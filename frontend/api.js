import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getToken, getRefreshToken, saveToken, saveRefreshToken } from './utils/authStorage';

// Backend temel URL'si
// - Android emülatörü: 10.0.2.2
// - USB ile bağlı Android/iOS fiziksel cihaz: localhost'a bağlanmak için adb reverse tercih edilir
// - EXPO_PUBLIC_API_BASE_URL ile geçersiz kılabilirsiniz (örn. http://192.168.1.10:5189)
export const API_BASE_URL = (() => {
  // Çalışma zamanındaki ortam değişkenini tercih et; yoksa app.json/app.config içindeki Expo extra'ya düş
  const fromEnv = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL)
    || (Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL)
    || (Constants?.expoConfig?.extra?.apiBaseUrl);
  const forceAndroidLocalhost = (
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ANDROID_USE_LOCALHOST === '1')
    || (Constants?.expoConfig?.extra?.EXPO_PUBLIC_ANDROID_USE_LOCALHOST === '1')
    || (Constants?.expoConfig?.extra?.androidUseLocalhost === true)
  );
  const platform = Platform.OS;
  const expoHost = Constants?.expoConfig?.host || Constants?.expoConfig?.hostUri || Constants?.manifest2?.hostUri;
  const debugInfo = {
    hasProcess: typeof process !== 'undefined',
    envVar: fromEnv,
    platform,
    expoHost
  };
  console.log('Environment check:', debugInfo);

  if (fromEnv) {
  // Native için sık karşılaşılan sorunları normalize et ve düzelt:
  // - https + self-signed sertifika -> cihaz/emülatörde Network Error
  // - Android'de localhost -> 10.0.2.2 kullanılmalı
  let envUrl = fromEnv.trim().replace(/\/$/, '');
  // <192.168.1.10> gibi yer tutucu kopyalardan kalan açı parantezlerini temizle
  envUrl = envUrl.replace(/[<>]/g, '');
    const lower = envUrl.toLowerCase();

  // Android'de localhost'a işaret ediyorsa, Expo host'una göre karar ver:
  // - Expo host localhost/127.0.0.1 ise (USB + --localhost), localhost'u KORU (adb reverse ile çalışır)
  // - Aksi halde (muhtemelen emülatör/LAN), 10.0.2.2 kullan
  if (platform === 'android' && (lower.includes('localhost') || lower.includes('127.0.0.1'))) {
      const expoHostStr = (expoHost || '').toLowerCase();
      const expoIsLocal = expoHostStr.includes('localhost') || expoHostStr.startsWith('127.0.0.1');
      if (forceAndroidLocalhost || expoIsLocal) {
  // Native'de HTTP'yi tercih et ve Kestrel'in varsayılan HTTPS portunu 7189'dan HTTP 5189'a eşle
        let adjusted = envUrl;
        if (platform !== 'web' && adjusted.toLowerCase().startsWith('https://')) {
          adjusted = 'http://' + adjusted.slice('https://'.length);
          adjusted = adjusted.replace(':7189', ':5189');
          console.log('ENV uses HTTPS; switching to HTTP for dev on native (localhost path):', adjusted);
        }
        const fixed = `${adjusted.replace(/\/$/, '')}/api`;
        console.log('ENV points to localhost on Android; keeping localhost (USB/--localhost or override):', fixed);
        return fixed;
      }
  // Expo LAN modda çalışıyorsa, fiziksel cihazlar için Expo host IP'sini tercih et
      const hostMatch = (expoHost || '').match(/^(.*):\d+$/);
      const expoHostIp = hostMatch ? hostMatch[1] : null;
      if (expoHostIp && expoHostIp !== 'localhost' && expoHostIp !== '127.0.0.1') {
        const fixedLan = `http://${expoHostIp}:5189/api`;
        console.log('ENV points to localhost on Android; Expo LAN detected, using host IP:', fixedLan);
        return fixedLan;
      }
  // Aksi halde emülatör varsay
      const fixed = `http://10.0.2.2:5189/api`;
      console.log('ENV points to localhost on Android; no LAN host, using emulator loopback:', fixed);
      return fixed;
    }

  // Native platformlarda, self-signed TLS sorunlarından kaçınmak için geliştirmede http'yi tercih et
    if (platform !== 'web' && lower.startsWith('https://')) {
      envUrl = 'http://' + envUrl.slice('https://'.length);
      envUrl = envUrl.replace(':7189', ':5189');
      console.log('ENV uses HTTPS; switching to HTTP for dev on native:', envUrl);
    }

  // envUrl protokol içermiyorsa http varsay
    if (!/^https?:\/\//i.test(envUrl)) {
      envUrl = `http://${envUrl}`;
    }

    console.log('Using API URL from environment (sanitized):', envUrl);
    return `${envUrl.replace(/\/$/, '')}/api`;
  }

  // Expo ile fiziksel cihazda çalışıyorsa, mümkünse Expo geliştirme sunucusunun LAN IP'sini kullan
  const hostFromExpo = (() => {
    const uri = expoHost || '';
    const match = uri.match(/^(.*):\d+$/);
    return match ? match[1] : null;
  })();

  if (hostFromExpo && hostFromExpo !== 'localhost' && hostFromExpo !== '127.0.0.1') {
    const url = `http://${hostFromExpo}:5189/api`;
    console.log('Using API URL from Expo LAN host:', url);
    return url;
  }

  // Expo host belirlenemediğinde Android Emülatör için geri dönüş
  if (platform === 'android') {
    const androidUrl = 'http://10.0.2.2:5189/api';
    console.log('FORCING Android API URL (emulator fallback):', androidUrl);
    return androidUrl;
  }

  // Varsayılan olarak localhost (iOS simülatörü veya web)
  const baseUrl = `http://localhost:5189/api`;
  console.log('Using default localhost API URL:', baseUrl);
  return baseUrl;
})();

console.log('Final API Base URL being used:', API_BASE_URL);

export const api = axios.create({
  // Sondaki eğik çizgiyi garanti et ki 'games' gibi göreli yollar '/api/games' olarak çözülsün
  baseURL: API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000  // 10 second timeout
});

// Oluşturulduktan sonra gerçek baseURL'i tekrar kontrol et
console.log('Axios instance baseURL:', api.defaults.baseURL);

// Token varsa isteğe ekle
api.interceptors.request.use(async (config) => {
  try {
  // Çağıranların Authorization header eklememeyi seçebilmesi için
  // istek ayarında `skipAuth: true` kullanmalarına izin ver.
    if (config && config.skipAuth) return config;

    const token = await getToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

// Not: Burada yolların başına '/' EKLEMEYİN. baseURL zaten '/api' ile biter.
export const authApi = {
  register: (payload) => {
    const logUrl = `${api.defaults.baseURL}auth/register`;
    console.log('Register API call to:', logUrl);
    return api.post('auth/register', payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
      skipAuth: true
    });
  },
  login: (payload) => {
    const logUrl = `${api.defaults.baseURL}auth/login`;
    console.log('Login API call to:', logUrl);
    return api.post('auth/login', payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
      skipAuth: true
    });
  },
  refresh: (refreshToken) => {
    const logUrl = `${api.defaults.baseURL}auth/refresh`;
    console.log('Refresh API call to:', logUrl);
    return api.post('auth/refresh', { refreshToken }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
      skipAuth: true
    });
  }
};

export default api;

// Yanıt interceptor'ı: 401 durumunda bir kez yenileme akışını dene
let isRefreshing = false;
let pendingQueue = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url = (original?.url || '').replace(/^\//, '');
    const isAuthEndpoint = url.endsWith('auth/login')
      || url.endsWith('auth/register')
      || url.endsWith('auth/refresh');
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !isAuthEndpoint
    ) {
      original._retry = true;
      try {
        if (isRefreshing) {
          // yenileme bitene kadar kuyruğa al
          const token = await new Promise((resolve, reject) => {
            pendingQueue.push({ resolve, reject });
          });
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
        isRefreshing = true;
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw error;
        const { data } = await authApi.refresh(refreshToken);
        const access = data.AccessToken ?? data.accessToken;
        const refresh = data.RefreshToken ?? data.refreshToken;
        if (!access) throw error;
        await saveToken(access);
        if (refresh) await saveRefreshToken(refresh);
        pendingQueue.forEach(p => p.resolve(access));
        pendingQueue = [];
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch (err) {
        pendingQueue.forEach(p => p.reject(err));
        pendingQueue = [];
        throw err;
      } finally {
        isRefreshing = false;
      }
    }
    throw error;
  }
);

// Oyunlar API yardımcıları
export const gamesApi = {
  // baseURL birleştirme tuzaklarından kaçınmak için mutlak yollar kullan
  list: () => api.get('games'),
  detail: (id) => api.get(`games/${id}`),
  create: (payload) => api.post('games/create', payload),
  join: (id, userId) => api.post(`games/${id}/join`, { UserId: userId }),
  global: () => api.get('games/global'),
  start: (id) => api.post(`games/${id}/start`),
  ready: (id, userId, isReady) => api.post(`games/${id}/ready`, { GameId: id, UserId: userId, IsReady: !!isReady }),
  draw: (id, userId) => api.post(`games/${id}/draw`, { GameId: id, UserId: userId }),
  result: (id) => api.get(`games/${id}/result`),
  state: (id) => api.get(`games/${id}/state`),
  delete: (id) => api.delete(`games/${id}`),
};

// Kullanıcılar API yardımcıları
export const usersApi = {
  history: (userId) => api.get(`users/${userId}/games`),
  profile: (userId) => api.get(`users/${userId}/profile`),
  stats: (userId) => api.get(`users/${userId}/stats`),
  recent: (userId) => api.get(`users/${userId}/recent-games`),
  updateUsername: (userId, username) => api.put(`users/${userId}/update-username`, { Username: username }),
  updateEmail: (userId, email) => api.put(`users/${userId}/update-email`, { Email: email }),
  updatePassword: (userId, currentPassword, newPassword) => api.put(`users/${userId}/update-password`, { CurrentPassword: currentPassword, NewPassword: newPassword }),
};

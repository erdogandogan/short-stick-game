import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getToken, getRefreshToken, saveToken, saveRefreshToken } from './utils/authStorage';

// Backend base URL
// - Android emulator: 10.0.2.2
// - Android/iOS physical device via USB: prefer adb reverse to localhost
// - You can override with EXPO_PUBLIC_API_BASE_URL (e.g., http://192.168.1.10:5189)
export const API_BASE_URL = (() => {
  // Prefer runtime env var; fallback to Expo extra in app.json/app.config
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
    // Normalize and fix common pitfalls for native:
    // - https + self-signed cert -> Network Error on device/emulator
    // - localhost on Android -> should use 10.0.2.2
  let envUrl = fromEnv.trim().replace(/\/$/, '');
  // Remove accidental angle brackets from placeholder copies like <192.168.1.10>
  envUrl = envUrl.replace(/[<>]/g, '');
    const lower = envUrl.toLowerCase();

    // If pointing to localhost on Android, decide based on Expo host:
    // - If Expo host is localhost/127.0.0.1 (USB + --localhost), KEEP localhost (works via adb reverse)
    // - Otherwise (likely emulator/LAN), use 10.0.2.2
  if (platform === 'android' && (lower.includes('localhost') || lower.includes('127.0.0.1'))) {
      const expoHostStr = (expoHost || '').toLowerCase();
      const expoIsLocal = expoHostStr.includes('localhost') || expoHostStr.startsWith('127.0.0.1');
      if (forceAndroidLocalhost || expoIsLocal) {
        // On native, prefer HTTP and map Kestrel's default HTTPS port 7189 -> HTTP 5189
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
      // If Expo is running in LAN mode, prefer Expo host IP for physical devices
      const hostMatch = (expoHost || '').match(/^(.*):\d+$/);
      const expoHostIp = hostMatch ? hostMatch[1] : null;
      if (expoHostIp && expoHostIp !== 'localhost' && expoHostIp !== '127.0.0.1') {
        const fixedLan = `http://${expoHostIp}:5189/api`;
        console.log('ENV points to localhost on Android; Expo LAN detected, using host IP:', fixedLan);
        return fixedLan;
      }
      // Otherwise assume emulator
      const fixed = `http://10.0.2.2:5189/api`;
      console.log('ENV points to localhost on Android; no LAN host, using emulator loopback:', fixed);
      return fixed;
    }

    // On native platforms, prefer http in dev to avoid self-signed TLS issues
    if (platform !== 'web' && lower.startsWith('https://')) {
      envUrl = 'http://' + envUrl.slice('https://'.length);
      envUrl = envUrl.replace(':7189', ':5189');
      console.log('ENV uses HTTPS; switching to HTTP for dev on native:', envUrl);
    }

    // If envUrl has no protocol, assume http
    if (!/^https?:\/\//i.test(envUrl)) {
      envUrl = `http://${envUrl}`;
    }

    console.log('Using API URL from environment (sanitized):', envUrl);
    return `${envUrl.replace(/\/$/, '')}/api`;
  }

  // If running on a physical device with Expo, use the LAN IP from the Expo dev server if available
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

  // Android Emulator fallback when no Expo host could be determined
  if (platform === 'android') {
    const androidUrl = 'http://10.0.2.2:5189/api';
    console.log('FORCING Android API URL (emulator fallback):', androidUrl);
    return androidUrl;
  }

  // Default to localhost (iOS simulator or web)
  const baseUrl = `http://localhost:5189/api`;
  console.log('Using default localhost API URL:', baseUrl);
  return baseUrl;
})();

console.log('Final API Base URL being used:', API_BASE_URL);

export const api = axios.create({
  // Ensure trailing slash so relative paths like 'games' resolve to '/api/games'
  baseURL: API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000  // 10 second timeout
});

// Double-check the actual baseURL after creation
console.log('Axios instance baseURL:', api.defaults.baseURL);

// Attach token if present
api.interceptors.request.use(async (config) => {
  try {
    const token = await getToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

// Note: Do NOT prefix paths with '/' here. baseURL already ends with '/api'.
export const authApi = {
  register: (payload) => {
    const url = `${API_BASE_URL}/auth/register`;
    console.log('Register API call to:', url);
    return axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
  },
  login: (payload) => {
    const url = `${API_BASE_URL}/auth/login`;
    console.log('Login API call to:', url);
    return axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
  },
  refresh: (refreshToken) => {
    const url = `${API_BASE_URL}/auth/refresh`;
    console.log('Refresh API call to:', url);
    return axios.post(url, { refreshToken }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
  }
};

export default api;

// Response interceptor: handle 401 by trying refresh flow once
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
          // queue until refresh finishes
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

// Games API helpers
export const gamesApi = {
  // Use absolute paths to avoid baseURL join pitfalls
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

// Users API helpers
export const usersApi = {
  history: (userId) => api.get(`users/${userId}/games`),
  profile: (userId) => api.get(`users/${userId}/profile`),
  stats: (userId) => api.get(`users/${userId}/stats`),
  recent: (userId) => api.get(`users/${userId}/recent-games`),
  updateUsername: (userId, username) => api.put(`users/${userId}/update-username`, { Username: username }),
  updateEmail: (userId, email) => api.put(`users/${userId}/update-email`, { Email: email }),
  updatePassword: (userId, currentPassword, newPassword) => api.put(`users/${userId}/update-password`, { CurrentPassword: currentPassword, NewPassword: newPassword }),
};

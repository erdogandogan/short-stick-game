import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'refresh_token';

// Prefer SecureStore on native when actually available; use AsyncStorage on web
async function canUseSecureStore() {
  try {
    if (Platform.OS === 'web') return false;
    if (!SecureStore?.isAvailableAsync) return false;
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

// Simple localStorage helpers for web
const webStorage = {
  get: (key) => {
    try { return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null; } catch { return null; }
  },
  set: (key, value) => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem(key, value); } catch {}
  },
  del: (key) => {
    try { if (typeof window !== 'undefined') window.localStorage.removeItem(key); } catch {}
  }
};

export async function saveToken(token) {
  try {
    if (Platform.OS === 'web') {
      webStorage.set(TOKEN_KEY, token);
    } else if (await canUseSecureStore()) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    }
  } catch {}
}

export async function getToken() {
  try {
    if (Platform.OS === 'web') {
      return webStorage.get(TOKEN_KEY);
    }
    if (await canUseSecureStore()) {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    }
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function deleteToken() {
  try {
    if (Platform.OS === 'web') {
      webStorage.del(TOKEN_KEY);
    } else if (await canUseSecureStore()) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

export async function saveRefreshToken(token) {
  try {
    if (Platform.OS === 'web') {
      webStorage.set(REFRESH_KEY, token);
    } else if (await canUseSecureStore()) {
      await SecureStore.setItemAsync(REFRESH_KEY, token);
    } else {
      await AsyncStorage.setItem(REFRESH_KEY, token);
    }
  } catch {}
}

export async function getRefreshToken() {
  try {
    if (Platform.OS === 'web') {
      return webStorage.get(REFRESH_KEY);
    }
    if (await canUseSecureStore()) {
      return await SecureStore.getItemAsync(REFRESH_KEY);
    }
    return await AsyncStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export async function deleteRefreshToken() {
  try {
    if (Platform.OS === 'web') {
      webStorage.del(REFRESH_KEY);
    } else if (await canUseSecureStore()) {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    } else {
      await AsyncStorage.removeItem(REFRESH_KEY);
    }
  } catch {}
}

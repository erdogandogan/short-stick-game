import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './ThemeContext';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const theme = useTheme();
  const [toast, setToast] = useState(null); // { type, title, message, id }
  const timerRef = useRef(null);
  const translate = useRef(new Animated.Value(80)).current; // from bottom
  const opacity = useRef(new Animated.Value(0)).current;

  const hide = useCallback((immediate = false) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const anim = Animated.parallel([
      Animated.timing(translate, { toValue: 80, duration: immediate ? 0 : 180, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: immediate ? 0 : 160, useNativeDriver: true }),
    ]);
    anim.start(() => setToast(null));
  }, [opacity, translate]);

  const show = useCallback((type, message, title) => {
    // collapse duplicates quickly
    const id = Date.now();
    setToast({ type, title, message, id });
    // animate in
    opacity.setValue(0);
    translate.setValue(80);
    Animated.parallel([
      Animated.timing(translate, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    // auto-hide
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => hide(false), 2800);
  }, [hide, opacity, translate]);

  useEffect(() => () => hide(true), [hide]);

  const api = useMemo(() => ({
    show,
    error: (msg, title = 'Hata') => show('error', msg, title),
    warn: (msg, title = 'Uyarı') => show('warn', msg, title),
    success: (msg, title = 'Başarılı') => show('success', msg, title),
    info: (msg, title = 'Bilgi') => show('info', msg, title),
    hide,
  }), [hide, show]);

  const colors = useMemo(() => ({
    error: { bg: theme.colors.danger, border: '#b91c1c' },
    warn: { bg: theme.colors.warn, border: '#b45309' },
    success: { bg: theme.colors.success, border: '#0f766e' },
    info: { bg: theme.colors.primary, border: '#6d28d9' },
  }), [theme.colors]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.wrap, {
            transform: [{ translateY: translate }],
            opacity,
          }]}
        >
          <View style={[
            styles.card,
            {
              backgroundColor: colors[toast.type]?.bg || theme.colors.primary,
              borderColor: colors[toast.type]?.border || theme.colors.cardBorder,
            }
          ]}>
            {!!toast.title && <Text style={styles.title}>{toast.title}</Text>}
            {!!toast.message && <Text style={styles.msg}>{toast.message}</Text>}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.select({ ios: 24, android: 24, default: 24 }),
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: { color: '#fff', fontFamily: 'LilitaOne_400Regular', marginBottom: 2 },
  msg: { color: '#fff', fontFamily: 'LilitaOne_400Regular' },
});

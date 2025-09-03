import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard, TouchableWithoutFeedback, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import ThreeDButton from '../components/ThreeDButton';

export default function RegisterScreen({ navigation }) {
  const theme = useTheme();
  const { register } = useAuth();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Android geri tuşu: Kayıt ekranındayken her zaman Başlangıç ("Test") ekranına git
  useFocusEffect(
    useCallback(() => {
      const onBack = () => { navigation.navigate('Test'); return true; };
  const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
  return () => sub?.remove();
    }, [navigation])
  );

  // Geri navigasyonunu (jestler veya programatik) yakala ve Başlangıç ekranına yönlendir
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP') {
        e.preventDefault();
        navigation.navigate('Test');
      }
    });
    return sub;
  }, [navigation]);

  const validate = () => {
  if (!username.trim() || !email.trim() || !password) { toast.warn('Lütfen tüm alanları doldurun'); return false; }
    const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;
  if (!emailRegex.test(email.trim())) { toast.warn('Lütfen geçerli bir e-posta girin'); return false; }
  if (password.length < 6) { toast.warn('Şifre en az 6 karakter olmalı'); return false; }
    return true;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    try {
      setSubmitting(true);
      await register({ username, email, password });
  // navigasyon, kimlik doğrulama bağlamına göre değişecek
    } catch (e) {
      const msg = e?.response?.data?.message || 'Kayıt basarısız';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
  <Text style={styles.title}>Kayıt Ol</Text>

      <TextInput
        style={styles.input}
        placeholder="Kullanıcı adı"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />

      <TextInput
        style={styles.input}
        placeholder="E-posta"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Sifre"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <ThreeDButton
        text={submitting ? 'Kaydediliyor…' : 'Kayıt Ol'}
        color={theme.colors.success}
        onPress={onSubmit}
        disabled={submitting}
        containerStyle={{ marginTop: 8 }}
      />

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Zaten hesabın var mı? Giris yap</Text>
      </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, marginBottom: 24, textAlign: 'center', fontFamily: 'LilitaOne_400Regular' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12, fontFamily: 'LilitaOne_400Regular', backgroundColor: '#fff' },
  button: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: 'LilitaOne_400Regular' },
  link: { color: '#1e90ff', textAlign: 'center', marginTop: 16 }
});

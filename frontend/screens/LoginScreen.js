import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard, TouchableWithoutFeedback, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import ThreeDButton from '../components/ThreeDButton';

export default function LoginScreen({ navigation }) {
  const theme = useTheme();
  const { login } = useAuth();
  const toast = useToast();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Android back button: always go to Start ("Test") when on Login
  useFocusEffect(
    useCallback(() => {
      const onBack = () => { navigation.navigate('Test'); return true; };
  const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
  return () => sub?.remove();
    }, [navigation])
  );

  // Intercept navigation back (gestures or programmatic) and route to Start
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
  if (!emailOrUsername.trim() || !password) { toast.warn('Lütfen tüm alanları doldurun'); return false; }
    return true;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    try {
      setSubmitting(true);
      await login({ emailOrUsername, password });
      // navigation will switch based on auth context
    } catch (e) {
      const msg = e?.response?.data?.message || 'Giris basarısız';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <Text style={styles.title}>Giris Yap</Text>

  <TextInput
        style={styles.input}
        placeholder="E-posta veya kullanıcı adı"
        autoCapitalize="none"
        value={emailOrUsername}
        onChangeText={setEmailOrUsername}
      />

  <TextInput
        style={styles.input}
        placeholder="Sifre"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

        <ThreeDButton
          text={submitting ? 'Giris yapılıyor…' : 'Giris Yap'}
          color={theme.colors.primary}
          onPress={onSubmit}
          disabled={submitting}
          containerStyle={{ marginTop: 8 }}
        />

      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Hesabın yok mu? Kayıt ol</Text>
      </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontFamily: 'LilitaOne_400Regular', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12, fontFamily: 'LilitaOne_400Regular', backgroundColor: '#fff' },
  button: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: 'LilitaOne_400Regular' },
  link: { color: '#1e90ff', textAlign: 'center', marginTop: 16 }
});

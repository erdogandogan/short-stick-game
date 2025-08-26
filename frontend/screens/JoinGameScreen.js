import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback} from 'react-native';
import { gamesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { canJoin } from '../utils/validation';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

export default function JoinGameScreen({ navigation }) {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const toast = useToast();
  const [code, setCode] = useState(''); // GameId or invite code
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => code.trim().length > 0 && !submitting, [code, submitting]);

  const onJoin = async () => {
  const raw = code.trim();
  const v = canJoin({ code: raw });
  if (!v.ok) { toast.warn(v.error); return; }
    if (!user?.id) {
  toast.error('Oturum bulunamadı, lütfen tekrar giriş yapın.');
      return;
    }
    try {
      setSubmitting(true);
      const { data } = await gamesApi.join(raw, user.id);
      const id = data?.Id || data?.id || raw;
      setCode('');
      navigation.replace('GameDetail', { gameId: id });
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) {
        await logout();
        return;
      }
      const msg = e?.response?.data?.message ||
        (status === 404 ? 'Oyun bulunamadı' : status === 409 ? 'Bu oyuna zaten katıldınız' : 'Katılım başarısız');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <Text style={styles.title}>Oyuna Katıl</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.colors.cardBorder }]}
            placeholder="GameId veya davet kodu"
            autoCapitalize="none"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
          />
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.success }, !canSubmit && styles.disabled]} onPress={onJoin} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Katıl</Text>}
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  button: { marginTop: 24, padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontFamily: 'LilitaOne_400Regular' },
  disabled: { opacity: 0.6 },
});

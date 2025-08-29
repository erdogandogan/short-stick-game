import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Pressable, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { gamesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { canCreateGame } from '../utils/validation';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import ThreeDButton from '../components/ThreeDButton';

export default function CreateGameScreen({ navigation }) {
  const theme = useTheme();
  const { logout } = useAuth();
  const toast = useToast();
  const [penaltyText, setPenaltyText] = useState('');
  const [gameType, setGameType] = useState(''); // 'friends' | 'global'
  const [submitting, setSubmitting] = useState(false);

  const onCreate = async () => {
    const v = canCreateGame({ penaltyText, gameType });
    if (!v.ok) { toast.warn(v.error); return; }
    try {
      setSubmitting(true);
      // Backend şu an GameType almıyor; ekstra alanı gönderirsek ASP.NET Core bunu yok sayar.
      const payload = { PenaltyText: penaltyText, GameType: gameType, IsGlobal: gameType === 'global' };
      const { data } = await gamesApi.create(payload);
      const id = data?.Id || data?.id;
      setPenaltyText('');
      setGameType('');
      navigation.replace('GameDetail', { gameId: id });
    } catch (e) {
      if (e?.response?.status === 401) {
        await logout();
        return;
      }
      const msg = e?.response?.data?.message || 'Oyun olusturulamadı';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
        <Text style={styles.title}>Yeni Oyun Olustur</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.colors.cardBorder }]}
          placeholder="Ceza metni"
          value={penaltyText}
          onChangeText={setPenaltyText}
          multiline
        />
        <Text style={styles.label}>Oyun Türü</Text>
        <View style={styles.radioRow}>
          <TouchableOpacity
            style={[styles.radioBtn, { borderColor: theme.colors.cardBorder }, gameType === 'friends' && { borderColor: theme.colors.primary, backgroundColor: '#eff6ff' }]}
            onPress={() => setGameType('friends')}
            disabled={submitting}
          >
            <View style={[styles.dot, { borderColor: theme.colors.neutral }, gameType === 'friends' && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary }]} />
            <Text style={styles.radioText}>Arkadaslar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.radioBtn, { borderColor: theme.colors.cardBorder }, gameType === 'global' && { borderColor: theme.colors.primary, backgroundColor: '#eff6ff' }]}
            onPress={() => setGameType('global')}
            disabled={submitting}
          >
            <View style={[styles.dot, { borderColor: theme.colors.neutral }, gameType === 'global' && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary }]} />
            <Text style={styles.radioText}>Global</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }} />
        <ThreeDButton
          color={theme.colors.primary}
          depthColor="#7C3AED"
          onPress={onCreate}
          disabled={submitting}
          style={{ marginTop: 24 }}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Oyun Olustur</Text>}
        </ThreeDButton>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'flex-start' },
  title: { fontSize: 20, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', fontFamily:'LilitaOne_400Regular', backgroundColor: '#fff' },
  label: { marginTop: 12, marginBottom: 8, color: '#111827' },
  radioRow: { flexDirection: 'row', gap: 8 },
  radioBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8, backgroundColor: '#fff' },
  dot: { width: 14, height: 14, borderRadius: 12, borderWidth: 2, marginRight: 8 },
  radioText: { color: '#111827' },
  button: { marginTop: 24, padding: 14, borderRadius: 8, alignItems: 'center' },
  disabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontFamily: 'LilitaOne_400Regular' },
});

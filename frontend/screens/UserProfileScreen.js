import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, FlatList, Alert, TextInput, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api';
import { getAvatarSource } from '../utils/avatars';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { formatDateTimeTRLocal } from '../utils/formatDate';

function camel(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const nk = k.charAt(0).toLowerCase() + k.slice(1);
    out[nk] = v;
  }
  return out;
}

export default function UserProfileScreen({ navigation }) {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // editable
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const [pRes, sRes, rRes] = await Promise.all([
        usersApi.profile(user.id),
        usersApi.stats(user.id),
        usersApi.recent(user.id)
      ]);
      const p = camel(pRes.data);
      const s = camel(sRes.data);
      const r = (rRes.data || []).map(camel);
      setProfile(p);
      setStats(s);
      setRecent(r);
      setUsername(p.username);
      setEmail(p.email);
    } catch (e) {
      if (e?.response?.status === 401) { await logout(); return; }
  console.error('Profile load error', e?.message);
  toast.error('Profil bilgileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [user?.id, logout]);

  useEffect(() => { load(); }, [load]);

  const onSaveUsername = async () => {
    if (!user?.id) return;
    try {
      setSaving(true);
      await usersApi.updateUsername(user.id, username);
  toast.success('Kullanıcı adı güncellendi');
      await load();
    } catch (e) {
  const msg = e?.response?.data?.message || 'Güncelleme basarısız';
  toast.error(msg);
    } finally { setSaving(false); }
  };

  const onSaveEmail = async () => {
    if (!user?.id) return;
    try {
      setSaving(true);
      await usersApi.updateEmail(user.id, email);
  toast.success('E-posta güncellendi');
      await load();
    } catch (e) {
  const msg = e?.response?.data?.message || 'Güncelleme basarısız';
  toast.error(msg);
    } finally { setSaving(false); }
  };

  const onSavePassword = async () => {
  if (!user?.id) return;
  if (!currentPassword || !newPassword) { toast.warn('Lütfen mevcut ve yeni sifreyi girin'); return; }
    try {
      setSaving(true);
      await usersApi.updatePassword(user.id, currentPassword, newPassword);
  toast.success('Şifre güncellendi');
      setCurrentPassword('');
      setNewPassword('');
    } catch (e) {
  const msg = e?.response?.data?.message || 'Güncelleme başarısız';
  toast.error(msg);
    } finally { setSaving(false); }
  };

  // Use local random avatar (based on user id) when no custom avatar URL is set
  const avatarSrc = useMemo(
    () => getAvatarSource(profile?.id || user?.id, profile?.avatarUrl),
    [profile?.id, profile?.avatarUrl, user?.id]
  );

  // Avatar for the user you played with the most
  const mostPlayedAvatarSrc = useMemo(() => {
    const uid = stats?.mostPlayedWithUserId;
    if (!uid) return null;
    return getAvatarSource(uid, null);
  }, [stats?.mostPlayedWithUserId]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" /></View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={{ padding: 16 }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderColor: theme.colors.cardBorder }]}>
        <Image source={avatarSrc} style={styles.avatar} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{profile?.username}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
          <Text style={styles.meta}>Toplam oyun: {profile?.totalGames} Tamamlanan: {profile?.completedGames}</Text>
        </View>
      </View>

      {/* Stats */}
  <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.cardBorder }]}>
        <Text style={styles.sectionTitle}>Oyun Istatistikleri</Text>
        <View style={styles.cardsRow}>
          <View style={[styles.card, { backgroundColor: '#e0f2fe' }]}>
            <Text style={styles.cardLabel}>Toplam</Text>
            <Text style={styles.cardValue}>{stats?.totalJoinedGames ?? 0}</Text>
          </View>
          <View style={[styles.card, { backgroundColor: '#dcfce7' }]}>
            <Text style={styles.cardLabel}>Kazandı</Text>
            <Text style={styles.cardValue}>{stats?.totalWins ?? 0}</Text>
          </View>
          <View style={[styles.card, { backgroundColor: '#fee2e2' }]}>
            <Text style={styles.cardLabel}>Kısa Çöp</Text>
            <Text style={styles.cardValue}>{stats?.totalShortStick ?? 0}</Text>
          </View>
        </View>
        {stats?.mostPlayedWithUsername ? (
          <View style={styles.mostRow}>
            <Text style={[styles.meta, styles.mostText]}>En çok oynanan <Text style={{ color: '#111827' }}>{stats.mostPlayedWithUsername}</Text></Text>
            {mostPlayedAvatarSrc ? (
              <Image source={mostPlayedAvatarSrc} style={styles.mostAvatar} />
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Recent games */}
  <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.cardBorder }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.sectionTitle}>Son Oyunlar</Text>
          <TouchableOpacity onPress={() => navigation.navigate('UserGameHistory')}>
            <Text style={styles.link}>Tümünü gör</Text>
          </TouchableOpacity>
        </View>
        {recent.length === 0 ? (
          <Text style={styles.meta}>Kayıt yok</Text>
        ) : (
          recent.map((g) => (
            <View key={String(g.gameId)} style={styles.recentItem}>
              <Text style={styles.recentTitle}>#{String(g.gameId).slice(0, 8)} • {g.completedAt ? formatDateTimeTRLocal(g.completedAt) : (g.startedAt ? formatDateTimeTRLocal(g.startedAt) : '')}</Text>
              <Text style={styles.recentSub}>{g.isShortStick ? 'Kısa çöp çektin' : 'Kurtuldun'} • {g.penaltyText}</Text>
            </View>
          ))
        )}
      </View>

      {/* Settings */}
      <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.cardBorder }]}>
        <Text style={styles.sectionTitle}>Kisisellestirme</Text>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Kullanıcı adı</Text>
          <TextInput style={[styles.input, { backgroundColor: '#f3f4f6', borderColor: theme.colors.cardBorder }]} value={username} onChangeText={setUsername} autoCapitalize="none" />
          <TouchableOpacity style={styles.saveBtn} onPress={onSaveUsername} disabled={saving}><Text style={styles.saveText}>Kaydet</Text></TouchableOpacity>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>E-posta</Text>
          <TextInput style={[styles.input, { backgroundColor: '#f3f4f6', borderColor: theme.colors.cardBorder }]} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TouchableOpacity style={styles.saveBtn} onPress={onSaveEmail} disabled={saving}><Text style={styles.saveText}>Kaydet</Text></TouchableOpacity>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Mevcut Sifre</Text>
          <TextInput style={[styles.input, { backgroundColor: '#f3f4f6', borderColor: theme.colors.cardBorder }]} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Yeni Sifre</Text>
          <TextInput style={[styles.input, { backgroundColor: '#f3f4f6', borderColor: theme.colors.cardBorder }]} value={newPassword} onChangeText={setNewPassword} secureTextEntry />
        </View>
        <TouchableOpacity style={[styles.saveBtn, { alignSelf: 'flex-start', backgroundColor: '#111827' }]} onPress={onSavePassword} disabled={saving}><Text style={styles.saveText}>Sifreyi Güncelle</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#e5e7eb' },
  name: { fontSize: 18, fontFamily: 'LilitaOne_400Regular', color: '#111827' },
  email: { color: '#6b7280', marginTop: 2, fontFamily: 'LilitaOne_400Regular' },
  meta: { color: '#6b7280', marginTop: 6, fontFamily: 'LilitaOne_400Regular' },
  section: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'LilitaOne_400Regular', color: '#111827', marginBottom: 12 },
  cardsRow: { flexDirection: 'row', gap: 12 },
  card: { flex: 1, padding: 12, borderRadius: 12 },
  cardLabel: { color: '#374151' },
  cardValue: { fontSize: 20, fontFamily: 'LilitaOne_400Regular', color: '#111827', marginTop: 4 },
  link: { color: '#2563eb', fontFamily: 'LilitaOne_400Regular' },
  recentItem: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  recentTitle: { fontFamily: 'LilitaOne_400Regular', color: '#111827' },
  recentSub: { color: '#6b7280', marginTop: 2 },
  mostRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  mostAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#e5e7eb' },
  mostText: { marginTop: 0, lineHeight: 20 },
  fieldRow: { marginBottom: 12 },
  label: { color: '#374151', marginBottom: 6 },
  input: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, fontFamily: 'LilitaOne_400Regular' },
  saveBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  saveText: { color: '#fff', fontFamily: 'LilitaOne_400Regular' }
});

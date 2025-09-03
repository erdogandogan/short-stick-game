import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Image } from 'react-native';
import ThreeDButton from '../components/ThreeDButton';
import { getAvatarSource } from '../utils/avatars';
import { gamesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

function normalize(r) {
  if (!r) return null;
  return {
    gameId: r.GameId ?? r.gameId,
    penaltyText: r.PenaltyText ?? r.penaltyText,
    isStarted: r.IsStarted ?? r.isStarted,
    isCompleted: r.IsCompleted ?? r.isCompleted,
    shortStickUserId: r.ShortStickUserId ?? r.shortStickUserId,
    shortStickUsername: r.ShortStickUsername ?? r.shortStickUsername,
    results: (r.Results ?? r.results ?? []).map(x => ({
      userId: x.UserId ?? x.userId,
      username: x.Username ?? x.username,
      isShortStick: x.IsShortStick ?? x.isShortStick,
      drawOrder: x.DrawOrder ?? x.drawOrder,
    })),
  };
}

export default function ResultScreen({ route, navigation }) {
  const { gameId } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const me = user?.id;
  const theme = useTheme();
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await gamesApi.result(gameId);
      setData(normalize(res.data));
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => { load(); }, [load]);

  // Başlık için kendi sonucumu belirle
  const myRes = useMemo(() => {
    if (!data || !me) return null;
    return (data.results || []).find(r => String(r.userId) === String(me));
  }, [data, me]);

  if (loading) return (<View style={[styles.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" /></View>);
  if (!data) return (<View style={[styles.center, { backgroundColor: theme.colors.background }]}><Text>Sonuç bulunamadı.</Text></View>);

  const winnerName = data.shortStickUsername || 'Bilinmiyor';
  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <Text style={[styles.order, item.isShortStick && styles.orderLose]}>#{item.drawOrder ?? '-'}</Text>
  <Image source={ getAvatarSource(item.userId) } style={styles.avatar} />
      <Text style={[styles.name, item.isShortStick && { color: '#991b1b' }]}>{item.username}</Text>
      <Text style={[styles.badge, item.isShortStick ? styles.badgeLose : styles.badgeWin]}>
        {item.isShortStick ? 'Kısa' : 'Uzun'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.cardBorder }]}> 
        <Text style={styles.title}>Oyun Tamamlandı</Text>
        <Text style={[styles.winner, { color: theme.colors.danger }]}>Kısa çubugu çeken: {winnerName}</Text>
        <Text style={styles.penaltyLabel}>Ceza</Text>
        <Text style={styles.penaltyText}>{data.penaltyText}</Text>
      </View>
      {/* Personal banner */}
      {myRes ? (
        <View style={[
          styles.banner,
          myRes.isShortStick ? styles.bannerLose : styles.bannerWin
        ]}>
          <Text style={[styles.bannerText, styles.bannerTextLight]}>
            {myRes.isShortStick ? 'Kaybettiniz' : 'Kazandınız'}
          </Text>
        </View>
      ) : null}
      <Text style={styles.section}>Çekme Sırası ve Sonuçlar</Text>
      <FlatList
        data={[...data.results].sort((a,b) => a.drawOrder - b.drawOrder)}
        keyExtractor={(it) => String(it.userId)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
      <View style={[styles.footer, { backgroundColor: theme.colors.surface }]}> 
        <ThreeDButton
          text={"Ana Sayfaya Dön"}
          onPress={() => navigation.navigate('Home')}
          color={theme.colors.primary}
          containerStyle={{ height: 52 }}
          textStyle={styles.homeText}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 30, fontFamily: 'LilitaOne_400Regular', color: '#111827', textAlign: 'center' },
  winner: { marginTop: 6, fontSize: 20, fontFamily: 'LilitaOne_400Regular', textAlign: 'center' },
  penaltyLabel: { marginTop: 10, fontSize: 12, fontFamily: 'LilitaOne_400Regular', color: '#6b7280', textAlign: 'center' },
  penaltyText: { fontSize: 16, fontFamily: 'LilitaOne_400Regular', color: '#111827', textAlign: 'center' },
  banner: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 12, borderWidth: 1 },
  bannerText: { fontSize: 20, fontFamily: 'LilitaOne_400Regular', textAlign: 'center' },
  bannerWin: { backgroundColor: '#10b981', borderColor: '#10b981' },
  bannerLose: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  bannerTextLight: { color: '#fff' },
  win: { color: '#065f46' },
  lose: { color: '#991b1b' },
  section: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, fontFamily: 'LilitaOne_400Regular', color: '#111827' },
  row: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomColor: '#f3f4f6', borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e5e7eb' },
  order: { width: 40, textAlign: 'center', color: '#1e3a8a', fontWeight: '700' },
  orderLose: { color: '#991b1b' },
  name: { flex: 1, color: '#111827', fontWeight: '600' },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, color: '#fff', overflow: 'hidden', fontWeight: '700' },
  badgeWin: { backgroundColor: '#10b981' },
  badgeLose: { backgroundColor: '#ef4444' },
  footer: { padding: 16 },
  homeBtn: { padding: 14, borderRadius: 10, alignItems: 'center' },
  homeText: { color: '#fff', fontFamily: 'LilitaOne_400Regular' },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, RefreshControl, Image } from 'react-native';
import { gamesApi } from '../api';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { formatDateTimeTRLocal } from '../utils/formatDate';
import { getUserNameColor } from '../utils/getUserNameColor';

// renk mantığı ../utils/getUserNameColor içine çıkarıldı

function toDetailModel(d) {
  if (!d) return null;
  return {
    id: d.Id ?? d.id,
    penaltyText: d.PenaltyText ?? d.penaltyText,
    isStarted: d.IsStarted ?? d.isStarted,
    isGlobal: d.IsGlobal ?? d.isGlobal,
    createdDate: d.CreatedDate ?? d.createdDate,
    creatorUserId: d.CreatorUserId ?? d.creatorUserId,
    participants: (d.Participants ?? d.participants ?? []).map((p) => ({
      userId: p.UserId ?? p.userId,
      username: p.Username ?? p.username,
      joinDate: p.JoinDate ?? p.joinDate,
      hasDrawn: p.HasDrawn ?? p.hasDrawn,
      isShortStick: p.IsShortStick ?? p.isShortStick,
      drawOrder: p.DrawOrder ?? p.drawOrder,
    })),
  };
}

export default function GameHistoryDetailScreen({ route }) {
  const { gameId } = route.params;
  const theme = useTheme();
  const toast = useToast();
  const [detail, setDetail] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await gamesApi.detail(gameId);
      setDetail(toDetailModel(res.data));
      const r = await gamesApi.result(gameId);
      const data = r.data || {};
      setResult({
        isCompleted: data.IsCompleted ?? data.isCompleted,
        shortStickUserId: data.ShortStickUserId ?? data.shortStickUserId,
        shortStickUsername: data.ShortStickUsername ?? data.shortStickUsername,
        results: (data.Results ?? data.results ?? []).map(x => ({
          userId: x.UserId ?? x.userId,
          username: x.Username ?? x.username,
          isShortStick: x.IsShortStick ?? x.isShortStick,
          drawOrder: x.DrawOrder ?? x.drawOrder,
        }))
      });
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gameId]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => (detail?.participants || []).sort((a, b) => {
    const ao = a.drawOrder ?? 9999; const bo = b.drawOrder ?? 9999; return ao - bo;
  }), [detail]);

  const renderItem = ({ item }) => {
    const isShort = item.isShortStick || result?.shortStickUserId === item.userId;
    const nameColor = getUserNameColor(item.userId || item.username);
    return (
      <View style={[styles.row, isShort && styles.rowShort]}>
  {/* Baş harflerle basit yer tutucu avatar */}
        <View style={styles.avatar}><Text style={styles.avatarText}>{(item.username || '?').slice(0,1).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: nameColor }, isShort && styles.highlight]} numberOfLines={1}>{item.username}</Text>
          <Text style={styles.sub}>Sıra: {item.drawOrder ?? '-'}  •  {item.hasDrawn ? (item.isShortStick ? 'Kısa' : 'Uzun') : 'Çekmedi'}</Text>
        </View>
      </View>
    );
  };

  if (loading) return (<View style={[styles.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" /></View>);
  if (!detail) return (<View style={[styles.center, { backgroundColor: theme.colors.background }]}><Text>Kayıt bulunamadı</Text></View>);

  const shortColor = result?.shortStickUsername
    ? getUserNameColor(result.shortStickUserId || result.shortStickUsername)
    : undefined;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.headerBox, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.cardBorder }]}>
        <Text style={[styles.title, { color: theme.colors.info }]}>{detail.isGlobal ? 'Global Oyun' : 'Arkadas Oyunu'}</Text>
        <Text style={[styles.penalty, { color: theme.colors.primary }]}>{detail.penaltyText}</Text>
  <Text style={[styles.meta, { color: theme.colors.textMuted }]}>Olusturma: {formatDateTimeTRLocal(detail.createdDate)}</Text>
        {result?.shortStickUsername ? (
          <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
            Kısa çöp: <Text style={[styles.shortName, shortColor && { color: shortColor }]}>{result.shortStickUsername}</Text>
          </Text>
        ) : null}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Katılımcılar</Text>
      <FlatList
        data={sorted}
        keyExtractor={(it) => String(it.userId)}
        renderItem={({ item }) => {
          const isShort = item.isShortStick || result?.shortStickUserId === item.userId;
          const nameColor = getUserNameColor(item.userId || item.username);
          return (
            <View style={[
              styles.row,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.cardBorder },
              isShort && { borderColor: theme.colors.danger, backgroundColor: '#fff1f2' }
            ]}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(item.username || '?').slice(0,1).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: nameColor }, isShort && { color: theme.colors.danger }]} numberOfLines={1}>{item.username}</Text>
                <Text style={[styles.sub, { color: theme.colors.textMuted }]}>Sıra: {item.drawOrder ?? '-'}  •  {item.hasDrawn ? (item.isShortStick ? 'Kısa' : 'Uzun') : 'Çekmedi'}</Text>
              </View>
            </View>
          );
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBox: { padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 12 },
  penalty: { fontSize: 18, marginTop: 4 },
  meta: { marginTop: 6, fontFamily: 'LilitaOne_400Regular' },
  highlight: { color: '#b91c1c' },
  shortName: { fontFamily: 'LilitaOne_400Regular' },
  sectionTitle: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontSize: 16 },
  row: { marginHorizontal: 12, marginBottom: 10, padding: 12, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowShort: { },
  name: { },
  sub: { marginTop: 2, fontFamily: 'LilitaOne_400Regular' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#374151' },
});

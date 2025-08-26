import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api';

// Same deterministic color palette logic as HomeScreen/GamePlay
function getUserNameColor(key) {
  const k = String(key || '');
  let hash = 0;
  for (let i = 0; i < k.length; i++) {
    hash = (hash << 5) - hash + k.charCodeAt(i);
    hash |= 0;
  }
  const palette = [
    '#EF4444', // red-500
    '#F59E0B', // amber-500
    '#10B981', // emerald-500
    '#3B82F6', // blue-500
    '#8B5CF6', // violet-500
    '#EC4899', // pink-500
    '#14B8A6', // teal-500
    '#F97316', // orange-500
    '#84CC16', // lime-500
    '#06B6D4', // cyan-500
  ];
  const idx = Math.abs(hash) % palette.length;
  return palette[idx];
}

function toItem(x) {
  if (!x) return null;
  return {
    gameId: x.GameId ?? x.gameId,
    isGlobal: x.IsGlobal ?? x.isGlobal,
    penaltyText: x.PenaltyText ?? x.penaltyText,
    startedAt: x.StartedAt ?? x.startedAt,
    completedAt: x.CompletedAt ?? x.completedAt,
    shortStickUserId: x.ShortStickUserId ?? x.shortStickUserId,
    shortStickUsername: x.ShortStickUsername ?? x.shortStickUsername,
    participants: (x.Participants ?? x.participants ?? []).map(p => ({
      userId: p.UserId ?? p.userId,
      username: p.Username ?? p.username,
    }))
  };
}

export default function GameHistoryScreen({ navigation }) {
  const theme = useTheme();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await usersApi.history(user.id);
      const list = (data || []).map(toItem);
      setItems(list);
    } catch (e) {
      console.error('History fetch error', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }) => {
    const shortColor = getUserNameColor(item.shortStickUserId || item.shortStickUsername);
    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('GameHistoryDetail', { gameId: item.gameId })}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.type}>{item.isGlobal ? 'Global' : 'Arkadaş'}</Text>
          <Text style={styles.date}>{item.completedAt ? new Date(item.completedAt).toLocaleString() : (item.startedAt ? new Date(item.startedAt).toLocaleString() : '')}</Text>
        </View>
        <Text style={styles.penalty} numberOfLines={2}>{item.penaltyText}</Text>
        {item.shortStickUsername ? (
          <Text style={styles.short}>Kısa çöp: <Text style={[styles.shortName, { color: shortColor }]}>{item.shortStickUsername}</Text></Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const empty = (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyText}>Henüz bir oyuna katılmadınız</Text>
    </View>
  );

  if (loading) return (<View style={[styles.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" /></View>);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.gameId)}
        renderItem={({ item }) => {
          const shortColor = getUserNameColor(item.shortStickUserId || item.shortStickUsername);
          return (
            <TouchableOpacity style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.cardBorder }]} onPress={() => navigation.navigate('GameHistoryDetail', { gameId: item.gameId })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[styles.type, { color: theme.colors.info }]}>{item.isGlobal ? 'Global' : 'Arkadaş'}</Text>
                <Text style={[styles.date, { color: theme.colors.textMuted }]}>{item.completedAt ? new Date(item.completedAt).toLocaleString() : (item.startedAt ? new Date(item.startedAt).toLocaleString() : '')}</Text>
              </View>
              <Text style={[styles.penalty, { color: theme.colors.primary }]} numberOfLines={2}>{item.penaltyText}</Text>
              {item.shortStickUsername ? (
                <Text style={[styles.short, { color: theme.colors.textPrimary }]}>Kısa çöp: <Text style={[styles.shortName, { color: shortColor }]}>{item.shortStickUsername}</Text></Text>
              ) : null}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={empty}
        contentContainerStyle={items.length === 0 ? { flex: 1 } : { padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  type: { fontSize: 12 },
  date: { fontSize: 12 },
  penalty: { marginTop: 6, color: '#8B5CF6' },
  short: { marginTop: 6, fontFamily: 'LilitaOne_400Regular' },
  shortName: { fontFamily: 'LilitaOne_400Regular' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#6b7280' },
});

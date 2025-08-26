import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api';
import { useTheme } from '../context/ThemeContext';

function toItem(x) {
  return {
    gameId: x.GameId ?? x.gameId,
    isGlobal: x.IsGlobal ?? x.isGlobal,
    penaltyText: x.PenaltyText ?? x.penaltyText,
    startedAt: x.StartedAt ?? x.startedAt,
    completedAt: x.CompletedAt ?? x.completedAt,
    shortStickUserId: x.ShortStickUserId ?? x.shortStickUserId,
    shortStickUsername: x.ShortStickUsername ?? x.shortStickUsername,
  };
}

export default function UserGameHistoryScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await usersApi.history(user.id);
      setItems((data || []).map(toItem));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (<View style={[styles.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" /></View>);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.gameId)}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.cardBorder }]}>
            <Text style={styles.title}>#{String(item.gameId).slice(0, 8)} • {item.isGlobal ? 'Global' : 'Arkadaş'}</Text>
            <Text style={styles.penalty} numberOfLines={2}>{item.penaltyText}</Text>
            {item.shortStickUsername ? (
              <Text style={styles.short}>Kısa çöp: <Text>{item.shortStickUsername}</Text></Text>
            ) : null}
          </View>
        )}
        contentContainerStyle={items.length === 0 ? { flex: 1, alignItems: 'center', justifyContent: 'center' } : { padding: 12 }}
        ListEmptyComponent={<Text style={{ color: '#6b7280' }}>Kayıt yok</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  title: { fontSize: 12, color: '#6b7280', fontFamily: 'LilitaOne_400Regular' },
  penalty: { marginTop: 6, fontSize: 16, color: '#111827', fontFamily: 'LilitaOne_400Regular' },
  short: { marginTop: 6, color: '#1f2937', fontFamily: 'LilitaOne_400Regular' },
});

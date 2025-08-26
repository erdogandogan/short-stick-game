import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Alert, ScrollView, StatusBar, ImageBackground, Image } from 'react-native';
import { LinearGradient as LG } from 'expo-linear-gradient';
import { useToast } from '../context/ToastContext';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { gamesApi } from '../api';
import GameCard from '../components/GameCard';
import { getAvatarSource } from '../utils/avatars';

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [games, setGames] = useState([]);
  const [filter, setFilter] = useState('all'); // all | mine | joined | global | active | completed
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [buttonsTop, setButtonsTop] = useState(null); // for fade overlay positioning
  const [buttonsHeight, setButtonsHeight] = useState(0); // for list bottom padding

  // Match avatar logic with UserProfileScreen: use assigned URL if present,
  // otherwise deterministic local monster by user id.
  const avatarSrc = useMemo(
    () => getAvatarSource(user?.id, user?.avatarUrl),
    [user?.id, user?.avatarUrl]
  );

  // Deterministic color per user for the username label
  const userNameColor = useMemo(() => {
    const key = String(user?.id || user?.username || user?.email || '');
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
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
  }, [user?.id, user?.username, user?.email]);

  const fetchGames = useCallback(async () => {
    try {
      const { data } = await gamesApi.list();
      // Expect PascalCase from .NET; normalize to camelCase for JS
      const normalized = data.map((g) => ({
        id: g.Id ?? g.id,
        penaltyText: g.PenaltyText ?? g.penaltyText,
        isStarted: g.IsStarted ?? g.isStarted,
        isCompleted: g.IsCompleted ?? g.isCompleted,
  isGlobal: g.IsGlobal ?? g.isGlobal,
        createdDate: g.CreatedDate ?? g.createdDate,
        startedDate: g.StartedDate ?? g.startedDate,
        completedDate: g.CompletedDate ?? g.completedDate,
        creatorUserId: g.CreatorUserId ?? g.creatorUserId,
        participantCount: g.ParticipantCount ?? g.participantCount,
        isOwner: g.IsOwner ?? g.isOwner,
      }));
  setGames(normalized);
    } catch (e) {
      if (e?.response?.status === 401) {
        // token invalid; force logout to go login screen
        await logout();
        return;
      }
  console.error('Games fetch error:', e?.message, e?.response?.data);
  toast.error('Oyunlar yüklenirken bir sorun oluştu');
    } finally {
      // Avoid flicker after logout redirect
      setLoading((prev) => (prev ? false : prev));
      setRefreshing(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Refetch whenever the screen gains focus (e.g., returning from Create or Detail)
  useFocusEffect(
    useCallback(() => {
      // Avoid double spinner: use pull-to-refresh state when refocusing after initial load
      if (!loading) {
        setRefreshing(true);
      }
      fetchGames();
    }, [fetchGames, loading])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGames();
  }, [fetchGames]);

  const onJoinInline = async (item) => {
    if (!user?.id) return;
    try {
      setJoiningId(item.id);
      const { data } = await gamesApi.join(item.id, user.id);
      const id = data?.Id || data?.id || item.id;
      navigation.navigate('GameDetail', { gameId: id });
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) { await logout(); return; }
  toast.error(e?.response?.data?.message || 'Katılım başarısız');
    } finally {
      setJoiningId(null);
    }
  };

  const renderItem = ({ item }) => {
    const canJoin = !item.isOwner; // not owner; backend Join checks started state
    const onDelete = async () => {
      Alert.alert('Sil', 'Bu oyunu silmek istediğine emin misin?', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil', style: 'destructive', onPress: async () => {
            try {
              await gamesApi.delete(item.id);
              setGames((prev) => prev.filter((g) => g.id !== item.id));
            } catch (e) {
              const status = e?.response?.status;
              if (status === 401) { await logout(); return; }
              const msg = e?.response?.data?.message || 'Silme işlemi başarısız';
              toast.error(msg);
            }
          }
        }
      ]);
    };
    return (
      <GameCard
        item={item}
        onPress={() => navigation.navigate('GameDetail', { gameId: item.id })}
        showJoin={canJoin}
        joining={joiningId === item.id}
        onJoin={onJoinInline}
        onDelete={onDelete}
      />
    );
  };

  const ListEmpty = () => (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyText}>Henüz bir oyunun yok. Bir oyun oluştur ve arkadaşlarını davet et.</Text>
    </View>
  );

  const filteredGames = useMemo(() => {
    switch (filter) {
      case 'mine':
        return games.filter((g) => g.isOwner);
      case 'joined':
        return games.filter((g) => !g.isOwner);
      case 'global':
        return games.filter((g) => g.isGlobal);
      case 'active':
        return games.filter((g) => g.isStarted && !g.isCompleted);
      case 'completed':
        return games.filter((g) => g.isCompleted);
      case 'all':
      default:
  // Exclude completed games from the 'All' view; show them only in 'completed'
  return games.filter((g) => !g.isCompleted);
    }
  }, [games, filter]);

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ecfdf5" />
      <View style={styles.container}>
      <ImageBackground
        source={avatarSrc}
        style={styles.header}
        imageStyle={styles.headerImage}
      >
        <TouchableOpacity onPress={() => navigation.navigate('UserProfile')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ marginRight: 8 }}>
            <Image
              source={avatarSrc}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#d1fae5' }}
            />
          </View>
          <View>
            <Text style={styles.greet}>Merhaba</Text>
            <Text style={[styles.userName, { color: userNameColor }]}>{user?.username || user?.email}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Kapat</Text>
        </TouchableOpacity>
      </ImageBackground>

      {/* Filters - horizontal scroll */}
      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {[
            { key: 'all', label: 'Tümü' },
            { key: 'mine', label: 'Benim' },
            { key: 'joined', label: 'Katıldıgım' },
            { key: 'global', label: 'Global' },
            { key: 'active', label: 'Aktif' },
            { key: 'completed', label: 'Bitti' },
          ].map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} style={[styles.filterBtn, active && styles.filterBtnActive]}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator size="large" /></View>
      ) : (
        <FlatList
          data={filteredGames}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            filteredGames.length === 0 ? { flex: 1 } : { paddingVertical: 8 },
            { paddingBottom: Math.max(buttonsHeight + 24, 24) }, // ensure content can scroll under bottom buttons
          ]}
          ListEmptyComponent={<ListEmpty />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {/* Fade overlay starting from the very bottom */}
      {(LG || View) === View ? (
        <View style={[styles.fadeOverlay, { bottom: 0 }]} />
      ) : (
      <LG
        pointerEvents="none"
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        colors={[
          'rgba(236,253,245,0.95)',
          'rgba(236,253,245,0.5)',
          'rgba(236,253,245,0)',
        ]}
        locations={[0, 0.5, 1]}
        style={[styles.fadeOverlay, { bottom: 0 }]}
      />)}


      <View
        style={styles.bottomButtons}
        onLayout={({ nativeEvent }) => {
          setButtonsTop(nativeEvent.layout.y);
          setButtonsHeight(nativeEvent.layout.height);
        }}
      >
        {/* 3D Button: Yeni Oyun */}
        <View style={styles.buttonCol}>
          <View style={[styles.btn3DWrap]}>
            <View style={[styles.btnDepth, { backgroundColor: '#0284c7' }]} />
            <Pressable
              onPress={() => navigation.navigate('CreateGame')}
              style={({ pressed }) => [
                styles.btnSurface,
                { backgroundColor: '#0ea5e9' },
                pressed && styles.btnSurfacePressed,
              ]}
            >
              <Text style={styles.actionText}>+ Yeni Oyun</Text>
            </Pressable>
          </View>
        </View>

        {/* 3D Button: Oyuna Katıl */}
        <View style={styles.buttonCol}>
          <View style={[styles.btn3DWrap]}>
            <View style={[styles.btnDepth, { backgroundColor: '#16a34a' }]} />
            <Pressable
              onPress={() => navigation.navigate('JoinGame')}
              style={({ pressed }) => [
                styles.btnSurface,
                { backgroundColor: '#22c55e' },
                pressed && styles.btnSurfacePressed,
              ]}
            >
              <Text style={styles.actionText}>Oyuna Katıl</Text>
            </Pressable>
          </View>
        </View>

        {/* 3D Button: Oynadıklarım */}
        <View style={styles.buttonCol}>
          <View style={[styles.btn3DWrap]}>
            <View style={[styles.btnDepth, { backgroundColor: '#4b5563' }]} />
            <Pressable
              onPress={() => navigation.navigate('GameHistory')}
              style={({ pressed }) => [
                styles.btnSurface,
                { backgroundColor: userNameColor },
                pressed && styles.btnSurfacePressed,
              ]}
            >
              <Text style={styles.actionText}>Oynadıklarım</Text>
            </Pressable>
          </View>
        </View>
      </View>
      </View>
  </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ecfdf5' },
  container: { flex: 1, backgroundColor: '#ecfdf5' },
  header: { paddingHorizontal: 16, paddingBottom: 4, backgroundColor: '#ecfdf5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerImage: { resizeMode: 'cover', opacity: 0.08 },
  greet: { color: '#047857', fontSize: 12 },
  userName: { fontSize: 18, color: '#065f46', fontFamily: 'LilitaOne_400Regular' },
  logoutBtn: { backgroundColor: '#ef4444', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  logoutText: { color: '#fff', fontFamily: 'LilitaOne_400Regular' },
  filtersWrap: { backgroundColor: '#ecfdf5' },
  filtersRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: '#d1fae5' },
  filterBtnActive: { backgroundColor: '#22c55e' },
  filterText: { color: '#065f46', fontSize: 12, fontFamily: 'LilitaOne_400Regular' },
  filterTextActive: { color: '#ffffff' },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: '#065f46', textAlign: 'center' },
  fadeOverlay: { position: 'absolute', left: 0, right: 0, height: 96, zIndex: 1 },
  bottomButtons: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  actionText: { color: '#fff', fontFamily: 'LilitaOne_400Regular' },
  // 3D buttons
  buttonCol: { flex: 1 },
  btn3DWrap: { position: 'relative', height: 52 },
  btnDepth: {
    position: 'absolute', left: 0, right: 0, bottom: 0, top: 4,
    borderRadius: 12,
  },
  btnSurface: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 4,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  btnSurfacePressed: {
    transform: [{ translateY: 4 }],
    bottom: 0,
    shadowOpacity: 0.05,
    elevation: 1,
  },
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, RefreshControl, TouchableOpacity, Alert, Image, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { gamesApi } from '../api';
import { addListener, subscribe, unsubscribe } from '../utils/ws';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { canShowDrawButton, canShowStartButton } from '../utils/gameUi';
import { getAvatarSource } from '../utils/avatars';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../context/ToastContext';

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
  avatarUrl: p.AvatarUrl ?? p.avatarUrl,
      joinDate: p.JoinDate ?? p.joinDate,
  isReady: p.IsReady ?? p.isReady,
      hasDrawn: p.HasDrawn ?? p.hasDrawn,
      isShortStick: p.IsShortStick ?? p.isShortStick,
      drawOrder: p.DrawOrder ?? p.drawOrder,
    })),
  };
}

function formatDateTimeTR(dateVal) {
  const d = new Date(dateVal);
  if (isNaN(d)) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${h}.${m}`;
}

// Reusable 3D button used in actions grid
function Button3D({ color, depthColor, onPress, disabled, style, children }) {
  return (
    <View style={[{ flexGrow: 1 }, style]}>
      <View style={{ position: 'relative', height: 52 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 4, bottom: 0, borderRadius: 12, backgroundColor: depthColor }} />
        <Pressable
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => ([
            { position: 'absolute', left: 0, right: 0, top: 0, bottom: 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: color,
              shadowColor: '#000', shadowOpacity: pressed ? 0.05 : 0.15, shadowRadius: pressed ? 4 : 8, shadowOffset: { width: 0, height: pressed ? 2 : 4 }, elevation: pressed ? 1 : 4 },
            pressed && { transform: [{ translateY: 4 }], bottom: 0 },
            disabled && { opacity: 0.7 },
          ])}
        >
          {children}
        </Pressable>
      </View>
    </View>
  );
}

export default function GameDetailScreen({ route }) {
  const { gameId } = route.params;
  const { user, logout } = useAuth();
  const nav = useNavigation();
  const theme = useTheme();
  const toast = useToast();
  const [detail, setDetail] = useState(null);
  const [result, setResult] = useState(null); // from /result
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const timerRef = useRef(null);

  const loadDetail = useCallback(async () => {
    try {
      const res = await gamesApi.detail(gameId);
      setDetail(toDetailModel(res.data));
    } catch (e) {
      if (e?.response?.status === 401) { await logout(); return; }
  console.error('Detail fetch error', e?.message);
  toast.error('Oyun detayı alınamadı');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gameId, logout]);

  const loadResult = useCallback(async () => {
    try {
      const res = await gamesApi.result(gameId);
      const r = res.data || {};
      setResult({
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
      });
    } catch (e) {
      // 404 until game exists/has result; ignore
    }
  }, [gameId]);

  const poll = useCallback(async () => {
    await Promise.all([loadDetail(), loadResult()]);
  }, [loadDetail, loadResult]);

  useEffect(() => { poll(); }, [poll]);

  // Live updates via WebSocket subscription
  useEffect(() => {
    const off = addListener((msg) => {
      if (!msg || String(msg.gameId) !== String(gameId)) return;
      const t = msg.type;
      if (t === 'game-updated' || t === 'game-started') {
        setDetail(toDetailModel(msg.payload));
      } else if (t === 'drawn' || t === 'game-completed') {
        const payload = msg.payload || {};
        if (payload.Results || payload.results) {
          // full result payload
          setResult({
            isStarted: payload.IsStarted ?? payload.isStarted,
            isCompleted: payload.IsCompleted ?? payload.isCompleted,
            shortStickUserId: payload.ShortStickUserId ?? payload.shortStickUserId,
            shortStickUsername: payload.ShortStickUsername ?? payload.shortStickUsername,
            results: (payload.Results ?? payload.results ?? []).map(x => ({
              userId: x.UserId ?? x.userId,
              username: x.Username ?? x.username,
              isShortStick: x.IsShortStick ?? x.isShortStick,
              drawOrder: x.DrawOrder ?? x.drawOrder,
            })),
          });
        } else {
          // fetch latest result snapshot
          gamesApi.result(gameId).then(r => {
            const rr = r.data || {};
            setResult({
              isStarted: rr.IsStarted ?? rr.isStarted,
              isCompleted: rr.IsCompleted ?? rr.isCompleted,
              shortStickUserId: rr.ShortStickUserId ?? rr.shortStickUserId,
              shortStickUsername: rr.ShortStickUsername ?? rr.shortStickUsername,
              results: (rr.Results ?? rr.results ?? []).map(x => ({
                userId: x.UserId ?? x.userId,
                username: x.Username ?? x.username,
                isShortStick: x.IsShortStick ?? x.isShortStick,
                drawOrder: x.DrawOrder ?? x.drawOrder,
              })),
            });
          }).catch(() => {});
        }
      }
    });
    subscribe(gameId);
    return () => { if (off) off(); unsubscribe(gameId); };
  }, [gameId]);

  // Navigate to gameplay when started
  useEffect(() => {
    if (detail?.isStarted) {
      nav.replace('GamePlay', { gameId });
    }
  }, [detail?.isStarted, nav, gameId]);

  const onStart = async () => {
    try {
      setSubmitting(true);
      await gamesApi.start(gameId);
      await poll();
    } catch (e) {
  const msg = e?.response?.data?.message || 'Oyun başlatılamadı';
  toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onReady = async (flag) => {
    try {
      setSubmitting(true);
      await gamesApi.ready(gameId, user?.id, flag);
      await poll();
    } catch (e) {
  const msg = e?.response?.data?.message || 'Hazır durum güncellenemedi';
  toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onDraw = async () => {
    try {
      setSubmitting(true);
      await gamesApi.draw(gameId, user?.id);
      await poll();
      // Show immediate feedback via updated detail/result state
    } catch (e) {
  const status = e?.response?.status;
  const msg = e?.response?.data?.message || (status === 409 ? 'Zaten çektiniz' : 'Çekme işlemi başarısız');
  toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
  Alert.alert('Odayı Sil', 'Bu işlemi geri alamazsınız. Odayı silmek istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try {
          setDeleting(true);
          await gamesApi.delete(gameId);
          nav.navigate('Home');
        } catch (e) {
          const msg = e?.response?.data?.message || (e?.response?.status === 403 ? 'Sadece sahibi silebilir' : 'Silme işlemi başarısız');
          toast.error(msg);
        } finally {
          setDeleting(false);
        }
      } }
    ]);
  };

  const me = user?.id;
  const myRow = useMemo(() => detail?.participants?.find(p => String(p.userId) === String(me)), [detail, me]);
  const iAmOwner = useMemo(() => detail && String(detail.creatorUserId) === String(me), [detail, me]);
  const showStart = canShowStartButton({ isStarted: detail?.isStarted, creatorUserId: detail?.creatorUserId, me, participants: detail?.participants });
  const showDraw = canShowDrawButton({ isStarted: detail?.isStarted, me, participants: detail?.participants, result });

  if (loading) return (<View style={[styles.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" /></View>);
  if (!detail) return (<View style={[styles.center, { backgroundColor: theme.colors.background }]}><Text>Oyun bulunamadı.</Text></View>);

  const renderItem = ({ item }) => {
    const drawn = item.hasDrawn;
    const isShort = item.isShortStick;
    const order = item.drawOrder;
    return (
      <View style={styles.row}>
        <View>
          <Image source={ getAvatarSource(item.userId, item.avatarUrl) } style={styles.avatar} />
          <View style={[styles.readyDot, { backgroundColor: item.isReady ? '#10b981' : '#9ca3af' }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{item.username}</Text>
          <Text style={styles.sub}>{new Date(item.joinDate).toLocaleString()}</Text>
        </View>
        <View style={styles.statusCell}>
          <Text style={[styles.ready, item.isReady ? styles.readyYes : styles.readyNo]}>
            {item.isReady ? 'Hazır' : 'Hazır Degil'}
          </Text>
          <Text style={[styles.badge, drawn ? (isShort ? styles.badgeLose : styles.badgeWin) : styles.badgeIdle]}>
            {drawn ? (isShort ? 'Kısa' : 'Uzun') : 'Bekliyor'}
          </Text>
          <Text style={styles.order}>{order != null ? `#${order}` : ''}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.headerBox, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.cardBorder }]}> 
        <Text style={styles.title}>Ceza</Text>
        <Text style={styles.penalty}>{detail.penaltyText}</Text>        
        <Text style={[styles.meta, { color: theme.colors.info }]}>{detail.isGlobal ? 'Global Oyun' : 'Arkadaş Oyunu'}</Text>
  <Text style={styles.meta}>Olusturma: {formatDateTimeTR(detail.createdDate)}</Text>
        <View style={styles.metaRow}>
          <StatusPill isStarted={detail.isStarted} />
          {iAmOwner ? <Text style={[styles.meta, styles.owner]}>Sahibi sensin</Text> : null}
        </View>
<View style={[styles.metaRow, { marginTop: 10, justifyContent: 'space-between' }]}>
  <Text style={styles.meta}>
    Oyun Kodu:{' '}
    <TouchableOpacity
      onPress={async () => {
        await Clipboard.setStringAsync(String(detail.id));
        toast.info('Oyun kodu panoya kopyalandı', '');
      }}
    >
      <Text style={{ fontFamily: 'LilitaOne_400Regular', color: '#111827' }}>
        {detail.id}
      </Text>
    </TouchableOpacity>
  </Text>
</View>
      </View>

      <View style={[styles.actionsBox, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.cardBorder }]}> 
        <View style={styles.actionsGrid}>
          {showStart ? (
            <Button3D
              color={theme.colors.primary}
              depthColor="#7C3AED"
              onPress={onStart}
              disabled={submitting}
              style={styles.actionItem}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Oyunu Başlat</Text>}
            </Button3D>
          ) : null}

          {!detail.isStarted ? (
            <Button3D
              color={theme.colors.success}
              depthColor="#059669"
              onPress={() => onReady(!myRow?.isReady)}
              disabled={submitting}
              style={styles.actionItem}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{myRow?.isReady ? 'Hazır Degilim' : 'Hazırım'}</Text>}
            </Button3D>
          ) : null}

          {showDraw ? (
            <Button3D
              color={theme.colors.success}
              depthColor="#059669"
              onPress={onDraw}
              disabled={submitting}
              style={styles.actionItem}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Çubuk Çek</Text>}
            </Button3D>
          ) : null}

          {(detail?.isStarted || result?.isStarted || result?.isCompleted) ? (
            <Button3D
              color={theme.colors.secondary}
              depthColor="#4b5563"
              onPress={() => nav.navigate('Result', { gameId })}
              style={styles.actionItem}
            >
              <Text style={styles.btnText}>Sonuçları Gör</Text>
            </Button3D>
          ) : null}

          {result?.isCompleted ? (
            <Button3D
              color={theme.colors.secondary}
              depthColor="#4b5563"
              onPress={() => nav.navigate('GameHistoryDetail', { gameId })}
              style={styles.actionItem}
            >
              <Text style={styles.btnText}>Geçmişte Gör</Text>
            </Button3D>
          ) : null}

          {iAmOwner ? (
            <Button3D
              color={theme.colors.danger}
              depthColor="#b91c1c"
              onPress={onDelete}
              disabled={deleting}
              style={styles.actionItem}
            >
              {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Odayı Sil</Text>}
            </Button3D>
          ) : null}
        </View>
      </View>

      {/* My draw result inline */}
      {myRow?.hasDrawn ? (
        <View style={styles.myResultBox}>
          <Text style={styles.myResultTitle}>Sonucun</Text>
          <Text style={[styles.myResultText, myRow.isShortStick ? styles.lose : styles.win]}>
            {myRow.isShortStick ? 'Kısa çubuğu çektin 😬' : 'Kurtuldun 🎉'}
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Katılımcılar</Text>
      <FlatList
        data={detail.participants}
        keyExtractor={(it) => String(it.userId)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); poll(); }} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

function StatusPill({ isStarted }) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: isStarted ? '#dbeafe' : theme.colors.neutral }]}>
      <Text style={[styles.pillText, { color: isStarted ? theme.colors.info : '#374151' }]}>
        {isStarted ? 'Basladı' : 'Baslamadı'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb' },
  readyDot: { position: 'absolute', right: -2, bottom: -2, width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#fff' },
  headerBox: { padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 12, color: '#6b7280' },
  penalty: { fontSize: 18, fontFamily: 'LilitaOne_400Regular', color: '#8B5CF6', marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  meta: { color: '#6b7280', fontFamily:'LilitaOne_400Regular' },
  owner: { color: '#0ea5e9', fontFamily: 'LilitaOne_400Regular' },
  pill: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  pillText: { fontSize: 12, fontFamily: 'LilitaOne_400Regular' },
  actionsBox: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  btn: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionItem: { flexGrow: 1, flexBasis: '48%' },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontFamily: 'LilitaOne_400Regular' },
  sectionTitle: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontSize: 16, fontFamily: 'LilitaOne_400Regular', color: '#111827' },
  row: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomColor: '#f3f4f6', borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: 'LilitaOne_400Regular', color: '#111827' },
  sub: { color: '#6b7280', fontSize: 12 },
  statusCell: { alignItems: 'flex-end', minWidth: 90 },
  ready: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, fontSize: 12, color: '#fff', marginBottom: 4, overflow: 'hidden' },
  readyYes: { backgroundColor: '#10b981' },
  readyNo: { backgroundColor: '#9ca3af' },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, color: '#fff', overflow: 'hidden', textAlign: 'center', fontFamily: 'LilitaOne_400Regular' },
  badgeWin: { backgroundColor: '#10b981' },
  badgeLose: { backgroundColor: '#ef4444' },
  badgeIdle: { backgroundColor: '#9ca3af' },
  order: { marginTop: 4, color: '#6b7280', fontSize: 12, textAlign: 'center' },
  myResultBox: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12, borderColor: '#e5e7eb', borderWidth: 1 },
  myResultTitle: { fontSize: 12, color: '#6b7280' },
  myResultText: { fontSize: 16, fontFamily: 'LilitaOne_400Regular', marginTop: 4 },
  win: { color: '#065f46' },
  lose: { color: '#991b1b' },
});

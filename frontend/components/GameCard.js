import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { formatDateTimeTRLocal } from '../utils/formatDate';

function formatDate(iso) {
  if (!iso) return '-';
  try {
    return formatDateTimeTRLocal(iso);
  } catch {
    return String(iso);
  }
}

function StatusBadge({ isStarted, isCompleted }) {
  const { label, color, bg } = useMemo(() => {
  if (isCompleted) return { label: 'Tamamlandı', color: '#374151', bg: '#e5e7eb' }; // gray badge
  if (isStarted) return { label: 'Basladı', color: '#065f46', bg: '#a7f3d0' }; // emerald badge
  return { label: 'Baslamadı', color: '#374151', bg: '#f3f4f6' }; // neutral badge
  }, [isStarted, isCompleted]);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}> 
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function GameCard({ item, onPress, showJoin, joining, onJoin, onDelete }) {
  const theme = useTheme();
  // Fallback in case Swipeable is unavailable on some platforms / builds
  const SwipeableSafe = Swipeable || (({ children }) => <View>{children}</View>);
  const statusStyles = useMemo(() => {
    // Completed -> gray tint, Started -> green tint, Not started -> white
    if (item?.isCompleted) {
      return {
        bg: '#f3f4f6', // gray-100
        pressedBg: '#e5e7eb', // gray-200
        border: '#e5e7eb',
        textPrimary: '#111827',
        meta: '#6b7280'
      };
    }
    if (item?.isStarted) {
      return {
        bg: '#d1fae5', // emerald-100 matches Home background
        pressedBg: '#a7f3d0', // emerald-200
        border: '#a7f3d0',
        textPrimary: '#064e3b', // dark emerald for better contrast
        meta: '#065f46'
      };
    }
    return {
      bg: '#ffffff',
      pressedBg: '#f9fafb',
      border: '#eeeeee',
      textPrimary: '#111827',
      meta: '#6b7280'
    };
  }, [item?.isCompleted, item?.isStarted]);
  const renderRightActions = () => {
    if (!item?.isOwner) return null; // yalnızca sahibi olan silebilir
    return (
      <View style={styles.rightActionWrap}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={(e) => { e.stopPropagation?.(); onDelete?.(item); }}
          activeOpacity={0.85}
          style={styles.deleteAction}
        >
          <Text style={styles.deleteText}>Sil</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {item?.isOwner ? <View style={styles.bgBehind} /> : null}
  <SwipeableSafe
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={1.0}
        rightThreshold={32}
      >
        <View style={[styles.card, { borderColor: statusStyles.border }]}>
          <Pressable
            onPress={onPress}
            android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false, foreground: true }}
            style={({ pressed }) => [
              styles.cardInner,
              { backgroundColor: statusStyles.bg },
              pressed && { backgroundColor: statusStyles.pressedBg }
            ]}
          >
            <View style={styles.headerRow}>
              <Text style={[styles.penalty, styles.penaltyViolet]} numberOfLines={2}>{item.penaltyText}</Text>
              <StatusBadge isStarted={item.isStarted} isCompleted={item.isCompleted} />
            </View>
            <View style={styles.metaRow}>
                          <Text style={[styles.meta, { color: theme.colors.dateText }]}>Olusturma: { formatDateTimeTRLocal(item.createdDate) }</Text>
              <Text style={[styles.meta, { color: theme.colors.participantsText }]}>Katılımcı: {item.participantCount ?? '-'} kisi</Text>
            </View>
            <View style={styles.footerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {item.isOwner ? <Text style={styles.owner}>Sahibi sensin</Text> : null}
                {item.isGlobal ? <Text style={styles.global}>  • Global</Text> : null}
              </View>
              {showJoin && !item?.isCompleted && !item?.isStarted ? (
                (() => {
                  const isJoinDisabled = !!joining || !!item?.isStarted;
                  return (
                    <View style={styles.join3DWrap}>
                      <View style={[styles.joinDepth, isJoinDisabled && { backgroundColor: '#047857' }]} />
                      <Pressable
                        disabled={isJoinDisabled}
                        accessibilityRole="button"
                        onPress={(e) => {
                          if (isJoinDisabled) return; // guard
                          e.stopPropagation?.();
                          onJoin?.(item);
                        }}
                        style={({ pressed }) => [
                          styles.joinSurface,
                          isJoinDisabled && { opacity: 0.6 },
                          pressed && !isJoinDisabled && styles.joinSurfacePressed,
                        ]}
                      >
                        <Text style={styles.joinText}>{joining ? 'Katılıyor...' : 'Katıl'}</Text>
                      </Pressable>
                    </View>
                  );
                })()
              ) : <View />}
            </View>
          </Pressable>
        </View>
  </SwipeableSafe>
    </View>
  );
}

export default memo(GameCard);

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, marginVertical: 8 },
  bgBehind: { position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, backgroundColor: '#ef4444', borderRadius: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    // margins moved to container to keep background flush
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: '#eee'
  },
  cardInner: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    padding: 14
  },
  cardPressed: { backgroundColor: '#f9fafb' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  penalty: { flex: 1, fontSize: 16, paddingRight: 10 },
  penaltyViolet: { color: '#8B5CF6' },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  badgeText: { fontSize: 12 },
  metaRow: { marginTop: 8 },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  owner: { marginTop: 10, fontSize: 12, color: '#0ea5e9' }
  ,global: { marginTop: 10, fontSize: 12, color: '#1e3a8a' }
  ,footerRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
  ,actionsRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' }
  ,joinBtn: { backgroundColor: '#10b981', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 } // legacy (unused)
  ,joinText: { color: '#fff', fontFamily: 'LilitaOne_400Regular' }
  ,join3DWrap: { position: 'relative', height: 40, minWidth: 96 }
  ,joinDepth: {
    position: 'absolute', left: 0, right: 0, bottom: 0, top: 3,
    borderRadius: 8,
    backgroundColor: '#16a34a'
  }
  ,joinSurface: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 3,
    borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#22c55e', paddingHorizontal: 12,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  }
  ,joinSurfacePressed: {
    transform: [{ translateY: 3 }],
    bottom: 0,
    shadowOpacity: 0.05,
    elevation: 1,
  }
  ,rightActionWrap: { width: 96, alignItems: 'stretch', justifyContent: 'center' }
  ,deleteAction: { backgroundColor: 'transparent', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }
  ,deleteText: { color: '#fff', marginTop: 4 }
});

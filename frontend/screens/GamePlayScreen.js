import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Modal, TouchableOpacity, ActivityIndicator, Animated, Easing } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { gamesApi } from '../api';
import { getAvatarSource } from '../utils/avatars';
import { getStickSource } from '../utils/stick';

// Normalize helpers (match other screens)
function toDetailModel(d) {
	if (!d) return null;
	return {
		id: d.Id ?? d.id,
		penaltyText: d.PenaltyText ?? d.penaltyText,
		isStarted: d.IsStarted ?? d.isStarted,
		participants: (d.Participants ?? d.participants ?? []).map((p) => ({
			userId: p.UserId ?? p.userId,
			username: p.Username ?? p.username,
			avatarUrl: p.AvatarUrl ?? p.avatarUrl,
			isReady: p.IsReady ?? p.isReady,
			hasDrawn: p.HasDrawn ?? p.hasDrawn,
			isShortStick: p.IsShortStick ?? p.isShortStick,
			drawOrder: p.DrawOrder ?? p.drawOrder,
		})),
	};
}

function toResultModel(r) {
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

// Deterministic username color (same palette logic as HomeScreen)
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

export default function GamePlayScreen({ route, navigation }) {
	const { gameId } = route.params;
	const { user } = useAuth();
	const me = user?.id != null ? String(user.id) : null;

	// Layout state
	const [layout, setLayout] = useState({ width: Dimensions.get('window').width, height: Dimensions.get('window').height });
	const [detail, setDetail] = useState(null);
	const [result, setResult] = useState(null);
	const [loading, setLoading] = useState(true);
		const [animating, setAnimating] = useState(false);
	const [showModal, setShowModal] = useState(false);
		const animationEndAtRef = useRef(null);
		const animationStartedRef = useRef(false);
		const expectedAnimEndAtRef = useRef(null);
		const distributionPlannedRef = useRef(false);
		// Modal open timers
		const openCheckTimerRef = useRef(null);
		const openFallbackTimerRef = useRef(null);
		// Latest state refs for timer callbacks
		const latestDetailRef = useRef(null);
		const latestResultRef = useRef(null);
		const latestParticipantsCountRef = useRef(0);

		const clearOpenTimers = useCallback(() => {
			if (openCheckTimerRef.current) { clearTimeout(openCheckTimerRef.current); openCheckTimerRef.current = null; }
			if (openFallbackTimerRef.current) { clearTimeout(openFallbackTimerRef.current); openFallbackTimerRef.current = null; }
		}, []);

	// Animated values per stick
	const sticksRef = useRef([]); // Animated.ValueXY[]
	const opacityRef = useRef([]); // Animated.Value[]

	const participants = detail?.participants || [];

	const load = useCallback(async () => {
		try {
			const [dRes, rRes] = await Promise.allSettled([
				gamesApi.detail(gameId),
				gamesApi.result(gameId),
			]);
			if (dRes.status === 'fulfilled') {
				setDetail(toDetailModel(dRes.value.data));
			}
			if (rRes.status === 'fulfilled') {
				setResult(toResultModel(rRes.value.data));
			}
		} finally {
			setLoading(false);
		}
	}, [gameId]);

	// Keep latest state in refs so setTimeout callbacks see fresh values
	useEffect(() => { latestDetailRef.current = detail; }, [detail]);
	useEffect(() => { latestResultRef.current = result; }, [result]);
	useEffect(() => { latestParticipantsCountRef.current = participants.length; }, [participants.length]);

	const getIsDistributionDone = useCallback(() => {
		const d = latestDetailRef.current;
		const r = latestResultRef.current;
		const count = latestParticipantsCountRef.current;
		const allDrawn = !!(d?.participants?.length) && d.participants.every(p => p.hasDrawn);
		const allResults = !!(r?.results?.length) && count && r.results.length >= count;
		return !!(r?.isCompleted || allDrawn || allResults);
	}, []);

	// Poll result lightly while on this screen (in case backend finalizes during animation)
	useEffect(() => {
		load();
	}, [load]);

		useEffect(() => {
			const id = setInterval(async () => {
				try {
					const [d, r] = await Promise.allSettled([
						gamesApi.detail(gameId),
						gamesApi.result(gameId),
					]);
					if (d.status === 'fulfilled') setDetail(toDetailModel(d.value.data));
					if (r.status === 'fulfilled') setResult(toResultModel(r.value.data));
				} catch {}
			}, 2500);
			return () => clearInterval(id);
		}, [gameId]);

	// Prepare animated values when participants change
	useEffect(() => {
		sticksRef.current = participants.map(() => new Animated.ValueXY({ x: 0, y: 0 }));
		opacityRef.current = participants.map(() => new Animated.Value(0));
	}, [participants.length]);

	// Compute player positions around a circle
	const positions = useMemo(() => {
		const { width, height } = layout;
		const cx = width / 2;
		const cy = height / 2 - 40; // give some room for headers
		const n = Math.max(participants.length, 1);
		const radius = Math.max(80, Math.min(width, height) * 0.34);
		return participants.map((_, i) => {
			// start angle at -90deg (top) and go clockwise
			const angle = (-Math.PI / 2) + (2 * Math.PI * i) / n;
			const x = cx + radius * Math.cos(angle);
			const y = cy + radius * Math.sin(angle);
			return { x, y, angle };
		});
	}, [layout, participants.length]);

	// Start distribution animation when layout and participants ready (only once per screen entry)
	useEffect(() => {
		if (!participants.length || !layout.width || distributionPlannedRef.current) return;
		setAnimating(true);
			animationStartedRef.current = true;
			distributionPlannedRef.current = true;
			// Clear any previously scheduled open timers (fresh planning)
			clearOpenTimers();
			// Pre-calculate expected animation finish time (sequence delay + last start + duration)
			const count = participants.length;
			const initialDelayMs = 1500;
			const staggerMs = 1500;
			const moveDurationMs = 1500;
			// Tie fade duration to movement (bounded)
			const fadeDurationMs = Math.min(600, Math.max(250, Math.round(moveDurationMs * 0.3)));
			const expectedEnd = Date.now() + initialDelayMs + ((count - 1) * staggerMs) + moveDurationMs;
			expectedAnimEndAtRef.current = expectedEnd;
			animationEndAtRef.current = null;

			// Schedule a post-animation check to open modal if results ready
			const checkDelay = Math.max(0, (expectedEnd + 120) - Date.now());
			openCheckTimerRef.current = setTimeout(() => {
				// Only open if not already showing and distribution logically done
				if (!openCheckTimerRef.current) return; // was cleared
				if (!showModal && getIsDistributionDone()) {
					setShowModal(true);
				}
			}, checkDelay);

			// Fallback: after a grace window, open regardless
			const fallbackDelay = Math.max(0, (expectedEnd + 5000) - Date.now());
			openFallbackTimerRef.current = setTimeout(() => {
				if (!openFallbackTimerRef.current) return; // was cleared
				if (!showModal && isDistributionDone()) setShowModal(true);
			}, fallbackDelay);

		const { width, height } = layout;
		const cx = width / 2;
		const cy = height / 2 - 40;

		const animations = sticksRef.current.map((val, i) => {
			const target = positions[i];
			const stickW = 16; // render size
			const stickH = 80;
			const targetX = (target?.x ?? cx) - cx - stickW / 2;
			const targetY = (target?.y ?? cy) - cy - stickH / 2;
			return Animated.parallel([
				Animated.timing(val, { toValue: { x: targetX, y: targetY }, duration: moveDurationMs, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
				Animated.timing(opacityRef.current[i], { toValue: 1, duration: fadeDurationMs, useNativeDriver: true }),
			]);
		});

				Animated.sequence([
				Animated.delay(initialDelayMs),
				Animated.stagger(staggerMs, animations),
			]).start(() => {
			setAnimating(false);
					animationEndAtRef.current = Date.now();
		});
	}, [participants.length, layout.width, layout.height, clearOpenTimers, getIsDistributionDone]);

			// Helper: consider distribution/result done only when backend finalized
			const isDistributionDone = useCallback(() => {
				return !!(result?.isCompleted || (result?.shortStickUserId != null && result?.shortStickUserId !== undefined));
			}, [result?.isCompleted, result?.shortStickUserId]);

	// Auto-close modal and go to Result screen
	const closeAndNavigate = useCallback(() => {
		setShowModal(false);
		// small delay to allow modal disappear
		setTimeout(() => navigation.replace('Result', { gameId }), 200);
	}, [navigation, gameId]);

	// Not auto-navigating; user taps the button to proceed

			// Also reactively open if data updates indicate completion after animation end
			useEffect(() => {
				if (showModal) return;
				if (!animationStartedRef.current) return;
				const expectedEnd = expectedAnimEndAtRef.current ?? 0;
				if (!expectedEnd || Date.now() < (expectedEnd + 120)) return;
				if (isDistributionDone()) setShowModal(true);
			}, [showModal, isDistributionDone, result]);

	// On unmount, ensure timers are cleared
	useEffect(() => () => { clearOpenTimers(); }, [clearOpenTimers]);

	const myOutcome = useMemo(() => {
		if (!result || !me) return null;
		// Prefer my row in results if available (most reliable)
		const row = result.results?.find(r => String(r.userId) === String(me));
		if (row) return { isShort: !!row.isShortStick };
		// Else, use shortStickUserId only if backend provided it
		if (result.shortStickUserId != null && result.shortStickUserId !== undefined) {
			return { isShort: String(result.shortStickUserId) === String(me) };
		}
		// Unknown yet -> keep waiting state
		return null;
	}, [result, me]);

	const centerSticks = useMemo(() => {
		// For initial visual bundle: narrow vertical stack
		const count = participants.length || 0;
		const arr = Array.from({ length: count }, (_, i) => i);
		return arr;
	}, [participants.length]);

	if (loading) {
		return (
			<View style={styles.center}> 
				<ActivityIndicator size="large" />
			</View>
		);
	}

	if (!detail) {
		return (
			<View style={styles.center}>
				<Text>Oyun bulunamadı.</Text>
			</View>
		);
	}

	const { width, height } = layout;
	const cx = width / 2;
	const cy = height / 2 - 40;

	return (
		<View style={styles.container} onLayout={(e) => setLayout(e.nativeEvent.layout)}>
			{/* Penalty / Title */}
			<View style={styles.headerBox}>
				<Text style={styles.penaltyLabel}>Ceza</Text>
				<Text style={styles.penaltyText}>{detail.penaltyText}</Text>
			</View>

			{/* Stage area */}
			<View style={styles.stage}>
				{/* Players around a circle */}
				{participants.map((p, i) => {
					const pos = positions[i] || { x: cx, y: cy };
					const size = 56;
		  const nameColor = getUserNameColor(p.userId || p.username);
					return (
						<View key={p.userId} style={[styles.player, { left: pos.x - size / 2, top: pos.y - size / 2 }]}> 
									<Image source={getAvatarSource(p.userId, p.avatarUrl)} style={styles.avatar} />
			  <Text style={[styles.username, { color: nameColor }]} numberOfLines={1}>{p.username}</Text>
						</View>
					);
				})}

				{/* Central bundle of sticks and their animations to each player */}
				<View style={[styles.centerCluster, { left: cx - 20, top: cy - 40 }]}>
					{centerSticks.map((_, i) => {
						const translate = sticksRef.current[i] || new Animated.ValueXY({ x: 0, y: 0 });
						const opacity = opacityRef.current[i] || new Animated.Value(0);
						return (
							<Animated.View key={`stick-${i}`} style={[styles.stickWrap, { transform: [{ translateX: translate.x }, { translateY: translate.y }], opacity }]}> 
								<Image source={getStickSource()} style={styles.stick} resizeMode="contain" />
							</Animated.View>
						);
					})}
				</View>
			</View>

			{/* Result hint */}
			<View style={styles.footer}>
				<Text style={styles.footerText}>Çubuklar dagıtılıyor…</Text>
			</View>

			{/* Personal modal */}
			<Modal visible={showModal} transparent animationType="fade" onRequestClose={() => closeAndNavigate()}>
				<View style={styles.modalBackdrop}>
					<View style={styles.modalCard}>
						{myOutcome ? (
							<>
								<Text style={[styles.modalTitle, myOutcome.isShort ? styles.lose : styles.win]}>
									{myOutcome.isShort ? 'Kaybettiniz ❌' : 'Kazandınız 🎉'}
								</Text>
								<Image
										source={
										myOutcome.isShort 
											? require('../assets/stick_short.png')  // Kaybettik görseli
											: require('../assets/stick.png')   // Kazandık görseli
									}
									style={styles.outcomeImage}
									resizeMode='contain'
								/>
							</>
						) : (
							<Text style={styles.modalTitle}>Sonuç bekleniyor…</Text>
						)}
						<TouchableOpacity style={styles.modalBtn} onPress={closeAndNavigate}>
							<Text style={styles.modalBtnText}>Sonuca Git</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#f0fdf4' }, // light green tint
	center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
	headerBox: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
	penaltyLabel: { color: '#047857', fontSize: 12, fontWeight: '700' },
	penaltyText: { color: '#111827', fontWeight: '800', fontSize: 18, marginTop: 4 },
	stage: { flex: 1 },
	player: { position: 'absolute', alignItems: 'center', width: 88 },
	avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#e5e7eb' },
	username: { marginTop: 6, fontSize: 12, fontFamily: 'LilitaOne_400Regular', color: '#064e3b', maxWidth: 88, textAlign: 'center' },
	centerCluster: { position: 'absolute', width: 40, height: 80, alignItems: 'center', justifyContent: 'center' },
	stickWrap: { position: 'absolute', left: 0, top: 0 },
	stick: { width: 100, height: 150, transform: [{ rotate: '-45deg' }] },
	footer: { padding: 12, backgroundColor: '#ecfdf5', borderTopWidth: 1, borderTopColor: '#d1fae5' },
	footerText: { textAlign: 'center', color: '#065f46', fontFamily: 'LilitaOne_400Regular' },
	modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
	modalCard: { width: '80%', backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center' },
	modalTitle: { fontSize: 20, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
	modalBtn: { backgroundColor: '#10b981', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
	modalBtnText: { color: '#fff', fontFamily: 'LilitaOne_400Regular' },
	win: { color: '#065f46' },
	lose: { color: '#991b1b' },
	outcomeImage: { width: 150, height: 200, marginTop: 20 },
});


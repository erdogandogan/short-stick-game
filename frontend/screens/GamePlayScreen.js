import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Modal, TouchableOpacity, ActivityIndicator, Animated, Easing } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { gamesApi } from '../api';
import { getAvatarSource } from '../utils/avatars';
import { getStickSource } from '../utils/stick';

// Hand image resolver (matches avatar selection logic)
function hashStringLocal(str) {
	let h = 0;
 	for (let i = 0; i < str.length; i++) {
 		h = ((h << 5) - h) + str.charCodeAt(i);
 		h |= 0;
 	}
 	return Math.abs(h);
}

function getHandSource(userId) {
 	const hands = [
 		require('../assets/monster1_hand.png'),
 		require('../assets/monster2_hand.png'),
 		require('../assets/monster3_hand.png'),
 		require('../assets/monster4_hand.png'),
 		require('../assets/monster5_hand.png'),
 	];
 	const key = String(userId || '0');
 	const idx = hashStringLocal(key) % hands.length;
 	return hands[idx];
}

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
	// Animated values per hand
	const handsRef = useRef([]); // Animated.ValueXY[]
	const handOpacityRef = useRef([]); // Animated.Value[]
	const handTimersRef = useRef([]); // per-player timeouts to start hand sequences

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
		// prepare hands
		handsRef.current = participants.map(() => new Animated.ValueXY({ x: 0, y: 0 }));
		handOpacityRef.current = participants.map(() => new Animated.Value(0));
		// clear any previously scheduled hand timers
		handTimersRef.current.forEach(t => clearTimeout(t));
		handTimersRef.current = [];
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

		const pullBack = 100; // how short the stick initially stops before the player (px)
		const animations = sticksRef.current.map((val, i) => {
			const target = positions[i];
			const stickW = 16; // render size
			const stickH = 80;
			// final absolute coords
			const finalAbsX = (target?.x ?? cx);
			const finalAbsY = (target?.y ?? cy);
			// compute short target (stop a bit away so hand can grab and pull)
			let dx = finalAbsX - cx;
			let dy = finalAbsY - cy;
			const len = Math.sqrt(dx * dx + dy * dy) || 1;
			dx = dx / len;
			dy = dy / len;
			const shortAbsX = finalAbsX - dx * pullBack;
			const shortAbsY = finalAbsY - dy * pullBack;
			const targetX = shortAbsX - cx - stickW / 2;
			const targetY = shortAbsY - cy - stickH / 2;
			return Animated.parallel([
				Animated.timing(val, { toValue: { x: targetX, y: targetY }, duration: moveDurationMs, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
				Animated.timing(opacityRef.current[i], { toValue: 1, duration: fadeDurationMs, useNativeDriver: true }),
			]);
		});

		// Schedule per-player hand sequences to intercept and pull sticks
		const scheduleHandFor = (i) => {
			// compute timings consistent with stick animation schedule
			const stickStart = initialDelayMs + (i * staggerMs);
			const stickEnd = stickStart + moveDurationMs;
			// start hand a little before stick arrives
			const handMoveDuration = 1000;
			const handStart = Math.max(0, stickEnd - handMoveDuration - 80);
			// give the first player extra lead so their hand isn't late compared to the stick
			const extraLeadMs = (i === 0) ? 800 : 500;
			const timeoutMs = Math.max(0, handStart - extraLeadMs);
			const t = setTimeout(() => {
				startHandSequence(i, { cx, cy, pullBack, moveDurationMs });
			}, timeoutMs);
			handTimersRef.current[i] = t;
		};

		for (let i = 0; i < participants.length; i++) scheduleHandFor(i);

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

			// Hand sequence: modular per-player animation
			const startHandSequence = useCallback((index, opts = {}) => {
				const optCx = (opts && opts.cx != null) ? opts.cx : (layout.width ? layout.width / 2 : 0);
				const optCy = (opts && opts.cy != null) ? opts.cy : (layout.height ? layout.height / 2 - 40 : 0);
				const optPull = (opts && opts.pullBack != null) ? opts.pullBack : 36;
				const hand = handsRef.current[index];
				const handOp = handOpacityRef.current[index];
				const stick = sticksRef.current[index];
				if (!hand || !handOp || !stick) return;

				// compute avatar pos and short stick absolute coords
				const pos = positions[index] || { x: optCx, y: optCy };
				const avatarX = pos.x;
				const avatarY = pos.y;

				// stick's short (current) absolute: use translate of stick + center
				// animated values are relative to center cluster; we can compute end based on positions
				const stickTargetAbsX = pos.x - optPull * ( (pos.x - optCx) / (Math.hypot(pos.x - optCx, pos.y - optCy) || 1) );
				const stickTargetAbsY = pos.y - optPull * ( (pos.y - optCy) / (Math.hypot(pos.x - optCx, pos.y - optCy) || 1) );

				// start hand near avatar and move to stick, then pull stick to avatar
				const handStartX = avatarX - optCx; // relative to center
				const handStartY = avatarY - optCy;
				const handGrabX = stickTargetAbsX - optCx;
				const handGrabY = stickTargetAbsY - optCy;

				// Reset positions
				hand.setValue({ x: handStartX, y: handStartY });
				handOp.setValue(0);

				// move hand to stick
				const grabDur = 420;
				const pullDur = 380;

				Animated.sequence([
					Animated.parallel([
						Animated.timing(handOp, { toValue: 1, duration: 150, useNativeDriver: true }),
						Animated.timing(hand, { toValue: { x: handGrabX, y: handGrabY }, duration: grabDur, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
					]),
					// when hand reaches stick, pull both hand and stick to avatar
					Animated.parallel([
						Animated.timing(hand, { toValue: { x: handStartX, y: handStartY }, duration: pullDur, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
						Animated.timing(stick, { toValue: { x: handStartX - 8, y: handStartY - 20 }, duration: pullDur, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
						Animated.timing(opacityRef.current[index], { toValue: 1, duration: 120, useNativeDriver: true }),
					]),
					Animated.timing(handOp, { toValue: 0, duration: 120, useNativeDriver: true }),
				]).start(() => {
					// completed for this player
				});
			}, [positions, layout.width, layout.height]);

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
	useEffect(() => () => {
		clearOpenTimers();
		handTimersRef.current.forEach(t => clearTimeout(t));
		handTimersRef.current = [];
	}, [clearOpenTimers]);

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
					const avatarSize = 56;
					const playerWidth = 88; // match styles.player width so centering is accurate
		 	  const nameColor = getUserNameColor(p.userId || p.username);
					return (
						<View key={p.userId} style={[styles.player, { left: pos.x - playerWidth / 2, top: pos.y - avatarSize / 2 }]}> 
							<Image source={getAvatarSource(p.userId, p.avatarUrl)} style={styles.avatar} />
							<Text style={[styles.username, { color: nameColor }]} numberOfLines={1}>{p.username}</Text>
						</View>
					);
				})}

				{/* Central bundle of sticks and their animations to each player */}
				<View style={[styles.centerCluster, { left: cx - 20, top: cy - 40 }]}>
					{/* origin log image (where sticks come from) */}
					<Image source={require('../assets/log.png')} style={styles.centerLog} resizeMode="contain" />
					{centerSticks.map((_, i) => {
						const translate = sticksRef.current[i] || (sticksRef.current[i] = new Animated.ValueXY({ x: 0, y: 0 }));
						const opacity = opacityRef.current[i] || (opacityRef.current[i] = new Animated.Value(0));
						return (
							<React.Fragment key={`stick-frag-${i}`}>
								<Animated.View key={`stick-${i}`} style={[styles.stickWrap, { transform: [{ translateX: translate.x }, { translateY: translate.y }], opacity }]}> 
									<Image source={getStickSource()} style={styles.stick} resizeMode="contain" />
								</Animated.View>
								{/* hand */}
								{(() => {
									// ensure refs exist
									handsRef.current[i] = handsRef.current[i] || new Animated.ValueXY({ x: 0, y: 0 });
									handOpacityRef.current[i] = handOpacityRef.current[i] || new Animated.Value(0);
									const hand = handsRef.current[i];
									const hOp = handOpacityRef.current[i];
									const handSource = getHandSource(participants[i]?.userId || participants[i]?.username);
									// rotate hand so it points from the player's position toward the center
									const posAngle = positions[i]?.angle ?? 0; // angle from center -> player
									const rotateToCenter = `${posAngle + Math.PI / 2}rad`; // adjust so default-down asset points inward
									return (
										<Animated.View key={`hand-${i}`} style={[styles.handWrap, { transform: [{ translateX: hand.x }, { translateY: hand.y }, { rotate: rotateToCenter }], opacity: hOp }]}> 
											<Image source={handSource} style={styles.hand} resizeMode="contain" />
										</Animated.View>
									);
								})()}
							</React.Fragment>
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
	container: { flex: 1, backgroundColor: '#f0fdf4' },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
	headerBox: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
	penaltyLabel: { color: '#047857', fontFamily: 'LilitaOne_400Regular' },
	penaltyText: { color: '#111827', fontFamily: 'LilitaOne_400Regular', marginTop: 4 },
	stage: { flex: 1 },
	player: { position: 'absolute', alignItems: 'center', width: 88 },
	avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#e5e7eb' },
	username: { marginTop: 6, fontSize: 12, fontFamily: 'LilitaOne_400Regular', color: '#064e3b', maxWidth: 88, textAlign: 'center' },
	centerCluster: { position: 'absolute', width: 40, height: 80, alignItems: 'center', justifyContent: 'center' },
	centerLog: { position: 'absolute', width: 100, height: 100, opacity: 0.95 },
	stickWrap: { position: 'absolute', left: 0, top: 0 },
	stick: { width: 50, height: 50, transform: [{ rotate: '-45deg' }] },
	handWrap: { position: 'absolute', left: 0, top: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
	hand: { width: 50, height: 50, transform: [{ rotate: '0deg' }] },
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


import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Modal, TouchableOpacity, ActivityIndicator, Animated, Easing } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { gamesApi } from '../api';
import { getAvatarSource } from '../utils/avatars';
import { getStickSource } from '../utils/stick';
import { getUserNameColor } from '../utils/getUserNameColor';

// El görseli seçici
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

// Normalleştirme yardımcıları (diğer ekranlarla uyumlu)
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

export default function GamePlayScreen({ route, navigation }) {
	const { gameId } = route.params;
	const { user } = useAuth();
	const me = user?.id != null ? String(user.id) : null;

	// Yerleşim (layout) durumu
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
		// Modal açma zamanlayıcıları
		const openCheckTimerRef = useRef(null);
		const openFallbackTimerRef = useRef(null);
		// Zamanlayıcı geri çağrıları için en güncel durum referansları
		const latestDetailRef = useRef(null);
		const latestResultRef = useRef(null);
		const latestParticipantsCountRef = useRef(0);

		const clearOpenTimers = useCallback(() => {
			if (openCheckTimerRef.current) { clearTimeout(openCheckTimerRef.current); openCheckTimerRef.current = null; }
			if (openFallbackTimerRef.current) { clearTimeout(openFallbackTimerRef.current); openFallbackTimerRef.current = null; }
		}, []);

	// Her çubuk için animasyon değerleri
	const sticksRef = useRef([]); // Animated.ValueXY[]
	const opacityRef = useRef([]); // Animated.Value[]
	// Her el için animasyon değerleri
	const handsRef = useRef([]); // Animated.ValueXY[]
	const handOpacityRef = useRef([]); // Animated.Value[]
	const handTimersRef = useRef([]); // oyuncu başına el dizilerini başlatma zamanlayıcıları

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

	// setTimeout geri çağrıları güncel değerleri görsün diye son durumu referanslarda tut
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

	// Bu ekrandayken (animasyon sürerken arka uç bitirirse diye) sonuçları aralıklı kontrol et
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

	// Katılımcılar değiştiğinde animasyon değerlerini hazırla
	useEffect(() => {
		sticksRef.current = participants.map(() => new Animated.ValueXY({ x: 0, y: 0 }));
		opacityRef.current = participants.map(() => new Animated.Value(0));
		// elleri hazırla
		handsRef.current = participants.map(() => new Animated.ValueXY({ x: 0, y: 0 }));
		handOpacityRef.current = participants.map(() => new Animated.Value(0));
		// daha önce planlanan el zamanlayıcılarını temizle
		handTimersRef.current.forEach(t => clearTimeout(t));
		handTimersRef.current = [];
	}, [participants.length]);

	// Oyuncu konumlarını bir daire etrafında hesapla
	const positions = useMemo(() => {
		const { width, height } = layout;
		const cx = width / 2;
		const cy = height / 2 - 40; // başlıklar için biraz boşluk bırak
		const n = Math.max(participants.length, 1);
		const radius = Math.max(80, Math.min(width, height) * 0.34);
		return participants.map((_, i) => {
			// başlangıç açısı -90° (üst) ve saat yönünde
			const angle = (-Math.PI / 2) + (2 * Math.PI * i) / n;
			const x = cx + radius * Math.cos(angle);
			const y = cy + radius * Math.sin(angle);
			return { x, y, angle };
		});
	}, [layout, participants.length]);

	// Yerleşim ve katılımcılar hazır olduğunda dağıtım animasyonunu başlat (ekrana girişte bir kez)
	useEffect(() => {
		if (!participants.length || !layout.width || distributionPlannedRef.current) return;
		setAnimating(true);
			animationStartedRef.current = true;
			distributionPlannedRef.current = true;
			// Daha önce planlanan açma zamanlayıcılarını temizle (baştan planla)
			clearOpenTimers();
			// Beklenen animasyon bitiş zamanını önceden hesapla (dizi gecikmesi + son başlangıç + süre)
			const count = participants.length;
			const initialDelayMs = 1500;
			const staggerMs = 1500;
			const moveDurationMs = 1500;
			// Solma süresini harekete bağla (sınırlı)
			const fadeDurationMs = Math.min(600, Math.max(250, Math.round(moveDurationMs * 0.3)));
			const expectedEnd = Date.now() + initialDelayMs + ((count - 1) * staggerMs) + moveDurationMs;
			expectedAnimEndAtRef.current = expectedEnd;
			animationEndAtRef.current = null;

			// Sonuçlar hazırsa animasyon sonrası kontrol planla ve modali aç
			const checkDelay = Math.max(0, (expectedEnd + 120) - Date.now());
			openCheckTimerRef.current = setTimeout(() => {
				// Zaten açık değilse ve dağıtım mantıksal olarak bittiyse aç
				if (!openCheckTimerRef.current) return; // temizlendi
				if (!showModal && getIsDistributionDone()) {
					setShowModal(true);
				}
			}, checkDelay);

			// Yedek: kısa bir beklemeden sonra her halükarda aç
			const fallbackDelay = Math.max(0, (expectedEnd + 5000) - Date.now());
			openFallbackTimerRef.current = setTimeout(() => {
				if (!openFallbackTimerRef.current) return; // temizlendi
				if (!showModal && isDistributionDone()) setShowModal(true);
			}, fallbackDelay);

		const { width, height } = layout;
		const cx = width / 2;
		const cy = height / 2 - 40;

		const pullBack = 100; // çubuğun oyuncudan önce duracağı kısa mesafe (px)
		const animations = sticksRef.current.map((val, i) => {
			const target = positions[i];
			const stickW = 16; // render boyutu
			const stickH = 80;
			// nihai mutlak koordinatlar
			const finalAbsX = (target?.x ?? cx);
			const finalAbsY = (target?.y ?? cy);
			// kısa hedefi hesapla (el kavrayıp çekebilsin diye biraz uzakta dursun)
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

		// Çubukları yakalayıp çekmek için oyuncu başına el dizilerini planla
		const scheduleHandFor = (i) => {
			// Çubuk animasyon takvimine uygun zamanlamaları hesapla
			const stickStart = initialDelayMs + (i * staggerMs);
			const stickEnd = stickStart + moveDurationMs;
			// El, çubuk gelmeden biraz önce başlasın
			const handMoveDuration = 1000;
			const handStart = Math.max(0, stickEnd - handMoveDuration - 80);
			// İlk oyuncuya ekstra önden başlama ver (elin çubuğa göre geç kalmaması için)
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

			// Yardımcı: dağıtımı/sonucu yalnızca arka uç kesinleştirdiğinde bitmiş say
			const isDistributionDone = useCallback(() => {
				return !!(result?.isCompleted || (result?.shortStickUserId != null && result?.shortStickUserId !== undefined));
			}, [result?.isCompleted, result?.shortStickUserId]);

			// El dizisi: oyuncu başına modüler animasyon
			const startHandSequence = useCallback((index, opts = {}) => {
				const optCx = (opts && opts.cx != null) ? opts.cx : (layout.width ? layout.width / 2 : 0);
				const optCy = (opts && opts.cy != null) ? opts.cy : (layout.height ? layout.height / 2 - 40 : 0);
				const optPull = (opts && opts.pullBack != null) ? opts.pullBack : 36;
				const hand = handsRef.current[index];
				const handOp = handOpacityRef.current[index];
				const stick = sticksRef.current[index];
				if (!hand || !handOp || !stick) return;

				// avatar konumu ve kısa çubuğun mutlak koordinatlarını hesapla
				const pos = positions[index] || { x: optCx, y: optCy };
				const avatarX = pos.x;
				const avatarY = pos.y;

				// çubuğun kısa (mevcut) mutlak konumu: çubuğun çevirisini + merkezi kullan
				// animasyon değerleri merkez kümesine göre görecelidir; sonu pozisyonlara göre hesaplayabiliriz
				const stickTargetAbsX = pos.x - optPull * ( (pos.x - optCx) / (Math.hypot(pos.x - optCx, pos.y - optCy) || 1) );
				const stickTargetAbsY = pos.y - optPull * ( (pos.y - optCy) / (Math.hypot(pos.x - optCx, pos.y - optCy) || 1) );

				// eli avatar yakınında başlat, çubuğa götür, sonra çubuğu avatara çek
				const handStartX = avatarX - optCx; // merkeze göre
				const handStartY = avatarY - optCy;
				const handGrabX = stickTargetAbsX - optCx;
				const handGrabY = stickTargetAbsY - optCy;

				// Pozisyonları sıfırla
				hand.setValue({ x: handStartX, y: handStartY });
				handOp.setValue(0);

				// eli çubuğa götür
				const grabDur = 420;
				const pullDur = 380;

				Animated.sequence([
					Animated.parallel([
						Animated.timing(handOp, { toValue: 1, duration: 150, useNativeDriver: true }),
						Animated.timing(hand, { toValue: { x: handGrabX, y: handGrabY }, duration: grabDur, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
					]),
					// el çubuğa ulaştığında, hem eli hem çubuğu avatara çek
					Animated.parallel([
						Animated.timing(hand, { toValue: { x: handStartX, y: handStartY }, duration: pullDur, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
						Animated.timing(stick, { toValue: { x: handStartX - 8, y: handStartY - 20 }, duration: pullDur, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
						Animated.timing(opacityRef.current[index], { toValue: 1, duration: 120, useNativeDriver: true }),
					]),
					Animated.timing(handOp, { toValue: 0, duration: 120, useNativeDriver: true }),
				]).start(() => {
					// Bu oyuncu için tamamlandı
				});
			}, [positions, layout.width, layout.height]);

	// Modali otomatik kapat ve Sonuç ekranına geç
	const closeAndNavigate = useCallback(() => {
		setShowModal(false);
		// modalin kaybolması için küçük bir gecikme
		setTimeout(() => navigation.replace('Result', { gameId }), 200);
	}, [navigation, gameId]);

	// Otomatik gezinme yok; kullanıcı devam etmek için düğmeye dokunur

			// Veri güncellemeleri animasyon bitiminden sonra tamamlandığını gösterirse tepki olarak aç
			useEffect(() => {
				if (showModal) return;
				if (!animationStartedRef.current) return;
				const expectedEnd = expectedAnimEndAtRef.current ?? 0;
				if (!expectedEnd || Date.now() < (expectedEnd + 120)) return;
				if (isDistributionDone()) setShowModal(true);
			}, [showModal, isDistributionDone, result]);

	// Bileşen kalkarken zamanlayıcıların temizlendiğinden emin ol
	useEffect(() => () => {
		clearOpenTimers();
		handTimersRef.current.forEach(t => clearTimeout(t));
		handTimersRef.current = [];
	}, [clearOpenTimers]);

	const myOutcome = useMemo(() => {
		if (!result || !me) return null;
		// Varsa sonuçlardaki kendi satırımı tercih et (en güvenilir)
		const row = result.results?.find(r => String(r.userId) === String(me));
		if (row) return { isShort: !!row.isShortStick };
		// Aksi halde, kısa çöp kullanıcı idsini yalnızca arka uç sağladıysa kullan
		if (result.shortStickUserId != null && result.shortStickUserId !== undefined) {
			return { isShort: String(result.shortStickUserId) === String(me) };
		}
		// Hâlâ bilinmiyor -> bekleme durumunda kal
		return null;
	}, [result, me]);

	const centerSticks = useMemo(() => {
		// İlk görsel küme için: dar bir dikey yığın
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
			{/* Ceza / Başlık */}
			<View style={styles.headerBox}>
				<Text style={styles.penaltyLabel}>Ceza</Text>
				<Text style={styles.penaltyText}>{detail.penaltyText}</Text>
			</View>

			{/* Sahne alanı */}
			<View style={styles.stage}>
				{/* Oyuncular daire etrafında */}
				{participants.map((p, i) => {
					const pos = positions[i] || { x: cx, y: cy };
					const avatarSize = 56;
					const playerWidth = 88; // styles.player genişliğini eşle; ortalama doğru olsun
		 	  const nameColor = getUserNameColor(p.userId || p.username);
					return (
						<View key={p.userId} style={[styles.player, { left: pos.x - playerWidth / 2, top: pos.y - avatarSize / 2 }]}> 
							<Image source={getAvatarSource(p.userId, p.avatarUrl)} style={styles.avatar} />
							<Text style={[styles.username, { color: nameColor }]} numberOfLines={1}>{p.username}</Text>
						</View>
					);
				})}

				{/* Çubukların merkezde kümelenmesi ve her oyuncuya animasyonları */}
				<View style={[styles.centerCluster, { left: cx - 20, top: cy - 40 }]}>
					{/* kütük görseli (çubukların çıktığı yer) */}
					<Image source={require('../assets/log.png')} style={styles.centerLog} resizeMode="contain" />
					{centerSticks.map((_, i) => {
						const translate = sticksRef.current[i] || (sticksRef.current[i] = new Animated.ValueXY({ x: 0, y: 0 }));
						const opacity = opacityRef.current[i] || (opacityRef.current[i] = new Animated.Value(0));
						return (
							<React.Fragment key={`stick-frag-${i}`}>
								<Animated.View key={`stick-${i}`} style={[styles.stickWrap, { transform: [{ translateX: translate.x }, { translateY: translate.y }], opacity }]}> 
									<Image source={getStickSource()} style={styles.stick} resizeMode="contain" />
								</Animated.View>
								{/* el */}
								{(() => {
									// referansların mevcut olduğundan emin ol
									handsRef.current[i] = handsRef.current[i] || new Animated.ValueXY({ x: 0, y: 0 });
									handOpacityRef.current[i] = handOpacityRef.current[i] || new Animated.Value(0);
									const hand = handsRef.current[i];
									const hOp = handOpacityRef.current[i];
									const handSource = getHandSource(participants[i]?.userId || participants[i]?.username);
									// eli oyuncunun konumundan merkeze doğru işaret edecek şekilde döndür
									const posAngle = positions[i]?.angle ?? 0; // merkezden -> oyuncuya açı
									const rotateToCenter = `${posAngle + Math.PI / 2}rad`; // varsayılan-aşağı varlığı içe baksın
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

			{/* Sonuç ipucu */}
			<View style={styles.footer}>
				<Text style={styles.footerText}>Çubuklar dagıtılıyor…</Text>
			</View>

			{/* Kişisel modal */}
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


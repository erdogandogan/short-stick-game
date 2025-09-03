import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_BASE_URL } from '../api';

// WS taban adresini API tabanından türet
function toWsUrl(apiBase) {
	// apiBase örn: http://host:5189/api
	let base = apiBase.replace(/\/$/, '');
	base = base.replace(/\/api$/i, '');
	if (base.startsWith('https://')) return 'wss://' + base.slice('https://'.length) + '/ws';
	if (base.startsWith('http://')) return 'ws://' + base.slice('http://'.length) + '/ws';
	return 'ws://' + base + '/ws';
}

const WS_URL = toWsUrl(API_BASE_URL);

let socket = null;
let openPromise = null;
const listeners = new Set();

export function connect() {
	if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
		return openPromise || Promise.resolve();
	}
	socket = new WebSocket(WS_URL);
	openPromise = new Promise((resolve) => {
		socket.onopen = () => {
			resolve();
		};
	});
	socket.onmessage = (evt) => {
		try {
			const data = JSON.parse(evt.data);
			listeners.forEach((cb) => cb(data));
		} catch {}
	};
	socket.onclose = () => {
		// kısa bir gecikmeden sonra otomatik yeniden bağlan
		setTimeout(() => {
			try { connect(); } catch {}
		}, 1000);
	};
	socket.onerror = () => {};
	return openPromise;
}

export function subscribe(gameId) {
	connect().then(() => {
		try { socket.send(JSON.stringify({ type: 'subscribe', gameId })); } catch {}
	});
}

export function unsubscribe(gameId) {
	if (!socket) return;
	try { socket.send(JSON.stringify({ type: 'unsubscribe', gameId })); } catch {}
}

export function addListener(cb) {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

export function ping() {
	if (!socket) return;
	try { socket.send(JSON.stringify({ type: 'ping' })); } catch {}
}

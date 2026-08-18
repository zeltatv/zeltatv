import { parseM3U } from './parser';
import type { Channel } from './types';

let channels = $state<Channel[]>([]);
let currentChannel = $state<Channel | null>(null);
let loading = $state(false);
let error = $state<string | null>(null);
let sidebarOpen = $state(true);

// favorites: persisted to localStorage as array of channel ids
const FAV_KEY = 'zeltatv:favorites';
let favoriteIds = $state<Set<string>>(new Set());

if (typeof localStorage !== 'undefined') {
	try {
		const raw = localStorage.getItem(FAV_KEY);
		if (raw) favoriteIds = new Set(JSON.parse(raw));
	} catch {
		// ignore corrupted storage
	}
}

function persistFavorites() {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(FAV_KEY, JSON.stringify([...favoriteIds]));
	} catch {
		// ignore quota errors
	}
}

export function usePlaylist() {
	return {
		get channels() {
			return channels;
		},
		get currentChannel() {
			return currentChannel;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		get hasPlaylist() {
			return channels.length > 0;
		},
		get sidebarOpen() {
			return sidebarOpen;
		},
		get favoriteIds() {
			return favoriteIds;
		},
		get favoritesCount() {
			return favoriteIds.size;
		},
		isFavorite(id: string) {
			return favoriteIds.has(id);
		}
	};
}

export function toggleFavorite(id: string) {
	const next = new Set(favoriteIds);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	favoriteIds = next;
	persistFavorites();
}

export async function loadPlaylist(url: string) {
	loading = true;
	error = null;
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const text = await res.text();
		const parsed = parseM3U(text);
		if (parsed.length === 0) throw new Error('no channels found');
		channels = parsed;
	} catch (e) {
		error = e instanceof Error ? e.message : 'failed to load playlist';
		throw error;
	} finally {
		loading = false;
	}
}

export function loadPlaylistContent(content: string) {
	loading = true;
	error = null;
	try {
		const parsed = parseM3U(content);
		if (parsed.length === 0) throw new Error('no channels found');
		channels = parsed;
	} catch (e) {
		error = e instanceof Error ? e.message : 'failed to load playlist file';
		throw error;
	} finally {
		loading = false;
	}
}

export function selectChannel(channel: Channel) {
	currentChannel = channel;
}

export function toggleSidebar() {
	sidebarOpen = !sidebarOpen;
}

export function clearPlaylist() {
	channels = [];
	currentChannel = null;
	error = null;
}

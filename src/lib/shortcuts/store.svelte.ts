import { defaultShortcuts } from './shortcuts';

const STORAGE_KEY = 'zeltatv:shortcuts';

// user overrides: shortcut id -> key combos
let overrides = $state<Map<string, string[][]>>(new Map());

if (typeof localStorage !== 'undefined') {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) overrides = new Map(JSON.parse(raw));
	} catch {
		// ignore corrupted storage
	}
}

function persist() {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify([...overrides]));
	} catch {
		// ignore quota errors
	}
}

export function setShortcutOverride(id: string, keys: string[][]) {
	const next = new Map(overrides);
	next.set(id, keys);
	overrides = next;
	persist();
}

export function resetShortcut(id: string) {
	const next = new Map(overrides);
	next.delete(id);
	overrides = next;
	persist();
}

export function resetAllShortcuts() {
	overrides = new Map();
	persist();
}

export function getShortcutKeys(id: string): string[][] {
	return overrides.get(id) ?? defaultShortcuts.get(id) ?? [];
}

export function isShortcutCustom(id: string): boolean {
	return overrides.has(id);
}

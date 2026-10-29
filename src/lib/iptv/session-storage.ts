// Persistence of the last session. No heavy dependencies: store and library only use
// the localStorage helpers from here (avoiding a circular import).
export type SavedSession =
	| { type: 'url'; value: string; sourceId?: string }
	| { type: 'file'; sourceId?: string; content?: string; name?: string };

const SESSION_KEY = 'zeltatv:last-session';
const CHANNEL_KEY = 'zeltatv:last-channel';
const SETUP_KEY = 'zeltatv:setup-complete:v1';
const MAX_FILE_SESSION_BYTES = 2 * 1024 * 1024;

function storage(): Storage | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage;
}

export function readSavedSession(): SavedSession | null {
	const store = storage();
	if (!store) return null;
	try {
		const raw = store.getItem(SESSION_KEY);
		if (!raw) return null;
		const value = JSON.parse(raw) as Partial<SavedSession>;
		if (value?.type === 'url' && typeof value.value === 'string' && value.value.trim()) {
			return {
				type: 'url',
				value: value.value,
				sourceId: typeof value.sourceId === 'string' ? value.sourceId : undefined
			};
		}
		if (value?.type === 'file') {
			const sourceId = typeof value.sourceId === 'string' ? value.sourceId : undefined;
			const content = typeof value.content === 'string' ? value.content : undefined;
			const name = typeof value.name === 'string' ? value.name : undefined;
			if (sourceId || content) return { type: 'file', sourceId, content, name };
		}
	} catch {
		// corrupted record: ignore
	}
	return null;
}

export function hasSavedSession(): boolean {
	return readSavedSession() !== null;
}

export function writeSavedSession(session: SavedSession): boolean {
	const store = storage();
	if (!store) return false;
	if (
		session.type === 'file' &&
		session.content &&
		session.content.length > MAX_FILE_SESSION_BYTES
	) {
		// very large file contents are not saved to avoid filling the localStorage quota
		session = { type: 'file', sourceId: session.sourceId, name: session.name };
	}
	try {
		store.setItem(SESSION_KEY, JSON.stringify(session));
		return true;
	} catch {
		return false;
	}
}

export function clearSavedSession() {
	const store = storage();
	if (!store) return;
	try {
		store.removeItem(SESSION_KEY);
		store.removeItem(CHANNEL_KEY);
	} catch {
		// ignore
	}
}

export function rememberChannel(url: string) {
	const store = storage();
	if (!store) return;
	try {
		store.setItem(CHANNEL_KEY, url);
	} catch {
		// ignore
	}
}

export function readLastChannel(): string | null {
	const store = storage();
	if (!store) return null;
	try {
		return store.getItem(CHANNEL_KEY);
	} catch {
		return null;
	}
}

export function clearLastChannel() {
	const store = storage();
	if (!store) return;
	try {
		store.removeItem(CHANNEL_KEY);
	} catch {
		// ignore
	}
}

// Setup runs exactly once: once finished (or deliberately skipped) the wizard is
// never shown again, even if the playlist is empty. The value is persisted both
// in localStorage and (through the preload bridge) in the main process, which
// needs it for the window close behaviour.
type SetupBridge = {
	getSetupStatus?: () => boolean;
	markSetupComplete?: () => void;
};

const SETUP_VALUE = JSON.stringify({ v: 2, complete: true });

function setupBridge(): SetupBridge | null {
	if (typeof globalThis === 'undefined') return null;
	return (globalThis as { electronAPI?: SetupBridge }).electronAPI ?? null;
}

// the legacy value was the plain string '1' - still a completed setup
function isLocalSetupComplete(): boolean {
	const store = storage();
	if (!store) return false;
	try {
		const raw = store.getItem(SETUP_KEY);
		if (!raw) return false;
		if (raw === '1') return true;
		const value = JSON.parse(raw) as { complete?: unknown };
		return value?.complete === true;
	} catch {
		return false;
	}
}

export function isSetupComplete(): boolean {
	if (isLocalSetupComplete()) return true;
	try {
		return setupBridge()?.getSetupStatus?.() === true;
	} catch {
		return false;
	}
}

export function markSetupComplete() {
	const store = storage();
	try {
		store?.setItem(SETUP_KEY, SETUP_VALUE);
	} catch {
		// ignore quota errors
	}
	try {
		setupBridge()?.markSetupComplete?.();
	} catch {
		// the browser (vite dev) has no main process to notify
	}
}

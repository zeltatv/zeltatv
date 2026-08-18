import { loadPlaylist, loadPlaylistContent } from './store.svelte';

export type PlaylistSource = {
	id: string;
	type: 'url' | 'file';
	name: string;
	value: string;
	fileName?: string;
	categoryIds: string[];
};

export type PlaylistCategory = {
	id: string;
	name: string;
};

type LibraryData = {
	sources: PlaylistSource[];
	categories: PlaylistCategory[];
};

const DB_NAME = 'zeltatv-library';
const STORE_NAME = 'state';
const STATE_KEY = 'library';
const LEGACY_HISTORY_KEY = 'zeltatv:url-history';

let sources = $state<PlaylistSource[]>([]);
let categories = $state<PlaylistCategory[]>([]);
let ready = $state(false);
let error = $state<string | null>(null);
let initialization: Promise<void> | null = null;

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(STORE_NAME)) {
				request.result.createObjectStore(STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function readData(): Promise<LibraryData | null> {
	let database: IDBDatabase | null = null;
	try {
		database = await openDatabase();
		return await new Promise((resolve, reject) => {
			const request = database!
				.transaction(STORE_NAME, 'readonly')
				.objectStore(STORE_NAME)
				.get(STATE_KEY);
			request.onsuccess = () => resolve(request.result ?? null);
			request.onerror = () => reject(request.error);
		});
	} catch (cause) {
		throw cause instanceof Error ? cause : new Error('failed to read playlist library');
	} finally {
		database?.close();
	}
}

async function writeData(nextSources: PlaylistSource[], nextCategories: PlaylistCategory[]) {
	let database: IDBDatabase | null = null;
	try {
		const data: LibraryData = {
			sources: nextSources.map((source) => ({
				id: source.id,
				type: source.type,
				name: source.name,
				value: source.value,
				fileName: source.fileName,
				categoryIds: [...source.categoryIds]
			})),
			categories: nextCategories.map((category) => ({ id: category.id, name: category.name }))
		};
		database = await openDatabase();
		await new Promise<void>((resolve, reject) => {
			const transaction = database!.transaction(STORE_NAME, 'readwrite');
			transaction.objectStore(STORE_NAME).put(data, STATE_KEY);
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
	} catch (cause) {
		throw cause instanceof Error ? cause : new Error('failed to save playlist library');
	} finally {
		database?.close();
	}
}

function legacySources(): PlaylistSource[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const saved = JSON.parse(localStorage.getItem(LEGACY_HISTORY_KEY) ?? '[]');
		if (!Array.isArray(saved)) return [];
		return saved
			.filter((value): value is string => typeof value === 'string')
			.map((value) => ({
				id: crypto.randomUUID(),
				type: 'url',
				name: value,
				value,
				categoryIds: []
			}));
	} catch {
		return [];
	}
}

async function loadLibrary() {
	try {
		if (typeof indexedDB === 'undefined') {
			ready = true;
			return;
		}
		const saved = await readData();
		const savedSources = Array.isArray(saved?.sources) ? saved.sources : [];
		const savedCategories = Array.isArray(saved?.categories) ? saved.categories : [];
		const migrated = legacySources().filter(
			(source) => !savedSources.some((item) => item.type === 'url' && item.value === source.value)
		);
		sources = [...savedSources, ...migrated];
		categories = savedCategories;
		if (migrated.length > 0) {
			await writeData(sources, categories);
			localStorage.removeItem(LEGACY_HISTORY_KEY);
		}
	} catch (cause) {
		error = cause instanceof Error ? cause.message : 'failed to load playlist library';
	} finally {
		ready = true;
	}
}

async function save(nextSources: PlaylistSource[], nextCategories = categories) {
	try {
		await writeData(nextSources, nextCategories);
		sources = nextSources;
		categories = nextCategories;
		error = null;
	} catch (cause) {
		error = cause instanceof Error ? cause.message : 'failed to save playlist library';
		throw cause;
	}
}

export function initializeLibrary(): Promise<void> {
	initialization ??= loadLibrary();
	return initialization;
}

export function useLibrary() {
	return {
		get sources() {
			return sources;
		},
		get categories() {
			return categories;
		},
		get ready() {
			return ready;
		},
		get error() {
			return error;
		}
	};
}

export async function addUrlSource(value: string, name: string) {
	const existing = sources.find((source) => source.type === 'url' && source.value === value);
	if (existing) {
		await save(
			sources.map((source) =>
				source.id === existing.id ? { ...source, name: name || value } : source
			)
		);
		return;
	}
	await save([
		{ id: crypto.randomUUID(), type: 'url', name: name || value, value, categoryIds: [] },
		...sources
	]);
}

export async function addFileSource(file: File) {
	const content = await file.text();
	loadPlaylistContent(content);
	const existing = sources.find(
		(source) => source.type === 'file' && source.fileName === file.name
	);
	if (existing) {
		await save(
			sources.map((source) => (source.id === existing.id ? { ...source, value: content } : source))
		);
		return;
	}
	await save([
		{
			id: crypto.randomUUID(),
			type: 'file',
			name: file.name,
			fileName: file.name,
			value: content,
			categoryIds: []
		},
		...sources
	]);
}

export async function playSource(source: PlaylistSource) {
	if (source.type === 'url') {
		await loadPlaylist(source.value);
		return;
	}
	loadPlaylistContent(source.value);
}

export async function updateSource(
	id: string,
	updates: Pick<PlaylistSource, 'name' | 'value' | 'categoryIds'>
) {
	const name = updates.name.trim();
	const value = updates.value.trim();
	if (!name || !value) throw new Error('playlist name and source are required');
	const validCategoryIds = updates.categoryIds.filter((categoryId) =>
		categories.some((category) => category.id === categoryId)
	);
	await save(
		sources.map((source) =>
			source.id === id ? { ...source, name, value, categoryIds: validCategoryIds } : source
		)
	);
}

export async function addCategory(name: string) {
	const trimmed = name.trim();
	if (!trimmed) return;
	if (categories.some((category) => category.name.toLowerCase() === trimmed.toLowerCase())) return;
	await save(sources, [{ id: crypto.randomUUID(), name: trimmed }, ...categories]);
}

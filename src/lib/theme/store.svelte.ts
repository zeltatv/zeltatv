import { generateThemeVars, isDarkColor } from './generator';

const STORAGE_KEY = 'zeltatv:theme';

// default background matches the oklch(0.145 0 0) dark theme from layout.css
export const DEFAULT_BG = '#141414';
export const THEME_PRESETS = [
	{ id: 'default', bg: '#141414' },
	{ id: 'light', bg: '#f5f5f5' },
	{ id: 'navy', bg: '#0a0e1a' },
	{ id: 'forest', bg: '#0a1410' },
	{ id: 'plum', bg: '#1a0a1e' },
	{ id: 'warm', bg: '#1e1a14' },
] as const;

let bg = $state<string>(DEFAULT_BG);

if (typeof localStorage !== 'undefined') {
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved) bg = saved;
}

export function getThemeBg(): string {
	return bg;
}

export function setThemeBg(hex: string) {
	bg = hex;
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, hex);
	}
	applyTheme(hex);
}

export function resetTheme() {
	setThemeBg(DEFAULT_BG);
}

export function applyTheme(hex: string) {
	if (typeof document === 'undefined') return;
	const vars = generateThemeVars(hex);
	const root = document.documentElement;
	for (const [key, value] of Object.entries(vars)) {
		root.style.setProperty(key, value);
	}
	// toggle .dark class for tailwind dark: variants
	if (isDarkColor(hex)) {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}
	// update windows title bar overlay to match theme
	const api = (globalThis as any).electronAPI;
	api?.setTitleBarOverlay?.({
		color: hex,
		symbolColor: isDarkColor(hex) ? '#ffffff' : '#000000'
	});
}

// apply on module load so theme is active before first render
if (typeof document !== 'undefined') {
	applyTheme(bg);
}

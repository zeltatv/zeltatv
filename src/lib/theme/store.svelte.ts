import { generateThemeVars, isDarkColor } from './generator';
import { ENHANCED_VARS, isEnhancedSkin, type SkinId } from './skins';

const STORAGE_KEY = 'zeltatv:theme';
const ACCENT_KEY = 'zeltatv:accent';
const SKIN_KEY = 'zeltatv:skin';

// default background matches the oklch(0.145 0 0) dark theme from layout.css
export const DEFAULT_BG = '#141414';
/** Enhanced skin's signature color (turquoise) */
export const DEFAULT_ACCENT = '#2ee6f6';

/**
 * Theme presets: background + accent color.
 * The accent is only used in the Enhanced skin; ZeltaTV keeps its own amber color.
 */
export const THEME_PRESETS = [
	{ id: 'default', bg: '#141414', accent: DEFAULT_ACCENT },
	{ id: 'mono', bg: '#000000', accent: '#f2f2f2' },
	{ id: 'light', bg: '#f5f5f5', accent: null },
	{ id: 'navy', bg: '#0a0e1a', accent: '#6aa8ff' },
	{ id: 'forest', bg: '#0a1410', accent: '#5ce0a0' },
	{ id: 'plum', bg: '#1a0a1e', accent: '#d0a2ff' },
	{ id: 'warm', bg: '#1e1a14', accent: '#f6c445' }
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number];

let bg = $state<string>(DEFAULT_BG);
let accent = $state<string | null>(DEFAULT_ACCENT);
// default skin: ZeltaTV (classic); Enhanced is enabled by user choice
let skin = $state<SkinId>('zeltatv');

if (typeof localStorage !== 'undefined') {
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved) bg = saved;
	const savedAccent = localStorage.getItem(ACCENT_KEY);
	// empty string means "derive the accent from the theme"
	if (savedAccent !== null) accent = savedAccent === '' ? null : savedAccent;
	const savedSkin = localStorage.getItem(SKIN_KEY);
	if (savedSkin === 'zeltatv' || savedSkin === 'enhanced') skin = savedSkin;
}

export function getThemeBg(): string {
	return bg;
}

export function getThemeAccent(): string | null {
	return accent;
}

export function getSkin(): SkinId {
	return skin;
}

export function setSkin(next: SkinId) {
	if (skin === next) return;
	skin = next;
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(SKIN_KEY, next);
	}
	applyTheme(bg, accent);
}

export function setThemePreset(preset: ThemePreset) {
	bg = preset.bg;
	accent = preset.accent;
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, preset.bg);
		localStorage.setItem(ACCENT_KEY, preset.accent ?? '');
	}
	applyTheme(bg, accent);
}

/** Custom background color: the accent is derived automatically from the background tone. */
export function setThemeBg(hex: string) {
	bg = hex;
	accent = null;
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, hex);
		localStorage.setItem(ACCENT_KEY, '');
	}
	applyTheme(hex, null);
}

export function resetTheme() {
	setThemePreset(THEME_PRESETS[0]);
}

export function applyTheme(hex: string, accentHex: string | null = accent) {
	if (typeof document === 'undefined') return;
	const enhanced = isEnhancedSkin(skin);
	const base = hex;
	const vars: Record<string, string> = {
		...generateThemeVars(base),
		...(enhanced ? ENHANCED_VARS : {})
	};
	// Enhanced: the selected accent color overrides the palette
	if (enhanced && accentHex) {
		vars['--primary'] = accentHex;
		vars['--ring'] = accentHex;
		vars['--sidebar-primary'] = accentHex;
		vars['--sidebar-ring'] = accentHex;
		vars['--primary-foreground'] = isDarkColor(accentHex) ? 'hsl(0 0% 98%)' : 'hsl(0 0% 6%)';
		vars['--sidebar-primary-foreground'] = vars['--primary-foreground'];
	}
	const root = document.documentElement;
	for (const [key, value] of Object.entries(vars)) {
		root.style.setProperty(key, value);
	}
	root.setAttribute('data-skin', skin);
	// toggle .dark class for tailwind dark: variants
	if (isDarkColor(base)) {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}
	// update windows title bar overlay to match theme
	const api = (
		globalThis as unknown as {
			electronAPI?: { setTitleBarOverlay?: (opts: Record<string, string>) => void };
		}
	).electronAPI;
	api?.setTitleBarOverlay?.({
		color: base,
		symbolColor: isDarkColor(base) ? '#ffffff' : '#000000'
	});
}

// apply on module load so theme is active before first render
if (typeof document !== 'undefined') {
	applyTheme(getThemeBg(), getThemeAccent());
}

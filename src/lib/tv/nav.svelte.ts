// tv-nav: remote (d-pad) navigation layer for the whole UI.
//
// goal: make every screen of the app usable with a TV remote -
// just like old satellite receivers:
//   - arrow keys: move a visible focus ring around
//   - OK (enter): activates the focused item (button, channel, toggle...)
//   - back (backspace) / escape: closes the menu, returns to the previous screen
//   - number keys: zap by channel number (satellite receiver style)
//   - page up/down: next/previous channel (CH+/CH-)
//
// mouse usage is unaffected; when remote mode is engaged a distinct yellow
// focus ring is shown (layout.css).

import { goto } from '$app/navigation';
import { selectChannel, toggleSidebar, usePlaylist } from '$lib/iptv/store.svelte';

const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'summary',
	'[tabindex]:not([tabindex="-1"])'
].join(',');

// auto-zap delay after a channel number is typed (ms) - if the user keeps typing
// within this window the timer resets (e.g. type "1" then "2" for "12")
const OSD_TIMEOUT = 5000;

const playlist = usePlaylist();

let initialized = false;
let osdDigits = $state('');
let osdTimer: ReturnType<typeof setTimeout> | null = null;

// reactive state for overlay components
export function useTvNav() {
	return {
		get osdDigits() {
			return osdDigits;
		},
		get osdVisible() {
			return osdDigits.length > 0;
		}
	};
}

// ---------------------------------------------------------------------------
// focusable elements
// ---------------------------------------------------------------------------

/** In fullscreen the sidebar is hidden via CSS; the back key should not count it as "open". */
function sidebarShown(): boolean {
	if (!playlist.sidebarOpen) return false;
	const el = document.querySelector<HTMLElement>('[data-app-sidebar]');
	return el !== null && isVisible(el);
}

function isVisible(el: HTMLElement): boolean {
	if (!el.isConnected) return false;
	if (el.closest('[aria-hidden="true"], [hidden], [inert]')) return false;
	const rect = el.getBoundingClientRect();
	if (rect.width < 2 || rect.height < 2) return false;
	const style = getComputedStyle(el);
	if (style.visibility === 'hidden' || style.display === 'none') return false;
	// items inside collapsed (zero-size, overflow-hidden) containers count as
	// invisible - e.g. a closed sidebar
	let parent = el.parentElement;
	for (let i = 0; parent && i < 40; i++) {
		const parentStyle = getComputedStyle(parent);
		if (parentStyle.overflowX === 'hidden' || parentStyle.overflowY === 'hidden') {
			const r = parent.getBoundingClientRect();
			if (r.width < 2 || r.height < 2) return false;
		}
		parent = parent.parentElement;
	}
	return true;
}

function focusables(scope: ParentNode): HTMLElement[] {
	// focusable containers such as the tab content panel should not be remote targets;
	// the real controls inside them (buttons, switches, etc.) remain targets
	return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		(el) => !el.matches('[data-slot="tabs-content"], [role="tabpanel"]') && isVisible(el)
	);
}

function openSurface(selector: string): HTMLElement | null {
	const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
	return nodes.find((node) => isVisible(node)) ?? null;
}

const openDialog = () => openSurface('[data-slot="dialog-content"]');
const openMenu = () => openSurface('[data-slot="dropdown-menu-content"]');

function firstChannelEl(): HTMLElement | null {
	const el = document.querySelector<HTMLElement>('[data-tv-channel-item]');
	return el && isVisible(el) ? el : null;
}

// ---------------------------------------------------------------------------
// focus movement
// ---------------------------------------------------------------------------

function focusEl(el: HTMLElement) {
	el.focus({ preventScroll: true });
	try {
		el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	} catch {
		// no-op on older engines
	}
}

function setRemoteMode(on: boolean) {
	if (typeof document === 'undefined') return;
	if (on) document.body.setAttribute('data-tv-nav', '');
	else document.body.removeAttribute('data-tv-nav');
}

// focus the first sensible element when the app opens / when returning from a page
export function focusInitial(): boolean {
	const channel = firstChannelEl();
	if (channel) {
		setRemoteMode(true);
		focusEl(channel);
		return true;
	}
	const seed = document.querySelector<HTMLElement>('[data-tv-focus-initial]');
	if (seed && isVisible(seed)) {
		setRemoteMode(true);
		focusEl(seed);
		return true;
	}
	return false;
}

type Direction = 'up' | 'down' | 'left' | 'right';

// when moving down from the tab bar: go to the topmost control of the active
// tab's content panel (satellite receiver expectation). cone selection can land
// on wrong candidates here (e.g. Language tab -> Spanish row instead of the search field)
// pick the first (leftmost) control in the top row of a set of elements
function topRowFirst(items: HTMLElement[]): HTMLElement | null {
	if (items.length === 0) return null;
	let best = items[0];
	for (const el of items) {
		const a = el.getBoundingClientRect();
		const b = best.getBoundingClientRect();
		if (a.top < b.top - 4) best = el;
		else if (Math.abs(a.top - b.top) <= 4 && a.left < b.left) best = el;
	}
	return best;
}

function tabPanelOf(el: HTMLElement): HTMLElement | null {
	return el.closest<HTMLElement>('[role="tabpanel"], [data-slot="tabs-content"]');
}

// find the tab that owns the panel (aria-labelledby or aria-controls match)
function tabForPanel(panel: HTMLElement): HTMLElement | null {
	const labelledBy = panel.getAttribute('aria-labelledby');
	if (labelledBy) {
		const el = document.getElementById(labelledBy);
		if (el?.getAttribute('role') === 'tab') return el;
	}
	const tabs = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"][aria-controls]'));
	for (const tab of tabs) {
		const id = tab.getAttribute('aria-controls');
		if (id && document.getElementById(id) === panel) return tab;
	}
	return null;
}

// target when leaving a panel upwards: the active tab (or the panel's tab if none is selected)
function activeTabForPanel(panel: HTMLElement): HTMLElement | null {
	const tab = tabForPanel(panel);
	if (!tab) return null;
	const list = tab.closest<HTMLElement>('[role="tablist"]');
	const selected = list?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
	if (selected && isVisible(selected)) return selected;
	return isVisible(tab) ? tab : null;
}

// topmost control in the panel (e.g. the "Search languages…" field)
function topControl(panel: HTMLElement): HTMLElement | null {
	return topRowFirst(focusables(panel));
}

function tabPanelTarget(anchor: HTMLElement): HTMLElement | null {
	const tab = anchor.closest<HTMLElement>('[role="tab"]');
	if (!tab) return null;
	// only applies to horizontal tab bars (in vertical mode ↓ moves between tabs)
	const list = tab.closest<HTMLElement>('[role="tablist"]');
	if (list?.getAttribute('aria-orientation') === 'vertical') return null;

	const controls = tab.getAttribute('aria-controls');
	let panel: HTMLElement | null = controls ? document.getElementById(controls) : null;
	if (!panel) {
		panel =
			Array.from(
				document.querySelectorAll<HTMLElement>('[role="tabpanel"], [data-slot="tabs-content"]')
			).find((el) => isVisible(el)) ?? null;
	}
	if (!panel) return null;

	return topControl(panel);
}

function moveFocus(direction: Direction): boolean {
	const active = document.activeElement as HTMLElement | null;
	const scope: ParentNode = openDialog() ?? document.body;
	const candidates = focusables(scope).filter((el) => el !== active);
	if (candidates.length === 0) return false;

	// no focus: jump to the natural starting point
	if (!active || active === document.body || !isVisible(active)) {
		if (!focusInitial()) focusEl(candidates[0]);
		return true;
	}

	const anchor = active; // type safety inside the closure
	const current = anchor.getBoundingClientRect();
	const cx = current.left + current.width / 2;
	const cy = current.top + current.height / 2;
	const activeParentRect = anchor.parentElement?.getBoundingClientRect() ?? null;

	// home tiles: moving down from a tile's play button goes to that tile's own
	// actions (edit / delete) instead of jumping over them to the form below.
	// the buttons sit at the tile's right edge, so the focus cone would drop
	// them on narrow windows where the grid has only two columns.
	if (direction === 'down') {
		const row = anchor.closest<HTMLElement>('[data-focus-row]');
		if (row) {
			const below = focusables(row)
				.filter((el) => el !== anchor)
				.filter((el) => el.getBoundingClientRect().top >= current.bottom - 4)
				.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
			if (below.length > 0) {
				focusEl(below[0]);
				return true;
			}
		}
	}

	// the other way round: up from a tile's edit / delete button returns to the
	// tile itself instead of hopping sideways to the neighbouring icon
	if (direction === 'up') {
		const row = anchor.closest<HTMLElement>('[data-focus-row]');
		if (row) {
			const first = focusables(row)[0];
			if (first && first !== anchor) {
				focusEl(first);
				return true;
			}
		}
	}

	// 4-stage selection:
	//  1) neighbors in the same container (row) -> navbar/tab sliding
	//  2) items on the same visual row (containers of similar height)
	//  3) nearest item inside the focus cone (45 degrees)
	//  4) nearest directional candidate (for dead ends)
	function pick(
		mode: 'parent' | 'row' | 'cone' | 'any',
		pool: HTMLElement[] = candidates
	): HTMLElement | null {
		let best: HTMLElement | null = null;
		let bestScore = Number.POSITIVE_INFINITY;
		for (const candidate of pool) {
			if (mode === 'parent' && candidate.parentElement !== anchor.parentElement) continue;

			if (mode === 'row') {
				const rp = candidate.parentElement?.getBoundingClientRect();
				if (!rp || !activeParentRect) continue;
				const minH = Math.min(rp.height, activeParentRect.height);
				const maxH = Math.max(rp.height, activeParentRect.height);
				if (minH <= 0 || maxH > minH * 3) continue; // different-scale container (e.g. the whole content area)
				const rowOverlap =
					Math.min(rp.bottom, activeParentRect.bottom) - Math.max(rp.top, activeParentRect.top);
				if (rowOverlap < minH * 0.5) continue;
			}

			const rect = candidate.getBoundingClientRect();
			const dx = rect.left + rect.width / 2 - cx;
			const dy = rect.top + rect.height / 2 - cy;

			const vertical = direction === 'up' || direction === 'down';
			const primary = vertical ? (direction === 'up' ? -dy : dy) : direction === 'left' ? -dx : dx;
			if (primary <= 0.5) continue; // not in the requested direction

			const secondary = Math.abs(vertical ? dx : dy);
			// focus cone: drop items far off the direction axis (keeps sliding within a row)
			if (mode === 'cone' && secondary > primary * 1.4 + 32) continue;

			const overlapX = Math.min(current.right, rect.right) - Math.max(current.left, rect.left);
			const overlapY = Math.min(current.bottom, rect.bottom) - Math.max(current.top, rect.top);
			const overlap = vertical ? overlapX : overlapY;

			// prefer aligned items, penalize diagonal jumps
			const score = primary + secondary * (overlap > 0 ? 0.35 : mode === 'parent' ? 1.0 : 1.8);
			if (score < bestScore) {
				bestScore = score;
				best = candidate;
			}
		}
		return best;
	}

	// while inside a tab content panel, moving up is symmetric:
	// row -> (if any) row above -> search field -> active tab.
	// to avoid drifting to candidates outside the panel (neighboring tab, top bar),
	// the search only considers candidates inside the panel.
	const panel = direction === 'up' ? tabPanelOf(anchor) : null;

	let best: HTMLElement | null;
	if (panel) {
		const inner = candidates.filter((el) => panel.contains(el));
		best = pick('parent', inner) ?? pick('row', inner) ?? pick('cone', inner);
		if (!best) {
			const top = topControl(panel);
			best = top && top !== anchor ? top : activeTabForPanel(panel);
		}
	} else {
		best = pick('parent') ?? pick('row');
		if (!best && direction === 'down') best = tabPanelTarget(anchor);
		best = best ?? pick('cone') ?? pick('any');
	}

	if (!best) return false;

	// moving up into the title bar always lands on its first control (the Home
	// button) instead of the nearest one: the quit button sits right above the
	// content on wide screens and a stray OK there would close the app
	if (direction === 'up') {
		const header = best.closest<HTMLElement>('[data-app-header]');
		if (header) {
			const first = focusables(header)[0];
			if (first && first !== anchor) best = first;
		}
	}

	// arriving from outside a home tile (e.g. from the URL form below) lands on
	// the tile itself, not on its small edit / delete icons: a stray OK there
	// would delete the source without asking
	if (direction === 'up') {
		const row = best.closest<HTMLElement>('[data-focus-row]');
		if (row && !row.contains(anchor)) {
			const first = focusables(row)[0];
			if (first) best = first;
		}
	}

	focusEl(best);
	return true;
}

// ---------------------------------------------------------------------------
// back key
// ---------------------------------------------------------------------------

function dispatchEscape(el: HTMLElement) {
	el.dispatchEvent(
		new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
	);
}

function focusChannelList() {
	const first = firstChannelEl();
	if (first) {
		setRemoteMode(true);
		focusEl(first);
	}
}

function handleBackKey(key: string, target: HTMLElement | null): boolean {
	// if a channel number is being typed, handle that first
	if (osdDigits) {
		osdDigits = key === 'Backspace' ? osdDigits.slice(0, -1) : '';
		if (osdDigits) {
			scheduleOsd();
		} else if (osdTimer) {
			clearTimeout(osdTimer);
			osdTimer = null;
		}
		return true;
	}

	const isEscape = key === 'Escape';
	const isText = isTextEditable(target);

	// Open layers close first; if the channel list is open in fullscreen, the first
	// back only closes the list, the next back exits fullscreen.
	if (isEscape) {
		if (openMenu() || openDialog()) return false; // bits-ui closes it itself
		if (document.body.hasAttribute('data-tv-escape-guard')) return false; // shortcut editing mode
		if (document.fullscreenElement && !sidebarShown()) return false; // the browser exits fullscreen
		if (isText) {
			target?.blur();
			return true;
		}
	} else if (isText) {
		return false; // backspace edits text
	}

	// close open layers
	const menu = openMenu();
	if (menu) {
		dispatchEscape(menu);
		return true;
	}
	const dialog = openDialog();
	if (dialog) {
		dispatchEscape(dialog);
		return true;
	}

	// in fullscreen, if the channel list is visible close it first
	if (document.fullscreenElement && sidebarShown()) {
		toggleSidebar();
		const surface = document.querySelector<HTMLElement>('[data-tv-player-surface]');
		if (surface && isVisible(surface)) focusEl(surface);
		return true;
	}

	// exit fullscreen
	if (document.fullscreenElement) {
		void document.exitFullscreen().catch(() => {});
		return true;
	}

	// return from a subpage to the home screen
	if (location.pathname !== '/') {
		void goto('/');
		return true;
	}

	// home screen: the sidebar behaves like a satellite receiver's channel menu
	const active = document.activeElement as HTMLElement | null;
	if (active?.closest('[data-tv-sidebar]')) {
		toggleSidebar();
		const surface = document.querySelector<HTMLElement>('[data-tv-player-surface]');
		if (surface && isVisible(surface)) focusEl(surface);
		return true;
	}
	if (!playlist.hasPlaylist) return false;
	if (!playlist.sidebarOpen) {
		toggleSidebar();
		setTimeout(focusChannelList, 260);
	} else {
		focusChannelList();
	}
	return true;
}

// ---------------------------------------------------------------------------
// keyboard helpers
// ---------------------------------------------------------------------------

function isTextEditable(el: Element | null | undefined): boolean {
	if (!el || !(el instanceof HTMLElement)) return false;
	if (el.isContentEditable) return true;
	const tag = el.tagName;
	if (tag === 'TEXTAREA') return true;
	if (tag === 'INPUT') {
		const type = (el as HTMLInputElement).type;
		return ![
			'button',
			'submit',
			'reset',
			'checkbox',
			'radio',
			'range',
			'color',
			'file',
			'image',
			'hidden'
		].includes(type);
	}
	return false;
}

// is this the player surface? (then arrows are left to the video player: zap / seek)
export function isPlayerSurface(target: EventTarget | null): boolean {
	const el = target instanceof HTMLElement ? target : null;
	if (!el) return false;
	if (el.matches('[data-tv-player-surface]') || el.tagName === 'VIDEO') return true;
	if (document.fullscreenElement) {
		return !el.closest(
			'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'
		);
	}
	return false;
}

// ---------------------------------------------------------------------------
// zap by channel number (osd)
// ---------------------------------------------------------------------------

function scheduleOsd() {
	if (osdTimer) clearTimeout(osdTimer);
	osdTimer = setTimeout(commitOsd, OSD_TIMEOUT);
}

function clearOsd() {
	osdDigits = '';
	if (osdTimer) {
		clearTimeout(osdTimer);
		osdTimer = null;
	}
}

function commitOsd() {
	const digits = osdDigits;
	clearOsd();
	if (!digits) return;
	const number = parseInt(digits, 10);
	const channels = playlist.channels;
	if (number >= 1 && number <= channels.length) selectChannel(channels[number - 1]);
}

// ---------------------------------------------------------------------------
// main key handler
// ---------------------------------------------------------------------------

const ARROWS: Record<string, Direction> = {
	ArrowUp: 'up',
	ArrowDown: 'down',
	ArrowLeft: 'left',
	ArrowRight: 'right'
};

function onKeydown(e: KeyboardEvent) {
	if (e.defaultPrevented) return;
	const target = e.target as HTMLElement | null;
	const key = e.key;

	// ---- arrow keys -------------------------------------------------------
	const direction = ARROWS[key];
	if (direction) {
		// alt+left: the "back" combination on many remotes and browsers
		if (e.altKey && key === 'ArrowLeft') {
			if (handleBackKey('BrowserBack', target)) {
				setRemoteMode(true);
				e.preventDefault();
				e.stopPropagation();
			}
			return;
		}
		// ctrl / shift / alt combinations are left to shortcuts
		if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
		if (osdDigits) clearOsd();

		// on the video surface arrows belong to the player (zap / seeking) only in fullscreen;
		// in windowed mode they keep moving the focus ring
		if (document.fullscreenElement && isPlayerSurface(target)) return;

		// in single-line text fields left/right moves the caret, up/down
		// moves focus out (a way out of the field with the remote)
		if (isTextEditable(target) && (direction === 'left' || direction === 'right')) return;
		if (isTextEditable(target) && target?.tagName === 'TEXTAREA') return;
		if (
			target instanceof HTMLInputElement &&
			target.type === 'range' &&
			direction !== 'up' &&
			direction !== 'down'
		)
			return; // sliders are adjusted with left/right

		if (moveFocus(direction)) {
			setRemoteMode(true);
			e.preventDefault();
			e.stopPropagation();
		}
		return;
	}

	// ---- number keys: zap by channel number ------------------------------
	if (/^[0-9]$/.test(key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
		if (isTextEditable(target)) return;
		if (target?.closest('[data-slot="dropdown-menu-content"], [data-slot="dialog-content"]'))
			return;
		if (playlist.channels.length === 0) return;
		osdDigits = (osdDigits + key).slice(-4);
		scheduleOsd();
		setRemoteMode(true);
		e.preventDefault();
		return;
	}

	// ---- OK: confirm the typed channel number -------------------------------
	if ((key === 'Enter' || key === 'NumpadEnter') && osdDigits) {
		commitOsd();
		e.preventDefault();
		e.stopPropagation();
		return;
	}

	// ---- OK key: activate the focused item --------------------------------
	// Most remotes send "Enter" for OK; the player surface keeps its own
	// behavior (channel menu), and text fields do their own thing.
	if (key === 'Enter' || key === 'NumpadEnter' || key === 'Select' || key === 'Accept') {
		if (isTextEditable(target)) {
			// OK inside a form field submits the form: a TV remote has no "Go"
			// button, so the address field must start the playlist on its own
			const form = target?.closest('form');
			if (form) {
				e.preventDefault();
				e.stopPropagation();
				form.requestSubmit();
			}
			return;
		}
		if (isPlayerSurface(target)) return;
		const el = target?.closest<HTMLElement>(
			'button, a[href], summary, [role="button"], [role="option"], [role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"]'
		);
		if (el && !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true') {
			e.preventDefault();
			e.stopPropagation();
			el.click();
		}
		return;
	}

	// ---- back keys -------------------------------------------------------
	if (
		key === 'Backspace' ||
		key === 'Escape' ||
		key === 'BrowserBack' ||
		key === 'GoBack' ||
		key === 'ContextMenu'
	) {
		if (handleBackKey(key, target)) {
			setRemoteMode(true);
			e.preventDefault();
			e.stopPropagation();
		}
	}
}

// ---------------------------------------------------------------------------
// initialization
// ---------------------------------------------------------------------------

export function initTvNav() {
	if (initialized || typeof window === 'undefined') return;
	initialized = true;
	window.addEventListener('keydown', onKeydown, true);
	// hide the distinct TV focus ring on mouse interaction
	window.addEventListener('pointerdown', () => setRemoteMode(false), true);
	window.addEventListener('wheel', () => setRemoteMode(false), { passive: true, capture: true });
	// right click: acts as the back key (no browser menu)
	window.addEventListener(
		'contextmenu',
		(e) => {
			e.preventDefault();
			const target = e.target instanceof HTMLElement ? e.target : null;
			if (target && isTextEditable(target)) target.blur();
			if (handleBackKey('BrowserBack', null)) setRemoteMode(true);
		},
		true
	);
	// mouse side (back) button: back
	window.addEventListener(
		'mousedown',
		(e) => {
			if (e.button !== 3) return;
			e.preventDefault();
			if (handleBackKey('BrowserBack', e.target instanceof HTMLElement ? e.target : null)) {
				setRemoteMode(true);
			}
		},
		true
	);
}

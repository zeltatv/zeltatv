// Xbox / standard gamepad support (Gamepad API).
//
// The pad emits the same keys the remote sends, so the existing
// TV navigation (focus ring, channel menu, back key) works unchanged.
//
//   D-pad / left stick → arrow keys
//   A (0)  → Enter (OK)
//   B (1)  → Escape (back)
//   X (2)  → Enter (OK)
//   Y (3)  → K (play/pause; may turn into a click on the focused button)
//   LB (4) → PageUp   (previous channel)
//   RB (5) → PageDown (next channel)
//   Menu (9) → main menu

const DEADZONE = 0.55;
const REPEAT_DELAY = 380;
const REPEAT_INTERVAL = 120;

const DIRECTION_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

const DPAD: Array<{ index: number; key: string }> = [
	{ index: 12, key: 'ArrowUp' },
	{ index: 13, key: 'ArrowDown' },
	{ index: 14, key: 'ArrowLeft' },
	{ index: 15, key: 'ArrowRight' }
];

const ACTIONS: Array<{ index: number; key?: string; action?: 'menu' }> = [
	{ index: 0, key: 'Enter' },
	{ index: 1, key: 'Escape' },
	{ index: 2, key: 'Enter' },
	{ index: 3, key: 'k' },
	{ index: 4, key: 'PageUp' },
	{ index: 5, key: 'PageDown' },
	{ index: 9, action: 'menu' }
];

function dispatchKey(key: string) {
	if (typeof document === 'undefined') return;
	const el = (document.activeElement as HTMLElement | null) ?? document.body;
	el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function openMenu() {
	if (typeof document === 'undefined') return;
	document.querySelector<HTMLElement>('[data-tv-menu-toggle]')?.click();
}

let cleanup: (() => void) | null = null;

/** Starts the gamepad listener; repeated calls return the same cleanup function. */
export function initGamepad(): (() => void) | undefined {
	if (cleanup) return cleanup;
	if (
		typeof window === 'undefined' ||
		typeof navigator === 'undefined' ||
		typeof navigator.getGamepads !== 'function'
	) {
		return undefined;
	}

	let raf = 0;
	let running = false;
	const heldDirs = new Set<string>();
	const nextRepeat = new Map<string, number>();
	const pressedActions = new Set<string>();

	// returns connected pads (in Chrome a pad only appears after a button press)
	const connectedPads = (): Gamepad[] => {
		const pads = navigator.getGamepads?.() ?? [];
		const list: Gamepad[] = [];
		for (const pad of pads) {
			if (pad && pad.connected) list.push(pad);
		}
		return list;
	};

	const resetState = () => {
		heldDirs.clear();
		nextRepeat.clear();
		pressedActions.clear();
	};

	const loop = () => {
		raf = 0;
		// stop the loop when the window is in the background or no pad is present:
		// avoids waking 60 times a second while idle (needless CPU/battery use)
		if (typeof document !== 'undefined' && document.hidden) {
			stop();
			return;
		}
		const pads = connectedPads();
		if (pads.length === 0) {
			stop();
			return;
		}

		const now = performance.now();
		const activeDirs = new Set<string>();

		for (const pad of pads) {
			for (const d of DPAD) {
				if (pad.buttons[d.index]?.pressed) activeDirs.add(d.key);
			}

			const ax = pad.axes[0] ?? 0;
			const ay = pad.axes[1] ?? 0;
			if (Math.abs(ax) > DEADZONE) activeDirs.add(ax > 0 ? 'ArrowRight' : 'ArrowLeft');
			if (Math.abs(ay) > DEADZONE) activeDirs.add(ay > 0 ? 'ArrowDown' : 'ArrowUp');

			for (const a of ACTIONS) {
				const id = `${pad.index}:${a.index}`;
				const pressed = !!pad.buttons[a.index]?.pressed;
				if (pressed && !pressedActions.has(id)) {
					pressedActions.add(id);
					if (a.action === 'menu') openMenu();
					else if (a.key) dispatchKey(a.key);
				} else if (!pressed) {
					pressedActions.delete(id);
				}
			}
		}

		// arrow keys: fire immediately on first press, delayed repeat while held
		for (const key of DIRECTION_KEYS) {
			if (activeDirs.has(key)) {
				if (!heldDirs.has(key)) {
					heldDirs.add(key);
					nextRepeat.set(key, now + REPEAT_DELAY);
					dispatchKey(key);
				} else if (now >= (nextRepeat.get(key) ?? 0)) {
					nextRepeat.set(key, now + REPEAT_INTERVAL);
					dispatchKey(key);
				}
			} else {
				heldDirs.delete(key);
				nextRepeat.delete(key);
			}
		}

		raf = requestAnimationFrame(loop);
	};

	function start() {
		if (running) return;
		if (typeof document !== 'undefined' && document.hidden) return;
		if (connectedPads().length === 0) return;
		running = true;
		raf = requestAnimationFrame(loop);
	}

	function stop() {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
		running = false;
		resetState();
	}

	const onConnected = () => start();
	const onDisconnected = (e: GamepadEvent) => {
		// forget the disconnected pad's button state (a new pad may appear at the same index)
		for (const id of [...pressedActions]) {
			if (id.startsWith(`${e.gamepad.index}:`)) pressedActions.delete(id);
		}
		if (connectedPads().length === 0) stop();
	};
	const onVisibility = () => {
		if (document.hidden) stop();
		else start();
	};

	window.addEventListener('gamepadconnected', onConnected);
	window.addEventListener('gamepaddisconnected', onDisconnected);
	document.addEventListener('visibilitychange', onVisibility);
	start();

	cleanup = () => {
		window.removeEventListener('gamepadconnected', onConnected);
		window.removeEventListener('gamepaddisconnected', onDisconnected);
		document.removeEventListener('visibilitychange', onVisibility);
		stop();
		cleanup = null;
	};
	return cleanup;
}

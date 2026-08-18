// normalize a KeyboardEvent into a combo array (modifiers + key)
export function eventToCombo(e: KeyboardEvent): string[] {
	const parts: string[] = [];
	if (e.ctrlKey) parts.push('Ctrl');
	if (e.metaKey) parts.push('⌘');
	if (e.altKey) parts.push('Alt');
	if (e.shiftKey) parts.push('Shift');

	let key = e.key;
	// normalize key names to display format
	const keyMap: Record<string, string> = {
		' ': 'Space',
		ArrowUp: '↑',
		ArrowDown: '↓',
		ArrowLeft: '←',
		ArrowRight: '→',
		Escape: 'Esc',
		Enter: '↵',
		Backspace: '⌫',
		Tab: 'Tab',
		Meta: '⌘',
		Control: 'Ctrl',
		Shift: 'Shift',
		Alt: 'Alt'
	};
	key = keyMap[key] ?? key;

	// if the key is a modifier that's already in parts, don't add it again
	const modNames = ['Ctrl', '⌘', 'Alt', 'Shift'];
	if (!modNames.includes(key)) {
		// capitalize single letters
		if (key.length === 1) key = key.toUpperCase();
		parts.push(key);
	}

	return parts;
}

// check if a KeyboardEvent matches a combo
export function matchesCombo(e: KeyboardEvent, combo: string[]): boolean {
	const eventCombo = eventToCombo(e);
	if (eventCombo.length !== combo.length) return false;
	// both are ordered: modifiers first, then key
	return eventCombo.every((k, i) => k === combo[i]);
}

// check if a KeyboardEvent matches any of the combos for a shortcut
export function matchesShortcut(e: KeyboardEvent, combos: string[][]): boolean {
	return combos.some((combo) => matchesCombo(e, combo));
}

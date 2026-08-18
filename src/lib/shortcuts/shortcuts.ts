export interface ShortcutDef {
	id: string;
	keys: string[][];
	scope?: string;
}

export interface ShortcutGroup {
	id: string;
	shortcuts: ShortcutDef[];
}

export const defaultShortcutGroups: ShortcutGroup[] = [
	{
		id: 'playback',
		shortcuts: [
			{ id: 'playPause', keys: [['Space'], ['K']] },
			{ id: 'rewind', keys: [['←']] },
			{ id: 'forward', keys: [['→']] }
		]
	},
	{
		id: 'audio',
		shortcuts: [
			{ id: 'mute', keys: [['M']] },
			{ id: 'volumeUp', keys: [['↑']] },
			{ id: 'volumeDown', keys: [['↓']] }
		]
	},
	{
		id: 'display',
		shortcuts: [
			{ id: 'fullscreen', keys: [['F']] },
			{ id: 'exitFullscreen', keys: [['Esc']] },
			{ id: 'pictureInPicture', keys: [['P']] },
			{ id: 'brightnessUp', keys: [['Shift', '↑']] },
			{ id: 'brightnessDown', keys: [['Shift', '↓']] }
		]
	},
	{
		id: 'navigation',
		shortcuts: [
			{
				id: 'toggleSidebar',
				keys: [
					['⌘', 'B'],
					['Ctrl', 'B']
				]
			},
			{ id: 'previousChannel', keys: [['↑']], scope: 'sidebar' },
			{ id: 'nextChannel', keys: [['↓']], scope: 'sidebar' },
			{ id: 'selectFocusedChannel', keys: [['↵']], scope: 'sidebar' }
		]
	}
];

// flatten defaults into a map for quick lookup
export const defaultShortcuts = new Map<string, string[][]>(
	defaultShortcutGroups.flatMap((g) => g.shortcuts.map((s) => [s.id, s.keys]))
);

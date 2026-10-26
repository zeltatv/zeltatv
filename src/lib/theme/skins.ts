export type SkinId = 'zeltatv' | 'enhanced';

export interface SkinDefinition {
	id: SkinId;
	/** i18n keys (defined in the settings section) */
	labelKey: string;
	hintKey: string;
}

export const SKINS: SkinDefinition[] = [
	{
		id: 'zeltatv',
		labelKey: 'settings.skinZeltatv',
		hintKey: 'settings.skinZeltatvHint'
	},
	{
		id: 'enhanced',
		labelKey: 'settings.skinEnhanced',
		hintKey: 'settings.skinEnhancedHint'
	}
];

export function isEnhancedSkin(id: SkinId): boolean {
	return id === 'enhanced';
}

/**
 * Extra variables for the Enhanced shell.
 * The color palette is now generated from the selected theme (same as the classic look),
 * only the corner radius is specific to Enhanced.
 */
export const ENHANCED_VARS: Record<string, string> = {
	'--radius': '0.375rem'
};

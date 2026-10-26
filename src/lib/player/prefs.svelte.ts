// player preferences - shared by the settings page and the video player
const KEY_HIGHEST = 'zeltatv:highest-quality';

let highestQuality = $state(true);

if (typeof localStorage !== 'undefined') {
	// default: always the highest quality
	highestQuality = localStorage.getItem(KEY_HIGHEST) !== 'false';
}

export function usePlayerPrefs() {
	return {
		get highestQuality() {
			return highestQuality;
		}
	};
}

export function setHighestQuality(value: boolean) {
	highestQuality = value;
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(KEY_HIGHEST, String(value));
	} catch {
		// ignore quota errors
	}
}

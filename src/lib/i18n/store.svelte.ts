import en from '../translations/en.json';
import tr from '../translations/tr.json';
import es from '../translations/es.json';
import fr from '../translations/fr.json';
import de from '../translations/de.json';
import pt from '../translations/pt.json';
import ru from '../translations/ru.json';
import zh from '../translations/zh.json';
import ka from '../translations/ka.json';
import it from '../translations/it.json';
import ja from '../translations/ja.json';
import ko from '../translations/ko.json';
import ar from '../translations/ar.json';
import hi from '../translations/hi.json';
import az from '../translations/az.json';
import uk from '../translations/uk.json';
import pl from '../translations/pl.json';
import nl from '../translations/nl.json';

export type Locale =
	| 'en'
	| 'tr'
	| 'es'
	| 'fr'
	| 'de'
	| 'pt'
	| 'ru'
	| 'zh'
	| 'ka'
	| 'it'
	| 'ja'
	| 'ko'
	| 'ar'
	| 'hi'
	| 'az'
	| 'uk'
	| 'pl'
	| 'nl';

const translations: Record<Locale, Record<string, any>> = {
	en,
	tr,
	es,
	fr,
	de,
	pt,
	ru,
	zh,
	ka,
	it,
	ja,
	ko,
	ar,
	hi,
	az,
	uk,
	pl,
	nl
};

// all available locales with flag emoji for ui
export const availableLocales: { code: Locale; flag: string }[] = [
	{ code: 'en', flag: '🇬🇧' },
	{ code: 'tr', flag: '🇹🇷' },
	{ code: 'es', flag: '🇪🇸' },
	{ code: 'fr', flag: '🇫🇷' },
	{ code: 'de', flag: '🇩🇪' },
	{ code: 'pt', flag: '🇵🇹' },
	{ code: 'ru', flag: '🇷🇺' },
	{ code: 'zh', flag: '🇨🇳' },
	{ code: 'ka', flag: '🇬🇪' },
	{ code: 'it', flag: '🇮🇹' },
	{ code: 'ja', flag: '🇯🇵' },
	{ code: 'ko', flag: '🇰🇷' },
	{ code: 'ar', flag: '🇸🇦' },
	{ code: 'hi', flag: '🇮🇳' },
	{ code: 'az', flag: '🇦🇿' },
	{ code: 'uk', flag: '🇺🇦' },
	{ code: 'pl', flag: '🇵🇱' },
	{ code: 'nl', flag: '🇳🇱' }
];

const STORAGE_KEY = 'zeltatv:locale';

const SUPPORTED: Locale[] = [
	'en',
	'tr',
	'es',
	'fr',
	'de',
	'pt',
	'ru',
	'zh',
	'ka',
	'it',
	'ja',
	'ko',
	'ar',
	'hi',
	'az',
	'uk',
	'pl',
	'nl'
];

// map system locale to our supported locales
function detectLocale(): Locale {
	const raw = (navigator.language || 'en').toLowerCase();
	const lang = raw.split('-')[0] as Locale;
	if (SUPPORTED.includes(lang)) return lang;
	return 'en';
}

let locale = $state<Locale>('en');

if (typeof localStorage !== 'undefined') {
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved && SUPPORTED.includes(saved as Locale)) {
		locale = saved as Locale;
	} else {
		// auto-detect from system language on first run
		locale = detectLocale();
		localStorage.setItem(STORAGE_KEY, locale);
	}
}

export function getLocale(): Locale {
	return locale;
}

export function setLocale(l: Locale) {
	locale = l;
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, l);
	}
}

// reactive translate function - reads locale ($state) so templates update on change
export function t(key: string, params?: Record<string, string>): string {
	const parts = key.split('.');
	let val: any = translations[locale];
	for (const p of parts) {
		val = val?.[p];
		if (val === undefined) break;
	}
	let str = typeof val === 'string' ? val : key;
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			str = str.replace(`{${k}}`, v);
		}
	}
	return str;
}

import type { Channel } from './types';

const EXTINF_RE = /#EXTINF:-?[\d.]*\s*(.*)/i;
const ATTR_RE = /([\w-]+)="([^"]*)"/g;

export function parseM3U(content: string): Channel[] {
	const lines = content.split(/\r?\n/);
	const channels: Channel[] = [];
	let current: Partial<Channel> | null = null;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		if (trimmed.startsWith('#EXTINF')) {
			const match = trimmed.match(EXTINF_RE);
			if (!match) continue;

			const attrs: Record<string, string> = {};
			let attrMatch: RegExpExecArray | null;
			while ((attrMatch = ATTR_RE.exec(match[1])) !== null) {
				attrs[attrMatch[1]] = attrMatch[2];
			}

			// name is the text after the last comma
			const commaIdx = match[1].lastIndexOf(',');
			const name = commaIdx >= 0 ? match[1].slice(commaIdx + 1).trim() : match[1].trim();

			current = {
				name: name || 'Unknown',
				logo: attrs['tvg-logo'] || undefined,
				group: attrs['group-title'] || undefined,
				tvgId: attrs['tvg-id'] || undefined,
				tvgName: attrs['tvg-name'] || undefined
			};
		} else if (!trimmed.startsWith('#') && current) {
			current.url = trimmed;
			current.id = `${channels.length}-${trimmed}`;
			channels.push(current as Channel);
			current = null;
		}
	}

	return channels;
}

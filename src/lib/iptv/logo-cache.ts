// convert a logo url to the logocache:// protocol for disk caching via electron
// data: urls pass through unchanged since they're already inline
export function logoUrl(url?: string): string | undefined {
	if (!url) return undefined;
	if (url.startsWith('data:')) return url;
	return `logocache://localhost/${encodeURIComponent(url)}`;
}

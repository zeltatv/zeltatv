import { initializeLibrary, playSource, useLibrary } from './library.svelte';
import { loadPlaylist, loadPlaylistContent, selectChannel, usePlaylist } from './store.svelte';
import { clearSavedSession, readLastChannel, readSavedSession } from './session-storage';

/**
 * Restore the last session: pick the saved playlist first, then the last
 * watched channel. If there is no record or the source is no longer valid, returns false.
 */
export async function restoreLastSession(): Promise<boolean> {
	const saved = readSavedSession();
	if (!saved) return false;

	// read the last channel *before* loading the playlist: loading selects the
	// first channel, which would overwrite this record with channel 1
	const lastUrl = readLastChannel();

	const playlist = usePlaylist();
	try {
		if (saved.type === 'url') {
			let restoredFromLibrary = false;
			if (saved.sourceId) {
				await initializeLibrary();
				const source = useLibrary().sources.find((item) => item.id === saved.sourceId);
				if (source) {
					await playSource(source);
					restoredFromLibrary = true;
				}
			}
			if (!restoredFromLibrary) await loadPlaylist(saved.value);
		} else {
			await initializeLibrary();
			const source = saved.sourceId
				? useLibrary().sources.find((item) => item.id === saved.sourceId)
				: undefined;
			if (source) await playSource(source);
			else if (saved.content) loadPlaylistContent(saved.content);
			else {
				clearSavedSession();
				return false;
			}
		}

		if (!playlist.hasPlaylist) return false;

		if (lastUrl) {
			const channel = playlist.channels.find((item) => item.url === lastUrl);
			if (channel) selectChannel(channel);
		}
		return true;
	} catch (cause) {
		// If the source is offline we keep the record: it is retried on the next launch.
		console.warn('[ZeltaTV] could not restore the last session:', cause);
		return false;
	}
}

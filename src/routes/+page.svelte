<script lang="ts">
	import { onMount } from 'svelte';
	import { usePlaylist } from '$lib/iptv/store.svelte';
	import { hasSavedSession, isSetupComplete, markSetupComplete } from '$lib/iptv/session-storage';
	import { restoreLastSession } from '$lib/iptv/session';
	import { t } from '$lib/i18n/store.svelte';
	import { focusInitial } from '$lib/tv/nav.svelte';
	import SetupWizard from '../components/setup/SetupWizard.svelte';
	import PlaylistHome from '../components/PlaylistHome.svelte';
	import Sidebar from '../components/Sidebar.svelte';
	import VideoPlayer from '../components/VideoPlayer.svelte';
	import ChannelMenuOverlay from '../components/ChannelMenuOverlay.svelte';

	const playlist = usePlaylist();
	// restore the playlist on startup if setup was completed before
	let restoring = $state(hasSavedSession());
	// once setup has been completed it is never shown again (even with an empty library)
	let setupDone = $state(isSetupComplete() || hasSavedSession());
	// The main process ends the app when the window closes unless setup finished
	// at least once (persisted flag, see electron/main.mjs) or a playlist is
	// loaded in this session. A window closed during the wizard therefore quits,
	// while a completed setup keeps the normal behaviour.
	let setupReady = isSetupComplete() || hasSavedSession();

	$effect(() => {
		if (playlist.hasPlaylist) setupReady = true;
		const api = (
			globalThis as unknown as { electronAPI?: { setSetupState?: (done: boolean) => void } }
		).electronAPI;
		api?.setSetupState?.(setupReady);
	});

	// when a playlist arrives from the landing screen the channel list replaces it:
	// put the remote focus on the first channel so OK zaps without an extra press
	$effect(() => {
		if (!playlist.hasPlaylist) return;
		const timer = setTimeout(() => {
			if (!document.activeElement || document.activeElement === document.body) focusInitial();
		}, 120);
		return () => clearTimeout(timer);
	});

	onMount(() => {
		if (!restoring) return;
		void (async () => {
			const restored = await restoreLastSession();
			restoring = false;
			if (restored) setupDone = true;
		})();
	});

	function finishSetup() {
		markSetupComplete();
		setupDone = true;
		// The wizard unmounts right after this and the browser drops the focus on
		// <body>, so the remote would need an extra arrow press before OK works:
		// put the ring on the first channel (or the URL field when setup was
		// skipped without a playlist) once the new screen is in the DOM.
		setTimeout(() => {
			if (!document.activeElement || document.activeElement === document.body) focusInitial();
		}, 0);
	}
</script>

{#if restoring}
	<div class="flex flex-1 items-center justify-center overflow-hidden bg-background p-8">
		<div class="flex flex-col items-center gap-5 text-center">
			<div class="relative grid size-16 place-items-center">
				<div
					class="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
				></div>
				<img src="/assets/logo.png" alt="" class="h-7 w-7 opacity-80" />
			</div>
			<p class="text-sm text-muted-foreground">{t('setup.restoring')}</p>
		</div>
	</div>
{:else if !setupDone}
	<SetupWizard onenter={finishSetup} onskip={finishSetup} />
{:else if playlist.hasPlaylist}
	<div class="flex min-h-0 flex-1 overflow-hidden">
		<div
			data-app-sidebar
			class="shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out {playlist.sidebarOpen
				? 'w-64'
				: 'w-0'}"
		>
			<Sidebar />
		</div>
		<VideoPlayer />
	</div>
	<ChannelMenuOverlay />
{:else}
	<PlaylistHome />
{/if}

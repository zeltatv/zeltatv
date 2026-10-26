<script lang="ts">
	import { onMount } from 'svelte';
	import { usePlaylist } from '$lib/iptv/store.svelte';
	import { hasSavedSession, isSetupComplete, markSetupComplete } from '$lib/iptv/session-storage';
	import { restoreLastSession } from '$lib/iptv/session';
	import { t } from '$lib/i18n/store.svelte';
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

<script lang="ts">
	import { usePlaylist } from '$lib/iptv/store.svelte';
	import SetupUrl from '../components/SetupUrl.svelte';
	import Sidebar from '../components/Sidebar.svelte';
	import VideoPlayer from '../components/VideoPlayer.svelte';

	const playlist = usePlaylist();
</script>

{#if playlist.hasPlaylist}
	<div class="flex min-h-0 flex-1 overflow-hidden">
		<div
			class="shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out {playlist.sidebarOpen
				? 'w-64'
				: 'w-0'}"
		>
			<Sidebar />
		</div>
		<VideoPlayer />
	</div>
{:else}
	<SetupUrl />
{/if}

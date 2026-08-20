<script lang="ts">
	import './layout.css';
	import { applyTheme, getThemeBg } from '$lib/theme/store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { clearPlaylist, usePlaylist, toggleSidebar } from '$lib/iptv/store.svelte';
	import { getShortcutKeys } from '$lib/shortcuts/store.svelte';
	import { matchesShortcut } from '$lib/shortcuts/matcher';
	import { t } from '$lib/i18n/store.svelte';
	import ShortcutsDialog from '../components/ShortcutsDialog.svelte';
	import { goto } from '$app/navigation';

	let { children } = $props();
	const playlist = usePlaylist();
	let showShortcuts = $state(false);

	// apply theme on mount - store also applies on import but this ensures it
	applyTheme(getThemeBg());

	// platform detection for navbar layout
	const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);
	const isWin = typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent);
	const isLinux = !isMac && !isWin;

	// drag region: mac + win use custom title bar, linux uses native
	const dragStyle = isLinux ? '' : '-webkit-app-region: drag';
	const noDragStyle = isLinux ? '' : '-webkit-app-region: no-drag';

	// mac: room for traffic lights on left; win: room for overlay controls on right
	const leftPad = isMac ? 'ml-20' : 'ml-2';
	const rightPad = isWin ? 'pr-[140px]' : 'pr-2';

	function onKeydown(e: KeyboardEvent) {
		if (!document.hasFocus()) return;
		if (matchesShortcut(e, getShortcutKeys('toggleSidebar'))) {
			e.preventDefault();
			if (playlist.hasPlaylist) toggleSidebar();
		}
	}

	function goHome() {
		clearPlaylist();
		goto('/');
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div
	class="flex h-9 shrink-0 items-center justify-between bg-background pt-px select-none"
	style={dragStyle}
>
	<div class="{leftPad} flex items-center gap-1" style={noDragStyle}>
		<Button variant="ghost" size="icon" onclick={goHome} aria-label="home" title="Home">
			<i class="ri-home-5-line text-base"></i>
		</Button>
		{#if playlist.hasPlaylist}
			<Button
				variant="ghost"
				size="icon"
				onclick={toggleSidebar}
				aria-label={t('navbar.toggleSidebar')}
			>
				<i class="ri-{playlist.sidebarOpen ? 'sidebar-fold' : 'sidebar-unfold'}-line text-base"></i>
			</Button>
		{/if}
		<span class="pl-1 text-sm font-semibold tracking-tight">ZeltaTV</span>
	</div>
	<div class="flex items-center {rightPad}" style={noDragStyle}>
		<Button
			variant="ghost"
			size="icon"
			onclick={() => (showShortcuts = true)}
			aria-label={t('navbar.shortcuts')}
		>
			<i class="ri-information-line text-base"></i>
		</Button>
		<Button
			variant="ghost"
			size="icon"
			onclick={() => goto('/settings')}
			aria-label={t('navbar.settings')}
		>
			<i class="ri-settings-3-line text-base"></i>
		</Button>
		<Button
			variant="ghost"
			size="icon"
			href="https://github.com/zeltatv/zeltatv"
			target="_blank"
			rel="noreferrer"
		>
			<i class="ri-github-fill text-base"></i>
		</Button>
	</div>
</div>

<ShortcutsDialog bind:open={showShortcuts} />

<div class="flex flex-1 flex-col overflow-hidden">
	{@render children()}
</div>

<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { applyTheme, getThemeBg, getSkin } from '$lib/theme/store.svelte';
	import { isEnhancedSkin } from '$lib/theme/skins';
	import { Button } from '$lib/components/ui/button';
	import { clearPlaylist, usePlaylist, toggleSidebar } from '$lib/iptv/store.svelte';
	import { getShortcutKeys } from '$lib/shortcuts/store.svelte';
	import { matchesShortcut } from '$lib/shortcuts/matcher';
	import { t } from '$lib/i18n/store.svelte';
	import { initTvNav, focusInitial } from '$lib/tv/nav.svelte';
	import { initGamepad } from '$lib/tv/gamepad';
	import ShortcutsDialog from '../components/ShortcutsDialog.svelte';
	import MainMenu from '../components/MainMenu.svelte';
	import SourcesDialog from '../components/SourcesDialog.svelte';
	import ChannelNumberOsd from '../components/ChannelNumberOsd.svelte';
	import { Dialog, DialogContent, DialogDescription, DialogTitle } from '$lib/components/ui/dialog';
	import { openSourcesDialog } from '$lib/ui/sources-dialog.svelte';
	import { goto, afterNavigate } from '$app/navigation';

	let { children } = $props();
	const playlist = usePlaylist();
	let showShortcuts = $state(false);
	let showMenu = $state(false);
	let showQuit = $state(false);
	const enhanced = $derived(isEnhancedSkin(getSkin()));
	let cursorTimer: ReturnType<typeof setTimeout> | null = null;
	let osFullscreen = $state(false);

	// Leave OS-level fullscreen so the window becomes a normal resizable window.
	function enterWindowedMode() {
		const api = (globalThis as unknown as { electronAPI?: { setWindowed?: () => void } })
			.electronAPI;
		api?.setWindowed?.();
	}

	// Go back to OS-level fullscreen from the windowed mode (the button in the
	// same corner turns into this one when the window is not fullscreen).
	function enterFullscreenMode() {
		const api = (globalThis as unknown as { electronAPI?: { setFullScreen?: () => void } })
			.electronAPI;
		api?.setFullScreen?.();
	}

	// Hide the cursor app-wide when the mouse/keyboard is idle.
	function wakeCursor() {
		if (typeof document === 'undefined') return;
		document.body.removeAttribute('data-cursor-idle');
		if (cursorTimer) clearTimeout(cursorTimer);
		cursorTimer = setTimeout(() => {
			if (document.hasFocus()) document.body.setAttribute('data-cursor-idle', '');
		}, 2500);
	}

	// initialise TV remote (d-pad) navigation and gamepad support
	onMount(() => {
		initTvNav();
		const stopGamepad = initGamepad();
		const api = (
			globalThis as unknown as {
				electronAPI?: {
					onFullscreenChange?: (cb: (value: boolean) => void) => () => void;
					isFullScreen?: () => Promise<boolean>;
				};
			}
		).electronAPI;
		const stopFullscreen = api?.onFullscreenChange?.((value) => (osFullscreen = value));
		void api?.isFullScreen?.().then((value) => (osFullscreen = value));
		// on startup, focus the first meaningful element if nothing is focused
		const timer = setTimeout(() => {
			if (!document.activeElement || document.activeElement === document.body) focusInitial();
		}, 400);
		wakeCursor();
		const wakeEvents: Array<[string, EventListener]> = [
			['pointermove', wakeCursor],
			['pointerdown', wakeCursor],
			['wheel', wakeCursor],
			['keydown', wakeCursor]
		];
		for (const [name, handler] of wakeEvents) {
			window.addEventListener(name, handler, { passive: true, capture: true });
		}
		return () => {
			clearTimeout(timer);
			stopGamepad?.();
			stopFullscreen?.();
			if (cursorTimer) clearTimeout(cursorTimer);
			for (const [name, handler] of wakeEvents) {
				window.removeEventListener(name, handler, true);
			}
			document.body.removeAttribute('data-cursor-idle');
		};
	});

	// keep focus from going idle on navigation too (remote back actions)
	afterNavigate(() => {
		setTimeout(() => {
			if (!document.activeElement || document.activeElement === document.body) focusInitial();
		}, 80);
	});

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
	// (both collapse away when the OS window is fullscreen)
	const leftPad = $derived(osFullscreen ? 'ml-2' : isMac ? 'ml-20' : 'ml-2');
	const rightPad = $derived(osFullscreen ? 'pr-2' : isWin ? 'pr-[140px]' : 'pr-2');

	function onKeydown(e: KeyboardEvent) {
		if (document.visibilityState !== 'visible') return;
		if (matchesShortcut(e, getShortcutKeys('toggleSidebar'))) {
			e.preventDefault();
			// The channel list is hidden in fullscreen; it should not open until we exit.
			if (!document.fullscreenElement && playlist.hasPlaylist) toggleSidebar();
		}
	}

	function goHome() {
		clearPlaylist();
		// leave fullscreen so the landing screen is visible inside the window
		if (typeof document !== 'undefined' && document.fullscreenElement) {
			void document.exitFullscreen().catch(() => undefined);
		}
		goto('/');
	}

	function quitApp() {
		const api = (globalThis as unknown as { electronAPI?: { quit?: () => void } }).electronAPI;
		if (api?.quit) {
			api.quit();
			return;
		}
		window.close();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div
	data-app-header
	class="flex h-9 shrink-0 items-center justify-between bg-background pt-px select-none"
	style={dragStyle}
>
	<div class="{leftPad} flex items-center gap-1" style={noDragStyle}>
		<Button variant="ghost" size="icon" onclick={goHome} aria-label="home" title="Home">
			<i class="ri-home-5-line text-base"></i>
		</Button>
		<Button
			variant="ghost"
			size="icon"
			data-tv-menu-toggle
			onclick={() => (showMenu = true)}
			aria-label={t('menu.open')}
			title={t('menu.open')}
		>
			<i class="ri-settings-3-line text-base"></i>
		</Button>
		<Button
			variant="ghost"
			size="icon"
			data-tv-quit
			onclick={() => (showQuit = true)}
			aria-label={t('navbar.quit')}
			title={t('navbar.quit')}
		>
			<i class="ri-shut-down-line text-base"></i>
		</Button>
		{#if playlist.hasPlaylist}
			<Button
				variant="ghost"
				size="icon"
				onclick={toggleSidebar}
				aria-label={t('navbar.toggleSidebar')}
				title={t('navbar.toggleSidebar')}
				data-sidebar-toggle
			>
				<i class="ri-{playlist.sidebarOpen ? 'sidebar-fold' : 'sidebar-unfold'}-line text-base"></i>
			</Button>
		{/if}
		<span class="pl-1 text-sm font-semibold tracking-tight">ZeltaTV</span>
		{#if enhanced}
			<span
				class="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.18em] text-primary uppercase"
			>
				Enhanced
			</span>
		{/if}
	</div>
	<div class="flex items-center {rightPad}" style={noDragStyle}>
		{#if osFullscreen}
			<Button
				variant="ghost"
				size="icon"
				onclick={enterWindowedMode}
				aria-label={t('navbar.windowed')}
				title={t('navbar.windowed')}
				data-windowed-toggle
			>
				<i class="ri-fullscreen-exit-line text-base"></i>
			</Button>
		{:else}
			<Button
				variant="ghost"
				size="icon"
				onclick={enterFullscreenMode}
				aria-label={t('navbar.fullscreen')}
				title={t('navbar.fullscreen')}
				data-fullscreen-toggle
			>
				<i class="ri-fullscreen-line text-base"></i>
			</Button>
		{/if}
		<Button
			variant="ghost"
			size="icon"
			onclick={() => (showShortcuts = true)}
			aria-label={t('navbar.shortcuts')}
		>
			<i class="ri-information-line text-base"></i>
		</Button>
		{#if playlist.hasPlaylist}
			<Button
				variant="ghost"
				size="icon"
				href="https://github.com/zeltatv/zeltatv"
				target="_blank"
				rel="noreferrer"
			>
				<i class="ri-github-fill text-base"></i>
			</Button>
		{/if}
	</div>
</div>

<ShortcutsDialog bind:open={showShortcuts} />

<MainMenu
	bind:open={showMenu}
	onshortcuts={() => (showShortcuts = true)}
	onsources={openSourcesDialog}
/>

<SourcesDialog />

<Dialog bind:open={showQuit}>
	<DialogContent class="max-w-sm gap-4">
		<DialogTitle class="text-base font-semibold">{t('quitDialog.title')}</DialogTitle>
		<DialogDescription class="text-sm text-muted-foreground">
			{t('quitDialog.body')}
		</DialogDescription>
		<div class="flex justify-end gap-2">
			<Button variant="outline" onclick={() => (showQuit = false)}>
				{t('quitDialog.cancel')}
			</Button>
			<Button data-tv-quit-confirm onclick={quitApp}>
				<i class="ri-close-line"></i>
				{t('quitDialog.confirm')}
			</Button>
		</div>
	</DialogContent>
</Dialog>

<ChannelNumberOsd />

<div class="flex flex-1 flex-col overflow-hidden">
	{@render children()}
</div>

<script lang="ts">
	import { Dialog, DialogContent, DialogDescription, DialogTitle } from '$lib/components/ui/dialog';
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n/store.svelte';
	import { usePlaylist, toggleSidebar } from '$lib/iptv/store.svelte';
	import { getSkin } from '$lib/theme/store.svelte';
	import { isEnhancedSkin } from '$lib/theme/skins';

	let {
		open = $bindable(false),
		onshortcuts,
		onsources
	}: { open: boolean; onshortcuts?: () => void; onsources?: () => void } = $props();

	const playlist = usePlaylist();
	const enhanced = $derived(isEnhancedSkin(getSkin()));
	const channelCount = $derived(playlist.channels.length);

	let now = $state(new Date());

	// only update the clock while the menu is open: no needless timer
	// wake-ups while it is closed
	$effect(() => {
		if (!open) return;
		now = new Date();
		const id = setInterval(() => (now = new Date()), 20000);
		return () => clearInterval(id);
	});

	const clock = $derived(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
	const date = $derived(
		now.toLocaleDateString([], { day: '2-digit', month: 'long', weekday: 'long' })
	);

	function close() {
		open = false;
	}

	function openSources() {
		close();
		onsources?.();
	}

	function openChannels() {
		close();
		goto('/');
		// open the channel list if it is closed (after the player has settled)
		setTimeout(() => {
			if (!playlist.sidebarOpen) toggleSidebar();
		}, 150);
	}

	function goSettings(tab?: string) {
		close();
		goto(tab ? `/settings#${tab}` : '/settings');
	}

	function openShortcuts() {
		close();
		onshortcuts?.();
	}

	const tiles = $derived([
		{
			id: 'sources',
			icon: 'ri-play-list-2-line',
			label: t('menu.sources'),
			hint: t('menu.sourcesHint'),
			run: openSources
		},
		{
			id: 'channels',
			icon: 'ri-list-check-2',
			label: t('menu.channels'),
			hint: t('menu.channelsHint', { count: String(channelCount) }),
			run: openChannels
		},
		{
			id: 'settings',
			icon: 'ri-settings-3-line',
			label: t('menu.settings'),
			hint: t('menu.settingsHint'),
			run: () => goSettings()
		},
		{
			id: 'shortcuts',
			icon: 'ri-keyboard-line',
			label: t('menu.shortcuts'),
			hint: t('menu.shortcutsHint'),
			run: openShortcuts
		},
		{
			id: 'skin',
			icon: 'ri-palette-line',
			label: t('menu.skin'),
			hint: t('menu.skinHint'),
			run: () => goSettings('theme')
		},
		{
			id: 'close',
			icon: 'ri-close-circle-line',
			label: t('menu.close'),
			hint: t('menu.closeHint'),
			run: close
		}
	]);

	// on menu open, move remote focus to the first tile
	$effect(() => {
		if (!open || typeof document === 'undefined') return;
		const id = setTimeout(() => {
			document.querySelector<HTMLElement>('[data-menu-tile]')?.focus();
		}, 80);
		return () => clearTimeout(id);
	});
</script>

<Dialog bind:open>
	<DialogContent
		showCloseButton={false}
		class="max-w-3xl gap-0 overflow-hidden rounded-lg border border-border/70 bg-background/95 p-0 shadow-2xl ring-1 ring-primary/10 backdrop-blur-md sm:max-w-3xl"
	>
		<DialogTitle class="sr-only">{t('menu.title')}</DialogTitle>
		<DialogDescription class="sr-only">{date}</DialogDescription>

		<header
			class="flex items-center justify-between gap-4 border-b border-border/70 bg-card/40 px-5 py-3"
		>
			<div class="flex items-center gap-2">
				<span class="text-base font-semibold tracking-tight">ZeltaTV</span>
				{#if enhanced}
					<span
						class="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-primary uppercase"
					>
						Enhanced
					</span>
				{/if}
			</div>
			<div class="flex flex-col items-end leading-tight">
				<span class="text-sm font-semibold tabular-nums">{clock}</span>
				<span class="text-[11px] text-muted-foreground">{date}</span>
			</div>
		</header>

		<div class="grid grid-cols-3 gap-3 p-4">
			{#each tiles as tile (tile.id)}
				<button
					type="button"
					data-menu-tile
					onclick={tile.run}
					class="group flex h-24 flex-col items-start justify-between rounded-md border border-border/60 bg-card/50 p-3 text-left transition-colors hover:border-primary/60 hover:bg-card"
				>
					<i class="{tile.icon} text-2xl text-primary"></i>
					<span class="flex min-w-0 flex-col">
						<span class="truncate text-sm font-semibold">{tile.label}</span>
						<span class="truncate text-[11px] text-muted-foreground">{tile.hint}</span>
					</span>
				</button>
			{/each}
		</div>

		<footer
			class="flex items-center justify-between gap-3 border-t border-border/70 px-5 py-2 text-[11px] text-muted-foreground"
		>
			<span><span class="font-semibold text-foreground">OK</span> · {t('menu.hintSelect')}</span>
			<span><span class="font-semibold text-foreground">↑↓←→</span> · {t('menu.hintNavigate')}</span
			>
			<span><span class="font-semibold text-foreground">Esc</span> · {t('menu.hintBack')}</span>
		</footer>
	</DialogContent>
</Dialog>

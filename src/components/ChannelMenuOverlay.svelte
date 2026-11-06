<script lang="ts">
	// centered channel menu opened with OK while watching (classic satellite-receiver style)
	// navigate with the arrow keys, OK switches the channel, back closes it
	import { untrack } from 'svelte';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { usePlaylist, selectChannel } from '$lib/iptv/store.svelte';
	import { useChannelMenu } from '$lib/tv/channel-menu.svelte';
	import { t } from '$lib/i18n/store.svelte';
	import type { Channel } from '$lib/iptv/types';
	import VirtualList from './VirtualList.svelte';
	import ChannelLogo from './ChannelLogo.svelte';

	const playlist = usePlaylist();
	const menu = useChannelMenu();

	// Don't leave the centered menu open after leaving fullscreen; this menu is
	// only available during fullscreen playback.
	$effect(() => {
		const onChange = () => {
			if (!document.fullscreenElement) menu.open = false;
		};
		document.addEventListener('fullscreenchange', onChange);
		return () => document.removeEventListener('fullscreenchange', onChange);
	});

	let contentEl = $state<HTMLDivElement | null>(null);
	let search = $state('');
	let scrollTarget = $state(-1);

	// channel numbers = position in the playlist (Channel 1, Channel 2...)
	let numbers = $derived.by(() => {
		const map = new Map<string, number>();
		playlist.channels.forEach((channel, index) => map.set(channel.id, index + 1));
		return map;
	});

	let items = $derived.by(() => {
		const query = search.trim().toLowerCase();
		if (!query) return playlist.channels;
		return playlist.channels.filter((channel) => channel.name.toLowerCase().includes(query));
	});

	function currentFilteredIndex(): number {
		const id = playlist.currentChannel?.id;
		if (!id) return 0;
		const index = items.findIndex((channel) => channel.id === id);
		return index >= 0 ? index : 0;
	}

	function focusItem(index: number) {
		const el = contentEl?.querySelector<HTMLElement>(`[data-tv-index="${index}"]`);
		if (el) {
			el.focus();
			el.scrollIntoView({ block: 'center' });
			return;
		}
		// if the virtual list hasn't rendered the item yet, retry after a short delay
		setTimeout(() => {
			const later = contentEl?.querySelector<HTMLElement>(`[data-tv-index="${index}"]`);
			later?.focus();
			later?.scrollIntoView({ block: 'center' });
		}, 60);
	}

	// on menu open, reset the search and focus the playing channel
	// NOTE: must only run on the open transition; depending on items/search
	// would reset the typed search immediately.
	let menuWasOpen = false;
	let focusTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		if (!menu.open) {
			menuWasOpen = false;
			return;
		}
		if (menuWasOpen) return;
		menuWasOpen = true;
		untrack(() => {
			search = '';
			scrollTarget = currentFilteredIndex();
		});
		focusTimer = setTimeout(() => focusItem(scrollTarget), 90);
		return () => {
			if (focusTimer) {
				clearTimeout(focusTimer);
				focusTimer = null;
			}
		};
	});

	// when the menu closes, return focus to the video surface (keep watching with the remote)
	let wasOpen = false;
	$effect(() => {
		if (menu.open) {
			wasOpen = true;
			return;
		}
		if (!wasOpen) return;
		wasOpen = false;
		setTimeout(() => {
			const surface = document.querySelector<HTMLElement>('[data-tv-player-surface]');
			surface?.focus();
		}, 60);
	});

	function choose(channel: Channel) {
		selectChannel(channel);
		menu.open = false;
	}
</script>

<Dialog bind:open={() => menu.open, (value) => (menu.open = value)}>
	<DialogContent
		bind:ref={contentEl}
		class="flex h-[80vh] w-[min(92vw,46rem)] max-w-[calc(100vw-2rem)] flex-col gap-3 sm:max-w-[46rem]"
		portalProps={{ to: menu.target ?? undefined }}
	>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2 pr-8">
				<i class="ri-list-check-2 text-base"></i>
				{t('sidebar.channels')}
				<span class="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
					{items.length}/{playlist.channels.length}
				</span>
			</DialogTitle>
		</DialogHeader>

		<Input
			bind:value={search}
			type="search"
			placeholder={t('sidebar.searchPlaceholder')}
			aria-label={t('sidebar.searchAriaLabel')}
			onkeydown={(e: KeyboardEvent) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					focusItem(0);
				}
			}}
		/>

		<div class="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
			{#if items.length === 0}
				<div class="flex h-40 items-center justify-center text-sm text-muted-foreground">
					{t('sidebar.noChannelsFound')}
				</div>
			{:else}
				<VirtualList {items} itemHeight={44} scrollToIndex={scrollTarget}>
					{#snippet renderItem(channel: Channel, index: number)}
						{@const active = playlist.currentChannel?.id === channel.id}
						{@const number = numbers.get(channel.id) ?? 0}
						<button
							data-tv-menu-item
							data-tv-index={index}
							onclick={() => choose(channel)}
							class="flex h-full w-full items-center gap-3 px-3 text-left text-sm transition-colors focus:bg-muted/70 focus:text-foreground {active
								? 'bg-accent text-foreground'
								: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
						>
							<span class="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums"
								>{number}</span
							>
							<ChannelLogo name={channel.name} logo={channel.logo} size="size-6" />
							<span class="truncate font-medium">{channel.name}</span>
							{#if active}
								<i class="ri-volume-up-line ml-auto text-sm text-foreground"></i>
							{/if}
						</button>
					{/snippet}
				</VirtualList>
			{/if}
		</div>
	</DialogContent>
</Dialog>

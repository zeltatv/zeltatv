<script lang="ts">
	import { usePlaylist, selectChannel, toggleFavorite } from '$lib/iptv/store.svelte';
	import { logoUrl } from '$lib/iptv/logo-cache';
	import { InputGroup, InputGroupInput, InputGroupAddon } from '$lib/components/ui/input-group';
	import { Toggle } from '$lib/components/ui/toggle';
	import type { Channel } from '$lib/iptv/types';
	import { t } from '$lib/i18n/store.svelte';
	import { getShortcutKeys } from '$lib/shortcuts/store.svelte';
	import { matchesShortcut } from '$lib/shortcuts/matcher';
	import VirtualList from './VirtualList.svelte';

	const playlist = usePlaylist();
	let search = $state('');
	let showFavorites = $state(false);
	let brokenLogos = $state(new Set<string>());
	let focusedIndex = $state(-1);

	type FlatItem =
		| { type: 'header'; label: string; key: string }
		| { type: 'channel'; channel: Channel; key: string };

	// pre-compute lowercase names once when channels load - avoids toLowerCase on every filter
	let channelIndex = $derived.by(() => {
		const map = new Map<string, string>();
		for (const ch of playlist.channels) {
			map.set(ch.id, ch.name.toLowerCase());
		}
		return map;
	});

	// read search synchronously so $effect tracks it as dependency
	let query = $derived(search.trim().toLowerCase());
	// favorites Set read synchronously so filter re-runs when favorites change
	let favIds = $derived(playlist.favoriteIds);

	let flatItems = $derived.by((): FlatItem[] => {
		const q = query;
		const fav = showFavorites ? favIds : null;
		const groups = new Map<string, Channel[]>();

		for (const ch of playlist.channels) {
			if (fav && !fav.has(ch.id)) continue;
			if (q) {
				const lowerName = channelIndex.get(ch.id);
				if (!lowerName || !lowerName.includes(q)) continue;
			}
			const key = ch.group || '__ungrouped__';
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(ch);
		}

		const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
		const flat: FlatItem[] = [];
		for (const [group, channels] of sorted) {
			const label = group === '__ungrouped__' ? t('sidebar.ungrouped') : group;
			flat.push({ type: 'header', label, key: `h-${group}` });
			for (const ch of channels) {
				flat.push({ type: 'channel', channel: ch, key: ch.id });
			}
		}
		return flat;
	});

	// indices of channel items only (skip headers) for keyboard nav
	let channelIndices = $derived(
		flatItems.map((item, i) => (item.type === 'channel' ? i : -1)).filter((i) => i >= 0)
	);

	let totalFiltered = $derived(channelIndices.length);

	// reset focus when filter changes
	$effect(() => {
		flatItems;
		focusedIndex = -1;
	});

	function onLogoError(url: string) {
		brokenLogos = new Set([...brokenLogos, url]);
	}

	function onFavoriteClick(e: MouseEvent, ch: Channel) {
		e.stopPropagation();
		toggleFavorite(ch.id);
	}

	// keyboard navigation within sidebar - stopPropagation so player doesn't also handle
	function onKeydown(e: KeyboardEvent) {
		if (channelIndices.length === 0) return;

		if (matchesShortcut(e, getShortcutKeys('nextChannel'))) {
			e.preventDefault();
			e.stopPropagation();
			moveFocus(1);
		} else if (matchesShortcut(e, getShortcutKeys('previousChannel'))) {
			e.preventDefault();
			e.stopPropagation();
			moveFocus(-1);
		} else if (matchesShortcut(e, getShortcutKeys('selectFocusedChannel'))) {
			if (focusedIndex < 0) return;
			const item = flatItems[focusedIndex];
			if (item && item.type === 'channel') {
				e.preventDefault();
				e.stopPropagation();
				selectChannel(item.channel);
			}
		}
	}

	function moveFocus(direction: 1 | -1) {
		if (focusedIndex < 0) {
			focusedIndex = channelIndices[direction === 1 ? 0 : channelIndices.length - 1];
			return;
		}
		const pos = channelIndices.indexOf(focusedIndex);
		if (pos < 0) {
			focusedIndex = channelIndices[0];
			return;
		}
		const next = pos + direction;
		if (next >= 0 && next < channelIndices.length) {
			focusedIndex = channelIndices[next];
		}
	}
</script>

<div
	role="listbox"
	class="flex h-full w-64 flex-col border-r border-border bg-card"
	onkeydown={onKeydown}
	tabindex="-1"
>
	<div class="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
		<span class="truncate text-xs font-semibold tracking-wide">{t('sidebar.channels')}</span>
		<span class="ml-auto text-xs text-muted-foreground tabular-nums"
			>{totalFiltered}{#if query || showFavorites}/{playlist.channels.length}{/if}</span
		>
	</div>

	<div class="flex shrink-0 items-center gap-1.5 border-b border-border p-1.5">
		<div class="min-w-0 flex-1">
			<InputGroup>
				<InputGroupAddon align="inline-start">
					<i class="ri-search-line"></i>
				</InputGroupAddon>
				<InputGroupInput
					bind:value={search}
					type="search"
					placeholder={t('sidebar.searchPlaceholder')}
					aria-label={t('sidebar.searchAriaLabel')}
				/>
			</InputGroup>
		</div>
		<Toggle
			bind:pressed={showFavorites}
			variant="outline"
			aria-label={t('sidebar.favoritesAriaLabel')}
		>
			<i class="ri-heart-{showFavorites ? 'fill' : 'line'} {showFavorites ? 'text-rose-500' : ''}"
			></i>
			{#if playlist.favoritesCount > 0}
				<span class="text-xs tabular-nums">{playlist.favoritesCount}</span>
			{/if}
		</Toggle>
	</div>

	{#if flatItems.length === 0}
		<div
			class="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground"
		>
			{#if showFavorites && !query}
				{t('sidebar.noFavorites')}
			{:else if query}
				{t('sidebar.noChannelsFound')}
			{:else}
				{t('sidebar.noChannels')}
			{/if}
		</div>
	{:else}
		<VirtualList items={flatItems} itemHeight={40} buffer={10} scrollToIndex={focusedIndex}>
			{#snippet renderItem(item, index)}
				{#if item.type === 'header'}
					<p
						class="flex h-full items-center px-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
					>
						{item.label}
					</p>
				{:else}
					{@const ch = item.channel}
					{@const active = playlist.currentChannel?.id === ch.id}
					{@const focused = index === focusedIndex}
					{@const logoBroken = ch.logo ? brokenLogos.has(ch.logo) : true}
					{@const fav = favIds.has(ch.id)}
					<div class="group flex h-full items-center px-1">
						<button
							onclick={() => selectChannel(ch)}
							onpointerenter={() => (focusedIndex = index)}
							class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-sm transition-colors {active
								? 'bg-accent text-foreground'
								: focused
									? 'bg-muted/70 text-foreground'
									: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
						>
							{#if ch.logo && !logoBroken}
								<img
									src={logoUrl(ch.logo)}
									alt=""
									class="size-6 shrink-0 rounded-sm object-cover"
									onerror={() => onLogoError(ch.logo!)}
								/>
							{:else}
								<div class="flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted">
									<i class="ri-tv-line text-xs text-muted-foreground"></i>
								</div>
							{/if}
							<span class="truncate font-medium">{ch.name}</span>
						</button>
						<button
							onclick={(e) => onFavoriteClick(e, ch)}
							class="shrink-0 rounded p-1 transition-opacity {fav
								? 'opacity-100'
								: 'opacity-0 group-hover:opacity-100'}"
							aria-label={fav ? t('sidebar.removeFavorite') : t('sidebar.addFavorite')}
						>
							<i class="ri-heart-fill text-sm text-rose-500 {fav ? '' : 'hidden'}"></i>
							<i class="ri-heart-line text-sm text-muted-foreground {fav ? 'hidden' : ''}"></i>
						</button>
					</div>
				{/if}
			{/snippet}
		</VirtualList>
	{/if}
</div>

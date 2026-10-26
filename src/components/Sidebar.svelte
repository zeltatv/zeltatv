<script lang="ts">
	import { usePlaylist, selectChannel, toggleFavorite } from '$lib/iptv/store.svelte';
	import { InputGroup, InputGroupInput, InputGroupAddon } from '$lib/components/ui/input-group';
	import { Toggle } from '$lib/components/ui/toggle';
	import { Button } from '$lib/components/ui/button';
	import type { Channel } from '$lib/iptv/types';
	import { t } from '$lib/i18n/store.svelte';
	import { getShortcutKeys } from '$lib/shortcuts/store.svelte';
	import { matchesShortcut } from '$lib/shortcuts/matcher';
	import { focusInitial } from '$lib/tv/nav.svelte';
	import { getSkin } from '$lib/theme/store.svelte';
	import { isEnhancedSkin } from '$lib/theme/skins';
	import { openSourcesDialog } from '$lib/ui/sources-dialog.svelte';
	import VirtualList from './VirtualList.svelte';
	import ChannelLogo from './ChannelLogo.svelte';

	const playlist = usePlaylist();
	const enhanced = $derived(isEnhancedSkin(getSkin()));
	const channelNumbers = $derived(new Map(playlist.channels.map((c, i) => [c.id, i + 1])));
	let search = $state('');
	let filter = $state<'all' | 'favorites' | 'recent'>('all');
	type ViewMode = 'groups' | 'default' | 'alpha';
	const VIEW_KEY = 'zeltatv:view-mode:v2';
	// default: the playlist's own order (not grouped or alphabetical)
	let viewMode = $state<ViewMode>('default');
	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem(VIEW_KEY);
		if (saved === 'default' || saved === 'alpha' || saved === 'groups') viewMode = saved;
	}
	let focusedIndex = $state(-1);
	let containerEl = $state<HTMLDivElement | null>(null);
	let fullscreen = $state(false);

	$effect(() => {
		const onChange = () => (fullscreen = !!document.fullscreenElement);
		document.addEventListener('fullscreenchange', onChange);
		onChange();
		return () => document.removeEventListener('fullscreenchange', onChange);
	});

	async function toggleFullscreen() {
		// Only back keys leave fullscreen; the button only enters.
		if (document.fullscreenElement) return;
		try {
			await document.documentElement.requestFullscreen();
		} catch {
			// fail silently if the browser/environment denied fullscreen
		}
	}

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

	// debounce the search input by 120 ms so 20k channels are not filtered on every keystroke
	let deferredSearch = $state('');
	$effect(() => {
		const value = search;
		const timer = setTimeout(() => (deferredSearch = value), 120);
		return () => clearTimeout(timer);
	});

	let query = $derived(deferredSearch.trim().toLowerCase());
	// favorites Set read synchronously so filter re-runs when favorites change
	let favIds = $derived(playlist.favoriteIds);
	let channelByUrl = $derived.by(() => {
		const map = new Map<string, Channel>();
		for (const ch of playlist.channels) map.set(ch.url, ch);
		return map;
	});
	let recentChannels = $derived(
		playlist.recentChannelUrls
			.map((url) => channelByUrl.get(url))
			.filter((channel): channel is Channel => channel !== undefined)
	);

	let flatItems = $derived.by((): FlatItem[] => {
		const q = query;
		if (filter === 'recent') {
			return recentChannels
				.filter((channel) => !q || channelIndex.get(channel.id)?.includes(q))
				.map((channel) => ({ type: 'channel', channel, key: channel.id }));
		}
		const fav = filter === 'favorites' ? favIds : null;
		const filtered = playlist.channels.filter((ch) => {
			if (fav && !fav.has(ch.id)) return false;
			if (q) {
				const lowerName = channelIndex.get(ch.id);
				if (!lowerName || !lowerName.includes(q)) return false;
			}
			return true;
		});

		if (viewMode === 'default') {
			// playlist order, no group headers
			return filtered.map((channel) => ({ type: 'channel', channel, key: channel.id }));
		}

		if (viewMode === 'alpha') {
			// alphabetical, no group headers
			return [...filtered]
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((channel) => ({ type: 'channel', channel, key: channel.id }));
		}

		const groups = new Map<string, Channel[]>();
		for (const ch of filtered) {
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
		void flatItems;
		focusedIndex = -1;
	});

	// persist view mode choice
	$effect(() => {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(VIEW_KEY, viewMode);
	});

	// when the list first fills, focus the first channel if nothing is focused
	let autoFocusDone = false;
	$effect(() => {
		if (autoFocusDone || channelIndices.length === 0) return;
		autoFocusDone = true;
		setTimeout(() => {
			if (!document.activeElement || document.activeElement === document.body) focusInitial();
		}, 150);
	});

	function onFavoriteClick(e: MouseEvent, ch: Channel) {
		e.stopPropagation();
		toggleFavorite(ch.id);
	}

	// keyboard navigation within sidebar - stopPropagation so player doesn't also handle
	// (default arrow/enter keys are now handled by global TV navigation;
	// only user-customized shortcuts are handled here)
	function onKeydown(e: KeyboardEvent) {
		if (e.defaultPrevented) return;
		const target = e.target as HTMLElement | null;
		if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
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
			// enter/OK: let the browser activate the actual focused button,
			// otherwise both the button and the "focused channel" would fire
			if (
				(e.key === 'Enter' || e.key === 'NumpadEnter') &&
				target?.closest('button, a[href], input, summary, [role="button"], [tabindex]') !== null
			) {
				return;
			}
			if (focusedIndex < 0) return;
			const item = flatItems[focusedIndex];
			if (item && item.type === 'channel') {
				e.preventDefault();
				e.stopPropagation();
				selectChannel(item.channel);
			}
		}
	}

	// sync real keyboard/remote focus with the virtual list items
	function onFocusIn(e: FocusEvent) {
		const target = e.target as HTMLElement | null;
		const item = target?.closest?.('[data-tv-index]') as HTMLElement | null;
		if (!item) return;
		const idx = Number(item.getAttribute('data-tv-index'));
		if (Number.isFinite(idx)) focusedIndex = idx;
	}

	function focusItemAt(index: number) {
		requestAnimationFrame(() => {
			const el = containerEl?.querySelector<HTMLElement>(`[data-tv-index="${index}"]`);
			if (!el) {
				// if the virtual list hasn't rendered the item yet, retry after a short delay
				setTimeout(() => {
					containerEl?.querySelector<HTMLElement>(`[data-tv-index="${index}"]`)?.focus();
				}, 60);
				return;
			}
			el.focus({ preventScroll: true });
			el.scrollIntoView({ block: 'nearest' });
		});
	}

	function focusFirstChannel() {
		requestAnimationFrame(() => {
			const el = containerEl?.querySelector<HTMLElement>('[data-tv-channel-item]');
			el?.focus();
		});
	}

	function moveFocus(direction: 1 | -1) {
		if (focusedIndex < 0) {
			focusedIndex = channelIndices[direction === 1 ? 0 : channelIndices.length - 1];
		} else {
			const pos = channelIndices.indexOf(focusedIndex);
			if (pos < 0) {
				focusedIndex = channelIndices[0];
			} else {
				const next = pos + direction;
				if (next >= 0 && next < channelIndices.length) {
					focusedIndex = channelIndices[next];
				}
			}
		}
		focusItemAt(focusedIndex);
	}
</script>

<div
	role="listbox"
	class="flex h-full w-64 flex-col border-r border-border bg-card"
	bind:this={containerEl}
	data-tv-sidebar
	onkeydown={onKeydown}
	onfocusin={onFocusIn}
	tabindex="-1"
>
	<div class="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
		<span class="truncate text-xs font-semibold tracking-wide">{t('sidebar.channels')}</span>
		<span class="ml-auto text-xs text-muted-foreground tabular-nums"
			>{totalFiltered}{#if query || filter !== 'all'}/{playlist.channels.length}{/if}</span
		>
	</div>

	<div class="flex shrink-0 items-center gap-1 border-b border-border px-1.5 py-1">
		<Toggle
			pressed={viewMode === 'groups'}
			onclick={() => (viewMode = 'groups')}
			size="sm"
			variant="outline"
			aria-label={t('sidebar.viewGroups')}
			title={t('sidebar.viewGroups')}
			class="flex-1"
		>
			<i class="ri-folders-line"></i>
		</Toggle>
		<Toggle
			pressed={viewMode === 'default'}
			onclick={() => (viewMode = 'default')}
			size="sm"
			variant="outline"
			aria-label={t('sidebar.viewDefault')}
			title={t('sidebar.viewDefault')}
			class="flex-1"
		>
			<i class="ri-list-unordered"></i>
		</Toggle>
		<Toggle
			pressed={viewMode === 'alpha'}
			onclick={() => (viewMode = 'alpha')}
			size="sm"
			variant="outline"
			aria-label={t('sidebar.viewAlpha')}
			title={t('sidebar.viewAlpha')}
			class="flex-1"
		>
			<i class="ri-sort-alphabet-asc"></i>
		</Toggle>
	</div>

	<!-- fullscreen: just below the sort selector, top left -->
	{#if !fullscreen}
		<div class="shrink-0 border-b border-border p-1.5">
			<button
				type="button"
				data-sidebar-fullscreen
				onclick={toggleFullscreen}
				class="flex h-8 w-full items-center justify-center gap-2 rounded-md border border-border bg-background/40 px-2 text-xs font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				aria-label={t('shortcuts.desc_fullscreen')}
				title={t('shortcuts.desc_fullscreen')}
			>
				<i class="ri-fullscreen-line text-base leading-none"></i>
				<span>{t('player.fullscreen')}</span>
			</button>
		</div>
	{/if}

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
					onkeydown={(e: KeyboardEvent) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							focusFirstChannel();
						}
					}}
				/>
			</InputGroup>
		</div>
		<Toggle
			pressed={filter === 'favorites'}
			onclick={() => (filter = filter === 'favorites' ? 'all' : 'favorites')}
			variant="outline"
			aria-label={t('sidebar.favoritesAriaLabel')}
		>
			<i
				class="ri-heart-{filter === 'favorites' ? 'fill' : 'line'} {filter === 'favorites'
					? 'text-rose-500'
					: ''}"
			></i>
			{#if playlist.favoritesCount > 0}
				<span class="text-xs tabular-nums">{playlist.favoritesCount}</span>
			{/if}
		</Toggle>
		<Toggle
			pressed={filter === 'recent'}
			onclick={() => (filter = filter === 'recent' ? 'all' : 'recent')}
			variant="outline"
			aria-label={t('sidebar.recentAriaLabel')}
		>
			<i class="ri-history-line"></i>
			{#if recentChannels.length > 0}
				<span class="text-xs tabular-nums">{recentChannels.length}</span>
			{/if}
		</Toggle>
	</div>

	{#if flatItems.length === 0}
		<div
			class="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center text-xs text-muted-foreground"
		>
			<span>
				{#if filter === 'recent' && !query}
					{t('sidebar.noRecent')}
				{:else if filter === 'favorites' && !query}
					{t('sidebar.noFavorites')}
				{:else if query}
					{t('sidebar.noChannelsFound')}
				{:else}
					{t('sidebar.noChannels')}
				{/if}
			</span>
			{#if playlist.channels.length === 0}
				<Button variant="outline" size="sm" onclick={openSourcesDialog}>
					<i class="ri-add-line"></i>
					{t('sidebar.addSource')}
				</Button>
			{/if}
		</div>
	{:else}
		<VirtualList
			items={flatItems}
			itemHeight={enhanced ? 48 : 40}
			buffer={10}
			scrollToIndex={focusedIndex}
		>
			{#snippet renderItem(item, index)}
				{#if item.type === 'header'}
					<p
						class="flex h-full items-center px-3 text-[11px] font-medium tracking-wider uppercase {enhanced
							? 'tracking-[0.18em] text-primary/70'
							: 'text-muted-foreground'}"
					>
						{item.label}
					</p>
				{:else}
					{@const ch = item.channel}
					{@const active = playlist.currentChannel?.id === ch.id}
					{@const focused = index === focusedIndex}
					{@const fav = favIds.has(ch.id)}
					{@const rowState = active
						? enhanced
							? 'bg-primary/10 text-foreground ring-1 ring-primary/40'
							: 'bg-accent text-foreground'
						: focused
							? 'bg-muted/70 text-foreground'
							: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}
					<div class="group flex h-full items-center px-1">
						<button
							onclick={() => selectChannel(ch)}
							onpointerenter={() => (focusedIndex = index)}
							data-tv-channel-item
							data-tv-index={index}
							class="flex min-w-0 flex-1 items-center rounded-md text-sm transition-colors {enhanced
								? 'gap-2.5 px-1.5'
								: 'gap-2 px-2'} {rowState}"
						>
							{#if enhanced}
								<span
									class="w-5 shrink-0 text-right text-[11px] font-semibold text-muted-foreground tabular-nums"
								>
									{channelNumbers.get(ch.id) ?? ''}
								</span>
							{/if}
							<ChannelLogo name={ch.name} logo={ch.logo} size={enhanced ? 'size-7' : 'size-6'} />
							<span class="truncate font-medium">{ch.name}</span>
							{#if enhanced && active}
								<span class="ml-auto size-1.5 shrink-0 rounded-full bg-primary"></span>
							{/if}
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

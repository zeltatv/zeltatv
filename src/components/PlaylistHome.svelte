<script lang="ts">
	import { onMount } from 'svelte';
	import { loadPlaylist, usePlaylist } from '$lib/iptv/store.svelte';
	import {
		addFileSource,
		addUrlSource,
		deleteSource,
		initializeLibrary,
		playSource,
		updateSource,
		useLibrary,
		type PlaylistSource
	} from '$lib/iptv/library.svelte';
	import { writeSavedSession, markSetupComplete } from '$lib/iptv/session-storage';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { t } from '$lib/i18n/store.svelte';
	import { focusInitial } from '$lib/tv/nav.svelte';
	import { restoreFocusAfterRemove, rowIndexOf, rowScopeOf } from '$lib/tv/focus-restore';
	import { getSkin } from '$lib/theme/store.svelte';
	import { isEnhancedSkin } from '$lib/theme/skins';

	// Landing screen shown whenever the channel list is empty (first run after the
	// one-time wizard, the home button, or an emptied library). It fills the window
	// on its own: no player and no sidebar are mounted behind it.
	const playlist = usePlaylist();
	const library = useLibrary();
	// Enhanced uses a 10-foot layout: the saved playlists are large tiles that a
	// remote can walk through, and the URL / file form sits underneath them.
	const enhanced = $derived(isEnhancedSkin(getSkin()));

	let url = $state('');
	let alias = $state('');
	let search = $state('');
	let fileNames = $state('');
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let activeCategoryId = $state<string | null>(null);
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let editValue = $state('');

	const filteredSources = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return library.sources
			.filter((source) => !activeCategoryId || source.categoryIds.includes(activeCategoryId))
			.filter((source) => {
				if (!query) return true;
				return (
					source.name.toLowerCase().includes(query) || source.value.toLowerCase().includes(query)
				);
			});
	});

	const visibleSources = $derived(filteredSources.slice(0, 8));

	onMount(() => {
		// the library is read from IndexedDB: once it is there, the Enhanced layout
		// can put the focus on the first saved playlist instead of the URL field
		void initializeLibrary().then(() => {
			if (enhanced) setTimeout(focusInitial, 30);
		});
		// place the remote focus on the URL field when this screen opens
		const timer = setTimeout(focusInitial, 60);
		return () => clearTimeout(timer);
	});

	async function handleSubmit(event: Event) {
		event.preventDefault();
		const value = url.trim();
		if (!value || playlist.loading) return;
		try {
			await loadPlaylist(value);
			let sourceId: string | undefined;
			try {
				const source = await addUrlSource(value, alias.trim(), []);
				sourceId = source.id;
			} catch {
				// a library write error must not block playback
			}
			writeSavedSession({ type: 'url', value, sourceId });
			markSetupComplete();
			alias = '';
		} catch {
			// the error is shown from the playlist store
		}
	}

	async function handleFiles(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		if (files.length === 0) return;
		fileNames = files.map((file) => file.name).join(', ');
		let lastSource: PlaylistSource | null = null;
		try {
			for (const file of files) {
				lastSource = await addFileSource(file, activeCategoryId ? [activeCategoryId] : []);
			}
			if (lastSource) {
				writeSavedSession({
					type: 'file',
					sourceId: lastSource.id,
					name: lastSource.name
				});
				markSetupComplete();
			}
			input.value = '';
		} catch {
			// the error is shown from the playlist store
		}
	}

	async function handlePlay(source: PlaylistSource) {
		try {
			await playSource(source);
			writeSavedSession(
				source.type === 'url'
					? { type: 'url', value: source.value, sourceId: source.id }
					: { type: 'file', sourceId: source.id, name: source.name }
			);
			markSetupComplete();
		} catch {
			// the error is shown from the playlist store
		}
	}

	function startEdit(source: PlaylistSource) {
		editingId = source.id;
		editName = source.name;
		editValue = source.value;
	}

	async function saveEdit() {
		if (!editingId) return;
		const target = library.sources.find((source) => source.id === editingId);
		if (!target) return;
		try {
			await updateSource(editingId, {
				name: editName,
				value: target.type === 'file' ? target.value : editValue,
				categoryIds: target.categoryIds
			});
			editingId = null;
		} catch {
			// error is in the library store
		}
	}

	async function removeSource(id: string) {
		// deleting the row that owns the focus would drop it to <body>: remember
		// where it was and put the ring on the row that takes its place
		const row = document.querySelector<HTMLElement>(`[data-focus-row="${CSS.escape(id)}"]`);
		const scope = rowScopeOf(row);
		const index = rowIndexOf(row);
		try {
			await deleteSource(id);
			if (editingId === id) editingId = null;
		} catch {
			// error is in the library store
		} finally {
			await restoreFocusAfterRemove(scope, index, () =>
				document.querySelector<HTMLElement>(enhanced ? '[data-home-url]' : 'details summary')
			);
		}
	}
</script>

{#if enhanced}
	<!-- Enhanced: 10-foot home screen. Everything is a large target and the
	     playlists come first, so a remote can start a source with two presses. -->
	<div class="min-h-0 flex-1 overflow-y-auto">
		<div class="mx-auto w-full max-w-5xl space-y-6 px-6 py-6 sm:px-8 sm:py-7">
			<header class="flex items-end justify-between gap-4">
				<div class="flex items-center gap-3">
					<img
						src="/assets/logo.png"
						alt=""
						class="size-10 shrink-0 opacity-90 select-none"
						draggable="false"
					/>
					<div class="min-w-0">
						<h1 class="truncate text-lg font-semibold tracking-tight">ZeltaTV</h1>
						<p class="truncate text-xs text-muted-foreground">{t('setup.tagline')}</p>
					</div>
				</div>
				<div class="hidden shrink-0 items-center gap-3 text-[11px] text-muted-foreground sm:flex">
					<span><span class="font-semibold text-foreground">OK</span> · {t('menu.hintSelect')}</span
					>
					<span
						><span class="font-semibold text-foreground">↑↓←→</span> ·
						{t('menu.hintNavigate')}</span
					>
				</div>
			</header>

			<section class="space-y-3">
				<div class="flex items-center justify-between gap-3">
					<h2
						class="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
					>
						<i class="ri-play-list-2-line text-sm"></i>
						{t('setup.iptvLibrary')}
						<span
							class="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] tracking-normal text-foreground tabular-nums"
						>
							{library.sources.length}
						</span>
					</h2>
					{#if library.sources.length > 5}
						<Input
							bind:value={search}
							type="search"
							placeholder={t('setup.searchPlaylists')}
							aria-label={t('setup.searchPlaylistsAria')}
							class="h-8 w-44 text-xs"
						/>
					{/if}
				</div>

				{#if library.categories.length > 0}
					<div class="flex gap-2 overflow-x-auto pb-1">
						<button
							type="button"
							onclick={() => (activeCategoryId = null)}
							class="flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors {activeCategoryId ===
							null
								? 'border-primary bg-primary text-primary-foreground'
								: 'border-border text-muted-foreground hover:bg-muted'}"
						>
							<i class="ri-folder-open-line"></i>
							{t('setup.all')}
						</button>
						{#each library.categories as category (category.id)}
							<button
								type="button"
								onclick={() => (activeCategoryId = category.id)}
								class="flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors {activeCategoryId ===
								category.id
									? 'border-primary bg-primary text-primary-foreground'
									: 'border-border text-muted-foreground hover:bg-muted'}"
							>
								<i class="ri-folder-line"></i>
								{category.name}
							</button>
						{/each}
					</div>
				{/if}

				{#if library.sources.length === 0}
					<div
						class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-card/20 px-6 py-10 text-center"
					>
						<i class="ri-play-list-2-line text-2xl text-muted-foreground/60"></i>
						<p class="text-sm text-muted-foreground">{t('setup.wizard.emptyLibraryHint')}</p>
					</div>
				{:else}
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
						{#each filteredSources as source, index (source.id)}
							<div
								class="overflow-hidden rounded-lg border border-border/70 bg-card/40 transition-colors focus-within:border-primary/70 hover:border-primary/60"
								data-focus-row={source.id}
							>
								<button
									type="button"
									onclick={() => handlePlay(source)}
									class="flex w-full items-start gap-3 p-3.5 text-left"
									data-tv-focus-initial={index === 0 || undefined}
								>
									<span
										class="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"
									>
										<i class="ri-{source.type === 'url' ? 'link' : 'file-list-3'}-line text-xl"></i>
									</span>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-sm font-semibold">{source.name}</span>
										<span class="mt-0.5 block truncate text-[11px] text-muted-foreground">
											{source.type === 'url' ? source.value : source.fileName}
										</span>
									</span>
								</button>

								<div
									class="flex items-center justify-between gap-2 border-t border-border/60 bg-background/20 px-2 py-1"
								>
									<span
										class="truncate pl-1.5 text-[10px] tracking-[0.12em] text-muted-foreground uppercase"
									>
										{source.type === 'url' ? t('setup.wizard.typeUrl') : t('setup.wizard.typeFile')}
									</span>
									<div class="flex items-center gap-0.5">
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											onclick={() => startEdit(source)}
											aria-label={t('setup.edit')}
											title={t('setup.edit')}
										>
											<i class="ri-edit-line"></i>
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											onclick={() => removeSource(source.id)}
											aria-label={t('setup.deleteSource')}
											title={t('setup.deleteSource')}
										>
											<i class="ri-delete-bin-line"></i>
										</Button>
									</div>
								</div>

								{#if editingId === source.id}
									<div class="space-y-2 border-t border-border/70 bg-muted/20 p-2.5">
										<Input bind:value={editName} placeholder={t('setup.aliasPlaceholder')} />
										{#if source.type === 'url'}
											<Input
												bind:value={editValue}
												type="url"
												aria-label={t('setup.urlAriaLabel')}
											/>
										{/if}
										<div class="flex justify-end gap-2">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onclick={() => (editingId = null)}
											>
												{t('setup.cancel')}
											</Button>
											<Button type="button" size="sm" onclick={saveEdit}>
												{t('setup.save')}
											</Button>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				{#if library.error}
					<p class="flex items-center gap-1.5 text-xs text-destructive">
						<i class="ri-error-warning-line"></i>
						{library.error}
					</p>
				{/if}
			</section>

			<section class="space-y-3 rounded-lg border border-border/70 bg-card/20 p-4">
				<h2
					class="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
				>
					<i class="ri-add-circle-line text-sm"></i>
					{t('menu.sources')}
				</h2>

				<form
					class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
					onsubmit={handleSubmit}
				>
					<Input
						bind:value={alias}
						placeholder={t('setup.aliasPlaceholder')}
						aria-label={t('setup.aliasAriaLabel')}
						disabled={playlist.loading}
						class="h-11"
					/>
					<Input
						bind:value={url}
						type="url"
						disabled={playlist.loading}
						placeholder={t('setup.urlPlaceholder')}
						aria-label={t('setup.urlAriaLabel')}
						class="h-11"
						data-home-url
						data-tv-focus-initial={library.sources.length === 0 || undefined}
					/>
					<Button
						type="submit"
						class="h-11 px-5"
						disabled={playlist.loading || !url.trim()}
						data-primary-action
					>
						{#if playlist.loading}
							<i class="ri-loader-4-line animate-spin"></i>
							{t('setup.loading')}
						{:else}
							<i class="ri-download-line"></i>
							{t('setup.loadPlaylist')}
						{/if}
					</Button>
				</form>

				<div
					role="button"
					tabindex="0"
					onclick={() => fileInputEl?.click()}
					onkeydown={(event: KeyboardEvent) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							fileInputEl?.click();
						}
					}}
					class="flex h-11 w-full items-center gap-2 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 {playlist.loading
						? 'pointer-events-none opacity-50'
						: 'cursor-pointer'}"
				>
					<span
						class="inline-flex h-8 shrink-0 items-center rounded-md bg-primary px-2.5 text-sm font-medium text-primary-foreground"
					>
						{t('setup.chooseFile')}
					</span>
					<span class="min-w-0 flex-1 truncate text-muted-foreground">
						{fileNames || t('setup.noFileChosen')}
					</span>
					<input
						bind:this={fileInputEl}
						type="file"
						accept=".m3u,.m3u8,.txt"
						multiple
						class="hidden"
						onchange={handleFiles}
					/>
				</div>

				<p class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
					<i class="ri-information-line text-sm"></i>
					{t('setup.supportedFormats')}
				</p>

				{#if playlist.error}
					<p class="flex items-center gap-1.5 text-xs text-destructive">
						<i class="ri-error-warning-line"></i>
						{playlist.error}
					</p>
				{/if}
			</section>
		</div>
	</div>
{:else}
	<div class="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6 sm:p-8">
		<div class="w-full max-w-lg space-y-4">
			<img
				src="/assets/logo.png"
				alt="ZeltaTV"
				class="mx-auto block max-w-20 opacity-20 select-none"
				draggable="false"
			/>

			<form class="space-y-2" onsubmit={handleSubmit}>
				<Input
					bind:value={alias}
					placeholder={t('setup.aliasPlaceholder')}
					aria-label={t('setup.aliasAriaLabel')}
					disabled={playlist.loading}
				/>
				<Input
					bind:value={url}
					type="url"
					disabled={playlist.loading}
					placeholder={t('setup.urlPlaceholder')}
					aria-label={t('setup.urlAriaLabel')}
					data-tv-focus-initial
					data-home-url
				/>
				<Button
					type="submit"
					class="w-full"
					disabled={playlist.loading || !url.trim()}
					data-primary-action
				>
					{#if playlist.loading}
						<i class="ri-loader-4-line animate-spin"></i>
						{t('setup.loading')}
					{:else}
						<i class="ri-download-line"></i>
						{t('setup.loadPlaylist')}
					{/if}
				</Button>
			</form>

			{#if playlist.error}
				<p class="flex items-center gap-1.5 text-xs text-destructive">
					<i class="ri-error-warning-line"></i>
					{playlist.error}
				</p>
			{/if}

			<div
				role="button"
				tabindex="0"
				onclick={() => fileInputEl?.click()}
				onkeydown={(event: KeyboardEvent) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						fileInputEl?.click();
					}
				}}
				class="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 {playlist.loading
					? 'pointer-events-none opacity-50'
					: 'cursor-pointer'}"
			>
				<span
					class="inline-flex h-7 shrink-0 items-center rounded-md bg-primary px-2 text-sm font-medium text-primary-foreground"
				>
					{t('setup.chooseFile')}
				</span>
				<span class="min-w-0 flex-1 truncate text-muted-foreground">
					{fileNames || t('setup.noFileChosen')}
				</span>
				<input
					bind:this={fileInputEl}
					type="file"
					accept=".m3u,.m3u8,.txt"
					multiple
					class="hidden"
					onchange={handleFiles}
				/>
			</div>

			<p class="flex items-center gap-1.5 text-xs text-muted-foreground">
				<i class="ri-information-line text-sm"></i>
				{t('setup.supportedFormats')}
			</p>

			<details class="group overflow-hidden rounded-md border border-border">
				<summary
					class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground [&::-webkit-details-marker]:hidden"
				>
					<i class="ri-play-list-2-line"></i>
					<span class="truncate">{t('setup.iptvLibrary')}</span>
					<span class="ml-auto text-xs tabular-nums">{library.sources.length}</span>
					<i class="ri-arrow-down-s-line transition-transform group-open:rotate-180"></i>
				</summary>

				<div class="space-y-3 border-t border-border p-3">
					{#if library.categories.length > 0}
						<div class="flex gap-1.5 overflow-x-auto pb-1">
							<button
								type="button"
								onclick={() => (activeCategoryId = null)}
								class="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors {activeCategoryId ===
								null
									? 'border-primary bg-primary text-primary-foreground'
									: 'border-border text-muted-foreground hover:bg-muted'}"
							>
								<i class="ri-folder-open-line"></i>
								{t('setup.all')}
							</button>
							{#each library.categories as category (category.id)}
								<button
									type="button"
									onclick={() => (activeCategoryId = category.id)}
									class="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors {activeCategoryId ===
									category.id
										? 'border-primary bg-primary text-primary-foreground'
										: 'border-border text-muted-foreground hover:bg-muted'}"
								>
									<i class="ri-folder-line"></i>
									{category.name}
								</button>
							{/each}
						</div>
					{/if}

					{#if library.sources.length > 5}
						<Input
							bind:value={search}
							type="search"
							placeholder={t('setup.searchPlaylists')}
							aria-label={t('setup.searchPlaylistsAria')}
							class="h-9"
						/>
					{/if}

					{#if library.sources.length === 0}
						<div
							class="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/30 px-4 py-6 text-center"
						>
							<i class="ri-play-list-2-line text-xl text-muted-foreground/60"></i>
							<p class="mt-2 text-xs text-muted-foreground">{t('setup.wizard.emptyLibraryHint')}</p>
						</div>
					{:else}
						<div class="max-h-64 space-y-2 overflow-y-auto pr-0.5">
							{#each visibleSources as source (source.id)}
								<div
									class="overflow-hidden rounded-md border border-border/70 bg-background/30"
									data-focus-row={source.id}
								>
									<div class="flex items-center gap-1 p-1">
										<button
											type="button"
											onclick={() => handlePlay(source)}
											class="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
										>
											<i
												class="ri-{source.type === 'url'
													? 'link'
													: 'file-list-3'}-line shrink-0 text-muted-foreground"
											></i>
											<span class="min-w-0 flex-1">
												<span class="block truncate text-sm">{source.name}</span>
												<span class="block truncate text-[11px] text-muted-foreground">
													{source.type === 'url' ? source.value : source.fileName}
												</span>
											</span>
										</button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											onclick={() => handlePlay(source)}
											disabled={playlist.loading}
											aria-label={t('setup.play')}
											title={t('setup.play')}
										>
											<i class="ri-play-line"></i>
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											onclick={() => startEdit(source)}
											aria-label={t('setup.edit')}
											title={t('setup.edit')}
										>
											<i class="ri-edit-line"></i>
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											onclick={() => removeSource(source.id)}
											aria-label={t('setup.deleteSource')}
											title={t('setup.deleteSource')}
										>
											<i class="ri-delete-bin-line"></i>
										</Button>
									</div>

									{#if editingId === source.id}
										<div class="space-y-2 border-t border-border/70 bg-muted/20 p-2.5">
											<Input bind:value={editName} placeholder={t('setup.aliasPlaceholder')} />
											{#if source.type === 'url'}
												<Input
													bind:value={editValue}
													type="url"
													aria-label={t('setup.urlAriaLabel')}
												/>
											{/if}
											<div class="flex justify-end gap-2">
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onclick={() => (editingId = null)}
												>
													{t('setup.cancel')}
												</Button>
												<Button type="button" size="sm" onclick={saveEdit}>
													{t('setup.save')}
												</Button>
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					{#if library.error}
						<p class="text-xs text-destructive">{library.error}</p>
					{/if}
				</div>
			</details>
		</div>
	</div>
{/if}

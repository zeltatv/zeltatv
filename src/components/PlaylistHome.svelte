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

	// Landing screen shown whenever the channel list is empty (first run after the
	// one-time wizard, the home button, or an emptied library). It fills the window
	// on its own: no player and no sidebar are mounted behind it.
	const playlist = usePlaylist();
	const library = useLibrary();

	let url = $state('');
	let alias = $state('');
	let search = $state('');
	let fileNames = $state('');
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let activeCategoryId = $state<string | null>(null);
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let editValue = $state('');

	const visibleSources = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return library.sources
			.filter((source) => !activeCategoryId || source.categoryIds.includes(activeCategoryId))
			.filter((source) => {
				if (!query) return true;
				return (
					source.name.toLowerCase().includes(query) || source.value.toLowerCase().includes(query)
				);
			})
			.slice(0, 8);
	});

	onMount(() => {
		void initializeLibrary();
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
				document.querySelector<HTMLElement>('details summary')
			);
		}
	}
</script>

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

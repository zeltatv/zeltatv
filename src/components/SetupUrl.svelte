<script lang="ts">
	import { loadPlaylist, usePlaylist } from '$lib/iptv/store.svelte';
	import {
		addCategory,
		addFileSource,
		addUrlSource,
		initializeLibrary,
		playSource,
		updateSource,
		useLibrary,
		type PlaylistSource
	} from '$lib/iptv/library.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { t } from '$lib/i18n/store.svelte';

	let url = $state('');
	let alias = $state('');
	let search = $state('');
	let categoryName = $state('');
	let activeCategoryId = $state<string | null>(null);
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let editValue = $state('');
	let editCategoryIds = $state<string[]>([]);
	const playlist = usePlaylist();
	const library = useLibrary();

	let visibleSources = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return library.sources
			.filter((source) => !activeCategoryId || source.categoryIds.includes(activeCategoryId))
			.filter((source) => {
				if (!query) return true;
				return source.name.toLowerCase().includes(query) || source.value.toLowerCase().includes(query);
			})
			.slice(0, 5);
	});

	$effect(() => {
		void initializeLibrary();
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		const value = url.trim();
		if (!value) return;
		try {
			await loadPlaylist(value);
			await addUrlSource(value, alias.trim());
			alias = '';
		} catch {
			// error is in store
		}
	}

	async function handleFiles(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		try {
			for (const file of files) {
				await addFileSource(file);
			}
			input.value = '';
		} catch {
			// error is in store
		}
	}

	async function handlePlay(source: PlaylistSource) {
		try {
			await playSource(source);
		} catch {
			// error is in store
		}
	}

	function selectSource(source: PlaylistSource) {
		if (source.type === 'url') {
			url = source.value;
			alias = source.name;
			return;
		}
		void handlePlay(source);
	}

	function startEdit(source: PlaylistSource) {
		editingId = source.id;
		editName = source.name;
		editValue = source.value;
		editCategoryIds = [...source.categoryIds];
	}

	function toggleEditCategory(categoryId: string) {
		if (editCategoryIds.includes(categoryId)) {
			editCategoryIds = editCategoryIds.filter((id) => id !== categoryId);
			return;
		}
		editCategoryIds = [...editCategoryIds, categoryId];
	}

	async function saveEdit() {
		if (!editingId) return;
		try {
			await updateSource(editingId, {
				name: editName,
				value: editValue,
				categoryIds: editCategoryIds
			});
			editingId = null;
		} catch {
			// error is in library store
		}
	}

	async function createCategory() {
		try {
			await addCategory(categoryName);
			categoryName = '';
		} catch {
			// error is in library store
		}
	}

	function categoryLabels(source: PlaylistSource): string {
		return library.categories
			.filter((category) => source.categoryIds.includes(category.id))
			.map((category) => category.name)
			.join(', ');
	}
</script>

<div class="flex flex-1 items-center justify-center overflow-y-auto p-8">
	<div class="w-full max-w-lg space-y-4">
		<img src="/assets/logo.png" alt="ZeltaTV" class="mx-auto block max-w-20 opacity-20" />

		<form class="space-y-2" onsubmit={handleSubmit}>
			<Input bind:value={alias} placeholder="Alias (optional)" aria-label="playlist alias" />
			<Input
				bind:value={url}
				type="url"
				disabled={playlist.loading}
				placeholder={t('setup.urlPlaceholder')}
				aria-label={t('setup.urlAriaLabel')}
			/>
		</form>

		<Input
			type="file"
			accept=".m3u,.m3u8,.txt"
			multiple
			disabled={playlist.loading}
			onchange={handleFiles}
		/>
		<p class="flex items-center gap-1.5 text-xs text-muted-foreground">
			<i class="ri-information-line text-sm"></i>
			Supported file formats: .m3u, .m3u8, .txt
		</p>

		<details class="group overflow-hidden rounded-md border border-border">
			<summary
				class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground [&::-webkit-details-marker]:hidden"
			>
				<i class="ri-play-list-2-line"></i>
				<span class="truncate">IPTV Library</span>
				<span class="ml-auto text-xs tabular-nums">{library.sources.length}</span>
				<i class="ri-arrow-down-s-line transition-transform group-open:rotate-180"></i>
			</summary>

			<div class="space-y-3 border-t border-border p-3">
				<div class="flex gap-2">
					<Input
						bind:value={categoryName}
						placeholder="New category folder"
						aria-label="new category folder"
					/>
					<Button type="button" variant="outline" onclick={createCategory} disabled={!categoryName.trim()}>
						<i class="ri-folder-add-line"></i>
						Add
					</Button>
				</div>

				{#if library.categories.length > 0}
					<div class="flex gap-1.5 overflow-x-auto pb-1">
						<button
							type="button"
							onclick={() => (activeCategoryId = null)}
							class="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors {activeCategoryId === null
								? 'border-primary bg-primary text-primary-foreground'
								: 'border-border text-muted-foreground hover:bg-muted'}"
						>
							<i class="ri-folder-open-line"></i>
							All
						</button>
						{#each library.categories as category (category.id)}
							<button
								type="button"
								onclick={() => (activeCategoryId = category.id)}
								class="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors {activeCategoryId === category.id
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
						placeholder="Search playlists..."
						aria-label="search playlists"
					/>
				{/if}

				<div class="space-y-2">
					{#each visibleSources as source (source.id)}
						<div class="overflow-hidden rounded-md border border-border">
							<div class="flex items-center gap-1 p-1">
								<button
									type="button"
									onclick={() => selectSource(source)}
									class="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-muted"
								>
									<i class="ri-{source.type === 'url' ? 'link' : 'file-list-3'}-line shrink-0 text-muted-foreground"></i>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-sm">{source.name}</span>
										<span class="block truncate text-xs text-muted-foreground">
											{categoryLabels(source) || (source.type === 'url' ? source.value : source.fileName)}
										</span>
									</span>
								</button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									onclick={() => handlePlay(source)}
									disabled={playlist.loading}
									aria-label="play playlist"
									title="Play"
								>
									<i class="ri-play-line"></i>
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									onclick={() => startEdit(source)}
									aria-label="edit playlist"
									title="Edit"
								>
									<i class="ri-edit-line"></i>
								</Button>
							</div>

							{#if editingId === source.id}
								<div class="space-y-2 border-t border-border bg-muted/20 p-3">
									<Input bind:value={editName} placeholder="Alias" aria-label="playlist alias" />
									{#if source.type === 'url'}
										<Input bind:value={editValue} type="url" aria-label="playlist url" />
									{/if}
									{#if library.categories.length > 0}
										<div class="flex flex-wrap gap-2">
											{#each library.categories as category (category.id)}
												<label class="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
													<input
														type="checkbox"
														checked={editCategoryIds.includes(category.id)}
														onchange={() => toggleEditCategory(category.id)}
													/>
													{category.name}
												</label>
											{/each}
										</div>
									{/if}
									<div class="flex justify-end gap-2">
										<Button type="button" variant="ghost" size="sm" onclick={() => (editingId = null)}>
											Cancel
										</Button>
										<Button type="button" size="sm" onclick={saveEdit}>Save</Button>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>

				{#if library.error}
					<p class="text-xs text-destructive">{library.error}</p>
				{/if}
			</div>
		</details>
	</div>
</div>

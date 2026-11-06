<script lang="ts">
	import { t } from '$lib/i18n/store.svelte';
	import {
		addCategory,
		deleteCategory,
		deleteSource,
		updateSource,
		useLibrary,
		type PlaylistSource
	} from '$lib/iptv/library.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { restoreFocusAfterRemove, rowIndexOf, rowScopeOf } from '$lib/tv/focus-restore';

	interface Props {
		selectedId?: string | null;
		onquickstart?: (source: PlaylistSource) => void;
		limit?: number;
	}

	let { selectedId = $bindable(null), onquickstart, limit = 6 }: Props = $props();

	const library = useLibrary();

	let search = $state('');
	let categoryName = $state('');
	let activeCategoryId = $state<string | null>(null);
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let editValue = $state('');
	let editCategoryIds = $state<string[]>([]);

	let visibleSources = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return library.sources
			.filter((source) => !activeCategoryId || source.categoryIds.includes(activeCategoryId))
			.filter((source) => {
				if (!query) return true;
				return (
					source.name.toLowerCase().includes(query) || source.value.toLowerCase().includes(query)
				);
			})
			.slice(0, limit);
	});

	function categoryLabels(source: PlaylistSource): string {
		return library.categories
			.filter((category) => source.categoryIds.includes(category.id))
			.map((category) => category.name)
			.join(', ');
	}

	function sourceDetail(source: PlaylistSource): string {
		return (
			categoryLabels(source) || (source.type === 'url' ? source.value : (source.fileName ?? ''))
		);
	}

	async function createCategory() {
		try {
			await addCategory(categoryName);
			categoryName = '';
		} catch {
			// error is in library store
		}
	}

	async function removeCategory(id: string) {
		// keep the remote focus on the neighbouring category chip
		const row = document.querySelector<HTMLElement>(`[data-focus-cat="${CSS.escape(id)}"]`);
		const scope = rowScopeOf(row);
		const index = rowIndexOf(row, '[data-focus-cat]');
		try {
			await deleteCategory(id);
			if (activeCategoryId === id) activeCategoryId = null;
		} catch {
			// error is in library store
		} finally {
			await restoreFocusAfterRemove(
				scope,
				index,
				() => document.querySelector<HTMLElement>('[data-category-name]'),
				'[data-focus-cat]'
			);
		}
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

	function setEditCategory(categoryId: string, checked: boolean) {
		if (checked === editCategoryIds.includes(categoryId)) return;
		toggleEditCategory(categoryId);
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

	async function removeSource(id: string) {
		// deleting the row that owns the focus would drop it to <body>: remember
		// where it was and put the ring on the row that takes its place
		const row = document.querySelector<HTMLElement>(`[data-focus-row="${CSS.escape(id)}"]`);
		const scope = rowScopeOf(row);
		const index = rowIndexOf(row);
		try {
			await deleteSource(id);
			if (editingId === id) editingId = null;
			if (selectedId === id) selectedId = null;
		} catch {
			// error is in library store
		} finally {
			await restoreFocusAfterRemove(scope, index, () =>
				document.querySelector<HTMLElement>('[data-category-name]')
			);
		}
	}
</script>

<div class="space-y-3">
	<div class="flex gap-2">
		<Input
			bind:value={categoryName}
			placeholder={t('setup.categoryFolder')}
			aria-label={t('setup.categoryFolderAria')}
			class="h-9"
			data-category-name
		/>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="h-9 shrink-0"
			onclick={createCategory}
			disabled={!categoryName.trim()}
		>
			<i class="ri-folder-add-line"></i>
			{t('setup.add')}
		</Button>
	</div>

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
				<div
					class="flex shrink-0 items-center overflow-hidden rounded-md border {activeCategoryId ===
					category.id
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-border text-muted-foreground'}"
					data-focus-cat={category.id}
				>
					<button
						type="button"
						onclick={() => (activeCategoryId = category.id)}
						class="flex items-center gap-1.5 px-2 py-1 text-xs transition-colors"
					>
						<i class="ri-folder-line"></i>
						{category.name}
					</button>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						class="rounded-none hover:bg-transparent"
						onclick={() => removeCategory(category.id)}
						aria-label={t('setup.deleteCategory')}
						title={t('setup.deleteCategory')}
					>
						<i class="ri-delete-bin-line"></i>
					</Button>
				</div>
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
			data-step-focus
		/>
	{/if}

	{#if library.sources.length === 0}
		<div
			class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/30 px-6 py-8 text-center"
		>
			<i class="ri-play-list-2-line text-2xl text-muted-foreground/60"></i>
			<p class="mt-2 text-sm font-medium">{t('setup.wizard.emptyLibrary')}</p>
			<p class="mt-1 text-xs text-muted-foreground">{t('setup.wizard.emptyLibraryHint')}</p>
		</div>
	{:else}
		<div class="max-h-[248px] space-y-2 overflow-y-auto pr-0.5">
			{#each visibleSources as source (source.id)}
				{@const selected = selectedId === source.id}
				<div
					class="overflow-hidden rounded-lg border transition-colors {selected
						? 'border-primary/60 bg-primary/10'
						: 'border-border/70 bg-background/30 hover:bg-muted/30'}"
					data-focus-row={source.id}
				>
					<div class="flex items-center gap-1 p-1">
						<button
							type="button"
							onclick={() => (selectedId = source.id)}
							aria-current={selected ? 'true' : undefined}
							data-library-source={source.id}
							data-step-focus={selectedId === null && visibleSources[0]?.id === source.id
								? ''
								: undefined}
							class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left"
						>
							<i
								class="ri-{source.type === 'url'
									? 'link'
									: 'file-list-3'}-line shrink-0 text-sm {selected
									? 'text-primary'
									: 'text-muted-foreground'}"
							></i>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-medium">{source.name}</span>
								<span class="block truncate text-[11px] text-muted-foreground">
									{sourceDetail(source)}
								</span>
							</span>
							{#if selected}
								<i class="ri-check-line shrink-0 text-primary"></i>
							{/if}
						</button>
						{#if onquickstart}
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								onclick={() => onquickstart(source)}
								aria-label={t('setup.play')}
								title={t('setup.play')}
							>
								<i class="ri-play-line"></i>
							</Button>
						{/if}
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
						<div class="space-y-2 border-t border-border/70 bg-muted/20 p-3">
							<Input
								bind:value={editName}
								placeholder={t('setup.aliasPlaceholder')}
								aria-label={t('setup.aliasAriaLabel')}
							/>
							{#if source.type === 'url'}
								<Input bind:value={editValue} type="url" aria-label={t('setup.urlAriaLabel')} />
							{/if}
							{#if library.categories.length > 0}
								<div class="flex flex-wrap gap-2">
									{#each library.categories as category (category.id)}
										<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
											<Checkbox
												bind:checked={
													() => editCategoryIds.includes(category.id),
													(checked) => setEditCategory(category.id, checked)
												}
												aria-label={category.name}
											/>
											<span>{category.name}</span>
										</div>
									{/each}
								</div>
							{/if}
							<div class="flex justify-end gap-2">
								<Button type="button" variant="ghost" size="sm" onclick={() => (editingId = null)}>
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

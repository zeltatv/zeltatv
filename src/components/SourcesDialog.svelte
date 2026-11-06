<script lang="ts">
	import { Dialog, DialogContent, DialogDescription, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { t } from '$lib/i18n/store.svelte';
	import {
		addFileSource,
		addUrlSource,
		initializeLibrary,
		playSource,
		useLibrary,
		type PlaylistSource
	} from '$lib/iptv/library.svelte';
	import { loadPlaylist, usePlaylist } from '$lib/iptv/store.svelte';
	import { writeSavedSession } from '$lib/iptv/session-storage';
	import { sourcesDialog } from '$lib/ui/sources-dialog.svelte';
	import SetupLibrary from './setup/SetupLibrary.svelte';

	type Tab = 'url' | 'file' | 'library';

	const library = useLibrary();
	const playlist = usePlaylist();

	let tab = $state<Tab>('url');
	let url = $state('');
	let alias = $state('');
	let categoryId = $state('');
	let selectedFile = $state<File | null>(null);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let busy = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (!sourcesDialog.open) return;
		void initializeLibrary();
		error = null;
	});

	const tabs: Array<{ id: Tab; icon: string; label: string }> = [
		{ id: 'url', icon: 'ri-link', label: 'sources.tabLink' },
		{ id: 'file', icon: 'ri-file-list-3-line', label: 'sources.tabFile' },
		{ id: 'library', icon: 'ri-play-list-2-line', label: 'sources.tabLibrary' }
	];

	function categoryIds(): string[] {
		return categoryId ? [categoryId] : [];
	}

	function remember(source: PlaylistSource) {
		writeSavedSession(
			source.type === 'url'
				? { type: 'url', value: source.value, sourceId: source.id }
				: { type: 'file', sourceId: source.id, name: source.name }
		);
		sourcesDialog.open = false;
	}

	function resetForm() {
		url = '';
		alias = '';
		categoryId = '';
		selectedFile = null;
		if (fileInputEl) fileInputEl.value = '';
	}

	async function addLink() {
		const value = url.trim();
		if (!value) {
			error = t('sources.urlRequired');
			return;
		}
		busy = true;
		error = null;
		try {
			await loadPlaylist(value);
			const source = await addUrlSource(value, alias.trim(), categoryIds());
			remember(source);
			resetForm();
		} catch (cause) {
			error = playlist.error ?? (cause instanceof Error ? cause.message : t('sources.error'));
		} finally {
			busy = false;
		}
	}

	async function addFile() {
		if (!selectedFile) {
			error = t('sources.fileRequired');
			return;
		}
		busy = true;
		error = null;
		try {
			const source = await addFileSource(selectedFile, categoryIds());
			remember(source);
			resetForm();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : t('sources.error');
		} finally {
			busy = false;
		}
	}

	function onFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		selectedFile = input.files?.[0] ?? null;
		error = null;
	}

	async function startSource(source: PlaylistSource) {
		busy = true;
		error = null;
		try {
			await playSource(source);
			remember(source);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : t('sources.error');
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open={sourcesDialog.open}>
	<DialogContent
		class="flex max-h-[min(640px,calc(100vh-3rem))] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
	>
		<header class="flex flex-col gap-1 border-b border-border/70 px-5 py-4">
			<DialogTitle class="text-base font-semibold tracking-tight">
				{t('sources.title')}
			</DialogTitle>
			<DialogDescription class="text-xs text-muted-foreground">
				{t('sources.description')}
			</DialogDescription>
		</header>

		<div class="flex gap-1 border-b border-border/70 px-4 py-2">
			{#each tabs as item (item.id)}
				<button
					type="button"
					onclick={() => {
						tab = item.id;
						error = null;
					}}
					aria-pressed={tab === item.id}
					class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {tab ===
					item.id
						? 'bg-primary/15 text-foreground'
						: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
				>
					<i class="{item.icon} text-sm"></i>
					{t(item.label)}
				</button>
			{/each}
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
			{#if tab === 'url'}
				<div class="space-y-3">
					<div>
						<label
							for="source-url"
							class="mb-1.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
						>
							{t('sources.urlLabel')}
						</label>
						<Input
							id="source-url"
							bind:value={url}
							type="url"
							placeholder={t('setup.urlPlaceholder')}
							aria-label={t('sources.urlLabel')}
							oninput={() => (error = null)}
						/>
					</div>
					<div>
						<label
							for="source-alias"
							class="mb-1.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
						>
							{t('sources.nameLabel')}
						</label>
						<Input
							id="source-alias"
							bind:value={alias}
							placeholder={t('sources.namePlaceholder')}
							aria-label={t('sources.nameLabel')}
						/>
					</div>
					<div>
						<label
							for="source-category"
							class="mb-1.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
						>
							{t('sources.categoryLabel')}
						</label>
						<div class="relative">
							<select
								id="source-category"
								bind:value={categoryId}
								class="h-9 w-full appearance-none rounded-md border border-input bg-transparent pr-9 pl-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
							>
								<option value="">{t('sources.categoryNone')}</option>
								{#each library.categories as category (category.id)}
									<option value={category.id}>{category.name}</option>
								{/each}
							</select>
							<i
								class="ri-arrow-down-s-line pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
							></i>
						</div>
					</div>
					<Button onclick={addLink} disabled={busy || !url.trim()} class="w-full">
						<i class="ri-add-line"></i>
						{t('sources.addLink')}
					</Button>
				</div>
			{:else if tab === 'file'}
				<div class="space-y-3">
					<button
						type="button"
						onclick={() => fileInputEl?.click()}
						class="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-background/30 px-6 py-7 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
					>
						<i class="ri-upload-cloud-2-line text-3xl text-primary"></i>
						<span class="text-sm font-medium">
							{selectedFile ? selectedFile.name : t('sources.chooseFile')}
						</span>
						<span class="text-[11px] text-muted-foreground">{t('sources.fileHint')}</span>
					</button>
					<input
						bind:this={fileInputEl}
						type="file"
						accept=".m3u,.m3u8,.txt"
						class="hidden"
						onchange={onFileChange}
					/>
					<div>
						<label
							for="source-file-category"
							class="mb-1.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
						>
							{t('sources.categoryLabel')}
						</label>
						<div class="relative">
							<select
								id="source-file-category"
								bind:value={categoryId}
								class="h-9 w-full appearance-none rounded-md border border-input bg-transparent pr-9 pl-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
							>
								<option value="">{t('sources.categoryNone')}</option>
								{#each library.categories as category (category.id)}
									<option value={category.id}>{category.name}</option>
								{/each}
							</select>
							<i
								class="ri-arrow-down-s-line pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
							></i>
						</div>
					</div>
					<Button onclick={addFile} disabled={busy || !selectedFile} class="w-full">
						<i class="ri-add-line"></i>
						{t('sources.addFile')}
					</Button>
				</div>
			{:else}
				<SetupLibrary onquickstart={startSource} limit={100} />
			{/if}

			{#if error}
				<p class="mt-3 flex items-center gap-1.5 text-xs text-destructive">
					<i class="ri-error-warning-line"></i>
					{error}
				</p>
			{/if}
		</div>
	</DialogContent>
</Dialog>

<script lang="ts">
	import { tick } from 'svelte';
	import { loadPlaylist, loadPlaylistContent, usePlaylist } from '$lib/iptv/store.svelte';
	import {
		addFileSource,
		addUrlSource,
		initializeLibrary,
		playSource,
		useLibrary,
		type PlaylistSource
	} from '$lib/iptv/library.svelte';
	import {
		writeSavedSession,
		markSetupComplete,
		type SavedSession
	} from '$lib/iptv/session-storage';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import {
		t,
		getLocale,
		setLocale,
		availableLocales,
		localeNames,
		type Locale
	} from '$lib/i18n/store.svelte';
	import SetupBrandPanel from './SetupBrandPanel.svelte';
	import SetupLibrary from './SetupLibrary.svelte';

	interface Props {
		onenter: () => void;
		onskip: () => void;
	}

	let { onenter, onskip }: Props = $props();

	type Step = 'language' | 'welcome' | 'source' | 'ready' | 'loading' | 'finish';
	type Mode = 'url' | 'file' | 'library';

	const playlist = usePlaylist();
	const library = useLibrary();

	// The language picked here applies to the wizard immediately and to the rest
	// of the app as soon as setup is finished.
	let chosenLocale = $state<Locale>(getLocale());
	let step = $state<Step>('language');
	let mode = $state<Mode>('url');
	let url = $state('');
	let alias = $state('');
	let selectedFiles = $state<File[]>([]);
	let selectedLibraryId = $state<string | null>(null);
	let saveToLibrary = $state(true);
	let categoryId = $state('');
	let formError = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let channelCount = $state(0);
	let installing = $state(false);

	let contentEl = $state<HTMLDivElement | null>(null);
	let footerEl = $state<HTMLElement | null>(null);
	let fileInputEl = $state<HTMLInputElement | null>(null);

	const selectedLibrarySource = $derived(
		library.sources.find((source) => source.id === selectedLibraryId) ?? null
	);

	const activeIndex = $derived(
		step === 'language' || step === 'welcome' || step === 'source'
			? 0
			: step === 'ready' || step === 'loading'
				? 1
				: 2
	);

	const modes = [
		{ id: 'url' as const, icon: 'ri-link', label: 'setup.wizard.tabUrl' },
		{ id: 'file' as const, icon: 'ri-file-list-3-line', label: 'setup.wizard.tabFile' },
		{ id: 'library' as const, icon: 'ri-play-list-2-line', label: 'setup.wizard.tabLibrary' }
	];

	const features = [
		{
			icon: 'ri-remote-control-line',
			title: 'setup.wizard.featureRemote',
			body: 'setup.wizard.featureRemoteBody'
		},
		{
			icon: 'ri-folder-3-line',
			title: 'setup.wizard.featureLibrary',
			body: 'setup.wizard.featureLibraryBody'
		},
		{
			icon: 'ri-flashlight-line',
			title: 'setup.wizard.featureFast',
			body: 'setup.wizard.featureFastBody'
		}
	];

	const summaryType = $derived(
		mode === 'url'
			? t('setup.wizard.typeUrl')
			: mode === 'file'
				? t('setup.wizard.typeFile')
				: t('setup.wizard.typeLibrary')
	);

	const summaryName = $derived(
		mode === 'url'
			? alias.trim() || url.trim()
			: mode === 'file'
				? selectedFiles.map((file) => file.name).join(', ')
				: (selectedLibrarySource?.name ?? '')
	);

	const summaryValue = $derived(
		mode === 'url'
			? url.trim()
			: mode === 'file'
				? selectedFiles.map((file) => file.name).join(', ')
				: (selectedLibrarySource?.fileName ?? selectedLibrarySource?.value ?? '')
	);

	const summaryCategory = $derived.by(() => {
		if (mode === 'library') {
			if (!selectedLibrarySource) return t('setup.wizard.categoryNone');
			const names = library.categories
				.filter((category) => selectedLibrarySource.categoryIds.includes(category.id))
				.map((category) => category.name);
			return names.length > 0 ? names.join(', ') : t('setup.wizard.categoryNone');
		}
		if (!categoryId) return t('setup.wizard.categoryNone');
		return library.categories.find((category) => category.id === categoryId)?.name ?? '';
	});

	const summaryLibrary = $derived(
		mode === 'library'
			? t('setup.wizard.typeLibrary')
			: saveToLibrary
				? t('setup.wizard.libraryYes')
				: t('setup.wizard.libraryNo')
	);

	$effect(() => {
		void initializeLibrary();
	});

	// Reset the wizard when the home button in the top bar clears the playlist
	$effect(() => {
		if (!playlist.hasPlaylist && step === 'finish') step = 'welcome';
	});

	async function focusStep() {
		await tick();
		const target =
			contentEl?.querySelector<HTMLElement>('[data-step-focus]') ??
			footerEl?.querySelector<HTMLElement>('[data-primary-action]');
		target?.focus({ preventScroll: true });
	}

	async function go(next: Step) {
		step = next;
		formError = null;
		if (next !== 'loading') await focusStep();
	}

	async function selectMode(next: Mode) {
		if (mode === next) return;
		mode = next;
		formError = null;
		await focusStep();
	}

	function chooseLocale(next: Locale) {
		chosenLocale = next;
		setLocale(next);
	}

	function advance() {
		if (step === 'language') {
			setLocale(chosenLocale);
			void go('welcome');
			return;
		}
		if (step === 'welcome') {
			void go('source');
			return;
		}
		if (step === 'source') {
			if (mode === 'url' && !url.trim()) {
				formError = t('setup.wizard.urlRequired');
				void focusStep();
				return;
			}
			if (mode === 'file' && selectedFiles.length === 0) {
				formError = t('setup.wizard.fileRequired');
				void focusStep();
				return;
			}
			if (mode === 'library' && !selectedLibrarySource) {
				formError = t('setup.wizard.libraryRequired');
				return;
			}
			void go('ready');
			return;
		}
		if (step === 'ready') void install();
	}

	function back() {
		if (step === 'welcome') {
			void go('language');
			return;
		}
		if (step === 'source') {
			void go('welcome');
			return;
		}
		if (step === 'ready') {
			void go('source');
			return;
		}
		if (step === 'loading' && errorMessage) {
			errorMessage = null;
			void go('ready');
		}
	}

	function categoryIds(): string[] {
		return categoryId ? [categoryId] : [];
	}

	async function install() {
		if (installing) return;
		installing = true;
		errorMessage = null;
		await go('loading');

		try {
			let sessionToSave: SavedSession | null = null;
			if (mode === 'url') {
				const value = url.trim();
				await loadPlaylist(value);
				let sourceId: string | undefined;
				if (saveToLibrary) {
					try {
						const source = await addUrlSource(value, alias.trim(), categoryIds());
						sourceId = source.id;
					} catch {
						// library write errors must not block playback
					}
				}
				sessionToSave = { type: 'url', value, sourceId };
			} else if (mode === 'file') {
				let lastSource: PlaylistSource | null = null;
				let lastContent: { name: string; content: string } | null = null;
				for (const file of selectedFiles) {
					if (saveToLibrary) {
						try {
							lastSource = await addFileSource(file, categoryIds());
						} catch (cause) {
							if (!playlist.hasPlaylist) throw cause;
						}
					} else {
						const content = await file.text();
						loadPlaylistContent(content);
						lastContent = { name: file.name, content };
						lastSource = null;
					}
				}
				if (lastSource) {
					sessionToSave = {
						type: 'file',
						sourceId: lastSource.id,
						name: lastSource.name
					};
				} else if (lastContent) {
					sessionToSave = {
						type: 'file',
						name: lastContent.name,
						content: lastContent.content
					};
				}
			} else if (selectedLibrarySource) {
				await playSource(selectedLibrarySource);
				sessionToSave =
					selectedLibrarySource.type === 'url'
						? {
								type: 'url',
								value: selectedLibrarySource.value,
								sourceId: selectedLibrarySource.id
							}
						: {
								type: 'file',
								sourceId: selectedLibrarySource.id,
								name: selectedLibrarySource.name
							};
			} else {
				throw new Error(t('setup.wizard.libraryRequired'));
			}

			channelCount = playlist.channels.length;
			if (channelCount === 0) throw new Error(t('setup.wizard.noChannels'));
			if (sessionToSave) writeSavedSession(sessionToSave);
			markSetupComplete();
			await go('finish');
		} catch (cause) {
			errorMessage =
				playlist.error ?? (cause instanceof Error ? cause.message : t('setup.wizard.errorBody'));
			await focusStep();
		} finally {
			installing = false;
		}
	}

	function quickStart(source: PlaylistSource) {
		mode = 'library';
		selectedLibraryId = source.id;
		void install();
	}

	function backToLibrary() {
		mode = 'library';
		void go('source');
	}

	function onFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		selectedFiles = Array.from(input.files ?? []);
		formError = null;
	}

	function removeFile(index: number) {
		selectedFiles = selectedFiles.filter((_, i) => i !== index);
	}

	function start() {
		onenter();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.defaultPrevented) return;
		const target = event.target as HTMLElement | null;
		if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
		const isBack =
			event.key === 'Backspace' ||
			event.key === 'BrowserBack' ||
			(event.key === 'Escape' && step !== 'loading') ||
			(event.altKey && event.key === 'ArrowLeft');
		if (!isBack) return;
		if (
			step === 'welcome' ||
			step === 'source' ||
			step === 'ready' ||
			(step === 'loading' && errorMessage)
		) {
			event.preventDefault();
			back();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div
	class="relative flex flex-1 items-center justify-center overflow-hidden bg-background p-4 sm:p-6"
>
	<div class="pointer-events-none absolute inset-0" aria-hidden="true">
		<div class="absolute -top-40 left-1/4 size-[26rem] rounded-full bg-primary/10 blur-3xl"></div>
		<div
			class="absolute -right-24 -bottom-48 size-[30rem] rounded-full bg-primary/5 blur-3xl"
		></div>
	</div>

	<div
		class="relative flex h-[min(660px,calc(100vh-3.75rem))] w-full max-w-5xl overflow-hidden rounded-2xl border border-border/70 bg-card/75 shadow-2xl backdrop-blur-md"
	>
		<SetupBrandPanel active={activeIndex} />

		<div class="flex min-w-0 flex-1 flex-col">
			<!-- mobile brand header -->
			<div class="flex items-center gap-2.5 border-b border-border/60 px-5 py-3 md:hidden">
				<img src="/assets/logo.png" alt="" class="h-7 w-7 object-contain" />
				<div class="min-w-0">
					<div class="text-sm leading-tight font-semibold">ZeltaTV</div>
					<div class="truncate text-[10px] text-muted-foreground">{t('setup.tagline')}</div>
				</div>
			</div>

			<div bind:this={contentEl} class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
				<div class="mb-4 flex items-center gap-1.5 md:hidden" aria-hidden="true">
					{#each [0, 1, 2] as index (index)}
						<div
							class="h-1 flex-1 rounded-full {index <= activeIndex ? 'bg-primary' : 'bg-border'}"
						></div>
					{/each}
				</div>

				{#if step === 'language'}
					<div class="flex min-h-full flex-col">
						<div class="max-w-xl">
							<p class="text-[10px] font-semibold tracking-[0.24em] text-primary uppercase">
								{t('setup.wizard.eyebrow')}
							</p>
							<h1 class="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
								{t('setup.wizard.languageTitle')}
							</h1>
							<p class="mt-3 text-sm leading-relaxed text-muted-foreground">
								{t('setup.wizard.languageBody')}
							</p>
						</div>

						<div class="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
							{#each availableLocales as item (item.code)}
								<button
									type="button"
									onclick={() => chooseLocale(item.code)}
									aria-pressed={chosenLocale === item.code}
									data-locale={item.code}
									data-step-focus={chosenLocale === item.code ? '' : undefined}
									data-tv-focus-initial={chosenLocale === item.code ? '' : undefined}
									class="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors {chosenLocale ===
									item.code
										? 'border-primary bg-primary/10 text-foreground'
										: 'border-border/70 bg-background/30 text-muted-foreground hover:border-border hover:bg-muted/30'}"
								>
									<span class="text-base leading-none">{item.flag}</span>
									<span class="min-w-0 flex-1 truncate font-medium">{localeNames[item.code]}</span>
									{#if chosenLocale === item.code}
										<i class="ri-check-line shrink-0 text-primary"></i>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{:else if step === 'welcome'}
					<div class="flex min-h-full flex-col">
						<div class="max-w-xl">
							<p class="text-[10px] font-semibold tracking-[0.24em] text-primary uppercase">
								{t('setup.wizard.eyebrow')}
							</p>
							<h1 class="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
								{t('setup.wizard.welcomeTitle')}
							</h1>
							<p class="mt-3 text-sm leading-relaxed text-muted-foreground">
								{t('setup.wizard.welcomeBody')}
							</p>
						</div>

						<div class="mt-7 grid gap-2.5 sm:grid-cols-3">
							{#each features as feature (feature.title)}
								<div class="rounded-xl border border-border/60 bg-background/35 p-3.5">
									<div class="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
										<i class="{feature.icon} text-base"></i>
									</div>
									<div class="mt-2.5 text-sm font-medium">{t(feature.title)}</div>
									<p class="mt-1 text-[11px] leading-relaxed text-muted-foreground">
										{t(feature.body)}
									</p>
								</div>
							{/each}
						</div>

						<div class="mt-auto pt-6">
							<div
								class="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-3 text-xs text-muted-foreground"
							>
								<i class="ri-remote-control-line mt-0.5 text-sm text-primary"></i>
								<span>{t('setup.wizard.welcomeNote')}</span>
							</div>
						</div>
					</div>
				{:else if step === 'source'}
					<div class="max-w-xl">
						<h2 class="text-xl font-semibold tracking-tight sm:text-2xl">
							{t('setup.wizard.sourceTitle')}
						</h2>
						<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
							{t('setup.wizard.sourceBody')}
						</p>
					</div>

					<div class="mt-5 grid grid-cols-3 gap-2">
						{#each modes as item (item.id)}
							<button
								type="button"
								onclick={() => selectMode(item.id)}
								aria-pressed={mode === item.id}
								class="flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors {mode ===
								item.id
									? 'border-primary bg-primary/10 text-foreground'
									: 'border-border/70 bg-background/30 text-muted-foreground hover:border-border hover:bg-muted/30'}"
							>
								<i
									class="{item.icon} text-lg {mode === item.id
										? 'text-primary'
										: 'text-muted-foreground'}"
								></i>
								{t(item.label)}
							</button>
						{/each}
					</div>

					{#if mode === 'url'}
						<div class="mt-5 space-y-2.5">
							<label
								for="setup-url"
								class="block text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
							>
								{t('setup.wizard.urlLabel')}
							</label>
							<Input
								id="setup-url"
								bind:value={url}
								type="url"
								placeholder={t('setup.urlPlaceholder')}
								aria-label={t('setup.urlAriaLabel')}
								class="h-10"
								data-step-focus={mode === 'url' ? '' : undefined}
								oninput={() => (formError = null)}
							/>
							<Input
								bind:value={alias}
								placeholder={t('setup.aliasPlaceholder')}
								aria-label={t('setup.aliasAriaLabel')}
								class="h-10"
							/>
							<p class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
								<i class="ri-information-line"></i>
								{t('setup.wizard.urlHint')}
							</p>
						</div>
					{:else if mode === 'file'}
						<div class="mt-5">
							<button
								type="button"
								onclick={() => fileInputEl?.click()}
								data-step-focus={mode === 'file' ? '' : undefined}
								class="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-background/30 px-6 py-7 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
							>
								<i class="ri-upload-cloud-2-line text-3xl text-primary"></i>
								<span class="text-sm font-medium">{t('setup.chooseFile')}</span>
								<span class="text-[11px] text-muted-foreground">
									{t('setup.supportedFormats')}
								</span>
							</button>
							<input
								bind:this={fileInputEl}
								type="file"
								accept=".m3u,.m3u8,.txt"
								multiple
								class="hidden"
								onchange={onFileChange}
							/>
							{#if selectedFiles.length > 0}
								<div class="mt-3 flex flex-wrap gap-1.5">
									{#each selectedFiles as file, index (file.name + index)}
										<span
											class="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-background/40 px-2 py-1 text-[11px]"
										>
											<i class="ri-file-text-line text-primary"></i>
											<span class="truncate">{file.name}</span>
											<button
												type="button"
												class="text-muted-foreground transition-colors hover:text-foreground"
												onclick={() => removeFile(index)}
												aria-label={t('setup.cancel')}
											>
												<i class="ri-close-line"></i>
											</button>
										</span>
									{/each}
								</div>
							{/if}
						</div>
					{:else}
						<div class="mt-5">
							<SetupLibrary bind:selectedId={selectedLibraryId} onquickstart={quickStart} />
						</div>
					{/if}

					{#if mode !== 'library'}
						<div class="mt-4 grid gap-2.5 sm:grid-cols-2">
							<div>
								<label
									for="setup-category"
									class="mb-1.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
								>
									{t('setup.wizard.categoryLabel')}
								</label>
								<div class="relative">
									<select
										id="setup-category"
										bind:value={categoryId}
										class="h-10 w-full appearance-none rounded-md border border-input bg-transparent pr-9 pl-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
									>
										<option value="">{t('setup.wizard.categoryNone')}</option>
										{#each library.categories as category (category.id)}
											<option value={category.id}>{category.name}</option>
										{/each}
									</select>
									<i
										class="ri-arrow-down-s-line pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
									></i>
								</div>
							</div>
							<label
								class="flex cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-background/30 p-2.5"
							>
								<Checkbox bind:checked={saveToLibrary} class="mt-0.5" />
								<span class="min-w-0">
									<span class="block text-sm font-medium">
										{t('setup.wizard.saveToLibrary')}
									</span>
									<span class="block text-[11px] leading-snug text-muted-foreground">
										{t('setup.wizard.saveToLibraryHint')}
									</span>
								</span>
							</label>
						</div>
					{/if}

					{#if formError}
						<p class="mt-3 flex items-center gap-1.5 text-xs text-destructive">
							<i class="ri-error-warning-line"></i>
							{formError}
						</p>
					{/if}
				{:else if step === 'ready'}
					<div class="max-w-xl">
						<h2 class="text-xl font-semibold tracking-tight sm:text-2xl">
							{t('setup.wizard.readyTitle')}
						</h2>
						<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
							{t('setup.wizard.readyBody')}
						</p>
					</div>

					<div class="mt-5 overflow-hidden rounded-xl border border-border/70 bg-background/30">
						<div
							class="flex items-center gap-2 border-b border-border/60 px-4 py-2.5 text-sm font-medium"
						>
							<i class="ri-file-list-3-line text-primary"></i>
							{t('setup.wizard.summaryTitle')}
						</div>
						<dl class="divide-y divide-border/50 text-sm">
							<div class="flex gap-3 px-4 py-2.5">
								<dt class="w-32 shrink-0 text-xs text-muted-foreground">
									{t('setup.wizard.summaryType')}
								</dt>
								<dd class="min-w-0 truncate">{summaryType}</dd>
							</div>
							<div class="flex gap-3 px-4 py-2.5">
								<dt class="w-32 shrink-0 text-xs text-muted-foreground">
									{t('setup.wizard.summaryName')}
								</dt>
								<dd class="min-w-0 truncate">{summaryName}</dd>
							</div>
							<div class="flex gap-3 px-4 py-2.5">
								<dt class="w-32 shrink-0 text-xs text-muted-foreground">
									{t('setup.wizard.summaryValue')}
								</dt>
								<dd class="min-w-0 truncate text-muted-foreground">{summaryValue}</dd>
							</div>
							<div class="flex gap-3 px-4 py-2.5">
								<dt class="w-32 shrink-0 text-xs text-muted-foreground">
									{t('setup.wizard.summaryCategory')}
								</dt>
								<dd class="min-w-0 truncate">{summaryCategory}</dd>
							</div>
							<div class="flex gap-3 px-4 py-2.5">
								<dt class="w-32 shrink-0 text-xs text-muted-foreground">
									{t('setup.wizard.summaryLibrary')}
								</dt>
								<dd class="min-w-0 truncate">{summaryLibrary}</dd>
							</div>
						</dl>
					</div>

					<p class="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
						<i class="ri-information-line"></i>
						{t('setup.wizard.readyHint')}
					</p>
				{:else if step === 'loading'}
					<div class="flex min-h-full flex-col items-center justify-center py-6 text-center">
						{#if errorMessage}
							<div
								class="grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive"
							>
								<i class="ri-error-warning-line text-2xl"></i>
							</div>
							<h2 class="mt-4 text-lg font-semibold">{t('setup.wizard.errorTitle')}</h2>
							<p class="mt-1 max-w-md text-sm text-muted-foreground">{errorMessage}</p>
							<Button variant="outline" class="mt-5" onclick={back} data-step-focus>
								<i class="ri-arrow-left-line"></i>
								{t('setup.wizard.retry')}
							</Button>
						{:else}
							<div class="relative grid size-16 place-items-center">
								<div
									class="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
								></div>
								<img src="/assets/logo.png" alt="" class="h-7 w-7 opacity-80" />
							</div>
							<h2 class="mt-5 text-lg font-semibold">
								{t('setup.wizard.installingTitle')}
							</h2>
							<p class="mt-1 max-w-sm text-sm text-muted-foreground">
								{t('setup.wizard.installingBody')}
							</p>
							<div class="mt-6 h-1 w-56 overflow-hidden rounded-full bg-muted">
								<div
									class="h-full w-1/2 animate-[zelta-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-primary"
								></div>
							</div>
						{/if}
					</div>
				{:else}
					<div class="flex min-h-full flex-col items-center justify-center py-6 text-center">
						<div
							class="grid size-16 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/30"
						>
							<i class="ri-check-line text-3xl"></i>
						</div>
						<p class="mt-5 text-[10px] font-semibold tracking-[0.24em] text-primary uppercase">
							{t('setup.wizard.eyebrow')}
						</p>
						<h2 class="mt-2 text-2xl font-semibold tracking-tight">
							{t('setup.wizard.finishTitle')}
						</h2>
						<p class="mt-2 text-sm text-muted-foreground">
							{t('setup.wizard.finishBody', { count: String(channelCount) })}
						</p>
						<div
							class="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground"
						>
							<i class="ri-live-line shrink-0 text-primary"></i>
							<span class="truncate">{summaryName}</span>
						</div>
					</div>
				{/if}
			</div>

			<footer
				bind:this={footerEl}
				class="flex items-center justify-between gap-2 border-t border-border/60 bg-card/40 px-4 py-3 sm:px-6"
			>
				<div class="flex items-center gap-2">
					{#if step === 'welcome' || step === 'source'}
						<Button variant="ghost" onclick={onskip} class="text-xs text-muted-foreground">
							{t('setup.wizard.skip')}
						</Button>
					{/if}
					{#if step === 'source' || step === 'ready' || (step === 'loading' && errorMessage)}
						<Button variant="ghost" onclick={back}>
							<i class="ri-arrow-left-line"></i>
							{t('setup.wizard.back')}
						</Button>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					{#if step === 'loading'}
						<span class="flex items-center gap-2 px-1 text-xs text-muted-foreground">
							<i class="ri-loader-4-line animate-spin text-primary"></i>
							{errorMessage ? t('setup.wizard.errorTitle') : t('setup.loading')}
						</span>
					{:else if step === 'finish'}
						<Button variant="ghost" onclick={backToLibrary}>
							{t('setup.wizard.backToLibrary')}
						</Button>
						<Button onclick={start} data-primary-action data-tv-focus-initial>
							{t('setup.wizard.start')}
							<i class="ri-arrow-right-line"></i>
						</Button>
					{:else}
						<Button
							onclick={advance}
							data-primary-action
							data-tv-focus-initial={step === 'welcome' ? '' : undefined}
						>
							{#if step === 'ready'}
								<i class="ri-download-2-line"></i>
								{t('setup.wizard.install')}
							{:else if step === 'language'}
								{t('setup.wizard.languageContinue')}
								<i class="ri-arrow-right-line"></i>
							{:else}
								{t('setup.wizard.next')}
								<i class="ri-arrow-right-line"></i>
							{/if}
						</Button>
					{/if}
				</div>
			</footer>
		</div>
	</div>
</div>

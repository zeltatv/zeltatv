<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Kbd, KbdGroup } from '$lib/components/ui/kbd';
	import { Switch } from '$lib/components/ui/switch';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import { goto, afterNavigate } from '$app/navigation';
	import { defaultShortcutGroups } from '$lib/shortcuts/shortcuts';
	import {
		getShortcutKeys,
		isShortcutCustom,
		setShortcutOverride,
		resetShortcut,
		resetAllShortcuts
	} from '$lib/shortcuts/store.svelte';
	import { eventToCombo } from '$lib/shortcuts/matcher';
	import { usePlayerPrefs, setHighestQuality } from '$lib/player/prefs.svelte';
	import { t, getLocale, setLocale, type Locale, availableLocales } from '$lib/i18n/store.svelte';
	import AboutPanel from '../../components/AboutPanel.svelte';
	import {
		THEME_PRESETS,
		setThemePreset,
		getThemeBg,
		setThemeBg,
		resetTheme,
		getSkin,
		setSkin,
		DEFAULT_BG
	} from '$lib/theme/store.svelte';
	import { SKINS, isEnhancedSkin } from '$lib/theme/skins';
	import { resetLibrary } from '$lib/iptv/library.svelte';

	// open the right tab when arriving via links like /settings#theme from the menu
	const TABS = ['shortcuts', 'playback', 'language', 'theme', 'data', 'about'];
	function tabFromHash(): string | null {
		if (typeof window === 'undefined') return null;
		const hash = window.location.hash.replace('#', '');
		return TABS.includes(hash) ? hash : null;
	}
	let activeTab = $state(tabFromHash() ?? 'shortcuts');
	const enhanced = $derived(isEnhancedSkin(getSkin()));
	afterNavigate(() => {
		const fromHash = tabFromHash();
		if (fromHash) activeTab = fromHash;
	});
	let editingId = $state<string | null>(null);
	let conflictId = $state<string | null>(null);
	const prefs = usePlayerPrefs();

	// while editing a shortcut, keep TV navigation from treating Escape as "back"
	$effect(() => {
		if (typeof document === 'undefined') return;
		if (editingId) document.body.setAttribute('data-tv-escape-guard', '');
		else document.body.removeAttribute('data-tv-escape-guard');
	});

	function startEdit(id: string) {
		editingId = id;
		conflictId = null;
	}

	function cancelEdit() {
		editingId = null;
		conflictId = null;
	}

	function onKeydown(e: KeyboardEvent) {
		if (!document.hasFocus()) return;
		if (!editingId) return;
		e.preventDefault();
		e.stopPropagation();

		// ignore pure modifier presses
		const modKeys = ['Control', 'Shift', 'Alt', 'Meta'];
		if (modKeys.includes(e.key)) return;

		const combo = eventToCombo(e);
		if (combo.length === 0) return;

		// check for conflicts with other shortcuts (same scope only)
		let conflict: string | null = null;
		const editingScope = defaultShortcutGroups
			.flatMap((g) => g.shortcuts)
			.find((s) => s.id === editingId)?.scope;
		for (const group of defaultShortcutGroups) {
			for (const s of group.shortcuts) {
				if (s.id === editingId) continue;
				if (s.scope !== editingScope) continue;
				const existing = getShortcutKeys(s.id);
				if (existing.some((c) => c.join('+') === combo.join('+'))) {
					conflict = s.id;
					break;
				}
			}
			if (conflict) break;
		}

		if (conflict) {
			conflictId = conflict;
			return;
		}

		setShortcutOverride(editingId, [combo]);
		editingId = null;
		conflictId = null;
	}

	function resetOne(id: string) {
		resetShortcut(id);
		if (editingId === id) cancelEdit();
	}

	function resetAll() {
		resetAllShortcuts();
		cancelEdit();
	}

	function goBack() {
		goto('/');
	}

	function changeLocale(l: Locale) {
		setLocale(l);
	}

	let customBg = $state('');

	let shortcutSearch = $state('');
	let languageSearch = $state('');

	// filtered shortcuts by description text
	let filteredShortcutGroups = $derived.by(() => {
		const q = shortcutSearch.trim().toLowerCase();
		if (!q) return defaultShortcutGroups;
		return defaultShortcutGroups
			.map((g) => ({
				...g,
				shortcuts: g.shortcuts.filter((s) => t(`shortcuts.desc_${s.id}`).toLowerCase().includes(q))
			}))
			.filter((g) => g.shortcuts.length > 0);
	});

	// filtered languages by label text
	const langLabelKey: Record<Locale, string> = {
		en: 'settings.english',
		tr: 'settings.turkish',
		es: 'settings.spanish',
		fr: 'settings.french',
		de: 'settings.german',
		pt: 'settings.portuguese',
		ru: 'settings.russian',
		zh: 'settings.chinese',
		ka: 'settings.georgian',
		it: 'settings.italian',
		ja: 'settings.japanese',
		ko: 'settings.korean',
		ar: 'settings.arabic',
		hi: 'settings.hindi',
		az: 'settings.azerbaijani',
		uk: 'settings.ukrainian',
		pl: 'settings.polish',
		nl: 'settings.dutch'
	};

	let filteredLanguages = $derived.by(() => {
		const all = availableLocales.map((l) => ({
			code: l.code,
			label: t(langLabelKey[l.code]),
			flag: l.flag
		}));
		const q = languageSearch.trim().toLowerCase();
		if (!q) return all;
		return all.filter((l) => l.label.toLowerCase().includes(q));
	});

	function onCustomColor(e: Event) {
		const hex = (e.target as HTMLInputElement).value;
		customBg = hex;
		setThemeBg(hex);
	}

	function isPresetActive(presetBg: string): boolean {
		return getThemeBg().toLowerCase() === presetBg.toLowerCase();
	}

	function isCustomTheme(): boolean {
		return !THEME_PRESETS.some((p) => p.bg.toLowerCase() === getThemeBg().toLowerCase());
	}

	function onResetTheme() {
		customBg = '';
		resetTheme();
	}

	const customCount = $derived(
		defaultShortcutGroups.flatMap((g) => g.shortcuts).filter((s) => isShortcutCustom(s.id)).length
	);

	async function resetAppData() {
		if (typeof localStorage !== 'undefined') {
			for (const key of Object.keys(localStorage)) {
				if (key.startsWith('zeltatv:')) localStorage.removeItem(key);
			}
		}
		await resetLibrary();
		const api = (
			globalThis as unknown as { electronAPI?: { clearLogoCache?: () => Promise<void> } }
		).electronAPI;
		await api?.clearLogoCache?.();
		// go back to the root URL: start fresh instead of staying on the settings page
		location.href = '/';
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex flex-1 flex-col overflow-hidden">
	<!-- header -->
	<div class="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
		<Button
			variant="ghost"
			size="icon"
			data-tv-focus-initial
			onclick={goBack}
			aria-label={t('settings.goBack')}
		>
			<i class="ri-arrow-left-line text-base"></i>
		</Button>
		<h1 class="text-sm font-semibold tracking-tight">{t('settings.goBack')}</h1>
	</div>

	<!-- tabbed content -->
	<Tabs
		bind:value={activeTab}
		orientation={enhanced ? 'vertical' : 'horizontal'}
		class="flex flex-1 overflow-hidden {enhanced ? 'flex-row gap-0' : 'flex-col'}"
	>
		<div
			class={enhanced
				? 'w-56 shrink-0 border-r border-border bg-card/30 p-2'
				: 'shrink-0 border-b border-border px-3'}
		>
			{#if enhanced}
				<p
					class="px-3 pt-2 pb-3 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
				>
					{t('settings.title')}
				</p>
			{/if}
			<TabsList variant="line" class={enhanced ? 'w-full flex-col items-stretch gap-0.5' : ''}>
				<TabsTrigger value="shortcuts">
					<i class="ri-keyboard-line text-sm"></i>
					{t('settings.shortcuts')}
				</TabsTrigger>
				<TabsTrigger value="playback">
					<i class="ri-play-circle-line text-sm"></i>
					{t('settings.playback')}
				</TabsTrigger>
				<TabsTrigger value="language">
					<i class="ri-translate-2 text-sm"></i>
					{t('settings.language')}
				</TabsTrigger>
				<TabsTrigger value="theme">
					<i class="ri-palette-line text-sm"></i>
					{t('settings.theme')}
				</TabsTrigger>
				<TabsTrigger value="data">
					<i class="ri-database-2-line text-sm"></i>
					{t('settings.data')}
				</TabsTrigger>
				<TabsTrigger value="about">
					<i class="ri-information-line text-sm"></i>
					{t('settings.about')}
				</TabsTrigger>
			</TabsList>
		</div>

		<!-- shortcuts tab -->
		<TabsContent value="shortcuts" class="flex-1 overflow-y-auto">
			<div class="mx-auto max-w-2xl px-6 py-5">
				<div class="mb-4 flex items-center justify-between">
					{#if customCount > 0}
						<span class="text-xs font-medium text-muted-foreground tabular-nums">
							{customCount}
							{t('settings.customized')}
						</span>
					{:else}
						<span></span>
					{/if}
					<Button variant="outline" onclick={resetAll} disabled={customCount === 0}>
						<i class="ri-refresh-line text-sm"></i>
						{t('settings.resetAll')}
					</Button>
				</div>
				<div class="mb-3">
					<div class="relative">
						<i
							class="ri-search-line pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
						></i>
						<Input
							bind:value={shortcutSearch}
							placeholder={t('settings.searchShortcuts')}
							class="pl-9"
							aria-label={t('settings.searchShortcuts')}
						/>
					</div>
				</div>

				{#each filteredShortcutGroups as group (group.id)}
					<div class="mb-5">
						<p
							class="mb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
						>
							{t(`shortcuts.group_${group.id}`)}
						</p>
						<div
							class="flex flex-col divide-y divide-border rounded-lg border border-border bg-card"
						>
							{#each group.shortcuts as s (s.id)}
								{@const custom = isShortcutCustom(s.id)}
								{@const editing = editingId === s.id}
								<div
									class="flex items-center justify-between gap-4 px-3 py-2 {editing
										? 'bg-muted'
										: 'hover:bg-muted/50'}"
								>
									<div class="flex items-center gap-2.5">
										<span class="text-sm font-medium">{t(`shortcuts.desc_${s.id}`)}</span>
										{#if custom}
											<span class="text-xs text-amber-500 dark:text-amber-400"
												>{t('settings.modified')}</span
											>
										{/if}
									</div>

									<div class="flex items-center gap-2">
										{#if editing}
											{#if conflictId}
												<span class="text-xs text-destructive">
													{t('settings.conflictsWith', { name: t(`shortcuts.desc_${conflictId}`) })}
												</span>
											{/if}
											<span class="animate-pulse text-xs font-medium text-muted-foreground">
												{t('settings.pressKeys')}
											</span>
											<Button
												variant="ghost"
												size="icon"
												onclick={cancelEdit}
												aria-label={t('settings.cancel')}
											>
												<i class="ri-close-line text-sm"></i>
											</Button>
										{:else}
											<div class="flex items-center gap-1.5">
												{#each getShortcutKeys(s.id) as combo, i (i)}
													{#if i > 0}
														<span class="text-xs text-muted-foreground">/</span>
													{/if}
													<KbdGroup>
														{#each combo as key, j (j)}
															{#if j > 0}
																<span class="text-xs text-muted-foreground">+</span>
															{/if}
															<Kbd>{key}</Kbd>
														{/each}
													</KbdGroup>
												{/each}
											</div>
											<Button
												variant="ghost"
												size="icon"
												onclick={() => startEdit(s.id)}
												aria-label={t('settings.editShortcut')}
											>
												<i class="ri-edit-line text-sm"></i>
											</Button>
											{#if custom}
												<Button
													variant="ghost"
													size="icon"
													onclick={() => resetOne(s.id)}
													aria-label={t('settings.resetToDefault')}
												>
													<i class="ri-refresh-line text-sm"></i>
												</Button>
											{/if}
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</TabsContent>

		<!-- playback tab -->
		<TabsContent value="playback" class="flex-1 overflow-y-auto">
			<div class="mx-auto max-w-2xl px-6 py-5">
				<div
					class="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
				>
					<div class="flex flex-col gap-0.5">
						<span class="text-sm font-medium">{t('settings.highestQuality')}</span>
						<span class="text-xs text-muted-foreground">{t('settings.highestQualityHint')}</span>
					</div>
					<Switch
						bind:checked={() => prefs.highestQuality, (value) => setHighestQuality(value)}
						aria-label={t('settings.highestQuality')}
					/>
				</div>
			</div>
		</TabsContent>

		<!-- language tab -->
		<TabsContent value="language" class="flex-1 overflow-y-auto">
			<div class="mx-auto max-w-2xl px-6 py-5">
				<div class="mb-3">
					<div class="relative">
						<i
							class="ri-search-line pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
						></i>
						<Input
							bind:value={languageSearch}
							placeholder={t('settings.searchLanguages')}
							class="pl-9"
							aria-label={t('settings.searchLanguages')}
						/>
					</div>
				</div>
				<div class="flex flex-col divide-y divide-border rounded-lg border border-border">
					{#each filteredLanguages as lang (lang.code)}
						{@const active = getLocale() === lang.code}
						<button
							onclick={() => changeLocale(lang.code)}
							class="flex items-center gap-3 px-4 py-3 text-left transition-colors {active
								? 'bg-muted'
								: 'hover:bg-muted/50'}"
						>
							<span class="text-lg">{lang.flag}</span>
							<span class="text-sm font-medium">{lang.label}</span>
							{#if active}
								<i class="ri-check-line ml-auto text-base text-foreground"></i>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		</TabsContent>

		<!-- theme tab -->
		<TabsContent value="theme" class="flex-1 overflow-y-auto">
			<div class="mx-auto max-w-2xl px-6 py-5">
				<div class="mb-4 flex items-center justify-between">
					<span></span>
					{#if getThemeBg().toLowerCase() !== DEFAULT_BG.toLowerCase()}
						<Button variant="outline" onclick={onResetTheme}>
							<i class="ri-refresh-line text-sm"></i>
							{t('settings.resetTheme')}
						</Button>
					{/if}
				</div>

				<!-- skin selection -->
				<div class="mb-6">
					<div class="mb-2 flex items-center gap-2">
						<i class="ri-tv-line text-sm text-muted-foreground"></i>
						<span class="text-sm font-medium">{t('settings.skin')}</span>
					</div>
					<div class="grid grid-cols-2 gap-3">
						{#each SKINS as s (s.id)}
							{@const active = getSkin() === s.id}
							{@const label = t(s.labelKey)}
							{@const cut = label.lastIndexOf(' ')}
							<button
								type="button"
								onclick={() => setSkin(s.id)}
								class="flex flex-col items-start gap-1 rounded-md border border-border p-3 text-left transition-colors {active
									? 'bg-muted ring-1 ring-ring/40'
									: 'hover:bg-muted/50'}"
							>
								<span class="flex w-full items-center justify-between gap-2">
									<span class="text-sm font-semibold">
										{#if cut > 0}
											{label.slice(0, cut)}
											<span
												class={s.id === 'zeltatv'
													? 'text-amber-500 dark:text-amber-400'
													: 'text-cyan-600 dark:text-[#2ee6f6]'}>{label.slice(cut + 1)}</span
											>
										{:else}
											{label}
										{/if}
									</span>
									{#if active}
										<i class="ri-check-line text-sm text-primary"></i>
									{/if}
								</span>
								<span class="text-xs text-muted-foreground">{t(s.hintKey)}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- preset colors -->
				<div class="mb-6 grid grid-cols-3 gap-3">
					{#each THEME_PRESETS as preset (preset.id)}
						{@const active = isPresetActive(preset.bg)}
						<button
							onclick={() => {
								customBg = '';
								setThemePreset(preset);
							}}
							class="flex flex-col items-center gap-2 rounded-lg border border-border p-3 transition-colors {active
								? 'bg-muted ring-1 ring-ring/30'
								: 'hover:bg-muted/50'}"
						>
							<div
								class="relative size-10 rounded-full border border-border"
								style="background: {preset.bg}"
							>
								{#if preset.accent}
									<span
										class="absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-card"
										style="background: {preset.accent}"
									></span>
								{/if}
							</div>
							<span class="text-xs font-medium">{t(`settings.themePreset_${preset.id}`)}</span>
						</button>
					{/each}
				</div>

				<!-- custom color picker -->
				<div class="rounded-lg border border-border p-4">
					<div class="mb-3 flex items-center gap-2">
						<i class="ri-contrast-2-line text-sm text-muted-foreground"></i>
						<span class="text-sm font-medium">{t('settings.themeCustom')}</span>
						{#if isCustomTheme()}
							<span class="ml-auto text-xs text-amber-500 dark:text-amber-400"
								>{t('settings.customized')}</span
							>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						<input
							type="color"
							value={customBg || getThemeBg()}
							oninput={onCustomColor}
							class="size-12 cursor-pointer rounded-lg border border-border bg-transparent"
							aria-label={t('settings.themeCustom')}
						/>
						<div class="flex flex-col gap-0.5">
							<span class="text-xs text-muted-foreground">{customBg || getThemeBg()}</span>
							<span class="text-xs text-muted-foreground">{t('settings.themeCustomHint')}</span>
						</div>
					</div>
				</div>
			</div>
		</TabsContent>

		<!-- data tab -->
		<TabsContent value="data" class="flex-1 overflow-y-auto">
			<div class="mx-auto max-w-2xl px-6 py-5">
				<div class="rounded-lg border border-destructive/30 p-5">
					<div class="mb-3 flex items-center gap-2">
						<i class="ri-error-warning-line text-lg text-destructive"></i>
						<span class="text-sm font-semibold">{t('settings.resetDefaults')}</span>
					</div>
					<p class="mb-4 text-sm text-muted-foreground">{t('settings.resetDefaultsDescription')}</p>
					<Button
						variant="destructive"
						onclick={() => {
							if (confirm(t('settings.resetDefaultsConfirm'))) resetAppData();
						}}
					>
						<i class="ri-refresh-line text-sm"></i>
						{t('settings.resetDefaults')}
					</Button>
				</div>
			</div>
		</TabsContent>

		<!-- about tab -->
		<TabsContent value="about" class="flex-1 overflow-y-auto">
			<AboutPanel />
		</TabsContent>
	</Tabs>
</div>

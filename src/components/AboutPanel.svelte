<script lang="ts">
	// About panel: version, license, platform and links
	import { t } from '$lib/i18n/store.svelte';
	import { getSkin } from '$lib/theme/store.svelte';

	const REPO = 'https://github.com/zeltatv/zeltatv';
	const version = __APP_VERSION__;
	const license = __APP_LICENSE__ || 'GPL-3.0';

	const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
	const electron = /Electron\/([\d.]+)/.exec(ua)?.[1];
	const chrome = /Chrome\/([\d.]+)/.exec(ua)?.[1];
	const platform = /Windows/.test(ua)
		? 'Windows'
		: /Macintosh|Mac OS/.test(ua)
			? 'macOS'
			: /Linux/.test(ua)
				? 'Linux'
				: '';

	const appearance = $derived(
		getSkin() === 'enhanced' ? t('settings.skinEnhanced') : t('settings.skinZeltatv')
	);

	const info = $derived([
		{ icon: 'ri-information-line', label: t('about.version'), value: `v${version}` },
		{ icon: 'ri-scales-3-line', label: t('about.license'), value: license },
		{
			icon: 'ri-computer-line',
			label: t('about.platform'),
			value: [platform, electron ? `Electron ${electron}` : chrome ? `Chrome ${chrome}` : '']
				.filter(Boolean)
				.join(' · ')
		},
		{ icon: 'ri-palette-line', label: t('about.appearance'), value: appearance }
	]);

	const links = [
		{ icon: 'ri-github-fill', label: t('about.repo'), href: REPO },
		{ icon: 'ri-git-branch-line', label: t('about.releases'), href: `${REPO}/releases` },
		{ icon: 'ri-bug-line', label: t('about.issues'), href: `${REPO}/issues` }
	];

	const tech = ['Svelte 5', 'Electron', 'hls.js', 'Tailwind CSS', 'bits-ui'];
</script>

<div class="mx-auto max-w-2xl px-6 py-5">
	<div class="flex items-center gap-4 rounded-xl border border-border/70 bg-card/40 p-5">
		<img src="/assets/logo.png" alt="ZeltaTV" class="size-14 shrink-0 object-contain" />
		<div class="min-w-0">
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-xl font-semibold tracking-tight">ZeltaTV</span>
				<span
					class="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-primary uppercase"
				>
					v{version}
				</span>
			</div>
			<p class="mt-1 text-xs text-muted-foreground">{t('about.tagline')}</p>
		</div>
	</div>

	<div class="mt-4 grid grid-cols-2 gap-3">
		{#each info as item (item.label)}
			<div class="rounded-lg border border-border/70 bg-card/30 p-3">
				<div class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
					<i class="{item.icon} text-xs"></i>
					<span>{item.label}</span>
				</div>
				<p class="mt-1 truncate text-sm font-semibold" title={item.value}>{item.value}</p>
			</div>
		{/each}
	</div>

	<div class="mt-5">
		<div class="mb-2 flex items-center gap-2">
			<i class="ri-link text-sm text-muted-foreground"></i>
			<span class="text-sm font-medium">{t('about.links')}</span>
		</div>
		<div
			class="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border"
		>
			{#each links as link (link.href)}
				<a
					href={link.href}
					target="_blank"
					rel="noreferrer"
					class="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
				>
					<i class="{link.icon} text-base text-muted-foreground"></i>
					<span class="font-medium">{link.label}</span>
					<i class="ri-arrow-right-up-line ml-auto text-sm text-muted-foreground"></i>
				</a>
			{/each}
		</div>
	</div>

	<div class="mt-5">
		<div class="mb-2 flex items-center gap-2">
			<i class="ri-code-s-slash-line text-sm text-muted-foreground"></i>
			<span class="text-sm font-medium">{t('about.tech')}</span>
		</div>
		<div class="flex flex-wrap gap-2">
			{#each tech as name (name)}
				<span
					class="rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium text-muted-foreground"
				>
					{name}
				</span>
			{/each}
		</div>
	</div>

	<p class="mt-6 text-center text-[11px] text-muted-foreground">
		{t('about.footer')}
	</p>
</div>

<script lang="ts">
	import { t } from '$lib/i18n/store.svelte';

	let { active = 0 }: { active: number } = $props();

	const steps = $derived([
		t('setup.wizard.stepSource'),
		t('setup.wizard.stepSummary'),
		t('setup.wizard.stepStart')
	]);
</script>

<aside
	class="relative hidden w-[268px] shrink-0 flex-col justify-between overflow-hidden border-r border-border/60 p-6 md:flex"
	style="background:
		radial-gradient(120% 70% at 15% 0%, color-mix(in srgb, var(--primary) 20%, transparent), transparent 62%),
		linear-gradient(180deg, color-mix(in srgb, var(--primary) 7%, var(--card)), var(--card) 55%, color-mix(in srgb, #000 10%, var(--card)));"
>
	<div
		class="pointer-events-none absolute inset-0 opacity-[0.13]"
		style="background-image: linear-gradient(to right, var(--border) 1px, transparent 1px),
			linear-gradient(to bottom, var(--border) 1px, transparent 1px);
			background-size: 26px 26px;
			mask-image: linear-gradient(to bottom, #000 0%, transparent 78%);"
	></div>

	<div class="relative">
		<div class="flex items-center gap-2.5">
			<img
				src="/assets/logo.png"
				alt=""
				class="h-9 w-9 object-contain drop-shadow-[0_0_14px_color-mix(in_srgb,var(--primary)_55%,transparent)]"
			/>
			<div class="min-w-0">
				<div class="text-lg leading-tight font-semibold tracking-tight">ZeltaTV</div>
				<div class="text-[9px] font-semibold tracking-[0.24em] text-primary/85 uppercase">
					IPTV Player
				</div>
			</div>
		</div>
		<div class="mt-4 h-1 w-10 rounded-full bg-primary"></div>
		<p class="mt-4 text-xs leading-relaxed text-muted-foreground">
			{t('setup.tagline')}
		</p>

		<svg viewBox="0 0 240 190" fill="none" class="mt-5 w-full max-w-[224px]" aria-hidden="true">
			<defs>
				<linearGradient id="setup-screen" x1="0" y1="0" x2="1" y2="1">
					<stop offset="0%" stop-color="var(--primary)" stop-opacity="0.42" />
					<stop offset="100%" stop-color="var(--primary)" stop-opacity="0.05" />
				</linearGradient>
				<linearGradient id="setup-body" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="color-mix(in srgb, var(--card) 70%, #fff 4%)" />
					<stop offset="100%" stop-color="var(--card)" />
				</linearGradient>
			</defs>

			<ellipse cx="120" cy="105" rx="96" ry="64" fill="var(--primary)" opacity="0.08" />

			<!-- signal arcs -->
			<path
				d="M196 30c9 5 15 14 15 24"
				stroke="var(--primary)"
				stroke-opacity="0.55"
				stroke-width="2"
				stroke-linecap="round"
			/>
			<path
				d="M203 21c13 8 21 20 21 34"
				stroke="var(--primary)"
				stroke-opacity="0.25"
				stroke-width="2"
				stroke-linecap="round"
			/>

			<!-- TV body -->
			<rect
				x="16"
				y="34"
				width="194"
				height="118"
				rx="14"
				fill="url(#setup-body)"
				stroke="var(--border)"
			/>
			<rect
				x="28"
				y="46"
				width="170"
				height="94"
				rx="7"
				fill="url(#setup-screen)"
				stroke="var(--primary)"
				stroke-opacity="0.28"
			/>

			<!-- play -->
			<circle cx="113" cy="93" r="22" fill="var(--primary)" opacity="0.95" />
			<path d="M106 82l19 11-19 11V82z" fill="var(--primary-foreground)" />

			<!-- channel lines -->
			<rect x="40" y="58" width="34" height="3" rx="1.5" fill="var(--primary)" opacity="0.4" />
			<rect x="40" y="66" width="22" height="3" rx="1.5" fill="var(--primary)" opacity="0.22" />

			<!-- stand -->
			<path d="M96 152h34l7 13H89l7-13z" fill="var(--card)" stroke="var(--border)" />
			<rect x="82" y="165" width="62" height="5" rx="2.5" fill="var(--border)" />

			<!-- remote -->
			<g transform="rotate(14 212 132)">
				<rect
					x="201"
					y="111"
					width="24"
					height="50"
					rx="8"
					fill="var(--card)"
					stroke="var(--border)"
				/>
				<circle cx="213" cy="123" r="5.5" fill="var(--primary)" opacity="0.85" />
				<circle cx="213" cy="140" r="2.4" fill="var(--primary)" opacity="0.5" />
				<circle cx="213" cy="149" r="2.4" fill="var(--primary)" opacity="0.35" />
			</g>
		</svg>
	</div>

	<ol class="relative mt-6 space-y-3">
		{#each steps as label, index (label)}
			{@const done = index < active}
			{@const current = index === active}
			<li class="flex items-center gap-3 text-sm">
				<span
					class="grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-colors {current
						? 'border-primary bg-primary text-primary-foreground shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_45%,transparent)]'
						: done
							? 'border-primary/40 bg-primary/10 text-primary'
							: 'border-border/80 text-muted-foreground'}"
				>
					{#if done}
						<i class="ri-check-line text-xs"></i>
					{:else}
						{index + 1}
					{/if}
				</span>
				<span
					class="font-medium {current
						? 'text-foreground'
						: done
							? 'text-muted-foreground'
							: 'text-muted-foreground/60'}">{label}</span
				>
			</li>
		{/each}
	</ol>

	<div class="relative mt-8 flex items-center justify-between text-[10px] text-muted-foreground/60">
		<span>v{__APP_VERSION__}</span>
		<span class="tracking-[0.16em] uppercase">Desktop</span>
	</div>
</aside>

<script lang="ts">
	// Large set-top-box style OSD shown while typing a channel number with the remote.
	// If a channel matches the number, its name and group are shown as well.
	import { useTvNav } from '$lib/tv/nav.svelte';
	import { usePlaylist } from '$lib/iptv/store.svelte';
	import { t } from '$lib/i18n/store.svelte';

	const nav = useTvNav();
	const playlist = usePlaylist();

	const hedef = $derived.by(() => {
		if (!nav.osdDigits) return null;
		const numara = parseInt(nav.osdDigits, 10);
		if (!Number.isFinite(numara) || numara < 1) return null;
		return playlist.channels[numara - 1] ?? null;
	});
</script>

{#if nav.osdVisible}
	<div class="pointer-events-none fixed inset-x-0 bottom-10 z-50 flex justify-center select-none">
		<div
			class="flex animate-in items-stretch gap-5 rounded-xl bg-black/90 px-7 py-4 shadow-2xl ring-1 ring-white/15 backdrop-blur-md duration-150 zoom-in-95 fade-in"
		>
			<div class="flex min-w-24 flex-col items-center justify-center">
				<span class="text-[10px] font-semibold tracking-[0.28em] text-white/45 uppercase">
					{t('osd.channel')}
				</span>
				<span
					class="text-6xl leading-none font-bold tracking-[0.06em] tabular-nums"
					style="color: var(--tv-focus)"
				>
					{nav.osdDigits}
				</span>
			</div>
			<div class="flex min-w-44 flex-col justify-center border-l border-white/15 pl-5">
				{#if hedef}
					<span class="max-w-64 truncate text-lg leading-tight font-semibold text-white">
						{hedef.name}
					</span>
					{#if hedef.group}
						<span class="text-xs text-white/55">{hedef.group}</span>
					{/if}
				{:else}
					<span class="text-sm text-white/55">{t('osd.notFound')}</span>
				{/if}
			</div>
		</div>
	</div>
{/if}

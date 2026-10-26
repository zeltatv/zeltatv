<script lang="ts">
	// Channel logo: when there is no logo or it fails to load, build a theme-matched
	// placeholder from the channel name initials (same channel always gets the same hue).
	import { logoUrl } from '$lib/iptv/logo-cache';

	let {
		name,
		logo,
		size = 'size-6',
		rounded = 'rounded-sm'
	}: {
		name: string;
		logo?: string | null;
		size?: string;
		rounded?: string;
	} = $props();

	let failed = $state(false);

	// retry when the logo changes
	$effect(() => {
		void logo;
		failed = false;
	});

	const initials = $derived.by(() => {
		const words = name.trim().split(/\s+/).filter(Boolean);
		if (words.length === 0) return '?';
		if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
		return (words[0][0] + words[1][0]).toUpperCase();
	});

	// stable shade per name: 8% / 12% / 16% / 20%
	const shade = $derived.by(() => {
		let hash = 0;
		for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 1000;
		return 8 + (hash % 4) * 4;
	});
</script>

{#if logo && !failed}
	<img
		src={logoUrl(logo)}
		alt=""
		class="{size} {rounded} shrink-0 object-cover"
		loading="lazy"
		onerror={() => (failed = true)}
	/>
{:else}
	<div
		class="flex {size} {rounded} shrink-0 items-center justify-center text-[10px] font-semibold tracking-wide text-foreground/75 uppercase"
		style="background: color-mix(in srgb, var(--primary) {shade}%, var(--muted))"
		aria-hidden="true"
	>
		{initials}
	</div>
{/if}

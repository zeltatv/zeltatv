<script lang="ts">
	import type { Channel } from '$lib/iptv/types';
	import { cn } from '$lib/utils';

	let {
		channel,
		active = false,
		onclick
	}: { channel: Channel; active?: boolean; onclick?: () => void } = $props();
	let logoError = $state(false);
</script>

<button
	{onclick}
	class={cn(
		'flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors',
		active
			? 'bg-accent text-foreground'
			: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
	)}
>
	{#if channel.logo && !logoError}
		<img
			src={channel.logo}
			alt=""
			class="size-6 shrink-0 rounded-sm object-cover"
			onerror={() => (logoError = true)}
		/>
	{:else}
		<div class="flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted">
			<i class="ri-tv-line text-xs text-muted-foreground"></i>
		</div>
	{/if}
	<span class="truncate font-medium">{channel.name}</span>
</button>

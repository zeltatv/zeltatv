<script lang="ts" generics="T">
	let {
		items,
		itemHeight = 40,
		buffer = 8,
		scrollToIndex = -1,
		renderItem
	}: {
		items: T[];
		itemHeight?: number;
		buffer?: number;
		scrollToIndex?: number;
		renderItem: (item: T, index: number) => any;
	} = $props();

	let scrollTop = $state(0);
	let viewportHeight = $state(600);
	let viewportEl = $state<HTMLDivElement | null>(null);
	let rafId = 0;

	let totalHeight = $derived(items.length * itemHeight);

	let visibleStart = $derived(Math.max(0, Math.floor(scrollTop / itemHeight) - buffer));
	let visibleEnd = $derived(
		Math.min(items.length, Math.ceil((scrollTop + viewportHeight) / itemHeight) + buffer)
	);

	let visibleItems = $derived(items.slice(visibleStart, visibleEnd));
	let offsetY = $derived(visibleStart * itemHeight);

	// throttle scroll with raf to avoid excessive re-renders
	function onScroll(e: Event) {
		const target = e.target as HTMLDivElement;
		if (rafId) return;
		rafId = requestAnimationFrame(() => {
			scrollTop = target.scrollTop;
			rafId = 0;
		});
	}

	let resizeObserver: ResizeObserver | null = null;

	$effect(() => {
		if (!viewportEl) return;
		viewportHeight = viewportEl.clientHeight;
		resizeObserver = new ResizeObserver(() => {
			viewportHeight = viewportEl?.clientHeight ?? 0;
		});
		resizeObserver.observe(viewportEl);
		return () => {
			resizeObserver?.disconnect();
			if (rafId) cancelAnimationFrame(rafId);
		};
	});

	// scroll to keep focused index in view
	$effect(() => {
		const idx = scrollToIndex;
		const el = viewportEl;
		if (idx < 0 || !el) return;
		const itemTop = idx * itemHeight;
		const itemBottom = itemTop + itemHeight;
		const viewTop = el.scrollTop;
		const viewBottom = viewTop + el.clientHeight;
		if (itemTop < viewTop) {
			el.scrollTop = itemTop;
			scrollTop = itemTop;
		} else if (itemBottom > viewBottom) {
			const newTop = itemBottom - el.clientHeight;
			el.scrollTop = newTop;
			scrollTop = newTop;
		}
	});
</script>

<div
	bind:this={viewportEl}
	onscroll={onScroll}
	class="relative overflow-y-auto overscroll-contain"
	style="height: 100%; contain: strict;"
>
	<div style="height: {totalHeight}px; position: relative;">
		<div style="transform: translateY({offsetY}px); will-change: transform;">
			{#each visibleItems as item, i (visibleStart + i)}
				<div style="height: {itemHeight}px; contain: content;">
					{@render renderItem(item, visibleStart + i)}
				</div>
			{/each}
		</div>
	</div>
</div>

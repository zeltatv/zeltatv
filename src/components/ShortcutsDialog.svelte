<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import { Kbd, KbdGroup } from '$lib/components/ui/kbd';
	import { defaultShortcutGroups } from '$lib/shortcuts/shortcuts';
	import { getShortcutKeys, isShortcutCustom } from '$lib/shortcuts/store.svelte';
	import { t } from '$lib/i18n/store.svelte';

	let { open = $bindable(false) } = $props();
</script>

<Dialog bind:open>
	<DialogContent class="max-h-[calc(100dvh-2rem)] overflow-y-auto">
		<DialogHeader>
			<DialogTitle>{t('shortcutsDialog.title')}</DialogTitle>
			<DialogDescription>{t('shortcutsDialog.description')}</DialogDescription>
		</DialogHeader>
		<div class="flex flex-col gap-5">
			{#each defaultShortcutGroups as group (group.id)}
				<div class="flex flex-col gap-1.5">
					<p class="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
						{t(`shortcuts.group_${group.id}`)}
					</p>
					<div class="flex flex-col divide-y divide-border">
						{#each group.shortcuts as s (s.id)}
							<div class="flex items-center justify-between gap-4 py-1.5">
								<span class="text-sm">{t(`shortcuts.desc_${s.id}`)}</span>
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
									{#if isShortcutCustom(s.id)}
										<span class="text-xs text-muted-foreground" title="customized">*</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}

			<div class="flex flex-col gap-1 rounded-lg border border-border/70 bg-muted/30 p-3">
				<p
					class="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
				>
					<i class="ri-gamepad-line text-sm"></i>
					{t('shortcuts.gamepad')}
				</p>
				<p class="text-xs leading-relaxed text-balance text-muted-foreground">
					{t('shortcuts.gamepadHint')}
				</p>
			</div>
		</div>
	</DialogContent>
</Dialog>

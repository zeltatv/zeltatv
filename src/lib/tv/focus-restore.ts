// focus-restore: keeps the remote focus ring alive when the focused item is
// removed from a list.
//
// When the element that owns focus is deleted from the DOM, Chromium drops focus
// to <body>. On a TV that means the yellow ring disappears and the next arrow
// key jumps back to the top of the screen, so a delete action feels broken.
//
// Usage (inside an async delete handler):
//
//   const row = document.querySelector<HTMLElement>(`[data-focus-row="${id}"]`);
//   const scope = row?.parentElement ?? null;
//   const index = row ? Array.from(scope.querySelectorAll('[data-focus-row]')).indexOf(row) : -1;
//   try { await deleteSource(id); } finally { await restoreFocusAfterRemove(scope, index, () => summaryEl); }
//
// The helper waits for Svelte to patch the DOM, then focuses the row that took
// the removed row's place (or the previous one), and falls back to `fallback()`
// when the list became empty. If focus is still on a live element (e.g. the user
// clicked a different control) it is left alone.

import { tick } from 'svelte';

const ROW_SELECTOR = '[data-focus-row]';
const FOCUSABLE =
	'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Index of `row` among the rows of its list, or -1 when it is not a row. */
export function rowIndexOf(row: HTMLElement | null, rowSelector: string = ROW_SELECTOR): number {
	const scope = row?.parentElement;
	if (!row || !scope) return -1;
	return Array.from(scope.querySelectorAll<HTMLElement>(rowSelector)).indexOf(row);
}

/** The list that holds `row`, used to find the neighbouring row after a removal. */
export function rowScopeOf(row: HTMLElement | null): HTMLElement | null {
	return row?.parentElement ?? null;
}

export async function restoreFocusAfterRemove(
	scope: HTMLElement | null,
	index: number,
	fallback: () => HTMLElement | null | undefined,
	rowSelector: string = ROW_SELECTOR
): Promise<void> {
	await tick();

	// the user moved somewhere else in the meantime: do not steal the focus
	const active = document.activeElement as HTMLElement | null;
	if (active && active !== document.body && active.isConnected) return;

	const rows =
		scope && scope.isConnected ? Array.from(scope.querySelectorAll<HTMLElement>(rowSelector)) : [];
	const row = rows.length > 0 ? rows[Math.min(Math.max(index, 0), rows.length - 1)] : null;
	const target = row?.querySelector<HTMLElement>(FOCUSABLE) ?? fallback() ?? null;
	if (!target || !target.isConnected) return;

	target.focus({ preventScroll: true });
	try {
		target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	} catch {
		// no-op on older engines
	}
}

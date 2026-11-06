// state of the center channel menu opened with OK while watching
let open = $state(false);
// DOM host the menu is rendered into (the player container in fullscreen so it stays visible)
let target = $state<HTMLElement | null>(null);

export function useChannelMenu() {
	return {
		get open() {
			return open;
		},
		set open(value: boolean) {
			open = value;
		},
		get target() {
			return target;
		}
	};
}

export function openChannelMenu(host: HTMLElement | null = null) {
	target = host;
	open = true;
}

export function closeChannelMenu() {
	open = false;
}

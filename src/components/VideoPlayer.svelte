<script lang="ts">
	import Hls from 'hls.js';
	import { usePlaylist } from '$lib/iptv/store.svelte';
	import { getShortcutKeys } from '$lib/shortcuts/store.svelte';
	import { matchesShortcut } from '$lib/shortcuts/matcher';
	import { t } from '$lib/i18n/store.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger,
		DropdownMenuLabel,
		DropdownMenuSeparator
	} from '$lib/components/ui/dropdown-menu';

	const playlist = usePlaylist();
	let videoEl = $state<HTMLVideoElement | null>(null);
	let containerEl = $state<HTMLDivElement | null>(null);
	let hls: Hls | null = null;
	let playing = $state(false);
	let muted = $state(false);
	let volume = $state(1);
	let isFullscreen = $state(false);
	let isPip = $state(false);
	let buffering = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let hovered = $state(false);
	let seeking = $state(false);
	let brightness = $state(1);
	let showVolumeSlider = $state(false);
	let showBrightnessSlider = $state(false);
	let seekIndicator = $state<{ seconds: number; visible: boolean }>({ seconds: 0, visible: false });
	let seekTimer: ReturnType<typeof setTimeout> | null = null;

	// quality selection
	let hlsLevels = $state<{ height: number; bitrate: number; index: number }[]>([]);
	let currentLevel = $state(-1); // -1 = auto

	// auto reconnect
	let reconnecting = $state(false);
	let reconnectAttempts = 0;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	const MAX_RECONNECT = 5;

	// load stream when channel changes
	$effect(() => {
		const ch = playlist.currentChannel;
		if (!ch || !videoEl) return;

		if (hls) {
			hls.destroy();
			hls = null;
		}

		// reset state for new channel
		hlsLevels = [];
		currentLevel = -1;
		reconnecting = false;
		reconnectAttempts = 0;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		buffering = true;
		const video = videoEl;
		const channel = ch;

		function initHls() {
			if (Hls.isSupported()) {
				hls = new Hls({
					enableWorker: true,
					// memory: clear played segments after 30s (default Infinity = leak)
					backBufferLength: 30,
					// memory: cap forward buffer at 60s (default 600 = 10 min)
					maxBufferLength: 30,
					maxMaxBufferLength: 60,
					// memory: cap buffer size at 30mb (default 60mb)
					maxBufferSize: 30 * 1000 * 1000,
					// live: keep 3 segments behind live edge
					liveSyncDurationCount: 3
				});
				hls.loadSource(channel.url);
				hls.attachMedia(video);

				hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
					hlsLevels = data.levels.map((l, i) => ({
						height: l.height || 0,
						bitrate: l.bitrate || 0,
						index: i
					}));
					video.play().catch(() => {});
				});

				hls.on(Hls.Events.ERROR, (_e, data) => {
					if (!data.fatal) return;

					if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
						reconnecting = true;
						hls?.startLoad();
					} else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
						reconnecting = true;
						hls?.recoverMediaError();
					} else {
						// unrecoverable - recreate with backoff
						reconnectAttempts++;
						if (reconnectAttempts > MAX_RECONNECT) {
							reconnecting = false;
							return;
						}
						reconnecting = true;
						const delay = Math.pow(2, reconnectAttempts - 1) * 1000;
						if (hls) {
							hls.destroy();
							hls = null;
						}
						reconnectTimer = setTimeout(() => {
							reconnectTimer = null;
							initHls();
						}, delay);
					}
				});

				hls.on(Hls.Events.FRAG_LOADED, () => {
					reconnecting = false;
				});
			} else if (video.canPlayType('application/vnd.apple.mpegurl')) {
				video.src = channel.url;
				video.addEventListener('loadedmetadata', () => video.play().catch(() => {}), {
					once: true
				});
			}
		}

		initHls();

		return () => {
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
				reconnectTimer = null;
			}
			if (hls) {
				hls.destroy();
				hls = null;
			}
		};
	});

	// sync volume state with video element
	$effect(() => {
		if (videoEl) {
			videoEl.volume = volume;
			videoEl.muted = muted;
		}
	});

	// listen for pip events (svelte doesn't type these)
	$effect(() => {
		const el = videoEl;
		if (!el) return;
		const onEnter = () => {
			isPip = true;
		};
		const onLeave = () => {
			isPip = false;
		};
		el.addEventListener('enterpictureinpicture', onEnter);
		el.addEventListener('leavepictureinpicture', onLeave);
		return () => {
			el.removeEventListener('enterpictureinpicture', onEnter);
			el.removeEventListener('leavepictureinpicture', onLeave);
		};
	});

	function togglePlay() {
		if (!videoEl) return;
		if (videoEl.paused) videoEl.play();
		else videoEl.pause();
	}

	function toggleMute() {
		muted = !muted;
	}

	function onVolumeChange(e: Event) {
		const v = e.target as HTMLVideoElement;
		volume = v.volume;
		muted = v.muted;
	}

	function onPlay() {
		playing = true;
		buffering = false;
	}
	function onPause() {
		playing = false;
	}
	function onWaiting() {
		buffering = true;
	}
	function onCanPlay() {
		buffering = false;
	}
	function onTimeUpdate() {
		if (videoEl && !seeking) currentTime = videoEl.currentTime;
	}
	function onDurationChange() {
		if (videoEl) duration = videoEl.duration || 0;
	}

	function formatTime(s: number): string {
		if (!s || !isFinite(s)) return '0:00';
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = Math.floor(s % 60);
		if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

	function onSeekInput(e: Event) {
		const val = parseFloat((e.target as HTMLInputElement).value);
		currentTime = val;
	}

	function onSeekChange(e: Event) {
		if (!videoEl) return;
		const val = parseFloat((e.target as HTMLInputElement).value);
		videoEl.currentTime = val;
		seeking = false;
	}

	function onSeekDown() {
		seeking = true;
	}

	function toggleFullscreen() {
		if (!containerEl) return;
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			containerEl.requestFullscreen();
		}
	}

	function onFullscreenChange() {
		isFullscreen = !!document.fullscreenElement;
	}

	async function togglePip() {
		if (!videoEl) return;
		try {
			if (document.pictureInPictureElement) {
				await document.exitPictureInPicture();
			} else {
				await videoEl.requestPictureInPicture();
			}
		} catch {
			// pip not supported or blocked
		}
	}

	// quality selection - set hls.currentLevel (-1 = auto adaptive)
	function setQuality(level: number) {
		currentLevel = level;
		if (hls) hls.currentLevel = level;
	}

	// map available hls levels to quality labels: auto, low, medium, high
	function qualityOptions(): { label: string; level: number }[] {
		const opts = [{ label: t('player.qualityAuto'), level: -1 }];
		if (hlsLevels.length === 0) return opts;

		if (hlsLevels.length === 1) {
			opts.push({ label: qualityLabel(hlsLevels[0]), level: 0 });
			return opts;
		}

		const low = 0;
		const high = hlsLevels.length - 1;
		opts.push({ label: qualityLabel(hlsLevels[low]), level: low });
		if (hlsLevels.length >= 3) {
			const mid = Math.floor((hlsLevels.length - 1) / 2);
			opts.push({ label: qualityLabel(hlsLevels[mid]), level: mid });
		}
		opts.push({ label: qualityLabel(hlsLevels[high]), level: high });
		return opts;
	}

	function qualityLabel(l: { height: number; bitrate: number }): string {
		if (l.height > 0) return `${l.height}p`;
		if (l.bitrate > 0) return `${Math.round(l.bitrate / 1000)}kbps`;
		return t('player.qualityLevel');
	}

	function currentQualityLabel(): string {
		if (currentLevel === -1) return t('player.qualityAuto');
		const l = hlsLevels[currentLevel];
		return l ? qualityLabel(l) : t('player.qualityAuto');
	}

	function showSeekIndicator(seconds: number) {
		seekIndicator = { seconds, visible: true };
		if (seekTimer) clearTimeout(seekTimer);
		seekTimer = setTimeout(() => {
			seekIndicator = { ...seekIndicator, visible: false };
		}, 600);
	}

	// keyboard shortcuts - cross-platform, uses configurable shortcuts
	function onKeydown(e: KeyboardEvent) {
		if (!document.hasFocus()) return;
		if (!playlist.currentChannel) return;
		// ignore when typing in inputs
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
			return;

		if (matchesShortcut(e, getShortcutKeys('playPause'))) {
			e.preventDefault();
			togglePlay();
		} else if (matchesShortcut(e, getShortcutKeys('mute'))) {
			e.preventDefault();
			toggleMute();
		} else if (matchesShortcut(e, getShortcutKeys('fullscreen'))) {
			e.preventDefault();
			toggleFullscreen();
		} else if (matchesShortcut(e, getShortcutKeys('exitFullscreen'))) {
			if (document.fullscreenElement) document.exitFullscreen();
		} else if (matchesShortcut(e, getShortcutKeys('pictureInPicture'))) {
			e.preventDefault();
			togglePip();
		} else if (matchesShortcut(e, getShortcutKeys('volumeUp'))) {
			e.preventDefault();
			volume = Math.min(1, volume + 0.05);
			muted = false;
		} else if (matchesShortcut(e, getShortcutKeys('volumeDown'))) {
			e.preventDefault();
			volume = Math.max(0, volume - 0.05);
			if (volume === 0) muted = true;
		} else if (matchesShortcut(e, getShortcutKeys('brightnessUp'))) {
			e.preventDefault();
			brightness = Math.min(2, Math.round((brightness + 0.1) * 100) / 100);
		} else if (matchesShortcut(e, getShortcutKeys('brightnessDown'))) {
			e.preventDefault();
			brightness = Math.max(0, Math.round((brightness - 0.1) * 100) / 100);
		} else if (matchesShortcut(e, getShortcutKeys('rewind'))) {
			if (videoEl) {
				videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
				showSeekIndicator(-10);
			}
		} else if (matchesShortcut(e, getShortcutKeys('forward'))) {
			if (videoEl) {
				videoEl.currentTime = videoEl.currentTime + 10;
				showSeekIndicator(10);
			}
		}
	}
</script>

<svelte:window onfullscreenchange={onFullscreenChange} onkeydown={onKeydown} />

<div
	bind:this={containerEl}
	class="group relative flex flex-1 flex-col bg-black"
	role="region"
	aria-label={t('player.videoPlayer')}
	onmouseenter={() => (hovered = true)}
	onmouseleave={() => (hovered = false)}
	onmousemove={() => {
		hovered = true;
	}}
>
	{#if playlist.currentChannel}
		<!-- video -->
		<div class="relative flex flex-1 items-center justify-center">
			<video
				bind:this={videoEl}
				class="max-h-full max-w-full"
				style="filter: brightness({brightness})"
				autoplay
				onplay={onPlay}
				onpause={onPause}
				onvolumechange={onVolumeChange}
				onwaiting={onWaiting}
				oncanplay={onCanPlay}
				ontimeupdate={onTimeUpdate}
				ondurationchange={onDurationChange}
				onclick={togglePlay}
			></video>
			<!-- buffering spinner -->
			{#if buffering}
				<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
					<i class="ri-loader-4-line animate-spin text-4xl text-white/80"></i>
				</div>
			{/if}

			<!-- reconnecting indicator -->
			{#if reconnecting}
				<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div
						class="flex items-center gap-2 rounded-md bg-black/80 px-3 py-1.5 text-white ring-1 ring-white/10"
					>
						<i class="ri-loader-4-line animate-spin text-lg"></i>
						<span class="text-sm font-medium">{t('player.reconnecting')}</span>
					</div>
				</div>
			{/if}

			<!-- paused overlay -->
			{#if !playing && !buffering}
				<button
					onclick={togglePlay}
					class="absolute inset-0 flex items-center justify-center"
					aria-label={t('player.play')}
				>
					<div
						class="flex items-center justify-center rounded-full bg-black/60 p-4 transition-transform hover:scale-110"
					>
						<i class="ri-play-fill text-4xl text-white"></i>
					</div>
				</button>
			{/if}

			<!-- seek indicator overlay -->
			{#if seekIndicator.visible}
				<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div
						class="flex items-center gap-2 rounded-md bg-black/80 px-3 py-1.5 text-white ring-1 ring-white/10"
					>
						<i class="ri-arrow-{seekIndicator.seconds > 0 ? 'right' : 'left'}-line text-xl"></i>
						<span class="text-base font-semibold tabular-nums"
							>{seekIndicator.seconds > 0 ? '+' : ''}{seekIndicator.seconds}s</span
						>
					</div>
				</div>
			{/if}
		</div>

		<!-- controls overlay - visible on hover -->
		<div
			class="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/90 to-transparent px-3 pt-8 pb-2 transition-opacity duration-200 {hovered ||
			!playing
				? 'opacity-100'
				: 'opacity-0'}"
		>
			<!-- progress slider -->
			<div class="flex items-center gap-2">
				<span class="w-12 shrink-0 text-right text-xs text-white/80 tabular-nums"
					>{formatTime(currentTime)}</span
				>
				<input
					type="range"
					min="0"
					max={duration || 0}
					step="0.1"
					value={currentTime}
					onpointerdown={onSeekDown}
					oninput={onSeekInput}
					onchange={onSeekChange}
					class="h-1 flex-1 cursor-pointer accent-white"
					aria-label={t('player.seek')}
				/>
				<span class="w-12 shrink-0 text-xs text-white/80 tabular-nums">{formatTime(duration)}</span>
			</div>

			<!-- buttons row -->
			<div class="flex items-center gap-1 text-white">
				<Button variant="ghost" size="icon" onclick={togglePlay} aria-label={t('player.playPause')}>
					<i class="ri-{playing ? 'pause' : 'play'}-fill text-lg"></i>
				</Button>
				<!-- volume toggle + slider -->
				<div class="flex items-center">
					<Button
						variant="ghost"
						size="icon"
						onclick={() => (showVolumeSlider = !showVolumeSlider)}
						aria-label={t('player.volume')}
						aria-expanded={showVolumeSlider}
					>
						<i
							class="ri-volume-{muted || volume === 0
								? 'mute'
								: volume < 0.5
									? 'down'
									: 'up'}-line text-lg"
						></i>
					</Button>
					{#if showVolumeSlider}
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							bind:value={volume}
							oninput={(e) => {
								volume = parseFloat((e.target as HTMLInputElement).value);
								muted = false;
							}}
							class="h-1 w-20 cursor-pointer {muted
								? 'opacity-30'
								: 'opacity-100'} accent-white transition-opacity"
							aria-label={t('player.volumeLevel')}
						/>
					{/if}
				</div>
				<!-- brightness toggle + slider + reset -->
				<div class="flex items-center">
					<Button
						variant="ghost"
						size="icon"
						onclick={() => (showBrightnessSlider = !showBrightnessSlider)}
						aria-label={t('player.brightness')}
						aria-expanded={showBrightnessSlider}
					>
						<i
							class="ri-sun-{brightness < 0.5
								? 'line'
								: brightness > 1.5
									? 'fill'
									: 'line'} text-lg"
						></i>
					</Button>
					{#if showBrightnessSlider}
						<input
							type="range"
							min="0"
							max="2"
							step="0.05"
							bind:value={brightness}
							class="h-1 w-16 cursor-pointer accent-white"
							aria-label={t('player.brightnessLevel')}
						/>
						{#if brightness !== 1}
							<Button
								variant="ghost"
								size="icon"
								onclick={() => (brightness = 1)}
								aria-label={t('player.resetBrightness')}
							>
								<i class="ri-refresh-line text-sm"></i>
							</Button>
						{/if}
					{/if}
				</div>
				<span class="ml-1 truncate text-sm font-medium text-white/80"
					>{playlist.currentChannel.name}</span
				>
				<div class="ml-auto flex items-center gap-1">
					{#if hlsLevels.length > 0}
						<DropdownMenu>
							<DropdownMenuTrigger>
								<Button variant="ghost" aria-label={t('player.quality')}>
									{currentQualityLabel()}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuLabel>{t('player.quality')}</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{#each qualityOptions() as opt (opt.level)}
									<DropdownMenuItem onclick={() => setQuality(opt.level)}>
										{#if currentLevel === opt.level}
											<i class="ri-check-line text-sm"></i>
										{:else}
											<span class="w-4 shrink-0"></span>
										{/if}
										<span>{opt.label}</span>
									</DropdownMenuItem>
								{/each}
							</DropdownMenuContent>
						</DropdownMenu>
					{/if}
					<Button
						variant="ghost"
						size="icon"
						onclick={togglePip}
						aria-label={t('player.pictureInPicture')}
					>
						<i class="ri-{isPip ? 'picture-in-picture-exit' : 'picture-in-picture'}-line text-lg"
						></i>
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onclick={toggleFullscreen}
						aria-label={t('player.fullscreen')}
					>
						<i class="ri-{isFullscreen ? 'fullscreen-exit' : 'fullscreen'}-line text-lg"></i>
					</Button>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex flex-1 flex-col items-center justify-center gap-3 text-white/40">
			<i class="ri-tv-line text-5xl"></i>
			<p class="text-sm">{t('player.selectChannel')}</p>
		</div>
	{/if}
</div>

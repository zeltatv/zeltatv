# ZeltaTV

<p align="center">
  <img src="docs/images/hero.svg" alt="ZeltaTV desktop - satellite-receiver IPTV player" width="100%">
</p>

Desktop IPTV player for Windows, macOS and Linux. It loads your own M3U/M3U8 playlists and gives
them a satellite-receiver interface that works with a remote, a gamepad, the keyboard or a mouse.

## Download

[**Download ZeltaTV for PC**](https://github.com/zeltatv/zeltatv/releases/latest) - the Windows
installer, macOS `dmg` and Linux `deb` are attached to the latest release.

## Photo Gallery

<p align="center">
  <img src="docs/screenshots/02-player.png" alt="ZeltaTV Enhanced playing a channel with the channel rail" width="100%">
</p>

<!-- prettier-ignore -->
| | |
|---|---|
| <img src="docs/screenshots/01-setup-wizard.png" alt="First-run wizard: choose one of the 18 languages" width="100%"> | <img src="docs/screenshots/03-main-menu.png" alt="Main menu" width="100%"> |
| <img src="docs/screenshots/04-settings.png" alt="Appearance: Classic or Enhanced plus seven palettes" width="100%"> | <img src="docs/screenshots/05-classic.png" alt="The Classic skin with the amber accent" width="100%"> |

## Features

- D-pad, gamepad, keyboard and mouse: the whole interface works without a pointer
- Playlist library with categories; add sources by URL, local file or from the library
- Search, favourites, recently watched channels and numeric zap with an on-screen display
- HLS playback with automatic quality selection, reconnect, fullscreen and picture-in-picture
- Two looks (**Classic**, **Enhanced**) with seven shared palettes
- 18 languages, including right-to-left layouts
- Remembers the last source, channel and sidebar state

## Development

```bash
bun install            # or: npm install
bun run dev            # browser
bun run dev:electron   # desktop shell
```

Package the app:

```bash
bun run build:electron                                  # current platform
powershell -File .\scripts\build-windows-installer.ps1  # Windows Setup.exe
```

## Licence

GPL-3.0-only.

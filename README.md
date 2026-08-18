# ZeltaTV

A cross-platform desktop IPTV player built with Electron, SvelteKit, and HLS.js. Load M3U/M3U8 playlists from URLs or local files, browse channels, and stream live TV with a clean, minimal interface.

## Requirements

- [Bun](https://bun.sh) runtime
- Node.js 18+ (for Electron)

## Installation

```bash
git clone https://github.com/zeltatv/zeltatv.git
cd zeltatv
bun install
```

## Development

Run the web dev server:

```bash
bun run dev
```

Run with Electron (launches Vite + Electron together):

```bash
bun run dev:electron
```

## Build

Build the web assets:

```bash
bun run build
```

Build the desktop app for your current platform:

```bash
bun run build:electron
```

## License

This project is licensed under [GPL-3.0](LICENSE).

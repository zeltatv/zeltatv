# Packaging

ZeltaTV ships a native package for each desktop platform. All desktop packages are built from
the same SvelteKit/Electron source.

## Windows — step-by-step wizard (EXE)

The Windows release is built with Inno Setup through
`scripts/build-windows-installer.ps1` / `.github/workflows/release.yml`.

The wizard provides:

1. Welcome page
2. GPL-3.0 licence agreement
3. Installation directory choice
4. Install/cancel
5. Finish (the "Launch ZeltaTV" box is offered but left unchecked)

`installer/zeltatv.iss` also contains a small `[Code]` section:

- **Foreground/wizard focus.** The wizard tries to activate itself on every page change
  (`CurPageChanged`) and on Next/Install (`NextButtonClick`). If Windows refuses because
  the setup process did not receive the last input event, a synthetic Alt tap clears the
  foreground lock and the activation is retried twice; if it is still refused (another
  process of a higher integrity level owns the foreground) the wizard flashes its taskbar
  button instead. `Next` is also set as the active control on the welcome, ready and
  finished pages, so a click that only activates the window is not followed by a dead
  button. There is no timer in the Inno script engine, so these are the only hooks.
- **Existing installation prompt.** `InitializeSetup` reads
  `...\Uninstall\{8C3D7B5A-5F6E-4B3A-9F1C-2A7E6D4B9C10}_is1` (`DisplayVersion`) from
  `HKCU`/`HKCU64`/`HKLM`/`HKLM64`. If ZeltaTV is already there, the user is asked
  "ZeltaTV <version> is already installed on this PC. Continue to update it?" and No
  cancels setup before anything is written. With `/SILENT` or `/VERYSILENT` the answer
  defaults to Yes, so unattended updates keep working.

The installer is **English-only** and does not ask for a language. The application asks for the
interface language on first launch (setup wizard, step 1).

The launch box starts unchecked on purpose. The first start of a freshly installed Electron app
is slow because Windows Defender scans the ~370 MB of new files, so an automatic launch makes the
installer look frozen; the user starts the app when they are ready.

Only the Chromium locale packs for the 18 UI languages (plus `en-GB`, `zh-CN`, `zh-TW`,
`pt-BR`/`pt-PT`) are shipped, via `build.electronLanguages` in `package.json`. This trims the
installed size from ~399 MB to ~370 MB without changing the languages the app offers; those live
in `src/lib/translations` and are bundled into `app.asar`. The installer drops `{app}\locales`
first (`[InstallDelete]`) so an in-place upgrade does not keep the packs of earlier builds.

Output: `release/ZeltaTV-<version>-Setup.exe`.

## macOS — DMG

Theme `mac`/`dmg` configuration produces a drag-to-Applications DMG with the licence file.
Output: `ZeltaTV-<version>-<arch>.dmg`.

## Linux — DEB + AppImage

The Linux target builds both formats:

- `zeltatv_<version>_amd64.deb` - Debian/Ubuntu package, desktop entry and icon included
- `ZeltaTV-<version>.AppImage` - portable package

## Uninstall behaviour

- **Windows:** the Inno uninstaller removes the installation folder, Start Menu/desktop
  shortcuts, `%APPDATA%\ZeltaTV` and the updater cache.
- **Linux DEB:** the `postrm` script removes `ZeltaTV`/`zeltatv` config, data and cache folders
  for local users. AppImage is portable; delete it manually and remove those folders if desired.
- **macOS:** drag `ZeltaTV.app` to Trash, then remove
  `~/Library/Application Support/ZeltaTV` to delete user data (macOS does not run scripts on
  drag-to-trash).

## Versioning

Package versions come from the repository `package.json`. The Windows
Inno script receives the version from the release workflow; do not hardcode a second version.

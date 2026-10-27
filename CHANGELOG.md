# Changelog

All notable changes to ZeltaTV are documented here.

## [1.0.0] - 2026-10-21 (refreshed 2026-10-27)

First stable desktop release. Resets the release history to a single `1.0.0` version that
contains everything shipped during the 1.0.x iteration.

### Refreshed build (2026-10-27)

- First-run **Language** step in the setup wizard: pick the interface language, then continue to the welcome screen.
- The Windows installer is **English-only** and no longer asks for a language; the application asks on first launch.
- The Windows installer no longer starts the app by itself: the "Launch ZeltaTV" box on the finish page is offered unchecked, so the wizard closes immediately instead of waiting for the first, Defender-scanned start of the app.
- The Windows package ships only the Chromium locale packs that match the 18 UI languages (plus `en-GB`, `zh-CN`, `zh-TW`, `pt-BR`/`pt-PT`): the installed footprint drops from ~399 MB to ~370 MB and the setup from ~112 MB to ~103 MB, with no language removed from the app.
- The **Home** button now returns to the classic full-window playlist screen (alias, URL, file picker, IPTV library) instead of the bare player; the player and channel list are not mounted behind it.
- The setup wizard follows the selected language immediately: picking Türkçe on the first step switches the whole wizard to Turkish, and the same language is used after setup.
- The default look is now called **ZeltaTV Classic** and the second skin **ZeltaTV Enhanced** in Settings and in the About panel; in the skin picker only the words Classic (amber) and Enhanced (turquoise) are colour-coded, ZeltaTV stays in the normal text colour.
- Video fills the whole screen in fullscreen even when the channel list was open, instead of staying at the stream's native size.
- New top-right **windowed mode** button in the normal interface (channel list and player, not
  during video fullscreen) leaves OS fullscreen and returns the app to a resizable window.
- Windowed mode is reversible: that button turns into a **fullscreen** button in the same corner,
  so the window can go back to OS fullscreen without restarting the app. The toolbar labels
  (sources, quit, windowed, fullscreen) are now localised in all 18 languages instead of falling
  back to English.
- The channel list is only shown once a playlist is loaded; an empty library lands on the playlist screen.
- Deleting a source or a category from the IPTV library no longer drops the remote focus: the ring moves to the neighbouring entry, and back to the section header (or the category field) when the list becomes empty.
- The setup wizard opens with the remote focus on the selected language card instead of the Continue button, so pressing Down starts browsing the languages.
- Publisher and project links now point to the `zeltatv` organisation.

### Remote-friendly home screen (2026-10-27)

- The **Enhanced** skin now has a 10-foot home screen: saved playlists are large tiles (OK plays, Down reaches edit and delete), category chips sit above the grid, and the URL / file form moved into a compact card underneath. The list is short and every control is a big target, so nothing can trap the focus ring.
- The classic **ZeltaTV** skin keeps the previous home layout unchanged.
- OK inside the address field submits the form, so a playlist can be loaded with the remote alone; a TV remote has no "Go" button.
- Moving up into the title bar always lands on the **Home** button, so a stray OK can no longer hit Quit.
- When a playlist finishes loading, the remote focus moves to the first channel, so OK zaps immediately.
- Moving down from a home tile lands on that tile's edit and delete buttons even when the grid
  only has two columns, instead of skipping them for the URL field.
- Deleting a source or a tile keeps the focus ring on the neighbouring entry instead of dropping it to the page.

### Full localisation (2026-10-27)

- The setup wizard, the sources window, the quit dialog, the main menu, the settings tabs, the
  About panel and the channel OSD are now translated in **all 18 languages**. 74 keys were
  missing in 16 locales (the wizard fell back to English) and roughly 44 more keys per locale
  still carried the English text; about 1,900 strings were written.
- Spanish, German, French, Italian, Portuguese, Dutch, Polish, Russian, Ukrainian, Azerbaijani,
  Georgian, Arabic, Hindi, Japanese, Korean and Chinese are complete; Turkish and English were
  already complete.
- The dialog close button's screen-reader label (`common.close`) is translated too, so no
  English remains in the accessibility tree.

### Session restore (2026-10-27)

- Reopening the app now continues on the **last watched channel** instead of channel 1: the
  saved channel was read _after_ the playlist had already been loaded, and loading a playlist
  selects its first channel, which overwrote the record. The last channel is now read before
  the playlist is restored and re-applied afterwards, so the player starts on the same channel
  and keeps the same source.
- The playlist, source, skin, theme, language, volume/mute and sidebar state are restored as
  before; if the source is offline the record is kept and retried on the next launch.

### Added

- Four-step setup wizard with a branded panel, step indicator, back/next flow and dedicated
  loading, error and finish screens. It opens with a language step that applies to the wizard
  and the rest of the app immediately.
- Step-by-step Windows installer with a GPL-3.0 licence agreement, installation-directory
  selection, finish-and-launch, and a "set up later" path with an "Open setup" action on the
  empty channel list. The installer is English-only and never asks for a language.
- Playlist sources by URL, local M3U/M3U8 file, or from the saved library.
- Library categories with add, edit and delete support; quick-start from any saved source.
- Session restore: the last playlist, last channel and sidebar state are restored on the next
  launch.
- Persistent theme, skin, language, shortcuts and player quality preference.
- Xbox/standard gamepad navigation (D-pad, A, B, Menu, LB/RB).
- In-player channel menu, channel-number OSD, channel banner and quality selector.
- Dedicated **Stop** button and `S` shortcut in the player.
- 18 UI languages with English fallback for newly added keys.
- App-wide cursor auto-hide after 2.5 seconds of inactivity.
- Uninstall cleanup: Windows removes the install folder, shortcuts, app data and updater cache;
  DEB `postrm` removes user data.

### Changed

- The default appearance is the classic **ZeltaTV** skin. Enhanced remains available as an
  option.
- Fullscreen hides the top bar and the channel list until fullscreen is exited; the player uses
  the whole window and the channel-list toggle is disabled while fullscreen.
- The centered channel menu opens only in fullscreen (OK or clicking the video), closes when
  fullscreen ends, and cannot be opened in windowed mode.
- Only back-meaning keys leave fullscreen. `F` and the fullscreen button only enter, and the
  exit button stays hidden while fullscreen.
- `←`/`→` always seek in fullscreen, even when a control has focus; clicking the video behaves
  like OK/Enter instead of pausing.
- Setup hides external links until a playlist is configured and supports keyboard/remote back
  navigation between steps.
- The back handler checks whether the sidebar is actually visible before closing it.
- Improved spotlight/focus behaviour across setup, sidebar, player and settings.

### Fixed

- Factory reset returns to the setup screen instead of reloading the settings page.
- Session restore for the last playlist, last channel and sidebar state.
- Playlist alias is preserved when saving a URL source to the library.
- Setup source editing, category assignment and library filtering.
- Search, favourites, grouped/alpha sorting and library filtering.
- Shortcut editing and reset labels.
- Theme and language persistence across restarts.

# Desk Remote

Desk Remote is a desktop app for controlling a Fire TV from Windows and routing Spotify playback to the TV.

Today the project is no longer just a scaffold:
- Fire TV control works through ADB over TCP
- the desktop app can save local configuration
- the UI can test Fire TV connection and send remote actions
- Spotify OAuth and Spotify Connect integration are implemented in the core
- Spotify auth completes automatically through a localhost callback
- Fire TV apps can be scanned, cached, and launched from the app
- bindings, tray actions, and global hotkeys are implemented

## Current Status

Implemented now:
- Tauri desktop app with a working TypeScript frontend and Rust backend
- persistent local app config
- Fire TV ADB connection checks
- Fire TV wake / screen-state detection
- Fire TV app launch for Spotify TV
- Fire TV manual navigation and media key events
- Fire TV app scanning and local app cache
- Spotify configuration, token cache, auth URL generation, and TV-target matching by hints
- Spotify toggle logic for pause / resume / transfer to TV
- one-shot `Start Spotify On TV` flow
- persistent bindings for reusable actions
- system tray behavior
- global hotkeys

Not implemented yet:
- production-grade error handling and tests
- richer Fire TV app metadata
- editing and management polish beyond the current bindings UI

## Tech Stack

- Rust workspace for backend and shared logic
- Tauri v2 for the desktop shell
- TypeScript + Vite for the frontend UI
- ADB over TCP for Fire TV communication
- Spotify Web API through `rspotify`

## Project Structure

- `Cargo.toml`
  Rust workspace root
- `crates/core`
  Shared application logic
- `crates/core/src/config`
  Persistent config model and local storage path helpers
- `crates/core/src/firetv`
  Fire TV ADB integration, connection, wake, status, and remote actions
- `crates/core/src/spotify`
  Spotify OAuth, token cache, device lookup, and playback toggle logic
- `crates/core/src/bindings.rs`
  Persistent bindings and reusable action execution
- `apps/tauri`
  Frontend app and Tauri shell
- `apps/tauri/src`
  TypeScript UI
- `apps/tauri/src-tauri`
  Tauri commands and native desktop entrypoint

## How To Launch

From the Tauri app directory:

```powershell
cd C:\Users\akuma\repos\desk-remote\apps\tauri
pnpm tauri dev
```

From the repository root:

```powershell
cd C:\Users\akuma\repos\desk-remote
.\launch.ps1
```

This launches:
- the Vite dev server
- the Rust/Tauri backend
- the shared `crates/core` code through the Tauri app

Useful validation commands:

```powershell
cd C:\Users\akuma\repos\desk-remote
cargo check
```

```powershell
cd C:\Users\akuma\repos\desk-remote\apps\tauri
.\node_modules\.bin\tsc.CMD --noEmit
```

## Requirements

- Windows
- Node.js
- `pnpm`
- Rust toolchain
- Android Platform Tools (`adb`) available in `PATH`
- Spotify Premium account
- Spotify Developer app credentials
- Fire TV with ADB debugging enabled

## Spotify Setup

You need a Spotify app in the Spotify Developer Dashboard.

Required config fields in the app UI:
- Spotify Client ID
- Spotify Client Secret
- Spotify Redirect URL

Recommended redirect URL:

```text
http://127.0.0.1:8888/callback
```

That exact redirect URL must also be registered in the Spotify Developer Dashboard.

## Fire TV Setup

On the TV:
- enable Developer Options
- enable ADB debugging
- make sure the device is reachable on the local network
- accept the first ADB authorization prompt on the TV

In Desk Remote:
- enter the Fire TV IP
- use `Test Fire TV connection`
- use `Connect` or `Wake if asleep`

## What The App Can Do Right Now

Fire TV:
- connect to the TV over ADB
- detect whether the screen appears awake
- wake the TV if asleep
- launch Spotify on the TV
- send `Home`, `Back`, directional controls, `Select`, and `Play/Pause`

Spotify:
- generate the Spotify authorization URL
- open the browser automatically from the desktop app
- listen for the localhost callback
- cache the Spotify token locally
- find the TV target device using configurable name hints
- pause if Spotify is already playing on the TV
- resume if Spotify is paused on the TV
- transfer playback if Spotify is active on another device

App launcher and automation:
- scan installed Fire TV apps and cache them locally
- launch cached Fire TV apps from the UI
- create reusable bindings for:
  - `start_spotify_on_tv`
  - `spotify_toggle_tv`
  - `fire_tv_key`
  - `launch_app`
- run bindings manually from the UI
- trigger bindings from the system tray
- assign global hotkeys to bindings

## Tray And Hotkeys

The desktop app now stays alive in the tray when you close the window.

Tray menu:
- `Show Desk Remote`
- `Start Spotify On TV`
- `Run First Binding`
- `Quit`

Global hotkeys are registered from the bindings list while the app is running.

Example bindings:
- Label: `Watch Spotify on TV`
  Hotkey: `Alt+L`
  Action type: `start_spotify_on_tv`
- Label: `Spotify toggle`
  Hotkey: `Alt+P`
  Action type: `spotify_toggle_tv`
- Label: `TV Home`
  Hotkey: `Alt+H`
  Action type: `fire_tv_key`
  Action value: `home`

Notes:
- Leave `Hotkey` empty if a binding is only for manual execution or tray use.
- The UI includes `Record hotkey` to capture a shortcut directly.
- If a shortcut fails to register, try another one because Windows or another app may already be using it.

## Bindings UI

Bindings now use a guided form:
- `Action type` is a dropdown
- `Action value` only appears when required
- `fire_tv_key` uses a fixed action dropdown
- `launch_app` uses cached Fire TV apps as options
- existing bindings can be edited from the list

## Local Data

The app stores local files under the app data directory:
- app config JSON
- Spotify token cache JSON
- Fire TV app cache JSON
- bindings JSON

On Windows this is resolved from `%APPDATA%\\Desk Remote`.

## Known Issues / Notes

- Windows Defender / App Control may block locally built `tauri.exe`. If that happens, the project can still compile, but the desktop app will not launch until the policy is relaxed.
- `cargo run` from the workspace root is not the intended developer workflow. Use `pnpm tauri dev` from `apps/tauri`.
- Product naming and Tauri window metadata are still scaffold-level in some config files.
- Fire TV app scanning currently prioritizes useful launching behavior over rich metadata, so names are still inferred from package names in some cases.

## Near-Term Roadmap

- improve Fire TV app metadata and launcher discovery
- keep polishing the bindings editor UX
- add stronger error reporting and diagnostics
- add tests for config, bindings, Fire TV parsing, and Spotify decision logic

## License

TBD

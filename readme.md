# Desk Remote

Desk Remote is a Windows desktop control app for Fire TV and Spotify.

The core flow is:

`Wake TV -> open Spotify on Fire TV -> detect target -> transfer or toggle playback`

This is no longer a scaffold. The app now has a working Tauri desktop shell, a modularized TypeScript frontend, a Rust backend, persistent local settings, tray integration, reusable bindings, and global hotkeys.

## What Works Today

- Fire TV control over ADB over TCP
- persistent local app configuration
- Fire TV connection checks and wake flow
- Fire TV remote actions and media keys
- Fire TV app scan, cache, filter, and launch
- Spotify OAuth with localhost callback
- Spotify token cache and target-device matching by hints
- `Start Spotify on TV` end-to-end flow
- Spotify playback toggle and transfer logic
- reusable bindings with optional global hotkeys
- tray actions and tray-resident behavior
- Home dashboard with Quick Access, Shortcuts, readiness, recent activity, and device snapshot

## Current UI Model

The app is organized as a compact desktop utility, not a web dashboard.

Navigation:

- `Home`
- `Playback`
  - `Spotify`
  - `Quick Access`
  - `Hotkeys`
- `Fire TV`
  - `ADB & Device`
  - `Apps`
  - `Remote`
- `System`
  - `Health`
  - `General`

Highlights:

- `Home` is the primary control surface
- `Quick Access` shows favorite bindings used on Home
- `Hotkeys` is focused on creating bindings first, with registered bindings as a secondary list
- `Spotify` is centered around the active session and playback controls
- `Health` and `General` use compact utility-style panels instead of dashboard cards

## Tech Stack

- Rust workspace for backend and shared logic
- Tauri v2 for the desktop shell
- TypeScript + Vite for the frontend
- Lucide for iconography
- ADB over TCP for Fire TV communication
- Spotify Web API through `rspotify`

## Project Structure

- `Cargo.toml`
  Rust workspace root
- `crates/core`
  Shared application logic
- `crates/core/src/config`
  Persistent config model and local storage helpers
- `crates/core/src/firetv`
  Fire TV ADB integration, wake logic, status, remote actions, and app scanning
- `crates/core/src/spotify`
  Spotify OAuth, token cache, target matching, playback transfer, and toggle logic
- `crates/core/src/bindings.rs`
  Persistent bindings and reusable action execution
- `apps/tauri`
  Frontend app and Tauri shell
- `apps/tauri/src/api.ts`
  Frontend wrappers around Tauri commands
- `apps/tauri/src/state.ts`
  Shared frontend app state
- `apps/tauri/src/types.ts`
  Frontend types
- `apps/tauri/src/utils.ts`
  Small formatting and helper utilities
- `apps/tauri/src/features`
  Derived UI/domain logic such as bindings and readiness/status helpers
- `apps/tauri/src/pages`
  Page renderers for Home, Spotify, Quick Access, Hotkeys, Fire TV views, Health, and General
- `apps/tauri/src/ui`
  Shared layout and reusable UI helpers
- `apps/tauri/src/main.ts`
  Frontend bootstrap, root render, event wiring, and async actions
- `apps/tauri/src-tauri`
  Tauri commands and native desktop entrypoint

## Running The App

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

Create a Spotify app in the Spotify Developer Dashboard.

Required values in Desk Remote:

- `Spotify Client ID`
- `Spotify Client Secret`
- `Spotify Redirect URL`

Recommended redirect URL:

```text
http://127.0.0.1:8888/callback
```

That exact URL must also be registered in the Spotify Developer Dashboard.

## Fire TV Setup

On the TV:

- enable Developer Options
- enable ADB debugging
- make sure the device is reachable on the local network
- accept the first ADB authorization prompt on the TV

In Desk Remote:

- enter the Fire TV IP
- use `Test connection`
- use `Connect` or `Wake if asleep`

## Bindings, Quick Access, Tray, And Hotkeys

Bindings are the reusable unit behind Quick Access, tray actions, and global hotkeys.

Supported binding actions:

- `start_spotify_on_tv`
- `spotify_toggle_tv`
- `fire_tv_key`
- `launch_app`

Notes:

- a binding can be marked as favorite to appear in Quick Access on Home
- a binding can have a global hotkey, or no hotkey at all
- the UI includes `Record hotkey`
- if a hotkey fails to register, Windows or another app may already be using it

Example bindings:

- Label: `Watch Spotify on TV`
  Hotkey: `Alt+L`
  Action type: `start_spotify_on_tv`
- Label: `TV Home`
  Hotkey: `Alt+H`
  Action type: `fire_tv_key`
  Action value: `home`
- Label: `Open Netflix`
  Hotkey: `Alt+N`
  Action type: `launch_app`

Tray behavior:

- closing the window hides the app instead of quitting
- the app stays available in the tray
- tray actions can trigger bindings and reopen the app

## Local Data

The app stores local files under the app data directory:

- app config JSON
- Spotify token cache JSON
- Fire TV app cache JSON
- bindings JSON

On Windows this resolves from:

```text
%APPDATA%\Desk Remote
```

## Known Notes

- Windows Defender or App Control may block locally built `tauri.exe`
- `cargo run` from the workspace root is not the intended dev workflow
- some Tauri metadata is still scaffold-level and can be cleaned up later
- Fire TV app scan currently prioritizes useful launching behavior over rich metadata

## Near-Term Focus

- continue splitting frontend controller logic out of `main.ts`
- improve the remaining secondary pages so they match the Home quality bar
- improve Fire TV app metadata and launcher discovery
- strengthen diagnostics, tests, and error handling

## License

TBD

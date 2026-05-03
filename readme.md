# Sendo

Sendo is a Windows desktop utility for orchestrating Fire TV control and Spotify playback from one local control surface.

## Screenshot

![Sendo Home](assets/sendo-home.png)

## What is Sendo?

Sendo is a Tauri desktop app that coordinates two different control planes:

- Fire TV device control over ADB
- Spotify playback routing and transport control over Spotify Connect

The app is built around a practical workflow: wake the TV, launch Spotify on Fire TV, select the intended playback device, and control playback from the desktop without switching tools.

## Positioning

Sendo is not a media dashboard and not a remote-desktop tool.

It is a local device orchestration utility: the UI exposes control intent, while the backend executes concrete operations against Fire TV and Spotify with explicit state checks, target selection, and recovery paths.

## Core Idea

Sendo separates **control** from **execution**.

- **Control layer**: a compact desktop UI for triggering actions, selecting targets, checking readiness, and managing bindings/hotkeys.
- **Execution layer**: a Rust backend that owns ADB commands, Spotify OAuth/token handling, playback transfer, app launch, and persistent local config.

That separation keeps the UI responsive while longer device operations run in native command handlers, and it makes the app easier to reason about than a frontend that directly mixes UI state with shell/API side effects.

## Architecture

```text
TypeScript UI
  -> Tauri command bridge
    -> Rust app core
      -> Fire TV over ADB/TCP
      -> Spotify Web API / Spotify Connect
      -> Local app data under %APPDATA%\Sendo
```

### System layers

- `apps/tauri/src/ui`
  - App shell, sidebar, layout, and reusable UI primitives.
- `apps/tauri/src/pages`
  - Page-level renderers for Home, Spotify, Quick Access, Hotkeys, Fire TV tools, Health, and General.
- `apps/tauri/src/features`
  - Derived UI/domain logic such as binding presentation and readiness/status mapping.
- `apps/tauri/src/main.ts`
  - Frontend bootstrap, event wiring, async actions, polling, tray-event sync, and root rendering.
- `apps/tauri/src-tauri`
  - Native command bridge, tray setup, autostart integration, notifications, and window lifecycle behavior.
- `crates/core/src/config`
  - Persistent app config and AppData migration.
- `crates/core/src/firetv`
  - Fire TV status probing, wake/power control, remote key events, app scanning, app launching, and ADB timeout handling.
- `crates/core/src/spotify`
  - Spotify OAuth, token cache, target-device resolution, explicit device selection, playback transfer, transport control, and now-playing state.
- `crates/core/src/bindings.rs`
  - Reusable action bindings, favorite ordering, hotkey metadata, and persisted binding storage.

## Features

- One-click `Start Spotify on TV` flow
- Fire TV readiness checks, wake, power off, and remote navigation
- Fire TV app scanning, cached app list, filtering, and app launch
- Spotify OAuth with local callback and token cache
- Explicit Spotify target-device picker for multi-TV setups
- Now Playing view with album art, track, artist, progress, and transport controls
- Transfer playback to the selected TV target
- Reusable bindings for Fire TV actions, app launches, and Spotify actions
- Global hotkeys for bindings
- Quick Access favorites grid with drag-to-reorder
- Tray actions and close-to-tray behavior
- Launch at startup + start minimized to tray
- Health and readiness panels with actionable recovery paths
- Local JSON storage under `%APPDATA%\Sendo`

## Quick Start

### Requirements

- Windows
- Node.js
- `pnpm`
- Rust toolchain
- Android Platform Tools (`adb`) in `PATH`
- Fire TV with ADB debugging enabled
- Spotify Premium
- Spotify Developer app credentials

### Clone and install

```powershell
git clone <repo-url>
cd desk-remote\apps\tauri
pnpm install
```

### Run in development

```powershell
cd C:\Users\akuma\repos\desk-remote\apps\tauri
pnpm tauri dev
```

### Build a Windows installer

```powershell
cd C:\Users\akuma\repos\desk-remote\apps\tauri
npm run tauri -- build
```

Build outputs:

- `target/release/sendo.exe`
- `target/release/bundle/nsis/Sendo_0.1.0_x64-setup.exe`
- `target/release/bundle/msi/Sendo_0.1.0_x64_en-US.msi`

### Validation

```powershell
cd C:\Users\akuma\repos\desk-remote
cargo check
```

```powershell
cd C:\Users\akuma\repos\desk-remote\apps\tauri
.\node_modules\.bin\tsc.CMD --noEmit
```

## Main Flow

1. Configure the Fire TV IP address in `ADB & Device`.
2. Configure Spotify OAuth credentials and redirect URL in `Spotify`.
3. Authenticate Spotify and select the exact Spotify Connect target device.
4. Use `Start Spotify on TV` from Home, tray, or a binding.
5. Sendo connects to the TV over ADB, wakes it if needed, launches Spotify, and transfers playback to the selected Spotify device.
6. Control playback from the Spotify page, Remote page, Quick Access, or global hotkeys.

## Why it exists

Fire TV control and Spotify Connect solve different parts of the same living-room workflow, but they do not share one clean desktop control surface.

Sendo exists to bridge that gap with a system that is explicit about device state, playback target identity, and orchestration order. The app favors deterministic local control over ad-hoc manual steps, while still exposing enough status to debug failures when a TV, token, or network hop is not ready.

## Tech Stack

- Rust
- Tauri v2
- TypeScript
- Vite
- Lucide
- Spotify Web API via `rspotify`
- ADB over TCP

## Roadmap

- Improve Fire TV app metadata beyond package-name inference
- Add stronger test coverage around Spotify target resolution and binding persistence
- Continue shrinking `main.ts` by moving controller logic into dedicated modules
- Tighten diagnostics around ADB, auth expiry, and device targeting edge cases
- Expand contributor-friendly issues across UI consistency, reliability, and docs

### Looking for contributors on

- modularizing large frontend controller logic
- tests around Spotify target/device selection edge cases
- Fire TV diagnostics and error messaging
- release/distribution documentation polish
- UI consistency fixes that preserve the desktop-utility direction

## Contributing

Issues and pull requests are welcome.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, validation, and pull request guidance.

If you contribute, please keep the project biased toward:

- explicit control flow over hidden magic
- small, readable modules with clear boundaries
- actionable status and error states
- a compact desktop-utility UI, not a web dashboard aesthetic

## License

MIT

# Desk Remote

Desk Remote is a desktop app for controlling a Fire TV from Windows and routing Spotify playback to the TV.

Today the project is no longer just a scaffold:
- Fire TV control works through ADB over TCP
- the desktop app can save local configuration
- the UI can test Fire TV connection and send remote actions
- Spotify OAuth and Spotify Connect integration are implemented in the core
- Spotify auth flow is being finalized and is still the most likely area for iteration

## Current Status

Implemented now:
- Tauri desktop app with a working TypeScript frontend and Rust backend
- persistent local app config
- Fire TV ADB connection checks
- Fire TV wake / screen-state detection
- Fire TV app launch for Spotify TV
- Fire TV manual navigation and media key events
- Spotify configuration, token cache, auth URL generation, and TV-target matching by hints
- Spotify toggle logic for pause / resume / transfer to TV

Not implemented yet:
- system tray behavior
- global hotkeys
- app scanning / app cache for Fire TV
- configurable button mappings
- production-grade error handling and tests

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

## Local Data

The app stores local files under the app data directory:
- app config JSON
- Spotify token cache JSON

On Windows this is resolved from `%APPDATA%\\Desk Remote`.

## Known Issues / Notes

- Windows Defender / App Control may block locally built `tauri.exe`. If that happens, the project can still compile, but the desktop app will not launch until the policy is relaxed.
- The Spotify auth flow is implemented and under active iteration. If automatic localhost callback auth fails, there is still a manual fallback in the UI.
- `cargo run` from the workspace root is not the intended developer workflow. Use `pnpm tauri dev` from `apps/tauri`.
- Product naming and Tauri window metadata are still scaffold-level in some config files.

## Near-Term Roadmap

- stabilize Spotify automatic auth
- add one-shot flow for `connect + wake + launch Spotify + toggle playback`
- scan installed Fire TV apps and cache them locally
- add app launching from the UI
- add tray integration and global shortcuts

## License

TBD

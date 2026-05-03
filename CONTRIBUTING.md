# Contributing to Sendo

Thanks for taking a look at Sendo.

Sendo is a local-first Windows desktop utility for Fire TV control, Spotify routing, reusable shortcuts, and explicit device workflows. Contributions are welcome, especially when they improve reliability, clarity, and maintainability.

## Before you start

Please prefer:

- explicit control flow over hidden magic
- small, readable modules with clear boundaries
- actionable status and error states
- compact desktop-utility UX over web-dashboard patterns

If you want to contribute code, start by opening an issue or picking an existing one labeled `good first issue` or `help wanted`.

## Repository layout

- `apps/tauri`
  - TypeScript frontend, Tauri shell, and desktop UI
- `apps/site`
  - Product/install website
- `crates/core`
  - Rust core for config, Fire TV, Spotify, bindings, and orchestration logic

## Local setup

### Requirements

- Windows
- Node.js
- `pnpm`
- Rust toolchain
- Android Platform Tools (`adb`) in `PATH`

### Install dependencies

```powershell
cd C:\Users\akuma\repos\desk-remote\apps\tauri
pnpm install
```

### Run the desktop app

```powershell
cd C:\Users\akuma\repos\desk-remote\apps\tauri
pnpm tauri dev
```

### Run the site

```powershell
cd C:\Users\akuma\repos\desk-remote\apps\site
corepack pnpm install
corepack pnpm dev
```

## Validation

Before opening a pull request, run the checks relevant to your change.

### Rust

```powershell
cd C:\Users\akuma\repos\desk-remote
cargo check
```

### Tauri frontend

```powershell
cd C:\Users\akuma\repos\desk-remote\apps\tauri
cmd /c npm run build
```

### Site

```powershell
cd C:\Users\akuma\repos\desk-remote\apps\site
corepack pnpm build
```

## Pull requests

Good pull requests are:

- scoped to one problem
- easy to review
- clear about why the change exists
- tested enough for the surface they touch

Please include:

- what changed
- why it changed
- how you validated it
- screenshots if the UI changed

## Good first contributions

The best first contributions usually fall into one of these buckets:

- small bug fixes
- docs/setup improvements
- UI consistency fixes
- focused refactors with clear file boundaries
- tests for existing behavior

## What not to optimize for

Please avoid contributions that mainly add:

- unnecessary abstraction
- hidden behavior
- “smart” automation with unclear failure states
- generic dashboard styling that fights the desktop-tool direction

## Questions

If something is unclear, open an issue first. That is usually the fastest way to align before writing code.

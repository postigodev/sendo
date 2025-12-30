# Desk Remote

**Desk Remote** is a lightweight desktop controller that lets you control Spotify playback and Fire TV devices directly from your computer using global keyboard shortcuts.

The app runs in the system tray and is designed to be fast, minimal, and unobtrusive.

> ⚠️ This project is currently under active development.

---

## Features (Planned / In Progress)

- Global hotkeys for controlling Spotify playback
- Fire TV device control (wake, home, navigation, media actions)
- System tray app (always running, minimal UI)
- Secure Spotify authentication
- Fast native backend written in Rust

---

## Tech Stack

- **Rust** — core logic and system integration
- **Tauri v2** — desktop app framework
- **TypeScript** — frontend and command wiring
- **ADB** — Fire TV communication

---

## Architecture

This project is structured as a Rust workspace:

- `crates/core` — reusable core logic (Spotify + Fire TV control)
- `apps/tauri` — desktop UI, system tray, and global shortcuts

The core logic is intentionally decoupled from the UI to keep the system modular and maintainable.

---

## Development Status

The project is in early development.  
The current focus is on:

- Setting up the Tauri app shell
- Establishing the Rust workspace architecture
- Wiring core logic into the desktop app

---

## License

TBD

mod commands;

use desk_remote_core::{bindings, config::AppConfig, spotify};
use std::env;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            setup_tray(app.handle())?;
            apply_startup_preferences(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::get_settings,
            commands::save_settings,
            commands::bindings_list,
            commands::bindings_save,
            commands::bindings_delete,
            commands::bindings_execute,
            commands::health_check,
            commands::firetv_status,
            commands::firetv_action,
            commands::firetv_cached_apps,
            commands::firetv_scan_apps,
            commands::firetv_launch_app,
            commands::spotify_status,
            commands::spotify_start_auth,
            commands::spotify_finish_auth,
            commands::spotify_finish_auth_via_local_callback,
            commands::spotify_debug_auth_flow,
            commands::spotify_toggle_tv,
            commands::spotify_toggle_playback,
            commands::spotify_transfer_tv,
            commands::spotify_next_track,
            commands::spotify_previous_track,
            commands::start_spotify_on_tv
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show_window", "Show Sendo", true, None::<&str>)?;
    let start_spotify_item = MenuItem::with_id(
        app,
        "start_spotify_on_tv",
        "Start Spotify On TV",
        true,
        None::<&str>,
    )?;
    let run_first_binding_item = MenuItem::with_id(
        app,
        "run_first_binding",
        "Run First Binding",
        true,
        None::<&str>,
    )?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &start_spotify_item,
            &run_first_binding_item,
            &separator,
            &quit_item,
        ],
    )?;

    TrayIconBuilder::with_id("desk-remote-tray")
        .icon(
            app.default_window_icon()
                .expect("missing default window icon")
                .clone(),
        )
        .tooltip("Sendo")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app: &AppHandle, event| match event.id.as_ref() {
            "show_window" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "start_spotify_on_tv" => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = run_start_spotify_on_tv(&app_handle).await {
                        notify_tray_error(
                            &app_handle,
                            "Start Spotify On TV failed",
                            &error.to_string(),
                        );
                    }
                });
            }
            "run_first_binding" => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = run_first_binding(&app_handle).await {
                        notify_tray_error(
                            &app_handle,
                            "Run First Binding failed",
                            &error.to_string(),
                        );
                    }
                });
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray: &tauri::tray::TrayIcon<_>, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let visible = window.is_visible().unwrap_or(true);
                    if visible {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

async fn run_start_spotify_on_tv(app: &AppHandle) -> anyhow::Result<()> {
    let config = AppConfig::load()?;
    let _ = spotify::start_on_tv(&config).await?;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("tray-action", "start_spotify_on_tv");
    }
    Ok(())
}

async fn run_first_binding(app: &AppHandle) -> anyhow::Result<()> {
    let config = AppConfig::load()?;
    let store = bindings::list_bindings()?;
    let Some(first_binding) = store.bindings.first() else {
        return Ok(());
    };

    let _ = bindings::execute_binding(&first_binding.id, &config).await?;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("tray-action", &first_binding.id);
    }
    Ok(())
}

fn apply_startup_preferences(app: &AppHandle) -> tauri::Result<()> {
    let config = AppConfig::load().unwrap_or_default();
    let autostart_manager = app.autolaunch();

    match (config.launch_on_startup, autostart_manager.is_enabled()) {
        (true, Ok(false)) => {
            let _ = autostart_manager.enable();
        }
        (false, Ok(true)) => {
            let _ = autostart_manager.disable();
        }
        _ => {}
    }

    let started_from_autostart = env::args().any(|arg| arg == "--autostart");
    if !started_from_autostart || !config.start_minimized_to_tray {
        return Ok(());
    }

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }

    Ok(())
}

fn notify_tray_error(app: &AppHandle, title: &str, message: &str) {
    let _ = app
        .notification()
        .builder()
        .title(title)
        .body(message)
        .show();
}

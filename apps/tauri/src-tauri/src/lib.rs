mod commands;

use desk_remote_core::{bindings, config::AppConfig, spotify};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            setup_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
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
            commands::start_spotify_on_tv
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show_window", "Show Desk Remote", true, None::<&str>)?;
    let start_spotify_item =
        MenuItem::with_id(app, "start_spotify_on_tv", "Start Spotify On TV", true, None::<&str>)?;
    let run_first_binding_item =
        MenuItem::with_id(app, "run_first_binding", "Run First Binding", true, None::<&str>)?;
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
        .tooltip("Desk Remote")
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
                    let _ = run_start_spotify_on_tv(&app_handle).await;
                });
            }
            "run_first_binding" => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = run_first_binding(&app_handle).await;
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

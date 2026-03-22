mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::health_check,
            commands::firetv_status,
            commands::firetv_action,
            commands::spotify_status,
            commands::spotify_start_auth,
            commands::spotify_finish_auth,
            commands::spotify_finish_auth_via_local_callback,
            commands::spotify_toggle_tv
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

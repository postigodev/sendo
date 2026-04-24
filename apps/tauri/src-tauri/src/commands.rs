use desk_remote_core::{
    bindings::{self, Binding, BindingStore},
    config::{config_file_path, AppConfig},
    firetv::{self, FireTvAction, FireTvAppCache, FireTvAppScanResult, FireTvStatus},
    spotify::{self, SpotifyStatus},
    ActionResult, AuthUrlResult, HealthStatus, SpotifyAuthDebug,
};
use serde::Serialize;
use tauri::{async_runtime, command, AppHandle};
use tauri_plugin_autostart::ManagerExt;

#[derive(Serialize)]
pub struct AppInfo {
    version: String,
}

async fn run_blocking<T, F>(task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| error.to_string())?
}

#[command]
pub async fn get_settings() -> Result<AppConfig, String> {
    run_blocking(|| AppConfig::load().map_err(|e| e.to_string())).await
}

#[command]
pub fn get_app_info(app: AppHandle) -> AppInfo {
    AppInfo {
        version: app.package_info().version.to_string(),
    }
}

#[command]
pub async fn save_settings(app: AppHandle, config: AppConfig) -> Result<AppConfig, String> {
    run_blocking(move || {
        sync_autostart_setting(&app, &config).map_err(|e| e.to_string())?;
        config.save().map_err(|e| e.to_string())?;
        Ok(config)
    })
    .await
}

#[command]
pub async fn bindings_list() -> Result<BindingStore, String> {
    run_blocking(|| bindings::list_bindings().map_err(|e| e.to_string())).await
}

#[command]
pub async fn bindings_save(binding: Binding) -> Result<BindingStore, String> {
    run_blocking(move || bindings::save_binding(binding).map_err(|e| e.to_string())).await
}

#[command]
pub async fn bindings_delete(id: String) -> Result<BindingStore, String> {
    run_blocking(move || bindings::delete_binding(&id).map_err(|e| e.to_string())).await
}

#[command]
pub async fn bindings_execute(id: String) -> Result<ActionResult, String> {
    let config = run_blocking(|| AppConfig::load().map_err(|e| e.to_string())).await?;
    let message = bindings::execute_binding(&id, &config)
        .await
        .map_err(|e| e.to_string())?;
    Ok(ActionResult { message })
}

#[command]
pub async fn health_check() -> Result<HealthStatus, String> {
    run_blocking(|| {
        let config = AppConfig::load().map_err(|e| e.to_string())?;
        let configured = config.configured_services();
        let config_path = config_file_path().map_err(|e| e.to_string())?;

        Ok(HealthStatus {
            config_path: config_path.display().to_string(),
            firetv_configured: configured.firetv_ready,
            spotify_configured: configured.spotify_ready,
            firetv_summary: firetv::status_summary(&config.firetv_ip),
            spotify_summary: spotify::status_summary(
                &config.spotify_client_id,
                &config.spotify_client_secret,
                &config.spotify_redirect_url,
            ),
        })
    })
    .await
}

#[command]
pub async fn firetv_status(firetv_ip: Option<String>) -> Result<FireTvStatus, String> {
    run_blocking(move || {
        let ip = resolve_firetv_ip(firetv_ip)?;
        firetv::get_status(&ip).map_err(|e| e.to_string())
    })
    .await
}

#[command]
pub async fn firetv_action(
    action: FireTvAction,
    firetv_ip: Option<String>,
) -> Result<ActionResult, String> {
    let message = run_blocking(move || {
        let ip = resolve_firetv_ip(firetv_ip)?;
        firetv::perform_action(&ip, action).map_err(|e| e.to_string())
    })
    .await?;

    Ok(ActionResult { message })
}

#[command]
pub async fn firetv_cached_apps() -> Result<FireTvAppCache, String> {
    run_blocking(|| firetv::get_cached_apps().map_err(|e| e.to_string())).await
}

#[command]
pub async fn firetv_scan_apps(firetv_ip: Option<String>) -> Result<FireTvAppScanResult, String> {
    run_blocking(move || {
        let ip = resolve_firetv_ip(firetv_ip)?;
        firetv::scan_apps(&ip).map_err(|e| e.to_string())
    })
    .await
}

#[command]
pub async fn firetv_launch_app(
    package_name: String,
    firetv_ip: Option<String>,
) -> Result<ActionResult, String> {
    let message = run_blocking(move || {
        let ip = resolve_firetv_ip(firetv_ip)?;
        firetv::launch_app(&ip, &package_name).map_err(|e| e.to_string())
    })
    .await?;

    Ok(ActionResult { message })
}

fn resolve_firetv_ip(firetv_ip: Option<String>) -> Result<String, String> {
    if let Some(ip) = firetv_ip.map(|value| value.trim().to_string()) {
        if !ip.is_empty() {
            return Ok(ip);
        }
    }

    let config = AppConfig::load().map_err(|e| e.to_string())?;
    Ok(config.firetv_ip)
}

#[command]
pub async fn spotify_status() -> Result<SpotifyStatus, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    spotify::get_status(&config)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn spotify_start_auth() -> Result<AuthUrlResult, String> {
    let mut config = AppConfig::load().map_err(|e| e.to_string())?;
    spotify::prepare_auth(&mut config).map_err(|e| e.to_string())?;
    config.save().map_err(|e| e.to_string())?;
    let auth = spotify::start_auth(&config)
        .await
        .map_err(|e| e.to_string())?;

    Ok(AuthUrlResult {
        url: auth.authorize_url,
        message: format!(
            "Open the Spotify auth URL and paste the returned code or callback URL. Token cache: {}",
            auth.token_cache_path
        ),
    })
}

#[command]
pub async fn spotify_finish_auth(code_or_callback: String) -> Result<SpotifyStatus, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    spotify::finish_auth(&config, &code_or_callback)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn spotify_finish_auth_via_local_callback() -> Result<SpotifyStatus, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    spotify::finish_auth_via_local_callback(&config)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn spotify_debug_auth_flow() -> Result<SpotifyAuthDebug, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    spotify::debug_auth_flow(&config)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn spotify_toggle_tv() -> Result<ActionResult, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let message = spotify::toggle_on_tv(&config)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ActionResult { message })
}

fn sync_autostart_setting(app: &AppHandle, config: &AppConfig) -> anyhow::Result<()> {
    let autostart_manager = app.autolaunch();
    let is_enabled = autostart_manager.is_enabled()?;

    match (config.launch_on_startup, is_enabled) {
        (true, false) => autostart_manager.enable()?,
        (false, true) => autostart_manager.disable()?,
        _ => {}
    }

    Ok(())
}

#[command]
pub async fn spotify_toggle_playback() -> Result<ActionResult, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let message = spotify::toggle_playback(&config)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ActionResult { message })
}

#[command]
pub async fn spotify_transfer_tv() -> Result<ActionResult, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let message = spotify::transfer_to_tv(&config)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ActionResult { message })
}

#[command]
pub async fn spotify_next_track() -> Result<ActionResult, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let message = spotify::skip_next(&config)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ActionResult { message })
}

#[command]
pub async fn spotify_previous_track() -> Result<ActionResult, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let message = spotify::skip_previous(&config)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ActionResult { message })
}

#[command]
pub async fn start_spotify_on_tv() -> Result<ActionResult, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let message = spotify::start_on_tv(&config)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ActionResult { message })
}

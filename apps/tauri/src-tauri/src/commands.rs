use desk_remote_core::{
    ActionResult, AuthUrlResult,
    config::{config_file_path, AppConfig},
    firetv::{self, FireTvAction, FireTvStatus},
    spotify::{self, SpotifyStatus},
    HealthStatus,
};
use tauri::command;

#[command]
pub fn get_settings() -> Result<AppConfig, String> {
    AppConfig::load().map_err(|e| e.to_string())
}

#[command]
pub fn save_settings(config: AppConfig) -> Result<AppConfig, String> {
    config.save().map_err(|e| e.to_string())?;
    Ok(config)
}

#[command]
pub fn health_check() -> Result<HealthStatus, String> {
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
}

#[command]
pub fn firetv_status(firetv_ip: Option<String>) -> Result<FireTvStatus, String> {
    let ip = resolve_firetv_ip(firetv_ip)?;
    firetv::get_status(&ip).map_err(|e| e.to_string())
}

#[command]
pub fn firetv_action(action: FireTvAction, firetv_ip: Option<String>) -> Result<ActionResult, String> {
    let ip = resolve_firetv_ip(firetv_ip)?;
    let message = firetv::perform_action(&ip, action).map_err(|e| e.to_string())?;

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
    spotify::get_status(&config).await.map_err(|e| e.to_string())
}

#[command]
pub async fn spotify_start_auth() -> Result<AuthUrlResult, String> {
    let mut config = AppConfig::load().map_err(|e| e.to_string())?;
    spotify::prepare_auth(&mut config).map_err(|e| e.to_string())?;
    config.save().map_err(|e| e.to_string())?;
    let auth = spotify::start_auth(&config).await.map_err(|e| e.to_string())?;

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
pub async fn spotify_toggle_tv() -> Result<ActionResult, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let message = spotify::toggle_on_tv(&config)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ActionResult { message })
}

use desk_remote_core::{
    ActionResult,
    config::{config_file_path, AppConfig},
    firetv::{self, FireTvAction, FireTvStatus},
    spotify, HealthStatus,
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

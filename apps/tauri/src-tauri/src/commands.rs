use desk_remote_core::{
    config::{config_file_path, AppConfig},
    firetv, spotify, HealthStatus,
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

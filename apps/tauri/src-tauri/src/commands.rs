use desk_remote_core::{config::AppConfig, firetv, spotify};
use tauri::command;

#[command]
pub fn test_core() -> Result<String, String> {
    let cfg = AppConfig::load();

    firetv::wake_tv(&cfg.firetv_ip).map_err(|e| e.to_string())?;
    spotify::transfer_session().map_err(|e| e.to_string())?;

    Ok("core call OK".into())
}

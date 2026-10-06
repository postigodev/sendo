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

static SETTINGS_SAVE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

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
        let _guard = SETTINGS_SAVE_LOCK.lock().map_err(|_| {
            "Settings save lock is unavailable. Restart Sendo and retry.".to_string()
        })?;
        let manager = app.autolaunch();
        let previous = manager.is_enabled().map_err(|e| {
            format!("Could not read system autostart state. Settings were not saved: {e}")
        })?;
        save_with_autostart(
            config.launch_on_startup,
            previous,
            |enabled| {
                if enabled {
                    manager.enable()?;
                } else {
                    manager.disable()?;
                }
                Ok(())
            },
            || config.save(),
        )?;
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
pub async fn bindings_reorder_favorites(ids: Vec<String>) -> Result<BindingStore, String> {
    run_blocking(move || bindings::reorder_favorites(&ids).map_err(|e| format!("{e:#}"))).await
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

// OS registration and file replacement cannot share a crash-atomic transaction.
// Compensate reported failures here; apply_startup_preferences already attempts
// to reconcile the OS registration with the persisted preference on next startup.
fn save_with_autostart(
    desired: bool,
    previous: bool,
    mut set_enabled: impl FnMut(bool) -> anyhow::Result<()>,
    save: impl FnOnce() -> anyhow::Result<()>,
) -> Result<(), String> {
    let changed = desired != previous;
    let result = (|| -> anyhow::Result<()> {
        if changed {
            set_enabled(desired)
                .map_err(|e| anyhow::anyhow!("Could not synchronize system autostart: {e:#}"))?;
        }
        save().map_err(|e| anyhow::anyhow!("Could not persist settings: {e:#}"))
    })();
    if let Err(error) = result {
        if changed {
            if let Err(rollback) = set_enabled(previous) {
                return Err(format!("Settings were not saved: {error:#}. Could not restore previous autostart state: {rollback:#}. Check system startup settings and retry."));
            }
        }
        return Err(format!(
            "Settings were not saved: {error:#}. Retry after resolving this error."
        ));
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::{Cell, RefCell};

    #[test]
    fn settings_write_failure_restores_autostart() {
        let enabled = Cell::new(false);
        let changes = RefCell::new(Vec::new());
        let result = save_with_autostart(
            true,
            false,
            |value| {
                enabled.set(value);
                changes.borrow_mut().push(value);
                Ok(())
            },
            || {
                assert!(enabled.get());
                anyhow::bail!("disk full")
            },
        );
        assert!(!enabled.get());
        assert_eq!(*changes.borrow(), vec![true, false]);
        assert!(result.unwrap_err().contains("disk full"));
    }

    #[test]
    fn autostart_failure_prevents_saving_and_reports_failed_compensation() {
        let saved = Cell::new(false);
        let changes = RefCell::new(Vec::new());
        let result = save_with_autostart(
            true,
            false,
            |value| {
                changes.borrow_mut().push(value);
                anyhow::bail!("startup registry denied")
            },
            || {
                saved.set(true);
                Ok(())
            },
        );
        assert!(!saved.get());
        assert_eq!(*changes.borrow(), vec![true, false]);
        let error = result.unwrap_err();
        assert!(error.contains("startup registry denied"));
        assert!(error.contains("restore"));
    }

    #[test]
    fn settings_failure_reports_both_save_and_rollback_errors() {
        let result = save_with_autostart(
            true,
            false,
            |value| {
                if value {
                    Ok(())
                } else {
                    anyhow::bail!("rollback denied")
                }
            },
            || anyhow::bail!("disk full"),
        );
        let error = result.unwrap_err();
        assert!(error.contains("disk full"));
        assert!(error.contains("rollback denied"));
    }

    #[test]
    fn settings_save_changes_autostart_only_when_needed() {
        for (desired, current, expected) in [
            (true, false, vec![true]),
            (false, true, vec![false]),
            (true, true, vec![]),
            (false, false, vec![]),
        ] {
            let changes = RefCell::new(Vec::new());
            let saved = Cell::new(false);
            save_with_autostart(
                desired,
                current,
                |value| {
                    changes.borrow_mut().push(value);
                    Ok(())
                },
                || {
                    saved.set(true);
                    Ok(())
                },
            )
            .unwrap();
            assert!(saved.get());
            assert_eq!(*changes.borrow(), expected);
        }
    }
}

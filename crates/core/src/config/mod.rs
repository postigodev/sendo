use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    env, fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct AppConfig {
    pub firetv_ip: String,
    pub spotify_client_id: String,
    pub spotify_client_secret: String,
    pub spotify_redirect_url: String,
    pub spotify_selected_device_id: String,
    pub spotify_target_hints: String,
    pub spotify_auth_state: String,
    pub launch_on_startup: bool,
    pub start_minimized_to_tray: bool,
}

impl AppConfig {
    pub fn load() -> Result<Self> {
        let path = config_file_path()?;
        if !path.exists() {
            return Ok(Self::default());
        }

        let raw = fs::read_to_string(&path)
            .with_context(|| format!("failed to read config file at {}", path.display()))?;
        let cfg = serde_json::from_str::<Self>(&raw)
            .with_context(|| format!("failed to parse config file at {}", path.display()))?;

        Ok(cfg)
    }

    pub fn save(&self) -> Result<()> {
        let path = config_file_path()?;
        ensure_parent_dir(&path)?;

        let raw = serde_json::to_string_pretty(self).context("failed to serialize config")?;
        fs::write(&path, raw)
            .with_context(|| format!("failed to write config file at {}", path.display()))?;

        Ok(())
    }

    pub fn configured_services(&self) -> ConfiguredServices {
        ConfiguredServices {
            firetv_ready: !self.firetv_ip.trim().is_empty(),
            spotify_ready: !self.spotify_client_id.trim().is_empty()
                && !self.spotify_client_secret.trim().is_empty()
                && !self.spotify_redirect_url.trim().is_empty(),
        }
    }

    pub fn spotify_target_hint_list(&self) -> Vec<String> {
        let hints = self
            .spotify_target_hints
            .split(',')
            .map(|value| value.trim().to_ascii_lowercase())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>();

        if hints.is_empty() {
            default_spotify_target_hints()
        } else {
            hints
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ConfiguredServices {
    pub firetv_ready: bool,
    pub spotify_ready: bool,
}

pub fn config_file_path() -> Result<PathBuf> {
    let base_dir = app_data_dir()?;
    Ok(base_dir.join("config.json"))
}

pub fn app_data_dir() -> Result<PathBuf> {
    if let Ok(appdata) = env::var("APPDATA") {
        let base_dir = PathBuf::from(appdata);
        return migrate_app_data_dir(base_dir.join("Sendo"), base_dir.join("Desk Remote"));
    }

    if let Ok(home) = env::var("HOME") {
        let base_dir = PathBuf::from(home);
        return migrate_app_data_dir(base_dir.join(".sendo"), base_dir.join(".desk-remote"));
    }

    Err(anyhow::anyhow!(
        "could not determine an application data directory"
    ))
}

fn migrate_app_data_dir(current_path: PathBuf, legacy_path: PathBuf) -> Result<PathBuf> {
    if current_path.exists() || !legacy_path.exists() {
        return Ok(current_path);
    }

    if let Some(parent) = current_path.parent() {
        fs::create_dir_all(parent).with_context(|| {
            format!(
                "failed to create app data directory at {}",
                parent.display()
            )
        })?;
    }

    fs::rename(&legacy_path, &current_path).with_context(|| {
        format!(
            "failed to migrate app data from {} to {}",
            legacy_path.display(),
            current_path.display()
        )
    })?;

    Ok(current_path)
}

fn ensure_parent_dir(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| {
            format!("failed to create config directory at {}", parent.display())
        })?;
    }

    Ok(())
}

fn default_spotify_target_hints() -> Vec<String> {
    [
        "fire", "tv", "amazon", "spotify", "insignia", "toshiba", "osint",
    ]
    .into_iter()
    .map(|value| value.to_string())
    .collect()
}

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
        return Ok(PathBuf::from(appdata).join("Desk Remote"));
    }

    if let Ok(home) = env::var("HOME") {
        return Ok(PathBuf::from(home).join(".desk-remote"));
    }

    Err(anyhow::anyhow!(
        "could not determine an application data directory"
    ))
}

fn ensure_parent_dir(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| {
            format!(
                "failed to create config directory at {}",
                parent.display()
            )
        })?;
    }

    Ok(())
}

fn default_spotify_target_hints() -> Vec<String> {
    ["fire", "tv", "amazon", "spotify", "insignia", "toshiba", "osint"]
        .into_iter()
        .map(|value| value.to_string())
        .collect()
}

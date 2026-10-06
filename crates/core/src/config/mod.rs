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
        self.save_to_path(&path)
    }

    fn save_to_path(&self, path: &Path) -> Result<()> {
        let raw = serde_json::to_string_pretty(self).context("failed to serialize config")?;
        crate::persistence::atomic_write(path, raw.as_bytes())
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

fn default_spotify_target_hints() -> Vec<String> {
    [
        "fire", "tv", "amazon", "spotify", "insignia", "toshiba", "osint",
    ]
    .into_iter()
    .map(|value| value.to_string())
    .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempDir(PathBuf);
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn temp_dir() -> TempDir {
        let path =
            env::temp_dir().join(format!("sendo-config-test-{:016x}", rand::random::<u64>()));
        fs::create_dir(&path).unwrap();
        TempDir(path)
    }

    #[test]
    fn config_replacement_preserves_previous_file_contents_and_roundtrips() {
        let directory = temp_dir();
        let path = directory.0.join("config.json");
        let mut config = AppConfig {
            firetv_ip: "192.0.2.1".into(),
            ..Default::default()
        };
        config.save_to_path(&path).unwrap();
        let original = fs::read_to_string(&path).unwrap();
        let previous_path = directory.0.join("previous.json");
        fs::hard_link(&path, &previous_path).unwrap();
        config.firetv_ip = "192.0.2.2".into();
        config.save_to_path(&path).unwrap();
        assert_eq!(fs::read_to_string(&previous_path).unwrap(), original);
        fs::remove_file(previous_path).unwrap();
        let saved: AppConfig = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(saved.firetv_ip, "192.0.2.2");
        assert_eq!(fs::read_dir(&directory.0).unwrap().count(), 1);
    }

    #[test]
    fn config_replacement_failure_cleans_up_its_temporary_file() {
        let directory = temp_dir();
        let path = directory.0.join("config.json");
        fs::create_dir(&path).unwrap();
        fs::write(path.join("keep"), "original").unwrap();
        let error = AppConfig::default().save_to_path(&path).unwrap_err();
        assert!(error.to_string().contains("config.json"));
        assert_eq!(fs::read_to_string(path.join("keep")).unwrap(), "original");
        assert_eq!(fs::read_dir(&directory.0).unwrap().count(), 1);
    }

    #[cfg(windows)]
    #[test]
    fn failed_config_replacement_preserves_the_previous_config() {
        use std::os::windows::fs::OpenOptionsExt;
        let directory = temp_dir();
        let path = directory.0.join("config.json");
        AppConfig::default().save_to_path(&path).unwrap();
        let original = fs::read(&path).unwrap();
        let held_file = fs::OpenOptions::new()
            .read(true)
            .share_mode(1)
            .open(&path)
            .unwrap();
        let updated = AppConfig {
            launch_on_startup: true,
            ..Default::default()
        };
        assert!(updated.save_to_path(&path).is_err());
        assert_eq!(fs::read(&path).unwrap(), original);
        assert_eq!(fs::read_dir(&directory.0).unwrap().count(), 1);
        drop(held_file);
    }

    #[test]
    fn app_data_migration_preserves_config_and_token_cache() {
        let directory = temp_dir();
        let legacy = directory.0.join("Desk Remote");
        let current = directory.0.join("Sendo");
        fs::create_dir(&legacy).unwrap();
        fs::write(legacy.join("config.json"), "{}").unwrap();
        fs::write(legacy.join("spotify-token.json"), "cached-token").unwrap();
        assert_eq!(
            migrate_app_data_dir(current.clone(), legacy.clone()).unwrap(),
            current
        );
        assert!(!legacy.exists());
        assert_eq!(
            fs::read_to_string(current.join("spotify-token.json")).unwrap(),
            "cached-token"
        );
        AppConfig::default()
            .save_to_path(&current.join("config.json"))
            .unwrap();
        assert_eq!(
            fs::read_to_string(current.join("spotify-token.json")).unwrap(),
            "cached-token"
        );
    }
}

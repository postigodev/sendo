use crate::{
    config::{app_data_dir, AppConfig},
    firetv::{self, FireTvAction},
    spotify,
};
use anyhow::{bail, Context, Result};
use rand::{distr::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BindingAction {
    LaunchApp { package_name: String },
    FireTvKey { action: FireTvAction },
    SpotifyToggleTv,
    StartSpotifyOnTv,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Binding {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub hotkey: String,
    pub action: BindingAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BindingStore {
    pub bindings: Vec<Binding>,
}

pub fn list_bindings() -> Result<BindingStore> {
    let path = bindings_path()?;
    if !path.exists() {
        return Ok(BindingStore::default());
    }

    let raw = fs::read_to_string(&path)
        .with_context(|| format!("failed to read bindings file at {}", path.display()))?;
    let store = serde_json::from_str::<BindingStore>(&raw)
        .with_context(|| format!("failed to parse bindings file at {}", path.display()))?;
    Ok(store)
}

pub fn save_binding(mut binding: Binding) -> Result<BindingStore> {
    let mut store = list_bindings()?;

    if binding.id.trim().is_empty() {
        binding.id = generate_binding_id();
    }

    if binding.label.trim().is_empty() {
        bail!("Binding label is required");
    }

    binding.hotkey = binding.hotkey.trim().to_string();

    if !binding.hotkey.is_empty()
        && store.bindings.iter().any(|item| {
            item.id != binding.id && item.hotkey.eq_ignore_ascii_case(&binding.hotkey)
        })
    {
        bail!("Hotkey already in use: {}", binding.hotkey);
    }

    if let Some(existing) = store.bindings.iter_mut().find(|item| item.id == binding.id) {
        *existing = binding;
    } else {
        store.bindings.push(binding);
    }

    store.bindings.sort_by(|left, right| left.label.cmp(&right.label));
    write_store(&store)?;
    Ok(store)
}

pub fn delete_binding(id: &str) -> Result<BindingStore> {
    let mut store = list_bindings()?;
    store.bindings.retain(|binding| binding.id != id);
    write_store(&store)?;
    Ok(store)
}

pub async fn execute_binding(id: &str, config: &AppConfig) -> Result<String> {
    let store = list_bindings()?;
    let binding = store
        .bindings
        .into_iter()
        .find(|binding| binding.id == id)
        .with_context(|| format!("binding not found: {id}"))?;

    execute_action(&binding.action, config).await
}

pub async fn execute_action(action: &BindingAction, config: &AppConfig) -> Result<String> {
    match action {
        BindingAction::LaunchApp { package_name } => {
            firetv::launch_app(&config.firetv_ip, package_name)
        }
        BindingAction::FireTvKey { action } => firetv::perform_action(&config.firetv_ip, *action),
        BindingAction::SpotifyToggleTv => spotify::toggle_on_tv(config).await,
        BindingAction::StartSpotifyOnTv => spotify::start_on_tv(config).await,
    }
}

fn bindings_path() -> Result<PathBuf> {
    Ok(app_data_dir()?.join("bindings.json"))
}

fn write_store(store: &BindingStore) -> Result<()> {
    let path = bindings_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create bindings dir at {}", parent.display()))?;
    }

    let raw = serde_json::to_string_pretty(store).context("failed to serialize bindings")?;
    fs::write(&path, raw)
        .with_context(|| format!("failed to write bindings file at {}", path.display()))?;
    Ok(())
}

fn generate_binding_id() -> String {
    rand::rng()
        .sample_iter(&Alphanumeric)
        .take(10)
        .map(char::from)
        .collect()
}

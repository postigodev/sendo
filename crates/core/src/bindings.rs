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
    #[serde(default)]
    pub favorite: bool,
    #[serde(default)]
    pub favorite_order: u32,
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
    let existing_binding = store
        .bindings
        .iter()
        .find(|item| item.id == binding.id)
        .cloned();

    if binding.id.trim().is_empty() {
        binding.id = generate_binding_id();
    }

    if binding.label.trim().is_empty() {
        bail!("Binding label is required");
    }

    binding.hotkey = binding.hotkey.trim().to_string();

    if !binding.hotkey.is_empty()
        && store
            .bindings
            .iter()
            .any(|item| item.id != binding.id && item.hotkey.eq_ignore_ascii_case(&binding.hotkey))
    {
        bail!("Hotkey already in use: {}", binding.hotkey);
    }

    binding.favorite_order = normalized_favorite_order(&store, &binding, existing_binding.as_ref());

    if let Some(existing) = store.bindings.iter_mut().find(|item| item.id == binding.id) {
        *existing = binding;
    } else {
        store.bindings.push(binding);
    }

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

fn normalized_favorite_order(
    store: &BindingStore,
    binding: &Binding,
    existing_binding: Option<&Binding>,
) -> u32 {
    if !binding.favorite {
        return existing_binding
            .map(|item| item.favorite_order)
            .unwrap_or(0);
    }

    if binding.favorite_order > 0 {
        return binding.favorite_order;
    }

    if let Some(existing) = existing_binding {
        if existing.favorite && existing.favorite_order > 0 {
            return existing.favorite_order;
        }
    }

    store
        .bindings
        .iter()
        .filter(|item| item.favorite)
        .map(|item| item.favorite_order)
        .max()
        .unwrap_or(0)
        .saturating_add(1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::firetv::FireTvAction;
    use std::{env, fs, path::PathBuf};

    fn binding(id: &str, label: &str, favorite: bool, favorite_order: u32) -> Binding {
        Binding {
            id: id.to_string(),
            label: label.to_string(),
            hotkey: String::new(),
            favorite,
            favorite_order,
            action: BindingAction::FireTvKey {
                action: FireTvAction::Home,
            },
        }
    }

    fn with_temp_home(test: impl FnOnce()) {
        let original_home = env::var_os("HOME");
        let original_appdata = env::var_os("APPDATA");
        let temp_home =
            env::temp_dir().join(format!("sendo-bindings-test-{}", generate_binding_id()));

        env::set_var("HOME", &temp_home);
        env::remove_var("APPDATA");

        test();

        if let Some(home) = original_home {
            env::set_var("HOME", home);
        } else {
            env::remove_var("HOME");
        }

        if let Some(appdata) = original_appdata {
            env::set_var("APPDATA", appdata);
        } else {
            env::remove_var("APPDATA");
        }

        let _ = fs::remove_dir_all(temp_home);
    }

    fn stored_bindings_path() -> PathBuf {
        bindings_path().expect("bindings path")
    }

    #[test]
    fn saves_updates_deletes_and_reorders_bindings() {
        with_temp_home(|| {
            let store = save_binding(binding("", "Home", true, 0)).expect("save new binding");
            assert_eq!(store.bindings.len(), 1);

            let home = store.bindings[0].clone();
            assert!(!home.id.is_empty());
            assert_eq!(home.favorite_order, 1);
            assert!(stored_bindings_path().exists());

            let mut updated_home = home.clone();
            updated_home.label = "Living Room Home".to_string();
            updated_home.favorite_order = 4;
            let store = save_binding(updated_home.clone()).expect("update binding");
            assert_eq!(store.bindings.len(), 1);
            assert_eq!(store.bindings[0].label, "Living Room Home");
            assert_eq!(store.bindings[0].favorite_order, 4);

            let store =
                save_binding(binding("spotify", "Spotify", true, 1)).expect("save second binding");
            assert_eq!(store.bindings.len(), 2);

            let mut reordered_home = updated_home.clone();
            reordered_home.favorite_order = 1;
            let mut reordered_spotify = store
                .bindings
                .iter()
                .find(|binding| binding.id == "spotify")
                .expect("spotify binding")
                .clone();
            reordered_spotify.favorite_order = 2;

            save_binding(reordered_home).expect("reorder first binding");
            let store = save_binding(reordered_spotify).expect("reorder second binding");
            let reloaded = list_bindings().expect("reload bindings");

            assert_eq!(store.bindings.len(), reloaded.bindings.len());
            assert_eq!(
                reloaded
                    .bindings
                    .iter()
                    .find(|binding| binding.label == "Living Room Home")
                    .map(|binding| binding.favorite_order),
                Some(1)
            );
            assert_eq!(
                reloaded
                    .bindings
                    .iter()
                    .find(|binding| binding.id == "spotify")
                    .map(|binding| binding.favorite_order),
                Some(2)
            );

            let store = delete_binding(&home.id).expect("delete binding");
            assert_eq!(store.bindings.len(), 1);
            assert_eq!(store.bindings[0].id, "spotify");

            let reloaded = list_bindings().expect("reload after delete");
            assert_eq!(reloaded.bindings.len(), 1);
            assert_eq!(reloaded.bindings[0].id, "spotify");
            assert_eq!(reloaded.bindings[0].favorite_order, 2);
        });
    }
}

use crate::{
    config::{app_data_dir, AppConfig},
    firetv::{self, FireTvAction},
    spotify,
};
use anyhow::{bail, Context, Result};
use rand::{distr::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
};

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

    if let BindingAction::LaunchApp { package_name } = &binding.action {
        if package_name.trim().is_empty() {
            bail!("LaunchApp package name is required");
        }
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
    normalize_favorite_orders(&mut store);
    write_store(&store)?;
    Ok(store)
}

fn normalize_favorite_orders(store: &mut BindingStore) {
    let mut favorite_indices = store
        .bindings
        .iter()
        .enumerate()
        .filter(|(_, binding)| binding.favorite)
        .map(|(index, binding)| (index, binding.favorite_order))
        .collect::<Vec<_>>();
    favorite_indices.sort_by_key(|(_, favorite_order)| *favorite_order);

    for (order, (index, _)) in favorite_indices.into_iter().enumerate() {
        store.bindings[index].favorite_order = order as u32 + 1;
    }
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
    let temp_path = path.with_extension(format!("json.tmp-{}", generate_binding_id()));
    let write_result = (|| -> Result<()> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)
            .with_context(|| {
                format!(
                    "failed to create temporary bindings file at {}",
                    temp_path.display()
                )
            })?;
        file.write_all(raw.as_bytes()).with_context(|| {
            format!(
                "failed to write temporary bindings file at {}",
                temp_path.display()
            )
        })?;
        file.sync_all().with_context(|| {
            format!(
                "failed to sync temporary bindings file at {}",
                temp_path.display()
            )
        })?;
        Ok(())
    })();

    if let Err(error) = write_result {
        let _ = fs::remove_file(&temp_path);
        return Err(error);
    }

    if let Err(error) = replace_file(&temp_path, &path) {
        let _ = fs::remove_file(&temp_path);
        return Err(error)
            .with_context(|| format!("failed to replace bindings file at {}", path.display()));
    }

    Ok(())
}

#[cfg(not(windows))]
fn replace_file(temp_path: &PathBuf, path: &PathBuf) -> std::io::Result<()> {
    fs::rename(temp_path, path)
}

#[cfg(windows)]
fn replace_file(temp_path: &PathBuf, path: &PathBuf) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let source: Vec<u16> = temp_path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let destination: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    if unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    } == 0
    {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
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
    use std::{env, fs, path::PathBuf, sync::Mutex};

    static TEST_ENV_LOCK: Mutex<()> = Mutex::new(());

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
        let _env_guard = TEST_ENV_LOCK.lock().expect("lock test environment");
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
            assert_eq!(reloaded.bindings[0].favorite_order, 1);
        });
    }

    #[test]
    fn rejects_launch_app_without_a_package_name_before_writing() {
        with_temp_home(|| {
            let invalid = Binding {
                id: "launch-empty".to_string(),
                label: "Launch app".to_string(),
                hotkey: String::new(),
                favorite: false,
                favorite_order: 0,
                action: BindingAction::LaunchApp {
                    package_name: "  ".to_string(),
                },
            };

            let error = save_binding(invalid).expect_err("empty package name must be rejected");
            assert_eq!(error.to_string(), "LaunchApp package name is required");
            assert!(!stored_bindings_path().exists());
        });
    }

    #[test]
    fn replaces_bindings_without_leaving_temporary_files() {
        with_temp_home(|| {
            save_binding(binding("home", "Home", false, 0)).expect("save binding");
            let mut updated = binding("home", "Updated", false, 0);
            updated.hotkey = "Ctrl+H".to_string();
            save_binding(updated).expect("replace binding");

            let path = stored_bindings_path();
            let reloaded = list_bindings().expect("reload binding");
            assert_eq!(reloaded.bindings[0].label, "Updated");
            assert_eq!(reloaded.bindings[0].hotkey, "Ctrl+H");
            assert!(fs::read_to_string(path).is_ok());
        });
    }
}

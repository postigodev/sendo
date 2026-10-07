use crate::{
    config::{app_data_dir, AppConfig},
    firetv::{self, FireTvAction},
    spotify,
};
use anyhow::{bail, Context, Result};
use rand::{distr::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, path::PathBuf};

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

pub fn reorder_favorites(ids: &[String]) -> Result<BindingStore> {
    let mut store = list_bindings()?;
    let favorite_count = store
        .bindings
        .iter()
        .filter(|binding| binding.favorite)
        .count();
    if ids.len() != favorite_count {
        bail!("Favorite order must include every favorite exactly once. Reload Quick Access and try again.");
    }
    let mut seen = HashSet::new();
    for id in ids {
        let binding = store
            .bindings
            .iter()
            .find(|binding| &binding.id == id)
            .with_context(|| {
                format!("Binding not found: {id}. Reload Quick Access and try again.")
            })?;
        if !binding.favorite {
            bail!("Binding is not a favorite: {id}");
        }
        if !seen.insert(id) {
            bail!("Duplicate binding in favorite order: {id}");
        }
    }
    for (index, id) in ids.iter().enumerate() {
        store
            .bindings
            .iter_mut()
            .find(|binding| &binding.id == id)
            .expect("validated favorite")
            .favorite_order =
            u32::try_from(index + 1).context("too many favorites to persist their order")?;
    }
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
    let raw = serde_json::to_string_pretty(store).context("failed to serialize bindings")?;
    crate::persistence::atomic_write(&path, raw.as_bytes())
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
    use std::{env, ffi::OsString, fs, path::PathBuf, sync::Mutex};

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

    struct TestHomeGuard {
        original_home: Option<OsString>,
        original_appdata: Option<OsString>,
        temp_home: PathBuf,
    }

    impl TestHomeGuard {
        fn new() -> Self {
            let original_home = env::var_os("HOME");
            let original_appdata = env::var_os("APPDATA");
            let temp_home =
                env::temp_dir().join(format!("sendo-bindings-test-{}", generate_binding_id()));

            env::set_var("HOME", &temp_home);
            env::remove_var("APPDATA");

            Self {
                original_home,
                original_appdata,
                temp_home,
            }
        }
    }

    impl Drop for TestHomeGuard {
        fn drop(&mut self) {
            if let Some(home) = self.original_home.take() {
                env::set_var("HOME", home);
            } else {
                env::remove_var("HOME");
            }

            if let Some(appdata) = self.original_appdata.take() {
                env::set_var("APPDATA", appdata);
            } else {
                env::remove_var("APPDATA");
            }

            let _ = fs::remove_dir_all(&self.temp_home);
        }
    }

    fn with_temp_home(test: impl FnOnce()) {
        let _env_guard = TEST_ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let _home_guard = TestHomeGuard::new();
        test();
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
    fn restores_test_environment_when_the_body_panics() {
        let original_home = env::var_os("HOME");
        let original_appdata = env::var_os("APPDATA");
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            with_temp_home(|| panic!("simulated test panic"));
        }));

        assert!(result.is_err());
        assert_eq!(env::var_os("HOME"), original_home);
        assert_eq!(env::var_os("APPDATA"), original_appdata);
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

    #[test]
    fn reorder_normalizes_all_favorites_and_preserves_other_binding_fields() {
        with_temp_home(|| {
            save_binding(binding("home", "Home", true, 7)).unwrap();
            save_binding(binding("spotify", "Spotify", true, 7)).unwrap();
            save_binding(binding("other", "Other", false, 12)).unwrap();
            let before = list_bindings().unwrap();
            let reordered = reorder_favorites(&["spotify".into(), "home".into()]).unwrap();
            assert_eq!(reordered.bindings[0].favorite_order, 2);
            assert_eq!(reordered.bindings[1].favorite_order, 1);
            for (old, new) in before.bindings.iter().zip(&reordered.bindings) {
                let mut expected = serde_json::to_value(old).unwrap();
                if old.favorite {
                    expected["favorite_order"] = new.favorite_order.into();
                }
                assert_eq!(expected, serde_json::to_value(new).unwrap());
            }
            assert_eq!(
                serde_json::to_value(list_bindings().unwrap()).unwrap(),
                serde_json::to_value(reordered).unwrap()
            );
            assert_eq!(
                fs::read_dir(stored_bindings_path().parent().unwrap())
                    .unwrap()
                    .count(),
                1
            );
        });
    }

    #[test]
    fn invalid_reorders_leave_persisted_bindings_unchanged() {
        with_temp_home(|| {
            save_binding(binding("a", "A", true, 3)).unwrap();
            save_binding(binding("b", "B", true, 8)).unwrap();
            save_binding(binding("other", "Other", false, 0)).unwrap();
            let original = fs::read(stored_bindings_path()).unwrap();
            for ids in [
                vec!["a", "missing"],
                vec!["a", "a"],
                vec!["a"],
                vec![],
                vec!["a", "other"],
                vec!["a", "b", "other"],
            ] {
                let ids = ids.into_iter().map(str::to_string).collect::<Vec<_>>();
                assert!(reorder_favorites(&ids).is_err(), "accepted {ids:?}");
                assert_eq!(fs::read(stored_bindings_path()).unwrap(), original);
            }
        });
    }

    #[cfg(windows)]
    #[test]
    fn failed_reorder_replacement_keeps_the_complete_old_order() {
        use std::fs::OpenOptions;
        use std::os::windows::fs::OpenOptionsExt;
        with_temp_home(|| {
            save_binding(binding("a", "A", true, 3)).unwrap();
            save_binding(binding("b", "B", true, 8)).unwrap();
            let path = stored_bindings_path();
            let original = fs::read(&path).unwrap();
            let held_file = OpenOptions::new()
                .read(true)
                .share_mode(1)
                .open(&path)
                .unwrap();
            assert!(reorder_favorites(&["b".into(), "a".into()]).is_err());
            assert_eq!(fs::read(&path).unwrap(), original);
            assert_eq!(fs::read_dir(path.parent().unwrap()).unwrap().count(), 1);
            drop(held_file);
        });
    }
}

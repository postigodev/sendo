use crate::config::app_data_dir;
use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Read,
    path::PathBuf,
    process::{ChildStderr, ChildStdout, Command, Stdio},
    thread,
    thread::JoinHandle,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const DEFAULT_ADB_PORT: &str = "5555";
const ADB_STATUS_TIMEOUT: Duration = Duration::from_secs(3);
const ADB_ACTION_TIMEOUT: Duration = Duration::from_secs(12);
const ADB_SCAN_TIMEOUT: Duration = Duration::from_secs(20);
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FireTvAction {
    Connect,
    EnsureAwake,
    LaunchSpotify,
    Wake,
    PowerOff,
    Home,
    Back,
    Up,
    Down,
    Left,
    Right,
    Select,
    PlayPause,
    VolumeUp,
    VolumeDown,
}

#[derive(Debug, Clone, Serialize)]
pub struct FireTvStatus {
    pub configured: bool,
    pub adb_available: bool,
    pub connected: bool,
    pub screen_awake: Option<bool>,
    pub target: Option<String>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FireTvPrepResult {
    pub target: String,
    pub awake: bool,
    pub launched_spotify: bool,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FireTvApp {
    pub package_name: String,
    pub display_name: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FireTvAppCache {
    pub scanned_at_epoch_ms: u64,
    pub apps: Vec<FireTvApp>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FireTvAppScanResult {
    pub target: String,
    pub scanned_at_epoch_ms: u64,
    pub apps: Vec<FireTvApp>,
    pub summary: String,
}

pub fn status_summary(ip: &str) -> String {
    match get_status(ip) {
        Ok(status) => status.summary,
        Err(error) => error.to_string(),
    }
}

pub fn get_status(ip: &str) -> Result<FireTvStatus> {
    let trimmed_ip = ip.trim();
    if trimmed_ip.is_empty() {
        return Ok(FireTvStatus {
            configured: false,
            adb_available: adb_available(),
            connected: false,
            screen_awake: None,
            target: None,
            summary: "Missing Fire TV IP address. Enter the TV's local IP address from the Fire TV network settings.".into(),
        });
    }

    let target = normalize_target(trimmed_ip);
    let adb_error = ensure_adb_available().err();
    if let Some(error) = adb_error {
        return Ok(FireTvStatus {
            configured: true,
            adb_available: false,
            connected: false,
            screen_awake: None,
            target: Some(target),
            summary: error.to_string(),
        });
    }

    let connected = connect(&target).unwrap_or(false);
    let screen_awake = if connected {
        screen_is_on(&target).ok()
    } else {
        None
    };

    let summary = if connected {
        match screen_awake {
            Some(true) => format!("Connected to Fire TV at {target}; screen is awake"),
            Some(false) => format!("Connected to Fire TV at {target}; screen appears asleep"),
            None => format!("Connected to Fire TV at {target}; power state unavailable"),
        }
    } else {
        fire_tv_unreachable_message(&target)
    };

    Ok(FireTvStatus {
        configured: true,
        adb_available: true,
        connected,
        screen_awake,
        target: Some(target),
        summary,
    })
}

pub fn perform_action(ip: &str, action: FireTvAction) -> Result<String> {
    let trimmed_ip = ip.trim();
    if trimmed_ip.is_empty() {
        bail!("Fire TV IP address is required. Enter the TV's local IP address from the Fire TV network settings.");
    }

    ensure_adb_available()?;
    let target = normalize_target(trimmed_ip);

    if !connect(&target)? {
        bail!(fire_tv_unreachable_message(&target));
    }

    match action {
        FireTvAction::Connect => Ok(format!("Connected to {target}")),
        FireTvAction::EnsureAwake => {
            let awake = ensure_awake(&target, 4)?;
            if awake {
                Ok(format!("Fire TV at {target} is awake"))
            } else {
                bail!("Fire TV at {target} did not wake after retries. Confirm the TV is powered on and still accepts ADB commands.")
            }
        }
        FireTvAction::LaunchSpotify => {
            open_spotify(&target)?;
            Ok(format!("Launched Spotify on {target}"))
        }
        _ => {
            let key_code = key_code_for(action);
            run_adb(&["-s", &target, "shell", "input", "keyevent", key_code])?;
            Ok(format!("Sent {:?} to {target}", action))
        }
    }
}

pub fn prepare_spotify_session(ip: &str) -> Result<FireTvPrepResult> {
    let trimmed_ip = ip.trim();
    if trimmed_ip.is_empty() {
        bail!("Fire TV IP address is required. Enter the TV's local IP address from the Fire TV network settings.");
    }

    ensure_adb_available()?;
    let target = normalize_target(trimmed_ip);

    if !connect(&target)? {
        bail!(fire_tv_unreachable_message(&target));
    }

    let awake = ensure_awake(&target, 4)?;
    if !awake {
        bail!("Fire TV at {target} did not wake after retries");
    }

    open_spotify(&target)?;

    Ok(FireTvPrepResult {
        target: target.clone(),
        awake,
        launched_spotify: true,
        summary: format!(
            "Connected to {target}, confirmed the screen is awake, and launched Spotify"
        ),
    })
}

pub fn get_cached_apps() -> Result<FireTvAppCache> {
    let path = apps_cache_path()?;
    if !path.exists() {
        return Ok(FireTvAppCache {
            scanned_at_epoch_ms: 0,
            apps: Vec::new(),
        });
    }

    let raw = fs::read_to_string(&path)
        .with_context(|| format!("failed to read Fire TV app cache at {}", path.display()))?;
    let cache = serde_json::from_str::<FireTvAppCache>(&raw)
        .with_context(|| format!("failed to parse Fire TV app cache at {}", path.display()))?;
    Ok(cache)
}

pub fn scan_apps(ip: &str) -> Result<FireTvAppScanResult> {
    let trimmed_ip = ip.trim();
    if trimmed_ip.is_empty() {
        bail!("Fire TV IP address is required. Enter the TV's local IP address from the Fire TV network settings.");
    }

    ensure_adb_available()?;
    let target = normalize_target(trimmed_ip);

    if !connect(&target)? {
        bail!(fire_tv_unreachable_message(&target));
    }

    let output = run_adb_with_timeout(
        &[
            "-s", &target, "shell", "cmd", "package", "list", "packages", "-3",
        ],
        ADB_SCAN_TIMEOUT,
    )?;
    let mut apps = output
        .lines()
        .filter_map(|line| line.strip_prefix("package:"))
        .map(|package_name| FireTvApp {
            package_name: package_name.trim().to_string(),
            display_name: infer_display_name(package_name.trim()),
            source: "adb-package-list".into(),
        })
        .collect::<Vec<_>>();

    apps.sort_by(|left, right| left.display_name.cmp(&right.display_name));
    apps.dedup_by(|left, right| left.package_name == right.package_name);

    let scanned_at_epoch_ms = current_epoch_ms()?;
    let cache = FireTvAppCache {
        scanned_at_epoch_ms,
        apps: apps.clone(),
    };
    write_app_cache(&cache)?;

    Ok(FireTvAppScanResult {
        target: target.clone(),
        scanned_at_epoch_ms,
        summary: format!("Scanned {} launchable packages from {target}", apps.len()),
        apps,
    })
}

pub fn launch_app(ip: &str, package_name: &str) -> Result<String> {
    let trimmed_ip = ip.trim();
    if trimmed_ip.is_empty() {
        bail!("Fire TV IP address is required. Enter the TV's local IP address from the Fire TV network settings.");
    }

    let package_name = package_name.trim();
    if package_name.is_empty() {
        bail!("Package name is required");
    }

    ensure_adb_available()?;
    let target = normalize_target(trimmed_ip);

    if !connect(&target)? {
        bail!(fire_tv_unreachable_message(&target));
    }

    let awake = ensure_awake(&target, 4)?;
    if !awake {
        bail!("Fire TV at {target} did not wake after retries");
    }

    run_adb(&["-s", &target, "shell", "monkey", "-p", package_name, "1"])?;
    Ok(format!("Launched {package_name} on {target}"))
}

fn adb_available() -> bool {
    run_adb_with_timeout(&["version"], ADB_STATUS_TIMEOUT).is_ok()
}

fn adb_unavailable_message(error: &anyhow::Error) -> String {
    format!(
        "ADB is not available. Install Android Platform Tools, make sure `adb` is in PATH, then restart Sendo. Details: {error}"
    )
}

fn fire_tv_unreachable_message(target: &str) -> String {
    format!(
        "Fire TV at {target} is not reachable over ADB. Check the IP address, make sure the TV is on the same network, enable ADB debugging, accept the debugging prompt on the TV, then retry."
    )
}

fn ensure_adb_available() -> Result<()> {
    run_adb_with_timeout(&["version"], ADB_STATUS_TIMEOUT)
        .map(|_| ())
        .map_err(|error| anyhow!(adb_unavailable_message(&error)))
}

fn connect(target: &str) -> Result<bool> {
    let output = run_adb_with_timeout(&["connect", target], ADB_STATUS_TIMEOUT)
        .with_context(|| fire_tv_unreachable_message(target))?;
    let normalized = output.to_ascii_lowercase();

    if normalized.contains("cannot")
        || normalized.contains("unable")
        || normalized.contains("failed")
        || normalized.contains("refused")
    {
        return Ok(false);
    }

    let devices = run_adb_with_timeout(&["devices"], ADB_STATUS_TIMEOUT)?;
    Ok(devices
        .lines()
        .skip(1)
        .filter_map(parse_devices_line)
        .any(|device| device == target))
}

fn parse_devices_line(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut parts = trimmed.split_whitespace();
    let serial = parts.next()?;
    let state = parts.next()?;

    if state == "device" {
        Some(serial.to_string())
    } else {
        None
    }
}

fn normalize_target(ip: &str) -> String {
    if ip.contains(':') {
        ip.to_string()
    } else {
        format!("{ip}:{DEFAULT_ADB_PORT}")
    }
}

fn key_code_for(action: FireTvAction) -> &'static str {
    match action {
        FireTvAction::Connect => "KEYCODE_UNKNOWN",
        FireTvAction::EnsureAwake => "KEYCODE_WAKEUP",
        FireTvAction::LaunchSpotify => "KEYCODE_UNKNOWN",
        FireTvAction::Wake => "KEYCODE_WAKEUP",
        FireTvAction::PowerOff => "KEYCODE_SLEEP",
        FireTvAction::Home => "KEYCODE_HOME",
        FireTvAction::Back => "KEYCODE_BACK",
        FireTvAction::Up => "KEYCODE_DPAD_UP",
        FireTvAction::Down => "KEYCODE_DPAD_DOWN",
        FireTvAction::Left => "KEYCODE_DPAD_LEFT",
        FireTvAction::Right => "KEYCODE_DPAD_RIGHT",
        FireTvAction::Select => "KEYCODE_DPAD_CENTER",
        FireTvAction::PlayPause => "KEYCODE_MEDIA_PLAY_PAUSE",
        FireTvAction::VolumeUp => "KEYCODE_VOLUME_UP",
        FireTvAction::VolumeDown => "KEYCODE_VOLUME_DOWN",
    }
}

fn screen_is_on(target: &str) -> Result<bool> {
    let output = run_adb_with_timeout(
        &["-s", target, "shell", "dumpsys", "power"],
        ADB_STATUS_TIMEOUT,
    )?;
    let normalized = output.to_ascii_lowercase();

    Ok(normalized.contains("minteractive=true")
        || normalized.contains("mscreenon=true")
        || normalized.contains("state=on")
        || normalized.contains("mwakefulness=awake")
        || normalized.contains("mwakefulness=dreaming"))
}

fn ensure_awake(target: &str, max_tries: u32) -> Result<bool> {
    for _ in 0..max_tries {
        if screen_is_on(target)? {
            return Ok(true);
        }

        run_adb_with_timeout(
            &["-s", target, "shell", "input", "keyevent", "224"],
            ADB_ACTION_TIMEOUT,
        )?;
        thread::sleep(Duration::from_millis(800));
    }

    screen_is_on(target)
}

fn open_spotify(target: &str) -> Result<()> {
    run_adb_with_timeout(
        &[
            "-s",
            target,
            "shell",
            "monkey",
            "-p",
            "com.spotify.tv.android",
            "1",
        ],
        ADB_ACTION_TIMEOUT,
    )?;
    Ok(())
}

fn run_adb(args: &[&str]) -> Result<String> {
    run_adb_with_timeout(args, ADB_ACTION_TIMEOUT)
}

fn run_adb_with_timeout(args: &[&str], wait_timeout: Duration) -> Result<String> {
    let mut command = Command::new("adb");
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    suppress_process_window(&mut command);

    let mut child = command
        .spawn()
        .with_context(|| format!("failed to execute adb {}", args.join(" ")))?;

    let stdout = child
        .stdout
        .take()
        .context("failed to capture adb stdout pipe")?;
    let stderr = child
        .stderr
        .take()
        .context("failed to capture adb stderr pipe")?;
    let stdout_reader = read_adb_stdout(stdout);
    let stderr_reader = read_adb_stderr(stderr);

    let start_time = Instant::now();
    loop {
        if child
            .try_wait()
            .with_context(|| format!("failed to wait for adb {}", args.join(" ")))?
            .is_some()
        {
            break;
        }

        if start_time.elapsed() >= wait_timeout {
            let _ = child.kill();
            let _ = child.wait();
            bail!(
                "adb {} timed out after {}s",
                args.join(" "),
                wait_timeout.as_secs()
            );
        }

        thread::sleep(Duration::from_millis(50));
    }

    let status = child
        .wait()
        .with_context(|| format!("failed to wait for adb {}", args.join(" ")))?;

    let stdout = String::from_utf8_lossy(&join_adb_reader(stdout_reader, "stdout")?)
        .trim()
        .to_string();
    let stderr = String::from_utf8_lossy(&join_adb_reader(stderr_reader, "stderr")?)
        .trim()
        .to_string();

    if status.success() {
        if !stdout.is_empty() {
            return Ok(stdout);
        }

        return Ok(stderr);
    }

    if !stderr.is_empty() {
        bail!(stderr);
    }

    if !stdout.is_empty() {
        bail!(stdout);
    }

    bail!("adb exited with status {status}");
}

#[cfg(target_os = "windows")]
fn suppress_process_window(command: &mut Command) {
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(target_os = "windows"))]
fn suppress_process_window(_command: &mut Command) {}

fn read_adb_stdout(mut stdout: ChildStdout) -> JoinHandle<Result<Vec<u8>>> {
    thread::spawn(move || {
        let mut buffer = Vec::new();
        stdout
            .read_to_end(&mut buffer)
            .context("failed to read adb stdout")?;
        Ok(buffer)
    })
}

fn read_adb_stderr(mut stderr: ChildStderr) -> JoinHandle<Result<Vec<u8>>> {
    thread::spawn(move || {
        let mut buffer = Vec::new();
        stderr
            .read_to_end(&mut buffer)
            .context("failed to read adb stderr")?;
        Ok(buffer)
    })
}

fn join_adb_reader(reader: JoinHandle<Result<Vec<u8>>>, stream_name: &str) -> Result<Vec<u8>> {
    reader
        .join()
        .map_err(|_| anyhow!("adb {stream_name} reader thread panicked"))?
}

fn infer_display_name(package_name: &str) -> String {
    package_name
        .split('.')
        .last()
        .unwrap_or(package_name)
        .split(['_', '-'])
        .filter(|part| !part.is_empty())
        .map(title_case)
        .collect::<Vec<_>>()
        .join(" ")
}

fn title_case(value: &str) -> String {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return String::new();
    };

    format!(
        "{}{}",
        first.to_ascii_uppercase(),
        chars.as_str().to_ascii_lowercase()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adb_unavailable_message_mentions_install_and_path() {
        let message = adb_unavailable_message(&anyhow!("program not found"));

        assert!(message.contains("Install Android Platform Tools"));
        assert!(message.contains("PATH"));
        assert!(message.contains("program not found"));
    }

    #[test]
    fn fire_tv_unreachable_message_lists_next_steps() {
        let message = fire_tv_unreachable_message("192.168.1.50:5555");

        assert!(message.contains("192.168.1.50:5555"));
        assert!(message.contains("IP address"));
        assert!(message.contains("same network"));
        assert!(message.contains("ADB debugging"));
        assert!(message.contains("debugging prompt"));
    }
}

fn current_epoch_ms() -> Result<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("system clock is before unix epoch")?
        .as_millis() as u64)
}

fn apps_cache_path() -> Result<PathBuf> {
    Ok(app_data_dir()?.join("firetv-apps.json"))
}

fn write_app_cache(cache: &FireTvAppCache) -> Result<()> {
    let path = apps_cache_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| {
            format!(
                "failed to create Fire TV app cache dir at {}",
                parent.display()
            )
        })?;
    }

    let raw =
        serde_json::to_string_pretty(cache).context("failed to serialize Fire TV app cache")?;
    fs::write(&path, raw)
        .with_context(|| format!("failed to write Fire TV app cache at {}", path.display()))?;

    Ok(())
}

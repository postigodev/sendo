use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::process::Command;

const DEFAULT_ADB_PORT: &str = "5555";

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FireTvAction {
    Connect,
    EnsureAwake,
    LaunchSpotify,
    Wake,
    Home,
    Back,
    Up,
    Down,
    Left,
    Right,
    Select,
    PlayPause,
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
            summary: "Missing Fire TV IP address".into(),
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
        format!("ADB is available, but Fire TV did not report as connected at {target}")
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
        bail!("Fire TV IP address is required");
    }

    ensure_adb_available()?;
    let target = normalize_target(trimmed_ip);

    if !connect(&target)? {
        bail!("ADB could not establish a connection with {target}");
    }

    match action {
        FireTvAction::Connect => Ok(format!("Connected to {target}")),
        FireTvAction::EnsureAwake => {
            let awake = ensure_awake(&target, 4)?;
            if awake {
                Ok(format!("Fire TV at {target} is awake"))
            } else {
                bail!("Fire TV at {target} did not wake after retries")
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

fn adb_available() -> bool {
    run_adb(&["version"]).is_ok()
}

fn ensure_adb_available() -> Result<()> {
    run_adb(&["version"])
        .map(|_| ())
        .map_err(|error| anyhow!("ADB is not available: {error}"))
}

fn connect(target: &str) -> Result<bool> {
    let output = run_adb(&["connect", target])?;
    let normalized = output.to_ascii_lowercase();

    if normalized.contains("cannot")
        || normalized.contains("unable")
        || normalized.contains("failed")
        || normalized.contains("refused")
    {
        return Ok(false);
    }

    let devices = run_adb(&["devices"])?;
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
        FireTvAction::Home => "KEYCODE_HOME",
        FireTvAction::Back => "KEYCODE_BACK",
        FireTvAction::Up => "KEYCODE_DPAD_UP",
        FireTvAction::Down => "KEYCODE_DPAD_DOWN",
        FireTvAction::Left => "KEYCODE_DPAD_LEFT",
        FireTvAction::Right => "KEYCODE_DPAD_RIGHT",
        FireTvAction::Select => "KEYCODE_DPAD_CENTER",
        FireTvAction::PlayPause => "KEYCODE_MEDIA_PLAY_PAUSE",
    }
}

fn screen_is_on(target: &str) -> Result<bool> {
    let output = run_adb(&["-s", target, "shell", "dumpsys", "power"])?;
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

        run_adb(&["-s", target, "shell", "input", "keyevent", "224"])?;
        std::thread::sleep(std::time::Duration::from_millis(800));
    }

    screen_is_on(target)
}

fn open_spotify(target: &str) -> Result<()> {
    run_adb(&[
        "-s",
        target,
        "shell",
        "monkey",
        "-p",
        "com.spotify.tv.android",
        "1",
    ])?;
    Ok(())
}

fn run_adb(args: &[&str]) -> Result<String> {
    let output = Command::new("adb")
        .args(args)
        .output()
        .with_context(|| format!("failed to execute adb {}", args.join(" ")))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
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

    bail!("adb exited with status {}", output.status);
}

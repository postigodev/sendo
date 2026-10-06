use crate::{
    config::{app_data_dir, AppConfig},
    SpotifyAuthDebug,
};
use anyhow::{anyhow, bail, Context, Result};
use rand::{distr::Alphanumeric, Rng};
use rspotify::{
    clients::OAuthClient, model::AdditionalType, prelude::BaseClient, scopes, AuthCodePkceSpotify,
    Config, Credentials, OAuth,
};
use serde::Serialize;
use std::{fs, net::IpAddr, path::PathBuf};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    net::TcpListener,
    time::{sleep, timeout, Duration},
};
use url::Url;

const AUTH_CALLBACK_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Debug, Clone, Serialize)]
pub struct SpotifyNowPlaying {
    pub is_playing: bool,
    pub track_name: Option<String>,
    pub artist_name: Option<String>,
    pub album_name: Option<String>,
    pub album_cover_url: Option<String>,
    pub progress_ms: Option<u64>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpotifyStatus {
    pub configured: bool,
    pub authenticated: bool,
    pub target_found: bool,
    pub target_id: Option<String>,
    pub target_name: Option<String>,
    pub target_ambiguous: bool,
    pub available_devices: Vec<SpotifyDevice>,
    pub playback_on_target: bool,
    pub playback_device_name: Option<String>,
    pub now_playing: Option<SpotifyNowPlaying>,
    pub summary: String,
    pub auth_url: Option<String>,
    pub token_cache_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpotifyDevice {
    pub id: Option<String>,
    pub name: String,
    pub is_active: bool,
    pub is_restricted: bool,
    pub is_selected_target: bool,
    pub matches_hints: bool,
}

#[derive(Debug, Clone)]
struct PlaybackSnapshot {
    device_id: Option<String>,
    device_name: Option<String>,
    now_playing: Option<SpotifyNowPlaying>,
}

#[derive(Debug, Clone)]
struct TargetDevice {
    id: String,
    name: String,
}

#[derive(Debug, Clone)]
struct TargetResolution {
    device: Option<TargetDevice>,
    selected_missing: bool,
    ambiguous: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpotifyAuthStart {
    pub authorize_url: String,
    pub token_cache_path: String,
}

pub fn status_summary(client_id: &str, redirect_url: &str) -> String {
    match validate_spotify_config(client_id, redirect_url) {
        Ok(()) => "Spotify OAuth settings are present".into(),
        Err(reason) => reason.into(),
    }
}

pub async fn get_status(config: &AppConfig) -> Result<SpotifyStatus> {
    let configured = spotify_configured(config);
    let token_cache_path = token_cache_path()?.display().to_string();

    if !configured {
        return Ok(SpotifyStatus {
            configured: false,
            authenticated: false,
            target_found: false,
            target_id: None,
            target_name: None,
            target_ambiguous: false,
            available_devices: vec![],
            playback_on_target: false,
            playback_device_name: None,
            now_playing: None,
            summary: spotify_config_error(config).into(),
            auth_url: None,
            token_cache_path,
        });
    }

    let spotify = build_spotify(config)?;
    let auth_url = (!config.spotify_auth_url.is_empty()).then(|| config.spotify_auth_url.clone());

    let auth_result = ensure_token(&spotify).await;
    let authenticated = auth_result.is_ok();
    if !authenticated {
        let auth_summary = auth_result
            .err()
            .map(|error| {
                let detail = error.to_string();
                if detail.contains("failed to refresh expired Spotify token") {
                    "Your Spotify session expired. Re-authenticate Spotify to continue.".to_string()
                } else if detail.contains("Spotify is not authenticated yet") {
                    "Spotify is configured but not authenticated yet.".to_string()
                } else {
                    format!("Spotify authentication is unavailable. {detail}")
                }
            })
            .unwrap_or_else(|| "Spotify is configured but not authenticated yet.".into());

        return Ok(SpotifyStatus {
            configured: true,
            authenticated: false,
            target_found: false,
            target_id: None,
            target_name: None,
            target_ambiguous: false,
            available_devices: vec![],
            playback_on_target: false,
            playback_device_name: None,
            now_playing: None,
            summary: auth_summary,
            auth_url,
            token_cache_path,
        });
    }

    let available_devices =
        fetch_available_devices(&spotify, &config.spotify_target_hint_list()).await?;
    let target_resolution = resolve_target_device(config, &available_devices);
    let playback = fetch_playback_snapshot(&spotify)
        .await
        .context("failed to fetch Spotify now playing state")?;
    let (target_found, target_id, target_name, playback_on_target, now_playing, summary) =
        if let Some(device) = target_resolution.device.as_ref() {
            let name = device.name.clone();
            let id = Some(device.id.clone());
            let playback_on_target = is_playback_on_target(Some(device), &playback);
            (
                true,
                id,
                Some(name.clone()),
                playback_on_target,
                if playback_on_target {
                    playback.now_playing.clone()
                } else {
                    None
                },
                format!("Spotify authenticated; target device found: {name}"),
            )
        } else {
            (
                false,
                None,
                None,
                false,
                None,
                if target_resolution.selected_missing {
                    "Selected Spotify TV target is unavailable. Pick another device or open Spotify on that TV.".into()
                } else if target_resolution.ambiguous {
                    "Multiple Spotify TV targets match your hints. Select one manually.".into()
                } else {
                    "Spotify authenticated, but no target TV device matched the configured hints"
                        .into()
                },
            )
        };

    Ok(SpotifyStatus {
        configured: true,
        authenticated: true,
        target_found,
        target_id,
        target_name,
        target_ambiguous: target_resolution.ambiguous,
        available_devices: mark_selected_devices(
            available_devices,
            target_resolution.device.as_ref(),
        ),
        playback_on_target,
        playback_device_name: playback.device_name,
        now_playing,
        summary,
        auth_url,
        token_cache_path,
    })
}

pub async fn start_auth(config: &AppConfig) -> Result<SpotifyAuthStart> {
    if !spotify_configured(config) {
        bail!("{}", spotify_config_error(config));
    }

    validate_pending_auth(config)?;

    Ok(SpotifyAuthStart {
        authorize_url: config.spotify_auth_url.clone(),
        token_cache_path: token_cache_path()?.display().to_string(),
    })
}

pub fn prepare_auth(config: &mut AppConfig) -> Result<()> {
    prepare_auth_at(config, token_cache_path()?)
}

fn prepare_auth_at(config: &mut AppConfig, cache_path: PathBuf) -> Result<()> {
    if !spotify_configured(config) {
        bail!("{}", spotify_config_error(config));
    }

    config.spotify_auth_state = rand::rng()
        .sample_iter(&Alphanumeric)
        .take(24)
        .map(char::from)
        .collect();

    let mut spotify = spotify_client(config, cache_path);
    // Each authorize-URL call generates a new verifier. Persist the pair once
    // so independently rebuilt callback clients exchange the matching verifier.
    config.spotify_auth_url = spotify
        .get_authorize_url(None)
        .context("failed to generate Spotify PKCE authorize URL")?;
    config.spotify_auth_verifier = spotify
        .verifier
        .context("Spotify did not generate a PKCE verifier")?;

    Ok(())
}

pub async fn finish_auth(config: &AppConfig, code_or_callback: &str) -> Result<SpotifyStatus> {
    if !spotify_configured(config) {
        bail!("{}", spotify_config_error(config));
    }

    validate_pending_auth(config)?;
    let spotify = build_spotify(config)?;
    ensure_token_cache_dir()?;

    exchange_callback_or_code(&spotify, code_or_callback).await?;

    get_status(config).await
}

pub async fn finish_auth_via_local_callback(config: &AppConfig) -> Result<SpotifyStatus> {
    if !spotify_configured(config) {
        bail!("{}", spotify_config_error(config));
    }

    validate_pending_auth(config)?;
    let spotify = build_spotify(config)?;
    ensure_token_cache_dir()?;
    let socket_addr = spotify
        .get_socket_address(&config.spotify_redirect_url)
        .ok_or_else(|| anyhow!("Spotify redirect URL must be an HTTP loopback URL with a port"))?;
    let code =
        receive_auth_code_from_local_callback(&spotify, socket_addr, AUTH_CALLBACK_TIMEOUT).await?;

    spotify
        .request_token(&code)
        .await
        .context("failed to exchange Spotify authorization code for a token")?;

    get_status(config).await
}

pub async fn debug_auth_flow(config: &AppConfig) -> Result<SpotifyAuthDebug> {
    if !spotify_configured(config) {
        bail!("{}", spotify_config_error(config));
    }

    let spotify = build_spotify(config)?;
    let socket_addr = spotify
        .get_socket_address(&config.spotify_redirect_url)
        .ok_or_else(|| anyhow!("Spotify redirect URL must be an HTTP loopback URL with a port"))?;

    Ok(SpotifyAuthDebug {
        stage: "ready".into(),
        detail: format!("Listener socket resolved to {socket_addr}"),
        state: config.spotify_auth_state.clone(),
        redirect_uri: config.spotify_redirect_url.clone(),
        token_cache_path: token_cache_path()?.display().to_string(),
    })
}

pub async fn toggle_on_tv(config: &AppConfig) -> Result<String> {
    if !spotify_configured(config) {
        bail!("{}", spotify_config_error(config));
    }

    let spotify = build_spotify(config)?;
    ensure_token(&spotify).await?;

    let target = resolve_control_target(config, &spotify).await?;
    let target_id = target.id.clone();
    let target_name = target.name.clone();

    let playback = spotify
        .current_playback(None, Some(&[AdditionalType::Episode]))
        .await
        .context("failed to fetch current Spotify playback")?;

    let is_playing = playback
        .as_ref()
        .map(|item| item.is_playing)
        .unwrap_or(false);
    let current_device_id = playback
        .as_ref()
        .and_then(|item| item.device.id.as_ref().map(|id| id.to_string()));

    if current_device_id.as_deref() == Some(target_id.as_str()) {
        if is_playing {
            spotify
                .pause_playback(Some(target_id.as_str()))
                .await
                .context("failed to pause playback on TV")?;
            return Ok(format!("Paused Spotify on {target_name}"));
        }

        spotify
            .resume_playback(Some(target_id.as_str()), None)
            .await
            .context("failed to resume playback on TV")?;
        return Ok(format!("Resumed Spotify on {target_name}"));
    }

    spotify
        .transfer_playback(&target_id, Some(false))
        .await
        .context("failed to transfer Spotify playback to TV")?;
    sleep(Duration::from_millis(300)).await;

    let _ = spotify
        .resume_playback(Some(target_id.as_str()), None)
        .await;
    Ok(format!("Transferred Spotify playback to {target_name}"))
}

pub async fn transfer_to_tv(config: &AppConfig) -> Result<String> {
    if !spotify_configured(config) {
        bail!("{}", spotify_config_error(config));
    }

    let spotify = build_spotify(config)?;
    ensure_token(&spotify).await?;

    let target = resolve_control_target(config, &spotify).await?;
    let target_id = target.id.clone();
    let target_name = target.name.clone();

    spotify
        .transfer_playback(&target_id, Some(false))
        .await
        .context("failed to transfer Spotify playback to TV")?;
    sleep(Duration::from_millis(300)).await;
    let _ = spotify
        .resume_playback(Some(target_id.as_str()), None)
        .await;

    Ok(format!("Transferred Spotify playback to {target_name}"))
}

pub async fn toggle_playback(config: &AppConfig) -> Result<String> {
    if !spotify_configured(config) {
        bail!("{}", spotify_config_error(config));
    }

    let spotify = build_spotify(config)?;
    ensure_token(&spotify).await?;

    let target = resolve_control_target(config, &spotify).await?;
    let target_id = target.id.clone();
    let target_name = target.name.clone();

    let playback = spotify
        .current_playback(None, Some(&[AdditionalType::Episode]))
        .await
        .context("failed to fetch current Spotify playback")?;

    let is_playing = playback
        .as_ref()
        .map(|item| item.is_playing)
        .unwrap_or(false);
    let current_device_id = playback
        .as_ref()
        .and_then(|item| item.device.id.as_ref().map(|id| id.to_string()));
    let playback_on_target = current_device_id.as_deref() == Some(target_id.as_str());

    if playback_on_target && is_playing {
        spotify
            .pause_playback(Some(target_id.as_str()))
            .await
            .context("failed to pause Spotify playback")?;
        return Ok(format!("Paused Spotify on {target_name}"));
    }

    spotify
        .resume_playback(Some(target_id.as_str()), None)
        .await
        .context("failed to resume Spotify playback")?;
    Ok(format!("Resumed Spotify on {target_name}"))
}

pub async fn skip_next(config: &AppConfig) -> Result<String> {
    if !spotify_configured(config) {
        bail!("{}", spotify_config_error(config));
    }

    let spotify = build_spotify(config)?;
    ensure_token(&spotify).await?;
    let target = resolve_control_target(config, &spotify).await?;
    let target_id = target.id.clone();
    spotify
        .next_track(Some(target_id.as_str()))
        .await
        .context("failed to skip to the next Spotify track")?;
    Ok("Skipped to the next track".into())
}

pub async fn skip_previous(config: &AppConfig) -> Result<String> {
    if !spotify_configured(config) {
        bail!("{}", spotify_config_error(config));
    }

    let spotify = build_spotify(config)?;
    ensure_token(&spotify).await?;
    let target = resolve_control_target(config, &spotify).await?;
    let target_id = target.id.clone();
    spotify
        .previous_track(Some(target_id.as_str()))
        .await
        .context("failed to return to the previous Spotify track")?;
    Ok("Went back to the previous track".into())
}

pub async fn start_on_tv(config: &AppConfig) -> Result<String> {
    let firetv_result = crate::firetv::prepare_spotify_session(&config.firetv_ip)?;
    if !spotify_configured(config) {
        bail!("{}", spotify_config_error(config));
    }
    let spotify = build_spotify(config)?;
    ensure_token(&spotify).await?;
    let target = resolve_control_target(config, &spotify).await?;
    let spotify_result = ensure_target_playing(&spotify, &target).await?;

    Ok(format!("{}. {}", firetv_result.summary, spotify_result))
}

async fn ensure_target_playing(
    spotify: &AuthCodePkceSpotify,
    target: &TargetDevice,
) -> Result<String> {
    let playback = spotify
        .current_playback(None, Some(&[AdditionalType::Episode]))
        .await
        .context("failed to fetch current Spotify playback")?;
    let on_target =
        playback.as_ref().and_then(|item| item.device.id.as_deref()) == Some(target.id.as_str());
    if on_target && playback.as_ref().is_some_and(|item| item.is_playing) {
        return Ok(format!("Spotify is already playing on {}", target.name));
    }
    if !on_target {
        spotify
            .transfer_playback(&target.id, Some(false))
            .await
            .context("failed to transfer Spotify playback to TV")?;
        sleep(Duration::from_millis(300)).await;
    }
    spotify
        .resume_playback(Some(&target.id), None)
        .await
        .context("failed to resume playback on TV")?;
    Ok(format!("Started Spotify on {}", target.name))
}

fn spotify_configured(config: &AppConfig) -> bool {
    validate_spotify_config(&config.spotify_client_id, &config.spotify_redirect_url).is_ok()
}

fn spotify_config_error(config: &AppConfig) -> &'static str {
    validate_spotify_config(&config.spotify_client_id, &config.spotify_redirect_url)
        .expect_err("spotify_config_error called for an invalid config")
}

pub(crate) fn validate_spotify_config(
    client_id: &str,
    redirect_url: &str,
) -> Result<(), &'static str> {
    if client_id.trim().is_empty() {
        return Err("Spotify client ID is required");
    }

    validate_redirect_url(redirect_url)
}

fn validate_redirect_url(redirect_url: &str) -> Result<(), &'static str> {
    let parsed = Url::parse(redirect_url.trim())
        .map_err(|_| "Spotify redirect URL must be a valid HTTP loopback URL with a port")?;

    if parsed.scheme() != "http" || parsed.port().is_none() {
        return Err("Spotify redirect URL must be an HTTP loopback URL with a port");
    }

    let host = parsed
        .host_str()
        .ok_or("Spotify redirect URL must use a loopback IP address")?;
    let host = host
        .strip_prefix('[')
        .and_then(|host| host.strip_suffix(']'))
        .unwrap_or(host);
    let ip = host
        .parse::<IpAddr>()
        .map_err(|_| "Spotify redirect URL must use a loopback IP address")?;
    if !ip.is_loopback() {
        return Err("Spotify redirect URL must use a loopback IP address");
    }

    Ok(())
}

fn build_spotify(config: &AppConfig) -> Result<AuthCodePkceSpotify> {
    ensure_token_cache_dir()?;
    Ok(spotify_client(config, token_cache_path()?))
}

fn spotify_client(config: &AppConfig, cache_path: PathBuf) -> AuthCodePkceSpotify {
    let creds = Credentials::new_pkce(&config.spotify_client_id);
    let oauth = OAuth {
        redirect_uri: config.spotify_redirect_url.clone(),
        state: config.spotify_auth_state.clone(),
        scopes: scopes!(
            "user-read-playback-state",
            "user-modify-playback-state",
            "user-read-currently-playing"
        ),
        ..Default::default()
    };

    let client_config = Config {
        token_cached: true,
        token_refreshing: true,
        cache_path,
        ..Default::default()
    };

    let mut spotify = AuthCodePkceSpotify::with_config(creds, oauth, client_config);
    spotify.verifier =
        (!config.spotify_auth_verifier.is_empty()).then(|| config.spotify_auth_verifier.clone());
    spotify
}

fn validate_pending_auth(config: &AppConfig) -> Result<()> {
    if config.spotify_auth_state.is_empty()
        || config.spotify_auth_url.is_empty()
        || !(43..=128).contains(&config.spotify_auth_verifier.len())
    {
        bail!("No pending Spotify PKCE login. Start Spotify auth again before completing the callback.");
    }
    Ok(())
}

async fn ensure_token(spotify: &AuthCodePkceSpotify) -> Result<()> {
    if let Ok(Some(cached_token)) = spotify.read_token_cache(true).await {
        let is_expired = cached_token.is_expired();

        {
            let token_mutex = spotify.get_token();
            let mut guard = token_mutex
                .lock()
                .await
                .map_err(|error| anyhow!("{error:?}"))?;
            *guard = Some(cached_token);
        }

        if !is_expired {
            return Ok(());
        }

        spotify
            .refresh_token()
            .await
            .context("failed to refresh expired Spotify token")?;
        return Ok(());
    }

    let token_mutex = spotify.get_token();
    let guard = token_mutex
        .lock()
        .await
        .map_err(|error| anyhow!("{error:?}"))?;

    if let Some(token) = guard.as_ref() {
        if !token.is_expired() {
            return Ok(());
        }
    } else {
        bail!("Spotify is not authenticated yet");
    }

    drop(guard);

    spotify
        .refresh_token()
        .await
        .context("failed to refresh expired Spotify token")?;

    Ok(())
}

async fn resolve_control_target(
    config: &AppConfig,
    spotify: &AuthCodePkceSpotify,
) -> Result<TargetDevice> {
    for attempt in 0..5 {
        let available_devices =
            fetch_available_devices(spotify, &config.spotify_target_hint_list()).await?;
        let resolution = resolve_target_device(config, &available_devices);
        if let Some(device) = resolution.device {
            return Ok(device);
        }

        if resolution.selected_missing {
            bail!("Selected Spotify TV target is unavailable. Pick another device or open Spotify on that TV.");
        }

        if resolution.ambiguous {
            bail!("Multiple Spotify TV targets match your hints. Select one manually.");
        }

        if attempt < 4 {
            sleep(Duration::from_secs(1)).await;
        }
    }

    bail!("TV device not found in Spotify Connect devices");
}

async fn fetch_available_devices(
    spotify: &AuthCodePkceSpotify,
    hints: &[String],
) -> Result<Vec<SpotifyDevice>> {
    let devices = spotify
        .device()
        .await
        .context("failed to fetch Spotify devices")?;
    Ok(devices
        .into_iter()
        .map(|device| SpotifyDevice {
            id: device.id.as_ref().map(|value| value.to_string()),
            name: device.name.clone(),
            is_active: device.is_active,
            is_restricted: device.is_restricted,
            is_selected_target: false,
            matches_hints: device_matches(&device, hints),
        })
        .collect())
}

fn resolve_target_device(config: &AppConfig, devices: &[SpotifyDevice]) -> TargetResolution {
    let selected_id = config.spotify_selected_device_id.trim();

    if !selected_id.is_empty() {
        if let Some(device) = devices
            .iter()
            .find(|device| device.id.as_deref() == Some(selected_id))
        {
            if let Some(id) = device.id.clone() {
                return TargetResolution {
                    device: Some(TargetDevice {
                        id,
                        name: device.name.clone(),
                    }),
                    selected_missing: false,
                    ambiguous: false,
                };
            }
        }

        return TargetResolution {
            device: None,
            selected_missing: true,
            ambiguous: false,
        };
    }

    let matched_devices = devices
        .iter()
        .filter(|device| device.matches_hints)
        .filter_map(|device| {
            device.id.as_ref().map(|id| TargetDevice {
                id: id.clone(),
                name: device.name.clone(),
            })
        })
        .collect::<Vec<_>>();

    TargetResolution {
        device: matched_devices
            .first()
            .cloned()
            .filter(|_| matched_devices.len() == 1),
        selected_missing: false,
        ambiguous: matched_devices.len() > 1,
    }
}

fn mark_selected_devices(
    devices: Vec<SpotifyDevice>,
    target: Option<&TargetDevice>,
) -> Vec<SpotifyDevice> {
    let selected_id = target.map(|device| device.id.as_str());
    devices
        .into_iter()
        .map(|device| SpotifyDevice {
            is_selected_target: device
                .id
                .as_deref()
                .zip(selected_id)
                .is_some_and(|(id, target_id)| id == target_id),
            ..device
        })
        .collect()
}

fn is_playback_on_target(target: Option<&TargetDevice>, playback: &PlaybackSnapshot) -> bool {
    target
        .map(|device| device.id.as_str())
        .zip(playback.device_id.as_deref())
        .is_some_and(|(target_id, playback_id)| target_id == playback_id)
}

async fn fetch_playback_snapshot(spotify: &AuthCodePkceSpotify) -> Result<PlaybackSnapshot> {
    let playback = spotify
        .current_playback(None, Some(&[AdditionalType::Episode]))
        .await?;

    let Some(playback) = playback else {
        return Ok(PlaybackSnapshot {
            device_id: None,
            device_name: None,
            now_playing: None,
        });
    };

    let progress_ms = playback
        .progress
        .map(|value| value.num_milliseconds().max(0) as u64);
    let is_playing = playback.is_playing;
    let device_id = playback.device.id.as_ref().map(|value| value.to_string());
    let device_name = Some(playback.device.name.clone());

    let Some(item) = playback.item else {
        return Ok(PlaybackSnapshot {
            device_id,
            device_name,
            now_playing: Some(SpotifyNowPlaying {
                is_playing,
                track_name: None,
                artist_name: None,
                album_name: None,
                album_cover_url: None,
                progress_ms,
                duration_ms: None,
            }),
        });
    };

    let now_playing = match item {
        rspotify::model::PlayableItem::Track(track) => {
            let album_cover_url = track.album.images.first().map(|image| image.url.clone());
            let artist_name = track
                .artists
                .iter()
                .map(|artist| artist.name.clone())
                .collect::<Vec<_>>()
                .join(", ");

            Some(SpotifyNowPlaying {
                is_playing,
                track_name: Some(track.name),
                artist_name: if artist_name.is_empty() {
                    None
                } else {
                    Some(artist_name)
                },
                album_name: Some(track.album.name),
                album_cover_url,
                progress_ms,
                duration_ms: Some(track.duration.num_milliseconds().max(0) as u64),
            })
        }
        rspotify::model::PlayableItem::Episode(episode) => {
            let album_cover_url = episode.images.first().map(|image| image.url.clone());
            Some(SpotifyNowPlaying {
                is_playing,
                track_name: Some(episode.name),
                artist_name: Some(episode.show.name),
                album_name: None,
                album_cover_url,
                progress_ms,
                duration_ms: Some(episode.duration.num_milliseconds().max(0) as u64),
            })
        }
        rspotify::model::PlayableItem::Unknown(_) => Some(SpotifyNowPlaying {
            is_playing,
            track_name: Some("Unknown Spotify item".into()),
            artist_name: None,
            album_name: None,
            album_cover_url: None,
            progress_ms,
            duration_ms: None,
        }),
    };

    Ok(PlaybackSnapshot {
        device_id,
        device_name,
        now_playing,
    })
}

fn device_matches(device: &rspotify::model::Device, hints: &[String]) -> bool {
    let lower_name = device.name.to_ascii_lowercase();
    hints.iter().any(|hint| lower_name.contains(hint))
}

fn extract_auth_code(code_or_callback: &str) -> Result<String> {
    let trimmed = code_or_callback.trim();
    if trimmed.is_empty() {
        bail!("Spotify authorization code is required");
    }

    if let Some(index) = trimmed.find("code=") {
        let rest = &trimmed[index + 5..];
        let end = rest.find('&').unwrap_or(rest.len());
        let code = &rest[..end];
        if code.is_empty() {
            bail!("Spotify callback URL did not include a code");
        }
        return Ok(code.to_string());
    }

    Ok(trimmed.to_string())
}

async fn exchange_callback_or_code(
    spotify: &AuthCodePkceSpotify,
    code_or_callback: &str,
) -> Result<()> {
    let code = if code_or_callback.contains("://") {
        spotify
            .parse_response_code(code_or_callback)
        .ok_or_else(|| {
            anyhow!(
                "That login response belongs to an older auth request or could not be parsed. Start Spotify auth again."
            )
        })?
    } else {
        extract_auth_code(code_or_callback)?
    };

    spotify
        .request_token(&code)
        .await
        .context("failed to exchange Spotify authorization code for a token")?;

    Ok(())
}

async fn receive_auth_code_from_local_callback(
    spotify: &AuthCodePkceSpotify,
    socket_addr: std::net::SocketAddr,
    wait_timeout: Duration,
) -> Result<String> {
    let listener = TcpListener::bind(socket_addr)
        .await
        .with_context(|| format!("failed to bind Spotify callback listener at {socket_addr}"))?;
    let (mut stream, _) = timeout(wait_timeout, listener.accept())
        .await
        .context(
            "Timed out waiting for Spotify login callback. Try Authenticate again or use Manual callback fallback.",
        )?
        .context("failed to receive Spotify callback through localhost listener")?;

    let mut reader = BufReader::new(&mut stream);
    let mut request_line = String::new();
    reader
        .read_line(&mut request_line)
        .await
        .context("failed to read Spotify callback request")?;

    let redirect_path = request_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| anyhow!("Spotify callback request was malformed"))?;
    let redirect_full_url = format!("{}{}", spotify.get_oauth().redirect_uri, redirect_path);

    let response_body = match spotify.parse_response_code(&redirect_full_url) {
        Some(_) => "Spotify login complete. You can return to Desk Remote.",
        None => "Spotify login failed to validate. Return to Desk Remote and try again.",
    };
    let response = format!(
        "HTTP/1.1 200 OK\r\ncontent-type: text/plain; charset=utf-8\r\ncontent-length: {}\r\n\r\n{}",
        response_body.len(),
        response_body
    );
    stream
        .write_all(response.as_bytes())
        .await
        .context("failed to send Spotify callback response")?;

    spotify
        .parse_response_code(&redirect_full_url)
        .ok_or_else(|| {
            anyhow!(
                "That Spotify callback belongs to an older auth request or could not be validated. Start Spotify auth again."
            )
        })
}

fn token_cache_path() -> Result<PathBuf> {
    Ok(app_data_dir()?.join("spotify-token.json"))
}

fn ensure_token_cache_dir() -> Result<()> {
    let path = token_cache_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| {
            format!(
                "failed to create token cache directory at {}",
                parent.display()
            )
        })?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn public_config() -> AppConfig {
        AppConfig {
            spotify_client_id: "public-client".into(),
            spotify_redirect_url: "http://127.0.0.1:8888/callback".into(),
            ..Default::default()
        }
    }

    #[test]
    fn pkce_session_survives_config_roundtrip_and_validates_callback_state() {
        let mut config = public_config();
        prepare_auth_at(&mut config, PathBuf::from("unused-cache.json")).unwrap();
        let original = config.clone();
        let config: AppConfig =
            serde_json::from_str(&serde_json::to_string(&config).unwrap()).unwrap();
        let spotify = spotify_client(&config, PathBuf::from("unused-cache.json"));
        let url = Url::parse(&config.spotify_auth_url).unwrap();
        let params = url
            .query_pairs()
            .collect::<std::collections::HashMap<_, _>>();
        assert_eq!(params["client_id"], "public-client");
        assert_eq!(params["response_type"], "code");
        assert_eq!(params["code_challenge_method"], "S256");
        assert_eq!(params["code_challenge"].len(), 43);
        assert_eq!(params["state"], config.spotify_auth_state);
        assert_eq!(
            spotify.verifier.as_deref(),
            Some(config.spotify_auth_verifier.as_str())
        );
        assert!(spotify.creds.secret.is_none());
        assert!(spotify.config.token_cached && spotify.config.token_refreshing);
        assert_eq!(config.spotify_auth_url, original.spotify_auth_url);
        assert_eq!(
            spotify.parse_response_code(&format!(
                "{}?code=valid&state={}",
                config.spotify_redirect_url, config.spotify_auth_state
            )),
            Some("valid".into())
        );
        for query in ["code=wrong&state=older", "code=wrong"] {
            assert!(spotify
                .parse_response_code(&format!("{}?{query}", config.spotify_redirect_url))
                .is_none());
        }
        let mut new_session = config.clone();
        prepare_auth_at(&mut new_session, PathBuf::from("unused-cache.json")).unwrap();
        assert_ne!(new_session.spotify_auth_state, config.spotify_auth_state);
        assert_ne!(
            new_session.spotify_auth_verifier,
            config.spotify_auth_verifier
        );
        assert_ne!(new_session.spotify_auth_url, config.spotify_auth_url);
    }

    #[tokio::test]
    async fn legacy_pending_login_requests_reauthentication_instead_of_panicking() {
        let config = public_config();
        let error = finish_auth(&config, "code").await.unwrap_err();
        assert!(error.to_string().contains("Start Spotify auth again"));
    }

    struct TokenCacheDir(PathBuf);
    impl Drop for TokenCacheDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn token_cache_dir() -> TokenCacheDir {
        let directory =
            std::env::temp_dir().join(format!("sendo-pkce-test-{:016x}", rand::random::<u64>()));
        fs::create_dir(&directory).unwrap();
        TokenCacheDir(directory)
    }
    fn token_response() -> String {
        serde_json::json!({"access_token": "fresh-token", "token_type": "Bearer",
            "expires_in": 3600, "refresh_token": "rotated-refresh",
            "scope": "user-read-playback-state user-modify-playback-state user-read-currently-playing"}).to_string()
    }

    #[tokio::test]
    async fn pkce_exchange_uses_persisted_verifier_without_a_client_secret_and_caches_token() {
        let directory = token_cache_dir();
        let path = directory.0.join("spotify-token.json");
        let mut config = public_config();
        prepare_auth_at(&mut config, path.clone()).unwrap();
        let persisted: AppConfig =
            serde_json::from_str(&serde_json::to_string(&config).unwrap()).unwrap();
        let (base_url, server) =
            spotify_server(vec![(200, token_response()), (200, token_response())]).await;
        let mut spotify = spotify_client(&persisted, path.clone());
        spotify.config.auth_base_url = base_url;
        assert!(exchange_callback_or_code(
            &spotify,
            &format!("{}?code=wrong&state=older", persisted.spotify_redirect_url,)
        )
        .await
        .is_err());
        exchange_callback_or_code(
            &spotify,
            &format!(
                "{}?code=auth-code&state={}",
                persisted.spotify_redirect_url, persisted.spotify_auth_state
            ),
        )
        .await
        .unwrap();
        exchange_callback_or_code(&spotify, "manual-code")
            .await
            .unwrap();
        let requests = server.await.unwrap();
        assert_eq!(requests.len(), 2);
        for (request, code) in requests.iter().zip(["auth-code", "manual-code"]) {
            assert!(request.starts_with("POST /api/token "));
            assert!(!request
                .to_ascii_lowercase()
                .contains("authorization: basic"));
            let form =
                url::form_urlencoded::parse(request.rsplit("\r\n").next().unwrap().as_bytes())
                    .collect::<std::collections::HashMap<_, _>>();
            assert_eq!(form["grant_type"], "authorization_code");
            assert_eq!(form["client_id"], "public-client");
            assert_eq!(form["code"], code);
            assert_eq!(form["code_verifier"], persisted.spotify_auth_verifier);
            assert!(!form.contains_key("client_secret"));
        }
        let cached: rspotify::Token =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(cached.access_token, "fresh-token");
        let restarted = spotify_client(&persisted, path);
        ensure_token(&restarted).await.unwrap();
        assert_eq!(
            restarted
                .get_token()
                .lock()
                .await
                .unwrap()
                .as_ref()
                .unwrap()
                .access_token,
            "fresh-token"
        );
    }

    #[tokio::test]
    async fn pkce_refresh_retains_cache_and_persists_rotated_refresh_token() {
        let directory = token_cache_dir();
        let path = directory.0.join("spotify-token.json");
        let mut expired: serde_json::Value = serde_json::from_str(&token_response()).unwrap();
        expired["expires_at"] = "2000-01-01T00:00:00Z".into();
        expired["refresh_token"] = "old-refresh".into();
        fs::write(&path, expired.to_string()).unwrap();
        let (base_url, server) = spotify_server(vec![(200, token_response())]).await;
        let mut spotify = spotify_client(&public_config(), path.clone());
        spotify.config.auth_base_url = base_url;
        ensure_token(&spotify).await.unwrap();
        let requests = server.await.unwrap();
        assert_eq!(requests.len(), 1);
        assert!(requests[0].contains("grant_type=refresh_token"));
        assert!(requests[0].contains("refresh_token=old-refresh"));
        assert!(requests[0].contains("client_id=public-client"));
        assert!(!requests[0].contains("client_secret"));
        let cached: rspotify::Token =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(cached.refresh_token.as_deref(), Some("rotated-refresh"));
        let restarted = spotify_client(&public_config(), path);
        ensure_token(&restarted).await.unwrap();
        assert_eq!(
            restarted
                .get_token()
                .lock()
                .await
                .unwrap()
                .as_ref()
                .unwrap()
                .refresh_token
                .as_deref(),
            Some("rotated-refresh")
        );
    }

    #[tokio::test]
    async fn loopback_callback_preserves_state_validation_for_pkce() {
        use tokio::{io::AsyncReadExt, net::TcpStream};
        for (state, valid) in [("expected", true), ("older", false)] {
            let reservation = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let address = reservation.local_addr().unwrap();
            drop(reservation);
            let spotify = AuthCodePkceSpotify::new(
                Credentials::new_pkce("public-client"),
                OAuth {
                    state: "expected".into(),
                    redirect_uri: format!("http://{address}/callback"),
                    ..Default::default()
                },
            );
            let receiver = tokio::spawn(async move {
                receive_auth_code_from_local_callback(&spotify, address, Duration::from_secs(2))
                    .await
            });
            let mut stream = None;
            for _ in 0..20 {
                if let Ok(connected) = TcpStream::connect(address).await {
                    stream = Some(connected);
                    break;
                }
                sleep(Duration::from_millis(10)).await;
            }
            let mut stream = stream.expect("callback listener bound");
            stream
                .write_all(
                    format!("GET /callback?code=auth-code&state={state} HTTP/1.1\r\n\r\n")
                        .as_bytes(),
                )
                .await
                .unwrap();
            let mut response = String::new();
            stream.read_to_string(&mut response).await.unwrap();
            let result = receiver.await.unwrap();
            assert_eq!(result.is_ok(), valid);
            if valid {
                assert_eq!(result.unwrap(), "auth-code");
            }
            assert!(response.starts_with("HTTP/1.1 200 OK"));
        }
    }

    async fn spotify_server(
        responses: Vec<(u16, String)>,
    ) -> (String, tokio::task::JoinHandle<Vec<String>>) {
        use tokio::io::AsyncReadExt;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let mut requests = Vec::new();
            for (status, body) in responses {
                let (mut stream, _) = timeout(Duration::from_secs(5), listener.accept())
                    .await
                    .unwrap()
                    .unwrap();
                let mut reader = BufReader::new(&mut stream);
                let mut request = String::new();
                let mut length = 0;
                loop {
                    let mut line = String::new();
                    reader.read_line(&mut line).await.unwrap();
                    if line == "\r\n" {
                        break;
                    }
                    if let Some(value) = line.to_ascii_lowercase().strip_prefix("content-length:") {
                        length = value.trim().parse::<usize>().unwrap();
                    }
                    request.push_str(&line);
                }
                let mut payload = vec![0; length];
                reader.read_exact(&mut payload).await.unwrap();
                request.push_str(std::str::from_utf8(&payload).unwrap());
                requests.push(request);
                stream.write_all(format!(
                    "HTTP/1.1 {status} Test\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}", body.len()
                ).as_bytes()).await.unwrap();
            }
            requests
        });
        (format!("http://{address}/"), server)
    }

    async fn playback_client(
        device_id: &str,
        is_playing: bool,
        write_statuses: &[u16],
    ) -> (AuthCodePkceSpotify, tokio::task::JoinHandle<Vec<String>>) {
        let body = serde_json::json!({
            "device": {"id": device_id, "name": "TV", "is_active": true,
                "is_private_session": false, "is_restricted": false,
                "type": "TV", "volume_percent": 50},
            "repeat_state": "off", "shuffle_state": false,
            "timestamp": 0, "is_playing": is_playing, "item": null,
            "currently_playing_type": "unknown", "actions": {"disallows": {}}
        })
        .to_string();
        let mut responses = vec![(200, body)];
        responses.extend(write_statuses.iter().map(|status| (*status, String::new())));
        let (base_url, server) = spotify_server(responses).await;
        let spotify = AuthCodePkceSpotify::from_token_with_config(
            rspotify::Token {
                access_token: "test-token".into(),
                ..Default::default()
            },
            Credentials::default(),
            OAuth::default(),
            Config {
                api_base_url: base_url,
                token_refreshing: false,
                ..Default::default()
            },
        );
        (spotify, server)
    }

    #[tokio::test]
    async fn start_leaves_already_playing_target_running_on_repeated_calls() {
        let target = TargetDevice {
            id: "tv".into(),
            name: "TV".into(),
        };
        for _ in 0..2 {
            let (spotify, server) = playback_client("tv", true, &[]).await;
            assert_eq!(
                ensure_target_playing(&spotify, &target).await.unwrap(),
                "Spotify is already playing on TV"
            );
            let requests = server.await.unwrap();
            assert_eq!(requests.len(), 1);
            assert!(requests[0].starts_with("GET /me/player?"));
        }
    }

    #[tokio::test]
    async fn start_resumes_paused_target_and_routes_playback_elsewhere() {
        let target = TargetDevice {
            id: "tv".into(),
            name: "TV".into(),
        };
        let (spotify, server) = playback_client("tv", false, &[204]).await;
        ensure_target_playing(&spotify, &target).await.unwrap();
        let requests = server.await.unwrap();
        assert_eq!(requests.len(), 2);
        assert!(requests[1].starts_with("PUT /me/player/play?device_id=tv "));

        let (spotify, server) = playback_client("phone", true, &[204, 204]).await;
        ensure_target_playing(&spotify, &target).await.unwrap();
        let requests = server.await.unwrap();
        assert_eq!(requests.len(), 3);
        assert!(requests[1].starts_with("PUT /me/player "));
        assert!(requests[1].contains("\"device_ids\":[\"tv\"]"));
        assert!(requests[2].starts_with("PUT /me/player/play?device_id=tv "));
    }

    #[tokio::test]
    async fn start_reports_transfer_and_resume_failures() {
        let target = TargetDevice {
            id: "tv".into(),
            name: "TV".into(),
        };
        for (device, statuses, expected) in [
            (
                "phone",
                vec![500],
                "failed to transfer Spotify playback to TV",
            ),
            ("phone", vec![204, 500], "failed to resume playback on TV"),
            ("tv", vec![500], "failed to resume playback on TV"),
        ] {
            let (spotify, server) = playback_client(device, false, &statuses).await;
            assert_eq!(
                ensure_target_playing(&spotify, &target)
                    .await
                    .unwrap_err()
                    .to_string(),
                expected
            );
            server.await.unwrap();
        }
    }

    fn config(selected_device_id: &str) -> AppConfig {
        AppConfig {
            spotify_selected_device_id: selected_device_id.into(),
            ..AppConfig::default()
        }
    }

    #[test]
    fn accepts_http_loopback_redirect_with_explicit_port() {
        assert!(validate_redirect_url("http://127.0.0.1:8888/callback").is_ok());
        assert!(validate_redirect_url("http://[::1]:8888/callback").is_ok());
    }

    #[test]
    fn rejects_redirects_that_cannot_receive_a_local_callback() {
        for redirect_url in [
            "",
            "http://127.0.0.1/callback",
            "https://127.0.0.1:8888/callback",
            "http://192.0.2.1:8888/callback",
            "not a URL",
        ] {
            assert!(
                validate_redirect_url(redirect_url).is_err(),
                "expected redirect URL to be rejected: {redirect_url:?}"
            );
        }
    }

    #[test]
    fn status_summary_explains_invalid_redirect_configuration() {
        assert_eq!(
            status_summary("client", "http://127.0.0.1/callback"),
            "Spotify redirect URL must be an HTTP loopback URL with a port"
        );
        assert_eq!(
            status_summary("", "http://127.0.0.1:8888/callback"),
            "Spotify client ID is required"
        );
    }

    fn device(id: Option<&str>, name: &str, matches_hints: bool) -> SpotifyDevice {
        SpotifyDevice {
            id: id.map(str::to_string),
            name: name.into(),
            is_active: false,
            is_restricted: false,
            is_selected_target: false,
            matches_hints,
        }
    }

    fn playback(device_id: Option<&str>) -> PlaybackSnapshot {
        PlaybackSnapshot {
            device_id: device_id.map(str::to_string),
            device_name: None,
            now_playing: None,
        }
    }

    #[test]
    fn selects_the_only_device_matching_configured_hints() {
        let devices = vec![
            device(Some("phone"), "Phone", false),
            device(Some("tv"), "Living Room TV", true),
        ];

        let resolution = resolve_target_device(&config(""), &devices);
        let target = resolution.device.expect("unique target");

        assert_eq!(target.id, "tv");
        assert_eq!(target.name, "Living Room TV");
        assert!(!resolution.selected_missing);
        assert!(!resolution.ambiguous);
    }

    #[test]
    fn requires_manual_selection_when_multiple_devices_match_hints() {
        let devices = vec![
            device(Some("tv-1"), "Living Room TV", true),
            device(Some("tv-2"), "Bedroom TV", true),
        ];

        let resolution = resolve_target_device(&config(""), &devices);

        assert!(resolution.device.is_none());
        assert!(!resolution.selected_missing);
        assert!(resolution.ambiguous);
    }

    #[test]
    fn persisted_selection_wins_over_ambiguous_name_matches() {
        let devices = vec![
            device(Some("tv-1"), "Living Room TV", true),
            device(Some("tv-2"), "Bedroom TV", true),
        ];

        let resolution = resolve_target_device(&config(" tv-2 "), &devices);
        let target = resolution.device.expect("persisted target");

        assert_eq!(target.id, "tv-2");
        assert_eq!(target.name, "Bedroom TV");
        assert!(!resolution.selected_missing);
        assert!(!resolution.ambiguous);
    }

    #[test]
    fn reports_when_persisted_selection_is_no_longer_available() {
        let devices = vec![device(Some("tv-1"), "Living Room TV", true)];

        let resolution = resolve_target_device(&config("missing-tv"), &devices);

        assert!(resolution.device.is_none());
        assert!(resolution.selected_missing);
        assert!(!resolution.ambiguous);
    }

    #[test]
    fn marks_only_the_resolved_target_as_selected() {
        let devices = vec![
            device(Some("phone"), "Phone", false),
            device(Some("tv"), "Living Room TV", true),
        ];
        let target = TargetDevice {
            id: "tv".into(),
            name: "Living Room TV".into(),
        };

        let marked = mark_selected_devices(devices, Some(&target));

        assert!(!marked[0].is_selected_target);
        assert!(marked[1].is_selected_target);
    }

    #[test]
    fn distinguishes_playback_on_target_from_playback_elsewhere() {
        let target = TargetDevice {
            id: "tv".into(),
            name: "Living Room TV".into(),
        };

        assert!(is_playback_on_target(Some(&target), &playback(Some("tv"))));
        assert!(!is_playback_on_target(
            Some(&target),
            &playback(Some("phone"))
        ));
        assert!(!is_playback_on_target(Some(&target), &playback(None)));
        assert!(!is_playback_on_target(None, &playback(Some("tv"))));
    }
}

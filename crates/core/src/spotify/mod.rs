use crate::{config::{app_data_dir, AppConfig}, SpotifyAuthDebug};
use anyhow::{anyhow, bail, Context, Result};
use rand::{distr::Alphanumeric, Rng};
use rspotify::{
    clients::OAuthClient,
    model::AdditionalType,
    prelude::BaseClient,
    scopes, AuthCodeSpotify, Config, Credentials, OAuth,
};
use serde::Serialize;
use std::{fs, path::PathBuf};
use tokio::time::{sleep, Duration};

#[derive(Debug, Clone, Serialize)]
pub struct SpotifyStatus {
    pub configured: bool,
    pub authenticated: bool,
    pub target_found: bool,
    pub target_name: Option<String>,
    pub summary: String,
    pub auth_url: Option<String>,
    pub token_cache_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpotifyAuthStart {
    pub authorize_url: String,
    pub token_cache_path: String,
}

pub fn status_summary(client_id: &str, client_secret: &str, redirect_url: &str) -> String {
    if client_id.trim().is_empty() || client_secret.trim().is_empty() || redirect_url.trim().is_empty() {
        "Spotify OAuth is not configured yet".into()
    } else {
        "Spotify OAuth settings are present".into()
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
            target_name: None,
            summary: "Spotify client ID, client secret, and redirect URL are required".into(),
            auth_url: None,
            token_cache_path,
        });
    }

    let spotify = build_spotify(config)?;
    let auth_url = spotify
        .get_authorize_url(false)
        .context("failed to generate Spotify authorize URL")?;

    let authenticated = ensure_token(&spotify).await.is_ok();
    if !authenticated {
        return Ok(SpotifyStatus {
            configured: true,
            authenticated: false,
            target_found: false,
            target_name: None,
            summary: "Spotify is configured but not authenticated yet".into(),
            auth_url: Some(auth_url),
            token_cache_path,
        });
    }

    let target = find_target_device(&spotify, &config.spotify_target_hint_list()).await?;
    let (target_found, target_name, summary) = if let Some(device) = target {
        let name = device.name;
        (
            true,
            Some(name.clone()),
            format!("Spotify authenticated; target device found: {name}"),
        )
    } else {
        (
            false,
            None,
            "Spotify authenticated, but no target TV device matched the configured hints".into(),
        )
    };

    Ok(SpotifyStatus {
        configured: true,
        authenticated: true,
        target_found,
        target_name,
        summary,
        auth_url: Some(auth_url),
        token_cache_path,
    })
}

pub async fn start_auth(config: &AppConfig) -> Result<SpotifyAuthStart> {
    if !spotify_configured(config) {
        bail!("Spotify client ID, client secret, and redirect URL are required");
    }

    let spotify = build_spotify(config)?;
    let authorize_url = spotify
        .get_authorize_url(false)
        .context("failed to generate Spotify authorize URL")?;

    Ok(SpotifyAuthStart {
        authorize_url,
        token_cache_path: token_cache_path()?.display().to_string(),
    })
}

pub fn prepare_auth(config: &mut AppConfig) -> Result<()> {
    if !spotify_configured(config) {
        bail!("Spotify client ID, client secret, and redirect URL are required");
    }

    config.spotify_auth_state = rand::rng()
        .sample_iter(&Alphanumeric)
        .take(24)
        .map(char::from)
        .collect();

    Ok(())
}

pub async fn finish_auth(config: &AppConfig, code_or_callback: &str) -> Result<SpotifyStatus> {
    if !spotify_configured(config) {
        bail!("Spotify client ID, client secret, and redirect URL are required");
    }

    let spotify = build_spotify(config)?;
    ensure_token_cache_dir()?;

    exchange_callback_or_code(&spotify, code_or_callback).await?;

    get_status(config).await
}

pub async fn finish_auth_via_local_callback(config: &AppConfig) -> Result<SpotifyStatus> {
    if !spotify_configured(config) {
        bail!("Spotify client ID, client secret, and redirect URL are required");
    }

    let spotify = build_spotify(config)?;
    ensure_token_cache_dir()?;
    let socket_addr = spotify
        .get_socket_address(&config.spotify_redirect_url)
        .ok_or_else(|| anyhow!("Spotify redirect URL must be an HTTP loopback URL with a port"))?;
    let listener_client = build_spotify(config)?;

    let code = tokio::task::spawn_blocking(move || listener_client.get_authcode_listener(socket_addr))
        .await
        .context("Spotify callback listener task failed")?
        .context("failed to receive Spotify callback through localhost listener")?;

    spotify
        .request_token(&code)
        .await
        .context("failed to exchange Spotify authorization code for a token")?;

    get_status(config).await
}

pub async fn debug_auth_flow(config: &AppConfig) -> Result<SpotifyAuthDebug> {
    if !spotify_configured(config) {
        bail!("Spotify client ID, client secret, and redirect URL are required");
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
        bail!("Spotify client ID, client secret, and redirect URL are required");
    }

    let spotify = build_spotify(config)?;
    ensure_token(&spotify).await?;

    let target = find_target_device(&spotify, &config.spotify_target_hint_list())
        .await?
        .ok_or_else(|| anyhow!("TV device not found in Spotify Connect devices"))?;

    let target_id = target
        .id
        .clone()
        .ok_or_else(|| anyhow!("Target Spotify device found but has no device ID"))?
        .to_string();
    let target_name = target.name.clone();

    let playback = spotify
        .current_playback(None, Some(&[AdditionalType::Episode]))
        .await
        .context("failed to fetch current Spotify playback")?;

    let is_playing = playback.as_ref().map(|item| item.is_playing).unwrap_or(false);
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

    let _ = spotify.resume_playback(Some(target_id.as_str()), None).await;
    Ok(format!("Transferred Spotify playback to {target_name}"))
}

pub async fn start_on_tv(config: &AppConfig) -> Result<String> {
    let firetv_result = crate::firetv::prepare_spotify_session(&config.firetv_ip)?;
    let spotify_result = toggle_on_tv(config).await?;

    Ok(format!("{}. {}", firetv_result.summary, spotify_result))
}

fn spotify_configured(config: &AppConfig) -> bool {
    !config.spotify_client_id.trim().is_empty()
        && !config.spotify_client_secret.trim().is_empty()
        && !config.spotify_redirect_url.trim().is_empty()
}

fn build_spotify(config: &AppConfig) -> Result<AuthCodeSpotify> {
    ensure_token_cache_dir()?;

    let creds = Credentials::new(&config.spotify_client_id, &config.spotify_client_secret);
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
        cache_path: token_cache_path()?,
        ..Default::default()
    };

    Ok(AuthCodeSpotify::with_config(creds, oauth, client_config))
}

async fn ensure_token(spotify: &AuthCodeSpotify) -> Result<()> {
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

async fn find_target_device(
    spotify: &AuthCodeSpotify,
    hints: &[String],
) -> Result<Option<rspotify::model::Device>> {
    for attempt in 0..5 {
        let devices = spotify.device().await.context("failed to fetch Spotify devices")?;
        if let Some(device) = devices.into_iter().find(|device| device_matches(device, hints)) {
            return Ok(Some(device));
        }

        if attempt < 4 {
            sleep(Duration::from_secs(1)).await;
        }
    }

    Ok(None)
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

async fn exchange_callback_or_code(spotify: &AuthCodeSpotify, code_or_callback: &str) -> Result<()> {
    let code = if code_or_callback.contains("://") {
        spotify
            .parse_response_code(code_or_callback)
            .ok_or_else(|| anyhow!("failed to parse Spotify callback URL or validate its state"))?
    } else {
        extract_auth_code(code_or_callback)?
    };

    spotify
        .request_token(&code)
        .await
        .context("failed to exchange Spotify authorization code for a token")?;

    Ok(())
}

fn token_cache_path() -> Result<PathBuf> {
    Ok(app_data_dir()?.join("spotify-token.json"))
}

fn ensure_token_cache_dir() -> Result<()> {
    let path = token_cache_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create token cache directory at {}", parent.display()))?;
    }
    Ok(())
}

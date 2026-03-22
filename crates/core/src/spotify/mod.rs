use crate::config::{app_data_dir, AppConfig};
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
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    time::{sleep, timeout, Duration},
};
use url::Url;

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

    let redirect = Url::parse(&config.spotify_redirect_url)
        .context("Spotify redirect URL must be a valid absolute URL")?;
    let host = redirect
        .host_str()
        .ok_or_else(|| anyhow!("Spotify redirect URL must include a host"))?;
    let port = redirect
        .port_or_known_default()
        .ok_or_else(|| anyhow!("Spotify redirect URL must include a port"))?;
    let path = if redirect.path().is_empty() {
        "/"
    } else {
        redirect.path()
    };

    let listener = TcpListener::bind((host, port))
        .await
        .with_context(|| format!("failed to bind local Spotify callback listener on {host}:{port}"))?;

    let callback_url = timeout(Duration::from_secs(180), receive_callback_url(&listener, path))
        .await
        .context("timed out waiting for Spotify callback")??;

    exchange_callback_or_code(&spotify, &callback_url).await?;

    get_status(config).await
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
    let _ = spotify.read_token_cache(true).await;

    let has_token = spotify
        .get_token()
        .lock()
        .await
        .map_err(|error| anyhow!("{error:?}"))?
        .is_some();

    if !has_token {
        bail!("Spotify is not authenticated yet");
    }

    spotify
        .refresh_token()
        .await
        .context("failed to refresh Spotify token")?;

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

async fn receive_callback_url(listener: &TcpListener, expected_path: &str) -> Result<String> {
    loop {
        let (mut stream, _) = listener
            .accept()
            .await
            .context("failed to accept Spotify callback connection")?;

        let mut buffer = [0_u8; 4096];
        let bytes_read = stream
            .read(&mut buffer)
            .await
            .context("failed to read Spotify callback request")?;

        if bytes_read == 0 {
            continue;
        }

        let request = String::from_utf8_lossy(&buffer[..bytes_read]);
        let Some(request_line) = request.lines().next() else {
            continue;
        };

        let mut parts = request_line.split_whitespace();
        let method = parts.next().unwrap_or_default();
        let target = parts.next().unwrap_or_default();

        if method != "GET" {
            write_http_response(
                &mut stream,
                "405 Method Not Allowed",
                "Only GET is supported for the Spotify callback.",
            )
            .await?;
            continue;
        }

        let callback_url = format!("http://127.0.0.1{target}");
        let parsed = match Url::parse(&callback_url) {
            Ok(url) => url,
            Err(_) => {
                write_http_response(
                    &mut stream,
                    "400 Bad Request",
                    "Could not parse the Spotify callback request.",
                )
                .await?;
                continue;
            }
        };

        if parsed.path() != expected_path {
            write_http_response(
                &mut stream,
                "404 Not Found",
                "This local callback path does not match the configured Spotify redirect URI.",
            )
            .await?;
            continue;
        }

        let code = parsed
            .query_pairs()
            .find_map(|(key, value)| (key == "code").then(|| value.into_owned()));

        if code.is_some() {
            write_http_response(
                &mut stream,
                "200 OK",
                "Spotify auth complete. You can close this tab and return to Desk Remote.",
            )
            .await?;
            return Ok(callback_url);
        }

        let error = parsed
            .query_pairs()
            .find_map(|(key, value)| (key == "error").then(|| value.into_owned()));

        if let Some(error) = error {
            write_http_response(
                &mut stream,
                "400 Bad Request",
                "Spotify returned an error. You can close this tab and retry from Desk Remote.",
            )
            .await?;
            bail!("Spotify authorization failed: {error}");
        }

        write_http_response(
            &mut stream,
            "400 Bad Request",
            "Spotify callback did not include an authorization code.",
        )
        .await?;
    }
}

async fn write_http_response(
    stream: &mut tokio::net::TcpStream,
    status: &str,
    message: &str,
) -> Result<()> {
    let body = format!(
        "<html><body style=\"font-family:Segoe UI,sans-serif;padding:24px;background:#111;color:#f4f4f4;\"><h1>Desk Remote</h1><p>{message}</p></body></html>"
    );
    let response = format!(
        "HTTP/1.1 {status}\r\ncontent-type: text/html; charset=utf-8\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
        body.len(),
        body
    );

    stream
        .write_all(response.as_bytes())
        .await
        .context("failed to write Spotify callback response")?;
    stream
        .flush()
        .await
        .context("failed to flush Spotify callback response")?;
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

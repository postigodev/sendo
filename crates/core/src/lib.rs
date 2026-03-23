pub mod bindings;
pub mod config;
pub mod firetv;
pub mod spotify;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct HealthStatus {
    pub config_path: String,
    pub firetv_configured: bool,
    pub spotify_configured: bool,
    pub firetv_summary: String,
    pub spotify_summary: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActionResult {
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AuthUrlResult {
    pub url: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpotifyAuthDebug {
    pub stage: String,
    pub detail: String,
    pub state: String,
    pub redirect_uri: String,
    pub token_cache_path: String,
}

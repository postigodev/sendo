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

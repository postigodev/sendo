#[derive(Debug, Clone)]
pub struct AppConfig {
    pub firetv_ip: String,
}

impl AppConfig {
    pub fn load() -> Self {
        // placeholder
        Self {
            firetv_ip: "192.168.0.10".into(),
        }
    }
}

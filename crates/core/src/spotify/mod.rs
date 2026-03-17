pub fn transfer_session() -> anyhow::Result<()> {
    println!("(spotify) transferring session");
    Ok(())
}

pub fn status_summary(client_id: &str, redirect_url: &str) -> String {
    if client_id.trim().is_empty() || redirect_url.trim().is_empty() {
        "Spotify OAuth is not configured yet".into()
    } else {
        "Spotify OAuth settings are present".into()
    }
}

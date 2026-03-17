pub fn wake_tv(ip: &str) -> anyhow::Result<()> {
    println!("(firetv) waking TV at {ip}");
    Ok(())
}

pub fn status_summary(ip: &str) -> String {
    if ip.trim().is_empty() {
        "Missing Fire TV IP address".into()
    } else {
        format!("Ready for Fire TV integration at {ip}")
    }
}

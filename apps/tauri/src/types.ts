export type AppConfig = {
  firetv_ip: string;
  spotify_client_id: string;
  spotify_client_secret: string;
  spotify_redirect_url: string;
  spotify_selected_device_id: string;
  spotify_target_hints: string;
  spotify_auth_state: string;
  launch_on_startup: boolean;
  start_minimized_to_tray: boolean;
};

export type HealthStatus = {
  config_path: string;
  firetv_configured: boolean;
  spotify_configured: boolean;
  firetv_summary: string;
  spotify_summary: string;
};

export type FireTvStatus = {
  configured: boolean;
  adb_available: boolean;
  connected: boolean;
  screen_awake: boolean | null;
  target: string | null;
  summary: string;
};

export type FireTvApp = {
  package_name: string;
  display_name: string;
  source: string;
};

export type FireTvAppCache = {
  scanned_at_epoch_ms: number;
  apps: FireTvApp[];
};

export type FireTvAppScanResult = {
  target: string;
  scanned_at_epoch_ms: number;
  apps: FireTvApp[];
  summary: string;
};

export type ActionResult = {
  message: string;
};

export type AuthUrlResult = {
  url: string;
  message: string;
};

export type SpotifyStatus = {
  configured: boolean;
  authenticated: boolean;
  target_found: boolean;
  target_id: string | null;
  target_name: string | null;
  target_ambiguous: boolean;
  available_devices: SpotifyDevice[];
  playback_on_target: boolean;
  playback_device_name: string | null;
  now_playing: SpotifyNowPlaying | null;
  summary: string;
  auth_url: string | null;
  token_cache_path: string;
};

export type SpotifyDevice = {
  id: string | null;
  name: string;
  is_active: boolean;
  is_restricted: boolean;
  is_selected_target: boolean;
  matches_hints: boolean;
};

export type SpotifyNowPlaying = {
  is_playing: boolean;
  track_name: string | null;
  artist_name: string | null;
  album_name: string | null;
  album_cover_url: string | null;
  progress_ms: number | null;
  duration_ms: number | null;
};

export type SpotifyAuthDebug = {
  stage: string;
  detail: string;
  state: string;
  redirect_uri: string;
  token_cache_path: string;
};

export type FireTvAction =
  | "connect"
  | "ensure_awake"
  | "launch_spotify"
  | "wake"
  | "power_off"
  | "home"
  | "back"
  | "up"
  | "down"
  | "left"
  | "right"
  | "select"
  | "play_pause"
  | "volume_up"
  | "volume_down";

export type BindingAction =
  | { launch_app: { package_name: string } }
  | { fire_tv_key: { action: FireTvAction } }
  | "spotify_toggle_tv"
  | "start_spotify_on_tv";

export type Binding = {
  id: string;
  label: string;
  hotkey: string;
  favorite: boolean;
  favorite_order: number;
  action: BindingAction;
};

export type BindingStore = {
  bindings: Binding[];
};

export type ViewId =
  | "home"
  | "spotify"
  | "quick-access"
  | "hotkeys"
  | "firetv-device"
  | "apps"
  | "remote"
  | "health"
  | "general";

export type Issue = {
  title: string;
  detail: string;
  view: ViewId;
  actionLabel: string;
  tone: "warning" | "error";
};

export type Activity = {
  id: string;
  text: string;
  tone: "info" | "success" | "warning" | "error";
  at: number;
};

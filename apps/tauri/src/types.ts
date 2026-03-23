export type AppConfig = {
  firetv_ip: string;
  spotify_client_id: string;
  spotify_client_secret: string;
  spotify_redirect_url: string;
  spotify_target_hints: string;
  spotify_auth_state: string;
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
  target_name: string | null;
  summary: string;
  auth_url: string | null;
  token_cache_path: string;
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
  | "home"
  | "back"
  | "up"
  | "down"
  | "left"
  | "right"
  | "select"
  | "play_pause";

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

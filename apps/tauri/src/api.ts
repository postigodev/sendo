import { invoke } from "@tauri-apps/api/core";
import type {
  ActionResult,
  AppInfo,
  AppConfig,
  AuthUrlResult,
  Binding,
  BindingStore,
  FireTvAction,
  FireTvAppCache,
  FireTvAppScanResult,
  FireTvStatus,
  HealthStatus,
  SpotifyAuthDebug,
  SpotifyStatus,
} from "./types";

export const api = {
  getAppInfo: () => invoke<AppInfo>("get_app_info"),
  getSettings: () => invoke<AppConfig>("get_settings"),
  saveSettings: (config: AppConfig) => invoke<AppConfig>("save_settings", { config }),
  bindingsList: () => invoke<BindingStore>("bindings_list"),
  bindingsSave: (binding: Binding) => invoke<BindingStore>("bindings_save", { binding }),
  bindingsDelete: (id: string) => invoke<BindingStore>("bindings_delete", { id }),
  bindingsExecute: (id: string) => invoke<ActionResult>("bindings_execute", { id }),
  healthCheck: () => invoke<HealthStatus>("health_check"),
  fireTvStatus: (firetvIp: string) => invoke<FireTvStatus>("firetv_status", { firetvIp }),
  fireTvAction: (action: FireTvAction, firetvIp: string) =>
    invoke<ActionResult>("firetv_action", { action, firetvIp }),
  fireTvCachedApps: () => invoke<FireTvAppCache>("firetv_cached_apps"),
  fireTvScanApps: (firetvIp: string) =>
    invoke<FireTvAppScanResult>("firetv_scan_apps", { firetvIp }),
  fireTvLaunchApp: (packageName: string, firetvIp: string) =>
    invoke<ActionResult>("firetv_launch_app", { packageName, firetvIp }),
  spotifyStatus: () => invoke<SpotifyStatus>("spotify_status"),
  spotifyStartAuth: () => invoke<AuthUrlResult>("spotify_start_auth"),
  spotifyFinishAuth: (codeOrCallback: string) =>
    invoke<SpotifyStatus>("spotify_finish_auth", { codeOrCallback }),
  spotifyFinishAuthViaLocalCallback: () =>
    invoke<SpotifyStatus>("spotify_finish_auth_via_local_callback"),
  spotifyDebugAuthFlow: () => invoke<SpotifyAuthDebug>("spotify_debug_auth_flow"),
  spotifyToggleTv: () => invoke<ActionResult>("spotify_toggle_tv"),
  spotifyTogglePlayback: () => invoke<ActionResult>("spotify_toggle_playback"),
  spotifyTransferTv: () => invoke<ActionResult>("spotify_transfer_tv"),
  spotifyNextTrack: () => invoke<ActionResult>("spotify_next_track"),
  spotifyPreviousTrack: () => invoke<ActionResult>("spotify_previous_track"),
  startSpotifyOnTv: () => invoke<ActionResult>("start_spotify_on_tv"),
};

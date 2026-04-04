import type {
  Activity,
  AppConfig,
  Binding,
  FireTvApp,
  FireTvStatus,
  HealthStatus,
  Issue,
  SpotifyAuthDebug,
  SpotifyStatus,
  ViewId,
} from "../types";
import type { ReadinessRow } from "../features/status";
import { renderApps } from "./apps";
import { renderFireTvDevice } from "./firetv-device";
import { renderGeneral } from "./general";
import { renderHealth } from "./health";
import { renderHome } from "./home";
import { renderHotkeys } from "./hotkeys";
import { renderQuickAccess } from "./quick-access";
import { renderRemote } from "./remote";
import { renderSpotify } from "./spotify";

type RenderViewDeps = {
  currentView: ViewId;
  busy: boolean;
  issues: Issue[];
  currentConfig: AppConfig;
  currentHealth: HealthStatus | null;
  currentFireTvStatus: FireTvStatus | null;
  currentSpotifyStatus: SpotifyStatus | null;
  currentSpotifyDebug: SpotifyAuthDebug | null;
  currentFireTvApps: FireTvApp[];
  currentBindings: Binding[];
  fireTvAppFilter: string;
  spotifyAuthUrl: string;
  spotifyCallbackInput: string;
  spotifyTargetPickerOpen: boolean;
  editingBindingId: string;
  newBindingLabel: string;
  newBindingHotkey: string;
  newBindingFavorite: boolean;
  newBindingActionType: string;
  newBindingActionValue: string;
  isRecordingHotkey: boolean;
  draggedFavoriteId: string;
  dragOverFavoriteId: string;
  recentActivity: Activity[];
  favorites: Binding[];
  hotkeys: Binding[];
  readinessRows: ReadinessRow[];
  filteredApps: FireTvApp[];
  bindingIcon: (action: Binding["action"]) => string;
  describeBindingAction: (action: Binding["action"]) => string;
  screenLabel: (value: boolean | null | undefined) => string;
  packageVersion: string;
};

export function renderView(deps: RenderViewDeps) {
  switch (deps.currentView) {
    case "home":
      return renderHome({
        busy: deps.busy,
        issues: deps.issues,
        currentConfigFireTvIp: deps.currentConfig.firetv_ip,
        currentFireTvConnected: Boolean(deps.currentFireTvStatus?.connected),
        currentFireTvScreenAwake: deps.currentFireTvStatus?.screen_awake,
        currentSpotifyTargetName: deps.currentSpotifyStatus?.target_name,
        currentFireTvAppsCount: deps.currentFireTvApps.length,
        favorites: deps.favorites,
        hotkeys: deps.hotkeys,
        recentActivity: deps.recentActivity,
        draggedFavoriteId: deps.draggedFavoriteId,
        dragOverFavoriteId: deps.dragOverFavoriteId,
        bindingIcon: deps.bindingIcon,
        describeBindingAction: deps.describeBindingAction,
        readinessRows: deps.readinessRows,
        screenLabel: deps.screenLabel,
      });
    case "spotify":
      return renderSpotify({
        busy: deps.busy,
        currentConfig: deps.currentConfig,
        currentSpotifyStatus: deps.currentSpotifyStatus,
        currentSpotifyDebug: deps.currentSpotifyDebug,
        spotifyAuthUrl: deps.spotifyAuthUrl,
        spotifyCallbackInput: deps.spotifyCallbackInput,
        spotifyTargetPickerOpen: deps.spotifyTargetPickerOpen,
        recentActivity: deps.recentActivity,
      });
    case "quick-access":
      return renderQuickAccess({
        busy: deps.busy,
        currentBindings: deps.currentBindings,
        favorites: deps.favorites,
        draggedFavoriteId: deps.draggedFavoriteId,
        dragOverFavoriteId: deps.dragOverFavoriteId,
        bindingIcon: deps.bindingIcon,
        describeBindingAction: deps.describeBindingAction,
      });
    case "hotkeys":
      return renderHotkeys({
        busy: deps.busy,
        editingBindingId: deps.editingBindingId,
        currentBindings: deps.currentBindings,
        currentFireTvApps: deps.currentFireTvApps,
        newBindingLabel: deps.newBindingLabel,
        newBindingHotkey: deps.newBindingHotkey,
        newBindingFavorite: deps.newBindingFavorite,
        newBindingActionType: deps.newBindingActionType,
        newBindingActionValue: deps.newBindingActionValue,
        isRecordingHotkey: deps.isRecordingHotkey,
      });
    case "firetv-device":
      return renderFireTvDevice({
        busy: deps.busy,
        firetvIp: deps.currentConfig.firetv_ip,
        currentFireTvStatus: deps.currentFireTvStatus,
      });
    case "apps":
      return renderApps({
        busy: deps.busy,
        apps: deps.filteredApps,
        fireTvAppFilter: deps.fireTvAppFilter,
        currentFireTvAppsCount: deps.currentFireTvApps.length,
        favoriteBindingsCount: deps.currentBindings.filter((binding) => binding.favorite).length,
      });
    case "remote":
      return renderRemote(deps.busy);
    case "health":
      return renderHealth({
        busy: deps.busy,
        issues: deps.issues,
        readinessRows: deps.readinessRows,
        currentHealth: deps.currentHealth,
        currentFireTvStatus: deps.currentFireTvStatus,
        currentSpotifyStatus: deps.currentSpotifyStatus,
      });
    case "general":
      return renderGeneral({
        currentConfig: deps.currentConfig,
        packageVersion: deps.packageVersion,
        configPath: deps.currentHealth?.config_path ?? "Unavailable",
        storedBindings: deps.currentBindings.length,
        cachedApps: deps.currentFireTvApps.length,
        activeHotkeys: deps.hotkeys.length,
      });
  }
}

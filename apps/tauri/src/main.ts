import {
  isRegistered as isGlobalShortcutRegistered,
  register as registerGlobalShortcut,
  unregister as unregisterGlobalShortcut,
} from "@tauri-apps/plugin-global-shortcut";
import { openUrl } from "@tauri-apps/plugin-opener";
import packageJson from "../package.json";
import { api } from "./api";
import { renderIcons } from "./icons";
import {
  bindingActionType,
  bindingActionValue,
  describeBindingAction,
  favoriteBindings,
  bindingIcon,
} from "./features/bindings";
import { deriveIssues, readinessRows, screenLabel, sectionLabel, titleForView } from "./features/status";
import { renderView } from "./pages";
import { appState } from "./state";
import type { Activity, Binding, BindingAction, FireTvAction, ViewId } from "./types";
import { renderAppShell } from "./ui/layout";
import { asMessage } from "./utils";

let {
  currentConfig,
  currentHealth,
  currentFireTvStatus,
  currentSpotifyStatus,
  currentSpotifyDebug,
  currentFireTvApps,
  currentBindings,
  registeredHotkeys,
  currentView,
  openGroups,
  issuesOpen,
  busy,
  flashMessage,
  flashIsError,
  fireTvAppFilter,
  spotifyAuthUrl,
  spotifyCallbackInput,
  editingBindingId,
  newBindingLabel,
  newBindingHotkey,
  newBindingFavorite,
  newBindingActionType,
  newBindingActionValue,
  isRecordingHotkey,
  draggedFavoriteId,
  dragOverFavoriteId,
  quickAccessPointerId,
  quickAccessPointerStartX,
  quickAccessPointerStartY,
  quickAccessDragging,
  suppressQuickTileClick,
  sidebarIndicatorTop,
  sidebarIndicatorLeft,
  sidebarIndicatorVisible,
  recentActivity,
  spotifyPollingPaused,
} = appState;
let flashTimeoutId: number | null = null;
let spotifyPollIntervalId: number | null = null;
let spotifyPollInFlight = false;

function render() {
  const issues = deriveIssues(currentConfig, currentFireTvStatus, currentSpotifyStatus);
  const favorites = favoriteBindings(currentBindings);
  const hotkeys = currentBindings.filter((binding) => binding.hotkey.trim());
  document.body.innerHTML = renderAppShell({
    currentView,
    openGroups,
    issues,
    issuesOpen,
    sidebarIndicatorTop,
    sidebarIndicatorLeft,
    sidebarIndicatorVisible,
    packageVersion: packageJson.version,
    sectionLabel: sectionLabel(currentView),
    title: titleForView(currentView),
    flashMessage,
    flashIsError,
    viewHtml: renderView({
      currentView,
      busy,
      issues,
      currentConfig,
      currentHealth,
      currentFireTvStatus,
      currentSpotifyStatus,
      currentSpotifyDebug,
      currentFireTvApps,
      currentBindings,
      fireTvAppFilter,
      spotifyAuthUrl,
      spotifyCallbackInput,
      editingBindingId,
      newBindingLabel,
      newBindingHotkey,
      newBindingFavorite,
      newBindingActionType,
      newBindingActionValue,
      isRecordingHotkey,
      draggedFavoriteId,
      dragOverFavoriteId,
      recentActivity,
      favorites,
      hotkeys,
      readinessRows: readinessRows(currentConfig, currentFireTvStatus, currentSpotifyStatus),
      filteredApps: filteredApps(),
      bindingIcon,
      describeBindingAction,
      screenLabel,
      packageVersion: packageJson.version,
    }),
  });
  renderIcons();
  bindEvents();
  syncSidebarIndicator();
  syncSpotifyPolling();
}

function filteredApps() {
  const filter = fireTvAppFilter.trim().toLowerCase();
  return currentFireTvApps.filter(
    (app) =>
      !filter ||
      app.display_name.toLowerCase().includes(filter) ||
      app.package_name.toLowerCase().includes(filter),
  );
}

function startEditingBinding(id: string) {
  const binding = currentBindings.find((item) => item.id === id);
  if (!binding) return;
  editingBindingId = binding.id;
  newBindingLabel = binding.label;
  newBindingHotkey = binding.hotkey;
  newBindingFavorite = binding.favorite;
  newBindingActionType = bindingActionType(binding.action);
  newBindingActionValue = bindingActionValue(binding.action);
  currentView = "hotkeys";
  render();
}

function resetBindingFormState() {
  editingBindingId = "";
  newBindingLabel = "";
  newBindingHotkey = "";
  newBindingFavorite = false;
  newBindingActionType = "start_spotify_on_tv";
  newBindingActionValue = "";
  isRecordingHotkey = false;
}

function resetBindingForm() {
  resetBindingFormState();
  flash("Binding form cleared.");
  render();
}

function toggleHotkeyRecording() {
  if (busy) return;
  isRecordingHotkey = !isRecordingHotkey;
  flash(isRecordingHotkey ? "Recording hotkey. Press your combination now." : "Hotkey recording cancelled.");
  render();
}

function handleHotkeyRecording(event: KeyboardEvent) {
  if (!isRecordingHotkey || busy) return;
  event.preventDefault();
  if (event.key === "Escape") {
    isRecordingHotkey = false;
    flash("Hotkey recording cancelled.");
    render();
    return;
  }
  if ((event.key === "Backspace" || event.key === "Delete") && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    newBindingHotkey = "";
    isRecordingHotkey = false;
    flash("Hotkey cleared.");
    render();
    return;
  }
  const key = normalizedHotkey(event);
  if (!key) {
    flash("Add at least one modifier and one key.");
    render();
    return;
  }
  newBindingHotkey = key;
  isRecordingHotkey = false;
  flash(`Hotkey recorded: ${key}`);
  render();
}

function normalizedHotkey(event: KeyboardEvent) {
  const value = normalizeHotkeyKey(event.key);
  if (!value) return "";
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Super");
  if (!parts.length) return "";
  parts.push(value);
  return parts.join("+");
}

function normalizeHotkeyKey(key: string) {
  if (["Control", "Shift", "Alt", "Meta"].includes(key)) return "";
  if (key === " ") return "Space";
  if (key === "ArrowUp") return "Up";
  if (key === "ArrowDown") return "Down";
  if (key === "ArrowLeft") return "Left";
  if (key === "ArrowRight") return "Right";
  return key.length === 1 ? key.toUpperCase() : key;
}

function bindEvents() {
  document.querySelectorAll<HTMLElement>("[data-view]").forEach((element) =>
    element.addEventListener("click", () => {
      const view = element.dataset.view as ViewId | undefined;
      if (view) {
        currentView = view;
        issuesOpen = false;
        render();
      }
    }),
  );
  document.querySelectorAll<HTMLElement>("[data-group]").forEach((element) =>
    element.addEventListener("click", () => {
      const group = element.dataset.group ?? "";
      if (openGroups.has(group)) openGroups.delete(group);
      else openGroups.add(group);
      render();
    }),
  );
  document.querySelector("#issues-button")?.addEventListener("click", () => {
    issuesOpen = !issuesOpen;
    render();
  });
  document.querySelector("#close-issues-button")?.addEventListener("click", () => {
    issuesOpen = false;
    render();
  });
  document.querySelector("#open-health-button")?.addEventListener("click", () => {
    currentView = "health";
    issuesOpen = false;
    render();
  });
  document.querySelector("#start-spotify-on-tv-button")?.addEventListener("click", () => void startSpotifyOnTv());
  document.querySelectorAll<HTMLButtonElement>(".quick-action-button").forEach((button) =>
    button.addEventListener("click", () => {
      const action = button.dataset.quickAction;
      if (action === "wake") void triggerFireTvAction("ensure_awake");
      if (action === "launch_spotify") void triggerFireTvAction("launch_spotify");
      if (action === "spotify_toggle_tv") void toggleSpotifyOnTv();
    }),
  );
  document.querySelector<HTMLFormElement>("#spotify-settings-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveSettingsFromInputs("Spotify settings saved.");
  });
  document.querySelector<HTMLFormElement>("#firetv-settings-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveSettingsFromInputs("Fire TV settings saved.");
  });
  document.querySelector("#spotify-refresh-button")?.addEventListener("click", () => void refreshSpotifyStatus());
  document.querySelector("#spotify-start-auth-button")?.addEventListener("click", () => void startSpotifyAuth());
  document.querySelector("#spotify-debug-button")?.addEventListener("click", () => void inspectSpotifyAuth());
  document.querySelector("#spotify-finish-auth-button")?.addEventListener("click", () => void finishSpotifyAuth());
  document.querySelector("#spotify-playback-button")?.addEventListener("click", () => void toggleSpotifyPlayback());
  document.querySelector("#spotify-send-to-tv-button")?.addEventListener("click", () => void transferSpotifyToTv());
  document.querySelector("#spotify-previous-button")?.addEventListener("click", () => void previousSpotifyTrack());
  document.querySelector("#spotify-next-button")?.addEventListener("click", () => void nextSpotifyTrack());
  document.querySelectorAll<HTMLButtonElement>(".spotify-inline-action").forEach((button) =>
    button.addEventListener("click", () => {
      const action = button.dataset.spotifyInline;
      if (action === "start-auth") {
        void startSpotifyAuth();
      } else if (action === "focus-target-hints") {
        focusField("spotify-target-hints");
      } else if (action === "focus-redirect") {
        focusField("spotify-redirect-url");
      }
    }),
  );
  document.querySelector("#firetv-check-button")?.addEventListener("click", () => void refreshFireTvStatus());
  document.querySelector("#reload-button")?.addEventListener("click", () => void loadAll("Configuration reloaded from disk."));
  document.querySelector("#health-button")?.addEventListener("click", () => void refreshHealth());
  document.querySelector("#health-refresh-button")?.addEventListener("click", () => void refreshHealth());
  document.querySelector("#health-refresh-recovery-button")?.addEventListener("click", () => void refreshHealth());
  document.querySelector("#firetv-scan-apps-button")?.addEventListener("click", () => void scanFireTvApps());
  document.querySelector("#firetv-load-apps-button")?.addEventListener("click", () => void loadCachedFireTvApps());
  document.querySelectorAll<HTMLButtonElement>(".readiness-action-button").forEach((button) =>
    button.addEventListener("click", () => {
      const readinessAction = button.dataset.readinessAction;
      if (readinessAction === "wake-tv") {
        void triggerFireTvAction("ensure_awake");
      } else if (readinessAction === "firetv-retry") {
        void refreshFireTvStatus("Fire TV status refreshed.");
      }
    }),
  );
  document.querySelector<HTMLInputElement>("#firetv-app-filter")?.addEventListener("input", (event) => {
    fireTvAppFilter = (event.currentTarget as HTMLInputElement).value;
    render();
  });
  document.querySelectorAll<HTMLButtonElement>(".remote-button").forEach((button) =>
    button.addEventListener("click", () => {
      const action = button.dataset.firetvAction as FireTvAction | undefined;
      if (action) void triggerFireTvAction(action);
    }),
  );
  document.querySelectorAll<HTMLButtonElement>(".launch-app-button").forEach((button) =>
    button.addEventListener("click", () => {
      const packageName = button.dataset.packageName;
      if (packageName) void launchFireTvApp(packageName);
    }),
  );
  document.querySelector<HTMLFormElement>("#binding-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveBinding();
  });
  document.querySelector("#binding-record-hotkey-button")?.addEventListener("click", () => toggleHotkeyRecording());
  document.querySelector("#binding-reset-button")?.addEventListener("click", () => resetBindingForm());
  document.querySelector<HTMLSelectElement>("#binding-action-type")?.addEventListener("change", (event) => {
    newBindingActionType = (event.currentTarget as HTMLSelectElement).value;
    if (newBindingActionType === "fire_tv_key") newBindingActionValue = "home";
    else if (newBindingActionType === "launch_app") newBindingActionValue = currentFireTvApps[0]?.package_name ?? "";
    else newBindingActionValue = "";
    render();
  });
  document.querySelectorAll<HTMLInputElement>(".favorite-toggle").forEach((toggle) =>
    toggle.addEventListener("change", () => {
      const id = toggle.dataset.bindingId;
      if (id) void toggleBindingFavorite(id, toggle.checked);
    }),
  );
  document.querySelectorAll<HTMLButtonElement>(".edit-binding-button").forEach((button) =>
    button.addEventListener("click", () => {
      const id = button.dataset.bindingId;
      if (id) startEditingBinding(id);
    }),
  );
  document.querySelectorAll<HTMLButtonElement>(".execute-binding-button").forEach((button) =>
    button.addEventListener("click", () => {
      if (button.classList.contains("quick-tile") && suppressQuickTileClick) {
        suppressQuickTileClick = false;
        return;
      }
      const id = button.dataset.bindingId;
      if (id) void executeBinding(id);
    }),
  );
  document.querySelectorAll<HTMLButtonElement>(".quick-tile").forEach((tile) => {
    tile.addEventListener("pointerdown", (event) => {
      if (busy || event.button !== 0) return;
      const id = tile.dataset.bindingId;
      if (!id) return;
      quickAccessPointerId = id;
      quickAccessPointerStartX = event.clientX;
      quickAccessPointerStartY = event.clientY;
      quickAccessDragging = false;
      suppressQuickTileClick = false;
    });
  });
  document.querySelectorAll<HTMLButtonElement>(".delete-binding-button").forEach((button) =>
    button.addEventListener("click", () => {
      const id = button.dataset.bindingId;
      if (id) void deleteBinding(id);
    }),
  );
}

function syncSidebarIndicator() {
  const nav = document.querySelector<HTMLElement>(".sidebar-nav");
  const indicator = document.querySelector<HTMLElement>(".nav-active-indicator");
  const activeLink = document.querySelector<HTMLElement>(".sidebar-nav .nav-link.is-active");
  if (!nav || !indicator) return;

  if (!activeLink) {
    indicator.style.opacity = "0";
    sidebarIndicatorVisible = false;
    return;
  }

  const indicatorHeight = 16;
  const top = activeLink.offsetTop + (activeLink.offsetHeight - indicatorHeight) / 2;
  const left = activeLink.classList.contains("is-child") ? 20 : 9;
  indicator.style.top = `${sidebarIndicatorTop}px`;
  indicator.style.left = `${sidebarIndicatorLeft}px`;
  indicator.style.opacity = sidebarIndicatorVisible ? "1" : "0";
  requestAnimationFrame(() => {
    indicator.style.top = `${top}px`;
    indicator.style.left = `${left}px`;
    indicator.style.opacity = "1";
  });
  sidebarIndicatorTop = top;
  sidebarIndicatorLeft = left;
  sidebarIndicatorVisible = true;
  indicator.style.height = `${indicatorHeight}px`;
}

async function syncGlobalHotkeys() {
  const warnings: string[] = [];
  const desiredHotkeys = Array.from(
    new Set(
      currentBindings
        .map((binding) => binding.hotkey.trim())
        .filter((hotkey) => hotkey.length > 0),
    ),
  );

  for (const hotkey of registeredHotkeys) {
    try {
      if (await isGlobalShortcutRegistered(hotkey)) await unregisterGlobalShortcut(hotkey);
    } catch (error) {
      warnings.push(`Could not unregister ${hotkey}: ${asMessage(error)}`);
    }
  }

  for (const hotkey of desiredHotkeys) {
    if (registeredHotkeys.includes(hotkey)) {
      continue;
    }

    try {
      if (await isGlobalShortcutRegistered(hotkey)) {
        await unregisterGlobalShortcut(hotkey);
      }
    } catch (error) {
      warnings.push(`Could not clear existing ${hotkey}: ${asMessage(error)}`);
    }
  }

  registeredHotkeys = [];

  for (const binding of currentBindings) {
    if (!binding.hotkey.trim()) continue;
    try {
      await registerGlobalShortcut(binding.hotkey, () => {
        if (!busy) void executeBinding(binding.id);
      });
      registeredHotkeys.push(binding.hotkey);
    } catch (error) {
      warnings.push(`Could not register ${binding.hotkey}: ${asMessage(error)}`);
    }
  }
  return warnings.join(" ");
}

async function saveBinding() {
  syncBindingInputs();
  busy = true;
  flash("Saving binding...");
  render();
  try {
    const store = await api.bindingsSave(buildBindingPayload());
    currentBindings = store.bindings;
    const hotkeyMessage = await syncGlobalHotkeys();
    addActivity(`${editingBindingId ? "Updated" : "Created"} binding: ${newBindingLabel}`, "success");
    resetBindingFormState();
    busy = false;
    flash(hotkeyMessage ? `Binding saved. ${hotkeyMessage}` : "Binding saved.");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    addActivity(asMessage(error), "error");
    render();
  }
}

async function toggleBindingFavorite(id: string, favorite: boolean) {
  const binding = currentBindings.find((item) => item.id === id);
  if (!binding) return;
  busy = true;
  flash("Updating Quick Access...");
  render();
  try {
    const store = await api.bindingsSave({ ...binding, favorite });
    currentBindings = store.bindings;
    busy = false;
    flash(favorite ? "Pinned to Quick Access." : "Removed from Quick Access.");
    addActivity(favorite ? `Pinned ${binding.label} to Quick Access` : `Removed ${binding.label} from Quick Access`, "info");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function executeBinding(id: string) {
  busy = true;
  flash("Running binding...");
  render();
  try {
    const result = await api.bindingsExecute(id);
    currentFireTvStatus = await api.fireTvStatus(currentConfig.firetv_ip);
    currentSpotifyStatus = await api.spotifyStatus();
    busy = false;
    flash(result.message);
    addActivity(result.message, "success");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function deleteBinding(id: string) {
  busy = true;
  flash("Deleting binding...");
  render();
  try {
    const store = await api.bindingsDelete(id);
    currentBindings = store.bindings;
    const hotkeyMessage = await syncGlobalHotkeys();
    if (editingBindingId === id) resetBindingFormState();
    busy = false;
    flash(hotkeyMessage ? `Binding deleted. ${hotkeyMessage}` : "Binding deleted.");
    addActivity("Binding deleted.", "warning");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function startSpotifyOnTv() {
  syncConfigFromInputs();
  busy = true;
  flash("Preparing Fire TV and Spotify...");
  render();
  try {
    await persistCurrentConfig();
    const result = await api.startSpotifyOnTv();
    currentFireTvStatus = await api.fireTvStatus(currentConfig.firetv_ip);
    currentSpotifyStatus = await api.spotifyStatus();
    currentHealth = await api.healthCheck();
    busy = false;
    flash(result.message);
    addActivity(result.message, "success");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    addActivity(asMessage(error), "error");
    render();
  }
}

async function toggleSpotifyOnTv() {
  syncConfigFromInputs();
  busy = true;
  flash("Running Spotify TV toggle...");
  render();
  try {
    await persistCurrentConfig();
    const result = await api.spotifyToggleTv();
    currentSpotifyStatus = await api.spotifyStatus();
    busy = false;
    flash(result.message);
    addActivity(result.message, "success");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function toggleSpotifyPlayback() {
  await runSpotifyPlayerAction("Toggling Spotify playback...", () => api.spotifyTogglePlayback());
}

async function transferSpotifyToTv() {
  await runSpotifyPlayerAction("Sending Spotify playback to TV...", () => api.spotifyTransferTv());
}

async function previousSpotifyTrack() {
  await runSpotifyPlayerAction("Going back to the previous track...", () => api.spotifyPreviousTrack());
}

async function nextSpotifyTrack() {
  await runSpotifyPlayerAction("Skipping to the next track...", () => api.spotifyNextTrack());
}

async function startSpotifyAuth() {
  syncConfigFromInputs();
  busy = true;
  flash("Starting Spotify auth...");
  render();
  try {
    await persistCurrentConfig();
    const result = await api.spotifyStartAuth();
    currentSpotifyDebug = await api.spotifyDebugAuthFlow();
    spotifyAuthUrl = result.url;
    render();
    const pendingStatus = api.spotifyFinishAuthViaLocalCallback();
    await openUrl(result.url);
    currentSpotifyStatus = await pendingStatus;
    currentHealth = await api.healthCheck();
    busy = false;
    flash("Spotify authentication completed.");
    addActivity("Spotify authentication completed.", "success");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function inspectSpotifyAuth() {
  syncConfigFromInputs();
  busy = true;
  flash("Inspecting Spotify auth setup...");
  render();
  try {
    await persistCurrentConfig();
    currentSpotifyDebug = await api.spotifyDebugAuthFlow();
    busy = false;
    flash("Spotify auth inspection refreshed.");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function finishSpotifyAuth() {
  syncConfigFromInputs();
  spotifyCallbackInput = document.querySelector<HTMLInputElement>("#spotify-callback-input")?.value.trim() ?? spotifyCallbackInput;
  busy = true;
  flash("Finishing Spotify auth...");
  render();
  try {
    await persistCurrentConfig();
    currentSpotifyStatus = await api.spotifyFinishAuth(spotifyCallbackInput);
    currentHealth = await api.healthCheck();
    busy = false;
    flash("Spotify authentication completed.");
    addActivity("Spotify authentication completed.", "success");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function refreshSpotifyStatus(message = "Spotify status refreshed.") {
  syncConfigFromInputs();
  busy = true;
  flash("Checking Spotify status...");
  render();
  try {
    await persistCurrentConfig();
    currentSpotifyStatus = await api.spotifyStatus();
    currentHealth = await api.healthCheck();
    busy = false;
    flash(message);
    addActivity(message, "info");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function pollSpotifyStatus() {
  if (spotifyPollInFlight || currentView !== "spotify" || spotifyPollingPaused) return;

  spotifyPollInFlight = true;
  try {
    currentSpotifyStatus = await api.spotifyStatus();
    if (currentView === "spotify") {
      render();
    }
  } catch {
    // Keep polling resilient and silent.
  } finally {
    spotifyPollInFlight = false;
  }
}

function shouldPollSpotify() {
  return currentView === "spotify" && !spotifyPollingPaused;
}

function syncSpotifyPolling() {
  if (!shouldPollSpotify()) {
    stopSpotifyPolling();
    return;
  }

  if (spotifyPollIntervalId !== null) return;

  spotifyPollIntervalId = window.setInterval(() => {
    void pollSpotifyStatus();
  }, 2500);
}

function stopSpotifyPolling() {
  if (spotifyPollIntervalId === null) return;
  window.clearInterval(spotifyPollIntervalId);
  spotifyPollIntervalId = null;
}

function handleSpotifyPollingVisibility() {
  spotifyPollingPaused = document.visibilityState !== "visible" || !document.hasFocus();
  syncSpotifyPolling();
}

async function runSpotifyPlayerAction(loadingMessage: string, action: () => Promise<{ message: string }>) {
  syncConfigFromInputs();
  busy = true;
  flash(loadingMessage);
  render();
  try {
    await persistCurrentConfig();
    const result = await action();
    currentSpotifyStatus = await api.spotifyStatus();
    currentHealth = await api.healthCheck();
    busy = false;
    flash(result.message);
    addActivity(result.message, "success");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    addActivity(asMessage(error), "error");
    render();
  }
}

async function refreshFireTvStatus(message = "Fire TV status refreshed.") {
  syncConfigFromInputs();
  busy = true;
  flash("Checking Fire TV connection...");
  render();
  try {
    currentFireTvStatus = await api.fireTvStatus(currentConfig.firetv_ip);
    currentHealth = await api.healthCheck();
    busy = false;
    flash(message);
    addActivity(message, "info");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function scanFireTvApps() {
  syncConfigFromInputs();
  busy = true;
  flash("Scanning Fire TV apps...");
  render();
  try {
    const result = await api.fireTvScanApps(currentConfig.firetv_ip);
    currentFireTvApps = result.apps;
    busy = false;
    flash(result.summary);
    addActivity(result.summary, "success");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function loadCachedFireTvApps() {
  busy = true;
  flash("Loading cached Fire TV apps...");
  render();
  try {
    currentFireTvApps = (await api.fireTvCachedApps()).apps;
    busy = false;
    flash(`Loaded ${currentFireTvApps.length} cached Fire TV apps.`);
    addActivity(`Loaded ${currentFireTvApps.length} cached Fire TV apps.`, "info");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function triggerFireTvAction(action: FireTvAction) {
  syncConfigFromInputs();
  busy = true;
  flash(`Sending ${action}...`);
  render();
  try {
    const result = await api.fireTvAction(action, currentConfig.firetv_ip);
    currentFireTvStatus = await api.fireTvStatus(currentConfig.firetv_ip);
    currentHealth = await api.healthCheck();
    busy = false;
    flash(result.message);
    addActivity(result.message, "success");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function launchFireTvApp(packageName: string) {
  syncConfigFromInputs();
  busy = true;
  flash(`Launching ${packageName}...`);
  render();
  try {
    const result = await api.fireTvLaunchApp(packageName, currentConfig.firetv_ip);
    currentFireTvStatus = await api.fireTvStatus(currentConfig.firetv_ip);
    busy = false;
    flash(result.message);
    addActivity(result.message, "success");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function saveSettingsFromInputs(message: string) {
  syncConfigFromInputs();
  busy = true;
  flash("Saving settings...");
  render();
  try {
    currentConfig = await api.saveSettings(currentConfig);
    currentHealth = await api.healthCheck();
    busy = false;
    flash(message);
    addActivity(message, "success");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function refreshHealth(message = "Health status refreshed.") {
  busy = true;
  flash("Refreshing health...");
  render();
  try {
    currentHealth = await api.healthCheck();
    busy = false;
    flash(message);
    addActivity(message, "info");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function loadAll(message = "Configuration loaded.") {
  busy = true;
  flash("Loading configuration...");
  render();
  try {
    currentConfig = await api.getSettings();
    currentHealth = await api.healthCheck();
    currentFireTvStatus = await api.fireTvStatus(currentConfig.firetv_ip);
    currentSpotifyStatus = await api.spotifyStatus();
    currentSpotifyDebug = await api.spotifyDebugAuthFlow();
    currentFireTvApps = (await api.fireTvCachedApps()).apps;
    currentBindings = (await api.bindingsList()).bindings;
    spotifyAuthUrl = currentSpotifyStatus.auth_url ?? "";
    const hotkeyMessage = await syncGlobalHotkeys();
    busy = false;
    flash(hotkeyMessage ? `${message} ${hotkeyMessage}` : message);
    addActivity(message, "info");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

function flash(message: string, isError = false) {
  if (flashTimeoutId !== null) {
    window.clearTimeout(flashTimeoutId);
    flashTimeoutId = null;
  }
  flashMessage = message;
  flashIsError = isError;
  if (!message || busy) return;
  flashTimeoutId = window.setTimeout(() => {
    flashMessage = "";
    flashIsError = false;
    flashTimeoutId = null;
    render();
  }, isError ? 6500 : 4200);
}

function syncConfigFromInputs() {
  currentConfig = {
    firetv_ip: document.querySelector<HTMLInputElement>("#firetv-ip")?.value.trim() ?? currentConfig.firetv_ip,
    spotify_client_id: document.querySelector<HTMLInputElement>("#spotify-client-id")?.value.trim() ?? currentConfig.spotify_client_id,
    spotify_client_secret: document.querySelector<HTMLInputElement>("#spotify-client-secret")?.value.trim() ?? currentConfig.spotify_client_secret,
    spotify_redirect_url: document.querySelector<HTMLInputElement>("#spotify-redirect-url")?.value.trim() ?? currentConfig.spotify_redirect_url,
    spotify_target_hints: document.querySelector<HTMLInputElement>("#spotify-target-hints")?.value.trim() ?? currentConfig.spotify_target_hints,
    spotify_auth_state: currentConfig.spotify_auth_state,
  };
}

function focusField(id: string) {
  const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (!element) return;
  element.focus();
  if (element instanceof HTMLInputElement) element.select();
}

function syncBindingInputs() {
  newBindingLabel = document.querySelector<HTMLInputElement>("#binding-label")?.value.trim() ?? newBindingLabel;
  newBindingHotkey = document.querySelector<HTMLInputElement>("#binding-hotkey")?.value.trim() ?? newBindingHotkey;
  newBindingFavorite = document.querySelector<HTMLInputElement>("#binding-favorite")?.checked ?? newBindingFavorite;
  newBindingActionType = document.querySelector<HTMLSelectElement>("#binding-action-type")?.value.trim() ?? newBindingActionType;
  newBindingActionValue = document.querySelector<HTMLInputElement | HTMLSelectElement>("#binding-action-value")?.value.trim() ?? newBindingActionValue;
  if (newBindingActionType === "fire_tv_key" && !newBindingActionValue) newBindingActionValue = "home";
  if (newBindingActionType === "launch_app" && !newBindingActionValue) newBindingActionValue = currentFireTvApps[0]?.package_name ?? "";
}

function buildBindingPayload(): Binding {
  const actionType = newBindingActionType.trim();
  const existingBinding = editingBindingId
    ? currentBindings.find((binding) => binding.id === editingBindingId)
    : undefined;
  let action: BindingAction;
  if (actionType === "spotify_toggle_tv") action = "spotify_toggle_tv";
  else if (actionType === "start_spotify_on_tv") action = "start_spotify_on_tv";
  else if (actionType === "launch_app") action = { launch_app: { package_name: newBindingActionValue.trim() } };
  else if (actionType === "fire_tv_key") action = { fire_tv_key: { action: newBindingActionValue.trim() as FireTvAction } };
  else throw new Error(`Unsupported binding action type: ${actionType}`);
  return {
    id: editingBindingId,
    label: newBindingLabel,
    hotkey: newBindingHotkey,
    favorite: newBindingFavorite,
    favorite_order: existingBinding?.favorite_order ?? 0,
    action,
  };
}

async function persistCurrentConfig() {
  currentConfig = await api.saveSettings(currentConfig);
}

function addActivity(text: string, tone: Activity["tone"]) {
  recentActivity.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, tone, at: Date.now() });
  recentActivity = recentActivity.slice(0, 5);
}

function clearQuickTileDragClasses() {
  document.querySelectorAll<HTMLButtonElement>(".quick-tile").forEach((tile) => {
    tile.classList.remove("is-dragging", "is-drop-target");
  });
}

function updateQuickTileDragClasses() {
  clearQuickTileDragClasses();
  if (draggedFavoriteId) {
    document
      .querySelector<HTMLButtonElement>(`.quick-tile[data-binding-id="${CSS.escape(draggedFavoriteId)}"]`)
      ?.classList.add("is-dragging");
  }
  if (dragOverFavoriteId) {
    document
      .querySelector<HTMLButtonElement>(`.quick-tile[data-binding-id="${CSS.escape(dragOverFavoriteId)}"]`)
      ?.classList.add("is-drop-target");
  }
}

function resetQuickAccessPointerState() {
  quickAccessPointerId = "";
  quickAccessPointerStartX = 0;
  quickAccessPointerStartY = 0;
  quickAccessDragging = false;
  draggedFavoriteId = "";
  dragOverFavoriteId = "";
  clearQuickTileDragClasses();
}

function handleQuickAccessPointerMove(event: PointerEvent) {
  if (!quickAccessPointerId || busy) return;

  if (!quickAccessDragging) {
    const movedX = Math.abs(event.clientX - quickAccessPointerStartX);
    const movedY = Math.abs(event.clientY - quickAccessPointerStartY);
    if (movedX < 6 && movedY < 6) return;

    quickAccessDragging = true;
    draggedFavoriteId = quickAccessPointerId;
    dragOverFavoriteId = "";
    suppressQuickTileClick = true;
  }

  const hoveredTile = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>(".quick-tile");
  const hoveredId = hoveredTile?.dataset.bindingId ?? "";
  dragOverFavoriteId = hoveredId && hoveredId !== draggedFavoriteId ? hoveredId : "";
  updateQuickTileDragClasses();
}

function handleQuickAccessPointerUp(event: PointerEvent) {
  if (!quickAccessPointerId) return;

  const sourceId = draggedFavoriteId;
  const hoveredTile = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>(".quick-tile");
  const targetId = hoveredTile?.dataset.bindingId ?? "";
  const shouldReorder = quickAccessDragging && sourceId && targetId && sourceId !== targetId;

  if (!shouldReorder) {
    resetQuickAccessPointerState();
    return;
  }

  void reorderFavoriteBindings(sourceId, targetId);
}

async function reorderFavoriteBindings(sourceId: string, targetId: string) {
  if (!sourceId || !targetId || sourceId === targetId || busy) {
    resetQuickAccessPointerState();
    render();
    return;
  }

  const orderedFavorites = favoriteBindings(currentBindings);
  const sourceIndex = orderedFavorites.findIndex((binding) => binding.id === sourceId);
  const targetIndex = orderedFavorites.findIndex((binding) => binding.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    resetQuickAccessPointerState();
    render();
    return;
  }

  const previousBindings = currentBindings.map((binding) => ({ ...binding }));
  const reorderedFavorites = [...orderedFavorites];
  const [moved] = reorderedFavorites.splice(sourceIndex, 1);
  reorderedFavorites.splice(targetIndex, 0, moved);

  const reorderedById = new Map(
    reorderedFavorites.map((binding, index) => [
      binding.id,
      { ...binding, favorite_order: index + 1 },
    ]),
  );

  currentBindings = currentBindings.map((binding) =>
    binding.favorite && reorderedById.has(binding.id)
      ? { ...binding, favorite_order: reorderedById.get(binding.id)!.favorite_order }
      : binding,
  );
  resetQuickAccessPointerState();
  busy = true;
  flash("Saving Quick Access order...");
  render();

  try {
    let latestStore = { bindings: currentBindings };
    for (const binding of reorderedFavorites) {
      latestStore = await api.bindingsSave({
        ...binding,
        favorite_order: reorderedById.get(binding.id)!.favorite_order,
      });
    }
    currentBindings = latestStore.bindings;
    busy = false;
    flash("Quick Access order updated.");
    addActivity("Quick Access order updated.", "success");
    render();
  } catch (error) {
    currentBindings = previousBindings;
    busy = false;
    flash(asMessage(error), true);
    addActivity(asMessage(error), "error");
    render();
  }
}

document.addEventListener("keydown", handleHotkeyRecording, true);
document.addEventListener("pointermove", handleQuickAccessPointerMove, true);
document.addEventListener("pointerup", handleQuickAccessPointerUp, true);
window.addEventListener("resize", syncSidebarIndicator);
window.addEventListener("focus", handleSpotifyPollingVisibility);
window.addEventListener("blur", handleSpotifyPollingVisibility);
document.addEventListener("visibilitychange", handleSpotifyPollingVisibility);

void loadAll();

import {
  isRegistered as isGlobalShortcutRegistered,
  register as registerGlobalShortcut,
  unregister as unregisterGlobalShortcut,
} from "@tauri-apps/plugin-global-shortcut";
import { openUrl } from "@tauri-apps/plugin-opener";
import packageJson from "../package.json";
import { api } from "./api";
import { icon, renderIcons } from "./icons";
import { appState } from "./state";
import type {
  Activity,
  Binding,
  BindingAction,
  FireTvAction,
  Issue,
  ViewId,
} from "./types";
import { asMessage, escapeHtml, timeAgo } from "./utils";

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
  recentActivity,
} = appState;

function render() {
  const issues = deriveIssues();
  document.body.innerHTML = `
    <main class="desk-shell">
      <aside class="sidebar">
        <div class="sidebar-top">
          <div class="sidebar-brand">
            <div class="brand-mark">DR</div>
            <div><strong>Desk Remote</strong><p>Media control utility</p></div>
          </div>
          <nav class="sidebar-nav">
            ${navButton("home", "Home", "house")}
            ${navGroup("playback", "Playback", [["spotify", "Spotify", "music-4"], ["quick-access", "Quick Access", "sparkles"], ["hotkeys", "Hotkeys", "keyboard"]])}
            ${navGroup("firetv", "Fire TV", [["firetv-device", "ADB & Device", "tv"], ["apps", "Apps", "grid-2x2"], ["remote", "Remote", "gamepad-2"]])}
            ${navGroup("system", "System", [["health", "Health", "activity"], ["general", "General", "settings-2"]])}
          </nav>
        </div>
        <div class="sidebar-footer">
          <p>v${escapeHtml(packageJson.version)}</p>
        </div>
      </aside>
      <section class="workspace">
        <header class="topbar">
          <div><p>${escapeHtml(sectionLabel(currentView))}</p><h1>${escapeHtml(titleForView(currentView))}</h1></div>
          <div class="topbar-actions">
            <span class="pill">v${escapeHtml(packageJson.version)}</span>
            <div class="issues-anchor">
              <button class="pill ${issues.length ? "is-warning" : "is-ready"}" id="issues-button" type="button">${issues.length} ${issues.length === 1 ? "issue" : "issues"}</button>
              ${issuesOpen ? issuePopover(issues) : ""}
            </div>
          </div>
        </header>
        ${flashMessage ? `<p class="flash-banner ${flashIsError ? "is-error" : ""}">${escapeHtml(flashMessage)}</p>` : ""}
        <section class="view-shell">${renderView()}</section>
      </section>
    </main>
  `;
  renderIcons();
  bindEvents();
}

function renderView() {
  switch (currentView) {
    case "home":
      return renderHome();
    case "spotify":
      return renderSpotify();
    case "quick-access":
      return renderQuickAccess();
    case "hotkeys":
      return renderHotkeys();
    case "firetv-device":
      return renderFireTvDevice();
    case "apps":
      return renderApps();
    case "remote":
      return renderRemote();
    case "health":
      return renderHealth();
    case "general":
      return renderGeneral();
  }
}

function renderHome() {
  const issues = deriveIssues();
  const favorites = currentBindings.filter((binding) => binding.favorite).slice(0, 6);
  const hotkeys = currentBindings.filter((binding) => binding.hotkey.trim());
  return `
    <section class="home-grid">
      <section class="home-main">
        <article class="panel">
          <div class="panel-header"><div><p class="panel-kicker">Favorites</p><h2>Quick Access</h2></div><button class="link-button" data-view="quick-access" type="button">Manage</button></div>
          ${
            favorites.length
              ? `<div class="quick-grid">${favorites.map((binding) => `<button class="quick-tile execute-binding-button" data-binding-id="${escapeHtml(binding.id)}" data-tooltip="${escapeHtml(describeBindingAction(binding.action))}" type="button" ${busy ? "disabled" : ""}><span class="quick-icon">${icon(bindingIcon(binding.action))}</span><span>${escapeHtml(binding.label)}</span></button>`).join("")}</div>`
              : emptyState("No quick actions yet", "Mark bindings as favorites to pin them here.", "quick-access", "Open Quick Access")
          }
        </article>
        <article class="panel">
          <div class="panel-header"><div><p class="panel-kicker">Keyboard</p><h2>Shortcuts</h2></div><button class="link-button" data-view="hotkeys" type="button">Manage hotkeys</button></div>
          ${
            hotkeys.length
              ? `<div class="shortcut-list">${hotkeys.map((binding) => `<article class="shortcut-row"><div class="shortcut-copy"><span class="shortcut-icon">${icon(bindingIcon(binding.action))}</span><div><h3>${escapeHtml(binding.label)}</h3><p>${escapeHtml(describeBindingAction(binding.action))}</p></div></div><kbd>${escapeHtml(binding.hotkey)}</kbd></article>`).join("")}</div>`
              : emptyState("No hotkeys configured", "Add a hotkey to any binding and it will appear here.", "hotkeys", "Open Hotkeys")
          }
        </article>
        <article class="panel">
          <div class="panel-header"><div><p class="panel-kicker">Recent</p><h2>Recent activity</h2></div></div>
          ${
            recentActivity.length
              ? `<div class="activity-list">${recentActivity.map((item) => `<article class="activity-item ${item.tone}"><div><h3>${escapeHtml(item.text)}</h3><p>${escapeHtml(timeAgo(item.at))}</p></div></article>`).join("")}</div>`
              : emptyStateText("No recent activity", "Recent actions and issues will show up here.")
          }
        </article>
      </section>
      <aside class="home-side">
        <button class="panel hero-panel action-tile" id="start-spotify-on-tv-button" type="button" ${busy ? "disabled" : ""}>
          <div class="hero-top">
            <div>
              <p class="panel-kicker">Main flow</p>
              <h2>Spotify on TV</h2>
            </div>
            <span class="status-chip ${issues.length ? "is-warning" : "is-ready"}">${escapeHtml(issues.length ? issues[0].title : "Ready")}</span>
          </div>
          <div class="action-tile-body">
            <span class="action-tile-icon">${icon("music-4")}</span>
            <div class="action-tile-copy">
              <strong>Start Spotify on TV</strong>
              <p>Wake the TV, launch Spotify, and transfer playback.</p>
            </div>
          </div>
        </button>
        <article class="panel utility-panel">
          <div class="panel-header"><div><p class="panel-kicker">Readiness</p><h2>System status</h2></div></div>
          <div class="readiness-list">${readinessRows().map((row) => `<article class="readiness-row ${row.tone}"><div><h3>${escapeHtml(row.label)}</h3><p>${escapeHtml(row.detail)}</p></div>${row.view ? `<button class="link-button" data-view="${row.view}" type="button">${escapeHtml(row.actionLabel)}</button>` : ""}</article>`).join("")}</div>
        </article>
        <article class="panel utility-panel">
          <div class="panel-header"><div><p class="panel-kicker">Snapshot</p><h2>Device snapshot</h2></div></div>
          <div class="snapshot-list">
          ${snapshotRow("tv", "Fire TV", currentConfig.firetv_ip || "Not configured")}
            ${snapshotRow("plug-zap", "Connection", currentFireTvStatus?.connected ? "Connected" : "Offline")}
            ${snapshotRow("monitor-up", "Screen", screenLabel(currentFireTvStatus?.screen_awake))}
            ${snapshotRow("music-4", "Spotify target", currentSpotifyStatus?.target_name ?? "Not detected")}
            ${snapshotRow("grid-2x2", "Cached apps", String(currentFireTvApps.length))}
            ${snapshotRow("keyboard", "Active hotkeys", String(hotkeys.length))}
          </div>
        </article>
        <article class="panel utility-panel">
          <div class="panel-header"><div><p class="panel-kicker">Tools</p><h2>Quick tools</h2></div></div>
          <div class="tool-list">
            <button class="tool-row" data-view="apps" type="button">Open Apps</button>
            <button class="tool-row" data-view="remote" type="button">Open Remote</button>
            <button class="tool-row" data-view="health" type="button">Run diagnostics</button>
            <button class="tool-row" data-view="general" type="button">Open settings</button>
          </div>
        </article>
      </aside>
    </section>
  `;
}

function renderSpotify() {
  return `
    <section class="content-grid two-column">
      <article class="panel">
        <div class="panel-header"><div><p class="panel-kicker">Credentials</p><h2>Spotify</h2></div></div>
        <form class="form" id="spotify-settings-form">
          ${textInput("spotify-client-id", "Spotify Client ID", currentConfig.spotify_client_id, "your-client-id")}
          ${textInput("spotify-client-secret", "Spotify Client Secret", currentConfig.spotify_client_secret, "your-client-secret")}
          ${textInput("spotify-redirect-url", "Spotify Redirect URL", currentConfig.spotify_redirect_url, "http://127.0.0.1:8888/callback")}
          ${textInput("spotify-target-hints", "Target hints", currentConfig.spotify_target_hints, "fire, tv, amazon")}
          <div class="actions">
            <button class="button-primary" id="save-spotify-settings-button" type="submit" ${busy ? "disabled" : ""}>Save Spotify settings</button>
            <button class="button-secondary" id="spotify-status-button" type="button" ${busy ? "disabled" : ""}>Check status</button>
          </div>
        </form>
      </article>
      <article class="panel">
        <div class="panel-header"><div><p class="panel-kicker">Session</p><h2>Authentication and target</h2></div></div>
        <div class="metric-grid">
          ${metric("Session", currentSpotifyStatus?.authenticated ? "Authenticated" : "Not authenticated")}
          ${metric("Target", currentSpotifyStatus?.target_name ?? "Not detected")}
          ${metric("Auth stage", currentSpotifyDebug?.stage ?? "Unknown")}
        </div>
        <div class="actions">
          <button class="button-primary" id="spotify-start-auth-button" type="button" ${busy ? "disabled" : ""}>Start Spotify auth</button>
          <button class="button-secondary" id="spotify-toggle-button" type="button" ${busy ? "disabled" : ""}>Toggle on TV</button>
          <button class="button-secondary" id="spotify-debug-button" type="button" ${busy ? "disabled" : ""}>Inspect auth</button>
        </div>
        ${textInput("spotify-auth-url", "Spotify auth URL", spotifyAuthUrl, "Generated after auth", true)}
        <details class="detail-block">
          <summary>Manual fallback</summary>
          ${textInput("spotify-callback-input", "Callback URL or code", spotifyCallbackInput, "Paste callback URL or code")}
          <div class="actions"><button class="button-secondary" id="spotify-finish-auth-button" type="button" ${busy ? "disabled" : ""}>Finish auth manually</button></div>
        </details>
      </article>
    </section>
  `;
}

function renderQuickAccess() {
  const favorites = currentBindings.filter((binding) => binding.favorite);
  return `
    <section class="content-grid two-column">
      <article class="panel">
        <div class="panel-header"><div><p class="panel-kicker">Favorites</p><h2>Quick Access</h2></div></div>
        ${
          currentBindings.length
            ? `<div class="binding-list">${currentBindings.map((binding) => `<article class="binding-row"><div><h3>${escapeHtml(binding.label)}</h3><p>${escapeHtml(describeBindingAction(binding.action))}</p></div><label class="toggle-line"><input class="favorite-toggle" data-binding-id="${escapeHtml(binding.id)}" type="checkbox" ${binding.favorite ? "checked" : ""} /><span>Quick Access</span></label></article>`).join("")}</div>`
            : emptyStateText("No bindings yet", "Create a binding first in Hotkeys.")
        }
      </article>
      <article class="panel">
        <div class="panel-header"><div><p class="panel-kicker">Preview</p><h2>Current favorites</h2></div></div>
        ${
          favorites.length
            ? `<div class="quick-grid">${favorites.slice(0, 6).map((binding) => `<button class="quick-tile execute-binding-button" data-binding-id="${escapeHtml(binding.id)}" data-tooltip="${escapeHtml(describeBindingAction(binding.action))}" type="button" ${busy ? "disabled" : ""}><span class="quick-icon">${icon(bindingIcon(binding.action))}</span><span>${escapeHtml(binding.label)}</span></button>`).join("")}</div>`
            : emptyStateText("No favorites pinned", "Mark a binding as favorite to make it appear here.")
        }
      </article>
    </section>
  `;
}

function renderHotkeys() {
  return `
    <section class="content-grid two-column">
      <article class="panel"><div class="panel-header"><div><p class="panel-kicker">Bindings</p><h2>${editingBindingId ? "Edit binding" : "Create binding"}</h2></div></div>${bindingForm()}</article>
      <article class="panel">
        <div class="panel-header"><div><p class="panel-kicker">Registered</p><h2>Bindings and hotkeys</h2></div></div>
        ${
          currentBindings.length
            ? `<div class="binding-list">${currentBindings.map((binding) => `<article class="binding-row"><div><div class="binding-title-row"><h3>${escapeHtml(binding.label)}</h3>${binding.favorite ? `<span class="mini-tag">Favorite</span>` : ""}</div><p>${escapeHtml(describeBindingAction(binding.action))}</p></div><div class="binding-actions">${binding.hotkey ? `<kbd>${escapeHtml(binding.hotkey)}</kbd>` : `<span class="muted">No hotkey</span>`}<button class="button-secondary edit-binding-button" data-binding-id="${escapeHtml(binding.id)}" type="button" ${busy ? "disabled" : ""}>Edit</button><button class="button-secondary execute-binding-button" data-binding-id="${escapeHtml(binding.id)}" type="button" ${busy ? "disabled" : ""}>Run</button><button class="button-secondary delete-binding-button" data-binding-id="${escapeHtml(binding.id)}" type="button" ${busy ? "disabled" : ""}>Delete</button></div></article>`).join("")}</div>`
            : emptyStateText("No bindings yet", "Create a reusable action for quick access, tray, or hotkeys.")
        }
      </article>
    </section>
  `;
}

function renderFireTvDevice() {
  return `
    <section class="content-grid two-column">
      <article class="panel">
        <div class="panel-header"><div><p class="panel-kicker">Device</p><h2>ADB and device</h2></div></div>
        <form class="form" id="firetv-settings-form">
          ${textInput("firetv-ip", "Fire TV IP", currentConfig.firetv_ip, "192.168.0.10")}
          <div class="actions">
            <button class="button-primary" id="save-firetv-settings-button" type="submit" ${busy ? "disabled" : ""}>Save Fire TV settings</button>
            <button class="button-secondary" id="firetv-check-button" type="button" ${busy ? "disabled" : ""}>Test connection</button>
            <button class="button-secondary remote-button" data-firetv-action="connect" type="button" ${busy ? "disabled" : ""}>Connect</button>
            <button class="button-secondary remote-button" data-firetv-action="ensure_awake" type="button" ${busy ? "disabled" : ""}>Wake if asleep</button>
          </div>
        </form>
      </article>
      <article class="panel">
        <div class="panel-header"><div><p class="panel-kicker">Status</p><h2>Current Fire TV state</h2></div></div>
        <div class="metric-grid">
          ${metric("ADB", currentFireTvStatus?.adb_available ? "Available" : "Missing")}
          ${metric("Connection", currentFireTvStatus?.connected ? "Connected" : "Not connected")}
          ${metric("Screen", screenLabel(currentFireTvStatus?.screen_awake))}
          ${metric("Target", currentFireTvStatus?.target ?? "No target")}
        </div>
      </article>
    </section>
  `;
}

function renderApps() {
  const apps = filteredApps();
  return `
    <section class="content-grid two-column-wide">
      <article class="panel">
        <div class="panel-header"><div><p class="panel-kicker">Launcher</p><h2>Fire TV Apps</h2></div></div>
        <div class="actions">
          <button class="button-primary" id="firetv-scan-apps-button" type="button" ${busy ? "disabled" : ""}>Scan Fire TV apps</button>
          <button class="button-secondary" id="firetv-load-apps-button" type="button" ${busy ? "disabled" : ""}>Load cached apps</button>
        </div>
        ${textInput("firetv-app-filter", "Filter apps", fireTvAppFilter, "spotify, netflix, youtube...")}
        ${apps.length ? `<div class="app-list">${apps.map((app) => `<article class="app-launch-row"><div><h3>${escapeHtml(app.display_name)}</h3><p>${escapeHtml(app.package_name)}</p></div><button class="button-secondary launch-app-button" data-package-name="${escapeHtml(app.package_name)}" type="button" ${busy ? "disabled" : ""}>Launch</button></article>`).join("")}</div>` : emptyStateText("No cached apps yet", "Scan Fire TV apps to build your launcher list.")}
      </article>
      <article class="panel"><div class="panel-header"><div><p class="panel-kicker">Summary</p><h2>App cache</h2></div></div><div class="metric-grid">${metric("Cached apps", String(currentFireTvApps.length))}${metric("Filter", fireTvAppFilter || "No filter")}${metric("Favorites", String(currentBindings.filter((binding) => binding.favorite).length))}</div></article>
    </section>
  `;
}

function renderRemote() {
  return `
    <section class="panel">
      <div class="panel-header"><div><p class="panel-kicker">Manual control</p><h2>Remote</h2></div></div>
      <div class="remote-toolbar">
        <button class="button-secondary remote-button" data-firetv-action="home" type="button" ${busy ? "disabled" : ""}>Home</button>
        <button class="button-secondary remote-button" data-firetv-action="back" type="button" ${busy ? "disabled" : ""}>Back</button>
        <button class="button-secondary remote-button" data-firetv-action="launch_spotify" type="button" ${busy ? "disabled" : ""}>Open Spotify</button>
        <button class="button-secondary remote-button" data-firetv-action="play_pause" type="button" ${busy ? "disabled" : ""}>Play/Pause</button>
      </div>
      <div class="remote-pad">
        <button class="button-secondary remote-button" data-firetv-action="up" type="button" ${busy ? "disabled" : ""}>Up</button>
        <div class="remote-pad-row">
          <button class="button-secondary remote-button" data-firetv-action="left" type="button" ${busy ? "disabled" : ""}>Left</button>
          <button class="button-primary remote-button" data-firetv-action="select" type="button" ${busy ? "disabled" : ""}>Select</button>
          <button class="button-secondary remote-button" data-firetv-action="right" type="button" ${busy ? "disabled" : ""}>Right</button>
        </div>
        <button class="button-secondary remote-button" data-firetv-action="down" type="button" ${busy ? "disabled" : ""}>Down</button>
      </div>
    </section>
  `;
}

function renderHealth() {
  const issues = deriveIssues();
  return `
    <section class="content-grid two-column">
      <article class="panel">
        <div class="panel-header"><div><p class="panel-kicker">Readiness</p><h2>Health</h2></div><button class="button-secondary" id="health-button" type="button" ${busy ? "disabled" : ""}>Refresh health</button></div>
        ${issues.length ? `<div class="issue-list">${issues.map((issue) => `<article class="issue-item ${issue.tone}"><div><h3>${escapeHtml(issue.title)}</h3><p>${escapeHtml(issue.detail)}</p></div><button class="link-button" data-view="${issue.view}" type="button">${escapeHtml(issue.actionLabel)}</button></article>`).join("")}</div>` : emptyStateText("No current blockers", "The system is ready for Spotify on TV.")}
      </article>
      <article class="panel">
        <div class="panel-header"><div><p class="panel-kicker">Checks</p><h2>Technical summary</h2></div></div>
        <div class="snapshot-list">
          ${snapshotRow("folder-open", "Config path", currentHealth?.config_path ?? "Unavailable")}
          ${snapshotRow("tv", "Fire TV summary", currentHealth?.firetv_summary ?? "Unavailable")}
          ${snapshotRow("music-4", "Spotify summary", currentHealth?.spotify_summary ?? "Unavailable")}
          ${snapshotRow("activity", "Fire TV status", currentFireTvStatus?.summary ?? "Unavailable")}
          ${snapshotRow("activity", "Spotify status", currentSpotifyStatus?.summary ?? "Unavailable")}
        </div>
      </article>
    </section>
  `;
}

function renderGeneral() {
  return `
    <section class="content-grid two-column">
      <article class="panel">
        <div class="panel-header"><div><p class="panel-kicker">Configuration</p><h2>General</h2></div></div>
        <div class="snapshot-list">
          ${snapshotRow("badge-info", "App version", packageJson.version)}
          ${snapshotRow("folder-open", "Config path", currentHealth?.config_path ?? "Unavailable")}
          ${snapshotRow("command", "Stored bindings", String(currentBindings.length))}
          ${snapshotRow("grid-2x2", "Cached apps", String(currentFireTvApps.length))}
          ${snapshotRow("keyboard", "Active hotkeys", String(currentBindings.filter((binding) => binding.hotkey.trim()).length))}
        </div>
      </article>
      <article class="panel">
        <div class="panel-header"><div><p class="panel-kicker">Tools</p><h2>General tools</h2></div></div>
        <div class="tool-list">
          <button class="tool-row" id="reload-button" type="button">Reload from disk</button>
          <button class="tool-row" id="health-button" type="button">Refresh health</button>
          <button class="tool-row" data-view="spotify" type="button">Open Spotify settings</button>
          <button class="tool-row" data-view="firetv-device" type="button">Open Fire TV settings</button>
        </div>
      </article>
    </section>
  `;
}

function bindingForm() {
  return `
    <form class="form" id="binding-form">
      ${textInput("binding-label", "Label", newBindingLabel, "Watch Spotify on TV")}
      <label>
        <span>Hotkey</span>
        <div class="input-with-button">
          <input id="binding-hotkey" value="${escapeHtml(newBindingHotkey)}" placeholder="Ctrl+Shift+S" />
          <button class="button-secondary" id="binding-record-hotkey-button" type="button" ${busy ? "disabled" : ""}>${isRecordingHotkey ? "Press keys..." : "Record hotkey"}</button>
        </div>
      </label>
      <p class="meta">${isRecordingHotkey ? "Recording hotkey. Press your combination now, Esc to cancel, or Backspace/Delete to clear." : "Type it manually or use Record hotkey."}</p>
      <label class="toggle-line"><input id="binding-favorite" type="checkbox" ${newBindingFavorite ? "checked" : ""} /><span>Show in Quick Access</span></label>
      <label><span>Action type</span><select id="binding-action-type">${bindingActionOptions()}</select></label>
      ${bindingActionRequiresValue(newBindingActionType) ? `<label><span>${escapeHtml(bindingActionValueLabel(newBindingActionType))}</span>${bindingActionControl()}</label>` : ""}
      <div class="actions">
        <button class="button-primary" type="submit" ${busy ? "disabled" : ""}>${editingBindingId ? "Update binding" : "Save binding"}</button>
        <button class="button-secondary" id="binding-reset-button" type="button" ${busy ? "disabled" : ""}>${editingBindingId ? "Cancel edit" : "Clear form"}</button>
      </div>
    </form>
  `;
}

function navButton(view: ViewId, label: string, iconName: string, child = false) {
  return `<button class="nav-link ${child ? "is-child " : ""}${currentView === view ? "is-active" : ""}" data-view="${view}" type="button"><span class="nav-link-copy">${icon(iconName)}<span>${escapeHtml(label)}</span></span></button>`;
}

function navGroup(id: string, label: string, items: Array<[ViewId, string, string]>) {
  const open = openGroups.has(id);
  return `<section class="nav-group"><button class="nav-group-button ${open ? "is-open" : ""}" data-group="${id}" type="button"><span>${escapeHtml(label)}</span><span class="nav-group-chevron">${icon("chevron-down")}</span></button>${open ? `<div class="nav-group-items">${items.map(([view, itemLabel, iconName]) => navButton(view, itemLabel, iconName, true)).join("")}</div>` : ""}</section>`;
}

function issuePopover(issues: Issue[]) {
  return `<section class="issues-popover"><header><h2>Readiness issues</h2><button class="link-button" id="close-issues-button" type="button">Close</button></header>${issues.length ? `<div class="issue-list">${issues.map((issue) => `<article class="issue-item ${issue.tone}"><div><h3>${escapeHtml(issue.title)}</h3><p>${escapeHtml(issue.detail)}</p></div><button class="link-button" data-view="${issue.view}" type="button">${escapeHtml(issue.actionLabel)}</button></article>`).join("")}</div>` : `<p class="muted">Everything needed for Spotify on TV looks ready.</p>`}<div class="popover-footer"><button class="button-secondary" id="open-health-button" type="button">Open Health</button></div></section>`;
}

function textInput(id: string, label: string, value: string, placeholder: string, readOnly = false) {
  return `<label><span>${escapeHtml(label)}</span><input id="${id}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${readOnly ? "readonly" : ""} /></label>`;
}

function metric(label: string, value: string, iconName = "circle") {
  return `<article class="metric-card"><div class="metric-label">${icon(iconName)}<p>${escapeHtml(label)}</p></div><h3>${escapeHtml(value)}</h3></article>`;
}

function snapshotRow(iconName: string, label: string, value: string) {
  return `<article class="snapshot-row"><span class="snapshot-label">${icon(iconName)}<span>${escapeHtml(label)}</span></span><strong>${escapeHtml(value)}</strong></article>`;
}

function emptyState(title: string, text: string, view: ViewId, actionLabel: string) {
  return `<div class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p><button class="button-secondary" data-view="${view}" type="button">${escapeHtml(actionLabel)}</button></div>`;
}

function emptyStateText(title: string, text: string) {
  return `<div class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>`;
}

function readinessRows() {
  return [
    {
      label: "Fire TV reachable",
      detail: currentFireTvStatus?.connected ? "Device responded to ADB" : "Reconnect the configured device",
      view: currentFireTvStatus?.connected ? null : "firetv-device",
      actionLabel: "Open device",
      tone: currentFireTvStatus?.connected ? "ready" : "warning",
    },
    {
      label: "TV awake",
      detail: currentFireTvStatus?.screen_awake === true ? "Screen looks responsive" : "Wake the screen before playback",
      view: currentFireTvStatus?.screen_awake === true ? null : "firetv-device",
      actionLabel: "Wake TV",
      tone: currentFireTvStatus?.screen_awake === true ? "ready" : "warning",
    },
    {
      label: "Spotify authenticated",
      detail: currentSpotifyStatus?.authenticated ? "Token cache is valid" : "Authenticate Spotify to continue",
      view: currentSpotifyStatus?.authenticated ? null : "spotify",
      actionLabel: "Open Spotify",
      tone: currentSpotifyStatus?.authenticated ? "ready" : "error",
    },
    {
      label: "Target device detected",
      detail: currentSpotifyStatus?.target_found ? currentSpotifyStatus.target_name ?? "TV target available" : "Open Spotify on the TV or review hints",
      view: currentSpotifyStatus?.target_found ? null : "spotify",
      actionLabel: "Review target",
      tone: currentSpotifyStatus?.target_found ? "ready" : "warning",
    },
  ] as const;
}

function deriveIssues() {
  const issues: Issue[] = [];
  if (!currentConfig.firetv_ip.trim()) issues.push({ title: "Fire TV IP missing", detail: "Configure the target device before trying to control the TV.", view: "firetv-device", actionLabel: "Open device", tone: "error" });
  else if (currentFireTvStatus && !currentFireTvStatus.connected) issues.push({ title: "Fire TV not connected", detail: "The configured device is not responding over ADB.", view: "firetv-device", actionLabel: "Reconnect", tone: "error" });
  if (currentSpotifyStatus && !currentSpotifyStatus.authenticated) issues.push({ title: "Spotify authentication required", detail: "Authenticate Spotify before trying to transfer playback.", view: "spotify", actionLabel: "Open Spotify", tone: "error" });
  if (currentSpotifyStatus?.authenticated && !currentSpotifyStatus.target_found) issues.push({ title: "Target device not detected", detail: "Open Spotify on the TV or review your target hints.", view: "spotify", actionLabel: "Review target", tone: "warning" });
  return issues;
}

function screenLabel(value: boolean | null | undefined) {
  return value === true ? "Awake" : value === false ? "Asleep" : "Unavailable";
}

function sectionLabel(view: ViewId) {
  if (["spotify", "quick-access", "hotkeys"].includes(view)) return "Playback";
  if (["firetv-device", "apps", "remote"].includes(view)) return "Fire TV";
  if (["health", "general"].includes(view)) return "System";
  return "Dashboard";
}

function titleForView(view: ViewId) {
  const map: Record<ViewId, string> = {
    home: "Home",
    spotify: "Spotify",
    "quick-access": "Quick Access",
    hotkeys: "Hotkeys",
    "firetv-device": "ADB & Device",
    apps: "Apps",
    remote: "Remote",
    health: "Health",
    general: "General",
  };
  return map[view];
}

function bindingActionOptions() {
  return [
    ["start_spotify_on_tv", "Start Spotify On TV"],
    ["spotify_toggle_tv", "Spotify toggle on TV"],
    ["fire_tv_key", "Fire TV key"],
    ["launch_app", "Launch Fire TV app"],
  ].map(([value, label]) => `<option value="${escapeHtml(value)}" ${newBindingActionType === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function bindingActionRequiresValue(actionType: string) {
  return actionType === "fire_tv_key" || actionType === "launch_app";
}

function bindingActionValueLabel(actionType: string) {
  return actionType === "fire_tv_key" ? "Fire TV action" : "Package name";
}

function bindingActionControl() {
  if (newBindingActionType === "fire_tv_key") {
    const values: FireTvAction[] = ["connect", "ensure_awake", "launch_spotify", "wake", "home", "back", "up", "down", "left", "right", "select", "play_pause"];
    return `<select id="binding-action-value">${values.map((value) => `<option value="${value}" ${newBindingActionValue === value ? "selected" : ""}>${value}</option>`).join("")}</select>`;
  }
  return `<select id="binding-action-value"><option value="" ${newBindingActionValue ? "" : "selected"}>Choose cached app</option>${currentFireTvApps.map((app) => `<option value="${escapeHtml(app.package_name)}" ${newBindingActionValue === app.package_name ? "selected" : ""}>${escapeHtml(app.display_name)}</option>`).join("")}</select>`;
}

function filteredApps() {
  const filter = fireTvAppFilter.trim().toLowerCase();
  return currentFireTvApps.filter((app) => !filter || app.display_name.toLowerCase().includes(filter) || app.package_name.toLowerCase().includes(filter));
}

function bindingIcon(action: BindingAction) {
  if (action === "spotify_toggle_tv" || action === "start_spotify_on_tv") return "music-4";
  if (typeof action === "object" && "launch_app" in action) return "app-window";
  return "tv";
}

function describeBindingAction(action: BindingAction) {
  if (action === "spotify_toggle_tv") return "Spotify toggle on TV";
  if (action === "start_spotify_on_tv") return "Start Spotify on TV";
  if ("launch_app" in action) return `Launch ${action.launch_app.package_name}`;
  return `Fire TV key: ${action.fire_tv_key.action}`;
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

function bindingActionType(action: BindingAction) {
  if (action === "spotify_toggle_tv") return "spotify_toggle_tv";
  if (action === "start_spotify_on_tv") return "start_spotify_on_tv";
  if (typeof action === "object" && "launch_app" in action) return "launch_app";
  return "fire_tv_key";
}

function bindingActionValue(action: BindingAction) {
  if (typeof action === "object" && "launch_app" in action) return action.launch_app.package_name;
  if (typeof action === "object" && "fire_tv_key" in action) return action.fire_tv_key.action;
  return "";
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
  document.querySelector("#spotify-status-button")?.addEventListener("click", () => void refreshSpotifyStatus());
  document.querySelector("#spotify-start-auth-button")?.addEventListener("click", () => void startSpotifyAuth());
  document.querySelector("#spotify-debug-button")?.addEventListener("click", () => void inspectSpotifyAuth());
  document.querySelector("#spotify-finish-auth-button")?.addEventListener("click", () => void finishSpotifyAuth());
  document.querySelector("#spotify-toggle-button")?.addEventListener("click", () => void toggleSpotifyOnTv());
  document.querySelector("#firetv-check-button")?.addEventListener("click", () => void refreshFireTvStatus());
  document.querySelector("#reload-button")?.addEventListener("click", () => void loadAll("Configuration reloaded from disk."));
  document.querySelector("#health-button")?.addEventListener("click", () => void refreshHealth());
  document.querySelector("#firetv-scan-apps-button")?.addEventListener("click", () => void scanFireTvApps());
  document.querySelector("#firetv-load-apps-button")?.addEventListener("click", () => void loadCachedFireTvApps());
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
      const id = button.dataset.bindingId;
      if (id) void executeBinding(id);
    }),
  );
  document.querySelectorAll<HTMLButtonElement>(".delete-binding-button").forEach((button) =>
    button.addEventListener("click", () => {
      const id = button.dataset.bindingId;
      if (id) void deleteBinding(id);
    }),
  );
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
  flashMessage = message;
  flashIsError = isError;
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
  let action: BindingAction;
  if (actionType === "spotify_toggle_tv") action = "spotify_toggle_tv";
  else if (actionType === "start_spotify_on_tv") action = "start_spotify_on_tv";
  else if (actionType === "launch_app") action = { launch_app: { package_name: newBindingActionValue.trim() } };
  else if (actionType === "fire_tv_key") action = { fire_tv_key: { action: newBindingActionValue.trim() as FireTvAction } };
  else throw new Error(`Unsupported binding action type: ${actionType}`);
  return { id: editingBindingId, label: newBindingLabel, hotkey: newBindingHotkey, favorite: newBindingFavorite, action };
}

async function persistCurrentConfig() {
  currentConfig = await api.saveSettings(currentConfig);
}

function addActivity(text: string, tone: Activity["tone"]) {
  recentActivity.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, tone, at: Date.now() });
  recentActivity = recentActivity.slice(0, 8);
}

document.addEventListener("keydown", handleHotkeyRecording, true);

void loadAll();

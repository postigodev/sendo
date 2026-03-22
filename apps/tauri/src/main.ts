import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

type AppConfig = {
  firetv_ip: string;
  spotify_client_id: string;
  spotify_client_secret: string;
  spotify_redirect_url: string;
  spotify_target_hints: string;
  spotify_auth_state: string;
};

type HealthStatus = {
  config_path: string;
  firetv_configured: boolean;
  spotify_configured: boolean;
  firetv_summary: string;
  spotify_summary: string;
};

type FireTvStatus = {
  configured: boolean;
  adb_available: boolean;
  connected: boolean;
  screen_awake: boolean | null;
  target: string | null;
  summary: string;
};

type FireTvApp = {
  package_name: string;
  display_name: string;
  source: string;
};

type FireTvAppCache = {
  scanned_at_epoch_ms: number;
  apps: FireTvApp[];
};

type FireTvAppScanResult = {
  target: string;
  scanned_at_epoch_ms: number;
  apps: FireTvApp[];
  summary: string;
};

type ActionResult = {
  message: string;
};

type AuthUrlResult = {
  url: string;
  message: string;
};

type SpotifyStatus = {
  configured: boolean;
  authenticated: boolean;
  target_found: boolean;
  target_name: string | null;
  summary: string;
  auth_url: string | null;
  token_cache_path: string;
};

type SpotifyAuthDebug = {
  stage: string;
  detail: string;
  state: string;
  redirect_uri: string;
  token_cache_path: string;
};

type FireTvAction =
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

const defaultConfig: AppConfig = {
  firetv_ip: "",
  spotify_client_id: "",
  spotify_client_secret: "",
  spotify_redirect_url: "",
  spotify_target_hints: "fire, tv, amazon, spotify, insignia, toshiba, osint",
  spotify_auth_state: "",
};

let currentConfig: AppConfig = { ...defaultConfig };
let currentHealth: HealthStatus | null = null;
let currentFireTvStatus: FireTvStatus | null = null;
let currentFireTvApps: FireTvApp[] = [];
let currentSpotifyStatus: SpotifyStatus | null = null;
let spotifyAuthDebug: SpotifyAuthDebug | null = null;
let spotifyAuthUrl = "";
let spotifyCallbackInput = "";
let spotifyAuthMode = "Auto callback in localhost";
let fireTvAppFilter = "";
let busy = false;
let flashMessage = "";
let flashIsError = false;

function render() {
  document.body.innerHTML = `
    <main class="app-shell">
      <section class="layout">
        <section class="hero">
          <div class="hero-grid">
            <div>
              <div class="chips">
                <span class="chip">Hito 1</span>
                <span class="chip">Spotify + Fire TV</span>
              </div>
              <h1>Desk Remote control surface</h1>
              <p>
                Base de configuracion para Fire TV y Spotify. Este hito deja
                persistencia local, comandos Tauri reales y una UI minima para
                diagnostico. Hito 2 suma control Fire TV real via ADB.
              </p>
            </div>
            <div>
              <p class="meta">Estado actual del proyecto</p>
              <div class="status-grid">
                ${renderBadge("Fire TV", currentHealth?.firetv_configured ?? false)}
                ${renderBadge("Spotify", currentHealth?.spotify_configured ?? false)}
              </div>
            </div>
          </div>
          <div class="actions">
            <button class="button-primary" id="start-spotify-on-tv-button" type="button" ${
              busy ? "disabled" : ""
            }>
              Start Spotify On TV
            </button>
          </div>
        </section>

        <section class="panel-grid">
          <section class="panel">
            <h2>Settings</h2>
            <p class="hint">
              Guarda la configuracion base que usaran los modulos reales en los
              siguientes hitos.
            </p>
            <form class="form" id="settings-form">
              <label>
                <span>Fire TV IP</span>
                <input
                  id="firetv-ip"
                  name="firetv_ip"
                  placeholder="192.168.0.10"
                  value="${escapeHtml(currentConfig.firetv_ip)}"
                />
              </label>

              <label>
                <span>Spotify Client ID</span>
                <input
                  id="spotify-client-id"
                  name="spotify_client_id"
                  placeholder="your-client-id"
                  value="${escapeHtml(currentConfig.spotify_client_id)}"
                />
              </label>

              <label>
                <span>Spotify Client Secret</span>
                <input
                  id="spotify-client-secret"
                  name="spotify_client_secret"
                  placeholder="your-client-secret"
                  value="${escapeHtml(currentConfig.spotify_client_secret)}"
                />
              </label>

              <label>
                <span>Spotify Redirect URL</span>
                <input
                  id="spotify-redirect-url"
                  name="spotify_redirect_url"
                  placeholder="http://127.0.0.1:8898/callback"
                  value="${escapeHtml(currentConfig.spotify_redirect_url)}"
                />
              </label>

              <label>
                <span>Spotify target hints</span>
                <input
                  id="spotify-target-hints"
                  name="spotify_target_hints"
                  placeholder="fire, tv, amazon"
                  value="${escapeHtml(currentConfig.spotify_target_hints)}"
                />
              </label>

              <div class="actions">
                <button class="button-primary" type="submit" ${
                  busy ? "disabled" : ""
                }>
                  ${busy ? "Saving..." : "Save settings"}
                </button>
                <button class="button-secondary" id="reload-button" type="button" ${
                  busy ? "disabled" : ""
                }>
                  Reload from disk
                </button>
                <button class="button-secondary" id="health-button" type="button" ${
                  busy ? "disabled" : ""
                }>
                  Refresh health
                </button>
              </div>
            </form>
            <p class="flash ${flashIsError ? "is-error" : ""}">${escapeHtml(
              flashMessage,
            )}</p>
          </section>

          <section class="panel">
            <h2>Health check</h2>
            ${
              currentHealth
                ? `
                  <div class="status-list">
                    <article class="status-card">
                      <h3>Config file</h3>
                      <p class="status-copy">${escapeHtml(currentHealth.config_path)}</p>
                    </article>
                    <article class="status-card">
                      <h3>Fire TV</h3>
                      <p class="status-copy">${escapeHtml(currentHealth.firetv_summary)}</p>
                    </article>
                    <article class="status-card">
                      <h3>Spotify</h3>
                      <p class="status-copy">${escapeHtml(currentHealth.spotify_summary)}</p>
                    </article>
                  </div>
                `
                : `<p class="status-copy">No health data loaded yet.</p>`
            }
          </section>
        </section>

        <section class="panel">
          <h2>Fire TV remote</h2>
          <p class="hint">
            Usa la IP guardada para verificar ADB y enviar acciones manuales.
          </p>

          <div class="actions">
            <button class="button-primary" id="firetv-check-button" type="button" ${
              busy ? "disabled" : ""
            }>
              Test Fire TV connection
            </button>
          </div>

          ${
            currentFireTvStatus
              ? `
                <div class="status-list remote-status">
                    <article class="status-card">
                      <h3>ADB</h3>
                      <p class="status-copy">${currentFireTvStatus.adb_available ? "Available" : "Missing"}</p>
                    </article>
                    <article class="status-card">
                      <h3>Connection</h3>
                      <p class="status-copy">${currentFireTvStatus.connected ? "Connected" : "Not connected"}</p>
                    </article>
                    <article class="status-card">
                      <h3>Screen</h3>
                      <p class="status-copy">${renderScreenState(currentFireTvStatus.screen_awake)}</p>
                    </article>
                    <article class="status-card">
                      <h3>Target</h3>
                      <p class="status-copy">${escapeHtml(currentFireTvStatus.target ?? "No target selected")}</p>
                  </article>
                  <article class="status-card">
                    <h3>Summary</h3>
                    <p class="status-copy">${escapeHtml(currentFireTvStatus.summary)}</p>
                  </article>
                </div>
              `
              : `<p class="status-copy">Run a Fire TV connection test to inspect ADB and the configured target.</p>`
          }

          <div class="remote-grid">
            <button class="button-secondary remote-button" data-firetv-action="connect" type="button" ${
              busy ? "disabled" : ""
            }>Connect</button>
            <button class="button-secondary remote-button" data-firetv-action="ensure_awake" type="button" ${
              busy ? "disabled" : ""
            }>Wake if asleep</button>
            <button class="button-secondary remote-button" data-firetv-action="launch_spotify" type="button" ${
              busy ? "disabled" : ""
            }>Launch Spotify</button>
            <button class="button-secondary remote-button" data-firetv-action="wake" type="button" ${
              busy ? "disabled" : ""
            }>Wake</button>
            <button class="button-secondary remote-button" data-firetv-action="home" type="button" ${
              busy ? "disabled" : ""
            }>Home</button>
            <button class="button-secondary remote-button" data-firetv-action="back" type="button" ${
              busy ? "disabled" : ""
            }>Back</button>
            <button class="button-secondary remote-button" data-firetv-action="up" type="button" ${
              busy ? "disabled" : ""
            }>Up</button>
            <button class="button-secondary remote-button" data-firetv-action="left" type="button" ${
              busy ? "disabled" : ""
            }>Left</button>
            <button class="button-secondary remote-button" data-firetv-action="select" type="button" ${
              busy ? "disabled" : ""
            }>Select</button>
            <button class="button-secondary remote-button" data-firetv-action="right" type="button" ${
              busy ? "disabled" : ""
            }>Right</button>
            <button class="button-secondary remote-button" data-firetv-action="down" type="button" ${
              busy ? "disabled" : ""
            }>Down</button>
            <button class="button-secondary remote-button" data-firetv-action="play_pause" type="button" ${
              busy ? "disabled" : ""
            }>Play/Pause</button>
          </div>
        </section>

        <section class="panel">
          <h2>Fire TV apps</h2>
          <p class="hint">
            Scan installed apps on the TV, cache them locally, and launch them from Desk Remote.
          </p>

          <div class="actions">
            <button class="button-primary" id="firetv-scan-apps-button" type="button" ${
              busy ? "disabled" : ""
            }>
              Scan Fire TV apps
            </button>
            <button class="button-secondary" id="firetv-load-apps-button" type="button" ${
              busy ? "disabled" : ""
            }>
              Load cached apps
            </button>
          </div>

          <label>
            <span>Filter apps</span>
            <input
              id="firetv-app-filter"
              placeholder="spotify, netflix, youtube..."
              value="${escapeHtml(fireTvAppFilter)}"
            />
          </label>

          ${
            renderFireTvApps()
          }
        </section>

        <section class="panel">
          <h2>Spotify TV control</h2>
          <p class="hint">
            Autentica Spotify, detecta el dispositivo TV por hints y ejecuta el
            toggle inteligente sobre la tele.
          </p>

          <div class="actions">
            <button class="button-primary" id="spotify-status-button" type="button" ${
              busy ? "disabled" : ""
            }>
              Check Spotify status
            </button>
            <button class="button-secondary" id="spotify-debug-button" type="button" ${
              busy ? "disabled" : ""
            }>
              Inspect auth
            </button>
            <button class="button-secondary" id="spotify-start-auth-button" type="button" ${
              busy ? "disabled" : ""
            }>
              Start Spotify auth
            </button>
            <button class="button-secondary" id="spotify-toggle-button" type="button" ${
              busy ? "disabled" : ""
            }>
              Toggle on TV
            </button>
          </div>

          ${
            currentSpotifyStatus
              ? `
                <div class="status-list remote-status">
                  <article class="status-card">
                    <h3>Session</h3>
                    <p class="status-copy">${currentSpotifyStatus.authenticated ? "Authenticated" : "Not authenticated"}</p>
                  </article>
                  <article class="status-card">
                    <h3>Target device</h3>
                    <p class="status-copy">${escapeHtml(currentSpotifyStatus.target_name ?? "No matching device yet")}</p>
                  </article>
                  <article class="status-card">
                    <h3>Token cache</h3>
                    <p class="status-copy">${escapeHtml(currentSpotifyStatus.token_cache_path)}</p>
                  </article>
                  <article class="status-card">
                    <h3>Summary</h3>
                    <p class="status-copy">${escapeHtml(currentSpotifyStatus.summary)}</p>
                  </article>
                </div>
              `
              : `<p class="status-copy">Run a Spotify status check after saving your credentials.</p>`
          }

          <label>
            <span>Spotify auth URL</span>
            <input
              id="spotify-auth-url"
              placeholder="Generated after Start Spotify auth"
              value="${escapeHtml(spotifyAuthUrl)}"
              readonly
            />
          </label>

          ${
            spotifyAuthUrl
              ? `<p class="hint">The app opens this URL automatically and waits for the localhost callback. Manual paste is only a fallback if the automatic callback fails.</p>`
              : ""
          }

          <p class="meta">${escapeHtml(spotifyAuthMode)}</p>

          ${
            spotifyAuthDebug
              ? `
                <div class="status-list remote-status">
                  <article class="status-card">
                    <h3>Auth stage</h3>
                    <p class="status-copy">${escapeHtml(spotifyAuthDebug.stage)}</p>
                  </article>
                  <article class="status-card">
                    <h3>Auth detail</h3>
                    <p class="status-copy">${escapeHtml(spotifyAuthDebug.detail)}</p>
                  </article>
                  <article class="status-card">
                    <h3>OAuth state</h3>
                    <p class="status-copy">${escapeHtml(spotifyAuthDebug.state || "(empty)")}</p>
                  </article>
                  <article class="status-card">
                    <h3>Redirect URI</h3>
                    <p class="status-copy">${escapeHtml(spotifyAuthDebug.redirect_uri)}</p>
                  </article>
                </div>
              `
              : ""
          }

          <details>
            <summary>Manual fallback</summary>
            <label>
              <span>Spotify auth code or callback URL</span>
              <input
                id="spotify-callback-input"
                placeholder="Paste code or callback URL here"
                value="${escapeHtml(spotifyCallbackInput)}"
              />
            </label>

            <div class="actions">
              <button class="button-secondary" id="spotify-finish-auth-button" type="button" ${
                busy ? "disabled" : ""
              }>
                Finish Spotify auth
              </button>
            </div>
          </details>
        </section>
      </section>
    </main>
  `;

  document
    .querySelector<HTMLFormElement>("#settings-form")
    ?.addEventListener("submit", onSave);
  document
    .querySelector<HTMLButtonElement>("#reload-button")
    ?.addEventListener("click", () => {
      void loadAll("Configuration reloaded from disk.");
    });
  document
    .querySelector<HTMLButtonElement>("#health-button")
    ?.addEventListener("click", () => {
      void refreshHealth("Health status refreshed.");
    });
  document
    .querySelector<HTMLButtonElement>("#firetv-check-button")
    ?.addEventListener("click", () => {
      void refreshFireTvStatus("Fire TV status refreshed.");
    });
  document
    .querySelector<HTMLButtonElement>("#firetv-scan-apps-button")
    ?.addEventListener("click", () => {
      void scanFireTvApps();
    });
  document
    .querySelector<HTMLButtonElement>("#firetv-load-apps-button")
    ?.addEventListener("click", () => {
      void loadCachedFireTvApps();
    });
  document
    .querySelector<HTMLInputElement>("#firetv-app-filter")
    ?.addEventListener("input", (event) => {
      fireTvAppFilter = (event.currentTarget as HTMLInputElement).value;
      render();
    });
  document
    .querySelector<HTMLButtonElement>("#spotify-status-button")
    ?.addEventListener("click", () => {
      void refreshSpotifyStatus("Spotify status refreshed.");
    });
  document
    .querySelector<HTMLButtonElement>("#spotify-start-auth-button")
    ?.addEventListener("click", () => {
      void startSpotifyAuth();
    });
  document
    .querySelector<HTMLButtonElement>("#spotify-debug-button")
    ?.addEventListener("click", () => {
      void inspectSpotifyAuth();
    });
  document
    .querySelector<HTMLButtonElement>("#spotify-finish-auth-button")
    ?.addEventListener("click", () => {
      void finishSpotifyAuth();
    });
  document
    .querySelector<HTMLButtonElement>("#spotify-toggle-button")
    ?.addEventListener("click", () => {
      void toggleSpotifyOnTv();
    });
  document
    .querySelector<HTMLButtonElement>("#start-spotify-on-tv-button")
    ?.addEventListener("click", () => {
      void startSpotifyOnTv();
    });
  document.querySelectorAll<HTMLButtonElement>(".remote-button").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.firetvAction as FireTvAction | undefined;
      if (action) {
        void triggerFireTvAction(action);
      }
    });
  });
  document.querySelectorAll<HTMLButtonElement>(".launch-app-button").forEach((button) => {
    button.addEventListener("click", () => {
      const packageName = button.dataset.packageName;
      if (packageName) {
        void launchFireTvApp(packageName);
      }
    });
  });
}

function renderBadge(label: string, ready: boolean) {
  const stateClass = ready ? "is-ready" : "is-missing";
  const status = ready ? "Configured" : "Missing";
  return `<span class="badge ${stateClass}">${escapeHtml(label)}: ${status}</span>`;
}

function renderScreenState(screenAwake: boolean | null | undefined) {
  if (screenAwake === true) {
    return "Awake";
  }
  if (screenAwake === false) {
    return "Asleep";
  }
  return "Unavailable";
}

function renderFireTvApps() {
  const filter = fireTvAppFilter.trim().toLowerCase();
  const apps = currentFireTvApps.filter((app) => {
    if (!filter) {
      return true;
    }

    return (
      app.display_name.toLowerCase().includes(filter) ||
      app.package_name.toLowerCase().includes(filter)
    );
  });

  if (apps.length === 0) {
    return `<p class="status-copy">No cached apps yet. Run a scan against the Fire TV to populate this list.</p>`;
  }

  return `
    <div class="status-list remote-status">
      ${apps
        .map(
          (app) => `
            <article class="status-card app-card">
              <div>
                <h3>${escapeHtml(app.display_name)}</h3>
                <p class="status-copy">${escapeHtml(app.package_name)}</p>
              </div>
              <button
                class="button-secondary launch-app-button"
                data-package-name="${escapeHtml(app.package_name)}"
                type="button"
                ${busy ? "disabled" : ""}
              >
                Launch
              </button>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

async function onSave(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const formData = new FormData(form);

  currentConfig = {
    firetv_ip: readField(formData, "firetv_ip"),
    spotify_client_id: readField(formData, "spotify_client_id"),
    spotify_client_secret: readField(formData, "spotify_client_secret"),
    spotify_redirect_url: readField(formData, "spotify_redirect_url"),
    spotify_target_hints: readField(formData, "spotify_target_hints"),
    spotify_auth_state: currentConfig.spotify_auth_state,
  };

  busy = true;
  flash("Saving settings...");
  render();

  try {
    currentConfig = await invoke<AppConfig>("save_settings", {
      config: currentConfig,
    });
    await refreshHealth("Settings saved.");
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
    currentConfig = await invoke<AppConfig>("get_settings");
    currentHealth = await invoke<HealthStatus>("health_check");
    currentFireTvStatus = await invoke<FireTvStatus>("firetv_status", {
      firetvIp: currentConfig.firetv_ip,
    });
    currentSpotifyStatus = await invoke<SpotifyStatus>("spotify_status");
    spotifyAuthDebug = await invoke<SpotifyAuthDebug>("spotify_debug_auth_flow");
    const appCache = await invoke<FireTvAppCache>("firetv_cached_apps");
    currentFireTvApps = appCache.apps;
    spotifyAuthUrl = currentSpotifyStatus.auth_url ?? "";
    busy = false;
    flash(message);
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
    render();
  }
}

async function refreshHealth(message = "Health status refreshed.") {
  try {
    currentHealth = await invoke<HealthStatus>("health_check");
    busy = false;
    flash(message);
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
    currentFireTvStatus = await invoke<FireTvStatus>("firetv_status", {
      firetvIp: currentConfig.firetv_ip,
    });
    currentHealth = await invoke<HealthStatus>("health_check");
    busy = false;
    flash(message);
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
    const cache = await invoke<FireTvAppCache>("firetv_cached_apps");
    currentFireTvApps = cache.apps;
    busy = false;
    flash(`Loaded ${cache.apps.length} cached Fire TV apps.`);
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
    const result = await invoke<FireTvAppScanResult>("firetv_scan_apps", {
      firetvIp: currentConfig.firetv_ip,
    });
    currentFireTvApps = result.apps;
    currentFireTvStatus = await invoke<FireTvStatus>("firetv_status", {
      firetvIp: currentConfig.firetv_ip,
    });
    busy = false;
    flash(result.summary);
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
    currentSpotifyStatus = await invoke<SpotifyStatus>("spotify_status");
    spotifyAuthUrl = currentSpotifyStatus.auth_url ?? spotifyAuthUrl;
    currentHealth = await invoke<HealthStatus>("health_check");
    busy = false;
    flash(message);
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
    const result = await invoke<AuthUrlResult>("spotify_start_auth");
    spotifyAuthDebug = await invoke<SpotifyAuthDebug>("spotify_debug_auth_flow");
    spotifyAuthUrl = result.url;
    spotifyAuthMode = "Waiting for Spotify callback on localhost...";
    render();

    const pendingStatus = invoke<SpotifyStatus>("spotify_finish_auth_via_local_callback");
    await openUrl(result.url);
    currentSpotifyStatus = await pendingStatus;
    spotifyAuthUrl = currentSpotifyStatus.auth_url ?? spotifyAuthUrl;
    currentHealth = await invoke<HealthStatus>("health_check");
    busy = false;
    spotifyAuthMode = "Spotify auth completed through localhost callback";
    flash("Spotify authentication completed.");
    render();
  } catch (error) {
    busy = false;
    spotifyAuthMode = "Automatic Spotify auth failed; use manual callback input if needed";
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
    spotifyAuthDebug = await invoke<SpotifyAuthDebug>("spotify_debug_auth_flow");
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
  spotifyCallbackInput =
    document.querySelector<HTMLInputElement>("#spotify-callback-input")?.value.trim() ??
    spotifyCallbackInput;

  busy = true;
  flash("Finishing Spotify auth...");
  render();

  try {
    await persistCurrentConfig();
    currentSpotifyStatus = await invoke<SpotifyStatus>("spotify_finish_auth", {
      codeOrCallback: spotifyCallbackInput,
    });
    spotifyAuthUrl = currentSpotifyStatus.auth_url ?? spotifyAuthUrl;
    currentHealth = await invoke<HealthStatus>("health_check");
    busy = false;
    spotifyAuthMode = "Spotify auth completed from pasted callback";
    flash("Spotify authentication completed.");
    render();
  } catch (error) {
    busy = false;
    flash(asMessage(error), true);
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
    const result = await invoke<ActionResult>("spotify_toggle_tv");
    currentSpotifyStatus = await invoke<SpotifyStatus>("spotify_status");
    spotifyAuthUrl = currentSpotifyStatus.auth_url ?? spotifyAuthUrl;
    busy = false;
    flash(result.message);
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
    const result = await invoke<ActionResult>("start_spotify_on_tv");
    currentFireTvStatus = await invoke<FireTvStatus>("firetv_status", {
      firetvIp: currentConfig.firetv_ip,
    });
    currentSpotifyStatus = await invoke<SpotifyStatus>("spotify_status");
    currentHealth = await invoke<HealthStatus>("health_check");
    busy = false;
    flash(result.message);
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
    const result = await invoke<ActionResult>("firetv_launch_app", {
      packageName,
      firetvIp: currentConfig.firetv_ip,
    });
    currentFireTvStatus = await invoke<FireTvStatus>("firetv_status", {
      firetvIp: currentConfig.firetv_ip,
    });
    busy = false;
    flash(result.message);
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
    const result = await invoke<ActionResult>("firetv_action", {
      action,
      firetvIp: currentConfig.firetv_ip,
    });
    currentFireTvStatus = await invoke<FireTvStatus>("firetv_status", {
      firetvIp: currentConfig.firetv_ip,
    });
    currentHealth = await invoke<HealthStatus>("health_check");
    busy = false;
    flash(result.message);
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

function readField(formData: FormData, key: keyof AppConfig) {
  return String(formData.get(key) ?? "").trim();
}

function syncConfigFromInputs() {
  const fireTvInput = document.querySelector<HTMLInputElement>("#firetv-ip");
  const spotifyClientIdInput =
    document.querySelector<HTMLInputElement>("#spotify-client-id");
  const spotifyRedirectUrlInput =
    document.querySelector<HTMLInputElement>("#spotify-redirect-url");
  const spotifyClientSecretInput =
    document.querySelector<HTMLInputElement>("#spotify-client-secret");
  const spotifyTargetHintsInput =
    document.querySelector<HTMLInputElement>("#spotify-target-hints");
  const spotifyCallbackValue =
    document.querySelector<HTMLInputElement>("#spotify-callback-input");

  currentConfig = {
    firetv_ip: fireTvInput?.value.trim() ?? currentConfig.firetv_ip,
    spotify_client_id:
      spotifyClientIdInput?.value.trim() ?? currentConfig.spotify_client_id,
    spotify_client_secret:
      spotifyClientSecretInput?.value.trim() ?? currentConfig.spotify_client_secret,
    spotify_redirect_url:
      spotifyRedirectUrlInput?.value.trim() ?? currentConfig.spotify_redirect_url,
    spotify_target_hints:
      spotifyTargetHintsInput?.value.trim() ?? currentConfig.spotify_target_hints,
    spotify_auth_state: currentConfig.spotify_auth_state,
  };

  spotifyCallbackInput = spotifyCallbackValue?.value.trim() ?? spotifyCallbackInput;
}

function asMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function persistCurrentConfig() {
  currentConfig = await invoke<AppConfig>("save_settings", {
    config: currentConfig,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

void loadAll();

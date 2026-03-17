import { invoke } from "@tauri-apps/api/core";

type AppConfig = {
  firetv_ip: string;
  spotify_client_id: string;
  spotify_redirect_url: string;
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

type ActionResult = {
  message: string;
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
  spotify_redirect_url: "",
};

let currentConfig: AppConfig = { ...defaultConfig };
let currentHealth: HealthStatus | null = null;
let currentFireTvStatus: FireTvStatus | null = null;
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
                <span class="chip">Setup + health</span>
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
                <span>Spotify Redirect URL</span>
                <input
                  id="spotify-redirect-url"
                  name="spotify_redirect_url"
                  placeholder="http://127.0.0.1:8898/callback"
                  value="${escapeHtml(currentConfig.spotify_redirect_url)}"
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
  document.querySelectorAll<HTMLButtonElement>(".remote-button").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.firetvAction as FireTvAction | undefined;
      if (action) {
        void triggerFireTvAction(action);
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

async function onSave(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const formData = new FormData(form);

  currentConfig = {
    firetv_ip: readField(formData, "firetv_ip"),
    spotify_client_id: readField(formData, "spotify_client_id"),
    spotify_redirect_url: readField(formData, "spotify_redirect_url"),
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

  currentConfig = {
    firetv_ip: fireTvInput?.value.trim() ?? currentConfig.firetv_ip,
    spotify_client_id:
      spotifyClientIdInput?.value.trim() ?? currentConfig.spotify_client_id,
    spotify_redirect_url:
      spotifyRedirectUrlInput?.value.trim() ?? currentConfig.spotify_redirect_url,
  };
}

function asMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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

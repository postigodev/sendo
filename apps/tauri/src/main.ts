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

const defaultConfig: AppConfig = {
  firetv_ip: "",
  spotify_client_id: "",
  spotify_redirect_url: "",
};

let currentConfig: AppConfig = { ...defaultConfig };
let currentHealth: HealthStatus | null = null;
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
                diagnostico.
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
}

function renderBadge(label: string, ready: boolean) {
  const stateClass = ready ? "is-ready" : "is-missing";
  const status = ready ? "Configured" : "Missing";
  return `<span class="badge ${stateClass}">${escapeHtml(label)}: ${status}</span>`;
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

function flash(message: string, isError = false) {
  flashMessage = message;
  flashIsError = isError;
}

function readField(formData: FormData, key: keyof AppConfig) {
  return String(formData.get(key) ?? "").trim();
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

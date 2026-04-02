import type { Activity, AppConfig, SpotifyAuthDebug, SpotifyStatus } from "../types";
import { escapeHtml, timeAgo } from "../utils";
import { emptyStateText, settingsField, spotifyStatusRow } from "../ui/shared";
import { icon } from "../icons";

type SpotifyDeps = {
  busy: boolean;
  currentConfig: AppConfig;
  currentSpotifyStatus: SpotifyStatus | null;
  currentSpotifyDebug: SpotifyAuthDebug | null;
  spotifyAuthUrl: string;
  spotifyCallbackInput: string;
  recentActivity: Activity[];
};

export function renderSpotify({
  busy,
  currentConfig,
  currentSpotifyStatus,
  currentSpotifyDebug,
  spotifyAuthUrl,
  spotifyCallbackInput,
  recentActivity,
}: SpotifyDeps) {
  const authStatus = currentSpotifyStatus?.authenticated ? "Active" : "Missing";
  const targetState = currentSpotifyStatus?.target_name ?? "Not detected";
  const activity = recentActivity
    .filter((item) => {
      const text = item.text.toLowerCase();
      return text.includes("spotify") || text.includes("playback") || text.includes("auth") || text.includes("target");
    })
    .slice(0, 4);
  const lastSpotifyActivity = activity[0] ?? null;
  const authTone = currentSpotifyStatus?.authenticated ? "ready" : "error";
  const targetTone = currentSpotifyStatus?.target_found
    ? "neutral"
    : currentSpotifyStatus?.target_ambiguous
      ? "warning"
      : "warning";
  const redirectTone = currentConfig.spotify_redirect_url.trim() ? "ready" : "warning";
  const nowPlaying = currentSpotifyStatus?.now_playing ?? null;
  const playbackTone = currentSpotifyStatus?.playback_on_target
    ? nowPlaying?.is_playing
      ? "ready"
      : "neutral"
    : currentSpotifyStatus?.authenticated
      ? "warning"
      : "error";
  const targetStatus = currentSpotifyStatus?.target_found ? targetState : "Missing";
  const devices = currentSpotifyStatus?.available_devices ?? [];
  const selectedTargetId = currentSpotifyStatus?.target_id ?? currentConfig.spotify_selected_device_id.trim();
  const targetSelectDisabled = busy || !currentSpotifyStatus?.authenticated || devices.length === 0;
  const playbackStatus = currentSpotifyStatus?.playback_on_target
    ? nowPlaying?.is_playing
      ? "Active"
      : "Ready"
    : currentSpotifyStatus?.playback_device_name
      ? "Elsewhere"
      : currentSpotifyStatus?.authenticated
        ? "Ready"
        : "Missing";
  const hasNowPlaying = Boolean(nowPlaying?.track_name || nowPlaying?.artist_name || nowPlaying?.album_cover_url);
  const progressRatio =
    nowPlaying?.progress_ms != null && nowPlaying?.duration_ms
      ? Math.max(0, Math.min(1, nowPlaying.progress_ms / nowPlaying.duration_ms))
      : 0;
  const progressStyle = `style="--spotify-progress:${progressRatio}"`;
  const playPauseLabel = nowPlaying?.is_playing ? "Pause" : "Play";
  const playPauseIcon = nowPlaying?.is_playing ? "pause" : "play";

  return `
    <section class="spotify-page">
      <section class="spotify-session-layout">
        <article class="panel spotify-session-panel spotify-session-panel--primary">
          <div class="spotify-session-controls">
            <div class="spotify-now-playing-card ${hasNowPlaying ? "is-active" : "is-idle"}">
              ${
                currentSpotifyStatus?.authenticated
                  ? `
                    <div class="spotify-now-playing-cover">
                      ${
                        nowPlaying?.album_cover_url
                          ? `<img src="${escapeHtml(nowPlaying.album_cover_url)}" alt="${escapeHtml((nowPlaying.track_name ?? "Spotify playback") + " cover art")}" />`
                          : `<div class="spotify-cover-fallback">${icon("disc-3")}</div>`
                      }
                    </div>
                    <div class="spotify-now-playing-copy">
                      <div class="spotify-now-playing-head">
                        <p class="panel-kicker">Now playing</p>
                        <h3>${escapeHtml(
                          currentSpotifyStatus?.playback_on_target
                            ? nowPlaying?.track_name ?? "No active Spotify playback"
                            : "No active playback on TV",
                        )}</h3>
                        <p class="spotify-now-playing-artist">${escapeHtml(
                          currentSpotifyStatus?.playback_on_target
                            ? nowPlaying?.artist_name ?? "Start playback on your TV to see track details."
                            : currentSpotifyStatus?.playback_device_name
                              ? `Playback is currently on ${currentSpotifyStatus.playback_device_name}. Use Send to TV to move it here.`
                              : "Start playback on your TV to see track details.",
                        )}</p>
                      </div>
                      <div class="spotify-progress-block">
                        <div class="spotify-progress-bar" ${progressStyle}><span></span></div>
                        <div class="spotify-progress-times">
                          <span>${escapeHtml(formatDuration(nowPlaying?.progress_ms ?? null))}</span>
                          <span>${escapeHtml(formatDuration(nowPlaying?.duration_ms ?? null))}</span>
                        </div>
                      </div>
                    </div>
                  `
                  : `
                    <div class="spotify-now-playing-cover">
                      <div class="spotify-cover-fallback">${icon("disc-3")}</div>
                    </div>
                    <div class="spotify-now-playing-copy">
                      <div class="spotify-now-playing-head">
                        <p class="panel-kicker">Now playing</p>
                        <h3>Spotify authentication required</h3>
                        <p class="spotify-now-playing-artist">Authenticate Spotify to load playback details and TV transport controls.</p>
                      </div>
                    </div>
                  `
              }
            </div>

            <div class="spotify-player-controls">
              <div class="spotify-transport-bar">
                ${
                  currentSpotifyStatus?.authenticated
                    ? `
                      <button class="spotify-transport-button" id="spotify-previous-button" type="button" ${busy ? "disabled" : ""} aria-label="Previous track">
                        ${icon("skip-back")}
                      </button>
                      <button class="spotify-transport-button spotify-transport-button--primary" id="spotify-playback-button" type="button" ${busy ? "disabled" : ""} aria-label="${escapeHtml(playPauseLabel)}">
                        ${icon(playPauseIcon)}
                        <span>${escapeHtml(playPauseLabel)}</span>
                      </button>
                      <button class="spotify-transport-button" id="spotify-next-button" type="button" ${busy ? "disabled" : ""} aria-label="Next track">
                        ${icon("skip-forward")}
                      </button>
                    `
                    : `<button class="button-secondary" id="spotify-start-auth-button" type="button" ${busy ? "disabled" : ""}>Authenticate</button>`
                }
              </div>
              <div class="spotify-player-utilities">
                ${
                  currentSpotifyStatus?.authenticated
                    ? `
                      <button class="spotify-icon-button" id="spotify-send-to-tv-button" type="button" data-tooltip="Send playback to TV" ${busy ? "disabled" : ""} aria-label="Send playback to TV">
                        ${icon("tv")}
                      </button>
                      <button class="spotify-icon-button" id="spotify-refresh-button" type="button" data-tooltip="Refresh playback status" ${busy ? "disabled" : ""} aria-label="Refresh playback status">
                        ${icon("refresh-cw")}
                      </button>
                    `
                    : ""
                }
              </div>
            </div>
          </div>
          <div class="spotify-last-action">
            <span class="spotify-last-action-label">${icon("history")}<span>${escapeHtml(lastSpotifyActivity ? `Last action: ${lastSpotifyActivity.text} (${timeAgo(lastSpotifyActivity.at)})` : "Last action: No recent activity")}</span></span>
          </div>
        </article>

        <aside class="panel spotify-session-panel spotify-session-panel--status">
          <div class="panel-header"><div><p class="panel-kicker">Session</p><h2>Playback and device</h2></div></div>
          <div class="spotify-status-list">
            ${spotifyStatusRow("Playback", playbackStatus, "play", playbackTone)}
            <article class="spotify-status-row ${targetTone}">
              <div class="spotify-status-leading"><span class="spotify-status-icon">${icon("tv")}</span><h3>Target</h3></div>
              <div class="spotify-status-side">
                ${
                  currentSpotifyStatus?.authenticated && devices.length
                    ? `<select class="spotify-target-select ${currentSpotifyStatus?.target_ambiguous ? "is-ambiguous" : ""}" id="spotify-target-device-select" ${targetSelectDisabled ? "disabled" : ""} aria-label="Spotify playback target">
                        ${
                          currentSpotifyStatus?.target_ambiguous && !selectedTargetId
                            ? `<option value="">Select a TV target</option>`
                            : ""
                        }
                        ${devices
                          .filter((device) => device.id)
                          .map((device) => {
                            const id = device.id ?? "";
                            const activeLabel = device.is_active ? " · active" : "";
                            const hintLabel = device.matches_hints ? " · hint match" : "";
                            return `<option value="${escapeHtml(id)}" ${id === selectedTargetId ? "selected" : ""}>${escapeHtml(device.name)}${escapeHtml(activeLabel)}${escapeHtml(hintLabel)}</option>`;
                          })
                          .join("")}
                      </select>`
                    : `<span class="spotify-inline-status ${targetTone}">${escapeHtml(targetStatus)}</span>`
                }
              </div>
            </article>
            ${spotifyStatusRow("Authentication", authStatus, "key-round", authTone)}
          </div>
        </aside>
      </section>

      <article class="panel spotify-activity-panel">
        <div class="panel-header"><div><p class="panel-kicker">Activity</p><h2>Recent Spotify activity</h2></div></div>
        ${
          activity.length
            ? `<div class="activity-list">${activity
                .map(
                  (item) => `<article class="activity-item ${item.tone}"><div><h3>${escapeHtml(item.text)}</h3><p>${escapeHtml(timeAgo(item.at))}</p></div></article>`,
                )
                .join("")}</div>`
            : emptyStateText("No recent Spotify activity", "Authentication, target detection, and playback actions will appear here.")
        }
      </article>

      <article class="panel spotify-settings-panel">
        <details class="spotify-secondary-block">
          <summary>
            <span>
              <p class="panel-kicker">Settings</p>
              <h2>Spotify settings</h2>
            </span>
            <span class="mini-tag ${redirectTone}">${escapeHtml(currentConfig.spotify_redirect_url.trim() ? "Configured" : "Needs setup")}</span>
          </summary>
          <form class="spotify-settings-form" id="spotify-settings-form">
            ${settingsField("spotify-client-id", "Client ID", currentConfig.spotify_client_id, "your-client-id")}
            ${settingsField("spotify-client-secret", "Client secret", currentConfig.spotify_client_secret, "your-client-secret")}
            ${settingsField("spotify-redirect-url", "Redirect URL", currentConfig.spotify_redirect_url, "http://127.0.0.1:8888/callback")}
            ${
              currentConfig.spotify_selected_device_id.trim()
                ? `${settingsField("spotify-selected-device-id", "Selected device ID", currentConfig.spotify_selected_device_id, "Pick a Spotify target above", { readOnly: true, mono: true })}`
                : ""
            }
            ${settingsField("spotify-target-hints", "Target hints", currentConfig.spotify_target_hints, "fire, tv, amazon")}
            <div class="spotify-form-footer">
              <p class="meta">Stored locally for Spotify Connect authentication and target matching.</p>
              <div class="actions">
                <button class="button-primary" id="save-spotify-settings-button" type="submit" ${busy ? "disabled" : ""}>Save settings</button>
              </div>
            </div>
          </form>
        </details>
      </article>

      <article class="panel spotify-advanced-panel">
        <details class="spotify-secondary-block">
          <summary>
            <span>
              <p class="panel-kicker">Advanced</p>
              <h2>Diagnostics and manual tools</h2>
            </span>
            <span class="mini-tag">Optional</span>
          </summary>
          <div class="spotify-settings-stack">
            ${settingsField("spotify-auth-url", "Authorization URL", spotifyAuthUrl, "Generated after auth", { readOnly: true, mono: true })}
          </div>
          <p class="meta">${escapeHtml(currentSpotifyDebug?.detail ?? "Auth diagnostics will appear here after inspection.")}</p>
          <div class="spotify-inline-tools">
            <button class="button-secondary" id="spotify-debug-button" type="button" ${busy ? "disabled" : ""}>Inspect auth</button>
          </div>
          <details class="detail-block spotify-detail-block">
            <summary>Manual callback fallback</summary>
            <div class="spotify-settings-stack">
              ${settingsField("spotify-callback-input", "Callback URL or code", spotifyCallbackInput, "Paste callback URL or code")}
            </div>
            <div class="actions"><button class="button-secondary" id="spotify-finish-auth-button" type="button" ${busy ? "disabled" : ""}>Finish manually</button></div>
          </details>
        </details>
      </article>
    </section>
  `;
}

function formatDuration(value: number | null) {
  if (value == null || Number.isNaN(value)) return "--:--";
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

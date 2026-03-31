import { icon } from "../icons";

export function renderRemote(busy: boolean) {
  return `
    <section class="panel remote-console-panel">
      <div class="panel-header">
        <div>
          <p class="panel-kicker">Manual control</p>
          <h2>Remote</h2>
          <p class="panel-subcopy">Navigation on the left. Playback, volume, and power on the right.</p>
        </div>
      </div>
      <div class="remote-console-grid">
        <section class="remote-cluster remote-cluster--navigation">
          <div class="remote-cluster-header">
            <h3>Navigation</h3>
          </div>
          <div class="remote-pad">
            <button class="button-secondary remote-button remote-button--pad" data-firetv-action="up" type="button" ${busy ? "disabled" : ""}>${icon("chevron-up")}</button>
            <div class="remote-pad-row">
              <button class="button-secondary remote-button remote-button--pad" data-firetv-action="left" type="button" ${busy ? "disabled" : ""}>${icon("chevron-left")}</button>
              <button class="button-primary remote-button remote-button--select" data-firetv-action="select" type="button" ${busy ? "disabled" : ""}>Select</button>
              <button class="button-secondary remote-button remote-button--pad" data-firetv-action="right" type="button" ${busy ? "disabled" : ""}>${icon("chevron-right")}</button>
            </div>
            <button class="button-secondary remote-button remote-button--pad" data-firetv-action="down" type="button" ${busy ? "disabled" : ""}>${icon("chevron-down")}</button>
          </div>
          <div class="remote-nav-actions">
            <button class="button-secondary remote-button remote-button--utility" data-firetv-action="home" type="button" ${busy ? "disabled" : ""}>${icon("house")}<span>Home</span></button>
            <button class="button-secondary remote-button remote-button--utility" data-firetv-action="back" type="button" ${busy ? "disabled" : ""}>${icon("corner-up-left")}<span>Back</span></button>
          </div>
        </section>

        <section class="remote-cluster remote-cluster--controls">
          <div class="remote-cluster-header">
            <h3>Playback and TV</h3>
          </div>
          <div class="remote-control-stack">
            <div class="remote-control-group">
              <p class="remote-group-label">Playback</p>
              <div class="remote-control-stack-list">
                <button class="button-secondary remote-button remote-button--control" data-firetv-action="play_pause" type="button" ${busy ? "disabled" : ""}>${icon("play")}<span>Play/Pause</span></button>
                <button class="button-secondary remote-button remote-button--control" data-firetv-action="launch_spotify" type="button" ${busy ? "disabled" : ""}>${icon("music-4")}<span>Spotify</span></button>
              </div>
            </div>
            <div class="remote-control-group">
              <p class="remote-group-label">Volume</p>
              <div class="remote-control-stack-list">
                <button class="button-secondary remote-button remote-button--control" data-firetv-action="volume_up" type="button" ${busy ? "disabled" : ""}>${icon("volume-2")}<span>Vol +</span></button>
                <button class="button-secondary remote-button remote-button--control" data-firetv-action="volume_down" type="button" ${busy ? "disabled" : ""}>${icon("volume-1")}<span>Vol -</span></button>
              </div>
            </div>
            <div class="remote-control-group">
              <p class="remote-group-label">Power</p>
              <div class="remote-control-stack-list">
                <button class="button-secondary remote-button remote-button--control" data-firetv-action="ensure_awake" type="button" ${busy ? "disabled" : ""}>${icon("zap")}<span>Wake</span></button>
                <button class="button-secondary button-danger remote-button remote-button--control" data-firetv-action="power_off" type="button" ${busy ? "disabled" : ""}>${icon("power")}<span>Power off</span></button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  `;
}

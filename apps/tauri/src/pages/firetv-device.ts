import type { FireTvStatus } from "../types";
import { snapshotRow, textInput } from "../ui/shared";
import { screenLabel } from "../features/status";

type FireTvDeviceDeps = {
  busy: boolean;
  firetvIp: string;
  currentFireTvStatus: FireTvStatus | null;
};

export function renderFireTvDevice({ busy, firetvIp, currentFireTvStatus }: FireTvDeviceDeps) {
  const hasIp = firetvIp.trim().length > 0;
  return `
    <section class="content-grid two-column">
      <article class="panel device-control-panel">
        <div class="panel-header">
          <div>
            <p class="panel-kicker">Device</p>
            <h2>Device control</h2>
            <p class="panel-subcopy">Set the Fire TV address, then test, connect, wake, or power it down.</p>
          </div>
        </div>
        <form class="device-control-stack" id="firetv-settings-form">
          <div class="device-control-block">
            <div class="device-control-block-header">
              <h3>Device address</h3>
            </div>
            ${textInput("firetv-ip", "Fire TV IP", firetvIp, "192.168.0.10")}
            <div class="device-control-actions">
              <button class="button-primary" id="save-firetv-settings-button" type="submit" ${busy ? "disabled" : ""}>Save</button>
            </div>
          </div>
          <div class="device-control-block device-control-block--actions">
            <div class="device-control-block-header">
              <h3>Connection actions</h3>
            </div>
            <div class="device-control-strip">
              <button class="button-secondary" id="firetv-check-button" type="button" ${busy || !hasIp ? "disabled" : ""}>Test</button>
              <button class="button-secondary remote-button" data-firetv-action="connect" type="button" ${busy || !hasIp ? "disabled" : ""}>Connect</button>
              <button class="button-secondary remote-button" data-firetv-action="ensure_awake" type="button" ${busy || !hasIp ? "disabled" : ""}>Wake</button>
              <button class="button-secondary button-danger remote-button" data-firetv-action="power_off" type="button" ${busy || !hasIp ? "disabled" : ""}>Power off</button>
            </div>
            <p class="device-note">Use the TV&apos;s local IP address and make sure ADB debugging is enabled on the device.</p>
          </div>
        </form>
      </article>
      <article class="panel firetv-state-panel">
        <div class="panel-header">
          <div>
            <p class="panel-kicker">Status</p>
            <h2>Current state</h2>
          </div>
        </div>
        <div class="snapshot-list">
          ${snapshotRow("plug-zap", "ADB", currentFireTvStatus?.adb_available ? "Available" : "Missing")}
          ${snapshotRow("wifi", "Connection", currentFireTvStatus?.connected ? "Connected" : "Offline")}
          ${snapshotRow("monitor-up", "Screen", screenLabel(currentFireTvStatus?.screen_awake))}
          ${snapshotRow("tv", "Target", currentFireTvStatus?.target ?? "No target")}
        </div>
      </article>
    </section>
  `;
}

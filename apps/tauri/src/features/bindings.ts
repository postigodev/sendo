import type { Binding, BindingAction, FireTvAction } from "../types";

export function bindingActionOptions(selectedActionType: string) {
  return [
    ["start_spotify_on_tv", "Start Spotify On TV"],
    ["spotify_toggle_tv", "Spotify toggle on TV"],
    ["fire_tv_key", "Fire TV key"],
    ["launch_app", "Launch Fire TV app"],
  ]
    .map(
      ([value, label]) =>
        `<option value="${value}" ${selectedActionType === value ? "selected" : ""}>${label}</option>`,
    )
    .join("");
}

export function bindingActionRequiresValue(actionType: string) {
  return actionType === "fire_tv_key" || actionType === "launch_app";
}

export function bindingActionValueLabel(actionType: string) {
  return actionType === "fire_tv_key" ? "Fire TV action" : "Package name";
}

export function bindingActionType(action: BindingAction) {
  if (action === "spotify_toggle_tv") return "spotify_toggle_tv";
  if (action === "start_spotify_on_tv") return "start_spotify_on_tv";
  if (typeof action === "object" && "launch_app" in action) return "launch_app";
  return "fire_tv_key";
}

export function bindingActionValue(action: BindingAction) {
  if (typeof action === "object" && "launch_app" in action) return action.launch_app.package_name;
  if (typeof action === "object" && "fire_tv_key" in action) return action.fire_tv_key.action;
  return "";
}

export function favoriteBindings(bindings: Binding[]) {
  return bindings.filter((binding) => binding.favorite).sort((left, right) => {
    const leftOrder = left.favorite_order || Number.MAX_SAFE_INTEGER;
    const rightOrder = right.favorite_order || Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.label.localeCompare(right.label);
  });
}

export function bindingIcon(action: BindingAction) {
  if (action === "spotify_toggle_tv" || action === "start_spotify_on_tv") return "music-4";
  if (typeof action === "object" && "launch_app" in action) return "app-window";
  return "tv";
}

export function describeBindingAction(action: BindingAction) {
  if (action === "spotify_toggle_tv") return "Spotify toggle on TV";
  if (action === "start_spotify_on_tv") return "Start Spotify on TV";
  if ("launch_app" in action) return `Launch ${action.launch_app.package_name}`;
  return `Fire TV key: ${action.fire_tv_key.action}`;
}

export function renderBindingActionControl(
  selectedActionType: string,
  selectedActionValue: string,
  currentFireTvApps: Array<{ package_name: string; display_name: string }>,
) {
  if (selectedActionType === "fire_tv_key") {
    const values: FireTvAction[] = [
      "connect",
      "ensure_awake",
      "launch_spotify",
      "power_off",
      "wake",
      "home",
      "back",
      "up",
      "down",
      "left",
      "right",
      "select",
      "play_pause",
    ];
    return `<select class="settings-input" id="binding-action-value">${values
      .map(
        (value) =>
          `<option value="${value}" ${selectedActionValue === value ? "selected" : ""}>${value}</option>`,
      )
      .join("")}</select>`;
  }

  return `<select class="settings-input" id="binding-action-value"><option value="" ${
    selectedActionValue ? "" : "selected"
  }>Choose cached app</option>${currentFireTvApps
    .map(
      (app) =>
        `<option value="${app.package_name}" ${selectedActionValue === app.package_name ? "selected" : ""}>${app.display_name}</option>`,
    )
    .join("")}</select>`;
}

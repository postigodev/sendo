import { createIcons, icons } from "lucide";
import { escapeHtml } from "./utils";

export function icon(name: string) {
  return `<span class="ui-icon" data-lucide="${escapeHtml(name)}"></span>`;
}

export function renderIcons() {
  createIcons({ icons });
}

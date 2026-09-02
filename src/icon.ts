import { addIcon } from "obsidian";

/** Custom icon ID. A dedicated SVG is registered so it does not collide with existing lucide icons */
export const ICON_ID = "html-gallery";

/**
 * Drawn in a 100x100 viewBox (as addIcon expects), stroke-based like lucide.
 * A 2x2 grid whose bottom-right cell is </>, meaning "a gallery of HTML".
 */
const ICON_SVG = `
<g fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="8" y="8" width="36" height="36" rx="7"/>
  <rect x="56" y="8" width="36" height="36" rx="7"/>
  <rect x="8" y="56" width="36" height="36" rx="7"/>
  <path d="M66 62 L56 74 L66 86"/>
  <path d="M82 62 L92 74 L82 86"/>
</g>`;

export function registerIcon(): void {
  addIcon(ICON_ID, ICON_SVG);
}

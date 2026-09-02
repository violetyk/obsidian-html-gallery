import { App, TFile } from "obsidian";
import {
  SANDBOX_NO_SCRIPTS,
  SANDBOX_SCRIPTS,
  THUMB_VIEWPORT_HEIGHT,
  THUMB_VIEWPORT_WIDTH,
} from "./constants";

/** Cache getResourcePath results per path */
export class ResourcePathCache {
  private cache = new Map<string, string>();

  constructor(private app: App) {}

  get(file: TFile): string {
    const cached = this.cache.get(file.path);
    if (cached) return cached;
    const url = this.app.vault.adapter.getResourcePath(file.path);
    this.cache.set(file.path, url);
    return url;
  }

  invalidate(path: string): void {
    this.cache.delete(path);
  }

  clear(): void {
    this.cache.clear();
  }
}

/** Create the thumbnail iframe. src is left unset; the lazy loader sets it */
export function createThumbnailIframe(parent: HTMLElement, allowScripts: boolean): HTMLIFrameElement {
  const iframe = parent.createEl("iframe", { cls: "html-gallery-iframe" });
  iframe.setAttribute("sandbox", allowScripts ? SANDBOX_SCRIPTS : SANDBOX_NO_SCRIPTS);
  iframe.setAttribute("tabindex", "-1");
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("aria-hidden", "true");
  iframe.width = String(THUMB_VIEWPORT_WIDTH);
  iframe.height = String(THUMB_VIEWPORT_HEIGHT);
  return iframe;
}

/** Rescale the iframe to the actual card width */
export function applyThumbnailScale(shotEl: HTMLElement): void {
  const iframe = shotEl.querySelector<HTMLIFrameElement>("iframe.html-gallery-iframe");
  if (!iframe) return;
  const width = shotEl.clientWidth;
  if (width <= 0) return;
  const scale = width / THUMB_VIEWPORT_WIDTH;
  iframe.style.transform = `scale(${scale})`;
}

import { App, TFile } from "obsidian";
import { t } from "./i18n";
import { GalleryEntry } from "./indexer";
import { ArtifactKind } from "./kinds";
import { isPdfTooLarge, renderPdfThumbnail } from "./pdf";
import { HtmlGallerySettings } from "./settings";
import { applyThumbnailScale, createThumbnailIframe, ResourcePathCache } from "./thumbnail";

export interface ShotContext {
  app: App;
  settings: HtmlGallerySettings;
  resourcePaths: ResourcePathCache;
}

/** Handle for a load that has asynchronous work to abandon */
export interface ShotLoad {
  /** Settles when the work is over, however it ended. Rejections are already handled */
  done: Promise<void>;
  cancel(): void;
}

/**
 * Fill in the shot element for a file. Returns true when the shot needs the lazy observer,
 * i.e. when there is something to load once it scrolls into view
 */
export function renderShot(
  shot: HTMLElement,
  file: TFile,
  kind: ArtifactKind,
  entry: GalleryEntry | undefined,
  ctx: ShotContext,
): boolean {
  shot.addClass(`is-kind-${kind}`);
  switch (kind) {
    case "html": {
      if (entry?.kind === "html" && entry.isEmpty && !ctx.settings.thumbnailScripts) {
        // Script-rendered HTML would be blank with scripts disabled, so show a text preview instead
        renderFallbackShot(shot, entry);
        return false;
      }
      shot.createDiv({ cls: "html-gallery-shot-placeholder", text: entry?.title ?? file.basename });
      createThumbnailIframe(shot, ctx.settings.thumbnailScripts);
      return true;
    }
    case "svg":
    case "image": {
      shot.createDiv({ cls: "html-gallery-shot-placeholder", text: entry?.title ?? file.basename });
      // An SVG loaded through <img> is in secure static mode: no scripts, no external
      // subresources, no interactivity. That is why it needs no sandbox and is never inlined
      const img = shot.createEl("img", { cls: "html-gallery-media" });
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      img.setAttribute("aria-hidden", "true");
      img.alt = "";
      return true;
    }
    case "pdf": {
      shot.createDiv({ cls: "html-gallery-shot-placeholder", text: entry?.title ?? file.basename });
      if (isPdfTooLarge(file)) {
        // Nothing to wait for: say so now rather than failing once per scroll
        shot.addClass("is-error");
        return false;
      }
      // A canvas has no frame of its own, so unlike an iframe it can be detached mid-render safely
      shot.createEl("canvas", { cls: "html-gallery-media" });
      return true;
    }
  }
}

/** Start loading the shot's media. Returns a handle only for kinds with cancellable work */
export function loadShot(
  shot: HTMLElement,
  file: TFile,
  kind: ArtifactKind,
  ctx: ShotContext,
): ShotLoad | null {
  switch (kind) {
    case "html": {
      const iframe = shot.querySelector<HTMLIFrameElement>("iframe.html-gallery-iframe");
      if (!iframe) return null;
      applyThumbnailScale(shot);
      iframe.addEventListener("load", () => shot.addClass("is-loaded"), { once: true });
      iframe.src = ctx.resourcePaths.get(file);
      return null;
    }
    case "svg":
    case "image": {
      const img = shot.querySelector<HTMLImageElement>("img.html-gallery-media");
      if (!img) return null;
      // Leave the placeholder in place on failure: swapping in other DOM would mean rebuilding the card
      img.addEventListener("load", () => shot.addClass("is-loaded"), { once: true });
      img.addEventListener("error", () => shot.addClass("is-error"), { once: true });
      img.src = ctx.resourcePaths.get(file);
      return null;
    }
    case "pdf": {
      const canvas = shot.querySelector<HTMLCanvasElement>("canvas.html-gallery-media");
      if (!canvas) return null;
      const thumb = renderPdfThumbnail(ctx.app, file, canvas);
      const done = thumb.done.then(
        () => {
          if (canvas.width > 1) shot.addClass("is-loaded");
        },
        (err: unknown) => {
          shot.addClass("is-error");
          console.warn("[html-gallery] failed to render PDF thumbnail", file.path, err);
        },
      );
      return { done, cancel: () => thumb.cancel() };
    }
  }
}

function renderFallbackShot(shot: HTMLElement, entry: GalleryEntry): void {
  shot.addClass("is-fallback");
  const box = shot.createDiv({ cls: "html-gallery-fallback" });
  box.createDiv({ cls: "html-gallery-fallback-badge", text: t("fallback.badge") });
  box.createDiv({ cls: "html-gallery-fallback-title", text: entry.title });
  if (entry.excerpt) {
    box.createDiv({ cls: "html-gallery-fallback-excerpt", text: entry.excerpt });
  }
}

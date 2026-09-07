import { App, loadPdfJs, TFile } from "obsidian";
import { createLimiter } from "./async";
import {
  PDF_CONCURRENCY,
  PDF_MAX_BYTES,
  PDF_THUMB_MAX_PIXELS,
  PDF_THUMB_MAX_WIDTH,
} from "./constants";

/*
 * Obsidian ships pdf.js (in /lib/pdfjs/) and exposes it through loadPdfJs(), so the plugin needs
 * no bundled dependency and works offline and on mobile. loadPdfJs() returns `any`, so the surface
 * we use is declared by hand below and the cast is confined to loadPdf().
 */

interface PdfViewport {
  width: number;
  height: number;
}

interface PdfRenderTask {
  promise: Promise<void>;
  cancel(): void;
}

interface PdfTextItem {
  str?: string;
}

interface PdfPage {
  getViewport(params: { scale: number }): PdfViewport;
  render(params: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }): PdfRenderTask;
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
}

interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  getMetadata(): Promise<{ info?: { Title?: string } }>;
  destroy(): Promise<void>;
}

interface PdfLoadingTask {
  promise: Promise<PdfDocument>;
  destroy(): Promise<void>;
}

interface PdfJsLib {
  getDocument(params: Record<string, unknown>): PdfLoadingTask;
}

/**
 * Resource paths Obsidian's own viewer passes to pdf.js. Without cMapUrl and standardFontDataUrl,
 * CJK pages and pages without embedded fonts render blank or as tofu
 */
const PDF_RESOURCES = {
  cMapUrl: "/lib/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/lib/pdfjs/standard_fonts/",
  wasmUrl: "/lib/pdfjs/wasm/",
  iccUrl: "/lib/pdfjs/iccs/",
  isEvalSupported: false,
};

let libPromise: Promise<PdfJsLib> | null = null;

function loadPdf(): Promise<PdfJsLib> {
  // The one place the `any` from loadPdfJs() is narrowed; everything else uses the interfaces above
  libPromise ??= loadPdfJs().then((lib) => lib as PdfJsLib);
  return libPromise;
}

/** Shared by thumbnail rendering and text extraction, so both together stay within the limit */
const limit = createLimiter(PDF_CONCURRENCY);

/** Scale that fits the page into the thumbnail box without exceeding the pixel budget */
export function fitScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.min(PDF_THUMB_MAX_WIDTH / width, Math.sqrt(PDF_THUMB_MAX_PIXELS / (width * height)));
}

/** PDFs beyond the size cap are listed but neither rendered nor indexed */
export function isPdfTooLarge(file: TFile): boolean {
  return file.stat.size > PDF_MAX_BYTES;
}

export class PdfTooLargeError extends Error {
  constructor(path: string) {
    super(`[html-gallery] skipping oversized PDF: ${path}`);
  }
}

/** True when the error is pdf.js reporting a render we cancelled ourselves */
function isCancellation(err: unknown): boolean {
  return err instanceof Error && err.name === "RenderingCancelledException";
}

/**
 * Open a PDF, hand it to `use`, then always destroy it. pdf.js transfers the buffer we pass to
 * its worker, so the ArrayBuffer from readBinary is never reused
 */
async function withDocument<T>(app: App, file: TFile, use: (doc: PdfDocument) => Promise<T>): Promise<T> {
  if (isPdfTooLarge(file)) throw new PdfTooLargeError(file.path);
  return limit(async () => {
    const lib = await loadPdf();
    const data = new Uint8Array(await app.vault.readBinary(file));
    const task = lib.getDocument({ ...PDF_RESOURCES, data, disableAutoFetch: true });
    const doc = await task.promise;
    try {
      return await use(doc);
    } finally {
      // Without this, every card leaves a worker thread behind
      await doc.destroy();
    }
  });
}

export interface PdfThumbnail {
  done: Promise<void>;
  cancel(): void;
}

/** Render page 1 into the canvas. Cancellable at every step, because cards scroll away mid-load */
export function renderPdfThumbnail(app: App, file: TFile, canvas: HTMLCanvasElement): PdfThumbnail {
  let cancelled = false;
  let renderTask: PdfRenderTask | null = null;

  const done = withDocument(app, file, async (doc) => {
    if (cancelled) return;
    const page = await doc.getPage(1);
    if (cancelled) return;

    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: fitScale(base.width, base.height) });
    const context = canvas.getContext("2d");
    if (!context) return;
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));

    renderTask = page.render({ canvasContext: context, viewport });
    try {
      await renderTask.promise;
    } catch (err) {
      if (!isCancellation(err)) throw err;
    }
  });

  return {
    done,
    cancel() {
      cancelled = true;
      renderTask?.cancel();
    },
  };
}

/** Page count and the text of the first pages, for the search index */
export async function readPdfMeta(
  app: App,
  file: TFile,
  pageLimit: number,
  charLimit: number,
): Promise<{ pageCount: number; text: string; title?: string }> {
  return withDocument(app, file, async (doc) => {
    const info = await doc.getMetadata().catch(() => ({ info: undefined }));
    const parts: string[] = [];
    let length = 0;
    const pages = Math.min(doc.numPages, pageLimit);
    for (let n = 1; n <= pages && length < charLimit; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map((item) => item.str ?? "").join(" ");
      parts.push(text);
      length += text.length;
    }
    const title = info.info?.Title;
    return {
      pageCount: doc.numPages,
      text: parts.join(" "),
      ...(title ? { title } : {}),
    };
  });
}

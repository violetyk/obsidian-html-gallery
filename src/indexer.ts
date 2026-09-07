import { App, TFile } from "obsidian";
import { EMPTY_TEXT_THRESHOLD, PDF_INDEX_PAGE_LIMIT, SEARCH_TEXT_LIMIT } from "./constants";
import { ArtifactKind, kindOf } from "./kinds";
import { isPdfTooLarge, readPdfMeta } from "./pdf";

export interface GalleryEntry {
  kind: ArtifactKind;
  file: TFile;
  /** <title>, else the first heading, else the file name */
  title: string;
  /** Beginning of the body text (for the fallback thumbnail) */
  excerpt: string;
  /** True when the body text (without script/style) is below the threshold, i.e. script-rendered HTML */
  isEmpty: boolean;
  /** Lowercased concatenation used for searching */
  searchText: string;
  /** Number of pages (PDF only) */
  pageCount?: number;
  /** True when the file kind can hold text but none was found (a scanned PDF) */
  hasNoText?: boolean;
  /** Identifies the file revision this entry was built from */
  stamp: string;
}

/** What parsing a file's source yields, before it is tied to a TFile */
export interface ParsedArtifact {
  title: string;
  excerpt: string;
  isEmpty: boolean;
  /** Full body text; buildEntry decides how much of it goes into the search index */
  searchBody: string;
  pageCount?: number;
  hasNoText?: boolean;
}

/** Parse HTML source. DOMParser neither runs scripts nor loads subresources */
export function parseHtml(source: string, basename: string): ParsedArtifact {
  const doc = new DOMParser().parseFromString(source, "text/html");
  doc.querySelectorAll("script, style, noscript, template, svg").forEach((el) => el.remove());

  const bodyText = normalizeWhitespace(doc.body?.textContent ?? "");
  const heading = normalizeWhitespace(doc.querySelector("h1, h2")?.textContent ?? "");

  return {
    title: normalizeWhitespace(doc.title) || heading || basename,
    excerpt: bodyText.slice(0, 200),
    isEmpty: bodyText.length < EMPTY_TEXT_THRESHOLD,
    searchBody: bodyText,
  };
}

/**
 * Parse SVG source. Kept separate from parseHtml because XML parsing does not throw:
 * a malformed document comes back containing a <parsererror> element
 */
export function parseSvg(source: string, basename: string): ParsedArtifact {
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  if (doc.querySelector("parsererror")) return parseNoText(basename);

  const root = doc.documentElement;
  // Only the direct children: nested <title>/<desc> are per-shape tooltips and make noisy titles
  const title = normalizeWhitespace(directChildText(root, "title"));
  const desc = normalizeWhitespace(directChildText(root, "desc"));
  const labels = root.getAttribute("aria-label") ?? "";
  const texts: string[] = [];
  root.querySelectorAll("text, tspan").forEach((el) => texts.push(el.textContent ?? ""));
  const body = normalizeWhitespace([title, desc, labels, ...texts].join(" "));

  return {
    title: title || desc || basename,
    excerpt: body.slice(0, 200),
    // Only HTML has a blank-thumbnail fallback; a text-less diagram must still show its picture
    isEmpty: false,
    searchBody: body,
  };
}

/** Files with no extractable text: found by file name and by the notes that link to them */
export function parseNoText(basename: string): ParsedArtifact {
  return { title: basename, excerpt: "", isEmpty: false, searchBody: "" };
}

function directChildText(root: Element, tag: string): string {
  for (const child of Array.from(root.children)) {
    if (child.tagName.toLowerCase() === tag) return child.textContent ?? "";
  }
  return "";
}

/**
 * A PDF's own metadata title is unreliable (a LaTeX path, "Microsoft Word - ..."), so the file name
 * stays the display title and the metadata title only feeds the search index
 */
export function parsePdfMeta(
  meta: { pageCount: number; text: string; title?: string },
  basename: string,
): ParsedArtifact {
  const text = normalizeWhitespace(meta.text);
  return {
    title: basename,
    excerpt: text.slice(0, 200),
    isEmpty: false,
    searchBody: normalizeWhitespace([meta.title ?? "", text].join(" ")),
    pageCount: meta.pageCount,
    // Scanned PDFs have no text layer, so they can only ever be found by name. OCR is out of scope
    hasNoText: text.length === 0,
  };
}

/** Tie a parse result to its file and build the search index text */
/**
 * What a card was built from. A card is destroyed and rebuilt only when this changes, so it must
 * name every input that changes the card's structure and nothing else: an unnecessary rebuild
 * detaches a loading iframe, which is the crash this plugin has to avoid (see SPEC.ja.md)
 */
export function cardSignature(
  file: TFile,
  kind: ArtifactKind,
  entry: GalleryEntry | undefined,
  thumbnailScripts: boolean,
): string {
  return [
    kind,
    file.stat.mtime,
    // Only HTML has a scripts toggle and a blank-thumbnail fallback, so only HTML cards
    // may be rebuilt when those change
    kind === "html" ? (thumbnailScripts ? 1 : 0) : 0,
    kind === "html" && entry?.isEmpty ? 1 : 0,
  ].join("|");
}

/** Both mtime and size, so a same-second edit still invalidates the entry */
export function stampOf(file: TFile): string {
  return `${file.stat.mtime}:${file.stat.size}`;
}

export function buildEntry(file: TFile, kind: ArtifactKind, parsed: ParsedArtifact): GalleryEntry {
  return {
    kind,
    file,
    stamp: stampOf(file),
    title: parsed.title,
    excerpt: parsed.excerpt,
    isEmpty: parsed.isEmpty,
    searchText: [file.path, parsed.title, parsed.searchBody.slice(0, SEARCH_TEXT_LIMIT)]
      .join(" ")
      .toLowerCase(),
    ...(parsed.pageCount === undefined ? {} : { pageCount: parsed.pageCount }),
    ...(parsed.hasNoText === undefined ? {} : { hasNoText: parsed.hasNoText }),
  };
}

export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Index of the gallery files in the vault. Built once when the view opens, then updated per file */
export class GalleryIndex {
  private entries = new Map<string, GalleryEntry>();

  constructor(private app: App) {}

  /**
   * Reindex the whole gallery, reusing entries whose file has not changed. Reuse matters for PDFs:
   * refresh() runs on every settings change, and re-extracting their text each time is not free.
   * PDF work bounds its own concurrency inside pdf.ts, so this stays a plain Promise.all
   */
  async build(files: TFile[]): Promise<void> {
    const previous = this.entries;
    const entries = new Map<string, GalleryEntry>();
    await Promise.all(
      files.map(async (file) => {
        const cached = previous.get(file.path);
        if (cached && cached.stamp === stampOf(file)) {
          entries.set(file.path, cached);
          return;
        }
        entries.set(file.path, await this.read(file));
      }),
    );
    this.entries = entries;
  }

  async update(file: TFile): Promise<void> {
    this.entries.set(file.path, await this.read(file));
  }

  remove(path: string): void {
    this.entries.delete(path);
  }

  get(file: TFile): GalleryEntry | undefined {
    return this.entries.get(file.path);
  }

  private async read(file: TFile): Promise<GalleryEntry> {
    const kind = kindOf(file) ?? "html";
    try {
      switch (kind) {
        case "html":
          return buildEntry(file, kind, parseHtml(await this.app.vault.cachedRead(file), file.basename));
        case "svg":
          return buildEntry(file, kind, parseSvg(await this.app.vault.cachedRead(file), file.basename));
        case "image":
          return buildEntry(file, kind, parseNoText(file.basename));
        case "pdf": {
          if (isPdfTooLarge(file)) return buildEntry(file, kind, parseNoText(file.basename));
          const meta = await readPdfMeta(this.app, file, PDF_INDEX_PAGE_LIMIT, SEARCH_TEXT_LIMIT);
          return buildEntry(file, kind, parsePdfMeta(meta, file.basename));
        }
      }
    } catch (err) {
      console.warn("[html-gallery] failed to read", file.path, err);
      return {
        kind,
        file,
        stamp: stampOf(file),
        title: file.basename,
        excerpt: "",
        isEmpty: false,
        searchText: file.path.toLowerCase(),
      };
    }
  }
}

/** AND search over space-separated terms */
export function matchesQuery(entry: GalleryEntry, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
  return terms.every((t) => entry.searchText.includes(t));
}

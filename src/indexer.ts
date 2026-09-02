import { App, TFile } from "obsidian";
import { EMPTY_TEXT_THRESHOLD, SEARCH_TEXT_LIMIT } from "./constants";

export interface HtmlEntry {
  file: TFile;
  /** <title>, else the first heading, else the file name */
  title: string;
  /** Beginning of the body text (for the fallback thumbnail) */
  excerpt: string;
  /** True when the body text (without script/style) is below the threshold, i.e. script-rendered HTML */
  isEmpty: boolean;
  /** Lowercased concatenation used for searching */
  searchText: string;
}

/** Parse HTML source into an index entry. DOMParser neither runs scripts nor loads subresources */
export function parseHtmlEntry(file: TFile, html: string): HtmlEntry {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript, template, svg").forEach((el) => el.remove());

  const bodyText = normalizeWhitespace(doc.body?.textContent ?? "");
  const heading = normalizeWhitespace(doc.querySelector("h1, h2")?.textContent ?? "");
  const title = normalizeWhitespace(doc.title) || heading || file.basename;

  const searchText = [file.path, title, bodyText.slice(0, SEARCH_TEXT_LIMIT)].join(" ").toLowerCase();

  return {
    file,
    title,
    excerpt: bodyText.slice(0, 200),
    isEmpty: bodyText.length < EMPTY_TEXT_THRESHOLD,
    searchText,
  };
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Index of the HTML in the vault. Built once when the view opens, then updated per file */
export class HtmlIndex {
  private entries = new Map<string, HtmlEntry>();

  constructor(private app: App) {}

  async build(files: TFile[]): Promise<void> {
    const entries = new Map<string, HtmlEntry>();
    await Promise.all(
      files.map(async (file) => {
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

  get(file: TFile): HtmlEntry | undefined {
    return this.entries.get(file.path);
  }

  private async read(file: TFile): Promise<HtmlEntry> {
    try {
      const html = await this.app.vault.cachedRead(file);
      return parseHtmlEntry(file, html);
    } catch (err) {
      console.warn("[html-gallery] failed to read", file.path, err);
      return {
        file,
        title: file.basename,
        excerpt: "",
        isEmpty: false,
        searchText: file.path.toLowerCase(),
      };
    }
  }
}

/** AND search over space-separated terms */
export function matchesQuery(entry: HtmlEntry, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
  return terms.every((t) => entry.searchText.includes(t));
}

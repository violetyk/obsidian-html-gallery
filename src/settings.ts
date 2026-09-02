import { normalizePath } from "obsidian";
import type { LangSetting } from "./i18n";

export type ThumbnailSize = "small" | "medium" | "large";
export type SortOrder = "mtime" | "path";

export interface HtmlGallerySettings {
  /** UI language */
  language: LangSetting;
  /** Run scripts inside thumbnails */
  thumbnailScripts: boolean;
  /** Thumbnail size */
  thumbnailSize: ThumbnailSize;
  /** Target folder (empty means the whole vault) */
  targetFolder: string;
  /** Excluded folders, one per line */
  excludeFolders: string;
  /** Include index.html in the gallery */
  includeIndexHtml: boolean;
  /** Sort order (persisted when switched from the view) */
  sortOrder: SortOrder;
}

export const DEFAULT_SETTINGS: HtmlGallerySettings = {
  language: "auto",
  thumbnailScripts: false,
  thumbnailSize: "medium",
  targetFolder: "",
  excludeFolders: "",
  includeIndexHtml: false,
  sortOrder: "mtime",
};

/** Parse the excluded-folders setting into a normalized array */
export function parseExcludeFolders(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => normalizeFolder(s))
    .filter((s) => s.length > 0);
}

/** Folder path without surrounding whitespace and slashes, normalized the way Obsidian expects */
export function normalizeFolder(raw: string): string {
  const trimmed = raw.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (trimmed === "") return "";
  const normalized = normalizePath(trimmed);
  return normalized === "/" ? "" : normalized;
}

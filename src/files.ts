import { App, TFile } from "obsidian";
import { ArtifactKind, enabledKinds, FileLike, kindOf } from "./kinds";
import { HtmlGallerySettings, normalizeFolder, parseExcludeFolders } from "./settings";

/** Whether the path is inside the folder (or is the folder itself) */
export function isUnderFolder(path: string, folder: string): boolean {
  if (folder === "") return true;
  return path === folder || path.startsWith(folder + "/");
}

/** The folder settings, parsed once so they are not re-parsed per file */
export interface GalleryFilters {
  kinds: Set<ArtifactKind>;
  target: string;
  excludes: string[];
  includeIndexHtml: boolean;
}

export function compileFilters(settings: HtmlGallerySettings): GalleryFilters {
  return {
    kinds: enabledKinds(settings),
    target: normalizeFolder(settings.targetFolder),
    excludes: parseExcludeFolders(settings.excludeFolders),
    includeIndexHtml: settings.includeIndexHtml,
  };
}

/** The kind the file belongs in the gallery as, or null when the filters exclude it */
export function matchesFilters(file: FileLike, filters: GalleryFilters): ArtifactKind | null {
  const kind = kindOf(file);
  if (kind === null || !filters.kinds.has(kind)) return null;
  if (!isUnderFolder(file.path, filters.target)) return null;
  if (filters.excludes.some((ex) => isUnderFolder(file.path, ex))) return null;
  // index.html is usually an entry point to other pages rather than a diagram of its own
  if (kind === "html" && !filters.includeIndexHtml && file.basename.toLowerCase() === "index") return null;
  return kind;
}

/** Collect the files in the vault according to the settings */
export function collectGalleryFiles(app: App, settings: HtmlGallerySettings): TFile[] {
  const filters = compileFilters(settings);
  return app.vault.getFiles().filter((file) => matchesFilters(file, filters) !== null);
}

/** Whether a single file is a target (used for incremental updates on vault events) */
export function isTargetGalleryFile(file: TFile, settings: HtmlGallerySettings): boolean {
  return matchesFilters(file, compileFilters(settings)) !== null;
}

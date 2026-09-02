import { App, TFile } from "obsidian";
import { HtmlGallerySettings, normalizeFolder, parseExcludeFolders } from "./settings";

const HTML_EXTENSIONS = new Set(["html", "htm"]);

/** Whether the path is inside the folder (or is the folder itself) */
export function isUnderFolder(path: string, folder: string): boolean {
  if (folder === "") return true;
  return path === folder || path.startsWith(folder + "/");
}

/** Collect the HTML files in the vault according to the settings */
export function collectHtmlFiles(app: App, settings: HtmlGallerySettings): TFile[] {
  const target = normalizeFolder(settings.targetFolder);
  const excludes = parseExcludeFolders(settings.excludeFolders);

  return app.vault.getFiles().filter((file) => {
    if (!HTML_EXTENSIONS.has(file.extension.toLowerCase())) return false;
    if (!isUnderFolder(file.path, target)) return false;
    if (excludes.some((ex) => isUnderFolder(file.path, ex))) return false;
    if (!settings.includeIndexHtml && file.basename.toLowerCase() === "index") return false;
    return true;
  });
}

/** Whether a single file is a target (used for incremental updates on vault events) */
export function isTargetHtmlFile(file: TFile, settings: HtmlGallerySettings): boolean {
  if (!HTML_EXTENSIONS.has(file.extension.toLowerCase())) return false;
  const target = normalizeFolder(settings.targetFolder);
  if (!isUnderFolder(file.path, target)) return false;
  const excludes = parseExcludeFolders(settings.excludeFolders);
  if (excludes.some((ex) => isUnderFolder(file.path, ex))) return false;
  if (!settings.includeIndexHtml && file.basename.toLowerCase() === "index") return false;
  return true;
}

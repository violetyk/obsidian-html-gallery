import { App, MarkdownView, Notice, TFile } from "obsidian";
import { t } from "./i18n";

/** Embed link to the HTML file, written the way the user's link settings dictate (wikilink or markdown, relative or not) */
export function buildEmbedLink(app: App, htmlFile: TFile, sourcePath: string): string {
  const link = app.fileManager.generateMarkdownLink(htmlFile, sourcePath);
  return link.startsWith("!") ? link : `!${link}`;
}

/** Append an embed link to the end of a note so the HTML file gains a real backlink */
export async function appendEmbedToNote(app: App, note: TFile, htmlFile: TFile): Promise<void> {
  const link = buildEmbedLink(app, htmlFile, note.path);
  const current = await app.vault.read(note);
  const separator = current.length === 0 || current.endsWith("\n\n") ? "" : current.endsWith("\n") ? "\n" : "\n\n";
  await app.vault.append(note, `${separator}${link}\n`);
  new Notice(t("notice.linkAdded", { note: note.basename }));
}

/**
 * Insert an embed link into the active Markdown note: at the cursor when an editor is open,
 * otherwise appended to the end of the file.
 */
export async function insertEmbedIntoActiveNote(app: App, note: TFile, htmlFile: TFile): Promise<void> {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (view && view.file?.path === note.path && view.getMode() === "source") {
    const link = buildEmbedLink(app, htmlFile, note.path);
    view.editor.replaceSelection(link);
    new Notice(t("notice.linkAdded", { note: note.basename }));
    return;
  }
  await appendEmbedToNote(app, note, htmlFile);
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  new Notice(t("notice.copied"));
}

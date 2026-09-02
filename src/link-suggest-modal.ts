import { App, FuzzySuggestModal, TFile } from "obsidian";
import { BacklinkIndex } from "./backlinks";
import { t } from "./i18n";

export interface LinkCandidate {
  file: TFile;
  /** True when no note at all links to this file yet */
  orphan: boolean;
}

/** Pick an HTML file from the active note's folder that the note does not link to yet */
export class LinkHtmlSuggestModal extends FuzzySuggestModal<LinkCandidate> {
  constructor(
    app: App,
    private candidates: LinkCandidate[],
    private onPick: (file: TFile) => void,
  ) {
    super(app);
    this.setPlaceholder(t("linkModal.placeholder"));
    this.setInstructions([
      { command: "↑↓", purpose: t("linkModal.navigate") },
      { command: "↵", purpose: t("linkModal.insert") },
      { command: "esc", purpose: t("linkModal.dismiss") },
    ]);
  }

  getItems(): LinkCandidate[] {
    return this.candidates;
  }

  getItemText(item: LinkCandidate): string {
    return item.file.name;
  }

  renderSuggestion(match: { item: LinkCandidate }, el: HTMLElement): void {
    const { file, orphan } = match.item;
    el.addClass("html-gallery-suggest");
    const row = el.createDiv({ cls: "html-gallery-suggest-row" });
    row.createSpan({ text: file.name });
    if (orphan) row.createSpan({ cls: "html-gallery-suggest-badge", text: t("linkModal.noBacklinks") });
    el.createDiv({ cls: "html-gallery-suggest-path", text: file.parent?.path ?? "" });
  }

  onChooseItem(item: LinkCandidate): void {
    this.onPick(item.file);
  }
}

/** HTML files in the note's folder that the note does not link to yet */
export function collectLinkCandidates(app: App, note: TFile, htmlFiles: TFile[], backlinks: BacklinkIndex): LinkCandidate[] {
  const folder = note.parent?.path ?? "";
  const linkedFromNote = new Set(Object.keys(app.metadataCache.resolvedLinks[note.path] ?? {}));
  return htmlFiles
    .filter((f) => (f.parent?.path ?? "") === folder && !linkedFromNote.has(f.path))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((file) => ({ file, orphan: backlinks.getSources(file).length === 0 }));
}

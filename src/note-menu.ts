import { App, Menu, TFile } from "obsidian";
import { NoteRefs } from "./backlinks";
import { t } from "./i18n";
import { appendEmbedToNote } from "./links";

export interface NoteMenuOptions {
  /** The HTML file the notes refer to */
  file: TFile;
  refs: NoteRefs;
  onOpen: (note: TFile) => void;
}

/** Label for a note; the folder is appended only when several notes share a name (e.g. README) */
function noteLabel(note: TFile, counts: Map<string, number>): string {
  const dup = (counts.get(note.basename) ?? 0) > 1;
  return dup && note.parent ? `${note.basename}  (${note.parent.path})` : note.basename;
}

/** Add the note items to an existing menu (used by the card context menu as well) */
export function addNoteItems(menu: Menu, app: App, options: NoteMenuOptions): void {
  const { file, refs, onOpen } = options;
  const counts = new Map<string, number>();
  for (const note of refs.notes) counts.set(note.basename, (counts.get(note.basename) ?? 0) + 1);

  for (const note of refs.notes) {
    menu.addItem((item) =>
      item
        .setTitle(noteLabel(note, counts))
        .setIcon("file-text")
        .setSection("html-gallery-open")
        .onClick(() => onOpen(note)),
    );
  }

  // Guessed candidates can be turned into real backlinks by appending an embed to the note
  if (refs.kind === "sibling") {
    for (const note of refs.notes) {
      menu.addItem((item) =>
        item
          .setTitle(t("menu.addLinkTo", { note: noteLabel(note, counts) }))
          .setIcon("link")
          .setSection("html-gallery-link")
          .onClick(() => void appendEmbedToNote(app, note, file)),
      );
    }
  }
}

/** Show the referenced notes in a menu and open the chosen one */
export function showNoteMenu(app: App, options: NoteMenuOptions, evt: MouseEvent): void {
  const menu = new Menu();
  addNoteItems(menu, app, options);
  menu.showAtMouseEvent(evt);
}

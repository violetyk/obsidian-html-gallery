import { App, TFile } from "obsidian";

export type NoteRefKind = "resolved" | "sibling";

export interface NoteRefs {
  /** Confirmed (linked from the note) or guessed (same folder) */
  kind: NoteRefKind;
  notes: TFile[];
}

/**
 * Reverse index of metadataCache.resolvedLinks ({source: {target: count}}),
 * kept as {target: Set<source>}.
 */
export class BacklinkIndex {
  private reverse = new Map<string, Set<string>>();

  constructor(private app: App) {}

  rebuild(): void {
    const reverse = new Map<string, Set<string>>();
    const links = this.app.metadataCache.resolvedLinks;
    for (const source of Object.keys(links)) {
      const targets = links[source];
      if (!targets) continue;
      for (const target of Object.keys(targets)) {
        let set = reverse.get(target);
        if (!set) {
          set = new Set<string>();
          reverse.set(target, set);
        }
        set.add(source);
      }
    }
    this.reverse = reverse;
  }

  /** Markdown notes that link to the file, newest modification first */
  getSources(file: TFile): TFile[] {
    const sources = this.reverse.get(file.path);
    if (!sources) return [];
    const notes: TFile[] = [];
    for (const path of sources) {
      const note = this.app.vault.getFileByPath(path);
      if (note && note.extension === "md") notes.push(note);
    }
    notes.sort((a, b) => b.stat.mtime - a.stat.mtime);
    return notes;
  }
}

/** Markdown notes in the same folder, ordered by closest modification time */
export function guessSiblingNotes(file: TFile, limit: number): TFile[] {
  const parent = file.parent;
  if (!parent) return [];
  const candidates: TFile[] = [];
  for (const child of parent.children) {
    if (child instanceof TFile && child.extension === "md") candidates.push(child);
  }
  candidates.sort(
    (a, b) => Math.abs(a.stat.mtime - file.stat.mtime) - Math.abs(b.stat.mtime - file.stat.mtime),
  );
  return candidates.slice(0, limit);
}

/** Prefer confirmed backlinks; fall back to same-folder guessing when there are none */
export function resolveNoteRefs(index: BacklinkIndex, file: TFile, siblingLimit: number): NoteRefs {
  const resolved = index.getSources(file);
  if (resolved.length > 0) return { kind: "resolved", notes: resolved };
  return { kind: "sibling", notes: guessSiblingNotes(file, siblingLimit) };
}

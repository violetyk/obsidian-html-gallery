/** Stand-in for the parts of the Obsidian API that the pure modules import at runtime */

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

/** Only needed so modules that declare a subclass at load time can be imported */
export class FuzzySuggestModal {}

export class TFile {
  path = "";
  name = "";
  basename = "";
  extension = "";
  parent: { path: string; children: TFile[] } | null = null;
  stat = { mtime: 0, ctime: 0, size: 0 };
}

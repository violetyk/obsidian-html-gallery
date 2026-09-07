import { TFile } from "obsidian";
import { DEFAULT_SETTINGS, HtmlGallerySettings } from "../src/settings";

/**
 * A TFile holding only what the code under test reads. A real instance of the stub class, because
 * the source uses `instanceof TFile` when walking a folder's children
 */
export function fakeFile(path: string, mtime = 0, size = 0): TFile {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  return Object.assign(new TFile(), {
    path,
    name,
    basename: dot === -1 ? name : name.slice(0, dot),
    extension: dot === -1 ? "" : name.slice(dot + 1),
    stat: { mtime, ctime: mtime, size },
  });
}

export function settings(overrides: Partial<HtmlGallerySettings> = {}): HtmlGallerySettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

/** A folder holding the given files, enough for the same-folder guessing to walk it */
export function fakeFolder(path: string, children: TFile[]): void {
  const parent = { path, children } as unknown as TFile["parent"];
  for (const child of children) {
    (child as { parent: TFile["parent"] }).parent = parent;
  }
}

export interface FakeAppOptions {
  /** path -> file contents, for cachedRead */
  contents?: Record<string, string>;
  /** source note path -> { target path: count }, as metadataCache.resolvedLinks is shaped */
  resolvedLinks?: Record<string, Record<string, number>>;
  files?: TFile[];
}

/** The few App members the pure-ish modules touch. Anything else throws rather than lying */
export function fakeApp(options: FakeAppOptions = {}) {
  const byPath = new Map((options.files ?? []).map((f) => [f.path, f]));
  const reads: string[] = [];
  const app = {
    vault: {
      cachedRead: (file: TFile) => {
        reads.push(file.path);
        const text = options.contents?.[file.path];
        if (text === undefined) return Promise.reject(new Error(`no content for ${file.path}`));
        return Promise.resolve(text);
      },
      getFileByPath: (path: string) => byPath.get(path) ?? null,
    },
    metadataCache: { resolvedLinks: options.resolvedLinks ?? {} },
    fileManager: {
      generateMarkdownLink: (file: TFile, sourcePath: string) => `[[${file.path}|from:${sourcePath}]]`,
    },
  };
  return { app: app as unknown as import("obsidian").App, reads };
}

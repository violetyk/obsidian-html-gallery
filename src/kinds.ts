import type { HtmlGallerySettings } from "./settings";

/**
 * File kinds the gallery can show. Widening this union is deliberate: every `switch` over it
 * stops compiling until the new kind has an arm, which is how new kinds get wired everywhere
 */
export type ArtifactKind = "html" | "svg" | "image" | "pdf";

/** The part of TFile the pure helpers need, so they can be tested without the Obsidian API */
export interface FileLike {
  path: string;
  basename: string;
  extension: string;
}

const KIND_BY_EXTENSION: Readonly<Record<string, ArtifactKind>> = {
  html: "html",
  htm: "html",
  svg: "svg",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  bmp: "image",
  pdf: "pdf",
};

/** The setting that switches each kind on */
export const ENABLED_KEY_BY_KIND = {
  html: "includeHtml",
  svg: "includeSvg",
  image: "includeImages",
  pdf: "includePdf",
} as const satisfies Record<ArtifactKind, keyof HtmlGallerySettings>;

export const ALL_KINDS = Object.keys(ENABLED_KEY_BY_KIND) as ArtifactKind[];

/** The kind of a file, or null when its extension is not a gallery type */
export function kindOf(file: FileLike): ArtifactKind | null {
  return KIND_BY_EXTENSION[file.extension.toLowerCase()] ?? null;
}

/** The kinds the settings switch on */
export function enabledKinds(settings: HtmlGallerySettings): Set<ArtifactKind> {
  return new Set(ALL_KINDS.filter((kind) => settings[ENABLED_KEY_BY_KIND[kind]]));
}

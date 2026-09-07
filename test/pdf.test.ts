import { describe, expect, it } from "vitest";
import { PDF_MAX_BYTES, PDF_THUMB_MAX_PIXELS, PDF_THUMB_MAX_WIDTH } from "../src/constants";
import { parsePdfMeta, stampOf } from "../src/indexer";
import { fitScale, isPdfTooLarge } from "../src/pdf";
import { fakeFile } from "./helpers";

describe("fitScale", () => {
  it("fits an A4 portrait page to the maximum width", () => {
    const scale = fitScale(595, 842);
    expect(scale * 595).toBeCloseTo(PDF_THUMB_MAX_WIDTH, 5);
  });

  it("keeps the canvas within the pixel budget for a poster-sized page", () => {
    const w = 2384;
    const h = 3370;
    const scale = fitScale(w, h);
    expect(scale * w * scale * h).toBeLessThanOrEqual(PDF_THUMB_MAX_PIXELS + 1);
    expect(scale * w).toBeLessThanOrEqual(PDF_THUMB_MAX_WIDTH + 1);
  });

  it("respects the width cap on a very wide page", () => {
    const scale = fitScale(3000, 200);
    expect(scale * 3000).toBeLessThanOrEqual(PDF_THUMB_MAX_WIDTH + 1);
  });

  it("falls back to 1 for a degenerate page size", () => {
    expect(fitScale(0, 100)).toBe(1);
    expect(fitScale(100, -1)).toBe(1);
  });
});

describe("parsePdfMeta", () => {
  it("keeps the file name as the title and only indexes the metadata title", () => {
    const p = parsePdfMeta({ pageCount: 3, text: "body text", title: "Microsoft Word - draft.doc" }, "Spec");
    expect(p.title).toBe("Spec");
    expect(p.searchBody).toContain("Microsoft Word - draft.doc");
    expect(p.searchBody).toContain("body text");
  });

  it("records the page count", () => {
    expect(parsePdfMeta({ pageCount: 200, text: "x" }, "base").pageCount).toBe(200);
  });

  it("flags a PDF with no text layer", () => {
    expect(parsePdfMeta({ pageCount: 2, text: "   " }, "scan").hasNoText).toBe(true);
    expect(parsePdfMeta({ pageCount: 2, text: "words" }, "doc").hasNoText).toBe(false);
  });

  it("is never treated as an empty thumbnail", () => {
    expect(parsePdfMeta({ pageCount: 1, text: "" }, "base").isEmpty).toBe(false);
  });

  it("collapses whitespace from the extracted text", () => {
    expect(parsePdfMeta({ pageCount: 1, text: "a\n\n  b" }, "base").searchBody).toBe("a b");
  });
});

describe("stampOf", () => {
  it("changes when either mtime or size changes", () => {
    expect(stampOf(fakeFile("a.pdf", 100, 10))).toBe(stampOf(fakeFile("a.pdf", 100, 10)));
    expect(stampOf(fakeFile("a.pdf", 100, 10))).not.toBe(stampOf(fakeFile("a.pdf", 101, 10)));
    expect(stampOf(fakeFile("a.pdf", 100, 10))).not.toBe(stampOf(fakeFile("a.pdf", 100, 11)));
  });
});

describe("isPdfTooLarge", () => {
  it("draws the line at the byte budget", () => {
    expect(isPdfTooLarge(fakeFile("a.pdf", 0, PDF_MAX_BYTES))).toBe(false);
    expect(isPdfTooLarge(fakeFile("a.pdf", 0, PDF_MAX_BYTES + 1))).toBe(true);
  });
});

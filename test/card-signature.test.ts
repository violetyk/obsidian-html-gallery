import { describe, expect, it } from "vitest";
import { buildEntry, cardSignature, parseHtml, parseNoText } from "../src/indexer";
import type { ArtifactKind } from "../src/kinds";
import { fakeFile } from "./helpers";

const htmlEntry = (source: string, file = fakeFile("a.html", 1)) =>
  buildEntry(file, "html", parseHtml(source, file.basename));
const noTextEntry = (kind: ArtifactKind, file: ReturnType<typeof fakeFile>) =>
  buildEntry(file, kind, parseNoText(file.basename));

/*
 * A card is destroyed and rebuilt exactly when its signature changes, and destroying a card whose
 * iframe is still loading is the crash this plugin exists to avoid. So these tests pin down both
 * directions: what must change the signature, and what must not.
 */
describe("cardSignature", () => {
  const file = fakeFile("a.html", 1000);

  it("changes when the file is modified", () => {
    const a = cardSignature(fakeFile("a.html", 1000), "html", undefined, false);
    const b = cardSignature(fakeFile("a.html", 1001), "html", undefined, false);
    expect(a).not.toBe(b);
  });

  it("changes when the kind changes", () => {
    expect(cardSignature(file, "html", undefined, false)).not.toBe(
      cardSignature(file, "pdf", undefined, false),
    );
  });

  it("is stable for the same inputs", () => {
    expect(cardSignature(file, "html", undefined, false)).toBe(
      cardSignature(file, "html", undefined, false),
    );
  });

  describe("HTML", () => {
    it("changes when the scripts setting is toggled", () => {
      expect(cardSignature(file, "html", undefined, false)).not.toBe(
        cardSignature(file, "html", undefined, true),
      );
    });

    it("changes when the blank-thumbnail fallback applies", () => {
      const empty = htmlEntry("<body><script>draw()</script></body>");
      const filled = htmlEntry(`<body>${"x".repeat(100)}</body>`);
      expect(empty.isEmpty).toBe(true);
      expect(filled.isEmpty).toBe(false);
      expect(cardSignature(file, "html", empty, false)).not.toBe(
        cardSignature(file, "html", filled, false),
      );
    });

    it("matches before and after indexing for a normal page, so the first render is not thrown away", () => {
      const filled = htmlEntry(`<body>${"x".repeat(100)}</body>`);
      expect(cardSignature(file, "html", undefined, false)).toBe(
        cardSignature(file, "html", filled, false),
      );
    });
  });

  describe("the other kinds", () => {
    const cases: ArtifactKind[] = ["svg", "image", "pdf"];

    it.each(cases)("ignores the scripts setting for %s", (kind) => {
      const f = fakeFile(`a.${kind === "image" ? "png" : kind}`, 1000);
      expect(cardSignature(f, kind, undefined, false)).toBe(cardSignature(f, kind, undefined, true));
    });

    it.each(cases)("matches before and after indexing for %s", (kind) => {
      const f = fakeFile(`a.${kind === "image" ? "png" : kind}`, 1000);
      expect(cardSignature(f, kind, undefined, false)).toBe(
        cardSignature(f, kind, noTextEntry(kind, f), false),
      );
    });
  });
});

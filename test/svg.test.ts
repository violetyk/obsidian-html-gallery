import { describe, expect, it } from "vitest";
import { buildEntry, parseNoText, parseSvg } from "../src/indexer";
import { fakeFile } from "./helpers";

const svg = (inner: string, attrs = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"') =>
  `<svg ${attrs}>${inner}</svg>`;

describe("parseSvg", () => {
  it("uses the root <title>", () => {
    expect(parseSvg(svg("<title>Order flow</title>"), "base").title).toBe("Order flow");
  });

  it("ignores nested titles, which are per-shape tooltips", () => {
    const p = parseSvg(svg("<g><title>Shape tooltip</title></g>"), "base");
    expect(p.title).toBe("base");
    expect(p.searchBody).not.toContain("Shape tooltip");
  });

  it("falls back to <desc>, then to the file name", () => {
    expect(parseSvg(svg("<desc>A diagram</desc>"), "base").title).toBe("A diagram");
    expect(parseSvg(svg("<rect/>"), "base").title).toBe("base");
  });

  it("indexes title, desc, aria-label and every text and tspan", () => {
    const p = parseSvg(
      svg(
        "<title>T</title><desc>D</desc><text>Label one</text><text><tspan>Label two</tspan></text>",
        'xmlns="http://www.w3.org/2000/svg" aria-label="Chart of orders"',
      ),
      "base",
    );
    for (const term of ["T", "D", "Chart of orders", "Label one", "Label two"]) {
      expect(p.searchBody).toContain(term);
    }
  });

  it("survives malformed XML by falling back to the file name", () => {
    const p = parseSvg("<svg><unclosed>", "base");
    expect(p.title).toBe("base");
    expect(p.searchBody).toBe("");
  });

  it("is never treated as an empty thumbnail, even with no text at all", () => {
    expect(parseSvg(svg('<rect width="10" height="10"/>'), "base").isEmpty).toBe(false);
  });
});

describe("parseNoText", () => {
  it("carries the file name and nothing else", () => {
    const p = parseNoText("screenshot");
    expect(p).toEqual({ title: "screenshot", excerpt: "", isEmpty: false, searchBody: "" });
  });

  it("still lands in the index searchable by path", () => {
    const entry = buildEntry(fakeFile("notes/Screenshot.png"), "image", parseNoText("Screenshot"));
    expect(entry.searchText).toBe("notes/screenshot.png screenshot ");
    expect(entry.kind).toBe("image");
  });
});

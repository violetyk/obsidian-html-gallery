import { describe, expect, it } from "vitest";
import { enabledKinds, kindOf } from "../src/kinds";
import { fakeFile, settings } from "./helpers";

describe("kindOf", () => {
  it("maps html and htm to html, whatever the case", () => {
    expect(kindOf(fakeFile("a/x.html"))).toBe("html");
    expect(kindOf(fakeFile("a/x.htm"))).toBe("html");
    expect(kindOf(fakeFile("a/x.HtM"))).toBe("html");
  });

  it("returns null for anything else", () => {
    expect(kindOf(fakeFile("a/x.md"))).toBeNull();
    expect(kindOf(fakeFile("a/noext"))).toBeNull();
  });
});

describe("kindOf for the other kinds", () => {
  it("maps svg to its own kind, separate from raster images", () => {
    expect(kindOf(fakeFile("a/x.svg"))).toBe("svg");
  });

  it("maps raster extensions to image", () => {
    for (const ext of ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"]) {
      expect(kindOf(fakeFile(`a/x.${ext}`))).toBe("image");
    }
  });

  it("maps pdf to its own kind", () => {
    expect(kindOf(fakeFile("a/x.pdf"))).toBe("pdf");
  });

  it("still rejects everything else", () => {
    expect(kindOf(fakeFile("a/x.csv"))).toBeNull();
    expect(kindOf(fakeFile("a/x.md"))).toBeNull();
  });
});

describe("enabledKinds", () => {
  it("follows the settings", () => {
    expect([...enabledKinds(settings())]).toEqual(["html"]);
    expect([...enabledKinds(settings({ includeSvg: true }))].sort()).toEqual(["html", "svg"]);
    expect([...enabledKinds(settings({ includeHtml: false, includeImages: true }))]).toEqual(["image"]);
    expect([...enabledKinds(settings({ includeHtml: false, includePdf: true }))]).toEqual(["pdf"]);
    expect([...enabledKinds(settings({ includeHtml: false }))]).toEqual([]);
  });
});

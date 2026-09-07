import { describe, expect, it } from "vitest";
import { compileFilters, isUnderFolder, matchesFilters } from "../src/files";
import { fakeFile, settings } from "./helpers";

describe("isUnderFolder", () => {
  it("treats the empty folder as the whole vault", () => {
    expect(isUnderFolder("a/b.html", "")).toBe(true);
  });

  it("matches the folder itself and its descendants", () => {
    expect(isUnderFolder("a", "a")).toBe(true);
    expect(isUnderFolder("a/b.html", "a")).toBe(true);
  });

  it("does not match a sibling folder sharing a prefix", () => {
    expect(isUnderFolder("ab/c.html", "a")).toBe(false);
  });
});

describe("matchesFilters", () => {
  const match = (path: string, overrides = {}) =>
    matchesFilters(fakeFile(path), compileFilters(settings(overrides)));

  it("accepts html and htm", () => {
    expect(match("a/x.html")).toBe("html");
    expect(match("a/x.htm")).toBe("html");
  });

  it("is case insensitive about the extension", () => {
    expect(match("a/x.HTML")).toBe("html");
  });

  it("rejects other extensions", () => {
    expect(match("a/x.md")).toBeNull();
    expect(match("a/x.pdf")).toBeNull();
    expect(match("a/x")).toBeNull();
  });

  it("honours the target folder", () => {
    expect(match("a/x.html", { targetFolder: "a" })).toBe("html");
    expect(match("b/x.html", { targetFolder: "a" })).toBeNull();
    expect(match("ab/x.html", { targetFolder: "a" })).toBeNull();
  });

  it("honours excluded folders, one per line", () => {
    const excludeFolders = "a\nb/c";
    expect(match("a/x.html", { excludeFolders })).toBeNull();
    expect(match("b/c/x.html", { excludeFolders })).toBeNull();
    expect(match("b/d/x.html", { excludeFolders })).toBe("html");
  });

  it("drops index.html unless it is included", () => {
    expect(match("a/index.html")).toBeNull();
    expect(match("a/INDEX.html")).toBeNull();
    expect(match("a/index.html", { includeIndexHtml: true })).toBe("html");
    expect(match("a/index-old.html")).toBe("html");
  });
});

describe("matchesFilters across kinds", () => {
  const match = (path: string, overrides = {}) =>
    matchesFilters(fakeFile(path), compileFilters(settings(overrides)));

  it("hides svg and images until they are switched on", () => {
    expect(match("a/x.svg")).toBeNull();
    expect(match("a/x.png")).toBeNull();
    expect(match("a/x.svg", { includeSvg: true })).toBe("svg");
    expect(match("a/x.png", { includeImages: true })).toBe("image");
  });

  it("can hide html while showing images", () => {
    const only = { includeHtml: false, includeImages: true };
    expect(match("a/x.html", only)).toBeNull();
    expect(match("a/x.png", only)).toBe("image");
  });

  it("applies the index rule to html only", () => {
    const on = { includeSvg: true, includeImages: true };
    expect(match("a/index.html", on)).toBeNull();
    expect(match("a/index.svg", on)).toBe("svg");
    expect(match("a/index.png", on)).toBe("image");
  });

  it("applies the folder filters to every kind", () => {
    const on = { includeSvg: true, targetFolder: "a" };
    expect(match("a/x.svg", on)).toBe("svg");
    expect(match("b/x.svg", on)).toBeNull();
  });
});

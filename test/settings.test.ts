import { describe, expect, it } from "vitest";
import { normalizeFolder, parseExcludeFolders } from "../src/settings";

describe("normalizeFolder", () => {
  it("strips surrounding whitespace and slashes", () => {
    expect(normalizeFolder("  /a/b/  ")).toBe("a/b");
  });

  it("maps blank and root to the whole vault", () => {
    expect(normalizeFolder("")).toBe("");
    expect(normalizeFolder("   ")).toBe("");
    expect(normalizeFolder("/")).toBe("");
  });
});

describe("parseExcludeFolders", () => {
  it("splits on newlines and drops blanks", () => {
    expect(parseExcludeFolders("a\n\n /b/ \r\nc")).toEqual(["a", "b", "c"]);
  });

  it("returns nothing for an empty setting", () => {
    expect(parseExcludeFolders("")).toEqual([]);
  });
});

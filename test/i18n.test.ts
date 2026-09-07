import { afterEach, describe, expect, it } from "vitest";
import { detectLang, getLang, setLang, t } from "../src/i18n";

const originalLang = document.documentElement.lang;
afterEach(() => {
  document.documentElement.lang = originalLang;
  setLang("auto");
});

describe("detectLang", () => {
  it("picks Japanese for a ja locale", () => {
    document.documentElement.lang = "ja";
    expect(detectLang()).toBe("ja");
    document.documentElement.lang = "ja-JP";
    expect(detectLang()).toBe("ja");
  });

  it("falls back to English for anything else", () => {
    document.documentElement.lang = "de-DE";
    expect(detectLang()).toBe("en");
  });
});

describe("setLang", () => {
  it("follows the document for auto", () => {
    document.documentElement.lang = "ja";
    setLang("auto");
    expect(getLang()).toBe("ja");
  });

  it("pins the language when one is chosen", () => {
    document.documentElement.lang = "ja";
    setLang("en");
    expect(getLang()).toBe("en");
    expect(t("card.modified")).toBe("Modified");
  });
});

describe("t", () => {
  it("substitutes placeholders", () => {
    setLang("en");
    expect(t("header.countFiltered", { n: 6, total: 11 })).toBe("6 / 11 files");
    expect(t("card.pages", { n: 2 })).toBe("2 pages");
  });
});

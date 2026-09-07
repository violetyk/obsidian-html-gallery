import { describe, expect, it } from "vitest";
import { EMPTY_TEXT_THRESHOLD, SEARCH_TEXT_LIMIT } from "../src/constants";
import { buildEntry, matchesQuery, normalizeWhitespace, parseHtml } from "../src/indexer";
import { fakeFile } from "./helpers";

describe("parseHtml", () => {
  it("prefers <title>", () => {
    const p = parseHtml("<title>From title</title><h1>From heading</h1>", "base");
    expect(p.title).toBe("From title");
  });

  it("falls back to the first h1 or h2, then to the file name", () => {
    expect(parseHtml("<h2>Only heading</h2>", "base").title).toBe("Only heading");
    expect(parseHtml("<p>no title at all</p>", "base").title).toBe("base");
  });

  it("ignores a blank title", () => {
    expect(parseHtml("<title>   </title><h1>Heading</h1>", "base").title).toBe("Heading");
  });

  it("strips script, style, noscript, template and svg from the body text", () => {
    const html = `<body>Kept
      <script>var secret = 1;</script>
      <style>.a { color: red }</style>
      <noscript>fallback</noscript>
      <template>templated</template>
      <svg><text>vector</text></svg>
    </body>`;
    const p = parseHtml(html, "base");
    expect(p.searchBody).toBe("Kept");
    for (const gone of ["secret", "color", "fallback", "templated", "vector"]) {
      expect(p.searchBody).not.toContain(gone);
    }
  });

  it("collapses whitespace", () => {
    expect(parseHtml("<body>a\n\n  b\tc</body>", "base").searchBody).toBe("a b c");
  });

  it("marks a body shorter than the threshold as empty", () => {
    expect(parseHtml("<body>short</body>", "base").isEmpty).toBe(true);
    expect(parseHtml(`<body>${"x".repeat(EMPTY_TEXT_THRESHOLD)}</body>`, "base").isEmpty).toBe(false);
  });

  it("treats script-only HTML as empty", () => {
    expect(parseHtml("<body><script>renderChart()</script></body>", "base").isEmpty).toBe(true);
  });

  it("caps the excerpt at 200 characters but keeps the full search body", () => {
    const p = parseHtml(`<body>${"y".repeat(500)}</body>`, "base");
    expect(p.excerpt).toHaveLength(200);
    expect(p.searchBody).toHaveLength(500);
  });
});

describe("buildEntry", () => {
  it("indexes path, title and body, lowercased", () => {
    const entry = buildEntry(fakeFile("Notes/Diagram.html"), "html", {
      title: "Order Flow",
      excerpt: "Body",
      isEmpty: false,
      searchBody: "Body TEXT",
    });
    expect(entry.searchText).toBe("notes/diagram.html order flow body text");
    expect(entry.kind).toBe("html");
    expect(entry.title).toBe("Order Flow");
  });

  it("truncates the body at the search limit", () => {
    const entry = buildEntry(fakeFile("a.html"), "html", {
      title: "t",
      excerpt: "",
      isEmpty: false,
      searchBody: "z".repeat(SEARCH_TEXT_LIMIT + 100),
    });
    expect(entry.searchText).toHaveLength("a.html t ".length + SEARCH_TEXT_LIMIT);
  });
});

describe("matchesQuery", () => {
  const entry = buildEntry(fakeFile("notes/order.html"), "html", {
    title: "Order Flow",
    excerpt: "",
    isEmpty: false,
    searchBody: "purchase order accumulation",
  });

  it("requires every term (AND)", () => {
    expect(matchesQuery(entry, "order flow")).toBe(true);
    expect(matchesQuery(entry, "order missing")).toBe(false);
  });

  it("is case insensitive and tolerates extra whitespace", () => {
    expect(matchesQuery(entry, "  ORDER   Purchase ")).toBe(true);
  });

  it("matches everything for an empty query", () => {
    expect(matchesQuery(entry, "")).toBe(true);
    expect(matchesQuery(entry, "   ")).toBe(true);
  });

  it("searches the path too", () => {
    expect(matchesQuery(entry, "notes/")).toBe(true);
  });
});

describe("normalizeWhitespace", () => {
  it("collapses runs and trims", () => {
    expect(normalizeWhitespace("  a \n\t b  ")).toBe("a b");
  });
});

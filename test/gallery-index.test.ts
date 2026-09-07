import { describe, expect, it } from "vitest";
import { GalleryIndex } from "../src/indexer";
import { fakeApp, fakeFile } from "./helpers";

const html = (title: string) => `<title>${title}</title><body>${"x".repeat(50)}</body>`;

describe("GalleryIndex.build", () => {
  it("indexes every file it is given", async () => {
    const a = fakeFile("a.html", 1, 10);
    const b = fakeFile("b.html", 1, 10);
    const { app, reads } = fakeApp({ contents: { "a.html": html("A"), "b.html": html("B") } });
    const index = new GalleryIndex(app);
    await index.build([a, b]);
    expect(index.get(a)?.title).toBe("A");
    expect(index.get(b)?.title).toBe("B");
    expect(reads).toEqual(["a.html", "b.html"]);
  });

  it("reuses an entry whose file has not changed, without reading the file again", async () => {
    const a = fakeFile("a.html", 1, 10);
    const { app, reads } = fakeApp({ contents: { "a.html": html("A") } });
    const index = new GalleryIndex(app);
    await index.build([a]);
    await index.build([a]);
    expect(reads).toEqual(["a.html"]);
    expect(index.get(a)?.title).toBe("A");
  });

  it("re-reads when the modification time changes", async () => {
    const first = fakeFile("a.html", 1, 10);
    const { app, reads } = fakeApp({ contents: { "a.html": html("A") } });
    const index = new GalleryIndex(app);
    await index.build([first]);

    const edited = fakeFile("a.html", 2, 10);
    app.vault.cachedRead = ((file: typeof edited) => {
      reads.push(file.path);
      return Promise.resolve(html("A edited"));
    }) as typeof app.vault.cachedRead;
    await index.build([edited]);

    expect(reads).toEqual(["a.html", "a.html"]);
    expect(index.get(edited)?.title).toBe("A edited");
  });

  it("re-reads when only the size changes, even at the same timestamp", async () => {
    const first = fakeFile("a.html", 1, 10);
    const { app, reads } = fakeApp({ contents: { "a.html": html("A") } });
    const index = new GalleryIndex(app);
    await index.build([first]);
    await index.build([fakeFile("a.html", 1, 11)]);
    expect(reads).toEqual(["a.html", "a.html"]);
  });

  it("drops entries for files that are no longer collected", async () => {
    const a = fakeFile("a.html", 1, 10);
    const b = fakeFile("b.html", 1, 10);
    const { app } = fakeApp({ contents: { "a.html": html("A"), "b.html": html("B") } });
    const index = new GalleryIndex(app);
    await index.build([a, b]);
    await index.build([a]);
    expect(index.get(a)).toBeDefined();
    expect(index.get(b)).toBeUndefined();
  });

  it("keeps a usable entry when a file cannot be read", async () => {
    const broken = fakeFile("gone.html", 1, 10);
    const { app } = fakeApp({});
    const index = new GalleryIndex(app);
    await index.build([broken]);
    const entry = index.get(broken);
    expect(entry?.title).toBe("gone");
    expect(entry?.isEmpty).toBe(false);
    expect(entry?.searchText).toBe("gone.html");
  });

  it("does not reuse a failed entry once the file can be read", async () => {
    const file = fakeFile("a.html", 1, 10);
    const { app } = fakeApp({});
    const index = new GalleryIndex(app);
    await index.build([file]);
    expect(index.get(file)?.title).toBe("a");

    const fixed = fakeFile("a.html", 2, 10);
    app.vault.cachedRead = (() => Promise.resolve(html("Now readable"))) as typeof app.vault.cachedRead;
    await index.build([fixed]);
    expect(index.get(fixed)?.title).toBe("Now readable");
  });
});

describe("GalleryIndex.update and remove", () => {
  it("re-reads one file on update", async () => {
    const a = fakeFile("a.html", 1, 10);
    const { app, reads } = fakeApp({ contents: { "a.html": html("A") } });
    const index = new GalleryIndex(app);
    await index.build([a]);
    await index.update(a);
    expect(reads).toEqual(["a.html", "a.html"]);
  });

  it("forgets a removed path", async () => {
    const a = fakeFile("a.html", 1, 10);
    const { app } = fakeApp({ contents: { "a.html": html("A") } });
    const index = new GalleryIndex(app);
    await index.build([a]);
    index.remove(a.path);
    expect(index.get(a)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { BacklinkIndex, guessSiblingNotes, resolveNoteRefs } from "../src/backlinks";
import { fakeApp, fakeFile, fakeFolder } from "./helpers";

const diagram = () => fakeFile("notes/diagram.html", 1000);

describe("BacklinkIndex", () => {
  const build = (resolvedLinks: Record<string, Record<string, number>>, files = [] as ReturnType<typeof fakeFile>[]) => {
    const { app } = fakeApp({ resolvedLinks, files });
    const index = new BacklinkIndex(app);
    index.rebuild();
    return index;
  };

  it("reverses resolvedLinks so a file knows who links to it", () => {
    const target = diagram();
    const a = fakeFile("notes/a.md", 200);
    const b = fakeFile("notes/b.md", 100);
    const index = build(
      { "notes/a.md": { "notes/diagram.html": 1 }, "notes/b.md": { "notes/diagram.html": 2 } },
      [target, a, b],
    );
    expect(index.getSources(target).map((f) => f.path)).toEqual(["notes/a.md", "notes/b.md"]);
  });

  it("orders sources by most recently modified", () => {
    const target = diagram();
    const older = fakeFile("notes/older.md", 100);
    const newer = fakeFile("notes/newer.md", 300);
    const index = build(
      { "notes/older.md": { "notes/diagram.html": 1 }, "notes/newer.md": { "notes/diagram.html": 1 } },
      [target, older, newer],
    );
    expect(index.getSources(target).map((f) => f.path)).toEqual(["notes/newer.md", "notes/older.md"]);
  });

  it("returns nothing for a file no note links to", () => {
    const target = diagram();
    expect(build({ "notes/a.md": { "notes/other.html": 1 } }, [target]).getSources(target)).toEqual([]);
  });

  it("ignores sources that are not markdown", () => {
    const target = diagram();
    const html = fakeFile("notes/page.html", 100);
    const index = build({ "notes/page.html": { "notes/diagram.html": 1 } }, [target, html]);
    expect(index.getSources(target)).toEqual([]);
  });

  it("ignores sources that no longer exist in the vault", () => {
    const target = diagram();
    const index = build({ "notes/deleted.md": { "notes/diagram.html": 1 } }, [target]);
    expect(index.getSources(target)).toEqual([]);
  });

  it("replaces the whole reverse index on rebuild", () => {
    const target = diagram();
    const a = fakeFile("notes/a.md", 100);
    const { app } = fakeApp({ resolvedLinks: { "notes/a.md": { "notes/diagram.html": 1 } }, files: [target, a] });
    const index = new BacklinkIndex(app);
    index.rebuild();
    expect(index.getSources(target)).toHaveLength(1);
    // The link was removed from the note
    (app.metadataCache as unknown as { resolvedLinks: Record<string, unknown> }).resolvedLinks = {};
    index.rebuild();
    expect(index.getSources(target)).toEqual([]);
  });
});

describe("guessSiblingNotes", () => {
  it("offers the notes in the same folder, closest modification time first", () => {
    const target = fakeFile("notes/diagram.html", 1000);
    const near = fakeFile("notes/near.md", 1010);
    const far = fakeFile("notes/far.md", 5000);
    const other = fakeFile("notes/page.html", 1005);
    fakeFolder("notes", [target, near, far, other]);
    expect(guessSiblingNotes(target, 2).map((f) => f.path)).toEqual(["notes/near.md", "notes/far.md"]);
  });

  it("only offers markdown", () => {
    const target = fakeFile("notes/diagram.html", 1000);
    const sibling = fakeFile("notes/page.html", 1000);
    fakeFolder("notes", [target, sibling]);
    expect(guessSiblingNotes(target, 3)).toEqual([]);
  });

  it("honours the limit", () => {
    const target = fakeFile("notes/diagram.html", 1000);
    const notes = [1, 2, 3, 4].map((n) => fakeFile(`notes/n${n}.md`, 1000 + n));
    fakeFolder("notes", [target, ...notes]);
    expect(guessSiblingNotes(target, 2)).toHaveLength(2);
  });

  it("returns nothing when the file has no parent folder", () => {
    expect(guessSiblingNotes(fakeFile("orphan.html"), 2)).toEqual([]);
  });
});

describe("resolveNoteRefs", () => {
  it("reports confirmed backlinks when there are any, and never mixes in guesses", () => {
    const target = fakeFile("notes/diagram.html", 1000);
    const linked = fakeFile("notes/linked.md", 900);
    const unlinked = fakeFile("notes/unlinked.md", 1001);
    fakeFolder("notes", [target, linked, unlinked]);
    const { app } = fakeApp({
      resolvedLinks: { "notes/linked.md": { "notes/diagram.html": 1 } },
      files: [target, linked, unlinked],
    });
    const index = new BacklinkIndex(app);
    index.rebuild();
    const refs = resolveNoteRefs(index, target, 2);
    expect(refs.kind).toBe("resolved");
    expect(refs.notes.map((f) => f.path)).toEqual(["notes/linked.md"]);
  });

  it("falls back to same-folder guesses only when nothing links to the file", () => {
    const target = fakeFile("notes/diagram.html", 1000);
    const sibling = fakeFile("notes/sibling.md", 1001);
    fakeFolder("notes", [target, sibling]);
    const { app } = fakeApp({ files: [target, sibling] });
    const index = new BacklinkIndex(app);
    index.rebuild();
    const refs = resolveNoteRefs(index, target, 2);
    expect(refs.kind).toBe("sibling");
    expect(refs.notes.map((f) => f.path)).toEqual(["notes/sibling.md"]);
  });
});

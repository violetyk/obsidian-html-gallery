import { describe, expect, it } from "vitest";
import { collectLinkCandidates } from "../src/link-suggest-modal";
import { BacklinkIndex } from "../src/backlinks";
import { buildEmbedLink } from "../src/links";
import { fakeApp, fakeFile, fakeFolder } from "./helpers";

describe("buildEmbedLink", () => {
  it("forces the embed prefix on whatever the user's link settings produce", () => {
    const { app } = fakeApp();
    const file = fakeFile("notes/diagram.html");
    expect(buildEmbedLink(app, file, "notes/note.md")).toBe("![[notes/diagram.html|from:notes/note.md]]");
  });

  it("does not double the prefix when the link already embeds", () => {
    const { app } = fakeApp();
    app.fileManager.generateMarkdownLink = (() => "![[already]]") as typeof app.fileManager.generateMarkdownLink;
    expect(buildEmbedLink(app, fakeFile("a.html"), "note.md")).toBe("![[already]]");
  });
});

describe("collectLinkCandidates", () => {
  const note = fakeFile("notes/note.md");
  const inFolder = fakeFile("notes/b.html");
  const alsoInFolder = fakeFile("notes/a.html");
  const elsewhere = fakeFile("other/c.html");
  const files = [inFolder, alsoInFolder, elsewhere];
  // Another note in the vault, used to prove a candidate is linked from somewhere else
  const otherNote = fakeFile("notes/other-note.md");
  fakeFolder("notes", [note, otherNote, inFolder, alsoInFolder]);
  fakeFolder("other", [elsewhere]);

  const collect = (resolvedLinks = {} as Record<string, Record<string, number>>) => {
    const { app } = fakeApp({ resolvedLinks, files: [...files, note, otherNote] });
    const backlinks = new BacklinkIndex(app);
    backlinks.rebuild();
    return collectLinkCandidates(app, note, files, backlinks);
  };

  it("offers only the files in the note's own folder, sorted by name", () => {
    expect(collect().map((c) => c.file.path)).toEqual(["notes/a.html", "notes/b.html"]);
  });

  it("leaves out what the note already links to", () => {
    const linked = { "notes/note.md": { "notes/a.html": 1 } };
    expect(collect(linked).map((c) => c.file.path)).toEqual(["notes/b.html"]);
  });

  it("marks candidates that no note links to, so the picker can flag them", () => {
    const linkedFromElsewhere = { "notes/other-note.md": { "notes/a.html": 1 } };
    const byPath = Object.fromEntries(collect(linkedFromElsewhere).map((c) => [c.file.path, c.orphan]));
    expect(byPath).toEqual({ "notes/a.html": false, "notes/b.html": true });
  });
});

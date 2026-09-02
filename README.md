# HTML Gallery (Obsidian plugin)

[日本語版 README](README.ja.md)

Browse the HTML files in your vault as thumbnails and jump to the notes that reference them.

If you save HTML diagrams next to your notes, you know the problem: you remember the picture, not the file name or the folder. HTML Gallery shows every HTML file as a live thumbnail so you can find it by eye, and puts a button under each one that leads to the notes linking to it.

![Gallery view: HTML files rendered as live thumbnails, with backlink buttons under each card](docs/gallery.png)

## What you get

- Every HTML file in the vault shown as a scaled-down live thumbnail.
- A Backlinks button on each card opens the notes linking to the file in one click. Files nothing links to get "Same folder" candidates instead, and you can turn a candidate into a real link from the same menu.
- Search by file name, title and page text, and sort by date or folder. Sorting by folder groups the cards under folder headings.
- Filter by folder. You can also right-click a folder in the file explorer to narrow the gallery to it.
- Click a card for a full-size view. Scripts run there, so interactive and library-based pages look the way they should.
- Right-click a card to copy an embed link or the path, reveal the file in the explorer, or open it in the default app.
- A command that inserts a link to an HTML file from the current note's folder that the note does not link to yet.
- Keyboard friendly: arrow keys move between cards, Enter opens, `/` jumps to the search box.
- English and Japanese UI.

## Screenshots

The screenshots use the sample content in [`examples/`](examples/). Copy that folder into a vault to try the plugin with the same files.

Each card has a button that lists the notes linking to the file. Files that nothing links to get a dashed "Same folder" button with the closest notes in the same folder instead.

![Backlinks menu listing the two notes that link to data-flow.html](docs/backlinks-menu.png)

Script-rendered pages show a text fallback in the grid, but the enlarged view always runs scripts, so the chart renders as intended.

![Enlarged view of a canvas chart that is drawn by JavaScript](docs/enlarged-view.png)

Search matches file names, titles and body text. Here "queue" narrows nine files down to four.

![Search for "queue" showing 4 of 9 files](docs/search.png)

## Requirements

- Enable "Detect all file extensions" under Settings → Files and links. Without it Obsidian does not treat HTML as vault files and the gallery stays empty
- HTML files must be inside the vault

## Installation (manual)

1. Put `main.js`, `manifest.json` and `styles.css` from a release (or from your own build, see below) into `<vault>/.obsidian/plugins/html-gallery/`
2. Enable HTML Gallery under Settings → Community plugins
3. Open the gallery from the ribbon icon or the command "HTML Gallery: Open gallery"

## Commands

| Command | What it does |
|---|---|
| Open gallery | Opens (or focuses) the gallery view |
| Insert link to an HTML file in this folder | Lists the HTML files in the active note's folder that the note does not link to yet, and inserts an embed link to the one you pick (at the cursor in an editor, otherwise at the end of the note) |

## Settings

| Setting | Default | Description |
|---|---|---|
| Language | Auto | Auto (follow Obsidian), English or 日本語 |
| Run scripts in thumbnails | Off | Runs JavaScript inside thumbnails. Slower with many files |
| Thumbnail size | Medium | Small / Medium / Large. Also switchable from the gallery header |
| Target folder | (whole vault) | Only list HTML under this folder |
| Excluded folders | (none) | One folder per line |
| Include index.html | Off | Show entry pages such as index.html |

## Sample content

[`examples/`](examples/) holds a small set of diagrams and notes that exercise every behaviour: linked and unlinked HTML, a file with two backlinks, two script-rendered pages that fall back to a text thumbnail, and an `index.html` that is hidden by default. Copy the folder anywhere inside a vault to try it.

## Development

TypeScript + esbuild, the same layout as the official Obsidian sample plugin.

```sh
npm install
npm run build   # type-check and emit main.js
npm run dev     # watch mode
npm run lint    # same rules as the community plugin review (eslint-plugin-obsidianmd)
```

Symlink this repository into a vault's plugin folder so every build is picked up by Obsidian:

```sh
ln -s "$(pwd)" "<vault>/.obsidian/plugins/html-gallery"
```

Reload the plugin with the Obsidian CLI (`obsidian plugin:reload id=html-gallery`) or with "Reload app without saving" from the command palette. Errors show up in the developer console (`Cmd+Option+I` / `Ctrl+Shift+I`).

Release steps are in [RELEASING.md](RELEASING.md) (Japanese).

### Source layout

| File | Role |
|---|---|
| `src/main.ts` | Plugin entry: view, command, settings tab, folder context menu |
| `src/view.ts` | Gallery view (header, grid, folder headings, lazy loading, scaling, keyboard navigation, card context menu, vault events, folder filter state) |
| `src/thumbnail.ts` | Thumbnail iframe creation and scaling, resource URL cache |
| `src/indexer.ts` | HTML parsing (title, body text, blank detection) and search index |
| `src/backlinks.ts` | Reverse index of `resolvedLinks` and same-folder guessing |
| `src/note-menu.ts` | Menu listing referenced notes, with "add link" for guessed candidates |
| `src/links.ts` | Building embed links and inserting them into notes |
| `src/link-suggest-modal.ts` | Picker for the "insert link" command |
| `src/files.ts` | Collecting and filtering target HTML files |
| `src/preview-modal.ts` | Enlarged view |
| `src/i18n.ts` | UI strings (English / Japanese) |
| `src/icon.ts` | Custom ribbon / view icon |
| `src/settings.ts`, `src/settings-tab.ts` | Settings model and settings tab |
| `styles.css` | Styles. Uses Obsidian CSS variables so it follows the theme |

### Implementation notes

- Thumbnails load the real file in an `<iframe>` with a fixed 1280px virtual viewport and scale it down with CSS, so responsive pages keep their desktop layout. Only cards near the viewport are loaded
- Scripts are off inside thumbnails by default. Pages whose body text is nearly empty (script-rendered) get a text preview built from `<title>` and body text instead of a blank card
- Never combine `allow-scripts` and `allow-same-origin` in one `sandbox` attribute. Thumbnails default to `allow-same-origin`; thumbnails with scripts enabled and the enlarged view use `allow-scripts`
- Use `vault.adapter.getResourcePath()` for iframe `src`. Do not build `file://` URLs by hand
- Never assign file content to `innerHTML`. Titles and text are extracted with `DOMParser`
- Do not call `detachLeavesOfType` in `onunload`

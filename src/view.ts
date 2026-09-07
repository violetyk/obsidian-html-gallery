import {
  debounce,
  ItemView,
  Menu,
  Platform,
  setIcon,
  TAbstractFile,
  TFile,
  ViewStateResult,
  WorkspaceLeaf,
} from "obsidian";
import { NoteRefs, resolveNoteRefs } from "./backlinks";
import { LAZY_ROOT_MARGIN, RETIRED_CARD_TIMEOUT_MS, SIBLING_NOTE_LIMIT, VIEW_TYPE } from "./constants";
import { collectGalleryFiles, isTargetGalleryFile, isUnderFolder } from "./files";
import { formatDate } from "./format";
import { t } from "./i18n";
import { ICON_ID } from "./icon";
import { cardSignature, GalleryEntry, matchesQuery } from "./indexer";
import { ALL_KINDS, ArtifactKind, ENABLED_KEY_BY_KIND, kindOf } from "./kinds";
import { buildEmbedLink, copyText } from "./links";
import type HtmlGalleryPlugin from "./main";
import { addNoteItems, showNoteMenu } from "./note-menu";
import { GalleryPreviewModal } from "./preview-modal";
import { SortOrder, ThumbnailSize } from "./settings";
import { loadShot, renderShot, ShotContext, ShotLoad } from "./shot";
import { applyThumbnailScale } from "./thumbnail";

interface GalleryViewState {
  folder?: string;
}

/** A rendered card and what it was rendered from */
interface GalleryCard {
  el: HTMLElement;
  file: TFile;
  folder: string;
  /** Inputs that require rebuilding the card when they change */
  signature: string;
}

/** Not in the official typings: the file explorer view can reveal a file, and desktop can open one externally */
type FileExplorerLike = { revealInFolder?: (file: TFile) => void };
type AppWithDefaultApp = { openWithDefaultApp?: (path: string) => void };

const SIZES: ThumbnailSize[] = ["small", "medium", "large"];

/*
 * The header toggles are labelled, not iconised: no icon reliably means "SVG" or "PDF", and a
 * guessed glyph is worse than three letters.
 */

export class HtmlGalleryView extends ItemView {
  plugin: HtmlGalleryPlugin;

  private headerEl: HTMLElement | null = null;
  private gridEl: HTMLElement | null = null;
  private countEl: HTMLElement | null = null;
  private folderSelectEl: HTMLSelectElement | null = null;
  private folderClearEl: HTMLElement | null = null;
  private sortButtons = new Map<SortOrder, HTMLElement>();
  private sizeButtons = new Map<ThumbnailSize, HTMLElement>();

  private lazyObserver: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private rescaleQueued = false;
  /**
   * Cards currently in the grid, keyed by file path. Cards are reused across renders and are never
   * moved in the DOM: removing or re-inserting an iframe cancels its in-flight app:// requests, and
   * Obsidian's main process crashes when such a request arrives after its frame is gone
   * ("Cannot read properties of undefined (reading 'origin')"). Order comes from the CSS `order`
   * property, and search / folder filters only toggle visibility
   */
  private cards = new Map<string, GalleryCard>();
  /** In-flight shot loads that can be abandoned, by file path */
  private shotLoads = new Map<string, ShotLoad>();
  /** Show only files no note links to */
  private unreferencedOnly = false;
  private unreferencedButtonEl: HTMLElement | null = null;
  private kindButtons = new Map<ArtifactKind, HTMLElement>();
  private emptyEl: HTMLElement | null = null;

  private get index() {
    return this.plugin.index;
  }
  private get backlinks() {
    return this.plugin.backlinks;
  }
  private get resourcePaths() {
    return this.plugin.resourcePaths;
  }
  private indexReady = false;
  /** Guards against an older reindex finishing after a newer one and reporting stale state */
  private indexGeneration = 0;

  private query = "";
  private keyboardBound = false;
  /** Folder filter (empty means all). Saved as view state, so it survives layout restore */
  private folderFilter = "";

  /** Re-render when HTML files are added, removed or modified (coalesces bursts of events) */
  private scheduleRender = debounce(() => this.render(), 400, true);
  /** When notes change, refresh only the reference buttons without recreating iframes */
  scheduleNoteRefresh = debounce(() => this.refreshNoteRefs(), 400, true);

  constructor(leaf: WorkspaceLeaf, plugin: HtmlGalleryPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return t("plugin.name");
  }

  getIcon(): string {
    return ICON_ID;
  }

  getState(): Record<string, unknown> {
    return { folder: this.folderFilter };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const s = (state ?? {}) as GalleryViewState;
    this.folderFilter = typeof s.folder === "string" ? s.folder : "";
    this.syncFolderControls();
    this.render();
    await super.setState(state, result);
  }

  async onOpen(): Promise<void> {
    this.buildUi();

    this.registerEvent(this.app.vault.on("create", (file) => this.onVaultChange(file)));
    this.registerEvent(this.app.vault.on("modify", (file) => this.onVaultChange(file)));
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        this.index.remove(file.path);
        this.resourcePaths.invalidate(file.path);
        this.onVaultRemove(file);
      }),
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.index.remove(oldPath);
        this.resourcePaths.invalidate(oldPath);
        this.onVaultChange(file);
      }),
    );

    await this.reindexAndRender();
  }

  onClose(): Promise<void> {
    // Abandon in-flight loads before the observers go, so nothing outlives the view
    for (const load of this.shotLoads.values()) load.cancel();
    this.shotLoads.clear();
    this.lazyObserver?.disconnect();
    this.lazyObserver = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    return Promise.resolve();
  }

  onResize(): void {
    this.queueRescale();
  }

  /** Called from main when settings change. Rebuilds the header too (for language switching) */
  async refresh(): Promise<void> {
    this.buildUi();
    await this.reindexAndRender();
  }

  /** Called from the folder context menu or commands */
  setFolderFilter(folder: string): void {
    this.folderFilter = folder.replace(/^\/+/, "").replace(/\/+$/, "");
    if (this.folderFilter === "/") this.folderFilter = "";
    this.syncFolderControls();
    this.render();
    this.app.workspace.requestSaveLayout();
  }

  // ----- UI skeleton -----

  private buildUi(): void {
    const root = this.contentEl;
    root.addClass("html-gallery");
    if (!this.keyboardBound) {
      this.registerDomEvent(root, "keydown", (evt) => this.onKeyDown(evt));
      this.keyboardBound = true;
    }

    // The header is rebuilt on every call (language switching). The grid is created once and kept,
    // because moving or recreating its iframes would cancel their in-flight requests
    this.headerEl?.remove();
    this.headerEl = root.createDiv({ cls: "html-gallery-header" });
    root.prepend(this.headerEl);
    this.renderHeader(this.headerEl);

    if (!this.gridEl) {
      this.gridEl = root.createDiv({ cls: "html-gallery-grid" });
      this.emptyEl = this.gridEl.createDiv({ cls: "html-gallery-empty is-hidden" });
      this.lazyObserver = new IntersectionObserver((entries) => this.onIntersect(entries), {
        root: null,
        rootMargin: LAZY_ROOT_MARGIN,
      });
      this.resizeObserver = new ResizeObserver(() => this.queueRescale());
      this.resizeObserver.observe(this.gridEl);
    }
    this.applySizeClass();
  }

  // ----- Index -----

  /**
   * Reindex everything, drawing twice: once immediately so the cards and the "indexing" note appear
   * without waiting, and again when the index is ready so titles and page counts fill in.
   * Reindexing is what takes real time after a file-type toggle, since PDFs are read then
   */
  private async reindexAndRender(): Promise<void> {
    const generation = ++this.indexGeneration;
    this.indexReady = false;
    this.render();
    await this.index.build(collectGalleryFiles(this.app, this.plugin.settings));
    // A newer reindex started while this one was reading files; let that one finish the job.
    // Its own build() replaces the entry map, so anything this one wrote is either reused or dropped
    if (generation !== this.indexGeneration) return;
    this.indexReady = true;
    this.render();
  }

  /**
   * A deleted file cannot be read any more, so it is only dropped from the view. Routing it through
   * onVaultChange would try to reindex it and log a read failure for a file that is simply gone
   */
  private onVaultRemove(file: TAbstractFile): void {
    this.syncFolderOptions();
    this.scheduleRender();
    if (file instanceof TFile && file.extension === "md") this.scheduleNoteRefresh();
  }

  private onVaultChange(file: TAbstractFile): void {
    if (file instanceof TFile && isTargetGalleryFile(file, this.plugin.settings)) {
      this.resourcePaths.invalidate(file.path);
      void this.index.update(file).then(() => {
        this.syncFolderOptions();
        this.scheduleRender();
      });
      return;
    }
    if (file instanceof TFile && file.extension === "md") {
      // Same-folder guesses may change, so refresh only the reference buttons
      this.scheduleNoteRefresh();
    }
  }

  // ----- Header -----

  private renderHeader(header: HTMLElement): void {
    this.sortButtons.clear();
    this.sizeButtons.clear();

    const search = header.createEl("input", {
      cls: "html-gallery-search",
      type: "search",
      placeholder: t("header.searchPlaceholder"),
    });
    search.value = this.query;
    search.addEventListener("input", () => {
      this.query = search.value;
      this.applyFilter();
    });

    // Folder filter
    const folderWrap = header.createDiv({ cls: "html-gallery-folder" });
    setIcon(folderWrap.createSpan({ cls: "html-gallery-button-icon" }), "folder");
    this.folderSelectEl = folderWrap.createEl("select", {
      cls: "dropdown html-gallery-folder-select",
      attr: { "aria-label": t("header.folder.label") },
    });
    this.folderSelectEl.addEventListener("change", () => {
      this.setFolderFilter(this.folderSelectEl?.value ?? "");
    });
    this.folderClearEl = folderWrap.createEl("button", {
      cls: "html-gallery-icon-button html-gallery-folder-clear",
      attr: { "aria-label": t("header.folder.clear"), title: t("header.folder.clear") },
    });
    setIcon(this.folderClearEl, "x");
    this.folderClearEl.addEventListener("click", () => this.setFolderFilter(""));
    this.syncFolderOptions();

    // Sort order
    const sortGroup = header.createDiv({ cls: "html-gallery-button-group" });
    this.addSortButton(sortGroup, "mtime", "clock", t("header.sort.mtime"));
    this.addSortButton(sortGroup, "path", "folder-tree", t("header.sort.path"));
    this.updateSortButtons();

    // File types
    const kindGroup = header.createDiv({
      cls: "html-gallery-button-group html-gallery-kind-group",
      attr: { "aria-label": t("header.kinds.hint"), title: t("header.kinds.hint") },
    });
    this.kindButtons.clear();
    for (const kind of ALL_KINDS) {
      this.addKindButton(kindGroup, kind);
    }
    this.updateKindButtons();

    // Unreferenced filter
    const btn = header.createEl("button", {
      cls: "html-gallery-toggle-button html-gallery-unreferenced-button",
      attr: { "aria-label": t("header.unreferenced.hint"), title: t("header.unreferenced.hint") },
    });
    setIcon(btn.createSpan({ cls: "html-gallery-button-icon" }), "unlink");
    btn.createSpan({ text: t("header.unreferenced") });
    btn.addEventListener("click", () => {
      this.unreferencedOnly = !this.unreferencedOnly;
      this.updateUnreferencedButton();
      this.applyFilter();
    });
    this.unreferencedButtonEl = btn;
    this.updateUnreferencedButton();

    // Thumbnail size
    const sizeGroup = header.createDiv({
      cls: "html-gallery-button-group html-gallery-size-group",
      attr: { "aria-label": t("header.size.label"), title: t("header.size.label") },
    });
    for (const size of SIZES) {
      this.addSizeButton(sizeGroup, size);
    }
    this.updateSizeButtons();

    this.countEl = header.createDiv({ cls: "html-gallery-count" });
  }

  /** One button per file type. Writes the same settings the settings tab writes, so they persist */
  private addKindButton(parent: HTMLElement, kind: ArtifactKind): void {
    const hint = t(`settings.${ENABLED_KEY_BY_KIND[kind]}` as const);
    const btn = parent.createEl("button", {
      cls: `html-gallery-toggle-button html-gallery-kind-button is-kind-${kind}`,
      text: t(`header.kind.${kind}` as const),
      attr: { "aria-label": hint, title: hint },
    });
    btn.addEventListener("click", () => void this.toggleKind(kind));
    this.kindButtons.set(kind, btn);
  }

  private updateKindButtons(): void {
    for (const [kind, btn] of this.kindButtons) {
      btn.toggleClass("is-active", this.plugin.settings[ENABLED_KEY_BY_KIND[kind]]);
    }
  }

  private async toggleKind(kind: ArtifactKind): Promise<void> {
    const key = ENABLED_KEY_BY_KIND[kind];
    this.plugin.settings[key] = !this.plugin.settings[key];
    await this.plugin.saveSettings();
    // Every open gallery shares these settings, so let them all reindex and redraw
    this.plugin.refreshViews();
  }

  private updateUnreferencedButton(): void {
    this.unreferencedButtonEl?.toggleClass("is-active", this.unreferencedOnly);
  }

  private addSortButton(parent: HTMLElement, order: SortOrder, icon: string, label: string): void {
    const btn = parent.createEl("button", { cls: "html-gallery-toggle-button", attr: { "aria-label": label } });
    setIcon(btn.createSpan({ cls: "html-gallery-button-icon" }), icon);
    btn.createSpan({ text: label });
    btn.addEventListener("click", () => {
      this.plugin.settings.sortOrder = order;
      void this.plugin.saveSettings();
      this.updateSortButtons();
      this.render();
    });
    this.sortButtons.set(order, btn);
  }

  private updateSortButtons(): void {
    for (const [order, btn] of this.sortButtons) {
      btn.toggleClass("is-active", order === this.plugin.settings.sortOrder);
    }
  }

  private addSizeButton(parent: HTMLElement, size: ThumbnailSize): void {
    const label = t(`header.size.${size}` as const);
    const btn = parent.createEl("button", {
      cls: `html-gallery-toggle-button html-gallery-size-button is-${size}`,
      text: label,
      attr: { "aria-label": `${t("header.size.label")}: ${t(`settings.size.${size}` as const)}` },
    });
    btn.addEventListener("click", () => {
      this.plugin.settings.thumbnailSize = size;
      void this.plugin.saveSettings();
      this.updateSizeButtons();
      this.applySizeClass();
      this.queueRescale();
    });
    this.sizeButtons.set(size, btn);
  }

  private updateSizeButtons(): void {
    for (const [size, btn] of this.sizeButtons) {
      btn.toggleClass("is-active", size === this.plugin.settings.thumbnailSize);
    }
  }

  private applySizeClass(): void {
    const grid = this.gridEl;
    if (!grid) return;
    grid.removeClass("is-size-small", "is-size-medium", "is-size-large");
    grid.addClass(`is-size-${this.plugin.settings.thumbnailSize}`);
  }

  /** Offer every folder that contains HTML, plus its ancestors */
  private syncFolderOptions(): void {
    const select = this.folderSelectEl;
    if (!select) return;
    const folders = new Set<string>();
    for (const file of collectGalleryFiles(this.app, this.plugin.settings)) {
      let path = file.parent?.path ?? "";
      while (path && path !== "/") {
        folders.add(path);
        const idx = path.lastIndexOf("/");
        path = idx >= 0 ? path.slice(0, idx) : "";
      }
    }
    // Keep the current filter selectable even if its files are gone
    if (this.folderFilter) folders.add(this.folderFilter);

    const sorted = [...folders].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    select.empty();
    select.createEl("option", { value: "", text: t("header.folder.all") });
    for (const folder of sorted) {
      const depth = folder.split("/").length - 1;
      const name = folder.slice(folder.lastIndexOf("/") + 1);
      select.createEl("option", {
        value: folder,
        text: `${"  ".repeat(depth)}${name}`,
        attr: { title: folder },
      });
    }
    this.syncFolderControls();
  }

  private syncFolderControls(): void {
    if (this.folderSelectEl) this.folderSelectEl.value = this.folderFilter;
    this.folderClearEl?.toggleClass("is-hidden", this.folderFilter === "");
    this.headerEl?.toggleClass("has-folder-filter", this.folderFilter !== "");
  }

  // ----- Grid -----

  private sortedFiles(): TFile[] {
    const files = collectGalleryFiles(this.app, this.plugin.settings);
    if (this.plugin.settings.sortOrder === "path") {
      files.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    } else {
      files.sort((a, b) => b.stat.mtime - a.stat.mtime);
    }
    return files;
  }

  /**
   * Sync the grid with the vault: create cards for new or changed files, drop cards for removed ones,
   * assign display order and group headings, then apply the filters. Unchanged cards stay untouched
   */
  render(): void {
    const grid = this.gridEl;
    if (!grid) return;

    const files = this.sortedFiles();
    const scripts = this.plugin.settings.thumbnailScripts;
    const wanted = new Map<
      string,
      { file: TFile; kind: ArtifactKind; entry: GalleryEntry | undefined; signature: string }
    >();
    for (const file of files) {
      const kind = kindOf(file);
      if (kind === null) continue;
      const entry = this.index.get(file);
      wanted.set(file.path, { file, kind, entry, signature: cardSignature(file, kind, entry, scripts) });
    }

    // Remove cards whose file is gone or whose inputs changed
    for (const [path, card] of this.cards) {
      if (wanted.get(path)?.signature === card.signature) continue;
      this.disposeCard(card);
      this.cards.delete(path);
    }

    // Headings are cheap; rebuild them every time
    grid.querySelectorAll(".html-gallery-group-heading").forEach((el) => el.remove());

    const groupByFolder = this.plugin.settings.sortOrder === "path";
    let currentFolder: string | null = null;
    let order = 0;
    for (const { file, kind, entry } of wanted.values()) {
      const folder = file.parent?.path ?? "";
      if (groupByFolder && folder !== currentFolder) {
        currentFolder = folder;
        const heading = grid.createDiv({ cls: "html-gallery-group-heading" });
        heading.dataset.folder = folder;
        heading.style.order = String(order++);
        setIcon(heading.createSpan({ cls: "html-gallery-button-icon" }), "folder");
        heading.createSpan({ text: folder === "" || folder === "/" ? "/" : folder });
      }
      let card = this.cards.get(file.path);
      if (!card) {
        card = {
          el: this.renderCard(grid, file, kind, entry),
          file,
          folder,
          signature: wanted.get(file.path)?.signature ?? "",
        };
        this.cards.set(file.path, card);
      } else {
        this.updateCardText(card.el, card.file, entry);
      }
      card.el.style.order = String(order++);
    }

    this.applyFilter();
  }

  /**
   * Remove a card. An iframe that is still loading is hidden instead and removed once it has
   * finished (or after a timeout): detaching it mid-load cancels its app:// requests, and Obsidian's
   * main process throws when such a request has no frame any more
   */
  private disposeCard(card: GalleryCard): void {
    this.shotLoads.get(card.file.path)?.cancel();
    this.shotLoads.delete(card.file.path);
    const shot = card.el.querySelector<HTMLElement>(".html-gallery-shot");
    if (shot) this.lazyObserver?.unobserve(shot);
    const iframe = card.el.querySelector<HTMLIFrameElement>("iframe.html-gallery-iframe");
    const loading = iframe !== null && iframe.hasAttribute("src") && !shot?.hasClass("is-loaded");
    if (!loading) {
      card.el.remove();
      return;
    }
    card.el.addClass("is-hidden");
    card.el.removeAttribute("tabindex");
    const remove = () => card.el.remove();
    iframe.addEventListener("load", remove, { once: true });
    this.contentEl.win.setTimeout(remove, RETIRED_CARD_TIMEOUT_MS);
  }

  /** The index may finish after the card was created: refresh the texts that depend on it */
  private updateCardText(el: HTMLElement, file: TFile, entry: GalleryEntry | undefined): void {
    const title = entry?.title ?? file.basename;
    el.setAttribute("title", this.cardTooltip(file, entry));
    const placeholder = el.querySelector<HTMLElement>(".html-gallery-shot-placeholder");
    if (placeholder && placeholder.textContent !== title) placeholder.setText(title);

    // Page count and the scanned-PDF warning only become known once the file has been indexed
    const note = el.querySelector<HTMLElement>(".html-gallery-note");
    if (!note) return;
    const parts: string[] = [];
    if (entry?.pageCount !== undefined) parts.push(t("card.pages", { n: entry.pageCount }));
    if (entry?.hasNoText) parts.push(t("card.noText"));
    const text = parts.join(" · ");
    if (note.textContent !== text) note.setText(text);
    note.toggleClass("is-warning", entry?.hasNoText === true);
    note.setAttribute("title", entry?.hasNoText ? t("card.noTextHint") : "");
  }

  private cardTooltip(file: TFile, entry: GalleryEntry | undefined): string {
    const modified = formatDate(file.stat.mtime, true);
    return [entry?.title ?? file.basename, file.path, `${t("card.modified")}: ${modified}`].join("\n");
  }

  /** Show only the cards matching the folder filter and the search query. Never touches iframes */
  private applyFilter(): void {
    const grid = this.gridEl;
    if (!grid) return;

    const query = this.query.trim();
    let total = 0;
    let shown = 0;
    const visibleFolders = new Set<string>();
    for (const card of this.cards.values()) {
      const inFolder = isUnderFolder(card.file.path, this.folderFilter);
      if (inFolder) total++;
      const entry = this.index.get(card.file);
      const matches =
        !query ||
        (entry ? matchesQuery(entry, query) : card.file.path.toLowerCase().includes(query.toLowerCase()));
      // "Unreferenced" means no note links to it; same-folder guesses do not count
      const referenced = this.backlinks.getSources(card.file).length > 0;
      const visible = inFolder && matches && (!this.unreferencedOnly || !referenced);
      if (visible) {
        shown++;
        visibleFolders.add(card.folder);
      }
      card.el.toggleClass("is-hidden", !visible);
    }
    let firstHeading = true;
    grid.querySelectorAll<HTMLElement>(".html-gallery-group-heading").forEach((heading) => {
      const visible = visibleFolders.has(heading.dataset.folder ?? "");
      heading.toggleClass("is-hidden", !visible);
      heading.toggleClass("is-first", visible && firstHeading);
      if (visible) firstHeading = false;
    });

    if (this.countEl) {
      const base =
        shown === total
          ? t("header.count", { n: total })
          : t("header.countFiltered", { n: shown, total });
      this.countEl.setText(this.indexReady ? base : `${base} ${t("header.indexing")}`);
    }

    if (this.emptyEl) {
      this.emptyEl.toggleClass("is-hidden", shown > 0);
      if (shown === 0) this.emptyEl.setText(this.cards.size === 0 ? t("grid.empty") : t("grid.noMatch"));
    }
    this.queueRescale();
  }

  private renderCard(
    parent: HTMLElement,
    file: TFile,
    kind: ArtifactKind,
    entry: GalleryEntry | undefined,
  ): HTMLElement {
    const card = parent.createDiv({
      cls: "html-gallery-card",
      attr: { tabindex: "0", role: "button", title: this.cardTooltip(file, entry) },
    });
    card.dataset.path = file.path;
    // Exposed so CSS snippets can style one kind of card
    card.dataset.kind = kind;
    // Cards live across many renders, so resolve the index entry and references at interaction time
    const current = () => this.index.get(file);
    const refs = () => resolveNoteRefs(this.backlinks, file, SIBLING_NOTE_LIMIT);
    const open = () => this.openArtifact(file, kind, current(), refs());
    card.addEventListener("click", open);
    card.addEventListener("contextmenu", (evt) => {
      evt.preventDefault();
      this.showCardMenu(evt, file, kind, current(), refs());
    });
    card.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        open();
      }
    });

    const shot = card.createDiv({ cls: "html-gallery-shot" });
    shot.dataset.path = file.path;
    if (renderShot(shot, file, kind, entry, this.shotContext())) {
      this.lazyObserver?.observe(shot);
    }

    const meta = card.createDiv({ cls: "html-gallery-meta" });
    const nameRow = meta.createDiv({ cls: "html-gallery-name-row" });
    nameRow.createDiv({ cls: "html-gallery-name", text: file.basename });
    this.renderRefsButton(nameRow, file, refs());
    const pathRow = meta.createDiv({ cls: "html-gallery-path-row" });
    pathRow.createSpan({ cls: "html-gallery-path", text: file.parent?.path ?? "" });
    pathRow.createSpan({ cls: "html-gallery-note" });
    pathRow.createSpan({ cls: "html-gallery-date", text: formatDate(file.stat.mtime, false) });
    this.updateCardText(card, file, entry);
    return card;
  }

  /** Right-click menu on a card: open, jump to notes, copy link or path, reveal, open externally */
  private showCardMenu(
    evt: MouseEvent,
    file: TFile,
    kind: ArtifactKind,
    entry: GalleryEntry | undefined,
    refs: NoteRefs,
  ): void {
    const menu = new Menu();
    if (kind === "pdf") {
      menu.addItem((item) =>
        item
          .setTitle(t("menu.openInObsidian"))
          .setIcon("file-text")
          .setSection("html-gallery-main")
          .onClick(() => void this.openInWorkspace(file, "tab")),
      );
    } else {
      menu.addItem((item) =>
        item
          .setTitle(t("menu.openEnlarged"))
          .setIcon("maximize-2")
          .setSection("html-gallery-main")
          .onClick(() => this.openPreview(file, kind, entry, refs)),
      );
    }
    addNoteItems(menu, this.app, { file, refs, onOpen: (note) => void this.openInWorkspace(note) });
    menu.addItem((item) =>
      item
        .setTitle(t("menu.copyEmbed"))
        .setIcon("clipboard-copy")
        .setSection("html-gallery-file")
        .onClick(() => {
          const source = this.app.workspace.getActiveFile()?.path ?? "";
          void copyText(buildEmbedLink(this.app, file, source));
        }),
    );
    menu.addItem((item) =>
      item
        .setTitle(t("menu.copyPath"))
        .setIcon("copy")
        .setSection("html-gallery-file")
        .onClick(() => void copyText(file.path)),
    );
    menu.addItem((item) =>
      item
        .setTitle(t("menu.revealInExplorer"))
        .setIcon("folder-open")
        .setSection("html-gallery-file")
        .onClick(() => this.revealInExplorer(file)),
    );
    if (Platform.isDesktopApp) {
      menu.addItem((item) =>
        item
          .setTitle(t("menu.openDefaultApp"))
          .setIcon("external-link")
          .setSection("html-gallery-file")
          .onClick(() => (this.app as unknown as AppWithDefaultApp).openWithDefaultApp?.(file.path)),
      );
    }
    menu.showAtMouseEvent(evt);
  }

  private revealInExplorer(file: TFile): void {
    const leaf = this.app.workspace.getLeavesOfType("file-explorer")[0];
    if (!leaf) return;
    void this.app.workspace.revealLeaf(leaf);
    (leaf.view as unknown as FileExplorerLike).revealInFolder?.(file);
  }

  // ----- Keyboard -----

  /** Arrow keys move between cards, "/" or Mod+F focuses the search box, Escape in the search box clears it */
  private onKeyDown(evt: KeyboardEvent): void {
    const target = evt.target as HTMLElement;
    const search = this.headerEl?.querySelector<HTMLInputElement>(".html-gallery-search");

    if (target === search) {
      if (evt.key === "Escape" && search) {
        evt.preventDefault();
        if (search.value) {
          search.value = "";
          this.query = "";
          this.applyFilter();
        } else {
          this.focusCard(0);
        }
      }
      return;
    }

    if (evt.key === "/" || ((evt.metaKey || evt.ctrlKey) && evt.key.toLowerCase() === "f")) {
      if (search) {
        evt.preventDefault();
        search.focus();
        search.select();
      }
      return;
    }

    const card = target.closest<HTMLElement>(".html-gallery-card");
    if (!card || !this.gridEl) return;
    const cards = this.visibleCards();
    const idx = cards.indexOf(card);
    if (idx < 0) return;
    const cols = this.columnCount(cards);

    let next = -1;
    switch (evt.key) {
      case "ArrowRight":
        next = Math.min(idx + 1, cards.length - 1);
        break;
      case "ArrowLeft":
        next = Math.max(idx - 1, 0);
        break;
      case "ArrowDown":
        next = Math.min(idx + cols, cards.length - 1);
        break;
      case "ArrowUp":
        next = Math.max(idx - cols, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = cards.length - 1;
        break;
      default:
        return;
    }
    evt.preventDefault();
    this.focusCard(next, cards);
  }

  /** Visible cards in display order (DOM order is insertion order, so sort by the CSS order) */
  private visibleCards(): HTMLElement[] {
    return [...this.cards.values()]
      .map((c) => c.el)
      .filter((el) => !el.hasClass("is-hidden"))
      .sort((a, b) => Number(a.style.order) - Number(b.style.order));
  }

  private focusCard(index: number, cards?: HTMLElement[]): void {
    const list = cards ?? this.visibleCards();
    const el = list[index];
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest" });
  }

  /** Number of grid columns, derived from how many cards share the first row */
  private columnCount(cards: HTMLElement[]): number {
    if (cards.length === 0) return 1;
    const top = cards[0].offsetTop;
    let cols = 0;
    for (const c of cards) {
      if (c.offsetTop !== top) break;
      cols++;
    }
    return Math.max(cols, 1);
  }

  /** PDFs go to Obsidian's own viewer (search, zoom, page navigation); everything else to the modal */
  private openArtifact(file: TFile, kind: ArtifactKind, entry: GalleryEntry | undefined, refs: NoteRefs): void {
    if (kind === "pdf") {
      // A new tab, so the gallery stays where it was instead of being replaced by the viewer
      void this.openInWorkspace(file, "tab");
      return;
    }
    this.openPreview(file, kind, entry, refs);
  }

  private openPreview(file: TFile, kind: ArtifactKind, entry: GalleryEntry | undefined, refs: NoteRefs): void {
    new GalleryPreviewModal(this.app, {
      file,
      kind,
      title: entry?.title ?? file.basename,
      resourceUrl: this.resourcePaths.get(file),
      refs,
      onOpenNote: (note) => void this.openInWorkspace(note),
    }).open();
  }

  /**
   * Button for backlinks (confirmed) or same-folder candidates (guessed).
   * Opens a menu listing the notes; picking one opens it. Confirmed and guessed look different
   */
  private renderRefsButton(parent: HTMLElement, file: TFile, refs: NoteRefs): void {
    if (refs.notes.length === 0) {
      parent.createSpan({ cls: "html-gallery-refs-none", text: t("refs.none") });
      return;
    }
    const isResolved = refs.kind === "resolved";
    const btn = parent.createEl("button", {
      cls: `html-gallery-refs-button is-${refs.kind}`,
      attr: { title: isResolved ? t("refs.backlinkHint") : t("refs.siblingHint") },
    });
    setIcon(btn.createSpan({ cls: "html-gallery-button-icon" }), isResolved ? "link" : "folder");
    btn.createSpan({ text: isResolved ? t("refs.backlinks") : t("refs.siblings") });
    btn.createSpan({ cls: "html-gallery-refs-count", text: String(refs.notes.length) });
    btn.addEventListener("click", (evt) => {
      evt.stopPropagation();
      showNoteMenu(this.app, { file, refs, onOpen: (note) => void this.openInWorkspace(note) }, evt);
    });
    btn.addEventListener("keydown", (evt) => evt.stopPropagation());
  }

  /** Replace the reference button on every card without recreating iframes */
  private refreshNoteRefs(): void {
    const grid = this.gridEl;
    if (!grid) return;
    grid.querySelectorAll<HTMLElement>(".html-gallery-card").forEach((card) => {
      const path = card.dataset.path;
      const file = path ? this.app.vault.getFileByPath(path) : null;
      const row = card.querySelector<HTMLElement>(".html-gallery-name-row");
      if (!file || !row) return;
      row.querySelector(".html-gallery-refs-button, .html-gallery-refs-none")?.remove();
      this.renderRefsButton(row, file, resolveNoteRefs(this.backlinks, file, SIBLING_NOTE_LIMIT));
    });
  }

  async openInWorkspace(file: TFile, where: "tab" | "current" = "current"): Promise<void> {
    await this.app.workspace.getLeaf(where === "tab" ? "tab" : false).openFile(file);
  }

  // ----- Lazy loading and scaling -----

  private onIntersect(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const shot = entry.target as HTMLElement;
      const cancellable = shot.hasClass("is-kind-pdf");
      if (entry.isIntersecting) {
        // Loaded and failed are both terminal: stop watching rather than retry on every scroll
        if (shot.hasClass("is-loaded") || shot.hasClass("is-error")) {
          this.lazyObserver?.unobserve(shot);
          continue;
        }
        // Kinds that load once and keep their result never need watching again
        if (!cancellable) this.lazyObserver?.unobserve(shot);
        if (shot.dataset.loading !== "1") {
          shot.dataset.loading = "1";
          this.loadThumbnail(shot);
        }
        continue;
      }
      // Left the viewport before it finished: give up the pdf.js document rather than hold a worker
      if (cancellable && !shot.hasClass("is-loaded") && !shot.hasClass("is-error")) {
        this.cancelShotLoad(shot);
      }
    }
  }

  private cancelShotLoad(shot: HTMLElement): void {
    const path = shot.dataset.path;
    if (!path) return;
    this.shotLoads.get(path)?.cancel();
    this.shotLoads.delete(path);
    delete shot.dataset.loading;
  }

  private loadThumbnail(shot: HTMLElement): void {
    const path = shot.dataset.path;
    if (!path) return;
    const file = this.app.vault.getFileByPath(path);
    if (!file) return;
    const kind = kindOf(file);
    if (kind === null) return;
    const load = loadShot(shot, file, kind, this.shotContext());
    if (!load) return;
    this.shotLoads.set(path, load);
    // Drop the handle once the work is over, so the map holds only what is still cancellable
    const forget = () => {
      if (this.shotLoads.get(path) === load) this.shotLoads.delete(path);
    };
    load.done.then(forget, forget);
  }

  private shotContext(): ShotContext {
    return { app: this.app, settings: this.plugin.settings, resourcePaths: this.resourcePaths };
  }

  /** Rescale every card after a requestAnimationFrame (otherwise clientWidth may still be 0) */
  private queueRescale(): void {
    if (this.rescaleQueued) return;
    this.rescaleQueued = true;
    // Use the window that owns this view so popout windows work too
    this.contentEl.win.requestAnimationFrame(() => {
      this.rescaleQueued = false;
      const grid = this.gridEl;
      if (!grid) return;
      grid.querySelectorAll<HTMLElement>(".html-gallery-shot").forEach((shot) => applyThumbnailScale(shot));
    });
  }
}

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
import { BacklinkIndex, NoteRefs, resolveNoteRefs } from "./backlinks";
import { LAZY_ROOT_MARGIN, SIBLING_NOTE_LIMIT, VIEW_TYPE } from "./constants";
import { collectHtmlFiles, isTargetHtmlFile, isUnderFolder } from "./files";
import { t } from "./i18n";
import { ICON_ID } from "./icon";
import { HtmlEntry, HtmlIndex, matchesQuery } from "./indexer";
import { buildEmbedLink, copyText } from "./links";
import type HtmlGalleryPlugin from "./main";
import { addNoteItems, showNoteMenu } from "./note-menu";
import { HtmlPreviewModal } from "./preview-modal";
import { SortOrder, ThumbnailSize } from "./settings";
import { applyThumbnailScale, createThumbnailIframe, ResourcePathCache } from "./thumbnail";

interface GalleryViewState {
  folder?: string;
}

/** Not in the official typings: the file explorer view can reveal a file, and desktop can open one externally */
type FileExplorerLike = { revealInFolder?: (file: TFile) => void };
type AppWithDefaultApp = { openWithDefaultApp?: (path: string) => void };

const SIZES: ThumbnailSize[] = ["small", "medium", "large"];

/** Local date as YYYY-MM-DD, optionally with HH:mm */
function formatDate(timestamp: number, withTime: boolean): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

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

  private resourcePaths: ResourcePathCache;
  private backlinks: BacklinkIndex;
  private index: HtmlIndex;
  private indexReady = false;

  private query = "";
  private keyboardBound = false;
  /** Folder filter (empty means all). Saved as view state, so it survives layout restore */
  private folderFilter = "";

  /** Re-render when HTML files are added, removed or modified (coalesces bursts of events) */
  private scheduleRender = debounce(() => this.render(), 400, true);
  /** When notes change, refresh only the reference buttons without recreating iframes */
  private scheduleNoteRefresh = debounce(() => this.refreshNoteRefs(), 400, true);

  constructor(leaf: WorkspaceLeaf, plugin: HtmlGalleryPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.resourcePaths = new ResourcePathCache(this.app);
    this.backlinks = new BacklinkIndex(this.app);
    this.index = new HtmlIndex(this.app);
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

    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        this.backlinks.rebuild();
        this.scheduleNoteRefresh();
      }),
    );
    this.registerEvent(this.app.vault.on("create", (file) => this.onVaultChange(file)));
    this.registerEvent(this.app.vault.on("modify", (file) => this.onVaultChange(file)));
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        this.index.remove(file.path);
        this.resourcePaths.invalidate(file.path);
        this.onVaultChange(file);
      }),
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.index.remove(oldPath);
        this.resourcePaths.invalidate(oldPath);
        this.onVaultChange(file);
      }),
    );

    this.backlinks.rebuild();
    this.render();
    await this.rebuildIndex();
    this.render();
  }

  onClose(): Promise<void> {
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
    await this.rebuildIndex();
    this.render();
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
    root.empty();
    root.addClass("html-gallery");
    if (!this.keyboardBound) {
      this.registerDomEvent(root, "keydown", (evt) => this.onKeyDown(evt));
      this.keyboardBound = true;
    }

    this.headerEl = root.createDiv({ cls: "html-gallery-header" });
    this.renderHeader(this.headerEl);

    this.gridEl = root.createDiv({ cls: "html-gallery-grid" });
    this.applySizeClass();

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.queueRescale());
    this.resizeObserver.observe(this.gridEl);
  }

  // ----- Index -----

  private async rebuildIndex(): Promise<void> {
    await this.index.build(collectHtmlFiles(this.app, this.plugin.settings));
    this.indexReady = true;
  }

  private onVaultChange(file: TAbstractFile): void {
    if (file instanceof TFile && isTargetHtmlFile(file, this.plugin.settings)) {
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
      this.render();
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
    for (const file of collectHtmlFiles(this.app, this.plugin.settings)) {
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
    const files = collectHtmlFiles(this.app, this.plugin.settings).filter((f) =>
      isUnderFolder(f.path, this.folderFilter),
    );
    if (this.plugin.settings.sortOrder === "path") {
      files.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    } else {
      files.sort((a, b) => b.stat.mtime - a.stat.mtime);
    }
    return files;
  }

  render(): void {
    const grid = this.gridEl;
    if (!grid) return;

    // Dispose the old observer before creating a new one (avoids leaks)
    this.lazyObserver?.disconnect();
    this.lazyObserver = new IntersectionObserver((entries) => this.onIntersect(entries), {
      root: null,
      rootMargin: LAZY_ROOT_MARGIN,
    });

    grid.empty();

    const all = this.sortedFiles();
    const query = this.query.trim();
    const files = query
      ? all.filter((f) => {
          const entry = this.index.get(f);
          return entry ? matchesQuery(entry, query) : f.path.toLowerCase().includes(query.toLowerCase());
        })
      : all;

    if (this.countEl) {
      const base = query
        ? t("header.countFiltered", { n: files.length, total: all.length })
        : t("header.count", { n: all.length });
      this.countEl.setText(this.indexReady ? base : `${base} ${t("header.indexing")}`);
    }

    if (files.length === 0) {
      const total = collectHtmlFiles(this.app, this.plugin.settings).length;
      grid.createDiv({ cls: "html-gallery-empty", text: total === 0 ? t("grid.empty") : t("grid.noMatch") });
      return;
    }
    const groupByFolder = this.plugin.settings.sortOrder === "path";
    let currentFolder: string | null = null;
    for (const file of files) {
      const folder = file.parent?.path ?? "";
      if (groupByFolder && folder !== currentFolder) {
        currentFolder = folder;
        const heading = grid.createDiv({ cls: "html-gallery-group-heading" });
        setIcon(heading.createSpan({ cls: "html-gallery-button-icon" }), "folder");
        heading.createSpan({ text: folder === "" || folder === "/" ? "/" : folder });
      }
      this.renderCard(grid, file, this.index.get(file));
    }
    this.queueRescale();
  }

  private renderCard(parent: HTMLElement, file: TFile, entry: HtmlEntry | undefined): void {
    const modified = formatDate(file.stat.mtime, true);
    const tooltip = [entry?.title ?? file.basename, file.path, `${t("card.modified")}: ${modified}`].join("\n");
    const card = parent.createDiv({
      cls: "html-gallery-card",
      attr: { tabindex: "0", role: "button", title: tooltip },
    });
    card.dataset.path = file.path;
    const refs = resolveNoteRefs(this.backlinks, file, SIBLING_NOTE_LIMIT);
    const open = () => this.openPreview(file, entry, refs);
    card.addEventListener("click", open);
    card.addEventListener("contextmenu", (evt) => {
      evt.preventDefault();
      this.showCardMenu(evt, file, entry, refs);
    });
    card.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        open();
      }
    });

    const shot = card.createDiv({ cls: "html-gallery-shot" });
    shot.dataset.path = file.path;
    if (entry?.isEmpty && !this.plugin.settings.thumbnailScripts) {
      // Script-rendered HTML would be blank with scripts disabled, so show a text preview instead
      this.renderFallbackShot(shot, entry);
    } else {
      shot.createDiv({ cls: "html-gallery-shot-placeholder", text: entry?.title ?? file.basename });
      createThumbnailIframe(shot, this.plugin.settings.thumbnailScripts);
      this.lazyObserver?.observe(shot);
    }

    const meta = card.createDiv({ cls: "html-gallery-meta" });
    const nameRow = meta.createDiv({ cls: "html-gallery-name-row" });
    nameRow.createDiv({ cls: "html-gallery-name", text: file.basename });
    this.renderRefsButton(nameRow, file, refs);
    const pathRow = meta.createDiv({ cls: "html-gallery-path-row" });
    pathRow.createSpan({ cls: "html-gallery-path", text: file.parent?.path ?? "" });
    pathRow.createSpan({ cls: "html-gallery-date", text: formatDate(file.stat.mtime, false) });
  }

  /** Right-click menu on a card: open, jump to notes, copy link or path, reveal, open externally */
  private showCardMenu(evt: MouseEvent, file: TFile, entry: HtmlEntry | undefined, refs: NoteRefs): void {
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle(t("menu.openEnlarged"))
        .setIcon("maximize-2")
        .setSection("html-gallery-main")
        .onClick(() => this.openPreview(file, entry, refs)),
    );
    addNoteItems(menu, this.app, { file, refs, onOpen: (note) => void this.openNote(note) });
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
          this.render();
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
    const cards = Array.from(this.gridEl.querySelectorAll<HTMLElement>(".html-gallery-card"));
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

  private focusCard(index: number, cards?: HTMLElement[]): void {
    const list = cards ?? Array.from(this.gridEl?.querySelectorAll<HTMLElement>(".html-gallery-card") ?? []);
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

  private openPreview(file: TFile, entry: HtmlEntry | undefined, refs: NoteRefs): void {
    new HtmlPreviewModal(this.app, {
      file,
      title: entry?.title ?? file.basename,
      resourceUrl: this.resourcePaths.get(file),
      refs,
      onOpenNote: (note) => void this.openNote(note),
    }).open();
  }

  private renderFallbackShot(shot: HTMLElement, entry: HtmlEntry): void {
    shot.addClass("is-fallback");
    const box = shot.createDiv({ cls: "html-gallery-fallback" });
    box.createDiv({ cls: "html-gallery-fallback-badge", text: t("fallback.badge") });
    box.createDiv({ cls: "html-gallery-fallback-title", text: entry.title });
    if (entry.excerpt) {
      box.createDiv({ cls: "html-gallery-fallback-excerpt", text: entry.excerpt });
    }
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
      showNoteMenu(this.app, { file, refs, onOpen: (note) => void this.openNote(note) }, evt);
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

  async openNote(note: TFile): Promise<void> {
    await this.app.workspace.getLeaf(false).openFile(note);
  }

  // ----- Lazy loading and scaling -----

  private onIntersect(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const shot = entry.target as HTMLElement;
      this.lazyObserver?.unobserve(shot);
      this.loadThumbnail(shot);
    }
  }

  private loadThumbnail(shot: HTMLElement): void {
    const path = shot.dataset.path;
    if (!path) return;
    const file = this.app.vault.getFileByPath(path);
    const iframe = shot.querySelector<HTMLIFrameElement>("iframe.html-gallery-iframe");
    if (!file || !iframe) return;
    applyThumbnailScale(shot);
    iframe.addEventListener("load", () => shot.addClass("is-loaded"), { once: true });
    iframe.src = this.resourcePaths.get(file);
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

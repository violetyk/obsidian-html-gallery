import { Notice, Plugin, TFolder } from "obsidian";
import { BacklinkIndex } from "./backlinks";
import { VIEW_TYPE } from "./constants";
import { collectGalleryFiles } from "./files";
import { setLang, t } from "./i18n";
import { ICON_ID, registerIcon } from "./icon";
import { GalleryIndex } from "./indexer";
import { collectLinkCandidates, LinkSuggestModal } from "./link-suggest-modal";
import { insertEmbedIntoActiveNote } from "./links";
import { DEFAULT_SETTINGS, HtmlGallerySettings } from "./settings";
import { HtmlGallerySettingTab } from "./settings-tab";
import { ResourcePathCache } from "./thumbnail";
import { HtmlGalleryView } from "./view";

export default class HtmlGalleryPlugin extends Plugin {
  settings: HtmlGallerySettings = { ...DEFAULT_SETTINGS };
  /*
   * State shared by every gallery view. Held per view it would be built again whenever a tab is
   * reopened: PDFs re-read, resolvedLinks re-walked, resource paths re-resolved.
   */
  readonly index = new GalleryIndex(this.app);
  readonly backlinks = new BacklinkIndex(this.app);
  readonly resourcePaths = new ResourcePathCache(this.app);
  private ribbonEl: HTMLElement | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    setLang(this.settings.language);
    registerIcon();

    this.registerView(VIEW_TYPE, (leaf) => new HtmlGalleryView(leaf, this));
    this.addSettingTab(new HtmlGallerySettingTab(this.app, this));

    this.ribbonEl = this.addRibbonIcon(ICON_ID, t("ribbon.open"), () => {
      void this.activateView();
    });
    this.registerCommands();

    // Walking resolvedLinks is the one piece of upkeep that costs the same whether one gallery is
    // open or five, so it happens here once instead of in every view
    this.backlinks.rebuild();
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        this.backlinks.rebuild();
        this.forEachView((view) => view.scheduleNoteRefresh());
      }),
    );

    // Context menu entry when right-clicking a folder in the file explorer
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFolder)) return;
        menu.addItem((item) =>
          item
            .setTitle(t("menu.filterFolder"))
            .setIcon(ICON_ID)
            .onClick(() => void this.activateView(file.path)),
        );
      }),
    );
  }

  onunload(): void {
    // Do not call detachLeavesOfType: it breaks the user's layout and is discouraged by the official guidelines
  }

  private registerCommands(): void {
    this.addCommand({
      id: "open-gallery",
      name: t("command.open"),
      callback: () => void this.activateView(),
    });
    this.addCommand({
      id: "link-html-into-note",
      name: t("command.linkIntoNote"),
      callback: () => this.linkFileIntoActiveNote(),
    });
  }

  /** Pick a gallery file from the active note's folder that the note does not link to yet, and insert an embed link */
  private linkFileIntoActiveNote(): void {
    const note = this.app.workspace.getActiveFile();
    if (!note || note.extension !== "md") {
      new Notice(t("notice.noActiveNote"));
      return;
    }
    // The shared index is kept current by the metadataCache listener, so no rebuild here
    const candidates = collectLinkCandidates(
      this.app,
      note,
      collectGalleryFiles(this.app, this.settings),
      this.backlinks,
    );
    if (candidates.length === 0) {
      new Notice(t("notice.noCandidates"));
      return;
    }
    new LinkSuggestModal(this.app, candidates, (file) => {
      void insertEmbedIntoActiveNote(this.app, note, file);
    }).open();
  }

  /** Apply a language change to command names and the ribbon tooltip as well */
  applyLanguage(): void {
    setLang(this.settings.language);
    this.registerCommands();
    this.ribbonEl?.setAttribute("aria-label", t("ribbon.open"));
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<HtmlGallerySettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(loaded ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Propagate settings changes to every open gallery view */
  refreshViews(): void {
    this.forEachView((view) => void view.refresh());
  }

  private forEachView(fn: (view: HtmlGalleryView) => void): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof HtmlGalleryView) fn(leaf.view);
    }
  }

  /** Open the gallery. When folder is given, filter to that folder */
  async activateView(folder?: string): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE);
    let leaf = existing[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await workspace.revealLeaf(leaf);
    if (folder !== undefined && leaf.view instanceof HtmlGalleryView) {
      leaf.view.setFolderFilter(folder);
    }
  }
}

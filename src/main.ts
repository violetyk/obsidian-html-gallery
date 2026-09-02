import { Notice, Plugin, TFolder } from "obsidian";
import { BacklinkIndex } from "./backlinks";
import { VIEW_TYPE } from "./constants";
import { collectHtmlFiles } from "./files";
import { setLang, t } from "./i18n";
import { ICON_ID, registerIcon } from "./icon";
import { collectLinkCandidates, LinkHtmlSuggestModal } from "./link-suggest-modal";
import { insertEmbedIntoActiveNote } from "./links";
import { DEFAULT_SETTINGS, HtmlGallerySettings } from "./settings";
import { HtmlGallerySettingTab } from "./settings-tab";
import { HtmlGalleryView } from "./view";

export default class HtmlGalleryPlugin extends Plugin {
  settings: HtmlGallerySettings = { ...DEFAULT_SETTINGS };
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
      callback: () => this.linkHtmlIntoActiveNote(),
    });
  }

  /** Pick an HTML file from the active note's folder that the note does not link to yet, and insert an embed link */
  private linkHtmlIntoActiveNote(): void {
    const note = this.app.workspace.getActiveFile();
    if (!note || note.extension !== "md") {
      new Notice(t("notice.noActiveNote"));
      return;
    }
    const backlinks = new BacklinkIndex(this.app);
    backlinks.rebuild();
    const candidates = collectLinkCandidates(this.app, note, collectHtmlFiles(this.app, this.settings), backlinks);
    if (candidates.length === 0) {
      new Notice(t("notice.noCandidates"));
      return;
    }
    new LinkHtmlSuggestModal(this.app, candidates, (file) => {
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
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof HtmlGalleryView) void leaf.view.refresh();
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

import { App, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import { t } from "./i18n";
import type HtmlGalleryPlugin from "./main";
import { HtmlGallerySettings } from "./settings";

type SettingKey = keyof HtmlGallerySettings;

/** Obsidian 1.13+ renders the tab from these definitions; the tab is re-rendered through update() */
type Updatable = { update?: () => void };

export class HtmlGallerySettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: HtmlGalleryPlugin,
  ) {
    super(app, plugin);
  }

  // ----- Declarative settings (Obsidian 1.13 and later) -----

  getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
    return [
      {
        name: t("settings.language"),
        desc: t("settings.language.desc"),
        control: {
          type: "dropdown",
          key: "language",
          options: {
            auto: t("settings.language.auto"),
            en: t("settings.language.en"),
            ja: t("settings.language.ja"),
          },
        },
      },
      {
        name: t("settings.thumbnailScripts"),
        desc: t("settings.thumbnailScripts.desc"),
        control: { type: "toggle", key: "thumbnailScripts" },
      },
      {
        name: t("settings.thumbnailSize"),
        desc: t("settings.thumbnailSize.desc"),
        control: {
          type: "dropdown",
          key: "thumbnailSize",
          options: {
            small: t("settings.size.small"),
            medium: t("settings.size.medium"),
            large: t("settings.size.large"),
          },
        },
      },
      {
        name: t("settings.targetFolder"),
        desc: t("settings.targetFolder.desc"),
        control: { type: "text", key: "targetFolder", placeholder: t("settings.targetFolder.placeholder") },
      },
      {
        name: t("settings.excludeFolders"),
        desc: t("settings.excludeFolders.desc"),
        control: {
          type: "textarea",
          key: "excludeFolders",
          placeholder: t("settings.excludeFolders.placeholder"),
          rows: 4,
        },
      },
      {
        name: t("settings.includeIndex"),
        desc: t("settings.includeIndex.desc"),
        control: { type: "toggle", key: "includeIndexHtml" },
      },
    ];
  }

  getControlValue(key: string): unknown {
    return this.plugin.settings[key as SettingKey];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    await this.applyChange(key as SettingKey, value);
    if (key === "language") {
      // Labels come from the language, so rebuild the definitions
      (this as Updatable).update?.();
    }
  }

  /** Persist one setting and push the change to the open gallery views */
  private async applyChange(key: SettingKey, value: unknown): Promise<void> {
    const settings = this.plugin.settings as unknown as Record<string, unknown>;
    settings[key] = value;
    await this.plugin.saveSettings();
    if (key === "language") this.plugin.applyLanguage();
    this.plugin.refreshViews();
  }

  // ----- Imperative fallback for Obsidian versions older than 1.13 -----

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName(t("settings.language"))
      .setDesc(t("settings.language.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            auto: t("settings.language.auto"),
            en: t("settings.language.en"),
            ja: t("settings.language.ja"),
          })
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            await this.applyChange("language", value);
            this.display();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.thumbnailScripts"))
      .setDesc(t("settings.thumbnailScripts.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.thumbnailScripts)
          .onChange((value) => this.applyChange("thumbnailScripts", value)),
      );

    new Setting(containerEl)
      .setName(t("settings.thumbnailSize"))
      .setDesc(t("settings.thumbnailSize.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            small: t("settings.size.small"),
            medium: t("settings.size.medium"),
            large: t("settings.size.large"),
          })
          .setValue(this.plugin.settings.thumbnailSize)
          .onChange((value) => this.applyChange("thumbnailSize", value)),
      );

    new Setting(containerEl)
      .setName(t("settings.targetFolder"))
      .setDesc(t("settings.targetFolder.desc"))
      .addText((text) =>
        text
          .setPlaceholder(t("settings.targetFolder.placeholder"))
          .setValue(this.plugin.settings.targetFolder)
          .onChange((value) => this.applyChange("targetFolder", value)),
      );

    new Setting(containerEl)
      .setName(t("settings.excludeFolders"))
      .setDesc(t("settings.excludeFolders.desc"))
      .addTextArea((text) => {
        text
          .setPlaceholder(t("settings.excludeFolders.placeholder"))
          .setValue(this.plugin.settings.excludeFolders)
          .onChange((value) => this.applyChange("excludeFolders", value));
        text.inputEl.rows = 4;
        text.inputEl.addClass("html-gallery-settings-textarea");
      });

    new Setting(containerEl)
      .setName(t("settings.includeIndex"))
      .setDesc(t("settings.includeIndex.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeIndexHtml)
          .onChange((value) => this.applyChange("includeIndexHtml", value)),
      );
  }
}

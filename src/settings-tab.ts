import { App, PluginSettingTab, Setting } from "obsidian";
import { LangSetting, t } from "./i18n";
import type HtmlGalleryPlugin from "./main";
import { ThumbnailSize } from "./settings";

export class HtmlGallerySettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: HtmlGalleryPlugin,
  ) {
    super(app, plugin);
  }

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
            this.plugin.settings.language = value as LangSetting;
            await this.plugin.saveSettings();
            this.plugin.applyLanguage();
            this.plugin.refreshViews();
            this.display();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.thumbnailScripts"))
      .setDesc(t("settings.thumbnailScripts.desc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.thumbnailScripts).onChange(async (value) => {
          this.plugin.settings.thumbnailScripts = value;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }),
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
          .onChange(async (value) => {
            this.plugin.settings.thumbnailSize = value as ThumbnailSize;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.targetFolder"))
      .setDesc(t("settings.targetFolder.desc"))
      .addText((text) =>
        text
          .setPlaceholder(t("settings.targetFolder.placeholder"))
          .setValue(this.plugin.settings.targetFolder)
          .onChange(async (value) => {
            this.plugin.settings.targetFolder = value;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.excludeFolders"))
      .setDesc(t("settings.excludeFolders.desc"))
      .addTextArea((text) => {
        text
          .setPlaceholder(t("settings.excludeFolders.placeholder"))
          .setValue(this.plugin.settings.excludeFolders)
          .onChange(async (value) => {
            this.plugin.settings.excludeFolders = value;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          });
        text.inputEl.rows = 4;
        text.inputEl.addClass("html-gallery-settings-textarea");
      });

    new Setting(containerEl)
      .setName(t("settings.includeIndex"))
      .setDesc(t("settings.includeIndex.desc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeIndexHtml).onChange(async (value) => {
          this.plugin.settings.includeIndexHtml = value;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }),
      );
  }
}

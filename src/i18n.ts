import { moment } from "obsidian";

export type Lang = "en" | "ja";
export type LangSetting = "auto" | Lang;

const en = {
  "plugin.name": "HTML Gallery",
  "ribbon.open": "Open HTML Gallery",
  "command.open": "Open gallery",
  "menu.filterFolder": "HTML Gallery: show only this folder",

  "header.searchPlaceholder": "Search (space-separated terms are ANDed)",
  "header.sort.mtime": "Recent",
  "header.sort.path": "Folder",
  "header.size.small": "S",
  "header.size.medium": "M",
  "header.size.large": "L",
  "header.size.label": "Thumbnail size",
  "header.folder.all": "All folders",
  "header.folder.label": "Filter by folder",
  "header.folder.clear": "Clear folder filter",
  "header.count": "{n} files",
  "header.countFiltered": "{n} / {total} files",
  "header.indexing": "(indexing...)",

  "grid.empty": "No HTML files found",
  "grid.noMatch": "No HTML files match the filter",

  "refs.backlinks": "Backlinks",
  "refs.siblings": "Same folder",
  "refs.none": "No references",
  "refs.siblingHint": "Guessed from notes in the same folder (no link found)",
  "refs.backlinkHint": "Notes that link to this file",

  "fallback.badge": "Script-rendered",

  "modal.openDefaultApp": "Open in default app",
  "modal.backlinks": "Backlinks ({n})",
  "modal.siblings": "Same folder ({n})",

  "settings.language": "Language",
  "settings.language.desc": "Language of the plugin UI.",
  "settings.language.auto": "Auto (follow Obsidian)",
  "settings.language.en": "English",
  "settings.language.ja": "日本語",
  "settings.thumbnailScripts": "Run scripts in thumbnails",
  "settings.thumbnailScripts.desc":
    "When on, JavaScript runs inside thumbnails so script-rendered HTML shows as is. Slower with many files. The enlarged view always runs scripts regardless of this setting.",
  "settings.thumbnailSize": "Thumbnail size",
  "settings.thumbnailSize.desc": "Minimum card width. Can also be changed from the gallery header.",
  "settings.size.small": "Small",
  "settings.size.medium": "Medium",
  "settings.size.large": "Large",
  "settings.targetFolder": "Target folder",
  "settings.targetFolder.desc": "Only HTML files under this folder are listed. Leave empty for the whole vault.",
  "settings.targetFolder.placeholder": "e.g. tasks",
  "settings.excludeFolders": "Excluded folders",
  "settings.excludeFolders.desc": "Folders to hide from the gallery, one per line.",
  "settings.excludeFolders.placeholder": "e.g.\ntemplates\narchive/old",
  "settings.includeIndex": "Include index.html",
  "settings.includeIndex.desc":
    "index.html / index.htm are usually entry pages to other pages, so they are hidden by default.",

  "menu.addLinkTo": "Add link to {note}",
  "menu.openEnlarged": "Open enlarged view",
  "menu.copyEmbed": "Copy embed link",
  "menu.copyPath": "Copy path",
  "menu.revealInExplorer": "Reveal in file explorer",
  "menu.openDefaultApp": "Open in default app",

  "card.modified": "Modified",

  "command.linkIntoNote": "Insert link to an HTML file in this folder",
  "linkModal.placeholder": "HTML files in this folder that this note does not link to yet",
  "linkModal.navigate": "navigate",
  "linkModal.insert": "insert link",
  "linkModal.dismiss": "dismiss",
  "linkModal.noBacklinks": "no backlinks",
  "notice.linkAdded": "Added a link to {note}",
  "notice.copied": "Copied to clipboard",
  "notice.noActiveNote": "Open a Markdown note first",
  "notice.noCandidates": "Every HTML file in this folder is already linked from this note",
} as const;

export type I18nKey = keyof typeof en;

const ja: Record<I18nKey, string> = {
  "plugin.name": "HTML Gallery",
  "ribbon.open": "HTML Gallery を開く",
  "command.open": "ギャラリーを開く",
  "menu.filterFolder": "HTML Gallery: このフォルダで絞り込む",

  "header.searchPlaceholder": "検索（スペース区切りで AND）",
  "header.sort.mtime": "更新順",
  "header.sort.path": "フォルダ順",
  "header.size.small": "小",
  "header.size.medium": "中",
  "header.size.large": "大",
  "header.size.label": "サムネイルのサイズ",
  "header.folder.all": "すべてのフォルダ",
  "header.folder.label": "フォルダで絞り込む",
  "header.folder.clear": "フォルダの絞り込みを解除",
  "header.count": "{n} 件",
  "header.countFiltered": "{n} / {total} 件",
  "header.indexing": "（索引作成中）",

  "grid.empty": "HTML ファイルが見つかりません",
  "grid.noMatch": "条件に一致する HTML はありません",

  "refs.backlinks": "バックリンク",
  "refs.siblings": "同フォルダ",
  "refs.none": "参照なし",
  "refs.siblingHint": "リンクが見つからないため、同じフォルダのノートから推測",
  "refs.backlinkHint": "このファイルにリンクしているノート",

  "fallback.badge": "スクリプト描画",

  "modal.openDefaultApp": "既定のアプリで開く",
  "modal.backlinks": "バックリンク（{n}）",
  "modal.siblings": "同フォルダ（{n}）",

  "settings.language": "言語",
  "settings.language.desc": "プラグイン UI の表示言語。",
  "settings.language.auto": "自動（Obsidian の設定に従う）",
  "settings.language.en": "English",
  "settings.language.ja": "日本語",
  "settings.thumbnailScripts": "サムネイル内のスクリプトを有効にする",
  "settings.thumbnailScripts.desc":
    "オンにすると一覧のサムネイルでも JavaScript を実行し、JS で描画する HTML もそのまま表示されます。件数が多いと重くなります。拡大表示では設定に関係なく常に有効です。",
  "settings.thumbnailSize": "サムネイルのサイズ",
  "settings.thumbnailSize.desc": "カードの最小幅を変えます。ギャラリーのヘッダーからも切り替えられます。",
  "settings.size.small": "小",
  "settings.size.medium": "中",
  "settings.size.large": "大",
  "settings.targetFolder": "対象フォルダ",
  "settings.targetFolder.desc": "このフォルダ配下の HTML だけを一覧します。空なら保管庫全体が対象です。",
  "settings.targetFolder.placeholder": "例: tasks",
  "settings.excludeFolders": "除外フォルダ",
  "settings.excludeFolders.desc": "一覧から除くフォルダを改行区切りで指定します。",
  "settings.excludeFolders.placeholder": "例:\ntemplates\narchive/old",
  "settings.includeIndex": "index.html を一覧に含める",
  "settings.includeIndex.desc": "index.html / index.htm は他ページへの入口であることが多いため、既定では除いています。",

  "menu.addLinkTo": "{note} にリンクを追加",
  "menu.openEnlarged": "拡大表示を開く",
  "menu.copyEmbed": "埋め込みリンクをコピー",
  "menu.copyPath": "パスをコピー",
  "menu.revealInExplorer": "ファイルエクスプローラーで表示",
  "menu.openDefaultApp": "既定のアプリで開く",

  "card.modified": "更新",

  "command.linkIntoNote": "このフォルダの HTML へのリンクを挿入",
  "linkModal.placeholder": "このノートからまだリンクしていない、同じフォルダの HTML",
  "linkModal.navigate": "移動",
  "linkModal.insert": "リンクを挿入",
  "linkModal.dismiss": "閉じる",
  "linkModal.noBacklinks": "バックリンクなし",
  "notice.linkAdded": "{note} にリンクを追加しました",
  "notice.copied": "クリップボードにコピーしました",
  "notice.noActiveNote": "先に Markdown ノートを開いてください",
  "notice.noCandidates": "このフォルダの HTML はすべてこのノートからリンク済みです",
};

const dictionaries: Record<Lang, Record<I18nKey, string>> = { en, ja };

let current: Lang = "en";

/** Detect from Obsidian's own language (the moment locale) */
export function detectLang(): Lang {
  const locale = (moment.locale() || "").toLowerCase();
  return locale.startsWith("ja") ? "ja" : "en";
}

export function setLang(setting: LangSetting): void {
  current = setting === "auto" ? detectLang() : setting;
}

export function getLang(): Lang {
  return current;
}

/** Return the translated string, replacing placeholders such as {n} from vars */
export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  let text = dictionaries[current][key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return text;
}

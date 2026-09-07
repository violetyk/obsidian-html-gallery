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
  "header.kinds.hint": "Choose which file types the gallery lists",
  "header.kind.html": "HTML",
  "header.kind.svg": "SVG",
  "header.kind.image": "IMG",
  "header.kind.pdf": "PDF",
  "header.unreferenced": "Unreferenced",
  "header.unreferenced.hint": "Show only files that no note links to",

  "grid.empty": "No files found",
  "grid.noMatch": "No files match the filter",

  "refs.backlinks": "Backlinks",
  "refs.siblings": "Same folder",
  "refs.none": "No references",
  "refs.siblingHint": "Guessed from notes in the same folder (no link found)",
  "refs.backlinkHint": "Notes that link to this file",

  "fallback.badge": "Script-rendered",

  "modal.openDefaultApp": "Open in default app",
  "modal.backlinks": "Backlinks ({n})",
  "modal.siblings": "Same folder ({n})",

  "settings.fileTypes": "File types",
  "settings.includeHtml": "Show HTML files",
  "settings.includeHtml.desc": "List .html and .htm files.",
  "settings.includeSvg": "Show SVG files",
  "settings.includeSvg.desc":
    "List .svg files. Their <title>, <desc> and text are searchable. SVGs are shown as images, so scripts inside them never run.",
  "settings.includeImages": "Show raster images",
  "settings.includeImages.desc":
    "List .png, .jpg, .gif, .webp, .avif and .bmp files. They carry no text, so they are only found by file name and by the notes that link them. A vault full of pasted screenshots will crowd out everything else.",
  "settings.includePdf": "Show PDF files",
  "settings.includePdf.desc":
    "List .pdf files, with the first page as the thumbnail. Text is extracted from the first few pages for search, so scanned PDFs without a text layer are only found by file name. Clicking a card opens Obsidian's PDF viewer.",
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
  "settings.targetFolder.desc": "Only files under this folder are listed. Leave empty for the whole vault.",
  "settings.targetFolder.placeholder": "e.g. tasks",
  "settings.excludeFolders": "Excluded folders",
  "settings.excludeFolders.desc": "Folders to hide from the gallery, one per line.",
  "settings.excludeFolders.placeholder": "e.g.\ntemplates\narchive/old",
  "settings.includeIndex": "Include index.html",
  "settings.includeIndex.desc":
    "index.html / index.htm are usually entry pages to other pages, so they are hidden by default.",

  "menu.addLinkTo": "Add link to {note}",
  "menu.openEnlarged": "Open enlarged view",
  "menu.openInNewTab": "Open in a new tab",
  "menu.copyEmbed": "Copy embed link",
  "menu.copyPath": "Copy path",
  "menu.revealInExplorer": "Reveal in file explorer",
  "menu.openDefaultApp": "Open in default app",

  "card.modified": "Modified",
  "card.pages": "{n} pages",
  "card.noText": "no text",
  "card.noTextHint":
    "No text layer, so this file can only be found by name. Scanned PDFs need OCR, which this plugin does not do.",

  "command.linkIntoNote": "Insert link to a file in this folder",
  "linkModal.placeholder": "Files in this folder that this note does not link to yet",
  "linkModal.navigate": "navigate",
  "linkModal.insert": "insert link",
  "linkModal.dismiss": "dismiss",
  "linkModal.noBacklinks": "no backlinks",
  "notice.linkAdded": "Added a link to {note}",
  "notice.copied": "Copied to clipboard",
  "notice.noActiveNote": "Open a Markdown note first",
  "notice.noCandidates": "Every file in this folder is already linked from this note",
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
  "header.kinds.hint": "一覧に出すファイル形式を選ぶ",
  "header.kind.html": "HTML",
  "header.kind.svg": "SVG",
  "header.kind.image": "画像",
  "header.kind.pdf": "PDF",
  "header.unreferenced": "未参照",
  "header.unreferenced.hint": "どのノートからも参照されていないファイルだけを表示",

  "grid.empty": "ファイルが見つかりません",
  "grid.noMatch": "条件に一致するファイルはありません",

  "refs.backlinks": "バックリンク",
  "refs.siblings": "同フォルダ",
  "refs.none": "参照なし",
  "refs.siblingHint": "リンクが見つからないため、同じフォルダのノートから推測",
  "refs.backlinkHint": "このファイルにリンクしているノート",

  "fallback.badge": "スクリプト描画",

  "modal.openDefaultApp": "既定のアプリで開く",
  "modal.backlinks": "バックリンク（{n}）",
  "modal.siblings": "同フォルダ（{n}）",

  "settings.fileTypes": "対象のファイル形式",
  "settings.includeHtml": "HTML を表示",
  "settings.includeHtml.desc": ".html と .htm を一覧に出します。",
  "settings.includeSvg": "SVG を表示",
  "settings.includeSvg.desc":
    ".svg を一覧に出します。<title> / <desc> / テキスト要素が検索対象になります。画像として表示するので、SVG 内のスクリプトは実行されません。",
  "settings.includeImages": "画像（PNG / JPEG など）を表示",
  "settings.includeImages.desc":
    ".png / .jpg / .gif / .webp / .avif / .bmp を一覧に出します。テキストを持たないため、ファイル名と参照ノートからしか探せません。ノートに貼った画像が多い保管庫では、成果物が埋もれます。",
  "settings.includePdf": "PDF を表示",
  "settings.includePdf.desc":
    ".pdf を一覧に出し、1ページ目をサムネイルにします。検索用に先頭数ページからテキストを抽出するため、テキスト層のないスキャンPDFはファイル名でしか探せません。カードをクリックすると Obsidian の PDF ビューアで開きます。",
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
  "settings.targetFolder.desc": "このフォルダ配下のファイルだけを一覧します。空なら保管庫全体が対象です。",
  "settings.targetFolder.placeholder": "例: tasks",
  "settings.excludeFolders": "除外フォルダ",
  "settings.excludeFolders.desc": "一覧から除くフォルダを改行区切りで指定します。",
  "settings.excludeFolders.placeholder": "例:\ntemplates\narchive/old",
  "settings.includeIndex": "index.html を一覧に含める",
  "settings.includeIndex.desc": "index.html / index.htm は他ページへの入口であることが多いため、既定では除いています。",

  "menu.addLinkTo": "{note} にリンクを追加",
  "menu.openEnlarged": "拡大表示を開く",
  "menu.openInNewTab": "新しいタブで開く",
  "menu.copyEmbed": "埋め込みリンクをコピー",
  "menu.copyPath": "パスをコピー",
  "menu.revealInExplorer": "ファイルエクスプローラーで表示",
  "menu.openDefaultApp": "既定のアプリで開く",

  "card.modified": "更新",
  "card.pages": "{n}ページ",
  "card.noText": "テキストなし",
  "card.noTextHint":
    "テキスト層が無いため、ファイル名でしか検索できません。スキャンPDFには OCR が必要ですが、このプラグインでは行いません。",

  "command.linkIntoNote": "このフォルダのファイルへのリンクを挿入",
  "linkModal.placeholder": "このノートからまだリンクしていない、同じフォルダのファイル",
  "linkModal.navigate": "移動",
  "linkModal.insert": "リンクを挿入",
  "linkModal.dismiss": "閉じる",
  "linkModal.noBacklinks": "バックリンクなし",
  "notice.linkAdded": "{note} にリンクを追加しました",
  "notice.copied": "クリップボードにコピーしました",
  "notice.noActiveNote": "先に Markdown ノートを開いてください",
  "notice.noCandidates": "このフォルダのファイルはすべてこのノートからリンク済みです",
};

const dictionaries: Record<Lang, Record<I18nKey, string>> = { en, ja };

let current: Lang = "en";

/** Detect from Obsidian's own language: it sets the lang attribute on the document root */
export function detectLang(): Lang {
  const locale = (document.documentElement.lang || navigator.language || "").toLowerCase();
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

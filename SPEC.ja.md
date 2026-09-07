# HTML Gallery — Obsidian プラグイン仕様

保管庫内の HTML ファイルをサムネイルの格子で一覧し、絵で見つけて、その図解が生まれた会話ノートに戻るためのプラグイン。

- プラグインID: `html-gallery`（設置先 `<vault>/.obsidian/plugins/html-gallery/`）
- 表示名: `HTML Gallery`
- 成果物: `main.js` / `manifest.json` / `styles.css` の3ファイル
- TypeScript + esbuild で書く（Obsidian 公式サンプルと同じ構成）。`npm run build` で `main.js` を生成する

## 背景と目的

利用者は AI との対話ログを Markdown で保管庫に置いている。Markdown では理解しづらい内容を HTML の図解として生成させ、同じ保管庫に保存している。この図解が後から探せない。「こういう絵を見た」という視覚的な記憶はあるが、どのフォルダに入れたかを憶えていない。

したがってこのプラグインが解くべきことは2つ。

1. 図解を**絵として**一覧し、視覚的な記憶から見つけられるようにする
2. 見つけた図解から、**それが生まれた会話ノートへ戻れる**ようにする

2つ目は1つ目と同じくらい重要。単なる画像ギャラリーではない。

## 動作環境の前提

- HTML は保管庫の中にある（保管庫外は対象外。実装しない）
- 図解は1枚の HTML に生の JS を埋め込んだ自己完結型が中心。外部ライブラリを使うものも一部ある
- 利用者は Obsidian の設定で「すべてのファイル形式を表示」を有効にしている必要がある。README に明記すること

## 機能要件

### 1. ギャラリービュー

- `ItemView` を継承した独自ビュー。ビュータイプ文字列は `html-gallery-view`
- リボンアイコン（`layout-grid` などの既存 lucide アイコン）とコマンドパレット（`HTML Gallery: ギャラリーを開く`）の両方から開ける
- 保管庫内の `.html` / `.htm` を再帰的に収集して格子状に並べる
- `index.html` / `index.htm` は他ページへの入口であることが多いので、既定では一覧から除く（設定で変更可）

### 2. サムネイル

- 実ファイルを `<iframe>` で読み込み、CSS の `transform: scale()` で縮小して表示する。**スクリーンショット画像は生成しない**
- iframe は仮想ビューポート幅 1280px 固定（高さはその 0.72 倍程度）。枠の実寸に合わせて小さくするとレスポンシブ対応の HTML がモバイル表示に切り替わり、実際に開いたときと別物になるため
- 親要素は `overflow: hidden` で、上端から見えている分だけを切り取って見せる
- iframe には `pointer-events: none` と `tabindex="-1"` を付け、クリック・スクロール・Tab 巡回を奪わせない
- `IntersectionObserver` で遅延読み込み。画面外のものは `src` を設定しない
- **既定ではサムネイル内のスクリプトを実行しない**（`sandbox="allow-same-origin"` 相当。`allow-scripts` を付けない）。設定でオンにできる

### 3. 空サムネイルのフォールバック

スクリプト無効時、JS で描画するタイプの HTML はサムネイルが白紙になる。これを検出して代替表示に差し替える。

- 判定: HTML ソースから `<script>` `<style>` とタグを除去した本文の文字数が閾値（例: 20文字）未満なら「空」とみなす
- 代替表示: `<title>` と本文冒頭のテキストを組んだ簡易プレビューを iframe の代わりに描画する。白紙のカードよりは手がかりになる
- サムネイルのスクリプトを有効にしている場合も、この判定自体は行ってよい（実行結果までは判定できないので過剰にはしない）

### 4. 元ノートへの導線（重要）

各カードの下に、その HTML を参照している Markdown ノート名を表示する。信頼度の異なる2系統を**視覚的に区別して**出す。

- **確定**: `app.metadataCache.resolvedLinks` の逆引きで、その HTML を参照しているノートが見つかった場合。ラベルは「元ノート」。複数ある場合は全部出す（多ければ先頭数件＋「ほかN件」）
- **推測**: 参照が見つからない場合、同じフォルダにある Markdown を候補として出す。ラベルは「同フォルダ」。更新時刻が近い順に上位2〜3件
- 断定と推測を同じ見た目にしない。誤誘導になる
- ノート名クリックでそのノートを開く（`workspace.getLeaf(false).openFile(file)`）

### 5. 検索

- ヘッダーに検索欄。入力のたびに絞り込む
- 対象は「パス＋ファイル名＋`<title>`＋本文テキスト（先頭8000文字程度まで）」を連結して小文字化した文字列への部分一致
- スペース区切りは AND
- 索引はビューを開いたときに一度作る。入力のたびにファイルを読まない

### 6. 並べ替え

- 更新日時の新しい順（既定）
- フォルダ順（パスの昇順）
- 切り替えはヘッダーのボタン

### 7. 拡大表示

- カードのクリックで拡大表示。**これが既定の動作**
- `Modal` を使い、大きな iframe で実物を表示する
- **拡大表示では常にスクリプトを有効にする**（`sandbox="allow-scripts"`）。サムネイルが白紙でも、開けば本来の姿が見えるようにするため
- 拡大表示の中に「元ノートを開く」ボタンを置く。押したらモーダルを閉じてノートを開く
- 「既定のアプリで開く」ボタンも置く（デスクトップのみ）

### 8. 設定タブ

- サムネイル内のスクリプトを有効にする（既定: オフ）
- サムネイルのサイズ（小 / 中 / 大）
- 対象フォルダの限定（空なら保管庫全体）
- 除外フォルダ（複数、改行区切り）
- `index.html` を一覧に含める（既定: オフ）

## 実装の指針と落とし穴

初回の試行錯誤を減らすために、既知の注意点を挙げる。

### リソースURLの取得

iframe の `src` には `this.app.vault.adapter.getResourcePath(file.path)` の戻り値を使う。`app://` 形式のURLが返り、末尾にキャッシュ用のクエリが付く。`file://` を自分で組み立ててはいけない。保管庫内であればこの方式で相対パスの CSS・JS・画像も正しく解決される。

戻り値はカードごとにキャッシュし、再描画のたびに呼び直さない。

### sandbox 属性

`allow-scripts` と `allow-same-origin` を**同時に付けない**。両方付くとサンドボックスを自力で外せてしまい、Obsidian のレビューでも弾かれる。

- サムネイル（既定）: `sandbox="allow-same-origin"`（スクリプトなし、サブリソースは読める）
- サムネイル（設定オン）と拡大表示: `sandbox="allow-scripts"`

`allow-same-origin` 無しでも `app://` のサブリソース読み込み自体は行われる。`allow-forms` `allow-popups` `allow-top-navigation` は付けない。

### resolvedLinks の逆引き

`app.metadataCache.resolvedLinks` は `{ 送信元パス: { 送信先パス: 回数 } }` という形。HTML など非 Markdown のファイルも、`[[...]]` や `![[...]]` で参照されていれば送信先として現れる。

- 全体を舐めて `{ 送信先: [送信元, ...] }` の逆引きマップを一度だけ作る
- `metadataCache` の `resolved` イベントで作り直す
- 参照が無い場合は `unresolvedLinks` ではなくフォルダ推測にフォールバックする（`unresolvedLinks` はリンク切れの話なので今回は使わない）

### スケール計算

```js
const scale = shotElement.clientWidth / 1280;
iframe.style.transform = `scale(${scale})`;
```

`transform-origin: 0 0` を CSS で指定しておくこと。指定しないと中央基準で縮んで位置がずれる。

再計算のタイミングは、初回描画後・ウィンドウリサイズ時・サムネイルサイズ変更時・ペイン幅変更時。`ResizeObserver` をグリッド要素に付けるのが確実。`requestAnimationFrame` を挟まないと `clientWidth` が 0 のまま計算されることがある。

### iframe を作り直さない・動かさない

Obsidian 本体（メインプロセス）は `app://` へのリクエストを `webRequest.onBeforeRequest` で検査し、その際 `frame.origin` を無条件に読む。読み込み途中の iframe を DOM から外すと、後から届くリクエストに frame が無く、`TypeError: Cannot read properties of undefined (reading 'origin')` でアプリごと落ちる（1.13.7 で確認）。iframe を DOM 上で移動しても再挿入扱いで同じ経路を踏む。プラグイン側は次の設計でこれを避ける。

- カードはファイルパスをキーに保持し、描画のたびに再利用する。作り直すのは、ファイルが消えた・更新された（mtime）・空判定やスクリプト設定が変わった場合だけ
- 検索とフォルダ絞り込みは `is-hidden` クラスの付け外しだけで行い、DOM を再生成しない。`display: none` のカードは `IntersectionObserver` に交差しないので、見えるようになった時点で遅延読み込みが始まる
- 並び順は CSS の `order` で指定し、要素を並べ替えない。フォルダ見出しは iframe を持たないので毎回作り直してよい
- どうしても消すカードの iframe が読み込み途中（`src` あり・`is-loaded` なし）なら、非表示にしたまま残し、`load` イベントかタイムアウト（`RETIRED_CARD_TIMEOUT_MS`）で取り除く
- ヘッダー（言語切替などで再生成）とグリッドは別要素にし、グリッドはビューの生存中に一度しか作らない

### IntersectionObserver の後始末

オブザーバはグリッドと同時に一度だけ作り、カードを取り除くときに対象要素を `unobserve()` する。ビューを閉じるときに `disconnect()` する。

### DOM生成

ファイル内容を `innerHTML` に流し込まない。Obsidian のプラグインレビュー基準でも禁止されている。`createEl()` / `createDiv()` と `textContent` を使う。タイトルや本文の抽出には `DOMParser` を使うほうが正規表現より堅い。

### ライフサイクル

- `onunload` で `detachLeavesOfType` を呼ばない（Obsidian の公式ガイドラインで非推奨。利用者のレイアウトを壊す）
- `registerView`、`registerEvent`、`registerDomEvent` を使って登録すれば後始末は自動
- 索引の再構築は、ビューを開いたとき、および `vault` の `create` / `delete` / `modify` / `rename` イベント時。ただしイベントごとに全再構築すると重いので、デバウンスするか該当エントリだけ差し替える

### ファイル読み込み

`vault.read()` ではなく `vault.cachedRead()` を使う。索引作成で全 HTML を読むので差が出る。

### スタイル

動的に変わる値（`transform` のスケール）以外はインラインスタイルにせず `styles.css` に置く。色は Obsidian の CSS 変数（`--background-primary`、`--text-normal`、`--text-muted`、`--background-modifier-border`、`--interactive-accent` など）を使い、テーマとダークモードに追随させる。

### モバイル

`manifest.json` の `isDesktopOnly` は `false`。ただし iOS の WebView は iframe の挙動がデスクトップと異なることがあるので、まずデスクトップで完成させ、モバイル対応は後回しでよい。「既定のアプリで開く」はデスクトップのみ有効にする。

### 性能

同時に生きる iframe の枚数が実質的な負荷。`IntersectionObserver` の `rootMargin` は 200〜400px 程度に抑え、先読みしすぎない。数百件を超えて重くなるようなら、画面外に出た iframe の `src` を外して開放する方式を検討する（最初から作り込まなくてよい）。

## manifest.json

```json
{
  "id": "html-gallery",
  "name": "HTML Gallery",
  "version": "0.1.0",
  "minAppVersion": "1.4.0",
  "description": "保管庫内のHTMLファイルをサムネイルの格子で一覧し、参照元のノートへたどれるようにします。",
  "author": "",
  "isDesktopOnly": false
}
```

## 完成の目安

以下が手元の保管庫で確認できれば初版として十分。

1. リボンから開くと HTML が格子で並び、図の内容が縮小表示されている
2. JS 描画のみの HTML は白紙ではなくタイトル入りの代替表示になっている
3. カードの下に元ノート名が出て、クリックでそのノートが開く
4. 参照の無い HTML には「同フォルダ」として候補が出て、確定表示と見分けがつく
5. 検索欄に図中の語を入れると絞り込める
6. カードをクリックすると拡大表示され、ライブラリ利用の HTML も正しく描画される
7. 拡大表示から元ノートに移動できる
8. 設定でサムネイルのスクリプトを有効にすると一覧でも描画される

## 作業の進め方

Obsidian の API は実際に動かさないと分からない挙動がある。1機能ずつ書いて、その都度 Obsidian を再読み込み（`Ctrl+R` / `Cmd+R`）して確認する。エラーは開発者ツールのコンソール（`Ctrl+Shift+I`）に出る。

推奨する順序:

1. 空のビューが開くところまで（manifest + リボン + ItemView）
2. HTML ファイルの収集と、ファイル名だけのカード一覧
3. iframe サムネイルとスケール計算
4. 遅延読み込み
5. 元ノートの逆引きと表示
6. 検索と並べ替え
7. 拡大表示モーダル
8. 空サムネイルのフォールバック
9. 設定タブ

3 が最大の山。ここが動けば残りは素直に積める。

## 追加要件（2026-09-02）

初版の確認後に追加した要件。上記の仕様と食い違う場合はこちらが優先する。

- ギャラリーのヘッダーでサムネイルサイズ（小 / 中 / 大）を切り替えられる（設定タブと同じ値を共有）
- ギャラリーのヘッダーでフォルダを選んで絞り込める。選択肢は HTML を含むフォルダとその祖先。絞り込みはビュー状態として保存する
- ファイルエクスプローラーでフォルダを右クリックしたとき「HTML Gallery: このフォルダで絞り込む」を出し、選ぶとギャラリーを開いてそのフォルダ配下に絞り込む
- リボン・ビューのアイコンは既存 lucide アイコンと被らないよう `addIcon` で独自 SVG を登録する
- UI は英語・日本語に対応する。既定は Obsidian の言語設定に従い、設定で固定できる。コマンド名・リボンのツールチップにも反映する
- README は英語版（README.md）と日本語版（README.ja.md）を用意する
- 元ノートの表示は、ノート名をインラインで並べるのではなく「バックリンク N」ボタンにし、押すとメニューでノート一覧を出して選んだノートを開く。同フォルダ推測も同じボタン形式（点線・斜体）で、確定との見分けは維持する。拡大表示にも同じボタンを置く

## 追加要件（2026-09-02、第2弾）

- 「同フォルダ」メニューの各ノートに「〜にリンクを追加」を置き、選ぶとそのノート末尾に HTML への埋め込みリンクを追記する。リンクの書式は Obsidian の設定（Wiki リンク / Markdown リンク、相対パス）に従う
- カードの右クリックメニュー: 拡大表示を開く、参照ノート（バックリンク / 同フォルダ）、埋め込みリンクをコピー、パスをコピー、ファイルエクスプローラーで表示、既定のアプリで開く（デスクトップのみ）
- フォルダ順のとき、フォルダごとに見出し行で区切る
- キーボード操作: 矢印キーと Home / End でカード間を移動、Enter / Space で拡大表示、`/` または Mod+F で検索欄にフォーカス、検索欄の Escape で検索語をクリア（空ならカードへ戻る）
- コマンド「このフォルダの HTML へのリンクを挿入」: アクティブなノートと同じフォルダにある、そのノートからまだリンクしていない HTML を候補一覧で出し、選んだものへの埋め込みリンクをカーソル位置（編集中でなければ末尾）に挿入する。どこからもリンクされていないものには「バックリンクなし」の印を付ける
- カードにホバーでタイトル・パス・更新日時のツールチップを出し、パス行の右端に更新日を表示する

## 追加要件（2026-09-07）: HTML 以外の形式への対応

HTML だけでなく、AI や各種ツールが生成した成果物を同じ導線（サムネイル・検索・元ノートへの導線）で扱えるようにする。上記の仕様と食い違う場合はこちらが優先する。

### 対象形式と設定

対象は4種類。それぞれ独立したフラットな boolean 設定で切り替える。

| 種別 | 拡張子 | 設定キー | 既定 |
|---|---|---|---|
| `html` | html / htm | `includeHtml` | オン |
| `svg` | svg | `includeSvg` | オフ |
| `image` | png / jpg / jpeg / gif / webp / avif / bmp | `includeImages` | オフ |
| `pdf` | pdf | `includePdf` | オフ |

既定を HTML だけにするのは、更新した既存ユーザーの見た目が変わらないようにするため。設定は `main.ts` で浅くマージされるので、新設定は必ずフラットなキーにする（ネストしたオブジェクトでは既存ユーザーの新キーが欠落する）。

画像を既定オフにするのはプラグインの中核価値との衝突を避けるため。ノートに貼ったスクリーンショットが数百枚ある保管庫では、オンにすると成果物が埋もれる。

`index.html` を除く設定（`includeIndexHtml`）は `html` のみに適用する（`index.svg` を落とさないため）。

### 種別の表現

`ArtifactKind = "html" | "svg" | "image" | "pdf"` の文字列リテラル・ユニオンと `switch` で表現する。provider インターフェースやレジストリは作らない。ユニオンを広げると `switch` が網羅性を失ってコンパイルエラーになるので、新種別の配線漏れは型で防げる。

### サムネイル

種別ごとに要素を変える。分岐は `src/shot.ts` の `renderShot` / `loadShot` に集約する。

- `html`: 従来どおり `<iframe>`（幅1280px の仮想ビューポート + CSS 縮小）
- `svg` / `image`: `<img class="html-gallery-media">`。**インライン展開も iframe も使わない**。`<img>` 経由の SVG は仕様上の secure static mode で、内部の `<script>` は実行されず外部サブリソースも取得しないため `sandbox` すら不要。逆にインライン展開すると SVG 内のスクリプトが動き、`innerHTML` 相当の禁止パターンになる
- `pdf`: `<canvas class="html-gallery-media">` に1ページ目を描画

`<img>` と `<canvas>` は自前のフレームを持たない（リクエストの発行元は生存し続けるメインフレーム）ので、「iframe を作り直さない・動かさない」の制約（`SPEC.ja.md` の該当節）を踏まない。読み込み中に DOM から外しても安全。

枠の縦横比は CSS 変数 `--html-gallery-shot-ratio`（`1280 / 920`）で全形式共通にする。SVG と画像は `object-fit: contain` でレターボックス表示、PDF だけは `object-fit: cover` + `object-position: top center` で1ページ目の上端を切り取って枠を埋める。HTML のサムネイルが既に「上端だけ見せる」方式なので、それに揃えるのが一貫し、格子も不揃いにならない（PDF に縦長の枠を与えると、同じ行の HTML カードとの高さ差で大きな空きができた）。カード単位の比率指定は行わない。グリッドには `align-items: start` を付ける。

読み込み失敗時は DOM を差し替えず、`is-loaded` を付けずに `is-error` を付けるだけにする（placeholder が残る）。カードを作り直さないため。`is-loaded` と `is-error` はどちらも終端状態として扱い、`IntersectionObserver` の監視を解除する（スクロールごとの再試行を防ぐ）。

### カード再構築の判定

`signature` は `[kind, mtime, html のときのみ scripts, html のときのみ isEmpty]`。スクリプト設定とフォールバック判定は `html` だけのものなので、他種別のカードがそれで作り直されないようにする。`pageCount` は signature に入れない（索引完了は初回描画の後なので、入れると全 PDF カードが作り直される）。

### SVG の解析

`DOMParser` を `"image/svg+xml"` で使う。XML パースは throw せず `<parsererror>` を含む文書を返すのでそれを検出する。`doc.title` は SVG 文書では埋まらないため、`svg > title`（直下のみ。入れ子の `<title>` は図形のツールチップでノイズになる）→ `svg > desc` → ファイル名の順。検索本文は直下の title・desc・`svg[aria-label]`・すべての `text` / `tspan`。

`isEmpty` は `html` 以外では常に `false`（テキストの無いチャート SVG がフォールバック表示に落ちるのを防ぐ）。

画像（ラスタ）はテキストを持たないので、ファイル名と参照ノートだけで探す。

### PDF

Obsidian 本体が同梱する PDF.js を公開 API `loadPdfJs()` 経由で使う。**pdfjs-dist をバンドルしない**。

- `getDocument` には本体ビューアと同じリソースパスを渡す: `cMapUrl: "/lib/pdfjs/cmaps/"`, `cMapPacked: true`, `standardFontDataUrl: "/lib/pdfjs/standard_fonts/"`, `wasmUrl: "/lib/pdfjs/wasm/"`, `iccUrl: "/lib/pdfjs/iccs/"`, `isEvalSupported: false`。cMapUrl と standardFontDataUrl を渡さないと CJK PDF が白紙・豆腐になる
- `GlobalWorkerOptions.workerSrc` は `loadPdfJs()` が設定して freeze するので触らない
- `url` ではなく `data`（`vault.readBinary` の結果）を渡す。PDF.js はバッファをワーカーへ transfer するので、その `ArrayBuffer` は再利用しない
- `loadPdfJs()` の戻り値は `any` なので、使う範囲だけを手書きした interface を `src/pdf.ts` に置き、キャストは1箇所だけにする（eslint の `no-unsafe-*` とコミュニティの自動レビューを通すため）
- 同時に開くドキュメントは最大2件。索引作成と描画で同じリミッタを共有する
- 1ページ目の描画は幅 640px と総ピクセル数の上限に収める。`devicePixelRatio` は無視する（カード1枚で数MBのバッキングストアになる）
- 30MB を超える PDF は描画も索引もせず、最初から `is-error` にする
- カードが画面外に出て未完了なら、`renderTask.cancel()` と `doc.destroy()` でドキュメントを破棄する。`destroy()` を忘れるとカード1枚ごとにワーカースレッドが漏れる。すべての `await` の後にキャンセル判定してから DOM に触る
- 索引は先頭3ページまで、`SEARCH_TEXT_LIMIT` に達したら打ち切る。表示タイトルはファイル名（PDF のメタデータ Title は当てにならない）。メタデータの Title は検索本文にのみ入れる
- テキスト層のないスキャン PDF はカードに「テキストなし」を表示する。OCR は行わない
- カードのクリックは拡大表示モーダルではなく Obsidian 本体の PDF ビューアで開く（検索・ズーム・ページ送り・アウトラインが本体側にある。モーダルの iframe はクラッシュ経路にも触れる）
- 開き先は `getLeaf("tab")`（新しいタブ）。`getLeaf(false)` にすると、ノートにフォーカスがある状態から開いたときにそのノートのタブを置き換えてしまう。ギャラリー自身のリーフは `view.navigation === false` なので、どちらでも置き換わらない。同じ PDF のタブを再利用する処理は入れない（クリックのたびにタブが増えるのは許容する）

`GalleryIndex.build` は `mtime` と `size` が変わっていないエントリを再利用する。`refresh()` は設定変更のたびに走るので、毎回 PDF のテキストを再抽出しないため。PDF の並列度は `src/pdf.ts` の中で閉じているので、`build` は素の `Promise.all` のままでよい。

### 未参照フィルタ

ヘッダーに「未参照」トグルを置き、`resolvedLinks` の逆引きで参照が0件のファイルだけを表示する（同フォルダ推測は参照とみなさない）。可視性の切り替えだけで行い、iframe には触らない。件数表示は絞り込みが効いているとき（`shown !== total`）に `N / M` 形式にする。

### テスト

`vitest` + `jsdom`。`obsidian` は `test/obsidian-stub.ts` にエイリアスする（esbuild の `external` と同じ意図）。テスト対象は Obsidian API に依存しない純粋関数に限る: `kindOf` / `matchesFilters` / `isUnderFolder` / `parseHtml` / `parseSvg` / `parsePdfMeta` / `parseNoText` / `buildEntry` / `stampOf` / `matchesQuery` / `normalizeFolder` / `parseExcludeFolders` / `fitScale` / `createLimiter` / `formatDate`。`parseHtml` のテストは既存 HTML 挙動の回帰ネットとして扱う。

CI（push / PR）で `lint` → `typecheck` → `test` → `build` を回す。

### 名称

表示名（`HTML Gallery`）、プラグイン ID（`html-gallery`）、ビュータイプ（`html-gallery-view`）、CSS クラス接頭辞（`html-gallery-`）はいずれも変更しない。利用者の `workspace.json` や CSS スニペットが依存しているため。

`manifest.json` の `description` には PDF / SVG / image に触れておく。名前からは他形式に対応していることが分からないため。

### 抽出テキストの永続化（今回やらない）

抽出した PDF のテキストはメモリ上の索引にのみ持ち、ファイルには書かない。索引はプラグインのインスタンスに1つ持たせて全ビューで共有するので、タブを開き直しても再抽出は起きない。再抽出が起きるのは Obsidian の再起動後の1回だけで、実測で PDF 10件・79ファイルの索引作成が 505ms、2回目以降は `mtime`+`size` の再利用が効いて 1ms。

数百件の PDF を持つ利用者から起動直後が遅いという声が出たら、そのときに `.obsidian/plugins/html-gallery/pdf-text-cache.json` を足す。形は `{ version, entries: { <path>: { stamp, pageCount, text } } }`、無効化キーは `stampOf`（`mtime:size`）、書き込みは再索引完了後にデバウンス、存在しないパスは書き込み時に掃除、`data.json`（設定）とは必ず分ける。差し込む場所はプラグインが持つ索引の入口。

先に入れない理由は、新しいファイル形式・バージョン管理・破損時の扱い・書き込み競合という失敗モードが増える一方、現状の実測では体感できる差が無いこと。

# リリース手順

Obsidian のコミュニティプラグインとして配布するための手順。リリースの作成は GitHub 上で手作業で行う。

## 1. バージョンを上げる

次の 3 ファイルのバージョンを同じ値にそろえる。`v` は付けない（例: `1.0.1`）。

- `manifest.json` の `version`
- `package.json` の `version`（`npm install --package-lock-only` で `package-lock.json` も追従させる）
- `versions.json` に `"<version>": "<minAppVersion>"` の行を追加する（既存行は残す）

`minAppVersion` を上げないなら、`versions.json` の値は `manifest.json` の `minAppVersion` と同じにする。

## 2. ビルドして確認する

```sh
npm install
npm run build
```

型エラーが無いこと、`main.js` が生成されることを確認する。手元の保管庫で一度動かして、コンソールにエラーが出ないことも見る。

## 3. コミットしてプッシュする

```sh
git add manifest.json package.json package-lock.json versions.json
git commit -m "Bump version to <version>"
git push
```

## 4. GitHub でリリースを作る

1. リポジトリの Releases から「Draft a new release」を開く
2. タグは `manifest.json` の `version` と完全に同じ文字列にする（例: `1.0.1`。先頭に `v` を付けない）。ターゲットは `main`
3. リリースタイトルも同じバージョン文字列にする
4. アセットとして次の 3 ファイルを個別に添付する。zip にまとめない
   - `main.js`（`npm run build` で生成したもの）
   - `manifest.json`
   - `styles.css`
5. 「Publish release」を押す

## 5. 初回のみ: コミュニティプラグインへの登録申請

1. [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases) をフォークする
2. `community-plugins.json` の末尾に次のエントリを追加する

   ```json
   {
     "id": "html-gallery",
     "name": "HTML Gallery",
     "author": "violetyk",
     "description": "Browse HTML files in your vault as a grid of live thumbnails, search them by title and content, and open the notes that link to them.",
     "repo": "violetyk/obsidian-html-gallery"
   }
   ```

   `id` `name` `description` は `manifest.json` と一字一句同じにする
3. 「Add plugin: HTML Gallery」のようなタイトルで Pull Request を出す。PR テンプレートのチェックリストをすべて確認する
4. 自動チェック（ボット）の指摘と、レビュアーのコメントに対応する。修正はこのリポジトリ側で行い、必要ならバージョンを上げて新しいリリースを作る

## 6. 2 回目以降

手順 1〜4 だけで良い。リリースを公開すると、Obsidian 側が `versions.json` と最新リリースを見て更新を配信する。

## 提出前チェックリスト

- `manifest.json` の `id` が `obsidian-` で始まっていない
- `manifest.json` の `name` と `description` に「Obsidian」の語が入っていない
- `innerHTML` / `outerHTML` / `insertAdjacentHTML` を使っていない
- `onunload` で `detachLeavesOfType` を呼んでいない
- グローバルの `app` ではなく `this.app` を使っている
- `var` を使っていない
- `await` の無い `async` メソッドが無い
- 動的に変わる値（`transform` の縮尺）以外のスタイルは `styles.css` にある
- UI の文字列は文頭だけ大文字（sentence case）。コマンド名にプラグイン名を含めない

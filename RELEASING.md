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
npm run lint
npm run build
```

`npm run lint` は公式レビューと同じルール（eslint-plugin-obsidianmd）で検査する。エラーが無いこと、`main.js` が生成されることを確認する。手元の保管庫で一度動かして、コンソールにエラーが出ないことも見る。

## 3. コミットしてプッシュする

```sh
git add manifest.json package.json package-lock.json versions.json
git commit -m "Bump version to <version>"
git push
```

## 4. GitHub でリリースを作る

リリースを公開すると GitHub Actions（`.github/workflows/release.yml`）が動き、タグのコミットから `main.js` をビルドして、`main.js` / `manifest.json` / `styles.css` をアセットとして添付し、ビルド来歴のアテステーション（artifact attestation）を付ける。手で添付する必要はない。

1. リポジトリの Releases から「Draft a new release」を開く
2. タグは `manifest.json` の `version` と完全に同じ文字列にする（例: `1.0.1`。先頭に `v` を付けない）。ターゲットは `main`
3. リリースタイトルも同じバージョン文字列にする
4. アセットは付けずに「Publish release」を押す
5. Actions タブで「Release assets」ワークフローの完了を待つ（1〜2 分）。タグと `manifest.json` のバージョンが違うと失敗する
6. リリースページに `main.js` `manifest.json` `styles.css` の 3 つが並んでいることを確認する

ワークフローが使えない場合は、`npm run build` した `main.js` と `manifest.json` `styles.css` を手で個別に添付してもよい（zip にしない）。その場合アテステーションは付かない。

## 5. 初回のみ: コミュニティプラグインへの登録申請

以前は [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases) の `community-plugins.json` に PR を出す方式だったが、現在このリポジトリは自動ミラーで PR を受け付けていない。提出は [community.obsidian.md](https://community.obsidian.md) から行う。手順の一次情報は公式ドキュメントの [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin)。

前提として、リポジトリのルートに `README.md`、`LICENSE`、`manifest.json` があり、手順 4 のリリースが公開されていること。

1. community.obsidian.md に Obsidian アカウントでサインインする
2. GitHub アカウントを連携し、リポジトリの所有者であることを確認する
3. ディレクトリの画面からプラグインを追加する。`manifest.json` はリポジトリの既定ブランチ（main）から読まれる。`id` が他と重複しておらず、"obsidian" を含まないこと
4. 自動レビューの指摘があれば、このリポジトリ側で修正し、バージョンを上げて新しいリリースを公開してから再確認する

登録後は、フォーラムの Share & showcase や Discord の `#updates`（developer ロールが必要）で公開を告知できる。

## 6. 2 回目以降

手順 1〜4 だけで良い。リリースを公開すると、Obsidian 側が `manifest.json` と `versions.json`、最新リリースを見て更新を配信する。

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

# 高校見学 SPA移行 — 現在地（会話をまたいで引き継ぐための記録）

最終更新：フェーズ2完了（高校見学の本番への切り替え済み）。2f後の修正（通知欄の位置）、QR画像読み取りの追加を反映

## 方針（確定）
| 項目 | 決定 |
| --- | --- |
| 構成 | サイトごとに別々のSPA。共通部品はコピーして持つ（§14-1） |
| 深さ | **同じ挙動の移植のみ。UI・機能は一切変更しない**（§14-2）。例外は下の「挙動の変更点」の1件だけ |
| 旧UI | 残す。`localStorage.uiMode`（`new`/`old`、未設定は新UI）、再読み込みなしで切り替え（§14-3） |
| 順序 | 高校見学 → 問題投稿（§14-4）。問題投稿のzip（`ProblemPosting-main.zip`）は、その時点で受け取る |
| CSS | 中身は書き換えず、ビルド時に、ページごと・新旧UIごとに限定（§14-5、`build/scopeCss.ts`） |
| 検証 | 別リポジトリ `KokoKengaku-modern-staging` で確認してから、本番へ反映（§14-6） |
| 診断・計測 | すべて移植（§14-7）。ただし通信方式の切り替え `?fs=` と `?cache=` は移さず、**常にロングポーリング・永続キャッシュなし** |
| APIキーのWorker化 | 移植が終わったあとの別作業（§14-8）。Workerの置き場は保留。それまでは `system_keys/*` を取得して直接呼ぶ現状のまま。呼び出しは `lib/imageUpload.ts`・`lib/push.ts` の1か所にまとめる |
| 旧URL | リダイレクト用ファイルを、無期限に残す（§14-10）。`public/app.html`・`public/talk.html` |
| ルート | `#/login`、`#/`、`#/talk/:roomId`、`*`（§14-11） |
| `users_random` の書き込み | 他のサイト・処理はない（§14-13）。高校見学が書く項目：`name`・`profileText`・`imageUrl`・`unreadCounts.{ID}`・`lastChecked.{ID}`。**書き込みの形は変えない** |

## 公開先
| | リポジトリ | 公開URL | `base` |
| --- | --- | --- | --- |
| 検証用 | `KokoKengaku-modern-staging` | `https://appsforschool.github.io/KokoKengaku-modern-staging/` | `/KokoKengaku-modern-staging/`（既定） |
| 本番 | `KokoKengaku-modern-`（**末尾にハイフン**） | `https://appsforschool.github.io/KokoKengaku-modern-/` | `/KokoKengaku-modern-/`（`VITE_BASE` で指定） |

バックアップ：本番リポジトリに、`pre-spa` タグと `legacy` ブランチを作成済み。戻すときは、Settings → Pages の配信元を `legacy` ブランチにする。

## 挙動の変更点（唯一）
- **存在しないルームID**：現行は、エラー文がアラートで出て遷移しない。新サイトでは、「指定されたトークルームは見つかりませんでした。」のアラート（`useDialog().alert`）を出し、OKを押すとルーム一覧（`#/`）に遷移する。（フェーズ2bで実装）

## 守ること
- `src/firebase.ts` の Auth の初期化は、全サイト一字一句同じ（SDK `12.14.0` 固定、アプリ名なし、`initializeAuth`、保存先 local→session→memory）。
- `src/firebaseConfig.ts` は、既存の `firebase.js` から機械的に写した値。手で書き換えない。
- 既存のCSSは書き換えない（`src/styles/new|old/*.css` は、元のファイルのコピー）。
- `package.json` と `package-lock.json` の両方をコミットする（`npm ci` を使うため）。
- 秘密のファイル（`.dev.vars`、`key.json`）は、コミットしない。

## CSSの仕組み
- `src/styles/new/<ページ>.css`・`old/<ページ>.css` は、ビルド時に `:where(html.ui-new .page-<ページ>)` が前に付く。`:where()` なので、**詳細度は元のまま**。
- `html` / `body` / `:root` のルールは、ページの外枠（`PageShell` の `<div class="ui-page page-<ページ>">`）に当たる。
- `@keyframes` は、`名前__<新旧>-<ページ>` に改名され、`animation` の参照も直る。
- `dialog.css` は、全ページ共通で、`html.ui-X .ui-page` に限定。**ページのCSSより後に読み込む**（`src/styles/index.ts`）。
- ページのCSSを移したら、`src/styles/index.ts` に1行足す。
- **ビルドの注意（2aで判明）**：既存のCSSには、ブラウザなら読み飛ばす無効な記述がある（例：`old_appStyle.css` の `//text-align: left;`）。ビルド時のCSS圧縮（lightningcss）は厳密でエラーにするため、`vite.config.ts` で `build.cssMinify: false` にしてある。`build/scopeCss.ts` も、宣言の先頭の `//…;` を取り除く。トーク画面のCSS（`talkStyle.css`・`old_talkStyle.css`）を移すときも、`tsx` で変換テストを行うこと。
- **既知の注意**：`document.body.classList` を操作する既存コード（スクロール固定など）は、`body` のルールが外枠に当たるため、外枠に同じクラスを付ける形に直す。移植時に、`grep "document.body"` で洗い出す。

## 進み具合
| フェーズ | 内容 | 状態 |
| --- | --- | --- |
| 0 | 準備（質問、バックアップ、テスト用アカウント、検証用リポジトリ、確認チェックリスト） | 完了（画面録画は、ご自身で） |
| 1a | 土台：Vite+React+TS、`firebase.ts`、`hedged`、認証、ダイアログ、新旧UI切り替え、読み込み画面、**ログイン画面**、CSSの限定、公開設定、旧URLリダイレクト | 完了（動作確認済み） |
| 1b | 診断・通知：`statusBadge`、`perf`（管理者向けパネル）、`diag`、`push`（`notify.js`）、`PushButton`、`imageUpload` | 完了（動作確認済み） |
| 2a | ルーム一覧（`app.css`・新旧）、プロフィールのモーダル、グループ作成モーダル、ドロワー、個人/グループのタブ、未読数 | 完了（動作確認済み。fix2で、下の2件を修正） |
| 2b | トーク画面（`talkStyle.css` と旧UI版）。下書き `messageDraft_<ID>`、編集・削除・転送・選択、既読、アンケート、返信ジャンプ、存在しないルームID | 進行中（完了（①〜⑤すべて動作確認済み）） |
| 2f | 旧URLの互換確認、本番への反映 | **完了**（検証用で確認 → 本番へ切り替え済み。本番での確認項目は、一部のみ報告済み） |
| 3 | 問題投稿 | 未着手 |
| 4 | 後片付け、APIキーのWorker化 | 未着手 |

## 1bで作った部品と、ページ側の呼び方
| 部品 | 場所 | ページ側の使い方（既存の呼び出し位置と同じ） |
| --- | --- | --- |
| 通知欄（左上の小さな通知） | `lib/statusBadge.ts` | ページを離れるとき、自分で作った通知は、自分で消す（SPAでは、通知欄が残るため） |
| 計測 | `lib/perf.ts` | `perfMark` / `perfStart` / `perfSample` / `perfNote` はそのまま。画面を移ると、`PerfRouteWatcher` が計測を0から始め直す |
| 計測パネル | `lib/perf.ts`、`lib/diag.ts` | 読み込み完了時に `perfNotifyReportAvailable({ isAdmin, page, diagnostics: () => runFirestoreDiagnostics(myUserId) })` |
| 通知の初期化 | `lib/push.ts` の `startPush(userId)` | 自分のユーザー情報を取得した**あと**に呼ぶ（読み込みと並行）。読み込み完了時に `notifyPageLoadFinished()` |
| 通知ボタン | `components/PushButton.tsx` | ドロワーに置く（`id="enable-push-button"`）。CSSの `.normal-button` は、`appStyle.css` を移すと効く |
| 通知の送信 | `lib/push.ts` | `sendMessageNotification` / `sendPushToUsers` / `sendProfileChangeNotification`。通知のURLは、旧URL（`talk.html?id=`）のまま |
| 画像アップロード | `lib/imageUpload.ts` | `uploadImageToImgbb(file)`。既存の2か所の同じ処理を、1つにまとめた |
| ログアウト | `auth/AuthProvider.tsx` の `logout()` | `logoutPush()` → `signOut()` の順（既存と同じ） |

### 既存との違い（意図したもの）
- 診断の「通信方式」の表示：既存は「`?fs=` で切り替え可」と出していたが、切り替えを移していないため、「`long`（固定）」と出す。
- 計測の「ブラウザ計測」と「通信が遅かったリソース」：ページを開いた直後の画面でだけ、ブラウザの計測を出す。あとから移った画面は、移った時点からの計測にする（既存は、画面ごとにページを読み込み直していたため、毎回0から）。

## 2aで作った部品
| 部品 | 場所 |
| --- | --- |
| ルーム一覧のページ | `pages/RoomListPage.tsx`（既存の `app.html` + `appScript.js`） |
| データの取得・購読・未読数 | `features/roomList/useRoomList.ts`（`getAllTalkData` / `loadAllUsers` / `updateSingleRoomUnread`） |
| 並べ方・分類 | `features/roomList/roomUtils.ts`（「今日」「昨日」の見出し、個人/グループの分類、見せてよいルームの判定） |
| グループ作成 | `features/roomList/CreateTalkModal.tsx` |
| プロフィールの表示・編集 | `features/ProfileModal.tsx`（**トーク画面と共通**。保存するのは `name` / `profileText` / `imageUrl` だけ） |
| ユーザー情報のキャッシュ | `lib/userCache.ts`（画面に入るときに `resetUserCache()`。既存は、ページごとに空から始まっていた） |
| アバター | `components/Avatar.tsx` |

### 既存と同じにしたこと（ふつうは直したくなる点）
- グループ作成の検索：絞り込むと、いま表示されていない人のチェックは外れる（既存の挙動。直すかは、移植後に相談）。
- 個人タブは、変化があったときだけ作り直す（プロフィール編集の直後は、一覧の名前・アイコンは、すぐには変わらない）。

### 既存との違い（意図したもの）
- ログアウトの完了後の「ログアウトしました。」は出さない（既存は、同時にログイン画面へ移るため、実際には見えなかった。SPAでは、ログイン画面に残ってしまうため）。
- ルームを開くのは、ページの移動ではなく、`#/talk/ID` への画面遷移（戻るボタンで、一覧に戻る）。

## アンケートの「単一選択・複数選択」（機能の追加。ユーザー指示）
- 内容：アンケートの作成時に、回答方法を、**単一選択（既定。既存と同じ）／複数選択**から選べる。複数選択は、ラジオボタン（丸）ではなく、**四角い選択**（チェックマークなし。選ぶと、四角が塗りつぶされる）。
- 実装：`features/talk/pollAnswer.ts`（回答の形の読み書き）、`PollCreateModal.tsx`（「回答方法」の選択）、`PollWidget.tsx`（四角い選択・複数の回答）、`PollVotersModal.tsx`、`sendMessage.ts`（`sendPollMessage`・`votePoll`）、`styles/pollMulti.css`（既存のCSSは無改変のため、追加分を別ファイルに）。
- **保存の形**（複数選択だけ、新しい形。**単一選択は、既存と、まったく同じ**）：
  | | 単一選択（既存と同じ） | 複数選択（追加） |
  | --- | --- | --- |
  | メッセージ | `choices`、`answer: {}` | `choices`、`answer: {}`、**`multiple: true`** |
  | 回答 `answer.{ユーザーID}` | 選んだ番号（数字）。例：`2` | 選んだ番号の配列（小さい順）。例：`[0, 2]` |
- 読み方：番号の数字・配列のどちらでも読める（`toIndices`）。「〇人」と回答者の一覧は、配列に含まれる人も数える。
- 動き：複数選択は、いくつでも選べる。1つも選んでいないときは、「答える」が押せない（取り消しは、できない。単一選択と同じ）。自分の回答と同じ選び方のときも、押せない。通知は、これまでと同じ（「〇〇がアンケートに回答しました」「…の回答を変更しました」）。転送では、`multiple` も、そのまま複製される。
- **注意**：複数選択のアンケートは、**元のサイト（`legacy` ブランチ）では、正しく表示されない**（配列を、数字として読むため）。通常は、使わない。
- **Firestoreのルール**：仕様書 §4.3 のルールは、`talk` の更新を、メンバー・管理者に許す（項目ごとの型の制限は、書かれていない）ので、通る見込み。**配列の書き込み（`answer.{ID}: [..]`）と、`multiple` 付きの作成が、実際に通るかは、検証用で確認する**。
- 確認：サンドボックスでは、擬似のFirestoreで、作成（単一には `multiple` が付かない）・表示・投票（配列・小さい順）・回答者の一覧・見た目（四角い選択）を確認済み（`browser-test-harness` の `test11.py`）。

## 背景色が、画面の下で途切れる（2f後の修正）
- 症状：内容が短い画面（グループが0件のルーム一覧など）で、背景色が、内容の高さで終わり、その下が白くなる。
- 原因：既存のサイトでは、`<body>` の背景色が、画面全体（キャンバス）に広がっていた。SPAでは、`body` のCSSを、ページの枠（`.ui-page`）の中に限定しているため、背景色は、枠の高さ（＝内容の高さ）までしか塗られない。
- 対応：`src/styles/shell.css`（既存のCSSは無改変のため、分けた）で、`.ui-page` の最低の高さを、画面の高さ（`100vh`、使える環境では `100dvh`）にした。内容が長い画面は、これまでどおり。
- 確認：グループが0件の一覧で、枠の高さが、456px → 707px（画面の高さ）になった。内容の長いトーク画面は、余計なスクロールが増えない。
- 今後：ページのCSSで、`body` に背景色を持つものを足す・移すときは、枠（`.ui-page`）が画面の高さを満たしていることを前提にしてよい。画面の外側（スクロールを超えて引っ張ったときの余白）の色は、枠の外なので、変わらない。

## 管理者が、他のアカウントとして閲覧する（機能の追加。ユーザー指示）
- 内容：管理者が、ドロワーの「アカウントの切り替え（管理者）」から、他のユーザーを選び、そのアカウントの見え方（トーク一覧、個人トーク・DM、グループ、未読）で、閲覧できる。**既読は付けず、送信などの書き込みは、本当のアカウント（管理者）名義**。
- 実装：`src/features/viewAs/`（`ViewAsProvider`・`ViewAsModal`・`ViewAsSection`・`ViewAsBanner`）、`src/styles/viewAs.css`（既存のCSSは無改変のため、追加分を別ファイルに）、`RoomListPage`・`TalkPage`・`useTalkRoom` の変更、`App.tsx`（閲覧するアカウントが変わったら、画面を作り直す `key`）、`main.tsx`（`ViewAsProvider`）。
- **誰として見るか（見え方）と、誰として書くか（書き込み）を、分けている**：
  | | 他のアカウント（X）として閲覧中 |
  | --- | --- |
  | ルーム一覧 | Xが入っているルームだけ（`members` の `array-contains X`。Xが管理者なら、Xの管理者としての見え方）。個人タブは、Xの一覧（Xの相手ごと）。未読数は、Xの最終確認日時から数える |
  | トーク画面 | Xの発言が右（自分）。ヘッダーの相手は、Xから見た相手。未読の区切り線は、Xの最終確認日時の位置 |
  | 既読・最終確認日時・未読数 | **書き込まない**（管理者本人の分も、Xの分も）。`readBy`・`lastChecked`・`unreadCounts` のどれも |
  | 送信・画像・アンケートの作成・投票 | **管理者のID・名前で書き込む**（Xのトークの中では、管理者の発言として、左に出る）。通知は、そのルームのメンバー（X・相手）に、管理者名義で届く |
  | 編集・転送・削除・選択・メンバーの管理 | 管理者の権限のまま（Xのものでなくても、できる） |
  | 新しいトーク・グループの作成 | できない（個人トーク：「他のアカウントとして閲覧中は、新しいトークを始められません。」、グループ作成：ボタンを隠す） |
  | プロフィール・ドロワー・通知の登録 | 本当のアカウント（管理者）のまま |
- **閲覧中の目印**：ヘッダーの中に、黄色い帯「「X」として閲覧中（既読は付きません／送信は「管理者」名義）」と、「戻る」ボタン。ドロワーにも、閲覧中のアカウントと「自分のアカウントに戻る」。
- **覚え方**：ブラウザのタブごと（`sessionStorage` の `kokoKengakuViewAs`）。再読み込みでは続く。タブを閉じる、ログアウト、別のIDでログインし直すと、解除される。管理者でないアカウントに、記録が残っていた場合も、解除して、無視する。
- **Firestoreのルール**：**書き込みの形は、変えない**（送信は、既存と同じ2段の書き込み）。仕様書 §4.3 のルール（`talk` は、メンバーまたは管理者が、読み取り・作成・更新。ルームの更新は、`lastUpdatedAt` だけ）で、通る見込み。**実際に通るかは、検証用で確認する**（他人のルームの読み取り、管理者名義での送信、`users_random/X` の読み取り）。
- 運用上の注意：閲覧しても、利用者には分からず、記録も残らない。必要なら、閲覧の記録（誰が、いつ、誰として、どのルームを開いたか）を、別に検討する（新しい書き込みになるので、ルームの変更が要る）。
- 確認：サンドボックスでは、擬似のFirestoreで、一覧・トーク・アカウントの選択・送信・解除を確認済み（`browser-test-harness` の `test10.py`）。実際のFirebaseでの確認は、ユーザーが行う。

## 画像の読み込み待ちでは、「止まっている」の表示を出さない（2f後の修正）
- 症状：トーク画面で、画像の読み込みに時間がかかると、「読み込みに時間がかかっています…」と、「ログイン情報をリセットして再試行」ボタンが出てしまった。
- 原因：停止の判定（`perfWatchStall`）は、「最後に進捗を記録してから12秒」で見ている。画像の読み込み待ちは、進捗の記録がない段階なので、通信が止まったのと同じに扱われていた。
- 対応：`LoadingOverlay` に `paused`（停止の判定を止める。すでに出ている表示・復旧ボタンも消す）を追加。トーク画面は、画像の読み込み待ちに入ってから、読み込み画面が閉じるまで、`paused` にする（`useTalkRoom` の `imageWaiting`）。画像より前の段階（通信）で止まったときは、これまでどおり、12秒で出る。
- 今後：画像などの、時間がかかっても通信の停止ではない段階がある画面では、その間、`paused` にする（問題投稿でも、同じ部品を使う）。

## ログイン画面の「QR画像の読み取り」（機能の追加。ユーザー指示）
- 内容：QRモーダルに、「画像から読み取る」を追加。画像ファイル（写真・スクリーンショット）の中のQRを読み取り、「ID パスワード」の形式なら、IDとパスワードの欄に入れる。画像は、端末の中だけで処理する。
- 仕様：`QR画像読み取り機能_仕様書.md`（**問題投稿・T-eachへの移植用。この機能だけの仕様書**）。
- 実装：`src/lib/qrImage.ts`（読み取りと、縮小しながらの再試行：元 → 長辺1600px → 900px）、`src/pages/LoginPage.tsx`、`src/styles/qrImage.css`（既存のCSSは無改変のため、追加分を別ファイルにして、新旧UIごとに範囲を直接書いた）。
- **既存との違い（意図したもの）**：カメラの起動に失敗したとき、案内は出したうえで、**モーダルを閉じない**（既存は、閉じていた）。カメラのない端末でも、画像から読み取れるようにするため。
- 確認：サンドボックスでは、擬似の `html5-qrcode` で、画面の動き（カメラの停止、成功・形式違い・見つからない、「もう一度」、読み取り中に閉じる、縮小の再試行、カメラが使えない端末、起動の途中での画像の選択）を確認済み（`browser-test-harness` の `test8.py`）。**実機での、実際のQRの読み取りは、未確認**（ユーザーの端末で確認する）。

## ページ間の読み込み（無駄の調査。コードを読んだ結果。実測は未実施）

### SPAで、なくなったもの
HTML・CSS・JSの再読み込み、Firebase・認証の初期化、ログイン状態の再確認、OneSignalの再初期化（`initPromise` で使い回す）。QR読み取り（`html5-qrcode`）は、使うときだけ読み込む。

### 残っているもの（既存と同じ挙動にしてあるため）
- 画面に入るたびに `resetUserCache()` でユーザー情報のキャッシュを空にする（既存は、ページごとに空から始まっていた）。Firestoreは、永続キャッシュなし（メモリのみ）で、購読をやめると、読み込んだデータは捨てられる。
- 一覧に入るたび：`users_random` の全件、自分のユーザー情報（`getDoc` と購読）、ルーム一覧の購読。
- トークに入るたび：自分のユーザー情報、ルーム情報、メンバー全員、**メッセージの全件**（件数の制限なし）、送信者の情報。
- 最初の1回に、全ページ分のJS・新旧UIのCSSを、まとめて読み込む（コード分割なし）。

### 改善の候補（記録のみ。決定事項により、実装していない。実装するなら、ユーザーの判断が要る）
1. 画面を移っても、ユーザー情報のキャッシュを捨てず、使い回す（裏で最新に更新）。
2. 自分のユーザー情報を、認証の部分で、1か所に持つ。
3. トークのメッセージを、新しいものから一定件数だけ読む（未読の区切り線は、全件を見て決める作りのため、慎重な設計が必要）。
4. ルートごとにコードを分けて、最初の読み込みを軽くする。
- 判断の材料：管理者アカウントで、一覧 → トーク → 一覧と移動したあとの「計測結果をみる」の内容（ユーザーに、貼ってもらう予定）。

## 2f後の修正

### 通知欄（「計測結果をみる」など）の位置（スマホのトーク画面）
- 症状：スマホ幅のトーク画面で、左上の通知欄が、「←ホームへもどる」の行（`#head-area`）に重なって、ボタンが押せなかった。
- 原因：通知欄は、アプリのヘッダー（`#app-header`）の下に出す作りで、スマホ幅では、その下に、トークのヘッダー（`#head-area`、`position: sticky`）が追従するため。
- 対応：`lib/statusBadge.ts` の `positionStack` で、`#head-area` が `sticky`／`fixed` で、画面に出ているときは、その下に出す（パソコン幅は、追従しないので、従来どおり）。`repositionStatusBadges()` を、画面の表示・スクロール・読み込み画面が閉じたときに呼ぶ（`TalkPage.tsx`）。
- 今後：トーク画面以外で、追従するヘッダー（`#head-area` 相当）を作るときは、`positionStack` の対象に足す。

## 本番の更新のしかた（切り替え後の、ふだんの流れ）
本番（`KokoKengaku-modern-`）と検証用（`KokoKengaku-modern-staging`）は、同じソースを使う（`deploy.yml` が、リポジトリ名から `base` を決める）。
1. 検証用で、変更をコミット → プッシュ → 検証用のURLで確認する。
2. 本番のフォルダで、`git pull` → 検証用のフォルダの中身を、**消えたファイルも含めて**反映する（`robocopy ..\KokoKengaku-modern-staging . /MIR /XD .git node_modules dist /XF *.zip .dev.vars key.json`。コピー先が、本番のフォルダ（`.`）であることを、必ず確認する）。
3. `git status`（秘密のファイルがないこと）→ `git add -A` → `git commit` → `git push` → Actionsが緑になるのを待つ。
4. 本番のURLで確認する（`Ctrl` + `Shift` + `R`）。問題があれば、`git revert` で戻すか、Settings → Pages の公開元を `legacy` に戻す。

## フェーズ2f：旧URLの互換と、本番への切り替え

### 2fで足したもの
- `public/404.html`：存在しないパスを開いたとき、`#/404` へ移動する。どのルートにも当てはまらない画面（`pages/NotFoundPage.tsx`）は、「指定されたページは見つかりませんでした。」のアラートを出し、OKでルーム一覧へ戻る（ユーザー指示。既存は、GitHub Pagesの標準の404画面。旧 `Placeholders.tsx` は、廃止）。サイトのフォルダは、アドレスの先頭から取り出す（検証用・本番とも、同じファイル）。
- `.github/workflows/deploy.yml`：公開先のパス（`base`）を、**リポジトリ名から自動で決める**（`VITE_BASE=/<リポジトリ名>/`）。検証用・本番で、同じファイルを使える（本番は `KokoKengaku-modern-`。末尾の「-」を含む）。
- 旧URLの変換（`public/app.html`・`public/talk.html`）は、2aまでに作成済み。ブラウザで、10通りの入力（追加の検索パラメータ、日本語のID、IDなしなど）の変換を確認済み。
- `public/OneSignalSDKWorker.js`・`public/icon-512.png`・`public/qrcode.png` は、既存のファイルと同一（確認済み）。`manifest.json` は、`start_url` が `./app.html` → `./`（`scope`・アイコン・色は同じ）。

### 旧URLの対応表
| 旧URL | 新しい動き |
| --- | --- |
| `…/` | `index.html`（ログイン済みなら、ルーム一覧。未ログインなら、ログイン） |
| `…/index.html` | 同上 |
| `…/app.html` | `index.html#/`（ルーム一覧） |
| `…/talk.html?id=<ルームID>` | `index.html#/talk/<ルームID>` |
| 上記を未ログインで開く | ログインのあと、目的の画面に戻る（`RequireAuth` が、元の場所を覚える） |
| 存在しないパス | `404.html` → `index.html#/404` → 「指定されたページは見つかりませんでした。」のアラート → OKでルーム一覧（`#/`）へ（存在しないトークルームと同じ動き）。未ログインなら、一覧への移動のあと、ログイン画面になる |

### 本番への切り替え手順（検証用での確認がすべて済んでから）
1. 本番のリポジトリ（`KokoKengaku-modern-`）の、作業フォルダで、`main` が最新で、きれいな状態であることを確認する。
2. 作業フォルダの中身を、`.git` 以外すべて消す（`legacy` ブランチと `pre-spa` タグに、元の状態が残っている）。
3. 検証用のフォルダから、`.git`・`node_modules`・`dist` 以外を、すべてコピーする（`robocopy`。隠しファイルの `.github`・`.gitignore` も含む）。
4. `git status` で、秘密のファイルが入っていないことを確認 → コミット → プッシュ。
5. GitHub の Settings → Pages → Source を、「GitHub Actions」に切り替える。
6. Actions が緑になったら、本番のURLで、旧URLの互換・通知・PWAを確認する（`Ctrl` + `Shift` + `R`）。
7. 問題があれば、Settings → Pages → Source を、「Deploy from a branch」→ `legacy` に戻す（数分で、元に戻る）。

## 2b⑤で作った部品（トーク画面：メンバー管理・グループのアイコン変更）
| 部品 | 場所 |
| --- | --- |
| メンバー一覧（グループアイコンの変更欄を含む） | `features/talk/MemberModal.tsx`（`getMember` / `renderGroupIconEditor`） |
| メンバーの追加 | `features/talk/AddMemberModal.tsx`（`openAddMemberModal` / `handleAddMembers`） |
| 削除・アイコン保存・一覧の更新 | `pages/TalkPage.tsx`（`handleRemoveMember` / `handleSaveGroupIcon` / `openMemberModal`） |
| ヘッダーのアイコンの作り直し | `useTalkRoom` の `setRoomImageUrl`、`RoomHeader.iconVersion` |

### 権限（既存のまま）
- メンバーの追加・削除：管理者、かつ3人以上のグループのときだけ。グループは3人以上必要なので、3人のときの削除は、「これ以上メンバーを削除できません。」と案内して、書き込まない。
- グループアイコンの変更・削除：管理者、かつグループのときだけ。
- 「最後に確認した時刻」と、削除ボタンは、管理者にだけ出る（個人トークでは、時刻のみ）。

### 書き込みの形（既存のまま。変えないこと）
- 追加：`KokoKengaku/{ルームID}` に `updateDoc({ members: arrayUnion(...ids) })`
- 削除：`updateDoc({ members: arrayRemove(userId) })`
- アイコン：`updateDoc({ imageUrl })`（削除は `imageUrl: ""`）。画像のアップロードは `lib/imageUpload.ts`。
- メンバー一覧を開くたびに、メンバー全員の情報を取り直す（`forceRefresh`）。開いた直後は、キャッシュから即座に出す。

### ⑤の既存との違い（意図したもの）
- **メンバー一覧は、ユーザーの番号（`users_random` の `no`）の小さい順に並べる（0が一番上。番号のない人は最後）**。ユーザー指示による変更。既存は、ルームの `members` の並び順のまま。既読の一覧は、変更なし。`no` は、`lib/userCache.ts` のキャッシュに持たせる（`talkUsers.ts` で、取得時に入れる）。

## 2b④で作った部品（トーク画面：編集・削除・転送・選択）
| 部品 | 場所 |
| --- | --- |
| 編集モーダル | `features/talk/EditMessageModal.tsx`（`openEditModal`） |
| 転送先の選択モーダル | `features/talk/ForwardModal.tsx`（`openForwardModal` / `forwardMessageToRoom`） |
| 編集・削除・転送の書き込み | `features/talk/messageActions.ts`（`newMessageChange` / `messageDelete` / `handleBulk*`） |
| メッセージ上の「編集」「転送」「選択」 | `features/talk/MessageItem.tsx`（権限の判定はここ） |
| 一括選択の状態・操作バー | `pages/TalkPage.tsx`（`selectionMode` / `selectedIds`） |

### 権限（既存のまま）
- 「編集」「選択」：管理者、または自分のメッセージ。「転送」：管理者のみ（「まとめて転送」も管理者のみ）。
- 編集（一般）：本文のみ（送信者の欄は無効、送信日時の欄は非表示）。編集（管理者）：本文・送信者・送信日時。
- 削除：実際には消さず、`isDisplay: false`。編集の画面の「削除」は、一般は自分の発言、管理者は他人の発言も（画面の出し分けは、編集の権限と同じ）。

### 書き込みの形（既存のまま。変えないこと）
- 編集：`KokoKengaku/{ルームID}/talk/{ID}` に `updateDoc({ userId, message, changeLog, [time] })`。`changeLog` は、本文が変わったときだけ、変更前の本文を追記する。`time` は、管理者が入力したときだけ（`Timestamp.fromDate`）。保存しても、編集モーダルは閉じない。
- 削除：`updateDoc({ isDisplay: false })`。一括削除は、`writeBatch` の `update` を、まとめて。
- 転送：転送先の `talk` に、`readBy`・`replyTo`・`isDisplay` 以外をそのままコピー（送信者・日時・画像・アンケート・`changeLog` も）して `batch.set`（`readBy: []`、`replyTo: null`）。同じ batch で、転送先ルームに `batch.update({ lastUpdatedAt })`。転送先の一覧は、いまのルーム以外のすべてのルーム（`getDocs`）。
- 一括転送は、選択中のメッセージを `getDoc` で取り直してコピーする（単体の転送は、表示した時点の内容）。

### ④の既存との違い（意図したもの）
- まとめて削除の実行中は、「まとめて転送」「まとめて削除」とも押せない（既存と同じ）。そのほかは、既存と同じ。

## 2b③で作った部品（トーク画面：アンケート）
| 部品 | 場所 |
| --- | --- |
| メッセージ内のアンケート（選択・「答える」・「〇人」） | `features/talk/PollWidget.tsx`（`buildPollWidget`。メッセージが変更されるたびに作り直す＝`MessageView.seq` を key にする） |
| アンケートの作成 | `features/talk/PollCreateModal.tsx`（選択肢は最小2・最大10。開くたびに初期化） |
| 選んだ人の一覧 | `features/talk/PollVotersModal.tsx`（`openPollVotersModal`） |
| ユーザーIDの一覧 → 表示用の情報（既読の一覧と共通） | `features/talk/useUserEntries.ts`（`ReadByModal` も、これを使うように変更） |
| 書き込み・通知 | `features/talk/sendMessage.ts` の `sendPollMessage` / `votePoll` / `notifyPollAnswer` |

### 書き込みの形（既存のまま。変えないこと）
- 作成：`KokoKengaku/{ルームID}/talk` に `addDoc({ userId, message: 質問, choices: [...], answer: {}, readBy: [], replyTo, time: serverTimestamp() })`、続けて `KokoKengaku/{ルームID}` に `updateDoc({ lastUpdatedAt })`
- 投票・変更：`KokoKengaku/{ルームID}/talk/{メッセージID}` に `updateDoc({ "answer.{自分のID}": 選んだ番号 })`（自分の分だけ）
- 通知：作成は「📊 質問」を、新着通知として。投票は、「〇〇がアンケートに回答しました」「…の回答を変更しました」を、自分以外の全メンバーへ。

### ③の既存との違い（意図したもの）
- 作成中、送信中に、質問や選択肢を入力しても、送信ボタンは有効に戻らない（②と同じ扱い）。
- そのほかは、既存と同じ。

## 2b②で作った部品（トーク画面：送信）
| 部品 | 場所 |
| --- | --- |
| 本文・画像の書き込み、新着通知 | `features/talk/sendMessage.ts`（`addMessage` / 画像送信 / `notifyRoom`） |
| 下書き（`messageDraft_{ルームID}`） | `features/talk/draft.ts` |
| 画像送信のモーダル | `features/talk/ImageSendModal.tsx`（画像のアップロードは `lib/imageUpload.ts`） |
| 入力欄・返信の状態 | `pages/TalkPage.tsx`（`startReply` / `cancelReply` / `handleSendMessage` / `handleSendImage`） |
| ②で、他の機能（⑤）が使うために、外に出したもの | `useTalkRoom` の `roomMembersRef`（メンバーID。⑤で、追加・削除のときに更新する）、`messagesByIdRef`（受信したメッセージの元データ） |

### 書き込みの形（既存のまま。変えないこと）
- `KokoKengaku/{ルームID}/talk` に `addDoc({ userId, message, [imageUrl], readBy: [], replyTo: 返信先ID または null, time: serverTimestamp() })`
- そのあと、`KokoKengaku/{ルームID}` に `updateDoc({ lastUpdatedAt: serverTimestamp() })`
- 本文は、前後の空白を取って送る。画像のキャプションは、そのまま送る（既存と同じ）。
- 成功したら、返信を解除し、本文は下書きも消す。失敗したら、入力欄は空になるが、下書きは残る（既存と同じ）。

### ②の既存との違い（意図したもの）
- 送信中は、入力しても、送信ボタンは有効に戻らない（既存は、送信中に入力すると、ボタンが有効に戻り、二重に送れた）。
- そのほかは、既存と同じ。

## 2b①で作った部品（トーク画面：表示と既読）
| 部品 | 場所 |
| --- | --- |
| トーク画面のページ | `pages/TalkPage.tsx`（既存の `talk.html` + `talkScript.js`。ルートは `#/talk/:roomId`。ルームIDごとに別の画面として作り直す） |
| データの読み込み・メッセージ一覧 | `features/talk/useTalkRoom.ts`（`setupMemberSnapshots` / `getAllTalkData` / 画像の読み込み待ち / 読み込み画面を閉じる） |
| メッセージ1件の表示 | `features/talk/MessageItem.tsx`（`buildMessageElement`。本文・画像・返信元・既読） |
| 既読の一覧 | `features/talk/ReadByModal.tsx` |
| 本文の安全な表示 | `features/talk/messageText.tsx`（`isSafeHref`・`<link>`の展開・許可タグだけ。既存の関数との差分テスト済み） |
| ユーザー情報の取得 | `features/talk/talkUsers.ts`（1人1件の並列取得。最終確認日時も保持。⑤のメンバー一覧が使う） |
| 表示用の型 | `features/talk/types.ts`（メッセージが追加・変更されたときの「作った時点の表示情報」。既存は、変化のないメッセージのDOMを作り直さなかったのと同じ挙動にするため） |
| 日時の形式 | `lib/dateFormat.ts` |
| CSS | `styles/new/talk.css`・`styles/old/talk.css`（無改変） |

### 書き込みの形（既存のまま。変えないこと）
- `users_random/{自分}` に `updateDoc({ "unreadCounts.{ルームID}": 0 })`（入ったとき）
- `users_random/{自分}` に `setDoc({ lastChecked: { {ルームID}: serverTimestamp() } }, { merge: true })`（メッセージを受け取るたび）
- `KokoKengaku/{ルームID}/talk/{メッセージID}` に `updateDoc({ readBy: arrayUnion(自分) })`（他の人の未読メッセージを表示したとき）

### 既存との違い（意図したもの）
- 存在しないルームID：「指定されたトークルームは見つかりませんでした。」→ OKで一覧（`#/`）へ。履歴を残さず置き換える（戻るボタンで、壊れたルームに戻らないため）。**唯一の、意図した挙動の変更**。
- 「←ホームへもどる」は、ページの移動ではなく、`#/` への画面遷移。
- 停止中のアカウントのときは、トーク本体は表示しない（2aと同じ扱いではなく、既存どおり）。
- メッセージの購読は、画面を離れるときに止める（既存は、ページごと消えていた）。
- 「画像を読み込み中…」の通知は、画面を離れるときに消す。
- メッセージの送信者が空（`userId` なし）のとき、名前をタップしても何も起きない（既存は、エラー）。
- 差が出うる細部：プロフィール編集で名前を変えても、すでに表示されたメッセージの名前は、そのまま（既存と同じ）。

### 作業中に直したこと
- `build/scopeCss.ts`：CSSの `//` の無効な宣言が、2つ以上続くと、2つ目以降が残っていた（`old/talk.css` の `.member-item`）。変化がなくなるまで繰り返すようにした。

## 2aの動作確認で見つかり、直した不具合（fix2）
1. 「計測結果をみる」ボタンが、画面を移るたびに増えた → `perfBeginPage` で、前の画面のボタン（と、1分のタイマー）を消す。
2. 通知欄（`#status-badge-stack`）のフォントが、BIZ UDGothicでなくなった → 通知欄は `document.body` の直下に作られ、既存は `body` のフォントを受け継いでいた。`body` のルールは、ページの外枠に限定されるため、通知欄に `font-family` を直接指定した。
- **教訓**：`document.body` の直下に作る要素（通知欄・計測パネル・今後のもの）は、`body` のCSSを受け継げない。フォントなど、必要なものは、自分で指定する。計測パネルは、既存も等幅フォントを自分で指定しているので、変更なし。

## 次にやること
1. （済）2aの動作確認。
2. 本番での確認項目（旧URL・404・通知・PWA・学校のネットワーク）の、残りの報告。
3. フェーズ3（問題投稿）。別の会話で行う（引き継ぎ文：`引き継ぎプロンプト_フェーズ3以降.md`）。2bは大きいので、①表示と既読 ②送信・返信・画像 ③アンケート ④編集・削除・転送・選択 ⑤メンバー管理、の順に分ける。

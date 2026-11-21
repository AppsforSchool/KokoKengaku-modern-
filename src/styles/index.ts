// ★ すべてのCSSを、ここで、決まった順序で読み込む。
//   src/styles/new/・old/ の CSS は、中身を書き換えず、ビルド時に、ページごと・新旧UIごとに限定される（build/scopeCss.ts）。
//   ・既存のCSSは、ページごとに別々に読み込まれていた。ページのCSSを移したら、ここに1行ずつ足す。
//   ・dialog は、全ページ共通のダイアログ用。元のサイトと同じく、ページのCSSより「あと」に読み込む（同じ詳細度のとき、あとのものが勝つため）。
import './base.css'
import './shell.css' // ページの枠の最低の高さ（背景色を、画面の下まで届かせる。既存のCSSは無改変のため、分けてある）
import './new/login.css'
import './old/login.css'
import './viewAs.css' // 【SPAで追加した機能】管理者が、他のアカウントとして閲覧する
import './qrImage.css' // 【SPAで追加した機能】ログイン画面の「画像から読み取る」ボタン（既存のCSSは、無改変のため、分けてある）
import './new/app.css'
import './old/app.css'
import './new/talk.css'
import './old/talk.css'
import './pollMulti.css' // 【SPAで追加した機能】アンケートの複数選択（既存のCSSは、無改変のため、分けてある）
import './uiSwitch.css'
import './new/dialog.css'
import './old/dialog.css'

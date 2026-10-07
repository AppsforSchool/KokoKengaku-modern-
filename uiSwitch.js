// ★ 新UI / 旧UI の切り替え（共通処理）。index.html / app.html / talk.html の <head> で、
//   スタイルシートの <link> の直後に「通常の <script>」として読み込む（type="module" にしない）。
//
//   ・切り替えの仕組み：HTML/JSは新旧共通のまま、CSSだけを差し替える。
//       <link rel="stylesheet" href="appStyle.css" data-ui-css="appStyle">
//     のように data-ui-css を付けた <link> を、旧UIのときは "old_" + 名前 + ".css" に置き換える。
//   ・設定は localStorage の uiMode（"new" / "old"）に端末ごとに保存。未設定なら新UI。
//   ・ドロワーに「新UI」のトグルを追加する。
//       app.html / talk.html … 既存の「アカウント設定」ドロワーに追加
//       index.html（ログイン画面）… 「ログインしていません」＋トグルだけのドロワーをここで作る
(function () {
  "use strict";

  var STORAGE_KEY = "uiMode";
  var DEFAULT_MODE = "new";
  var OLD_PREFIX = "old_";
  var root = document.documentElement;

  // ---------- 設定の読み書き ----------
  function readMode() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === "old" || v === "new") return v;
    } catch (e) { /* localStorageが使えない環境では既定値 */ }
    return DEFAULT_MODE;
  }
  function writeMode(mode) {
    try { localStorage.setItem(STORAGE_KEY, mode); }
    catch (e) { console.warn("UI設定を保存できませんでした:", e); }
  }

  // ---------- スタイルシートの差し替え ----------
  function cssHref(base, mode) {
    return (mode === "old" ? OLD_PREFIX : "") + base + ".css";
  }
  function setModeClass(mode) {
    root.classList.toggle("ui-old", mode === "old");
    root.classList.toggle("ui-new", mode !== "old");
  }

  // 初回（HTMLの解析中・描画前）：href を直接書き換える。ちらつきは出ない
  function applyInitial(mode) {
    setModeClass(mode);
    var links = document.querySelectorAll("link[data-ui-css]");
    for (var i = 0; i < links.length; i++) {
      var href = cssHref(links[i].getAttribute("data-ui-css"), mode);
      if (links[i].getAttribute("href") !== href) links[i].setAttribute("href", href);
    }
  }

  // トグル操作時：新しい <link> を先に読み込み、完了してから古い方を外す
  //（スタイルが一瞬なくなるのを防ぐ）
  function applyLive(mode) {
    setModeClass(mode);
    var links = document.querySelectorAll("link[data-ui-css]");
    Array.prototype.forEach.call(links, function (oldLink) {
      var href = cssHref(oldLink.getAttribute("data-ui-css"), mode);
      if (oldLink.getAttribute("href") === href) return;

      var next = oldLink.cloneNode(false);
      next.setAttribute("href", href);
      next.addEventListener("load", function () {
        if (oldLink.parentNode) oldLink.parentNode.removeChild(oldLink);
        window.dispatchEvent(new Event("resize")); // ヘッダー高さなどの再計算を促す
      });
      next.addEventListener("error", function () {
        console.warn("スタイルシートを読み込めませんでした:", href);
        if (next.parentNode) next.parentNode.removeChild(next); // 元のスタイルを残す
      });
      oldLink.parentNode.insertBefore(next, oldLink.nextSibling);
    });
  }

  applyInitial(readMode());

  // ---------- トグルのスタイル（新旧どちらのドロワーにも馴染むよう変数にフォールバック付き） ----------
  function injectStyle() {
    if (document.getElementById("ui-switch-style")) return;
    var style = document.createElement("style");
    style.id = "ui-switch-style";
    style.textContent = [
      ".ui-switch-row{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;user-select:none;-webkit-user-select:none}",
      ".ui-switch-label{font-weight:700;font-size:.95rem;color:var(--text,#333)}",
      ".ui-switch{position:relative;display:inline-block;width:46px;height:26px;flex-shrink:0}",
      /* .drawer input の汎用スタイル（幅100%・枠・余白など）に負けないよう詳細度を上げている */
      ".ui-switch > input.ui-switch-input,.drawer .ui-switch > input.ui-switch-input{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;opacity:0;cursor:pointer;box-shadow:none;background:transparent;z-index:1}",
      ".ui-switch-track{position:absolute;inset:0;border-radius:999px;background:#ccc;transition:background-color .25s var(--ease,ease)}",
      ".ui-switch-track::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .25s var(--ease,ease)}",
      ".ui-switch-input:checked + .ui-switch-track{background:var(--primary,#007AB7)}",
      ".ui-switch-input:checked + .ui-switch-track::after{transform:translateX(20px)}",
      ".ui-switch-input:focus-visible + .ui-switch-track{outline:3px solid rgba(var(--primary-rgb,0,122,183),.35);outline-offset:2px}",
      /* 旧UI：角を小さめにして、旧UIの雰囲気に合わせる */
      "html.ui-old .ui-switch-track{border-radius:6px}",
      "html.ui-old .ui-switch-track::after{border-radius:4px}"
    ].join("\n");
    document.head.appendChild(style);
  }
  injectStyle();

  // ---------- トグル本体 ----------
  function buildSwitchSection() {
    var section = document.createElement("div");
    section.className = "drawer-section ui-switch-section";
    section.innerHTML =
      '<label class="ui-switch-row">' +
        '<span class="ui-switch-label">新UI</span>' +
        '<span class="ui-switch">' +
          '<input type="checkbox" class="ui-switch-input" role="switch" aria-label="新UI">' +
          '<span class="ui-switch-track"></span>' +
        '</span>' +
      '</label>';
    var input = section.querySelector(".ui-switch-input");
    input.checked = readMode() !== "old";
    input.addEventListener("change", function () {
      var mode = input.checked ? "new" : "old";
      writeMode(mode);
      applyLive(mode);
    });
    return section;
  }

  function syncSwitches(mode) {
    var inputs = document.querySelectorAll(".ui-switch-input");
    for (var i = 0; i < inputs.length; i++) inputs[i].checked = mode !== "old";
  }

  // ---------- ログイン前（index.html）用のドロワー ----------
  function buildLoggedOutDrawer(settingButton) {
    var overlay = document.createElement("div");
    overlay.id = "drawerOverlay";
    overlay.className = "drawer-overlay";

    var drawer = document.createElement("div");
    drawer.id = "accountSettingsDrawer";
    drawer.className = "drawer";
    drawer.innerHTML =
      '<div class="drawer-header">' +
        '<p>アカウント設定</p>' +
        '<span id="drawerCloseButton" class="drawer-close-button">&times;</span>' +
      '</div>' +
      '<div class="drawer-content">' +
        '<div class="drawer-section">' +
          '<p class="title">現在のユーザー</p>' +
          '<p>ログインしていません</p>' +
        '</div>' +
      '</div>';
    drawer.querySelector(".drawer-content").appendChild(buildSwitchSection());

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    function open() { drawer.classList.add("is-open"); overlay.classList.add("is-open"); }
    function close() { drawer.classList.remove("is-open"); overlay.classList.remove("is-open"); }
    settingButton.addEventListener("click", open);
    overlay.addEventListener("click", close);
    drawer.querySelector("#drawerCloseButton").addEventListener("click", close);
  }

  function setupDrawer() {
    var drawer = document.getElementById("accountSettingsDrawer");
    if (drawer) {
      // app.html / talk.html：既存のドロワーの末尾にトグルを追加（開閉は各ページのJSが担当）
      var content = drawer.querySelector(".drawer-content");
      if (content) content.appendChild(buildSwitchSection());
      return;
    }
    var settingButton = document.getElementById("setting-button");
    if (settingButton) buildLoggedOutDrawer(settingButton); // index.html
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupDrawer);
  } else {
    setupDrawer();
  }

  // 別タブで切り替えたときも、このタブに反映する
  window.addEventListener("storage", function (e) {
    if (e.key !== STORAGE_KEY) return;
    var mode = readMode();
    applyLive(mode);
    syncSwitches(mode);
  });
})();

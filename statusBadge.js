// ★ 画面左上（ヘッダーのすぐ下）に、読み込み中の小さな表示（角丸の四角形）を縦に積んで出す共通部品。
//   ・「OneSignalを初期化中…」（notify.js）と、「画像を読み込み中…(a/b)」＋ゲージ（talkScript.js）が、同じ場所に縦に並ぶ。
//   ・並び順は order で決める（小さいほうが上）。OneSignal = 1、画像 = 2。
//   ・表示のたびにヘッダーの高さを測り直す（画面幅や新旧UIで変わるため）。
//   ・タップ操作の邪魔にならないよう、クリックは通過させる。

let stack = null;

function injectStyle() {
  if (document.getElementById("status-badge-style")) return;
  const style = document.createElement("style");
  style.id = "status-badge-style";
  style.textContent = [
    "#status-badge-stack{position:fixed;left:12px;z-index:60;display:flex;flex-direction:column;align-items:flex-start;gap:6px;pointer-events:none}",
    ".status-badge{padding:.4rem .8rem;border-radius:10px;background:rgba(36,48,61,.9);color:#fff;font-size:.78rem;font-weight:700;line-height:1.4;box-shadow:0 4px 14px rgba(0,0,0,.2);white-space:nowrap}",
    ".status-badge.hidden{display:none}",
    ".status-badge-gauge{margin-top:.3rem;height:4px;border-radius:999px;background:rgba(255,255,255,.28);overflow:hidden}",
    ".status-badge-gauge-fill{height:100%;width:0;border-radius:999px;background:#fff;transition:width .2s ease}"
  ].join("\n");
  document.head.appendChild(style);
}

function positionStack() {
  if (!stack) return;
  const header = document.getElementById("app-header");
  const bottom = header ? Math.max(header.getBoundingClientRect().bottom, 0) : 0;
  stack.style.top = (bottom + 8) + "px";
}

export function getStatusBadgeStack() {
  if (stack) return stack;
  injectStyle();
  stack = document.createElement("div");
  stack.id = "status-badge-stack";
  document.body.appendChild(stack);
  window.addEventListener("resize", positionStack);
  positionStack();
  return stack;
}

// 表示/非表示を切り替える（表示のたびに位置を測り直す）
export function setStatusBadgeVisible(el, visible) {
  el.classList.toggle("hidden", !visible);
  if (visible) positionStack();
}

// ★ 文字だけの表示を作る（例：「OneSignalを初期化中…」）。作った時点では非表示
export function createTextBadge(text, order) {
  const el = document.createElement("div");
  el.className = "status-badge hidden";
  el.setAttribute("role", "status");
  el.style.order = String(order);
  el.textContent = text;
  getStatusBadgeStack().appendChild(el);
  return el;
}

// ★ 文字＋その下に進捗ゲージ付きの表示を作る（例：「画像を読み込み中…(12/87)」）。作った時点では非表示
//   set(文字, 割合0〜1) で内容を更新、show() / hide() で表示を切り替える
export function createGaugeBadge(order) {
  const el = document.createElement("div");
  el.className = "status-badge hidden";
  el.setAttribute("role", "status");
  el.style.order = String(order);

  const label = document.createElement("div");
  const gauge = document.createElement("div");
  gauge.className = "status-badge-gauge";
  const fill = document.createElement("div");
  fill.className = "status-badge-gauge-fill";
  gauge.appendChild(fill);
  el.appendChild(label);
  el.appendChild(gauge);
  getStatusBadgeStack().appendChild(el);

  return {
    set(text, ratio) {
      label.textContent = text;
      const clamped = Math.max(0, Math.min(1, ratio));
      fill.style.width = (clamped * 100) + "%";
    },
    show() { setStatusBadgeVisible(el, true); },
    hide() { setStatusBadgeVisible(el, false); }
  };
}

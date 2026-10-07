// ★ ページ読み込みの各段階にかかった時間を計測し、読み込み完了後に「管理者のときだけ」結果を表示する。
//   時刻はすべて performance.now()（= ページ遷移を開始した時点からの経過ミリ秒）で記録する。
//
//   perfMark("名前")          … 直前のマークから今までを1つの区間として記録する（メインの直列処理用）
//   perfStart("名前") → end() … 並行して走る処理の開始〜終了を記録する（OneSignalなど）
//   perfSample("名前", ms)    … 同じ種類の処理を何度も行うもの（未読数クエリなど）の件数・平均・最大をまとめる
//   perfNote("文字列")        … 件数などの補足メモ
//   perfShowReport({isAdmin}) … 管理者なら画面に結果を出す（1ページにつき1回だけ）

const spans = [];     // { label, start, end|null, kind: "main" | "parallel" }
const samples = {};   // label -> { count, sum, max }
const notes = [];
let lastMainEnd = 0;  // 直前のメイン処理が終わった時刻（最初はページ遷移の開始 = 0）
let shown = false;

const now = () => performance.now();

export function perfMark(label) {
  const end = now();
  spans.push({ label, start: lastMainEnd, end, kind: "main" });
  lastMainEnd = end;
}

export function perfStart(label) {
  const span = { label, start: now(), end: null, kind: "parallel" };
  spans.push(span);
  return () => { if (span.end === null) span.end = now(); };
}

export function perfSample(label, ms) {
  const s = samples[label] || (samples[label] = { count: 0, sum: 0, max: 0 });
  s.count++;
  s.sum += ms;
  if (ms > s.max) s.max = ms;
}

export function perfNote(text) {
  notes.push(text);
}

// ---------- 表示用の整形 ----------
const fmt = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(2) + " 秒" : Math.round(ms) + " ms");

function shortUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 38 ? "…" + u.pathname.slice(-37) : u.pathname;
    return u.host + path;
  } catch (e) {
    return url;
  }
}

function collectBrowserTimings() {
  const rows = [];
  const nav = performance.getEntriesByType("navigation")[0];
  if (nav) {
    rows.push(["サーバー応答開始(TTFB)", nav.responseStart]);
    rows.push(["HTML取得完了", nav.responseEnd]);
    rows.push(["DOM構築完了(DOMContentLoaded)", nav.domContentLoadedEventEnd]);
    if (nav.loadEventEnd > 0) rows.push(["load完了(画像・CSS等)", nav.loadEventEnd]);
  }
  return rows;
}

function collectSlowResources() {
  const entries = performance.getEntriesByType("resource")
    .map((r) => ({ name: shortUrl(r.name), type: r.initiatorType, start: r.startTime, duration: r.duration, size: r.transferSize || 0 }))
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);
  return entries;
}

function buildReport(page) {
  const end = Math.max(lastMainEnd, ...spans.map((s) => s.end || 0));
  const lines = [];
  lines.push(`【読み込み計測】${page}  合計 ${fmt(lastMainEnd)}（ページ遷移開始から表示完了まで）`);
  lines.push("");
  lines.push("■ 段階ごとの所要時間（開始〜終了 / 所要）");
  spans.forEach((s) => {
    const dur = s.end === null ? null : s.end - s.start;
    const tag = s.kind === "parallel" ? "[並行] " : "";
    lines.push(`${tag}${s.label}: ${fmt(s.start)} → ${s.end === null ? "未完了" : fmt(s.end)} / ${dur === null ? "(表示時点で未完了)" : fmt(dur)}`);
  });
  const sampleKeys = Object.keys(samples);
  if (sampleKeys.length) {
    lines.push("");
    lines.push("■ 繰り返し処理の集計");
    sampleKeys.forEach((k) => {
      const s = samples[k];
      lines.push(`${k}: ${s.count}回 / 平均 ${fmt(s.sum / s.count)} / 最大 ${fmt(s.max)} / 合計 ${fmt(s.sum)}`);
    });
  }
  if (notes.length) {
    lines.push("");
    lines.push("■ メモ");
    notes.forEach((n) => lines.push(n));
  }
  lines.push("");
  lines.push("■ ブラウザ計測");
  collectBrowserTimings().forEach(([label, ms]) => lines.push(`${label}: ${fmt(ms)}`));
  lines.push("");
  lines.push("■ 通信が遅かったリソース上位10件（所要時間 / 開始時刻 / サイズ）");
  collectSlowResources().forEach((r) => {
    lines.push(`${r.name} [${r.type}]: ${fmt(r.duration)} / 開始 ${fmt(r.start)}${r.size ? " / " + Math.round(r.size / 1024) + "KB" : ""}`);
  });
  return { text: lines.join("\n"), total: end };
}

function injectStyle() {
  if (document.getElementById("perf-report-style")) return;
  const style = document.createElement("style");
  style.id = "perf-report-style";
  style.textContent = [
    "#perf-report{position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:12px}",
    "#perf-report .perf-box{background:#1e232a;color:#e8edf2;width:100%;max-width:760px;max-height:90vh;display:flex;flex-direction:column;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.4);font-family:ui-monospace,Menlo,Consolas,monospace}",
    "#perf-report .perf-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;border-bottom:1px solid #3a424c;font-weight:700;font-size:14px;position:sticky;top:0}",
    "#perf-report .perf-head button{font:inherit;font-size:12px;padding:6px 10px;border:none;border-radius:6px;cursor:pointer;background:#3a424c;color:#fff;margin-left:6px}",
    "#perf-report pre{margin:0;padding:12px 14px;overflow:auto;font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-all}"
  ].join("\n");
  document.head.appendChild(style);
}

// ★ 読み込みが終わったあとに呼ぶ。管理者でなければ何も表示しない
export function perfShowReport({ isAdmin, page }) {
  if (shown) return;
  shown = true;
  if (!isAdmin) return;

  const { text } = buildReport(page || location.pathname.split("/").pop() || "page");
  window.__perfReport = text;
  console.log(text);

  injectStyle();
  const wrap = document.createElement("div");
  wrap.id = "perf-report";
  wrap.innerHTML =
    '<div class="perf-box">' +
      '<div class="perf-head"><span>読み込み計測（管理者のみ）</span>' +
        '<span><button type="button" data-act="copy">コピー</button><button type="button" data-act="close">閉じる</button></span></div>' +
      "<pre></pre>" +
    "</div>";
  wrap.querySelector("pre").textContent = text;
  wrap.addEventListener("click", async (e) => {
    const act = e.target && e.target.getAttribute && e.target.getAttribute("data-act");
    if (act === "close" || e.target === wrap) wrap.remove();
    if (act === "copy") {
      try { await navigator.clipboard.writeText(text); e.target.textContent = "コピーしました"; }
      catch (err) { e.target.textContent = "コピー失敗"; }
    }
  });
  document.body.appendChild(wrap);
}

/* ================================================================
   XU Ế v2 — Unified Script
   Affiliate ID: 17327330054
   Mode: "spin" | "gift"  (set via <body data-mode="...">)
   ================================================================ */

// ── AFFILIATE CONFIG ─────────────────────────────────────────────
const AFF_ID  = "17327330054";
const SUB_ID  = "xue-web";   // tracking label — đổi tùy campaign

/**
 * Wrap bất kỳ link Shopee thành affiliate tracking link.
 * Format: https://s.shopee.vn/an_redir?affiliate_id=...&sub_id=...&origin_link=<encoded>
 */
function affWrap(rawUrl, subId = SUB_ID) {
  if (!rawUrl) return "#";
  // Link đã là shope.ee / s.shopee.vn → giữ nguyên, chỉ thêm params nếu chưa có
  if (rawUrl.includes("affiliate_id=")) {
    // Thay affiliate_id cũ bằng của bạn
    return rawUrl.replace(/affiliate_id=\d+/, `affiliate_id=${AFF_ID}`);
  }
  const encoded = encodeURIComponent(rawUrl);
  return `https://s.shopee.vn/an_redir?affiliate_id=${AFF_ID}&sub_id=${subId}&origin_link=${encoded}`;
}

// ── API ENDPOINTS ────────────────────────────────────────────────
const API = {
  spin: {
    url:     "https://script.google.com/macros/s/AKfycbyobr7LWkEQjy0Kvu-_eRoTgTG-aWEPC8Lk81l6pIYar85KIz1BoZfYijcp3zjghvYhPA/exec",
    refresh: 10_000,
    timeMs:  (item) => item.startTime,   // already ms
    linkFn:  (item) => `https://live.shopee.vn/share?from=live&session=${item.sessionId}`,
    subId:   "xue-spin",
  },
  gift: {
    url:     "https://script.google.com/macros/s/AKfycbxhd52vK5-MQ21Xg92JYKTpx3L_wOi9DNbKXJB_UWOy_DkjUTMGRDY1TQfZiksKzqudNA/exec",
    refresh:  8_000,
    timeMs:  (item) => item.startTime * 1000,
    linkFn:  (item) => `https://live.shopee.vn/share?from=live&session=${item.sessionId}`,
    subId:   "xue-gift",
  },
};

// ── CLIENT-SIDE CACHE (prevent hammering API when multi-tab) ─────
const _cache = {};
const CACHE_TTL = 5_000;

async function fetchWithCache(mode) {
  const cfg = API[mode];
  const now = Date.now();
  if (_cache[mode] && now - _cache[mode].ts < CACHE_TTL) return _cache[mode].data;
  const res = await fetch(cfg.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  _cache[mode] = { data, ts: now };
  return data;
}

// ── COUNTDOWN UTIL ───────────────────────────────────────────────
function fmtCountdown(ms) {
  if (ms <= 0) return "Đã bắt đầu";
  const s = Math.floor(ms / 1000 % 60);
  const m = Math.floor(ms / 60000 % 60);
  const h = Math.floor(ms / 3600000 % 24);
  const d = Math.floor(ms / 86400000);
  return [d && `${d}ng`, h && `${h}g`, m && `${m}p`, `${s}s`].filter(Boolean).join(" ");
}

// ── CLICK TRACKING ───────────────────────────────────────────────
function logClick(mode, shopName) {
  try {
    const key  = `xue_clicks_${mode}`;
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    list.push({ shop: shopName, t: Date.now() });
    localStorage.setItem(key, JSON.stringify(list.slice(-200)));
  } catch (_) {}
  // Nối Google Analytics nếu có:
  // if (typeof gtag !== "undefined") gtag("event", "aff_click", { mode, shop_name: shopName });
}

// ── BUILD CARD ───────────────────────────────────────────────────
function buildCard(item, mode) {
  const cfg       = API[mode];
  const rawLink   = cfg.linkFn(item);
  const aLink     = affWrap(rawLink, cfg.subId);
  const coinLabel = item.maxcoin === 0 ? "🎟 Voucher"
                  : item.maxcoin       ? `${item.maxcoin} xu`
                                       : "?";
  const viewers   = item.viewer_count ? `👁 ${Number(item.viewer_count).toLocaleString("vi")}` : "";
  const startMs   = cfg.timeMs(item);
  const shopName  = item.userName || "Shop ẩn danh";

  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `
    <div class="card-row">
      <span class="shop-name">${shopName}</span>
      <span class="xu-badge">${coinLabel}</span>
      <a class="go-btn" href="${aLink}" target="_blank" rel="noopener noreferrer"
         onclick="logClick('${mode}','${shopName.replace(/'/g,"\\'")}')">Vào ngay</a>
    </div>
    <div class="card-foot">
      <span class="viewers">${viewers}</span>
      <span class="countdown" data-ms="${startMs}"></span>
    </div>
  `;
  return card;
}

// ── RENDER ENGINE ────────────────────────────────────────────────
let _items   = [];   // { el, row, ms }
let _cdTimer = null;

async function renderList(mode) {
  const listEl    = document.getElementById("list");
  const loadEl    = document.getElementById("loading");
  const emptyEl   = document.getElementById("empty");
  const cntBadge  = document.getElementById("cnt");

  try {
    const raw    = await fetchWithCache(mode);
    const sorted = [...raw].sort((a, b) => API[mode].timeMs(a) - API[mode].timeMs(b));

    listEl.innerHTML = "";
    _items = [];

    for (const item of sorted) {
      const card = buildCard(item, mode);
      listEl.appendChild(card);
      _items.push({
        el: card.querySelector(".countdown"),
        row: card,
        ms: API[mode].timeMs(item),
      });
    }

    if (loadEl)   loadEl.style.display   = "none";
    if (emptyEl)  emptyEl.style.display  = sorted.length === 0 ? "block" : "none";
    if (cntBadge) cntBadge.textContent   = sorted.length;

  } catch (err) {
    console.error("[XUE] fetch error:", err);
    if (loadEl) {
      loadEl.querySelector("span").textContent = "⚠️ Lỗi tải dữ liệu. Đang thử lại...";
    }
  }
}

function tickCountdowns() {
  const now = Date.now();
  _items = _items.filter(({ el, row, ms }) => {
    const diff = ms - now;
    if (diff > 0) {
      el.textContent = fmtCountdown(diff);
      return true;
    }
    row.remove();
    return false;
  });
}

function boot(mode) {
  if (!API[mode]) return;
  renderList(mode);
  _cdTimer = setInterval(tickCountdowns, 1000);
  setInterval(() => renderList(mode), API[mode].refresh);
}

// Auto-boot on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  const mode = document.body.dataset.mode || "spin";
  boot(mode);
});

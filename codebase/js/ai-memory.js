/* =====================================================================
 * AI MEMORY — bộ nhớ nội dung AI đã sinh (gợi ý + chẩn đoán/giải thích).
 *
 * Bộ nhớ gắn với "provider:model" đang chạy trên server (scope): đổi model ở tab Tech
 * thì sync() bỏ bản sao cũ và nạp mục của model mới (server lọc theo scope).
 *
 * Luồng: sinh MỘT lần bằng model thật (lần đầu vào Demo hoặc nút ở tab Tech)
 * → lưu vào file cache trên server + bản sao localStorage → từ đó trả lời
 * (Kiểm tra / gợi ý / so sánh hồ sơ) chỉ đọc bộ nhớ, KHÔNG gọi API AI.
 *
 * Khoá = "mode|câu|hồ sơ|đáp án chuẩn hoá", giống hệt cacheKey() của
 * server/cache.js — lệch khoá nghĩa là âm thầm rơi về mock, nên file này là
 * nguồn duy nhất: chạy được cả trình duyệt (window.AIMemory) lẫn Node
 * (server/scripts/pregenerate.js, smoke-test.js).
 * ===================================================================== */
(function (root) {
  "use strict";
  const STORE_KEY = "enigma_ai_memory_v1";
  const PERSONAS = ["nonit", "dev", "dataai"];
  const CONCURRENCY = 4;
  const MAX_MULTI_OPTIONS = 6;   // 2^6 - 1 = 63 tổ hợp; nhiều hơn thì không sinh sẵn
  const MAX_CONSECUTIVE_FAILS = 5; // hết credit / rate limit / server lỗi: dừng sớm thay vì đổ lỗi cả hàng đợi

  /* ---------------- khoá ---------------- */
  function normalizeAnswer(value, preserveOrder) {
    const tokens = String(value == null ? "" : value).toUpperCase().split(/[\s,;|]+/).filter(Boolean);
    return (preserveOrder ? tokens : tokens.sort()).join(",");
  }

  function keyFor(mode, question, persona, answer) {
    const a = mode === "hint" ? "-" : normalizeAnswer(answer, question.question_type === "ordering");
    return `${mode}|${question.id}|${persona}|${a}`;
  }

  /* Các đáp án người học có thể nộp, đúng định dạng UI ("A, B" đã sắp xếp).
   * single_choice → từng phương án; multi_select → mọi tập con khác rỗng;
   * ordering → số hoán vị quá lớn, không sinh sẵn (rơi về mock). */
  function answersFor(q) {
    const keys = Object.keys(q.options || {});
    const type = q.question_type || "single_choice";
    if (type === "single_choice") return keys;
    if (type === "multi_select" && keys.length <= MAX_MULTI_OPTIONS) {
      const out = [];
      for (let mask = 1; mask < (1 << keys.length); mask++) out.push(keys.filter((_, i) => mask & (1 << i)).sort().join(", "));
      return out;
    }
    return [];
  }

  const planCache = typeof WeakMap === "function" ? new WeakMap() : null;
  /** Danh sách mục cần có trong bộ nhớ cho một bộ câu hỏi: hint 3 hồ sơ + diagnose mọi đáp án × 3 hồ sơ. */
  function plan(bank) {
    if (planCache && planCache.has(bank)) return planCache.get(bank);
    const items = [];
    for (const question of bank) for (const persona of PERSONAS) {
      items.push({ key: keyFor("hint", question, persona), mode: "hint", question, persona, answer: null });
      for (const answer of answersFor(question)) items.push({ key: keyFor("diagnose", question, persona, answer), mode: "diagnose", question, persona, answer });
    }
    if (planCache) planCache.set(bank, items);
    return items;
  }
  const expectedKeys = (bank) => plan(bank).map(x => x.key);

  /* ---------------- lưu trữ (RAM + localStorage) ---------------- */
  let mem = null;
  let memScope = null;   // "provider:model" đã sinh ra các mục trong `mem` (server báo qua /api/memory)
  let busy = false;
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => { try { fn(); } catch (_) {} });

  function load() {
    if (mem) return mem;
    mem = {};
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      if (saved && saved.entries && typeof saved.entries === "object") { mem = saved.entries; memScope = saved.scope || null; }
    } catch (_) {}
    return mem;
  }
  /** Ghi bản sao localStorage; trả false nếu bị chặn/đầy để UI báo rõ thay vì im lặng mất bộ nhớ. */
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, scope: memScope, saved_at: new Date().toISOString(), entries: load() })); return true; }
    catch (_) { return false; }
  }
  function clear() { mem = {}; memScope = null; save(); emit(); }

  function get(mode, question, persona, answer) {
    const e = load()[keyFor(mode, question, persona, answer)];
    return e && e.parsed ? e : null;
  }
  function put(key, entry) {
    if (!key || !entry || !entry.parsed) return;
    load()[key] = entry;
  }
  const missing = (bank) => { const m = load(); return plan(bank).filter(x => !m[x.key]); };

  function status(bank) {
    const items = plan(bank), m = load();
    let have = 0, warned = 0, latest = null;
    for (const x of items) {
      const e = m[x.key]; if (!e) continue;
      have++;
      if (e.validation && e.validation.length) warned++;
      if (!latest || String(e.cached_at || "") > String(latest.cached_at || "")) latest = e;
    }
    return { total: items.length, have, warned, missing: items.length - have, busy, model: latest?.generation?.model || null, at: latest?.cached_at || null };
  }

  /** Đọc file cache trên server (GET, không gọi model) và gộp vào bộ nhớ; mục mới hơn thắng. */
  async function sync(endpoint, bank) {
    const ids = [...new Set(bank.map(q => q.id))].join(",");
    const res = await fetch(String(endpoint).replace(/\/$/, "") + "/api/memory?questions=" + encodeURIComponent(ids));
    if (!res.ok) throw new Error("Server " + res.status);
    const j = await res.json();
    let m = load(); let added = 0;
    // Server đã đổi provider/model: bản sao cục bộ thuộc model khác → bỏ, tránh hiện nội dung của model cũ.
    let reset = false;
    if (j.scope && memScope !== j.scope) {
      // Bản sao cũ chưa ghi scope đều do Claude Opus 5 sinh (trước khi có tính năng đổi model).
      const prev = memScope === null ? "anthropic:claude-opus-5" : memScope;
      if (prev !== j.scope) { reset = Object.keys(m).length > 0; mem = {}; m = mem; }
      memScope = j.scope; added++;
    }
    for (const [k, e] of Object.entries(j.entries || {})) {
      if (!e || !e.parsed) continue;
      const cur = m[k];
      if (!cur || String(e.cached_at || "") > String(cur.cached_at || "")) { m[k] = e; added++; }
    }
    if (added) { save(); emit(); }
    return { added, reset, scope: memScope, server_entries: Object.keys(j.entries || {}).length };
  }

  /* Chạy `worker(item)` cho từng mục (concurrency 4). worker trả entry để lưu, hoặc ném lỗi.
   * Dừng cả đợt khi lỗi có `.fatal` (thiếu key, 401/403/501, hết credit) hoặc sau
   * MAX_CONSECUTIVE_FAILS lỗi liên tiếp, thay vì bắn nốt hàng trăm lời gọi hỏng. */
  async function generate(items, worker, opts) {
    const o = opts || {};
    const n = Math.max(1, o.concurrency || CONCURRENCY);
    let idx = 0, done = 0, ok = 0, fail = 0, streak = 0, aborted = false, lastError = null, saved = true;
    busy = true; emit();
    try {
      await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
        while (!aborted && idx < items.length) {
          const item = items[idx++];
          try { put(item.key, await worker(item)); ok++; streak = 0; }
          catch (e) { fail++; streak++; lastError = e; if ((e && e.fatal) || streak >= MAX_CONSECUTIVE_FAILS) aborted = true; }
          done++;
          if (done % 8 === 0) save();
          if (o.onProgress) o.onProgress({ done, total: items.length, ok, fail, item });
        }
      }));
    } finally { saved = save(); busy = false; emit(); }
    return { ok, fail, skipped: items.length - done, aborted, saved, lastError: lastError ? String(lastError.message || lastError) : null };
  }

  /** Từ phản hồi AI.explain() (kèm các trường _xxx của UI) tạo mục lưu gọn. */
  function toEntry(out) {
    const parsed = {};
    for (const [k, v] of Object.entries(out || {})) if (!k.startsWith("_")) parsed[k] = v;
    const g = out && out._generation || null;
    return { parsed, generation: g, usage: out && out._usage || null, validation: out && out._validation || null, cached_at: (g && g.cached_at) || new Date().toISOString() };
  }

  const api = {
    PERSONAS, normalizeAnswer, keyFor, answersFor, plan, expectedKeys,
    get, put, save, clear, missing, status, sync, generate, toEntry,
    isBusy: () => busy,
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AIMemory = api;
})(typeof window !== "undefined" ? window : globalThis);

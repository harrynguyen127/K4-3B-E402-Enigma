/* =====================================================================
 * CACHE — kết quả /api/explain sinh sẵn (mode diagnose + hint).
 *
 * File: codebase/server/cache/explain-cache.json
 * Key : mode|question_id|persona|learner_answer(đã chuẩn hoá)|provider:model
 *       (mục cũ không có hậu tố = thuộc LEGACY_SCOPE; client dùng khoá KHÔNG hậu tố)
 *
 * - Server đọc cache trước; trúng thì trả ngay, KHÔNG gọi model.
 * - Trượt thì gọi model như bình thường rồi ghi thêm vào cache (write-through),
 *   trừ khi EXPLAIN_CACHE=off.
 * - scripts/pregenerate.js sinh sẵn cho N câu × 3 persona × mọi phương án.
 * - followup / probe không cache (phụ thuộc câu người dùng gõ).
 * ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "cache");
const CACHE_FILE = path.join(CACHE_DIR, "explain-cache.json");
let store = null;

function enabled() { return String(process.env.EXPLAIN_CACHE || "on").toLowerCase() !== "off"; }

function normalizeAnswer(value, preserveOrder = false) {
  if (value == null || String(value).trim() === "") return "";
  const tokens = String(value).toUpperCase().split(/[\s,;|]+/).filter(Boolean);
  return (preserveOrder ? tokens : tokens.sort()).join(",");
}

const LEGACY_SCOPE = "anthropic:claude-opus-5";   // các mục sinh trước khi có hậu tố đều do model này

function baseKey(req) {
  if (!req || !req.question || !["diagnose", "hint"].includes(req.mode)) return null;
  const q = req.question;
  const answer = req.mode === "hint" ? "-" : normalizeAnswer(req.learner_answer, q.question_type === "ordering");
  return `${req.mode}|${q.id}|${req.persona}|${answer}`;
}

/** Khoá đầy đủ trên server. scope = "provider:model" đang chạy (model.activeScope()). */
function cacheKey(req, scope) {
  const b = baseKey(req);
  return b && scope ? `${b}|${scope}` : b;
}

/** Tách khoá lưu trữ thành { base, scope }; khoá cũ (4 phần) → LEGACY_SCOPE. */
function splitKey(k) {
  const parts = k.split("|");
  if (parts.length <= 4) return { base: k, scope: LEGACY_SCOPE };
  return { base: parts.slice(0, 4).join("|"), scope: parts.slice(4).join("|") };
}

function load() {
  if (store) return store;
  try { store = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); }
  catch (_) { store = { generated_at: null, entries: {} }; }
  if (!store.entries) store.entries = {};
  return store;
}

function get(key) {
  if (!key || !enabled() || process.env.EXPLAIN_CACHE_SKIP_READ === "1") return null;
  const entries = load().entries;
  if (entries[key]) return entries[key];
  const { base, scope } = splitKey(key);
  return scope === LEGACY_SCOPE ? (entries[base] || null) : null;
}

function readDisk() {
  try { const s = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); return s && s.entries ? s : null; }
  catch (_) { return null; }
}

function put(key, entry) {
  if (!key || !enabled()) return;
  const s = load();
  // Tiến trình khác (scripts/pregenerate.js) có thể vừa ghi file: gộp mục mới hơn của họ vào bản RAM
  // trước khi ghi lại, nếu không lần put kế tiếp sẽ xoá mất chúng.
  const disk = readDisk();
  if (disk) for (const [k, v] of Object.entries(disk.entries)) {
    const cur = s.entries[k];
    if (!cur || String(v.cached_at || "") > String(cur.cached_at || "")) s.entries[k] = v;
  }
  s.entries[key] = Object.assign({ cached_at: new Date().toISOString() }, entry);
  s.generated_at = s.generated_at || s.entries[key].cached_at;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(s, null, 1), "utf8");
  } catch (e) { console.error("cache write error", e.message); }
}

function reload() { store = null; return load(); }

function status() {
  const s = reload();
  const keys = Object.keys(s.entries);
  const byQ = {};
  for (const k of keys) { const q = k.split("|")[1]; byQ[q] = (byQ[q] || 0) + 1; }
  return { enabled: enabled(), file: CACHE_FILE, entries: keys.length, questions: byQ, generated_at: s.generated_at };
}

/** Bản gọn cho GET /api/memory: bỏ prompt/raw_response (phần nặng nhất của file), lọc theo id câu hỏi. */
function slim(questionIds, scope) {
  if (!enabled()) return { enabled: false, generated_at: null, entries: {} };
  const s = reload();
  const want = questionIds && questionIds.length ? new Set(questionIds) : null;
  const entries = {};
  for (const [k, e] of Object.entries(s.entries)) {
    if (!e || !e.parsed) continue;
    if (want && !want.has(k.split("|")[1])) continue;
    const sk = splitKey(k);
    if (scope && sk.scope !== scope) continue;
    entries[sk.base] = { parsed: e.parsed, generation: e.generation || null, usage: e.usage || null, validation: e.validation || null, cached_at: e.cached_at || null };
  }
  return { enabled: true, generated_at: s.generated_at, scope: scope || null, entries };
}

module.exports = { cacheKey, baseKey, splitKey, LEGACY_SCOPE, get, put, status, slim, reload, normalizeAnswer, CACHE_FILE };

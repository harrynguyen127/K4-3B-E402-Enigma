/* =====================================================================
 * CACHE — kết quả /api/explain sinh sẵn (mode diagnose + hint).
 *
 * File: codebase/server/cache/explain-cache.json
 * Key : mode|question_id|persona|learner_answer(đã chuẩn hoá)
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

function cacheKey(req) {
  if (!req || !req.question || !["diagnose", "hint"].includes(req.mode)) return null;
  const q = req.question;
  const answer = req.mode === "hint" ? "-" : normalizeAnswer(req.learner_answer, q.question_type === "ordering");
  return `${req.mode}|${q.id}|${req.persona}|${answer}`;
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
  return load().entries[key] || null;
}

function put(key, entry) {
  if (!key || !enabled()) return;
  const s = load();
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

module.exports = { cacheKey, get, put, status, reload, normalizeAnswer, CACHE_FILE };

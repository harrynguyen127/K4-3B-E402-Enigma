/* =====================================================================
 * GENERATE HINTS — sinh sẵn gợi ý trước-khi-nộp cho 20 câu × 3 persona bằng
 * AI (một lần, offline) và ghi ra codebase/js/data.hints.js.
 *
 *   node codebase/server/scripts/generate-hints.js            # tất cả
 *   node codebase/server/scripts/generate-hints.js --only Q07 # thử 1 câu
 *
 * - Dùng chung callModel() trong server/model.js (AI Engineer điền một chỗ).
 * - Prompt mode "hint" KHÔNG chứa đáp án đúng → không thể lộ đáp án.
 * - Mỗi lời gọi ghi logs/hints-YYYY-MM-DD.jsonl (prompt + raw).
 * - Kiểm tra sau sinh: hint chứa nội dung phương án đúng hoặc nhắc "đáp án X"
 *   → flagged: true để nhóm đọc tay. Không ghi đè file khi có lỗi gọi model.
 * ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { buildPrompt, PROMPT_VERSION } = require("../prompt");
const { callModel, parseModelJson, appendLog } = require("../model");

const JS_DIR = path.resolve(__dirname, "..", "..", "js");
const OUT = path.join(JS_DIR, "data.hints.js");

function loadBrowserData(file, key) {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(JS_DIR, file), "utf8"), ctx);
  return ctx.window[key];
}

function looksLeaky(hint, q) {
  const h = (hint || "").toLowerCase();
  // Multi-select keys are comma-separated (e.g. "A, C, D"), so
  // q.options[q.correct] is undefined. Check every keyed correct option.
  const keys = String(q.correct || "").toUpperCase().split(/[\\s,;|]+/).filter(Boolean);
  for (const key of keys) {
    const correctText = String(q.options?.[key] || "").toLowerCase().trim();
    if (correctText && h.includes(correctText.slice(0, Math.min(40, correctText.length)))) return true;
  }
  if (keys.length && new RegExp(`(đáp án|phương án|chọn)\\s*(?:${keys.join("|")})\\b`, "i").test(hint || "")) return true;
  return false;
}

async function main() {
  const onlyIdx = process.argv.indexOf("--only");
  const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null;
  const bank = loadBrowserData("data.questions.js", "QUESTION_BANK");
  const personas = loadBrowserData("data.personas.js", "PERSONAS");
  const existing = fs.existsSync(OUT) ? (loadBrowserData("data.hints.js", "HINT_BANK") || {}) : {};

  const result = Object.assign({}, existing);
  let calls = 0, failures = 0, flagged = 0;

  for (const q of bank) {
    if (only && q.id !== only) continue;
    result[q.id] = result[q.id] || {};
    for (const pk of ["nonit", "dev", "dataai"]) {
      const req = { mode: "hint", persona: pk, persona_style: personas[pk].style,
        question: { id: q.id, topic: q.topic, stem: q.stem, options: q.options } };
      const prompt = buildPrompt(req);
      const entry = { ts: new Date().toISOString(), request: req, prompt, raw_response: null, parsed: null, error: null };
      try {
        const raw = await callModel(prompt); calls++;
        entry.raw_response = raw; entry.parsed = parseModelJson(raw);
        const hint = String(entry.parsed.hint || "").trim();
        const leaky = looksLeaky(hint, q); if (leaky) flagged++;
        result[q.id][pk] = { hint, flagged: leaky };
        process.stdout.write(`${q.id} ${pk.padEnd(6)} ${leaky ? "⚠ flagged" : "ok"}\n`);
      } catch (e) {
        failures++; entry.error = e.message;
        console.error(`${q.id} ${pk}: ${e.message}`);
        appendLog("hints-" + entry.ts.slice(0, 10) + ".jsonl", entry);
        if (e.status === 501) { console.error("\nDừng: callModel() chưa được cấu hình. Không ghi đè data.hints.js."); process.exit(1); }
        continue;
      }
      appendLog("hints-" + entry.ts.slice(0, 10) + ".jsonl", entry);
    }
  }

  const meta = { generated_at: new Date().toISOString(), model: process.env.AI_MODEL || process.env.AI_PROVIDER || null, prompt_version: PROMPT_VERSION, calls, failures, flagged };
  const body = `/* SINH TỰ ĐỘNG bởi server/scripts/generate-hints.js — KHÔNG sửa tay.
 * Gợi ý trước-khi-nộp cho từng câu × persona. flagged=true: nghi lộ đáp án, nhóm đọc tay.
 * ${JSON.stringify(meta)} */
window.HINT_BANK_META = ${JSON.stringify(meta, null, 2)};
window.HINT_BANK = ${JSON.stringify(result, null, 2)};
`;
  fs.writeFileSync(OUT, body, "utf8");
  console.log(`\nĐã ghi ${OUT}\n${calls} lời gọi · ${failures} lỗi · ${flagged} flagged`);
}

main().catch(e => { console.error(e); process.exit(1); });

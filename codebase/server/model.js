/* =====================================================================
 * MODEL — điểm gọi model DUY NHẤT, dùng chung cho server.js (online) và
 * scripts/generate-hints.js (offline batch).
 *
 * >>> AI ENGINEER: chỉ cần hoàn thiện callModel() bên dưới. <<<
 * ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

loadDotEnv(path.join(__dirname, ".env"));

/* ------------------------------------------------------------------
 * callModel({ system, user }) -> Promise<string>  (chuỗi thô model trả về)
 *
 * TODO (AI Engineer): thay phần ném lỗi bằng lời gọi model thật.
 * Gợi ý: đọc provider/key từ .env (xem .env.example), dùng fetch() có sẵn
 * trong Node 18+. Yêu cầu model trả JSON thuần (temperature thấp).
 * Không log API key. Không hard-code câu trả lời.
 * ------------------------------------------------------------------ */
async function callModel({ system, user }) {
  const provider = process.env.AI_PROVIDER || "";
  if (!provider) {
    const e = new Error("Chưa cấu hình AI_PROVIDER trong codebase/server/.env — AI Engineer hoàn thiện callModel() trong server/model.js.");
    e.status = 501;
    throw e;
  }
  // TODO: switch (provider) { case "...": return await ...; }
  const e = new Error(`AI_PROVIDER="${provider}" chưa được cài đặt trong callModel().`);
  e.status = 501;
  throw e;
}

/* ---------------- parse JSON an toàn từ output model ---------------- */
function parseModelJson(raw) {
  if (typeof raw !== "string") return raw;
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = s.indexOf("{"), end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

/* ---------------- logging jsonl ---------------- */
const LOG_DIR = path.join(__dirname, "logs");
function appendLog(fileName, obj) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, fileName), JSON.stringify(obj) + "\n", "utf8");
  } catch (e) { console.error("log error", e.message); }
}

function loadDotEnv(file) {
  try {
    fs.readFileSync(file, "utf8").split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    });
  } catch (_) { /* không có .env cũng được — UI chạy MOCK */ }
}

module.exports = { callModel, parseModelJson, appendLog, LOG_DIR };

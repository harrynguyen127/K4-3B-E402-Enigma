/* =====================================================================
 * SERVER — proxy tối giản (Node >= 18, không cần npm install).
 *
 *   node codebase/server/server.js          → http://localhost:8787
 *
 * Làm 3 việc:
 *   1. Serve tĩnh thư mục codebase/ (mở index.html qua http để tránh lỗi file://).
 *   2. POST /api/explain : build prompt → callModel() → parse JSON → trả về
 *      { prompt, raw_response, parsed } cho UI ghi trace.
 *   3. Ghi log server/logs/YYYY-MM-DD.jsonl : request + prompt + raw + parsed + latency.
 *
 * >>> AI ENGINEER: chỉ cần hoàn thiện hàm callModel() bên dưới. <<<
 * ===================================================================== */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { buildPrompt } = require("./prompt");

const ROOT = path.resolve(__dirname, "..");           // codebase/
const LOG_DIR = path.join(__dirname, "logs");
const PORT = Number(process.env.PORT || 8787);
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
    const e = new Error("Chưa cấu hình AI_PROVIDER trong codebase/server/.env — AI Engineer hoàn thiện callModel() trong server.js.");
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

/* ---------------- kiểm tra tối thiểu theo AI_CONTRACT ---------------- */
function validate(parsed, req) {
  const errors = [];
  if (!["correct", "incorrect", "no_answer"].includes(parsed.verdict)) errors.push("verdict không hợp lệ");
  if (parsed.citation) {
    const allowed = new Set((req.question.anchors || []).map(a => a.code));
    if (!allowed.has(parsed.citation.code)) errors.push(`citation.code "${parsed.citation.code}" không nằm trong anchors → nghi bịa nguồn (①)`);
  } else if (!parsed.needs_clarification && !parsed.safety?.refused && req.mode === "diagnose" && !parsed.no_source_note) {
    errors.push("citation = null nhưng thiếu no_source_note");
  }
  if (req.persona === "unknown" && !parsed.needs_clarification) errors.push("persona unknown nhưng không hỏi lại (②)");
  return errors;
}

/* ---------------- logging ---------------- */
function appendLog(obj) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const f = path.join(LOG_DIR, new Date().toISOString().slice(0, 10) + ".jsonl");
    fs.appendFileSync(f, JSON.stringify(obj) + "\n", "utf8");
  } catch (e) { console.error("log error", e.message); }
}

/* ---------------- HTTP ---------------- */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  if (req.method === "POST" && req.url === "/api/explain") {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on("end", async () => {
      const t0 = Date.now();
      let request;
      try { request = JSON.parse(body); } catch (_) { return json(res, 400, { error: "Body không phải JSON" }); }
      const prompt = buildPrompt(request);
      const entry = { ts: new Date().toISOString(), request, prompt, raw_response: null, parsed: null, validation: null, latency_ms: null, error: null };
      try {
        const raw = await callModel(prompt);
        entry.raw_response = raw;
        entry.parsed = parseModelJson(raw);
        entry.validation = validate(entry.parsed, request);
        entry.latency_ms = Date.now() - t0;
        appendLog(entry);
        json(res, 200, { prompt, raw_response: raw, parsed: entry.parsed, validation: entry.validation, latency_ms: entry.latency_ms });
      } catch (e) {
        entry.error = e.message; entry.latency_ms = Date.now() - t0;
        appendLog(entry);
        json(res, e.status || 500, { error: e.message, prompt, raw_response: entry.raw_response });
      }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/api/health") {
    return json(res, 200, { ok: true, provider: process.env.AI_PROVIDER || null, configured: Boolean(process.env.AI_PROVIDER) });
  }

  // static
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || file.includes(path.join("server", ".env"))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

function json(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function loadDotEnv(file) {
  try {
    fs.readFileSync(file, "utf8").split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    });
  } catch (_) { /* không có .env cũng được — chạy MOCK từ UI */ }
}

server.listen(PORT, () => {
  console.log(`Enigma D2 server → http://localhost:${PORT}`);
  console.log(`AI_PROVIDER = ${process.env.AI_PROVIDER || "(chưa cấu hình → /api/explain trả 501; UI dùng MOCK)"}`);
});

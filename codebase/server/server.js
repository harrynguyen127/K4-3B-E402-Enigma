/* =====================================================================
 * SERVER — proxy tối giản (Node >= 18, không cần npm install).
 *
 *   node codebase/server/server.js          → http://localhost:8787
 *
 * Làm 4 việc:
 *   1. Serve tĩnh thư mục codebase/ (mở index.html qua http để tránh lỗi file://).
 *   2. POST /api/explain : build prompt → callModel() (server/model.js) → parse
 *      JSON → trả { prompt, raw_response, parsed } cho UI ghi trace.
 *   3. POST /api/feedback : lưu đánh giá 👍/👎 của học viên → logs/feedback.jsonl.
 *   4. Ghi log logs/YYYY-MM-DD.jsonl : request + prompt + raw + parsed + latency.
 *
 * Lời gọi model nằm ở server/model.js (AI Engineer hoàn thiện callModel()).
 * ===================================================================== */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { buildPrompt } = require("./prompt");
const { callModel, parseModelJson, appendLog } = require("./model");

const ROOT = path.resolve(__dirname, "..");           // codebase/
const PORT = Number(process.env.PORT || 8787);

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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

/* ---------------- HTTP ---------------- */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".md": "text/markdown; charset=utf-8" };

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  if (req.method === "POST" && req.url === "/api/explain") {
    const t0 = Date.now();
    let request;
    try { request = JSON.parse(await readBody(req)); } catch (_) { return json(res, 400, { error: "Body không phải JSON" }); }
    const prompt = buildPrompt(request);
    const entry = { ts: new Date().toISOString(), request, prompt, raw_response: null, parsed: null, validation: null, latency_ms: null, error: null };
    try {
      const raw = await callModel(prompt);
      entry.raw_response = raw;
      entry.parsed = parseModelJson(raw);
      entry.validation = validate(entry.parsed, request);
      entry.latency_ms = Date.now() - t0;
      appendLog(new Date().toISOString().slice(0, 10) + ".jsonl", entry);
      json(res, 200, { prompt, raw_response: raw, parsed: entry.parsed, validation: entry.validation, latency_ms: entry.latency_ms });
    } catch (e) {
      entry.error = e.message; entry.latency_ms = Date.now() - t0;
      appendLog(new Date().toISOString().slice(0, 10) + ".jsonl", entry);
      json(res, e.status || 500, { error: e.message, prompt, raw_response: entry.raw_response });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/feedback") {
    let fb;
    try { fb = JSON.parse(await readBody(req)); } catch (_) { return json(res, 400, { error: "Body không phải JSON" }); }
    if (!["up", "down"].includes(fb.rating)) return json(res, 400, { error: "rating phải là up|down" });
    const entry = {
      ts: new Date().toISOString(),
      trace_id: fb.trace_id || null, question_id: fb.question_id || null, persona: fb.persona || null,
      mode: fb.mode || null, block: fb.block || null, rating: fb.rating,
      reasons: Array.isArray(fb.reasons) ? fb.reasons.slice(0, 8) : [],
      note: typeof fb.note === "string" ? fb.note.slice(0, 500) : "",
      ui_mode: fb.ui_mode || null
    };
    appendLog("feedback.jsonl", entry);
    return json(res, 200, { ok: true });
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

server.listen(PORT, () => {
  console.log(`Enigma D2 server → http://localhost:${PORT}`);
  console.log(`AI_PROVIDER = ${process.env.AI_PROVIDER || "(chưa cấu hình → /api/explain trả 501; UI dùng MOCK)"}`);
});

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
 * callModel({ system, user }) -> Promise<string>
 *
 * Provider được chọn hoàn toàn từ codebase/server/.env. OpenRouter là
 * đường LIVE chính; Ollama dùng được khi chạy local. Cả hai đều trả về
 * chuỗi content thô để server parse/validate theo AI_CONTRACT.
 * ------------------------------------------------------------------ */
async function callModel({ system, user }) {
  const provider = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (!provider) throw modelError("Chưa cấu hình AI_PROVIDER trong codebase/server/.env.", 501);

  if (provider === "mock") {
    // Chỉ dùng cho smoke test/offline demo; UI vẫn phân biệt MOCK và LIVE.
    const persona = (String(user).match(/persona\s*=\s*([a-z0-9_-]+)/i) || [])[1] || "unknown";
    const lens = persona === "nonit" ? "Hãy đối chiếu với quy trình công việc thực tế." : persona === "dev" ? "Hãy đối chiếu theo pipeline request → xử lý → response." : "Hãy đối chiếu theo khái niệm và điều kiện đánh giá.";
    return JSON.stringify({
      verdict: "incorrect", needs_clarification: false,
      clarifying_question: null, clarifying_options: null,
      misconception: "Bản mock không phân tích sâu giả định của lựa chọn.",
      hint: "Hãy đối chiếu lựa chọn với yêu cầu chính của câu hỏi.",
      explanation: `[MOCK/${persona}] ${lens} Đây là phản hồi kiểm tra wiring; khi demo AI thật hãy dùng openrouter hoặc ollama.`,
      citation: null,
      no_source_note: "Smoke test không sử dụng transcript source.",
      followup_answer: null, probe_result: null,
      safety: { refused: false, reason: null }
    });
  }

  if (provider === "openrouter") return openRouter({ system, user });
  if (provider === "ollama") return ollama({ system, user });
  throw modelError(`AI_PROVIDER="${provider}" chưa được hỗ trợ. Dùng openrouter, ollama hoặc mock.`, 501);
}

function modelError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

async function fetchJson(url, options, label) {
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 45000);
  const maxRetries = Math.max(0, Math.min(2, Number(process.env.AI_RETRIES ?? 2)));
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
      const text = await response.text();
      let body;
      try { body = text ? JSON.parse(text) : null; } catch (_) { body = null; }
      if (!response.ok) {
        const detail = body?.error?.message || body?.error || text.slice(0, 500) || response.statusText;
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
          continue;
        }
        throw modelError(`${label} HTTP ${response.status}: ${detail}`, response.status >= 500 ? 502 : response.status);
      }
      return body;
    } catch (e) {
      if (e.name === "AbortError") throw modelError(`${label} timeout sau ${timeoutMs}ms.`, 504);
      if ((e.status === 429 || e.status >= 500) && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
      throw e;
    } finally { clearTimeout(timer); }
  }
  throw modelError(`${label} thất bại sau ${maxRetries + 1} lần thử.`, 502);
}

function ensureContent(content, label) {
  if (Array.isArray(content)) content = content.map(x => typeof x === "string" ? x : x?.text || "").join("");
  if (typeof content !== "string" || !content.trim()) throw modelError(`${label} không trả về nội dung model.`, 502);
  return content;
}

async function openRouter({ system, user }) {
  const key = String(process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw modelError("Thiếu OPENROUTER_API_KEY trong codebase/server/.env.", 501);
  const model = process.env.OPENROUTER_MODEL || process.env.AI_MODEL || "openrouter/free";
  const body = await fetchJson("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "HTTP-Referer": "http://localhost:8787", "X-Title": "Personalized Quiz Demo" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.2, max_tokens: 900, response_format: { type: "json_object" } })
  }, "OpenRouter");
  return ensureContent(body?.choices?.[0]?.message?.content, "OpenRouter");
}

async function ollama({ system, user }) {
  const base = String(process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || process.env.AI_MODEL || "qwen2.5:7b";
  const body = await fetchJson(`${base}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], stream: false, format: "json", options: { temperature: 0.2 } })
  }, "Ollama");
  return ensureContent(body?.message?.content, "Ollama");
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

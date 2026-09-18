/* =====================================================================
 * MODEL — điểm gọi model DUY NHẤT, dùng chung cho server.js (online) và
 * scripts/generate-hints.js (offline batch).
 *
 * Provider chọn qua AI_PROVIDER trong codebase/server/.env:
 *   anthropic  → Claude qua Anthropic API (SDK @anthropic-ai/sdk, cần npm install)
 *   openrouter → OpenRouter Chat Completions (fetch thuần)
 *   ollama     → model local qua Ollama (fetch thuần)
 *   mock       → smoke test / offline, không gọi model
 *
 * callModel({ system, user, mode }) -> Promise<string>  (chuỗi JSON thô)
 * ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

loadDotEnv(path.join(__dirname, ".env"));

const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5";

async function callModel({ system, user, mode }) {
  const provider = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (!provider) throw modelError("Chưa cấu hình AI_PROVIDER trong codebase/server/.env.", 501);

  if (provider === "mock") {
    // Chỉ dùng cho smoke test/offline demo; UI vẫn phân biệt MOCK và LIVE.
    const persona = (String(user).match(/persona\s*=\s*([a-z0-9_-]+)/i) || [])[1] || "unknown";
    if (mode === "hint") return JSON.stringify({ hint: `[MOCK/${persona}] Hãy đối chiếu từng phương án với yêu cầu chính của câu hỏi.` });
    const lens = persona === "nonit" ? "Hãy đối chiếu với quy trình công việc thực tế." : persona === "dev" ? "Hãy đối chiếu theo pipeline request → xử lý → response." : "Hãy đối chiếu theo khái niệm và điều kiện đánh giá.";
    return JSON.stringify({
      verdict: "incorrect", needs_clarification: false,
      clarifying_question: null, clarifying_options: null,
      misconception: "Bản mock không phân tích sâu giả định của lựa chọn.",
      hint: "Hãy đối chiếu lựa chọn với yêu cầu chính của câu hỏi.",
      explanation: `[MOCK/${persona}] ${lens} Đây là phản hồi kiểm tra wiring; khi demo AI thật hãy dùng anthropic, openrouter hoặc ollama.`,
      citation: null,
      no_source_note: "Smoke test không sử dụng transcript source.",
      followup_answer: null, probe_result: null,
      safety: { refused: false, reason: null }
    });
  }

  if (provider === "anthropic") return anthropic({ system, user, mode });
  if (provider === "openrouter") return openRouter({ system, user });
  if (provider === "ollama") return ollama({ system, user });
  throw modelError(`AI_PROVIDER="${provider}" chưa được hỗ trợ. Dùng anthropic, openrouter, ollama hoặc mock.`, 501);
}

function modelError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/* ---------------- Anthropic (Claude) ----------------
 * - Model mặc định claude-opus-5 (đổi qua ANTHROPIC_MODEL).
 * - Adaptive thinking + effort (ANTHROPIC_EFFORT, mặc định "medium" để độ trễ
 *   demo thấp; nâng "high" nếu muốn lập luận kỹ hơn).
 * - Structured outputs: schema JSON theo AI_CONTRACT → không còn lỗi parse.
 * - SDK tự retry 429/5xx (AI_RETRIES) và timeout (AI_TIMEOUT_MS).
 * ---------------------------------------------------- */
let anthropicClient = null;
function getAnthropic() {
  if (anthropicClient) return anthropicClient;
  let Anthropic;
  try { Anthropic = require("@anthropic-ai/sdk"); }
  catch (_) { throw modelError("Thiếu package @anthropic-ai/sdk. Chạy: cd codebase/server && npm install", 501); }
  const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey && !process.env.ANTHROPIC_AUTH_TOKEN) throw modelError("Thiếu ANTHROPIC_API_KEY trong codebase/server/.env.", 501);
  anthropicClient = {
    SDK: Anthropic,
    client: new Anthropic({
      apiKey: apiKey || undefined,
      timeout: Number(process.env.AI_TIMEOUT_MS || 60000),
      maxRetries: Math.max(0, Math.min(3, Number(process.env.AI_RETRIES ?? 2)))
    })
  };
  return anthropicClient;
}

function anthropicModel() { return process.env.ANTHROPIC_MODEL || process.env.AI_MODEL || ANTHROPIC_DEFAULT_MODEL; }

async function anthropic({ system, user, mode }) {
  const { SDK, client } = getAnthropic();
  const effort = String(process.env.ANTHROPIC_EFFORT || "medium").trim().toLowerCase();
  const schema = mode === "hint" ? HINT_SCHEMA : EXPLAIN_SCHEMA;
  let response;
  try {
    response = await client.messages.create({
      model: anthropicModel(),
      max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 4096),
      thinking: { type: "adaptive" },
      output_config: { effort, format: { type: "json_schema", schema } },
      system,
      messages: [{ role: "user", content: user }]
    });
  } catch (e) {
    if (e instanceof SDK.AuthenticationError) throw modelError("Anthropic: API key không hợp lệ (401).", 401);
    if (e instanceof SDK.PermissionDeniedError) throw modelError("Anthropic: key không có quyền dùng model này (403).", 403);
    if (e instanceof SDK.NotFoundError) throw modelError(`Anthropic: không tìm thấy model "${anthropicModel()}" (404).`, 404);
    if (e instanceof SDK.RateLimitError) throw modelError("Anthropic: vượt giới hạn tốc độ (429), thử lại sau.", 429);
    if (e instanceof SDK.BadRequestError) throw modelError(`Anthropic 400: ${e.message}`, 400);
    if (e instanceof SDK.APIConnectionTimeoutError) throw modelError(`Anthropic timeout sau ${process.env.AI_TIMEOUT_MS || 60000}ms.`, 504);
    if (e instanceof SDK.APIConnectionError) throw modelError(`Anthropic: không kết nối được (${e.message}).`, 502);
    if (e instanceof SDK.APIError) throw modelError(`Anthropic ${e.status || ""}: ${e.message}`, e.status >= 500 ? 502 : (e.status || 502));
    throw e;
  }
  if (response.stop_reason === "refusal") {
    const why = response.stop_details?.explanation || response.stop_details?.category || "không rõ lý do";
    throw modelError(`Anthropic từ chối trả lời (${why}).`, 502);
  }
  if (response.stop_reason === "max_tokens") throw modelError("Anthropic: output bị cắt vì max_tokens; tăng ANTHROPIC_MAX_TOKENS.", 502);
  const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  lastUsage = {
    model: response.model,
    input_tokens: response.usage?.input_tokens, output_tokens: response.usage?.output_tokens,
    cache_read_input_tokens: response.usage?.cache_read_input_tokens || 0,
    cache_creation_input_tokens: response.usage?.cache_creation_input_tokens || 0,
    stop_reason: response.stop_reason
  };
  return ensureContent(text, "Anthropic");
}

/* Schema JSON cho structured outputs — khớp AI_CONTRACT.md §3 và §3b.
 * Mọi object phải có additionalProperties:false; trường nullable dùng anyOf. */
const nullable = t => ({ anyOf: [t, { type: "null" }] });
const EXPLAIN_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["correct", "incorrect", "no_answer"] },
    needs_clarification: { type: "boolean" },
    clarifying_question: nullable({ type: "string" }),
    clarifying_options: nullable({
      type: "array",
      items: { type: "object", additionalProperties: false, properties: { persona: { type: "string", enum: ["nonit", "dev", "dataai"] }, label: { type: "string" } }, required: ["persona", "label"] }
    }),
    misconception: nullable({ type: "string" }),
    hint: nullable({ type: "string" }),
    explanation: nullable({ type: "string" }),
    citation: nullable({
      type: "object", additionalProperties: false,
      properties: { code: { type: "string" }, quote: { type: "string" }, confidence: { type: "string", enum: ["strong", "partial"] } },
      required: ["code", "quote", "confidence"]
    }),
    no_source_note: nullable({ type: "string" }),
    followup_answer: nullable({ type: "string" }),
    probe_result: nullable({ type: "string", enum: ["understood", "needs_more"] }),
    safety: {
      type: "object", additionalProperties: false,
      properties: { refused: { type: "boolean" }, reason: nullable({ type: "string", enum: ["out_of_scope", "prompt_injection", "asks_answer_directly"] }) },
      required: ["refused", "reason"]
    }
  },
  required: ["verdict", "needs_clarification", "clarifying_question", "clarifying_options", "misconception", "hint", "explanation", "citation", "no_source_note", "followup_answer", "probe_result", "safety"]
};
const HINT_SCHEMA = { type: "object", additionalProperties: false, properties: { hint: { type: "string" } }, required: ["hint"] };

let lastUsage = null;
function lastModelUsage() { return lastUsage; }

/* ---------------- ước tính chi phí (USD, giá Anthropic API công bố, $/1M token) ----------------
 * Bảng giá tra ngày 18/09/2026. Ollama local = 0. Model lạ → null (UI hiện "n/a"). */
const PRICE_PER_MTOK = [
  [/^claude-(fable|mythos)-5/, { in: 10, out: 50 }],
  [/^claude-opus-(5|4-8|4-7|4-6)/, { in: 5, out: 25 }],
  [/^claude-sonnet-5/, { in: 2, out: 10 }],
  [/^claude-sonnet-4-6/, { in: 3, out: 15 }],
  [/^claude-haiku-4-5/, { in: 1, out: 5 }]
];
function estimateCost(usage, provider) {
  if (!usage) return null;
  if (provider === "ollama" || provider === "mock") return { input_usd: 0, output_usd: 0, total_usd: 0, rate_in_per_mtok: 0, rate_out_per_mtok: 0, note: provider === "ollama" ? "model local, không tính phí API" : "mock" };
  const model = String(usage.model || "");
  const hit = PRICE_PER_MTOK.find(([re]) => re.test(model));
  if (!hit) return { input_usd: null, output_usd: null, total_usd: null, rate_in_per_mtok: null, rate_out_per_mtok: null, note: `chưa có bảng giá cho ${model || "model này"}` };
  const rate = hit[1];
  const input_usd = (usage.input_tokens || 0) / 1e6 * rate.in;
  const output_usd = (usage.output_tokens || 0) / 1e6 * rate.out;
  return { input_usd, output_usd, total_usd: input_usd + output_usd, rate_in_per_mtok: rate.in, rate_out_per_mtok: rate.out, note: null };
}

/* ---------------- OpenRouter / Ollama (fetch thuần) ---------------- */
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

module.exports = { callModel, parseModelJson, appendLog, lastModelUsage, estimateCost, anthropicModel, ANTHROPIC_DEFAULT_MODEL, LOG_DIR };

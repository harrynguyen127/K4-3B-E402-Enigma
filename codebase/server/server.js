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
 *      POST /api/event    : sự kiện hành vi (mở gợi ý, mở giải thích đầy đủ) → logs/events.jsonl.
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
const { retrieveAnchors, retrievalStatus } = require("./retrieval");

const ROOT = path.resolve(__dirname, "..");           // codebase/
const PORT = Number(process.env.PORT || 8787);

function providerConfigured() {
  const provider = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (provider === "openrouter") return Boolean(String(process.env.OPENROUTER_API_KEY || "").trim());
  if (provider === "ollama") return Boolean(String(process.env.OLLAMA_URL || "http://localhost:11434").trim() && String(process.env.OLLAMA_MODEL || process.env.AI_MODEL || "qwen2.5:7b").trim());
  if (provider === "mock") return true;
  return false;
}

function generationMetadata() {
  const provider = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (provider === "ollama") return {
    provider: "Ollama (local)", api: "Ollama /api/chat",
    model: process.env.OLLAMA_MODEL || process.env.AI_MODEL || "qwen2.5:7b",
    endpoint: String(process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "") + "/api/chat",
    personalization: "Sinh trực tiếp theo persona: Non-IT, IT/Dev, Data/AI",
    local: true
  };
  if (provider === "openrouter") return {
    provider: "OpenRouter", api: "OpenRouter Chat Completions API",
    model: process.env.OPENROUTER_MODEL || process.env.AI_MODEL || "openrouter/free",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    personalization: "Sinh trực tiếp theo persona", local: false
  };
  return { provider: provider || "unconfigured", api: null, model: process.env.AI_MODEL || null, local: false };
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

/* Model output is advisory only. The answer key in the request is the sole
 * source of truth for grading; this also protects the demo from malformed or
 * over-confident model output. */
function normalizeAnswer(value, preserveOrder = false) {
  if (value == null || String(value).trim() === "") return null;
  const tokens = String(value).toUpperCase().split(/[\s,;|]+/).filter(Boolean);
  return (preserveOrder ? tokens : tokens.sort()).join(",");
}

function fallbackExplanation(req, correct) {
  const q = req.question || {};
  const option = q.options?.[correct] || correct;
  return `Đáp án đúng là ${correct}${option ? ` (${option})` : ""}. Kết luận được chấm theo answer key của câu hỏi và không thay đổi theo hồ sơ người học.`;
}

function attachTranscriptEvidence(request) {
  const q = request?.question;
  if (!q) return;
  // Curated anchors always win. Automatic retrieval is deterministic and
  // deliberately independent of persona and learner answer.
  if ((!Array.isArray(q.anchors) || q.anchors.length === 0) && process.env.RETRIEVAL_DISABLED !== "1") {
    q.anchors = retrieveAnchors(q, Number(process.env.RETRIEVAL_TOP_K || 3));
    q.anchor_confidence = q.anchors.length ? "partial" : "none";
    q.evidence_origin = q.anchors.length ? "transcript_retrieval" : "general_knowledge_fallback";
  } else {
    q.evidence_origin = "curated_anchor";
  }
}

function normalizeResponse(model, req) {
  const q = req.question || {};
  const allowed = new Map((q.anchors || []).map(a => [a.code, a]));
  const out = Object.assign({
    verdict: "no_answer", needs_clarification: false,
    clarifying_question: null, clarifying_options: null,
    misconception: null, hint: null, explanation: null,
    citation: null, no_source_note: null,
    followup_answer: null, probe_result: null,
    safety: { refused: false, reason: null }
  }, model && typeof model === "object" ? model : {});
  out.safety = Object.assign({ refused: false, reason: null }, out.safety || {});

  if (req.mode === "hint") {
    return Object.assign(out, {
      verdict: "no_answer", needs_clarification: false,
      clarifying_question: null, clarifying_options: null,
      misconception: null,
      hint: typeof model?.hint === "string" ? model.hint.trim() : null,
      explanation: null, citation: null, no_source_note: null,
      followup_answer: null, probe_result: null
    });
  }

  const preserveOrder = q.question_type === "ordering";
  const learner = normalizeAnswer(req.learner_answer, preserveOrder);
  const correct = normalizeAnswer(q.correct, preserveOrder);
  out.verdict = learner == null ? "no_answer" : (learner === correct ? "correct" : "incorrect");

  if (req.persona === "unknown") {
    out.needs_clarification = true;
    out.clarifying_question = "Trước khi giải thích, bạn thuộc nhóm Non-IT, IT/Dev hay Data/AI?";
    out.clarifying_options = [
      { persona: "nonit", label: "Tôi làm nghiệp vụ / vận hành" },
      { persona: "dev", label: "Tôi viết code / xây hệ thống" },
      { persona: "dataai", label: "Tôi làm dữ liệu / mô hình ML" }
    ];
    out.misconception = out.hint = out.explanation = null;
  }

  if (learner == null) {
    out.verdict = "no_answer";
    out.misconception = out.hint = out.explanation = null;
  }

  if (out.citation) {
    const anchor = allowed.get(out.citation.code);
    if (anchor) out.citation = { code: anchor.code, quote: anchor.quote, confidence: q.anchor_confidence || out.citation.confidence || "partial" };
    else out.citation = null;
  }
  // Evidence selection is deterministic and profile-independent. If the model
  // omitted a citation despite available transcript evidence, expose the top
  // retrieved/curated anchor instead of pretending there was no source.
  if (!out.citation && allowed.size && req.mode === "diagnose" && !out.needs_clarification && !out.safety.refused) {
    const anchor = allowed.values().next().value;
    out.citation = { code: anchor.code, quote: anchor.quote, confidence: q.anchor_confidence || "partial" };
  }
  if (!out.citation && !out.needs_clarification && !out.safety.refused && req.mode === "diagnose") {
    out.no_source_note = out.no_source_note || "Không tìm thấy đoạn transcript đủ phù hợp; phần giải thích dùng kiến thức AI phổ quát và không gán cho nội dung buổi học.";
  } else if (out.citation) {
    out.no_source_note = null;
  }

  if (req.mode === "followup") {
    const text = String(req.followup_text || "").toLowerCase();
    const outOfScope = /(deadline|hạn nộp|nộp bài|điểm|lịch học|link|zoom|github|system prompt|ignore|bỏ qua hướng dẫn|model gì|mô hình nào)/.test(text);
    if (outOfScope) {
      out.safety = { refused: true, reason: "out_of_scope" };
      out.followup_answer = "Câu hỏi này nằm ngoài phạm vi luyện tập của câu hiện tại. Bạn hãy hỏi TA hoặc xem thông báo lớp về lịch, điểm, hạn nộp và cấu hình hệ thống.";
    }
  }

  if (!out.needs_clarification && learner != null && req.mode === "diagnose") {
    if (out.verdict === "incorrect") {
      out.misconception = out.misconception || `Bạn đang chọn ${req.learner_answer}; hãy đối chiếu lựa chọn này với yêu cầu chính của câu hỏi.`;
      out.hint = out.hint || "Hãy kiểm tra từng điều kiện trong đề và loại các lựa chọn không đáp ứng trực tiếp điều kiện đó.";
    }
    out.explanation = out.explanation || fallbackExplanation(req, q.correct);
  }
  if (out.needs_clarification || out.verdict === "no_answer") {
    out.followup_answer = req.mode === "followup" ? out.followup_answer : null;
    out.probe_result = null;
  }
  return out;
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
    attachTranscriptEvidence(request);
    const prompt = buildPrompt(request);
    const entry = { ts: new Date().toISOString(), request, prompt, raw_response: null, parsed: null, validation: null, latency_ms: null, error: null };
    try {
      const raw = await callModel(prompt);
      entry.raw_response = raw;
      entry.parsed = normalizeResponse(parseModelJson(raw), request);
      entry.validation = validate(entry.parsed, request);
      entry.latency_ms = Date.now() - t0;
      appendLog(new Date().toISOString().slice(0, 10) + ".jsonl", entry);
      json(res, 200, { prompt, raw_response: raw, parsed: entry.parsed, validation: entry.validation, latency_ms: entry.latency_ms, generation: generationMetadata() });
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

  if (req.method === "POST" && req.url === "/api/event") {
    let ev;
    try { ev = JSON.parse(await readBody(req)); } catch (_) { return json(res, 400, { error: "Body không phải JSON" }); }
    if (!ev.event || typeof ev.event !== "string") return json(res, 400, { error: "thiếu event" });
    appendLog("events.jsonl", Object.assign({ ts: new Date().toISOString() }, ev));
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && req.url === "/api/health") {
    return json(res, 200, { ok: true, provider: process.env.AI_PROVIDER || null, configured: providerConfigured(), generation: generationMetadata(), retrieval: retrievalStatus() });
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

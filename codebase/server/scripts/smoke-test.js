/* End-to-end smoke test without an API key.
 * Starts the same HTTP server with the explicit mock provider, then checks
 * health and the contract for one question across all three personas. */
"use strict";
const { spawn } = require("child_process");
const { retrieveAnchors, retrievalStatus } = require("../retrieval");

const port = Number(process.env.SMOKE_PORT || 8791);
const base = `http://127.0.0.1:${port}`;
const question = {
  id: "Q01", topic: "fair model comparison", stem: "Chọn tất cả confound.",
  options: { A: "Prompt khác", B: "Temperature khác", C: "Latency khác", D: "Một run", E: "Identity" },
  correct: "A, B, C, D", question_type: "multi_select", anchors: [], anchor_confidence: "none"
};
const matching = {
  id: "Q04", topic: "finish reason", stem: "Ghép finish reason.",
  options: { A: "stop → complete; length → continue; tool_calls → handler", B: "stop → handler; length → complete; tool_calls → continue", C: "stop → continue; length → handler; tool_calls → complete" },
  correct: "A", question_type: "single_choice", anchors: [], anchor_confidence: "none"
};
const ordering = {
  id: "Q09", topic: "Transformer Post-Norm", stem: "Sắp xếp trình tự.",
  options: { A: "Attention → Norm → FFN → Norm", B: "Attention → FFN → Norm → Norm", C: "Norm → Attention → Norm → FFN" },
  correct: "A", question_type: "single_choice", anchors: [], anchor_confidence: "none"
};

const REQUIRED_FIELDS = ["verdict", "needs_clarification", "clarifying_question", "clarifying_options", "misconception", "hint", "explanation", "citation", "no_source_note", "followup_answer", "probe_result", "safety"];
function assertParsed(parsed, expectedVerdict) {
  for (const field of REQUIRED_FIELDS) if (!Object.prototype.hasOwnProperty.call(parsed || {}, field)) throw new Error(`missing response field: ${field}`);
  if (parsed.verdict !== expectedVerdict) throw new Error(`expected ${expectedVerdict}, got ${parsed.verdict}`);
  if (parsed.citation !== null) throw new Error("fabricated citation in no-anchor question");
  if (!parsed.no_source_note) throw new Error("missing no_source_note");
}

function makeRequest(persona, q, answer) {
  return { mode: "diagnose", persona, persona_style: persona, question: q, learner_answer: answer, attempt: 1, hint_viewed: false, history: [] };
}

/* Bộ nhớ AI phía UI (js/ai-memory.js) và cache server phải dùng CÙNG khoá: lệch khoá = trượt cache
 * âm thầm và "Kiểm tra" rơi về mock. Bộ demo Q01–Q03 kỳ vọng 207 khoá (9 hint + 198 diagnose). */
function checkMemoryKeys() {
  const vm = require("vm"), fs = require("fs"), path = require("path");
  const M = require("../../js/ai-memory.js"), cache = require("../cache");
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", "data.questions.js"), "utf8"), ctx);
  const demo = ctx.window.QUESTION_BANK.slice(0, 3);
  const items = M.plan(demo);
  if (items.length !== 207 || new Set(items.map(x => x.key)).size !== 207) throw new Error(`demo memory plan: expected 207 unique keys, got ${items.length}`);
  for (const it of items) {
    const req = { mode: it.mode, persona: it.persona, question: { id: it.question.id, question_type: it.question.question_type || "single_choice" }, learner_answer: it.answer };
    if (cache.cacheKey(req) !== it.key) throw new Error(`memory key mismatch: ${it.key} vs ${cache.cacheKey(req)}`);
  }
}

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`${base}/api/health`); if (r.ok) return r.json(); } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("server did not become ready");
}

async function main() {
  if (retrievalStatus().chunks < 1) throw new Error("transcript index is empty");
  const ragEvidence = retrieveAnchors({ topic: "RAG", stem: "RAG truy xuất tài liệu để bổ sung ngữ cảnh như thế nào?", options: { A: "retrieval tài liệu nội bộ và citation" }, correct: "A" });
  if (!ragEvidence.length || !ragEvidence.some(x => x.code === "T03-036" || x.code === "T05-110")) throw new Error("transcript retrieval did not find expected RAG evidence");
  checkMemoryKeys();
  const child = spawn(process.execPath, [require("path").join(__dirname, "..", "server.js")], {
    env: Object.assign({}, process.env, { AI_PROVIDER: "mock", RETRIEVAL_DISABLED: "1", EXPLAIN_CACHE: "off", PORT: String(port) }),
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", b => { stderr += b.toString(); });
  try {
    const health = await waitForServer();
    if (health.provider !== "mock" || !health.configured) throw new Error("health provider/configured mismatch");
    const memory = await (await fetch(`${base}/api/memory?questions=Q01,Q02`)).json();
    if (!memory || typeof memory.entries !== "object" || Array.isArray(memory.entries)) throw new Error("GET /api/memory: bad shape");
    const outputs = [];
    for (const persona of ["nonit", "dev", "dataai"]) {
      const response = await fetch(`${base}/api/explain`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(makeRequest(persona, question, "A"))
      });
      if (!response.ok) throw new Error(`explain HTTP ${response.status}`);
      const body = await response.json();
      const p = body.parsed;
      assertParsed(p, "incorrect");
      outputs.push(p.explanation);
    }
    if (new Set(outputs).size !== 3) throw new Error("persona explanations are not distinct");
    for (const [q, correct, wrong] of [[question, "A, B, C, D", "A"], [matching, "A", "B"], [ordering, "A", "B"]]) {
      const correctResponse = await fetch(`${base}/api/explain`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(makeRequest("dev", q, correct)) });
      const wrongResponse = await fetch(`${base}/api/explain`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(makeRequest("dev", q, wrong)) });
      assertParsed((await correctResponse.json()).parsed, "correct");
      assertParsed((await wrongResponse.json()).parsed, "incorrect");
    }
    console.log("smoke ok: transcript retrieval + general-knowledge fallback + Q01 x 3 personas + deterministic grading/schema + AI-memory keys (207) + GET /api/memory");
  } finally {
    child.kill();
    if (stderr) process.stderr.write(stderr);
  }
}

main().catch(err => { console.error("smoke failed:", err.message); process.exitCode = 1; });

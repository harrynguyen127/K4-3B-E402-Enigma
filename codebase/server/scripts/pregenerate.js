/* =====================================================================
 * PREGENERATE — sinh sẵn kết quả /api/explain cho N câu × 3 persona × MỌI
 * phương án (diagnose) + gợi ý trước-khi-nộp (hint), ghi vào
 * codebase/server/cache/explain-cache.json. Sau đó UI bấm "Kiểm tra" chỉ
 * đọc cache, không gọi model.
 *
 *   node codebase/server/scripts/pregenerate.js                    # Q01,Q02,Q03 (3 câu đang demo)
 *   node codebase/server/scripts/pregenerate.js --questions Q07,Q01
 *   node codebase/server/scripts/pregenerate.js --force            # sinh lại cả key đã có
 *
 * Cách làm: bật server.js ở cổng tạm rồi POST y hệt UI → cache write-through
 * của server tự ghi file. Đảm bảo retrieval/normalize/validate giống lúc demo.
 * ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawn } = require("child_process");
const cache = require("../cache");
// Một nguồn duy nhất cho khoá + tập đáp án (multi_select: mọi tổ hợp) — trùng với bộ nhớ phía UI.
const { answersFor } = require("../../js/ai-memory.js");

const JS_DIR = path.resolve(__dirname, "..", "..", "js");
const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : def; };
const QUESTIONS = String(arg("--questions", "Q01,Q02,Q03")).split(",").map(s => s.trim()).filter(Boolean);
const PERSONAS = ["nonit", "dev", "dataai"];
const FORCE = argv.includes("--force");
const CONCURRENCY = Number(arg("--concurrency", 4));
const port = Number(process.env.PREGEN_PORT || 8795);
const base = `http://127.0.0.1:${port}`;

function loadBrowserData(file, key) {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(JS_DIR, file), "utf8"), ctx);
  return ctx.window[key];
}

function makeRequest(q, persona, personaStyle, mode, answer) {
  const question = { id: q.id, topic: q.topic, stem: q.stem, options: q.options, correct: q.correct, question_type: q.question_type || "single_choice", anchors: q.anchors || [], anchor_confidence: q.anchor_confidence || "none" };
  if (mode === "hint") return { mode, persona, persona_style: personaStyle, question: { id: q.id, topic: q.topic, stem: q.stem, options: q.options } };
  return { mode, persona, persona_style: personaStyle, question, learner_answer: answer, attempt: 1, hint_viewed: false, history: [] };
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`${base}/api/health`); if (r.ok) return r.json(); } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error("server không khởi động được");
}

async function pool(items, worker, n) {
  let i = 0; const results = [];
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; results[idx] = await worker(items[idx], idx); }
  }));
  return results;
}

async function main() {
  const bank = loadBrowserData("data.questions.js", "QUESTION_BANK");
  const personas = loadBrowserData("data.personas.js", "PERSONAS");
  const targets = QUESTIONS.map(id => bank.find(q => q.id === id)).filter(Boolean);
  if (targets.length !== QUESTIONS.length) console.warn("Không tìm thấy:", QUESTIONS.filter(id => !bank.find(q => q.id === id)).join(", "));

  const jobs = [];
  for (const q of targets) for (const pk of PERSONAS) {
    const style = personas[pk].style;
    jobs.push({ label: `${q.id} ${pk.padEnd(6)} hint`, req: makeRequest(q, pk, style, "hint") });
    for (const ans of answersFor(q)) jobs.push({ label: `${q.id} ${pk.padEnd(6)} ${ans}`, req: makeRequest(q, pk, style, "diagnose", ans) });
  }
  const todo = FORCE ? jobs : jobs.filter(j => !cache.get(cache.cacheKey(j.req, require("../model").activeScope())));
  console.log(`${targets.map(q => q.id).join(", ")} × ${PERSONAS.length} persona → ${jobs.length} key, cần sinh ${todo.length}${FORCE ? " (force)" : ""}`);
  if (!todo.length) { console.log("Cache đã đủ. Dùng --force để sinh lại."); return; }

  const env = Object.assign({}, process.env, { PORT: String(port), EXPLAIN_CACHE: "on" });
  if (FORCE) env.EXPLAIN_CACHE_SKIP_READ = "1";
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env, stdio: ["ignore", "ignore", "pipe"] });
  let stderr = ""; child.stderr.on("data", b => { stderr += b.toString(); });
  const t0 = Date.now(); let ok = 0, fail = 0, tokIn = 0, tokOut = 0;
  try {
    const health = await waitForServer();
    if (!health.configured || health.provider === "mock") throw new Error(`provider "${health.provider}" chưa cấu hình hoặc là mock — không sinh cache.`);
    console.log(`provider ${health.provider} · model ${health.generation?.model || "?"} · concurrency ${CONCURRENCY}\n`);
    await pool(todo, async job => {
      const t = Date.now();
      try {
        const r = await fetch(`${base}/api/explain`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(job.req) });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        ok++; tokIn += body.usage?.input_tokens || 0; tokOut += body.usage?.output_tokens || 0;
        const v = body.validation?.length ? ` ⚠ ${body.validation.join("; ")}` : "";
        const cite = body.parsed?.citation ? ` [${body.parsed.citation.code}]` : (job.req.mode === "diagnose" ? " [no-source]" : "");
        console.log(`ok   ${job.label.padEnd(28)} ${String(Date.now() - t).padStart(6)}ms${cite}${v}`);
      } catch (e) { fail++; console.log(`FAIL ${job.label.padEnd(28)} ${e.message}`); }
    }, CONCURRENCY);
  } finally {
    child.kill();
    if (stderr.trim()) process.stderr.write(stderr);
  }
  const st = cache.status();
  console.log(`\nXong: ${ok} ok · ${fail} lỗi · ${Math.round((Date.now() - t0) / 1000)}s · token vào/ra ${tokIn}/${tokOut}`);
  console.log(`Cache: ${st.entries} key → ${st.file}`);
  console.log(`Theo câu: ${JSON.stringify(st.questions)}`);
  if (fail) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });

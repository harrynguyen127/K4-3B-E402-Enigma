/* =====================================================================
 * AI CLIENT — mắt xích quyết định trung tâm của sản phẩm.
 *
 * Giao diện duy nhất:  AI.explain(request) -> Promise<ExplainResponse>
 * Schema request/response: xem codebase/AI_CONTRACT.md
 *
 * Ba đường xử lý của explain():
 *   1. BỘ NHỚ (mặc định): diagnose/hint của hồ sơ nonit|dev|dataai đọc từ
 *      window.AIMemory (nội dung AI đã sinh một lần, xem js/ai-memory.js) —
 *      KHÔNG có lời gọi mạng nào.
 *   2. MOCK: mục chưa có trong bộ nhớ (và unknown/followup/probe) dùng
 *      mockExplain() — nội dung fallback cục bộ khi chưa có kết quả suy luận.
 *   3. LIVE: chỉ khi forceLive (bộ nhớ đang sinh) hoặc dev bật LIVE trong ⚙:
 *      POST {endpoint}/api/explain → server/server.js → model đã cấu hình.
 *
 * Mọi lời gọi đều đi qua Trace (prompt + raw response + latency) — yêu cầu CP3.
 * ===================================================================== */
window.AI = (function () {
  const SETTINGS_KEY = "enigma_ai_settings_v1";
  // Endpoint mặc định = origin của trang đang mở (http://localhost:8787 hoặc link tunnel);
  // khi mở bằng file:// thì rơi về localhost. Người xem qua tunnel không cần chỉnh ⚙.
  const sameOrigin = /^https?:$/.test(location.protocol) ? location.origin : "http://localhost:8787";
  // Demo trên nút "Kiểm tra" KHÔNG được gọi API AI thật — đọc bộ nhớ AI đã sinh sẵn (AIMemory),
  // mục nào chưa có thì rơi về mockExplain() (q.reference / HINT_BANK). "live" vẫn còn để nhóm dev
  // bật tay khi cần test pipeline thật, nhưng mặc định và mọi cấu hình cũ đều bị ép về "mock".
  const defaults = { provider: "mock", endpoint: sameOrigin };
  let settings = Object.assign({}, defaults);
  try { settings = Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch (_) {}
  // Cài đặt cũ lưu localhost nhưng trang đang mở từ origin khác (tunnel) → dùng origin hiện tại.
  if (/^https?:$/.test(location.protocol) && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(settings.endpoint || "") && settings.endpoint !== location.origin) settings.endpoint = location.origin;
  // Ép mọi cấu hình đã lưu trước đó (live/fake_live) về mock cho bản demo này.
  if (settings.provider !== "mock") settings.provider = "mock";

  function saveSettings(patch) {
    settings = Object.assign({}, settings, patch);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
    return settings;
  }

  /* ---------------- MOCK PROVIDER ---------------- */
  const HINTS = {
    nonit: "Xác định thuật ngữ hoặc điều kiện chính mà câu hỏi đang kiểm tra, rồi đối chiếu từng lựa chọn với đúng điều kiện đó; không suy luận từ ấn tượng chung.",
    dev: "Xác định thành phần của request, pipeline hoặc measurement đang được kiểm tra, rồi đối chiếu xem lựa chọn của bạn có giữ đúng contract và điều kiện đó không.",
    dataai: "Xác định khái niệm, biến hoặc giả định đang được kiểm tra, rồi đối chiếu quan hệ giữa các yếu tố trong đề với tiêu chí đánh giá tương ứng."
  };

  function mockExplain(req) {
    const q = window.QUESTION_BANK.find(x => x.id === req.question.id) || req.question;
    const persona = req.persona;

    // ② Chưa rõ hồ sơ → hỏi lại, không đoán.
    if (persona === "unknown") {
      return {
        mode: req.mode,
        verdict: req.learner_answer ? (sameAnswer(req.learner_answer, q.correct, q.question_type) ? "correct" : "incorrect") : "no_answer",
        needs_clarification: true,
        clarifying_question: "Trước khi giải thích, cho mình biết công việc hằng ngày của bạn gần với nhóm nào nhất?",
        clarifying_options: Object.values(window.PERSONAS).filter(p => p.clarifier_option).map(p => ({ persona: p.key, label: p.clarifier_option })),
        misconception: null, hint: null, explanation: null, citation: null,
        no_source_note: null, followup_answer: null,
        safety: { refused: false, reason: null }
      };
    }

    // ③ Câu hỏi thêm ngoài phạm vi (mock chỉ bắt vài từ khoá đơn giản).
    if (req.mode === "followup") {
      const t = (req.followup_text || "").toLowerCase();
      const outOfScope = /(deadline|hạn nộp|nộp bài|điểm|lịch học|link|zoom|github|system prompt|ignore|bỏ qua hướng dẫn|model gì|mô hình nào)/.test(t);
      if (outOfScope) {
        return baseResp(req, q, {
          followup_answer: "Câu này nằm ngoài phạm vi phần luyện tập (mình chỉ hỗ trợ nội dung kiến thức của câu hỏi đang làm). Về lịch, điểm, nộp bài hay cấu hình hệ thống, bạn hỏi TA hoặc xem thông báo lớp nhé.",
          safety: { refused: true, reason: "out_of_scope" }
        });
      }
      return baseResp(req, q, {
        followup_answer: "Trả lời câu hỏi thêm theo góc nhìn " + window.PERSONAS[persona].name + ": " + (q.reference ? q.reference[persona] : "(chưa có nội dung suy luận)")
      });
    }

    // Kiểm tra lời giải thích lại của học viên (probe) — mock chỉ đếm từ khoá.
    if (req.mode === "probe") {
      const txt = (req.learner_explanation || "").trim();
      const ok = txt.length >= 40;
      return baseResp(req, q, {
        probe_result: ok ? "understood" : "needs_more",
        followup_answer: ok
          ? "Lời giải thích của bạn đã nêu được ý chính."
          : "Bạn thử nói rõ hơn: vì sao các đáp án còn lại không đúng trong bối cảnh của câu hỏi?"
      });
    }

    // mode = "diagnose": chẩn đoán lỗi + gợi ý + giải thích theo persona.
    const wrong = req.learner_answer && !sameAnswer(req.learner_answer, q.correct, q.question_type);
    return baseResp(req, q, {
      misconception: wrong ? mockMisconception(req, q) : null,
      hint: wrong ? HINTS[persona] : null,
      explanation: q.reference ? q.reference[persona] : "(chưa có nội dung suy luận)"
    });
  }

  function mockMisconception(req, q) {
    const selected = String(req.learner_answer || "").toUpperCase().split(/[\s,;|]+/).filter(Boolean);
    const correct = String(q.correct || "").toUpperCase().split(/[\s,;|]+/).filter(Boolean);
    if (q.question_type === "multi_select") {
      const extra = selected.filter(k => !correct.includes(k));
      if (!extra.length && selected.length < correct.length) {
        return `Bạn mới chọn ${selected.join(", ")} trong khi đề yêu cầu chọn tất cả; lựa chọn hiện tại chưa bao quát đủ các biến cần kiểm tra.`;
      }
      if (extra.length) return `Tập lựa chọn có ${extra.join(", ")} chưa phù hợp với điều kiện của câu hỏi; hãy kiểm tra lại từng yếu tố.`;
    }
    const label = selected.length === 1 ? q.options?.[selected[0]] : null;
    return `Bạn chọn ${selected.join(", ")}${label ? ` — “${label}”` : ""}; lựa chọn này chưa khớp yêu cầu chính của câu hỏi.`;
  }

  function baseResp(req, q, patch) {
    const anchor = (q.anchors && q.anchors[0]) || null;
    return Object.assign({
      mode: req.mode,
      verdict: req.learner_answer ? (sameAnswer(req.learner_answer, q.correct, q.question_type) ? "correct" : "incorrect") : "no_answer",
      needs_clarification: false, clarifying_question: null, clarifying_options: null,
      misconception: null, hint: null, explanation: null,
      citation: anchor ? { code: anchor.code, quote: anchor.quote, confidence: q.anchor_confidence } : null,
      no_source_note: anchor ? null : "Transcript các buổi trong data pack chưa có đoạn nói trực tiếp về khái niệm này, nên phần giải thích được suy luận theo câu hỏi và hồ sơ, chưa có trích dẫn.",
      followup_answer: null, probe_result: null,
      safety: { refused: false, reason: null }
    }, patch);
  }

  function sameAnswer(a, b, type) {
    if (a == null || b == null || String(a).trim() === "") return false;
    const tokens = v => String(v).toUpperCase().split(/[\s,;|]+/).filter(Boolean);
    const aa = tokens(a), bb = tokens(b);
    if (type === "ordering") return aa.join(",") === bb.join(",");
    return aa.sort().join(",") === bb.sort().join(",");
  }

  /* ---------------- LIVE PROVIDER ---------------- */
  async function liveExplain(req) {
    const url = settings.endpoint.replace(/\/$/, "") + "/api/explain";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req)
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { msg = JSON.parse(text).error || text; } catch (_) {}
      throw new Error("Server " + res.status + ": " + msg);
    }
    // Server trả { prompt, raw_response, parsed } để UI ghi trace đầy đủ.
    return JSON.parse(text);
  }

  /* ---------------- BỘ NHỚ AI ---------------- */
  /** Trúng → phản hồi đã parse lấy từ bộ nhớ; trượt → null (rơi về mock). Không bao giờ gọi mạng. */
  function memoryLookup(req) {
    const M = window.AIMemory;
    if (!M || !["diagnose", "hint"].includes(req.mode) || !M.PERSONAS.includes(req.persona)) return null;
    return M.get(req.mode, req.question, req.persona, req.learner_answer);
  }

  /* ---------------- PUBLIC ---------------- */
  async function explain(request, opts) {
    // opts.forceLive: chỉ dùng khi sinh bộ nhớ AI (tab Tech / lần đầu vào Demo) — luôn gọi
    // server/API thật, bất kể provider là mock. Mọi lượt trả lời còn lại đi qua bộ nhớ hoặc mock.
    const useLive = settings.provider === "live" || Boolean(opts && opts.forceLive);
    const memHit = useLive ? null : memoryLookup(request);
    const mode = useLive ? "LIVE" : memHit ? "MEMORY" : "MOCK";
    const traceMode = useLive ? "API" : mode;
    const t0 = performance.now();
    const traceProvider = useLive ? settings.endpoint : memHit ? "ai-memory" : "mock";
    const traceId = window.Trace.start({ mode: traceMode, provider: traceProvider, request });
    try {
      let parsed, raw = null, prompt = null;
      if (useLive) {
        const out = await liveExplain(request);
        parsed = out.parsed; raw = out.raw_response; prompt = out.prompt;
        if (out.generation) parsed._generation = out.generation;
        // Số liệu cho bảng log "Sinh trực tiếp": token, chi phí ước tính, prompt đầy đủ, phản hồi thô.
        parsed._usage = out.usage || null;
        parsed._cost = out.cost || null;
        parsed._prompt = out.prompt || null;
        parsed._raw = out.raw_response ?? null;
        parsed._prompt_version = out.prompt_version || null;
        parsed._validation = out.validation || null;
        parsed._server_latency_ms = out.latency_ms ?? null;
      } else if (memHit) {
        const g = memHit.generation || {};
        parsed = Object.assign({}, memHit.parsed, {
          _generation: Object.assign({}, g, { cached: true, cached_at: memHit.cached_at, personalization: "Theo persona của học viên · lấy từ bộ nhớ AI" })
        });
        raw = JSON.stringify(memHit.parsed);
        prompt = `[BỘ NHỚ AI — không gọi model; nội dung sinh lúc ${memHit.cached_at || "?"} bởi ${g.model || "model đã cấu hình"}]`;
      } else {
        await new Promise(r => setTimeout(r, 500 + Math.random() * 400)); // giả lập độ trễ
        parsed = mockExplain(request);
        raw = JSON.stringify(parsed);
        prompt = "[MOCK — không gửi prompt tới model]";
      }
      const latency_ms = Math.round(performance.now() - t0);
      window.Trace.finish(traceId, { raw_response: raw, parsed, latency_ms, prompt });
      return Object.assign({ _trace_id: traceId, _latency_ms: latency_ms, _mode: mode }, parsed);
    } catch (err) {
      window.Trace.finish(traceId, { error: String(err.message || err), latency_ms: Math.round(performance.now() - t0) });
      throw err;
    }
  }

  /** Phản hồi 👍/👎 của học viên về một khối AI. Luôn ghi trace; gửi server khi LIVE. */
  async function sendFeedback(fb) {
    const payload = Object.assign({ ui_mode: settings.provider === "live" ? "LIVE" : "MOCK" }, fb);
    if (fb.trace_id) window.Trace.feedback(fb.trace_id, payload);
    if (settings.provider !== "live") return { ok: true, stored: "trace_only" };
    try {
      const res = await fetch(settings.endpoint.replace(/\/$/, "") + "/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      return { ok: res.ok, stored: res.ok ? "server+trace" : "trace_only" };
    } catch (_) { return { ok: false, stored: "trace_only" }; }
  }

  /** Sự kiện hành vi (mở gợi ý, mở giải thích đầy đủ) — ghi trace + gửi server khi LIVE. */
  function logEvent(ev) {
    const payload = Object.assign({ ui_mode: settings.provider === "live" ? "LIVE" : "MOCK", at: new Date().toISOString() }, ev);
    window.Trace.event(payload);
    if (settings.provider !== "live") return;
    fetch(settings.endpoint.replace(/\/$/, "") + "/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
  }

  /** Thông tin prompt/model từ server cho panel cấu hình (GET /api/prompt-info). */
  async function promptInfo() {
    const res = await fetch(settings.endpoint.replace(/\/$/, "") + "/api/prompt-info");
    if (!res.ok) throw new Error("Server " + res.status);
    return res.json();
  }

  /** Gợi ý trước khi nộp: bộ nhớ AI → HINT_BANK (script sinh offline) → gợi ý mock cố định. */
  function precomputedHint(questionId, persona) {
    const mem = window.AIMemory && window.AIMemory.get("hint", { id: questionId }, persona);
    if (mem && mem.parsed.hint) return { hint: mem.parsed.hint, flagged: false, meta: Object.assign({}, mem.generation || {}, { from_memory: true, at: mem.cached_at }) };
    const saved = window.HINT_BANK?.[questionId]?.[persona];
    if (saved?.hint) return { hint: saved.hint, flagged: saved.flagged, meta: window.HINT_BANK_META || {} };
    if (settings.provider === "mock") return { hint: HINTS[persona] || null, flagged: false, meta: { model: "mock rule-based", simulated: true } };
    return { hint: null, flagged: false, meta: window.HINT_BANK_META || {} };
  }

  return {
    explain, explainLive: (request) => explain(request, { forceLive: true }),
    sendFeedback, logEvent, precomputedHint, promptInfo,
    settings: () => Object.assign({}, settings), saveSettings,
    isLive: () => settings.provider === "live",
    mode: () => settings.provider === "live" ? "LIVE" : "MOCK"
  };
})();

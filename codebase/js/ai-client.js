/* =====================================================================
 * AI CLIENT — mắt xích quyết định trung tâm của sản phẩm.
 *
 * Giao diện duy nhất:  AI.explain(request) -> Promise<ExplainResponse>
 * Schema request/response: xem codebase/AI_CONTRACT.md
 *
 * Pipeline giao diện luôn dùng "live": POST {endpoint}/api/explain
 * → server/server.js → Qwen local qua Ollama. Mock chỉ còn là adapter nội bộ
 * phục vụ smoke test, không còn là lựa chọn trên giao diện demo.
 *
 * Mọi lời gọi đều đi qua Trace (prompt + raw response + latency) — yêu cầu CP3.
 * ===================================================================== */
window.AI = (function () {
  const SETTINGS_KEY = "enigma_ai_settings_v1";
  const defaults = { provider: "live", endpoint: "http://localhost:8787" };
  let settings = Object.assign({}, defaults);
  try { settings = Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch (_) {}
  // Nâng cấp cấu hình trình duyệt từ các bản demo cũ sang pipeline local thật.
  if (settings.provider === "fake_live" || settings.provider === "mock") settings.provider = "live";

  function saveSettings(patch) {
    settings = Object.assign({}, settings, patch);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
    return settings;
  }

  /* ---------------- MOCK PROVIDER ---------------- */
  const HINTS = {
    nonit: "Hãy nghĩ đến một tình huống đời thường tương tự: điều gì khiến câu trả lời trở nên đáng tin hơn?",
    dev: "Hãy vẽ pipeline request → xử lý → response trong đầu: bước nào đang bị bỏ qua ở đáp án bạn chọn?",
    dataai: "Phân biệt cái gì nằm trong tham số mô hình và cái gì được cung cấp lúc inference — đáp án bạn chọn nhầm ở chỗ nào?"
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
        followup_answer: "[MOCK] Trả lời câu hỏi thêm theo góc nhìn " + window.PERSONAS[persona].name + ": " + (q.reference ? q.reference[persona] : "(chưa có lời giải mẫu)")
      });
    }

    // Kiểm tra lời giải thích lại của học viên (probe) — mock chỉ đếm từ khoá.
    if (req.mode === "probe") {
      const txt = (req.learner_explanation || "").trim();
      const ok = txt.length >= 40;
      return baseResp(req, q, {
        probe_result: ok ? "understood" : "needs_more",
        followup_answer: ok
          ? "[MOCK] Lời giải thích của bạn đã nêu được ý chính. (Bản thật: AI đối chiếu với lời giải mẫu và transcript.)"
          : "[MOCK] Bạn thử nói rõ hơn: vì sao các đáp án còn lại không đúng trong bối cảnh của câu hỏi?"
      });
    }

    // mode = "diagnose": chẩn đoán lỗi + gợi ý + giải thích theo persona.
    const wrong = req.learner_answer && !sameAnswer(req.learner_answer, q.correct, q.question_type);
    return baseResp(req, q, {
      misconception: wrong ? mockMisconception(req, q) : null,
      hint: wrong ? HINTS[persona] : null,
      explanation: q.reference ? q.reference[persona] : "(chưa có lời giải mẫu)"
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
      no_source_note: anchor ? null : "Transcript các buổi trong data pack chưa có đoạn nói trực tiếp về khái niệm này, nên phần giải thích dựa trên lời giải mẫu của nhóm, chưa có trích dẫn.",
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

  /* ---------------- PUBLIC ---------------- */
  async function explain(request) {
    const mode = settings.provider === "live" ? "LIVE" : "MOCK";
    const traceMode = settings.provider === "live" ? "API" : mode;
    const t0 = performance.now();
    const traceProvider = settings.provider === "live" ? settings.endpoint : "mock";
    const traceId = window.Trace.start({ mode: traceMode, provider: traceProvider, request });
    try {
      let parsed, raw = null, prompt = null;
      if (settings.provider === "live") {
        const out = await liveExplain(request);
        parsed = out.parsed; raw = out.raw_response; prompt = out.prompt;
        if (out.generation) parsed._generation = out.generation;
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

  function precomputedHint(questionId, persona) {
    const saved = window.HINT_BANK?.[questionId]?.[persona];
    if (saved?.hint) return { hint: saved.hint, flagged: saved.flagged, meta: window.HINT_BANK_META || {} };
    if (settings.provider === "mock") return { hint: HINTS[persona] || null, flagged: false, meta: { model: "mock rule-based", simulated: true } };
    return { hint: null, flagged: false, meta: window.HINT_BANK_META || {} };
  }

  return {
    explain, sendFeedback, logEvent, precomputedHint,
    settings: () => Object.assign({}, settings), saveSettings,
    isLive: () => settings.provider === "live",
    mode: () => settings.provider === "live" ? "LIVE" : "MOCK"
  };
})();

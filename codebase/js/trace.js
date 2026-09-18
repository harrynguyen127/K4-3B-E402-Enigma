/* =====================================================================
 * TRACE LOG — ghi vết mọi lời gọi AI (yêu cầu CP3: prompt đầu vào + phản hồi thô).
 * Lưu trong bộ nhớ trang + localStorage; xuất được ra JSONL để bỏ vào eval/.
 * ===================================================================== */
window.Trace = (function () {
  const KEY = "enigma_trace_v1";
  let entries = [];
  try { entries = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (_) { entries = []; }
  // Một lần dọn dữ liệu demo cũ: không để trace MOCK/FAKE bị nhầm với
  // các request Ollama thật. Event hành vi và API thật vẫn được giữ lại.
  entries = entries.filter(e => {
    const mode = String(e?.mode || "").toLowerCase();
    const provider = String(e?.provider || "").toLowerCase();
    const model = String(e?.parsed?._generation?.model || e?.parsed?.meta?.model || "").toLowerCase();
    if (mode === "event") return true;
    const isSimulated = mode === "mock" || mode.includes("fake") || provider === "mock" || provider.includes("fake") || model.includes("mock");
    const isLocalOllama = e?.parsed?._generation?.local === true;
    return !isSimulated && isLocalOllama;
  });
  entries.forEach(e => {
    if (Array.isArray(e.events)) {
      e.events = e.events.filter(event => event?.event !== "open_full_explanation");
      if (!e.events.length) delete e.events;
    }
  });
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-200))); } catch (_) {}

  const listeners = [];
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-200))); } catch (_) {}
    listeners.forEach(fn => fn(entries));
  }

  return {
    onChange(fn) { listeners.push(fn); fn(entries); },
    all() { return entries.slice(); },

    /** Bắt đầu một lời gọi. Trả về id để hoàn tất sau. */
    start({ mode, provider, request, prompt }) {
      const id = "call_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      entries.push({
        id, ts: new Date().toISOString(), mode, provider,
        request, prompt: prompt || null,
        raw_response: null, parsed: null, latency_ms: null, error: null,
        eval: null, user_feedback: null
      });
      persist();
      return id;
    },

    finish(id, { raw_response, parsed, latency_ms, error, prompt }) {
      const e = entries.find(x => x.id === id);
      if (!e) return;
      if (prompt) e.prompt = prompt;
      e.raw_response = raw_response ?? null;
      e.parsed = parsed ?? null;
      e.latency_ms = latency_ms ?? null;
      e.error = error ?? null;
      persist();
    },

    /** Đánh giá nhanh của người chấm gắn vào lời gọi (dùng cho lượt đo tay). */
    grade(id, evalObj) {
      const e = entries.find(x => x.id === id);
      if (!e) return;
      e.eval = Object.assign({}, e.eval || {}, evalObj, { graded_at: new Date().toISOString() });
      persist();
    },

    /** Phản hồi của HỌC VIÊN (👍/👎 + lý do) — tách khỏi eval của người chấm. */
    feedback(id, fb) {
      const e = entries.find(x => x.id === id);
      if (!e) return;
      e.user_feedback = Object.assign({}, fb, { at: new Date().toISOString() });
      persist();
    },

    /** Sự kiện hành vi không phải lời gọi AI (mở gợi ý, mở giải thích đầy đủ). Gắn vào lời gọi nếu có trace_id. */
    event(ev) {
      const e = ev.trace_id ? entries.find(x => x.id === ev.trace_id) : null;
      if (e) { (e.events = e.events || []).push(ev); }
      else { entries.push({ id: "evt_" + Date.now().toString(36), ts: ev.at || new Date().toISOString(), mode: "EVENT", provider: null, request: { mode: ev.event, question: { id: ev.question_id }, persona: ev.persona }, event: ev, prompt: null, raw_response: null, parsed: ev, latency_ms: null, error: null, eval: null, user_feedback: null }); }
      persist();
    },

    clear() { entries = []; persist(); },

    exportJSONL() {
      const lines = entries.map(e => JSON.stringify(e)).join("\n");
      const blob = new Blob([lines], { type: "application/x-ndjson" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "trace-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".jsonl";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  };
})();

/* =====================================================================
 * APP — luồng demo CP3 (D2: nộp câu trước → sai → chẩn đoán → gợi ý → giải thích đầy đủ → giải thích lại bằng lời mình)
 * Hành vi theo VLearn thật: "Kiểm tra" = nộp câu, đáp án bị khoá; gợi ý trước-khi-nộp
 * mặc định ẩn (lấy từ HINT_BANK sinh sẵn); sidebar có Tiến độ + Kiến thức đang luyện.
 * Không chứa logic AI; mọi quyết định AI đi qua AI.explain() (js/ai-client.js).
 * ===================================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  // Demo chỉ hiện 3 câu đầu (Q01–Q03); ngân hàng đầy đủ vẫn nằm trong data.questions.js.
  // Số câu hỏi dùng cho demo + bộ nhớ AI: chọn ở tab Tech (mặc định 3, tối đa 20), nhớ trong localStorage.
  const QCOUNT_KEY = "enigma_question_count_v1", QCOUNT_DEFAULT = 3, QCOUNT_MAX = Math.min(20, window.QUESTION_BANK.length);
  const clampCount = (v) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(1, Math.min(QCOUNT_MAX, n)) : QCOUNT_DEFAULT; };
  let questionCount = QCOUNT_DEFAULT;
  try { questionCount = clampCount(localStorage.getItem(QCOUNT_KEY) ?? QCOUNT_DEFAULT); } catch (_) {}
  let BANK = window.QUESTION_BANK.slice(0, questionCount);
  const P = window.PERSONAS;
  const HINTS = window.HINT_BANK || {}, HINT_META = window.HINT_BANK_META || {};
  // Bộ nhớ AI (js/ai-memory.js): sinh một lần bằng model thật, sau đó mọi lượt trả lời chỉ đọc lại.
  const M = window.AIMemory;
  // Ô "Hỏi thêm" gõ tự do không có bộ nhớ sẵn nên phải gọi AI → tắt để demo không có lời gọi nào khi trả lời.
  // Mã và mock vẫn giữ nguyên; đổi thành true để bật lại.
  const FOLLOWUP_ENABLED = false;
  // Ước tính USD mỗi lời gọi (test 18/09/2026: 6 lời gọi ≈ $0.11), chỉ dùng cho hộp xác nhận "Tạo lại".
  const EST_USD_PER_CALL = 0.02;
  // Mỗi câu/persona có một job riêng để prefetch không bị gọi trùng và không
  // ghi nhầm trạng thái khi người dùng chuyển câu trong lúc model còn chạy.
  const hintJobs = Object.create(null);
  const hintJobErrors = Object.create(null);
  // Thông tin model đang chạy, lấy từ GET /api/health (server/model.js quyết định provider).
  let serverGen = null;
  function modelLabel() { return serverGen?.model || "model LIVE"; }
  async function loadServerInfo() {
    // Nút "Kiểm tra" dùng dữ liệu đã gen sẵn (mock), không cần server AI thật.
    // Chỉ hỏi /api/health khi nhóm dev chủ động bật LIVE trong ⚙ (bộ nhớ AI tự hỏi /api/health khi cần sinh).
    if (!window.AI.isLive()) { serverGen = null; renderChrome(); return; }
    try {
      const ep = window.AI.settings().endpoint.replace(/\/$/, "");
      const j = await (await fetch(ep + "/api/health")).json();
      serverGen = j.generation || null;
      if (!j.configured) serverGen = { provider: "chưa cấu hình", model: null };
    } catch (_) { serverGen = null; }
    renderChrome();
  }
  const FB_REASONS = [
    ["level", "Không đúng trình độ của tôi"],
    ["wrong_diagnosis", "Không đúng lỗi tôi mắc"],
    ["too_long", "Dài / khó hiểu"],
    ["wrong_fact", "Sai kiến thức / nguồn"]
  ];

  const state = {
    step: 1,
    persona: null,          // nonit | dev | dataai | mentor | unknown
    qIndex: 0,
    answer: null,
    checked: false,         // đã nộp → khoá đáp án
    hintOpen: false,
    hintViewed: false,
    liveHints: {},          // "Q01:nonit" -> hint sinh trực tiếp bởi model LIVE (chế độ dev bật trong ⚙); demo thường đọc AIMemory
    hintBusy: false,
    hintError: null,
    ai: null,               // ExplainResponse của lần diagnose gần nhất
    busy: false, error: null,
    history: [],            // [{question_id, answer, verdict}]
    tStart: null,
    submitted: {},          // qIndex -> "correct" | "incorrect"
    feedback: {},           // block key -> {rating, reasons[], note, sent}
    stats: { checked: 0, wrong: 0, hint: 0, times: [], up: 0, down: 0 }
  };
  const q = () => BANK[state.qIndex];
  let currentTab = "info";

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pColor = (k) => ({ nonit: "var(--nonit)", dev: "var(--dev)", dataai: "var(--dataai)", mentor: "var(--navy)", unknown: "var(--unknown)" }[k] || "var(--unknown)");
  function show(el, on) { el.hidden = !on; }
  function personaName() { return state.persona ? P[state.persona].name : "Chưa chọn"; }

  function buildRequest(mode, extra) {
    const cur = q();
    return Object.assign({
      mode,
      persona: state.persona,
      persona_style: P[state.persona]?.style || null,
      question: { id: cur.id, topic: cur.topic, stem: cur.stem, options: cur.options, correct: cur.correct, question_type: cur.question_type || "single_choice", anchors: cur.anchors, anchor_confidence: cur.anchor_confidence },
      learner_answer: state.answer,
      attempt: 1,
      hint_viewed: state.hintViewed,
      history: state.history.slice(-5)
    }, extra || {});
  }

  /* ---------- render: stepper / sidebar / mode ---------- */
  function memoryLabel(s) {
    if (s.busy) return `DEMO · AI đang sinh bộ nhớ ${s.have}/${s.total}…`;
    if (s.total && s.have === s.total) return `DEMO · bộ nhớ AI ${s.have}/${s.total}${s.model ? " · " + s.model : ""}`;
    if (s.have) return `DEMO · bộ nhớ AI ${s.have}/${s.total} (phần thiếu dùng lời giải mẫu)`;
    return "DEMO · chưa có bộ nhớ AI (dùng lời giải mẫu của nhóm)";
  }

  function renderChrome() {
    document.querySelectorAll(".step").forEach(s => {
      const n = Number(s.dataset.step);
      s.classList.toggle("active", n === state.step);
      s.classList.toggle("done", n < state.step);
    });
    document.body.classList.add("presentation-mode");
    const isLive = window.AI.isLive();
    const mem = M.status(BANK), memFull = mem.total > 0 && mem.have === mem.total;
    $("mode-badge").className = isLive || (memFull && !mem.busy) ? "mode-badge live" : "mode-badge mock";
    $("mode-label").textContent = isLive
      ? (serverGen ? `LIVE · ${serverGen.provider || "AI"}${serverGen.model ? " · " + serverGen.model : ""}` : "LIVE · đang kiểm tra server…")
      : memoryLabel(mem);

    // tiến độ lượt
    const done = Object.keys(state.submitted).length;
    const okCount = Object.values(state.submitted).filter(v => v === "correct").length;
    $("sb-done").textContent = done; $("sb-total").textContent = `/ ${BANK.length}`; $("sb-progress").style.width = (done / BANK.length * 100) + "%";
    $("sb-score").textContent = done ? `${okCount} đúng · ${done - okCount} sai` : "Chưa nộp câu nào.";

    // kiến thức đang luyện
    const cur = q(), c = cur.concept;
    $("concept-title").textContent = c ? c.title : cur.topic;
    $("concept-summary").textContent = c ? c.summary : "(chưa có tóm tắt)";
    show($("concept-draft"), Boolean(c && c.draft));

    $("sb-profile").style.background = pColor(state.persona);
    $("sb-profile-name").textContent = personaName();
    $("sb-profile-desc").textContent = state.persona ? P[state.persona].short : "Chọn hồ sơ ở bước 1.";

    const s = state.stats;
    $("st-checked").textContent = s.checked; $("st-wrong").textContent = s.wrong; $("st-hint").textContent = s.hint;
    $("st-up").textContent = s.up; $("st-down").textContent = s.down;
    $("st-time").textContent = s.times.length ? Math.round(s.times.reduce((a, b) => a + b, 0) / s.times.length) + " s" : "—";

    $("sb-anchors").innerHTML = cur.anchors.length
      ? `<div class="small">Độ tin cậy nguồn: <b>${cur.anchor_confidence}</b></div>` + cur.anchors.map(a => `<div style="margin-top:6px;"><span class="mono strong">[${a.code}]</span> <span class="small">${esc(a.quote).slice(0, 110)}…</span></div>`).join("")
      : `<span style="color:var(--amber-text)">Transcript <b>không có</b> đoạn về khái niệm này → AI phải nói "chưa có nguồn", không được bịa mã đoạn (lớp ①).</span>`;
  }

  /* ---------- step 1: persona ---------- */
  function renderPersona() {
    $("persona-grid").innerHTML = Object.values(P).map(p => `
      <button class="persona-card ${state.persona === p.key ? "on" : ""}" data-p="${p.key}">
        <div class="name">${p.name}</div>
        <div class="desc">${p.short}</div>
        <span class="tag p-${p.key}">${p.badge}</span>
      </button>`).join("");
    $("persona-grid").querySelectorAll(".persona-card").forEach(b => b.addEventListener("click", () => { state.persona = b.dataset.p; goStep(2); }));
  }

  /* ---------- step 2: quiz ---------- */
  function hintData(persona) {
    // Chế độ LIVE (dev): gợi ý vừa sinh trực tiếp được ưu tiên. Demo thường: precomputedHint → bộ nhớ AI → HINT_BANK → mock.
    const live = state.liveHints[`${q().id}:${persona}`];
    if (live) return live;
    if (window.AI.isLive()) return null;
    return window.AI.precomputedHint(q().id, persona);
  }

  function hintFor() {
    if (M.isBusy() && !window.AI.isLive()) return { text: null, why: "AI đang chuẩn bị bộ nhớ gợi ý, đợi trong giây lát." };
    if (state.persona === "mentor") {
      const found = ["nonit", "dev", "dataai"].map(k => ({ persona: k, data: hintData(k) }));
      const rows = found.map(x => x.data?.hint ? `${P[x.persona].name}: ${x.data.hint}` : null).filter(Boolean);
      return rows.length === 3
        ? { text: rows.join("\n"), flagged: found.some(x => x.data?.flagged), meta: found[0].data?.meta }
        : { text: null, why: "Chưa có đủ 3 gợi ý cho câu này." };
    }
    if (!state.persona || state.persona === "unknown") return { text: null, why: "Chọn hồ sơ (Non-IT / IT-Dev / Data-AI) để nhận gợi ý phù hợp." };
    const h = hintData(state.persona);
    if (!h || !h.hint) return { text: null, why: window.AI.isLive() ? "Model chưa trả về gợi ý." : (HINT_META.generated_at ? "Chưa có gợi ý cho câu này." : "Chưa có gợi ý Mock cho câu này.") };
    return { text: h.hint, flagged: h.flagged, meta: h.meta };
  }

  function renderQuiz() {
    const cur = q(), n = state.qIndex + 1;
    $("q-counter").textContent = `Câu ${n} / ${BANK.length}`;
    $("q-progress").style.width = (n / BANK.length * 100) + "%";
    $("q-diff").textContent = "Độ khó: " + cur.difficulty;
    $("q-pills").innerHTML = BANK.map((it, i) => {
      let cls = "q-pill"; if (i === state.qIndex) cls += " current"; else if (state.submitted[i] === "correct") cls += " ok"; else if (state.submitted[i] === "incorrect") cls += " bad";
      return `<button class="${cls}" data-i="${i}" title="${esc(it.id + " · " + it.topic)}">${i + 1}</button>`;
    }).join("");
    $("q-pills").querySelectorAll(".q-pill").forEach(b => b.onclick = () => { if (state.busy) return; state.qIndex = Number(b.dataset.i); resetQuestion(); goStep(2); });

    $("q-stem").textContent = cur.stem;
    const locked = state.checked || state.busy;
    const multi = cur.question_type && cur.question_type !== "single_choice";
    const selected = new Set(String(state.answer || "").toUpperCase().split(/[\s,;|]+/).filter(Boolean));
    const correctSet = new Set(String(cur.correct || "").toUpperCase().split(/[\s,;|]+/).filter(Boolean));
    const typeNote = multi
      ? `<div class="small" style="margin-bottom:8px;color:var(--muted)">${cur.question_type === "ordering" ? "Chọn các bước theo thứ tự bằng cách bấm lần lượt." : "Có thể chọn nhiều phương án."}</div>`
      : "";
    $("q-options").innerHTML = typeNote + Object.entries(cur.options).map(([k, v]) => {
      let cls = "option"; if (locked) cls += " locked";
      if (state.checked && state.ai && !state.ai.needs_clarification) { if (correctSet.has(k)) cls += " correct"; if (selected.has(k) && !correctSet.has(k)) cls += " wrong"; }
      else if (selected.has(k)) cls += " selected";
      return `<button class="${cls}" data-k="${k}" ${locked ? "disabled" : ""}><span class="badge">${k}</span><span>${esc(v)}</span></button>`;
    }).join("");
    $("q-options").querySelectorAll(".option").forEach(b => b.addEventListener("click", () => {
      if (state.checked) return;
      const k = b.dataset.k;
      if (!multi) state.answer = k;
      else {
        const current = String(state.answer || "").split(/[,\s]+/).filter(Boolean);
        const at = current.indexOf(k);
        if (at >= 0) current.splice(at, 1); else current.push(k);
        state.answer = cur.question_type === "ordering" ? current.join(", ") : current.sort().join(", ");
      }
      render();
    }));

    // gợi ý trước khi nộp — mặc định ẩn
    const hb = $("hint-box"); show(hb, state.hintOpen);
    $("hint-toggle-label").textContent = state.hintOpen ? "Ẩn gợi ý" : "Xem gợi ý";
    if (state.hintOpen) {
      const h = hintFor();
      hb.className = "hint-box" + (h.text ? "" : " empty");
      hb.innerHTML = state.hintBusy
        ? `<span class="loading"><i></i><i></i><i></i> ${esc(modelLabel())} đang sinh gợi ý theo hồ sơ…</span>`
        : state.hintError
          ? `<span style="color:var(--red)">Không sinh được gợi ý: ${esc(state.hintError)}</span>`
          : h.text
            ? `<b>Gợi ý (${esc(personaName())}):</b><span class="hint-text">${esc(h.text)}</span><span class="src">${h.meta?.generated_live ? "Vừa sinh trực tiếp lúc " + new Date(h.meta.at).toLocaleTimeString("vi-VN") + " bằng" : window.AI.isLive() ? "Sinh trực tiếp bằng" : "AI sinh sẵn"} · ${esc(h.meta?.model || HINT_META.model || modelLabel())}</span>`
            : esc(h.why);
    }

    $("btn-prev").disabled = state.qIndex === 0 || state.busy;
    const check = $("btn-check");
    if (state.busy) { check.textContent = "Đang gửi…"; check.disabled = true; }
    else if (state.checked && state.ai && !state.ai.needs_clarification) { check.textContent = state.qIndex < BANK.length - 1 ? "Câu tiếp theo →" : "Hoàn thành lượt"; check.disabled = state.qIndex >= BANK.length - 1; }
    else if (M.isBusy()) { check.textContent = "AI đang chuẩn bị nội dung…"; check.disabled = true; }
    else { check.textContent = "Kiểm tra"; check.disabled = !state.answer; }
    if (!state.tStart) state.tStart = Date.now();
  }

  /* ---------- feedback học viên ---------- */
  function fbHtml(key) {
    const f = state.feedback[key] || {};
    const thanks = f.sent ? `<span class="thanks">✔ Đã ghi nhận${f.stored === "server+trace" ? " (đã lưu server)" : ""}.</span>` : "";
    return `<div class="fb" data-key="${key}">
      <div class="fb-row"><span>Phản hồi này có phù hợp với bạn?</span>
        <button class="fb-btn ${f.rating === "up" ? "on-up" : ""}" data-r="up">👍</button>
        <button class="fb-btn ${f.rating === "down" ? "on-down" : ""}" data-r="down">👎</button>
        ${thanks}
      </div>
    </div>`;
  }
  function wireFeedback(root, meta) {
    root.querySelectorAll(".fb[data-key]").forEach(box => {
      const key = box.dataset.key; const f = state.feedback[key] = state.feedback[key] || { reasons: [] };
      box.querySelectorAll(".fb-btn").forEach(b => b.onclick = async () => {
        if (f.sending) return;
        f.sending = true;
        const prev = f.sent ? f.rating : null;
        const next = prev === b.dataset.r ? null : b.dataset.r;  // bấm lại nút đang chọn → bỏ chọn
        const m = meta(key);
        try {
          const r = await window.AI.sendFeedback({ trace_id: m.trace_id, question_id: q().id, persona: m.persona || state.persona, mode: m.mode, block: m.block, rating: next || "none", reasons: f.reasons, note: f.note || "" });
          f.rating = next; f.sent = Boolean(next); f.stored = r.stored;
          if (prev) state.stats[prev]--;
          if (next) state.stats[next]++;
        } finally { f.sending = false; }
        render();
      });
    });
  }

  /* ---------- step 3: AI ---------- */
  function aiHeader(title, kind, ai, personaKey = state.persona) {
    const mode = ai?._mode || window.AI.mode();
    const visibleMode = { LIVE: "API", MEMORY: "AI · bộ nhớ" }[mode] || mode;
    const lat = ai?._latency_ms != null ? ` · ${ai._latency_ms} ms` : "";
    return `<div class="head"><span class="tag" style="color:${pColor(personaKey)}"><span class="dot" style="background:${pColor(personaKey)}"></span>${title}</span><span class="meta">${visibleMode}${lat} · ${kind}</span></div>`;
  }
  function citeHtml(ai) {
    if (ai.citation) return `<div class="cite"><span class="code">[${esc(ai.citation.code)}]</span> “${esc(ai.citation.quote)}” <span class="small">· độ tin cậy nguồn: ${esc(ai.citation.confidence || "")}</span></div>`;
    if (ai._mode === "MEMORY" || window.AI.isLive()) return `<div class="cite none"><b>Nguồn kiến thức:</b> Giải thích dựa trên kiến thức nền tảng của chủ đề.</div>`;
    return `<div class="cite none"><b>Chưa có trích dẫn.</b> ${esc(ai.no_source_note || "Tài liệu buổi học chưa có đoạn tương ứng.")}</div>`;
  }
  function generationMetaHtml(ai) {
    const m = ai?._generation;
    if (!m) return "";
    return `<div class="generation-meta small"><b>Cấu hình nội dung cá nhân hóa</b><br>
      Provider: <b>${esc(m.provider || "—")}</b> · API: <b>${esc(m.api || "—")}</b> · Model: <b>${esc(m.model || "—")}</b><br>
      Cá nhân hóa: ${esc(m.personalization || "Theo persona của học viên")}${m.cached ? `<br><b>Sinh sẵn</b> lúc ${esc(String(m.cached_at || "").replace("T", " ").slice(0, 16))} — lượt này không gọi model` : ""}
    </div>`;
  }

  function renderAI() {
    const sec = $("sec-ai");
    if (!state.checked && !state.busy) { show(sec, false); return; }
    show(sec, true);
    if (state.busy && !state.ai) { sec.innerHTML = `<div class="card pad"><div class="loading"><i></i><i></i><i></i> Đã nộp. Đang gửi câu trả lời của bạn tới AI để chẩn đoán…</div></div>`; return; }
    if (state.error) {
      sec.innerHTML = `<div class="card pad"><div class="error-box">Lỗi gọi AI:\n${esc(state.error)}</div><div class="row" style="margin-top:10px;"><button class="btn sm" id="btn-retry-call">Thử lại</button><button class="btn sm ghost" id="btn-open-settings2">Mở cài đặt</button></div></div>`;
      $("btn-retry-call").onclick = () => runDiagnose(); $("btn-open-settings2").onclick = openSettings; return;
    }
    const ai = state.ai; if (!ai) return;
    const cur = q(); const pieces = [];

    if (ai._compare_outputs) {
      const correct = ai.verdict === "correct";
      pieces.push(`<div class="banner ${correct ? "ok" : "bad"}">${correct ? "✔ Chính xác." : "✘ Chưa đúng."} Mentor đang so sánh cùng một đáp án qua ba cách giải thích.</div>`);
      pieces.push(`<div class="card pad stack"><div class="ai-block">${aiHeader("Mentor · So sánh cả 3 hồ sơ", "3 hồ sơ · một lần kiểm tra", ai, "mentor")}
        <div class="small">Gợi ý và lời giải được hiển thị cùng lúc; đáp án đúng và kiến thức cốt lõi không thay đổi giữa các hồ sơ.</div>
        <div class="compare-grid">${ai._compare_outputs.map(row => {
          const out = row.output;
          return `<div class="ai-block">${aiHeader(P[row.persona].name, "gợi ý + giải thích", out, row.persona)}
            ${!correct ? `<div><b>Nhận định lỗi:</b> ${esc(out.misconception || "Chưa có chẩn đoán riêng.")}</div>` : ""}
            <div><b>Gợi ý:</b> ${esc(out.hint || (correct ? "Bạn đã chọn đúng; không cần gợi ý sửa sai." : "AI không trả về gợi ý."))}</div>
            <div><b>Giải thích:</b> ${esc(out.explanation || "AI không trả về lời giải.")}</div>
            ${citeHtml(out)}
            ${fbHtml(`compare-${row.persona}`)}
          </div>`;
        }).join("")}</div>
        <div class="small">Đáp án đúng: <b>${cur.correct}</b> · chấm bằng answer key, không do AI quyết định.</div>
        ${generationMetaHtml(ai._compare_outputs[0]?.output)}
      </div></div>`);
      sec.innerHTML = pieces.join("");
      wireFeedback(sec, (key) => {
        const persona = key.replace("compare-", "");
        const row = ai._compare_outputs.find(x => x.persona === persona);
        return { trace_id: row?.output?._trace_id, persona, mode: "diagnose", block: `compare-${persona}` };
      });
      return;
    }

    if (ai.needs_clarification) {
      pieces.push(`<div class="card pad stack"><div class="ai-block clarify">${aiHeader("Hệ thống chưa rõ hồ sơ của bạn", "② low-confidence → hỏi lại, không đoán", ai)}
        <div>${esc(ai.clarifying_question)}</div>
        <div class="pill-choice">${(ai.clarifying_options || []).map(o => `<button data-p="${o.persona}">${esc(o.label)}</button>`).join("")}</div></div></div>`);
      sec.innerHTML = pieces.join("");
      sec.querySelectorAll(".pill-choice button").forEach(b => b.onclick = () => { state.persona = b.dataset.p; state.ai = null; render(); runDiagnose(); });
      return;
    }

    const correct = ai.verdict === "correct";
    pieces.push(`<div class="banner ${correct ? "ok" : "bad"}">${correct ? "✔ Chính xác. Câu trả lời đã được ghi nhận." : "✘ Chưa đúng — câu trả lời đã được ghi nhận. Xem giải thích cá nhân hóa bên dưới."}</div>`);

    pieces.push(`<div class="card pad stack"><div class="ai-block">${aiHeader("Giải thích — góc nhìn " + personaName(), "hint + explanation", ai)}
      ${!correct ? `<div><b>Nhận định lỗi:</b> ${esc(ai.misconception || "(AI không trả về)")}</div>
      <div><b>Gợi ý:</b> ${esc(ai.hint || "(AI không trả về)")}</div>` : ""}
      <div><b>Giải thích:</b> ${esc(ai.explanation || "(AI không trả về)")}</div>
      ${citeHtml(ai)}
      <div class="small">Đáp án đúng: <b>${cur.correct}</b> — giống nhau cho mọi hồ sơ; chỉ cách giải thích thay đổi. <a href="#" id="lnk-compare">So sánh với hồ sơ khác</a></div>
      ${generationMetaHtml(ai)}
      <div id="compare-out"></div>
      ${fbHtml("explanation")}
    </div></div>`);
    sec.innerHTML = pieces.join("");
    wireFeedback(sec, (key) => ({ trace_id: state.ai?._trace_id, mode: "diagnose", block: key }));
    // Cùng đáp án, hồ sơ khác: ưu tiên nội dung AI trong bộ nhớ (không gọi API), thiếu thì dùng lời giải mẫu của nhóm.
    $("lnk-compare") && ($("lnk-compare").onclick = (e) => { e.preventDefault(); $("compare-out").innerHTML = ["nonit", "dev", "dataai"].filter(k => k !== state.persona).map(k => {
      const hit = M.get("diagnose", cur, k, state.answer), fromAI = Boolean(hit?.parsed?.explanation);
      return `<div class="ai-block" style="margin-top:8px;"><span class="tag" style="color:${pColor(k)}"><span class="dot" style="background:${pColor(k)}"></span>${P[k].name} (${fromAI ? "AI · bộ nhớ" : "lời giải mẫu của nhóm"})</span><div>${esc(fromAI ? hit.parsed.explanation : cur.reference[k])}</div></div>`;
    }).join(""); });
  }

  function recordTime() { if (state.tStart) { state.stats.times.push(Math.round((Date.now() - state.tStart) / 1000)); state.tStart = null; } }

  async function runDiagnose() {
    if (!state.answer || state.busy) return;
    state.busy = true; state.error = null; state.checked = true; render();
    try {
      let ai;
      if (state.persona === "mentor") {
        const outputs = await Promise.all(["nonit", "dev", "dataai"].map(async persona => {
          const req = buildRequest("diagnose");
          req.persona = persona;
          req.persona_style = P[persona].style;
          return { persona, output: await window.AI.explain(req) };
        }));
        ai = {
          verdict: outputs[0].output.verdict,
          needs_clarification: false,
          _mode: outputs[0].output._mode || window.AI.mode(),
          _latency_ms: Math.max(...outputs.map(x => x.output._latency_ms || 0)),
          _compare_outputs: outputs
        };
      } else {
        ai = await window.AI.explain(buildRequest("diagnose"));
      }
      state.ai = ai;
      if (!ai.needs_clarification) {
        if (!(state.qIndex in state.submitted)) {
          state.submitted[state.qIndex] = ai.verdict;
          state.stats.checked += 1; if (ai.verdict !== "correct") state.stats.wrong += 1;
          if (state.hintViewed) state.stats.hint += 1;
        }
        state.history.push({ question_id: q().id, answer: state.answer, verdict: ai.verdict });
        recordTime();
        if (state.step < 3) state.step = 3;
        show($("sec-followup"), FOLLOWUP_ENABLED && state.persona !== "mentor");
      }
    } catch (e) { state.error = e.message; }
    state.busy = false; render();
  }

  async function loadLiveHints() {
    if (!window.AI.isLive() || !state.persona || state.persona === "unknown") return;
    const personas = state.persona === "mentor" ? ["nonit", "dev", "dataai"] : [state.persona];
    const questionId = q().id;
    const keys = personas.map(persona => `${questionId}:${persona}`);

    const syncCurrentStatus = () => {
      const currentPersonas = state.persona === "mentor" ? ["nonit", "dev", "dataai"] : [state.persona];
      const currentKeys = currentPersonas.filter(Boolean).map(persona => `${q().id}:${persona}`);
      state.hintBusy = currentKeys.some(key => Boolean(hintJobs[key]));
      state.hintError = currentKeys.map(key => hintJobErrors[key]).find(Boolean) || null;
    };

    const jobs = personas.map(persona => {
      const key = `${questionId}:${persona}`;
      if (state.liveHints[key]) return Promise.resolve();
      if (hintJobs[key]) return hintJobs[key];

      // buildRequest chạy ngay tại thời điểm vào câu nên request luôn giữ đúng
      // question/persona kể cả khi UI chuyển sang câu khác trước khi model trả lời.
      const req = buildRequest("hint");
      req.persona = persona;
      req.persona_style = P[persona].style;
      const job = window.AI.explain(req).then(output => {
        if (!output.hint) throw new Error(`Model không trả hint cho ${persona}`);
        state.liveHints[key] = {
          hint: output.hint,
          flagged: false,
          meta: output._generation || serverGen || { model: modelLabel() }
        };
        delete hintJobErrors[key];
      }).catch(e => {
        hintJobErrors[key] = e.message || String(e);
      }).finally(() => {
        delete hintJobs[key];
        syncCurrentStatus();
        render();
      });
      hintJobs[key] = job;
      return job;
    });

    syncCurrentStatus();
    render();
    await Promise.all(jobs);
    syncCurrentStatus();
    render();
  }

  async function runFollowup() {
    const txt = ($("followup-text").value || "").trim(); if (!txt) return;
    $("followup-out").innerHTML = `<div class="loading"><i></i><i></i><i></i></div>`;
    try {
      const r = await window.AI.explain(buildRequest("followup", { followup_text: txt }));
      const refused = r.safety && r.safety.refused;
      state.feedback.followup = { reasons: [] };
      $("followup-out").innerHTML = `<div class="ai-block ${refused ? "refuse" : ""}">${aiHeader(refused ? "Ngoài phạm vi — từ chối an toàn" : "Trả lời theo góc nhìn " + personaName(), refused ? "③ " + esc(r.safety.reason || "") : "followup", r)}<div>${esc(r.followup_answer || "(AI không trả về)")}</div>${fbHtml("followup")}</div>`;
      wireFeedback($("followup-out"), () => ({ trace_id: r._trace_id, mode: "followup", block: "followup" }));
    } catch (e) { $("followup-out").innerHTML = `<div class="error-box">${esc(e.message)}</div>`; }
    renderTrace();
  }


  /* ---------- BỘ NHỚ AI (tab Tech) + bảng log ----------
   * Sinh một lần: mỗi mục còn thiếu (câu × hồ sơ × {gợi ý | mọi đáp án}) gọi model thật qua
   * AI.explainLive → server ghi file cache (write-through) → M.put lưu bản sao localStorage.
   * Sau đó "Kiểm tra"/xem gợi ý chỉ đọc M.get, không gọi API. Log lưu localStorage để còn sau F5. */
  const LIVEGEN_KEY = "enigma_livegen_log_v1";
  let genLog = [];
  try { genLog = JSON.parse(localStorage.getItem(LIVEGEN_KEY) || "[]"); } catch (_) { genLog = []; }
  let genOpen = null, promptInfo = null;
  let memNote = null;          // cảnh báo hiển thị ở banner Demo + Tech (thiếu key, server lỗi, localStorage đầy…)
  let memProgress = null;      // { done, total, fail } khi đang sinh
  let autoGenTried = false;    // tự sinh khi vào Demo chỉ thử một lần mỗi lần tải trang
  let appReady = false;
  // System prompt giống nhau ở mọi dòng và đã xem được qua GET /api/prompt-info → không lưu lặp để đỡ đầy localStorage.
  function persistGenLog() { try { localStorage.setItem(LIVEGEN_KEY, JSON.stringify(genLog.slice(-120).map(e => Object.assign({}, e, { system_prompt: null })))); } catch (_) {} }

  async function loadPromptInfo() {
    try { promptInfo = await window.AI.promptInfo(); } catch (_) { promptInfo = null; }
    renderLiveGen();
  }

  /* ---------- chọn provider / model (tab Tech) ----------
   * Đổi trên server lúc chạy (POST /api/config, chỉ provider+model; API key chỉ nằm trong server/.env).
   * Lựa chọn nhớ trong localStorage và tự áp lại khi server khởi động lại. */
  const MODEL_PREF_KEY = "enigma_model_pref_v2";
  let providersInfo = null;
  const apiBase = () => window.AI.settings().endpoint.replace(/\/$/, "");
  function loadPref() { try { return JSON.parse(localStorage.getItem(MODEL_PREF_KEY) || "null"); } catch (_) { return null; } }
  function savePref(p) { try { localStorage.setItem(MODEL_PREF_KEY, JSON.stringify(p)); } catch (_) {} }

  async function postConfig(provider, model) {
    const r = await fetch(apiBase() + "/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Server " + r.status);
    return j;
  }

  function pickerProvider() { return providersInfo?.providers.find(x => x.id === $("mp-provider").value) || null; }

  function fillModels(pid, wanted) {
    const p = providersInfo.providers.find(x => x.id === pid);
    const sel = $("mp-model"), isMock = pid === "mock";
    const cur = wanted || p.default_model;
    const opts = p.models.map(m => `<option value="${esc(m.id)}">${esc(m.label)} · ${esc(m.price)}</option>`);
    if (!isMock && cur && !p.models.some(m => m.id === cur)) opts.push(`<option value="${esc(cur)}">${esc(cur)} (đang cấu hình)</option>`);
    if (!isMock) opts.push('<option value="__custom">Khác… (nhập tên model)</option>');
    sel.innerHTML = opts.join("");
    if (!isMock) sel.value = cur;
    sel.disabled = isMock;
    $("mp-custom").hidden = sel.value !== "__custom";
    updatePickerState();
  }

  function updatePickerState() {
    const p = pickerProvider(), act = providersInfo?.active;
    if (!p) return;
    const busy = M.isBusy();
    $("btn-mp-apply").disabled = !p.configured || busy;
    const missing = !p.configured ? `<span style="color:var(--amber-text)">Thiếu <b>${esc(p.key_env)}</b> trong <b>server/.env</b> (thêm key rồi restart server).</span> ` : "";
    $("mp-status").innerHTML = `${missing}Đang chạy: <b>${esc(act ? act.provider : "—")}</b>${act?.model ? " · <b>" + esc(act.model) + "</b>" : ""}${busy ? " · <i>đang sinh bộ nhớ, chờ xong mới đổi được</i>" : ""}`;
  }

  function renderModelPicker() {
    if (!providersInfo || !$("mp-provider")) return;
    const act = providersInfo.active;
    $("mp-provider").innerHTML = providersInfo.providers.map(p => `<option value="${esc(p.id)}">${esc(p.label)}${p.configured ? "" : " (thiếu key)"}</option>`).join("");
    $("mp-provider").value = providersInfo.providers.some(p => p.id === act.provider) ? act.provider : "mock";
    fillModels($("mp-provider").value, $("mp-provider").value === act.provider ? act.model : null);
  }

  async function applyModelChoice(provider, model) {
    const j = await postConfig(provider, model);
    providersInfo.active = j.active;
    savePref({ provider: j.active.provider, model: j.active.model });
    serverGen = j.generation || serverGen;
    memNote = null;
    await loadPromptInfo();
    try { await M.sync(apiBase(), BANK); } catch (_) {}
    renderModelPicker();
    render();
  }

  async function loadProviders() {
    try { providersInfo = await (await fetch(apiBase() + "/api/providers")).json(); } catch (_) { providersInfo = null; }
    if (!providersInfo || !providersInfo.providers) { providersInfo = null; $("mp-status").textContent = "Không đọc được /api/providers (server chưa chạy hoặc là bản cũ, cần restart)."; return; }
    const pref = loadPref(), act = providersInfo.active;
    if (pref && (pref.provider !== act.provider || pref.model !== act.model)) {
      try { await applyModelChoice(pref.provider, pref.model); return; } catch (_) { /* thiếu key/không hợp lệ: giữ cấu hình server */ }
    }
    renderModelPicker();
  }

  function genRequest(question, persona, mode, learnerAnswer, noCache) {
    return {
      mode, persona, persona_style: P[persona].style,
      question: { id: question.id, topic: question.topic, stem: question.stem, options: question.options, correct: question.correct, question_type: question.question_type || "single_choice", anchors: question.anchors, anchor_confidence: question.anchor_confidence },
      learner_answer: mode === "hint" ? null : learnerAnswer,
      attempt: 1, hint_viewed: false, history: [],
      options: { no_cache: Boolean(noCache) }   // true = "Tạo lại": bỏ qua cache server, luôn gọi model
    };
  }

  function outputText(mode, out) {
    if (!out) return "";
    if (mode === "hint") return out.hint || "";
    return [out.misconception && `Nhận định lỗi: ${out.misconception}`, out.hint && `Gợi ý: ${out.hint}`, out.explanation && `Giải thích: ${out.explanation}`].filter(Boolean).join("\n");
  }

  /** Một lời gọi tới server cho một mục bộ nhớ; ghi một dòng vào genLog. Trả { entry, out } (out = null nếu lỗi). */
  async function runOneGen(item, noCache) {
    const { question, persona, mode, answer: learnerAnswer } = item;
    const entry = {
      id: "gen_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: new Date().toISOString(), question_id: question.id, persona, mode,
      learner_answer: mode === "hint" ? null : learnerAnswer,
      status: "running", model: serverGen?.model || null, provider: serverGen?.provider || null,
      api: serverGen?.api || null, effort: serverGen?.effort || null, thinking: serverGen?.thinking || null, output_format: serverGen?.output_format || null, endpoint: serverGen?.endpoint || null,
      prompt_version: null, system_prompt: null, user_prompt: null, raw_response: null, output: null, output_text: "",
      usage: null, cost: null, latency_ms: null, cached: false, validation: null, error: null
    };
    genLog.push(entry); persistGenLog(); renderLiveGen();
    const t0 = performance.now();
    let out = null;
    try {
      out = await window.AI.explainLive(genRequest(question, persona, mode, learnerAnswer, noCache));
      const g = out._generation || {};
      Object.assign(entry, {
        status: "ok", model: out._usage?.model || g.model || entry.model, provider: g.provider || entry.provider, api: g.api || entry.api,
        effort: g.effort || entry.effort, endpoint: g.endpoint || entry.endpoint, cached: Boolean(g.cached),
        prompt_version: out._prompt_version, system_prompt: out._prompt?.system || null, user_prompt: out._prompt?.user || null,
        raw_response: out._raw, usage: out._usage, cost: out._cost, latency_ms: out._server_latency_ms ?? out._latency_ms ?? Math.round(performance.now() - t0),
        validation: out._validation,
        output: { verdict: out.verdict, misconception: out.misconception, hint: out.hint, explanation: out.explanation, citation: out.citation, no_source_note: out.no_source_note },
        output_text: outputText(mode, out)
      });
    } catch (e) {
      out = null;
      Object.assign(entry, { status: "error", error: e.message || String(e), latency_ms: Math.round(performance.now() - t0) });
    }
    persistGenLog(); renderLiveGen();
    return { entry, out };
  }

  /** Worker cho M.generate: gọi model, kiểm tra có nội dung, trả mục để lưu. Lỗi 401/403/501/mất kết nối là .fatal → dừng cả đợt. */
  async function memWorker(item, noCache) {
    const { entry, out } = await runOneGen(item, noCache);
    if (!out) {
      const err = new Error(entry.error || "lỗi không rõ");
      err.fatal = /^Server (401|403|501)\b|Failed to fetch|NetworkError|credit balance|billing|api key|API_KEY_INVALID|PERMISSION_DENIED/i.test(entry.error || "");
      throw err;
    }
    if (item.mode === "hint" && !out.hint) throw new Error("Model không trả gợi ý");
    if (item.mode === "diagnose" && !out.explanation) throw new Error("Model không trả lời giải");
    return M.toEntry(out);
  }

  /** Đưa bộ nhớ về đủ theo thứ tự rẻ → đắt: bản sao localStorage → file cache server (GET) → sinh bằng model thật.
   * opts.generate: được phép sinh; opts.manual: do người dùng bấm nút (bỏ qua giới hạn "tự sinh một lần");
   * opts.force: sinh lại toàn bộ, bỏ qua cache. Bộ nhớ đã đủ thì không có request nào. */
  async function ensureMemory(opts) {
    const o = opts || {};
    if (M.isBusy()) return;
    const ep = window.AI.settings().endpoint.replace(/\/$/, "");
    memNote = null;
    let todo = o.force ? M.plan(BANK).slice() : M.missing(BANK);
    if (!todo.length) { render(); return; }
    if (!o.force) {
      try { await M.sync(ep, BANK); todo = M.missing(BANK); }
      catch (e) { memNote = `Không đọc được cache server (${e.message || e}).`; }
      if (!todo.length) { memNote = null; render(); return; }
    }
    if (!o.generate || (!o.manual && autoGenTried)) { render(); return; }
    if (!o.manual) autoGenTried = true;

    let info = null;
    try { info = await (await fetch(ep + "/api/health")).json(); } catch (_) {}
    if (!info) { memNote = "Không kết nối được server để sinh bộ nhớ AI. Đang dùng lời giải mẫu của nhóm."; render(); return; }
    if (!info.configured || info.provider === "mock") { memNote = "Server chưa cấu hình AI thật (AI_PROVIDER và API key trong server/.env, hoặc chọn provider ở tab Tech) nên chưa sinh được bộ nhớ AI. Đang dùng lời giải mẫu của nhóm."; render(); return; }
    serverGen = info.generation || serverGen;

    memProgress = { done: 0, total: todo.length, fail: 0 };
    render();
    const res = await M.generate(todo, (item) => memWorker(item, Boolean(o.force)), { onProgress: (p) => { memProgress = p; renderMemoryStatus(); renderChrome(); } });
    memProgress = null;
    if (res.aborted) memNote = `Dừng vì lỗi: ${res.lastError}. Đã sinh ${res.ok}/${todo.length} mục.`;
    else if (res.fail) memNote = `${res.fail}/${todo.length} lời gọi lỗi (${res.lastError}). Bấm "Tạo câu gợi ý cho bộ câu hỏi" để thử lại các mục còn thiếu.`;
    if (!res.saved) memNote = (memNote ? memNote + " " : "") + "Không lưu được bản sao trong trình duyệt (localStorage đầy hoặc bị chặn): bộ nhớ chỉ dùng được đến khi tải lại trang. Bấm \"Xoá log\" ở tab Tech rồi tải lại để lấy từ cache server.";
    render();
  }

  /** Dòng trạng thái ở tab Tech, thanh tiến độ, banner ở tab Demo và trạng thái hai nút. */
  function renderMemoryStatus() {
    const busy = M.isBusy(), s = M.status(BANK), full = s.total > 0 && s.have === s.total;
    $("btn-memory-gen").disabled = busy; $("btn-memory-regen").disabled = busy;
    $("btn-memory-gen").textContent = busy ? "Đang sinh…" : "Tạo câu gợi ý cho bộ câu hỏi";
    const running = busy && memProgress;
    const progress = running ? `<span class="loading"><i></i><i></i><i></i></span> Đang gọi <b>${esc(modelLabel())}</b> · ${memProgress.done}/${memProgress.total} lời gọi xong${memProgress.fail ? ` · ${memProgress.fail} lỗi` : ""}…` : "";
    show($("livegen-progress"), Boolean(running)); if (running) $("livegen-progress").innerHTML = progress;
    $("memory-status").innerHTML = `Bộ nhớ AI: <b>${s.have}/${s.total}</b> mục${s.model ? ` · model <b>${esc(s.model)}</b>` : ""}${s.at ? ` · cập nhật ${esc(new Date(s.at).toLocaleString("vi-VN"))}` : ""}${full ? " · <b>đủ, trả lời không cần gọi model</b>" : ""}${s.warned ? ` · ${s.warned} mục có cảnh báo kiểm tra` : ""}${memNote ? `<br><span style="color:var(--amber-text)">${esc(memNote)}</span>` : ""}`;
    // Banner ở tab Demo: người xem lần đầu cần biết vì sao "Kiểm tra" đang khoá.
    const banner = $("memory-banner");
    banner.hidden = !running && !memNote;
    banner.style.background = running ? "" : "var(--amber-bg)"; banner.style.color = running ? "" : "var(--amber-text)";
    banner.innerHTML = running ? `${progress}<div class="small" style="margin-top:4px;">Lần đầu bộ nhớ còn trống nên AI đang sinh nội dung cho cả bộ câu hỏi. Xong sẽ trả lời tức thì, không gọi AI nữa.</div>` : esc(memNote || "");
  }

  const money = (v) => v == null ? "n/a" : (v < 0.01 ? "$" + v.toFixed(5) : "$" + v.toFixed(4));
  const num = (v) => v == null ? "—" : Number(v).toLocaleString("vi-VN");

  function renderLiveGen() {
    if (!$("sec-livegen")) return;
    renderMemoryStatus();

    // Panel cấu hình + tổng hợp
    const g = serverGen || promptInfo?.generation || {};
    const okRows = genLog.filter(e => e.status === "ok");
    const tokIn = okRows.reduce((a, e) => a + (e.usage?.input_tokens || 0), 0);
    const tokOut = okRows.reduce((a, e) => a + (e.usage?.output_tokens || 0), 0);
    const costRows = okRows.filter(e => e.cost && e.cost.total_usd != null);
    const cost = costRows.reduce((a, e) => a + e.cost.total_usd, 0);
    const lat = okRows.filter(e => !e.cached && e.latency_ms != null);
    const avgLat = lat.length ? Math.round(lat.reduce((a, e) => a + e.latency_ms, 0) / lat.length) : null;
    const rate = costRows[0]?.cost || promptInfo?.pricing || null;
    const errCount = genLog.filter(e => e.status === "error").length;
    const kv = (k, v, cls = "") => `<div class="lg-kv ${cls}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
    $("livegen-config").innerHTML = [
      kv("Provider", esc(g.provider || "—")),
      kv("Model", esc(g.model || "—")),
      kv("API", esc(g.api || "—")),
      kv("Effort / thinking", esc(g.effort ? g.effort + " · " + (g.thinking || "adaptive") : (g.thinking || "—"))),
      kv("Prompt version", esc(promptInfo?.prompt_version || okRows.slice(-1)[0]?.prompt_version || "—")),
      kv("Đơn giá ($/1M token)", rate && rate.rate_in_per_mtok != null ? `in ${rate.rate_in_per_mtok} · out ${rate.rate_out_per_mtok}` : "—"),
      kv("Lời gọi đã sinh", `${okRows.length}${errCount ? ` · ${errCount} lỗi` : ""}`, "total"),
      kv("Token in / out", `${num(tokIn)} / ${num(tokOut)}`, "total"),
      kv("Chi phí ước tính", costRows.length ? money(cost) : "—", "total"),
      kv("Độ trễ TB (gọi thật)", avgLat != null ? avgLat + " ms" : "—", "total"),
      promptInfo ? `<details class="lg-sys"><summary>System prompt đang dùng (giải thích · v${esc(promptInfo.prompt_version)})</summary><pre>${esc(promptInfo.system_prompt_explain)}</pre></details>
        <details class="lg-sys"><summary>System prompt sinh gợi ý (không đưa đáp án đúng vào prompt)</summary><pre>${esc(promptInfo.system_prompt_hint)}</pre></details>` : `<div class="lg-sys small">Chưa lấy được system prompt từ server (GET /api/prompt-info).</div>`
    ].join("");

    // Bảng log
    const rows = genLog.slice().reverse();
    $("livegen-count").textContent = rows.length ? `(${rows.length})` : "";
    if (!rows.length) { $("livegen-table").innerHTML = `<tbody><tr><td class="lg-empty">Chưa có lời gọi nào. Bấm "Tạo câu gợi ý cho bộ câu hỏi" để gọi model thật (bộ nhớ đã đủ thì không có lời gọi nào).</td></tr></tbody>`; return; }
    const head = `<thead><tr><th>Giờ</th><th>Câu</th><th>Hồ sơ</th><th>Loại</th><th>Model</th><th>Kết quả</th><th class="num">Token in/out</th><th class="num">Chi phí</th><th class="num">Độ trễ</th><th>Trạng thái</th></tr></thead>`;
    const body = rows.map(e => {
      const st = e.status === "running" ? `<span class="st run">đang gọi</span>` : e.status === "error" ? `<span class="st err">lỗi</span>` : e.cached ? `<span class="st cache">cache</span>` : `<span class="st ok">API thật</span>`;
      const kind = e.mode === "hint" ? "Gợi ý" : `Giải thích (chọn ${esc(e.learner_answer)})`;
      const outCell = e.status === "running" ? `<span class="loading"><i></i><i></i><i></i></span>` : e.error ? `<span style="color:var(--red)">${esc(e.error)}</span>` : `<div class="out ${e.output_text ? "" : "empty"}">${esc((e.output_text || "(trống)").slice(0, 160))}${(e.output_text || "").length > 160 ? "…" : ""}</div>`;
      const open = genOpen === e.id;
      const main = `<tr class="lg-row" data-id="${e.id}">
        <td class="mono">${new Date(e.ts).toLocaleTimeString("vi-VN")}</td>
        <td class="mono">${esc(e.question_id)}</td>
        <td class="persona" style="color:${pColor(e.persona)}">${esc(P[e.persona]?.name || e.persona)}</td>
        <td>${kind}</td>
        <td class="mono">${esc(e.model || "—")}</td>
        <td>${outCell}</td>
        <td class="num">${e.usage ? `${num(e.usage.input_tokens)} / ${num(e.usage.output_tokens)}` : "—"}</td>
        <td class="num">${e.cost ? money(e.cost.total_usd) : "—"}</td>
        <td class="num">${e.latency_ms != null ? e.latency_ms + " ms" : "—"}</td>
        <td>${st}</td></tr>`;
      if (!open) return main;
      const o = e.output || {};
      const result = e.mode === "hint"
        ? `<b>Gợi ý:</b> ${esc(o.hint || "(trống)")}`
        : `${o.misconception ? `<b>Nhận định lỗi:</b> ${esc(o.misconception)}<br>` : ""}${o.hint ? `<b>Gợi ý:</b> ${esc(o.hint)}<br>` : ""}<b>Giải thích:</b> ${esc(o.explanation || "(trống)")}${o.citation ? `<br><span class="small">Trích dẫn [${esc(o.citation.code)}] “${esc(o.citation.quote)}”</span>` : o.no_source_note ? `<br><span class="small">Không có nguồn: ${esc(o.no_source_note)}</span>` : ""}`;
      const info = { provider: e.provider, model: e.model, api: e.api, endpoint: e.endpoint, effort: e.effort, thinking: e.thinking || null, output_format: e.output_format || null, prompt_version: e.prompt_version, cached: e.cached, latency_ms: e.latency_ms, usage: e.usage, cost: e.cost, validation: e.validation };
      const detail = `<tr class="lg-detail"><td colspan="10">
        <div class="grid2">
          <div class="blk" style="grid-column:1/-1"><div class="t">Kết quả model trả về (đã parse)</div><div class="result">${result}</div></div>
          <div class="blk"><div class="t">Thông tin lời gọi</div><pre>${esc(JSON.stringify(info, null, 2))}</pre></div>
          <div class="blk"><div class="t">System prompt</div><pre>${esc(e.system_prompt || "—")}</pre></div>
          <div class="blk"><div class="t">User prompt (câu hỏi + hồ sơ + anchors)</div><pre>${esc(e.user_prompt || "—")}</pre></div>
          <div class="blk"><div class="t">Phản hồi thô từ model</div><pre>${esc(e.raw_response || "—")}</pre></div>
        </div></td></tr>`;
      return main + detail;
    }).join("");
    $("livegen-table").innerHTML = head + `<tbody>${body}</tbody>`;
    $("livegen-table").querySelectorAll("tr.lg-row").forEach(tr => tr.onclick = () => { genOpen = genOpen === tr.dataset.id ? null : tr.dataset.id; renderLiveGen(); });
  }

  function exportGenLog() {
    const blob = new Blob([genLog.map(e => JSON.stringify(e)).join("\n")], { type: "application/x-ndjson" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "livegen-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".jsonl"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- navigation ---------- */
  function goStep(n) {
    state.step = n;
    show($("sec-persona"), n === 1);
    show($("sec-quiz"), n >= 2);
    show($("sec-followup"), FOLLOWUP_ENABLED && n === 3 && state.checked);
    render();
    // Prefetch ngay khi vào câu hỏi. Người dùng vẫn làm bài bình thường; nếu
    // mở gợi ý sớm, renderQuiz sẽ hiện trạng thái chờ cho tới khi job hoàn tất.
    if (n >= 2 && !state.checked) void loadLiveHints();
    if (currentTab === "demo") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function resetQuestion() { state.answer = null; state.checked = false; state.hintOpen = false; state.hintViewed = false; state.hintBusy = false; state.hintError = null; state.ai = null; state.error = null; state.tStart = null; state.feedback = {}; $("followup-out").innerHTML = ""; $("followup-text").value = ""; }
  function nextQuestion() { if (state.qIndex < BANK.length - 1) { state.qIndex += 1; resetQuestion(); goStep(2); } }
  function prevQuestion() { if (state.qIndex > 0) { state.qIndex -= 1; resetQuestion(); goStep(2); } }

  /* ---------- trace (tab Tech) ---------- */
  function traceSafe(value) {
    return String(value ?? "");
  }
  function renderTrace() {
    const list = window.Trace.all().slice().reverse();
    $("trace-count").textContent = "(" + list.length + ")";
    $("trace-list").innerHTML = list.length ? list.map(e => `
      <details class="tr">
        <summary><span class="chip ${e.error ? "err" : (e.mode || "").toLowerCase().replace(/\s+/g, "-")}">${e.error ? "LỖI" : traceSafe(e.mode)}</span>
          <span>${esc(e.request?.mode)} · ${esc(e.request?.question?.id)} · ${esc(e.request?.persona)} · chọn ${esc(e.request?.learner_answer ?? "—")}</span>
          ${e.user_feedback ? `<span class="chip">${{ up: "👍", down: "👎" }[e.user_feedback.rating] || "—"}</span>` : ""}${e.events && e.events.length ? `<span class="chip">sự kiện</span>` : ""}
          <span class="small">${e.latency_ms != null ? e.latency_ms + " ms" : ""} · ${new Date(e.ts).toLocaleTimeString("vi-VN")}</span></summary>
        ${e.error ? `<pre>${esc(traceSafe(e.error))}</pre>` : ""}
        <div class="small" style="margin-top:8px;"><b>Prompt</b></div><pre>${esc(traceSafe(typeof e.prompt === "string" ? e.prompt : JSON.stringify(e.prompt, null, 2)))}</pre>
        <div class="small"><b>Phản hồi thô</b></div><pre>${esc(traceSafe(e.raw_response ?? ""))}</pre>
        <div class="small"><b>Đã parse</b></div><pre>${esc(traceSafe(JSON.stringify(e.parsed, null, 2)))}</pre>
        ${e.user_feedback ? `<div class="small"><b>Phản hồi học viên</b></div><pre>${esc(traceSafe(JSON.stringify(e.user_feedback, null, 2)))}</pre>` : ""}
        ${e.events && e.events.length ? `<div class="small"><b>Sự kiện</b></div><pre>${esc(traceSafe(JSON.stringify(e.events, null, 2)))}</pre>` : ""}
      </details>`).join("") : `<div class="small">Chưa có lời gọi nào. Nộp một câu bằng "Kiểm tra".</div>`;
  }

  /* ---------- settings ---------- */
  function openSettings() {
    const s = window.AI.settings();
    document.querySelectorAll('input[name=prov]').forEach(r => { r.checked = r.value === s.provider; });
    $("endpoint").value = s.endpoint; $("health-out").textContent = "";
    syncRadio(); $("modal").classList.add("open");
  }
  function syncRadio() { document.querySelectorAll(".radio-row").forEach(r => r.classList.toggle("on", r.querySelector("input").checked)); }

  /* ---------- master render ---------- */
  /* ---------- hướng dẫn theo bước ---------- */
  const D2 = '<span class="tour-tag d2">D2</span>', BASE = '<span class="tour-tag">nền</span>';
  function guideContent() {
    if (state.step === 1) return { n: "1", d2: false, do: "Chọn hồ sơ học viên (Non-IT · IT/Dev · Data/AI).", see: "Đây là đầu vào của tính năng: cùng câu hỏi, lời giải thích sẽ đổi theo hồ sơ này. Chọn “Chưa rõ” để xem hệ thống hỏi lại thay vì đoán." };
    if (state.step === 2 && !state.checked) return { n: "2", d2: false, do: "Chọn một đáp án rồi bấm Kiểm tra (nộp câu, không chọn lại). Gợi ý: câu 7, chọn C.", see: "Bước này giống VLearn hiện tại. Nút “Xem gợi ý” trước khi nộp là phần AI sinh theo hồ sơ (D2), gợi ý không lộ đáp án." };
    if (state.busy) return window.AI.isLive()
      ? { n: "3", d2: true, do: "AI đang chẩn đoán lỗi và soạn lời giải thích theo hồ sơ…", see: "Mỗi lời gọi được ghi vào Trace ở tab Tech (prompt, phản hồi thô, độ trễ)." }
      : { n: "3", d2: true, do: "Đang lấy chẩn đoán và lời giải thích theo hồ sơ từ bộ nhớ AI…", see: "Mỗi lượt được ghi vào Trace ở tab Tech; nội dung do AI sinh một lần và lưu sẵn, không gọi model lúc trả lời." };
    if (state.ai?.needs_clarification) return { n: "3", d2: true, do: "Hồ sơ chưa rõ → AI hỏi lại. Chọn một nhóm để tiếp tục.", see: "Lớp ② mơ hồ: không đoán hồ sơ, không giải thích khi chưa biết người nghe là ai." };
    if (state.checked) return { n: "3", d2: true, do: "Đọc khối “Học từ lỗi”: giả định đang nhầm → gợi ý → giải thích theo hồ sơ. Rồi bấm “So sánh với hồ sơ khác”.", see: "Đây là tính năng chính: đáp án đúng không đổi, chỉ cách giảng đổi. Xem mã trích dẫn [Txx-NNN] hoặc ghi chú “chưa có nguồn”." + (FOLLOWUP_ENABLED ? " Thử ô “Hỏi thêm” với “deadline nộp lab là khi nào?” để thấy từ chối an toàn." : "") };
    return null;
  }
  function renderGuide() {
    const g = guideContent(); const el = $("guide");
    show(el, Boolean(g)); if (!g) return;
    el.innerHTML = `<div class="g-icon">${g.n}</div><div class="g-body"><div class="g-do">${g.do}</div><div class="g-see">${g.see}</div></div><div class="g-tag">${g.d2 ? D2 : BASE}</div>`;
  }
  function render() { renderChrome(); renderPersona(); renderQuiz(); renderAI(); renderTrace(); renderGuide(); renderLiveGen(); }

  /* ---------- wire ---------- */
  $("btn-check").addEventListener("click", () => { if (state.checked && state.ai && !state.ai.needs_clarification) nextQuestion(); else runDiagnose(); });
  $("btn-prev").addEventListener("click", prevQuestion);
  $("hint-toggle").addEventListener("click", async () => {
    state.hintOpen = !state.hintOpen;
    if (state.hintOpen && !state.checked && !state.hintViewed) state.hintViewed = true;
    render();
    if (state.hintOpen && !state.checked) await loadLiveHints();
    if (state.hintOpen && !state.checked) window.AI.logEvent({ event: "open_pre_submit_hint", question_id: q().id, persona: state.persona, hint_available: Boolean(hintFor().text) });
  });
  $("btn-back-persona").addEventListener("click", () => goStep(1));
  // Chống bấm spam tốn phí: "Tạo câu gợi ý" chỉ sinh mục còn thiếu (đủ rồi thì không gọi gì);
  // "Tạo lại toàn bộ" bỏ qua cache nên luôn hỏi xác nhận kèm số lời gọi và chi phí ước tính.
  $("btn-memory-gen").addEventListener("click", () => ensureMemory({ generate: true, manual: true }));
  $("btn-memory-regen").addEventListener("click", () => {
    const n = M.plan(BANK).length;
    if (confirm(`Tạo lại toàn bộ bộ nhớ AI?\n\n${n} lời gọi model, bỏ qua cache, ước tính ≈ $${(n * EST_USD_PER_CALL).toFixed(2)} và có thể mất vài phút.`)) ensureMemory({ generate: true, manual: true, force: true });
  });
  const qc = $("qcount");
  qc.max = QCOUNT_MAX; qc.value = questionCount;
  qc.addEventListener("change", async () => {
    if (M.isBusy()) { qc.value = questionCount; return; }
    const n = clampCount(qc.value);
    qc.value = n;
    if (n === questionCount) return;
    questionCount = n;
    try { localStorage.setItem(QCOUNT_KEY, String(n)); } catch (_) {}
    BANK = window.QUESTION_BANK.slice(0, n);
    if (state.qIndex >= BANK.length) { state.qIndex = BANK.length - 1; resetQuestion(); }
    try { await M.sync(apiBase(), BANK); } catch (_) {}
    render();
  });
  M.onChange(() => { renderChrome(); renderMemoryStatus(); renderQuiz(); if (providersInfo) updatePickerState(); });
  $("mp-provider").addEventListener("change", () => fillModels($("mp-provider").value, null));
  $("mp-model").addEventListener("change", () => { $("mp-custom").hidden = $("mp-model").value !== "__custom"; if (!$("mp-custom").hidden) $("mp-custom").focus(); });
  $("btn-mp-apply").addEventListener("click", async () => {
    const pid = $("mp-provider").value, model = $("mp-model").value === "__custom" ? $("mp-custom").value.trim() : ($("mp-model").disabled ? "" : $("mp-model").value);
    if ($("mp-model").value === "__custom" && !model) { $("mp-status").textContent = "Hãy nhập tên model."; return; }
    $("btn-mp-apply").disabled = true; $("mp-status").textContent = "Đang áp dụng…";
    try { await applyModelChoice(pid, model); }
    catch (e) { updatePickerState(); $("mp-status").innerHTML += `<br><span style="color:var(--red)">${esc(e.message || e)}</span>`; }
  });
  $("btn-livegen-export").addEventListener("click", exportGenLog);
  $("btn-livegen-clear").addEventListener("click", () => { if (confirm("Xoá bảng log sinh trực tiếp?")) { genLog = []; genOpen = null; persistGenLog(); renderLiveGen(); } });
  $("btn-followup").addEventListener("click", runFollowup);
  $("followup-text").addEventListener("keydown", (e) => { if (e.key === "Enter") runFollowup(); });
  $("btn-export").addEventListener("click", () => window.Trace.exportJSONL());
  $("btn-clear").addEventListener("click", () => { if (confirm("Xoá toàn bộ trace trong trình duyệt?")) window.Trace.clear(); });
  $("btn-settings").addEventListener("click", openSettings);
  $("mode-badge").addEventListener("click", openSettings);
  document.querySelectorAll('input[name=prov]').forEach(r => r.addEventListener("change", syncRadio));
  $("btn-save-settings").addEventListener("click", () => {
    const provider = document.querySelector('input[name=prov]:checked')?.value || "mock";
    window.AI.saveSettings({ provider, endpoint: ($("endpoint").value || "http://localhost:8787").trim() });
    $("modal").classList.remove("open"); render();
  });
  $("modal").addEventListener("click", (e) => { if (e.target === $("modal")) $("modal").classList.remove("open"); });
  $("btn-health").addEventListener("click", async () => {
    const ep = ($("endpoint").value || "").replace(/\/$/, "");
    $("health-out").textContent = "Đang kiểm tra…";
    try { const r = await fetch(ep + "/api/health"); const j = await r.json(); $("health-out").textContent = j.configured ? `Server OK · provider: ${j.provider}${j.generation?.model ? " · model: " + j.generation.model : ""}` : "Server chạy nhưng CHƯA cấu hình AI_PROVIDER (sẽ trả 501)."; serverGen = j.generation || null; renderChrome(); }
    catch (e) { $("health-out").textContent = "Không kết nối được server: " + e.message; }
  });
  window.Trace.onChange(renderTrace);

  // 3 tab: info / demo / tech. Nhớ tab trong trình duyệt, đồng bộ location.hash.
  const TAB_KEY = "enigma_tab", TABS = ["info", "demo", "tech"];
  function setTab(name) {
    if (!TABS.includes(name)) name = "info";
    currentTab = name;
    TABS.forEach(t => {
      show($("tab-" + t), t === name);
      $("tab-btn-" + t).setAttribute("aria-selected", String(t === name));
    });
    try { localStorage.setItem(TAB_KEY, name); } catch (_) {}
    if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
    window.scrollTo({ top: 0 });
    // Vào Live demo: bộ nhớ AI thiếu thì lấy từ cache server, vẫn thiếu thì sinh (một lần mỗi lần tải trang).
    if (appReady && name === "demo") void ensureMemory({ generate: true });
  }
  TABS.forEach(t => $("tab-btn-" + t).addEventListener("click", () => setTab(t)));
  $("btn-go-demo").addEventListener("click", () => setTab("demo"));
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (TABS.includes(h) && h !== currentTab) setTab(h); });

  // ?persona=dev|nonit|dataai|mentor → vào thẳng bước 2 ở tab Live demo (tiện cho demo/quay video).
  const qsPersona = new URLSearchParams(location.search).get("persona");
  let initialTab = location.hash.slice(1);
  if (!TABS.includes(initialTab)) { try { initialTab = localStorage.getItem(TAB_KEY); } catch (_) { initialTab = null; } }
  if (qsPersona && P[qsPersona]) { state.persona = qsPersona; initialTab = "demo"; }
  setTab(initialTab);
  if (qsPersona && P[qsPersona]) goStep(2); else goStep(1);
  void loadServerInfo();
  void loadPromptInfo();
  void loadProviders();
  // Khởi tạo xong: luôn đồng bộ bộ nhớ từ cache server (GET, không phải AI); chỉ sinh nếu đang ở tab Demo.
  appReady = true;
  void ensureMemory({ generate: currentTab === "demo" });
})();

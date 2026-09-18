/* =====================================================================
 * APP — luồng demo CP3 (D2: nộp câu trước → sai → chẩn đoán → gợi ý → giải thích đầy đủ → giải thích lại bằng lời mình)
 * Hành vi theo VLearn thật: "Kiểm tra" = nộp câu, đáp án bị khoá; gợi ý trước-khi-nộp
 * mặc định ẩn (lấy từ HINT_BANK sinh sẵn); sidebar có Tiến độ + Kiến thức đang luyện.
 * Không chứa logic AI; mọi quyết định AI đi qua AI.explain() (js/ai-client.js).
 * ===================================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  // Demo chỉ hiện 3 câu đầu (Q01–Q03); ngân hàng đầy đủ vẫn nằm trong data.questions.js.
  const DEMO_QUESTION_LIMIT = 3;
  const BANK = window.QUESTION_BANK.slice(0, DEMO_QUESTION_LIMIT), P = window.PERSONAS;
  const HINTS = window.HINT_BANK || {}, HINT_META = window.HINT_BANK_META || {};
  // Mỗi câu/persona có một job riêng để prefetch không bị gọi trùng và không
  // ghi nhầm trạng thái khi người dùng chuyển câu trong lúc model còn chạy.
  const hintJobs = Object.create(null);
  const hintJobErrors = Object.create(null);
  // Thông tin model đang chạy, lấy từ GET /api/health (server/model.js quyết định provider).
  let serverGen = null;
  function modelLabel() { return serverGen?.model || "model LIVE"; }
  async function loadServerInfo() {
    // Nút "Kiểm tra" dùng dữ liệu đã gen sẵn (mock), không cần server AI thật.
    // Chỉ hỏi /api/health khi nhóm dev chủ động bật LIVE trong ⚙ (dùng cho "Sinh trực tiếp").
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
    liveHints: {},          // "Q01:nonit" -> hint sinh trực tiếp bởi model LIVE
    liveExplains: {},       // "Q01:nonit" -> lời giải sinh bằng nút "Sinh trực tiếp" (chỉ để hiển thị trong log)
    hintBusy: false,
    hintError: null,
    ai: null,               // ExplainResponse của lần diagnose gần nhất
    busy: false, error: null,
    history: [],            // [{question_id, answer, verdict}]
    tStart: null,
    submitted: {},          // qIndex -> "correct" | "incorrect"
    tour: {},               // các mốc đã thử: explained | compare | followup_refused | unknown_asked | trace_opened
    feedback: {},           // block key -> {rating, reasons[], note, sent}
    stats: { checked: 0, wrong: 0, hint: 0, times: [], up: 0, down: 0 }
  };
  const q = () => BANK[state.qIndex];

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
  function renderChrome() {
    document.querySelectorAll(".step").forEach(s => {
      const n = Number(s.dataset.step);
      s.classList.toggle("active", n === state.step);
      s.classList.toggle("done", n < state.step);
    });
    document.body.classList.add("presentation-mode");
    const isLive = window.AI.isLive();
    $("mode-badge").className = isLive ? "mode-badge live" : "mode-badge mock";
    $("mode-label").textContent = isLive
      ? (serverGen ? `LIVE · ${serverGen.provider || "AI"}${serverGen.model ? " · " + serverGen.model : ""}` : "LIVE · đang kiểm tra server…")
      : "DEMO · dữ liệu AI đã sinh sẵn";

    // tiến độ lượt
    const done = Object.keys(state.submitted).length;
    const okCount = Object.values(state.submitted).filter(v => v === "correct").length;
    $("sb-done").textContent = done; $("sb-progress").style.width = (done / BANK.length * 100) + "%";
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
    // Gợi ý vừa sinh bằng nút "Sinh trực tiếp" luôn được ưu tiên, kể cả khi demo đang ở chế độ dữ liệu sinh sẵn.
    const live = state.liveHints[`${q().id}:${persona}`];
    if (live) return live;
    if (window.AI.isLive()) return null;
    return window.AI.precomputedHint(q().id, persona);
  }

  function hintFor() {
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
    else { check.textContent = "Kiểm tra"; check.disabled = !state.answer; }
    if (!state.tStart) state.tStart = Date.now();
  }

  /* ---------- feedback học viên ---------- */
  function fbHtml(key) {
    const f = state.feedback[key] || {};
    if (f.sent) return `<div class="fb"><span class="thanks">✔ Cảm ơn, đã ghi nhận phản hồi của bạn${f.stored === "server+trace" ? " (đã lưu server)" : ""}.</span></div>`;
    return `<div class="fb" data-key="${key}">
      <div class="fb-row"><span>Phản hồi này có phù hợp với bạn?</span>
        <button class="fb-btn ${f.rating === "up" ? "on-up" : ""}" data-r="up">👍</button>
        <button class="fb-btn ${f.rating === "down" ? "on-down" : ""}" data-r="down">👎</button>
        ${f.rating === "up" ? `<button class="btn sm primary" data-send="1">Gửi</button>` : ""}
      </div>
      ${f.rating === "down" ? `<div class="chips">${FB_REASONS.map(([k, l]) => `<button class="chip ${(f.reasons || []).includes(k) ? "on" : ""}" data-c="${k}">${l}</button>`).join("")}</div>
        <div class="fb-row"><input type="text" data-note="1" placeholder="Ghi chú thêm (tuỳ chọn)" value="${esc(f.note || "")}"><button class="btn sm primary" data-send="1">Gửi</button></div>` : ""}
    </div>`;
  }
  function wireFeedback(root, meta) {
    root.querySelectorAll(".fb[data-key]").forEach(box => {
      const key = box.dataset.key; const f = state.feedback[key] = state.feedback[key] || { reasons: [] };
      box.querySelectorAll(".fb-btn").forEach(b => b.onclick = () => { f.rating = b.dataset.r; render(); });
      box.querySelectorAll(".chip").forEach(b => b.onclick = () => { const k = b.dataset.c; f.reasons = f.reasons.includes(k) ? f.reasons.filter(x => x !== k) : f.reasons.concat(k); render(); });
      const note = box.querySelector("input[data-note]"); if (note) note.oninput = () => { f.note = note.value; };
      const send = box.querySelector("[data-send]"); if (send) send.onclick = async () => {
        const m = meta(key);
        const r = await window.AI.sendFeedback({ trace_id: m.trace_id, question_id: q().id, persona: m.persona || state.persona, mode: m.mode, block: m.block, rating: f.rating, reasons: f.reasons, note: f.note || "" });
        f.sent = true; f.stored = r.stored; if (f.rating === "up") state.stats.up++; else state.stats.down++;
        render();
      };
    });
  }

  /* ---------- step 3: AI ---------- */
  function aiHeader(title, kind, ai, personaKey = state.persona) {
    const mode = ai?._mode || window.AI.mode();
    const visibleMode = mode === "LIVE" ? "API" : mode;
    const lat = ai?._latency_ms != null ? ` · ${ai._latency_ms} ms` : "";
    return `<div class="head"><span class="tag" style="color:${pColor(personaKey)}"><span class="dot" style="background:${pColor(personaKey)}"></span>${title}</span><span class="meta">${visibleMode}${lat} · ${kind}</span></div>`;
  }
  function citeHtml(ai) {
    if (ai.citation) return `<div class="cite"><span class="code">[${esc(ai.citation.code)}]</span> “${esc(ai.citation.quote)}” <span class="small">· độ tin cậy nguồn: ${esc(ai.citation.confidence || "")}</span></div>`;
    if (window.AI.isLive()) return `<div class="cite none"><b>Nguồn kiến thức:</b> Giải thích dựa trên kiến thức nền tảng của chủ đề.</div>`;
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
      ${correct ? `<div class="stack" style="margin-top:6px;"><div class="label">Giải thích lại bằng lời của bạn (kiểm tra hiểu thật, không đoán)</div><textarea id="probe-text" placeholder="Vì sao đáp án ${cur.correct} đúng và các phương án kia sai?"></textarea><div class="row"><button class="btn sm" id="btn-probe">Gửi cho AI kiểm tra</button><span id="probe-out" class="small"></span></div><div id="probe-fb"></div></div>` : ""}
      ${fbHtml("explanation")}
    </div></div>`);
    sec.innerHTML = pieces.join("");
    wireFeedback(sec, (key) => ({ trace_id: state.ai?._trace_id, mode: "diagnose", block: key }));
    $("lnk-compare") && ($("lnk-compare").onclick = (e) => { e.preventDefault(); state.tour.compare = true; renderTour(); $("compare-out").innerHTML = ["nonit", "dev", "dataai"].filter(k => k !== state.persona).map(k => `<div class="ai-block" style="margin-top:8px;"><span class="tag" style="color:${pColor(k)}"><span class="dot" style="background:${pColor(k)}"></span>${P[k].name} (lời giải mẫu của nhóm)</span><div>${esc(cur.reference[k])}</div></div>`).join(""); });
    $("btn-probe") && ($("btn-probe").onclick = runProbe);
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
          _mode: window.AI.mode(),
          _latency_ms: Math.max(...outputs.map(x => x.output._latency_ms || 0)),
          _compare_outputs: outputs
        };
      } else {
        ai = await window.AI.explain(buildRequest("diagnose"));
      }
      state.ai = ai;
      if (ai.needs_clarification) state.tour.unknown_asked = true;
      else if (ai.verdict === "incorrect") state.tour.explained = true;
      if (!ai.needs_clarification) {
        if (!(state.qIndex in state.submitted)) {
          state.submitted[state.qIndex] = ai.verdict;
          state.stats.checked += 1; if (ai.verdict !== "correct") state.stats.wrong += 1;
          if (state.hintViewed) state.stats.hint += 1;
        }
        state.history.push({ question_id: q().id, answer: state.answer, verdict: ai.verdict });
        recordTime();
        if (state.step < 3) state.step = 3;
        show($("sec-followup"), state.persona !== "mentor");
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

  async function runProbe() {
    const txt = ($("probe-text").value || "").trim(); if (!txt) return;
    $("probe-out").innerHTML = `<span class="loading"><i></i><i></i><i></i></span>`;
    try {
      const r = await window.AI.explain(buildRequest("probe", { learner_explanation: txt }));
      $("probe-out").innerHTML = `<b>${r.probe_result === "understood" ? "✔ Đã hiểu" : "↺ Cần nói rõ hơn"}</b> — ${esc(r.followup_answer || "")}`;
      state.feedback.probe = { reasons: [] }; $("probe-fb").innerHTML = fbHtml("probe");
      wireFeedback($("probe-fb"), () => ({ trace_id: r._trace_id, mode: "probe", block: "probe" }));
    } catch (e) { $("probe-out").innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`; }
    renderTrace();
  }

  async function runFollowup() {
    const txt = ($("followup-text").value || "").trim(); if (!txt) return;
    $("followup-out").innerHTML = `<div class="loading"><i></i><i></i><i></i></div>`;
    try {
      const r = await window.AI.explain(buildRequest("followup", { followup_text: txt }));
      const refused = r.safety && r.safety.refused;
      if (refused) { state.tour.followup_refused = true; renderTour(); }
      state.feedback.followup = { reasons: [] };
      $("followup-out").innerHTML = `<div class="ai-block ${refused ? "refuse" : ""}">${aiHeader(refused ? "Ngoài phạm vi — từ chối an toàn" : "Trả lời theo góc nhìn " + personaName(), refused ? "③ " + esc(r.safety.reason || "") : "followup", r)}<div>${esc(r.followup_answer || "(AI không trả về)")}</div>${fbHtml("followup")}</div>`;
      wireFeedback($("followup-out"), () => ({ trace_id: r._trace_id, mode: "followup", block: "followup" }));
    } catch (e) { $("followup-out").innerHTML = `<div class="error-box">${esc(e.message)}</div>`; }
    renderTrace();
  }


  /* ---------- SINH TRỰC TIẾP (nút cho giám khảo) + bảng log ----------
   * Mỗi lần bấm: với câu đang chọn, gọi model thật cho 3 hồ sơ × {hint, diagnose},
   * options.no_cache = true → server bỏ qua cache, luôn gọi API. Hint vừa sinh được nạp
   * vào state.liveHints để nút "Xem gợi ý" dùng ngay. Log lưu localStorage để còn sau F5. */
  const LIVEGEN_KEY = "enigma_livegen_log_v1";
  let genLog = [];
  try { genLog = JSON.parse(localStorage.getItem(LIVEGEN_KEY) || "[]"); } catch (_) { genLog = []; }
  let genBusy = false, genOpen = null, promptInfo = null;
  function persistGenLog() { try { localStorage.setItem(LIVEGEN_KEY, JSON.stringify(genLog.slice(-120))); } catch (_) {} }

  async function loadPromptInfo() {
    try { promptInfo = await window.AI.promptInfo(); } catch (_) { promptInfo = null; }
    renderLiveGen();
  }

  /** Đáp án sai dùng để sinh phần "giải thích khi sai": ưu tiên lựa chọn hiện tại của người dùng nếu sai. */
  function wrongAnswerFor(question) {
    const keys = Object.keys(question.options || {});
    const correct = String(question.correct || "").toUpperCase().split(/[\s,;|]+/).filter(Boolean);
    const isWrong = (a) => a && !sameSet(a, question.correct, question.question_type);
    if (question.id === q().id && isWrong(state.answer)) return state.answer;
    const distractor = keys.find(k => !correct.includes(k));
    if (!question.question_type || question.question_type === "single_choice") return distractor || keys[0];
    if (question.question_type === "ordering") { const r = correct.slice(); if (r.length > 1) { const t = r[0]; r[0] = r[1]; r[1] = t; } return r.join(", "); }
    const partial = correct.slice(1).concat(distractor ? [distractor] : []);
    return partial.sort().join(", ");
  }
  function sameSet(a, b, type) {
    const tokens = v => String(v ?? "").toUpperCase().split(/[\s,;|]+/).filter(Boolean);
    const aa = tokens(a), bb = tokens(b);
    if (type === "ordering") return aa.join(",") === bb.join(",");
    return aa.sort().join(",") === bb.sort().join(",");
  }

  function genRequest(question, persona, mode, learnerAnswer) {
    return {
      mode, persona, persona_style: P[persona].style,
      question: { id: question.id, topic: question.topic, stem: question.stem, options: question.options, correct: question.correct, question_type: question.question_type || "single_choice", anchors: question.anchors, anchor_confidence: question.anchor_confidence },
      learner_answer: mode === "hint" ? null : learnerAnswer,
      attempt: 1, hint_viewed: false, history: [],
      options: { no_cache: true }
    };
  }

  function outputText(mode, out) {
    if (!out) return "";
    if (mode === "hint") return out.hint || "";
    return [out.misconception && `Nhận định lỗi: ${out.misconception}`, out.hint && `Gợi ý: ${out.hint}`, out.explanation && `Giải thích: ${out.explanation}`].filter(Boolean).join("\n");
  }

  async function runOneGen(question, persona, mode, learnerAnswer) {
    const entry = {
      id: "gen_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: new Date().toISOString(), question_id: question.id, persona, mode,
      learner_answer: mode === "hint" ? null : learnerAnswer,
      status: "running", model: serverGen?.model || null, provider: serverGen?.provider || null,
      api: serverGen?.api || null, effort: serverGen?.effort || null, endpoint: serverGen?.endpoint || null,
      prompt_version: null, system_prompt: null, user_prompt: null, raw_response: null, output: null, output_text: "",
      usage: null, cost: null, latency_ms: null, cached: false, validation: null, error: null
    };
    genLog.push(entry); persistGenLog(); renderLiveGen();
    const t0 = performance.now();
    try {
      const out = await window.AI.explainLive(genRequest(question, persona, mode, learnerAnswer));
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
      if (mode === "hint" && out.hint) {
        state.liveHints[`${question.id}:${persona}`] = { hint: out.hint, flagged: false, meta: Object.assign({}, g, { model: entry.model, generated_live: true, at: entry.ts }) };
        delete hintJobErrors[`${question.id}:${persona}`];
      }
      if (mode === "diagnose") state.liveExplains[`${question.id}:${persona}`] = entry.output;
    } catch (e) {
      Object.assign(entry, { status: "error", error: e.message || String(e), latency_ms: Math.round(performance.now() - t0) });
    }
    persistGenLog(); renderLiveGen(); renderQuiz();
    return entry;
  }

  async function runLiveGen(questions) {
    if (genBusy) return;
    genBusy = true; renderLiveGen();
    const personas = ["nonit", "dev", "dataai"];
    let done = 0; const total = questions.length * personas.length * 2;
    for (const question of questions) {
      const wrong = wrongAnswerFor(question);
      const jobs = [];
      for (const persona of personas) {
        jobs.push(runOneGen(question, persona, "hint", null).then(() => { done++; renderProgress(done, total, question); }));
        jobs.push(runOneGen(question, persona, "diagnose", wrong).then(() => { done++; renderProgress(done, total, question); }));
      }
      renderProgress(done, total, question);
      await Promise.all(jobs); // 6 lời gọi song song cho mỗi câu, tuần tự giữa các câu để không dồn rate limit
    }
    genBusy = false; state.tour.livegen = true; renderLiveGen(); renderTour(); renderQuiz();
  }
  function renderProgress(done, total, question) {
    const el = $("livegen-progress");
    show(el, genBusy);
    if (genBusy) el.innerHTML = `<span class="loading"><i></i><i></i><i></i></span> Đang gọi <b>${esc(modelLabel())}</b> · ${done}/${total} lời gọi xong · câu ${esc(question.id)}…`;
  }

  const money = (v) => v == null ? "n/a" : (v < 0.01 ? "$" + v.toFixed(5) : "$" + v.toFixed(4));
  const num = (v) => v == null ? "—" : Number(v).toLocaleString("vi-VN");

  function renderLiveGen() {
    if (!$("sec-livegen")) return;
    $("btn-livegen").disabled = genBusy; $("btn-livegen-all").disabled = genBusy;
    $("btn-livegen").textContent = genBusy ? "Đang sinh…" : `⚡ Sinh cho câu hiện tại (${q().id})`;
    if (!genBusy) show($("livegen-progress"), false);

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
      kv("Effort / thinking", esc(g.effort ? g.effort + " · adaptive" : "—")),
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
    if (!rows.length) { $("livegen-table").innerHTML = `<tbody><tr><td class="lg-empty">Chưa có lời gọi nào. Bấm "Sinh cho câu hiện tại" để gọi model thật.</td></tr></tbody>`; return; }
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
      const info = { provider: e.provider, model: e.model, api: e.api, endpoint: e.endpoint, effort: e.effort, thinking: "adaptive", output_format: "json_schema (structured outputs)", prompt_version: e.prompt_version, cached: e.cached, latency_ms: e.latency_ms, usage: e.usage, cost: e.cost, validation: e.validation };
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
    show($("sec-intro"), n === 1);
    show($("sec-quiz"), n >= 2);
    show($("sec-livegen"), n >= 2);
    show($("sec-followup"), n === 3 && state.checked);
    render();
    // Prefetch ngay khi vào câu hỏi. Người dùng vẫn làm bài bình thường; nếu
    // mở gợi ý sớm, renderQuiz sẽ hiện trạng thái chờ cho tới khi job hoàn tất.
    if (n >= 2 && !state.checked) void loadLiveHints();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function resetQuestion() { state.answer = null; state.checked = false; state.hintOpen = false; state.hintViewed = false; state.hintBusy = false; state.hintError = null; state.ai = null; state.error = null; state.tStart = null; state.feedback = {}; $("followup-out").innerHTML = ""; $("followup-text").value = ""; }
  function nextQuestion() { if (state.qIndex < BANK.length - 1) { state.qIndex += 1; resetQuestion(); goStep(2); } }
  function prevQuestion() { if (state.qIndex > 0) { state.qIndex -= 1; resetQuestion(); goStep(2); } }

  /* ---------- trace drawer ---------- */
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
          ${e.user_feedback ? `<span class="chip">${e.user_feedback.rating === "up" ? "👍" : "👎"}</span>` : ""}${e.events && e.events.length ? `<span class="chip">sự kiện</span>` : ""}
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
  /* ---------- hướng dẫn theo bước + lộ trình thử ---------- */
  const D2 = '<span class="tour-tag d2">D2</span>', BASE = '<span class="tour-tag">nền</span>';
  function guideContent() {
    if (state.step === 1) return { n: "1", d2: false, do: "Chọn hồ sơ học viên (Non-IT · IT/Dev · Data/AI).", see: "Đây là đầu vào của tính năng: cùng câu hỏi, lời giải thích sẽ đổi theo hồ sơ này. Chọn “Chưa rõ” để xem hệ thống hỏi lại thay vì đoán." };
    if (state.step === 2 && !state.checked) return { n: "2", d2: false, do: "Chọn một đáp án rồi bấm Kiểm tra (nộp câu, không chọn lại). Gợi ý: câu 7, chọn C.", see: "Bước này giống VLearn hiện tại. Nút “Xem gợi ý” trước khi nộp là phần AI sinh theo hồ sơ (D2), gợi ý không lộ đáp án." };
    if (state.busy) return { n: "3", d2: true, do: "AI đang chẩn đoán lỗi và soạn lời giải thích theo hồ sơ…", see: "Mỗi lời gọi được ghi vào Trace (prompt, phản hồi thô, độ trễ)." };
    if (state.ai?.needs_clarification) return { n: "3", d2: true, do: "Hồ sơ chưa rõ → AI hỏi lại. Chọn một nhóm để tiếp tục.", see: "Lớp ② mơ hồ: không đoán hồ sơ, không giải thích khi chưa biết người nghe là ai." };
    if (state.checked) return { n: "3", d2: true, do: "Đọc khối “Học từ lỗi”: giả định đang nhầm → gợi ý → giải thích theo hồ sơ. Rồi bấm “So sánh với hồ sơ khác”.", see: "Đây là tính năng chính: đáp án đúng không đổi, chỉ cách giảng đổi. Xem mã trích dẫn [Txx-NNN] hoặc ghi chú “chưa có nguồn”. Thử ô “Hỏi thêm” với “deadline nộp lab là khi nào?” để thấy từ chối an toàn." };
    return null;
  }
  function renderGuide() {
    const g = guideContent(); const el = $("guide");
    show(el, Boolean(g)); if (!g) return;
    el.innerHTML = `<div class="g-icon">${g.n}</div><div class="g-body"><div class="g-do">${g.do}</div><div class="g-see">${g.see}</div></div><div class="g-tag">${g.d2 ? D2 : BASE}</div>`;
  }
  function tourItems() {
    const wrongOnce = Object.values(state.submitted).includes("incorrect");
    return [
      { txt: "Chọn hồ sơ học viên", d2: false, done: Boolean(state.persona) && state.persona !== "unknown" },
      { txt: "Nộp một câu trả lời sai (VD câu 7 chọn C)", d2: false, done: wrongOnce },
      { txt: "Đọc chẩn đoán → gợi ý → giải thích theo hồ sơ", d2: true, done: Boolean(state.tour.explained) },
      { txt: "So sánh với hồ sơ khác: cùng đáp án, khác cách giảng", d2: true, done: Boolean(state.tour.compare) },
      { txt: "Hỏi thêm ngoài phạm vi → AI từ chối an toàn", d2: true, done: Boolean(state.tour.followup_refused) },
      { txt: "Hồ sơ “Chưa rõ” → AI hỏi lại thay vì đoán", d2: true, done: Boolean(state.tour.unknown_asked) },
      { txt: "Bấm “Sinh trực tiếp”: xem model thật sinh gợi ý + log token, chi phí", d2: true, done: Boolean(state.tour.livegen) },
      { txt: "Mở Trace: prompt + phản hồi thô + độ trễ", d2: false, done: Boolean(state.tour.trace_opened) }
    ];
  }
  function renderTour() {
    const items = tourItems(); const firstOpen = items.findIndex(x => !x.done);
    $("tour-list").innerHTML = items.map((x, i) => `<li class="${x.done ? "done" : ""}${i === firstOpen ? " now" : ""}"><span class="box">${x.done ? "✓" : ""}</span><span class="txt">${x.txt}${x.d2 ? D2 : ""}</span></li>`).join("");
    $("tour-count").textContent = `${items.filter(x => x.done).length}/${items.length}`;
  }
  function render() { renderChrome(); renderPersona(); renderQuiz(); renderAI(); renderTrace(); renderGuide(); renderTour(); renderLiveGen(); }

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
  // TẠM COMMENT: khoá 2 nút gọi API AI thật để user test UI không bấm spam tốn phí.
  // Bỏ comment 2 dòng dưới (và bỏ "disabled" trên 2 nút trong index.html) khi cần demo AI thật.
  // $("btn-livegen").addEventListener("click", () => runLiveGen([q()]));
  // $("btn-livegen-all").addEventListener("click", () => runLiveGen(BANK.slice()));
  $("btn-livegen-export").addEventListener("click", exportGenLog);
  $("btn-livegen-clear").addEventListener("click", () => { if (confirm("Xoá bảng log sinh trực tiếp?")) { genLog = []; genOpen = null; persistGenLog(); renderLiveGen(); } });
  $("btn-followup").addEventListener("click", runFollowup);
  $("followup-text").addEventListener("keydown", (e) => { if (e.key === "Enter") runFollowup(); });
  $("btn-trace").addEventListener("click", () => { $("drawer").classList.toggle("open"); if ($("drawer").classList.contains("open")) { state.tour.trace_opened = true; renderTour(); } });
  $("btn-close-drawer").addEventListener("click", () => $("drawer").classList.remove("open"));
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

  // Khối giới thiệu đề: thu gọn/mở rộng, nhớ lựa chọn trong trình duyệt.
  const INTRO_KEY = "enigma_intro_collapsed";
  function setIntro(collapsed) {
    $("sec-intro").classList.toggle("collapsed", collapsed);
    $("btn-intro-toggle").textContent = collapsed ? "Xem mô tả đề" : "Thu gọn";
    $("btn-intro-toggle").setAttribute("aria-expanded", String(!collapsed));
    try { localStorage.setItem(INTRO_KEY, collapsed ? "1" : "0"); } catch (_) {}
  }
  let introCollapsed = false;
  try { introCollapsed = localStorage.getItem(INTRO_KEY) === "1"; } catch (_) {}
  setIntro(introCollapsed);
  $("btn-intro-toggle").addEventListener("click", () => setIntro(!$("sec-intro").classList.contains("collapsed")));

  // ?persona=dev|nonit|dataai|mentor → vào thẳng bước 2 (tiện cho demo/quay video).
  const qsPersona = new URLSearchParams(location.search).get("persona");
  if (qsPersona && P[qsPersona]) { state.persona = qsPersona; goStep(2); } else goStep(1);
  void loadServerInfo();
  void loadPromptInfo();
})();

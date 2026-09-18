/* =====================================================================
 * APP — luồng demo CP3 (D2: nộp câu trước → sai → chẩn đoán → gợi ý → giải thích đầy đủ → giải thích lại bằng lời mình)
 * Hành vi theo VLearn thật: "Kiểm tra" = nộp câu, đáp án bị khoá; gợi ý trước-khi-nộp
 * mặc định ẩn (lấy từ HINT_BANK sinh sẵn); sidebar có Tiến độ + Kiến thức đang luyện.
 * Không chứa logic AI; mọi quyết định AI đi qua AI.explain() (js/ai-client.js).
 * ===================================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const BANK = window.QUESTION_BANK, P = window.PERSONAS;
  const HINTS = window.HINT_BANK || {}, HINT_META = window.HINT_BANK_META || {};
  // Mỗi câu/persona có một job riêng để prefetch không bị gọi trùng và không
  // ghi nhầm trạng thái khi người dùng chuyển câu trong lúc model còn chạy.
  const hintJobs = Object.create(null);
  const hintJobErrors = Object.create(null);
  // Thông tin model đang chạy, lấy từ GET /api/health (server/model.js quyết định provider).
  let serverGen = null;
  function modelLabel() { return serverGen?.model || "model LIVE"; }
  async function loadServerInfo() {
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
    $("mode-badge").className = "mode-badge live";
    $("mode-label").textContent = serverGen ? `LIVE · ${serverGen.provider || "AI"}${serverGen.model ? " · " + serverGen.model : ""}` : "LIVE · đang kiểm tra server…";

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
    if (window.AI.isLive()) return state.liveHints[`${q().id}:${persona}`] || null;
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
            ? `<b>Gợi ý (${esc(personaName())}):</b><span class="hint-text">${esc(h.text)}</span><span class="src">${window.AI.isLive() ? "Sinh trực tiếp bằng" : "AI sinh sẵn"} · ${esc(h.meta?.model || HINT_META.model || modelLabel())}</span>`
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
      Cá nhân hóa: ${esc(m.personalization || "Theo persona của học viên")}
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
    $("lnk-compare") && ($("lnk-compare").onclick = (e) => { e.preventDefault(); $("compare-out").innerHTML = ["nonit", "dev", "dataai"].filter(k => k !== state.persona).map(k => `<div class="ai-block" style="margin-top:8px;"><span class="tag" style="color:${pColor(k)}"><span class="dot" style="background:${pColor(k)}"></span>${P[k].name} (lời giải mẫu của nhóm)</span><div>${esc(cur.reference[k])}</div></div>`).join(""); });
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
      state.feedback.followup = { reasons: [] };
      $("followup-out").innerHTML = `<div class="ai-block ${refused ? "refuse" : ""}">${aiHeader(refused ? "Ngoài phạm vi — từ chối an toàn" : "Trả lời theo góc nhìn " + personaName(), refused ? "③ " + esc(r.safety.reason || "") : "followup", r)}<div>${esc(r.followup_answer || "(AI không trả về)")}</div>${fbHtml("followup")}</div>`;
      wireFeedback($("followup-out"), () => ({ trace_id: r._trace_id, mode: "followup", block: "followup" }));
    } catch (e) { $("followup-out").innerHTML = `<div class="error-box">${esc(e.message)}</div>`; }
    renderTrace();
  }


  /* ---------- navigation ---------- */
  function goStep(n) {
    state.step = n;
    show($("sec-persona"), n === 1);
    show($("sec-quiz"), n >= 2);
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
  function render() { renderChrome(); renderPersona(); renderQuiz(); renderAI(); renderTrace(); }

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
  $("btn-followup").addEventListener("click", runFollowup);
  $("followup-text").addEventListener("keydown", (e) => { if (e.key === "Enter") runFollowup(); });
  $("btn-trace").addEventListener("click", () => $("drawer").classList.toggle("open"));
  $("btn-close-drawer").addEventListener("click", () => $("drawer").classList.remove("open"));
  $("btn-export").addEventListener("click", () => window.Trace.exportJSONL());
  $("btn-clear").addEventListener("click", () => { if (confirm("Xoá toàn bộ trace trong trình duyệt?")) window.Trace.clear(); });
  $("btn-settings").addEventListener("click", openSettings);
  $("mode-badge").addEventListener("click", openSettings);
  document.querySelectorAll('input[name=prov]').forEach(r => r.addEventListener("change", syncRadio));
  $("btn-save-settings").addEventListener("click", () => {
    const provider = document.querySelector('input[name=prov]:checked')?.value || "live";
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

  goStep(1);
  void loadServerInfo();
})();

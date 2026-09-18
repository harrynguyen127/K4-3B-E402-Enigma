/* =====================================================================
 * APP — luồng demo CP3 (D2: làm bài trước → sai → chẩn đoán → gợi ý → giải thích → làm lại)
 * Không chứa logic AI; mọi quyết định AI đi qua AI.explain() (js/ai-client.js).
 * ===================================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const BANK = window.QUESTION_BANK, P = window.PERSONAS;

  const state = {
    step: 1,
    persona: null,          // nonit | dev | dataai | unknown
    qIndex: 0,
    answer: null,
    attempt: 1,
    checked: false,
    ai: null,               // ExplainResponse của lần diagnose gần nhất
    level: 0,               // 0 chưa có · 1 gợi ý · 2 giải thích đầy đủ
    busy: false,
    history: [],            // [{question_id, answer, verdict}]
    tStart: null,           // thời điểm bắt đầu câu (đo thời gian đến lời giải)
    retry: null,            // {question, answer, checked}
    stats: { checked: 0, wrong: 0, recovered: 0, retryOk: 0, times: [] }
  };
  const q = () => BANK[state.qIndex];

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pColor = (k) => ({ nonit: "var(--nonit)", dev: "var(--dev)", dataai: "var(--dataai)", unknown: "var(--unknown)" }[k] || "var(--unknown)");
  function show(el, on) { el.hidden = !on; }
  function personaName() { return state.persona ? P[state.persona].name : "Chưa chọn"; }

  function buildRequest(mode, extra) {
    const cur = q();
    return Object.assign({
      mode,
      persona: state.persona,
      persona_style: P[state.persona]?.style || null,
      question: { id: cur.id, topic: cur.topic, stem: cur.stem, options: cur.options, correct: cur.correct, anchors: cur.anchors, anchor_confidence: cur.anchor_confidence },
      learner_answer: state.answer,
      attempt: state.attempt,
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
    const live = window.AI.isLive();
    $("mode-badge").className = "mode-badge " + (live ? "live" : "mock");
    $("mode-label").textContent = live ? "LIVE — gọi AI thật" : "MOCK — chưa gọi AI thật";
    show($("mock-note"), !live);

    $("sb-profile").style.background = pColor(state.persona);
    $("sb-profile-name").textContent = personaName();
    $("sb-profile-desc").textContent = state.persona ? P[state.persona].short : "Chọn hồ sơ ở bước 1.";

    const s = state.stats;
    $("st-checked").textContent = s.checked; $("st-wrong").textContent = s.wrong;
    $("st-recovered").textContent = s.recovered; $("st-retry-ok").textContent = s.retryOk;
    $("st-time").textContent = s.times.length ? Math.round(s.times.reduce((a, b) => a + b, 0) / s.times.length) + " s" : "—";

    const cur = q();
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
    $("persona-grid").querySelectorAll(".persona-card").forEach(b => b.addEventListener("click", () => {
      state.persona = b.dataset.p;
      goStep(2);
    }));
  }

  /* ---------- step 2: quiz ---------- */
  function renderQuiz() {
    const cur = q();
    const sel = $("q-select");
    if (!sel.options.length) {
      BANK.forEach((it, i) => { const o = document.createElement("option"); o.value = i; o.textContent = `${it.id} · ${it.topic}`; sel.appendChild(o); });
    }
    sel.value = state.qIndex;
    $("q-diff").textContent = "Độ khó: " + cur.difficulty;
    $("q-topic").textContent = "Kiến thức đang luyện: " + cur.topic + (cur.anchor_confidence === "none" ? " · (chưa có transcript tương ứng)" : "");
    $("q-stem").textContent = cur.stem;
    $("q-attempt").textContent = "Lần thử " + state.attempt;
    $("q-options").innerHTML = Object.entries(cur.options).map(([k, v]) => {
      let cls = "option";
      if (state.checked && state.ai && !state.ai.needs_clarification) {
        if (k === cur.correct) cls += " correct"; else if (k === state.answer) cls += " wrong";
      } else if (k === state.answer) cls += " selected";
      return `<button class="${cls}" data-k="${k}" ${state.busy ? "disabled" : ""}><span class="badge">${k}</span><span>${esc(v)}</span></button>`;
    }).join("");
    $("q-options").querySelectorAll(".option").forEach(b => b.addEventListener("click", () => {
      if (state.checked && state.level >= 2) return; // đã xem giải thích đầy đủ → dùng "Làm lại"
      state.answer = b.dataset.k;
      if (state.checked) { state.checked = false; state.ai = null; state.level = 0; show($("sec-ai"), false); show($("sec-followup"), false); }
      render();
    }));
    $("btn-check").disabled = !state.answer || state.busy || state.checked;
    $("btn-check").textContent = state.busy ? "Đang hỏi AI…" : (state.checked ? "Đã kiểm tra" : "Kiểm tra");
    if (!state.tStart) state.tStart = Date.now();
  }

  /* ---------- step 3: AI ---------- */
  function aiHeader(title, kind) {
    const mode = state.ai?._mode || (window.AI.isLive() ? "LIVE" : "MOCK");
    const lat = state.ai?._latency_ms != null ? ` · ${state.ai._latency_ms} ms` : "";
    return `<div class="head"><span class="tag" style="color:${pColor(state.persona)}"><span class="dot" style="background:${pColor(state.persona)}"></span>${title}</span><span class="meta">${mode}${lat} · ${kind}</span></div>`;
  }
  function citeHtml(ai) {
    if (ai.citation) return `<div class="cite"><span class="code">[${esc(ai.citation.code)}]</span> “${esc(ai.citation.quote)}” <span class="small">· độ tin cậy nguồn: ${esc(ai.citation.confidence || "")}</span></div>`;
    return `<div class="cite none"><b>Chưa có trích dẫn.</b> ${esc(ai.no_source_note || "Tài liệu buổi học chưa có đoạn tương ứng.")}</div>`;
  }

  function renderAI() {
    const sec = $("sec-ai");
    if (!state.checked && !state.busy) { show(sec, false); return; }
    show(sec, true);
    if (state.busy && !state.ai) {
      sec.innerHTML = `<div class="card pad"><div class="loading"><i></i><i></i><i></i> Đang gửi câu trả lời của bạn tới AI để chẩn đoán…</div></div>`;
      return;
    }
    if (state.error) { sec.innerHTML = `<div class="card pad"><div class="error-box">Lỗi gọi AI:\n${esc(state.error)}</div><div class="row" style="margin-top:10px;"><button class="btn sm" id="btn-retry-call">Thử lại</button><button class="btn sm ghost" id="btn-open-settings2">Mở cài đặt</button></div></div>`;
      $("btn-retry-call").onclick = () => runDiagnose();
      $("btn-open-settings2").onclick = openSettings;
      return; }
    const ai = state.ai; if (!ai) return;
    const cur = q();
    const pieces = [];

    // ② cần hỏi lại
    if (ai.needs_clarification) {
      pieces.push(`<div class="card pad stack"><div class="ai-block clarify">${aiHeader("Hệ thống chưa rõ hồ sơ của bạn", "② low-confidence → hỏi lại, không đoán")}
        <div>${esc(ai.clarifying_question)}</div>
        <div class="pill-choice">${(ai.clarifying_options || []).map(o => `<button data-p="${o.persona}">${esc(o.label)}</button>`).join("")}</div></div></div>`);
      sec.innerHTML = pieces.join("");
      sec.querySelectorAll(".pill-choice button").forEach(b => b.onclick = () => { state.persona = b.dataset.p; state.checked = false; state.ai = null; render(); runDiagnose(); });
      return;
    }

    const correct = ai.verdict === "correct";
    pieces.push(`<div class="banner ${correct ? "ok" : "bad"}">${correct ? "✔ Chính xác." : "✘ Chưa đúng — nhưng đây chính là lúc học hiệu quả nhất."} ${correct ? "" : "Hãy đọc chẩn đoán bên dưới rồi thử lại trước khi xem đáp án."}</div>`);

    if (!correct) {
      // Bậc 1: chẩn đoán + gợi ý (không lộ đáp án)
      pieces.push(`<div class="card pad stack"><div class="ai-block level1">${aiHeader("Bậc 1 · Bạn đang nhầm ở đâu?", "chẩn đoán lỗi")}
        <div><b>Giả định đang sai:</b> ${esc(ai.misconception || "(AI không trả về)")}</div>
        <div><b>Gợi ý (${esc(personaName())}):</b> ${esc(ai.hint || "(AI không trả về)")}</div>
        ${state.level < 2 ? `<div class="row"><button class="btn primary sm" id="btn-self-fix">Tôi tự sửa → chọn lại đáp án</button><button class="btn sm" id="btn-need-more">Vẫn chưa hiểu → xem giải thích đầy đủ</button></div>` : ""}
      </div></div>`);
    }
    if (correct || state.level >= 2) {
      pieces.push(`<div class="card pad stack"><div class="ai-block level2">${aiHeader((correct ? "Vì sao đúng" : "Bậc 2 · Giải thích đầy đủ") + " — góc nhìn " + personaName(), "explanation")}
        <div>${esc(ai.explanation || "(AI không trả về)")}</div>
        ${citeHtml(ai)}
        <div class="small">Đáp án đúng: <b>${cur.correct}</b> — giống nhau cho mọi hồ sơ; chỉ cách giải thích thay đổi. <a href="#" id="lnk-compare">So sánh với hồ sơ khác</a></div>
        <div id="compare-out"></div>
        ${!correct && ai.retry_question ? `<div class="row"><button class="btn primary sm" id="btn-go-retry">Làm câu tương tự để chắc đã hiểu →</button></div>` : ""}
        ${correct ? `<div class="stack" style="margin-top:6px;"><div class="label">Giải thích lại bằng lời của bạn (kiểm tra hiểu thật, không đoán)</div><textarea id="probe-text" placeholder="Vì sao đáp án ${cur.correct} đúng và các phương án kia sai?"></textarea><div class="row"><button class="btn sm" id="btn-probe">Gửi cho AI kiểm tra</button><span id="probe-out" class="small"></span></div></div>` : ""}
      </div></div>`);
    }
    sec.innerHTML = pieces.join("");

    $("btn-self-fix") && ($("btn-self-fix").onclick = () => { state.attempt += 1; state.checked = false; state.answer = null; state.level = 1; state.ai = null; render(); window.scrollTo({ top: $("sec-quiz").offsetTop - 20, behavior: "smooth" }); });
    $("btn-need-more") && ($("btn-need-more").onclick = () => { state.level = 2; recordTime(); render(); });
    $("btn-go-retry") && ($("btn-go-retry").onclick = () => { state.retry = { question: ai.retry_question, answer: null, checked: false }; goStep(4); });
    $("lnk-compare") && ($("lnk-compare").onclick = (e) => { e.preventDefault(); $("compare-out").innerHTML = ["nonit", "dev", "dataai"].filter(k => k !== state.persona).map(k => `<div class="ai-block" style="margin-top:8px;"><span class="tag" style="color:${pColor(k)}"><span class="dot" style="background:${pColor(k)}"></span>${P[k].name} (lời giải mẫu của nhóm)</span><div>${esc(cur.reference[k])}</div></div>`).join(""); });
    $("btn-probe") && ($("btn-probe").onclick = runProbe);
  }

  function recordTime() {
    if (state.tStart) { state.stats.times.push(Math.round((Date.now() - state.tStart) / 1000)); state.tStart = null; }
  }

  async function runDiagnose() {
    if (!state.answer || state.busy) return;
    state.busy = true; state.error = null; state.checked = true; render();
    try {
      const ai = await window.AI.explain(buildRequest("diagnose"));
      state.ai = ai;
      if (!ai.needs_clarification) {
        state.history.push({ question_id: q().id, answer: state.answer, verdict: ai.verdict });
        if (state.attempt === 1) { state.stats.checked += 1; if (ai.verdict !== "correct") state.stats.wrong += 1; }
        if (state.attempt > 1 && ai.verdict === "correct") state.stats.recovered += 1;
        if (ai.verdict === "correct") recordTime();
        state.level = ai.verdict === "correct" ? 2 : Math.max(state.level, 1);
        if (state.step < 3) state.step = 3;
        show($("sec-followup"), true);
      }
    } catch (e) { state.error = e.message; }
    state.busy = false; render();
  }

  async function runProbe() {
    const txt = ($("probe-text").value || "").trim();
    if (!txt) return;
    $("probe-out").innerHTML = `<span class="loading"><i></i><i></i><i></i></span>`;
    try {
      const r = await window.AI.explain(buildRequest("probe", { learner_explanation: txt }));
      $("probe-out").innerHTML = `<b>${r.probe_result === "understood" ? "✔ Đã hiểu" : "↺ Cần nói rõ hơn"}</b> — ${esc(r.followup_answer || "")}`;
    } catch (e) { $("probe-out").innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`; }
    renderTrace();
  }

  async function runFollowup() {
    const txt = ($("followup-text").value || "").trim();
    if (!txt) return;
    $("followup-out").innerHTML = `<div class="loading"><i></i><i></i><i></i></div>`;
    try {
      const r = await window.AI.explain(buildRequest("followup", { followup_text: txt }));
      const refused = r.safety && r.safety.refused;
      $("followup-out").innerHTML = `<div class="ai-block ${refused ? "refuse" : ""}">${aiHeader(refused ? "Ngoài phạm vi — từ chối an toàn" : "Trả lời theo góc nhìn " + personaName(), refused ? "③ " + esc(r.safety.reason || "") : "followup")}<div>${esc(r.followup_answer || "(AI không trả về)")}</div></div>`;
    } catch (e) { $("followup-out").innerHTML = `<div class="error-box">${esc(e.message)}</div>`; }
    renderTrace();
  }

  /* ---------- step 4: retry ---------- */
  function renderRetry() {
    const sec = $("sec-retry");
    if (state.step !== 4 || !state.retry) { show(sec, false); return; }
    show(sec, true);
    const r = state.retry, rq = r.question;
    sec.innerHTML = `<div><div class="label">Bước 4 · Câu tương tự (AI sinh theo hồ sơ ${esc(personaName())})</div><div class="stem" style="margin-top:6px;">${esc(rq.stem)}</div></div>
      <div class="options">${Object.entries(rq.options).map(([k, v]) => { let cls = "option"; if (r.checked) { if (k === rq.correct) cls += " correct"; else if (k === r.answer) cls += " wrong"; } else if (k === r.answer) cls += " selected"; return `<button class="${cls}" data-k="${k}"><span class="badge">${k}</span><span>${esc(v)}</span></button>`; }).join("")}</div>
      ${r.checked ? `<div class="banner ${r.answer === rq.correct ? "ok" : "warn"}">${r.answer === rq.correct ? "✔ Đúng — bạn đã sửa được lỗi ban đầu." : "Chưa đúng. Quay lại đọc giải thích rồi thử câu khác nhé."}</div>` : ""}
      <div class="footer-actions"><button class="btn ghost" id="btn-retry-back">← Xem lại giải thích</button><div class="row">${r.checked ? `<button class="btn primary" id="btn-next-q">Câu tiếp theo →</button>` : `<button class="btn primary" id="btn-retry-check" ${r.answer ? "" : "disabled"}>Kiểm tra</button>`}</div></div>`;
    sec.querySelectorAll(".option").forEach(b => b.onclick = () => { if (!r.checked) { r.answer = b.dataset.k; render(); } });
    $("btn-retry-back").onclick = () => goStep(3);
    $("btn-retry-check") && ($("btn-retry-check").onclick = () => { r.checked = true; if (r.answer === rq.correct) state.stats.retryOk += 1; render(); });
    $("btn-next-q") && ($("btn-next-q").onclick = () => nextQuestion());
  }

  /* ---------- navigation ---------- */
  function goStep(n) {
    state.step = n;
    show($("sec-persona"), n === 1);
    show($("sec-quiz"), n >= 2 && n !== 4);
    show($("sec-followup"), n === 3 && state.checked);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function resetQuestion() { state.answer = null; state.attempt = 1; state.checked = false; state.ai = null; state.level = 0; state.error = null; state.retry = null; state.tStart = null; $("followup-out").innerHTML = ""; $("followup-text").value = ""; }
  function nextQuestion() { state.qIndex = (state.qIndex + 1) % BANK.length; resetQuestion(); goStep(2); }

  /* ---------- trace drawer ---------- */
  function renderTrace() {
    const list = window.Trace.all().slice().reverse();
    $("trace-count").textContent = "(" + list.length + ")";
    $("trace-list").innerHTML = list.length ? list.map(e => `
      <details class="tr">
        <summary><span class="chip ${e.error ? "err" : (e.mode || "").toLowerCase()}">${e.error ? "LỖI" : e.mode}</span>
          <span>${esc(e.request?.mode)} · ${esc(e.request?.question?.id)} · ${esc(e.request?.persona)} · chọn ${esc(e.request?.learner_answer ?? "—")}</span>
          <span class="small">${e.latency_ms != null ? e.latency_ms + " ms" : ""} · ${new Date(e.ts).toLocaleTimeString("vi-VN")}</span></summary>
        ${e.error ? `<pre>${esc(e.error)}</pre>` : ""}
        <div class="small" style="margin-top:8px;"><b>Prompt</b></div><pre>${esc(typeof e.prompt === "string" ? e.prompt : JSON.stringify(e.prompt, null, 2))}</pre>
        <div class="small"><b>Phản hồi thô</b></div><pre>${esc(e.raw_response ?? "")}</pre>
        <div class="small"><b>Đã parse</b></div><pre>${esc(JSON.stringify(e.parsed, null, 2))}</pre>
        <div class="grade" data-id="${e.id}">
          <span class="small strong">Chấm nhanh:</span>
          ${[["persona_fit", "Đúng persona"], ["diagnosis", "Chẩn đoán đúng lỗi"], ["grounded", "Trích dẫn đúng / fallback đúng"], ["safe", "An toàn / không lộ đáp án ở hint"]].map(([k, l]) => `<label><input type="checkbox" data-k="${k}" ${e.eval?.[k] ? "checked" : ""}>${l}</label>`).join("")}
        </div>
      </details>`).join("") : `<div class="small">Chưa có lời gọi nào. Làm một câu và bấm "Kiểm tra".</div>`;
    $("trace-list").querySelectorAll(".grade input").forEach(cb => cb.onchange = () => {
      const id = cb.closest(".grade").dataset.id; const obj = {}; obj[cb.dataset.k] = cb.checked; window.Trace.grade(id, obj);
    });
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
  function render() { renderChrome(); renderPersona(); renderQuiz(); renderAI(); renderRetry(); renderTrace(); }

  /* ---------- wire ---------- */
  $("q-select").addEventListener("change", (e) => { state.qIndex = Number(e.target.value); resetQuestion(); render(); });
  $("btn-check").addEventListener("click", runDiagnose);
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
    const provider = document.querySelector('input[name=prov]:checked')?.value || "mock";
    window.AI.saveSettings({ provider, endpoint: ($("endpoint").value || "http://localhost:8787").trim() });
    $("modal").classList.remove("open"); render();
  });
  $("modal").addEventListener("click", (e) => { if (e.target === $("modal")) $("modal").classList.remove("open"); });
  $("btn-health").addEventListener("click", async () => {
    const ep = ($("endpoint").value || "").replace(/\/$/, "");
    $("health-out").textContent = "Đang kiểm tra…";
    try { const r = await fetch(ep + "/api/health"); const j = await r.json(); $("health-out").textContent = j.configured ? `Server OK · provider: ${j.provider}` : "Server chạy nhưng CHƯA cấu hình AI_PROVIDER (sẽ trả 501)."; }
    catch (e) { $("health-out").textContent = "Không kết nối được server: " + e.message; }
  });
  window.Trace.onChange(renderTrace);

  goStep(1);
})();

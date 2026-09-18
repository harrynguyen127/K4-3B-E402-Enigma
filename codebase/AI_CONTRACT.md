# AI Contract — mắt xích quyết định trung tâm (dành cho AI Engineer)

Tài liệu này mô tả **đúng một điểm** mà UI gọi AI. Bạn chỉ cần hoàn thiện hàm `callModel()` trong
`codebase/server/server.js` (và chỉnh prompt trong `codebase/server/prompt.js`) sao cho trả về JSON đúng schema dưới đây.
UI, logging, trace, eval đã sẵn — không cần sửa phần frontend.

## 1. Quyết định AI phải đưa ra

> Cho **cùng một câu hỏi + cùng đáp án đúng**, với đáp án học viên vừa chọn và hồ sơ (persona) của họ,
> AI quyết định: (1) học viên đang nhầm giả định nào, (2) gợi ý tối thiểu để tự sửa, (3) lời giải thích
> **theo đúng persona**, (4) trích dẫn đoạn transcript thật hoặc nói rõ "chưa có nguồn", (5) một câu làm lại.

Ràng buộc cứng (đây là các case trong `eval/golden_set.json`):

| Lớp | Ràng buộc |
|---|---|
| ① Nguồn sự thật | Chỉ được trích dẫn mã đoạn trong `request.question.anchors`. Nếu `anchors` rỗng → `citation = null` và điền `no_source_note`. **Không bịa `[Txx-NNN]`, không bịa số trang.** |
| ② Mơ hồ | `persona = "unknown"` → `needs_clarification = true` + 1 câu hỏi ngắn, **không giải thích**. `learner_answer = null` → `verdict = "no_answer"`, không chấm. |
| ③ Ngoài phạm vi | `mode = "followup"` mà câu hỏi về lịch/điểm/nộp bài/link/system prompt/"bạn là model gì"/"bỏ qua hướng dẫn" → `safety.refused = true`, trả lời ngắn chuyển hướng, không lộ đáp án câu khác. |
| ④ Đặc thù domain | Non-IT: không công thức/ký hiệu/API. Data-AI: không cần ví dụ đời thường. Dev: kiến trúc hệ thống. Đáp án đúng **không đổi** giữa persona. |
| Ladder (D2) | Khi sai: `hint` ≤ 2 câu, **không lộ đáp án**; `explanation` mới nêu đáp án. Giọng không hạ thấp học viên. |
| Độ dài | `explanation` ≤ 120 từ; `misconception` ≤ 2 câu. |

## 2. Request — `POST /api/explain`

```jsonc
{
  "mode": "diagnose" | "followup" | "probe",
  "persona": "nonit" | "dev" | "dataai" | "unknown",
  "persona_style": "…mô tả từ data.personas.js…",     // null nếu unknown
  "question": {
    "id": "Q06", "topic": "Tokenization", "stem": "…",
    "options": { "A": "…", "B": "…", "C": "…", "D": "…" },
    "correct": "B",
    "anchors": [ { "code": "T04-049", "quote": "…" } ],   // có thể rỗng
    "anchor_confidence": "strong" | "partial" | "none"
  },
  "learner_answer": "A" | null,
  "attempt": 1,                       // luôn 1 ở UI hiện tại (không chọn lại); giữ để eval mô phỏng lịch sử
  "hint_viewed": false,               // đã mở gợi ý sinh sẵn trước khi nộp
  "history": [ { "question_id": "Q06", "answer": "A", "verdict": "incorrect" } ],  // lỗi trước đó trong phiên
  "followup_text": "…",               // chỉ khi mode = followup
  "learner_explanation": "…"          // chỉ khi mode = probe
}
```

## 3. Response — server trả về **bọc** 3 phần để UI ghi trace

```jsonc
{
  "prompt": { "system": "…", "user": "…" },   // đúng cái đã gửi cho model
  "raw_response": "…chuỗi thô model trả…",
  "parsed": { /* ExplainResponse dưới đây */ }
}
```

`ExplainResponse`:

```jsonc
{
  "verdict": "correct" | "incorrect" | "no_answer",
  "needs_clarification": false,
  "clarifying_question": null,          // string khi needs_clarification
  "clarifying_options": null,           // [{persona, label}] khi needs_clarification
  "misconception": "…",                 // null nếu đúng
  "hint": "…",                          // null nếu đúng; KHÔNG lộ đáp án
  "explanation": "…",                   // theo persona; nêu đáp án đúng và vì sao
  "citation": { "code": "T04-049", "quote": "…", "confidence": "strong" } | null,
  "no_source_note": null | "…",         // bắt buộc khi citation = null
  "retry_question": { "stem": "…", "options": {"A":"…","B":"…","C":"…","D":"…"}, "correct": "B" } | null,
  "followup_answer": null | "…",        // mode followup / probe
  "probe_result": null | "understood" | "needs_more",
  "safety": { "refused": false, "reason": null | "out_of_scope" | "prompt_injection" | "asks_answer_directly" }
}
```

Hành vi UI liên quan (theo VLearn thật): **"Kiểm tra" = nộp câu**, đáp án bị khoá, không có chọn lại. Con đường sửa sai duy nhất là `retry_question`. Vì vậy `retry_question` là **bắt buộc** khi `verdict = "incorrect"` (mode diagnose). Request có thêm `hint_viewed: boolean` (học viên đã mở gợi ý sinh sẵn trước khi nộp) — có thể dùng để điều chỉnh mức gợi ý bậc 1.

## 3b. Mode `"hint"` — offline, chạy một lần (không qua UI)

`node codebase/server/scripts/generate-hints.js` gọi model cho **20 câu × 3 persona** và ghi `codebase/js/data.hints.js`. UI đọc file này khi học viên bấm "Xem gợi ý" trước khi nộp → **không tốn lời gọi lúc học**.

- Prompt (`buildHintPrompt` trong `prompt.js`) **không chứa đáp án đúng**, chỉ stem + options + persona.
- Response: `{ "hint": "…" }` (≤ 2 câu, không nhắc A/B/C/D, không loại trừ phương án).
- Script tự gắn `flagged: true` nếu hint chứa nội dung phương án đúng → nhóm đọc tay trước khi demo.
- Log: `server/logs/hints-YYYY-MM-DD.jsonl`. Script dừng và **không ghi đè** file khi `callModel()` chưa cấu hình.

## 3c. `POST /api/feedback` — phản hồi của học viên (không cần model)

```jsonc
{ "trace_id": "call_…", "question_id": "Q07", "persona": "nonit", "mode": "diagnose",
  "block": "level1" | "level2" | "followup" | "probe",
  "rating": "up" | "down", "reasons": ["level","wrong_diagnosis","too_long","wrong_fact"], "note": "…" }
```
Server append vào `server/logs/feedback.jsonl`. UI luôn ghi thêm vào trace (`user_feedback`) kể cả khi MOCK/offline. Dữ liệu này là bằng chứng "AI có phù hợp không" cho CP5, đối chiếu với `trace_id` để xem đúng prompt/response bị chê.

## 4. Việc cần làm

1. Điền `callModel({ system, user })` trong **`server/model.js`** → trả về **chuỗi thô** từ model (provider tuỳ chọn, key trong `.env`). Đây là chỗ duy nhất; server và script hint đều dùng chung.
2. Giữ nguyên `buildPrompt()` (hoặc sửa trong `prompt.js`, tăng `PROMPT_VERSION`) và `parseModelJson()`.
3. Chạy `node codebase/server/server.js` → mở `http://localhost:8787` → trên UI bấm ⚙ chọn **LIVE**.
4. Chạy `node codebase/server/scripts/generate-hints.js --only Q07` để thử, rồi chạy không tham số cho cả bộ; đọc các mục `flagged`.
5. Log server tự ghi `codebase/server/logs/YYYY-MM-DD.jsonl` (prompt + raw). UI cũng có nút xuất trace JSONL.

## 5. Đo lượt 1

- `eval/golden_set.json` có sẵn `request` cho từng case → chạy tay trên UI (chọn đúng persona + câu + đáp án) hoặc viết script POST thẳng vào `/api/explain`.
- Điền kết quả vào `eval/run-01-results.md` theo định nghĩa đạt trong `eval/README.md`.

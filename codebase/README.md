# codebase/ — prototype D2 "Học từ lỗi theo hồ sơ học viên"

## Chạy

```bash
cd codebase/server && npm install   # một lần, cài @anthropic-ai/sdk (Node ≥ 18)
cp .env.example .env                # điền ANTHROPIC_API_KEY
node server.js                      # → http://localhost:8787
```

Mở `http://localhost:8787`. UI mặc định gọi **Claude (Anthropic API)** qua server: `AI_PROVIDER=anthropic`, `ANTHROPIC_MODEL=claude-opus-5`, `ANTHROPIC_EFFORT=medium`. Response dùng **structured outputs** (JSON schema theo `AI_CONTRACT.md`) nên không còn lỗi parse JSON. Muốn chạy hoàn toàn local, đổi `AI_PROVIDER=ollama` (Qwen 2.5 7B, không cần key, không cần npm install).

Trước mỗi lời giải, server tự tìm tối đa 3 đoạn trong transcript bằng retrieval local, hoàn toàn độc lập với persona. Có đoạn đủ liên quan thì phản hồi kèm mã `[Txx-NNN]`; không có thì model vẫn giải thích bằng kiến thức chung và hiển thị ghi chú rõ rằng không có nguồn buổi học phù hợp.

Smoke test không cần key:

```bash
node codebase/server/scripts/smoke-test.js
```

Có thể mở thẳng `codebase/index.html` bằng trình duyệt (file://) — chỉ chạy được MOCK.

## Cấu trúc

| Đường dẫn | Vai trò | Ai phụ trách |
|---|---|---|
| `index.html`, `css/app.css`, `js/app.js` | Luồng demo 4 bước + panel Trace + cài đặt | UI (Tuấn) |
| `js/data.questions.js` | 20 câu quiz AI track theo schema dev; multi-select dùng `question_type`, matching/ordering đã chuyển thành single-choice với các bộ đáp án hoàn chỉnh | Nội dung (cả nhóm review) |
| `js/data.personas.js` | Mô tả 3 persona + "Chưa rõ" (đưa vào prompt) | Nội dung |
| `js/data.hints.js` | Fallback Mock; ở chế độ LIVE, gợi ý được model sinh trực tiếp khi vào câu | AI Engineer |
| `server/model.js` | `callModel()` — Anthropic (Claude, mặc định), OpenRouter, Ollama local, mock smoke provider | **AI Engineer** |
| `server/scripts/generate-hints.js` | Batch sinh gợi ý 20 câu × 3 persona, tự gắn cờ nghi lộ đáp án | AI Engineer |
| `js/ai-client.js` | Điểm gọi AI duy nhất `AI.explain()`; gọi server `/api/explain`; ghi trace | UI |
| `js/trace.js` | Lưu prompt/raw/parsed từng lời gọi; xuất JSONL; chấm nhanh | UI |
| `server/server.js` | HTTP: `POST /api/explain`, `POST /api/feedback`, static; deterministic grading; kiểm tra citation | UI |
| `server/prompt.js` | System prompt + schema JSON (bản nháp) | AI Engineer |
| `AI_CONTRACT.md` | Hợp đồng request/response giữa UI và AI | Đọc trước khi sửa |
| `prototype.html` | Bản CP2 (giữ nguyên để đối chiếu) | — |

## Luồng demo 5 phút (bấm vào đâu, gõ gì, ra gì)

Hành vi giống VLearn thật: **"Kiểm tra" = nộp câu**, đáp án bị khoá; gợi ý trước khi nộp mặc định ẩn.

1. **Hồ sơ**: chọn *Non-IT* (ngoài đời xác định qua câu tự đánh giá lúc onboarding; người dùng luôn tự đổi được nếu chưa chắc).
2. **Nộp câu trả lời**: bấm pill **7** (`Q07 · temperature`), chọn **C** (sai; đáp án đúng là A) → *Kiểm tra*. Các câu multi-select như Q01/Q17 cho phép chọn nhiều phương án; các câu mapping/ordering đã được chuyển thành các bộ đáp án hoàn chỉnh để chọn một phương án.
3. **Học từ lỗi**: đáp án khoá, đáp án đúng hiện xanh; chẩn đoán, gợi ý và explanation cá nhân hóa xuất hiện cùng lúc trong một khối duy nhất. Bộ câu hỏi hiện chưa có transcript anchor đã xác minh nên UI hiển thị **chưa có trích dẫn** thay vì bịa mã nguồn. Bấm *So sánh với hồ sơ khác*: cùng đáp án, khác lời giảng. Bấm **👎 → "Không đúng trình độ của tôi" → Gửi** để cho thấy hệ thống thu phản hồi.
4. **Chỗ khó**: ô *Hỏi thêm* gõ `deadline nộp lab là khi nào?` → từ chối an toàn (③). Pill **16** (`AI system design`) → chọn một bộ mapping hoàn chỉnh và xem fallback no-source. Hồ sơ *Chưa rõ* → hệ thống hỏi lại thay vì đoán (②).
5. Mở **Trace** → prompt + phản hồi thô + độ trễ + phản hồi học viên gắn theo từng lời gọi.

## Gợi ý trước-khi-nộp

Ở chế độ LIVE, model bắt đầu sinh gợi ý ngay khi người dùng vào một câu hỏi và lưu cache trong phiên trình duyệt. Nếu mở **Xem gợi ý** khi request chưa xong, UI hiển thị trạng thái chờ rồi tự thay bằng kết quả. Mentor tạo ba request theo ba persona. Script dưới đây chỉ còn là lựa chọn batch/fallback:

```bash
node codebase/server/scripts/generate-hints.js --only Q07   # thử
node codebase/server/scripts/generate-hints.js              # 20 câu × 3 persona → js/data.hints.js
```
Chưa chạy → nút "Xem gợi ý" hiện thông báo "chưa chạy sinh gợi ý" (không dùng mock để khỏi lẫn với AI thật).

## Phần nào thật, phần nào mock (ghi vào spec §4)

- **Thật (đã chạy):** luồng nộp → bậc 1 → bậc 2 → giải thích lại bằng lời mình; log sự kiện mở gợi ý / mở giải thích đầy đủ (`logs/events.jsonl`); gợi ý sinh sẵn; panel trace; log server (`logs/*.jsonl`, `logs/feedback.jsonl`); kiểm tra citation ∉ anchors; chỉ số học trong phiên; thu phản hồi 👍/👎 + lý do.
- **LIVE:** `callModel()` trong `server/model.js` hỗ trợ Anthropic (Claude), OpenRouter và Ollama; `mock` chỉ dành cho smoke/offline test. UI hiển thị LIVE/MOCK riêng biệt.
- **Nguồn:** 20 câu giữ nội dung AI track; anchors để rỗng có chủ ý khi chưa có transcript mapping đã xác minh.
- **Mock có chủ ý (không làm trong hackathon):** đọc CV để suy persona; dashboard giảng viên; lưu lịch sử lỗi giữa các phiên.

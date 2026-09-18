# codebase/ — prototype D2 "Học từ lỗi theo hồ sơ học viên"

## Chạy

```bash
cd codebase/server && npm install   # một lần, cài @anthropic-ai/sdk (Node ≥ 18)
cp .env.example .env                # điền ANTHROPIC_API_KEY
node server.js                      # → http://localhost:8787
```

Mở `http://localhost:8787`. UI mặc định gọi **Claude (Anthropic API)** qua server: `AI_PROVIDER=anthropic`, `ANTHROPIC_MODEL=claude-opus-5`, `ANTHROPIC_EFFORT=medium`. Response dùng **structured outputs** (JSON schema theo `AI_CONTRACT.md`) nên không còn lỗi parse JSON. Muốn chạy hoàn toàn local, đổi `AI_PROVIDER=ollama` (Qwen 2.5 7B, không cần key, không cần npm install).

Trước mỗi lời giải, server tự tìm tối đa 3 đoạn trong transcript bằng retrieval local, hoàn toàn độc lập với persona. Có đoạn đủ liên quan thì phản hồi kèm mã `[Txx-NNN]`; không có thì model vẫn giải thích bằng kiến thức chung và hiển thị ghi chú rõ rằng không có nguồn buổi học phù hợp.

## Data pack (không nằm trong repo)

`data/vlearn-pack/` (chatlog + transcript) là dữ liệu BTC cấp riêng, **không được commit** vào repo công khai (`data/` đã gitignore). Retrieval transcript ([server/retrieval.js](server/retrieval.js)) cần bản cục bộ: đặt `TRANSCRIPT_DIR=<đường dẫn tới thư mục transcript>` trong `server/.env` (xem `.env.example`), hoặc chép data pack vào `data/vlearn-pack/`. Thiếu data thì server vẫn chạy nhưng retrieval tắt: log khởi động in `CẢNH BÁO`, `/api/health` báo `retrieval.available = false`, và mọi câu dùng fallback "không có nguồn" (citation = null). Khi chạy golden set phải có data pack, nếu không các case kỳ vọng citation sẽ trượt vì thiếu nguồn chứ không phải vì AI sai.

## Kết quả sinh sẵn (cache) — demo không gọi model lúc bấm "Kiểm tra"

```bash
node codebase/server/scripts/pregenerate.js                     # Q07, Q16, Q13 × 3 persona × mọi phương án + hint
node codebase/server/scripts/pregenerate.js --questions Q07,Q01 # chọn câu khác
node codebase/server/scripts/pregenerate.js --force             # sinh lại
```

Kết quả ghi vào `codebase/server/cache/explain-cache.json` (cố ý commit). Server đọc cache trước theo key `mode|question|persona|đáp án`; trúng thì trả ngay và UI ghi "Sinh sẵn lúc …"; trượt (câu khác, tổ hợp multi-select khác, hồ sơ "Chưa rõ", hỏi thêm, probe) thì gọi model như bình thường rồi tự thêm vào cache. Tắt cache: `EXPLAIN_CACHE=off`. `/api/health` cho biết cache có bao nhiêu mục theo câu.

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
| `server/cache.js`, `server/scripts/pregenerate.js` | Cache kết quả sinh sẵn theo câu × persona × đáp án; script sinh một lần | AI Engineer |
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

## Nút "Sinh trực tiếp bằng AI thật" (cho giám khảo)

Ở bước 2 (dưới card câu hỏi) có card **Sinh trực tiếp bằng AI thật** với hai nút:

- **⚡ Sinh cho câu hiện tại**: gửi 6 lời gọi (3 hồ sơ × gợi ý + giải thích) tới model đang cấu hình trong `server/.env`, kèm `options.no_cache = true` nên server **bỏ qua cache** và luôn gọi API. Nút này gọi API thật kể cả khi giao diện đang ở chế độ dữ liệu sinh sẵn (`AI.explainLive`).
- **Sinh cả 3 câu demo**: lặp tuần tự cho Q01–Q03 (18 lời gọi).

Gợi ý vừa sinh được nạp ngay vào nút **Xem gợi ý** của câu đó (ưu tiên hơn dữ liệu sinh sẵn) và ghi write-through vào `server/cache/explain-cache.json`.

Bên dưới là **bảng log**: provider, model, API, effort, prompt version, đơn giá, tổng token in/out, chi phí ước tính, độ trễ trung bình, hai system prompt (bấm để mở), và mỗi dòng = một lời gọi (bấm dòng để xem system prompt, user prompt, phản hồi thô, usage, cost, validation). Log lưu trong `localStorage`, có nút **Xuất JSONL**.

Endpoint mới: `GET /api/prompt-info` (prompt version, system prompt, pricing) và trường `cost`, `prompt_version` trong phản hồi `/api/explain`. Bảng giá ($/1M token) nằm ở `PRICE_PER_MTOK` trong `server/model.js` (tra ngày 18/09/2026: claude-opus-5 = 5 in / 25 out). Ollama = 0.

Mẹo quay video: mở `index.html?persona=dev` để vào thẳng bước 2.

# codebase/ — prototype D2 "Học từ lỗi theo hồ sơ học viên"

## Chạy

```bash
node codebase/server/server.js      # → http://localhost:8787  (Node ≥ 18, không cần npm install)
```

Mở `http://localhost:8787`. Mặc định UI ở chế độ **MOCK** (không gọi AI). Bấm ⚙ → **LIVE** khi `codebase/server/.env` đã cấu hình và `callModel()` đã được hoàn thiện.

Có thể mở thẳng `codebase/index.html` bằng trình duyệt (file://) — chỉ chạy được MOCK.

## Cấu trúc

| Đường dẫn | Vai trò | Ai phụ trách |
|---|---|---|
| `index.html`, `css/app.css`, `js/app.js` | Luồng demo 4 bước + panel Trace + cài đặt | UI (Tuấn) |
| `js/data.questions.js` | 20 câu từ `golden_set.md` + lời giải mẫu 3 persona + **anchors transcript thật** | Nội dung (cả nhóm review) |
| `js/data.personas.js` | Mô tả 3 persona + "Chưa rõ" (đưa vào prompt) | Nội dung |
| `js/data.hints.js` | Gợi ý trước-khi-nộp, **sinh tự động** bởi `server/scripts/generate-hints.js` | AI Engineer chạy script |
| `server/model.js` | `callModel()` — điểm gọi model duy nhất | **AI Engineer** |
| `server/scripts/generate-hints.js` | Batch sinh gợi ý 20 câu × 3 persona, tự gắn cờ nghi lộ đáp án | AI Engineer |
| `js/ai-client.js` | Điểm gọi AI duy nhất `AI.explain()`; provider mock/live; ghi trace | UI |
| `js/trace.js` | Lưu prompt/raw/parsed từng lời gọi; xuất JSONL; chấm nhanh | UI |
| `server/server.js` | HTTP: `POST /api/explain`, `POST /api/feedback`, static; log `server/logs/*.jsonl`; kiểm tra citation | UI |
| `server/prompt.js` | System prompt + schema JSON (bản nháp) | AI Engineer |
| `AI_CONTRACT.md` | Hợp đồng request/response giữa UI và AI | Đọc trước khi sửa |
| `prototype.html` | Bản CP2 (giữ nguyên để đối chiếu) | — |

## Luồng demo 5 phút (bấm vào đâu, gõ gì, ra gì)

Hành vi giống VLearn thật: **"Kiểm tra" = nộp câu**, đáp án bị khoá; gợi ý trước khi nộp mặc định ẩn.

1. **Hồ sơ**: chọn *Non-IT*.
2. **Nộp câu trả lời**: bấm pill **7** (`Q07 · Temperature`), bấm *Xem gợi ý* (gợi ý AI sinh sẵn theo hồ sơ, không tốn lời gọi), chọn **A** (sai) → *Kiểm tra*.
3. **Học từ lỗi**: đáp án khoá, B hiện xanh. Bậc 1: *giả định sai* + *gợi ý* (chưa giải thích) → bấm *Xem giải thích đầy đủ* → giải thích Non-IT + trích dẫn `[T04-072]`. Bấm *So sánh với hồ sơ khác*: cùng đáp án, khác lời giảng. Bấm **👎 → "Không đúng trình độ của tôi" → Gửi** để cho thấy hệ thống thu phản hồi.
4. **Làm lại**: *Làm câu tương tự* → câu AI sinh theo hồ sơ → đúng → chỉ số "Đúng câu làm lại sau khi sai" tăng.
5. **Chỗ khó**: ô *Hỏi thêm* gõ `deadline nộp lab là khi nào?` → từ chối an toàn (③). Pill **16** (`Vector Database`) → giải thích **không có trích dẫn** và nói rõ vì sao (①). Hồ sơ *Chưa rõ* → hệ thống hỏi lại thay vì đoán (②).
6. Mở **Trace** → prompt + phản hồi thô + độ trễ + phản hồi học viên gắn theo từng lời gọi.

## Sinh gợi ý trước-khi-nộp (một lần)

```bash
node codebase/server/scripts/generate-hints.js --only Q07   # thử
node codebase/server/scripts/generate-hints.js              # 20 câu × 3 persona → js/data.hints.js
```
Chưa chạy → nút "Xem gợi ý" hiện thông báo "chưa chạy sinh gợi ý" (không dùng mock để khỏi lẫn với AI thật).

## Phần nào thật, phần nào mock (ghi vào spec §4)

- **Thật (đã chạy):** luồng nộp → bậc 1 → bậc 2 → làm lại; gợi ý sinh sẵn; panel trace; log server (`logs/*.jsonl`, `logs/feedback.jsonl`); kiểm tra citation ∉ anchors; chỉ số học trong phiên; thu phản hồi 👍/👎 + lý do.
- **Chờ AI Engineer:** `callModel()` trong `server/model.js` — lời gọi model thật (dùng cho cả `/api/explain` và script sinh gợi ý). Trước đó, badge trên UI luôn hiện **MOCK** (không được quay video CP3 ở chế độ này).
- **Bản nháp cần review:** `concept` (Kiến thức đang luyện) của 20 câu trong `js/data.questions.js` (`draft: true`).
- **Mock có chủ ý (không làm trong hackathon):** đọc CV để suy persona; dashboard giảng viên; lưu lịch sử lỗi giữa các phiên.

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
| `js/ai-client.js` | Điểm gọi AI duy nhất `AI.explain()`; provider mock/live; ghi trace | UI |
| `js/trace.js` | Lưu prompt/raw/parsed từng lời gọi; xuất JSONL; chấm nhanh | UI |
| `server/server.js` | Proxy `POST /api/explain`, log `server/logs/*.jsonl`, kiểm tra citation | **AI Engineer hoàn thiện `callModel()`** |
| `server/prompt.js` | System prompt + schema JSON (bản nháp) | AI Engineer |
| `AI_CONTRACT.md` | Hợp đồng request/response giữa UI và AI | Đọc trước khi sửa |
| `prototype.html` | Bản CP2 (giữ nguyên để đối chiếu) | — |

## Luồng demo 5 phút (bấm vào đâu, gõ gì, ra gì)

1. **Hồ sơ**: chọn *Non-IT*.
2. **Làm bài**: chọn `Q07 · Temperature`, chọn **A** (sai) → *Kiểm tra*.
3. **Học từ lỗi**: Bậc 1 hiện *giả định sai* + *gợi ý* (chưa lộ đáp án) → bấm *Tôi tự sửa* → chọn **B** → *Kiểm tra* → banner đúng + giải thích Non-IT + trích dẫn `[T04-072]`. Bấm *So sánh với hồ sơ khác* để thấy cùng đáp án, khác lời giảng.
4. **Chỗ khó**: ở ô *Hỏi thêm* gõ `deadline nộp lab là khi nào?` → từ chối an toàn (③). Đổi câu sang `Q16 · Vector Database` → giải thích **không có trích dẫn** và nói rõ vì sao (①). Chọn hồ sơ *Chưa rõ* → hệ thống hỏi lại thay vì đoán (②).
5. Mở **Trace** → cho giám khảo thấy prompt + phản hồi thô + độ trễ.

## Phần nào thật, phần nào mock (ghi vào spec §4)

- **Thật (đã chạy):** toàn bộ luồng UI, ladder gợi ý → giải thích → làm lại, panel trace, log server, kiểm tra citation ∉ anchors, chỉ số học trong phiên.
- **Chờ AI Engineer:** `callModel()` — lời gọi model thật. Trước đó, badge trên UI luôn hiện **MOCK** và nội dung là lời giải mẫu của nhóm (không được quay video CP3 ở chế độ này).
- **Mock có chủ ý (không làm trong hackathon):** đọc CV để suy persona; dashboard giảng viên; lưu lịch sử lỗi giữa các phiên.

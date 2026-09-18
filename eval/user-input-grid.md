# User Input Grid — 4 chiều mà đổi giá trị thì câu trả lời đúng phải đổi theo

| Chiều | Giá trị | Vì sao đổi giá trị thì output phải đổi |
|---|---|---|
| **Persona** | nonit · dev · dataai · unknown | Ngôn ngữ giải thích đổi; `unknown` → phải hỏi lại. |
| **Trạng thái trả lời** | correct · wrong · blank | Đúng → probe hiểu thật; sai → ladder chẩn đoán; trống → không chấm. |
| **Loại đầu vào** | diagnose · followup · probe | followup là cửa vào của lớp ③; probe kiểm tra "đoán đúng mà không hiểu". |
| **Nguồn trích dẫn** | strong · partial · none | none → bắt buộc `citation = null` + no_source_note (lớp ①). |

Chiều phụ (không nhân vào lưới, ghi ở case): **attempt** (1 / ≥3) — lần 3 phải đổi cách tiếp cận. Bộ 20 hiện chưa có case attempt 3 (xem `README.md` mục 6).

## Độ phủ hiện tại (persona × trạng thái × đầu vào)

Ô ghi mã case; **—** = chưa có case (lỗ hổng coverage đã biết).

| | diagnose · wrong | diagnose · correct | diagnose · blank | followup | probe |
|---|---|---|---|---|---|
| **nonit** | GS-01 (strong) · GS-04 (strong) · GS-08 (strong) · GS-17 (strong) | — | GS-12 | GS-14 (③) | GS-20 |
| **dev** | GS-03 (strong) · GS-07 (partial) · GS-18 (strong) | — | — | GS-10 (①) · GS-13 (②) · GS-15 (③) · GS-19 (rare) | — |
| **dataai** | GS-02 (strong) · GS-05 (strong) · GS-06 (partial) · GS-09 (none) | — | — | GS-16 (③) | — |
| **unknown** | GS-11 | — | — | — | — |

## Lỗ hổng đã biết và quyết định

| Ô trống | Giữ hay bỏ | Lý do |
|---|---|---|
| diagnose · correct (cả 3 persona) | **Bỏ qua ở golden set** | Đúng ngay → không có quyết định AI khó; probe (GS-20) đã phủ phần "hiểu thật". |
| dev/dataai · blank | Bỏ qua | Hành vi giống GS-14, không phụ thuộc persona. |
| dev / dataai · probe | **Nên thêm 1 case** nếu còn thời gian (mở rộng bộ >20) | Data-AI dễ "giải thích đúng nhưng khác cách diễn đạt tài liệu" (hard test D3). |
| unknown · followup | Bỏ qua | UI không cho hỏi thêm khi chưa có persona. |
| nonit · followup "cho đáp án luôn" | Chờ chốt | Đã bỏ khỏi bộ 20 vì chưa chốt hành vi (từ chối hẳn / thêm 1 gợi ý) — xem `README.md` mục 3. |

## Lưới phụ: gợi ý sinh sẵn (mode `hint`, offline)

| | nonit | dev | dataai |
|---|---|---|---|
| Câu có anchor strong (VD Q06, Q07) | đọc tay | đọc tay | đọc tay |
| Câu không có anchor (Q16, Q19) | đọc tay | đọc tay | đọc tay |
| Câu có phương án đúng dài, dễ bị nhắc lại (Q05, Q13) | ưu tiên kiểm | ưu tiên kiểm | ưu tiên kiểm |

Tiêu chí duy nhất cần 100%: **không lộ / không loại trừ phương án**. Script đã tự gắn `flagged` khi hint chứa nội dung phương án đúng.

Nguyên tắc (guide §2.6): người thiết kế lưới và viết case từ chatlog; LLM chỉ được dùng để paraphrase biến thể câu chữ.

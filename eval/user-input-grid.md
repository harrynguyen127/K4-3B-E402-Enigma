# User Input Grid — 4 chiều mà đổi giá trị thì câu trả lời đúng phải đổi theo

| Chiều | Giá trị | Vì sao đổi giá trị thì output phải đổi |
|---|---|---|
| **Persona** | nonit · dev · dataai · unknown | Ngôn ngữ giải thích đổi; `unknown` → phải hỏi lại. |
| **Trạng thái trả lời** | correct · wrong · blank | Đúng → probe hiểu thật; sai → ladder chẩn đoán; trống → không chấm. |
| **Loại đầu vào** | diagnose · followup · probe | followup là cửa vào của lớp ③; probe kiểm tra "đoán đúng mà không hiểu". |
| **Nguồn trích dẫn** | strong · partial · none | none → bắt buộc `citation = null` + no_source_note (lớp ①). |

Chiều phụ (không nhân vào lưới, ghi ở case): **attempt** (1 / ≥3) — lần 3 phải đổi cách tiếp cận (GS-24).

## Độ phủ hiện tại (persona × trạng thái × đầu vào)

Ô ghi mã case; **—** = chưa có case (lỗ hổng coverage đã biết).

| | diagnose · wrong | diagnose · correct | diagnose · blank | followup | probe |
|---|---|---|---|---|---|
| **nonit** | GS-01 (strong) · GS-04 (strong) · GS-08 (strong) · GS-11 (none) · GS-20 (strong) | — | GS-14 | GS-16 (③) · GS-19 (③) | GS-23 |
| **dev** | GS-03 (strong) · GS-07 (partial) · GS-21 (strong) | — | — | GS-12 (①) · GS-15 (②) · GS-17 (③) · GS-22 (rare) | GS-09 |
| **dataai** | GS-02 (strong) · GS-05 (strong) · GS-06 (partial) · GS-10 (none) · GS-24 (attempt 3) | — | — | GS-18 (③) | — |
| **unknown** | GS-13 | — | — | — | — |

## Lỗ hổng đã biết và quyết định

| Ô trống | Giữ hay bỏ | Lý do |
|---|---|---|
| diagnose · correct (cả 3 persona) | **Bỏ qua ở golden set** | Đúng ngay → không có quyết định AI khó; probe (GS-09, GS-23) đã phủ phần "hiểu thật". |
| dev/dataai · blank | Bỏ qua | Hành vi giống GS-14, không phụ thuộc persona. |
| dataai · probe | **Nên thêm 1 case** nếu còn thời gian | Data-AI dễ "giải thích đúng nhưng khác cách diễn đạt tài liệu" (hard test D3). |
| unknown · followup | Bỏ qua | UI không cho hỏi thêm khi chưa có persona. |

Nguyên tắc (guide §2.6): người thiết kế lưới và viết case từ chatlog; LLM chỉ được dùng để paraphrase biến thể câu chữ.

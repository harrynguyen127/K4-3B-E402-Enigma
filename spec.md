# AI SPEC — Adaptive Quiz Feedback D2 · Nhóm Enigma · Zone C3
Hướng: [x] D — Học tập thích ứng & tương tác trên VLearn
Loại: [x] Tính năng mới

## §1. User & Job
- Job executor + workflow:
  - Job executor: Học viên K4 đang làm quiz/lab theo buổi trên VLearn.
  - Workflow hiện tại: xem nội dung -> làm quiz/lab -> sai -> đọc phản hồi -> thử lại.
  - Điểm nghẽn: phản hồi thường chung, chưa chỉ ra sai ở giả định nào nên học viên thử lại theo cảm tính.
- Core JTBD (không tên sản phẩm/AI trong câu):
  - Khi tôi làm sai một câu trong lúc học, tôi muốn biết ngay tôi sai ở đâu và bước sửa tiếp theo là gì, để kịp sửa đúng trước hạn nộp.
- Problem statement (khong dung chu AI):
  - Phản hồi sau câu trả lời sai chưa chẩn đoán được lỗi hiểu bài ở cấp cá nhân, dẫn đến việc học viên thử lại nhiều vòng nhưng vẫn chưa biết nên sửa kiến thức nào trước.
- Evidence (chuẩn B mining, bổ sung chuẩn A sau):
  - Số liệu mining:
    - Trên toàn bộ chatlog `tutor_turns.csv`, trường `understanding_level` chỉ có 20/13.494 lượt.
    - `move_used=ask_probing_question` chỉ 28/13.494 lượt.
    - Nguồn: data dictionary của vlearn-pack.
  - 5 ví dụ nguyên văn K4 + nguồn:
    - `T10317`: học viên nói "giải thích lại dc không hơi khó hiểu", phản hồi chưa bám được nội dung cụ thể do thiếu ngữ cảnh tài liệu.
    - `T10318`: học viên nói "đây", phản hồi tiếp tục yêu cầu mở lại tài liệu, chưa chẩn đoán lỗi hiểu bài.
    - `T10326`: học viên nói "Giải thích lại giúp mình phần mà mình hay thấy khó", hệ thống hỏi lại chung, chưa có cơ chế tìm lỗi điển hình theo lịch sử sai.
    - `T10484`: học viên yêu cầu tóm tắt video, phản hồi thừa nhận không truy cập được nội dung video và trả lời tổng quát.
    - `T10291`: học viên hỏi nên ôn phần nào theo tiến độ, phản hồi mới dừng ở định hướng chung.
    - Nguồn: `data/vlearn-pack/chatlog/tutor_turns.csv` (các turn_id nêu trên).
  - Phương pháp đếm kiểm lại được:
    - Lọc cột `move_used`, `understanding_level` theo định nghĩa trong `DATA_DICTIONARY.md`.
    - Truy vết từng turn qua `turn_id` trong `tutor_turns.csv`.
  - Khảo sát/pv (se bo sung truoc CP4):
    - Mục tiêu: n >= 20 học viên ngoài nhóm, ghi full log câu hỏi/câu trả lời.

## §2. Impact & quyết định chọn
- Bảng impact (3 ứng viên):

| Ứng viên pain | Bao nhiêu người bị ảnh hưởng | Tần suất | Tốn gì mỗi lần | Khả thi 30h |
|---|---:|---:|---|---|
| A. Sai nhưng phản hồi chung, không chỉ rõ lỗi | Cao (đa số người làm quiz/lab) | Cao ở giờ lab/quiz | 3-10 phút/lượt thử lại + tăng nản | Cao |
| B. Hỏi logistics (nộp gì, deadline) nhưng không có câu trả lời dứt điểm | Trung bình đến cao | Trung bình, tăng mạnh gần hạn nộp | 2-7 phút/lượt + chuyển kênh hỏi | Cao |
| C. Không tóm tắt được video/không lấy được nội dung một số học phần | Trung bình | Trung bình | 3-8 phút/lượt tự mò lại nội dung | Trung bình |

- Ứng viên đã loại + lý do:
  - Loại B làm bài chính: dễ làm nhưng thiên về FAQ vận hành hơn là "học tập thích ứng" của Track D.
  - Loại C làm bài chính: phụ thuộc chất lượng nguồn tài liệu/video ingestion, rủi ro kỹ thuật cao trong 30h.
- Ứng viên chọn + vì sao:
  - Chọn A vì đúng trọng tâm D2 (học từ lỗi trước), có bằng chứng từ log, đo được bằng chỉ số học tập sau phản hồi (khong chi chat accuracy).

## §3. Giải pháp tương tự đã nghiên cứu
- Duolingo-style hint ladder:
  - Flow: sai -> hint mức 1 -> sai tiếp -> giải thích mức 2 -> câu kiểm tra lại.
  - Đáng học: phản hồi theo bậc, không lộ đáp án ngay.
  - Đáng né: feedback chung chung không neo vào lỗi cụ thể.
  - Mình khác: bắt buộc kèm trích dẫn từ transcript/slide của bài đang học.
- Khan Academy Khanmigo/Socratic tutoring pattern:
  - Flow: hỏi gợi mở để học viên tự nói ra giả định.
  - Đáng học: dùng câu hỏi ngược để xác minh hiểu thật.
  - Đáng né: hội thoại dài nhưng không có tiêu chí dừng.
  - Mình khác: có ngưỡng dừng rõ ràng và chuyển mức hỗ trợ theo số lần sai.

## §4. Thiết kế
- Lát cắt MỘT CÂU:
  - Một học viên K4 làm sai 1 câu quiz về tokenization, hệ thống quyết định lỗi thuộc nhầm khái niệm nào từ đáp án sai và ngữ cảnh bài học, rồi trả 1 gợi ý ngắn kèm đoạn trích nguồn liên quan để học viên sửa đúng ở lần kế tiếp và giải thích lại được vì sao.
- Non-goals:
  - Không build hệ thống chấm điểm chính thức toàn khóa.
  - Không cá nhân hóa theo hồ sơ nghề nghiệp/CV ở phiên bản này.
  - Không thay thế toàn bộ tutor hiện có trên mọi loại câu hỏi.
  - Không xử lý câu hỏi ngoài phạm vi học thuật (hành chính, chính sách nghỉ học).
- Mức prototype nhắm tới: [ ] Sketch [ ] Mock [x] Working
  - Thật: pipeline phân loại lỗi -> sinh hint theo bậc -> trích dẫn nguồn -> câu kiểm tra lại.
  - Mock: dữ liệu profile sâu và dashboard giảng viên chỉ ở mức demo tĩnh.
- Automation: [x] augment [x] conditional [ ] automate
  - Lý do: cost-of-error cao nếu chẩn đoán sai lỗi học viên; cần điều kiện confidence và cơ chế fallback.

### §4b. Nguyên tắc đã áp dụng (HAX/PAIR)

| Nguyên tắc | Áp cụ thể vào đâu trong prototype |
|---|---|
| Disclosure rõ ràng | Mở đầu phản hồi nêu đây là gợi ý học tập, không phải điểm số chính thức |
| Nêu giới hạn & nguồn sự thật | Mỗi phản hồi bắt buộc có trích đoạn nguồn; thiếu nguồn thì nói "chưa đủ căn cứ" |
| Progressive disclosure | Hint 3 mức: gợi ý nhẹ -> chỉ lỗi giả định -> giải thích có ví dụ |
| User control | Học viên chọn "gợi ý thêm" hoặc "cho câu tương tự" thay vì bị ép xem đáp án |
| Recovery path | Nếu mô hình không chắc, chuyển sang câu hỏi làm rõ hoặc khuyến nghị xem đoạn cụ thể |

## §5. Kiểu lỗi — 4 lớp chỗ khó + kịch bản

| ID | Lớp lỗi | Kịch bản lỗi | Hậu quả | Cách xử lý trong prototype |
|---|---|---|---|---|
| E1 | ① Nguồn sự thật | Hệ thống gợi ý không có trích dẫn từ transcript/slide | Học viên học sai nhưng tưởng đúng | Chặn trả lời, buộc fallback "chưa đủ căn cứ" |
| E2 | ① Nguồn sự thật | Trích dẫn nhầm đoạn (cite đúng format nhưng sai nội dung) | Tăng nhầm lẫn | Kiểm tra lexical overlap giữa lỗi và đoạn trích |
| E3 | ② Mơ hồ/thiếu thông tin | Câu trả lời của học viên quá ngắn (1-2 từ) | Chẩn đoán lỗi sai loại | Hỏi làm rõ 1 câu ngắn trước khi phân loại misconception |
| E4 | ② Mơ hồ/thiếu thông tin | Bài toán có nhiều cách đúng | Bị chấm sai oan | Cho phép nhiều pattern đáp án đúng + yêu cầu học viên giải thích |
| E5 | ③ Ngoài phạm vi/thẩm quyền | Học viên hỏi deadline, nộp bài, điểm | Trải nghiệm lệch mục tiêu D2 | Route sang thông điệp ngoài phạm vi + chỉ nơi kiểm tra |
| E6 | ③ Ngoài phạm vi/thẩm quyền | User yêu cầu "cho đáp án luôn" | Mất mục tiêu học từ lỗi | Giữ ladder: chỉ mở đáp án đầy đủ sau >=2 vòng nỗ lực |
| E7 | ④ Đặc thù domain học tập | Chẩn đoán sai misconception (ví dụ nhầm tokenization vs embedding) | Sửa sai kiến thức, mất niềm tin | Misconception bank có mô tả ranh giới rõ, kiểm thử riêng từng loại |
| E8 | ④ Đặc thù domain học tập | Feedback quá dài, quá hàn lâm | Học viên bỏ cuộc | Giới hạn phản hồi theo template ngắn + câu hỏi kiểm tra lại |

## §6. Bốn đường đi của trải nghiệm
- Happy path:
  - Học viên trả lời sai -> hệ thống nhận diện đúng misconception -> đưa hint mức 1 + trích dẫn -> học viên sửa đúng ở lượt sau.
- Low-confidence (②):
  - Hệ thống không chắc lỗi thuộc nhóm nào -> hỏi 1 câu làm rõ -> mới chọn hint.
- Failure/không căn cứ (①):
  - Không tìm được đoạn nguồn đủ liên quan -> nói rõ chưa đủ căn cứ + gợi ý mở lại đúng phần bài.
- Correction (user sửa):
  - Học viên báo "vẫn chưa hiểu" -> tăng mức hỗ trợ từ hint sang explain, giữ cùng một concept.
- Khi bị đòi ngoài phạm vi (③):
  - Hỏi hành chính/điểm số chính thức -> từ chối lịch sự + chuyển kênh phù hợp.
- Case đặc thù domain (④):
  - Học viên trả lời đúng kết quả nhưng giải thích sai bản chất -> yêu cầu giải thích ngắn 1-2 câu để xác thực hiểu thật.

## §7. Kiểm thử
- Chiều chất lượng + định nghĩa kiểm chứng:
  - Misconception diagnosis accuracy: % case gán đúng nhóm lỗi theo đáp án chuẩn.
  - Learning recovery rate: % case sai lần 1 nhưng đúng lần 2 sau hint.
  - Grounded feedback rate: % phản hồi có trích dẫn hợp lệ và liên quan.
  - Safe fallback rate: % case thiếu dữ liệu nhưng không bịa.

- Golden set (file se tao trong `eval/`):
  - Tối thiểu 24 case:
    - 10 case sai khái niệm cốt lõi (tokenization, attention, prompt quality).
    - 6 case mơ hồ/thiếu ngữ cảnh.
    - 4 case ngoài phạm vi.
    - 4 case phản ví dụ domain (đúng đáp án nhưng sai giải thích).
  - Mỗi case gồm: question, learner_answer, expected_misconception, expected_feedback_level, expected_source_anchor.

- Quality bar (chot tai CP4):
  - Đạt khi:
    - >= 75% case gán đúng misconception.
    - >= 70% case sai lần 1 được sửa đúng sau tối đa 2 lượt phản hồi.
    - >= 90% phản hồi có citation hợp lệ hoặc fallback đúng quy tắc.
    - 100% case ngoài phạm vi không bịa thông tin.

- Kết quả các lượt chạy (cap nhat truoc CP6):

| Lần chạy | So case | Misconception accuracy | Recovery rate | Grounded/fallback đúng | Ghi chú |
|---|---:|---:|---:|---:|---|
| Baseline | 24 | TBD | TBD | TBD | Chưa có tầng D2, dùng prompt tutor hiện tại |
| Iteration 1 | 24 | TBD | TBD | TBD | Thêm misconception bank + hint ladder |
| Iteration 2 | 24 | TBD | TBD | TBD | Tinh chỉnh prompt và routing low-confidence |

## §8. Phân công & kế hoạch
- Phân công có tên:
  - Nguyễn Anh Tuấn (2A202602700) - Teamlead: điều phối dự án, phân chia công việc, tạo UI, chốt demo script.
  - Đặng Quang Hưng (2A202602719) - Member: mining evidence, evidence table, chọn và kiểm 5+ turn_id.
  - Nguyễn Hữu Thành (2A202602813) - Member: thiết kế misconception bank, prompt logic, fallback rules.
  - Hà Thị Mỹ Linh (2A202602619) - Member: user test >=5 bạn, ghi log trước/sau, tổng hợp phản hồi và slide kết quả.

- Willing users (bonus validation):
  - Nguyễn Hoàng Cường - Học viên
  - Văn Thành Huy - Học viên
  - Nguyễn Tiến Phát - Học viên
  - Kế hoạch vòng validation: cho mỗi bạn làm 1 mini-flow 3 câu (1 sai de test hint, 1 sua sau hint, 1 feedback survey 2 cau), log thoi gian va muc do hieu.

- Multi-prototype (neu lam):
  - PA1: Hint ladder rule-based + retrieval theo keyword.
  - PA2: Classifier misconception + retrieval theo semantic similarity.
  - Tieu chi chon: accuracy cao hon va thoi gian phan hoi <= 6s.

## §9. Changelog

| Thời điểm | Đổi gì | Vì sao (trỏ về feedback/case nào) |
|---|---|---|
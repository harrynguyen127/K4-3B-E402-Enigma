# Canvas CP1 — Track D2

| # | Dòng | Nội dung |
|---|---|---|
| 1 | Track + đề | **D2 · Học từ lỗi trước — làm bài rồi mới được giảng** |
| 2 | Job executor (ai · đang ở đâu · làm gì) | Học viên K4 đang làm quiz/lab trên VLearn sau khi xem một phần bài giảng, cần biết mình sai ở đâu để sửa và nộp đúng hạn. |
| 3 | Pain một câu (ai – đang làm gì – vướng đâu – hậu quả) | Khi làm sai câu hỏi học tập, học viên thường chỉ nhận giải thích chung thay vì chẩn đoán đúng lỗi cá nhân và bước sửa tiếp theo, khiến phải thử lại nhiều lần, tốn thời gian và dễ nản trước deadline. |
| 4 | 1–2 bằng chứng đầu (số + cách đếm + mã hội thoại/tin nhắn, hoặc khảo sát/phỏng vấn có số người) | **Mining data pack:** (1) `understanding_level` chỉ có **20/13.494** lượt và `move_used=ask_probing_question` chỉ **28/13.494** lượt (Data Dictionary) -> tín hiệu cá nhân hóa theo lỗi còn rất thấp. (2) K4 có các turn cho thấy học viên chưa hiểu nhưng phản hồi chưa bám lỗi cụ thể: `T10317`, `T10318`, `T10326`, `T10484`, `T10291` trong `tutor_turns.csv`. **Cách đếm kiểm lại được:** lọc cột `cohort_hint`, `move_used`, `understanding_level`; đối chiếu `turn_id` nguyên văn trong file. |
| 5 | Lát cắt MỘT CÂU (1 user · 1 việc · 1 quyết định AI · 1 kết quả) | Một học viên K4 làm sai 1 câu quiz về tokenization · AI quyết định lỗi thuộc nhầm khái niệm nào dựa trên đáp án sai + ngữ cảnh bài đang học · trả 1 gợi ý ngắn kèm đoạn trích transcript đúng trọng tâm · học viên sửa đúng ở lần kế tiếp và giải thích lại được vì sao. |
| 6 | AI tự làm đến đâu + 1 dòng lý do · ≥3 willing users ngoài nhóm | **AI tự làm:** phân loại lỗi vào misconception bank, chọn mức can thiệp (hint -> explain -> cite), gợi đoạn học lại và sinh câu kiểm tra lại 1 câu. **AI không tự làm:** không chấm điểm chính thức, không kết luận năng lực dài hạn khi thiếu dữ liệu, không bịa khi không có nguồn. **Lý do:** sai ở bước chẩn đoán lỗi sẽ dẫn tới học sai và mất niềm tin. **Willing users ngoài nhóm:** Nguyễn Hoàng Cường - Học viên; Văn Thành Huy - Học viên|
| 7 | Phân công có tên | Nguyễn Anh Tuấn (2A202602700) - Teamlead: điều phối dự án, phân chia công việc, tạo UI; Đặng Quang Hưng (2A202602719) - Thành viên: mining evidence, lập evidence table và chọn 5 turn_id minh họa; Nguyễn Hữu Thành (2A202602813) - Thành viên: thiết kế misconception bank, prompt và logic chọn mức feedback; Hà Thị Mỹ Linh (2A202602619) - Thành viên: user test với >=5 bạn, tổng hợp log trước/sau và chuẩn bị demo. |

## Ghi chú nộp nhanh

- Trước CP1: thay đủ tên thật ở dòng 6, 7.
- Trước CP4: bổ sung khảo sát >=20 người hoặc tăng bằng chứng mining theo đúng `04-rubric.md`.
- Khi demo D2: bắt buộc có chỉ số học tập (vd: tỉ lệ sửa đúng sau hint lần 1, thời gian đến lời giải).
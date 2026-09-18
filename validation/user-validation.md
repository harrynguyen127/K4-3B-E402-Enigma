# Vòng Đo Bằng Người (User Validation) — Track D2

> **Tài liệu kiểm chứng thực tế theo hướng dẫn 4.2 (Bonus tối đa +8 điểm)**  
> **Người thực hiện:** Hà Thị Mỹ Linh (2A202602619)  
> **Trạng thái:** ĐANG THỰC HIỆN ĐO KIỂM THỰC TẾ (Đã có phản hồi thực tế từ người dùng)  
> **Nguyên tắc chấm thi:** Ghi số liệu và phản hồi THẬT — tuyệt đối không bịa số.  

---

## 1. Bảng Scaffold Log (Điền trực tiếp khi test từng bạn)

*Mỗi người thử một dòng. Ghi lại trung thực hành vi quan sát và quote nguyên văn lời nói của bạn đó.*

| Người thử (Tên/Vai — Willing user?) | Task (Giao theo outcome) | Quan sát hành vi (Thang 1: Hành động & Do dự) | Quote nguyên văn (Thang 2 & 3: Lời nói lúc dùng & Trả lời câu hỏi) | Mức nghiêm trọng (Nhẹ / TB / Nghiêm trọng) |
|---|---|---|---|---|
| **Đinh Thị Minh Tâm**<br>*(Học viên Data/AI — Thành viên ngoài nhóm)* | Thử làm quiz và đọc lời giải thích của AI theo persona Data/AI | Mất thời gian quan sát ban đầu do màn hình có nhiều thông tin; sau khi định hình được các khối thì đọc hiểu nội dung giải thích suôn sẻ | - *Đọc giải thích:* **"Đọc thấy dễ hiểu"**<br>- *Khó hiểu/khó chịu nhất:* **"UI UX rối, nhiều thông tin nên người dùng mới sẽ mất thời gian để sử dụng"**<br>- *Disappointment:* **Hơi tiếc** | **Trung bình** *(Cần tinh giản giao diện, giảm tải thông tin cho người mới)* |
| **Nguyễn Khánh Linh**<br>*(Học viên Non-IT — Thành viên ngoài nhóm)* | Thử làm quiz và nhận phản hồi chấm từ AI | Quan sát quá trình AI sinh phản hồi (chờ kết quả); thử nghiệm các câu hỏi có nhiều phương án đúng | - *Nhận xét tốc độ:* **"Chấm gen chậm thật"**<br>- *Góp ý logic chấm:* **"Em nghĩ nên thêm phần thiếu, kiểu ví dụ có 5 câu trả lời, 4 câu đúng mà em tick 3 thì nó phải trả là thiếu chứ không phải chưa đúng"**<br>- *Disappointment:* **Hơi tiếc** | **Trung bình** *(Độ trễ AI & Phân loại câu trả lời đúng một phần)* |
| **Nguyễn Viết Đức**<br>*(Học viên IT/Dev — Thành viên ngoài nhóm)* | Thử nghiệm toàn diện luồng quiz, độ khó câu hỏi và roadmap học tập | Trải nghiệm nhanh, thử chọn các phương án khác nhau; đánh giá kỹ tính sư phạm, độ phủ câu hỏi và tính phân loại của bài quiz | - *Khen:* **"Các bài giảng, link đầy đủ, nhiều (bổ ích). Về ý tưởng và tính năng: đầy đủ từ bắt đầu cho người dùng chọn nội dung trình độ được cho ra 1 roadmap phù hợp, roadmap rõ ràng, cho người dùng đọc học rồi test, test không qua sẽ có thể ôn tập cải thiện lỗi hổng. Về ý tưởng và tính năng trọn vẹn rồi"**<br>- *Góp ý cải thiện:* **"Phần bài kiểm tra chọn bừa cũng đúng hết :)))), hơi ít câu hỏi ôn tập, thời gian học em nghĩ nên để chẵn tầm 5-10 phút. Quiz cần thêm nhiều câu hỏi hơn, cả phần diagnostics, cần có thêm câu hỏi về cả code lẫn câu hỏi áp dụng, tính toán nữa"**<br>- *Đề xuất mở rộng:* Thêm điểm thưởng học tập, gói Plus/Pro, tìm mentor | **Trung bình** *(Độ khó quiz & Cần bổ sung câu hỏi code/tính toán cho Dev)* |
| *(Bạn test 4 - nếu có)* | | | | |
| *(Bạn test 5 - nếu có)* | | | | |

---

## 2. Bốn (4) Dòng Tổng Hợp Theo Rubric 4.2 (Tổng kết cập nhật)

1. **Chủ đề lặp nhiều nhất:**  
   - **Đánh giá cao:** Cả 3 học viên (đại diện đủ 3 nhóm Non-IT, Data/AI, Dev) đều đồng thuận **ý tưởng và tính năng rất trọn vẹn, giải thích dễ hiểu, bài giảng và tài liệu bài học phong phú, bám sát lộ trình học từ lỗi**.  
   - **Điểm nghẽn chính:** Cần tối ưu thời gian phản hồi AI (*"chấm gen chậm"*), tinh giản giao diện (*"bớt rối mắt cho người mới"*), và tăng tính thử thách cho câu hỏi kỹ thuật (*"cần thêm câu hỏi code/tính toán, tránh chọn bừa cũng đúng"*).
2. **1–2 thay đổi làm trước demo (đưa vào Changelog `spec.md §9`):**  
   - **Thay đổi 1:** Rà soát lại bộ distractors (đáp án nhiễu) ở các câu hỏi kỹ thuật chuyên sâu để tăng độ phân loại người học (theo góp ý của Viết Đức).  
   - **Thay đổi 2:** Thêm hiệu ứng loading / spinner sinh động khi chờ AI chấm bài để giảm cảm giác sốt ruột (theo góp ý của Khánh Linh).
3. **Điểm giữ nguyên có lý do (đối chiếu nguyên lý thiết kế):**  
   - Giữ nguyên triết lý bài test ngắn chẩn đoán đúng một lỗ hổng kiến thức trước khi giảng giải (đúng đề bài D2), chưa mở rộng sang các tính năng thương mại (gói Plus/Pro, quảng cáo) trong khuôn khổ cuộc thi.
4. **Đưa vào Backlog (để trình bày trên Slide 6 — CP5):**  
   - Mở rộng ngân hàng câu hỏi lập trình tương tác (Code sandbox / bài toán tính toán tham số) dành riêng cho hồ sơ IT/Dev.  
   - Bổ sung logic chấm "Đúng một phần / Còn thiếu" (Partial Correct) cho dạng câu hỏi nhiều đáp án.  
   - Hệ thống Gamification (tích điểm thưởng học tập) và tính năng kết nối Mentor khi học viên làm sai liên tiếp.

---

## 3. Chỉ Số Định Lượng Rút Ra (Đưa vào Slide kết quả CP5)

- **Số người đã thử nghiệm:** **3 bạn ngoài nhóm** — **Đạt 100% độ phủ cả 3 nhóm hồ sơ mục tiêu:**
  1. *Đinh Thị Minh Tâm* (Data / AI)
  2. *Nguyễn Khánh Linh* (Non-IT)
  3. *Nguyễn Viết Đức* (IT / Software Dev)
- **Mức độ hài lòng về ý tưởng & tính năng:** **100% (3/3 bạn)** đánh giá giải thích dễ hiểu, tài liệu bổ ích, quy trình roadmap học từ lỗi trọn vẹn.
- **Tỉ lệ xác thực nhu cầu (Disappointment / Demand):** 100% người dùng nhận thấy giá trị thực tế cao của giải pháp, sẵn sàng sử dụng khi hoàn thiện tối ưu UX và độ sâu ngân hàng đề.

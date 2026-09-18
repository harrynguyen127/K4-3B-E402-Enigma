# AI SPEC — Personalized Quiz Feedback D2 · Nhóm Enigma · Zone C3
Hướng: [x] D — Học tập thích ứng & tương tác trên VLearn
Loại: [x] Tính năng mới

## §1. User & Job
- Job executor + workflow:
  - Job executor: Học viên K4 đang làm quiz/lab trên VLearn, trong đó mỗi người đến từ các bối cảnh nghề nghiệp khác nhau.
  - Workflow hiện tại: xem nội dung -> làm quiz/lab -> trả lời sai -> đọc phản hồi chung -> thử lại theo cảm tính.
  - Điểm nghẽn: cùng một khái niệm được giảng dạy trong buổi học nhưng câu hỏi và phản hồi chưa được điều chỉnh theo profile của người học. Học viên từ Data/AI, IT/Dev và Non-IT sẽ hiểu cùng một câu hỏi với mức độ liên hệ và ví dụ khác nhau.
- Core JTBD (không tên sản phẩm/AI trong câu):
  - Khi tôi làm quiz hoặc lab và không chắc về kiến thức, tôi muốn nhận được câu hỏi, gợi ý và giải thích phù hợp với nền tảng nghề nghiệp của mình, để hiểu đúng bản chất của khái niệm và cải thiện lần làm tiếp theo.
- Problem statement (khong dung chu AI):
  - Hệ thống hiện tại đưa ra phản hồi chung cho mọi học viên dù họ đến từ các profile khác nhau, khiến học viên khó kết nối khái niệm với bối cảnh công việc thực tế của mình. Kết quả là học viên sai lặp lại nhiều lần vì không hiểu đúng giả định mà câu hỏi đang kiểm tra.
- Evidence (chuẩn B mining, bổ sung chuẩn A sau):
  - Dữ liệu hiện có cho thấy trong chatlog và nội dung quiz, phản hồi thường có tính tổng quát, không phản ánh sự đa dạng của học viên theo nghề nghiệp hoặc bối cảnh áp dụng.
  - 3 nhóm profile chính cần cân nhắc:
    - Data/AI: quen với khái niệm dữ liệu, thống kê, mô hình, pipeline, độ tin cậy.
    - IT/Dev: quen với coding, hệ thống, logic, API, architecture.
    - Non-IT: quen với quy trình, business, workflow, hiểu biết ứng dụng kinh doanh hơn là kỹ thuật sâu.
  - Sự khác biệt này ảnh hưởng trực tiếp đến cách đặt câu hỏi và cách sinh feedback:
    - Cùng một kiến thức “tokenization”, câu hỏi cho Data/AI có thể liên quan đến “đọc dữ liệu, preprocessing, embedding”.
    - Cùng kiến thức đó, câu hỏi cho IT/Dev có thể liên quan đến “string processing, API payload / parsing logic”.
    - Với Non-IT, câu hỏi nên tập trung vào “ý nghĩa thực tiễn, ví dụ trong workflow công việc, không quá chuyên sâu về kỹ thuật”.
  - Khảo sát/pv (sẽ bổ sung trước CP4):
    - Mục tiêu: n >= 20 học viên, thu thập profile nghề nghiệp, cách họ hiểu 1-2 câu hỏi tương tự, mức độ phù hợp của phản hồi hiện tại.

## §2. Impact & quyết định chọn
- Bảng impact (3 ứng viên):

| Ứng viên pain | Bao nhiêu người bị ảnh hưởng | Tần suất | Tốn gì mỗi lần | Khả thi 30h |
|---|---:|---:|---|---|
| A. Học viên làm sai nhưng nhận feedback không phù hợp với profile của mình | Cao, vì K4 có học viên từ nhiều ngành | Cao ở quiz/lab | 3-10 phút/lượt thử lại + cảm giác “đề không phù hợp” | Cao |
| B. Học viên thấy câu hỏi quá kỹ thuật hoặc quá business so với background của mình | Cao ở 3 nhóm profile | Trung bình đến cao | 2-8 phút/lượt + mất tập trung | Cao |
| C. Học viên không biết phải dùng ví dụ nào để liên hệ với kiến thức khi profile khác biệt | Trung bình | Trung bình | 3-7 phút/lượt tự suy đoán | Trung bình |

- Ứng viên đã loại + lý do:
  - Loại B làm bài chính: nếu hệ thống chỉ hỏi lại đúng profile mà không giải thích được lỗi học tập thì chưa giải quyết triệt để core problem.
  - Loại C làm bài chính: đây là vấn đề bổ trợ, nhưng không phải trọng tâm của D2.
- Ứng viên chọn + vì sao:
  - Chọn A vì đây là pain point trực tiếp của D2: học viên sai do không hiểu đúng khái niệm trong bối cảnh của mình. Việc cá nhân hóa câu hỏi và feedback theo profile sẽ khiến nội dung học phù hợp hơn, giảm sự mơ hồ, và tăng khả năng sửa sai ngay trên lần làm tiếp theo.

## §3. Giải pháp tương tự đã nghiên cứu
- Duolingo-style personalized hint ladder:
  - Flow: sai -> gợi ý theo profile -> explain theo ví dụ liên quan -> hỏi lại phiên bản phù hợp với năng lực.
  - Đáng học: phản hồi theo bậc, không lộ đáp án ngay.
  - Đáng né: nếu hint vẫn chung cho mọi learner.
  - Mình khác: phải điều chỉnh ngôn ngữ, kiểu ví dụ và độ sâu kỹ thuật theo profile từng học viên.
- Khan Academy / Socratic tutoring pattern:
  - Flow: hỏi gợi mở để học viên tự suy luận.
  - Đáng học: tạo câu hỏi kích thích suy nghĩ.
  - Đáng né: hỏi quá dài, không có bối cảnh nghề nghiệp.
  - Mình khác: dùng persona-aware scaffolding, tức là cùng một kiến thức nhưng đặt lại câu hỏi và ví dụ theo Data/AI, IT/Dev hoặc Non-IT.

## §4. Thiết kế
- Lát cắt MỘT CÂU:
  - Một học viên profile Data/AI làm sai câu về “tokenization”, hệ thống nhận ra câu hỏi đang quá tổng quát và cần chuyển sang dạng liên quan đến preprocessing dữ liệu, feature engineering hoặc embedding. Hệ thống trả lời bằng một gợi ý ngắn, dùng ví dụ từ pipeline dữ liệu, kèm một câu hỏi lặp lại ở mức độ tương ứng với profile đó.
  - Với học viên profile IT/Dev, cùng một khái niệm được giải thích qua ví dụ về parsing string, API payload, validation logic.
  - Với học viên profile Non-IT, cùng khái niệm được giải thích qua ví dụ business workflow, xử lý thông tin đầu vào, tránh quá chuyên sâu về code.
- Non-goals:
  - Không xây hệ thống toàn khóa cho mọi bài học và mọi loại câu hỏi.
  - Không dự đoán hoàn toàn nghề nghiệp thực tế của học viên từ CV nếu không có dữ liệu đầy đủ.
  - Không thay thế toàn bộ tutor hiện có trên VLearn.
  - Không xử lý các câu hỏi hành chính, lịch học, nộp bài, điểm số.
- Mức prototype nhắm tới: [ ] Sketch [ ] Mock [x] Working
  - **Cập nhật CP3 (18/09):** bản demo chính chuyển sang `codebase/index.html` (+ `js/`, `css/`, `server/`). Luồng 4 bước: hồ sơ → làm bài trước → AI chẩn đoán lỗi theo bậc (gợi ý → giải thích → trích dẫn transcript) → giải thích lại bằng lời mình. Điểm gọi AI duy nhất: `AI.explain()` → `POST /api/explain` (hợp đồng: `codebase/AI_CONTRACT.md`). Panel Trace ghi prompt + phản hồi thô + độ trễ từng lời gọi; server ghi `codebase/server/logs/*.jsonl`.
  - **Thật (đã chạy):** toàn bộ luồng UI và ladder, trace/log, kiểm tra `citation ∉ anchors` phía server, chỉ số học trong phiên (sai lần 1 / sửa đúng sau gợi ý / đúng câu làm lại / thời gian đến lời giải).
  - **Đang chờ (AI Engineer):** `callModel()` trong `codebase/server/server.js` — lời gọi model thật. Trước khi xong, UI hiển thị badge **MOCK** và dùng lời giải mẫu của nhóm; video CP3 phải quay ở chế độ LIVE.
  - **Mock có chủ ý (không build trong hackathon):** suy persona từ CV; dashboard giảng viên; lưu lịch sử lỗi giữa các phiên.
  - **Cập nhật CP3 lần 2 (18/09, theo giao diện VLearn thật):** "Kiểm tra" = nộp câu, đáp án khoá, không chọn lại, không có câu làm lại (bỏ theo góp ý teamlead 18/09). Gợi ý trước-khi-nộp mặc định ẩn, lấy từ `codebase/js/data.hints.js` do AI sinh sẵn một lần (20 câu × 3 persona, `server/scripts/generate-hints.js`, prompt không chứa đáp án) để không tốn lời gọi lúc học. Sidebar có "Tiến độ lượt này" và "Kiến thức đang luyện" (`concept`, bản nháp cần review). Mỗi khối AI có nút 👍/👎 + lý do → `server/logs/feedback.jsonl` gắn `trace_id`. Sự kiện mở gợi ý trước-nộp và mở "giải thích đầy đủ" (kèm số giây dừng ở bậc 1) ghi `events.jsonl` để đo bản ngắn có đủ dễ hiểu không. Hồ sơ: xác định qua câu tự đánh giá lúc onboarding, người dùng tự đổi được khi chưa chắc.
  - Bản mẫu tương tác (trang tĩnh HTML/CSS/JS, chạy được trực tiếp trên trình duyệt, không cần server): `codebase/prototype.html`.
  - Thật (chạy trong prototype, logic có thật dù data cố định): chọn hồ sơ (persona) ở thanh trên cùng đổi ngay toàn bộ gợi ý + giải thích; chọn đáp án A-D có phản hồi đúng/sai theo state; nút "Xem gợi ý" và "Kiểm tra" là hai luồng độc lập thật sự (không phải ảnh tĩnh).
  - Giả lập (Mock — sẽ thay bằng AI thật ở CP3): nội dung câu hỏi/giải thích/thuật ngữ cho 3 persona đang là dữ liệu viết sẵn (fixed), chưa qua profile classifier hay contextualized question generation thật; dashboard giảng viên và profile mapping cũng chỉ demo tĩnh.
  - Lộ trình sang "Thật": profile classifier -> contextualized question generation -> personalized hint -> source grounding -> retry question (làm ở CP3, thay thế phần dữ liệu cố định trong `codebase/prototype.html`).
- Automation: [x] augment [x] conditional [ ] automate
  - Lý do (theo cost-of-error, §2.3):
    - **Augment** cho bước sinh câu hỏi/ví dụ theo profile: nếu AI gán sai ví dụ hoặc sai độ khó cho một profile, học viên hiểu sai bản chất khái niệm ngay từ lần học đầu và phải mất một vòng làm lại mới phát hiện ra — cái giá của lỗi là **kiến thức sai + thời gian học lại**, đắt hơn nhiều so với chi phí để giảng viên duyệt trước bộ câu hỏi theo từng profile. Vì vậy người quyết định cuối vẫn là giảng viên, AI chỉ gợi ý.
    - **Conditional** cho bước chọn hồ sơ và sinh giải thích: đa số case học viên đã có profile rõ ràng (đã chọn ở thanh hồ sơ) và có nội dung bài học tương ứng — đây là case lành, để AI tự trả lời ngay (như trong `codebase/prototype.html`, đổi persona là thấy giải thích khác ngay). Số ít case không chắc profile hoặc không tìm được nội dung tương ứng là case hiểm (dễ khiến học viên hiểu sai và mất niềm tin vào hệ thống) — case này tốn kém hơn nếu AI tự đoán, nên hệ thống hỏi lại một câu ngắn thay vì đoán mò.
    - Automate bị loại vì sai ở đây không rẻ và học viên (nhất là Non-IT) không phải lúc nào cũng tự nhận ra được ngay khi giải thích sai profile.

### §4b. Nguyên tắc đã áp dụng (HAX/PAIR)

*Vị trí cụ thể trỏ vào file `codebase/prototype.html` — mở file bằng trình duyệt để kiểm chứng trực tiếp từng dòng dưới đây.*

| Nguyên tắc (mã HAX) | Áp cụ thể vào đâu trong prototype |
|---|---|
| **G2** — Làm rõ nó làm tốt đến đâu *(nhóm khởi đầu)* | Dòng phụ đề dưới tiêu đề "Cá nhân hóa giải thích theo background" và banner "Hồ sơ học viên... Dữ liệu đã biết từ trước — lấy từ CV/onboarding, không phải từ câu trả lời" — nói rõ hệ thống cá nhân hóa PHẦN GIẢI THÍCH, không phải tự chấm đúng/sai hộ học viên. |
| **G10** — Thu hẹp phạm vi khi nghi ngờ *(bắt buộc)* | Nút `#btn-check` ("Kiểm tra") bị khóa (`disabled`) cho tới khi học viên đã chọn một đáp án — hệ thống không tự suy đoán câu trả lời hay tự chấm khi chưa có input rõ ràng. Tương ứng ngoài đời: khi chưa xác định được profile/độ tin cậy, hệ thống hỏi lại thay vì đoán (mô tả ở §4 phần Conditional). |
| **G9** — Sửa dễ dàng | Thanh "Hồ sơ học viên" (`.pill-group`, `#view-flow`) cho phép đổi persona (Non-IT / Data-AI / IT-Dev) bất kỳ lúc nào — toàn bộ gợi ý và giải thích cập nhật lại ngay lập tức, học viên không cần làm lại câu hỏi để sửa góc nhìn sai. |
| **G11** — Giải thích vì sao | Khối `#result-wrap` hiện ra sau khi bấm "Kiểm tra": banner đúng/sai + khối "Giải thích cho [persona]" nêu rõ vì sao đáp án B đúng, kèm mục "Giải thích thuật ngữ" — luôn gắn lý do với hành động vừa thực hiện (chọn đáp án), không chỉ báo đúng/sai suông. |

## §5. Kiểu lỗi — 4 lớp chỗ khó + kịch bản

| ID | Lớp lỗi | Kịch bản lỗi | Hậu quả | Cách xử lý trong prototype |
|---|---|---|---|---|
| E1 | ① Nguồn sự thật | Feedback không dựa trên bài học hoặc không phù hợp profile | Học viên hiểu sai càng sâu | Chặn phản hồi, yêu cầu dùng nguồn bài học và ví dụ tương ứng |
| E2 | ① Nguồn sự thật | Cùng một câu hỏi bị gắn ví dụ sai cho profile | Học viên cảm thấy đề không hợp lý | Xác thực profile trước khi cấp câu hỏi mới |
| E3 | ② Mơ hồ/thiếu thông tin | Học viên không rõ mình thuộc nhóm nào | Lỗi phân loại profile sai | Hỏi 1 câu ngắn để xác định profile hoặc mức độ quen thuộc |
| E4 | ② Mơ hồ/thiếu thông tin | Cùng một khái niệm nhưng nhiều cách hiểu tùy bối cảnh | Chấm sai oan | Cho phép nhiều đáp án đúng theo từng profile, rồi yêu cầu giải thích ngắn |
| E5 | ③ Ngoài phạm vi/thẩm quyền | Học viên hỏi deadline, điểm, thông tin cá nhân | Trải nghiệm lệch mục tiêu D2 | Route sang khu vực hành chính riêng |
| E6 | ③ Ngoài phạm vi/thẩm quyền | Học viên yêu cầu “cho đáp án luôn” | Mất mục tiêu học từ lỗi | Giữ ladder: chỉ mở đáp án đầy đủ sau >=2 vòng nỗ lực |
| E7 | ④ Đặc thù domain học tập | Câu hỏi dạng kỹ thuật quá sâu cho Non-IT hoặc quá business cho Data/AI | Người học mất niềm tin | Có bộ template theo từng profile và độ sâu tùy nhóm |
| E8 | ④ Đặc thù domain học tập | Feedback quá dài, nhiều khái niệm không liên quan | Học viên bỏ cuộc | Giới hạn phản hồi 2-3 câu + 1 câu kiểm tra lại |

## §6. Bốn đường đi của trải nghiệm
*Đối chiếu trực tiếp trong `codebase/prototype.html` theo từng bước bấm nêu dưới đây.*

- Happy path:
  - Học viên làm sai -> hệ thống xác định profile -> tạo lại câu hỏi hoặc hint theo profile -> học viên hiểu đúng ở lần quay lại.
  - Trong prototype: chọn persona ở thanh trên cùng -> chọn đáp án B -> bấm "Kiểm tra" -> banner xanh "Chính xác!" + khối giải thích đúng persona hiện ra ngay.
- Low-confidence (②):
  - Không chắc học viên thuộc nhóm nào -> hỏi 1 câu ngắn để xác định profile trước khi cho feedback.
  - Trong prototype: nút "Kiểm tra" khóa (`disabled`) khi chưa chọn đáp án — mô phỏng nguyên tắc "chưa đủ thông tin thì không tự chấm/đoán" (G10, §4b).
- Failure/không căn cứ (①):
  - Không đủ dữ liệu hoặc không tìm thấy phần nội dung tương ứng -> nói rõ “chưa đủ căn cứ” và gợi ý xem lại bài học trước khi làm lại.
  - Trong prototype: chọn đáp án sai (A/C/D) -> bấm "Kiểm tra" -> banner đỏ "Chưa đúng — đáp án đúng là B" (không bịa lý do, chỉ nêu đáp án đúng + giải thích có căn cứ theo persona).
- Correction (user sửa):
  - Học viên báo “vẫn chưa hiểu” -> tăng mức hỗ trợ từ hint sang explain theo cùng profile, không đổi sang cách giải thích khác nhóm.
  - Trong prototype: bấm "Xem gợi ý" trước (mức hỗ trợ nhẹ) -> nếu vẫn chưa rõ, bấm "Kiểm tra" để xem giải thích đầy đủ (mức hỗ trợ sâu hơn) — cả hai đều theo đúng persona đang chọn, không tự đổi nhóm.
- Khi bị đòi ngoài phạm vi (③):
  - Hỏi về điểm, deadline, thông tin hành chính -> từ chối lịch sự, chuyển kênh phù hợp.
- Case đặc thù domain (④):
  - Cùng một đáp án đúng nhưng giải thích sai vì khác bối cảnh nghề nghiệp -> yêu cầu học viên giải thích ngắn theo góc nhìn profile của mình.
  - Trong prototype: đổi persona (Non-IT ↔ Data/AI ↔ IT-Dev) sau khi đã "Kiểm tra" -> khối giải thích đổi theo đúng góc nhìn mới ngay lập tức (G9 — sửa dễ dàng, §4b).

## §7. Kiểm thử
- Chiều chất lượng + định nghĩa kiểm chứng:
  - Profile alignment accuracy: % trường hợp hệ thống xác định đúng nhóm học viên phù hợp với câu hỏi và phản hồi.
  - Learning recovery rate: % trường hợp sai lần 1 nhưng đúng sau tối đa 2 vòng phản hồi theo profile.
  - Grounded feedback rate: % phản hồi có căn cứ từ bài học và ví dụ tương ứng.
  - Safe fallback rate: % trường hợp thiếu thông tin nhưng không bịa hoặc ép profile sai.

- Golden set (`eval/golden_set.json` — bản nháp 0.1, 24 case, cần review; định nghĩa đạt và cơ cấu trong `eval/README.md`, lưới phủ trong `eval/user-input-grid.md`):
  - Cơ cấu theo guide §2.6: ① 3 case · ② 3 case · ③ 4 case · ④ 2 case · thường gặp 9 · hiếm 3; **15/24 case phát triển từ chatlog thật** (ghi `turn_id`).
  - Mỗi case gồm: `request` (mode, persona, question_id, learner_answer, followup_text/learner_explanation, attempt, history) và `expected` (verdict, must, must_not) theo `codebase/AI_CONTRACT.md`.
  - Ngân hàng 20 câu + lời giải mẫu 3 persona + mã đoạn transcript được phép trích dẫn: `codebase/js/data.questions.js` (Q16, Q19 không có transcript tương ứng — dùng làm case lớp ①).

- Quality bar (chốt tại CP4):
  - Đạt khi:
    - >= 75% case xác định đúng profile và context phù hợp.
    - >= 70% case sai lần 1 sửa đúng sau tối đa 2 vòng phản hồi cá nhân hóa.
    - >= 90% phản hồi có citation hợp lệ hoặc fallback đúng quy tắc.
    - 100% case ngoài phạm vi không bịa thông tin.

- Kết quả các lượt chạy (cập nhật trước CP6):
  - Lượt 1: `eval/run-01-results.md` (chưa chạy — chờ lời gọi model thật). Log thô: `codebase/server/logs/`.

| Lần chạy | Số case | Profile alignment | Recovery rate | Grounded/fallback đúng | Ghi chú |
|---|---:|---:|---:|---:|---|
| Baseline | 24 | TBD | TBD | TBD | Chưa có phân nhóm profile, dùng feedback chung |
| Iteration 1 | 24 | TBD | TBD | TBD | Thêm profile mapping + personalized hint ladder |
| Iteration 2 | 24 | TBD | TBD | TBD | Tinh chỉnh prompt theo 3 nhóm và fallback low-confidence |

## §8. Phân công & kế hoạch
- Phân công có tên:
  - Nguyễn Anh Tuấn (2A202602700) - Teamlead: điều phối, thiết kế UX, demo flow, tổng hợp bài toán profile-aware learning.
  - Đặng Quang Hưng (2A202602719) - Member: mining evidence và lập profile map cho Data/AI, IT/Dev, Non-IT.
  - Nguyễn Hữu Thành (2A202602813) - Member: thiết kế misconception bank, prompt logic, fallback rules theo profile.
  - Hà Thị Mỹ Linh (2A202602619) - Member: user test >=5 bạn, ghi log trước/sau, tổng hợp phản hồi và slide kết quả.

- Willing users (bonus validation):
  - Nguyễn Hoàng Cường - Học viên profile Data/AI
  - Văn Thành Huy - Học viên profile IT/Dev
  - Nguyễn Tiến Phát - Học viên profile Non-IT
  - Kế hoạch vòng validation: cho mỗi bạn làm 1 mini-flow 3 câu (1 câu sai để test hint, 1 câu sửa sau hint, 1 câu survey để đánh giá độ phù hợp profile), log thời gian và mức độ hiểu.

- Multi-prototype (nếu làm):
  - PA1: Rule-based profile-aware hint ladder.
  - PA2: Classifier profile + retrieval semantic similarity theo từng nhóm.
  - Tiêu chí chọn: độ chính xác cao hơn và thời gian phản hồi <= 6s.

## §9. Changelog

| Thời điểm | Đổi gì | Vì sao (trỏ về feedback/case nào) |
|---|---|---|
| 17/09/2026 | Chuyển trọng tâm từ adaptive quiz feedback chung sang profile-aware personalized learning | Đề bài của nhóm xác định rõ: mỗi học viên có background nghề nghiệp khác nhau và nên nhận câu hỏi, ví dụ, phản hồi khác nhau dù cùng kiến thức |
| 17/09/2026 | Thêm profile map Data/AI, IT/Dev, Non-IT vào golden set và prompt logic | Duy trì tính phù hợp với khóa học K4 và các nhóm học viên khác nhau |
| 18/09/2026 | Dựng khung CP3: `codebase/index.html` (luồng 4 bước, ladder gợi ý→giải thích→làm lại, trace), `server/` proxy + log, `AI_CONTRACT.md`; giữ `prototype.html` làm bản CP2 | vlearn_cp3.md yêu cầu ≥1 lời gọi AI thật tại quyết định trung tâm + log prompt/raw; tách UI khỏi AI để AI Engineer ghép độc lập |
| 18/09/2026 | Golden set nháp 24 case trong `eval/` theo 4 lớp chỗ khó + User Input Grid; 15 case từ chatlog K4 (T10472, T10471, T10451, T10509, T10729, T11237, T11043, T11736, T12701, T10318, T10814, T10330, T11020, T10687, T10441) | Thay cơ cấu cũ "8 case/persona" (không phủ 4 lớp) bằng cơ cấu guide §2.6 |
| 18/09/2026 | Gắn mã đoạn transcript thật cho từng câu (`anchors`, `anchor_confidence`); phát hiện transcript **không có** đoạn về vector DB/embedding/chunking | Tránh AI bịa trích dẫn (lớp ①): chỉ được trích trong danh sách anchors, không có thì nói rõ |
| 18/09/2026 | Khoá đáp án sau "Kiểm tra" (bỏ "Tôi tự sửa → chọn lại"); pill 1–20 + progress; gợi ý trước-nộp ẩn mặc định, sinh sẵn bằng AI batch; sidebar Tiến độ + Kiến thức đang luyện | Đối chiếu giao diện VLearn thật (ảnh teamlead gửi): nút Kiểm tra là nộp câu; tiết kiệm token so với gọi AI mỗi lần bấm gợi ý |
| 18/09/2026 | Thêm phản hồi học viên 👍/👎 + 4 lý do trên từng khối AI, lưu `feedback.jsonl` + trace | Cần dữ liệu "AI có phù hợp với trình độ không" từ người dùng thật cho CP5, đối chiếu được với prompt/response |
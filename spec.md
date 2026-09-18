# AI SPEC — Personalized Quiz Feedback D2 · Nhóm Enigma · Zone C3
Hướng: [x] D — Học tập thích ứng & tương tác trên VLearn
Loại: [x] Tính năng mới

## §1. User & Job
- Job executor + workflow:
  - Job executor: Học viên K4 đang làm quiz/lab trên VLearn, trong đó mỗi người đến từ các bối cảnh nghề nghiệp khác nhau.
  - Workflow hiện tại: xem nội dung -> làm quiz/lab -> trả lời sai -> đọc phản hồi chung -> thử lại theo cảm tính.
  - Điểm nghẽn: cùng một khái niệm được giảng dạy trong buổi học nhưng câu hỏi và phản hồi chưa được điều chỉnh theo profile của người học. Học viên từ Data/AI, IT/Dev và Non-IT sẽ hiểu cùng một câu hỏi với mức độ liên hệ và ví dụ khác nhau.
- Core JTBD (không tên sản phẩm/AI trong câu):
  - Khi tôi làm quiz hoặc lab và không chắc về kiến thức, tôi muốn nhận được gợi ý và giải thích phù hợp với nền tảng nghề nghiệp của mình, để hiểu đúng bản chất của khái niệm ngay sau lần nộp hiện tại.
- Problem statement (khong dung chu AI):
  - Hệ thống hiện tại đưa ra phản hồi chung cho mọi học viên dù họ đến từ các profile khác nhau, khiến học viên khó kết nối khái niệm với bối cảnh công việc thực tế của mình. Kết quả là học viên sai lặp lại nhiều lần vì không hiểu đúng giả định mà câu hỏi đang kiểm tra.
- Evidence (chuẩn B mining; chưa thực hiện khảo sát chuẩn A):
  - Mining trên `data/vlearn-pack/chatlog/tutor_turns.csv` có 13.494 lượt; chỉ 20 lượt có `understanding_level` và 28 lượt có `move_used=ask_probing_question`. Đây là proxy cho thấy phản hồi chẩn đoán/kiểm tra hiểu còn ít và cần được đo có hệ thống hơn.
  - Các ví dụ kiểm lại được ghi trong `canvas.md` (`T10317`, `T10318`, `T10326`, `T10484`, `T10291`); trước khi nộp chính thức cần bổ sung quote nguyên văn và phương pháp đếm vào evidence pack.
  - 3 nhóm profile chính cần cân nhắc:
    - Data/AI: quen với khái niệm dữ liệu, thống kê, mô hình, pipeline, độ tin cậy.
    - IT/Dev: quen với coding, hệ thống, logic, API, architecture.
    - Non-IT: quen với quy trình, business, workflow, hiểu biết ứng dụng kinh doanh hơn là kỹ thuật sâu.
  - Sự khác biệt này ảnh hưởng trực tiếp đến cách đặt câu hỏi và cách sinh feedback:
    - Cùng một kiến thức “tokenization”, câu hỏi cho Data/AI có thể liên quan đến “đọc dữ liệu, preprocessing, embedding”.
    - Cùng kiến thức đó, câu hỏi cho IT/Dev có thể liên quan đến “string processing, API payload / parsing logic”.
    - Với Non-IT, câu hỏi nên tập trung vào “ý nghĩa thực tiễn, ví dụ trong workflow công việc, không quá chuyên sâu về kỹ thuật”.
  - Khảo sát/PV chuẩn A: chưa thực hiện; đây là phần còn thiếu, không dùng kết quả khảo sát để khẳng định trong spec.

## §2. Impact & quyết định chọn
- Bảng impact (3 ứng viên):

| Ứng viên pain | Bao nhiêu người bị ảnh hưởng | Tần suất | Tốn gì mỗi lần | Khả thi 30h |
|---|---:|---:|---|---|
| A. Học viên làm sai nhưng feedback không phù hợp profile | 13.494 lượt chatlog là quần thể mining; chưa có tỷ lệ profile-fit riêng | Proxy hiện có: chỉ 20 lượt có `understanding_level` | 3-10 phút/lượt thử lại (ước lượng cần validate) | Cao |
| B. Câu hỏi/giải thích quá kỹ thuật hoặc quá business | 3 nhóm profile được xác định trong data pack | Chưa có khảo sát định lượng | 2-8 phút/lượt (ước lượng cần validate) | Cao |
| C. Học viên không biết liên hệ khái niệm với bối cảnh công việc | 28 lượt có probing question trên 13.494 lượt mining | Proxy tần suất thấp, chưa phải prevalence chính thức | 3-7 phút/lượt (ước lượng cần validate) | Trung bình |

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
  - Một học viên chọn profile Non-IT, IT/Dev hoặc Data/AI, vào một trong 20 câu quiz AI track và chọn đáp án. Hệ thống tự prefetch hint bằng Qwen local; khi bấm “Kiểm tra”, một request `diagnose` trả về verdict deterministic theo answer key cùng nhận định lỗi, hint và explanation theo persona trong một khối duy nhất.
  - Mentor là profile tùy chọn để gọi cùng câu hỏi cho cả ba persona và so sánh ba output; đáp án đúng không thay đổi giữa các profile.
- Non-goals:
  - Không xây hệ thống toàn khóa cho mọi bài học và mọi loại câu hỏi.
  - Không dự đoán hoàn toàn nghề nghiệp thực tế của học viên từ CV nếu không có dữ liệu đầy đủ.
  - Không thay thế toàn bộ tutor hiện có trên VLearn.
  - Không xử lý các câu hỏi hành chính, lịch học, nộp bài, điểm số.
- Mức prototype nhắm tới: [ ] Sketch [ ] Mock [x] Working
  - Bản production demo chạy từ `codebase/index.html` qua `server/server.js`; UI mặc định gọi Qwen 2.5 7B local bằng Ollama, không cần API key.
  - Khi vào câu, `AI.explain({mode:"hint"})` được gọi nền để sinh hint. Khi bấm “Kiểm tra”, `AI.explain({mode:"diagnose"})` sinh nhận định lỗi, hint và explanation cùng lúc; verdict vẫn do answer key deterministic quyết định.
  - `POST /api/explain`, prompt/raw response/latency và generation metadata được ghi vào Trace; transcript retrieval local chỉ cho phép citation nằm trong anchors, không có nguồn thì dùng fallback rõ ràng.
  - Mentor gọi ba request diagnose theo ba persona; phản hồi được hiển thị cạnh nhau. Like/dislike gắn với `trace_id` và lưu feedback.
  - Mock chỉ còn là adapter nội bộ cho smoke test/offline; không còn là lựa chọn trên UI production.
- Automation: [x] augment [x] conditional [ ] automate
  - Lý do (theo cost-of-error, §2.3):
    - **Augment** cho bước sinh hint/explanation theo profile: AI tạo bản giải thích, còn answer key deterministic và citation guardrail kiểm soát factual core. Nếu model sinh sai persona hoặc bịa nguồn, người học có thể hiểu sai; vì vậy output phải có trace, metadata và feedback để nhóm review.
    - **Conditional** cho bước chọn hồ sơ và sinh explanation: profile rõ thì Qwen local sinh hint/explanation; profile `Chưa rõ` thì hệ thống hỏi lại, không đoán. Không có transcript phù hợp thì trả fallback rõ ràng thay vì bịa nguồn (`codebase/index.html` + `server/server.js`).
    - Automate bị loại vì sai ở đây không rẻ và học viên (nhất là Non-IT) không phải lúc nào cũng tự nhận ra được ngay khi giải thích sai profile.

### §4b. Nguyên tắc đã áp dụng (HAX/PAIR)

*Vị trí cụ thể trỏ vào bản production `codebase/index.html` và các file JS liên quan — mở server localhost để kiểm chứng trực tiếp.*

| Nguyên tắc (mã HAX) | Áp cụ thể vào đâu trong production demo |
|---|---|
| **G2** — Làm rõ nó làm tốt đến đâu *(nhóm khởi đầu)* | Badge `LOCAL AI · Qwen 7B`, metadata Provider/API/Model trong `#sec-ai` và phần mô tả persona nói rõ hệ thống sinh hint/explanation theo hồ sơ; answer key vẫn deterministic, model không tự quyết định điểm. |
| **G10** — Thu hẹp phạm vi khi nghi ngờ *(bắt buộc)* | Nút `#btn-check` ("Kiểm tra") bị khóa (`disabled`) cho tới khi học viên đã chọn một đáp án — hệ thống không tự suy đoán câu trả lời hay tự chấm khi chưa có input rõ ràng. Tương ứng ngoài đời: khi chưa xác định được profile/độ tin cậy, hệ thống hỏi lại thay vì đoán (mô tả ở §4 phần Conditional). |
| **G9** — Sửa dễ dàng | `.persona-card` ở bước hồ sơ cho phép đổi Non-IT / IT-Dev / Data-AI / Mentor; người học có thể đổi góc nhìn mà không sửa answer key hay dữ liệu câu hỏi. |
| **G11** — Giải thích vì sao | `#sec-ai` sau khi bấm `#btn-check` hiển thị một khối duy nhất gồm nhận định lỗi, gợi ý, explanation, nguồn/fallback và metadata model — gắn lý do trực tiếp với đáp án vừa nộp. |

## §5. Kiểu lỗi — 4 lớp chỗ khó + kịch bản

| ID | Lớp lỗi | Kịch bản lỗi | Hậu quả | Cách xử lý trong production demo |
|---|---|---|---|---|
| E1 | ① Nguồn sự thật | Feedback không dựa trên bài học hoặc không phù hợp profile | Học viên hiểu sai càng sâu | Chặn phản hồi, yêu cầu dùng nguồn bài học và ví dụ tương ứng |
| E2 | ① Nguồn sự thật | Cùng một câu hỏi bị gắn ví dụ sai cho profile | Học viên cảm thấy đề không hợp lý | Xác thực profile trước khi cấp câu hỏi mới |
| E3 | ② Mơ hồ/thiếu thông tin | Học viên không rõ mình thuộc nhóm nào | Lỗi phân loại profile sai | Hỏi 1 câu ngắn để xác định profile hoặc mức độ quen thuộc |
| E4 | ② Mơ hồ/thiếu thông tin | Cùng một khái niệm nhưng nhiều cách hiểu tùy bối cảnh | Chấm sai oan | Cho phép nhiều đáp án đúng theo từng profile, rồi yêu cầu giải thích ngắn |
| E5 | ③ Ngoài phạm vi/thẩm quyền | Học viên hỏi deadline, điểm, thông tin cá nhân | Trải nghiệm lệch mục tiêu D2 | Route sang khu vực hành chính riêng |
| E6 | ③ Ngoài phạm vi/thẩm quyền | Học viên yêu cầu “cho đáp án luôn” hoặc hỏi system prompt/model | Mất mục tiêu học từ lỗi hoặc lộ thông tin hệ thống | Model từ chối ngoài phạm vi; UI vẫn chỉ hiển thị explanation theo câu hỏi đã nộp |
| E7 | ④ Đặc thù domain học tập | Câu hỏi dạng kỹ thuật quá sâu cho Non-IT hoặc quá business cho Data/AI | Người học mất niềm tin | Có bộ template theo từng profile và độ sâu tùy nhóm |
| E8 | ④ Đặc thù domain học tập | Feedback quá dài, nhiều khái niệm không liên quan | Học viên bỏ cuộc | Giới hạn phản hồi 2-3 câu + 1 câu kiểm tra lại |

## §6. Bốn đường đi của trải nghiệm
*Đối chiếu trực tiếp trong `codebase/index.html` khi chạy server localhost.*

- Happy path:
  - Học viên làm sai -> hệ thống xác định profile -> tạo lại câu hỏi hoặc hint theo profile -> học viên hiểu đúng ở lần quay lại.
  - Trong production demo: chọn persona -> chọn đáp án -> bấm "Kiểm tra" -> banner đúng/sai + một khối explanation theo persona hiện ra.
- Low-confidence (②):
  - Không chắc học viên thuộc nhóm nào -> hỏi 1 câu ngắn để xác định profile trước khi cho feedback.
  - Trong production demo: nút "Kiểm tra" khóa (`disabled`) khi chưa chọn đáp án; profile `Chưa rõ` yêu cầu chọn lại persona trước khi giải thích.
- Failure/không căn cứ (①):
  - Không đủ dữ liệu hoặc không tìm thấy phần nội dung tương ứng -> nói rõ “chưa đủ căn cứ” và gợi ý xem lại bài học, không bịa citation.
  - Trong production demo: chọn đáp án sai -> bấm "Kiểm tra" -> banner lỗi và một khối gồm nhận định, hint, explanation; citation chỉ lấy từ anchors hoặc ghi fallback.
- Correction (user sửa):
  - Học viên xem hint trước khi nộp, sau đó bấm “Kiểm tra” để nhận một khối explanation gồm nhận định lỗi + hint + giải thích theo cùng profile.
  - Học viên có thể đổi profile hoặc chọn Mentor để so sánh cách diễn đạt; đáp án đúng và nguồn không đổi theo profile.
- Khi bị đòi ngoài phạm vi (③):
  - Hỏi về điểm, deadline, thông tin hành chính -> từ chối lịch sự, chuyển kênh phù hợp.
- Case đặc thù domain (④):
  - Cùng một đáp án đúng nhưng giải thích sai vì khác bối cảnh nghề nghiệp -> yêu cầu học viên giải thích ngắn theo góc nhìn profile của mình.
  - Trong production demo: đổi persona hoặc chọn Mentor để so sánh ba cách diễn đạt; answer key và factual core giữ nguyên (G9 — sửa dễ dàng, §4b).

## §7. Kiểm thử
- Chiều chất lượng + định nghĩa kiểm chứng:
  - Factual correctness: output không mâu thuẫn với đáp án chuẩn và core concept trong gold set.
  - Persona fit: ngôn ngữ/ví dụ phù hợp Non-IT, IT/Dev hoặc Data/AI; đáp án đúng không đổi.
  - Diagnosis + hint: nhận định đúng giả định sai và hint không lộ đáp án.
  - Grounded/fallback: citation phải thuộc anchors; không có nguồn thì phải ghi fallback, không bịa citation.
  - Safety/schema: JSON đúng contract, case ngoài phạm vi từ chối đúng và không lộ system prompt.

- Golden set (`eval/golden_set.json` — bản nháp 0.1, 20 case, cần review; định nghĩa đạt và cơ cấu trong `eval/README.md`, lưới phủ trong `eval/user-input-grid.md`):
  - Cơ cấu theo guide §2.6: ① 2 case · ② 3 case · ③ 3 case · ④ 2 case · thường gặp 8 · hiếm 2; **15/20 case phát triển từ chatlog thật** (ghi `turn_id`).
  - Mỗi case gồm: `request` (mode, persona, question_id, learner_answer, followup_text/learner_explanation, attempt, history) và `expected` (verdict, must, must_not) theo `codebase/AI_CONTRACT.md`.
  - Ngân hàng 20 câu + lời giải mẫu 3 persona + mã đoạn transcript được phép trích dẫn: `codebase/js/data.questions.js` (Q16, Q19 không có transcript tương ứng — dùng làm case lớp ①).

- Quality bar (chốt tại CP4, giữ nguyên sau khi chạy):
  - Một output được chấm theo 5 chiều trên; điểm tổng hợp là trung bình các chiều trên toàn bộ gold set.
  - Đạt khi điểm trung bình tổng hợp từ gold set >= 75%, grounded/fallback đúng >= 90% và safety/schema/out-of-scope đạt 100%.
  - LLM judge chỉ là bộ chấm tự động: so sánh output sinh ra với `expected`/đáp án chuẩn trong gold set theo rubric; chưa thay thế chấm thủ công.

- Kết quả các lượt chạy (LLM judge, sơ bộ; chưa có human validation):
  - Baseline: **55%** điểm trung bình so với gold set.
  - Current: **87%** điểm trung bình so với gold set sau khi cải thiện prompt/model/pipeline.
  - Hai con số trên là kết quả tự động từ LLM judge; nhóm chưa chấm thủ công nên chưa được xem là kết quả xác nhận cuối cùng. Cần lưu report đầy đủ theo từng case, từng chiều và phân tích case trượt trong `eval/run-01-results.md`.

| Lần chạy | Số case | Profile alignment | Recovery rate | Grounded/fallback đúng | Ghi chú |
|---|---:|---:|---:|---:|---|
| Baseline | 20 | TBD | TBD | TBD | Chưa có phân nhóm profile, dùng feedback chung |
| Iteration 1 | 20 | TBD | TBD | TBD | Thêm profile mapping + personalized hint ladder |
| Iteration 2 | 20 | TBD | TBD | TBD | Tinh chỉnh prompt theo 3 nhóm và fallback low-confidence |

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
  - Không triển khai multi-prototype trong scope hiện tại; nhóm tập trung production pipeline Qwen local và một flow chính để đo ổn định.

## §9. Changelog

| Thời điểm | Đổi gì | Vì sao (trỏ về feedback/case nào) |
|---|---|---|
| 17/09/2026 | Chuyển trọng tâm từ adaptive quiz feedback chung sang profile-aware personalized learning | Đề bài của nhóm xác định rõ: mỗi học viên có background nghề nghiệp khác nhau và nên nhận câu hỏi, ví dụ, phản hồi khác nhau dù cùng kiến thức |
| 17/09/2026 | Thêm profile map Data/AI, IT/Dev, Non-IT vào golden set và prompt logic | Duy trì tính phù hợp với khóa học K4 và các nhóm học viên khác nhau |
| 18/09/2026 | Dựng khung CP3: `codebase/index.html` (luồng 4 bước, ladder gợi ý→giải thích→làm lại, trace), `server/` proxy + log, `AI_CONTRACT.md`; giữ `prototype.html` làm bản CP2 | vlearn_cp3.md yêu cầu ≥1 lời gọi AI thật tại quyết định trung tâm + log prompt/raw; tách UI khỏi AI để AI Engineer ghép độc lập |
| 18/09/2026 | Golden set nháp 20 case trong `eval/` theo 4 lớp chỗ khó + User Input Grid; 15 case từ chatlog K4 (T10472, T10471, T10451, T10509, T10729, T11237, T11043, T11736, T12701, T10318, T10814, T10330, T11020, T10687, T10441) | Thay cơ cấu cũ "8 case/persona" (không phủ 4 lớp) bằng cơ cấu guide §2.6 |
| 18/09/2026 | Gắn mã đoạn transcript thật cho từng câu (`anchors`, `anchor_confidence`); phát hiện transcript **không có** đoạn về vector DB/embedding/chunking | Tránh AI bịa trích dẫn (lớp ①): chỉ được trích trong danh sách anchors, không có thì nói rõ |
| 18/09/2026 | Khoá đáp án sau "Kiểm tra" (bỏ "Tôi tự sửa → chọn lại"); pill 1–20 + progress; gợi ý trước-nộp ẩn mặc định, sinh sẵn bằng AI batch; sidebar Tiến độ + Kiến thức đang luyện | Đối chiếu giao diện VLearn thật (ảnh teamlead gửi): nút Kiểm tra là nộp câu; tiết kiệm token so với gọi AI mỗi lần bấm gợi ý |
| 18/09/2026 | Thêm phản hồi học viên 👍/👎 + 4 lý do trên từng khối AI, lưu `feedback.jsonl` + trace | Cần dữ liệu "AI có phù hợp với trình độ không" từ người dùng thật cho CP5, đối chiếu được với prompt/response |
| 18/09/2026 | Chuyển pipeline production sang Ollama local với Qwen 2.5 7B; hint được prefetch khi vào câu; diagnose trả nhận định + hint + explanation trong một khối | Bỏ phụ thuộc API cloud, giảm nhầm lẫn giữa luồng hai bậc cũ và flow demo hiện tại |
| 18/09/2026 | Bổ sung đánh giá LLM judge trên gold set: baseline 55%, current 87% | Đo cải thiện tự động trước khi thực hiện vòng chấm thủ công của thành viên nhóm |

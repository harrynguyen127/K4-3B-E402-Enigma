/* Print one self-contained prompt for generating 20 questions x 3 personas
 * in ChatGPT Web. Correct answers are deliberately excluded. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const JS_DIR = path.resolve(__dirname, "..", "..", "js");

function loadBrowserData(file, key) {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(JS_DIR, file), "utf8"), ctx);
  return ctx.window[key];
}

const questions = loadBrowserData("data.questions.js", "QUESTION_BANK").map(q => ({
  id: q.id,
  topic: q.topic,
  question_type: q.question_type || "single_choice",
  stem: q.stem,
  options: q.options
}));

const prompt = `Bạn là trợ giảng của khóa “AI Thực Chiến”. Hãy sinh trước gợi ý học tập cho 20 câu quiz × 3 hồ sơ người học, tổng cộng đúng 60 gợi ý.

MỤC TIÊU
Gợi ý chỉ giúp người học biết nên suy nghĩ theo hướng nào TRƯỚC KHI nộp câu trả lời. Gợi ý không được làm lộ đáp án.

BA HỒ SƠ
- nonit: ít nền tảng IT/AI; dùng trực giác hoặc ví dụ đời thường; giải nghĩa thuật ngữ; tránh công thức, tên API và jargon không cần thiết.
- dev: hiểu programming, API, database, backend/frontend; dùng góc nhìn kiến trúc, data flow và implementation.
- dataai: hiểu ML/AI cơ bản; có thể dùng embedding, inference, vector, retrieval, attention, sampling; tập trung vào cơ chế và trade-off.

RÀNG BUỘC BẮT BUỘC CHO TỪNG GỢI Ý
1. Viết bằng tiếng Việt, tối đa 2 câu và tối đa 45 từ.
2. Không nói hoặc ám chỉ đáp án đúng.
3. Không nhắc chữ cái lựa chọn như A/B/C/D/E.
4. Không chép nguyên văn bất kỳ lựa chọn nào.
5. Không loại trừ trực tiếp một phương án và không nói “hãy chọn...”.
6. Không thêm kiến thức course-specific không có trong câu hỏi; chỉ đặt câu hỏi dẫn dắt hoặc nêu mental model chung.
7. Ba persona của cùng một câu phải khác cách diễn đạt rõ ràng nhưng cùng hướng tới một khái niệm.
8. Không thêm markdown, code fence, nhận xét, giải thích quy trình hoặc nội dung ngoài JavaScript được yêu cầu.

ĐỊNH DẠNG ĐẦU RA
Trả về đúng JavaScript hợp lệ theo mẫu sau, đủ Q01 đến Q20 và đủ nonit/dev/dataai cho từng câu:

window.HINT_BANK_META = {
  "generated_at": "MANUAL_CHATGPT_WEB",
  "model": "ChatGPT Web",
  "prompt_version": "manual-web-v1",
  "calls": 60,
  "failures": 0,
  "flagged": 0
};
window.HINT_BANK = {
  "Q01": {
    "nonit": { "hint": "...", "flagged": false },
    "dev": { "hint": "...", "flagged": false },
    "dataai": { "hint": "...", "flagged": false }
  }
};

Trước khi trả kết quả, tự kiểm tra: có đúng 20 question ID, đúng 60 hint, không hint nào rỗng, không nhắc chữ cái đáp án, và JavaScript parse được.

DỮ LIỆU CÂU HỎI (cố ý không cung cấp correct_answer để tránh lộ đáp án):
${JSON.stringify(questions, null, 2)}
`;

process.stdout.write(prompt);

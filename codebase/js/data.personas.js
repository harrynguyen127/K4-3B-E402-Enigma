/* Hồ sơ học viên (persona) — 3 nhóm chính theo Track_da_chon.md + trạng thái "chưa rõ".
 * Mô tả `style` được đưa nguyên văn vào prompt (xem server/prompt.js) để AI đổi
 * CÁCH GIẢI THÍCH, không đổi câu hỏi hay đáp án đúng. */
window.PERSONAS = {
  nonit: {
    key: "nonit",
    name: "Non-IT",
    short: "Business / vận hành / không code",
    badge: "Ví dụ đời thường, không thuật ngữ",
    style: "Người học không có nền tảng lập trình. Dùng ví dụ đời thường hoặc quy trình công việc (sổ tay, nhân viên mới, bàn làm việc). KHÔNG dùng công thức, ký hiệu toán, tên API. Nếu bắt buộc dùng thuật ngữ tiếng Anh thì giải thích ngay trong ngoặc.",
    clarifier_option: "Tôi làm nghiệp vụ / vận hành / kinh doanh, hầu như không viết code."
  },
  dev: {
    key: "dev",
    name: "IT / Dev",
    short: "Lập trình viên, kỹ sư phần mềm",
    badge: "Kiến trúc hệ thống, pipeline kỹ thuật",
    style: "Người học là lập trình viên. Giải thích theo kiến trúc hệ thống: request → pipeline → response, API, database, layer. Được dùng thuật ngữ kỹ thuật phần mềm; tránh đi sâu vào toán/thống kê của mô hình.",
    clarifier_option: "Tôi viết code / xây hệ thống phần mềm, chưa làm nhiều về mô hình ML."
  },
  dataai: {
    key: "dataai",
    name: "Data / AI",
    short: "Data scientist, ML engineer, phân tích dữ liệu",
    badge: "Thuật ngữ ML, tập trung khái niệm",
    style: "Người học có nền tảng dữ liệu / ML. Giải thích bằng khái niệm mô hình: distribution, representation, training vs inference, trade-off. Được dùng ký hiệu toán ngắn khi cần; không cần ví dụ đời thường.",
    clarifier_option: "Tôi làm việc với dữ liệu / mô hình ML (phân tích, huấn luyện, đánh giá)."
  },
  unknown: {
    key: "unknown",
    name: "Chưa rõ",
    short: "Chưa có hồ sơ — hệ thống sẽ hỏi 1 câu",
    badge: "Cần hỏi lại trước khi giải thích",
    style: null,
    clarifier_option: null
  }
};

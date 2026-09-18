/* SINH TỰ ĐỘNG bởi server/scripts/generate-hints.js — KHÔNG sửa tay.
 * Gợi ý trước-khi-nộp cho từng câu × persona. flagged=true: nghi lộ đáp án, nhóm đọc tay.
 * CHƯA CHẠY: generated_at = null → UI hiện "chưa có gợi ý". Chạy script khi callModel() đã sẵn sàng. */
window.HINT_BANK_META = { "generated_at": null, "model": null, "prompt_version": "0.2", "calls": 0, "failures": 0, "flagged": 0 };
window.HINT_BANK = {};

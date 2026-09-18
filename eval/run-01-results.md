# Kết quả lượt 1 — golden set 20 case

> **CHƯA CHẠY.** Điền sau khi server LIVE hoạt động. Không sửa số sau khi đã ghi; lượt sau ghi file `run-02-results.md`.

| Trường | Giá trị |
|---|---|
| Ngày giờ chạy | |
| Provider / model | |
| Phiên bản prompt (commit) | |
| Người chấm 1 / Người chấm 2 | |
| Log thô | `codebase/server/logs/____.jsonl` · trace UI: `eval/trace-____.jsonl` |

## Bảng kết quả từng case

Ký hiệu: ✔ đạt · ✘ trượt · – không áp dụng cho case này.

| Case | Nhóm | Persona fit | Diagnosis | Grounded/fallback | Safe | ĐẠT toàn case | Ghi chú ngắn |
|---|---|---|---|---|---|---|---|
| GS-01 | common | | | | | | |
| GS-02 | common | | | | | | |
| GS-03 | common | | | | | | |
| GS-04 | common | | | | | | |
| GS-05 | common | | | | | | |
| GS-06 | common | | | | | | |
| GS-07 | common | | | | | | |
| GS-08 | common | | | | | | |
| GS-09 | ① | | | | | | |
| GS-10 | ① | | – | | | | |
| GS-11 | ② | – | – | – | | | |
| GS-12 | ② | – | – | – | | | |
| GS-13 | ② | | – | | | | |
| GS-14 | ③ | – | – | – | | | |
| GS-15 | ③ | – | – | – | | | |
| GS-16 | ③ | – | – | – | | | |
| GS-17 | ④ | | | | | | |
| GS-18 | ④ | | | | | | |
| GS-19 | rare | | – | | | | |
| GS-20 | rare | | – | | | | |

## Tổng hợp

| Chỉ số | Số case áp dụng | Đạt | % |
|---|---|---|---|
| Persona fit | | | |
| Diagnosis | | | |
| Grounded / fallback đúng | | | |
| Safe (② + ③) | | | |
| **Đạt toàn case** | 20 | | |
| Case lớp ③ từ chối an toàn | 3 | | (quality bar yêu cầu 100%) |

Đối chiếu quality bar đã chốt trong `spec.md §7`: **ĐẠT / CHƯA ĐẠT** — …

## Phân tích từng case trượt

Mỗi case trượt một mục: *hiện tượng → nguyên nhân giả định (prompt / anchor thiếu / model / định nghĩa) → sẽ sửa gì ở lượt 2*.

- GS-__ : …

## Độ lệch giữa hai người chấm

5 case chấm chéo: ____. Số case lệch: __/5 → định nghĩa (giữ nguyên / đã sửa, xem changelog).

# Kết quả iteration hiện tại — golden set 20 case

> Đây là bảng tổng hợp iteration hiện tại do nhóm cung cấp. Bảng chi tiết từng case và log raw cần bổ sung để người chấm kiểm tra lại từng kết quả.

| Trường | Giá trị |
|---|---|
| Ngày giờ chạy | Chưa cung cấp |
| Provider / model | Chưa cung cấp trong bảng kết quả |
| Phiên bản prompt (commit) | Chưa cung cấp |
| Người chấm 1 / Người chấm 2 | Chưa chấm chéo |
| Log thô | Chưa đính kèm; cần thêm log đã loại dữ liệu bí mật |

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
| Hint no-leak | 20 | 20 | 100% |
| Persona fit | 20 | 16 | 80% |
| Grounded / fallback đúng | 20 | 20 | 100% |
| Safety | 20 | 20 | 100% |
| **Đạt toàn case** | 20 | 16 | 80% |

## Đối chiếu quality bar

| Tiêu chí | Kết quả | Ngưỡng | Trạng thái |
|---|---:|---:|---|
| Pass toàn case | 16/20 | ≥16/20 | Đạt |
| Persona fit | 16/20 | ≥17/20 | Chưa đạt |
| Grounding | 20/20 | ≥18/20 | Đạt |
| Safety | 20/20 | 20/20 | Đạt |

**Kết luận iteration:** Chưa đạt toàn bộ quality bar vì Persona fit còn 1 case dưới ngưỡng.

## Phân tích từng case trượt

Mỗi case trượt một mục: *hiện tượng → nguyên nhân giả định (prompt / anchor thiếu / model / định nghĩa) → sẽ sửa gì ở lượt 2*.

- Chưa có bảng mapping kết quả theo từng GS; không tự suy đoán case trượt từ số tổng hợp.

## Độ lệch giữa hai người chấm

5 case chấm chéo: ____. Số case lệch: __/5 → định nghĩa (giữ nguyên / đã sửa, xem changelog).

# Quyết định và điểm OPEN

| ID      | Trạng thái | Xử lý hiện tại                                                                                                         | Điều kiện production                           |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| ADR-01  | PROPOSED   | Modular monolith NestJS/PostgreSQL/Prisma                                                                              | Đánh giá lại sau khi có OPEN-09                |
| ADR-02  | PROPOSED   | Lượng 3 số lẻ, giá 4, hệ số 6; không dùng float                                                                        | Chủ dự án xác nhận precision/làm tròn          |
| ADR-03  | PROPOSED   | Bearer JWT + session DB; kiểm tra grant mỗi request                                                                    | Xác nhận TTL/CORS/secret store                 |
| OPEN-01 | OPEN       | Lượng nhận thừa được giữ trong discrepancy nhưng không tự nhập; adjustment post chặn tồn âm; báo hỏng không tự trừ tồn | Chốt thời điểm tồn, tồn âm, thừa/hỏng/hoàn     |
| OPEN-02 | OPEN       | Chưa mở đổi nguồn đơn đang thực hiện                                                                                   | Chốt actor và trạng thái được đổi              |
| OPEN-03 | OPEN       | Chỉ bật resolve/close/confirm và approve/post adjustment khi `DEMO_POLICY_ENABLED=true`; production mặc định chặn      | Chốt quyền và nguyên tắc tách người lập/duyệt  |
| OPEN-04 | OPEN       | Demo kho riêng Bếp/Bàn                                                                                                 | Chốt kho chung, cutoff và reopen               |
| OPEN-05 | OPEN       | Có adapter import thủ công, staging/validate/preview/commit, mapping và chống trùng; chưa gọi API iPOS thật            | Cung cấp API/file iPOS và mapping thật         |
| OPEN-06 | OPEN       | Chưa bật cảnh báo vận hành                                                                                             | Chốt ngưỡng/đơn vị/lịch nhắc                   |
| OPEN-07 | OPEN       | CSV demo chưa phát hành                                                                                                | Chốt mẫu export, giá và actor payment          |
| OPEN-08 | OPEN       | Chưa phát hành attachment API; discrepancy/báo hỏng vẫn lưu được dữ liệu nghiệp vụ không kèm file                      | Chốt lúc bắt buộc ảnh, loại/cỡ file và storage |
| OPEN-09 | OPEN       | Pool mặc định tối đa 20; chưa cam kết SLA                                                                              | Cung cấp tải, hạ tầng, RPO/RTO/retention       |

Khi một quyết định được xác nhận, bổ sung người xác nhận, ngày, ảnh hưởng schema/API/test vào bảng này.

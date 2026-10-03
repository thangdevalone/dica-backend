# Trạng thái module

| Module                  | Trạng thái               | Ghi chú                                                                                                                                                                       |
| ----------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE-01 Auth/RBAC         | Luồng chính hoàn tất     | Login/refresh/logout/me, thu hồi session, permission/scope; quản trị user/role/grant và vô hiệu hóa token hiện hành                                                           |
| BE-02 Tổ chức           | Luồng chính hoàn tất     | Facility/location/department và ràng buộc cùng facility                                                                                                                       |
| BE-03 Danh mục          | Luồng chính hoàn tất     | Unit/group/ingredient/supplier/link; quy đổi có version, thời gian hiệu lực và chặn khoảng chồng lấn                                                                          |
| BE-04 Nguồn cấp         | Hoàn tất cho luồng thử   | Eligibility, source, history, bulk atomic                                                                                                                                     |
| BE-05 Xin/đặt hàng      | Hoàn tất luồng thử       | Create/update draft/submit/approve/reject/revise/cancel/refresh routing, split order, close outstanding và hủy đơn chưa phát sinh ledger; change-source/export chờ OPEN-02/07 |
| BE-06 Giao nhận         | Hoàn tất luồng thử       | Dispatch/receipt từng phần, ledger, thiếu/thừa thành discrepancy; resolve chỉ đóng hồ sơ, không tự nhập lượng thừa; ảnh chờ OPEN-08                                           |
| BE-07 Điều chuyển       | Luồng chính hoàn tất     | Tạo/sửa draft/submit/duyệt/từ chối/cancel, tự duyệt tuyến Kho tổng↔Bếp tổng và dùng chung engine giao nhận                                                                    |
| BE-08 Kiểm kê           | Luồng demo hoàn tất      | Tạo/sửa/submit và snapshot tồn dự kiến/chênh lệch; reopen được policy-gate theo OPEN-04; không tự điều chỉnh tồn                                                              |
| BE-09 Hao hụt/báo hỏng  | Luồng demo hoàn tất      | Import thủ công, mapping, định mức version, tính variance có trạng thái thiếu dữ liệu; báo hỏng có sửa draft và không tự trừ tồn; alert chỉ test/inactive do OPEN-06          |
| BE-10 Báo cáo           | Luồng đọc chính hoàn tất | Tồn, thực hiện đơn, variance, báo hỏng, payment; bộ lọc nghiệp vụ nâng cao và export chờ OPEN-07                                                                              |
| BE-11 Thông báo/lịch sử | Luồng chính hoàn tất     | Outbox worker, audit query, notification list/detail/mark-read, kiểm tra lại quyền resource và audit tập trung cho mọi cấu hình admin hiện có                                 |
| BE-12 Vận hành          | Một phần                 | Pino/request ID/redaction, phân trang offset/cursor và index dữ liệu lớn, Docker, migration, seed, health, OpenAPI, backup/restore; cần diễn tập restore trên hạ tầng thật    |

Luồng điều chỉnh tồn đã có create/approve/post, signed ledger, idempotency và chặn tồn âm. Approve/post, resolve discrepancy, đóng lượng còn thiếu và confirm báo hỏng chỉ chạy khi `DEMO_POLICY_ENABLED=true`; production mặc định chặn bằng `POLICY_NOT_CONFIGURED` cho đến khi OPEN-03 được chốt.

Các phần còn lại đáng chú ý: order change-source/export, attachment, filter/export báo cáo và live integration với iPOS. Những phần này chưa được coi là nghiệm thu hoàn tất.

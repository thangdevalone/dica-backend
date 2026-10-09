# Quyết định và phần còn chờ

Cập nhật: 09/10/2026. [Câu trả lời khách ngày 08/10/2026](customer-flow-questions-response.md) là nguồn nghiệp vụ hiện hành, ưu tiên hơn `new-flow.md` và `flow.md`. [TASK.md](../TASK.md) theo dõi tiến độ hiện tại.

## Quyết định đang áp dụng

| Nội dung                       | Cách áp dụng                                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Giao diện                      | Mobile xử lý nghiệp vụ; Web cấu hình. NCC dùng chung mobile, chỉ đọc đơn/giá của mình.                                                              |
| Phiếu bị từ chối/đổi sau duyệt | Tạo mới; hủy chỉ trước nhận đã ghi sổ và cần đúng quyền.                                                                                            |
| Thiếu/thừa                     | Bù nhiều lần trong ngày, 00:00 đóng phần thiếu; thừa nhập tồn.                                                                                      |
| Điều chuyển                    | Kho tổng ↔ Bếp tổng tự duyệt và thông báo; Chi nhánh ↔ Chi nhánh, Bếp tổng ↔ Chi nhánh cần duyệt. Không điều chuyển trực tiếp Chi nhánh ↔ Kho tổng. |
| Hoàn                           | Về nguồn đã cấp, hoàn một phần, ảnh hàng cùng hóa đơn; quản lý/Chủ duyệt, chốt cuối ngày duyệt.                                                     |
| Kiểm kê/báo hỏng               | Nhân viên nhập số thực tế, quyền riêng xem lệch/điều chỉnh. Báo hỏng có ảnh giảm tồn một lần khi gửi. Tồn vật lý có thể âm.                         |
| Giá/tiền                       | Lưu giá NCC/hàng; ADMIN đặt giá chuẩn/ngưỡng; tùy chọn xác nhận hai người; tiền theo lượng thực giữ lại.                                            |
| Ảnh                            | R2 riêng tư, upload presigned, đọc qua API có quyền; 1–10 ảnh mỗi lần nhận, lưu 6–12 tháng. Quyết định public ngày 07/10 đã bị thay thế.            |
| Thông báo                      | Inbox/push theo quyền tài nguyên; nhắc mỗi giờ đến khi đọc, không giờ im lặng. Alarm native cần app thực hiện.                                      |
| Xóa                            | ADMIN xem phạm vi và nhập mật khẩu; xóa lịch sử liên quan. Ngừng sử dụng giữ lịch sử.                                                               |

## Lựa chọn kỹ thuật hiện tại

- NestJS modular monolith, PostgreSQL/Prisma; bút toán có transaction/idempotency.
- Bearer JWT + session, kiểm tra quyền/scope mỗi request.
- Lượng 3 số lẻ, giá 4, hệ số quy đổi 6; dùng Decimal.
- Pool mặc định 20 connection; chưa cam kết tải/SLA/RPO/RTO.
- `audit.read` hiện cần grant cấp tổ chức; chưa có audit chung theo scope cơ sở cho mọi resource.

## Còn chờ

| Nội dung             | Cần có                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Mobile               | Source app, test camera/offline/retry và alarm Android/iOS.                                   |
| iPOS                 | API/webhook/file, môi trường thử, mapping hóa đơn hủy. Hoàn món/combo ngoài phạm vi hiện tại. |
| Phiếu NCC ngoài app  | Mẫu hóa đơn/PDF/ảnh và triển khai xuất phiếu; chưa có endpoint PDF.                           |
| Cảnh báo tồn/hao hụt | Rule mới chỉ là thử nghiệm, chưa có job gửi cảnh báo vận hành; cần chốt ngưỡng/lịch/cooldown. |
| Hạ tầng              | Smoke test R2 private/FCM, giám sát worker, backup/phục hồi theo yêu cầu vận hành.            |

Xem [review hiện hành](new-flow-implementation-review.md) và [contract mobile](mobile-integration.md) để phân biệt code/test với phần chưa kiểm thử dịch vụ thật.

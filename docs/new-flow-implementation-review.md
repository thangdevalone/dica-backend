# Review flow DICA

Ngày review: 09/10/2026. Phạm vi: Backend, Web Admin và contract mobile; workspace không có source mobile.

## Kết luận

FE Web và BE khớp các cấu hình cần thiết cho flow khách chốt ngày 08/10/2026. API có các nghiệp vụ tương ứng và test PostgreSQL cho quy tắc chính. Build thành công không chứng minh mobile, iPOS hoặc hạ tầng ảnh/push đã chạy end-to-end.

`new-flow.md` là mô tả ban đầu; [câu trả lời khách](customer-flow-questions-response.md) được ưu tiên: đóng thiếu 00:00, nhập tồn hàng thừa, NCC xem giá đơn của mình, ảnh riêng tư và Web chỉ cấu hình. Nội dung trả lời gốc được giữ nguyên.

## Web Admin và Backend

| Cấu hình            | Web                                             | Backend                                                               | Kết quả                                        |
| ------------------- | ----------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| Cơ cấu              | Cơ sở, kho, bộ phận                             | `/facilities`, `/stock-locations`, `/departments`                     | Khớp                                           |
| Danh mục            | Nhóm, đơn vị, nguyên liệu, quy đổi              | Catalog/conversion kiểm tra tổ chức và hiệu lực                       | Khớp                                           |
| NCC                 | Số điện thoại, hàng, giá, NCC ưu tiên           | `/suppliers`, `/supplier-ingredients`, một NCC ưu tiên hoạt động/hàng | Khớp                                           |
| Hàng được xin       | Nhóm và ngoại lệ từng hàng                      | `/group-eligibility`, `/item-eligibility`, ngoại lệ ưu tiên           | Khớp                                           |
| Nguồn cấp           | Kho hoặc NCC theo cơ sở/bộ phận/hàng            | `/source-rules`, bulk atomic, kiểm tra lại khi duyệt                  | Khớp                                           |
| Tài khoản           | Loại, liên kết NCC, vai trò/phạm vi             | User/role/grant, chặn API nội bộ cho SUPPLIER                         | Khớp                                           |
| Chính sách          | Giá chuẩn/ngưỡng, thanh toán hai người, lưu ảnh | `/price-rules`, `/workflow-policy`, quyền ADMIN riêng                 | Khớp                                           |
| iPOS                | Mapping, định mức, cảnh báo                     | Mapping/recipe/alert rule, import thủ công trên API                   | Khớp cấu hình; chưa kết nối thật               |
| Nhật ký/xóa         | Nhật ký, ngừng sử dụng, preview/mật khẩu xóa    | Audit và purge ADMIN                                                  | Khớp; xóa có thể liên quan nhiều cơ sở         |
| Phân chia giao diện | Không menu xử lý nghiệp vụ, không tour          | API phân loại Mobile/Web                                              | Khớp; hướng dẫn đã đổi thành các bước cấu hình |

## Nghiệp vụ và contract mobile

| Quy tắc                         | Code chính                                | Bằng chứng kiểm thử                                         |
| ------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| Từ chối tạo mới, hủy trước nhận | Request/Order/Transfer, `cancel-order.ts` | Phiếu từ chối bất biến; hủy sau xuất đảo transit            |
| Lượng/giá dùng đơn vị cơ sở     | Request/Transfer, migration 003           | Xin 2 bao × 5 kg phát hành 10 kg, nhận/tiền đúng            |
| Thiếu/thừa, giao bù, 1–10 ảnh   | Delivery/Attachment                       | Ảnh bắt buộc, thừa cộng tồn/tiền một lần, bù nhiều lần      |
| 00:00 đóng thiếu, chặn nhận trễ | Delivery, WorkflowWorker                  | Chốt thiếu và retry theo giờ Việt Nam                       |
| Tuyến và khoảng giờ điều chuyển | Transfer                                  | Tuyến cấm, Kho tổng ↔ Bếp tổng tự duyệt, start/end          |
| Hoàn về nguồn gốc, cuối ngày    | Workflow service/worker                   | Hoàn một phần giảm hóa đơn một lần, lý do từ chối/thông báo |
| Giá và thanh toán hai người     | Workflow/Reporting                        | Lưu giá, cảnh báo, người nhập không tự xác nhận, thông báo  |
| Báo hỏng một lần, tồn âm        | Operation/Delivery                        | Submit giảm, confirm không trừ lại, xuất khi tồn âm         |
| Kiểm kê mù, lịch sử lệch đỏ     | Operation, response visibility            | Redaction và audit `highlight=RED`                          |
| Nhắc và thu hồi quyền           | Worker, Inventory/Push                    | UNREAD/READ, quyền bị thu hồi, lọc push                     |
| NCC chỉ đọc đơn/giá của mình    | Supplier projection/PermissionGuard       | Schema/phạm vi, chặn nội bộ dù cấp nhầm quyền               |
| Hủy dữ liệu bán hàng            | Ipos                                      | Audit/thông báo, giữ dữ liệu gốc, tính lại tiêu hao         |
| Xóa ADMIN                       | Purge                                     | Mật khẩu, preview thay đổi và các loại gốc xóa              |

[mobile-integration.md](mobile-integration.md) mô tả payload, trạng thái và giới hạn thực tế. Ảnh dùng Bearer token; giá bị ẩn không coi là 0; thanh toán lấy version riêng. Hoàn APPROVED chưa có `postedAt` vẫn chờ hạch toán.

## Điểm sửa trong lần review

1. Viết lại README Web từ template và rút gọn README Backend: flow, setup, bootstrap, test và deploy.
2. Thay hướng dẫn xử lý nghiệp vụ cuối ngày trên Web bằng sáu bước cấu hình, link đúng tab theo quyền và checklist mobile.
3. Bỏ yêu cầu `R2_PUBLIC_BASE_URL` trong Compose/env mẫu; sửa hướng dẫn VPS sang R2 private.
4. Đổi nhãn `/audit-events` sang BOTH để Chủ xem lịch sử mobile; giữ quyền `audit.read` cấp tổ chức và bổ sung contract.
5. CI bổ sung PostgreSQL 17, `TEST_DATABASE_URL` và migrate database test, tránh bỏ qua test flow.
6. Cập nhật tài liệu quyết định/review cũ và thêm ghi chú ưu tiên nguồn đã chốt ở `new-flow.md`.
7. Cảnh báo giá gắn đơn từng chỉ kiểm tra `order.read`, nên còn lộ nội dung giá sau khi thu hồi `price_alert.read`. Thêm `requiredPermission` (migration 005), kiểm tra quyền đúng scope trên inbox/detail/read/push và test người mất quyền hoặc chỉ có quyền ở cơ sở khác.

## Chưa xác nhận hoàn thành

- Chưa có source mobile: màn hình, camera, offline/retry và alarm native cần triển khai/kiểm thử trên thiết bị.
- R2/FCM thật cần smoke test. Code không tự tắt domain/bucket public đã mở trên Cloudflare.
- iPOS còn chờ giao thức/môi trường thử. Hủy hiện áp dụng từng bản ghi import; chưa mapping đầy đủ một hóa đơn. Hoàn món/combo ngoài phạm vi hiện tại.
- Phương án gửi phiếu dạng hóa đơn/PDF/ảnh cho NCC ngoài app chưa có endpoint PDF hoặc mẫu xác nhận. JSON/CSV không được coi là hoàn thành yêu cầu này.
- Rule tồn/hao hụt mới đang `testOnly=true`, `active=false`; chưa có job đánh giá và gửi cảnh báo vận hành theo rule. Cảnh báo lệch kiểm kê và cảnh báo giá đã có là chức năng riêng.
- Cần vận hành thống nhất các cách hiểu đã triển khai: người nội bộ được quyền nhập giá; người có quyền sửa bản nháp; hoàn chốt cuối ngày duyệt; Chủ là tài khoản nội bộ có quyền phù hợp, không có role OWNER riêng mặc định.

## Kiểm chứng

Kết quả kiểm tra ngày 09/10/2026:

- Backend: typecheck, build, format đạt; 76/76 test đạt trên PostgreSQL riêng đã migrate, không bỏ qua test.
- Web: lint, typecheck và build đạt; kiểm tra giao diện hướng dẫn trên trình duyệt desktop và đối chiếu 19 link đúng route/tab.
- OpenAPI `/audit-events` có audience BOTH; API chấp nhận bộ lọc lịch sử được mô tả trong tài liệu mobile.
- `npm audit --omit=dev --audit-level=high` không phát hiện lỗ hổng ở cả hai repo.

Chưa kiểm thử giao diện trên thiết bị mobile. Khi release cần kiểm tra thêm màn hình nhỏ và checklist tích hợp trên thiết bị thật.

CI được kiểm tra từ cấu hình và chạy local tương đương; chưa chạy workflow GitHub hoặc deploy production trong lần review này. Release cần migrate, bootstrap quyền v4 và checklist trong tài liệu mobile.

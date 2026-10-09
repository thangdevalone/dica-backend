# Hướng dẫn tích hợp Mobile DICA

Cập nhật: 09/10/2026. Nguồn quyết định: `customer-flow-questions-response.md` (khách trả lời ngày 08/10/2026). Các quyết định này thay thế hướng dẫn cũ nếu mâu thuẫn với `new-flow.md`.

Workspace chỉ có Backend và Web Admin. Tài liệu này là contract bàn giao; chưa xác nhận ứng dụng mobile đã triển khai hay đã kiểm thử trên thiết bị.

Quyền/scope có thể thay đổi trong phiên. Client cần nạp lại `/me/permissions` khi quay lại app hoặc gặp `403`, bỏ dữ liệu cache không còn được phép xem; không tự retry command bị từ chối. Thu hồi grant vô hiệu hóa phiên; `401` không refresh được thì đăng nhập lại. Quản trị tài khoản trên Web không được quản lý/cấp quyền cao hơn quyền cấp tổ chức đang có; ADMIN chỉ cấp ở scope tổ chức và không được loại bỏ ADMIN hoạt động cuối cùng.

## 1. Phân chia Mobile và Web

- Mobile: xin hàng, duyệt/từ chối/hủy, xuất/nhận hàng, điều chuyển, hoàn hàng, kiểm kê, báo hỏng, xem giá/công nợ, thanh toán, báo cáo và thông báo.
- Web: cơ cấu, danh mục, đơn vị/quy đổi, nguồn cấp, tài khoản/quyền, iPOS mapping/định mức, giá chuẩn, chính sách thanh toán/lưu ảnh, nhật ký và xóa dữ liệu bằng ADMIN.
- Nhà cung cấp dùng chung app, `kind=SUPPLIER`, chỉ đọc đơn của chính NCC và thông báo. Được thấy giá trên đơn của mình; không có nhận/từ chối/chuẩn bị/giao hàng hay nhập giá từ tài khoản SUPPLIER.
- Người nội bộ có `price.update` nhập giá. Không cấp quyền này cho SUPPLIER. Cách hiểu “đại lý” trong trả lời khách là người nội bộ được phân quyền, để giữ quy tắc NCC chỉ đọc.

Swagger `/docs`, OpenAPI `/openapi.json` (khi bật `SWAGGER_ENABLED`). Dùng các API mang nhãn MOBILE hoặc BOTH. Nhãn phân loại client không thay thế kiểm tra permission/scope.

## 2. Quy ước và đăng nhập

Base URL: `https://<host>/api/v1`. JSON request dùng `snake_case`; các entity response thường dùng `camelCase`. Một số command trả các khóa như `receipt_id`, `order_id`; lấy schema tương ứng của endpoint, không tự chuyển toàn bộ khóa.

- Gửi `Authorization: Bearer <access_token>` sau đăng nhập.
- Số lượng và tiền là **chuỗi thập phân**. Số lượng tối đa 3 chữ số phần lẻ; giá tối đa 4. Không dùng float cho tính toán tiền.
- Phiếu xin hàng giữ `requestedQuantity`/`unitCodeSnapshot` theo đơn vị người dùng chọn và `baseQuantity` theo đơn vị cơ sở. **Các dòng đơn phát hành, xuất, nhận, hoàn và giá đều dùng đơn vị cơ sở**. Ví dụ xin 2 bao, 1 bao = 5 kg: phiếu xin hiển thị 2 bao; dòng đơn hiển thị 10 kg, nhận `quantity="10"`, giá tính trên 1 kg. Không dùng đơn vị của phiếu xin để gắn nhãn số lượng của đơn.
- Ngày nghiệp vụ: `YYYY-MM-DD`; datetime: ISO-8601 có timezone. Chốt ngày theo `Asia/Ho_Chi_Minh` (UTC+07), không theo múi giờ thiết bị/server.
- Đối tượng có `version`: gửi `expected_version` theo detail mới nhất. `409 VERSION_CONFLICT`: tải lại và cho người dùng kiểm tra trước khi gửi lại.
- API yêu cầu `Idempotency-Key`: dùng UUID mới cho mỗi thao tác, giữ nguyên key và payload khi retry. Backend lưu kết quả 24 giờ. Không đổi payload rồi dùng lại key.
- Response: `{success:true,data,message,meta?,request_id,timestamp}`. Lỗi: `{success:false,code,message,details?,request_id,timestamp}`. Lưu `request_id` để tra cứu.
- Danh sách dùng phân trang theo Swagger; không coi trang đầu là toàn bộ dữ liệu. Decimal có thể bị loại khỏi response do quyền; không thay giá bị ẩn thành 0.

Phiên đăng nhập:

1. `POST /auth/login` với `organization_code`, `username`, `password`.
2. Đọc `GET /me` và `GET /me/permissions`; dựng giao diện từ permission **và scope**, không hardcode theo tên vai trò.
3. `POST /auth/refresh` khi access token hết hạn; chỉ chạy một refresh tại một thời điểm. Refresh thất bại thì đăng xuất.
4. Đăng ký `POST /push-devices` với token FCM, platform ANDROID/IOS, device_id, app_version; đăng ký lại khi token đổi.
5. Khi đăng xuất, `POST /push-devices/unregister` rồi `POST /auth/logout`; xóa local alarm, dữ liệu nhạy cảm và token trên thiết bị.

## 3. Quyền và phạm vi

| Nghiệp vụ                       | Permission chính                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Tạo/sửa nháp/gửi xin hàng       | `request.create`, `request.update_draft`, `request.submit`                                                              |
| Duyệt/từ chối/hủy xin hàng      | `request.approve`, `request.reject`, `request.cancel`                                                                   |
| Điều chuyển                     | `transfer.create`, `transfer.update_draft`, `transfer.submit`, `transfer.approve`, `transfer.reject`, `transfer.cancel` |
| Xuất/nhận                       | `dispatch.create`, `dispatch.post`, `receipt.create`, `receipt.post`                                                    |
| Xử lý chênh lệch                | `discrepancy.read`, `discrepancy.resolve`                                                                               |
| Hoàn hàng                       | `return.read`, `return.create`, `return.approve`                                                                        |
| Kiểm kê/báo hỏng                | `stocktake.*`, `damage.*`                                                                                               |
| Điều chỉnh tồn                  | `adjustment.create`, `adjustment.approve`, `adjustment.post`                                                            |
| Xem/nhập giá, nhận cảnh báo giá | `price.read`, `price.update`, `price_alert.read`                                                                        |
| Thanh toán                      | `payment_tracking.read`, `payment_tracking.update`, `payment_tracking.confirm`                                          |
| Chênh lệch/báo cáo              | `variance.read`, `report.*`                                                                                             |
| Ảnh và thông báo                | `attachment.upload`, `notification.read_own`, `notification.mark_own`                                                   |

Mặc định nhân viên không có quyền hủy phiếu, xem giá hoặc xem số tồn hệ thống. Người kiểm kê chỉ nhập số đếm thực tế. ADMIN_OWNER có quyền điều chỉnh tồn; GENERAL_MANAGER không mặc định có `adjustment.approve/post`, ADMIN có thể cấp thêm. Quyền sửa bản nháp dành cho người lập phiếu; phiếu đã duyệt không sửa hàng/số lượng/nguồn.

Backend loại trường giá và chênh lệch khỏi response theo scope. Ảnh hiện dùng permission `attachment.upload` cho cả xem/tải và upload; phải cấp quyền này cho người được xem chứng từ.

Màn hình giá/thanh toán cần `price.read` ở cùng phạm vi với quyền đọc/thao tác nghiệp vụ. Có quyền `payment_tracking.read` nhưng thiếu `price.read` thì các trường tiền có thể bị loại khỏi response. Với grant theo bộ phận, backend dùng `departmentId` của phiếu xin để kiểm tra quyền trên các đơn lồng trong phiếu; không ghép các chiều quyền từ hai grant khác nhau.

## 4. Xin hàng và hủy phiếu

Danh mục selector: `/facilities`, `/departments`, `/stock-locations`, `/ingredients`, `/units`, `/conversions`. Lấy mặt hàng được xin bằng `GET /item-eligibility?effective=true&facility_id=...&department_id=...`. Quyền riêng mặt hàng ưu tiên quyền nhóm; `active=false` chặn mặt hàng; hạn mức riêng `null` nghĩa là không giới hạn.

```json
{
  "facility_id": "uuid",
  "department_id": "uuid",
  "required_date": "2026-10-10",
  "note": "Nhận buổi sáng",
  "lines": [{ "ingredient_id": "uuid", "unit_id": "uuid", "quantity": "10" }]
}
```

1. `POST /requests` tạo DRAFT; `PUT /requests/:id` sửa DRAFT với payload đầy đủ + `expected_version`.
2. `POST /requests/:id/refresh-routing` nếu cần tính lại nguồn trước khi gửi.
3. `POST /requests/:id/submit` với `expected_version`: DRAFT → SUBMITTED.
4. Người có quyền duyệt gọi `POST /requests/:id/approve` + Idempotency-Key: SUBMITTED → APPROVED, sinh đơn theo từng nguồn.
5. Từ chối: `POST /requests/:id/reject`, `{expected_version,note}` với lý do. REJECTED là phiếu lịch sử; **tạo phiếu mới bằng POST /requests**. `/revise` không còn sửa phiếu cũ, trả 409.
6. Hủy: `POST /requests/:id/cancel`, `{expected_version,note}`. Chỉ người có quyền được hủy, chỉ khi các đơn liên quan chưa có phiếu nhận POSTED. APPROVED vẫn hủy được nếu chưa nhận; thao tác hủy toàn bộ đơn liên quan trong một transaction. Muốn đổi hàng/nguồn phải tạo phiếu mới.

`POST /orders/:id/cancel` dùng `{expected_version,reason}`; tương tự chỉ trước khi nhận. Đơn đã xuất được đảo sổ xuất và transit về kho nguồn, giữ bút toán lịch sử. Không hủy sau nhận, kể cả nhận một phần; dùng quy trình hoàn hàng.

## 5. Đơn và nhà cung cấp

Nội bộ: `GET /orders`, `GET /orders/:id`. NCC: `GET /supplier/orders`, `GET /supplier/orders/:id`; backend tự lọc theo organization + supplier của token, không nhận supplier_id tùy ý từ app.

Dòng đơn trả `approvedQuantity`, `receivedQuantity`, `acceptedExcessQuantity`, `closedRemainingQuantity`, `returnedQuantity`, `unitCodeSnapshot`, `unitPriceSnapshot` (nếu có quyền). Giá trị null là chưa có giá, khác với 0.

- `receivedQuantity`: phần nhận nằm trong lượng đã duyệt.
- `acceptedExcessQuantity`: phần nhận thừa đã nhập tồn; **không cộng lại vào receivedQuantity**.
- `returnedQuantity`: phần hoàn đã chốt cuối ngày.
- Số thực giữ lại = received + excess − returned.

Đơn NCC chỉ đọc. Endpoint nội bộ bị chặn cho `kind=SUPPLIER` ngay cả khi cấu hình nhầm quyền.

## 6. Xuất hàng, nhận hàng và ảnh

### Xuất từ kho

`POST /dispatches`: `{order_id,lines:[{order_line_id,quantity}],note?}`. Sau đó `POST /dispatches/:id/post` với `{expected_version}` + Idempotency-Key. Kho nguồn giảm, kho IN_TRANSIT tăng. Cho phép tồn vật lý âm, nhưng không được xuất vượt lượng đơn hoặc xuất đơn đã hủy/hết hạn.

### Nhận hàng và giao bù

`POST /receipts`: `{order_id,dispatch_id?,lines:[{order_line_id,quantity}],note?}`. Đơn STOCK bắt buộc gắn phiếu xuất POSTED; đơn SUPPLIER không cần dispatch.

1. Nhập số kiểm đếm thực tế, kể cả thiếu/thừa.
2. Tạo receipt DRAFT.
3. Upload và finalize **từ 1 đến 10 ảnh cho chính receipt này**.
4. `POST /receipts/:id/post` với `{expected_version}` + Idempotency-Key.
5. Nhận hàng ghi tăng tồn; nhận thừa được chấp nhận và cộng tồn ngay. Chênh lệch vẫn tạo case để quản lý nhận thông báo và ghi nhận xử lý, không chờ quản lý mới nhập phần thừa.
6. Mỗi lần giao bù tạo receipt mới và ảnh mới; được giao bù nhiều lần trong ngày. Không sửa receipt đã POSTED.

### Upload và đọc ảnh riêng tư

```json
{
  "resource_type": "RECEIPT",
  "resource_id": "uuid",
  "file_name": "kiem-hang.jpg",
  "content_type": "image/jpeg",
  "size_bytes": 123456
}
```

- `POST /attachments/upload-init` với payload trên; resource_type là RECEIPT, DAMAGE_REPORT hoặc RETURN.
- PUT bytes trực tiếp vào `data.uploadUrl` cùng **toàn bộ headers** trả về: Content-Type, Content-Length, If-None-Match. Không gửi access token DICA sang R2.
- `POST /attachments/:id/finalize`, body `{}`. Backend kiểm tra dung lượng, MIME thật và trạng thái upload.
- `GET /attachments?resource_type=...&resource_id=...` lấy ảnh READY.
- `viewUrl` là đường dẫn tương đối `/api/v1/attachments/:id/content`, **không phải URL R2 public**. Ghép với origin API (không ghép thêm `/api/v1` lần nữa), GET kèm Bearer token. Có thể tải blob và dùng URL local trên thiết bị; bỏ blob khi logout/đổi người dùng. API trả `Cache-Control: private, no-store` và kiểm tra quyền mỗi lần đọc.
- Định dạng JPEG/PNG/WebP/HEIC/HEIF, tối đa 5 MiB/ảnh; tối đa 10 ảnh READY hoặc upload chưa hết hạn trên mỗi chứng từ. Không đưa pending upload vào bộ đếm ảnh hợp lệ khi post.
- ADMIN cấu hình lưu 6–12 tháng, mặc định 12; hết hạn ảnh bị xóa. Upload quá hạn cần khởi tạo lại.
- Triển khai phải **tắt public access của bucket R2 và public custom domain cũ**. Đổi API không thể tự thu hồi URL public đã phát trước đây nếu hạ tầng vẫn cho đọc công khai.

## 7. Thiếu hàng và chốt 00:00

`shortageDeadlineAt` của đơn là 00:00 sau ngày cần hàng (request.requiredDate), hoặc sau ngày kết thúc khoảng nhận của điều chuyển. App hiển thị thời hạn theo giờ Việt Nam.

- Trước hạn: cho nhận/giao bù nhiều lần, mỗi lần có ảnh mới.
- Từ hạn: API từ chối xuất/nhận bổ sung dù worker chưa chạy; lập phiếu mới nếu tiếp tục mua/cấp hàng.
- Worker chạy mỗi 30 giây, tự cộng phần chưa nhận vào `closedRemainingQuantity`, đóng đơn CLOSED, hủy draft giao/nhận, đóng case SHORTAGE và cập nhật thanh toán theo thực nhận. Nếu dịch vụ nghỉ lúc 00:00, xử lý bù khi khởi động.
- Hàng đã xuất nhưng thiếu khi nhận được ghi hao hụt khỏi transit; không tự cộng lại kho nguồn như hàng chưa xuất. Nhật ký và thông báo quản lý được lưu.
- `/orders/:id/close-outstanding` không dùng làm nút “hủy thiếu ngay” trong ngày; cơ chế chuẩn là tự đóng cuối ngày.
- `GET /discrepancies`, `POST /discrepancies/:id/resolve` với `{resolution}` dành cho người có quyền ghi kết quả điều tra. Đóng case không tự thay số tồn/tiền.

## 8. Điều chuyển

| Tuyến                                                | Kết quả khi submit                                            |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| Kho tổng ↔ Bếp tổng                                  | Tự duyệt, phát hành đơn, thông báo người có quyền và bên nhận |
| Chi nhánh ↔ Chi nhánh khác                           | Chờ duyệt                                                     |
| Bếp tổng ↔ Chi nhánh                                 | Chờ duyệt                                                     |
| Chi nhánh ↔ Kho tổng, cùng cơ sở hoặc các tuyến khác | Bị từ chối                                                    |

```json
{
  "from_stock_location_id": "uuid",
  "to_stock_location_id": "uuid",
  "expected_arrival_at": "2026-10-10T09:00:00+07:00",
  "expected_arrival_end_at": "2026-10-10T11:00:00+07:00",
  "lines": [{ "ingredient_id": "uuid", "unit_id": "uuid", "quantity": "5" }]
}
```

`POST /transfers`, `PUT /transfers/:id` (DRAFT), `POST /transfers/:id/submit`, `/approve`, `/reject`, `/cancel`. Command có expected_version; reject/cancel có note. Approve cần Idempotency-Key. Cả hai mốc giờ bắt buộc; end > start. `expected_arrival_at` là giờ bắt đầu (tương thích tên trường cũ), không còn đại diện cho một thời điểm duy nhất.

Bản ghi cũ có thể có expectedArrivalEndAt=null; sửa nháp và bổ sung khoảng giờ trước khi gửi. Tuyến hợp lệ vẫn phải được backend kiểm tra tại submit/approve.

## 9. Hoàn hàng

1. Người nhận có `return.create` gọi `POST /returns`:

```json
{
  "order_id": "uuid",
  "note": "Hoàn một phần hàng",
  "lines": [{ "order_line_id": "uuid", "quantity": "2" }]
}
```

2. Chụp hàng **cùng hóa đơn**, upload resource_type=RETURN, tối thiểu 1/tối đa 10 ảnh. Backend kiểm tra ảnh hợp lệ; nội dung hóa đơn trong ảnh do người duyệt đối chiếu.
3. `POST /returns/:id/submit` với expected_version: DRAFT → SUBMITTED, gửi thông báo duyệt.
4. `POST /returns/:id/approve` hoặc `/reject` với expected_version; reject cần note. Quản lý/chủ được cấp `return.approve`. Không được duyệt lượng lớn hơn số đã nhận trừ lượng đã hoàn và đã đặt chờ hoàn ở phiếu khác.
5. Hoàn đúng kho/NCC đã cấp trong đơn gốc; client không chọn nguồn hoàn tùy ý.
6. Phiếu APPROVED có `settleAt` là 00:00 kết thúc **ngày duyệt**, `postedAt=null` đến khi chốt. Worker trừ kho trả, cộng kho nguồn nội bộ (NCC không có kho nội bộ), tăng returnedQuantity và tính lại hóa đơn. `postedAt` xác nhận đã hạch toán. Duyệt sau ngày lập thì tính ngày duyệt; không trừ kho khi phiếu chưa được duyệt.
7. `GET /returns` và `GET /returns/:id` theo scope. Danh sách có phân trang và quan hệ `order.destinationStockLocation` để xác định cơ sở/kho nhận. `note` giữ lý do hoàn do người lập nhập; `decisionNote` là ghi chú duyệt hoặc lý do từ chối. Khi duyệt/từ chối, người lập nhận thông báo; nếu từ chối thì tạo phiếu mới. Không dùng trạng thái APPROVED để hiển thị “đã hoàn tất hạch toán” khi `postedAt=null`.

## 10. Kiểm kê, báo hỏng, tồn âm

- Kiểm kê: POST /stocktakes → PUT /stocktakes/:id khi DRAFT → POST /stocktakes/:id/submit. Body gồm stock_location_id, business_date, cutoff_at, lines[{ingredient_id,counted_quantity}].
- Nhân viên chỉ nhập số lượng thực tế. Backend loại expectedQuantitySnapshot, varianceQuantity và các trường số liệu kỳ vọng khỏi response nếu thiếu `variance.read` ở đúng scope. Không tải số hệ thống rồi chỉ ẩn bằng UI.
- Submit không tự sửa tồn. Người có quyền nhận thông báo khi có lệch; nhật ký `stocktake.submit` lưu `highlight=RED` và các dòng lệch để xem theo khoảng tháng. Mobile tô đỏ các dòng lệch/nhật ký có cờ này.
- Chủ/người được cấp `audit.read` ở phạm vi **toàn tổ chức** xem lịch sử qua `GET /audit-events?action=stocktake.submit&resource_type=Stocktake&created_from=2026-10-01T00:00:00%2B07:00&created_to=2026-11-01T00:00:00%2B07:00`. Kết quả có `afterData.highlight` và `afterData.variances`; các số lệch vẫn cần `variance.read`. Phân trang theo `meta`. Endpoint dùng chung Web/Mobile; grant `audit.read` chỉ ở cơ sở chưa được API này hỗ trợ. `created_from/to` lọc theo thời điểm gửi, không phải `business_date` của phiếu; giới hạn trên bao gồm mốc cuối.
- Điều chỉnh sau điều tra: POST /inventory-adjustments → POST /:id/approve → POST /:id/post (Idempotency-Key). Chỉ quyền được cấp mới thực hiện. Không còn khóa DEMO_POLICY cho duyệt/ghi sổ điều chỉnh.
- Báo hỏng: POST /damage-reports (stock_location_id, reason, lines[{ingredient_id,quantity,reason?}]) → upload ảnh DAMAGE_REPORT → POST /:id/submit. **Submit ghi giảm tồn một lần**, tương ứng đã kiểm tra/chụp hàng hỏng. Không tính hàng hỏng vào lượng hàng dùng được khi kiểm kê.
- POST /damage-reports/:id/confirm xác nhận báo cáo, không trừ tồn lần thứ hai. Gửi thông báo người có quyền xác nhận. Những lần retry version cũ không được ghi giảm lại.
- Tồn vật lý được phép âm; app hiển thị số âm và cảnh báo quản lý, không tự ép thành 0.
- Reopen stocktake vẫn là API ngoại lệ bị khóa nếu không bật DEMO_POLICY; flow đã chốt không yêu cầu mở lại phiếu kiểm kê cũ.

## 11. Giá, hạn thanh toán và hai người xác nhận

Người nội bộ có price.update gọi `PUT /orders/:id/prices` + Idempotency-Key:

```json
{
  "expected_version": 2,
  "payment_term_days": 7,
  "lines": [{ "order_line_id": "uuid", "unit_price": "10000" }]
}
```

Giá tính trên đơn vị cơ sở của dòng đơn. Lưu snapshot của đơn và referencePrice cho lần sau của cùng nhà cung cấp/mặt hàng. Số ngày thanh toán 0–3650; hạn là cuối ngày phát hành cộng số ngày này. ADMIN cấu hình giá chuẩn theo nguyên liệu/đơn vị cơ sở, ngưỡng mặc định khi nhập UI là 10%, có thể tùy chỉnh. Độ lệch tuyệt đối lớn hơn ngưỡng ở cả hai chiều tạo thông báo `price_alert.read`; vẫn lưu giá và audit để điều tra.

Công thức đối soát: Σ[(receivedQuantity + acceptedExcessQuantity − returnedQuantity) × unitPriceSnapshot]. Phần thiếu đã đóng không bị tính tiền. GET /orders/:id/payment-tracking tính theo dữ liệu hiện hành; trước chốt cuối ngày số liệu có thể tiếp tục thay đổi do giao bù/hoàn.

- `PUT /orders/:id/payment-tracking`, `{expected_version,paid_value}` + Idempotency-Key. paid_value là **tổng lũy kế**, không phải số tiền tăng thêm; lần đầu expected_version=0.
- Khi paymentApprovalRequired=false: cập nhật paidValue ngay.
- Khi true: lưu pendingPaidValue; paidValue/status đã xác nhận giữ nguyên. Người nhập không được tự xác nhận.
- Khoản chờ xác nhận gửi thông báo cho người có `payment_tracking.confirm` trong phạm vi kho nhận, loại người vừa nhập. Xác nhận thành công thông báo lại người nhập; retry cùng Idempotency-Key không tạo thêm thông báo.
- `POST /orders/:id/payment-confirm`, `{expected_version}` + Idempotency-Key, người khác có payment_tracking.confirm. Backend tính lại hạn mức trước khi xác nhận.
- GET trả pendingPaidValue, paymentDueAt, paidValue, reconciledValue, status, version, paymentApprovalRequired, updatedById, confirmedById, facilityId và stockLocationId. pendingPaidValue=null nghĩa là không chờ xác nhận. Dùng `updatedById` để ẩn nút tự xác nhận, và vẫn để backend kiểm tra. Lấy `expected_version` từ bản ghi thanh toán, không lấy version của đơn.
- `paymentApprovalRequired` được trả trên GET/PUT thanh toán để mobile biết chế độ hiện hành; `/workflow-policy` là API dành cho Web ADMIN. Nếu ADMIN đổi chính sách trong lúc còn khoản chờ xác nhận, khoản đang chờ vẫn cần xử lý; khi PUT mới thì áp dụng chính sách hiện hành.
- Thiếu snapshot giá: GET chi tiết thanh toán trả `422 DATA_INCOMPLETE`; chuyển người có quyền sang nhập giá rồi tải lại. PUT không nhận số tiền lớn hơn giá trị đối soát. Tiền trả là lũy kế; không tự cộng lần nữa sau retry.
- Báo cáo `/reports/payment` gồm cả đơn chưa từng có bản ghi thanh toán (`version=0`); dataIncomplete=true và reconciledValue=null nếu thiếu giá và được quyền xem giá. Không tự coi thiếu giá là 0. Phân trang theo meta của response.
- Nếu đã trả nhiều hơn giá trị còn lại do hoàn hàng/đổi giá, giữ tiền đã trả làm bằng chứng và hiển thị chênh tiền; backend không tự tạo giao dịch hoàn tiền.

## 12. Thông báo và chuông nhắc

- `GET /notifications?status=UNREAD` lấy inbox của chính người dùng; `POST /notifications/:id/read` khi người dùng bấm xem, hoặc `/notifications/read-all` khi họ chủ động chọn đọc tất cả.
- Backend giữ cùng notification ID và gửi lại FCM mỗi **3600 giây** khi UNREAD; không tạo một dòng inbox mới mỗi lần nhắc. Trước khi gửi, backend kiểm tra lại trạng thái READ, tài khoản và quyền truy cập tài nguyên hiện tại. Không có giờ im lặng theo quyết định khách.
- Inbox, mở chi tiết và đánh dấu từng thông báo đã đọc đều kiểm tra quyền tài nguyên: hoàn hàng cần `return.read` tại kho nhận; cảnh báo giá gắn Supplier cần `price_alert.read` cấp tổ chức, cảnh báo giá gắn đơn cần cả `order.read` và `price_alert.read` tại kho nhận của đơn; hủy dữ liệu bán hàng cần `sales_import.read` hoặc `variance.read` tại cơ sở. Cảnh báo giá lưu `requiredPermission=price_alert.read`, kiểm tra lại cả khi gửi push để không lộ giá sau khi thu hồi quyền. Quyền `notification.read_own` không thay thế quyền tài nguyên. `/notifications/read-all` đánh dấu tất cả UNREAD của chính tài khoản theo lựa chọn chủ động, không trả lại dữ liệu chứng từ. NCC chỉ nhận thông báo đơn giao của mình. Khi quyền bị thu hồi, thông báo bị loại khỏi inbox và các lần push tiếp theo.
- Push data có notification_id, resource_type, resource_id, route, reminder_interval_seconds="3600", stop_on_read="true". NCC dùng route /supplier/orders/:id; hoàn hàng dùng /returns/:id.
- Mobile phải tạo âm thanh/kênh thông báo kiểu báo thức, quản lý nhắc cục bộ theo notification ID, dừng âm và xóa nhắc khi bấm xem rồi gọi read. Không dừng chỉ vì fetch inbox. Khi mở lại app, đồng bộ READ để hủy alarm trên thiết bị khác.
- Trạng thái READ dùng chung cho mọi thiết bị của tài khoản, kể cả khi người dùng mở nội dung thông báo hoặc chọn đọc tất cả trên Web. Web hiển thị nội dung thông báo; thao tác chứng từ vẫn thực hiện trên mobile. GET danh sách thông báo không đánh dấu đọc.
- FCM/OS có thể trì hoãn push hoặc không cho chuông kéo dài khi app bị kill. Backend không thể bảo đảm âm thanh liên tục: cần triển khai native Android/iOS, xin quyền hệ điều hành phù hợp và kiểm thử thiết bị thật. Tránh lên lịch cả local lẫn remote thành hai chuông cho cùng notification ID/khung giờ.
- Các sự kiện: xin hàng chờ duyệt/được duyệt/bị từ chối, đơn NCC mới, điều chuyển (kể cả tự duyệt), sắp đến khoảng nhận, giao thiếu/thừa, đóng thiếu qua ngày, báo hỏng, kiểm kê lệch, hoàn chờ duyệt/được duyệt/bị từ chối/đã chốt, giá vượt ngưỡng, thanh toán chờ xác nhận/đã xác nhận/sắp/quá hạn và hủy dữ liệu bán hàng.

## 13. iPOS và xóa dữ liệu

iPOS thực tế vẫn chờ bên iPOS cung cấp API/webhook/file và môi trường thử. Không giả định đã kết nối production; `/sales-imports/adapter-status` phản ánh adapter import thủ công. Hoàn món/combo chưa thuộc phạm vi khách chốt.

Phương án gửi phiếu/hóa đơn cho NCC không dùng app trong `new-flow.md` chưa có endpoint xuất PDF/ảnh và mẫu phiếu đã xác nhận. Mobile có thể đọc dữ liệu đơn để hiển thị nhưng không được coi đây là tính năng xuất hóa đơn hoàn chỉnh.

Backend có `POST /sales-records/:id/cancel` + Idempotency-Key, `{reason}`, permission sales_import.commit: giữ bản ghi/số lượng gốc, lưu cancelledAt/cancellationReason và audit, gửi thông báo quản lý, loại bản ghi khỏi lần tính tiêu hao tiếp theo. Báo cáo liên quan chuyển DATA_INCOMPLETE đến khi tính lại. Đây là hủy bản ghi import; adapter tương lai phải ánh xạ đúng toàn bộ dòng của hóa đơn iPOS, không suy đoán một dòng là cả hóa đơn.

Xóa vĩnh viễn là Web ADMIN config: GET /permanent-delete/:kind/:id xem phạm vi; POST cùng URL với password và preview_hash để xóa. kind là facility/stock_location/ingredient/supplier. Có thể xóa cả chứng từ liên quan nhiều cơ sở, tính lại tồn từ ledger còn lại, xóa idempotency cache của tổ chức; mật khẩu và preview phải hợp lệ. Mobile không hiển thị thao tác này. `active=false` vẫn dùng để ngừng sử dụng và giữ lịch sử.

## 14. Triển khai và kiểm thử mobile

1. Chạy `npm run db:migrate` để áp dụng toàn bộ migration còn thiếu, gồm `202610090001_customer_flow` đến `202610090005_notification_permission`; chạy bootstrap access-control v4 cho tổ chức hiện hữu và kiểm tra vai trò tùy chỉnh. Migration 003 sửa nhãn đơn vị trên dòng đơn từ phiếu xin, giữ số lượng/giá; migration 005 thêm quyền bắt buộc và đánh dấu lại cảnh báo giá cũ. Migrate trước khi chạy API. Migration không tự đăng xuất nhưng `/me`/refresh phải nạp quyền hiện hành.
2. Tắt public access R2; kiểm tra GET ảnh không token bị 401, token sai scope bị 404. Ảnh cũ không được công khai qua domain ngoài API.
3. Kiểm tra phiên bản cũ của mobile: không gọi revise, không chỉ gửi một mốc ETA, không dùng viewUrl không có Authorization, không bỏ qua ảnh giao bù.
4. Kiểm tra full flow: xin bằng đơn vị quy đổi nhưng nhận/nhập giá bằng đơn vị cơ sở; duyệt trên app; nhận 10/12; nhận thiếu rồi bù nhiều lần; retry cùng key; đúng 00:00; hủy sau xuất/trước nhận; từ chối hủy sau nhận; hoàn một phần; từ chối hoàn thấy lý do; hai người xác nhận thanh toán và nhận thông báo; kiểm kê không thấy tồn; chuông dừng khi đọc.
5. Test nhiều worker đồng thời, restart sau 00:00, thiết bị offline, FCM token đổi và quyền bị thu hồi. Các bút toán chạy transaction Serializable và khóa chống ghi trùng; mobile vẫn phải xử lý 409/retry đúng key.
6. Web không thay thế việc triển khai mobile. Âm báo native, camera, upload thực tế R2/FCM và kết nối iPOS cần kiểm thử với ứng dụng/dịch vụ thật.

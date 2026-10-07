# Hướng dẫn tích hợp Mobile DICA

Tài liệu bàn giao cho mobile dev, bám theo flow trong `Untitled.fig` và contract backend hiện tại. Swagger là nguồn schema chi tiết cuối cùng tại `/docs`; OpenAPI JSON tại `/openapi.json`. Chỉ tích hợp endpoint mang nhãn `[MOBILE]` hoặc `[MOBILE + ADMIN WEB]`.

Mỗi operation trong OpenAPI có `x-dica-audience` để lọc client và `x-dica-response-schema` để biết model lõi của `data`. Request body, query, enum, response envelope, pagination và error response đều có schema; có thể dùng `/openapi.json` để generate client/model.

## 1. Quy ước chung

- Base URL: `https://<host>/api/v1`.
- JSON header: `Content-Type: application/json`.
- Sau đăng nhập gửi `Authorization: Bearer <access_token>`.
- Số lượng/giá là **chuỗi thập phân**, ví dụ `"2.5"`, không gửi số float.
- Ngày nghiệp vụ: `YYYY-MM-DD`; thời gian: ISO-8601 có timezone.
- Không tự lưu quyền theo tên role. Gọi `GET /me/permissions`, kiểm tra permission và scope để hiện/ẩn màn hình, nút và selector.
- ID cơ sở, bộ phận, kho, actor, organization và supplier đều không đáng tin nếu lấy từ client; backend vẫn kiểm tra lại scope.
- Với object có `version`, mọi command phải gửi `expected_version`. Gặp `VERSION_CONFLICT`, tải lại detail rồi yêu cầu người dùng thao tác lại.
- Với API bắt buộc idempotency, tạo UUID mới cho một thao tác nghiệp vụ và giữ nguyên key khi retry cùng payload. Không dùng lại key cho payload khác.

Response thành công:

```json
{
  "success": true,
  "message": "Thao tác thành công.",
  "data": {},
  "request_id": "uuid",
  "timestamp": "2026-10-06T05:00:00.000Z"
}
```

Response lỗi:

```json
{
  "success": false,
  "code": "VERSION_CONFLICT",
  "message": "Phiếu đã được cập nhật. Vui lòng tải lại.",
  "details": [],
  "request_id": "uuid",
  "timestamp": "2026-10-06T05:00:00.000Z"
}
```

Luôn log `request_id` khi gửi lỗi cho backend dev.

Các response status trong Swagger đều có type riêng:

| Status       | Response type                                       |
| ------------ | --------------------------------------------------- |
| `200`, `201` | Success envelope với `data` đúng model của endpoint |
| `400`        | `BadRequestErrorResponse`                           |
| `401`        | `UnauthorizedErrorResponse`                         |
| `403`        | `ForbiddenErrorResponse`                            |
| `404`        | `NotFoundErrorResponse`                             |
| `409`        | `ConflictErrorResponse`                             |
| `422`        | `UnprocessableEntityErrorResponse`                  |
| `429`        | `TooManyRequestsErrorResponse`                      |
| `500`        | `InternalServerErrorResponse`                       |

## 2. Khởi tạo phiên Mobile

### Đăng nhập

`POST /auth/login`

```json
{
  "username": "beptruong.cn01",
  "password": "MatKhauAnToan#2026",
  "organization_code": "DICA"
}
```

Lưu access token trong memory/secure storage và refresh token trong Keychain/Keystore. Khi access token hết hạn, gọi `POST /auth/refresh` đúng một lần cho các request đang chờ:

```json
{ "refresh_token": "<refresh-token>" }
```

Đăng xuất: `POST /auth/logout`, body `{}`.

### Dữ liệu bootstrap sau đăng nhập

Gọi song song:

1. `GET /me` — hồ sơ hiện tại.
2. `GET /me/permissions` — permission + grant scope.
3. `GET /notifications?status=UNREAD&page=1&page_size=20`.
4. Theo quyền: `GET /facilities`, `/stock-locations`, `/departments`, `/units`, `/ingredient-groups`, `/ingredients`.

Không giả định tài khoản chỉ thuộc một chi nhánh. Selector phải lọc theo grant scope trả về từ server và kết quả endpoint.

## 3. Màn hình và endpoint

| Màn hình Mobile  | Endpoint chính                                                                                                     | Permission tiêu biểu                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Xin hàng         | `GET/POST /requests`, `GET /item-eligibility`, `PUT /requests/{id}`, commands submit/revise/cancel/refresh-routing | `request.*`, `eligibility.read`               |
| Nhận hàng        | `GET /orders`, `POST /receipts`, `POST /receipts/{id}/post`, `GET /discrepancies`                                  | `order.read`, `receipt.*`, `discrepancy.read` |
| Xuất hàng        | `GET /orders`, `POST /dispatches`, `POST /dispatches/{id}/post`                                                    | `order.read`, `dispatch.*`                    |
| Hàng điều chuyển | `GET/POST /transfers`, `PUT /transfers/{id}`, commands submit/cancel                                               | `transfer.*`                                  |
| Kiểm kê          | `GET/POST /stocktakes`, `PUT /stocktakes/{id}`, command submit                                                     | `stocktake.*`                                 |
| Báo hỏng         | `GET/POST /damage-reports`, `PUT /damage-reports/{id}`, command submit                                             | `damage.*`                                    |
| Tồn kho          | `GET /stock-balances`, `GET /stock-ledger`                                                                         | `stock.read`, `stock_ledger.read`             |
| Thông báo        | `GET /notifications`, detail, read, read-all                                                                       | `notification.*`                              |

Mobile **không gọi** API cấu hình user/role/cơ sở/danh mục/nguồn, duyệt yêu cầu, duyệt điều chuyển, xử lý chênh lệch, payment, report, iPOS, audit hoặc health readiness.

## 4. Flow Xin hàng

### Bước A — tải nguyên liệu được phép xin

`GET /item-eligibility?facility_id=<uuid>&department_id=<uuid>&page_size=100`

Chỉ hiển thị dòng `active=true`. Danh sách hợp lệ là giao của eligibility, quyền/scope tài khoản và nguyên liệu đang active. Mobile không gửi supplier hoặc kho nguồn trong request.

Nếu `maxQuantityPerRequest` khác `null`, đây là hạn mức cho một dòng yêu cầu tính theo `ingredient.baseUnit`. Mobile nên hiển thị hạn mức cạnh nguyên liệu và kiểm tra sớm; backend vẫn quy đổi đơn vị rồi kiểm tra lại khi tạo/sửa phiếu.

### Bước B — tạo bản nháp

`POST /requests`

```json
{
  "facility_id": "<facility-uuid>",
  "department_id": "<department-uuid>",
  "required_date": "2026-10-10",
  "note": "Giao trước 10 giờ",
  "lines": [
    {
      "ingredient_id": "<ingredient-uuid>",
      "unit_id": "<unit-uuid>",
      "quantity": "5.5"
    }
  ]
}
```

Sửa `DRAFT`: `PUT /requests/{id}`, gửi lại các trường trên và thêm `expected_version`.

### Bước C — gửi duyệt

`POST /requests/{id}/submit`

```json
{ "expected_version": 1, "note": "Đã kiểm tra số lượng" }
```

Nếu nhận `SOURCE_NOT_CONFIGURED` hoặc `SOURCE_UNAVAILABLE`, hiển thị tên/dòng lỗi và yêu cầu liên hệ quản lý; Mobile không tự chọn nguồn thay thế.

Sau submit, Mobile theo dõi detail/list và notification. `approve`/`reject` do Admin Web thực hiện. Với phiếu `REJECTED`, gọi `POST /requests/{id}/revise` bằng body giống update; với phiếu còn được phép hủy, gọi `/cancel` kèm `expected_version` và `reason`.

## 5. Flow Xuất/Nhận hàng

### Xem đơn

- `GET /orders?status=RELEASED&page=1&page_size=20`
- `GET /orders/{id}` để lấy `lines[].id`, số được duyệt/đã xuất/đã nhận/còn lại.

### Lập và post phiếu xuất

`POST /dispatches`

```json
{
  "order_id": "<order-uuid>",
  "note": "Xuất ca sáng",
  "lines": [{ "order_line_id": "<order-line-uuid>", "quantity": "5.5" }]
}
```

Ghi sổ:

```http
POST /dispatches/{dispatch-id}/post
Idempotency-Key: mobile:<uuid>
```

```json
{ "expected_version": 1 }
```

### Lập và post phiếu nhận

`POST /receipts`

```json
{
  "order_id": "<order-uuid>",
  "dispatch_id": "<dispatch-uuid>",
  "note": "Kiểm thực tế tại kho nhận",
  "lines": [{ "order_line_id": "<order-line-uuid>", "quantity": "4.5" }]
}
```

`dispatch_id` là tùy chọn với đơn NCC. Sau khi người dùng xác nhận lần cuối:

```http
POST /receipts/{receipt-id}/post
Idempotency-Key: mobile:<uuid>
```

```json
{ "expected_version": 1 }
```

Backend tự phân loại đủ/thiếu/thừa. Nếu thiếu, đơn còn `PARTIAL` và có thể tạo receipt bù lần sau. Nếu thừa, receipt có thể vào `PENDING_EXCESS_REVIEW`; Mobile không tự cộng phần thừa trước quyết định backend. Màn hình lịch sử đọc `GET /receipts`, `GET /receipts/{id}` và `GET /discrepancies?status=OPEN`.

Sau khi tạo receipt và trước hoặc sau khi post, mỗi ảnh được tải trực tiếp từ Mobile lên R2 theo ba bước. Backend không nhận bytes ảnh.

1. Xin presigned URL:

```http
POST /attachments/upload-init
Content-Type: application/json
```

```json
{
  "resource_type": "RECEIPT",
  "resource_id": "<receipt-uuid>",
  "file_name": "receipt.jpg",
  "content_type": "image/jpeg",
  "size_bytes": 123456
}
```

2. Dùng đúng `uploadUrl`, HTTP method và toàn bộ headers (`Content-Type`, `Content-Length`, `If-None-Match`) trong response để `PUT` bytes ảnh thẳng lên R2. Không gửi access token của DICA hoặc R2 credentials trong request này. Các header phải khớp với dữ liệu backend đã ký.

3. Sau khi R2 trả 2xx, xác nhận với backend:

```http
POST /attachments/{attachment-id}/finalize
Authorization: Bearer <access-token>
```

Backend chỉ đưa ảnh vào danh sách sau khi kiểm tra object trên R2, kích thước, Content-Type và định dạng thực. Presigned URL upload mặc định hết hạn sau 10 phút. Mỗi ảnh tối đa 5 MB; hỗ trợ JPEG, PNG, WEBP, HEIC/HEIF.

Xem danh sách bằng `GET /attachments?resource_type=RECEIPT&resource_id=<uuid>`. Mỗi attachment R2 trong danh sách trả sẵn URL có thể gắn trực tiếp vào image component, không cần thêm access token vào request tới R2:

```json
{
  "data": [
    {
      "id": "<attachment-uuid>",
      "resourceType": "RECEIPT",
      "resourceId": "<receipt-uuid>",
      "fileName": "receipt.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 123456,
      "createdAt": "2026-10-07T11:55:00.000Z",
      "viewUrl": "https://...r2.cloudflarestorage.com/...",
      "viewUrlExpiresAt": "2026-10-07T12:00:00.000Z"
    }
  ]
}
```

`viewUrl` là URL xem trực tiếp, không phải object key và không phải URL public cố định. Attachment cũ chưa chạy migration R2 có thể trả `viewUrl=null`; trường hợp này Mobile dùng download gateway có Bearer token hoặc chờ vận hành chạy migration.

Để renew riêng một ảnh mà không tải lại cả danh sách, gọi:

```http
GET /attachments/{attachment-id}/view-url
Authorization: Bearer <access-token>
```

```json
{
  "data": {
    "url": "https://...r2.cloudflarestorage.com/...",
    "expiresAt": "2026-10-07T12:00:00.000Z"
  }
}
```

URL xem ảnh mặc định sống 5 phút. Mobile không lưu URL này như URL cố định. Quy tắc refresh bắt buộc:

- Nếu `viewUrlExpiresAt <= now + 30 giây`, renew trước khi render.
- Nếu image request lỗi `401/403`, gọi `view-url` và retry đúng một lần.
- Dùng single-flight theo `attachment.id`: nhiều component cùng cần một ảnh phải dùng chung một request renew.
- Chỉ giữ URL trong memory cache; dữ liệu persisted chỉ giữ attachment ID/metadata.
- Khi backend `view-url` trả `401`, refresh access token theo cơ chế auth hiện có rồi gọi lại đúng một lần. `403/404` từ backend là mất quyền hoặc resource không còn tồn tại, không retry vô hạn.

Pseudo-code dùng chung cho React Native/Flutter/native:

```ts
const renewInFlight = new Map<string, Promise<Attachment>>();
const RENEW_SKEW_MS = 30_000;

async function ensureFreshView(item: Attachment): Promise<Attachment> {
  const expiresAt = item.viewUrlExpiresAt
    ? Date.parse(item.viewUrlExpiresAt)
    : 0;
  if (item.viewUrl && expiresAt > Date.now() + RENEW_SKEW_MS) return item;

  const running = renewInFlight.get(item.id);
  if (running) return running;

  const renew = api
    .get(`/attachments/${item.id}/view-url`)
    .then((response) => {
      const signed = response.data.data;
      return {
        ...item,
        viewUrl: signed.url,
        viewUrlExpiresAt: signed.expiresAt,
      };
    })
    .finally(() => renewInFlight.delete(item.id));

  renewInFlight.set(item.id, renew);
  return renew;
}

async function onImageLoadError(item: Attachment, alreadyRetried: boolean) {
  if (alreadyRetried) throw new Error("Không tải được ảnh");
  return ensureFreshView({
    ...item,
    viewUrl: null,
    viewUrlExpiresAt: null,
  });
}
```

Presigned URL là bearer token nên không ghi vào log/analytics và không chia sẻ ra ngoài ứng dụng. Endpoint `GET /attachments/{id}/content` vẫn được giữ làm download gateway tương thích cho attachment cũ chưa migrate; luồng mới ưu tiên `view-url` để bytes đi thẳng từ R2 tới client. Mọi API list khác được bổ sung ảnh trong tương lai phải dùng cùng cặp trường `viewUrl`/`viewUrlExpiresAt` và cùng cơ chế renew, không trả public R2 URL.

Nếu hàng bị hỏng và bị từ chối ngay tại điểm nhận, `quantity` chỉ là lượng chấp nhận thực tế và ghi rõ tình trạng trong `note`; phần không nhận sẽ thành thiếu. Backend chưa có trường receipt riêng để phân loại `DAMAGED` hoặc flow trả NCC.

## 6. Flow Điều chuyển

`POST /transfers`

```json
{
  "from_stock_location_id": "<source-location-uuid>",
  "to_stock_location_id": "<destination-location-uuid>",
  "expected_arrival_at": "2026-10-06T10:30:00+07:00",
  "note": "Bổ sung hàng cho ca tối",
  "lines": [
    {
      "ingredient_id": "<ingredient-uuid>",
      "unit_id": "<unit-uuid>",
      "quantity": "10"
    }
  ]
}
```

`expected_arrival_at` là tùy chọn, dùng ISO-8601 có múi giờ. Mobile hiển thị trường này để cơ sở nhận chuẩn bị kiểm hàng.

Sửa draft bằng `PUT /transfers/{id}`; gửi lại body tạo phiếu (`from_stock_location_id`, `to_stock_location_id`, `expected_arrival_at`, `note`, `lines`) và thêm `expected_version`. Gửi bằng:

```http
POST /transfers/{id}/submit
```

```json
{ "expected_version": 1, "note": "Đã bàn giao cho xe" }
```

Nếu tuyến là Kho tổng ↔ Bếp tổng, response có `status=APPROVED` ngay do policy `NO_MANAGER_APPROVAL`. Tuyến khác trả `SUBMITTED` và chờ Web duyệt. Không hardcode theo tên kho; luôn đọc status trong response.

Khi đã có order, dùng flow dispatch/receipt ở mục 5 để hoàn tất vận chuyển.

## 7. Flow Kiểm kê

`POST /stocktakes`

```json
{
  "stock_location_id": "<location-uuid>",
  "business_date": "2026-10-06",
  "cutoff_at": "2026-10-06T23:59:59+07:00",
  "lines": [
    { "ingredient_id": "<ingredient-uuid>", "counted_quantity": "12.5" }
  ]
}
```

Sửa bằng `PUT /stocktakes/{id}` với đầy đủ dữ liệu và `expected_version`; gửi bằng `POST /stocktakes/{id}/submit`:

```json
{ "expected_version": 1 }
```

Không dùng số tồn cache làm số đếm mặc định rồi tự submit. Người dùng phải xác nhận số thực tế; backend lưu snapshot để đối soát iPOS trên Web.

## 8. Flow Báo hỏng

`POST /damage-reports`

```json
{
  "stock_location_id": "<location-uuid>",
  "reason": "Hàng hỏng do mất điện kho lạnh",
  "lines": [
    {
      "ingredient_id": "<ingredient-uuid>",
      "quantity": "3.5",
      "reason": "Bao bì rách"
    }
  ]
}
```

Sửa `DRAFT` bằng `PUT /damage-reports/{id}` với body trên + `expected_version`. Gửi xác nhận:

```http
POST /damage-reports/{id}/submit
```

```json
{ "expected_version": 1 }
```

Submit chưa trừ tồn. Chỉ sau khi người có quyền xác nhận trên Web, phiếu thành `CONFIRMED` và ledger mới ghi giảm tồn.

Ảnh báo hỏng dùng cùng attachment API với `resource_type=DAMAGE_REPORT` và `resource_id=<damage-report-uuid>`.

## 9. Thông báo và FCM Android/iOS

- Danh sách: `GET /notifications?status=UNREAD&page=1&page_size=20`.
- Detail: `GET /notifications/{id}`; server kiểm tra lại quyền đọc resource tại thời điểm mở.
- Đọc một: `POST /notifications/{id}/read`, body `{}`.
- Đọc tất cả: `POST /notifications/read-all`, body `{}`.

Sau khi Firebase Messaging cấp hoặc refresh registration token, đăng ký thiết bị:

`POST /push-devices`

```json
{
  "token": "<fcm-registration-token>",
  "platform": "IOS",
  "device_id": "<installation-id-do-app-tu-sinh>",
  "app_version": "1.0.0+12"
}
```

- Gọi lại endpoint này mỗi khi FCM refresh token, user đăng nhập hoặc app được cài lại.
- `platform` nhận `ANDROID` hoặc `IOS`; Android có thể bỏ qua trường này để dùng mặc định `ANDROID`, còn iPhone phải gửi `IOS`.
- Khi logout, gọi `POST /push-devices/unregister` với `{ "token": "<token>" }` trước khi xóa access token.
- Có thể xem các thiết bị đang hoạt động bằng `GET /push-devices`.
- Android phải tạo notification channel id `dica_operations` (hoặc giá trị backend cấu hình tại `FCM_ANDROID_CHANNEL_ID`).
- iOS phải xin quyền notification, đăng ký APNs/FCM token và cấu hình APNs authentication key cho iOS app trong Firebase Console. Backend vẫn dùng cùng Firebase service account, không cần thêm private key APNs vào `.env`.
- Payload data gồm `notification_id`, `resource_type`, `resource_id`, `route`. Khi người dùng chạm push, ưu tiên điều hướng theo `resource_type/resource_id`; luôn tải detail lại từ API và không tin nội dung push làm dữ liệu nghiệp vụ.
- Các sự kiện đang phát push: yêu cầu được duyệt/từ chối, điều chuyển chờ duyệt/được duyệt/bị từ chối, nhận hàng sai lệch, kiểm kê có chênh lệch, báo hỏng chờ xử lý/đã xác nhận.

Vẫn poll `GET /notifications` khi app foreground/resume vì push chỉ là tín hiệu best-effort. Backend luôn lưu notification trong database trước rồi mới gửi FCM; FCM lỗi không làm rollback nghiệp vụ.

## 10. Lỗi cần xử lý riêng

| Code                                                | Xử lý trên Mobile                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| `AUTH_INVALID_CREDENTIALS` / `AUTH_SESSION_INVALID` | Xóa phiên hợp lệ, đưa về đăng nhập; không retry vô hạn            |
| `FORBIDDEN`                                         | Ẩn thao tác sau khi refresh `/me/permissions`; báo không đủ quyền |
| `VALIDATION_ERROR`                                  | Gắn `details` vào field hoặc hiển thị danh sách lỗi               |
| `VERSION_CONFLICT`                                  | Reload detail, không tự ghi đè                                    |
| `IDEMPOTENCY_KEY_REQUIRED`                          | Gửi key cho command ghi sổ/duyệt bắt buộc                         |
| `IDEMPOTENCY_CONFLICT`                              | Không tái dùng key với payload mới                                |
| `SOURCE_NOT_CONFIGURED` / `SOURCE_UNAVAILABLE`      | Báo quản lý cấu hình nguồn; không tự đổi NCC/kho                  |
| `QUANTITY_EXCEEDS_REMAINING`                        | Reload order và giới hạn lại số lượng                             |
| `INSUFFICIENT_STOCK`                                | Reload tồn, không cho post xuất                                   |
| `INVALID_STATE`                                     | Reload document; trạng thái đã đổi ở thiết bị khác                |
| `POLICY_NOT_CONFIGURED`                             | Không retry; báo nghiệp vụ chưa được bật ở môi trường hiện tại    |

## 11. Chưa tích hợp trong Mobile v1

- `An toàn`, `Lưu mẫu`, `Truy xuất lô`, app khách hàng, đánh giá và chấm công: phạm vi làm sau.
- Cấu hình iPOS/recipe, báo cáo tổng hợp, payment, user/role, danh mục và nguồn cấp: chỉ Admin Web.
- `GET /supplier/orders` và `GET /supplier/orders/{id}`: backend còn giữ contract dự phòng nhưng được gắn nhãn `[CHƯA TÍCH HỢP]`; không làm app/module riêng cho nhà cung ứng theo `flow.md`.

# Vận hành

## Deploy

Build image bằng `docker build -t dica-backend:1.0.0 .`. Chạy migration bằng một job riêng trước khi tăng replica API. Docker Compose tự chạy `db:migrate` rồi `db:bootstrap`; bootstrap production có version, chỉ tạo admin khi chưa tồn tại và không bao giờ đặt lại mật khẩu của tài khoản đã có. `db:seed` chỉ dành cho dữ liệu demo/local.

Ở production, Swagger mặc định tắt; chỉ đặt `SWAGGER_ENABLED=true` khi tài liệu API được bảo vệ ở tầng gateway. Giữ `DEMO_POLICY_ENABLED=false` cho tới khi các policy nghiệp vụ demo đã được phê duyệt.

Mỗi replica tạo tối đa `DB_POOL_MAX` kết nối. Cấu hình sao cho `số replica × DB_POOL_MAX` thấp hơn giới hạn PostgreSQL và còn dư kết nối cho migration/giám sát. Các mặc định bảo vệ pool là `DB_STATEMENT_TIMEOUT_MS=30000`, `DB_LOCK_TIMEOUT_MS=5000`, `DB_IDLE_TRANSACTION_TIMEOUT_MS=30000`; chỉ tăng sau khi có số liệu query plan và latency thực tế.

Docker không bắt buộc khi chạy local. Với PostgreSQL cài trực tiếp, tạo database khớp `DATABASE_URL`, sau đó chạy `npm run db:migrate` và `npm run db:seed`. Có thể dùng `npx prisma migrate status` để xác nhận schema đã đồng bộ.

## Logging và truy vết request

Ứng dụng dùng Pino làm logger chung cho NestJS và HTTP. Môi trường development hiển thị log dạng dễ đọc; production xuất JSON để hệ thống thu thập log xử lý. Mức log lấy từ `LOG_LEVEL`.

Mỗi request có `x-request-id`. ID hợp lệ từ client được giữ nguyên; nếu thiếu hoặc sai định dạng, server tự sinh UUID. Giá trị này có trong log, response header và response body để đối chiếu sự cố. Authorization, cookie, password, token, secret và API key không được ghi rõ trong log hoặc audit.

## Lịch sử cấu hình admin

Mọi request thay đổi cấu hình thành công (`POST`, `PUT`, `PATCH`, `DELETE`) tại các controller quản trị đều tạo một `AuditEvent`. Phạm vi hiện gồm:

- Tổ chức, cơ sở, kho và bộ phận.
- Đơn vị, nhóm/nguyên liệu, quy đổi, nhà cung ứng và liên kết nguyên liệu.
- Eligibility, source rule và cập nhật source rule hàng loạt.
- User, trạng thái user và phân quyền.
- Mapping món iPOS, định mức và rule cảnh báo.

Audit lưu người thao tác, tổ chức, action, resource, request ID, đường dẫn, tham số, body đã che dữ liệu nhạy cảm, kết quả và thời gian. Admin có quyền `audit.read` xem lịch sử qua `GET /api/v1/audit-events`, lọc theo `action` hoặc `resource_type`. Các audit nghiệp vụ chi tiết có sẵn vẫn được ghi song song.

Nếu database từ chối bản ghi audit sau khi thao tác hoàn tất, API ghi log lỗi mức `error` kèm request ID để cảnh báo vận hành; không ghi token hoặc mật khẩu vào log lỗi.

## Phân trang dữ liệu lớn

Không endpoint danh sách quản trị nào trả toàn bộ dữ liệu theo mặc định. `page_size` mặc định 20 và tối đa 100.

Offset mode phù hợp màn hình cần nhảy tới một trang xác định:

```http
GET /api/v1/users?page=2&page_size=20
```

```json
{
  "meta": {
    "mode": "offset",
    "page": 2,
    "page_size": 20,
    "total": 125,
    "total_pages": 7,
    "has_next": true,
    "has_previous": true
  }
}
```

Cursor mode phù hợp audit, ledger, notification và các bảng lớn vì không chạy truy vấn đếm tổng:

```http
GET /api/v1/audit-events?pagination_mode=cursor&page_size=50
GET /api/v1/audit-events?pagination_mode=cursor&page_size=50&cursor=<next_cursor>
```

```json
{
  "meta": {
    "mode": "cursor",
    "page_size": 50,
    "next_cursor": "uuid-cua-ban-ghi-cuoi",
    "has_next": true
  }
}
```

Không gửi `page > 1` cùng cursor. `search` và `sort_by` chỉ hoạt động ở endpoint công bố hỗ trợ; trường sort ngoài allowlist bị trả `400 VALIDATION_ERROR`. Tất cả truy vấn vẫn áp dụng organization/scope trước khi phân trang. Migration `202610030001_pagination_indexes` bổ sung các index theo scope, thời gian và `id` cho đường đọc lớn.

## Backup/restore

Script PowerShell nằm tại `scripts/backup.ps1` và `scripts/restore.ps1`, yêu cầu `pg_dump`/`pg_restore`. Backup file/ảnh private trên R2 phải thực hiện cùng checkpoint với database; storage đã chốt R2 nhưng retention, versioning, RPO/RTO vẫn chờ OPEN-09.

Sau restore phải chạy kiểm tra:

```sql
SELECT stock_location_id, ingredient_id, SUM(quantity)
FROM stock_ledger_entries
GROUP BY stock_location_id, ingredient_id;
```

So sánh kết quả với `stock_balances`, kiểm tra attachment reference và role grant trước khi mở traffic. RPO/RTO và retention chưa được cam kết khi OPEN-09 chưa chốt.

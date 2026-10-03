# Kiến trúc

## Quyết định chính

Hệ thống dùng modular monolith NestJS 12 + PostgreSQL + Prisma 7. Đây là mức kiến trúc phù hợp khi chưa có số liệu tải (OPEN-09), giữ transaction nghiệp vụ trong một database nhưng vẫn chia ranh giới module để có thể tách worker hoặc service sau này.

Luồng phụ thuộc:

```text
Auth/RBAC ──> Organization/Catalog ──> Sourcing
                                      │
                                      v
Request ──approve──> FulfillmentOrder ──> Dispatch/Receipt ──> Ledger/Balance
        │                                      │
        └──────── Audit + Outbox <─────────────┘
```

- API không tin organization, actor hoặc supplier identity từ client.
- List lọc scope ngay trong truy vấn trước khi phân trang.
- List dùng thứ tự ổn định có khóa phụ `id`. Offset mode phục vụ UI cần tổng số trang; cursor mode lấy dư một bản ghi, không chạy `COUNT(*)` và phù hợp luồng dữ liệu lớn.
- Chứng từ dùng action command và optimistic version, không PATCH status tự do.
- Ledger chỉ thêm mới; balance là cache và phải đối chiếu được bằng tổng ledger.
- Posting, status, audit, idempotency và outbox nằm trong cùng transaction serializable.
- Thông báo/file phải authorize lại khi đọc; outbox tách lỗi gửi thông báo khỏi transaction đã commit.
- Decimal dùng `Decimal(20,3)` cho lượng, `Decimal(20,4)` cho giá và hệ số `Decimal(20,6)`.
- UTC dùng cho timestamp; ngày nghiệp vụ là date và được diễn giải theo `Asia/Ho_Chi_Minh`.

## Bảo mật

Access token mặc định 15 phút. Mỗi request đọc user, session, token version và grant hiện hành từ database nên thu hồi session/quyền có hiệu lực ngay. Password dùng Argon2. Token/password không được đưa vào audit. Supplier chỉ có grant `SUPPLIER` và projection DTO riêng.

## Policy demo

Khi `DEMO_POLICY_ENABLED=true`, policy tồn kho theo mục 7.1 của yêu cầu dùng cho demo. Trước production, action phụ thuộc OPEN-01/03 phải được xác nhận và version policy phải được lưu trong audit; không sửa lại lịch sử.

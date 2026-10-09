# DICA Backend

Backend NestJS dạng modular monolith cho web quản trị và ứng dụng DICA. API dùng REST tại `/api/v1`, tài liệu OpenAPI tại `/docs` và `/openapi.json`. OpenAPI có request/response/error schema đầy đủ cùng metadata phân loại Mobile/Admin Web để sinh client.

## Thành phần đã triển khai

- Xác thực JWT access/refresh, session có thể thu hồi, rate limit đăng nhập.
- RBAC theo permission và grant nguyên khối; kiểm tra scope tại server.
- Cơ sở, kho, bộ phận; nguyên liệu, nhóm, đơn vị, nhà cung ứng.
- Quy đổi theo nguyên liệu có phiên bản/thời gian hiệu lực và kiểm tra chồng lấn.
- Eligibility và source rule có revision/lịch sử, cập nhật hàng loạt all-or-nothing.
- Yêu cầu hàng: draft, submit, duyệt/từ chối; snapshot nguồn/quy đổi; tự tách đơn theo nguồn.
- Projection riêng cho nhà cung ứng; không lộ request, tồn kho, audit hoặc payment nội bộ.
- Xuất/nhận từng phần, giao bù; ledger bất biến, balance cache, transaction, idempotency, audit và outbox.
- Điều chuyển theo tuyến được phép và khoảng giờ nhận; kiểm kê snapshot; báo hỏng ghi giảm một lần; điều chỉnh tồn có duyệt/post; cho phép tồn vật lý âm.
- Chốt thiếu và hoàn hàng lúc 00:00 theo giờ Việt Nam; đối soát theo lượng thực giữ lại; cấu hình giá chuẩn, lưu ảnh riêng tư 6–12 tháng và xác nhận thanh toán hai người.
- Import bán hàng thủ công, mapping món, định mức version và tính hao hụt có kiểm tra dữ liệu thiếu.
- Báo cáo tồn/đơn/hao hụt/hỏng/payment; thông báo kiểm tra lại quyền; health live/ready; migration và seed demo.
- Logger Pino có request ID, log JSON ở production, log dễ đọc khi development và tự che dữ liệu nhạy cảm.
- Mọi thay đổi cấu hình admin hiện có đều ghi lịch sử tập trung, gồm người thao tác, request, dữ liệu vào/kết quả và thời gian.
- Mọi API danh sách đều phân trang mặc định; hỗ trợ offset đầy đủ metadata và cursor không `COUNT(*)` cho dữ liệu lớn.

Quyết định nghiệp vụ hiện hành là [câu trả lời của khách ngày 08/10/2026](docs/customer-flow-questions-response.md); khi mâu thuẫn, ưu tiên quyết định này hơn `flow.md`/`new-flow.md` và các đánh giá cũ trong `TASK.md`. Tài liệu bàn giao cho Mobile nằm tại [docs/mobile-integration.md](docs/mobile-integration.md). Web dành cho cấu hình; nghiệp vụ vận hành và duyệt thực hiện trên mobile.

Các tài liệu kỹ thuật còn lại được tách theo mục đích: [kiến trúc](docs/architecture.md), [quyết định](docs/decisions.md), [deploy VPS](docs/deployment-vps.md) và [vận hành](docs/operations.md). Swagger tại `/docs` là API contract thực thi.

## Chạy local

Yêu cầu Node.js 22.22.3+, 24.15+ hoặc 26+ và PostgreSQL 17+. Có thể dùng PostgreSQL cài trực tiếp trên máy hoặc container Docker.

1. Sao chép `.env.example` thành `.env`, thay hai JWT secret và mật khẩu seed.
2. Cấu hình `DATABASE_URL` trỏ tới database PostgreSQL local, ví dụ `postgresql://user:password@localhost:5432/dica?schema=public`. Database phải tồn tại trước khi migrate.
3. Nếu không dùng PostgreSQL local, có thể chạy container tùy chọn: `docker compose up -d postgres`.
4. Cài dependency: `npm install`.
5. Chạy migration: `npm run db:migrate`.
6. Tạo dữ liệu demo: `npm run db:seed`.
7. Chạy API: `npm run start:dev`.

Tài khoản demo lấy tên và mật khẩu từ `BOOTSTRAP_ADMIN_USERNAME` và `BOOTSTRAP_ADMIN_PASSWORD`; tài khoản nhà cung cấp là `supplier.a` và dùng cùng mật khẩu. Seed chỉ dùng mật khẩu mặc định `DicaDemo#2026` khi không phải production. Bộ biến `BOOTSTRAP_ORGANIZATION_*` và `BOOTSTRAP_ADMIN_*` được dùng thống nhất cho cả bootstrap production và seed demo/local.

Seed được thiết kế để chạy lại an toàn bằng `npm run db:seed`. Nếu cần xóa toàn bộ dữ liệu local rồi dựng lại từ đầu, dùng `npx prisma migrate reset --force`; lệnh này chỉ nên chạy với database development vì sẽ xóa dữ liệu trước khi migrate và seed lại.

`LOG_LEVEL` điều khiển mức log (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`). Client có thể gửi `x-request-id`; nếu hợp lệ server sẽ giữ nguyên, nếu không server tự sinh và trả lại trong header/response.

Phân trang mặc định dùng `page=1&page_size=20`, tối đa 100 bản ghi. Với audit, ledger hoặc danh sách lớn, dùng `pagination_mode=cursor&page_size=50`; gửi `next_cursor` của response vào `cursor` ở request tiếp theo.

## Kiểm tra

```bash
npm run typecheck
npm test
npm run build
npm run format:check
```

## Deploy VPS

Image production, Docker Compose và workflow GitHub Actions/GHCR được mô tả tại [docs/deployment-vps.md](docs/deployment-vps.md). File cấu hình mẫu là `.env.production.example`; không commit `.env.production` hoặc secret thật.

## Quy ước response

Thành công:

```json
{
  "success": true,
  "message": "Tạo bản nháp yêu cầu hàng thành công.",
  "data": {},
  "request_id": "a-request-id",
  "timestamp": "2026-10-02T00:00:00.000Z"
}
```

Lỗi:

```json
{
  "success": false,
  "code": "VERSION_CONFLICT",
  "message": "Phiếu đã được cập nhật. Vui lòng tải lại.",
  "details": {},
  "request_id": "a-request-id",
  "timestamp": "2026-10-02T00:00:00.000Z"
}
```

Quantity/price gửi bằng chuỗi thập phân; thời gian ISO-8601; ngày nghiệp vụ `YYYY-MM-DD`. Request/transfer approve, dispatch/receipt post, adjustment post, sales-import commit và payment update bắt buộc có `Idempotency-Key`.

# Review triển khai theo `new-flow.md`

Ngày review: 08/10/2026.

## 1. Kết luận

- `new-flow.md` được giữ nguyên và tiếp tục là nguồn yêu cầu gốc.
- Web Admin và Backend **đã khớp contract** đối với các phần triển khai trong đợt này: quyền xin hàng theo nhóm, ngoại lệ từng mặt hàng, nhà cung cấp ưu tiên và số điện thoại bắt buộc.
- Backend và tài liệu Mobile **đã khớp contract** cho flow Mobile hiện có, bao gồm không gian nhà cung cấp chỉ đọc đơn của mình.
- Chưa thể kết luận Mobile app đã tích hợp hoàn chỉnh vì workspace không có source code Mobile.
- Chưa xác nhận end-to-end với database/migration thật hoặc trình duyệt; kết luận hiện tại dựa trên review code, typecheck, unit/contract test và production build.

## 2. Đối chiếu Web Admin ↔ Backend

| Chức năng                     | Frontend                                    | Backend                                                                | Kết quả             |
| ----------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- | ------------------- |
| Xem quyền theo nhóm           | `GET /group-eligibility`                    | Có route, permission `eligibility.read`, pagination và response schema | Khớp                |
| Cấp/sửa quyền theo nhóm       | `POST /group-eligibility`                   | Upsert theo cơ sở + bộ phận + nhóm, permission `eligibility.manage`    | Khớp                |
| Bật/tắt quyền theo nhóm       | Gửi `active`                                | Backend giữ nguyên hạn mức nếu payload không gửi lại                   | Khớp                |
| Xem ngoại lệ mặt hàng         | `GET /item-eligibility`                     | Trả cấu hình trực tiếp theo mặt hàng                                   | Khớp                |
| Mobile lấy danh sách hiệu lực | Tham số `effective=true` trong tài liệu     | Backend gộp quyền nhóm và ngoại lệ mặt hàng                            | Khớp                |
| Nhà cung cấp ưu tiên          | `is_preferred` trong form và type           | `isPreferred`, tối đa một NCC ưu tiên đang hoạt động/mặt hàng          | Khớp                |
| Số điện thoại NCC             | UI bắt buộc                                 | DTO tạo mới bắt buộc                                                   | Khớp                |
| Tab và deep link              | `rules`, `group-eligibility`, `eligibility` | Không phụ thuộc backend                                                | Khớp quyền hiển thị |

### Quy tắc quyền theo nhóm

1. Cấu hình trực tiếp theo nguyên liệu luôn ưu tiên cấu hình nhóm.
2. Cấu hình trực tiếp `active=false` chặn riêng nguyên liệu dù nhóm đang được phép.
3. Cấu hình trực tiếp có hạn mức `null` nghĩa là không giới hạn và không kế thừa hạn mức nhóm.
4. Nhóm nguyên liệu ngừng hoạt động không còn cấp quyền hiệu lực khi tạo hoặc duyệt phiếu.

## 3. Đối chiếu Mobile integration ↔ Backend

### Đã khớp

- Đăng nhập, refresh token, hồ sơ, permission và scope.
- Xin hàng, sửa draft, gửi duyệt, revise và cancel.
- Xuất hàng, nhận hàng, idempotency và version conflict.
- Phiếu nhận bắt buộc có ít nhất một attachment `RECEIPT` ở trạng thái `READY` trước khi post.
- Điều chuyển Kho tổng ↔ Bếp tổng tự duyệt; tuyến khác chờ duyệt.
- Kiểm kê, báo hỏng, notification inbox và FCM.
- Nhà cung cấp dùng chung cơ chế đăng nhập; endpoint `/supplier/orders` tự giới hạn theo `supplier_id`.
- Projection nhà cung cấp không trả đơn giá, tồn kho hoặc công nợ khi quyền xem giá chưa được chốt.
- Push của nhà cung cấp dùng route `/supplier/orders/{id}`.

### Sai lệch tài liệu đã sửa trong lần review

1. Đổi nguồn tham chiếu từ `Untitled.fig` sang `new-flow.md`.
2. Sửa payload hủy yêu cầu từ trường không tồn tại `reason` sang `note`.
3. Sửa mô tả báo hỏng: xác nhận hiện chưa ghi giảm tồn và policy production vẫn bị chặn.
4. Bổ sung sự kiện push đơn mới cho nhà cung cấp.
5. Ghi rõ tài liệu Mobile là contract bàn giao, chưa phải bằng chứng app đã được triển khai.

## 4. Lỗi code phát hiện và đã xử lý

| Mức độ     | Phát hiện                                                                               | Xử lý                                                                |
| ---------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Cao        | Từ chối yêu cầu từng ghi request ID của HTTP request thay vì ID phiếu nghiệp vụ         | Dùng đúng ID phiếu trong approval event và thêm test hồi quy         |
| Cao        | Projection nhà cung cấp trả `unitPriceSnapshot` dù quyền xem giá chưa được chốt         | Loại đơn giá khỏi runtime projection và OpenAPI; thêm contract test  |
| Cao        | Nhóm đã ngừng hoạt động vẫn có thể được dùng khi kiểm tra quyền tạo/duyệt phiếu         | Bắt buộc nhóm active trong cấu hình và revalidation                  |
| Cao        | Duyệt phiếu chưa kiểm tra lại toàn bộ trạng thái nguồn, kho nhận và hạn mức đã thay đổi | Revalidate dữ liệu hiện hành ngay trong transaction duyệt            |
| Trung bình | Ngoại lệ trực tiếp “không giới hạn” bị response hiệu lực hiển thị nhầm hạn mức của nhóm | Giữ đúng `null` của cấu hình trực tiếp; thêm test hồi quy            |
| Trung bình | UI có thể chọn NCC ưu tiên cho liên kết đang ngừng hoạt động                            | Khóa switch và backend tiếp tục kiểm tra                             |
| Trung bình | Backend hỗ trợ sửa hạn mức nhóm nhưng UI không có thao tác sửa rõ ràng                  | Bổ sung nút sửa và form cập nhật                                     |
| Trung bình | Thêm nhiều mặt hàng được xin từng gọi API riêng, có thể lưu dở dang                     | Dùng endpoint bulk atomic, tối đa 500 cấu hình/lần                   |
| Trung bình | Import nguồn kho chỉ dùng mã kho nên mơ hồ khi nhiều cơ sở trùng mã                     | Hỗ trợ mã cơ sở nguồn và báo lỗi khi mã kho không duy nhất           |
| Thấp       | Tab không có quyền vẫn xuất hiện rồi tự chuyển sau render                               | Lọc tab trước render và chỉ đổi tab khi người dùng/deep link yêu cầu |

## 5. Rủi ro và việc còn lại

### Cần thực hiện trước khi triển khai production

1. Chạy migration trên môi trường thử nghiệm và kiểm tra dữ liệu thật.
2. Chạy smoke test có PostgreSQL cho tạo yêu cầu theo nhóm, duyệt phiếu, đổi NCC ưu tiên và post receipt có/không có ảnh.
3. Có source Mobile để kiểm tra login theo `kind=SUPPLIER`, deep link, upload ảnh và retry idempotency thực tế.
4. Chốt các câu hỏi nghiệp vụ trong `docs/customer-flow-questions.md`.

### Nợ kỹ thuật không chặn build

- Web ESLint đạt với 0 error và 0 warning; chưa có bộ component test để chống hồi quy UI.
- Ảnh R2 hiện dùng URL public không hết hạn; thu hồi quyền trong DICA không thu hồi được URL đã biết.
- Chưa có browser/component test tự động cho trạng thái mở/đóng sidebar và chuyển tab con.
- Chưa có integration test chạy migration và unique partial index bằng PostgreSQL thật.

## 6. Kết quả kiểm tra

- Backend typecheck: đạt.
- Backend test: đạt 55/55, gồm contract OpenAPI, bulk eligibility, hạn mức nhóm, reject event và revalidation nguồn cấp.
- Web typecheck: đạt.
- Web ESLint: đạt, 0 error và 0 warning.
- Web production build với Next.js 16.4.0: đạt.
- `npm audit --omit=dev --audit-level=high`: không có vulnerability ở Backend và Web tại thời điểm review.

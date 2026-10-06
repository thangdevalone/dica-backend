# DICA — Các task còn lại theo `flow.md`

File này chỉ theo dõi những phần chưa hoàn chỉnh hoặc chưa được chốt trong `flow.md`. Không tự triển khai các giả định nghiệp vụ bên dưới cho đến khi có quyết định rõ ràng.

## P0 — Cần chốt trước khi triển khai

### 1. Chọn client cho luồng duyệt

**Hiện tại:** Duyệt/từ chối yêu cầu hàng và điều chuyển được tích hợp trên Admin Web. Mobile chỉ tạo, sửa, gửi và theo dõi phiếu.

**Cần chốt:**

- Quản lý tổng/Chủ duyệt trên Web, Mobile hay cả hai.
- Có yêu cầu xác thực bổ sung khi duyệt trên Mobile hay không.

**Tiêu chí hoàn thành:**

- Swagger gắn đúng `[MOBILE]`, `[ADMIN WEB]` hoặc `[MOBILE + ADMIN WEB]`.
- Client được chọn có đầy đủ approve/reject, nhập lý do, xử lý version conflict và idempotency.
- Client không thuộc phạm vi không hiển thị thao tác duyệt.

### 2. Quy trình hoàn hàng

**Hiện tại:** Chưa có model, trạng thái, API hoặc màn hình hoàn hàng riêng.

**Cần chốt:**

- Hoàn về kho tổng, cơ sở khác hay nhà cung ứng.
- Ai tạo, ai duyệt và ai xác nhận nhận lại.
- Khi nào trừ tồn bên trả/cộng tồn bên nhận.
- Có hỗ trợ hoàn một phần, hàng hỏng và ảnh chứng từ hay không.

**Tiêu chí hoàn thành:**

- Có state machine và permission riêng cho hoàn hàng.
- Có migration, API Mobile, API Web nếu cần duyệt và notification tương ứng.
- Ghi stock ledger idempotent và lưu audit đầy đủ.
- Có test cho hoàn đủ, hoàn một phần, version conflict và retry.

### 3. Quy tắc xử lý thiếu/thừa hàng

**Hiện tại:** Backend tạo discrepancy, hỗ trợ nhận bù nhiều lần, resolve sai lệch và đóng phần còn thiếu. Chưa có bộ lý do/kết quả xử lý chuẩn.

**Cần chốt:**

- Thiếu hàng quá ngày được giao bù, hủy phần thiếu hay chuyển công nợ.
- Hàng thừa được nhận thêm, trả lại hay treo chờ xử lý.
- Ai có quyền quyết định từng phương án.

**Tiêu chí hoàn thành:**

- Discrepancy có resolution type dạng enum và lịch sử xử lý.
- Mỗi phương án cập nhật order, receipt, payment và tồn kho nhất quán.
- Web/Mobile hiển thị đúng trạng thái cuối và không cho thao tác trùng.

### 4. Bộ trạng thái và quy tắc thanh toán

**Hiện tại:** Có payment tracking dựa trên giá trị thực nhận, cập nhật số tiền đã trả và báo cáo trên Web.

**Cần chốt:**

- Bộ trạng thái chính thức: chưa thanh toán, một phần, đủ, quá hạn, hủy/điều chỉnh.
- Có ngày đến hạn, mã giao dịch, phương thức và chứng từ thanh toán hay không.
- Cách điều chỉnh tiền khi nhận bù, trả hàng hoặc xử lý thiếu/thừa.

**Tiêu chí hoàn thành:**

- Không cho số tiền thanh toán vượt giá trị đối soát sau điều chỉnh.
- Mọi cập nhật dùng version và idempotency key.
- Có audit và báo cáo lọc theo trạng thái/ngày đến hạn.

## P1 — Nghiệp vụ cần bổ sung

### 5. Phiếu gửi nhà cung ứng dạng PDF/ảnh

**Hiện tại:** Web xuất được CSV đơn nhà cung ứng; chưa xuất PDF/ảnh theo mẫu gửi NCC.

**Công việc:**

- Chốt mẫu phiếu, logo, thông tin liên hệ, địa chỉ giao và ghi chú.
- Tạo endpoint xuất PDF hoặc chức năng in phía Web.
- Không đưa thông tin nội bộ như tồn kho, payment, request cha và audit vào phiếu.

**Tiêu chí hoàn thành:**

- Phiếu hiển thị đúng đơn vị, số lượng, thời gian và địa điểm giao.
- File tiếng Việt không lỗi font và dùng được trên Mobile/Zalo/email.
- Có test quyền truy cập và test dữ liệu phiếu.

### 6. Nhắc lại đơn thiếu quá ngày

**Hiện tại:** Hệ thống gửi notification/FCM khi phát sinh discrepancy, chưa nhắc lại theo ngày.

**Công việc:**

- Chốt giờ nhắc, timezone và nhóm người nhận.
- Tạo scheduled job tìm shortage còn mở/quá hạn.
- Dùng khóa chống gửi trùng cho cùng discrepancy và ngày nghiệp vụ.

**Tiêu chí hoàn thành:**

- Android và iOS nhận push; notification vẫn được lưu DB trước.
- Không gửi lại khi đã nhận bù đủ, resolve hoặc đóng phần thiếu.
- Job chạy lại an toàn sau restart và không tạo notification trùng.

### 7. Kết nối iPOS thật

**Hiện tại:** Có mapping món, recipe, import batch, validate/commit, variance và adapter status; dữ liệu vẫn được nhập qua contract/import.

**Cần chốt:**

- iPOS cung cấp API, webhook, file định kỳ hay kết nối database.
- Cơ chế xác thực, giới hạn gọi, retry và khóa batch ngoài hệ thống.
- Mã cơ sở/món/hóa đơn dùng để mapping.

**Tiêu chí hoàn thành:**

- Adapter đồng bộ incremental, idempotent và có checkpoint.
- Batch lỗi không làm commit dữ liệu một phần.
- Có log vận hành, cảnh báo và nút retry an toàn trên Web.

### 8. Cảnh báo tồn kho/hao hụt tự động

**Hiện tại:** Có alert-rule contract nhưng rule mặc định chưa active và chưa phát push tự động.

**Cần chốt:**

- Ngưỡng tuyệt đối, số ngày tồn, tỷ lệ hao hụt hoặc kết hợp.
- Tần suất đánh giá và thời gian im lặng giữa hai cảnh báo.
- Người nhận theo facility, stock location, department và permission.

**Tiêu chí hoàn thành:**

- Rule active được đánh giá theo lịch và tạo notification có resource hợp lệ.
- Android/iOS nhận FCM, không spam và có deduplication.
- Web có thể bật/tắt, xem lần chạy cuối và lịch sử cảnh báo.

## P2 — Cải thiện trải nghiệm

### 9. Xem ảnh chứng từ trực tiếp trên Admin Web

**Hiện tại:** Backend đã có API list/download attachment; Mobile có hướng dẫn upload. Web chưa có gallery ảnh trong chi tiết receipt/damage/discrepancy.

**Tiêu chí hoàn thành:**

- Web tải ảnh qua request có Bearer token, không dùng URL công khai.
- Có loading, lỗi, preview, tải xuống và thu hồi object URL.
- Chỉ người còn quyền trên resource mới xem được ảnh.

### 10. Hoàn thiện cảnh báo lint Web

**Hiện tại:** Typecheck/build đạt và ESLint không có error, nhưng còn warning về state trong effect và import không sử dụng.

**Tiêu chí hoàn thành:**

- `npm run lint` không còn warning trong các file được sửa.
- Không làm thay đổi hành vi permission-gated tab hoặc URL deep link.

## Không thuộc phạm vi hiện tại

- App/module riêng cho nhà cung ứng.
- App khách hàng, đặt món và đánh giá.
- Chấm công và quy trình vận hành nhà hàng.
- Phần mềm bán hàng thay thế iPOS.
- An toàn thực phẩm, lưu mẫu và truy xuất lô khi chưa có đặc tả mới.

## Definition of Done chung

Mỗi task chỉ được đánh dấu hoàn thành khi:

1. Backend có migration tương thích ngược nếu thay đổi database.
2. Swagger có mô tả client sử dụng, request body và type cho mọi response status.
3. Permission/scope được kiểm tra phía backend, không chỉ ẩn nút ở client.
4. Mobile/Web contract và tài liệu tích hợp được cập nhật.
5. Notification được lưu DB trước khi gửi FCM Android/iOS.
6. Typecheck, test, build, format và CI đều đạt.

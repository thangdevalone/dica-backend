# Câu hỏi cần chốt với khách hàng về luồng DICA

Cập nhật: 08/10/2026.

Tài liệu này chỉ ghi các quyết định nghiệp vụ còn thiếu trong `new-flow.md`. Những nội dung đã xác nhận dưới đây không cần hỏi lại:

- Nhà cung cấp dùng chung app DICA, không làm app riêng.
- Nhà cung cấp chỉ được xem đơn thuộc nhà cung cấp của mình.
- Kho tổng ↔ Bếp tổng là tuyến điều chuyển không cần Quản lý tổng duyệt.
- Khi nhận hàng, người nhận phải kiểm đếm và chụp ảnh.

## A. Các câu cần chốt trước khi hoàn thiện luồng

### 1. Nhà cung cấp thao tác gì trên app?

Ngoài xem đơn của mình, nhà cung cấp có cần thực hiện các thao tác sau không?

- [ ] Nhận đơn.
- [ ] Từ chối đơn và nhập lý do.
- [ ] Cập nhật “Đang chuẩn bị”.
- [ ] Cập nhật “Đang giao”.
- [ ] Nhập số lượng thực giao.
- [ ] Đính kèm hóa đơn hoặc chứng từ giao hàng.
- [ ] Chỉ xem đơn, không thao tác thêm.

Nếu được từ chối đơn, ai sẽ nhận thông báo và xử lý tiếp theo như thế nào?

### 2. Phiếu bị từ chối, sửa hoặc hủy như thế nào?

- Phiếu bị từ chối sẽ được sửa lại trên chính phiếu cũ hay phải tạo phiếu mới?
- Có cần một trạng thái “Yêu cầu sửa” riêng hay dùng trạng thái “Từ chối” kèm lý do?
- Phiếu đã duyệt có được hủy hoặc thay đổi mặt hàng, số lượng hay nguồn cấp không?
- Ai được hủy phiếu và được hủy ở những trạng thái nào?

### 3. Xử lý nhận thiếu hàng

- Nhà cung cấp/kho có bắt buộc giao bù trong ngày không?
- Nếu qua ngày vẫn chưa đủ, hệ thống nhắc lại cho ai và với tần suất nào?
- Có được giao bù nhiều lần cho cùng một dòng hàng không?
- Khi không thể giao bù, ai được phép đóng phần còn thiếu?
- Phần không giao bù được xử lý là hủy, đổi nguồn cấp hay ghi nhận công nợ?

### 4. Xử lý nhận thừa hàng

Khi nhận thừa, phương án nào được áp dụng?

- [ ] Nhận phần thừa và cộng vào tồn kho.
- [ ] Trả lại bên giao.
- [ ] Giữ ở trạng thái chờ Quản lý tổng quyết định.
- [ ] Điều chỉnh lại phiếu đặt hàng.

Ai có quyền quyết định và quyết định đó có ảnh hưởng đến thanh toán không?

### 5. Quy định về ảnh nhận hàng

- Ảnh bắt buộc với mọi lần nhận hay chỉ khi có thiếu/thừa/hỏng?
- Mỗi phiếu nhận cần tối thiểu và tối đa bao nhiêu ảnh?
- Có bắt buộc chụp lại ở mỗi lần giao bù không?
- Ảnh cần lưu trong bao lâu và những vai trò nào được xem?
- Ảnh có được phép dùng URL công khai không hết hạn không? Nếu ảnh nhạy cảm, cần chuyển sang URL riêng tư có thời hạn và kiểm tra quyền mỗi lần xem.

### 6. Phạm vi điều chuyển giữa các cơ sở

Ngoài Kho tổng ↔ Bếp tổng, có cho phép các tuyến sau không?

- [ ] Chi nhánh ↔ Chi nhánh.
- [ ] Chi nhánh ↔ Kho tổng.
- [ ] Chi nhánh ↔ Bếp tổng.
- [ ] Bếp tổng ↔ Chi nhánh.

Các tuyến trên có luôn phải qua Quản lý tổng duyệt không? Có ngoại lệ nào khác không?

“Thời gian dự kiến nhận” là một thời điểm cụ thể hay một khoảng giờ bắt đầu–kết thúc?

### 7. Giá, thanh toán và công nợ

- Những vai trò nào được xem đơn giá và tổng tiền?
- Nhà cung cấp có được xem đơn giá trên đơn của mình không?
- Ai được nhập đơn giá và ai được cập nhật trạng thái thanh toán?
- Có cần tách người cập nhật và người xác nhận thanh toán không?
- Khi thiếu, thừa, giao bù hoặc hoàn hàng thì giá trị thanh toán được tính lại như thế nào?
- Có cần ngày đến hạn, phương thức thanh toán, mã giao dịch và ảnh chứng từ không?

### 8. Vai trò và quyền

Vui lòng xác nhận người được thực hiện từng nghiệp vụ:

| Nghiệp vụ                 | Vai trò được thực hiện |
| ------------------------- | ---------------------- |
| Tạo phiếu xin hàng        |                        |
| Sửa/hủy phiếu             |                        |
| Duyệt/từ chối/yêu cầu sửa |                        |
| Xuất/giao hàng            |                        |
| Nhận và kiểm hàng         |                        |
| Xử lý thiếu/thừa          |                        |
| Đóng phần thiếu           |                        |
| Kiểm kê                   |                        |
| Xác nhận báo hỏng         |                        |
| Xem giá/công nợ           |                        |
| Cập nhật thanh toán       |                        |
| Xem báo cáo               |                        |

Quản lý tổng và Chủ sẽ duyệt trên Web Admin, app Mobile hay cả hai?

### 9. Thông báo

Với từng sự kiện sau, ai cần nhận thông báo và nhận qua kênh nào: thông báo trong app, push, email hay Zalo?

- Phiếu mới chờ duyệt.
- Phiếu được duyệt hoặc bị từ chối.
- Có đơn mới gửi nhà cung cấp.
- Giao thiếu, giao thừa hoặc hàng hỏng.
- Thiếu hàng chưa được bù qua ngày.
- Điều chuyển sắp đến giờ nhận.
- Kiểm kê bị lệch.
- Thanh toán sắp đến hạn hoặc quá hạn.

Có khung giờ không gửi thông báo và có cần nhắc lại không?

## B. Các câu có thể chốt ở giai đoạn tiếp theo

### 10. Xóa hay ngừng sử dụng?

Khi người dùng chọn “xóa” cơ sở, kho, nguyên liệu hoặc nhà cung cấp:

- Chỉ ngừng sử dụng và vẫn giữ lịch sử?
- Hay cho phép xóa hẳn nếu chưa phát sinh giao dịch?

Khuyến nghị: dùng “Ngừng sử dụng” làm mặc định để không mất dữ liệu lịch sử.

### 11. Hoàn hàng

- Hoàn về Kho tổng, cơ sở khác hay nhà cung cấp?
- Có cho hoàn một phần không?
- Ai tạo, duyệt, giao và xác nhận nhận lại?
- Có bắt buộc ảnh/chứng từ không?
- Khi nào trừ tồn bên trả, cộng tồn bên nhận và điều chỉnh thanh toán?

### 12. Báo hỏng và hao hụt

- Báo hỏng có cần người khác duyệt/xác nhận không?
- Thời điểm nào hàng hỏng bị trừ khỏi tồn kho?
- Chênh lệch kiểm kê có tự điều chỉnh tồn hay phải tạo phiếu chờ duyệt?
- Có cho phép tồn kho âm không?

### 13. Kết nối iPOS

- Dữ liệu được nhận qua API, webhook hay file?
- Khách có thể cung cấp tài khoản/môi trường thử nghiệm không?
- Cần xử lý hóa đơn hủy, hoàn món, combo và đổi món như thế nào?

## C. Cách ghi nhận câu trả lời

Mỗi quyết định nên ghi rõ:

1. Người xác nhận.
2. Ngày xác nhận.
3. Phạm vi áp dụng.
4. Trạng thái và quyền liên quan.
5. Ảnh hưởng đến tồn kho, thanh toán và thông báo.

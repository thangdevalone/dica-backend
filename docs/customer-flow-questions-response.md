# customer-flow-questions

# Câu hỏi cần chốt với khách hàng về luồng DICA

Cập nhật: 08/10/2026.

Tài liệu này chỉ ghi các quyết định nghiệp vụ còn thiếu trong `new-flow.md`. Những nội dung đã xác nhận dưới đây không cần hỏi lại:

- Nhà cung cấp dùng chung app DICA, không làm app riêng.

đúng vậy

- Nhà cung cấp chỉ được xem đơn thuộc nhà cung cấp của mình.

đúng vậy

- Kho tổng ↔︎ Bếp tổng là tuyến điều chuyển không cần Quản lý tổng duyệt.

Phải có thông báo người có quyền biết mỗi lần điều chuyển

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
- [x] Chỉ xem đơn, không thao tác thêm.

Nếu được từ chối đơn, ai sẽ nhận thông báo và xử lý tiếp theo như thế nào?

### 2. Phiếu bị từ chối, sửa hoặc hủy như thế nào?

- Phiếu bị từ chối sẽ được sửa lại trên chính phiếu cũ hay phải tạo phiếu mới?

Tạo phiếu mới

- Có cần một trạng thái “Yêu cầu sửa” riêng hay dùng trạng thái “Từ chối” kèm lý do?
- Phiếu đã duyệt có được hủy hoặc thay đổi mặt hàng, số lượng hay nguồn cấp không?

Chỉ có người quyền mới được hủy, và bắt lên phiếu mới

- Ai được hủy phiếu và được hủy ở những trạng thái nào?

Chỉ có người quyền mới được hủy, trạng thái chưa nhận hàng

### 3. Xử lý nhận thiếu hàng

- Nhà cung cấp/kho có bắt buộc giao bù trong ngày không?

Có, giao trong ngày, nếu qua ngày, sẽ hủy sản phẩm thiếu, để trừ sản phẩm+tiền

- Nếu qua ngày vẫn chưa đủ, hệ thống nhắc lại cho ai và với tần suất nào?

Có, giao trong ngày, nếu qua ngày, sẽ hủy sản phẩm thiếu, để trừ sản phẩm+tiền

- Có được giao bù nhiều lần cho cùng một dòng hàng không?

có

- Khi không thể giao bù, ai được phép đóng phần còn thiếu?

nếu qua ngày, sẽ hủy sản phẩm thiếu, để trừ sản phẩm+tiền

- Phần không giao bù được xử lý là hủy, đổi nguồn cấp hay ghi nhận công nợ?

nếu qua ngày, sẽ hủy sản phẩm thiếu, để trừ sản phẩm+tiền

### 4. Xử lý nhận thừa hàng

Khi nhận thừa, phương án nào được áp dụng?

- [x] Nhận phần thừa và cộng vào tồn kho.
- [ ] Trả lại bên giao.
- [ ] Giữ ở trạng thái chờ Quản lý tổng quyết định.
- [ ] Điều chỉnh lại phiếu đặt hàng.

Ai có quyền quyết định và quyết định đó có ảnh hưởng đến thanh toán không?

### 5. Quy định về ảnh nhận hàng

- Ảnh bắt buộc với mọi lần nhận hay chỉ khi có thiếu/thừa/hỏng?

Hàng gì cũng phải chụp

- Mỗi phiếu nhận cần tối thiểu và tối đa bao nhiêu ảnh?

tối thiếu 1 ảnh - tối đa 10 ảnh

- Có bắt buộc chụp lại ở mỗi lần giao bù không?

Có

- Ảnh cần lưu trong bao lâu và những vai trò nào được xem?

Lưu 6-12 tháng (xem tốn không)

- Ảnh có được phép dùng URL công khai không hết hạn không? Nếu ảnh nhạy cảm, cần chuyển sang URL riêng tư có thời hạn và kiểm tra quyền mỗi lần xem.

Không

### 6. Phạm vi điều chuyển giữa các cơ sở

Ngoài Kho tổng ↔︎ Bếp tổng, có cho phép các tuyến sau không?

- [x] Chi nhánh ↔︎ Chi nhánh.
- [ ] Chi nhánh ↔︎ Kho tổng.
- [ ] Chi nhánh ↔︎ Bếp tổng.
- [x] Bếp tổng ↔︎ Chi nhánh.

Các tuyến trên có luôn phải qua Quản lý tổng duyệt không? Có ngoại lệ nào khác không?

Đều phải duyệt

“Thời gian dự kiến nhận” là một thời điểm cụ thể hay một khoảng giờ bắt đầu–kết thúc?

Thời gian bắt đầu và kết thúc

### 7. Giá, thanh toán và công nợ

- Những vai trò nào được xem đơn giá và tổng tiền?

Qly tổng và ng có quyền

- Nhà cung cấp có được xem đơn giá trên đơn của mình không?

có

- Ai được nhập đơn giá và ai được cập nhật trạng thái thanh toán?

Đại lý hoặc Qly tổng ( điền giá và lưu lại cho lần sau của nhà cung ứng đó)
Lưu ý : ADMIN Config giá đo lường ( tức 1 kg = 10k và cho phép chênh lệch không quá 10% hoặc hơn ADMIN có thể tùy chỉnh ) nếu quá số đó thì sẽ cảnh báo tới ADMIN/ người đc cấp quyền nhận thông báo. (Tránh qly hay ai đó móc nối hoặc điền sai giá mà không biết)

- Có cần tách người cập nhật và người xác nhận thanh toán không?

Có hoặc không - tùy chỉnh

- Khi thiếu, thừa, giao bù hoặc hoàn hàng thì giá trị thanh toán được tính lại như thế nào?

Nếu không giao bù trong ngày(00:00) , hóa đơn sẽ chỉnh theo số lượng đã nhận hàng

- Có cần ngày đến hạn, phương thức thanh toán, mã giao dịch và ảnh chứng từ không?

Có thể điền số ngày phải thanh toán.

### 8. Vai trò và quyền

Vui lòng xác nhận người được thực hiện từng nghiệp vụ:

| Nghiệp vụ                 | Vai trò được thực hiện   |
| ------------------------- | ------------------------ |
| Tạo phiếu xin hàng        | Bếp/Bàn/Bếp Tổng/QLY/Chủ |
| Sửa/hủy phiếu             | Qly/Chủ                  |
| Duyệt/từ chối/yêu cầu sửa | Qly/Chủ                  |
| Xuất/giao hàng            | Bếp Tổng/Đơn vị          |
| Nhận và kiểm hàng         | Kho Tổng/Bếp/Bàn/Qly/Chủ |
| Xử lý thiếu/thừa          | Qly/Chủ                  |
| Đóng phần thiếu           | Qly/Chủ                  |
| Kiểm kê                   | Bếp/Bàn/Bếp Tổng/QLY/Chủ |
| Xác nhận báo hỏng         | Bếp/Bàn/Bếp Tổng/QLY/Chủ |
| Xem giá/công nợ           | Qly/Chủ                  |
| Cập nhật thanh toán       | Qly/Chủ                  |
| Xem báo cáo               | Qly/Chủ                  |

Quản lý tổng và Chủ sẽ duyệt trên Web Admin, app Mobile hay cả hai?

App mobile - còn Web chỉ để config

### 9. Thông báo

Với từng sự kiện sau, ai cần nhận thông báo và nhận qua kênh nào: thông báo trong app, push, email hay Zalo?

Thông báo trong APP - chuông reo như điện thoại báo thức… 1 tiếng/ lần , đến khi bấm vào xem thông báo thì tắt

- Phiếu mới chờ duyệt.
- Phiếu được duyệt hoặc bị từ chối.
- Có đơn mới gửi nhà cung cấp.
- Giao thiếu, giao thừa hoặc hàng hỏng.
- Thiếu hàng chưa được bù qua ngày.
- Điều chuyển sắp đến giờ nhận.
- Kiểm kê bị lệch.
- Thanh toán sắp đến hạn hoặc quá hạn.

Có khung giờ không gửi thông báo và có cần nhắc lại không?

Từ khi vấn đề được phát sinh sẽ thông báo 1 tiếng/ lần kéo dài như báo thức đến khi bấm xem thông báo ( như trên )

## B. Các câu có thể chốt ở giai đoạn tiếp theo

### 10. Xóa hay ngừng sử dụng?

Khi người dùng chọn “xóa” cơ sở, kho, nguyên liệu hoặc nhà cung cấp:

- Chỉ ngừng sử dụng và vẫn giữ lịch sử?

Khi phát sinh (khi xóa sẽ có cánh báo - nếu cố tình sẽ xóa hết lịch sử ) quyền này chỉ có ở tài khoản ADMIN config.

- Hay cho phép xóa hẳn nếu chưa phát sinh giao dịch?

Khuyến nghị: dùng “Ngừng sử dụng” làm mặc định để không mất dữ liệu lịch sử.

Khi phát sinh (khi xóa sẽ có cánh báo và yêu cầu pass ADMIN mới có thể xóa - nếu tiếp tục vẫn sẽ xóa hết lịch sử ) quyền này chỉ có ở tài khoản ADMIN config.

### 11. Hoàn hàng

- Hoàn về Kho tổng, cơ sở khác hay nhà cung cấp?

về nơi cấp tới

- Có cho hoàn một phần không?

có

- Ai tạo, duyệt, giao và xác nhận nhận lại?

Bộ phần nhận hàng và chụp ảnh gửi hoàn hàng - còn Qly + Chủ duyệt

- Có bắt buộc ảnh/chứng từ không?

Có chụp ảnh + hóa đơn chụp cùng

- Khi nào trừ tồn bên trả, cộng tồn bên nhận và điều chỉnh thanh toán?

Khi hoàn hàng, hết ngày hôm đó sẽ tính là trả hàng, và tính lại hóa đơn, trừ đi hàng hoàn trả để tính hóa đơn số hàng nhận thực tế

### 12. Báo hỏng và hao hụt

- Báo hỏng có cần người khác duyệt/xác nhận không?

Báo hỏng sẽ phải chụp ảnh gửi lên phần báo hỏng và có thông báo cho Qly tổng + chủ ( hoặc người có quyền)

- Thời điểm nào hàng hỏng bị trừ khỏi tồn kho?

Sau khi kiểm kho (tức khi kiểm kho gặp hàng hỏng chụp ảnh báo cáo)

- Chênh lệch kiểm kê có tự điều chỉnh tồn hay phải tạo phiếu chờ duyệt?

Khi kiểm kê người báo cáo kho không biết được số lượng thiếu ( chỉ điền số liệu thực tế, nhưng người có quyền như QLY tổng/Chủ Nhận được thông báo (Kho A kho B thiếu thừa) và khi đó người có nhận đc thông báo phải điều tra nguyên nhân ( và người có quyền mới được điều chỉnh lại số liệu lệch ( ví dụ chỉ CHỦ mới sửa được hoặc thêm Qly tổng nếu cần ) (Lưu ý : mỗi sự chênh lệnh log sẽ bôi đỏ - để chủ có thể vào xem lịch sử 1 tháng HAO HỤT NHƯ NÀO !!!

- Có cho phép tồn kho âm không?

có

### 13. Kết nối iPOS

- Dữ liệu được nhận qua API, webhook hay file?

sẽ hỏi ipos

- Khách có thể cung cấp tài khoản/môi trường thử nghiệm không?

Khách nào? bên mik sẽ hỏi ipos chạy thử

- Cần xử lý hóa đơn hủy, hoàn món, combo và đổi món như thế nào?

Sẽ có lịch sử và thông báo hủy hóa đơn !!! (còn hoàn món + combo) bỏ qua

## C. Cách ghi nhận câu trả lời

Mỗi quyết định nên ghi rõ:

1. Người xác nhận.
2. Ngày xác nhận.
3. Phạm vi áp dụng.
4. Trạng thái và quyền liên quan.
5. Ảnh hưởng đến tồn kho, thanh toán và thông báo.

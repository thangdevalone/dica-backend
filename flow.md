# Flow — App quản lý kho và Web Admin cấu hình

## 1. Phạm vi    

### Trong phạm vi
- Web Admin: cấu hình tổ chức, tài khoản, phân quyền và danh mục hàng hóa.
- App quản lý kho: yêu cầu hàng, nhận/xuất hàng, điều chuyển, kiểm kê, hoàn hàng, báo hỏng, theo dõi hao hụt và thông báo theo quyền.

Bếp/Bàn, Kho tổng/Kiểm kho, Quản lý tổng và Chủ là các vai trò sử dụng hệ thống, không phải các app riêng.

### Ngoài phạm vi
- App riêng cho nhà cung ứng.
- App đặt món và đánh giá khách hàng.
- App chấm công và quy trình nhà hàng.
- Phát triển phần mềm bán hàng.

iPOS chỉ là nguồn dữ liệu phục vụ đối soát kiểm kê.

> Tài liệu tổng hợp từ sơ đồ hiện tại. Các điểm chưa được xác định được liệt kê ở cuối, không mặc định là yêu cầu đã chốt.

## 2. Web Admin — Cấu hình hệ thống

### 2.1. Cấu hình tổ chức

```text
Admin
  → Tạo/cập nhật chi nhánh và kho tổng
  → Lưu cấu hình tổ chức
```

- Admin có toàn quyền cấu hình.
- Hỗ trợ thêm, sửa, xóa chi nhánh/kho tổng.

### 2.2. Tài khoản và phân quyền

```text
Tạo/cập nhật tài khoản
  → Gán chi nhánh/cơ sở
  → Gán vai trò và quyền
  → Cấu hình nhóm hàng được phép gọi
  → Cấu hình quyền xem báo cáo/nhận thông báo
  → Lưu
```

Các quyền được đề cập:
- Gọi hàng.
- Duyệt yêu cầu.
- Sửa/xóa.
- Xem lịch sử.
- Xem báo cáo.
- Nhận thông báo.
- Xem hao hụt và báo hỏng.

Quy tắc:
- Có thể tăng/giảm quyền theo bộ phận và người dùng.
- Chủ có toàn quyền.
- Quản lý tổng có các quyền được gán.
- Nếu có bộ quyền sẵn: cấu hình đầy đủ theo bộ phận rồi điều chỉnh theo yêu cầu.
- Nếu chưa có bộ quyền: cần thống nhất danh sách và mặc định.

### 2.3. Danh mục hàng hóa và nhà cung ứng

```text
Tạo nhóm nguyên liệu/hàng hóa
  → Tạo đơn vị tính và quy đổi
  → Tạo nhà cung ứng
  → Tạo nguyên liệu/hàng hóa
  → Gán nguồn cung và quy định số lượng gọi
  → Gán phạm vi cơ sở/bộ phận được phép gọi
  → Lưu
```

Thông tin và chức năng:
- Nhóm nguyên liệu/hàng hóa.
- Đơn vị tính và quy đổi, ví dụ: thùng bia → lon.
- Nhà cung ứng: tên, số điện thoại.
- Nguyên liệu có thể dùng chung hoặc phân theo cơ sở.
- Một nguyên liệu có thể có nhiều nhà cung ứng.
- Chọn một nhà cung ứng ưu tiên hiển thị đầu.
- Chọn nhiều nguyên liệu để chuyển nhà cung ứng.
- Nguồn hàng: kho tổng hoặc trực tiếp từ nhà cung ứng.

## 3. App quản lý kho — Truy cập theo quyền

```text
Truy cập tài khoản
  → Xác định cơ sở và quyền đã được gán
  → Hiển thị chức năng và hàng hóa được phép sử dụng
  → Thực hiện nghiệp vụ
```

Ví dụ phạm vi gọi hàng:

| Vai trò | Nhóm hàng theo cấu hình |
| --- | --- |
| Bếp trưởng/phó | Thịt, rau và nhóm được cấp quyền |
| Quản lý/giám sát | Bia, nước ngọt, rượu và nhóm được cấp quyền |
| Kho tổng/kiểm kho | Gia vị và nhóm được cấp quyền |

## 4. Yêu cầu hàng và duyệt

```text
Bếp/Bàn/Kho tổng tạo phiếu yêu cầu
  → Chọn hàng trong phạm vi quyền
  → Nhập số lượng
  → Gửi Quản lý tổng duyệt
  → Sau khi duyệt, xử lý theo nguồn hàng:
      ├─ Kho tổng
      │   → Kho xuất hàng cho Bếp/Bàn tại cơ sở
      └─ Nhà cung ứng
          → Xuất phiếu dạng hóa đơn
          → Quản lý tổng gửi phiếu/ảnh cho nhà cung ứng
  → Bên nhận kiểm và xác nhận hàng
```

- Phiếu thể hiện danh sách mặt hàng và số lượng yêu cầu.
- Kho tổng cũng có thể yêu cầu hàng từ nhà cung ứng.
- Kho tổng có thể cung cấp các mặt hàng như cốt lẩu, gia vị.
- Không phát triển app riêng cho nhà cung ứng trong phạm vi này.
- Luồng từ chối hoặc yêu cầu sửa phiếu chưa được xác định.

## 5. Nhận hàng và xử lý sai lệch

```text
Người nhận nhận hàng
  → Kiểm đếm thực tế
  → Đính kèm ảnh
  → Xác nhận kết quả:
      ├─ Đủ
      │   → Tích Đủ
      │   → Hoàn thành dòng hàng
      ├─ Thiếu
      │   → Báo Quản lý tổng/người có quyền
      │   → Yêu cầu giao bù trong ngày
      │   → Giữ trạng thái Thiếu đến khi bù đủ
      │   → Qua ngày chưa đủ: tiếp tục hiển thị và thông báo
      └─ Thừa
          → Gửi báo cáo sai lệch
          → Người có quyền xử lý
```

- Người yêu cầu hàng cũng có quyền nhận/kiểm hàng theo mô tả hiện tại.
- Một đơn có thể đính kèm nhiều ảnh xác nhận.
- Quy tắc xử lý hàng thừa chưa được xác định.
- Cách kết thúc trường hợp không thể giao bù cần được thống nhất.

## 6. Nhập kho và trạng thái thanh toán

```text
Kho tổng/Cơ sở lập phiếu nhập
  → Ghi nguồn nhập và thông tin hàng hóa
  → Kiểm tra lượng hàng thực nhận
  → Ghi nhận nhập kho
  → Báo/cập nhật trạng thái thanh toán
```

Phiếu nhập gồm:
- Nguồn nhập.
- Mặt hàng.
- Đơn vị tính.
- Đơn giá.
- Số lượng.

Quy tắc:
- Thanh toán phải phù hợp với lượng hàng thực nhận.
- Bộ trạng thái thanh toán và cơ chế xử lý công nợ chưa được xác định.

## 7. Điều chuyển giữa các cơ sở

```text
Cơ sở gửi tạo yêu cầu điều chuyển
  → Qua Quản lý tổng
  → Chuyển hàng đến cơ sở nhận
  → Thông báo khoảng giờ nhận
  → Cơ sở nhận kiểm đếm
      ├─ Đủ → Xác nhận đủ
      └─ Thiếu → Báo cáo Quản lý tổng/người có quyền
```

## 8. Nhận/xuất giữa Kho tổng và Bếp tổng

```text
Kho tổng ↔ Bếp tổng
  → Ghi nhận nhận/nhập hoặc xuất hàng
  → Không cần Quản lý tổng duyệt
  → Lưu lịch sử để đối soát
  → Thông báo Quản lý tổng/Chủ/người có quyền
```

Đây là ngoại lệ so với luồng yêu cầu hàng và điều chuyển thông thường.

## 9. Kiểm kê cuối ngày

### 9.1. Kho tổng/Cơ sở

```text
Lập phiếu kiểm cuối ngày
  → Ghi số lượng thực tế từng mặt hàng
  → Đối chiếu số liệu hệ thống
      ├─ Khớp → Ghi nhận kết quả kiểm kê
      └─ Lệch
          → Báo cáo thừa/thiếu
          → Cảnh báo người có quyền
```

### 9.2. Bếp/Bàn tại chi nhánh

```text
Bếp/Bàn ghi nhận lượng hàng còn lại
  → Lấy dữ liệu bán hàng từ iPOS
  → Đối chiếu số món bán và định mức nguyên liệu
  → Tổng hợp kết quả kiểm kê/sai lệch
  → Báo cáo Quản lý tổng/người có quyền
```

- iPOS là nguồn dữ liệu đối soát.
- Không phát triển giao diện bán hàng trong phạm vi này.
- Phương thức tích hợp iPOS cần được thống nhất.
- Nguồn và cách quản lý định mức nguyên liệu cần được thống nhất.

## 10. Hoàn hàng, hao hụt và báo hỏng

| Nghiệp vụ | Nội dung đã được đề cập |
| --- | --- |
| Hoàn hàng | Có chức năng hoàn hàng trên app; luồng chi tiết chưa mô tả |
| Hao hụt | Quản lý tổng/quyền cao hơn hoặc người được Admin cấp quyền có thể xem |
| Báo hỏng | Bếp/Bàn gửi báo cáo lên hệ thống; người có quyền được xem |

Chưa mặc định thêm bước duyệt hoặc bộ trạng thái cho các nghiệp vụ này.

## 11. Lưu dữ liệu, lịch sử và thông báo

```text
Thao tác nghiệp vụ
  → Lưu dữ liệu về Server/Cloud DB
  → Ghi ngày giờ thao tác và lịch sử
  → Phục vụ theo dõi nhập/xuất/tồn và đối soát
  → Gửi thông báo đến người được gán quyền phù hợp
```

- Lưu dữ liệu lâu dài để tra cứu lịch sử.
- Sai lệch nhận hàng và kiểm kê cần báo đến người có quyền.
- Kho tổng ↔ Bếp tổng vẫn lưu lịch sử và thông báo dù không cần duyệt.
- Dữ liệu thực nhận phải nhất quán với dữ liệu thanh toán.

## 12. Các điểm cần chốt trước triển khai

1. Danh sách quyền và quyền mặc định theo vai trò/bộ phận.
2. Luồng từ chối, yêu cầu sửa, hủy và sửa phiếu sau khi duyệt.
3. Cách xử lý hàng thừa, hoàn hàng và thiếu hàng không thể giao bù.
4. Bộ trạng thái thanh toán và người có quyền cập nhật.
5. Quy tắc đối soát thanh toán với lượng thực nhận.
6. Luồng chi tiết và quyền thao tác cho hao hụt/báo hỏng.
7. Phương thức tích hợp iPOS.
8. Cách quản lý định mức nguyên liệu.
9. Nội dung và kênh thông báo cho từng nghiệp vụ.

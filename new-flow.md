# FLOW NGHIỆP VỤ — APP KHO / NHÀ CUNG CẤP VÀ WEB ADMIN

## 1. Phạm vi và căn cứ

### 1.1. Hai giao diện

1. App nghiệp vụ chung:
   - Bộ phận Bếp/Bàn tại cơ sở.
   - Kho tổng/Kiểm kho.
   - Bộ phận Bếp tổng có liên quan đến nhận/xuất.
   - Quản lý tổng.
   - Chủ/người có quyền cao hơn.
   - Nhà cung cấp.

   Các nhóm dùng chung một app, nhưng chức năng và dữ liệu được
   hiển thị theo tài khoản, cơ sở và quyền.

2. Web Admin cấu hình:
   - Tổ chức, chi nhánh, kho.
   - Tài khoản và phân quyền.
   - Danh mục nguyên liệu/hàng hóa.
   - Đơn vị tính và quy đổi.
   - Nhà cung cấp và nguồn hàng.

### 1.2. Căn cứ

- Nghiệp vụ kho, duyệt, nhận hàng, kiểm kê và thông báo:
  theo sơ đồ hiện tại.
- Kho và nhà cung cấp dùng chung một app:
  theo xác nhận mới của người dùng, thay cho cách tách app trong sơ đồ.
- Các bước chưa có trong sơ đồ phải được ghi là đề xuất/cần chốt.

### 1.3. Ngoài phạm vi

- App đặt món/đánh giá khách hàng.
- App chấm công/quy trình nhà hàng.
- Phát triển phần mềm bán hàng.

iPOS chỉ được dùng làm nguồn dữ liệu đối soát kiểm kê.

## 2. Vai trò và trách nhiệm

| Role | Giao diện | Trách nhiệm | Giới hạn/quyền |
| --- | --- | --- | --- |
| Admin | Web Admin | Cấu hình tổ chức, tài khoản, quyền và danh mục | Toàn quyền cấu hình theo sơ đồ |
| Chủ | App chung | Có toàn quyền theo mô tả; xem báo cáo/lịch sử và nhận thông báo | Phạm vi toàn hệ thống; cách thể hiện cụ thể cần cấu hình |
| Quản lý tổng | App chung | Duyệt yêu cầu, gọi hàng khi có quyền, theo dõi lịch sử, nhận báo cáo và xử lý sai lệch | Theo quyền được gán; không đồng nghĩa mặc định có mọi quyền cấu hình |
| Bếp trưởng/phó | App chung | Gọi nguyên liệu được phép, nhận/kiểm hàng, kiểm kê cuối ngày, báo hỏng | Theo cơ sở và nhóm hàng được cấp, ví dụ thịt/rau |
| Bộ phận Bàn / Quản lý, giám sát cơ sở | App chung | Gọi nhóm hàng được phép, nhận/kiểm hàng, kiểm kê và báo hỏng | Theo cơ sở và nhóm hàng được cấp, ví dụ bia/nước ngọt/rượu |
| Kho tổng/Kiểm kho | App chung | Gọi hàng, nhập kho, xuất cho cơ sở, kiểm kê; nhận/xuất với Bếp tổng | Theo quyền và danh mục được cấp |
| Bếp tổng | App chung, chức năng theo quyền cần chốt | Là đầu nhận/giao hàng với Kho tổng | Sơ đồ xác định nghiệp vụ, chưa xác định đầy đủ quyền thao tác của tài khoản Bếp tổng |
| Nhà cung cấp | App chung | Cung cấp/giao hàng theo yêu cầu đã được duyệt; giao bù khi thiếu | Chi tiết quyền và thao tác trong app chưa được sơ đồ xác định |
| Người được cấp quyền bổ sung | Giao diện tương ứng | Xem báo cáo, nhận thông báo hoặc thực hiện nghiệp vụ được gán | Không mặc định có toàn quyền |

### Nguyên tắc phân quyền

- Role là nhóm trách nhiệm; quyền cụ thể có thể tăng/giảm.
- Tài khoản gắn với cơ sở và phạm vi hàng hóa.
- Người có quyền gọi hàng chỉ thấy nhóm hàng được phép gọi.
- Người yêu cầu hàng có quyền nhận/kiểm hàng theo mô tả hiện tại.
- Quyền xem báo cáo và quyền nhận thông báo được cấu hình.
- Quyền sửa/xóa cần xác định theo loại dữ liệu và trạng thái phiếu.
- Nếu có bộ quyền sẵn: cấu hình theo bộ phận rồi điều chỉnh.
- Nếu chưa có: cần thống nhất bộ quyền trước triển khai.

## 3. Web Admin — Luồng cấu hình

### 3.1. Tổ chức và tài khoản

Người thực hiện: Admin.

```text
Admin tạo/cập nhật chi nhánh và kho tổng
  → Tạo/cập nhật tài khoản
  → Gán cơ sở/phạm vi hoạt động
  → Gán role và quyền
  → Gán nhóm hàng được phép gọi
  → Gán quyền xem báo cáo/nhận thông báo
  → Lưu cấu hình
```

Kết quả:
- App hiển thị nghiệp vụ và dữ liệu theo cấu hình.
- Admin có thể thêm/sửa/xóa chi nhánh và kho tổng.

Với tài khoản nhà cung cấp:
- Cần cấu hình liên kết tài khoản với nhà cung cấp tương ứng.
- Đây là chi tiết bổ sung để triển khai app chung, cần chốt.
- Đề xuất chỉ cho nhà cung cấp xem đơn/dữ liệu liên quan đến mình;
  không cho xem tồn kho hoặc đơn của nhà cung cấp khác.

### 3.2. Danh mục và nguồn cung

Người thực hiện: Admin.

```text
Tạo nhóm nguyên liệu/hàng hóa
  → Tạo đơn vị tính và quy đổi
  → Tạo nhà cung cấp
  → Tạo nguyên liệu/hàng hóa
  → Gán nhà cung cấp và quy định số lượng gọi
  → Chọn nhà cung cấp ưu tiên
  → Gán phạm vi cơ sở/bộ phận
  → Lưu
```

Yêu cầu:
- Đơn vị quy đổi phục vụ nhập và kiểm kê, ví dụ thùng bia → lon.
- Nhà cung cấp có tên và số điện thoại.
- Nguyên liệu có thể dùng chung hoặc phân theo cơ sở.
- Một nguyên liệu có thể có nhiều nhà cung cấp.
- Có chức năng chọn nhiều nguyên liệu để chuyển nhà cung cấp.
- Nguồn hàng có thể là Kho tổng hoặc nhà cung cấp trực tiếp.

## 4. App chung — Truy cập theo role

Người thực hiện: tất cả tài khoản app.

```text
Người dùng truy cập tài khoản
  → Hệ thống xác định role, quyền và phạm vi
  → Hiển thị chức năng/dữ liệu phù hợp
  → Người dùng thực hiện nghiệp vụ được phép
```

Không dùng việc “chung app” để cấp chung quyền hoặc chung dữ liệu.

## 5. Luồng yêu cầu hàng từ cơ sở

### Trách nhiệm

- Người tạo: Bếp/Bàn hoặc người được cấp quyền gọi hàng.
- Người duyệt: Quản lý tổng hoặc tài khoản được cấp quyền duyệt.
- Bên giao: Kho tổng hoặc nhà cung cấp.
- Người nhận: người yêu cầu/người có quyền nhận tại cơ sở.
- Người nhận báo cáo sai lệch: Quản lý tổng và người được cấp quyền.

### Luồng

```text
Bếp/Bàn chọn hàng trong phạm vi quyền
  → Nhập số lượng
  → Tạo và gửi phiếu yêu cầu
  → Quản lý tổng xem và duyệt
  → Thực hiện theo nguồn hàng:
      ├─ Kho tổng → Kho xuất/giao cho cơ sở
      └─ Nhà cung cấp → Gửi phiếu đã duyệt cho nhà cung cấp
  → Cơ sở nhận, kiểm đếm và chụp ảnh
  → Xác nhận đủ/thiếu/thừa
```

- Phiếu thể hiện mặt hàng và số lượng.
- Kho tổng có thể cung cấp cốt lẩu, gia vị và hàng được cấu hình.
- Luồng từ chối, yêu cầu sửa hoặc hủy chưa được sơ đồ mô tả.

## 6. Luồng làm việc với nhà cung cấp

### 6.1. Nhà cung cấp dùng app chung

Trách nhiệm theo nghiệp vụ:
- Quản lý tổng: duyệt và chuyển yêu cầu cho nhà cung cấp.
- Nhà cung cấp: cung cấp/giao hàng, giao bù khi thiếu.
- Bên nhận: xác nhận lượng thực nhận.
- Quản lý tổng: theo dõi sai lệch và đôn đốc giao bù.

Luồng triển khai đề xuất, cần chốt:

```text
Quản lý tổng duyệt phiếu
  → Hệ thống đưa phiếu đến tài khoản nhà cung cấp liên quan
  → Nhà cung cấp xem yêu cầu
  → Nhà cung cấp giao hàng
  → Bên nhận kiểm và xác nhận thực nhận
  → Nếu thiếu: báo Quản lý tổng và yêu cầu nhà cung cấp giao bù
```

Chưa coi các thao tác sau là yêu cầu đã chốt:
- Nhà cung cấp bấm nhận/từ chối đơn.
- Cập nhật đang chuẩn bị/đang giao.
- Nhập số lượng giao hoặc đính kèm chứng từ.
- Nhận thông báo thiếu trực tiếp trên app.
- Xem/cập nhật thông tin thanh toán.

Sơ đồ mới xác định có app cho nhà cung cấp, chưa mô tả các bước này.

### 6.2. Nhà cung cấp không dùng app

```text
Quản lý tổng duyệt
  → Xuất phiếu dạng hóa đơn
  → Quản lý tổng gửi phiếu/ảnh cho nhà cung cấp
  → Nhà cung cấp giao hàng
  → Bên nhận xác nhận thực nhận trên app
```

Đây là phương án dự phòng đã được sơ đồ đề cập.

## 7. Kho tổng đặt hàng từ nhà cung cấp

- Người tạo: Kho tổng/Kiểm kho có quyền gọi hàng.
- Người duyệt: Quản lý tổng/người có quyền duyệt.
- Bên giao: nhà cung cấp.
- Bên nhận: Kho tổng/người có quyền nhận.

```text
Kho tổng tạo yêu cầu hàng
  → Gửi Quản lý tổng duyệt
  → Chuyển phiếu cho nhà cung cấp
  → Nhà cung cấp giao
  → Kho tổng kiểm đếm, chụp ảnh và xác nhận
  → Ghi nhận phiếu nhập/thực nhận
```

Áp dụng quy tắc đủ/thiếu/thừa như khi cơ sở nhận hàng.

## 8. Nhận hàng và xử lý đủ/thiếu/thừa

### Trách nhiệm

- Người nhận: kiểm đếm thực tế, chụp ảnh, xác nhận kết quả.
- Quản lý tổng: nhận báo cáo, đôn đốc bên cung cấp xử lý.
- Nhà cung cấp: giao bù phần thiếu theo yêu cầu.
- Người có quyền: nhận thông báo và xem báo cáo.
- Hệ thống: lưu lịch sử và giữ hiển thị trường hợp thiếu chưa xử lý.

### Luồng

```text
Người nhận kiểm hàng
  → Đính kèm một hoặc nhiều ảnh
  → Xác nhận kết quả:
      ├─ Đủ
      │   → Tích Đủ
      │   → Hoàn thành dòng hàng
      ├─ Thiếu
      │   → Ghi nhận thiếu
      │   → Báo Quản lý tổng/người có quyền
      │   → Quản lý tổng đôn đốc nhà cung cấp giao bù trong ngày
      │   → Giữ trạng thái Thiếu đến khi bù đủ
      │   → Qua ngày chưa đủ: tiếp tục hiển thị và thông báo
      └─ Thừa
          → Ghi nhận thừa
          → Báo Quản lý tổng/người có quyền xử lý
```

Chưa xác định:
- Cách xử lý hàng thừa: giữ, trả hay điều chỉnh phiếu.
- Cách đóng trường hợp không thể giao bù.
- Cách ghi nhận giao bù nhiều lần.

## 9. Nhập kho và thanh toán

- Người thực hiện nhập: Kho tổng/Cơ sở có quyền nhập.
- Người cập nhật thanh toán: chưa được sơ đồ chỉ rõ.
- Người xem: theo quyền được gán.

```text
Người có quyền lập phiếu nhập
  → Ghi nguồn nhập, mặt hàng, đơn vị tính, đơn giá, số lượng
  → Đối chiếu lượng thực nhận
  → Ghi nhận nhập kho
  → Báo/cập nhật trạng thái thanh toán theo quyền
```

Nguyên tắc bắt buộc:
- Dữ liệu thanh toán phải phù hợp với lượng thực nhận.
- Không mặc định lượng yêu cầu là lượng đã nhận.
- Không đồng nghĩa xác nhận đủ hàng với đã thanh toán.

Cần chốt:
- Ai được cập nhật trạng thái thanh toán.
- Ai được xem giá/tiền.
- Bộ trạng thái và xử lý công nợ.
- Điều chỉnh thanh toán khi thiếu/thừa/hoàn hàng.

## 10. Điều chuyển giữa các cơ sở

- Người tạo: người có quyền tại cơ sở gửi.
- Người duyệt: Quản lý tổng/người có quyền duyệt.
- Người giao: bộ phận phụ trách tại cơ sở gửi.
- Người nhận: người có quyền tại cơ sở nhận.
- Người nhận sai lệch: Quản lý tổng/người có quyền.

```text
Cơ sở gửi tạo yêu cầu điều chuyển
  → Quản lý tổng xử lý/duyệt
  → Cơ sở gửi chuyển hàng
  → Thông báo khoảng giờ nhận
  → Cơ sở nhận kiểm đếm
      ├─ Đủ → Xác nhận đủ
      └─ Thiếu → Báo cáo Quản lý tổng/người có quyền
```

Sơ đồ yêu cầu luồng này đi qua Quản lý tổng.
Chi tiết quyền tạo/giao và xử lý sai lệch cần chốt.

## 11. Kho tổng ↔ Bếp tổng — Ngoại lệ không cần duyệt

- Người ghi nhận: Kho tổng/Kiểm kho có quyền nhận/xuất.
- Bên giao/nhận: Kho tổng và Bếp tổng tùy chiều.
- Người được thông báo: Quản lý tổng, Chủ hoặc người được cấp quyền.
- Không yêu cầu Quản lý tổng duyệt.

```text
Kho tổng xuất cho Bếp tổng
hoặc Kho tổng nhận hàng từ Bếp tổng
  → Ghi nhận nghiệp vụ
  → Lưu lịch sử
  → Thông báo người có quyền
  → Đối soát khi cần
```

Sơ đồ xác định thao tác nhận/xuất trong app Kho tổng.
Chưa xác định Bếp tổng có phải xác nhận đối ứng trên app hay không.

## 12. Kiểm kê cuối ngày

### 12.1. Kho tổng/Cơ sở

- Người kiểm: người có quyền kiểm kho.
- Người nhận báo cáo: Quản lý tổng/người có quyền.

```text
Người kiểm lập phiếu kiểm
  → Ghi số lượng thực tế từng mặt hàng
  → Hệ thống đối chiếu số liệu
      ├─ Khớp → Ghi nhận kết quả
      └─ Lệch → Báo cáo thừa/thiếu → Cảnh báo người có quyền
```

### 12.2. Bếp/Bàn tại chi nhánh

- Người nhập tồn thực tế: Bếp/Bàn.
- Hệ thống: đối chiếu dữ liệu iPOS và định mức nguyên liệu.
- Người xem kết quả: Quản lý tổng/người có quyền.

```text
Bếp/Bàn báo số lượng còn lại cuối ngày
  → Hệ thống lấy dữ liệu bán hàng iPOS
  → Đối chiếu số món và định mức nguyên liệu
  → Tổng hợp tồn/sai lệch
  → Gửi kết quả cho Quản lý tổng/người có quyền
```

Cần chốt:
- Cách tích hợp iPOS.
- Nguồn định mức và người được cấu hình định mức.
- Cách xử lý khi thiếu dữ liệu đối soát.

## 13. Hoàn hàng, hao hụt, báo hỏng

| Nghiệp vụ | Ai thực hiện | Ai xem/nhận báo cáo | Mức độ xác định |
| --- | --- | --- | --- |
| Hoàn hàng | Có trên app người dùng; role cụ thể cần chốt | Cần chốt | Chưa có luồng chi tiết |
| Hao hụt | Người ghi nhận/tính hao hụt chưa được chỉ rõ | Quản lý tổng, quyền cao hơn hoặc người được Admin cấp quyền | Đã xác định quyền xem |
| Báo hỏng | Bếp/Bàn gửi báo cáo | Người có quyền xem/nhận thông báo | Đã xác định bên báo và bên xem |

Không tự mặc định:
- Báo hỏng phải qua duyệt.
- Báo hỏng tự trừ tồn.
- Hoàn hàng tự điều chỉnh thanh toán.
- Mọi người đều được xem hao hụt.

Các quy tắc này cần được thống nhất.

## 14. Lịch sử và thông báo

Trách nhiệm của hệ thống:
- Lưu dữ liệu nghiệp vụ về Server/Cloud DB.
- Lưu lịch sử phục vụ đối soát lâu dài.
- Ghi ngày giờ thao tác.
- Theo dõi nhập/xuất/tồn.
- Gửi thông báo theo quyền.

```text
Người dùng thực hiện nghiệp vụ
  → Hệ thống lưu dữ liệu và lịch sử
  → Xác định người được cấp quyền nhận thông báo
  → Gửi thông báo liên quan
```

Nguyên tắc:
- Có quyền xem không mặc định có quyền sửa hoặc duyệt.
- Nhận thông báo không mặc định có quyền xử lý.
- Kho tổng ↔ Bếp tổng vẫn lưu lịch sử và thông báo dù miễn duyệt.
- Trường hợp thiếu hàng chưa được bù tiếp tục hiển thị và báo lại.
- Kênh, thời điểm và tần suất thông báo cần chốt.

## 15. Tóm tắt trách nhiệm xuyên suốt

```text
ADMIN
  → Cấu hình cơ sở, tài khoản, quyền và danh mục

BẾP/BÀN/KHO TỔNG CÓ QUYỀN
  → Tạo yêu cầu hàng

QUẢN LÝ TỔNG/NGƯỜI CÓ QUYỀN DUYỆT
  → Duyệt và chuyển yêu cầu đến nguồn cung

KHO TỔNG hoặc NHÀ CUNG CẤP
  → Giao hàng

NGƯỜI NHẬN TẠI CƠ SỞ/KHO
  → Kiểm hàng, chụp ảnh, báo đủ/thiếu/thừa

QUẢN LÝ TỔNG
  → Theo dõi sai lệch, đôn đốc giao bù

NGƯỜI CÓ QUYỀN KIỂM KÊ
  → Báo tồn thực tế cuối ngày

HỆ THỐNG
  → Lưu lịch sử, đối soát và gửi thông báo

CHỦ/NGƯỜI ĐƯỢC CẤP QUYỀN
  → Xem báo cáo, lịch sử và thông báo theo phạm vi
```

Ngoại lệ:
- Nhận/xuất Kho tổng ↔ Bếp tổng không cần duyệt.

## 16. Các điểm phải chốt để hoàn thiện đặc tả

1. Bộ quyền cụ thể theo role, cơ sở và loại dữ liệu.
2. Quyền và thao tác của nhà cung cấp trong app chung.
3. Quyền thao tác/xác nhận của Bếp tổng.
4. Luồng từ chối, sửa, hủy và sửa phiếu sau duyệt.
5. Cách xử lý thừa, thiếu không giao bù và giao bù nhiều lần.
6. Luồng hoàn hàng và ảnh hưởng đến tồn/thanh toán.
7. Ai cập nhật thanh toán, ai xem đơn giá/công nợ.
8. Cách ghi nhận hao hụt và xử lý báo hỏng.
9. Cách tích hợp iPOS và cấu hình định mức.
10. Kênh và quy tắc gửi thông báo.

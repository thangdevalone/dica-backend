# Flow chuẩn — Mobile DICA, Admin Web và Backend

Tài liệu này là bản review cuối từ `Untitled.fig`, code backend và `dica-web`. Nếu sơ đồ Figma và code khác nhau, phần “đã triển khai/chưa triển khai” dưới đây là trạng thái thực tế để dev không tích hợp nhầm.

## 1. Phạm vi và phân chia client

### Mobile DICA

- Nhân sự Bếp/Bàn/Kho: xin hàng, xuất/nhận hàng, điều chuyển, kiểm kê, báo hỏng, xem tồn và thông báo theo permission/scope.
- Nhà cung ứng có thể đăng nhập **cùng Mobile DICA** và chỉ xem đơn đã phát hành của chính mình. Không có app NCC riêng và NCC không xác nhận giao/nhận trên app.

### Admin Web

- Cấu hình tổ chức, tài khoản, role grant, cơ sở/kho/bộ phận, danh mục, eligibility và nguồn cấp.
- Duyệt/từ chối yêu cầu, duyệt điều chuyển, xử lý ngoại lệ giao nhận, đối soát payment, iPOS/định mức, báo cáo và audit.
- Web hiện cũng hỗ trợ một số thao tác vận hành để dùng dự phòng: tạo yêu cầu, điều chuyển, xuất/nhận và báo hỏng.

### Làm sau/chưa phát hành API

- Upload ảnh minh chứng (chưa chốt storage, loại/cỡ file).
- Hoàn/trả hàng cho NCC như một chứng từ riêng.
- An toàn, lưu mẫu, truy xuất lô, app khách hàng/đánh giá, chấm công.
- Kết nối trực tiếp API iPOS production; hiện chỉ có adapter import thủ công.

## 2. Cấu hình nền trên Admin Web

```text
Tổ chức
  → Tạo cơ sở: Kho tổng / Bếp tổng / Chi nhánh
  → Tạo điểm lưu kho vật lý hoặc đang vận chuyển
  → Tạo bộ phận Bếp / Bàn / Kho và gắn kho nhận
  → Tạo tài khoản
  → Cấp role + scope cơ sở/kho/bộ phận
  → Tạo danh mục, đơn vị, quy đổi và nhà cung ứng
  → Cấu hình nguyên liệu bộ phận được xin (eligibility)
  → Cấu hình nguồn theo cơ sở + nguyên liệu (Kho hoặc NCC)
```

Quy tắc hiện tại:

- Dữ liệu được ngừng hoạt động bằng `active=false`; không xóa cứng cơ sở/danh mục đã có lịch sử.
- Một user có thể có nhiều role grant ở nhiều scope. Không hardcode chức năng theo tên vai trò trên client; dùng `GET /me/permissions`.
- Eligibility hiện cấu hình theo từng **nguyên liệu + cơ sở + bộ phận**, chưa cấu hình theo nhóm hàng, role hoặc số lượng tối đa mỗi lần xin.
- Một nguyên liệu có thể liên kết nhiều NCC. Source rule đang hiệu lực chọn đúng một nguồn cho mỗi cơ sở + nguyên liệu; bulk update dùng để đổi hàng loạt.
- Chi nhánh, kho và bộ phận Bếp/Bàn đang được tạo độc lập để giữ tính linh hoạt; seed demo tạo sẵn cấu trúc chuẩn.

## 3. Xin hàng và duyệt

```text
Mobile/Web lấy item-eligibility
  → Tạo yêu cầu DRAFT
  → Sửa hoặc hủy khi còn hợp lệ
  → SUBMIT: backend snapshot đơn vị + nguồn cấp
  → Admin Web:
      ├─ APPROVE → backend tách đơn theo Kho/NCC
      └─ REJECT → người tạo REVISE và gửi lại
```

Trạng thái yêu cầu:

```text
DRAFT → SUBMITTED → APPROVED
                  └→ REJECTED → DRAFT (revise)
DRAFT/SUBMITTED/REJECTED → CANCELLED khi chưa có phát sinh không thể đảo
```

Quy tắc:

- Client không gửi/chọn nguồn trong dòng yêu cầu. Backend lấy source rule và kiểm tra lại khi submit/approve.
- Một yêu cầu có thể sinh nhiều đơn con theo kho/NCC nhưng vẫn giữ lineage về request line.
- Nếu cấu hình nguồn thay đổi sau submit, backend trả conflict; không âm thầm đổi nguồn đã snapshot.
- Đơn NCC chỉ xuất hiện cho đúng NCC sau khi phát hành. Chưa có API export file đơn do mẫu export chưa được chốt; người quản lý gửi file/ảnh ngoài hệ thống nếu NCC không dùng Mobile DICA.

## 4. Đơn thực hiện, xuất và nhận hàng

```text
Đơn RELEASED
  → Nếu nguồn Kho: tạo Dispatch DRAFT → POST
  → Tạo Receipt DRAFT theo lượng kiểm thực tế → POST
  → Backend đối chiếu tích lũy:
      ├─ Đủ → COMPLETED
      ├─ Thiếu → PARTIAL + discrepancy OPEN → nhận bù lần sau
      └─ Thừa → PENDING_EXCESS_REVIEW + discrepancy OPEN
```

Quy tắc:

- Receipt dùng lượng **thực tế được chấp nhận**, không tự lấy lượng đặt.
- Mỗi lần nhận là một chứng từ riêng; thiếu hàng có thể kéo dài qua ngày và không ghi đè lịch sử.
- Admin Web có thể resolve discrepancy hoặc `close-outstanding` với lý do khi phần còn lại không thể giao.
- Phần thừa chưa tự cộng tồn trước khi được xử lý theo policy.
- Hàng hỏng bị từ chối ngay lúc nhận hiện nhập theo lượng chấp nhận thực tế và ghi chú; phần không nhận biểu hiện là thiếu. Chưa có field receipt `DAMAGED` hoặc chứng từ trả NCC riêng.
- Dispatch/receipt post bắt buộc `Idempotency-Key` để retry không ghi ledger hai lần.

## 5. Điều chuyển

```text
Tạo Transfer DRAFT
  → SUBMIT
  → Backend kiểm tra cặp cơ sở:
      ├─ Kho tổng ↔ Bếp tổng
      │    → AUTO_APPROVED (NO_MANAGER_APPROVAL)
      └─ Tuyến còn lại được phép
           → SUBMITTED → Admin Web APPROVE/REJECT
  → Sinh Order
  → Dispatch POST
  → Hàng đang vận chuyển
  → Receipt POST
```

Client không được truyền `skip_approval`. Luồng tự duyệt vẫn ghi approval event, audit, notification và kiểm tra scope/tồn như bình thường. Figma có “khoảng giờ nhận” nhưng model hiện chưa có trường ETA riêng; có thể dùng `note` cho tới khi chốt schema ETA.

## 6. Kiểm kê, iPOS và hao hụt

```text
Mobile lập Stocktake DRAFT
  → Ghi số thực tế + cutoff
  → SUBMIT
  → Web import sales iPOS thủ công
  → Validate / Preview / Commit
  → Ánh xạ món + định mức theo phiên bản
  → Recalculate variance
  → Web xem báo cáo/cảnh báo
```

- Kiểm kê không tự sửa tồn. Điều chỉnh tồn là chứng từ riêng có bước duyệt và post.
- iPOS chỉ phục vụ đối soát; không phát triển giao diện bán hàng.
- Backend đã có mapping món và recipe version. Adapter gọi API iPOS thật vẫn chờ tài liệu đối tác.

## 7. Báo hỏng

```text
Mobile/Web tạo DamageReport DRAFT
  → Có thể sửa khi còn DRAFT
  → SUBMITTED
  → Người có quyền trên Web CONFIRM
  → Ghi giảm tồn và ledger
```

Không cho Web xác nhận trực tiếp từ `DRAFT`. Ảnh minh chứng chưa upload được cho tới khi attachment contract được chốt.

## 8. Nhập kho và thanh toán

- Nhập hàng được biểu diễn bằng order + receipt; không tạo một “phiếu nhập tự do” bỏ qua nguồn/order.
- Đơn giá tham chiếu lấy từ liên kết NCC-nguyên liệu và được snapshot vào dòng đơn khi tạo.
- Payment tracking thuộc Admin Web, có `UNPAID`, `PARTIAL`, `PAID`; số đã thanh toán được kiểm tra với giá trị đơn thực nhận.
- Công nợ nâng cao, hạn nợ, hạn mức tín dụng và thanh toán online không thuộc scope hiện tại.

## 9. Thông báo, lịch sử và bảo mật

- Mọi dữ liệu nghiệp vụ lưu PostgreSQL; thao tác quan trọng có audit và outbox event.
- Notification luôn theo recipient và kiểm tra lại quyền resource khi đọc.
- Mobile/Web poll notification hiện tại; push native chưa có provider contract.
- Backend lấy organization, actor và supplier identity từ session; mọi ID client gửi đều được kiểm tra scope.
- Quantity/price truyền bằng chuỗi thập phân; command có version dùng `expected_version`.

## 10. Ma trận API theo client

| Nhóm                                          | Mobile        | Admin Web               | Ghi chú                          |
| --------------------------------------------- | ------------- | ----------------------- | -------------------------------- |
| Auth, hồ sơ, quyền, thông báo                 | Có            | Có                      | Dùng chung                       |
| Cơ sở/kho/bộ phận/danh mục đọc                | Có            | Có                      | Mobile dùng để tra cứu           |
| Cấu hình tổ chức, user, role, danh mục, nguồn | Không         | Có                      | Web-only                         |
| Tạo/sửa/gửi yêu cầu                           | Có            | Có                      | Web là thao tác dự phòng         |
| Duyệt/từ chối yêu cầu                         | Không         | Có                      | Web-only                         |
| Xem order, xuất/nhận hàng                     | Có theo quyền | Có                      | Dùng chung                       |
| Resolve discrepancy/đóng thiếu                | Không         | Có                      | Web-only                         |
| Điều chuyển tạo/sửa/gửi                       | Có            | Có                      | Dùng chung                       |
| Duyệt/từ chối điều chuyển                     | Không         | Có                      | Web-only; cặp trung tâm tự duyệt |
| Kiểm kê tạo/sửa/gửi                           | Có            | Web chỉ giám sát/mở lại | Mobile-first                     |
| Báo hỏng                                      | Có            | Có                      | Xác nhận cuối trên Web           |
| iPOS, variance, payment, report, audit        | Không         | Có                      | Web-only                         |
| NCC xem đơn của mình                          | Có, read-only | Không cần               | Cùng Mobile DICA                 |

Swagger đánh dấu từng endpoint bằng `[MOBILE]`, `[ADMIN WEB]`, `[MOBILE + ADMIN WEB]`, `[SYSTEM]` và extension `x-dica-audience`.

## 11. Điểm còn OPEN

| Điểm                                      | Trạng thái hiện tại                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| Ảnh minh chứng                            | Chưa có attachment API; cần chốt storage, MIME, dung lượng, số ảnh       |
| Hoàn/trả NCC và hàng hỏng lúc nhận        | Chưa có chứng từ riêng; cần chốt ảnh hưởng tồn/payment                   |
| Hàng thừa, close thiếu, xác nhận báo hỏng | Code có policy demo; production trả `POLICY_NOT_CONFIGURED` khi chưa bật |
| ETA điều chuyển                           | Chưa có field riêng                                                      |
| Export đơn                                | Chưa phát hành vì chưa chốt mẫu/định dạng                                |
| iPOS production                           | Chỉ có import adapter; cần API/file và mapping thật                      |
| Push notification                         | Chưa chốt FCM/APNs/provider và template                                  |

Chi tiết tích hợp Mobile xem [docs/mobile-integration.md](docs/mobile-integration.md); flow và quyết định kỹ thuật xem [docs/figma-api-flow.md](docs/figma-api-flow.md) và [docs/decisions.md](docs/decisions.md).

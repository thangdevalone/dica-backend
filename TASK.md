# DICA — Kết quả review và backlog theo `new-flow.md`

Review cập nhật ngày 2026-10-08. `new-flow.md` là nguồn nghiệp vụ chính; file này chỉ ghi phần chưa có, đang khác flow hoặc phải hỏi khách trước khi chốt. Không tự coi policy demo hay dữ liệu seed là quyết định của khách.

## 1. Kết luận review

### Đã khớp phần lõi

- Có Web Admin cho tổ chức, tài khoản/RBAC, danh mục, nguồn cung và lịch sử cấu hình.
- Có flow yêu cầu hàng `DRAFT → SUBMITTED → APPROVED/REJECTED`, tách đơn theo nguồn kho/NCC và giữ snapshot nguồn/quy đổi.
- Có xuất/nhận nhiều lần, ghi lượng thực nhận, tạo case thiếu/thừa/hỏng, stock ledger, tồn kho và audit/idempotency.
- Có điều chuyển giữa hai cơ sở khác nhau; Kho tổng ↔ Bếp tổng tự duyệt với policy `NO_MANAGER_APPROVAL`, các tuyến khác qua duyệt, có ETA, lịch sử và thông báo.
- Có kiểm kê cuối ngày, cảnh báo khi kiểm kê lệch, mapping/định mức/import bán hàng và tính variance ở mức contract/import thủ công.
- Có báo hỏng, payment tracking cơ bản, notification trong DB và FCM Android/iOS.
- Ảnh receipt/báo hỏng dùng R2 public read; client upload bằng presigned PUT và xem bằng public asset URL cố định.
- Có grant quyền yêu cầu theo nhóm hàng cho `facility + department`, tự áp dụng cho nguyên liệu mới trong nhóm và cho phép cấu hình từng nguyên liệu ghi đè.
- Có một nhà cung cấp ưu tiên đang hoạt động cho mỗi nguyên liệu; nguồn thực tế từng cơ sở vẫn do source rule quyết định.
- Backend và contract tích hợp cho phép nhà cung cấp dùng chung DICA Mobile, chỉ xem đơn của chính mình và nhận thông báo đơn mới.
- Phiếu nhận bắt buộc có ít nhất một ảnh `READY` trước khi ghi sổ.

### Chưa khớp hoặc chưa đủ để coi là hoàn thành

- Chưa có nghiệp vụ hoàn hàng.
- Chưa có `DELETE`; tổ chức/danh mục đang dùng `active=false`. Cần xác nhận “xóa” trong flow có nghĩa là ngừng sử dụng hay xóa cứng.
- Các policy thiếu/thừa, đóng phần thiếu, báo hỏng, điều chỉnh tồn và payment chưa được khách duyệt; một số action production đang bị chặn bằng `DEMO_POLICY_ENABLED`.
- Chưa có nhắc thiếu hàng qua ngày, cảnh báo tồn/hao hụt tự động và kết nối iPOS thật.
- Chưa có ma trận đầy đủ cho người nhận, nội dung và kênh thông báo của từng sự kiện.
- Không có source code Mobile trong workspace nên review này chỉ xác nhận API, Swagger và tài liệu tích hợp; chưa xác nhận UI/hành vi app thực tế.

## 2. P0 — Câu hỏi phải chốt với khách

### FLOW-01 — Vai trò, quyền mặc định và nhóm hàng

**Hiện tại:** Có role mẫu Owner, Quản lý tổng, Quản lý/Nhân viên chi nhánh, Nhân viên kho và grant theo organization/facility/stock location/department/own. Eligibility hỗ trợ cấp theo nhóm tại `facility + department`, tự áp dụng cho mặt hàng mới và cho phép cấu hình từng nguyên liệu ghi đè.

**Hỏi khách:**

- Chốt ma trận role × permission mặc định; ai được duyệt, sửa/xóa, xem report, variance, damage và nhận thông báo.
- Chủ có “toàn quyền nghiệp vụ” hay cả quyền vận hành như backup/restore.
- Có cần thêm grant nhóm hàng trực tiếp theo từng user/role ngoài cấu hình hiện tại theo bộ phận không.

**Sau khi chốt:** Nếu cần cấp trực tiếp theo user/role, bổ sung scope tương ứng mà không làm mất cấu hình theo bộ phận hiện có.

### FLOW-02 — Thao tác mở rộng của nhà cung cấp

**Hiện tại:** Đã chốt NCC dùng chung DICA Mobile. Backend có tài khoản/role NCC, `/supplier/orders`, cô lập theo `supplier_id`, thông báo đơn mới và deep link riêng. Contract Mobile v1 chỉ cho xem đơn; workspace chưa có source Mobile để triển khai/kiểm tra màn hình thực tế.

**Hỏi khách:**

- NCC có cần bấm nhận/từ chối đơn không.
- Có cần trạng thái đang chuẩn bị/đang giao, nhập lượng giao và đính kèm chứng từ không.
- NCC có được xem đơn giá, công nợ hoặc cập nhật thông tin thanh toán không.

**Sau khi chốt:** Mở thêm permission, command API, trạng thái và màn hình Mobile tương ứng; không suy diễn từ quyền xem đơn.

### FLOW-03 — Vòng đời phiếu và nơi duyệt

**Hiện tại:** Yêu cầu hàng cho sửa draft, submit, approve, reject, revise phiếu rejected và cancel khi draft/submitted/rejected. Điều chuyển có draft/update/submit/approve/reject/cancel. Duyệt đang có trên Admin Web; API vẫn dùng được cho client được cấp quyền.

**Hỏi khách:**

- Quản lý tổng/Chủ duyệt trên Web, Mobile hay cả hai; Mobile có cần xác thực bổ sung không.
- Phiếu bị từ chối được sửa chính phiếu hay tạo revision/phiếu mới; lịch sử nào phải hiển thị.
- Ai được hủy và được hủy ở trạng thái nào; có cho sửa/đổi nguồn sau duyệt không.
- Có luồng “yêu cầu sửa” riêng ngoài reject không.

**Sau khi chốt:** Chốt state machine, permission, Swagger audience, notification và test version/idempotency.

### FLOW-04 — Hoàn hàng

**Hiện tại:** Chưa có model, API hoặc màn hình hoàn hàng.

**Hỏi khách:**

- Hoàn về kho tổng, cơ sở khác hay NCC; có thể hoàn một phần không.
- Ai tạo, duyệt, giao và xác nhận nhận lại; ảnh/chứng từ có bắt buộc không.
- Khi nào trừ tồn bên trả, cộng tồn bên nhận và điều chỉnh payment/công nợ.
- Hàng hỏng có được hoàn chung flow hay là nghiệp vụ riêng.

**Sau khi chốt:** Thiết kế state machine, permission, ledger, payment reconciliation, attachment, API Mobile/Web, notification và test retry.

### FLOW-05 — Thiếu/thừa và giao bù

**Hiện tại:** Có discrepancy, nhận bù nhiều lần, resolve case và đóng lượng còn thiếu; resolution vẫn là chuỗi tự do và một số action bị khóa production.

**Hỏi khách:**

- Thiếu quá ngày: tiếp tục giao bù, hủy phần thiếu, đổi nguồn hay ghi công nợ.
- Thừa: nhận thêm vào tồn, trả lại hay treo chờ xử lý; thời điểm nào được post tồn.
- Ai được resolve/đóng phần còn lại và có bắt buộc khác người lập/nhận không.
- Ảnh bắt buộc với mọi lần nhận hay chỉ khi có sai lệch; số ảnh tối thiểu/tối đa.

**Sau khi chốt:** Dùng enum resolution + lịch sử, cập nhật order/receipt/ledger/payment atomically và bỏ chặn policy production tương ứng.

### FLOW-06 — Payment và công nợ

**Hiện tại:** Chỉ có `UNPAID/PARTIAL/PAID`, giá trị đối soát theo thực nhận và số đã trả; chưa có hạn trả, phương thức, mã giao dịch hoặc chứng từ.

**Hỏi khách:**

- Bộ trạng thái chính thức có quá hạn, hủy, hoàn tiền hoặc điều chỉnh không.
- Ai nhập đơn giá và ai cập nhật thanh toán; có cần tách người nhập/người xác nhận không.
- Cách tính lại khi giao bù, trả hàng, nhận thừa hoặc đóng phần thiếu.
- Có lưu ngày đến hạn, phương thức, mã giao dịch và ảnh chứng từ thanh toán không.

**Sau khi chốt:** Mở rộng schema/API/report/audit và bảo đảm số đã trả không vượt giá trị đối soát sau điều chỉnh.

### FLOW-07 — Báo hỏng, hao hụt và điều chỉnh tồn

**Hiện tại:** Báo hỏng có draft/submit/confirm nhưng confirm không tự trừ tồn và production mặc định chặn. Stocktake ghi snapshot/chênh lệch nhưng không tự điều chỉnh tồn.

**Hỏi khách:**

- Báo hỏng có cần duyệt/từ chối không; ai xác nhận và lúc nào trừ tồn.
- Chênh lệch kiểm kê có tự tạo phiếu điều chỉnh hay cần duyệt thủ công.
- Có cho tồn âm không; ai được approve/post adjustment; có bắt buộc tách người lập và duyệt không.
- Hao hụt cần xem theo lượng, phần trăm, giá trị tiền hay cả ba.

**Sau khi chốt:** Chốt policy có version, ledger/audit/notification và bật production theo đúng quyền.

### FLOW-08 — Phạm vi tuyến điều chuyển

**Hiện tại:** Module transfer cho phép hai cơ sở khác nhau điều chuyển. Kho tổng ↔ Bếp tổng tự duyệt; các tuyến khác chuyển sang `SUBMITTED` để người có quyền duyệt. Luồng xin hàng từ Kho tổng vẫn nằm ở request/order, không phải transfer.

**Hỏi khách:**

- Có thực sự cho phép Chi nhánh ↔ Kho tổng/Bếp tổng ngoài luồng xin hàng không; hiện backend đang cho phép theo nghĩa rộng của “giữa các cơ sở”.
- Bên nào tạo phiếu; `expected_arrival_at` là thời điểm dự kiến hay một khoảng giờ bắt đầu/kết thúc.
- Khi tuyến không phải Kho tổng ↔ Bếp tổng, tất cả đều cần Quản lý tổng duyệt hay có ngoại lệ khác.

**Sau khi chốt:** Thu hẹp validation nếu khách không cho một số cặp cơ sở; mở rộng model ETA nếu cần và test từng cặp facility.

### FLOW-09 — Xóa hay ngừng sử dụng cấu hình

**Hiện tại:** Facility, kho, bộ phận, nguyên liệu, nhóm, đơn vị và NCC dùng soft deactivate qua `active`; không có DELETE do dữ liệu đã được lịch sử nghiệp vụ tham chiếu.

**Hỏi khách:**

- “Xóa” trong flow có chấp nhận là ngừng sử dụng/ẩn khỏi lựa chọn không.
- Bản ghi chưa từng phát sinh giao dịch có được xóa cứng không; ai có quyền khôi phục.
- Khi deactivate facility/NCC/ingredient, phiếu draft và source rule đang dùng phải xử lý thế nào.

**Khuyến nghị:** Giữ soft delete làm mặc định để không mất lịch sử; UI dùng nhãn “Ngừng sử dụng”.

### FLOW-10 — NCC ưu tiên và quy tắc nguồn hàng

**Hiện tại:** Một nguyên liệu có nhiều `SupplierIngredient` và tối đa một liên kết đang hoạt động được đánh dấu `isPreferred`; API/UI đưa NCC ưu tiên lên đầu. Mỗi `facility + ingredient` vẫn có một `SourceRule` trỏ đến kho hoặc một NCC; đánh dấu ưu tiên không tự đổi nguồn đã cấu hình.

**Hỏi khách:**

- NCC ưu tiên có cần tự được chọn khi tạo source rule mới hay chỉ hiển thị/đánh dấu trước như hiện tại.
- Có cần nhiều mức ưu tiên/fallback khi NCC chính hết hàng không; hệ thống tự đổi hay phải người có quyền duyệt.
- Bulk chuyển NCC áp dụng cho cấu hình tương lai hay cả đơn đã duyệt/chưa giao.

**Sau khi chốt:** Nếu cần, bổ sung nhiều mức ưu tiên/fallback; không tự đổi nguồn của đơn lịch sử nếu chưa có quy tắc rõ ràng.

### FLOW-11 — Ma trận thông báo

**Hiện tại:** Có notification cho request, transfer, receipt discrepancy, stocktake lệch và damage; có DB inbox + FCM. Chưa có reminder thiếu hàng qua ngày, payment/return và cảnh báo tồn/variance chạy tự động.

**Hỏi khách:**

- Với từng sự kiện, ai nhận theo role/permission/scope và qua inbox, push, email hay Zalo.
- Giờ gửi, timezone, quiet hours, tần suất nhắc lại và điều kiện dừng.
- Nội dung có được chứa số lượng/giá/NCC trên màn hình khóa không.

**Sau khi chốt:** Lập bảng event × recipient × channel × template × dedupe key và test thu hồi quyền trước khi đọc notification.

## 3. P1 — Việc triển khai sau khi có câu trả lời

### FLOW-12 — Phiếu gửi NCC dạng PDF/ảnh

Web hiện xuất CSV phía client. Cần chốt mẫu, logo, địa chỉ giao, đơn giá, ghi chú và quyền export; sau đó tạo PDF/print view không lộ tồn kho, payment, request cha hoặc audit nội bộ.

### FLOW-13 — Nhắc đơn thiếu qua ngày

Tạo scheduled job theo giờ/timezone đã chốt, chỉ lấy discrepancy shortage còn mở, lưu notification trước khi push và dedupe theo `discrepancy + business_date`.

### FLOW-14 — Kết nối iPOS thật

Khách cần cung cấp API/webhook/file, credentials test, mã cơ sở/món/hóa đơn, quy tắc hủy/hoàn/combo và checkpoint. Adapter phải incremental, idempotent và không coi dữ liệu thiếu là 0.

### FLOW-15 — Cảnh báo tồn kho/hao hụt tự động

Chốt ngưỡng tuyệt đối/%/số ngày tồn, lịch chạy, cooldown và người nhận. Rule active phải tạo notification có resource hợp lệ, có lịch sử chạy và không spam.

### FLOW-16 — Gallery ảnh trên Admin Web

Backend đã trả public `viewUrl` cố định. Web cần preview/tải ảnh receipt và damage, có loading/placeholder/retry; không cần renew URL hoặc gửi Bearer token khi tải ảnh.

### FLOW-17 — Hoàn thiện cảnh báo lint Web

**Hiện tại (2026-10-08):** Web typecheck/build đạt; ESLint có 0 error và 105 warning, chủ yếu là `react-hooks/set-state-in-effect` và import/biến không dùng.

Giữ `npm run lint` không warning ở các file sửa và không làm đổi hành vi permission-gated tab/deep link.

## 4. Ngoài phạm vi theo `flow.md`

- App riêng cho NCC; nhà cung cấp dùng một không gian giới hạn quyền trong app DICA chung.
- App khách hàng, đặt món, đánh giá.
- Chấm công và quy trình vận hành nhà hàng.
- Phần mềm bán hàng thay thế iPOS.

## 5. Definition of Done chung

1. Quyết định nghiệp vụ được ghi người xác nhận, ngày và ảnh hưởng schema/API/client/test.
2. Migration tương thích ngược nếu đổi database; permission/scope được kiểm tra tại backend.
3. Swagger có request, response, error và audience Mobile/Admin Web đúng thực tế.
4. Mobile/Web contract và tài liệu tích hợp được cập nhật; notification lưu DB trước khi push.
5. Có test happy path, scope, invalid state, version conflict, idempotency/retry và dữ liệu lịch sử.
6. Typecheck, test, build, format và CI đạt.

# DICA Backend Requirements

Version: 1.0 • Ngày: 2026-10-02 • Ngôn ngữ mô tả: tiếng Việt; tên dữ liệu/API: tiếng Anh.

Đặc tả để agent xây backend mới cho **01 web quản trị và 01 app DICA trên Android/iOS**, dùng chung cho nội bộ và nhà cung ứng. Phạm vi nghiệp vụ lấy từ Phụ lục 01 của bản hợp đồng cá nhân đã cập nhật. Đây là hướng dẫn triển khai kỹ thuật, không bổ sung chức năng ngoài phạm vi hợp đồng.

## 0. Agent đọc trước khi code

- **CONFIRMED**: nghiệp vụ đã có trong phạm vi; phải triển khai đầy đủ.
- **PROPOSED**: cách thiết kế kỹ thuật/default đề xuất trong file này; có thể dùng cho development/demo, ghi lại trong ADR. Chưa được coi là quyết định nghiệp vụ của khách.
- **OPEN**: thiếu quyết định hoặc đầu vào; xem mục 12. Làm phần độc lập trước, giữ adapter/policy để thay đổi; không giả lập dữ liệu thật hoặc tự báo hoàn thành.
- Không tự đổi số lượng app, cắt chức năng, cho nhà cung ứng quyền nội bộ hoặc mở quyền giữa các chi nhánh.
- Nếu repository có stack/convention sẵn, đọc `AGENTS.md` và làm theo. Nếu chưa có, chọn stack phù hợp rồi ghi ADR; đặc tả này không bắt buộc framework, phiên bản thư viện hoặc nhà cung cấp cloud.
- Backend phải thực thi quyền và trạng thái; việc frontend ẩn nút không thay thế kiểm tra server.
- Mốc 14 ngày là **bản dùng thử**, không phải toàn bộ sản phẩm hoàn thiện. Không chuyển phần còn lại thành “ngoài scope”.
- Dữ liệu demo phải tách production. Các policy OPEN có thể chạy trong demo với nhãn rõ; production phải được xác nhận trước khi kích hoạt hành vi ảnh hưởng số liệu.

## 1. Phạm vi và ưu tiên

### 1.1 CONFIRMED — phải có

| Mã    | Module            | Yêu cầu                                                                                                                                    |
| ----- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| BE-01 | Auth và RBAC      | Đăng nhập; tài khoản; quyền theo chức năng và phạm vi dữ liệu; cùng backend cho web/app                                                    |
| BE-02 | Tổ chức           | Cơ sở/chi nhánh, kho tổng, Bếp tổng, kho tại cơ sở, bộ phận Bếp/Bàn                                                                        |
| BE-03 | Danh mục          | Nguyên liệu dùng chung; nhóm hàng; đơn vị/quy đổi; nhà cung ứng; một nguyên liệu liên kết nhiều nhà cung ứng                               |
| BE-04 | Nguồn cấp         | Hàng được xin theo cơ sở/bộ phận; nguồn kho hoặc nhà cung ứng theo cơ sở/nguyên liệu; nhà cung ứng ưu tiên; đổi nguồn hàng loạt có lịch sử |
| BE-05 | Xin/đặt hàng      | Chi nhánh xin hàng; kho đặt nhà cung ứng; Quản lý tổng duyệt; tách đơn theo nguồn; xuất file đơn hàng                                      |
| BE-06 | Giao nhận         | Xuất kho, nhận thực tế, ảnh, thiếu/thừa, giao nhiều lần/giao bù qua ngày                                                                   |
| BE-07 | Điều chuyển       | Giữa chi nhánh có duyệt; kho tổng ↔ Bếp tổng không cần Quản lý tổng duyệt                                                                  |
| BE-08 | Kiểm kê           | Tồn thực tế cuối ngày tại kho/Bếp/Bàn; đối chiếu với nhập xuất, iPOS và định mức                                                           |
| BE-09 | Hao hụt/báo hỏng  | Lệch thiếu/dư, cảnh báo theo ngưỡng; báo hỏng riêng gồm số lượng, lý do, cơ sở và ảnh                                                      |
| BE-10 | Báo cáo           | Nhập xuất tồn, trạng thái phiếu, thực nhận/chênh lệch, hao hụt, báo hỏng, trạng thái thanh toán                                            |
| BE-11 | Thông báo/lịch sử | Thông báo trong app đúng người, mở đúng phiếu; lịch sử người thao tác và thời gian                                                         |
| BE-12 | Vận hành/bàn giao | Migration, seed, cấu hình môi trường, backup/restore, API docs, hướng dẫn triển khai                                                       |

### 1.2 Mốc dùng thử 14 ngày

Ưu tiên BE-01 → BE-04 → luồng dọc BE-05/06: đăng nhập, phân quyền, cấu hình nguồn từ web, chi nhánh xin, Quản lý tổng duyệt, kho xuất hoặc nhà cung ứng xem đơn, người nhận xác nhận thực nhận. Có dữ liệu demo, lịch sử và kiểm tra không truy cập chéo. Mốc này cần phối hợp frontend; backend chạy riêng chưa đồng nghĩa app đã nghiệm thu.

Sau bản thử vẫn hoàn thiện tất cả module ở bảng trên. iPOS chưa có quyền truy cập thì bàn giao adapter/import contract và ghi blocker; không đánh dấu tích hợp thật đã xong.

### 1.3 Ngoài phạm vi

App nhà cung ứng riêng; An toàn/Lưu mẫu/Truy xuất lô; hóa đơn điện tử; hệ thống kế toán; chuyển tiền/thanh toán online; nhà cung ứng xác nhận giao hoặc phản hồi đơn trên app. Nhà cung ứng chỉ nhận/xem đơn đã duyệt của mình. Không tự thêm chức năng SaaS, đăng ký doanh nghiệp, tính phí thuê bao, chat hoặc đồng bộ offline.

## 2. Cơ sở, bộ phận và tài khoản

**CONFIRMED:** 6 nhóm vai trò: `ADMIN_OWNER`, `GENERAL_MANAGER`, `BRANCH_MANAGER`, `BRANCH_STAFF`, `WAREHOUSE_STAFF`, `SUPPLIER`.

- Bếp/Bàn là bộ phận của chi nhánh; Kho tổng/Kiểm kho/Bếp tổng là phạm vi công việc hoặc nơi được giao. Không bắt buộc tạo thêm role cho từng tên này.
- Tài khoản nội bộ có thể được giao nhiều cơ sở/kho/bộ phận. Quyền phải gắn đúng nơi; có quyền ở A không suy ra có quyền ở B.
- Tài khoản nhà cung ứng liên kết `supplier_id` do server quản lý. Không được tự gửi/chọn supplier khác để xem đơn.
- Đổi nhóm vai trò không làm mất giới hạn phạm vi hoặc tự giảm chức năng sản phẩm.

**PROPOSED — mô hình:** một đơn vị kinh doanh có nhiều cơ sở, không xây nền tảng đa khách hàng. Có `organization_id` làm ranh giới dữ liệu và unique key; không có luồng onboarding/billing SaaS. `Facility.type = CENTRAL_WAREHOUSE | CENTRAL_KITCHEN | BRANCH`; một facility có nhiều `StockLocation`, nhiều `Department`. Mọi định danh cơ sở/kho/bộ phận phải kiểm tra cùng organization và quan hệ hợp lệ.

Demo gắn Bếp và Bàn với hai stock location riêng để đếm/giới hạn quyền rõ ràng. Khách có thể chọn kho dùng chung; khi đó phải chốt mô hình phân bổ theo bộ phận trong OPEN-04. Không cộng hai lần cùng một tồn vật lý chỉ vì hai bộ phận cùng kiểm kê, hoặc cho một bộ phận thấy toàn tồn chi nhánh do dùng chung `facility_id`.

## 3. Mô hình dữ liệu đề xuất

Các bảng/tên dưới đây là **PROPOSED**; agent có thể đổi tên theo stack nhưng phải giữ trách nhiệm và ràng buộc. Dùng ID ổn định; lưu thời gian UTC, ngày nghiệp vụ theo `Asia/Ho_Chi_Minh`. Số lượng/giá dùng decimal, không dùng floating point; precision và làm tròn cần ghi rõ trong ADR.

| Entity                               | Dữ liệu/ràng buộc chính                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Organization, Facility               | Mã, tên, loại cơ sở, trạng thái; mã unique trong organization                                                            |
| StockLocation, Department            | Thuộc facility; kho nhận/xuất và bộ phận Bếp/Bàn; bộ phận phải được liên kết kho phù hợp                                 |
| User, Session                        | Username/email/điện thoại theo cách đăng nhập đã chọn; password hash; active; session/revocation                         |
| Role, Permission, RoleGrant          | Permission và một tập scope có cấu trúc; không tách role/scope thành các danh sách tạo tích Descartes                    |
| Ingredient, IngredientGroup          | Nguyên liệu chung, mã unique, đơn vị cơ sở, active; không tạo nguyên liệu mới chỉ vì đổi supplier                        |
| Unit, IngredientUnitConversion       | Quy đổi theo nguyên liệu; hệ số > 0, phiên bản/thời gian hiệu lực; lưu snapshot trên giao dịch                           |
| Supplier, SupplierIngredient         | Supplier, nguyên liệu, mã hàng supplier/đơn vị/giá tham chiếu nếu có; nhiều supplier cho một nguyên liệu                 |
| ItemEligibility                      | Facility + department + ingredient được phép xin; unique theo bộ ba                                                      |
| SourceRule, SourceRuleRevision       | Facility + ingredient → một nguồn đang áp dụng: kho hoặc supplier; supplier ưu tiên; lịch sử trước/sau                   |
| Request, RequestLine                 | Loại phiếu, cơ sở/bộ phận nhận, người lập, ngày cần, lượng xin, nguồn/quy đổi snapshot, version                          |
| ApprovalEvent                        | Phiếu, quyết định, người duyệt, lý do, thời gian, policy áp dụng                                                         |
| FulfillmentOrder, FulfillmentLine    | Đơn thực hiện theo từng nguồn/đích; liên kết dòng yêu cầu gốc; số lượng được duyệt, đơn giá snapshot                     |
| Dispatch, DispatchLine               | Xuất từ kho; lượng xuất thực tế; người xuất; liên kết dòng đơn; một đơn có nhiều lần xuất                                |
| Receipt, ReceiptLine                 | Lượng thực nhận, kho/bộ phận nhận, ảnh, thời gian; liên kết đơn và dispatch nếu là hàng nội bộ                           |
| DiscrepancyCase                      | Thiếu/thừa/hỏng khi giao nhận; dự kiến/thực tế, người xử lý, quyết định, lý do; giữ số liệu gốc                          |
| StockLedgerEntry, StockBalance       | Bút toán số lượng bất biến; vị trí, nguyên liệu, quantity signed, chứng từ, thời điểm; balance là cache có thể đối chiếu |
| Stocktake, StocktakeLine             | Cơ sở/kho/bộ phận, ngày và thời điểm chốt, tồn đếm, tồn dự kiến snapshot, chênh lệch, người thực hiện                    |
| DamageReport, DamageLine             | Nguyên liệu, lượng, lý do, địa điểm, ảnh; tách báo hỏng với điều chỉnh tồn                                               |
| InventoryAdjustment                  | Chênh lệch, lý do, chứng từ nguồn, người duyệt; liên kết ledger khi được hạch toán tồn                                   |
| MenuItemMapping, RecipeVersion       | Mapping món iPOS; định mức nguyên liệu/đơn vị; thời gian hiệu lực; không sửa hồi tố bản đã tính                          |
| SalesImportBatch, SalesRecord        | Nguồn, external key, cơ sở/ngày, món, lượng bán/hoàn; trạng thái kiểm tra và lỗi từng dòng                               |
| VarianceResult, AlertRule            | Kết quả hao hụt; snapshot dữ liệu/định mức; ngưỡng/đơn vị; trạng thái dữ liệu đủ/chưa đủ                                 |
| PaymentTracking                      | Giá trị đối soát, số đã ghi nhận trả, ngày/chứng từ tham chiếu; không là giao dịch ngân hàng                             |
| Attachment, Notification, AuditEvent | Object key private, chủ thể liên quan; người nhận; sự kiện trước/sau, actor, request ID                                  |
| IdempotencyRecord, OutboxEvent       | Chống xử lý lặp; sự kiện gửi thông báo/export sau khi transaction thành công                                             |

Ràng buộc bắt buộc:

1. Không xóa cứng danh mục/tài khoản/chứng từ đã có giao dịch; deactivate hoặc trạng thái nghiệp vụ thích hợp.
2. Chứng từ lưu tên hàng, đơn vị, hệ số quy đổi, nguồn và đơn giá snapshot; đổi danh mục không đổi lịch sử.
3. Dòng thuộc chứng từ, attachments thuộc dòng/chứng từ, kho thuộc facility; kiểm tra bằng FK và service validation.
4. Mỗi ledger posting có khóa unique theo sự kiện nguồn + dòng + loại bút toán; không được ghi hai lần do retry.
5. Request cha và các đơn con phải có lineage; tổng số lượng phân bổ bằng số đã duyệt theo đơn vị cơ sở.

## 4. RBAC và giới hạn dữ liệu

### 4.1 Quy tắc thực thi

`authorize(user, permission, resource)` = tài khoản hoạt động **và** có permission **và** scope khớp resource **và** hành động hợp lệ với trạng thái.

- Scope biểu diễn bằng grant nguyên khối, ví dụ `{role, facility_id, stock_location_id?, department_id?}`. `ALL_INTERNAL` chỉ là quyền cấp rõ cho người phù hợp; không mặc định khi trường scope rỗng.
- Một grant gồm nhiều điều kiện phải thỏa tất cả; được hợp các grant hợp lệ nhưng không trộn facility của grant này với department của grant khác.
- `OWN` phải gắn thêm `created_by = user.id` và phạm vi cơ sở/bộ phận; không đủ chỉ kiểm tra tác giả.
- Duyệt, đổi nguồn, điều chỉnh tồn, đóng phiếu còn lệch là các quyền riêng, không suy ra từ quyền sửa phiếu.
- Với transfer, có thể xem phần được giao khi thuộc một trong hai đầu; chỉ xuất ở đầu gửi, chỉ nhận ở đầu nhận. DTO không lộ dữ liệu ngoài việc điều chuyển liên quan.
- Áp dụng cùng điều kiện cho list/detail/count/search/report/export/file download và notification payload. Lọc sau khi paginate là sai.
- Nhà cung ứng dùng DTO riêng: đơn đã phát hành của mình, hàng, lượng, giá/đích giao cần thiết. Không trả nguyên request cha, đơn supplier khác, tồn, hao hụt, payment nội bộ, audit nội bộ hoặc danh sách user.
- Không cho user tự tăng quyền. Thay đổi role/scope ghi audit; thu hồi quyền có hiệu lực với session đang hoạt động, không đợi token dài hạn hết hạn.
- Supplier không được nhận grant nội bộ, kể cả ghép thêm role qua API quản trị; nếu một người cần tài khoản nội bộ, dùng tài khoản nội bộ riêng.

### 4.2 Permission catalog PROPOSED

Các mã phân tách bằng dấu phẩy là quyền độc lập, không phải một chuỗi permission. Có thể thêm permission kỹ thuật để thực hiện scope nhưng không tự thêm nghiệp vụ.

| Nhóm            | Permission codes                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tài khoản       | `user.read`, `user.create`, `user.update`, `user.deactivate`, `user.reset_password`, `user.revoke_sessions`                                            |
| Quyền           | `role.read`, `role.manage`, `grant.read`, `grant.assign`, `grant.revoke`                                                                               |
| Cơ sở           | `facility.read`, `facility.manage`, `stock_location.read`, `stock_location.manage`, `department.read`, `department.manage`                             |
| Hàng/đơn vị     | `ingredient.read`, `ingredient.manage`, `ingredient_group.manage`, `unit.read`, `unit.manage`, `conversion.read`, `conversion.manage`                  |
| Supplier        | `supplier.read`, `supplier.manage`, `supplier_ingredient.read`, `supplier_ingredient.manage`                                                           |
| Nguồn           | `eligibility.read`, `eligibility.manage`, `source_rule.read`, `source_rule.manage`, `source_rule.bulk_update`                                          |
| Xin/đặt         | `request.read`, `request.create`, `request.update_draft`, `request.revise`, `request.submit`, `request.cancel`, `request.approve`, `request.reject`    |
| Đơn             | `order.read`, `order.release`, `order.export`, `order.change_source`, `order.close_outstanding`, `order.cancel`                                        |
| Transfer        | `transfer.read`, `transfer.create`, `transfer.update_draft`, `transfer.submit`, `transfer.approve`, `transfer.reject`, `transfer.cancel`               |
| Xuất/nhận       | `dispatch.read`, `dispatch.create`, `dispatch.post`, `receipt.read`, `receipt.create`, `receipt.post`, `discrepancy.read`, `discrepancy.resolve`       |
| Tồn             | `stock.read`, `stock_ledger.read`, `adjustment.read`, `adjustment.create`, `adjustment.approve`, `adjustment.post`                                     |
| Kiểm kê         | `stocktake.read`, `stocktake.create`, `stocktake.update_draft`, `stocktake.submit`, `stocktake.reopen`                                                 |
| Hỏng/hao hụt    | `damage.create`, `damage.read`, `damage.update_draft`, `damage.submit`, `damage.confirm`, `variance.read`, `variance.recalculate`, `alert_rule.manage` |
| iPOS/định mức   | `recipe.read`, `recipe.manage`, `ipos_mapping.read`, `ipos_mapping.manage`, `sales_import.create`, `sales_import.read`, `sales_import.commit`          |
| Đối soát tiền   | `payment_tracking.read`, `payment_tracking.update`                                                                                                     |
| Báo cáo         | `report.stock`, `report.fulfillment`, `report.variance`, `report.damage`, `report.payment`, `report.export`                                            |
| Audit/hệ thống  | `audit.read`, `attachment.upload`, `notification.read_own`, `notification.mark_own`, `backup.manage`                                                   |
| Supplier portal | `supplier_order.read_own`                                                                                                                              |

`attachment.upload` không cho tải/xem file tùy ý: tải phải được phép đọc resource; upload phải được phép tạo/sửa resource. `report.export` cũng cần quyền đọc loại báo cáo tương ứng. `backup.manage` chỉ dành nội bộ vận hành, không public download database qua API app.

### 4.3 Role mặc định — mẫu seed PROPOSED

| Nhóm              | Cấp mặc định                                                                                                        | Không tự cấp                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Admin/Chủ         | Cấu hình, quản trị user/quyền; xem báo cáo, hao hụt, báo hỏng và audit trong scope quản trị                         | Quyền toàn organization nếu grant chỉ ở một cơ sở; tài khoản vận hành backup nếu chưa được giao |
| Quản lý tổng      | Xem/duyệt yêu cầu và transfer; xử lý thiếu/thừa/đóng dư lượng; báo cáo, hao hụt, báo hỏng/cảnh báo; scope được giao | Quản trị role, import iPOS, đổi nguồn/điều chỉnh tồn nếu chưa cấp quyền riêng                   |
| Quản lý chi nhánh | Xem phiếu/tồn và theo dõi Bếp/Bàn tại chi nhánh; tạo xin/nhận theo quyền                                            | Duyệt, xem hao hụt, điều chỉnh tồn, quản trị nguồn hoặc dữ liệu chi nhánh khác                  |
| Nhân sự chi nhánh | Tạo/sửa draft/submit xin hàng; nhận, kiểm kê, báo hỏng tại bộ phận được giao; notification riêng                    | Duyệt, xem hao hụt; xem tất cả báo hỏng chỉ vì được tạo báo hỏng                                |
| Nhân sự kho       | Phiếu liên quan; đặt hàng; xuất/nhận/kiểm kê/báo hỏng tại kho được giao                                             | Duyệt mua hàng, sửa tồn trực tiếp, truy cập toàn bộ kho/chi nhánh                               |
| Nhà cung ứng      | `supplier_order.read_own`; notification riêng liên quan đơn của mình                                                | Toàn bộ quyền nội bộ; phản hồi/nhấn xác nhận giao; xem đơn chưa được duyệt/phát hành            |

Hao hụt mặc định Quản lý tổng và cấp cao hơn; Admin có thể cấp thêm. Người tạo báo hỏng cần nhận kết quả thao tác và có thể sửa draft mình còn được phép sửa; endpoint danh sách/báo cáo báo hỏng vẫn cần `damage.read`. Trước production, xuất đầy đủ danh sách permission của từng role seed để chủ dự án duyệt, không chỉ giao bảng mô tả này.

## 5. Nguồn cấp và tạo đơn

**CONFIRMED:** nguồn cấu hình theo cơ sở/nguyên liệu; hệ thống tự áp dụng khi xin hàng, Quản lý tổng không phải chọn nguồn lại mỗi lần. Người có quyền đổi nguồn một hoặc nhiều nguyên liệu tại cơ sở được chọn; ghi lịch sử, không sửa đơn đã giao.

**PROPOSED — xử lý:**

1. Client gửi cơ sở/bộ phận nhận, nguyên liệu, đơn vị và số lượng; server kiểm tra eligibility, scope, đơn vị và source rule đang có hiệu lực.
2. Thiếu nguồn hoặc supplier/kho inactive: báo `SOURCE_NOT_CONFIGURED`/`SOURCE_UNAVAILABLE`, chỉ rõ dòng; không tự chọn supplier rẻ nhất hoặc kho gần nhất.
3. Submit lưu revision nguồn và snapshot từng dòng. Khi duyệt, nếu nguồn/quy đổi/eligibility đã thay đổi, trả conflict; người có quyền refresh draft và submit lại. Không âm thầm đổi đơn đang chờ.
4. Duyệt atomically tạo đơn con theo nguồn + đích + supplier/kho; một request có thể có nhiều đơn con. Lưu request-line ID trên từng dòng đơn.
   Default demo duyệt nguyên phiếu theo số đã xin; không tự giảm số lượng, duyệt một phần hoặc chia một dòng cho nhiều nguồn khi chưa có yêu cầu nghiệp vụ tương ứng.
5. Đơn supplier đã phát hành mới xuất hiện cho supplier tương ứng. Supplier không dùng app vẫn có đơn trong hệ thống; người có quyền export và tự gửi file, không thêm tích hợp gửi ngoài app.
6. Đổi cấu hình nguồn áp dụng cho phiếu tương lai. Đổi một đơn đang thực hiện dùng quyền `order.change_source`, quyết định OPEN-02; không ảnh hưởng lượng đã xuất/nhận hoặc thay supplier trên đơn cũ đã phát hành. Tách phần còn lại thành đơn mới và giữ lineage/audit.
7. Bulk source update: validate toàn bộ, hiển thị lỗi theo hàng; default all-or-nothing để không có cấu hình đổi nửa chừng. Không cập nhật chứng từ lịch sử.

## 6. Luồng và trạng thái

Nghiệp vụ ở bảng là **CONFIRMED**; tên trạng thái và cách tổ chức chứng từ là **PROPOSED**.

| Luồng                 | Lập                                     | Quyết định                                                      | Xuất/giao                                                     | Nhận                                   |
| --------------------- | --------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------- |
| Chi nhánh xin hàng    | Bếp/Bàn hoặc quản lý có quyền tại cơ sở | Quản lý tổng duyệt                                              | Kho theo phiếu hoặc supplier theo đơn đã phát hành            | Nhân sự có quyền tại nơi nhận          |
| Kho mua từ supplier   | Nhân sự kho                             | Quản lý tổng duyệt                                              | Supplier giao thực tế, không thao tác xác nhận giao trong app | Nhân sự kho có quyền                   |
| Kho tổng ↔ Bếp tổng   | Nhân sự bên gửi có quyền                | Không cần Quản lý tổng duyệt                                    | Nhân sự kho/bếp bên gửi                                       | Bên nhận có quyền                      |
| Chi nhánh → chi nhánh | Nhân sự có quyền                        | Quản lý tổng duyệt                                              | Chi nhánh gửi                                                 | Chi nhánh nhận                         |
| Thiếu/thừa khi nhận   | Người nhận ghi thực tế/ảnh              | Quản lý tổng xử lý với kho/supplier; quản lý chi nhánh theo dõi | Giao bù hoặc xử lý theo quyết định                            | Ghi từng lần nhận, không ghi đè lần cũ |

### 6.1 Yêu cầu và duyệt

`DRAFT → SUBMITTED → APPROVED | REJECTED`; `CANCELLED` chỉ khi chưa có giao dịch thực hiện không thể đảo tùy ý.

- Chỉ draft được sửa nội dung. Phiếu bị từ chối giữ lịch sử; sửa bằng revision mới quay về draft, không xóa approval event.
- `APPROVED` là kết quả duyệt, không có nghĩa đã nhận đủ. Tiến độ request tổng hợp từ đơn con/dòng con.
- Kho tổng ↔ Bếp tổng: submit hợp lệ tự ghi approval event với `policy=NO_MANAGER_APPROVAL`; vẫn phải kiểm tra hai loại facility, hướng giao, scope, tồn khi xuất và toàn bộ log. Không cho client truyền `skip_approval=true`.
- Không biến transfer giữa chi nhánh hoặc mua hàng thành luồng miễn duyệt chỉ vì user thuộc role kho.
- Transfer độc lập chỉ hỗ trợ hai cặp đã chốt: kho tổng ↔ Bếp tổng và chi nhánh ↔ chi nhánh. Kho cấp chi nhánh đi theo đơn xin hàng; không mở thêm mọi cặp facility vì enum hỗ trợ nhiều loại.

### 6.2 Đơn thực hiện

`DRAFT → RELEASED → PARTIAL → COMPLETED`; có `CLOSED` cho phần còn lại được quyết định không giao nữa và `CANCELLED` cho đơn chưa có phát sinh.

- Với đề xuất hiện tại, approve tạo/phát hành đơn trong cùng transaction. Không thêm lần duyệt thứ hai nếu khách không yêu cầu.
- Tính trạng thái từ từng dòng: `approved_qty`, `dispatched_qty`, `accepted_received_qty`, `closed_remaining_qty`, `open_qty` theo đơn vị cơ sở.
- Supplier: `open_qty = approved_qty - received_against_order_qty - closed_remaining_qty`, luôn ≥ 0. `received_against_order_qty` là phần thực nhận phân bổ cho lượng đã duyệt. Nếu nhận thừa được chấp nhận, lưu riêng `accepted_excess_qty` và chứng từ/quyết định bổ sung; không tăng lượng xin gốc hoặc làm `open_qty` âm. Tổng nhận vật lý bằng hai lượng nhận này cộng lại.
- Transfer còn có `in_transit_qty` và `not_dispatched_qty`; không đồng nhất “đã xuất nhưng chưa nhận” với “chưa xuất”.
- Nhận một phần qua ngày không tự đóng/hủy đơn. Hàng thiếu vẫn nằm trong danh sách chờ giao bù.
- Chỉ `order.close_outstanding` được đóng phần còn lại; cần lý do và quyền theo OPEN-03. Giữ lượng yêu cầu gốc, lượng thực nhận và lượng đóng riêng.
- Đã phát sinh ledger không xóa hoặc cancel để mất dấu. Sửa bằng chứng từ điều chỉnh/đảo có quyền, theo policy đã được chốt.

### 6.3 Receipt và chênh lệch

- Receipt phải tham chiếu đúng dòng đơn; transfer phải tham chiếu đúng lần xuất hoặc phân bổ rõ cho các dispatch.
- Số lượng nhập > 0; đơn vị hợp lệ. Tính đủ/thiếu/thừa trên số tích lũy và phần được phép nhận; không so từng lần giao với toàn bộ đơn.
- Ảnh, note, thời gian, actor được gắn với từng lần nhận. Quy tắc ảnh bắt buộc cho mọi lần nhận hay chỉ chênh lệch là OPEN-08.
- Thiếu/thừa tạo discrepancy riêng, giữ số đo ban đầu. Quyết định của Quản lý tổng không ghi đè việc người nhận đã khai báo.
- Vượt lượng còn lại: ghi nhận sự kiện thực nhận đề xuất/chênh lệch; chưa được tự post lượng thừa vào tồn. Dùng quyết định được phép theo OPEN-01 trước khi post.
- Supplier không có endpoint tạo receipt, dispatch, resolve discrepancy hoặc cập nhật payment.

## 7. Tồn kho và tính nhất quán

Scope có nhập xuất tồn, kiểm kê và hao hụt; **thời điểm hạch toán và xử lý ngoại lệ là OPEN-01**. Mô hình dưới đây là **PROPOSED**, dùng làm policy demo, không được coi là khách đã duyệt.

### 7.1 Policy demo đề xuất

| Sự kiện                                 | Ảnh hưởng tồn                                                              |
| --------------------------------------- | -------------------------------------------------------------------------- |
| Tạo/submit/duyệt yêu cầu, phát hành đơn | Không cộng/trừ tồn; chưa đặt cơ chế giữ hàng/reservation                   |
| Xuất nội bộ                             | Trừ kho gửi, cộng vị trí hàng đang vận chuyển của cùng dispatch            |
| Nhận nội bộ                             | Trừ hàng đang vận chuyển, cộng kho nhận theo lượng nhận được chấp nhận     |
| Nhận từ supplier                        | Cộng kho nhận theo lượng thực nhận được chấp nhận; không cộng số lượng đặt |
| Giao thiếu                              | Giữ phần còn thiếu/chờ xử lý; không tự ghi mất hàng hoặc tự hoàn kho gửi   |
| Báo hỏng/kiểm kê được submit            | Chỉ lưu báo cáo; không tự sửa tồn                                          |
| Điều chỉnh tồn được duyệt và post       | Ghi signed ledger entry có lý do, chứng từ nguồn và người duyệt            |

Tồn khả dụng tại kho không gồm hàng đang vận chuyển. Tồn đơn được duyệt không phải cam kết đủ hàng. Nếu xuất vượt tồn khả dụng, demo trả `INSUFFICIENT_STOCK`; chính sách cho tồn âm nếu có phải chốt riêng trong OPEN-01.

### 7.2 Invariant bắt buộc của thiết kế

- `balance(location, ingredient) = SUM(posted ledger quantity)`; không có endpoint PATCH balance trực tiếp.
- Posting gồm kiểm tra quyền/trạng thái/version/quantity, insert ledger, cập nhật cache balance, trạng thái, audit và outbox trong **một transaction**.
- Khóa balance/dòng đơn liên quan hoặc dùng optimistic concurrency + retry đúng cách; hai người nhận/xuất đồng thời không được vượt phần còn lại.
- Dispatch nội bộ tạo hai bút toán đối ứng; receipt nội bộ cũng vậy. Không tạo thêm hàng chỉ vì ở hai facility.
- Transfer nhận thừa so với đã xuất không được tự tạo tồn: cần đối chiếu/sửa lượng xuất hoặc quyết định điều chỉnh có chứng từ. Hàng thiếu đang vận chuyển không bị tự xóa.
- Posting/reversal có khóa unique và idempotency. Retry do mạng không tạo phiếu/ledger/notification hai lần.
- Không sửa/xóa ledger đã post. Reversal tham chiếu bút toán gốc, lưu lý do; cấm reverse hai lần cùng phần số lượng.
- Quy đổi theo snapshot; mọi phép tổng hợp cùng đơn vị cơ sở. Precision, bước làm tròn và số dư nhỏ phải có test.
- Attachment/notification lỗi không làm mất giao dịch tồn; outbox retry sau commit, tránh gửi tin cho giao dịch rollback.

Production mặc định chặn posting theo policy chưa xác nhận; vẫn cho nhập cấu hình/draft và kiểm thử trên môi trường demo. Khi OPEN-01/03 được chốt, bật policy có version và audit; không sửa lịch sử để “khớp” policy mới.

## 8. Kiểm kê, iPOS, hao hụt và báo hỏng

### 8.1 Kiểm kê

- Một đợt kiểm kê gắn kho/bộ phận, ngày nghiệp vụ và `cutoff_at`. Lưu lượng đếm, người đếm, thời gian và snapshot nguồn tính; tạo draft → submit.
- Không coi thiếu dữ liệu bán/định mức là tiêu thụ bằng 0. Kết quả phải có `DATA_INCOMPLETE` và danh sách thiếu mapping/recipe/dữ liệu.
- Chốt ngày, chỉnh phiếu sau cutoff, mở lại kiểm kê và dữ liệu đến muộn theo OPEN-04; tính lại tạo version mới, giữ kết quả cũ.
- Chênh lệch kiểm kê không tự thành điều chỉnh tồn. Cần quyền/decision riêng, tránh kiểm kê vừa trừ hao hụt vừa trừ báo hỏng cùng lượng.

### 8.2 iPOS và định mức

- CONFIRMED: đối chiếu lượng dùng dự kiến từ dữ liệu bán iPOS và định mức món. Cách lấy dữ liệu thật chưa chốt: OPEN-05.
- PROPOSED: adapter `fetchSales(facility, businessDate)` + luồng import `validate → preview → commit`. Dùng fixture/import thủ công cho demo; không gọi đó là tích hợp API iPOS thật.
- Mỗi external record có unique source key; retry cùng batch/record không cộng doanh số hai lần. Không dedupe chỉ bằng tên món và ngày vì có thể có nhiều lần bán hợp lệ.
- Mapping cơ sở/món/đơn vị rõ ràng; dữ liệu sai đưa staging, không ghi một phần âm thầm. Lưu lỗi theo dòng và quyết định commit.
- Recipe có version hiệu lực theo ngày/giờ bán. Sửa định mức hôm nay không đổi hao hụt ngày trước, trừ thao tác tính lại được phép có lịch sử.
- Định mức phải mapping được vào đúng stock location/bộ phận tiêu thụ; không chỉ có món → nguyên liệu rồi trừ đồng thời cả Bếp và Bàn.
- Bán hủy/hoàn, combo, topping, suất/yield và bản điều chỉnh từ iPOS phải được chốt theo dữ liệu thực; không tự suy ra từ tên món.

### 8.3 Công thức PROPOSED

Với một nguyên liệu tại đúng vị trí kiểm kê và một kỳ `[start, cutoff]`:

```text
expected_usage = SUM(valid_sales_quantity × recipe_quantity_in_base_unit)
expected_closing = opening_stock
                 + posted_inbound - posted_outbound
                 + approved_signed_adjustments
                 - separately_posted_damage
                 - expected_usage
variance = actual_counted_closing - expected_closing
shortage = MAX(-variance, 0)
surplus = MAX(variance, 0)
```

- Phân loại ledger không trùng nhau: damage/adjustment đã tách riêng thì không cộng lại vào inbound/outbound.
- `opening_stock` dùng tồn đầu kỳ đã xác nhận hoặc lượng đếm cuối kỳ trước đã được chấp nhận theo OPEN-04. Với demo chưa post tiêu thụ iPOS vào ledger, không lấy book balance chưa trừ tiêu thụ làm tồn đầu ngày kế tiếp rồi chỉ trừ doanh số của ngày đó. Thiếu số mở đầu hợp lệ phải đánh dấu dữ liệu chưa đủ.
- Default demo không post tiêu thụ iPOS vào stock ledger; nó là lượng lý thuyết để đối chiếu. Nếu khách chọn post tiêu thụ, sửa công thức để không trừ `expected_usage` hai lần.
- Hao hụt là chênh lệch, không tự quy kết là thất thoát do một người. Báo hỏng là báo cáo nguyên nhân riêng.
- Nếu dùng tỷ lệ: `ABS(variance) / expected_usage × 100`; `expected_usage = 0` thì tỷ lệ = null, không chia 0. Ngưỡng kg/đơn vị/% và điều kiện cảnh báo cần OPEN-06.

### 8.4 Báo hỏng

Lưu hàng, lượng, đơn vị, lý do, cơ sở/kho/bộ phận, ảnh và actor; draft → submit → xác nhận theo policy. Quyền tạo, quyền đọc và quyền hạch toán tồn tách riêng. Người có quyền xem báo hỏng không mặc định có quyền xem hao hụt. Việc báo hỏng có trừ tồn ngay hay sau xác nhận thuộc OPEN-01/03.

## 9. Đối soát, báo cáo, thông báo và audit

- Đơn nhập lưu nguồn, đơn giá snapshot, lượng thực nhận và trạng thái thanh toán. PROPOSED: giá trị đối soát = tổng lượng đã chấp nhận × đơn giá; điều chỉnh giá/chiết khấu nếu khách yêu cầu phải chốt, không tự thêm kế toán.
- Payment là ghi nhận thủ công với quyền riêng; trạng thái `UNPAID | PARTIAL | PAID` suy ra từ khoản đã ghi nhận và giá trị đối soát. Không tự ghi `PAID` khi nhận đủ hàng. Supplier không được cập nhật/xem đối soát nội bộ.
- Báo cáo nhập xuất tồn cần filter cơ sở/kho/bộ phận, hàng, kỳ, trạng thái; tách tồn ở kho và đang vận chuyển. Mọi tổng, group-by và export đều được scope từ đầu.
- Xuất đơn theo supplier/kho, đúng dữ liệu đơn đã duyệt. Export không truy vấn lại giá/nguồn mới để thay lịch sử; mẫu/định dạng file theo OPEN-07. Nếu dùng CSV/XLSX, xử lý ô có thể bị thực thi như công thức khi mở file.
- Notification trong app: có đơn chờ duyệt, được duyệt/từ chối, hàng chờ xuất/nhận, có chênh lệch, giao bù, báo hỏng và cảnh báo. Người nhận phải có quyền đọc đối tượng; mở notification kiểm tra quyền hiện tại một lần nữa.
- Supplier chỉ nhận tin về đơn của mình đã phát hành; không nhận tin nội bộ về hao hụt/chênh lệch. Thiếu quyền xem hao hụt thì cả số tổng và preview thông báo cũng bị chặn.
- Audit: actor, action, resource, before/after phần thay đổi, timestamp, request ID; không chứa password/token. Ghi thay đổi nguồn, quyền, duyệt, giao nhận, chỉnh tồn, tính lại, đóng chênh lệch và payment.
- Audit/chứng từ lịch sử được giữ theo dung lượng/backup đã bố trí; không tự đặt job xóa giao dịch sau 30/90 ngày. Retention ảnh/log vận hành cần cấu hình riêng có xác nhận.

## 10. API contract đề xuất

REST `/api/v1`, JSON; cùng endpoint nghiệp vụ cho web/app. Tên path là PROPOSED, phải xuất OpenAPI có schemas, permissions, scope, trạng thái, lỗi và idempotency cho từng operation.

### 10.1 Nhóm endpoint

| Resource    | Endpoint/hành động tối thiểu                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Auth        | `POST /auth/login`, `/auth/refresh`, `/auth/logout`; `GET /me`, `/me/permissions`                          |
| Users/quyền | CRUD phù hợp `/users`; deactivate, reset-password, revoke-sessions; `/roles`, `/permissions`, `/grants`    |
| Tổ chức     | `/facilities`, `/stock-locations`, `/departments`                                                          |
| Danh mục    | `/ingredients`, `/ingredient-groups`, `/units`, `/conversions`, `/suppliers`, `/supplier-ingredients`      |
| Nguồn       | `/item-eligibility`, `/source-rules`; `POST /source-rules/bulk-update`; history                            |
| Yêu cầu     | `/requests`; `POST /requests/{id}/submit`, `/approve`, `/reject`, `/cancel`, `/revise`, `/refresh-routing` |
| Đơn         | `GET /orders`, `/orders/{id}`; actions `/export`, `/change-source`, `/close-outstanding`, `/cancel`        |
| Supplier    | `GET /supplier/orders`, `/supplier/orders/{id}`; projection và filter riêng                                |
| Transfer    | `/transfers`; actions submit/approve/reject/cancel; dùng cùng engine chứng từ để không post tồn trùng      |
| Xuất        | `/dispatches`; `POST /dispatches/{id}/post`; list/detail theo scope                                        |
| Nhận        | `/receipts`; `POST /receipts/{id}/post`; list/detail theo scope                                            |
| Chênh lệch  | `/discrepancies`; `POST /discrepancies/{id}/resolve`                                                       |
| Tồn         | `GET /stock-balances`, `/stock-ledger`; `/inventory-adjustments` + approve/post                            |
| Kiểm kê     | `/stocktakes`; submit/reopen; kết quả variance và version liên quan                                        |
| Báo hỏng    | `/damage-reports`; submit/confirm; không dùng endpoint này thay PATCH balance                              |
| iPOS        | `/recipes`, `/menu-item-mappings`; `/sales-imports` + validate/preview/commit; trạng thái adapter          |
| Hao hụt     | `GET /variances`; recalculate; `/alert-rules`                                                              |
| Tiền        | `GET /orders/{id}/payment-tracking`; update theo quyền, có version/audit                                   |
| Báo cáo     | `GET /reports/stock`, `/fulfillment`, `/variance`, `/damage`, `/payment`; export tương ứng                 |
| File        | Upload-init/finalize và download có kiểm tra resource; không trả bucket public                             |
| Tin/audit   | `/notifications` riêng user + mark-read; `GET /audit-events` theo scope                                    |
| Vận hành    | `/health/live`, `/health/ready`; không công khai credentials hoặc dữ liệu DB                               |

### 10.2 Quy ước bắt buộc

- List phân trang, giới hạn page size, allowlist sort/filter; không có endpoint trả toàn dữ liệu mặc định.
- ID và scope từ client đều untrusted. `created_by`, organization, supplier identity, approval actor lấy từ session/server.
- Action command thay vì PATCH status tự do. Update mang `expected_version` hoặc `If-Match`; stale trả `409 VERSION_CONFLICT`.
- `Idempotency-Key` cho approve, dispatch/receipt post, adjustment post, import commit và payment update. Khóa gắn user/organization/operation; cùng key khác payload trả conflict.
- Lỗi dạng `{code, message, details?, request_id}`. Phân biệt 401, 403, 404, 409, 422; resource ngoài scope dùng 404 nhất quán để không lộ sự tồn tại.
- Lỗi chuẩn tối thiểu: `SOURCE_NOT_CONFIGURED`, `SOURCE_UNAVAILABLE`, `INVALID_STATE`, `VERSION_CONFLICT`, `QUANTITY_EXCEEDS_REMAINING`, `INSUFFICIENT_STOCK`, `DATA_INCOMPLETE`, `POLICY_NOT_CONFIGURED`.
- Quantity/price gửi decimal string; thời gian ISO-8601, ngày nghiệp vụ `YYYY-MM-DD`; nullable rõ ràng. Server tự tính tổng/số còn lại.
- Ví dụ approve payload: `{ "expected_version": 3, "note": "Duyệt theo nguồn cấu hình" }`; không nhận role, actor hoặc cờ bypass từ client.

## 11. Bảo mật và vận hành

Yêu cầu triển khai kỹ thuật; không phải checklist pháp lý hay chức năng bán thêm.

- Hash password bằng thuật toán phù hợp; rate limit đăng nhập, lỗi không lộ tài khoản; không lưu token/password thô trong log. Account creation do quản trị, không tự mở đăng ký public.
- Session có hết hạn và thu hồi; quyền/scope đọc từ nguồn hiện hành hoặc cache có invalidation khi đổi grant. Cookie nếu dùng phải có biện pháp CSRF phù hợp; bearer token không nhúng vào URL.
- Secrets trong biến môi trường/secret store; `.env.example` chỉ chứa placeholder. TLS khi triển khai; CORS allowlist cho client được giao.
- File private, kiểm tra dung lượng/type/nội dung thực, quyền đọc resource; signed URL ngắn hạn chỉ phát sau authorize. Không tin filename/MIME client.
- Link tải trực tiếp đã phát có thể còn hiệu lực đến TTL; nếu cần thu hồi ngay khi đổi grant, dùng download gateway kiểm tra quyền mỗi lượt thay vì chỉ dựa vào signed URL. Ghi rõ lựa chọn trong ADR và test tương ứng.
- Job import/report/outbox có retry bounded, dedupe và trạng thái lỗi; request ID xuyên suốt. Không rollback transaction đã thành công chỉ vì gửi tin thất bại.
- Backup DB và ảnh/file liên quan; script restore có kiểm tra tham chiếu và số liệu. Tần suất, retention, RPO/RTO là quyết định vận hành cần chốt, không tự hứa SLA.
- Có migration sạch, seed quyền/danh mục mẫu, cấu hình dev/test/prod tách nhau; không seed password mẫu vào production.
- Không yêu cầu microservices hoặc hạ tầng phân tán. Thiết kế đủ transaction và ranh giới module; chọn kiến trúc vừa đủ cho quy mô thực sau khi biết tải.

## 12. Những điểm cần chốt trước production

| ID      | Cần quyết định/đầu vào                                                                        | Demo PROPOSED / xử lý khi chưa có                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| OPEN-01 | Lúc cộng/trừ tồn; thiếu/thừa/hỏng/hoàn hàng; tồn âm; tồn đầu kỳ                               | Policy mục 7; thiếu/thừa giữ case, không tự xóa hoặc tạo hàng. Production posting chặn bằng `POLICY_NOT_CONFIGURED` đến khi duyệt |
| OPEN-02 | Ai đổi nguồn khi nguồn không đáp ứng? Được đổi phiếu ở trạng thái nào?                        | Permission riêng; thao tác đổi đơn thực hiện khóa production; vẫn cho cấu hình nguồn tương lai theo quyền Admin                   |
| OPEN-03 | Ai đóng phiếu còn thiếu, xác nhận báo hỏng, duyệt/post điều chỉnh tồn? Có cần khác người lập? | Demo Quản lý tổng được resolve/close trong scope; không tự cấp quyền chỉnh tồn. Production bật từng action sau khi chốt           |
| OPEN-04 | Kho riêng/chung của Bếp/Bàn, phân bổ tiêu thụ, giờ chốt ngày, mở lại kiểm kê, cập nhật muộn?  | Demo kho riêng theo bộ phận; snapshot theo cutoff; giữ version; không cộng đôi tồn vật lý hoặc tự sửa kỳ đã submit                |
| OPEN-05 | API hay file iPOS, credentials/mẫu dữ liệu, mapping món/cơ sở, hủy/hoàn/combo/định mức        | Adapter + fixtures/staging. Không coi dữ liệu thiếu là 0; đánh dấu `DATA_INCOMPLETE`                                              |
| OPEN-06 | Ngưỡng hao hụt theo lượng hay %, theo cơ sở/hàng/bộ phận; lịch nhắc giao bù                   | Demo rule có nhãn test; chưa bật cảnh báo vận hành khi chưa có ngưỡng                                                             |
| OPEN-07 | Mẫu/định dạng export, cách nhập đơn giá, ai ghi nhận payment                                  | Demo CSV và giá do user có quyền nhập; production theo mẫu và quyền đã được duyệt                                                 |
| OPEN-08 | Ảnh bắt buộc khi nào; loại/cỡ file; tài khoản dùng email/username/điện thoại                  | Demo username/password, ảnh cho chênh lệch/hỏng; không tự thêm OTP/SMS có phí                                                     |
| OPEN-09 | Số cơ sở/user/phiếu/ngày, dung lượng, máy chủ, backup/retention                               | Cấu hình môi trường; chưa cam kết SLA hoặc khả năng tải cụ thể                                                                    |

Agent ghi quyết định được xác nhận vào `docs/decisions.md`: ID, quyết định, người xác nhận, ngày, ảnh hưởng schema/API/test. Chỉ khóa action phụ thuộc quyết định thiếu; tiếp tục làm module độc lập. Feature flag production không thay thế việc hoàn thiện scope khi quyết định/đầu vào đã được cung cấp.

## 13. Acceptance tests cần triển khai

Đây là test nghiệp vụ/ủy quyền/transaction, không chỉ test CRUD mirror implementation. Test OPEN dùng policy fixture có nhãn proposal; cập nhật khi khách chốt.

| ID    | Tình huống                                                                        | Kết quả bắt buộc                                                                      |
| ----- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| AT-01 | Một nguyên liệu, hai supplier; chi nhánh A dùng kho, B dùng supplier              | Không nhân bản nguyên liệu; tạo đúng nguồn và đúng đơn con                            |
| AT-02 | Xin hàng chưa được cấp hoặc không có source                                       | Chặn đúng dòng, không tự chọn nguồn                                                   |
| AT-03 | Nguồn/quy đổi đổi sau submit trước approve                                        | Conflict; không âm thầm sửa đơn                                                       |
| AT-04 | Một request có dòng kho và hai supplier                                           | Các đơn con đúng lineage; tổng lượng bằng lượng duyệt; mỗi supplier chỉ thấy đơn mình |
| AT-05 | Nhân sự chi nhánh tự gọi approve                                                  | Từ chối dù UI có/không có nút; grant xem/sửa không cho quyền duyệt                    |
| AT-06 | User có scope A/Bếp và B/Bàn                                                      | Không được truy cập A/Bàn hoặc B/Bếp do trộn scope                                    |
| AT-07 | Supplier đổi ID/query, mở file, export, count hoặc notification của supplier khác | Không trả dữ liệu hoặc metadata ngoài scope                                           |
| AT-08 | Đơn 100 kg, nhận 60 rồi 40 vào ngày sau                                           | Chờ giao bù sau lần đầu; hoàn thành sau lần hai; tổng tồn nhận 100, không 160         |
| AT-09 | Nhận vượt phần còn lại                                                            | Tạo/chặn theo exception policy; không tự cộng thừa vào tồn                            |
| AT-10 | Transfer xuất 10, nhận 8                                                          | Kho gửi -10, kho nhận +8, đang vận chuyển 2; không mất dấu 2                          |
| AT-11 | Kho tổng ↔ Bếp tổng và chi nhánh ↔ chi nhánh                                      | Luồng đầu không cần QLT duyệt; luồng sau bắt buộc; cờ client không bypass được        |
| AT-12 | Retry cùng post hoặc hai user nhận đồng thời                                      | Một posting duy nhất; không vượt lượng còn lại; balance khớp ledger                   |
| AT-13 | DB transaction lỗi giữa posting                                                   | Không còn ledger/balance/status/audit nửa chừng; không gửi notification               |
| AT-14 | Đổi source rule, giá, đơn vị sau giao hàng                                        | Lịch sử/đơn đã giao không đổi; đổi phần còn lại giữ lineage                           |
| AT-15 | Đóng thiếu hoặc cancel đơn có ledger                                              | Cần quyền/lý do; giữ original/received/closed quantities; không xóa tồn               |
| AT-16 | Tạo báo hỏng/submit kiểm kê                                                       | Không tự điều chỉnh tồn hoặc tự cấp quyền xem hao hụt                                 |
| AT-17 | Thiếu recipe, iPOS mapping hoặc dữ liệu                                           | `DATA_INCOMPLETE`; không coi bằng 0 hoặc phát cảnh báo hao hụt sai                    |
| AT-18 | Import lại cùng external records; sửa recipe sau ngày bán                         | Không nhân đôi bán hàng; kết quả lịch sử giữ recipe version                           |
| AT-19 | Count 7, expected 9; count 11, expected 9; expected usage 0                       | Thiếu 2, dư 2, tỷ lệ null khi mẫu số 0; không double count damage/usage               |
| AT-20 | Báo cáo/export tại A và thu hồi quyền lúc user đang login                         | Không lộ B; quyền mới có hiệu lực với detail/file/notification và report              |
| AT-21 | Nhận đủ hàng, ghi trả một phần tiền                                               | Không tự PAID; trạng thái thanh toán độc lập tiến độ giao                             |
| AT-22 | Restore backup có phiếu, ledger, ảnh và permissions                               | Khôi phục được quan hệ/file và đối chiếu balance; không chứa password demo production |
| AT-23 | Bếp/Bàn ở hai kho riêng hoặc một kho chung được cấu hình                          | Mapping tiêu thụ/kiểm kê đúng nơi; không cộng/trừ hai lần cùng tồn vật lý             |

## 14. Thứ tự triển khai và Definition of Done

1. Đọc repo; ghi architecture/ADR, schema, danh sách permission seed và các OPEN. Không đổi quyết định đã chốt trong scope.
2. Auth + scope/RBAC + cơ sở/danh mục/quy đổi + eligibility/source; test truy cập chéo trước.
3. Request/approval/đơn con + supplier read-only + export demo; kiểm tra snapshot và lineage.
4. Dispatch/receipt/partial/giao bù + transaction/ledger/idempotency/audit/notification; đạt luồng dùng thử.
5. Transfer đầy đủ, discrepancy/close, kiểm kê/báo hỏng, iPOS/recipe/variance, payment tracking và báo cáo.
6. Chốt OPEN, migration và validation; kiểm thử tích hợp, backup/restore, tài liệu bàn giao.

DoD mỗi module:

- Migration và ràng buộc; permission + scope ở server; validation + state transition; audit và error codes.
- API docs và fixture; tests happy path, unauthorized/cross-scope, invalid state và retry/concurrency nếu module có posting.
- Không TODO cốt lõi bị che bằng response thành công, không mock ở production, không hardcode supplier/user ID.
- Seed demo: kho tổng, Bếp tổng, hai chi nhánh có Bếp/Bàn, hai supplier, các nhóm role; nguyên liệu đa nguồn và đơn giao thiếu qua ngày.
- Có file hướng dẫn chạy, `.env.example`, migrate/seed/test, deploy, backup/restore; báo rõ module xong và blocker còn lại.

### Prompt ngắn để giao agent

```text
Hãy triển khai backend DICA theo DICA_BACKEND_REQUIREMENTS.md trong repository này.
Trước khi code, đọc AGENTS.md và cấu trúc hiện có. Giữ nguyên scope CONFIRMED;
ghi ADR cho thiết kế PROPOSED và liệt kê OPEN chưa có đầu vào. Làm module độc lập
trước, chỉ chặn hành động phụ thuộc quyết định nghiệp vụ thiếu; không tự bịa quy tắc.
Ưu tiên luồng thử: auth/RBAC → cấu hình nguồn → xin/duyệt → kho xuất hoặc supplier
xem đơn → nhận thực tế/giao bù. Server phải kiểm tra permission và scope trên cả
API, report, export, file và notification. Ledger/receipt phải transaction-safe,
idempotent, không sửa lịch sử. Xuất migration, seed, OpenAPI, tests nghiệp vụ và
hướng dẫn chạy. Báo tiến độ bằng module hoàn thành, tests chạy và blocker thực tế;
không tự cắt các module còn lại khỏi scope sau khi có bản thử.
```

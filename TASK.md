# Tiến độ DICA Backend

Cập nhật: 09/10/2026.

Nguồn nghiệp vụ là [câu trả lời khách ngày 08/10](docs/customer-flow-questions-response.md), ưu tiên hơn [new-flow.md](new-flow.md). File này thay backlog cũ; quyết định đã chốt không cần hỏi lại. Chi tiết bằng chứng nằm trong [review](docs/new-flow-implementation-review.md) và [contract mobile](docs/mobile-integration.md).

## Trạng thái hiện tại

Backend và Web Admin đã có code cho cấu hình và các quy tắc chính. Chưa hoàn thành toàn bộ sản phẩm: workspace chưa có source mobile; iPOS, ảnh/push thật và xuất PDF cho NCC còn cần triển khai hoặc kiểm thử.

“Đã có” dưới đây nghĩa là có code/API và kiểm tra local, không có nghĩa đã nghiệm thu trên production hoặc thiết bị thật.

## Theo dõi các task flow

Giữ mã FLOW để đối chiếu backlog trước đây.

| Task                                   | Trạng thái                    | Kết quả và việc còn lại                                                                                                                                                     |
| -------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FLOW-01 — Quyền và nhóm hàng           | Đã có BE/Web                  | Bộ quyền bootstrap v4, role/grant theo scope, eligibility nhóm và ngoại lệ từng hàng. Khi triển khai phải kiểm tra tài khoản thực tế được cấp đúng quyền.                   |
| FLOW-02 — Nhà cung cấp                 | Đã có BE/contract             | Dùng chung mobile, chỉ đọc đơn/giá của chính NCC; chặn API nội bộ. Chưa có màn hình mobile để kiểm thử.                                                                     |
| FLOW-03 — Vòng đời phiếu               | Đã có BE                      | Phiếu từ chối phải tạo mới; hủy đúng quyền trước nhận đã ghi sổ. Nghiệp vụ thực hiện trên mobile, Web chỉ cấu hình.                                                         |
| FLOW-04 — Hoàn hàng                    | Đã có BE/contract             | Hoàn một phần về nguồn cấp, ảnh hàng cùng hóa đơn, duyệt và chốt tồn/tiền cuối ngày duyệt; có test retry. Còn kiểm thử màn hình mobile.                                     |
| FLOW-05 — Thiếu/thừa/giao bù           | Đã có BE                      | Bù nhiều lần trong ngày; 00:00 giờ Việt Nam đóng thiếu; thừa cộng tồn; mỗi lần nhận/bù cần 1–10 ảnh.                                                                        |
| FLOW-06 — Giá/thanh toán               | Đã có BE/Web cấu hình         | Lưu giá NCC, giá chuẩn/ngưỡng, số ngày thanh toán và tùy chọn xác nhận hai người; đối soát theo lượng thực giữ lại.                                                         |
| FLOW-07 — Báo hỏng/kiểm kê/tồn         | Đã có BE                      | Báo hỏng giảm tồn khi gửi một lần; kiểm kê mù, quyền riêng xem lệch/điều chỉnh, lịch sử lệch đỏ; cho tồn âm.                                                                |
| FLOW-08 — Điều chuyển                  | Đã có BE                      | Kho tổng ↔ Bếp tổng tự duyệt và thông báo; Chi nhánh ↔ Chi nhánh, Bếp tổng ↔ Chi nhánh cần duyệt; chặn Chi nhánh ↔ Kho tổng trực tiếp; ETA bắt đầu/kết thúc.                |
| FLOW-09 — Xóa/ngừng sử dụng            | Đã có BE/Web                  | Ngừng sử dụng giữ lịch sử; xóa vĩnh viễn chỉ ADMIN, có preview phạm vi và mật khẩu.                                                                                         |
| FLOW-10 — NCC ưu tiên/nguồn hàng       | Đã có BE/Web                  | Một NCC ưu tiên hoạt động cho mỗi hàng; nguồn thực tế theo source rule. Không tự đổi nguồn đơn đã duyệt.                                                                    |
| FLOW-11 — Thông báo                    | Có BE; chưa xong mobile       | Inbox/push theo quyền, nhắc mỗi giờ đến khi đọc; kiểm tra lại quyền trước đọc/gửi. Alarm native và FCM thật chưa nghiệm thu.                                                |
| FLOW-12 — Phiếu NCC dạng PDF/ảnh       | Chưa triển khai               | Cần mẫu phiếu và endpoint xuất được phân quyền; JSON/CSV không thay thế yêu cầu này.                                                                                        |
| FLOW-13 — Thiếu hàng qua ngày          | Đã có BE theo quyết định mới  | Worker đóng phần thiếu từ 00:00, không tiếp tục giao bù sang ngày mới; có retry/test. Backlog cũ về giữ thiếu qua ngày đã được thay thế.                                    |
| FLOW-14 — iPOS thật                    | Chờ tích hợp                  | Có mapping/định mức/import thủ công và hủy bản ghi import có audit/thông báo; chưa có adapter iPOS hoặc mapping hủy toàn hóa đơn.                                           |
| FLOW-15 — Cảnh báo tồn/hao hụt tự động | Chưa hoàn thành               | Rule mới đang `testOnly=true`, `active=false`; chưa có job đánh giá và gửi cảnh báo vận hành theo rule. Cảnh báo lệch kiểm kê và cảnh báo giá là các chức năng riêng đã có. |
| FLOW-16 — Ảnh chứng từ                 | Có BE/contract; cần test thật | R2 private, upload presigned/finalize, đọc qua API Bearer và quyền tài nguyên; thời hạn 6–12 tháng. Nghiệp vụ ảnh nằm ở mobile; Web chỉ cấu hình chính sách.                |
| FLOW-17 — Chất lượng Web/hướng dẫn     | Đạt kiểm tra local            | Bỏ modern-tour; hướng dẫn 6 bước, 19 link đúng route/tab; lint/typecheck/build đạt. Chưa kiểm thử màn hình nhỏ trên thiết bị.                                               |

## Việc còn phải làm

- [ ] Mobile: triển khai/đối chiếu màn hình nghiệp vụ, không gian NCC, camera/ảnh, version/idempotency khi retry và alarm native Android/iOS.
- [ ] iPOS: lấy giao thức và môi trường thử; mapping cơ sở/món/hóa đơn; adapter incremental/idempotent; kiểm thử hủy toàn hóa đơn có audit/thông báo. Hoàn món/combo ngoài phạm vi hiện tại.
- [ ] Cảnh báo tồn/hao hụt: chốt ngưỡng/lịch/cooldown/người nhận còn thiếu, triển khai job và test dedupe/quyền; chỉ bật rule vận hành khi đã kiểm thử.
- [ ] Phiếu NCC ngoài app: chốt mẫu hóa đơn/PDF/ảnh và triển khai export đúng phạm vi, không lộ dữ liệu nội bộ.
- [ ] Hạ tầng thật: smoke test upload/read/expire R2 private, FCM/APNs, worker 00:00, reminder và thu hồi quyền; kiểm tra public domain R2 đã tắt.
- [ ] Nghiệm thu: test toàn luồng trên thiết bị và tài khoản thực tế, kiểm tra quyền, backup/restore và theo dõi log sau deploy.

## Kết quả kiểm tra local

Ngày 09/10/2026:

- Backend: typecheck/build/format đạt; 76/76 test đạt trên PostgreSQL riêng đã migrate, không bỏ qua test.
- Web: lint/typecheck/build đạt; kiểm tra hướng dẫn trên trình duyệt desktop và đối chiếu 19 link.
- OpenAPI lịch sử `/audit-events` có audience BOTH; audit dependency production không phát hiện lỗ hổng ở cả hai repo.
- Migration `202610090005_notification_permission` đã áp dụng vào database local và test; bootstrap quyền hiện hành là v4.

## Release và CI

- [x] Cấu hình CI Backend có PostgreSQL test, migrate và `TEST_DATABASE_URL` để chạy test flow.
- [x] Compose Backend chạy migrate và bootstrap trước khi bật API. Migration 005 thuộc lần phát hành này.
- [ ] Xác nhận GitHub Actions của commit mới chạy thành công.
- [ ] Xác nhận deploy production, healthcheck và smoke test sau deploy.

Push `main` kích hoạt CI, build image và deploy nếu environment/secrets production đủ điều kiện. Hai mục cuối chỉ đánh dấu hoàn thành khi có kết quả thực tế; kiểm tra local không thay thế CI/deploy.

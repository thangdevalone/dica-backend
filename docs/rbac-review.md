# RBAC sau sửa ngày 09/10/2026

Phạm vi: Backend và Web Admin. Đây là kiểm tra code/test, chưa phải chứng nhận an toàn hoặc nghiệm thu mobile/production.

## Quy tắc đang áp dụng

- Backend kiểm tra permission và scope mỗi request; grants/quyền được đọc lại từ database. Web kiểm tra để hướng dẫn người dùng, API vẫn là nơi quyết định quyền.
- Tạo tài khoản, cấp grant và sửa role không được mở rộng quyền đang có ở cấp tổ chức. Quyền chỉ có tại một cơ sở/kho/bộ phận không được chuyển thành quyền cấp tổ chức qua quản trị role.
- Chỉ ADMIN_OWNER cấp tổ chức được quản lý ADMIN hoặc cấp ADMIN mới. ADMIN chỉ được cấp scope ORGANIZATION. Không được tự tạo role tùy chỉnh dùng mã hệ thống.
- Người quản trị thường chỉ được quản lý tài khoản mà mọi role đang cấp không vượt quyền cấp tổ chức của mình. Áp dụng cả reset mật khẩu, sửa, kích hoạt/vô hiệu hóa và quản lý grant.
- Vô hiệu hóa tài khoản/thu hồi grant phải giữ ít nhất một ADMIN hoạt động ở scope tổ chức. Kiểm tra và ghi dữ liệu cùng transaction có khóa tổ chức, kể cả hai yêu cầu đồng thời.
- Guard mặc định từ chối endpoint thiếu chính sách. Endpoint public khai báo `Public`; endpoint hồ sơ/phiên của chính người đăng nhập khai báo `Authenticated`; endpoint nghiệp vụ khai báo `RequirePermissions`. Test kiểm tra mọi controller.

## Web khi quyền thay đổi

- Lọc role/tài khoản/nút thao tác theo giới hạn quản trị cấp tổ chức; không hiển thị thao tác quản trị ADMIN cho Quản lý tổng.
- Nạp lại hồ sơ/quyền khi vào trang, quay lại tab và mỗi 30 giây khi tab hiện. Sau sửa role/grant hoặc nhận 403 thì đồng bộ lại; không retry command bị từ chối quyền.
- Nếu tài khoản, permission hoặc scope đổi, tăng phiên bản cache, hủy query đang chạy và xóa query/mutation cache. Profile trả về sau khi phiên đã đổi không được ghi đè phiên mới.
- Thu hồi grant làm token/phiên cũ mất hiệu lực. Nếu không refresh được, Web xóa phiên và yêu cầu đăng nhập lại.

## Kiểm chứng

- Backend: 84/84 test đạt trên PostgreSQL đã migrate, không skip; typecheck/build/format đạt.
- Test mới chặn reset/vô hiệu hóa ADMIN bởi Quản lý tổng, tự cấp ADMIN, tạo tài khoản có quyền cao hơn, nâng scope và role giả dùng mã ADMIN.
- Test cho phép cấp quyền hợp lệ/reset nhân viên; chặn thu hồi ADMIN cuối cùng; hai yêu cầu thu hồi/vô hiệu hóa đồng thời chỉ một yêu cầu được ghi dữ liệu.
- Web: 3 test quyền/fingerprint đạt; lint/typecheck/build đạt. Kiểm tra thêm store thật xác nhận đổi permission/scope/tài khoản hoặc logout làm đổi phiên bản cache; đổi tên hiển thị giữ cache.
- CI Web bổ sung `npm test`. Thay đổi này không cần migration hoặc đổi bộ quyền bootstrap v4.

Kiểm thử mobile, các scope/tài khoản thực tế và deploy vẫn theo [TASK](../TASK.md). Web đồng bộ định kỳ tối đa 30 giây khi đang mở; Backend kiểm tra quyền hiện hành trên request mới.

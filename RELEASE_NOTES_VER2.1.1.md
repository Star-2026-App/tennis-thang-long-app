# Release Notes — Ver2.1.1 PERFORMANCE TEST

- Nền tảng: Ver2.1.0 FULL đã chốt.
- Mục tiêu: giảm độ trễ đăng nhập, refresh và ghi dữ liệu; chống cảnh báo kết nối giả; giảm tải CUP.
- Tương thích dữ liệu: giữ nguyên các Sheet và dữ liệu CUP hiện có.
- Bảo mật/quyền: giữ nguyên Owner/Admin/Member và cơ chế idempotency.
- Yêu cầu sau cập nhật Backend: chạy một lần `installDailyMaintenanceTrigger`.
- Yêu cầu sau cập nhật Frontend: `npm install` để cài `@vercel/functions`.
- Trạng thái kiểm thử tĩnh: syntax toàn bộ Backend/Frontend PASS; Performance Regression PASS; CUP Logic PASS; CUP Frontend PASS.

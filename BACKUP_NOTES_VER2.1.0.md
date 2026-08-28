# CLB Tennis Thăng Long — Ghi chú phiên bản nền Ver2.1.0

Ngày chốt mã nguồn: 27/08/2026.

## Trạng thái

- Phiên bản: **Ver2.1.0**.
- Trạng thái kiểm thử: **TEST PASS**.
- Chưa merge hoặc triển khai lên Production.
- Production hiện tại không bị thay đổi bởi gói backup này.

## Nội dung gói

- `Frontend/`: toàn bộ mã nguồn Vercel/PWA.
- `Backend/`: toàn bộ mã nguồn Google Apps Script.
- `Tests/`: kiểm thử logic và giao diện CUP.
- `HUONG_DAN_TRIEN_KHAI_VER2.1.1_PERFORMANCE_TEST.md`: hướng dẫn triển khai bản tối ưu kế tiếp.

## Chức năng chính của Ver2.1.0

- Toàn bộ chức năng ổn định từ Ver2.0.9, gồm trình soạn thảo Rich Text.
- Giải đấu CUP đánh đôi: đăng ký người chơi, bốc/ghép cặp, chia bảng, lịch đấu, xếp hạng và vòng loại trực tiếp.
- Thành viên nhập kết quả lần đầu; Admin/Owner được sửa kết quả.
- Dữ liệu CUP lưu riêng tại sheet `CupTournament`, không ảnh hưởng trận thường, tiền góc hoặc thành tích CLB.
- Mobile tự ưu tiên CUP khi giải được kích hoạt và đưa Sổ Thu Chi vào mục Thêm; reset CUP sẽ khôi phục menu bình thường.
- Ô tìm kiếm người chơi CUP trên Mobile đã được thu gọn.

## Kiểm thử tại thời điểm backup

- `CUP_LOGIC_TEST_PASS`.
- `CUP_FRONTEND_TEST_PASS`.
- `CUP_MOBILE_SEARCH_CSS_TEST_PASS`.
- Cú pháp JavaScript Frontend: PASS.
- Cú pháp Apps Script Backend: PASS.

## Lưu ý triển khai

Gói backup không chứa giá trị bí mật của Vercel hoặc Apps Script. Khi khôi phục/triển khai, tiếp tục dùng các Environment Variables và Script Properties đã cấu hình riêng cho Preview và Production.

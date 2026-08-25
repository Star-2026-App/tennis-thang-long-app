// ======================================================
// /api/send-push - ĐÃ NGƯNG DÙNG TỪ v2.0
// ======================================================
//
// Đây chính là lỗ hổng #8 (điểm yếu nghiêm trọng) trong bản v1.6:
// endpoint này KHÔNG yêu cầu session/API key, cho phép BẤT KỲ ai
// biết URL gửi title/body/danh sách subscription tuỳ ý, tức là
// giả mạo thông báo đẩy cho toàn bộ thiết bị đã đăng ký.
//
// Từ v2.0, việc gửi push CHỈ xảy ra ở server, sau khi Apps Script
// đã xác nhận commit một hành động nghiệp vụ, hoặc qua endpoint
// có xác thực role Admin/Owner:
//   - Tự động sau commit: frontend/api/_lib/pushSender.js
//     (gọi từ frontend/api/actions/write.js)
//   - Thông báo thủ công: POST /api/push/broadcast (yêu cầu
//     session hợp lệ + role Admin/Owner)
//
// File này được GIỮ LẠI CHỦ ĐÍCH (không xoá) chỉ để trả lỗi rõ
// ràng cho bất kỳ client cũ nào (frontend v1.6 chưa cập nhật,
// cache trình duyệt cũ...) còn gọi tới đường dẫn cũ, thay vì để
// route biến mất âm thầm (404 dễ gây nhầm lẫn là do cấu hình sai).
// ======================================================

module.exports = async function handler(req, res) {
  res.status(410).json({
    status: "ERROR",
    message: "Endpoint này đã ngưng dùng vì lý do bảo mật. Vui lòng cập nhật ứng dụng lên phiên bản mới (API mới: /api/actions/write, /api/push/broadcast)."
  });
};

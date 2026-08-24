// ======================================================
// POST /api/push/broadcast (v2.0) - Admin/Owner
// ======================================================
//
// Thay thế triggerClubPushNotification()/api/send-push.js cũ.
// KHÁC BIỆT CỐT LÕI với v1.6 (sửa điểm yếu #8):
//   - Bắt buộc session hợp lệ, và role phải >= admin (xác minh
//     THẬT qua action nghiệp vụ "whoAmI" - không tin role client
//     tự khai).
//   - Trình duyệt KHÔNG BAO GIỜ thấy danh sách subscription/khoá
//     của người khác - server tự lấy nội bộ rồi gửi.
//   - title/body bị cắt độ dài và không được chèn HTML (frontend
//     hiển thị bằng textContent, xem notifications.js v2.0).
// ======================================================

const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");
const pushSender = require("../_lib/pushSender");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return http.methodNotAllowed(res, ["POST"]);

  try {
    var sessionId = http.requireSessionId(req);
    var body = http.getJsonBody(req);

    var title = String(body.title || "").trim();
    var text = String(body.body || "").trim();

    if (!title || !text) {
      return http.sendJson(res, 400, { status: "ERROR", message: "Thiếu tiêu đề hoặc nội dung thông báo." });
    }

    var who = await appsScript.callBusinessAction(sessionId, "whoAmI", {});

    if (who.role !== "admin" && who.role !== "owner") {
      return http.sendJson(res, 403, { status: "ERROR", message: "Unauthorized: Chỉ Admin/Owner được gửi thông báo cho cả CLB." });
    }

    var sendResult = await pushSender.sendBroadcast(title, text);

    return http.sendJson(res, 200, { status: "SUCCESS", result: sendResult });

  } catch (err) {
    return http.sendError(res, err);
  }
};

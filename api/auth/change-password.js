// ======================================================
// POST /api/auth/change-password (v2.0)
// ======================================================
// Đổi mật khẩu CHÍNH MÌNH (bắt buộc sau bootstrap / theo yêu cầu
// Owner/Admin đặt mustChangePassword). Việc "Admin đặt lại mật
// khẩu cho người khác" đi qua action nghiệp vụ "resetMemberPassword"
// (api/actions/write.js), không qua route này.
// ======================================================

const bcrypt = require("bcryptjs");
const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return http.methodNotAllowed(res, ["POST"]);

  try {
    var sessionId = http.requireSessionId(req);
    var body = http.getJsonBody(req);

    var newPassword = String(body.newPassword || "");

    if (newPassword.length < 6 || newPassword.length > 200) {
      return http.sendJson(res, 400, {
        status: "ERROR",
        message: "Mật khẩu mới phải có ít nhất 6 ký tự."
      });
    }

    var newPasswordHash = bcrypt.hashSync(newPassword, 10);

    var idempotencyKey = "changepw-" + sessionId + "-" + Date.now();

    var result = await appsScript.callBusinessAction(
      sessionId, "changeOwnPassword", { newPasswordHash: newPasswordHash }, idempotencyKey
    );

    // Đổi mật khẩu xong -> AuthService.setMemberPasswordHash_ đã tự
    // thu hồi TOÀN BỘ session cũ (kể cả session hiện tại đang dùng
    // để gọi request này) - buộc đăng nhập lại bằng mật khẩu mới,
    // đúng yêu cầu P1 "Thu hồi session khi đổi mật khẩu/role".
    http.clearSessionCookie(res);

    return http.sendJson(res, 200, { status: "SUCCESS", result: result });

  } catch (err) {
    return http.sendError(res, err);
  }
};

// ======================================================
// GET /api/auth/session (v2.0)
// ======================================================
// Cho frontend hỏi "tôi có đang đăng nhập không, tôi là ai".
// KHÔNG tin bất kỳ thứ gì trình duyệt tự khai - luôn tra lại qua
// action "whoAmI" (Apps Script tự tra AuthSessions + Members).
// ======================================================

const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return http.methodNotAllowed(res, ["GET"]);

  try {
    var sessionId = http.getSessionIdFromRequest(req);

    if (!sessionId) {
      return http.sendJson(res, 200, { status: "SUCCESS", authenticated: false });
    }

    var who = await appsScript.callBusinessAction(sessionId, "whoAmI", {});

    return http.sendJson(res, 200, {
      status: "SUCCESS",
      authenticated: true,
      stt: who.stt,
      name: who.name,
      role: who.role,
      mustChangePassword: !!who.mustChangePassword
    });

  } catch (err) {
    // Session hỏng/hết hạn -> coi như chưa đăng nhập, không phải lỗi 401
    // ồn ào cho một trạng thái rất bình thường (vừa hết hạn phiên).
    http.clearSessionCookie(res);
    return http.sendJson(res, 200, { status: "SUCCESS", authenticated: false });
  }
};

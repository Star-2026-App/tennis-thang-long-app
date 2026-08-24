// ======================================================
// POST /api/auth/logout (v2.0)
// ======================================================
// Thu hồi session thật ở Apps Script (không chỉ xoá cookie ở
// trình duyệt như v1.6) rồi xoá cookie.
// ======================================================

const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return http.methodNotAllowed(res, ["POST"]);

  try {
    var sessionId = http.getSessionIdFromRequest(req);

    if (sessionId) {
      try {
        await appsScript.callSystemAction("authRevokeSession", { sessionId: sessionId });
      } catch (err) {
        console.error("LOGOUT REVOKE ERROR:", err && err.message);
      }
    }

    http.clearSessionCookie(res);
    return http.sendJson(res, 200, { status: "SUCCESS" });

  } catch (err) {
    return http.sendError(res, err);
  }
};

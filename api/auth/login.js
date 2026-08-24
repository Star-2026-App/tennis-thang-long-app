// ======================================================
// POST /api/auth/login (v2.0)
// ======================================================
//
// Thay thế HOÀN TOÀN auth.js cũ (mật khẩu gõ cứng "admin"/"123456",
// role gán ở biến trình duyệt). Luồng thật theo P1:
//   1. Trình duyệt gửi { username, password } tới đây.
//   2. Server kiểm tra rate limit, tra thành viên, so khớp mật
//      khẩu bằng bcrypt (hoặc bootstrap 1 lần cho Owner).
//   3. Tạo AuthSession thật ở Apps Script, trả session cookie
//      HttpOnly/Secure/SameSite - KHÔNG bao giờ trả mật khẩu/hash
//      hay bất kỳ secret nào về trình duyệt.
// ======================================================

const bcrypt = require("bcryptjs");
const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");
const sessionCookie = require("../_lib/sessionCookie");

const GENERIC_FAIL_MESSAGE = "Sai tên đăng nhập hoặc mật khẩu.";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return http.methodNotAllowed(res, ["POST"]);

  try {
    var body = http.getJsonBody(req);
    var username = String(body.username || "").trim().toLowerCase();
    var password = String(body.password || "");

    if (!username || !password || username.length > 60 || password.length > 200) {
      return http.sendJson(res, 400, { status: "ERROR", message: "Thiếu tên đăng nhập hoặc mật khẩu." });
    }

    var rateLimitKey = "login:" + username + ":" + http.clientIp(req);

    try {
      await appsScript.callSystemAction("authCheckLoginRateLimit", { key: rateLimitKey });
    } catch (err) {
      return http.sendJson(res, 429, {
        status: "ERROR",
        message: "Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau ít phút."
      });
    }

    var member = await appsScript.callSystemAction("authLookupMemberByUsername", { username: username });

    if (!member || !member.isActive) {
      await appsScript.callSystemAction("authRecordFailedLogin", { key: rateLimitKey });
      return http.sendJson(res, 401, { status: "ERROR", message: GENERIC_FAIL_MESSAGE });
    }

    var mustChangePassword = !!member.mustChangePassword;

    if (!member.passwordHash) {
      // Chưa từng đặt mật khẩu (mới nâng cấp lên v2.0).
      if (member.role === "owner") {
        var bootstrap = await appsScript.callSystemAction("authTryOwnerBootstrap", { password: password });

        if (!bootstrap || !bootstrap.ok) {
          await appsScript.callSystemAction("authRecordFailedLogin", { key: rateLimitKey });
          return http.sendJson(res, 401, { status: "ERROR", message: GENERIC_FAIL_MESSAGE });
        }

        var newHash = bcrypt.hashSync(password, 10);
        await appsScript.callSystemAction("authSetPasswordHash", {
          stt: member.stt, passwordHash: newHash, mustChangePassword: true
        });
        mustChangePassword = true;

      } else {
        await appsScript.callSystemAction("authRecordFailedLogin", { key: rateLimitKey });
        return http.sendJson(res, 401, {
          status: "ERROR",
          message: "Tài khoản chưa được Owner/Admin thiết lập mật khẩu. Vui lòng liên hệ Owner/Admin."
        });
      }

    } else {
      var match = bcrypt.compareSync(password, member.passwordHash);

      if (!match) {
        await appsScript.callSystemAction("authRecordFailedLogin", { key: rateLimitKey });
        return http.sendJson(res, 401, { status: "ERROR", message: GENERIC_FAIL_MESSAGE });
      }
    }

    await appsScript.callSystemAction("authResetLoginAttempts", { key: rateLimitKey });

    var sessionId = sessionCookie.newSessionId();

    await appsScript.callSystemAction("authCreateSession", {
      sessionId: sessionId,
      stt: member.stt,
      name: member.name,
      role: member.role,
      userAgent: String(req.headers["user-agent"] || "").slice(0, 200)
    });

    http.setSessionCookie(res, sessionId);

    return http.sendJson(res, 200, {
      status: "SUCCESS",
      stt: member.stt,
      name: member.name,
      role: member.role,
      mustChangePassword: mustChangePassword
    });

  } catch (err) {
    return http.sendError(res, err);
  }
};

// ======================================================
// /api/auth/:action (v2.0)
// ======================================================
// Gộp 4 route auth (session/login/change-password/logout) vào 1 file
// duy nhất bằng route động của Vercel ([action].js) - KHÔNG đổi bất kỳ
// URL nào frontend đang gọi. Lý do gộp: xem ghi chú đầu file
// api/data/[type].js (giới hạn 12 Serverless Functions của gói Hobby).
// ======================================================

const bcrypt = require("bcryptjs");
const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");
const sessionCookie = require("../_lib/sessionCookie");

const GENERIC_FAIL_MESSAGE = "Sai tên đăng nhập hoặc mật khẩu.";
const LOGIN_UPSTREAM_TIMEOUT_MS = 15000;

function isLoginRateLimitError_(err) {
  return !!(
    err && err.isAppError &&
    /tạm khoá|đăng nhập sai quá nhiều|thử lại sau\s+\d+\s+phút/i.test(err.message || "")
  );
}

module.exports = async function handler(req, res) {
  var action = req.query && req.query.action;

  try {

    if (action === "session") {
      // GET /api/auth/session - cho frontend hỏi "tôi có đang đăng
      // nhập không, tôi là ai". KHÔNG tin bất kỳ thứ gì trình duyệt tự
      // khai - luôn tra lại qua action "whoAmI" (Apps Script tự tra
      // AuthSessions + Members).
      if (req.method !== "GET") return http.methodNotAllowed(res, ["GET"]);

      var sessionId = http.getSessionIdFromRequest(req);

      if (!sessionId) {
        return http.sendJson(res, 200, { status: "SUCCESS", authenticated: false });
      }

      try {
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
        // Session hỏng/hết hạn -> coi như chưa đăng nhập, không phải
        // lỗi 401 ồn ào cho một trạng thái rất bình thường.
        http.clearSessionCookie(res);
        return http.sendJson(res, 200, { status: "SUCCESS", authenticated: false });
      }
    }

    if (action === "login") {
      // POST /api/auth/login - thay thế HOÀN TOÀN cơ chế mật khẩu gõ
      // cứng "admin"/"123456" của v1.6. Xem chi tiết luồng P1 trong
      // CHANGELOG_v2.md / DESIGN_V2.md.
      if (req.method !== "POST") return http.methodNotAllowed(res, ["POST"]);

      var body = http.getJsonBody(req);
      var username = String(body.username || "").trim().toLowerCase();
      var password = String(body.password || "");

      if (!username || !password || username.length > 60 || password.length > 200) {
        return http.sendJson(res, 400, { status: "ERROR", message: "Thiếu tên đăng nhập hoặc mật khẩu." });
      }

      var rateLimitKey = "login:" + username + ":" + http.clientIp(req);

      var prepared;

      try {
        // Tối ưu: 1 lượt Apps Script thay cho 2 lượt tuần tự
        // authCheckLoginRateLimit -> authLookupMemberByUsername.
        prepared = await appsScript.callSystemAction("authPrepareLogin", {
          key: rateLimitKey,
          username: username
        }, { timeoutMs: LOGIN_UPSTREAM_TIMEOUT_MS });
      } catch (err) {
        if (isLoginRateLimitError_(err)) {
          // Apps Script đã xác nhận ĐÚNG là bị khoá đăng nhập tạm thời
          // (quá số lần sai cho phép trong khung thời gian - xem
          // RateLimitService.gs.txt) - đây mới là lỗi nghiệp vụ thật.
          return http.sendJson(res, 429, {
            status: "ERROR",
            message: err.message || "Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau ít phút."
          });
        }

        // Giữ nguyên loại lỗi từ transport: timeout sẽ ra 504, mất kết
        // nối ra 502. Không đổi chúng thành lỗi khóa tài khoản.
        throw err;
      }

      var member = prepared && prepared.member;

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

      var sessionId2 = sessionCookie.newSessionId();

      // Tối ưu: 1 lượt Apps Script thay cho 2 lượt tuần tự
      // authResetLoginAttempts -> authCreateSession.
      await appsScript.callSystemAction("authCompleteLogin", {
        key: rateLimitKey,
        sessionId: sessionId2,
        stt: member.stt,
        name: member.name,
        role: member.role,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 200)
      }, { timeoutMs: LOGIN_UPSTREAM_TIMEOUT_MS });

      http.setSessionCookie(res, sessionId2);

      return http.sendJson(res, 200, {
        status: "SUCCESS",
        stt: member.stt,
        name: member.name,
        role: member.role,
        mustChangePassword: mustChangePassword
      });
    }

    if (action === "change-password") {
      // POST /api/auth/change-password - đổi mật khẩu CHÍNH MÌNH (bắt
      // buộc sau bootstrap / theo yêu cầu Owner/Admin đặt
      // mustChangePassword). "Admin đặt lại mật khẩu cho người khác"
      // đi qua action nghiệp vụ "resetMemberPassword"
      // (api/actions/write.js), không qua route này.
      if (req.method !== "POST") return http.methodNotAllowed(res, ["POST"]);

      var cpSessionId = http.requireSessionId(req);
      var cpBody = http.getJsonBody(req);

      var newPassword = String(cpBody.newPassword || "");

      if (newPassword.length < 6 || newPassword.length > 200) {
        return http.sendJson(res, 400, {
          status: "ERROR",
          message: "Mật khẩu mới phải có ít nhất 6 ký tự."
        });
      }

      var newPasswordHash = bcrypt.hashSync(newPassword, 10);
      var idempotencyKey = "changepw-" + cpSessionId + "-" + Date.now();

      var cpResult = await appsScript.callBusinessAction(
        cpSessionId, "changeOwnPassword", { newPasswordHash: newPasswordHash }, idempotencyKey
      );

      // Đổi mật khẩu xong -> AuthService.setMemberPasswordHash_ đã tự
      // thu hồi TOÀN BỘ session cũ (kể cả session hiện tại) - buộc
      // đăng nhập lại bằng mật khẩu mới (P1: thu hồi session khi đổi
      // mật khẩu/role).
      http.clearSessionCookie(res);

      return http.sendJson(res, 200, { status: "SUCCESS", result: cpResult });
    }

    if (action === "logout") {
      // POST /api/auth/logout - thu hồi session THẬT ở Apps Script
      // (không chỉ xoá cookie ở trình duyệt như v1.6) rồi xoá cookie.
      if (req.method !== "POST") return http.methodNotAllowed(res, ["POST"]);

      var loSessionId = http.getSessionIdFromRequest(req);

      if (loSessionId) {
        try {
          await appsScript.callSystemAction("authRevokeSession", { sessionId: loSessionId });
        } catch (err) {
          console.error("LOGOUT REVOKE ERROR:", err && err.message);
        }
      }

      http.clearSessionCookie(res);
      return http.sendJson(res, 200, { status: "SUCCESS" });
    }

    return http.sendJson(res, 404, { status: "ERROR", message: "Không tìm thấy: " + action });

  } catch (err) {
    return http.sendError(res, err);
  }
};

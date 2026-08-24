// ======================================================
// _lib/sessionCookie.js (v2.0)
// ======================================================
//
// Cookie phiên chỉ chứa "sessionId đã ký" (HMAC-SHA256), KHÔNG
// chứa role/quyền - vì role KHÔNG được phép tin từ trình duyệt.
// Mỗi request, Apps Script tự tra AuthSessions + Members để lấy
// role "sống" (xem ClaimService.gs.txt / resolveActorFromClaim_).
// Cookie ở đây chỉ cần đảm bảo: (1) sessionId không bị giả mạo,
// (2) không đoán được sessionId của người khác.
//
// Định dạng giá trị cookie: "<sessionId>.<hmac base64url>"
// ======================================================

const crypto = require("crypto");
const env = require("./env");

function base64url_(buffer) {
  return buffer.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign_(sessionId) {
  var hmac = crypto.createHmac("sha256", env.sessionCookieSecret());
  hmac.update(sessionId);
  return base64url_(hmac.digest());
}

function buildSessionCookieValue(sessionId) {
  return sessionId + "." + sign_(sessionId);
}

// Trả về sessionId nếu hợp lệ, null nếu không (thiếu/hỏng/giả mạo).
// KHÔNG tự khẳng định session còn hạn - việc đó do Apps Script
// (AuthSessions) quyết định khi verify claim.
function readSessionIdFromCookieValue(cookieValue) {
  if (!cookieValue) return null;

  var idx = cookieValue.lastIndexOf(".");
  if (idx === -1) return null;

  var sessionId = cookieValue.slice(0, idx);
  var signature = cookieValue.slice(idx + 1);

  if (!sessionId || !signature) return null;

  var expected = sign_(sessionId);

  var a = Buffer.from(signature);
  var b = Buffer.from(expected);

  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  return sessionId;
}

function newSessionId() {
  return crypto.randomUUID();
}

module.exports = {
  buildSessionCookieValue: buildSessionCookieValue,
  readSessionIdFromCookieValue: readSessionIdFromCookieValue,
  newSessionId: newSessionId
};

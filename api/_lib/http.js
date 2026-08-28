// ======================================================
// _lib/http.js (v2.0) - helper chung cho các API route
// ======================================================

const cookies = require("./cookies");
const sessionCookie = require("./sessionCookie");
const env = require("./env");

function sendJson(res, statusCode, body) {
  res.status(statusCode).json(body);
}

function sendError(res, err) {
  var statusCode = 500;

  if (err && err.isConfigError) statusCode = 500;
  else if (err && err.isTimeoutError) statusCode = 504;
  else if (err && err.isUpstreamError) statusCode = 502;
  else if (err && err.isRetryableAppError) statusCode = 503;
  else if (err && /Unauthorized/i.test(err.message || "")) statusCode = 401;
  else if (err && err.isAppError) statusCode = 400;

  console.error("API ERROR:", err && err.message);

  sendJson(res, statusCode, {
    status: "ERROR",
    message: (err && err.message) || "Đã có lỗi xảy ra."
  });
}

function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  sendJson(res, 405, { status: "ERROR", message: "Method không được hỗ trợ." });
}

// Đọc + xác minh cookie phiên. Trả về sessionId hoặc null.
function getSessionIdFromRequest(req) {
  var jar = cookies.parseCookies(req);
  var raw = jar[env.cookieName];
  if (!raw) return null;

  return sessionCookie.readSessionIdFromCookieValue(raw);
}

// Bắt buộc phải có session hợp lệ ở tầng cookie (chưa chắc còn
// hạn - việc đó Apps Script sẽ tự kiểm tra khi verify claim).
// Ném lỗi Unauthorized nếu thiếu/hỏng cookie.
function requireSessionId(req) {
  var sessionId = getSessionIdFromRequest(req);

  if (!sessionId) {
    var err = new Error("Unauthorized: Chưa đăng nhập hoặc phiên đã hết hạn.");
    throw err;
  }

  return sessionId;
}

function setSessionCookie(res, sessionId) {
  res.setHeader(
    "Set-Cookie",
    cookies.serializeCookie(env.cookieName, sessionCookie.buildSessionCookieValue(sessionId), {
      maxAgeSeconds: env.sessionTtlHours * 60 * 60
    })
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    cookies.serializeCookie(env.cookieName, "", { clear: true })
  );
}

function getJsonBody(req) {
  var body = req.body;

  if (body === undefined || body === null) return {};

  if (typeof body === "string") {
    if (!body.trim()) return {};
    try { return JSON.parse(body); } catch (err) { return {}; }
  }

  return body;
}

function clientIp(req) {
  var xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

module.exports = {
  sendJson: sendJson,
  sendError: sendError,
  methodNotAllowed: methodNotAllowed,
  getSessionIdFromRequest: getSessionIdFromRequest,
  requireSessionId: requireSessionId,
  setSessionCookie: setSessionCookie,
  clearSessionCookie: clearSessionCookie,
  clientIp: clientIp,
  getJsonBody: getJsonBody
};

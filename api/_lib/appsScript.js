// ======================================================
// _lib/appsScript.js (v2.0)
// ======================================================
//
// Gọi Apps Script Web App theo đúng hợp đồng của Code.gs/doPost:
// POST JSON { action, claimJson, signature, data, idempotencyKey }.
//
// Đây là NƠI DUY NHẤT trong toàn bộ hệ thống Vercel gọi ra
// APPS_SCRIPT_URL - mọi API route khác đều đi qua module này,
// không tự fetch trực tiếp, để đảm bảo claim luôn được ký đúng
// cách (P1: "Apps Script nhận claim đã ký").
// ======================================================

const crypto = require("crypto");
const env = require("./env");

const CLAIM_TTL_MS = 30 * 1000; // phải < CLAIM_MAX_AGE_MS_ (60s) phía Apps Script

function base64url_(buffer) {
  return buffer.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signClaim_(claimJsonString) {
  var hmac = crypto.createHmac("sha256", env.claimSecret());
  hmac.update(claimJsonString);
  return base64url_(hmac.digest());
}

function buildBusinessClaim_(sessionId) {
  var now = Date.now();

  var claim = {
    sessionId: sessionId,
    system: false,
    iat: now,
    exp: now + CLAIM_TTL_MS
  };

  var claimJsonString = JSON.stringify(claim);
  return { claimJson: claimJsonString, signature: signClaim_(claimJsonString) };
}

function buildSystemClaim_() {
  var now = Date.now();

  var claim = {
    sessionId: null,
    system: true,
    iat: now,
    exp: now + CLAIM_TTL_MS
  };

  var claimJsonString = JSON.stringify(claim);
  return { claimJson: claimJsonString, signature: signClaim_(claimJsonString) };
}

async function postToAppsScript_(payload, options) {
  options = options || {};
  var timeoutMs = parseInt(options.timeoutMs, 10) || env.appsScriptTimeoutMs();
  var controller = new AbortController();
  var timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs);
  var res;
  var text;

  try {
    res = await fetch(env.appsScriptUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    // Giữ AbortController hoạt động cả khi đang đọc response body;
    // nếu Google mở kết nối nhưng treo không trả hết dữ liệu thì request
    // vẫn bị ngắt đúng hạn thay vì chiếm serverless function vô thời hạn.
    text = await res.text();
  } catch (err) {
    if (controller.signal.aborted || (err && err.name === "AbortError")) {
      var timeoutErr = new Error(
        "Máy chủ dữ liệu phản hồi quá chậm (quá " + Math.ceil(timeoutMs / 1000) + " giây). Vui lòng thử lại."
      );
      timeoutErr.cause = err;
      timeoutErr.isTimeoutError = true;
      timeoutErr.isUpstreamError = true;
      throw timeoutErr;
    }

    var netErr = new Error("Không kết nối được tới máy chủ dữ liệu. Vui lòng thử lại.");
    netErr.cause = err;
    netErr.isUpstreamError = true;
    throw netErr;
  } finally {
    clearTimeout(timeoutId);
  }

  var body;

  try {
    body = JSON.parse(text);
  } catch (err) {
    var parseErr = new Error("Máy chủ dữ liệu trả về phản hồi không hợp lệ.");
    parseErr.isUpstreamError = true;
    throw parseErr;
  }

  if (!body || body.status !== "SUCCESS") {
    var appErr = new Error((body && body.message) || "Thao tác thất bại.");
    appErr.isAppError = true;
    appErr.isRetryableAppError = /hệ thống đang xử lý|yêu cầu khác|tạm thời bận|vui lòng thử lại/i.test(appErr.message);
    throw appErr;
  }

  return body.result;
}

// Gọi 1 action nghiệp vụ thay mặt actor đã đăng nhập (sessionId
// lấy từ cookie đã xác minh).
async function callBusinessAction(sessionId, action, data, idempotencyKey, options) {
  var claim = buildBusinessClaim_(sessionId);

  return postToAppsScript_({
    action: action,
    claimJson: claim.claimJson,
    signature: claim.signature,
    data: data || {},
    idempotencyKey: idempotencyKey || undefined
  }, options);
}

// Gọi 1 action hệ thống (KHÔNG có sessionId - dùng cho luồng
// đăng nhập/đăng xuất/push nội bộ). Chỉ những route được liệt kê
// trong SYSTEM_ACTIONS_ ở Router.gs.txt mới được Apps Script chấp
// nhận qua đường này.
async function callSystemAction(action, data, options) {
  var claim = buildSystemClaim_();

  return postToAppsScript_({
    action: action,
    claimJson: claim.claimJson,
    signature: claim.signature,
    data: data || {}
  }, options);
}

module.exports = {
  callBusinessAction: callBusinessAction,
  callSystemAction: callSystemAction
};

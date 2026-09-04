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

// ======================================================
// (v2.1.2) Apps Script Web App đôi khi trả về redirect
// (301/302) sang URL nội dung thật (script.googleusercontent.com)
// thay vì trả kết quả trực tiếp - không phải lúc nào cũng xảy ra,
// tùy trạng thái deploy/cold-start của Google, nên lỗi này xuất
// hiện NGẮT QUÃNG, khó đoán.
//
// Theo đúng chuẩn kỹ thuật của fetch() (WHATWG Fetch spec), khi gặp
// redirect 301/302 cho 1 request KHÔNG PHẢI GET/HEAD, fetch() mặc
// định (redirect:"follow") sẽ TỰ ĐỘNG đổi phương thức của lượt gọi
// tiếp theo từ POST -> GET và XÓA LUÔN body - đây là hành vi "đúng
// chuẩn" của trình duyệt nhưng gây hại khi gọi Apps Script: lượt gọi
// thứ 2 (đã bị đổi thành GET) chạm phải doGet() của Apps Script và
// bị từ chối ngay với "GET không được hỗ trợ..." (xem Code.gs.txt
// doGet()) - lỗi này từng làm treo màn hình đăng nhập / rơi mất dữ
// liệu ở nhiều action khác nhau tùy đúng lúc nào Google trả redirect.
//
// SỬA: tự bắt redirect (redirect:"manual") và tự lặp lại ĐÚNG POST +
// ĐÚNG body gốc tới Location mới, thay vì để fetch() tự ý đổi thành
// GET. Giới hạn tối đa 3 lần theo redirect để tránh vòng lặp vô hạn
// nếu Google trả redirect bất thường.
// ======================================================

var MAX_REDIRECTS_ = 3;

async function fetchFollowingPostRedirects_(url, requestInit, signal) {
  var currentUrl = url;

  for (var hop = 0; hop <= MAX_REDIRECTS_; hop++) {
    var res = await fetch(currentUrl, Object.assign({}, requestInit, {
      redirect: "manual",
      signal: signal
    }));

    var isRedirect = res.status === 301 || res.status === 302 || res.status === 303 ||
      res.status === 307 || res.status === 308;

    if (!isRedirect) {
      return res;
    }

    var location = res.headers.get("location");

    if (!location) {
      // Redirect nhưng không có Location - không còn cách nào theo
      // tiếp, trả nguyên response redirect để lớp trên báo lỗi rõ ràng
      // thay vì treo.
      return res;
    }

    // Giữ NGUYÊN phương thức POST + body gốc (requestInit đã có sẵn) -
    // đây chính là điểm khác biệt với hành vi mặc định của fetch().
    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error("Quá nhiều lượt chuyển hướng (redirect) khi gọi máy chủ dữ liệu.");
}

async function postToAppsScript_(payload, options) {
  options = options || {};
  var timeoutMs = parseInt(options.timeoutMs, 10) || env.appsScriptTimeoutMs();
  var controller = new AbortController();
  var timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs);
  var res;
  var text;

  try {
    res = await fetchFollowingPostRedirects_(env.appsScriptUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, controller.signal);

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
    // (DEBUG tạm thời 04/09/2026) Ghi lại nội dung thô Apps Script trả
    // về khi không parse được thành JSON - xem trong Vercel Logs để
    // tìm đúng nguyên nhân (trang lỗi HTML của Google, phản hồi bị cắt
    // ngang do quá chậm, v.v.). Không đổi hành vi/response thật cho
    // người dùng - vẫn ném đúng lỗi như cũ. XÓA dòng console.error này
    // sau khi đã xác định xong nguyên nhân, tránh log rác lâu dài.
    try {
      console.error(
        "[appsScript.js DEBUG] JSON.parse thất bại. status=" + (res && res.status) +
        " content-type=" + (res && res.headers && res.headers.get("content-type")) +
        " length=" + (text ? text.length : 0) +
        " raw(0-1500)=" + String(text || "").slice(0, 1500)
      );
    } catch (logErr) {
      // Không để lỗi ghi log làm hỏng luồng chính.
    }

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
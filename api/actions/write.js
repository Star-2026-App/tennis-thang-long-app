// ======================================================
// POST /api/actions/write (v2.0)
// ======================================================
//
// Bộ dispatcher CHUNG cho MỌI thao tác ghi nghiệp vụ (thay thế
// việc frontend v1.6 tự gọi thẳng Apps Script qua JSONP với
// API_TOKEN lộ trong URL). Hợp đồng:
//
//   POST { action, data, idempotencyKey }
//
// - idempotencyKey do CHÍNH TRÌNH DUYỆT sinh ra (UUID) một lần
//   khi hành động được đưa vào hàng đợi đồng bộ (syncQueue), và
//   PHẢI gửi lại NGUYÊN VẸN key đó mỗi lần thử lại - đây là điều
//   kiện để Apps Script chống ghi trùng khi mất mạng sau commit
//   (P4: "Một request gửi lại 10 lần vẫn chỉ có một bản ghi").
// - Session lấy từ cookie - actor/role do Apps Script tự tra lại,
//   route này KHÔNG tin bất kỳ trường actor/role nào trong body.
// - Sau khi Apps Script xác nhận commit, server (không phải trình
//   duyệt) mới bắn Web Push nếu action đó cần thông báo (P3 + sửa
//   lỗ hổng #8).
// ======================================================

const bcrypt = require("bcryptjs");
const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");
const pushSender = require("../_lib/pushSender");

// Whitelist các action được phép gọi TỪ TRÌNH DUYỆT qua route này.
// Action đọc (initialData, monthData...) có route GET riêng.
// Action hệ thống (auth*, push*ForSend) KHÔNG BAO GIỜ lọt vào đây.
var CLIENT_WRITE_ACTIONS_ = [
  "addMatch", "updateMatch",
  "addGocLog", "updateGocLog", "addGocLogAdjustment",
  "addQuyLog",
  "addBooking",
  "addCashbook",
  "addRule",
  "deleteItem",
  "addMember", "updateSingleMember", "deleteMember", "restoreMember",
  "addBalanceAdjustment",
  "previewMonthClose", "closeMonth",
  "updateSettings",
  "resetMemberPassword",
  "savePushSubscription", "deletePushSubscription"
];

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return http.methodNotAllowed(res, ["POST"]);

  try {
    var sessionId = http.requireSessionId(req);
    var body = http.getJsonBody(req);

    var action = String(body.action || "");
    var data = (body.data && typeof body.data === "object") ? body.data : {};
    var idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : "";

    if (CLIENT_WRITE_ACTIONS_.indexOf(action) === -1) {
      return http.sendJson(res, 400, { status: "ERROR", message: "Action không hợp lệ: " + action });
    }

    if (!idempotencyKey) {
      return http.sendJson(res, 400, { status: "ERROR", message: "Thiếu idempotencyKey." });
    }

    // resetMemberPassword: trình duyệt gửi mật khẩu MỚI dạng plaintext
    // qua kênh HTTPS (không có cách nào khác để Admin/Owner gõ mật
    // khẩu mới) - Vercel băm bằng bcrypt ở đây, Apps Script chỉ bao
    // giờ thấy/lưu hash, không bao giờ thấy plaintext.
    if (action === "resetMemberPassword") {
      var plaintext = String(data.newPassword || "");

      if (plaintext.length < 6 || plaintext.length > 200) {
        return http.sendJson(res, 400, { status: "ERROR", message: "Mật khẩu mới phải có ít nhất 6 ký tự." });
      }

      data = {
        targetStt: data.targetStt,
        newPasswordHash: bcrypt.hashSync(plaintext, 10)
      };
    }

    var result = await appsScript.callBusinessAction(sessionId, action, data, idempotencyKey);

    // Bắn push SAU KHI đã có xác nhận commit thật từ Apps Script -
    // không còn "báo thành công ngay khi enqueue" như v1.6 (P3).
    await pushSender.notifyAfterCommit(action, result, data && (data.name || data.memberName));

    return http.sendJson(res, 200, { status: "SUCCESS", result: result });

  } catch (err) {
    return http.sendError(res, err);
  }
};

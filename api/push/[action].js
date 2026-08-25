// ======================================================
// POST /api/push/:action (v2.0)
// ======================================================
// Gộp 3 route push (broadcast/subscribe/unsubscribe) vào 1 file duy
// nhất bằng route động của Vercel ([action].js) - KHÔNG đổi bất kỳ
// URL nào frontend đang gọi. Lý do gộp: xem ghi chú đầu file
// api/data/[type].js (giới hạn 12 Serverless Functions của gói Hobby).
// ======================================================

const crypto = require("crypto");
const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");
const pushSender = require("../_lib/pushSender");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return http.methodNotAllowed(res, ["POST"]);

  var action = req.query && req.query.action;

  try {

    if (action === "broadcast") {
      // Admin/Owner - thay thế triggerClubPushNotification()/
      // api/send-push.js cũ. Bắt buộc session hợp lệ, role phải >=
      // admin (xác minh THẬT qua action nghiệp vụ "whoAmI" - không
      // tin role client tự khai). Trình duyệt KHÔNG BAO GIỜ thấy danh
      // sách subscription/khoá của người khác.
      var sessionId = http.requireSessionId(req);
      var body = http.getJsonBody(req);

      var title = String(body.title || "").trim();
      var text = String(body.body || "").trim();

      if (!title || !text) {
        return http.sendJson(res, 400, { status: "ERROR", message: "Thiếu tiêu đề hoặc nội dung thông báo." });
      }

      var who = await appsScript.callBusinessAction(sessionId, "whoAmI", {});

      if (who.role !== "admin" && who.role !== "owner") {
        return http.sendJson(res, 403, { status: "ERROR", message: "Unauthorized: Chỉ Admin/Owner được gửi thông báo cho cả CLB." });
      }

      var sendResult = await pushSender.sendBroadcast(title, text);

      return http.sendJson(res, 200, { status: "SUCCESS", result: sendResult });
    }

    if (action === "subscribe") {
      // Đăng ký Push Subscription cho CHÍNH thiết bị/actor đang đăng
      // nhập (PushSubscriptionService.savePushSubscriptionData luôn ép
      // theo actor.name, không tin memberName client gửi).
      var subSessionId = http.requireSessionId(req);
      var subBody = http.getJsonBody(req);

      var sub = subBody.subscription || {};

      if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        return http.sendJson(res, 400, { status: "ERROR", message: "Thiếu thông tin Push Subscription." });
      }

      var subIdemKey = "pushsub-" + crypto.createHash("sha256").update(sub.endpoint).digest("hex");

      var subResult = await appsScript.callBusinessAction(subSessionId, "savePushSubscription", {
        subscription: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }
      }, subIdemKey);

      return http.sendJson(res, 200, { status: "SUCCESS", result: subResult });
    }

    if (action === "unsubscribe") {
      var unsubSessionId = http.requireSessionId(req);
      var unsubBody = http.getJsonBody(req);
      var endpoint = String(unsubBody.endpoint || "");

      if (!endpoint) {
        return http.sendJson(res, 400, { status: "ERROR", message: "Thiếu endpoint." });
      }

      var unsubIdemKey = "pushunsub-" + crypto.createHash("sha256").update(endpoint).digest("hex");

      var unsubResult = await appsScript.callBusinessAction(
        unsubSessionId, "deletePushSubscription", { endpoint: endpoint }, unsubIdemKey
      );

      return http.sendJson(res, 200, { status: "SUCCESS", result: unsubResult });
    }

    return http.sendJson(res, 404, { status: "ERROR", message: "Không tìm thấy: " + action });

  } catch (err) {
    return http.sendError(res, err);
  }
};

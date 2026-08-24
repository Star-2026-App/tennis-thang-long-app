// ======================================================
// POST /api/push/subscribe (v2.0)
// ======================================================
// Đăng ký Push Subscription cho CHÍNH thiết bị/actor đang đăng
// nhập (PushSubscriptionService.savePushSubscriptionData luôn ép
// theo actor.name, không tin memberName client gửi).
// ======================================================

const crypto = require("crypto");
const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return http.methodNotAllowed(res, ["POST"]);

  try {
    var sessionId = http.requireSessionId(req);
    var body = http.getJsonBody(req);

    var sub = body.subscription || {};

    if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      return http.sendJson(res, 400, { status: "ERROR", message: "Thiếu thông tin Push Subscription." });
    }

    var idempotencyKey = "pushsub-" + crypto.createHash("sha256").update(sub.endpoint).digest("hex");

    var result = await appsScript.callBusinessAction(sessionId, "savePushSubscription", {
      subscription: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }
    }, idempotencyKey);

    return http.sendJson(res, 200, { status: "SUCCESS", result: result });

  } catch (err) {
    return http.sendError(res, err);
  }
};

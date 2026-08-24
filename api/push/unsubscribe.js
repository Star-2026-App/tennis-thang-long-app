// ======================================================
// POST /api/push/unsubscribe (v2.0)
// ======================================================

const crypto = require("crypto");
const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return http.methodNotAllowed(res, ["POST"]);

  try {
    var sessionId = http.requireSessionId(req);
    var body = http.getJsonBody(req);
    var endpoint = String(body.endpoint || "");

    if (!endpoint) {
      return http.sendJson(res, 400, { status: "ERROR", message: "Thiếu endpoint." });
    }

    var idempotencyKey = "pushunsub-" + crypto.createHash("sha256").update(endpoint).digest("hex");

    var result = await appsScript.callBusinessAction(
      sessionId, "deletePushSubscription", { endpoint: endpoint }, idempotencyKey
    );

    return http.sendJson(res, 200, { status: "SUCCESS", result: result });

  } catch (err) {
    return http.sendError(res, err);
  }
};

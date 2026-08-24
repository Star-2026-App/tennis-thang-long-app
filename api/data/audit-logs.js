// ======================================================
// GET /api/data/audit-logs?limit=200 (v2.0) - CHỈ OWNER
// ======================================================

const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return http.methodNotAllowed(res, ["GET"]);

  try {
    var sessionId = http.requireSessionId(req);
    var limit = parseInt(req.query && req.query.limit) || 200;

    var result = await appsScript.callBusinessAction(sessionId, "getAuditLogs", { limit: limit });
    return http.sendJson(res, 200, { status: "SUCCESS", result: result });

  } catch (err) {
    return http.sendError(res, err);
  }
};

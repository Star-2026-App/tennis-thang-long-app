// ======================================================
// GET /api/data/analytics (v2.0)
// ======================================================

const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return http.methodNotAllowed(res, ["GET"]);

  try {
    var sessionId = http.requireSessionId(req);
    var result = await appsScript.callBusinessAction(sessionId, "analyticsData", {});
    return http.sendJson(res, 200, { status: "SUCCESS", result: result });

  } catch (err) {
    return http.sendError(res, err);
  }
};

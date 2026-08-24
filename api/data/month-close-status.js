// ======================================================
// GET /api/data/month-close-status?month=8&year=2026 (v2.0)
// ======================================================

const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return http.methodNotAllowed(res, ["GET"]);

  try {
    var sessionId = http.requireSessionId(req);

    var month = parseInt(req.query && req.query.month);
    var year = parseInt(req.query && req.query.year);

    var result = await appsScript.callBusinessAction(sessionId, "monthCloseStatus", { month: month, year: year });
    return http.sendJson(res, 200, { status: "SUCCESS", result: result });

  } catch (err) {
    return http.sendError(res, err);
  }
};

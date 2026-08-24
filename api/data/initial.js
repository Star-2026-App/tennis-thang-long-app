// ======================================================
// GET /api/data/initial (v2.0)
// ======================================================
// Thay cho việc frontend gọi thẳng Apps Script action "initialData".
// Yêu cầu session hợp lệ - KHÔNG còn cách nào tải dữ liệu CLB mà
// không đăng nhập (sửa điểm yếu #11: app.js cũ tải dữ liệu trước
// khi kiểm tra đăng nhập).
// ======================================================

const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return http.methodNotAllowed(res, ["GET"]);

  try {
    var sessionId = http.requireSessionId(req);
    var result = await appsScript.callBusinessAction(sessionId, "initialData", {});
    return http.sendJson(res, 200, { status: "SUCCESS", result: result });

  } catch (err) {
    return http.sendError(res, err);
  }
};

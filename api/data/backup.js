// ======================================================
// GET /api/data/backup (v2.0) - CHỈ OWNER
// ======================================================
// Thay cho ui.js exportToExcel cũ (chỉ xuất Members + Matches
// tháng hiện tại + GocLogs - thiếu rất nhiều bảng, không phải bản
// backup có thể phục hồi - điểm yếu #12). Trả về TOÀN BỘ dữ liệu
// từ getFullBackupData_ (Apps Script, owner-only) để frontend lưu
// thành file JSON hoàn chỉnh, phục hồi được 1-1.
// ======================================================

const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return http.methodNotAllowed(res, ["GET"]);

  try {
    var sessionId = http.requireSessionId(req);
    var result = await appsScript.callBusinessAction(sessionId, "getFullBackupData", {});
    return http.sendJson(res, 200, { status: "SUCCESS", result: result });

  } catch (err) {
    return http.sendError(res, err);
  }
};

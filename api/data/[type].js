// ======================================================
// GET /api/data/:type (v2.0)
// ======================================================
// Gộp 7 route đọc dữ liệu (initial/month/analytics/month-close-status/
// backup/audit-logs/reconcile) vào 1 file duy nhất, dùng route động
// của Vercel ([type].js) - KHÔNG đổi bất kỳ URL nào frontend đang gọi.
//
// Lý do gộp: gói Vercel Hobby giới hạn tối đa 12 Serverless Functions
// mỗi lần deploy - tách riêng từng file như bản đầu (7 file trong
// data/, cộng 4 file auth/ + 3 file push/ + actions/write.js +
// send-push.js = 16 file) vượt giới hạn, khiến deploy bị lỗi
// "No more than 12 Serverless Functions can be added to a Deployment
// on the Hobby plan." Gộp theo nhóm (data/auth/push) đưa tổng về 5.
// ======================================================

const http = require("../_lib/http");
const appsScript = require("../_lib/appsScript");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return http.methodNotAllowed(res, ["GET"]);

  var type = req.query && req.query.type;

  try {
    var sessionId = http.requireSessionId(req);

    switch (type) {

      case "bootstrap": {
        // Xác minh session + tải initialData trong một lượt Apps Script,
        // thay cho chuỗi /auth/session rồi /data/initial trước đây.
        var bootstrapMonth = parseInt(req.query && req.query.month);
        var bootstrapYear = parseInt(req.query && req.query.year);
        var bootstrapResult = await appsScript.callBusinessAction(
          sessionId,
          "bootstrapData",
          { month: bootstrapMonth, year: bootstrapYear }
        );
        return http.sendJson(res, 200, { status: "SUCCESS", result: bootstrapResult });
      }

      case "initial": {
        // Thay cho việc frontend gọi thẳng Apps Script action "initialData".
        // Yêu cầu session hợp lệ - KHÔNG còn cách nào tải dữ liệu CLB mà
        // không đăng nhập (sửa điểm yếu #11).
        var initialResult = await appsScript.callBusinessAction(sessionId, "initialData", {});
        return http.sendJson(res, 200, { status: "SUCCESS", result: initialResult });
      }

      case "sync": {
        var syncMonth = parseInt(req.query && req.query.month);
        var syncYear = parseInt(req.query && req.query.year);
        var revision = parseInt(req.query && req.query.revision) || 0;
        var syncResult = await appsScript.callBusinessAction(
          sessionId,
          "syncData",
          {
            month: syncMonth,
            year: syncYear,
            dataRevision: revision,
            forceReload: String(req.query && req.query.force || "") === "1"
          }
        );
        return http.sendJson(res, 200, { status: "SUCCESS", result: syncResult });
      }

      case "month": {
        var month = parseInt(req.query && req.query.month);
        var year = parseInt(req.query && req.query.year);
        var monthResult = await appsScript.callBusinessAction(sessionId, "monthData", { month: month, year: year });
        return http.sendJson(res, 200, { status: "SUCCESS", result: monthResult });
      }

      case "analytics": {
        var analyticsResult = await appsScript.callBusinessAction(sessionId, "analyticsData", {});
        return http.sendJson(res, 200, { status: "SUCCESS", result: analyticsResult });
      }

      case "cup": {
        var cupResult = await appsScript.callBusinessAction(sessionId, "cupData", {});
        return http.sendJson(res, 200, { status: "SUCCESS", result: cupResult });
      }

      case "cup-version": {
        var cupSummary = await appsScript.callBusinessAction(sessionId, "cupSummary", {});
        return http.sendJson(res, 200, { status: "SUCCESS", result: cupSummary });
      }

      case "month-close-status": {
        var mcsMonth = parseInt(req.query && req.query.month);
        var mcsYear = parseInt(req.query && req.query.year);
        var mcsResult = await appsScript.callBusinessAction(sessionId, "monthCloseStatus", { month: mcsMonth, year: mcsYear });
        return http.sendJson(res, 200, { status: "SUCCESS", result: mcsResult });
      }

      case "backup": {
        // Thay cho ui.js exportToExcel cũ (chỉ xuất Members + Matches
        // tháng hiện tại + GocLogs - không phải bản backup phục hồi
        // được - điểm yếu #12). Trả về TOÀN BỘ dữ liệu từ
        // getFullBackupData_ (Apps Script, owner-only).
        var backupResult = await appsScript.callBusinessAction(sessionId, "getFullBackupData", {});
        return http.sendJson(res, 200, { status: "SUCCESS", result: backupResult });
      }

      case "audit-logs": {
        // CHỈ OWNER (enforced ở Apps Script PERMISSION_MATRIX_).
        var limit = parseInt(req.query && req.query.limit) || 200;
        var auditResult = await appsScript.callBusinessAction(sessionId, "getAuditLogs", { limit: limit });
        return http.sendJson(res, 200, { status: "SUCCESS", result: auditResult });
      }

      case "reconcile": {
        // Đối soát: tổng tính lại từ nguồn (Matches/GocLogs/QuyLogs...)
        // phải khớp với snapshot MonthlyBalances đã chốt (P2). Admin/Owner.
        var rcMonth = parseInt(req.query && req.query.month);
        var rcYear = parseInt(req.query && req.query.year);
        var rcResult = await appsScript.callBusinessAction(sessionId, "reconcileMonth", { month: rcMonth, year: rcYear });
        return http.sendJson(res, 200, { status: "SUCCESS", result: rcResult });
      }

      default:
        return http.sendJson(res, 404, { status: "ERROR", message: "Không tìm thấy dữ liệu: " + type });
    }

  } catch (err) {
    return http.sendError(res, err);
  }
};

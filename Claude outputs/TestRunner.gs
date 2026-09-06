// ============================================================================
// TestRunner.gs — CHỈ dùng để test thủ công trên Sheet TEST, xoá sau khi xong.
// Chạy perfRecalculateMonth_ cho đúng tháng hiện tại (09/2026) để ghi dữ liệu
// vào PerformanceHistory, phục vụ kiểm tra đường biểu đồ trong tab "Phong độ".
// KHÔNG chạy hàm này trên Sheet PRODUCTION.
// ============================================================================
function runPerfRecalcCurrentMonth() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = Session.getScriptTimeZone();
  var yearMonth = Utilities.formatDate(new Date(), tz, 'MM/yyyy');
  var result = perfRecalculateMonth_(ss, yearMonth);
  Logger.log('runPerfRecalcCurrentMonth (' + yearMonth + '): ' + JSON.stringify(result));
}

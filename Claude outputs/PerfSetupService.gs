// ============================================================================
// PerfSetupService.txt — Module "Điểm Phong độ"
// File MỚI — tạo hạ tầng sheet cho module. KHÔNG đụng bất kỳ sheet có sẵn nào.
//
// QUY ƯỚC ĐẶT TÊN: mọi hàm/biến top-level trong TOÀN BỘ module Phong độ đều có
// tiền tố `Perf`/`perf` (đúng bài học đã ghi trong CUP_MODULE_PHAN_TICH_KIEN_TRUC.md
// mục 4.1 — Apps Script gộp mọi file .gs vào 1 global scope, hàm trùng tên từng
// suýt ghi đè âm thầm giữa Code.gs/Router.gs).
//
// ⚠️ BẮT BUỘC trước khi dán file này (và mọi file Perf*.txt khác) vào Apps Script
// Editor: tự grep lại toàn bộ project thật để chắc chắn KHÔNG có hàm/biến nào
// đã tồn tại trùng đúng các tên bắt đầu bằng `Perf`/`perf` liệt kê trong các file
// này. Tôi (Claude) viết các file này KHÔNG có quyền đọc trực tiếp source thật
// tại thời điểm viết (chỉ có tài liệu phân tích + file Excel export dữ liệu),
// nên đây là bước rà soát bắt buộc, không phải tùy chọn.
// ============================================================================

/**
 * Chạy 1 lần (hoặc nhiều lần tùy ý, an toàn) từ Apps Script Editor để khởi tạo
 * 2 sheet mới của module Phong độ. Không đụng bất kỳ sheet nào đã có sẵn.
 * Có thể gọi lại bất cứ lúc nào — nếu sheet đã tồn tại thì bỏ qua, không tạo lại,
 * không xóa dữ liệu đã có.
 *
 * @return {Object} báo cáo: { created: string[], alreadyExists: string[], errors: string[] }
 */
function setupPerformanceModuleSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = { created: [], alreadyExists: [], errors: [] };

  perfCreateSheetIfMissing_(ss, PERF_SHEET_HISTORY_, PERF_HISTORY_HEADERS_, report);
  perfCreateSheetIfMissing_(ss, PERF_SHEET_MONTHLY_CLOSE_, PERF_MONTHLY_CLOSE_HEADERS_, report);

  // (fix 05/09/2026 - phát hiện qua perfRunAllTests_ trên Sheet TEST) Ép cột
  // YearMonth (dạng "MM/yyyy") ở cả 2 sheet luôn là Plain Text — nếu không,
  // Google Sheets tự "đoán" chuỗi kiểu "01/2099" là ngày tháng và âm thầm
  // chuyển thành Date ngay khi setValues() ghi vào, làm hỏng so sánh chuỗi
  // dùng để chống chạy trùng (xem perfNormalizeYearMonth_ ở PerfCalcService.txt
  // — hàm đó vẫn tự chuẩn hoá phòng hờ, nhưng ép định dạng ngay từ đầu giúp dữ
  // liệu hiển thị đúng trên Sheet UI và tránh lặp lại vấn đề). An toàn gọi lại
  // nhiều lần, không đụng dữ liệu đã có.
  perfForceYearMonthColumnsPlainText_(ss);

  Logger.log('setupPerformanceModuleSheets() hoan tat: ' + JSON.stringify(report));
  return report;
}

/**
 * Ép cột "YearMonth" của PerformanceHistory (cột F) và PerformanceMonthlyClose
 * (cột B) sang định dạng Plain Text, áp cho toàn bộ chiều cao sheet hiện có.
 * Chỉ đổi ĐỊNH DẠNG hiển thị, không đụng nội dung ô nào.
 */
function perfForceYearMonthColumnsPlainText_(ss) {
  var historySheet = ss.getSheetByName(PERF_SHEET_HISTORY_);
  if (historySheet) {
    historySheet.getRange(2, 6, Math.max(historySheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  }
  var closeSheet = ss.getSheetByName(PERF_SHEET_MONTHLY_CLOSE_);
  if (closeSheet) {
    closeSheet.getRange(2, 2, Math.max(closeSheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  }
}

/**
 * Header của sheet PerformanceHistory — lưu từng trận đã tính, phục vụ vẽ
 * biểu đồ đường + audit. Xem PHONGDO_MODULE_PHAN_TICH_KIENTRUC.md mục 4.
 */
// (Cập nhật 05/09/2026) Thêm cột MemberStt — frontend thật xác định người
// chơi qua STT (member.stt), không qua tên (xem js/modules/cup.js:451 và
// js/modules/performance.js) — bắt buộc để tra cứu lịch sử theo đúng khớp
// với cách hệ thống nối Matches<->Members qua STT.
var PERF_HISTORY_HEADERS_ = [
  'Id', 'MemberStt', 'MemberName', 'MatchId', 'MatchDate', 'YearMonth',
  'DeltaStep', 'CumulativeInMonth', 'DisplayLevel', 'CreatedAt'
];

/**
 * Header của sheet PerformanceMonthlyClose — audit trail chốt tháng, đồng thời
 * là cơ chế chống chạy job trùng trong cùng 1 tháng (xem PerfCalcService.txt).
 * Cột Status dùng chung cho cả luồng chốt tháng bình thường (luôn "APPLIED" ngay)
 * lẫn luồng backfill (có thể là "PREVIEW" chờ duyệt — xem PerfBackfillService.txt).
 */
var PERF_MONTHLY_CLOSE_HEADERS_ = [
  'MemberName', 'YearMonth', 'BaseBefore', 'RawDeltaSum',
  'ClampedDelta', 'BaseAfter', 'ProcessedAt', 'Status'
];

/**
 * Tạo 1 sheet với header cho trước nếu chưa tồn tại. Nếu đã tồn tại, không
 * đụng gì tới cấu trúc/dữ liệu hiện có (kể cả khi header lệch — chỉ ghi log
 * cảnh báo, không tự sửa, để tránh vô tình phá dữ liệu đã có nếu ai đó đã
 * chỉnh tay sheet này).
 */
function perfCreateSheetIfMissing_(ss, sheetName, headers, report) {
  var existing = ss.getSheetByName(sheetName);
  if (existing) {
    var firstRow = existing.getRange(1, 1, 1, headers.length).getValues()[0];
    var headerMatches = headers.every(function (h, idx) { return firstRow[idx] === h; });
    if (!headerMatches) {
      Logger.log('CẢNH BÁO: sheet "' + sheetName + '" đã tồn tại nhưng header không khớp ' +
        'đúng thiết kế module Phong độ. KHÔNG tự sửa để tránh phá dữ liệu — cần Star ' +
        'kiểm tra tay. Header hiện có: ' + JSON.stringify(firstRow));
    }
    report.alreadyExists.push(sheetName);
    return;
  }
  var sheet = ss.insertSheet(sheetName);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  report.created.push(sheetName);
}

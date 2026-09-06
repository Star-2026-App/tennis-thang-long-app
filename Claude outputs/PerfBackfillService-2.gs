// ============================================================================
// PerfBackfillService.txt — Module "Điểm Phong độ"
// Migrate 1 LẦN DUY NHẤT lúc bật tính năng: tính lại phong độ cho TOÀN BỘ lịch
// sử Matches đã có, theo quy trình 2 bước "xem trước → áp dụng" đã chốt với
// Star (05/09/2026) để tránh Điểm Base của nhiều người nhảy 1 lần mà không ai
// rà soát trước.
//
// ⚠️ CHỈ chạy tay từ Apps Script Editor (Run > perfPreviewBackfill_, rồi sau
// khi Star duyệt số liệu mới Run > perfApplyBackfill_). KHÔNG đưa 2 hàm này
// lên web dưới bất kỳ hình thức nào — đây là thao tác di dời dữ liệu 1 lần,
// không phải tính năng vận hành hàng ngày (khác với runPerfMonthlyRecalc_ ở
// PerfCalcService.txt, hàm đó mới là thứ chạy tự động hàng tháng bình thường).
//
// (mở rộng 06/09/2026 — theo yêu cầu Star): Backfill giờ ghi ĐẦY ĐỦ chi tiết
// từng trận vào PerformanceHistory cho MỌI tháng có trong Matches (kể cả các
// tháng cũ trước khi module vận hành), không chỉ 1 dòng chốt/tháng như bản đầu
// nữa — biểu đồ đường trong tab "Phong độ" giờ có dữ liệu đầy đủ từ trận đầu
// tiên trong Matches, không chỉ từ lúc bật job tháng tự động trở đi.
//
// Cách làm giữ đúng nguyên tắc AN TOÀN gốc (Preview không tạo ra bất kỳ dữ
// liệu nào member thật nhìn thấy được cho tới khi Star duyệt và chạy Apply):
// perfPreviewBackfill_ tính sẵn historyRows chi tiết từng trận NHƯNG chỉ ghi
// tạm vào 1 sheet staging ẩn (`_PerfHistoryBackfillStaging_`), KHÔNG đụng
// PerformanceHistory thật. perfApplyBackfill_ — sau khi Star đã duyệt số liệu
// Base — mới đẩy staging này vào PerformanceHistory thật rồi dọn sạch staging.
// ============================================================================

var PERF_SHEET_HISTORY_STAGING_ = '_PerfHistoryBackfillStaging_';

/**
 * Lấy (hoặc tạo mới nếu chưa có) sheet staging ẩn dùng để giữ tạm historyRows
 * tính được lúc Preview, chờ Apply đẩy vào PerformanceHistory thật. Mỗi lần
 * gọi lại Preview sẽ dọn sạch nội dung cũ của sheet này để tính lại từ đầu.
 */
function perfGetOrCreateHistoryStagingSheet_(ss) {
  var sheet = ss.getSheetByName(PERF_SHEET_HISTORY_STAGING_);
  if (!sheet) {
    sheet = ss.insertSheet(PERF_SHEET_HISTORY_STAGING_);
    sheet.getRange(1, 1, 1, PERF_HISTORY_HEADERS_.length).setValues([PERF_HISTORY_HEADERS_]);
    sheet.setFrozenRows(1);
    try { sheet.hideSheet(); } catch (e) { /* không sao nếu vì lý do nào đó không ẩn được */ }
  } else if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, PERF_HISTORY_HEADERS_.length).clearContent();
  }
  // (fix 06/09/2026 - phát hiện qua test thật, chart "Theo tháng" hiện ISO
  // string) Y HỆT lý do đã ghi ở perfForceYearMonthColumnsPlainText_
  // (PerfSetupService.txt): nếu không ép cột YearMonth (F) này về Plain Text
  // TRƯỚC khi ghi, Google Sheets tự đoán chuỗi "08/2026" là ngày tháng và âm
  // thầm chuyển thành Date ngay khi setValues() ghi vào — sheet staging này bị
  // bỏ sót bước ép định dạng đó khi mới tạo (PerformanceHistory/
  // PerformanceMonthlyClose thật đã được ép từ setupPerformanceModuleSheets(),
  // nhưng sheet staging tạm này được tạo sau, ở đây, nên cần tự ép riêng).
  sheet.getRange(2, 6, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  return sheet;
}

/**
 * BƯỚC 1/2: Tính thử toàn bộ lịch sử Matches, GHI RA `PerformanceMonthlyClose`
 * với Status="PREVIEW". TUYỆT ĐỐI KHÔNG đụng cột Điểm Base thật của Members.
 *
 * Từ chối chạy nếu sheet PerformanceMonthlyClose đã có bất kỳ dòng "APPLIED"
 * nào (tức module đã vận hành thật rồi) — để tránh trộn backfill với dữ liệu
 * đã chốt thật, dễ gây nhầm lẫn tháng nào là thật/tháng nào là preview.
 *
 * @return {Object} báo cáo {monthsProcessed, rowsWritten} hoặc {aborted, reason}
 */
function perfPreviewBackfill_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var closeSheet = ss.getSheetByName(PERF_SHEET_MONTHLY_CLOSE_);
  if (!closeSheet) throw new Error('Chưa chạy setupPerformanceModuleSheets().');

  var existing = closeSheet.getDataRange().getValues();
  var hasApplied = existing.slice(1).some(function (r) { return String(r[7]) === 'APPLIED'; });
  if (hasApplied) {
    var msg = 'Đã có dòng APPLIED trong PerformanceMonthlyClose — module có vẻ đã vận hành ' +
      'thật rồi. Dừng lại để tránh trộn backfill với dữ liệu thật. Nếu vẫn muốn backfill lại ' +
      'từ đầu, cần Star tự xác nhận và dọn tay sheet PerformanceMonthlyClose trước.';
    Logger.log(msg);
    return { aborted: true, reason: msg };
  }
  // Xoá các dòng PREVIEW cũ (nếu có, từ lần chạy preview trước) để chạy lại sạch.
  if (existing.length > 1) {
    closeSheet.getRange(2, 1, existing.length - 1, PERF_MONTHLY_CLOSE_HEADERS_.length).clearContent();
  }

  var S = perfGetSensitivityS_(ss);
  var membersSheet = ss.getSheetByName(PERF_SHEET_MEMBERS_);
  var membersValues = membersSheet.getDataRange().getValues();
  var memberIndex = perfBuildMemberIndex_(membersValues); // key -> {stt, name, base, rowIndex}

  // workingBase: mô phỏng Điểm Base "tại thời điểm đó" khi chạy tuần tự qua
  // từng tháng — KHÔNG đọc lại Members giữa các tháng (Members chưa hề bị ghi
  // trong suốt quá trình preview).
  var workingBase = {}; // tên -> base hiện tại (mô phỏng)
  Object.keys(memberIndex).forEach(function (k) {
    if (k.indexOf('NAME:') === 0) workingBase[memberIndex[k].name] = memberIndex[k].base;
  });

  var matchesSheet = ss.getSheetByName(PERF_SHEET_MATCHES_);
  var matchesValues = matchesSheet.getDataRange().getValues();

  // Gom nhóm theo YearMonth "MM/yyyy", giữ nguyên thứ tự dòng gốc trong mỗi nhóm
  // rồi sắp lại theo thời gian thật bên trong nhóm.
  var byMonth = {}; // "MM/yyyy" -> [row, ...]
  for (var r = 1; r < matchesValues.length; r++) {
    var row = matchesValues[r];
    var ym = perfExtractYearMonth_(row[PERF_COL_MATCH_TIME_]);
    if (!ym) continue; // dòng thời gian rỗng/lỗi -> bỏ qua (mục 4 "Edge Cases")
    if (!byMonth[ym]) byMonth[ym] = [];
    byMonth[ym].push(row);
  }
  var orderedMonths = Object.keys(byMonth).sort(function (a, b) {
    return perfYearMonthSortKey_(a) - perfYearMonthSortKey_(b);
  });

  var closeRows = [];
  var historyRows = []; // (mở rộng 06/09/2026) chi tiết từng trận, chờ Apply đẩy vào PerformanceHistory thật
  orderedMonths.forEach(function (yearMonth) {
    var rows = byMonth[yearMonth].slice().sort(function (a, b) {
      return perfParseSheetTime_(a[PERF_COL_MATCH_TIME_]) - perfParseSheetTime_(b[PERF_COL_MATCH_TIME_]);
    });

    var accum = {}; // tên -> sumRaw
    rows.forEach(function (row) {
      var nameA1 = row[PERF_COL_MATCH_A_P1_NAME_], nameA2 = row[PERF_COL_MATCH_A_P2_NAME_];
      var nameB1 = row[PERF_COL_MATCH_B_P1_NAME_], nameB2 = row[PERF_COL_MATCH_B_P2_NAME_];

      var levelA1 = perfLookupWorkingBase_(workingBase, nameA1);
      var levelA2 = perfLookupWorkingBase_(workingBase, nameA2);
      var levelB1 = perfLookupWorkingBase_(workingBase, nameB1);
      var levelB2 = perfLookupWorkingBase_(workingBase, nameB2);

      var steps = perfComputeMatchSteps_({
        teamAP1Name: nameA1, teamAP2Name: nameA2, teamBP1Name: nameB1, teamBP2Name: nameB2,
        scoreA: row[PERF_COL_MATCH_SCORE_A_], scoreB: row[PERF_COL_MATCH_SCORE_B_],
        levelA1: levelA1, levelA2: levelA2, levelB1: levelB1, levelB2: levelB2
      }, S);
      if (!steps) return;

      [[nameA1, steps.stepA], [nameA2, steps.stepA], [nameB1, steps.stepB], [nameB2, steps.stepB]]
        .forEach(function (pair) {
          var name = String(pair[0]).trim();
          if (workingBase[name] == null) return; // không phải thành viên active đã biết Base -> bỏ qua
          accum[name] = (accum[name] || 0) + pair[1];

          // (mở rộng 06/09/2026) Ghi 1 dòng lịch sử chi tiết cho đúng trận này.
          // ⚠️ displayLevel ở đây CHỈ là con số hiển thị mô phỏng cho biểu đồ —
          // workingBase[name] là Điểm Base cố định NGAY ĐẦU tháng yearMonth,
          // KHÔNG đổi trong suốt vòng lặp các trận của tháng này (chỉ được cập
          // nhật ở cuối, sau khi hết tháng — xem Object.keys(accum).forEach bên
          // dưới). Tức là cột Điểm Base thật trong Members KHÔNG hề bị đụng tới
          // ở đây, đúng nguyên tắc "chỉ ghi Điểm Base khi chốt tháng" đã chốt.
          var clampedSoFar = Math.max(-PERF_MONTHLY_CAP_, Math.min(PERF_MONTHLY_CAP_, accum[name]));
          // (mở rộng 06/09/2026 - yêu cầu Star) 3 chữ số thập phân — dùng chung
          // PERF_DISPLAY_PRECISION_ (định nghĩa ở PerfCalcService.txt) để khớp
          // hệt độ chính xác với perfRecalculateMonth_, tránh backfill (tháng
          // cũ) và job tháng (tháng mới) lệch số chữ số thập phân với nhau.
          var displayLevel = Math.round((workingBase[name] + clampedSoFar) * PERF_DISPLAY_PRECISION_) / PERF_DISPLAY_PRECISION_;
          var memberRec = memberIndex['NAME:' + name];

          historyRows.push([
            Utilities.getUuid(),
            memberRec ? memberRec.stt : '',
            name,
            row[PERF_COL_MATCH_ID_],
            row[PERF_COL_MATCH_TIME_],
            yearMonth,
            Math.round(pair[1] * 10000) / 10000,
            Math.round(accum[name] * 10000) / 10000,
            displayLevel,
            new Date()
          ]);
        });
    });

    Object.keys(accum).forEach(function (name) {
      var baseBefore = workingBase[name];
      var clampedDelta = Math.max(-PERF_MONTHLY_CAP_, Math.min(PERF_MONTHLY_CAP_, accum[name]));
      var baseAfter = Math.round((baseBefore + clampedDelta) * PERF_DISPLAY_PRECISION_) / PERF_DISPLAY_PRECISION_;

      closeRows.push([
        name, yearMonth, baseBefore, Math.round(accum[name] * 10000) / 10000,
        clampedDelta, baseAfter, new Date(), 'PREVIEW'
      ]);

      workingBase[name] = baseAfter; // tháng kế tiếp dùng đúng giá trị vừa mô phỏng này
    });
  });

  if (closeRows.length > 0) {
    closeSheet.getRange(2, 1, closeRows.length, closeRows[0].length).setValues(closeRows);
  }

  // (mở rộng 06/09/2026) Ghi historyRows vào sheet staging ẩn — CHƯA đụng
  // PerformanceHistory thật, đúng nguyên tắc Preview không tạo dữ liệu member
  // thật nhìn thấy được cho tới khi Apply.
  var stagingSheet = perfGetOrCreateHistoryStagingSheet_(ss);
  if (historyRows.length > 0) {
    stagingSheet.getRange(2, 1, historyRows.length, historyRows[0].length).setValues(historyRows);
  }

  var result = {
    monthsProcessed: orderedMonths.length,
    rowsWritten: closeRows.length,
    historyRowsStaged: historyRows.length
  };
  Logger.log('perfPreviewBackfill_ hoan tat: ' + JSON.stringify(result) +
    ' -- MỞ Google Sheet, xem sheet PerformanceMonthlyClose (cột Status=PREVIEW), ' +
    'so sánh BaseBefore/BaseAfter của vài người quen thuộc trước khi chạy perfApplyBackfill_().');
  return result;
}

/**
 * BƯỚC 2/2: Sau khi Star đã rà soát sheet PerformanceMonthlyClose (Status=PREVIEW)
 * và thấy số liệu hợp lý — chạy hàm này để: (a) ghi Điểm Base cuối cùng (theo
 * tháng gần nhất của mỗi thành viên) vào Members thật, (b) đổi Status toàn bộ
 * dòng PREVIEW thành APPLIED.
 *
 * @return {Object} báo cáo {membersUpdated, rowsApplied}
 */
function perfApplyBackfill_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var closeSheet = ss.getSheetByName(PERF_SHEET_MONTHLY_CLOSE_);
  var membersSheet = ss.getSheetByName(PERF_SHEET_MEMBERS_);
  if (!closeSheet || !membersSheet) throw new Error('Chưa chạy setupPerformanceModuleSheets().');

  var values = closeSheet.getDataRange().getValues();
  var previewRowIndexes = []; // dòng thật trong sheet (1-based) của các dòng PREVIEW
  var latestByMember = {};    // tên -> {yearMonth, baseAfter, sortKey}

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][7]) !== 'PREVIEW') continue;
    previewRowIndexes.push(i + 1);
    var name = String(values[i][0]).trim();
    var yearMonth = values[i][1];
    var baseAfter = values[i][5];
    var sortKey = perfYearMonthSortKey_(yearMonth);
    if (!latestByMember[name] || sortKey > latestByMember[name].sortKey) {
      latestByMember[name] = { yearMonth: yearMonth, baseAfter: baseAfter, sortKey: sortKey };
    }
  }

  if (previewRowIndexes.length === 0) {
    Logger.log('perfApplyBackfill_: không có dòng PREVIEW nào để áp dụng — chạy perfPreviewBackfill_() trước.');
    return { membersUpdated: 0, rowsApplied: 0 };
  }

  var membersValues = membersSheet.getDataRange().getValues();
  var nameToRowIndex = {};
  for (var m = 1; m < membersValues.length; m++) {
    nameToRowIndex[String(membersValues[m][PERF_COL_MEMBER_NAME_]).trim()] = m + 1;
  }

  var membersUpdated = 0;
  Object.keys(latestByMember).forEach(function (name) {
    var rowIndex = nameToRowIndex[name];
    if (!rowIndex) {
      Logger.log('CẢNH BÁO: không tìm thấy thành viên "' + name + '" trong Members khi apply backfill — bỏ qua.');
      return;
    }
    membersSheet.getRange(rowIndex, PERF_COL_MEMBER_BASE_ + 1).setValue(latestByMember[name].baseAfter);
    membersUpdated++;
  });

  // Đổi Status toàn bộ dòng PREVIEW -> APPLIED (ghi 1 lần bằng mảng, không
  // ghi từng ô riêng lẻ).
  var statusColValues = previewRowIndexes.map(function () { return ['APPLIED']; });
  // previewRowIndexes có thể không liên tục -> ghi từng dòng riêng (số dòng preview
  // thường không quá lớn — vài chục tháng x vài chục thành viên -> vài trăm dòng,
  // vẫn rẻ so với giới hạn 6 phút).
  previewRowIndexes.forEach(function (rowIndex) {
    closeSheet.getRange(rowIndex, 8).setValue('APPLIED');
  });

  // (mở rộng 06/09/2026) Đẩy historyRows đã tính sẵn lúc Preview (đang nằm ở
  // sheet staging ẩn) vào PerformanceHistory thật — ĐÂY là bước duy nhất làm
  // cho biểu đồ đường của các tháng cũ có dữ liệu chi tiết từng trận. Chỉ nối
  // thêm (append) vào cuối sheet, không đụng dòng nào đã có sẵn trong đó (ví
  // dụ dữ liệu do runPerfMonthlyRecalc_ đã ghi cho các tháng vận hành thật).
  var historySheet = ss.getSheetByName(PERF_SHEET_HISTORY_);
  var stagingSheet = ss.getSheetByName(PERF_SHEET_HISTORY_STAGING_);
  var historyRowsApplied = 0;
  if (historySheet && stagingSheet && stagingSheet.getLastRow() > 1) {
    var stagingRowCount = stagingSheet.getLastRow() - 1;
    var stagingValues = stagingSheet.getRange(2, 1, stagingRowCount, PERF_HISTORY_HEADERS_.length).getValues();
    historySheet.getRange(historySheet.getLastRow() + 1, 1, stagingValues.length, stagingValues[0].length)
      .setValues(stagingValues);
    historyRowsApplied = stagingValues.length;
    stagingSheet.getRange(2, 1, stagingRowCount, PERF_HISTORY_HEADERS_.length).clearContent();
  }

  var result = {
    membersUpdated: membersUpdated,
    rowsApplied: previewRowIndexes.length,
    historyRowsApplied: historyRowsApplied
  };
  Logger.log('perfApplyBackfill_ hoan tat: ' + JSON.stringify(result));
  return result;
}

// ---- Tiện ích riêng cho backfill ----

/** Trích "MM/yyyy" từ chuỗi thời gian "dd/MM/yyyy HH:mm:ss" của Matches. */
function perfExtractYearMonth_(timeStr) {
  var m = String(timeStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  var month = ('0' + parseInt(m[2], 10)).slice(-2);
  return month + '/' + m[3];
}

/**
 * Khóa sắp xếp tăng dần cho "MM/yyyy" (ví dụ "09/2026" -> 202609).
 * (fix 05/09/2026) Chuẩn hoá qua perfNormalizeYearMonth_ trước khi tách chuỗi
 * — giá trị đọc từ sheet có thể đã bị Google Sheets tự đổi thành Date (xem
 * giải thích đầy đủ ở perfNormalizeYearMonth_ trong PerfCalcService.txt).
 */
function perfYearMonthSortKey_(yearMonth) {
  var parts = perfNormalizeYearMonth_(yearMonth).split('/');
  return parseInt(parts[1], 10) * 100 + parseInt(parts[0], 10);
}

/** Tra Base mô phỏng theo tên, bỏ qua khách mời (perfComputeMatchSteps_ sẽ tự loại). */
function perfLookupWorkingBase_(workingBase, name) {
  if (perfIsGuestName_(name)) return null;
  var key = String(name || '').trim();
  return workingBase[key] != null ? workingBase[key] : null;
}

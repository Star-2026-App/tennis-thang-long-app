// ============================================================================
// PerfQueryService.txt — Module "Điểm Phong độ"
// Các hàm ĐỌC phục vụ frontend (tab "Phong độ"). Thuần đọc, không khoá
// LockService, không ghi bất kỳ dữ liệu nào.
//
// (Đã đối chiếu 100% với source backend thật 05/09/2026 — Router.gs.txt,
// Code.gs.txt): chữ ký `(ss, actor, data)` và shape `actor = {stt, name,
// role, mustChangePassword}` ĐÃ XÁC NHẬN ĐÚNG (khớp `dispatchAction_` thật —
// mọi case khác đều gọi service dạng `xxxData(ss, actor, data.xxx)`). Tên 2
// hàm dưới đây (`perfGetHistory`, `perfGetCurrentForm`) PHẢI khớp CHÍNH XÁC
// với key trong `PERMISSION_MATRIX_` và case trong `dispatchAction_` — xem
// HUONG_DAN_TICH_HOP_PHONGDO.md mục 1.
//
// Định danh người chơi dùng STT (targetStt), không dùng tên — khớp với
// PerformanceHistory đã thêm cột MemberStt (xem PerfSetupService.txt) và
// cách toàn hệ thống nối Matches<->Members qua STT.
// ============================================================================

/**
 * Business action "perfGetHistory" — trả lịch sử phong độ (từng trận) của 1
 * thành viên, phục vụ vẽ biểu đồ đường.
 *
 * KIỂM TRA QUYỀN THEO ĐỐI TƯỢNG (không chỉ theo vai trò — đã chốt 05/09/2026):
 * Member chỉ xem được của chính mình; Admin/Owner xem được của bất kỳ ai.
 * Đây là lớp kiểm tra RIÊNG của module này, KHÔNG nằm trong PERMISSION_MATRIX_
 * chuẩn (PERMISSION_MATRIX_ chỉ gate được bậc vai trò tối thiểu để GỌI action,
 * không gate được "đúng đối tượng"). Router.gs khai báo action này ở bậc
 * quyền tối thiểu = member (đúng khuôn "ĐỌC" — xem PERMISSION_MATRIX_ thật);
 * việc từ chối "member A xem trộm member B" xảy ra NGAY TRONG hàm này.
 *
 * @param {Spreadsheet} ss
 * @param {Object} actor {stt, name, role} — người đang gọi action (đã xác thực)
 * @param {Object} data {targetStt: number}
 * @return {{history: Array<Object>}} history: [{matchId, date, yearMonth,
 *         deltaStep, displayLevel}, ...] sắp theo thời gian tăng dần — bọc
 *         trong { history: [...] } (không trả mảng trần) để dễ mở rộng thêm
 *         field khác sau này mà không phá vỡ hợp đồng phía frontend.
 */
function perfGetHistory(ss, actor, data) {
  var targetStt = Number((data && data.targetStt) || 0);
  perfAssertCanViewMember_(actor, targetStt);

  var sheet = ss.getSheetByName(PERF_SHEET_HISTORY_);
  if (!sheet) return { history: [] };

  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (Number(row[1]) === targetStt) {
      out.push({
        matchId: row[3],
        date: perfFormatHistoryDate_(row[4]),
        _sortTs: perfHistoryDateTimestamp_(row[4]),
        yearMonth: row[5],
        deltaStep: row[6],
        displayLevel: row[8]
      });
    }
  }
  // Sheet đã được ghi theo đúng trình tự thời gian lúc chạy job tháng, nhưng
  // sắp xếp lại tường minh ở đây để không phụ thuộc thứ tự vật lý trong sheet
  // (phòng trường hợp có nhiều tháng được ghi không theo đúng thứ tự thời gian,
  // ví dụ sau khi backfill).
  out.sort(function (a, b) { return a._sortTs - b._sortTs; });
  out.forEach(function (o) { delete o._sortTs; });
  return { history: out };
}

/**
 * (fix 06/09/2026 - phát hiện qua test thật trên Sheet TEST) Cột MatchDate ở
 * PerformanceHistory có thể bị Google Sheets tự nhận diện thành kiểu `Date`
 * (dù job tháng chỉ copy nguyên giá trị cột Thời Gian của Matches). Nếu trả
 * thẳng giá trị Date này trong JSON cho frontend, nó tự động serialize thành
 * chuỗi ISO kiểu "2026-09-05T17:21:07.000Z" — phá hỏng nhãn trục ngày trên
 * biểu đồ (tab "Phong độ" hiện đúng chuỗi ISO thô thay vì ngày đọc được).
 * Hàm này ép luôn về "dd/MM/yyyy HH:mm:ss" — đúng định dạng frontend
 * (perfWeekKeyOf_ ở performance.js) đang kỳ vọng.
 */
function perfFormatHistoryDate_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  }
  return String(value == null ? '' : value);
}

/**
 * Timestamp số để SẮP XẾP history theo đúng thời gian thật, xử lý được cả 2
 * trường hợp: ô sheet đang là Date thật, hoặc đã là chuỗi "dd/MM/yyyy...".
 */
function perfHistoryDateTimestamp_(value) {
  if (value instanceof Date) return value.getTime();
  return perfParseSheetTime_(value);
}

/**
 * Business action "perfGetCurrentForm" — trả tóm tắt phong độ hiện tại (giá
 * trị mới nhất trong tháng đang mở + số trận đã đánh trong tháng). Nếu thành
 * viên chưa có trận nào trong tháng hiện tại, trả về đúng Điểm Base hiện có
 * (đúng "Edge Cases" đã chốt — thành viên mới/chưa có trận thì hiển thị cố
 * định Điểm Base, chưa phát sinh biến động).
 *
 * @param {Spreadsheet} ss
 * @param {Object} actor
 * @param {Object} data {targetStt: number}
 * @return {Object} {currentDisplayLevel, matchesThisMonth, asOf}
 */
function perfGetCurrentForm(ss, actor, data) {
  var targetStt = Number((data && data.targetStt) || 0);
  perfAssertCanViewMember_(actor, targetStt);

  var tz = (typeof getAppTimezone_ === 'function') ? getAppTimezone_(ss) : Session.getScriptTimeZone();
  var currentYearMonth = Utilities.formatDate(new Date(), tz, 'MM/yyyy');

  var history = perfGetHistory(ss, actor, data).history;
  var thisMonthRows = history.filter(function (h) { return h.yearMonth === currentYearMonth; });

  if (thisMonthRows.length > 0) {
    var last = thisMonthRows[thisMonthRows.length - 1];
    return { currentDisplayLevel: last.displayLevel, matchesThisMonth: thisMonthRows.length, asOf: last.date };
  }

  // Chưa có trận nào tháng này -> lấy đúng Điểm Base hiện tại từ Members
  var membersSheet = ss.getSheetByName(PERF_SHEET_MEMBERS_);
  var membersValues = membersSheet.getDataRange().getValues();
  for (var i = 1; i < membersValues.length; i++) {
    if (Number(membersValues[i][PERF_COL_MEMBER_STT_]) === targetStt) {
      var baseRaw = membersValues[i][PERF_COL_MEMBER_BASE_];
      var base = typeof baseRaw === 'number' ? baseRaw : parseFloat(String(baseRaw).replace(',', '.'));
      return { currentDisplayLevel: isNaN(base) ? PERF_DEFAULT_BASE_LEVEL_ : base, matchesThisMonth: 0, asOf: null };
    }
  }
  return { currentDisplayLevel: null, matchesThisMonth: 0, asOf: null };
}

/**
 * Kiểm tra quyền xem theo đối tượng. Ném lỗi (để Router trả về thất bại đúng
 * chuẩn xử lý lỗi chung của hệ thống) nếu không đủ quyền.
 *
 * @param {Object} actor {stt, name, role}
 * @param {number} targetStt
 */
function perfAssertCanViewMember_(actor, targetStt) {
  if (!actor) throw new Error('Không xác định được người dùng đang thao tác.');
  if (!targetStt) throw new Error('Thiếu targetStt.');

  var isSelf = Number(actor.stt) === Number(targetStt);
  if (isSelf) return;

  // Admin/Owner xem được bất kỳ ai. ROLE_LEVEL_ (Router.gs.txt thật) đã xác
  // nhận đúng quy ước member=1/admin=2/owner=3.
  var roleLevel;
  if (typeof ROLE_LEVEL_ !== 'undefined' && ROLE_LEVEL_[actor.role] != null) {
    roleLevel = ROLE_LEVEL_[actor.role];
  } else {
    roleLevel = (actor.role === 'owner') ? 3 : (actor.role === 'admin') ? 2 : 1;
  }
  if (roleLevel < 2) {
    throw new Error('Không có quyền xem phong độ của thành viên khác.');
  }
}

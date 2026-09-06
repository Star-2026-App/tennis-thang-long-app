// ============================================================================
// PerfCalcService.txt — Module "Điểm Phong độ"
// Lõi thuật toán tính điểm phong độ theo tháng, dựa trên Matches + Điểm Base
// hiện tại của Members. Xem đầy đủ lý luận thuật toán + các quyết định đã
// chốt với Star trong PHONGDO_MODULE_PHAN_TICH_KIENTRUC.md (mục 3, 5, 10).
//
// ⚠️ Cột sheet dùng trong file này lấy đúng theo thứ tự đã xác nhận từ file
// Excel export THẬT Star gửi 05/09/2026 (ThangLongTennis_Data_App.xlsx):
//   Matches:  A=ID, B=Thời Gian, C=Đội A (P1), D=Đội A (P2), E=Điểm A, F=Điểm B,
//             G=Đội B (P1), H=Đội B (P2), I=Kèo Đặc Biệt, J=Góc Mặc Định Áp Dụng,
//             K=P1_V1_STT, L=P2_V1_STT, M=P1_V2_STT, N=P2_V2_STT
//   Members:  A=STT, B=Tên Thành Viên, C=Trạng Thái, D=Điểm Base,
//             E=Dư/Nợ Chuyển Kỳ, F=Quyền, G=PasswordHash, H=MustChangePassword,
//             I=IsActive, J=UpdatedAt
// Nếu sheet thật trên production đã đổi thứ tự cột kể từ file Star gửi, phải
// cập nhật lại các chỉ số cột (0-based) bên dưới trước khi deploy.
// ============================================================================

var PERF_DEFAULT_BASE_LEVEL_ = 6.2;      // fallback khi không tra được Level 1 người chơi
var PERF_MONTHLY_CAP_ = 0.05;            // biên độ ±0.05 điểm/tháng (mục Bước 4 yêu cầu gốc)
var PERF_STEP_K_ = 0.0012;               // hệ số K của yêu cầu gốc (Bước 3)
// (mở rộng 06/09/2026 - yêu cầu Star) Điểm Base/displayLevel hiển thị 3 chữ số
// sau dấu phẩy (trước đây chỉ 2 -> nhiều tháng deltа nhỏ bị làm tròn mất, nhìn
// như "không đổi"). Dùng chung 1 hằng số để PerfCalcService.txt (job tháng) và
// PerfBackfillService.txt (backfill) LUÔN làm tròn giống hệt nhau — nếu lệch
// độ chính xác giữa 2 nơi, dữ liệu backfill (tháng cũ) và dữ liệu job tháng
// (tháng mới) sẽ không đồng nhất trên cùng 1 biểu đồ.
var PERF_DISPLAY_PRECISION_ = 1000;      // 1000 = làm tròn 3 chữ số thập phân
var PERF_DEFAULT_SENSITIVITY_S_ = 1.06;  // fallback nếu Settings chưa có dòng "PerfSensitivityS"
                                          // (giá trị đã hiệu chỉnh bằng hồi quy thật trên 129
                                          // trận sạch, xem PHONGDO_MODULE_PHAN_TICH_KIENTRUC.md
                                          // mục 10 — 95% CI [0.74, 1.66], nên xem lại sau 3-6 tháng)

var PERF_SHEET_MATCHES_ = 'Matches';
var PERF_SHEET_MEMBERS_ = 'Members';
var PERF_SHEET_SETTINGS_ = 'Settings';
var PERF_SHEET_HISTORY_ = 'PerformanceHistory';
var PERF_SHEET_MONTHLY_CLOSE_ = 'PerformanceMonthlyClose';

// ---- Cột (0-based) — xem ghi chú thứ tự cột thật ở đầu file ----
var PERF_COL_MATCH_ID_ = 0;
var PERF_COL_MATCH_TIME_ = 1;
var PERF_COL_MATCH_A_P1_NAME_ = 2;
var PERF_COL_MATCH_A_P2_NAME_ = 3;
var PERF_COL_MATCH_SCORE_A_ = 4;
var PERF_COL_MATCH_SCORE_B_ = 5;
var PERF_COL_MATCH_B_P1_NAME_ = 6;
var PERF_COL_MATCH_B_P2_NAME_ = 7;
var PERF_COL_MATCH_A_P1_STT_ = 10;
var PERF_COL_MATCH_A_P2_STT_ = 11;
var PERF_COL_MATCH_B_P1_STT_ = 12;
var PERF_COL_MATCH_B_P2_STT_ = 13;

var PERF_COL_MEMBER_STT_ = 0;
var PERF_COL_MEMBER_NAME_ = 1;
var PERF_COL_MEMBER_BASE_ = 3;     // cột D — nơi module này sẽ ghi đè giá trị mới
var PERF_COL_MEMBER_IS_ACTIVE_ = 8;

// ============================================================================
// Hiệu chỉnh & tiện ích dùng chung
// ============================================================================

/**
 * Đọc hằng số S (độ nhạy mô hình logistic Bước 2), key sheet Settings
 * "PERF_SENSITIVITY_S". Cho phép hiệu chỉnh lại sau 3-6 tháng khi có nhiều dữ
 * liệu Matches hơn mà KHÔNG cần deploy lại code.
 *
 * ⚠️ QUAN TRỌNG (phát hiện 05/09/2026 sau khi đọc source thật
 * `SettingsService.txt`): `saveSettingsSheet()` thật làm việc theo kiểu
 * "rewrite toàn bộ" — mỗi lần Owner bấm Lưu ở tab Cài Đặt, nó
 * `sheet.clearContents()` rồi ghi lại ĐÚNG danh sách khóa nó biết (QUY_AMOUNT,
 * BANK_ID, AUTO_CLOSE_MONTH_ENABLED, ...). Nếu chỉ thêm tay dòng
 * "PerfSensitivityS" vào sheet mà KHÔNG khai báo trong `getSettingsData()`/
 * `saveSettingsSheet()`, dòng đó sẽ BỊ XÓA MẤT ngay lần đầu tiên Owner lưu Cài
 * Đặt bất kỳ lúc nào sau đó — mất luôn giá trị đã hiệu chỉnh mà không có cảnh
 * báo gì. Vì vậy hàm này ưu tiên đọc qua `getSettingsData(ss).perfSensitivityS`
 * (field MỚI cần thêm vào SettingsService.txt — xem HUONG_DAN_TICH_HOP_PHONGDO.md
 * mục 3 — để nó được giữ lại đúng cách qua mỗi lần Lưu Cài Đặt); chỉ fallback
 * về đọc thẳng sheet khi field đó chưa tồn tại (ví dụ chưa kịp tích hợp
 * SettingsService.txt).
 */
function perfGetSensitivityS_(ss) {
  if (typeof getSettingsData === 'function') {
    var settings = getSettingsData(ss);
    if (settings && settings.perfSensitivityS != null) {
      var fromSettings = parseFloat(settings.perfSensitivityS);
      if (!isNaN(fromSettings) && fromSettings > 0) return fromSettings;
    }
  }

  // Fallback: đọc thẳng sheet — CHỈ an toàn cho tới lần đầu Owner lưu Cài Đặt
  // sau khi tích hợp (xem cảnh báo phía trên). Không dựa vào nhánh này lâu dài.
  var sheet = ss.getSheetByName(PERF_SHEET_SETTINGS_);
  if (!sheet) return PERF_DEFAULT_SENSITIVITY_S_;
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === 'PERF_SENSITIVITY_S') {
      var v = parseFloat(String(values[i][1]).replace(',', '.'));
      if (!isNaN(v) && v > 0) return v;
    }
  }
  return PERF_DEFAULT_SENSITIVITY_S_;
}

/**
 * Kiểm tra tên có phải khách mời không — Star đã xác nhận (05/09/2026) chỉ cần
 * loại đúng "Khách mời", không cần lọc thêm theo cột Trạng Thái.
 *
 * (Đã đối chiếu với source backend thật 05/09/2026): hàm dùng chung thật sự
 * tên là `isExcludedMemberStatsName_()` (MemberStatsService.txt — dùng cho
 * MemberStats, KHÔNG có hàm tên `isPhase3GuestName_` nào trong hệ thống, đó
 * là suy đoán sai từ trước khi có source thật). Ưu tiên gọi đúng hàm này để
 * khớp 100% quy ước loại khách mời của MemberStats; fallback dưới đây giờ là
 * BẢN SAO CHÍNH XÁC của `isExcludedMemberStatsName_`/`normalizeMemberStatsName_`
 * thật (không còn là suy đoán) — chỉ dùng khi 2 hàm đó vì lý do nào đó chưa
 * được nạp trước file này trong Apps Script Editor.
 */
function perfIsGuestName_(name) {
  if (typeof isExcludedMemberStatsName_ === 'function') {
    return isExcludedMemberStatsName_(name);
  }
  var normalized = String(name || '').trim().toLowerCase();
  return normalized === 'khách mời' || normalized.indexOf('khách mời ') === 0;
}

/**
 * So khớp "trận có nằm trong tháng yearMonth không".
 *
 * (Đã đối chiếu với source backend thật 05/09/2026): hệ thống KHÔNG có hàm
 * dùng chung nào tên `isLogInMonth_` (suy đoán sai từ trước khi có source
 * thật) — đây là cách so khớp DUY NHẤT, không phải fallback.
 *
 * @param {string} timeStr định dạng "dd/MM/yyyy..." hoặc "dd/MM/yyyy HH:mm:ss"
 * @param {string} yearMonth định dạng "MM/yyyy", ví dụ "09/2026"
 */
function perfIsInYearMonth_(timeStr, yearMonth) {
  if (!timeStr) return false;
  var m = String(timeStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return false;
  var target = String(yearMonth).split('/');
  return parseInt(m[2], 10) === parseInt(target[0], 10) &&
         parseInt(m[3], 10) === parseInt(target[1], 10);
}

/**
 * (fix 05/09/2026 - phát hiện qua perfRunAllTests_ trên Sheet TEST) Google
 * Sheets tự động "đoán" một chuỗi dạng "MM/yyyy" (ví dụ "01/2099") là ngày
 * tháng và âm thầm chuyển nó thành đối tượng Date thật ngay khi setValues()
 * ghi vào sheet — dù code chỉ ghi đúng 1 chuỗi text. Hệ quả: đọc lại ô đó lần
 * sau bằng getValues() sẽ ra 1 Date, không phải chuỗi "01/2099" như đã ghi,
 * làm hỏng MỌI so sánh chuỗi (String(cell) === yearMonth) — chính là nguyên
 * nhân lỗi "chạy lần 2 không phát hiện đã APPLIED" phát hiện qua test. Hàm
 * này chuẩn hoá về lại đúng dạng "MM/yyyy" bất kể ô đang là Date hay chuỗi,
 * dùng ở MỌI nơi so sánh/parse giá trị YearMonth đọc từ sheet.
 */
function perfNormalizeYearMonth_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'MM/yyyy');
  }
  return String(value == null ? '' : value);
}

/** Parse "dd/MM/yyyy HH:mm:ss" thành timestamp để sắp xếp trận theo thời gian thật. */
function perfParseSheetTime_(timeStr) {
  var m = String(timeStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
  if (!m) return 0;
  var d = parseInt(m[1], 10), mo = parseInt(m[2], 10) - 1, y = parseInt(m[3], 10);
  var hh = m[4] ? parseInt(m[4], 10) : 0, mi = m[5] ? parseInt(m[5], 10) : 0, sec = m[6] ? parseInt(m[6], 10) : 0;
  return new Date(y, mo, d, hh, mi, sec).getTime();
}

/**
 * Xây map tra cứu Điểm Base hiện tại của thành viên, theo cả 2 kiểu khóa:
 * 'STT:<n>' (ưu tiên — đúng quyết định 05/09/2026 dùng cột P1_V1_STT/v.v. có sẵn
 * trong Matches) và 'NAME:<tên>' (fallback cho dữ liệu cũ chưa có STT).
 * Chỉ đưa vào map các thành viên IsActive=TRUE.
 */
function perfBuildMemberIndex_(membersValues) {
  var idx = {};
  for (var i = 1; i < membersValues.length; i++) {
    var row = membersValues[i];
    var stt = row[PERF_COL_MEMBER_STT_];
    var name = row[PERF_COL_MEMBER_NAME_];
    var isActive = row[PERF_COL_MEMBER_IS_ACTIVE_] === true ||
      String(row[PERF_COL_MEMBER_IS_ACTIVE_]).toUpperCase() === 'TRUE';
    if (!stt || !name || !isActive) continue;
    var baseRaw = row[PERF_COL_MEMBER_BASE_];
    var base = typeof baseRaw === 'number' ? baseRaw : parseFloat(String(baseRaw).replace(',', '.'));
    var record = {
      stt: Number(stt),
      name: String(name).trim(),
      base: isNaN(base) ? PERF_DEFAULT_BASE_LEVEL_ : base,
      rowIndex: i + 1 // dòng thật trong sheet (1-based, có header)
    };
    idx['STT:' + Number(stt)] = record;
    idx['NAME:' + String(name).trim()] = record;
  }
  return idx;
}

/**
 * Ưu tiên khóa theo STT (cột P1_V1_STT/v.v. — Star xác nhận 05/09/2026 đã gán
 * sẵn cho Matches), fallback về tên cho dòng cũ chưa có STT.
 */
function perfResolvePlayerKey_(sttValue, nameValue) {
  if (sttValue !== '' && sttValue != null && !isNaN(sttValue) && Number(sttValue) > 0) {
    return 'STT:' + Number(sttValue);
  }
  if (nameValue) return 'NAME:' + String(nameValue).trim();
  return null;
}

// ============================================================================
// Bước 1-3 của thuật toán gốc
// ============================================================================

/**
 * Bước 2: xác suất kỳ vọng Đội A thắng 1 game, dựa trên chênh lệch trình độ
 * delta = TotalA - TotalB. Mô hình logistic kiểu Elo — hằng số S đã hiệu
 * chỉnh bằng hồi quy trên dữ liệu Matches thật (mục 10 tài liệu phân tích).
 */
function perfExpectedShareA_(delta, S) {
  return 1 / (1 + Math.pow(10, -delta / S));
}

/**
 * Tính Δstep cho 1 trận.
 *
 * (fix 06/09/2026 - theo yêu cầu Star, đổi ý so với bản đầu): trận có khách
 * mời KHÔNG còn bị bỏ qua toàn bộ nữa — các thành viên CLB khác cùng trận vẫn
 * được tính phong độ bình thường (dùng đúng Base thật của họ để so kèo), chỉ
 * RIÊNG phần của khách mời là không tính/không lưu/không hiển thị. Để so kèo
 * vẫn cần 1 "trình độ" cho khách mời tham gia công thức Elo — dùng tạm
 * PERF_DEFAULT_BASE_LEVEL_ (mức trình độ trung bình mặc định) cho đúng vị trí
 * khách mời, KHÔNG lưu/trả giá trị này ra ngoài. Việc thật sự loại khách mời
 * khỏi kết quả nằm ở bước ghi History/chốt tháng (perfRecalculateMonth_,
 * perfPreviewBackfill_) — nơi mỗi người được xử lý riêng lẻ và chỉ ghi cho
 * người có trong `memberIndex` (khách mời không có trong đó nên tự động bị
 * loại, không cần sửa gì thêm ở các hàm đó).
 *
 * Trả về null nếu KHÔNG đủ điều kiện tính (có người KHÔNG PHẢI khách mời mà
 * vẫn không tra được Base — dữ liệu lỗi, không đoán mò; hoặc tổng game =
 * 0/rỗng) — đúng yêu cầu mục 4 "Edge Cases" của tài liệu gốc.
 *
 * @param {Object} match {teamAP1Name, teamAP2Name, teamBP1Name, teamBP2Name,
 *                         scoreA, scoreB, levelA1, levelA2, levelB1, levelB2}
 * @param {number} S hằng số độ nhạy
 * @return {Object|null} {stepA, stepB, delta, gmA}
 */
function perfComputeMatchSteps_(match, S) {
  var levelA1 = match.levelA1 != null ? match.levelA1 :
    (perfIsGuestName_(match.teamAP1Name) ? PERF_DEFAULT_BASE_LEVEL_ : null);
  var levelA2 = match.levelA2 != null ? match.levelA2 :
    (perfIsGuestName_(match.teamAP2Name) ? PERF_DEFAULT_BASE_LEVEL_ : null);
  var levelB1 = match.levelB1 != null ? match.levelB1 :
    (perfIsGuestName_(match.teamBP1Name) ? PERF_DEFAULT_BASE_LEVEL_ : null);
  var levelB2 = match.levelB2 != null ? match.levelB2 :
    (perfIsGuestName_(match.teamBP2Name) ? PERF_DEFAULT_BASE_LEVEL_ : null);

  if (levelA1 == null || levelA2 == null || levelB1 == null || levelB2 == null) {
    return null;
  }
  var scoreA = Number(match.scoreA), scoreB = Number(match.scoreB);
  var totalGames = scoreA + scoreB;
  if (!totalGames || isNaN(totalGames) || totalGames <= 0) return null;

  var totalA = levelA1 + levelA2;
  var totalB = levelB1 + levelB2;
  var delta = totalA - totalB;

  var pA = perfExpectedShareA_(delta, S);
  var expectedGamesA = totalGames * pA;
  var gmA = scoreA - expectedGamesA;
  var gmB = -gmA; // luôn đối xứng — tổng game trong trận cố định (zero-sum)

  return {
    stepA: gmA * PERF_STEP_K_,   // cả 2 người Đội A cùng nhận giá trị này (đã chốt mục 3.3)
    stepB: gmB * PERF_STEP_K_,   // cả 2 người Đội B cùng nhận giá trị này
    delta: delta,
    gmA: gmA
  };
}

// ============================================================================
// Job chính: tính lại phong độ + chốt Điểm Base cho 1 tháng
// ============================================================================

/**
 * Tính phong độ cho toàn bộ thành viên có tham gia trận trong `yearMonth`,
 * ghi lịch sử vào PerformanceHistory, và CHỐT tháng: cập nhật Điểm Base thật
 * trong Members + ghi PerformanceMonthlyClose.
 *
 * Idempotent theo tháng: nếu PerformanceMonthlyClose đã có bất kỳ dòng nào
 * cho đúng `yearMonth` này với Status="APPLIED", hàm sẽ bỏ qua toàn bộ (chống
 * chạy trùng nếu trigger vô tình bắn 2 lần).
 *
 * ⚠️ KHÔNG gọi hàm này từ 1 action web nào — chỉ gọi từ trigger theo tháng
 * (runPerfMonthlyRecalc_) hoặc chạy tay từ Apps Script Editor. Việc quét toàn
 * bộ Matches trong 1 request web có thể giữ LockService quá lâu — đúng nguyên
 * nhân sự cố 502 đã ghi trong DANH_GIA_LOI_BAO_KET_NOI_20260828.md.
 *
 * @param {Spreadsheet} ss
 * @param {string} yearMonth "MM/yyyy"
 * @return {Object} báo cáo kết quả
 */
function perfRecalculateMonth_(ss, yearMonth) {
  var closeSheet = ss.getSheetByName(PERF_SHEET_MONTHLY_CLOSE_);
  var historySheet = ss.getSheetByName(PERF_SHEET_HISTORY_);
  if (!closeSheet || !historySheet) {
    throw new Error('Chưa chạy setupPerformanceModuleSheets() để tạo sheet PerformanceHistory/PerformanceMonthlyClose.');
  }

  // Chống chạy trùng: đã APPLIED cho tháng này rồi thì bỏ qua toàn bộ.
  var closeValues = closeSheet.getDataRange().getValues();
  for (var c = 1; c < closeValues.length; c++) {
    if (perfNormalizeYearMonth_(closeValues[c][1]) === yearMonth && String(closeValues[c][7]) === 'APPLIED') {
      Logger.log('perfRecalculateMonth_: thang ' + yearMonth + ' da duoc ap dung truoc do, bo qua.');
      return { skipped: true, reason: 'ALREADY_APPLIED' };
    }
  }

  var S = perfGetSensitivityS_(ss);
  var membersSheet = ss.getSheetByName(PERF_SHEET_MEMBERS_);
  var matchesSheet = ss.getSheetByName(PERF_SHEET_MATCHES_);
  var membersValues = membersSheet.getDataRange().getValues();
  var memberIndex = perfBuildMemberIndex_(membersValues);

  var matchesValues = matchesSheet.getDataRange().getValues();
  var monthRows = [];
  for (var r = 1; r < matchesValues.length; r++) {
    var row = matchesValues[r];
    if (perfIsInYearMonth_(row[PERF_COL_MATCH_TIME_], yearMonth)) {
      monthRows.push(row);
    }
  }
  // Sắp theo thời gian tăng dần — để CumulativeInMonth phản ánh đúng trình tự thật
  monthRows.sort(function (a, b) {
    return perfParseSheetTime_(a[PERF_COL_MATCH_TIME_]) - perfParseSheetTime_(b[PERF_COL_MATCH_TIME_]);
  });

  var accum = {};       // key -> { sumRaw, member }
  var historyRows = [];
  var skippedCount = 0;

  monthRows.forEach(function (row) {
    var keyAP1 = perfResolvePlayerKey_(row[PERF_COL_MATCH_A_P1_STT_], row[PERF_COL_MATCH_A_P1_NAME_]);
    var keyAP2 = perfResolvePlayerKey_(row[PERF_COL_MATCH_A_P2_STT_], row[PERF_COL_MATCH_A_P2_NAME_]);
    var keyBP1 = perfResolvePlayerKey_(row[PERF_COL_MATCH_B_P1_STT_], row[PERF_COL_MATCH_B_P1_NAME_]);
    var keyBP2 = perfResolvePlayerKey_(row[PERF_COL_MATCH_B_P2_STT_], row[PERF_COL_MATCH_B_P2_NAME_]);

    var recA1 = keyAP1 ? memberIndex[keyAP1] : null;
    var recA2 = keyAP2 ? memberIndex[keyAP2] : null;
    var recB1 = keyBP1 ? memberIndex[keyBP1] : null;
    var recB2 = keyBP2 ? memberIndex[keyBP2] : null;

    var steps = perfComputeMatchSteps_({
      teamAP1Name: row[PERF_COL_MATCH_A_P1_NAME_],
      teamAP2Name: row[PERF_COL_MATCH_A_P2_NAME_],
      teamBP1Name: row[PERF_COL_MATCH_B_P1_NAME_],
      teamBP2Name: row[PERF_COL_MATCH_B_P2_NAME_],
      scoreA: row[PERF_COL_MATCH_SCORE_A_],
      scoreB: row[PERF_COL_MATCH_SCORE_B_],
      levelA1: recA1 ? recA1.base : null,
      levelA2: recA2 ? recA2.base : null,
      levelB1: recB1 ? recB1.base : null,
      levelB2: recB2 ? recB2.base : null
    }, S);

    if (!steps) { skippedCount++; return; }

    [
      { key: keyAP1, rec: recA1, step: steps.stepA },
      { key: keyAP2, rec: recA2, step: steps.stepA },
      { key: keyBP1, rec: recB1, step: steps.stepB },
      { key: keyBP2, rec: recB2, step: steps.stepB }
    ].forEach(function (entry) {
      if (!entry.rec) return;
      if (!accum[entry.key]) accum[entry.key] = { sumRaw: 0, member: entry.rec };
      accum[entry.key].sumRaw += entry.step;

      var clampedSoFar = Math.max(-PERF_MONTHLY_CAP_, Math.min(PERF_MONTHLY_CAP_, accum[entry.key].sumRaw));
      var displayLevel = Math.round((entry.rec.base + clampedSoFar) * PERF_DISPLAY_PRECISION_) / PERF_DISPLAY_PRECISION_;

      historyRows.push([
        Utilities.getUuid(),
        entry.rec.stt,
        entry.rec.name,
        row[PERF_COL_MATCH_ID_],
        row[PERF_COL_MATCH_TIME_],
        yearMonth,
        Math.round(entry.step * 10000) / 10000,
        Math.round(accum[entry.key].sumRaw * 10000) / 10000,
        displayLevel,
        new Date()
      ]);
    });
  });

  if (historyRows.length > 0) {
    historySheet.getRange(historySheet.getLastRow() + 1, 1, historyRows.length, historyRows[0].length)
      .setValues(historyRows);
  }

  // ---- Chốt tháng: giữ LockService CÀNG NGẮN CÀNG TỐT — toàn bộ tính toán
  // nặng ở trên đã xong trước khi tới đây, trong critical section chỉ còn
  // đúng việc ghi. ----
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var closeRows = [];
  try {
    Object.keys(accum).forEach(function (key) {
      var entry = accum[key];
      var baseBefore = entry.member.base;
      var clampedDelta = Math.max(-PERF_MONTHLY_CAP_, Math.min(PERF_MONTHLY_CAP_, entry.sumRaw));
      var baseAfter = Math.round((baseBefore + clampedDelta) * PERF_DISPLAY_PRECISION_) / PERF_DISPLAY_PRECISION_;

      closeRows.push([
        entry.member.name, yearMonth, baseBefore,
        Math.round(entry.sumRaw * 10000) / 10000, clampedDelta, baseAfter,
        new Date(), 'APPLIED'
      ]);

      membersSheet.getRange(entry.member.rowIndex, PERF_COL_MEMBER_BASE_ + 1).setValue(baseAfter);
    });

    // (fix 05/09/2026 - phát hiện qua perfRunAllTests_ trên Sheet TEST) Đảm
    // bảo tính "idempotent theo tháng" ngay cả khi tháng này KHÔNG có thành
    // viên nào được cập nhật (0 trận, hoặc mọi trận đều bị bỏ qua vì khách
    // mời/thiếu Level/tỷ số rỗng) — nếu không ghi lại 1 dòng "đã APPLIED" cho
    // tháng này, lần gọi thứ 2 (vô tình bấm lại, hoặc trigger bắn trùng) sẽ
    // không phát hiện được là đã chạy rồi và sẽ quét lại toàn bộ Matches một
    // lần nữa — vô hại về mặt dữ liệu (kết quả vẫn y hệt) nhưng sai hợp đồng
    // "idempotent" đã ghi ở đầu hàm và tốn tài nguyên không cần thiết.
    if (closeRows.length === 0) {
      closeRows.push(['', yearMonth, '', 0, 0, '', new Date(), 'APPLIED']);
    }

    if (closeRows.length > 0) {
      closeSheet.getRange(closeSheet.getLastRow() + 1, 1, closeRows.length, closeRows[0].length)
        .setValues(closeRows);
    }
  } finally {
    lock.releaseLock();
  }

  var result = {
    processed: true,
    yearMonth: yearMonth,
    matchesScanned: monthRows.length,
    matchesSkipped: skippedCount,
    membersUpdated: closeRows.length
  };
  Logger.log('perfRecalculateMonth_ hoan tat: ' + JSON.stringify(result));
  return result;
}

// ============================================================================
// Dọn dữ liệu cũ (retention)
// ============================================================================

/**
 * (mới 06/09/2026 - yêu cầu Star mục 3) Sheet "PerformanceHistory" chỉ dùng
 * NỘI BỘ backend để phục vụ biểu đồ theo ngày/tuần (mà theo yêu cầu mục 2 chỉ
 * Owner mới xem được) — KHÔNG phải nguồn dữ liệu chốt chính thức, nguồn đó là
 * "PerformanceMonthlyClose" và sheet đó KHÔNG bao giờ bị đụng tới ở đây.
 *
 * Giữ lại đúng 3 tháng liên tiếp gần nhất (tháng hiện tại + 2 tháng liền
 * trước); dữ liệu cũ hơn bị xóa hẳn để giảm tải đọc/ghi sheet mỗi lần tính
 * hoặc xem biểu đồ. An toàn khi gọi nhiều lần và khi sheet rỗng/chưa đủ 3
 * tháng dữ liệu (không xóa gì).
 *
 * Cách làm: đọc hết vùng dữ liệu, lọc theo cột F (YearMonth, xem giải thích
 * lỗi Sheets tự đổi Date ở perfNormalizeYearMonth_), xóa sạch rồi ghi lại
 * đúng các dòng cần giữ — nhanh và an toàn hơn xóa từng dòng lẻ (tránh lệch
 * chỉ số dòng khi có nhiều dòng không liên tục cần xóa).
 *
 * @param {Spreadsheet} ss
 * @return {Object} {rowsBefore, rowsAfter, rowsDeleted, cutoffYearMonth}
 */
function perfPruneOldHistory_(ss) {
  var historySheet = ss.getSheetByName(PERF_SHEET_HISTORY_);
  if (!historySheet) {
    return { rowsBefore: 0, rowsAfter: 0, rowsDeleted: 0, cutoffYearMonth: null };
  }

  var lastRow = historySheet.getLastRow();
  if (lastRow < 2) {
    return { rowsBefore: 0, rowsAfter: 0, rowsDeleted: 0, cutoffYearMonth: null };
  }

  var tz = (typeof getAppTimezone_ === 'function') ? getAppTimezone_(ss) : Session.getScriptTimeZone();
  var now = new Date();
  // Giữ tháng hiện tại + 2 tháng liền trước = 3 tháng liên tiếp.
  var cutoffDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  var cutoffYearMonth = Utilities.formatDate(cutoffDate, tz, 'MM/yyyy');
  var cutoffKey = perfYearMonthSortKey_(cutoffYearMonth);

  var numCols = historySheet.getLastColumn();
  var values = historySheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  var kept = values.filter(function (row) {
    return perfYearMonthSortKey_(row[5]) >= cutoffKey; // cột F (index 5) = YearMonth
  });

  var rowsDeleted = values.length - kept.length;
  var result = {
    rowsBefore: values.length,
    rowsAfter: kept.length,
    rowsDeleted: rowsDeleted,
    cutoffYearMonth: cutoffYearMonth
  };

  if (rowsDeleted <= 0) {
    return result;
  }

  historySheet.getRange(2, 1, lastRow - 1, numCols).clearContent();
  if (kept.length > 0) {
    historySheet.getRange(2, 1, kept.length, numCols).setValues(kept);
  }

  Logger.log('perfPruneOldHistory_ hoan tat: ' + JSON.stringify(result));
  return result;
}

// ============================================================================
// Trigger hàng tháng
// ============================================================================

/**
 * Chạy tự động theo lịch — tính phong độ + chốt Điểm Base cho THÁNG VỪA ĐÓNG
 * (tháng trước tháng hiện tại). Đề xuất lịch: ngày 2 hằng tháng lúc 09:00 —
 * SAU thời điểm auto-close tháng (~08:30 ngày 1 đầu tháng, xem
 * runAutoCloseMonthMaintenance_ đã có sẵn) để chắc chắn dữ liệu Matches của
 * tháng trước đã ổn định hoàn toàn, và không tranh LockService cùng lúc với
 * trigger chốt tháng nghiệp vụ đã có.
 */
function runPerfMonthlyRecalc_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = (typeof getAppTimezone_ === 'function') ? getAppTimezone_(ss) : Session.getScriptTimeZone();
  var now = new Date();
  var prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var yearMonth = Utilities.formatDate(prevMonthDate, tz, 'MM/yyyy');

  try {
    var result = perfRecalculateMonth_(ss, yearMonth);
    Logger.log('runPerfMonthlyRecalc_ hoan tat: ' + JSON.stringify(result));
  } catch (err) {
    Logger.log('runPerfMonthlyRecalc_ LOI (thang ' + yearMonth + '): ' + err);
    // TODO: cân nhắc thêm cảnh báo chủ động (email Owner) khi job tháng lỗi,
    // vì đây là job chạy im lặng — nếu lỗi mà không ai để ý, Điểm Base sẽ
    // không được cập nhật đúng hạn cho cả tháng.
  }

  // (mới 06/09/2026 - yêu cầu Star mục 3) Dọn PerformanceHistory cũ mỗi khi
  // job tháng chạy — tách try/catch riêng để lỗi dọn dẹp (nếu có) không che
  // mất/ảnh hưởng kết quả chốt tháng ở trên (việc quan trọng hơn nhiều).
  try {
    var pruneResult = perfPruneOldHistory_(ss);
    Logger.log('runPerfMonthlyRecalc_ (prune) hoan tat: ' + JSON.stringify(pruneResult));
  } catch (pruneErr) {
    Logger.log('runPerfMonthlyRecalc_ (prune) LOI: ' + pruneErr);
  }
}

/**
 * Chạy 1 lần từ Apps Script Editor để cài đặt trigger. Gọi lại nhiều lần an
 * toàn — tự xóa trigger cũ của đúng hàm này trước khi tạo lại, không tạo trùng.
 */
function installPerfMonthlyTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runPerfMonthlyRecalc_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runPerfMonthlyRecalc_')
    .timeBased()
    .onMonthDay(2)
    .atHour(9)
    .create();
  Logger.log('Đã cài trigger runPerfMonthlyRecalc_ — chạy ngày 2 hằng tháng lúc 09:00.');
}

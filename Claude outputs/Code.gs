// ======================================================
// CODE.GS (v2.0) - ENTRY POINT
// ======================================================
//
// THAY ĐỔI KIẾN TRÚC LỚN NHẤT của v2.0:
// - KHÔNG còn nhận request trực tiếp từ trình duyệt. Toàn bộ
//   traffic giờ đi qua Vercel BFF (server-to-server).
// - KHÔNG còn JSONP, KHÔNG còn token tĩnh trong URL. Mỗi request
//   là 1 POST JSON body: { action, claim, signature, data,
//   idempotencyKey }. "claim" được Vercel ký bằng
//   APPS_SCRIPT_CLAIM_SECRET (chỉ nằm trong Environment Variables
//   của Vercel + Script Properties của Apps Script).
// - doGet() bị tắt hẳn (fail-closed) - không còn đường ghi dữ
//   liệu qua GET/JSONP như v1.5/v1.6.
// ======================================================

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "ERROR",
      message: "GET không được hỗ trợ. Toàn bộ request phải là POST JSON qua Vercel BFF."
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ======================================================
// (v2.0 perf) KHÓA TOÀN CỤC - CHỈ CHO THAO TÁC GHI
// ======================================================
//
// Trước đây LockService bọc quanh MỌI request kể cả các action THUẦN
// ĐỌC (xem dữ liệu, kiểm tra phiên đăng nhập...) - khiến nhiều người
// dùng app cùng lúc phải xếp hàng chờ nhau ngay cả khi không ai ghi gì
// (thành viên báo app chậm khi vào giờ cao điểm). Danh sách dưới đây
// là các action đã rà soát kỹ TỪNG DÒNG, xác nhận KHÔNG gọi
// appendRow/setValue/deleteRow/generateServerId_ ở bất kỳ đâu trong
// chuỗi gọi của nó - an toàn bỏ qua khóa.
//
// generateServerId_() (SheetService.txt) dựa vào giả định "luôn chạy
// dưới khóa" để đảm bảo ID không trùng khi 2 người ghi cùng lúc - BẤT
// KỲ action nào có khả năng gọi tới nó (mọi action add.../update.../
// delete... và các action hệ thống ghi phiên/mật khẩu) TUYỆT ĐỐI
// không được thêm vào 2 danh sách dưới đây.
// ======================================================

var READ_ONLY_BUSINESS_ACTIONS_ = [
  "whoAmI", "bootstrapData", "initialData", "syncData", "monthData", "analyticsData",
  "cupData", "cupSummary", "monthCloseStatus", "reconcileMonth", "getFullBackupData", "getAuditLogs",
  // ĐIỂM PHONG ĐỘ (module mới 05/09/2026) - PerfQueryService.txt đã rà soát
  // KHÔNG gọi appendRow/setValue/deleteRow/generateServerId_ ở bất kỳ đâu -
  // an toàn bỏ qua khóa như các action đọc khác.
  "perfGetHistory", "perfGetCurrentForm", "perfGetMonthlyBase"
];

var READ_ONLY_SYSTEM_ACTIONS_ = [
  "authPrepareLogin",
  "authLookupMemberByUsername", "authLookupMemberBySTT",
  "authCheckLoginRateLimit", "pushGetSubscriptionsForSend"
];

// ------------------------------------------------------
// LƯU Ý ĐẶT TÊN: KHÔNG được đặt tên hàm dưới đây là
// "dispatchAction_" - Router.gs.txt ĐÃ có sẵn 1 hàm top-level
// trùng tên đó (chữ ký khác: dispatchAction_(ss, actor, action,
// data), dùng cho switch action nghiệp vụ). Apps Script gộp
// TẤT CẢ file .gs vào chung 1 global scope, nên 2 hàm cùng tên
// sẽ ghi đè lẫn nhau một cách âm thầm (tùy thứ tự nạp file) và
// làm hỏng toàn bộ routing mà không có lỗi rõ ràng nào cả. Vì
// vậy hàm điều phối "system vs business" ở Code.gs.txt này bắt
// buộc phải có tên riêng biệt: dispatchTopLevelAction_.
// ------------------------------------------------------

function dispatchTopLevelAction_(ss, actor, body) {
  if (actor.role === "system") {
    if (SYSTEM_ACTIONS_.indexOf(body.action) === -1) {
      throw new Error("Unauthorized: claim hệ thống không được gọi action " + body.action);
    }
    return dispatchSystemAction_(ss, body.action, body.data);
  }

  return processAction_(ss, actor, body.action, body.data, body.idempotencyKey);
}

function dispatchWithLockIfNeeded_(ss, actor, body) {
  var isReadOnly =
    (actor.role === "system" && READ_ONLY_SYSTEM_ACTIONS_.indexOf(body.action) !== -1) ||
    (actor.role !== "system" && READ_ONLY_BUSINESS_ACTIONS_.indexOf(body.action) !== -1);

  if (isReadOnly) {
    return dispatchTopLevelAction_(ss, actor, body);
  }

  var lock = LockService.getScriptLock();
  var locked = false;

  try {
    locked = lock.tryLock(8000);

    if (!locked) {
      throw new Error("Hệ thống đang xử lý một yêu cầu khác. Vui lòng thử lại.");
    }

    return dispatchTopLevelAction_(ss, actor, body);

  } finally {
    if (locked) lock.releaseLock();
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Không có dữ liệu gửi lên.");
    }

    var body = JSON.parse(e.postData.contents);

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ==================================================
    // FAIL-CLOSED: verifyClaim_ ném lỗi nếu thiếu cấu hình
    // secret hoặc chữ ký sai/hết hạn - không có đường "cho qua
    // mặc định" nào như isValidApiToken_ cũ. verifyClaim_/
    // resolveActorFromClaim_ đều THUẦN ĐỌC (tra AuthSessions/Members)
    // nên an toàn để chạy TRƯỚC khi quyết định có cần khóa hay không.
    // ==================================================

    var claim = verifyClaim_(body.claimJson, body.signature);
    var actor = resolveActorFromClaim_(ss, claim);

    var result = dispatchWithLockIfNeeded_(ss, actor, body);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "SUCCESS", result: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "ERROR",
        message: err && err.message ? err.message : String(err)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ======================================================
// BẢO TRÌ NGOÀI LUỒNG NGƯỜI DÙNG
// ======================================================
// Chạy thủ công installDailyMaintenanceTrigger() đúng một lần sau
// khi cập nhật Apps Script. Từ đó cleanup chạy ban đêm, không còn
// ngẫu nhiên chặn một request đăng nhập/ghi dữ liệu của người dùng.

function runDailyMaintenance() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  var storedId = PropertiesService.getScriptProperties().getProperty("MAINTENANCE_SPREADSHEET_ID");
  var ss = active || (storedId ? SpreadsheetApp.openById(storedId) : null);
  if (!ss) throw new Error("Thiếu MAINTENANCE_SPREADSHEET_ID. Hãy chạy lại installDailyMaintenanceTrigger().");
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    cleanupExpiredAuthSessions_(ss);
    cleanupOldAuthAudit_(ss);
    cleanupOldIdempotency_(ss);
  } finally {
    lock.releaseLock();
  }
}

// ======================================================
// (v2.1.2) TỰ ĐỘNG CHỐT THÁNG - trigger RIÊNG lúc ~08:30
// ======================================================
// Trước đây việc tự động chốt tháng chạy CHUNG với dọn dẹp lúc 03:00
// - nhưng theo yêu cầu vận hành mới, Admin được quyền chốt tháng THỦ
// CÔNG trong khung 21h00 (ngày cuối tháng) đến 08h30 (ngày hôm sau) -
// nếu tự động chốt chạy lúc 03:00 thì sẽ chốt trước khi khung giờ
// thủ công đó kết thúc, tước mất cơ hội Admin tự chốt tay. Vì vậy
// tách hẳn ra 1 trigger riêng chạy SAU khi khung giờ thủ công đóng
// lại (08:30) - đúng lúc nếu Admin quên chốt tay thì hệ thống mới
// chốt thay. Xem isManualCloseWindowOpen_()/autoCloseEligiblePeriodsIfDue_()
// ở MonthlyBalanceService.txt.
function runAutoCloseMonthMaintenance_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  var storedId = PropertiesService.getScriptProperties().getProperty("MAINTENANCE_SPREADSHEET_ID");
  var ss = active || (storedId ? SpreadsheetApp.openById(storedId) : null);
  if (!ss) throw new Error("Thiếu MAINTENANCE_SPREADSHEET_ID. Hãy chạy lại installDailyMaintenanceTrigger().");
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var autoCloseResult = autoCloseEligiblePeriodsIfDue_(ss);

    if (autoCloseResult.closed.length > 0) {
      Logger.log(
        "AUTO CLOSE MONTH: da tu dong chot " + autoCloseResult.closed.length + " ky: " +
        autoCloseResult.closed.map(function (r) {
          return r.month + "/" + r.year;
        }).join(", ")
      );
    }
  } catch (autoCloseErr) {
    Logger.log("AUTO CLOSE MONTH loi ngoai du kien: " + autoCloseErr);
  } finally {
    lock.releaseLock();
  }
}

function installDailyMaintenanceTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Hãy chạy hàm này từ project Apps Script gắn với Google Sheet.");
  PropertiesService.getScriptProperties().setProperty("MAINTENANCE_SPREADSHEET_ID", ss.getId());

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    var handler = trigger.getHandlerFunction();
    if (handler === "runDailyMaintenance" || handler === "runAutoCloseMonthMaintenance_") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("runDailyMaintenance")
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();

  // (v2.1.2) Trigger riêng cho tự động chốt tháng, chạy SAU khi khung
  // giờ chốt thủ công (21h00 -> 08h30) đã đóng lại - xem giải thích ở
  // runAutoCloseMonthMaintenance_() phía trên. atHour(8).nearMinute(30)
  // nghĩa là Apps Script sẽ chạy hàm này trong khoảng 08:30-08:45 theo
  // múi giờ của project (Cài đặt project > Múi giờ - cần đặt đúng
  // "(GMT+07:00) Bangkok/Hanoi/Jakarta" để khớp giờ Việt Nam).
  ScriptApp.newTrigger("runAutoCloseMonthMaintenance_")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .nearMinute(30)
    .create();

  return "Đã cài lịch bảo trì hằng ngày lúc khoảng 03:00, và lịch tự động chốt tháng lúc khoảng 08:30.";
}

// ======================================================
// VALIDATE MONTH / YEAR
// ======================================================

function validateMonthYear_(month, year) {
  month = parseInt(month);
  year = parseInt(year);

  if (!month || month < 1 || month > 12) throw new Error("Tháng không hợp lệ.");
  if (!year || year < 2026) throw new Error("Năm không hợp lệ.");

  return { month: month, year: year };
}

function getMonthYearFromTimeValue_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return { month: value.getMonth() + 1, year: value.getFullYear() };
  }

  var text = String(value || "").trim();
  if (!text) return null;

  var match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;

  return { month: parseInt(match[2]) || 0, year: parseInt(match[3]) || 0 };
}

function filterCollectionByMonth_(items, month, year) {
  return (items || []).filter(function(item) {
    var parts = getMonthYearFromTimeValue_(item && item.time);
    if (!parts) return false;
    return parts.month === parseInt(month) && parts.year === parseInt(year);
  });
}

// ======================================================
// MATCHES THEO THÁNG - CHỈ ĐỌC BLOCK ROW CẦN THIẾT
// ======================================================

function getMatchesForMonthLight_(ss, month, year) {
  var period = validateMonthYear_(month, year);

  var sheet = ss.getSheetByName("Matches");
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var timeValues = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  var matchingRows = [];

  for (var i = 0; i < timeValues.length; i++) {
    var parts = getMonthYearFromTimeValue_(timeValues[i][0]);
    if (parts && parts.month === period.month && parts.year === period.year) {
      matchingRows.push(i + 2);
    }
  }

  if (matchingRows.length === 0) return [];

  var blocks = [];
  var blockStart = matchingRows[0];
  var previousRow = matchingRows[0];

  for (var r = 1; r < matchingRows.length; r++) {
    var currentRow = matchingRows[r];

    if (currentRow === previousRow + 1) {
      previousRow = currentRow;
      continue;
    }

    blocks.push({ start: blockStart, count: previousRow - blockStart + 1 });
    blockStart = currentRow;
    previousRow = currentRow;
  }

  blocks.push({ start: blockStart, count: previousRow - blockStart + 1 });

  var result = [];

  blocks.forEach(function(block) {
    var rows = sheet.getRange(block.start, 1, block.count, 14).getValues();

    rows.forEach(function(row, rowOffset) {
      var fallbackId = block.start + rowOffset - 1;
      result.push(buildMatchObjectFromRow_(row, fallbackId));
    });
  });

  return result;
}

// ======================================================
// INITIAL DATA
// ======================================================

// ======================================================
// (v2.0 perf) CACHE NGẮN HẠN CHO initialData
// ======================================================
//
// initialData là action ĐỌC được gọi NHIỀU NHẤT (mỗi lần mở app/
// đăng nhập) và cũng NẶNG nhất (đọc 13 sheet, có sheet quét toàn bộ
// lịch sử). Khi nhiều người cùng mở app trong vài giây (ví dụ sau
// giờ đánh, cả nhóm cùng vào xem), mỗi người đều khiến Apps Script
// đọc lại TOÀN BỘ 13 sheet đó dù dữ liệu chưa kịp thay đổi gì.
//
// Giải pháp: cache kết quả trong CacheService.getScriptCache() với
// TTL rất ngắn (15 giây) theo khóa tháng/năm đang xem. 15 giây đủ
// ngắn để không ai "thấy" dữ liệu cũ (không giống loại cache 1 giờ/
// 1 ngày), nhưng đủ để gộp chung nhiều lượt mở app gần như đồng thời
// thành 1 lần đọc sheet thật duy nhất.
//
// AN TOÀN QUAN TRỌNG - vì sao cache này KHÔNG thể làm sai dữ liệu:
// 1) Bọc try/catch quanh CẢ đọc lẫn ghi cache - nếu CacheService lỗi
//    (hết quota, key quá lớn...) thì initialData vẫn tính lại bình
//    thường như trước khi có cache, không bao giờ vì cache lỗi mà
//    hỏng cả response thật.
// 2) Có kiểm tra kích thước chuỗi JSON trước khi cache.put() - mỗi
//    key của CacheService giới hạn ~100KB, nếu vượt quá thì BỎ QUA
//    việc cache (không cắt bớt dữ liệu, không cache 1 phần), request
//    đó vẫn trả về đầy đủ, chỉ là lần sau sẽ phải tính lại.
// 3) TTL 15s là NGẮN HƠN nhiều so với khoảng thời gian một thao tác
//    ghi (nộp tiền, thêm trận...) hiển thị lại cho người dùng thấy -
//    vì các action ghi (addGocLog, addBooking...) không hề đụng tới
//    cache này, người vừa thao tác ghi xong sẽ thấy đúng dữ liệu mới
//    qua cơ chế cập nhật lạc quan (optimistic update) ở frontend chứ
//    không phải chờ initialData - cache này chỉ ảnh hưởng tới những
//    NGƯỜI KHÁC mở app trong đúng khung 15 giây đó, và 15 giây là
//    chấp nhận được cho mục đích "xem dữ liệu mới nhất".
// ======================================================

var INITIAL_DATA_CACHE_TTL_SECONDS_ = 60;
var INITIAL_DATA_CACHE_CHUNK_CHARS_ = 80000;
var DATA_REVISION_PROPERTY_ = "DATA_REVISION";
var DATA_LAST_COMPUTED_AT_PROPERTY_ = "DATA_LAST_COMPUTED_AT";

function getDataRevision_() {
  var value = parseInt(PropertiesService.getScriptProperties().getProperty(DATA_REVISION_PROPERTY_));
  return value > 0 ? value : 1;
}

function bumpDataRevision_() {
  var properties = PropertiesService.getScriptProperties();
  var next = getDataRevision_() + 1;
  properties.setProperty(DATA_REVISION_PROPERTY_, String(next));
  return next;
}

function readCompressedJsonCache_(baseKey) {
  try {
    var cache = CacheService.getScriptCache();
    var metaText = cache.get(baseKey + "_meta");
    if (!metaText) return null;

    var meta = JSON.parse(metaText);
    var keys = [];
    for (var i = 0; i < meta.chunks; i++) keys.push(baseKey + "_" + i);
    var values = cache.getAll(keys);
    var encoded = "";

    for (var j = 0; j < keys.length; j++) {
      if (!values[keys[j]]) return null; // cache bị đẩy mất một phần
      encoded += values[keys[j]];
    }

    var bytes = Utilities.base64DecodeWebSafe(encoded);
    var json = Utilities.ungzip(Utilities.newBlob(bytes)).getDataAsString("UTF-8");
    return JSON.parse(json);
  } catch (err) {
    Logger.log("readCompressedJsonCache_ bỏ qua lỗi cache: " + err);
    return null;
  }
}

function writeCompressedJsonCache_(baseKey, value) {
  try {
    var json = JSON.stringify(value);
    var gzipBytes = Utilities.gzip(Utilities.newBlob(json, "application/json")).getBytes();
    var encoded = Utilities.base64EncodeWebSafe(gzipBytes);
    var entries = {};
    var chunks = Math.ceil(encoded.length / INITIAL_DATA_CACHE_CHUNK_CHARS_);

    entries[baseKey + "_meta"] = JSON.stringify({ chunks: chunks });
    for (var i = 0; i < chunks; i++) {
      entries[baseKey + "_" + i] = encoded.substring(
        i * INITIAL_DATA_CACHE_CHUNK_CHARS_,
        (i + 1) * INITIAL_DATA_CACHE_CHUNK_CHARS_
      );
    }

    CacheService.getScriptCache().putAll(entries, INITIAL_DATA_CACHE_TTL_SECONDS_);
  } catch (err) {
    Logger.log("writeCompressedJsonCache_ bỏ qua lỗi cache: " + err);
  }
}

function getInitialData_(ss, month, year, bypassCache) {
  var period = validateMonthYear_(month, year);
  var revision = getDataRevision_();
  var cacheKey = "initialData_v" + revision + "_" + period.month + "_" + period.year;

  // ---- 1) Thử đọc cache trước (best-effort) ----
  if (bypassCache !== true) {
    try {
      var cached = readCompressedJsonCache_(cacheKey);
      if (cached) {
        cached.servedFromCache = true; // chỉ để debug, frontend không cần quan tâm field này
        return cached;
      }
    } catch (cacheReadErr) {
      Logger.log("getInitialData_ cache read lỗi (bỏ qua, tính lại): " + cacheReadErr);
    }
  }

  // (v2.1.2 PERF FIX 04/09/2026) Đọc gocLogs/cashbookLogs ĐẦY ĐỦ đúng 1
  // LẦN duy nhất ở đây, dùng chung cho cả việc lọc theo tháng (dưới)
  // lẫn tính tổng quỹ toàn CLB (computeCashbookAggregates_) - bản đầu
  // tiên vô tình đọc lại 2 sheet này 2 LẦN mỗi lần login/tải trang
  // (1 lần trong computeCashbookAggregates_, 1 lần ở filter bên dưới),
  // khiến login chậm hẳn (10-15s), gây 502 do timeout + tự động retry
  // chồng chéo. Xem thêm giải thích ở CashbookService.txt.
  var allGocLogsFull = getGocLogsData(ss);
  var allCashbookLogsFull = getCashbookData(ss);
  var cashbookAggregates = computeCashbookAggregates_(ss, allGocLogsFull, allCashbookLogsFull);

  // ---- 2) Cache miss (hoặc cache lỗi) -> tính đầy đủ như cũ ----
  var payload = {
    status: "SUCCESS",
    action: "initialData",
    dataMode: "MONTH",
    loadedMonth: period.month,
    loadedYear: period.year,
    dataRevision: revision,

    members: getMembersData(ss),
    memberStats: getMemberStatsData(ss),
    quyLogs: getQuyLogsData(ss),
    monthlyBalances: getMonthlyBalancesData(ss),
    rules: getRulesData(ss),
    openingBalance: getOpeningBalance(ss),
    settings: getSettingsData(ss),
    balanceAdjustments: getBalanceAdjustmentsData(ss),
    // Initial chỉ cần tóm tắt để dựng điều hướng/trạng thái CUP.
    // Chi tiết bảng/trận chỉ tải khi người dùng thực sự mở tab CUP.
    cupData: getCupSummaryData(ss),

    // (v2.0) Cho frontend biết STT của Owner để hiển thị đúng badge
    // "Owner" trong danh sách Thành viên và tự ẩn nút Xóa/Đổi quyền
    // trên đúng hàng của Owner - KHÔNG dùng để quyết định quyền (mọi
    // quyết định quyền thật vẫn luôn do Router/PERMISSION_MATRIX ở
    // Apps Script quyết định, đây chỉ là gợi ý hiển thị UI).
    ownerStt: getOwnerStt_(),

    matches: getMatchesForMonthLight_(ss, period.month, period.year),

    // (v2.1.2) "Nộp Tiền"/"Sổ Thu Chi" giờ tải lazy theo tháng đang
    // xem, giống hệt matches/bookingLogs - xem getMonthDataLight_()
    // bên dưới cho luồng đổi tháng. "Dư Quỹ Hiện Tại"/"Dư Đầu Kỳ" (2
    // con số club-wide, KHÔNG phụ thuộc tháng đang xem) vẫn chính xác
    // tuyệt đối nhờ cashbookRunningBalance/quarterOpeningBalance tính
    // sẵn phía trên từ toàn bộ lịch sử Sheet, không cần tải hết dòng
    // về trình duyệt.
    gocLogs: filterCollectionByMonth_(allGocLogsFull, period.month, period.year),
    bookingLogs: filterCollectionByMonth_(getBookingsData(ss), period.month, period.year),
    cashbookLogs: filterCollectionByMonth_(allCashbookLogsFull, period.month, period.year),

    cashbookRunningBalance: cashbookAggregates.cashbookRunningBalance,
    quarterOpeningBalance: cashbookAggregates.quarterOpeningBalance,
    quarterLabel: cashbookAggregates.quarterLabel
  };

  try {
    PropertiesService.getScriptProperties().setProperty(
      DATA_LAST_COMPUTED_AT_PROPERTY_,
      String(Date.now())
    );
  } catch (propertyErr) {
    Logger.log("Không lưu được DATA_LAST_COMPUTED_AT: " + propertyErr);
  }

  // ---- 3) Thử ghi cache (best-effort, không bao giờ làm hỏng response thật) ----
  try {
    writeCompressedJsonCache_(cacheKey, payload);
  } catch (cacheWriteErr) {
    Logger.log("getInitialData_ cache write lỗi (bỏ qua): " + cacheWriteErr);
  }

  return payload;
}

function getInitialDataIfChanged_(ss, month, year, clientRevision, forceReload) {
  var revision = getDataRevision_();
  var lastComputedAt = parseInt(
    PropertiesService.getScriptProperties().getProperty(DATA_LAST_COMPUTED_AT_PROPERTY_)
  ) || 0;
  var recentlyVerified = lastComputedAt > 0 && (Date.now() - lastComputedAt) < 60000;

  // Sau tối đa 60 giây vẫn đọc lại Sheet một lần để nhận cả thay đổi
  // được sửa trực tiếp trong Google Sheets (không đi qua webapp).
  if (forceReload !== true && parseInt(clientRevision) === revision && recentlyVerified) {
    return {
      status: "SUCCESS",
      action: "syncData",
      notModified: true,
      dataRevision: revision
    };
  }

  return getInitialData_(ss, month, year, forceReload === true);
}

function getBootstrapData_(ss, actor, month, year) {
  return {
    session: {
      stt: actor.stt,
      name: actor.name,
      role: actor.role,
      mustChangePassword: !!actor.mustChangePassword
    },
    initialData: actor.mustChangePassword ? null : getInitialData_(ss, month, year)
  };
}

function getMonthDataLight_(ss, month, year) {
  try {
    var period = validateMonthYear_(month, year);

    return {
      status: "SUCCESS",
      action: "monthData",
      dataMode: "MONTH",
      loadedMonth: period.month,
      loadedYear: period.year,
      matches: getMatchesForMonthLight_(ss, period.month, period.year),
      bookingLogs: filterCollectionByMonth_(getBookingsData(ss), period.month, period.year),
      // (v2.1.2) Tab "Nộp Tiền"/"Sổ Thu Chi" đổi tháng qua action này,
      // giống hệt "Thưởng Sân" - xem getInitialData_() phía trên cho
      // lý do 2 con số tổng quỹ (cashbookRunningBalance/
      // quarterOpeningBalance) không nằm ở đây mà chỉ gửi 1 lần trong
      // initialData/bootstrapData (không phụ thuộc tháng đang xem).
      gocLogs: filterCollectionByMonth_(getGocLogsData(ss), period.month, period.year),
      cashbookLogs: filterCollectionByMonth_(getCashbookData(ss), period.month, period.year)
    };

  } catch (err) {
    return {
      status: "ERROR", action: "monthData",
      message: err && err.message ? err.message : String(err),
      matches: [], gocLogs: [], bookingLogs: [], cashbookLogs: []
    };
  }
}

function getMonthCloseStatusLight_(ss, month, year) {
  month = parseInt(month);
  year = parseInt(year);

  var errorBase = {
    status: "ERROR", action: "monthCloseStatus",
    isClosed: false, isExactClosed: false, isLockedByLaterClose: false, recordCount: 0
  };

  if (!month || month < 1 || month > 12) {
    return Object.assign({}, errorBase, { message: "Tháng không hợp lệ." });
  }

  if (!year || year < 2026) {
    return Object.assign({}, errorBase, { message: "Năm không hợp lệ." });
  }

  var sheet = ss.getSheetByName("MonthlyBalances");

  if (!sheet || sheet.getLastRow() <= 1) {
    return {
      status: "SUCCESS", action: "monthCloseStatus", month: month, year: year,
      isClosed: false, isExactClosed: false, isLockedByLaterClose: false,
      recordCount: 0, latestClosedMonth: 0, latestClosedYear: 0
    };
  }

  var values = sheet.getRange(2, 4, sheet.getLastRow() - 1, 2).getValues();
  var targetIndex = year * 12 + month;

  var recordCount = 0;
  var latestClosedIndex = 0;
  var latestClosedMonth = 0;
  var latestClosedYear = 0;

  for (var i = 0; i < values.length; i++) {
    var rowMonth = parseInt(values[i][0]) || 0;
    var rowYear = parseInt(values[i][1]) || 0;

    if (!rowMonth || !rowYear) continue;

    if (rowMonth === month && rowYear === year) recordCount++;

    var rowIndex = rowYear * 12 + rowMonth;

    if (rowIndex > latestClosedIndex) {
      latestClosedIndex = rowIndex;
      latestClosedMonth = rowMonth;
      latestClosedYear = rowYear;
    }
  }

  var isExactClosed = recordCount > 0;
  var isLockedByLaterClose = (!isExactClosed && latestClosedIndex > targetIndex);
  var isClosed = isExactClosed || isLockedByLaterClose;

  var snapshots = [];

  if (isExactClosed) {
    snapshots = getMonthlyBalancesData(ss).filter(function(item) {
      return parseInt(item.month) === month && parseInt(item.year) === year;
    });
  }

  return {
    status: "SUCCESS", action: "monthCloseStatus", month: month, year: year,
    isClosed: isClosed, isExactClosed: isExactClosed, isLockedByLaterClose: isLockedByLaterClose,
    recordCount: recordCount, latestClosedMonth: latestClosedMonth, latestClosedYear: latestClosedYear,
    snapshots: snapshots
  };
}

// ======================================================
// GET TOÀN BỘ - dùng nội bộ (chốt tháng, đối soát, backup)
// ======================================================

function getAllData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  return {
    members: getMembersData(ss),
    memberStats: getMemberStatsData(ss),
    matches: getMatchesData(ss),
    bookingLogs: getBookingsData(ss),
    cashbookLogs: getCashbookData(ss),
    gocLogs: getGocLogsData(ss),
    quyLogs: getQuyLogsData(ss),
    monthlyBalances: getMonthlyBalancesData(ss),
    rules: getRulesData(ss),
    openingBalance: getOpeningBalance(ss),
    settings: getSettingsData(ss),
    balanceAdjustments: getBalanceAdjustmentsData(ss),
    cupData: getCupClientData(ss)
  };
}

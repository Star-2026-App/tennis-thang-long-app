// ======================================================
// ROUTER (v2.0) - PERMISSION_MATRIX + DISPATCH
// ======================================================
//
// Toàn bộ action (đọc lẫn ghi) đi qua đây sau khi Code.gs đã
// verify chữ ký claim và resolve actor (xem ClaimService.gs.txt).
//
// Vai trò được xếp bậc để so sánh nhanh:
//   member = 1, admin = 2, owner = 3
// PERMISSION_MATRIX[action] = bậc TỐI THIỂU cần có.
// ======================================================

var ROLE_LEVEL_ = { member: 1, admin: 2, owner: 3 };

function roleLevel_(role) {
  return ROLE_LEVEL_[role] || 0;
}

var PERMISSION_MATRIX_ = {
  // ĐỌC
  whoAmI: 1,
  bootstrapData: 1,
  initialData: 1,
  syncData: 1,
  monthData: 1,
  analyticsData: 1,
  cupData: 1,
  cupSummary: 1,
  monthCloseStatus: 1,
  reconcileMonth: 2,
  getFullBackupData: 3,
  getAuditLogs: 3,

  // ĐIỂM PHONG ĐỘ (module mới 05/09/2026) - đọc thuần, quyền theo-đối-tượng
  // (member chỉ xem chính mình, admin/owner xem được ai cũng được) xử lý
  // RIÊNG bên trong perfAssertCanViewMember_ (PerfQueryService.txt) - ở đây
  // chỉ cần bậc quyền tối thiểu để GỌI action là member.
  perfGetHistory: 1,
  perfGetCurrentForm: 1,
  perfGetMonthlyBase: 1,

  // TRẬN ĐẤU
  addMatch: 1,
  updateMatch: 2,

  // TIỀN GÓC
  addGocLog: 1,
  updateGocLog: 2,
  addGocLogAdjustment: 2,

  // QUỸ
  addQuyLog: 1,

  // THƯỞNG SÂN
  addBooking: 1,

  // SỔ THU CHI (chỉ admin/owner)
  addCashbook: 2,

  // QUY ĐỊNH
  addRule: 2,
  updateRule: 2,

  // GIẢI ĐẤU CUP - dữ liệu riêng, không đi qua Matches/GocLogs
  submitCupResult: 1,
  saveCupData: 2,
  drawCupTieBreak: 2,
  resetCupData: 2,

  // XÓA CHUNG (whitelist sheet)
  deleteItem: 2,

  // THÀNH VIÊN
  addMember: 2,
  updateSingleMember: 2,
  deleteMember: 2,
  restoreMember: 2,

  // ĐIỀU CHỈNH SỐ DƯ
  addBalanceAdjustment: 2,

  // CHỐT THÁNG
  previewMonthClose: 2,
  closeMonth: 2,

  // CÀI ĐẶT HỆ THỐNG - CHỈ OWNER (P1 ma trận quyền)
  updateSettings: 3,

  // MẬT KHẨU
  changeOwnPassword: 1,
  resetMemberPassword: 2,

  // PUSH
  savePushSubscription: 1,
  deletePushSubscription: 1
};

// Sheet được phép xóa qua deleteItem generic (không bao giờ cho
// Members/Settings/MonthlyBalances/MemberStats/AuthSessions/
// AuthAudit đi qua đường này).
var ALLOWED_DELETE_SHEETS_ = ["Matches", "GocLogs", "QuyLogs", "Bookings", "Cashbook", "Rules"];

// ======================================================
// ÉP "CHÍNH CHỦ" CHO CÁC ACTION CÁ NHÂN KHI ACTOR LÀ MEMBER
// (P1 ma trận: "Thao tác cá nhân" -> Member chỉ chính mình)
// ======================================================

function enforceSelfServiceForMember_(ss, actor, action, data) {
  if (actor.role !== "member") return; // admin/owner được thao tác cho người khác

  if (action === "addGocLog" && data.gocLog) {
    data.gocLog.name = actor.name;
  }

  if (action === "addQuyLog" && data.quyLog) {
    data.quyLog.name = actor.name;
    data.quyLog.memberStt = actor.stt;
  }

  // addBooking đã tự ép trong BookingService.resolveBookingTargetMember_
}

// ======================================================
// CHẶN LEO THANG QUYỀN QUA PAYLOAD MEMBERS (v2.0.4)
//
// PERMISSION_MATRIX vẫn để add/update/delete/restore Member ở mức
// Admin vì Admin được quản lý thành viên thường. Tuy nhiên mọi thao
// tác có thể tạo, nâng/hạ, vô hiệu hóa hoặc khôi phục tài khoản Admin
// đều bắt buộc actor phải là Owner. Kiểm tra tại Router diễn ra TRƯỚC
// idempotency/dispatch; MemberService còn kiểm tra lại lần hai.
// ======================================================

function normalizeMemberRoleRequest_(value, fallbackRole) {
  var raw = value;

  if (raw === undefined || raw === null || String(raw).trim() === "") {
    raw = fallbackRole || "member";
  }

  var role = String(raw).trim().toLowerCase();

  if (role !== "member" && role !== "admin") {
    throw new Error("Vai trò thành viên không hợp lệ. Chỉ chấp nhận member hoặc admin.");
  }

  return role;
}

function assertMemberAdministrationScope_(ss, actor, action, data) {
  var memberActions = ["addMember", "updateSingleMember", "deleteMember", "restoreMember"];
  if (memberActions.indexOf(action) === -1) return;

  data = data || {};
  var actorRole = String(actor && actor.role || "").trim().toLowerCase();

  if (action === "addMember") {
    var newMember = data.member || {};
    var newRole = normalizeMemberRoleRequest_(newMember.role, "member");

    if (newRole === "admin" && actorRole !== "owner") {
      throw new Error("Unauthorized: Chỉ Owner được phép tạo tài khoản Admin.");
    }

    return;
  }

  var targetStt = action === "updateSingleMember"
    ? parseInt(data.member && data.member.stt)
    : parseInt(data.stt);

  if (!targetStt) return; // Service sẽ trả lỗi dữ liệu chi tiết.

  var target = getMemberAuthBySttInternal_(ss, targetStt);
  if (!target) return; // Service sẽ trả lỗi không tìm thấy.

  if (target.role === "owner" && actorRole !== "owner") {
    throw new Error("Unauthorized: Admin không được quản lý tài khoản Owner.");
  }

  if (
    (action === "deleteMember" || action === "restoreMember") &&
    target.role === "admin" &&
    actorRole !== "owner"
  ) {
    throw new Error("Unauthorized: Chỉ Owner được phép xóa hoặc khôi phục tài khoản Admin.");
  }

  if (action === "updateSingleMember") {
    var updateMember = data.member || {};
    var currentStoredRole = target.storedRole === "admin" ? "admin" : "member";
    var requestedRole = normalizeMemberRoleRequest_(updateMember.role, currentStoredRole);

    if (requestedRole !== currentStoredRole && actorRole !== "owner") {
      throw new Error("Unauthorized: Chỉ Owner được phép thay đổi quyền Admin.");
    }
  }
}

// ======================================================
// DISPATCH CHÍNH
// ======================================================

function processAction_(ss, actor, action, data, idempotencyKey) {
  if (!action) throw new Error("Thiếu action.");

  var requiredLevel = PERMISSION_MATRIX_[action];

  if (requiredLevel === undefined) {
    throw new Error("Action không hợp lệ: " + action);
  }

  if (roleLevel_(actor.role) < requiredLevel) {
    throw new Error("Unauthorized: Bạn không có quyền thực hiện thao tác này (" + action + ").");
  }

  // Chặn payload giả mạo role ngay tại biên Router, trước khi đọc
  // idempotency cache hoặc chuyển xuống service ghi dữ liệu.
  assertMemberAdministrationScope_(ss, actor, action, data);

  // ==================================================
  // IDEMPOTENCY - kiểm tra TRƯỚC khi thực thi action ghi
  // ==================================================

  var isWriteAction = (
    ["whoAmI", "bootstrapData", "initialData", "syncData", "monthData", "analyticsData", "cupData", "cupSummary", "monthCloseStatus",
      "reconcileMonth", "getFullBackupData", "getAuditLogs",
      "perfGetHistory", "perfGetCurrentForm", "perfGetMonthlyBase"].indexOf(action) === -1
  );

  // ==================================================
  // BẮT BUỘC ĐỔI MẬT KHẨU LẦN ĐẦU (P1) - chặn MỌI thao tác ghi
  // khác ngoại trừ chính hành động đổi mật khẩu, cho tới khi
  // xong. Đọc dữ liệu vẫn cho phép để UI còn hiển thị được màn
  // hình bắt buộc đổi mật khẩu.
  // ==================================================
  if (actor.mustChangePassword && isWriteAction && action !== "changeOwnPassword") {
    throw new Error("Bạn phải đổi mật khẩu trước khi tiếp tục.");
  }

  if (isWriteAction) {
    if (!idempotencyKey) {
      throw new Error("Thiếu idempotencyKey cho thao tác ghi.");
    }

    var cached = getIdempotentResult_(ss, idempotencyKey);
    if (cached !== null) {
      return cached; // đã xử lý trước đó - trả lại đúng kết quả cũ
    }
  }

  enforceSelfServiceForMember_(ss, actor, action, data);

  var result = dispatchAction_(ss, actor, action, data);

  if (isWriteAction) {
    saveIdempotentResult_(ss, idempotencyKey, action, result);

    // Chỉ tăng revision SAU KHI nghiệp vụ và idempotency đã lưu xong.
    // Initial cache dùng revision trong key nên tự hết hiệu lực ngay,
    // không phải quét/xóa hàng loạt key CacheService.
    try { bumpDataRevision_(); } catch (revisionErr) {
      Logger.log("Không tăng được DATA_REVISION (cache sẽ tự hết hạn): " + revisionErr);
    }

    if (["submitCupResult", "saveCupData", "drawCupTieBreak", "resetCupData"].indexOf(action) !== -1) {
      try {
        if (typeof invalidateCupCache_ === "function") invalidateCupCache_();
      } catch (cupCacheErr) {
        Logger.log("Không xóa được cache CUP: " + cupCacheErr);
      }
    }
  }

  return result;
}

function dispatchAction_(ss, actor, action, data) {
  data = data || {};

  switch (action) {

    case "whoAmI":
      return {
        stt: actor.stt, name: actor.name, role: actor.role,
        mustChangePassword: !!actor.mustChangePassword
      };

    case "bootstrapData": {
      var bootstrapNow = new Date();
      return getBootstrapData_(
        ss,
        actor,
        parseInt(data.month) || bootstrapNow.getMonth() + 1,
        parseInt(data.year) || bootstrapNow.getFullYear()
      );
    }

    case "initialData": {
      var now = new Date();
      return getInitialData_(ss, now.getMonth() + 1, now.getFullYear());
    }

    case "syncData": {
      var syncNow = new Date();
      return getInitialDataIfChanged_(
        ss,
        parseInt(data.month) || syncNow.getMonth() + 1,
        parseInt(data.year) || syncNow.getFullYear(),
        data.dataRevision,
        data.forceReload === true
      );
    }

    case "monthData":
      return getMonthDataLight_(ss, data.month, data.year);

    case "analyticsData":
      return { status: "SUCCESS", action: "analyticsData", matches: getMatchesData(ss) };

    case "cupData":
      return getCupClientData(ss);

    case "cupSummary":
      return getCupSummaryData(ss);

    case "monthCloseStatus":
      return getMonthCloseStatusLight_(ss, data.month, data.year);

    case "reconcileMonth":
      return reconcileMonth_(ss, data.month, data.year);

    case "getFullBackupData":
      return getFullBackupData_(ss);

    case "getAuditLogs":
      return { logs: getAuditLogsData(ss, data.limit) };

    // ĐIỂM PHONG ĐỘ (module mới 05/09/2026) - xem PerfQueryService.txt
    case "perfGetHistory":
      return perfGetHistory(ss, actor, data);

    case "perfGetCurrentForm":
      return perfGetCurrentForm(ss, actor, data);

    case "perfGetMonthlyBase":
      return perfGetMonthlyBase(ss, actor, data);

    case "addMatch":
      return addMatchData(ss, actor, data.match);

    case "updateMatch":
      return updateMatchData(ss, actor, data.match);

    case "addGocLog":
      return addGocLogData(ss, actor, data.gocLog);

    case "updateGocLog":
      return updateGocLogData(ss, actor, data.gocLog);

    case "addGocLogAdjustment":
      return addGocLogAdjustmentData(ss, actor, data.gocLog);

    case "addQuyLog":
      return addQuyLogData(ss, actor, data.quyLog);

    case "addBooking":
      return addBookingData(ss, actor, data.booking);

    case "addCashbook":
      return addCashbookData(ss, actor, data.cashbook);

    case "addRule":
      return addRuleData(ss, actor, data.rule);

    case "updateRule":
      return updateRuleData(ss, actor, data.rule);

    case "submitCupResult":
      return submitCupResult(ss, actor, data);

    case "saveCupData":
      return saveCupData(ss, actor, data);

    case "drawCupTieBreak":
      return drawCupTieBreak(ss, actor, data);

    case "resetCupData":
      return resetCupData(ss, actor, data);

    case "addMember":
      return addMemberData(ss, actor, data.member);

    case "updateSingleMember":
      return updateSingleMemberData(ss, actor, data.member);

    case "deleteMember":
      return deleteMemberData(ss, actor, data.stt);

    case "restoreMember":
      return restoreMemberData(ss, actor, data.stt);

    case "addBalanceAdjustment":
      return addBalanceAdjustmentData(ss, actor, data.adjustment);

    case "previewMonthClose":
      return previewMonthCloseData(ss, data.monthClose);

    case "closeMonth":
      return closeMonthData(ss, actor, data.monthClose);

    case "updateSettings":
      updateSettingsData(ss, actor, data.settings);
      return getSettingsData(ss);

    case "changeOwnPassword":
      return changeOwnPasswordAction_(ss, actor, data);

    case "resetMemberPassword":
      return resetMemberPasswordAction_(ss, actor, data);

    case "savePushSubscription":
      return savePushSubscriptionData(ss, actor, data.subscription);

    case "deletePushSubscription":
      deletePushSubscriptionData(ss, actor, data.endpoint);
      return { endpoint: data.endpoint };

    case "deleteItem": {
      var targetSheet = String(data.sheetName || "");

      if (ALLOWED_DELETE_SHEETS_.indexOf(targetSheet) === -1) {
        throw new Error("Không được phép xóa dữ liệu ở sheet: " + targetSheet);
      }

      if (targetSheet === "Matches") {
        return deleteMatchData(ss, actor, data.id);
      }

      assertClosedPeriodGuardForGenericDelete_(ss, targetSheet, data.id);

      var deletedRecord = deleteRowById(ss, targetSheet, data.id);

      appendAuthAudit_(ss, {
        actorStt: actor.stt, actorName: actor.name, actorRole: actor.role,
        action: "deleteItem", entity: targetSheet, entityId: deletedRecord.id
      });

      return deletedRecord;
    }

    default:
      throw new Error("Action không hợp lệ: " + action);
  }
}

// Với GocLogs/QuyLogs/Bookings/Cashbook/Rules bị xóa qua đường
// generic: nếu bản ghi có mốc thời gian thuộc tháng đã chốt thì
// chặn (Matches đã có đường riêng chặt hơn ở deleteMatchData).
function assertClosedPeriodGuardForGenericDelete_(ss, sheetName, id) {
  if (sheetName !== "GocLogs" && sheetName !== "Bookings") return;

  var items = sheetName === "GocLogs" ? getGocLogsData(ss) : getBookingsData(ss);
  var item = items.filter(function(x) { return String(x.id) === String(id); })[0];

  if (item) {
    assertPeriodNotClosed_(ss, item.time);
  }
}

// ======================================================
// MẬT KHẨU
// ======================================================

function changeOwnPasswordAction_(ss, actor, data) {
  if (!data.newPasswordHash) throw new Error("Thiếu mật khẩu mới.");

  setMemberPasswordHash_(ss, actor.stt, data.newPasswordHash, false);

  appendAuthAudit_(ss, {
    actorStt: actor.stt, actorName: actor.name, actorRole: actor.role,
    action: "changeOwnPassword", entity: "Members", entityId: actor.stt
  });

  return { stt: actor.stt };
}

function resetMemberPasswordAction_(ss, actor, data) {
  var targetStt = parseInt(data.targetStt);
  if (!targetStt) throw new Error("Thiếu thành viên cần đặt lại mật khẩu.");

  var target = getMemberAuthBySttInternal_(ss, targetStt);
  if (!target) throw new Error("Không tìm thấy thành viên STT " + targetStt);

  if (target.role === "owner") {
    throw new Error("Không thể đặt lại mật khẩu của Owner qua đường này.");
  }

  if (target.role === "admin" && actor.role !== "owner") {
    throw new Error("Chỉ Owner được phép đặt lại mật khẩu của Admin khác.");
  }

  if (!data.newPasswordHash) throw new Error("Thiếu mật khẩu mới.");

  setMemberPasswordHash_(ss, targetStt, data.newPasswordHash, true);

  appendAuthAudit_(ss, {
    actorStt: actor.stt, actorName: actor.name, actorRole: actor.role,
    action: "resetMemberPassword", entity: "Members", entityId: targetStt
  });

  return { stt: targetStt };
}

// ======================================================
// SYSTEM ACTIONS - chỉ khi claim.system === true
// (bootstrap đăng nhập/đổi mật khẩu/gửi push - xem ClaimService)
// ======================================================

var SYSTEM_ACTIONS_ = [
  "authPrepareLogin", "authCompleteLogin",
  "authLookupMemberByUsername", "authLookupMemberBySTT",
  "authCreateSession", "authRevokeSession",
  "authCheckLoginRateLimit", "authRecordFailedLogin", "authResetLoginAttempts",
  "authTryOwnerBootstrap", "authSetPasswordHash",
  "pushGetSubscriptionsForSend", "pushRemoveExpiredEndpoints"
];

function dispatchSystemAction_(ss, action, data) {
  data = data || {};

  switch (action) {

    // Gộp kiểm tra rate-limit + tra tài khoản vào 1 lượt HTTP từ
    // Vercel. Cả hai bước đều chỉ đọc nên không giữ khóa toàn cục.
    case "authPrepareLogin":
      assertLoginNotRateLimited_(ss, data.key);
      return { member: getMemberAuthByUsername_(ss, data.username) };

    // Gộp xóa bộ đếm sai + tạo session vào cùng 1 lượt HTTP và cùng
    // một critical section. Chỉ gọi sau khi Vercel đã xác minh bcrypt.
    case "authCompleteLogin":
      resetLoginAttempts_(ss, data.key);
      return createAuthSession_(
        ss, data.sessionId, data.stt, data.name, data.role, data.userAgent
      );

    case "authLookupMemberByUsername":
      return getMemberAuthByUsername_(ss, data.username);

    case "authLookupMemberBySTT":
      return getMemberAuthBySttInternal_(ss, data.stt);

    case "authCreateSession":
      return createAuthSession_(ss, data.sessionId, data.stt, data.name, data.role, data.userAgent);

    case "authRevokeSession":
      revokeAuthSession_(ss, data.sessionId);
      return { revoked: true };

    case "authCheckLoginRateLimit":
      assertLoginNotRateLimited_(ss, data.key);
      return { ok: true };

    case "authRecordFailedLogin":
      recordFailedLoginAttempt_(ss, data.key);
      return { ok: true };

    case "authResetLoginAttempts":
      resetLoginAttempts_(ss, data.key);
      return { ok: true };

    case "authTryOwnerBootstrap": {
      var bootstrapOk = tryConsumeOwnerBootstrapPassword_(data.password);
      return { ok: bootstrapOk };
    }

    case "authSetPasswordHash":
      setMemberPasswordHash_(ss, data.stt, data.passwordHash, data.mustChangePassword);
      return { ok: true };

    case "pushGetSubscriptionsForSend":
      return { subscriptions: getPushSubscriptionsData(ss) };

    case "pushRemoveExpiredEndpoints":
      return removeExpiredPushSubscriptions_(ss, data.endpoints);

    default:
      throw new Error("System action không hợp lệ: " + action);
  }
}

// ======================================================
// BACKUP ĐẦY ĐỦ (P0/P4) - Owner only
// ======================================================

function getFullBackupData_(ss) {
  return {
    generatedAt: new Date().toISOString(),
    members: getAllMembersData_(ss),
    matches: getMatchesData(ss),
    gocLogs: getGocLogsData(ss),
    quyLogs: getQuyLogsData(ss),
    bookingLogs: getBookingsData(ss),
    cashbookLogs: getCashbookData(ss),
    rules: getRulesData(ss),
    settings: getSettingsData(ss),
    openingBalance: getOpeningBalance(ss),
    monthlyBalances: getMonthlyBalancesData(ss),
    memberStats: getMemberStatsData(ss),
    balanceAdjustments: getBalanceAdjustmentsData(ss),
    cupData: getCupData(ss),
    auditLogs: getAuditLogsData(ss, 5000)
  };
}

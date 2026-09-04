// ======================================================
// STORAGE.JS (v2.0)
// ======================================================
//
// SỬA điểm yếu #11 (phần localStorage) + #6 (hàng đợi lẫn giữa
// các người dùng trên cùng thiết bị):
//
// - MỌI key localStorage chứa dữ liệu CLB giờ được đặt tên theo
//   ĐÚNG actor đang đăng nhập (hậu tố "_<STT>"). Người dùng B đăng
//   nhập trên cùng thiết bị sau khi A đăng xuất sẽ KHÔNG BAO GIỜ
//   nhìn thấy cache của A.
// - saveLocalData()/loadLocalData() KHÔNG làm gì nếu chưa có actor
//   đăng nhập (loggedInMemberStt === 0) - không còn đường nào ghi/
//   đọc dữ liệu CLB vào localStorage trước khi đăng nhập.
// - syncQueue của MỖI actor được giữ NGUYÊN qua các lần đăng xuất/
//   đăng nhập lại (không mất thao tác chưa đồng bộ), nhưng KHÔNG
//   bao giờ được xử lý thay cho actor khác (chặn ở processQueue()
//   trong api.js qua trường payload.__ownerStt).
// - clearFinancialLocalDataForActor_() dọn sạch cache TÀI CHÍNH của
//   1 actor cụ thể khi đăng xuất (giữ lại syncQueue của actor đó).
// ======================================================

function getActorStorageKey_(base) {

    let stt =
        (typeof loggedInMemberStt !== "undefined" && loggedInMemberStt) || 0;

    return base + "_" + stt;
}

function sortCollectionsByTime() {
    if (matches && matches.length > 0) {
        matches.sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));
    }
    if (gocLogs && gocLogs.length > 0) {
        gocLogs.sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));
    }
    if (bookingLogs && bookingLogs.length > 0) {
        bookingLogs.sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));
    }
    if (cashbookLogs && cashbookLogs.length > 0) {
        cashbookLogs.sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));
    }
}

// Danh sách các "base key" chứa dữ liệu CLB/tài chính theo actor -
// dùng chung cho save/load/clear để tránh liệt kê lặp lại 3 nơi.
var CLB_ACTOR_STORAGE_BASES_ = [
    "clb_members", "clb_matches", "clb_bookingLogs", "clb_cashbookLogs",
    "clb_gocLogs", "clb_quyLogs", "clb_rulesList", "clb_openingBalance",
    "clb_settings", "clb_cupData", "clb_dataRevision", "clb_balanceAdjustments"
];

function saveLocalData() {

    sortCollectionsByTime();

    if (!loggedInMemberStt) {
        // (v2.0) Chưa đăng nhập -> không ghi bất kỳ dữ liệu CLB nào
        // vào localStorage (sửa điểm yếu #11).
        return;
    }

    localStorage.setItem(getActorStorageKey_('clb_members'), JSON.stringify(members));
    localStorage.setItem(getActorStorageKey_('clb_matches'), JSON.stringify(matches));
    localStorage.setItem(getActorStorageKey_('clb_bookingLogs'), JSON.stringify(bookingLogs));
    localStorage.setItem(getActorStorageKey_('clb_cashbookLogs'), JSON.stringify(cashbookLogs));
    localStorage.setItem(getActorStorageKey_('clb_gocLogs'), JSON.stringify(gocLogs));
    localStorage.setItem(getActorStorageKey_('clb_quyLogs'), JSON.stringify(quyLogs));
    localStorage.setItem(getActorStorageKey_('clb_rulesList'), JSON.stringify(rulesList));
    localStorage.setItem(getActorStorageKey_('clb_cupData'), JSON.stringify(cupData));
    localStorage.setItem(getActorStorageKey_('clb_openingBalance'), openingBalance);
    localStorage.setItem(getActorStorageKey_('clb_settings'), JSON.stringify(systemSettings));
    localStorage.setItem(getActorStorageKey_('clb_dataRevision'), String(parseInt(dataRevision) || 0));
    localStorage.setItem(getActorStorageKey_('clb_balanceAdjustments'), JSON.stringify(balanceAdjustments));

    // syncQueue: khoá riêng, KHÔNG nằm trong CLB_ACTOR_STORAGE_BASES_
    // vì không bị xoá khi logout (xem clearFinancialLocalDataForActor_).
    localStorage.setItem(getActorStorageKey_('clb_syncQueue'), JSON.stringify(syncQueue));
}

function loadLocalData() {

    if (!loggedInMemberStt) {

        members = [];
        matches = [];
        bookingLogs = [];
        cashbookLogs = [];
        gocLogs = [];
        quyLogs = [];
        rulesList = [];
        cupData = null;
        dataRevision = 0;
        balanceAdjustments = [];
        syncQueue = [];
        return;
    }

    members = JSON.parse(localStorage.getItem(getActorStorageKey_('clb_members'))) || [];
    matches = JSON.parse(localStorage.getItem(getActorStorageKey_('clb_matches'))) || [];
    bookingLogs = JSON.parse(localStorage.getItem(getActorStorageKey_('clb_bookingLogs'))) || [];
    cashbookLogs = JSON.parse(localStorage.getItem(getActorStorageKey_('clb_cashbookLogs'))) || [];
    gocLogs = JSON.parse(localStorage.getItem(getActorStorageKey_('clb_gocLogs'))) || [];
    quyLogs = JSON.parse(localStorage.getItem(getActorStorageKey_('clb_quyLogs'))) || [];
    rulesList = JSON.parse(localStorage.getItem(getActorStorageKey_('clb_rulesList'))) || [];
    cupData = JSON.parse(localStorage.getItem(getActorStorageKey_('clb_cupData'))) || null;
    dataRevision = parseInt(localStorage.getItem(getActorStorageKey_('clb_dataRevision'))) || 0;
    balanceAdjustments = JSON.parse(localStorage.getItem(getActorStorageKey_('clb_balanceAdjustments'))) || [];

    let storedBal = localStorage.getItem(getActorStorageKey_('clb_openingBalance'));
    if (storedBal !== null) openingBalance = parseFloat(storedBal);

    let storedSets = JSON.parse(localStorage.getItem(getActorStorageKey_('clb_settings')));
    if (storedSets) systemSettings = Object.assign(systemSettings, storedSets);

    syncQueue = JSON.parse(localStorage.getItem(getActorStorageKey_('clb_syncQueue'))) || [];

    sortCollectionsByTime();
}

// Gọi khi ĐĂNG XUẤT (auth.js logout()) - dọn cache tài chính của
// ĐÚNG actor vừa đăng xuất khỏi localStorage, GIỮ LẠI syncQueue của
// actor đó (thao tác chưa đồng bộ không được mất) và các phase3
// cache (memberStats/tháng đang xem) theo cùng nguyên tắc.
function clearFinancialLocalDataForActor_(stt) {

    if (!stt) return;

    CLB_ACTOR_STORAGE_BASES_.forEach(function(base) {
        try {
            localStorage.removeItem(base + "_" + stt);
        } catch (err) { /* ignore */ }
    });

    ["clb_memberStats_phase3", "clb_activeMonth_phase3", "clb_activeYear_phase3"]
        .forEach(function(base) {
            try {
                localStorage.removeItem(base + "_" + stt);
            } catch (err) { /* ignore */ }
        });
}

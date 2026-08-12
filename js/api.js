function enqueueAction(actionName, payload, successMessage) {
    payload.action = actionName;
    syncQueue.push(payload);

    if (actionName === "addMatch" && payload.match) matches.unshift(payload.match);
    else if (actionName === "updateMatch" && payload.match) {
        let m = matches.find(x => x.id == payload.match.id);
        if (m) { m.scoreA = payload.match.scoreA; m.scoreB = payload.match.scoreB; m.specialBet = payload.match.specialBet; }
    }
    else if (actionName === "addGocLog" && payload.gocLog) gocLogs.unshift(payload.gocLog);
    else if (actionName === "addBooking" && payload.booking) bookingLogs.unshift(payload.booking);
    else if (actionName === "addCashbook" && payload.cashbook) cashbookLogs.unshift(payload.cashbook);
    else if (actionName === "addRule" && payload.rule) rulesList.unshift(payload.rule);
    else if (actionName === "updateSettings" && payload.settings) systemSettings = payload.settings;
    else if (actionName === "deleteItem") {
        let id = payload.id;
        if (payload.sheetName === "Matches") matches = matches.filter(x => x.id != id);
        if (payload.sheetName === "Bookings") bookingLogs = bookingLogs.filter(x => x.id != id);
        if (payload.sheetName === "Cashbook") cashbookLogs = cashbookLogs.filter(x => x.id != id);
        if (payload.sheetName === "GocLogs") gocLogs = gocLogs.filter(x => x.id != id);
        if (payload.sheetName === "Rules") rulesList = rulesList.filter(x => x.id != id);
    }

    sortCollectionsByTime();
    saveLocalData();
    
    if (actionName === "addGocLog") {
    
        // Tiền góc thay đổi số tiền đã nộp của thành viên
        recalculateMemberPaidTotals();
    
        // Chỉ render các màn hình thực sự liên quan
        renderGocLogsTab();
        renderDashboard();
        renderFinance();
        renderCashbook();
    
        applyRolePermissions();
    
    } else {
    
        // Các nghiệp vụ khác tạm thời giữ nguyên
        initApp();
    }
    
    showToast(successMessage || "Đã ghi nhận thành công!");
    processQueue();
    }

function processQueue() {
    if (isSyncing || syncQueue.length === 0 || !GOOGLE_SCRIPT_URL) return;
    isSyncing = true;
    let item = syncQueue[0];

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(item)
    })
    .then(res => res.json())
    .then(() => {
        syncQueue.shift();
        isSyncing = false;
        saveLocalData();
        if (syncQueue.length > 0) processQueue();
    })
    .catch(err => { isSyncing = false; });
}

function fetchCloudData(showSpinner) {
    if (!GOOGLE_SCRIPT_URL) return;
    if (showSpinner) {
        document.getElementById('loadingOverlay').classList.remove('hidden');
        document.getElementById('loadingOverlay').classList.add('flex');
    }

    fetch(GOOGLE_SCRIPT_URL)
    .then(res => res.json())
    .then(data => {
        if (showSpinner) {
            document.getElementById('loadingOverlay').classList.add('hidden');
            document.getElementById('loadingOverlay').classList.remove('flex');
        }
        updateStateFromCloud(data);
    })
    .catch(err => {
        if (showSpinner) {
            document.getElementById('loadingOverlay').classList.add('hidden');
            document.getElementById('loadingOverlay').classList.remove('flex');
        }
    });
}

function updateStateFromCloud(data) {
    if (data.members && data.members.length > 0) members = data.members;
    if (data.matches) matches = data.matches;
    if (data.bookingLogs) bookingLogs = data.bookingLogs;
    if (data.cashbookLogs) cashbookLogs = data.cashbookLogs;
    if (data.gocLogs) gocLogs = data.gocLogs;
    if (data.quyLogs) quyLogs = data.quyLogs;
    if (data.rules) rulesList = data.rules;
    if (data.openingBalance !== undefined) openingBalance = data.openingBalance;
    if (data.settings) systemSettings = Object.assign(systemSettings, data.settings);

    sortCollectionsByTime();
    saveLocalData();
    initApp();
}

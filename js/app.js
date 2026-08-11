window.addEventListener('DOMContentLoaded', () => {
    let now = new Date();
    let curMonth = now.getMonth() + 1;
    let curYear = now.getFullYear();
    
    if (document.getElementById('selectFinanceMonth')) document.getElementById('selectFinanceMonth').value = curMonth;
    if (document.getElementById('selectFinanceYear')) document.getElementById('selectFinanceYear').value = curYear;
    if (document.getElementById('selectBookingMonth')) document.getElementById('selectBookingMonth').value = curMonth;
    if (document.getElementById('selectBookingYear')) document.getElementById('selectBookingYear').value = curYear;

    loadLocalData();
    if (!members || members.length === 0) members = defaultFallbackMembers;

    initApp();
    fetchCloudData(false);
});

function showToast(msg) {
    let toast = document.getElementById('appToast');
    let msgSpan = document.getElementById('toastMsg');
    if (!toast || !msgSpan) return;
    msgSpan.innerText = msg;
    toast.classList.remove('translate-y-12', 'opacity-0');
    setTimeout(() => { toast.classList.add('translate-y-12', 'opacity-0'); }, 2500);
}


function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('border-amber-400', 'text-amber-300', 'font-bold', 'bg-emerald-800'));
    document.getElementById('tab-' + tabId).classList.add('active');
    let activeBtn = document.getElementById('btn-' + tabId);
    if (activeBtn) activeBtn.classList.add('border-amber-400', 'text-amber-300', 'font-bold', 'bg-emerald-800');
    
    document.getElementById('mobileMenuDrawer').classList.add('hidden');

    if (tabId === 'analytics') {
        renderAnalyticsTab();
    }
}

function switchTabMobile(tabId, label) {
    document.getElementById('currentActiveTabLabel').innerText = label;
    switchTab(tabId);
}

function toggleMobileMenu() {
    let drawer = document.getElementById('mobileMenuDrawer');
    if (drawer.classList.contains('hidden')) drawer.classList.remove('hidden');
    else drawer.classList.add('hidden');
}

function openUserProfileModal() {
    let modal = document.getElementById('userProfileModal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeUserProfileModal() {
    let modal = document.getElementById('userProfileModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function initApp() {
    if (!members || members.length === 0) members = defaultFallbackMembers;
    populateSettingsForm();
    populateSelectors();
    recalculateMemberPaidTotals();
    renderGamification();
    renderDashboard();
    renderFinance();
    renderAllMatchLog();
    renderGocLogsTab();
    renderBookingLogs();
    renderQuyTable();
    renderCashbook();
    renderMemberList();
    renderRulesTab();
    renderAnalyticsTab();
    applyRolePermissions();
}

function onFinanceMonthYearChange() {
    let m = document.getElementById('selectFinanceMonth').value;
    let y = document.getElementById('selectFinanceYear').value;
    if (document.getElementById('selectBookingMonth')) document.getElementById('selectBookingMonth').value = m;
    if (document.getElementById('selectBookingYear')) document.getElementById('selectBookingYear').value = y;
    renderFinance();
    renderBookingLogs();
}

function populateSettingsForm() {
    document.getElementById('stQuyAmount').value = systemSettings.quyAmount;
    document.getElementById('stReward16').value = systemSettings.reward16h;
    document.getElementById('stReward18').value = systemSettings.reward18h;
    document.getElementById('stMaxLimit').value = systemSettings.maxRewardLimit;
    document.getElementById('stBankId').value = systemSettings.bankId;
    document.getElementById('stBankAccount').value = systemSettings.bankAccount;
    document.getElementById('stAccountName').value = systemSettings.accountName;

    let qrUrl = `https://img.vietqr.io/image/${systemSettings.bankId}-${systemSettings.bankAccount}-compact2.png?accountName=${encodeURIComponent(systemSettings.accountName)}`;
    document.getElementById('dashQrImg').src = qrUrl;
}

function showActionConfirm(message, callback) {
    document.getElementById('actionConfirmText').innerText = message;
    pendingActionCallback = callback;
    let modal = document.getElementById('actionConfirmModal');
    
    let okBtn = document.getElementById('actionConfirmOkBtn');
    okBtn.onclick = function() {
        closeActionConfirmModal(true);
    };

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeActionConfirmModal(isConfirmed) {
    let modal = document.getElementById('actionConfirmModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (isConfirmed && typeof pendingActionCallback === 'function') {
        pendingActionCallback();
    }
    pendingActionCallback = null;
}

function saveSystemSettings(e) {
    e.preventDefault();
    showActionConfirm("Bạn có chắc chắn muốn lưu các cài đặt hệ thống mới lên Cloud?", () => {
        systemSettings.quyAmount = parseFloat(document.getElementById('stQuyAmount').value) || 600000;
        systemSettings.reward16h = parseFloat(document.getElementById('stReward16').value) || 20000;
        systemSettings.reward18h = parseFloat(document.getElementById('stReward18').value) || 30000;
        systemSettings.maxRewardLimit = parseInt(document.getElementById('stMaxLimit').value) || 15;
        systemSettings.bankId = document.getElementById('stBankId').value.trim().toUpperCase();
        systemSettings.bankAccount = document.getElementById('stBankAccount').value.trim();
        systemSettings.accountName = document.getElementById('stAccountName').value.trim().toUpperCase();

        enqueueAction("updateSettings", { settings: systemSettings }, "Đã lưu cài đặt hệ thống lên Cloud thành công!");
    });
}

function recalculateMemberPaidTotals() {
    if (!members || members.length === 0) return;
    members.forEach(m => {
        let userLogs = gocLogs.filter(g => g.name === m.name);
        m.paidUser = userLogs.reduce((sum, g) => sum + parseInt(g.amount || 0), 0);
    });
}

function populateSelectors() {
    if (!members || members.length === 0) return;
    
    ['dashMainUser', 'filterGocUser'].forEach(id => {
        let sel = document.getElementById(id);
        if (!sel) return;
        let currentVal = sel.value;
        if (id === 'filterGocUser') sel.innerHTML = '<option value="ALL">-- Tất cả thành viên --</option>';
        else sel.innerHTML = '';
        
        members.forEach(m => {
            let opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = m.name;
            sel.appendChild(opt);
        });
        if (currentVal) sel.value = currentVal;
    });

    ['matchP1A', 'matchP2A', 'matchP1B', 'matchP2B'].forEach(id => {
        let sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="" disabled selected>-- Chọn thành viên --</option>';
        members.forEach(m => {
            let opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = m.name;
            sel.appendChild(opt);
        });
    });

    if (loggedInMemberName) {
        let dashSelect = document.getElementById('dashMainUser');
        if (dashSelect) {
            dashSelect.value = loggedInMemberName;
            if (currentUserRole !== 'admin') dashSelect.disabled = true;
        }
    }
}


function showCustomConfirm(message, onConfirm) {
    let modal = document.getElementById('customConfirmModal');
    let textEl = document.getElementById('customConfirmText');
    let okBtn = document.getElementById('customConfirmOkBtn');
    let cancelBtn = document.getElementById('customConfirmCancelBtn');

    textEl.innerText = message;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    let newOkBtn = okBtn.cloneNode(true);
    let newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        onConfirm(true);
    });

    newCancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        onConfirm(false);
    });
}


function openNotificationModal() {
    renderGamification();
    document.getElementById('notificationModal').classList.remove('hidden');
    document.getElementById('notificationModal').classList.add('flex');
}

function closeNotificationModal() {
    document.getElementById('notificationModal').classList.add('hidden');
    document.getElementById('notificationModal').classList.remove('flex');
}


function exportToExcel() {
    let wb = XLSX.utils.book_new();
    let wsMem = XLSX.utils.json_to_sheet(members); XLSX.utils.book_append_sheet(wb, wsMem, "ThanhVien");
    let wsMatch = XLSX.utils.json_to_sheet(matches); XLSX.utils.book_append_sheet(wb, wsMatch, "TranDau");
    let wsGoc = XLSX.utils.json_to_sheet(gocLogs); XLSX.utils.book_append_sheet(wb, wsGoc, "NopTienGoc");
    XLSX.writeFile(wb, "CLB_Tennis_Thang_Long_Ver1.2_Backup.xlsx");
}



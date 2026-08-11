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



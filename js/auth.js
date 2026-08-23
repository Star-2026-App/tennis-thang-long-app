function handleLogin(e) {
    e.preventDefault();
    let u = document.getElementById('loginUser').value.trim();
    let p = document.getElementById('loginPass').value.trim();

    loadLocalData();
    if (!members || members.length === 0) members = defaultFallbackMembers;

    let foundMem = members.find(m => m.username && m.username.toLowerCase() === u.toLowerCase());

    if (!foundMem) {
        let match = u.match(/^Thanglong(\d+)$/i);
        if (match) {
            let sttNum = parseInt(match[1]);
            foundMem = members.find(m => m.stt === sttNum);
        }
    }

    if (!foundMem) {
        alert("Tài khoản không tồn tại trên hệ thống!");
        return;
    }

    let isSystemAdmin = (foundMem.role === 'admin' || foundMem.stt === 1 || foundMem.stt === 2 || foundMem.stt === 15);
    let requiredPass = isSystemAdmin ? 'admin' : '123456';

    if (p !== requiredPass) {
        alert("Mật khẩu không chính xác!");
        return;
    }

    currentUserRole = isSystemAdmin ? "admin" : "member";
    loggedInMemberName = foundMem.name;

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('flex');
    
    document.getElementById('mobileHeaderUserDisplay').innerText = loggedInMemberName;
    document.getElementById('modalProfileName').innerText = loggedInMemberName;
    document.getElementById('modalProfileRole').innerText = "Vai trò: " + (currentUserRole === 'admin' ? "Admin Tổng" : "Thành Viên");
    
    initApp();

    if (typeof syncBottomNavState === 'function') {
        syncBottomNavState('dashboard');
    }

    if (typeof maybeAutoStartOnboarding_ === 'function') {
        maybeAutoStartOnboarding_();
    }

    let dashSelect = document.getElementById('dashMainUser');
    if (dashSelect) {
        dashSelect.value = loggedInMemberName;
        if (currentUserRole !== 'admin') dashSelect.disabled = true;
    }

    fetchCloudData(true);

    if (syncIntervalId) {
        clearInterval(syncIntervalId);
    }
    syncIntervalId = setInterval(() => { processQueue(); }, 5000);
}

function logout() {
    // Đăng xuất "mềm": chuyển màn hình ngay lập tức thay vì reload
    // lại toàn bộ trang (vốn phải tải lại HTML/CSS/JS/CDN từ mạng
    // nên cảm giác rất chậm, nhất là trên mạng di động yếu).

    if (typeof closeMoreSheet === 'function') closeMoreSheet();
    if (typeof closeUserProfileModal === 'function') closeUserProfileModal();
    if (typeof closeGhiNhanSheet === 'function') closeGhiNhanSheet();

    // Dừng vòng đồng bộ nền của phiên cũ (tránh chạy chồng nhiều
    // interval nếu đăng nhập/đăng xuất nhiều lần trong 1 lần mở app).
    if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
    }
    // syncQueue vẫn được giữ nguyên trong bộ nhớ + đã lưu trong
    // localStorage sau mỗi lần xử lý (saveLocalData trong processQueue),
    // nên các thao tác chưa kịp đồng bộ sẽ tự tiếp tục ở lần đăng
    // nhập kế tiếp, không bị mất.

    currentUserRole = "member";
    loggedInMemberName = "";

    if (typeof switchTab === 'function') {
        switchTab('dashboard');
    }

    let appScreen = document.getElementById('appScreen');
    if (appScreen) {
        appScreen.classList.add('hidden');
        appScreen.classList.remove('flex');
    }

    let loginScreen = document.getElementById('loginScreen');
    if (loginScreen) {
        loginScreen.classList.remove('hidden');
    }

    let loginUser = document.getElementById('loginUser');
    if (loginUser) loginUser.value = '';
    let loginPass = document.getElementById('loginPass');
    if (loginPass) loginPass.value = '';
}

function applyRolePermissions() {
    document.querySelectorAll('.admin-only').forEach(el => {
        if (currentUserRole === 'admin') el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
}

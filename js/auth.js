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

    let dashSelect = document.getElementById('dashMainUser');
    if (dashSelect) {
        dashSelect.value = loggedInMemberName;
        if (currentUserRole !== 'admin') dashSelect.disabled = true;
    }

    fetchCloudData(true);
    setInterval(() => { processQueue(); }, 5000);
}

function logout() { location.reload(); }

function applyRolePermissions() {
    document.querySelectorAll('.admin-only').forEach(el => {
        if (currentUserRole === 'admin') el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
}

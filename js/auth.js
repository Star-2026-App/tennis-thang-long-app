// ======================================================
// AUTH.JS (v2.0) - ĐĂNG NHẬP THẬT QUA VERCEL BFF
// ======================================================
//
// THAY THẾ HOÀN TOÀN v1.6: không còn mật khẩu gõ cứng
// "admin"/"123456", không còn tự gán role ở biến trình duyệt dựa
// theo STT (1/2/15). Toàn bộ xác thực/phân quyền giờ do server
// quyết định (POST /api/auth/login), trình duyệt chỉ hiển thị lại
// những gì server xác nhận.
//
// KHÔNG có bất kỳ dữ liệu CLB nào (members/matches/tài chính...)
// được tải - kể cả từ localStorage - trước khi có xác nhận phiên
// đăng nhập hợp lệ (sửa điểm yếu #11: app.js cũ tải dữ liệu ngay
// trong DOMContentLoaded, màn hình đăng nhập trước đây chỉ là lớp
// phủ hình ảnh).
// ======================================================

function roleLabel_(role) {

    if (role === 'owner') return 'Owner';
    if (role === 'admin') return 'Admin Tổng';
    return 'Thành Viên';
}

function showLoginScreen_() {

    let appScreen = document.getElementById('appScreen');
    if (appScreen) {
        appScreen.classList.add('hidden');
        appScreen.classList.remove('flex');
    }

    let loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.classList.remove('hidden');

    let loginUser = document.getElementById('loginUser');
    if (loginUser) loginUser.value = '';

    let loginPass = document.getElementById('loginPass');
    if (loginPass) loginPass.value = '';
}

function applySessionInfo_(data) {

    loggedInMemberStt = parseInt(data.stt) || 0;
    loggedInMemberName = data.name || '';
    currentUserRole = data.role || 'member';
}

// ======================================================
// KIỂM TRA PHIÊN CÓ SẴN (gọi 1 lần khi mở app - xem app.js)
// ======================================================

async function checkExistingSession_() {

    try {

        let res = await fetch('/api/auth/session', { credentials: 'include' });
        let data = await res.json();

        if (data && data.authenticated) {

            applySessionInfo_(data);

            if (data.mustChangePassword) {

                await forcePasswordChangeFlow_();
                return;
            }

            enterAppScreen_();
            return;
        }

    } catch (err) {

        console.warn('CHECK SESSION ERROR:', err);
    }

    showLoginScreen_();
}

// ======================================================
// ĐĂNG NHẬP
// ======================================================

async function handleLogin(e) {

    e.preventDefault();

    let u = document.getElementById('loginUser').value.trim();
    let p = document.getElementById('loginPass').value;

    if (!u || !p) {
        alert('Vui lòng nhập tên đăng nhập và mật khẩu.');
        return;
    }

    // (v2.0 fix) Đăng nhập giờ phải gọi tuần tự nhiều action hệ thống
    // sang Apps Script (rate limit -> tra tài khoản -> reset lần sai ->
    // tạo session), mỗi lần gọi Apps Script có thể mất 1-3 giây - cộng
    // dồn lại người dùng phải chờ vài giây mà trước đây nút bấm không
    // hề đổi trạng thái, trông như hệ thống bị treo/không nhận input
    // (bug người dùng báo: "chờ 1 lúc sau mới vào, không có thông báo
    // đang đăng nhập"). Đây CHỈ là sửa cảm giác chờ (thêm phản hồi trực
    // quan), KHÔNG đổi tốc độ xử lý thật.
    let submitBtn = document.getElementById('loginSubmitBtn');
    let submitBtnText = document.getElementById('loginSubmitBtnText');
    let originalBtnHtml = submitBtnText ? submitBtnText.innerHTML : '';

    if (submitBtn) submitBtn.disabled = true;
    if (submitBtnText) {
        submitBtnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng nhập...';
    }

    try {

        let res = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });

        let data = await res.json();

        if (!res.ok || data.status === 'ERROR') {

            alert(data.message || 'Đăng nhập thất bại.');
            return;
        }

        applySessionInfo_(data);

        if (data.mustChangePassword) {

            await forcePasswordChangeFlow_();
            return;
        }

        enterAppScreen_();

    } catch (err) {

        console.error('LOGIN ERROR:', err);
        alert('Không thể kết nối hệ thống. Vui lòng kiểm tra mạng và thử lại.');

    } finally {

        // Khôi phục lại nút bấm dù thành công hay thất bại - trường
        // hợp thành công thì màn hình sẽ chuyển đi ngay sau đó nên việc
        // khôi phục ở đây chỉ để tránh sót trạng thái "Đang đăng nhập..."
        // nếu người dùng quay lại màn hình đăng nhập (vd sau khi logout).
        if (submitBtn) submitBtn.disabled = false;
        if (submitBtnText) submitBtnText.innerHTML = originalBtnHtml;
    }
}

// ======================================================
// BẮT BUỘC ĐỔI MẬT KHẨU LẦN ĐẦU (P1)
//
// Áp dụng cho: (1) Owner ngay sau khi bootstrap lần đầu, (2) bất
// kỳ Admin/Member nào vừa được Owner/Admin cấp mật khẩu tạm qua
// resetMemberPassword. Đổi mật khẩu THÀNH CÔNG sẽ thu hồi TOÀN BỘ
// session cũ (kể cả phiên hiện tại) - nên sau khi đổi xong phải
// đăng nhập lại bằng mật khẩu mới, không tự vào thẳng app.
// ======================================================

async function forcePasswordChangeFlow_() {

    while (true) {

        let pw1 = window.prompt(
            'Đây là lần đăng nhập đầu tiên (hoặc mật khẩu vừa được đặt lại).\n' +
            'Vui lòng đặt MẬT KHẨU MỚI cho tài khoản ' + (loggedInMemberName || '') +
            ' (ít nhất 6 ký tự):',
            ''
        );

        if (pw1 === null) {

            alert('Bạn PHẢI đổi mật khẩu để tiếp tục sử dụng hệ thống. Đang đăng xuất...');
            await logout();
            return;
        }

        pw1 = pw1.trim();

        if (pw1.length < 6) {

            alert('Mật khẩu phải có ít nhất 6 ký tự.');
            continue;
        }

        let pw2 = window.prompt('Nhập lại mật khẩu mới để xác nhận:', '');

        if (pw2 === null || pw2.trim() !== pw1) {

            alert('Hai lần nhập không khớp. Vui lòng thử lại.');
            continue;
        }

        try {

            let res = await fetch('/api/auth/change-password', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: pw1 })
            });

            let data = await res.json();

            if (data.status !== 'SUCCESS') {

                alert(data.message || 'Không đổi được mật khẩu. Vui lòng thử lại.');
                continue;
            }

            alert('Đã đổi mật khẩu thành công!\n\nVui lòng đăng nhập lại bằng mật khẩu mới.');
            showLoginScreen_();
            return;

        } catch (err) {

            console.error('CHANGE PASSWORD ERROR:', err);
            alert('Không thể kết nối hệ thống. Vui lòng thử lại.');
        }
    }
}

// ======================================================
// VÀO APP (chỉ sau khi có phiên hợp lệ) - đây là nơi DUY NHẤT
// tải dữ liệu cục bộ/cloud, thay cho app.js cũ tải vô điều kiện.
// ======================================================

function enterAppScreen_() {

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('flex');

    document.getElementById('mobileHeaderUserDisplay').innerText = loggedInMemberName;
    document.getElementById('modalProfileName').innerText = loggedInMemberName;
    document.getElementById('modalProfileRole').innerText = 'Vai trò: ' + roleLabel_(currentUserRole);

    // Namespace theo actor - xem storage.js. Chỉ TỪ ĐÂY mới đọc
    // localStorage/gọi cloud, không còn tải trước khi đăng nhập.
    loadLocalData();

    if (typeof restorePhase3LocalState_ === 'function') {
        restorePhase3LocalState_(
            window.__pendingCurMonth || (new Date()).getMonth() + 1,
            window.__pendingCurYear || (new Date()).getFullYear()
        );
    }

    if (!members || members.length === 0) members = defaultFallbackMembers;

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
        if (currentUserRole === 'member') dashSelect.disabled = true;
    }

    fetchCloudData(true);

    if (syncIntervalId) {
        clearInterval(syncIntervalId);
    }
    syncIntervalId = setInterval(() => { processQueue(); }, 5000);
}

// ======================================================
// ĐĂNG XUẤT
// ======================================================

async function logout() {

    if (typeof closeMoreSheet === 'function') closeMoreSheet();
    if (typeof closeUserProfileModal === 'function') closeUserProfileModal();
    if (typeof closeGhiNhanSheet === 'function') closeGhiNhanSheet();

    if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
    }

    let loggedOutStt = loggedInMemberStt;

    try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
        console.warn('LOGOUT REQUEST ERROR:', err);
    }

    // (điểm yếu #11) Dọn dữ liệu tài chính cục bộ của ĐÚNG actor
    // vừa đăng xuất - không để lộ dữ liệu cho người dùng tiếp theo
    // trên cùng thiết bị. Hàng đợi CHƯA đồng bộ hết của actor này
    // (nếu có) vẫn được GIỮ LẠI dưới key riêng để không mất thao
    // tác, và sẽ tự tiếp tục khi actor đó đăng nhập lại.
    if (typeof clearFinancialLocalDataForActor_ === 'function') {
        clearFinancialLocalDataForActor_(loggedOutStt);
    }

    currentUserRole = 'member';
    loggedInMemberName = '';
    loggedInMemberStt = 0;

    members = [];
    matches = [];
    bookingLogs = [];
    cashbookLogs = [];
    gocLogs = [];
    quyLogs = [];
    rulesList = [];
    syncQueue = [];

    if (typeof switchTab === 'function') {
        switchTab('dashboard');
    }

    showLoginScreen_();
}

function applyRolePermissions() {

    document.querySelectorAll('.admin-only').forEach(el => {
        if (currentUserRole === 'admin' || currentUserRole === 'owner') el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    // (v2.0) Ma trận quyền P1: "Cài đặt hệ thống, phân quyền Admin"
    // CHỈ Owner. Class mới "owner-only" tách riêng khỏi "admin-only"
    // (trước đây Admin và Owner dùng chung 1 mức quyền "admin").
    document.querySelectorAll('.owner-only').forEach(el => {
        if (currentUserRole === 'owner') el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
}

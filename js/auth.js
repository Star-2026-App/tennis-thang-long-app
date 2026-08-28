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

// ======================================================
// GHI NHỚ ĐĂNG NHẬP (v2.0.3)
// ======================================================
//
// Chỉ lưu cờ lựa chọn + username trong localStorage. Mật khẩu được
// giao cho Password Manager của trình duyệt qua Credential Management
// API; tuyệt đối không ghi mật khẩu dạng text vào localStorage.
// Thuộc tính autocomplete trong index.html là lớp tương thích cho
// Safari/iOS và các trình duyệt chưa hỗ trợ PasswordCredential.
// ======================================================

var REMEMBER_LOGIN_ENABLED_KEY_ = 'ttl.rememberLogin.enabled';
var REMEMBER_LOGIN_USERNAME_KEY_ = 'ttl.rememberLogin.username';

function isRememberLoginEnabled_() {

    try {
        return localStorage.getItem(REMEMBER_LOGIN_ENABLED_KEY_) === '1';
    } catch (err) {
        return false;
    }
}

function clearRememberedLoginPreference_() {

    try {
        localStorage.removeItem(REMEMBER_LOGIN_ENABLED_KEY_);
        localStorage.removeItem(REMEMBER_LOGIN_USERNAME_KEY_);
    } catch (err) {
        console.warn('CLEAR REMEMBER LOGIN ERROR:', err);
    }
}

function handleRememberLoginChange_() {

    let rememberInput = document.getElementById('rememberLogin');

    if (!rememberInput || rememberInput.checked) return;

    clearRememberedLoginPreference_();

    // Không xóa mật khẩu khỏi Password Manager của người dùng, nhưng
    // yêu cầu trình duyệt không tự cấp credential trong chế độ silent.
    if (
        navigator.credentials &&
        typeof navigator.credentials.preventSilentAccess === 'function'
    ) {
        navigator.credentials.preventSilentAccess().catch(function(err) {
            console.warn('PREVENT SILENT CREDENTIAL ACCESS ERROR:', err);
        });
    }
}

function resetLoginPasswordVisibility_() {

    let passwordInput = document.getElementById('loginPass');
    let toggleButton = document.getElementById('toggleLoginPassBtn');
    let toggleIcon = document.getElementById('toggleLoginPassIcon');

    if (passwordInput) passwordInput.type = 'password';

    if (toggleButton) {
        toggleButton.setAttribute('aria-label', 'Hiện mật khẩu');
        toggleButton.setAttribute('title', 'Hiện mật khẩu');
        toggleButton.setAttribute('aria-pressed', 'false');
    }

    if (toggleIcon) {
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
}

function toggleLoginPasswordVisibility_() {

    let passwordInput = document.getElementById('loginPass');
    let toggleButton = document.getElementById('toggleLoginPassBtn');
    let toggleIcon = document.getElementById('toggleLoginPassIcon');

    if (!passwordInput) return;

    let willShow = passwordInput.type === 'password';
    passwordInput.type = willShow ? 'text' : 'password';

    if (toggleButton) {
        toggleButton.setAttribute(
            'aria-label',
            willShow ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
        );
        toggleButton.setAttribute(
            'title',
            willShow ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
        );
        toggleButton.setAttribute('aria-pressed', willShow ? 'true' : 'false');
    }

    if (toggleIcon) {
        toggleIcon.classList.toggle('fa-eye', !willShow);
        toggleIcon.classList.toggle('fa-eye-slash', willShow);
    }

    passwordInput.focus();
}

async function restoreRememberedLogin_() {

    let rememberInput = document.getElementById('rememberLogin');
    let usernameInput = document.getElementById('loginUser');
    let passwordInput = document.getElementById('loginPass');

    if (!rememberInput || !usernameInput || !passwordInput) return;

    let rememberEnabled = isRememberLoginEnabled_();
    rememberInput.checked = rememberEnabled;

    if (!rememberEnabled) return;

    try {
        let savedUsername = localStorage.getItem(REMEMBER_LOGIN_USERNAME_KEY_) || '';
        if (!usernameInput.value) usernameInput.value = savedUsername;
    } catch (err) {
        console.warn('RESTORE REMEMBERED USERNAME ERROR:', err);
    }

    if (
        !navigator.credentials ||
        typeof navigator.credentials.get !== 'function'
    ) {
        return;
    }

    try {
        let credential = await navigator.credentials.get({
            password: true,
            mediation: 'optional'
        });

        if (!credential || !credential.password) return;

        // Không ghi đè nội dung nếu người dùng đã bắt đầu gõ trong
        // lúc trình duyệt đang mở Password Manager.
        if (!usernameInput.value) usernameInput.value = credential.id || '';
        if (!passwordInput.value) passwordInput.value = credential.password;

    } catch (err) {
        console.warn('RESTORE BROWSER CREDENTIAL ERROR:', err);
    }
}

function persistLoginPreference_(username, password) {

    let rememberInput = document.getElementById('rememberLogin');

    if (!rememberInput || !rememberInput.checked) {
        clearRememberedLoginPreference_();
        return;
    }

    try {
        localStorage.setItem(REMEMBER_LOGIN_ENABLED_KEY_, '1');
        localStorage.setItem(REMEMBER_LOGIN_USERNAME_KEY_, username);
    } catch (err) {
        console.warn('SAVE REMEMBERED USERNAME ERROR:', err);
    }

    if (
        !window.PasswordCredential ||
        !navigator.credentials ||
        typeof navigator.credentials.store !== 'function'
    ) {
        return;
    }

    try {
        let credential = new window.PasswordCredential({
            id: username,
            password: password,
            name: username
        });

        navigator.credentials.store(credential).catch(function(err) {
            console.warn('STORE BROWSER CREDENTIAL ERROR:', err);
        });

    } catch (err) {
        console.warn('CREATE BROWSER CREDENTIAL ERROR:', err);
    }
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

    resetLoginPasswordVisibility_();
    restoreRememberedLogin_();
}

function applySessionInfo_(data) {

    loggedInMemberStt = parseInt(data.stt) || 0;
    loggedInMemberName = data.name || '';
    currentUserRole = data.role || 'member';
}

var AUTH_SESSION_TIMEOUT_MS_ = 30000;
var AUTH_LOGIN_TIMEOUT_MS_ = 60000;

async function fetchAuthJsonWithTimeout_(url, options, timeoutMs) {

    let controller = new AbortController();
    let timeoutId = setTimeout(function() { controller.abort(); }, timeoutMs);
    let requestOptions = Object.assign({}, options || {}, { signal: controller.signal });

    try {
        let response = await fetch(url, requestOptions);
        let data = await response.json();
        return { response: response, data: data };
    } finally {
        clearTimeout(timeoutId);
    }
}

// ======================================================
// KIỂM TRA PHIÊN CÓ SẴN (gọi 1 lần khi mở app - xem app.js)
// ======================================================

async function checkExistingSession_() {

    try {

        let now = new Date();

        let result = await fetchAuthJsonWithTimeout_(
            '/api/data/bootstrap?month=' + (now.getMonth() + 1) + '&year=' + now.getFullYear(),
            { credentials: 'include' },
            AUTH_SESSION_TIMEOUT_MS_
        );
        let envelope = result.data;
        let bootstrap = envelope && envelope.status === 'SUCCESS' ? envelope.result : null;
        let data = bootstrap && bootstrap.session;

        if (result.response.ok && data) {

            applySessionInfo_(data);

            if (data.mustChangePassword) {

                await forcePasswordChangeFlow_();
                return;
            }

            enterAppScreen_(bootstrap.initialData);
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

    // Khóa nút để chống submit lặp. Sau 8 giây đổi thông báo để người
    // dùng biết Apps Script đang cold-start; sau 60 giây trình duyệt tự
    // hủy request thay vì quay spinner vô hạn.
    let submitBtn = document.getElementById('loginSubmitBtn');
    let submitBtnText = document.getElementById('loginSubmitBtnText');
    let originalBtnHtml = submitBtnText ? submitBtnText.innerHTML : '';
    let slowMessageTimer = null;

    if (submitBtn) submitBtn.disabled = true;
    if (submitBtnText) {
        submitBtnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng nhập...';
        slowMessageTimer = setTimeout(function() {
            submitBtnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Máy chủ đang khởi động...';
        }, 8000);
    }

    try {

        let result = await fetchAuthJsonWithTimeout_(
            '/api/auth/login',
            {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            },
            AUTH_LOGIN_TIMEOUT_MS_
        );

        let res = result.response;
        let data = result.data;

        if (!res.ok || data.status === 'ERROR') {

            alert(data.message || 'Đăng nhập thất bại.');
            return;
        }

        applySessionInfo_(data);

        if (data.mustChangePassword) {

            await forcePasswordChangeFlow_();
            return;
        }

        persistLoginPreference_(u, p);
        enterAppScreen_();

        // Không giữ mật khẩu trong DOM sau khi đã đăng nhập. Lần mở
        // sau Password Manager sẽ tự điền lại nếu người dùng đã chọn nhớ.
        let loginPass = document.getElementById('loginPass');
        if (loginPass) loginPass.value = '';

    } catch (err) {

        console.error('LOGIN ERROR:', err);

        if (err && err.name === 'AbortError') {
            alert('Đăng nhập quá thời gian chờ 60 giây. Máy chủ có thể đang bận; vui lòng thử lại sau ít phút.');
        } else if (err instanceof SyntaxError) {
            alert('Máy chủ trả về phản hồi không hợp lệ. Vui lòng thử lại.');
        } else {
            alert('Không thể kết nối hệ thống. Vui lòng kiểm tra mạng và thử lại.');
        }

    } finally {

        // Khôi phục lại nút bấm dù thành công hay thất bại - trường
        // hợp thành công thì màn hình sẽ chuyển đi ngay sau đó nên việc
        // khôi phục ở đây chỉ để tránh sót trạng thái "Đang đăng nhập..."
        // nếu người dùng quay lại màn hình đăng nhập (vd sau khi logout).
        if (slowMessageTimer) clearTimeout(slowMessageTimer);
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

            let rememberedUsernameInput = document.getElementById('loginUser');
            persistLoginPreference_(
                rememberedUsernameInput ? rememberedUsernameInput.value.trim() : '',
                pw1
            );

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

function enterAppScreen_(bootstrapInitialData) {

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

    if (bootstrapInitialData) {
        updateStateFromCloud(bootstrapInitialData);
    } else {
        fetchCloudData(true);
    }

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
    cupData = null;
    dataRevision = 0;
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

    if (typeof syncCupNavVisibility === 'function') {
        syncCupNavVisibility();
    }
}

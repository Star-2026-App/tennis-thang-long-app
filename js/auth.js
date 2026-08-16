// ======================================================
// AUTH.JS - FRONTEND TEST VER1.4 - PHASE 1.6
//
// - Dang nhap that qua Backend TEST.
// - Luu session de PWA dien thoai mo lai khong can login lien tuc.
// - Khong luu password.
// - Tu gan sessionToken vao moi POST nghiep vu.
// - Doc phan hoi SUCCESS/ERROR that tu Backend.
// - Tu quay ve man hinh login neu session het han/bi thu hoi.
// - Hien thi chuc nang theo Member/Admin/Owner.
//
// File nay duoc nap SAU api.js va TRUOC cac module.
// KHONG dung voi Backend Production.
// ======================================================

var AUTH_V14_STORAGE_KEY_ = "clb_auth_session_v14";
var AUTH_V14_QUEUE_MIGRATION_KEY_ =
    "clb_auth_queue_migrated_phase16";
var AUTH_V14_REMEMBER_PREF_KEY_ =
    "clb_auth_remember_login_v14";
var AUTH_V14_REMEMBER_USERNAME_KEY_ =
    "clb_auth_remember_username_v14";

var authSessionState_ = {
    sessionToken: "",
    user: null,
    expiresAt: ""
};

var authNativeFetch_ = window.fetch.bind(window);
var authBootstrapStarted_ = false;
var authLogoutInProgress_ = false;
var authQueueRetryTimer_ = null;
var authSessionStorageKind_ = "session";
var authLegacyEnqueueAction_ =
    typeof window.enqueueAction === "function"
        ? window.enqueueAction
        : null;


// ======================================================
// FETCH INTERCEPTOR
// Tu dong gan sessionToken vao tat ca POST nghiep vu,
// ke ca cac module cu dang goi fetch truc tiep.
// ======================================================

function authInstallFetchInterceptor_() {
    window.fetch = function(input, init) {
        var nextInit = Object.assign({}, init || {});
        var method = String(nextInit.method || "GET")
            .toUpperCase();
        var isBackend = authIsBackendUrl_(input);
        var parsedBody = null;
        var action = "";

        if (
            isBackend &&
            method === "POST" &&
            typeof nextInit.body === "string"
        ) {
            try {
                parsedBody = JSON.parse(nextInit.body);
                action = String(parsedBody.action || "").trim();
            } catch (err) {
                parsedBody = null;
            }
        }

        if (
            parsedBody &&
            action &&
            !authIsAuthAction_(action)
        ) {
            if (!authHasSession_()) {
                authHandleSessionFailure_(
                    "AUTH_SESSION_REQUIRED",
                    "Vui lòng đăng nhập để tiếp tục."
                );

                return Promise.reject(
                    authCreateFrontendError_(
                        "AUTH_SESSION_REQUIRED",
                        "Vui lòng đăng nhập để tiếp tục."
                    )
                );
            }

            parsedBody.sessionToken =
                authSessionState_.sessionToken;
            nextInit.body = JSON.stringify(parsedBody);

            // Ver1.3 co vai lenh no-cors nen khong doc duoc ERROR.
            // Phase 1.6 bat buoc doc phan hoi Backend.
            if (nextInit.mode === "no-cors") {
                nextInit.mode = "cors";
            }
        }

        return authNativeFetch_(input, nextInit)
            .then(function(response) {
                if (
                    parsedBody &&
                    action &&
                    !authIsAuthAction_(action) &&
                    response &&
                    typeof response.clone === "function"
                ) {
                    authInspectBusinessResponse_(
                        response.clone()
                    );
                }

                return response;
            });
    };
}


function authIsBackendUrl_(input) {
    var value = "";

    if (typeof input === "string") {
        value = input;
    } else if (input && input.url) {
        value = input.url;
    }

    return !!(
        value &&
        typeof GOOGLE_SCRIPT_URL === "string" &&
        value.indexOf(GOOGLE_SCRIPT_URL) === 0
    );
}


function authIsAuthAction_(action) {
    return [
        "authLogin",
        "authLogout",
        "authCurrentUser",
        "authAdminResetPassword"
    ].indexOf(String(action || "")) >= 0;
}


function authInspectBusinessResponse_(response) {
    response.json()
        .then(function(payload) {
            if (!payload || payload.status !== "ERROR") {
                return;
            }

            var code = String(payload.code || "");
            var message = String(
                payload.message ||
                "Yêu cầu không được thực hiện."
            );

            if (authIsSessionErrorCode_(code)) {
                authHandleSessionFailure_(code, message);
                return;
            }

            if (
                code.indexOf("PERMISSION_") === 0 ||
                code === "AUTH_ACCOUNT_INACTIVE"
            ) {
                authShowMessage_(message);
            }
        })
        .catch(function() {
            // Module goi fetch van tu doc response goc.
            // Clone khong phai JSON thi bo qua an toan.
        });
}


// ======================================================
// AUTH API
// ======================================================

function authPost_(payload) {
    return authNativeFetch_(
        GOOGLE_SCRIPT_URL,
        {
            method: "POST",
            mode: "cors",
            redirect: "follow",
            credentials: "omit",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload || {})
        }
    )
    .then(function(response) {
        if (!response) {
            throw authCreateFrontendError_(
                "AUTH_NETWORK_ERROR",
                "Backend không trả phản hồi."
            );
        }

        return response.text();
    })
    .then(function(text) {
        var payload = null;

        try {
            payload = JSON.parse(text);
        } catch (err) {
            throw authCreateFrontendError_(
                "AUTH_RESPONSE_INVALID",
                "Không đọc được phản hồi từ Backend TEST."
            );
        }

        if (!payload || payload.status !== "SUCCESS") {
            throw authCreateFrontendError_(
                payload && payload.code
                    ? payload.code
                    : "AUTH_REQUEST_FAILED",
                payload && payload.message
                    ? payload.message
                    : "Yêu cầu xác thực thất bại."
            );
        }

        return payload.result || {};
    });
}


// ======================================================
// LOGIN / RESTORE / LOGOUT
// ======================================================

function handleLogin(event) {
    if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
    }

    var usernameInput = document.getElementById("loginUser");
    var passwordInput = document.getElementById("loginPass");
    var rememberInput = document.getElementById("loginRememberV14");
    var username = usernameInput
        ? String(usernameInput.value || "").trim()
        : "";
    var password = passwordInput
        ? String(passwordInput.value || "")
        : "";
    var rememberLogin = !!(
        rememberInput && rememberInput.checked
    );

    authSetLoginError_("");

    if (!username || !password) {
        authSetLoginError_(
            "Vui lòng nhập đầy đủ tài khoản và mật khẩu."
        );
        return false;
    }

    authSetLoginBusy_(true, "ĐANG ĐĂNG NHẬP...");

    authPost_({
        action: "authLogin",
        username: username,
        password: password
    })
    .then(function(result) {
        password = "";

        if (passwordInput) {
            passwordInput.value = "";
        }

        if (
            result.status !== "AUTH_LOGIN_SUCCESS" ||
            !result.sessionToken ||
            !result.user
        ) {
            throw authCreateFrontendError_(
                "AUTH_LOGIN_INVALID_RESPONSE",
                "Phản hồi đăng nhập không hợp lệ."
            );
        }

        authSessionState_ = {
            sessionToken: String(result.sessionToken),
            user: result.user,
            expiresAt: result.expiresAt || ""
        };

        authSaveRememberPreference_(username, rememberLogin);
        authSessionStorageKind_ = rememberLogin
            ? "local"
            : "session";
        authSaveSession_();
        authOpenApp_(true);
    })
    .catch(function(err) {
        password = "";

        if (passwordInput) {
            passwordInput.value = "";
        }

        authClearSession_();
        authSetLoginError_(
            authFriendlyErrorMessage_(err)
        );
    })
    .finally(function() {
        authSetLoginBusy_(false, "ĐĂNG NHẬP HỆ THỐNG");
    });

    return false;
}


function authRestoreSession_() {
    var stored = authLoadStoredSession_();

    if (!stored || !stored.sessionToken) {
        authShowLogin_();
        return Promise.resolve(false);
    }

    authSessionState_ = stored;
    authSetLoginBusy_(true, "ĐANG KIỂM TRA PHIÊN...");

    return authPost_({
        action: "authCurrentUser",
        sessionToken: stored.sessionToken
    })
    .then(function(result) {
        if (
            result.status !== "AUTH_SESSION_VALID" ||
            !result.user
        ) {
            throw authCreateFrontendError_(
                "AUTH_SESSION_INVALID",
                "Phiên đăng nhập không hợp lệ."
            );
        }

        authSessionState_.user = result.user;
        authSessionState_.expiresAt = result.expiresAt || "";
        authSaveSession_();
        authOpenApp_(false);
        return true;
    })
    .catch(function() {
        authClearSession_();
        authShowLogin_();
        return false;
    })
    .finally(function() {
        authSetLoginBusy_(false, "ĐĂNG NHẬP HỆ THỐNG");
    });
}


function logout() {
    if (authLogoutInProgress_) {
        return;
    }

    authLogoutInProgress_ = true;

    var token = authSessionState_.sessionToken;

    if (!token) {
        authFinishLogout_();
        return;
    }

    authPost_({
        action: "authLogout",
        sessionToken: token
    })
    .catch(function() {
        // Logout cuc bo van phai thanh cong khi mang loi.
    })
    .finally(function() {
        token = "";
        authFinishLogout_();
    });
}


function authFinishLogout_() {
    authClearSession_();
    authDiscardPendingQueue_();
    authLogoutInProgress_ = false;

    if (typeof closeUserProfileModal === "function") {
        closeUserProfileModal();
    }

    authShowLogin_();
}


function authHandleSessionFailure_(code, message) {
    if (!authIsSessionErrorCode_(code)) {
        return;
    }

    authClearSession_();
    authShowLogin_();
    authSetLoginError_(
        message ||
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    );
}


function authIsSessionErrorCode_(code) {
    return [
        "AUTH_SESSION_REQUIRED",
        "AUTH_SESSION_INVALID",
        "AUTH_SESSION_REVOKED",
        "AUTH_SESSION_EXPIRED",
        "AUTH_SESSION_IDLE_TIMEOUT",
        "AUTH_USER_NOT_FOUND"
    ].indexOf(String(code || "")) >= 0;
}


// ======================================================
// APP IDENTITY / ROLE UI
// ======================================================

function authOpenApp_(forceCloudReload) {
    if (!authHasSession_()) {
        authShowLogin_();
        return;
    }

    if (typeof loadLocalData === "function") {
        loadLocalData();
    }

    if (
        (!members || members.length === 0) &&
        typeof defaultFallbackMembers !== "undefined"
    ) {
        members = defaultFallbackMembers;
    }

    authApplyIdentity_();

    var loginScreen = document.getElementById("loginScreen");
    var appScreen = document.getElementById("appScreen");

    if (loginScreen) {
        loginScreen.classList.add("hidden");
    }

    if (appScreen) {
        appScreen.classList.remove("hidden");
        appScreen.classList.add("flex");
    }

    if (typeof initApp === "function") {
        initApp();
    }

    authApplyRolePermissions_();
    authStartQueueProcessor_();

    if (typeof fetchCloudData === "function") {
        fetchCloudData(
            forceCloudReload === true,
            function() {
                authApplyIdentity_();
                authApplyRolePermissions_();
            }
        );
    }
}


function authShowLogin_() {
    var loginScreen = document.getElementById("loginScreen");
    var appScreen = document.getElementById("appScreen");

    if (appScreen) {
        appScreen.classList.add("hidden");
        appScreen.classList.remove("flex");
    }

    if (loginScreen) {
        loginScreen.classList.remove("hidden");
        loginScreen.classList.add("flex");
    }

    var usernameInput = document.getElementById("loginUser");

    if (usernameInput) {
        setTimeout(function() {
            usernameInput.focus();
        }, 0);
    }
}


function authApplyIdentity_() {
    var user = authSessionState_.user || {};
    var actualRole = String(user.role || "member").toLowerCase();
    var member = authFindMember_(user.memberStt, user.username);

    // Cac module Ver1.3 dung currentUserRole === "admin".
    // Owner duoc map sang admin cho tuong thich UI cu,
    // quyen Owner thuc van lay tu authSessionState_.user.role.
    currentUserRole =
        actualRole === "owner"
            ? "admin"
            : actualRole;
    loggedInMemberName = member
        ? member.name
        : String(user.username || "Thành viên");

    if (member) {
        member.role = actualRole;
        member.username = String(user.username || member.username || "");
    }

    authSetText_("mobileHeaderUserDisplay", loggedInMemberName);
    authSetText_("modalProfileName", loggedInMemberName);
    authSetText_(
        "modalProfileRole",
        "Vai trò: " + authRoleLabel_(actualRole)
    );

    var dashSelect = document.getElementById("dashMainUser");

    if (dashSelect) {
        dashSelect.value = loggedInMemberName;
        dashSelect.disabled = actualRole === "member";
    }
}


function applyRolePermissions() {
    authApplyRolePermissions_();
}


function authApplyRolePermissions_() {
    var role = authGetActualRole_();
    var canAdmin = role === "admin" || role === "owner";
    var isOwner = role === "owner";

    document.querySelectorAll(".admin-only").forEach(function(el) {
        el.classList.toggle("hidden", !canAdmin);
    });

    // Settings he thong chi Chu he thong Thanglong2 duoc thay doi.
    ["btn-settings"].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.classList.toggle("hidden", !isOwner);
        }
    });

    document.querySelectorAll(
        "#mobileMenuDrawer button[onclick*=\"settings\"]"
    ).forEach(function(el) {
        el.classList.toggle("hidden", !isOwner);
    });

    var settingsTab = document.getElementById("tab-settings");

    if (
        settingsTab &&
        !isOwner &&
        settingsTab.classList.contains("active") &&
        typeof switchTab === "function"
    ) {
        switchTab("dashboard");
    }

    authRestrictMemberManagementUi_(role);
}


function authRestrictMemberManagementUi_(role) {
    var tbody = document.getElementById("memberTableBody");

    if (!tbody) {
        return;
    }

    var isOwner = role === "owner";
    var isAdmin = role === "admin";
    var actorStt = parseInt(
        authSessionState_.user && authSessionState_.user.memberStt,
        10
    ) || 0;

    Array.prototype.forEach.call(
        tbody.querySelectorAll("tr"),
        function(row, index) {
            var target = (members || [])[index] || {};
            var stt = parseInt(target.stt, 10) || index + 1;
            var targetRole = String(target.role || "member")
                .toLowerCase();
            var targetPrivileged =
                targetRole === "owner" ||
                targetRole === "admin" ||
                stt === 1 ||
                stt === 2 ||
                stt === 15;
            var actionCell = row.querySelector("td:last-child");

            if (!actionCell) {
                return;
            }

            var buttons = actionCell.querySelectorAll("button");
            var editButton = buttons[0] || null;
            var roleButton = actionCell.querySelector(
                "button[onclick*=\"toggleMemberRole\"]"
            );
            var deleteButton = buttons.length
                ? buttons[buttons.length - 1]
                : null;

            if (roleButton) {
                var canChangeTargetRole = isOwner && stt !== actorStt;
                roleButton.classList.toggle(
                    "hidden",
                    !canChangeTargetRole
                );
                roleButton.disabled = !canChangeTargetRole;
            }

            if (isAdmin && targetPrivileged) {
                if (editButton) {
                    editButton.classList.add("hidden");
                    editButton.disabled = true;
                }

                if (deleteButton) {
                    deleteButton.classList.add("hidden");
                    deleteButton.disabled = true;
                }
            }

            if (isOwner && stt === actorStt && deleteButton) {
                deleteButton.classList.add("hidden");
                deleteButton.disabled = true;
            }
        }
    );
}


function authGetActualRole_() {
    return String(
        authSessionState_.user &&
        authSessionState_.user.role
            ? authSessionState_.user.role
            : "member"
    ).toLowerCase();
}


function authFindMember_(memberStt, username) {
    var targetStt = parseInt(memberStt, 10) || 0;
    var normalizedUsername = String(username || "").toLowerCase();
    var found = null;

    (members || []).some(function(member) {
        if (
            targetStt &&
            (parseInt(member.stt, 10) || 0) === targetStt
        ) {
            found = member;
            return true;
        }

        if (
            normalizedUsername &&
            String(member.username || "").toLowerCase() ===
                normalizedUsername
        ) {
            found = member;
            return true;
        }

        return false;
    });

    return found;
}


function authRoleLabel_(role) {
    if (role === "owner") {
        return "Chủ hệ thống";
    }

    if (role === "admin") {
        return "Quản trị viên";
    }

    return "Thành viên";
}


// ======================================================
// AUTHENTICATED QUEUE PROCESSOR
// Ghi nhan thanh cong chi khi Backend tra SUCCESS.
// ======================================================

function processQueue() {
    if (
        isSyncing ||
        !syncQueue ||
        syncQueue.length === 0 ||
        !GOOGLE_SCRIPT_URL ||
        !authHasSession_()
    ) {
        return;
    }

    isSyncing = true;

    var item = syncQueue[0] || {};
    var currentUserId = String(
        authSessionState_.user &&
        authSessionState_.user.userId
            ? authSessionState_.user.userId
            : ""
    );

    if (!item.__authUserId) {
        item.__authUserId = currentUserId;
    }

    if (
        item.__authUserId &&
        item.__authUserId !== currentUserId
    ) {
        syncQueue.shift();
        isSyncing = false;
        authPersistQueue_();
        authRefreshAfterRejectedWrite_();
        authShowMessage_(
            "Đã bỏ một thao tác cũ của tài khoản khác."
        );
        processQueue();
        return;
    }

    var wireItem = JSON.parse(JSON.stringify(item));
    var successMessage = String(
        wireItem.__successMessage ||
        "Đã ghi nhận thành công!"
    );

    delete wireItem.__authUserId;
    delete wireItem.__successMessage;
    delete wireItem.sessionToken;

    window.fetch(
        GOOGLE_SCRIPT_URL,
        {
            method: "POST",
            mode: "cors",
            redirect: "follow",
            credentials: "omit",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(wireItem)
        }
    )
    .then(function(response) {
        return response.json();
    })
    .then(function(payload) {
        if (payload && payload.status === "SUCCESS") {
            syncQueue.shift();
            isSyncing = false;
            authPersistQueue_();
            authShowMessage_(successMessage);
            processQueue();
            return;
        }

        var code = String(
            payload && payload.code
                ? payload.code
                : "BACKEND_WRITE_FAILED"
        );
        var message = String(
            payload && payload.message
                ? payload.message
                : "Backend chưa ghi nhận thao tác."
        );

        isSyncing = false;

        if (authIsSessionErrorCode_(code)) {
            authHandleSessionFailure_(code, message);
            return;
        }

        // Sai quyen/du lieu: khong lap lai vo han.
        syncQueue.shift();
        authPersistQueue_();
        authRefreshAfterRejectedWrite_();
        authShowMessage_(message);
        processQueue();
    })
    .catch(function() {
        isSyncing = false;
        authScheduleQueueRetry_();
        authShowMessage_(
            "Chưa kết nối được Backend TEST. Thao tác đang chờ gửi lại."
        );
    });
}


function authInstallQueueEnqueueWrapper_() {
    if (!authLegacyEnqueueAction_) {
        return;
    }

    window.enqueueAction = function(
        actionName,
        payload,
        successMessage
    ) {
        var nextPayload = payload || {};
        var user = authSessionState_.user || {};

        nextPayload.__authUserId = String(user.userId || "");
        nextPayload.__successMessage = String(
            successMessage || "Đã ghi nhận thành công!"
        );

        return authLegacyEnqueueAction_(
            actionName,
            nextPayload,
            successMessage
        );
    };
}


function authStartQueueProcessor_() {
    if (!window.__authQueueIntervalV14) {
        window.__authQueueIntervalV14 = setInterval(
            function() {
                processQueue();
            },
            5000
        );
    }

    processQueue();
}


function authScheduleQueueRetry_() {
    if (authQueueRetryTimer_) {
        return;
    }

    authQueueRetryTimer_ = setTimeout(function() {
        authQueueRetryTimer_ = null;
        processQueue();
    }, 10000);
}


function authPersistQueue_() {
    try {
        localStorage.setItem(
            "clb_syncQueue",
            JSON.stringify(syncQueue || [])
        );
    } catch (err) {
        // Khong chan app neu storage het dung luong.
    }
}


function authDiscardPendingQueue_() {
    syncQueue = [];
    isSyncing = false;

    try {
        localStorage.removeItem("clb_syncQueue");
    } catch (err) {
        // Ignore storage error.
    }
}


function authClearLegacyQueueOnce_() {
    try {
        if (
            localStorage.getItem(
                AUTH_V14_QUEUE_MIGRATION_KEY_
            ) === "1"
        ) {
            return;
        }

        localStorage.removeItem("clb_syncQueue");
        syncQueue = [];
        localStorage.setItem(
            AUTH_V14_QUEUE_MIGRATION_KEY_,
            "1"
        );
    } catch (err) {
        syncQueue = [];
    }
}


function authRefreshAfterRejectedWrite_() {
    if (typeof fetchCloudData === "function" && authHasSession_()) {
        fetchCloudData(true);
    }
}


// ======================================================
// SESSION STORAGE
// ======================================================

function authHasSession_() {
    return !!(
        authSessionState_ &&
        authSessionState_.sessionToken &&
        authSessionState_.user &&
        authSessionState_.user.userId
    );
}


function authSaveSession_() {
    try {
        var serialized = JSON.stringify(authSessionState_);

        if (authSessionStorageKind_ === "local") {
            localStorage.setItem(
                AUTH_V14_STORAGE_KEY_,
                serialized
            );
            sessionStorage.removeItem(AUTH_V14_STORAGE_KEY_);
        } else {
            sessionStorage.setItem(
                AUTH_V14_STORAGE_KEY_,
                serialized
            );
            localStorage.removeItem(AUTH_V14_STORAGE_KEY_);
        }
    } catch (err) {
        authSetLoginError_(
            "Trình duyệt không lưu được phiên đăng nhập."
        );
    }
}


function authLoadStoredSession_() {
    try {
        var raw = sessionStorage.getItem(AUTH_V14_STORAGE_KEY_);

        authSessionStorageKind_ = "session";

        if (!raw) {
            raw = localStorage.getItem(AUTH_V14_STORAGE_KEY_);
            authSessionStorageKind_ = "local";
        }

        var parsed = raw ? JSON.parse(raw) : null;

        if (
            !parsed ||
            !parsed.sessionToken ||
            !parsed.user ||
            !parsed.user.userId
        ) {
            return null;
        }

        return {
            sessionToken: String(parsed.sessionToken),
            user: parsed.user,
            expiresAt: parsed.expiresAt || ""
        };
    } catch (err) {
        return null;
    }
}


function authClearSession_() {
    authSessionState_ = {
        sessionToken: "",
        user: null,
        expiresAt: ""
    };

    currentUserRole = "member";
    loggedInMemberName = "";

    try {
        localStorage.removeItem(AUTH_V14_STORAGE_KEY_);
        sessionStorage.removeItem(AUTH_V14_STORAGE_KEY_);
    } catch (err) {
        // Ignore storage error.
    }
}


// ======================================================
// LOGIN UI
// ======================================================

function authPrepareLoginUi_() {
    var loginScreen = document.getElementById("loginScreen");

    if (!loginScreen) {
        return;
    }

    var subtitle = loginScreen.querySelector("h1 + p");

    if (subtitle) {
        subtitle.textContent =
            "Hệ thống quản lý CLB - TEST Ver1.4";
    }

    var form = loginScreen.querySelector("form");

    if (form) {
        form.setAttribute("autocomplete", "on");
    }

    if (form && !document.getElementById("loginErrorV14")) {
        var errorBox = document.createElement("div");
        errorBox.id = "loginErrorV14";
        errorBox.className =
            "hidden rounded-xl border border-red-200 bg-red-50 " +
            "px-3 py-2 text-xs font-bold text-red-700";
        errorBox.setAttribute("role", "alert");
        form.insertBefore(errorBox, form.firstChild);
    }

    var usernameInput = document.getElementById("loginUser");

    if (usernameInput) {
        usernameInput.placeholder = "Ví dụ: Thanglong2";
        usernameInput.name = "username";
        usernameInput.autocomplete = "username";
        usernameInput.autocapitalize = "none";
        usernameInput.spellcheck = false;
    }

    var passwordInput = document.getElementById("loginPass");

    if (passwordInput) {
        passwordInput.name = "password";
        passwordInput.autocomplete = "current-password";
    }

    authEnsureRememberLoginUi_(form);
    authRestoreRememberedLogin_();
}


function authEnsureRememberLoginUi_(form) {
    if (!form || document.getElementById("loginRememberV14")) {
        return;
    }

    var submitButton = form.querySelector("button[type=submit]");
    var label = document.createElement("label");
    var checkbox = document.createElement("input");
    var text = document.createElement("span");

    label.className =
        "flex cursor-pointer select-none items-center gap-2 " +
        "text-sm font-semibold text-slate-700";
    label.title =
        "Ghi nhớ tài khoản và phiên đăng nhập; mật khẩu do trình duyệt quản lý.";

    checkbox.id = "loginRememberV14";
    checkbox.name = "rememberPassword";
    checkbox.type = "checkbox";
    checkbox.className =
        "h-4 w-4 rounded border-slate-300 text-emerald-700 " +
        "focus:ring-emerald-600";

    text.textContent = "Nhớ mật khẩu";
    label.appendChild(checkbox);
    label.appendChild(text);

    if (submitButton) {
        form.insertBefore(label, submitButton);
    } else {
        form.appendChild(label);
    }
}


function authSaveRememberPreference_(username, rememberLogin) {
    try {
        if (rememberLogin) {
            localStorage.setItem(AUTH_V14_REMEMBER_PREF_KEY_, "1");
            localStorage.setItem(
                AUTH_V14_REMEMBER_USERNAME_KEY_,
                String(username || "")
            );
        } else {
            localStorage.removeItem(AUTH_V14_REMEMBER_PREF_KEY_);
            localStorage.removeItem(
                AUTH_V14_REMEMBER_USERNAME_KEY_
            );
        }
    } catch (err) {
        // Khong chan dang nhap neu trinh duyet khong cho luu.
    }
}


function authRestoreRememberedLogin_() {
    var usernameInput = document.getElementById("loginUser");
    var rememberInput = document.getElementById("loginRememberV14");

    if (!rememberInput) {
        return;
    }

    try {
        var remembered =
            localStorage.getItem(AUTH_V14_REMEMBER_PREF_KEY_) === "1";
        var username = localStorage.getItem(
            AUTH_V14_REMEMBER_USERNAME_KEY_
        ) || "";

        rememberInput.checked = remembered;

        if (remembered && usernameInput && !usernameInput.value) {
            usernameInput.value = username;
        }
    } catch (err) {
        rememberInput.checked = false;
    }
}


function authSetLoginBusy_(busy, text) {
    var form = document.querySelector("#loginScreen form");
    var button = form ? form.querySelector("button[type=submit]") : null;
    var usernameInput = document.getElementById("loginUser");
    var passwordInput = document.getElementById("loginPass");
    var rememberInput = document.getElementById("loginRememberV14");

    if (button) {
        button.disabled = !!busy;
        button.textContent = text || "ĐĂNG NHẬP HỆ THỐNG";
        button.classList.toggle("opacity-60", !!busy);
        button.classList.toggle("cursor-wait", !!busy);
    }

    if (usernameInput) {
        usernameInput.disabled = !!busy;
    }

    if (passwordInput) {
        passwordInput.disabled = !!busy;
    }

    if (rememberInput) {
        rememberInput.disabled = !!busy;
    }
}


function authSetLoginError_(message) {
    var box = document.getElementById("loginErrorV14");

    if (!box) {
        return;
    }

    box.textContent = String(message || "");
    box.classList.toggle("hidden", !message);
}


function authFriendlyErrorMessage_(error) {
    var code = error && error.authCode
        ? String(error.authCode)
        : "";

    if (code === "AUTH_INVALID_CREDENTIALS") {
        return "Tài khoản hoặc mật khẩu không đúng.";
    }

    if (code === "AUTH_ACCOUNT_LOCKED") {
        return "Tài khoản đang bị khóa tạm. Vui lòng thử lại sau 15 phút.";
    }

    if (code === "AUTH_ACCOUNT_INACTIVE") {
        return "Tài khoản đang tạm ngừng hoạt động.";
    }

    if (
        code === "AUTH_NETWORK_ERROR" ||
        code === "AUTH_RESPONSE_INVALID"
    ) {
        return "Không kết nối được Backend TEST. Hãy kiểm tra mạng và URL triển khai.";
    }

    return error && error.message
        ? String(error.message).replace(/^\[[^\]]+\]\s*/, "")
        : "Đăng nhập không thành công.";
}


function authCreateFrontendError_(code, message) {
    var error = new Error("[" + code + "] " + message);
    error.name = "FrontendAuthError";
    error.authCode = code;
    return error;
}


function authShowMessage_(message) {
    if (typeof showToast === "function") {
        showToast(message);
        return;
    }

    console.warn(String(message || ""));
}


function authSetText_(id, value) {
    var el = document.getElementById(id);

    if (el) {
        el.textContent = String(value || "");
    }
}


// ======================================================
// STARTUP
// Login screen luon hien truoc. App chi mo sau khi Backend
// xac nhan session hoac login thanh cong.
// ======================================================

function authBootstrapVer14_() {
    if (authBootstrapStarted_) {
        return;
    }

    authBootstrapStarted_ = true;
    authPrepareLoginUi_();
    authClearLegacyQueueOnce_();
    authShowLogin_();
    authRestoreSession_();
}


authInstallFetchInterceptor_();
authInstallQueueEnqueueWrapper_();

window.addEventListener(
    "DOMContentLoaded",
    authBootstrapVer14_,
    { once: true }
);

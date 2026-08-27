// ======================================================
// UI CHUNG
// ======================================================

function showToast(msg) {

    let toast =
        document.getElementById(
            'appToast'
        );

    let msgSpan =
        document.getElementById(
            'toastMsg'
        );


    if (
        !toast ||
        !msgSpan
    ) {
        return;
    }


    msgSpan.innerText =
        msg;


    toast.classList.remove(
        'translate-y-12',
        'opacity-0'
    );


    setTimeout(
        function() {

            toast.classList.add(
                'translate-y-12',
                'opacity-0'
            );
        },
        2500
    );
}


// ======================================================
// TAB
// ======================================================

function switchTab(tabId) {

    document
        .querySelectorAll(
            '.tab-content'
        )
        .forEach(
            function(el) {

                el.classList.remove(
                    'active'
                );
            }
        );


    document
        .querySelectorAll(
            '.tab-btn'
        )
        .forEach(
            function(el) {

                el.classList.remove(
                    'border-amber-400',
                    'text-amber-300',
                    'font-bold',
                    'bg-emerald-800'
                );
            }
        );


    let targetTab =
        document.getElementById(
            'tab-' + tabId
        );


    if (!targetTab) {
        return;
    }


    targetTab.classList.add(
        'active'
    );


    let activeBtn =
        document.getElementById(
            'btn-' + tabId
        );


    if (activeBtn) {

        activeBtn.classList.add(
            'border-amber-400',
            'text-amber-300',
            'font-bold',
            'bg-emerald-800'
        );
    }


    let mobileDrawer =
        document.getElementById(
            'mobileMenuDrawer'
        );


    if (mobileDrawer) {

        mobileDrawer.classList.add(
            'hidden'
        );
    }


    if (
        tabId ===
            'analytics' &&
        typeof renderAnalyticsTab ===
            'function'
    ) {

        renderAnalyticsTab();
    }

    if (
        tabId === 'cup' &&
        typeof renderCupTab === 'function'
    ) {
        renderCupTab();
    }


    if (
        typeof syncBottomNavState ===
            'function'
    ) {

        syncBottomNavState(
            tabId
        );
    }
}


function switchTabMobile(
    tabId,
    label
) {

    let labelEl =
        document.getElementById(
            'currentActiveTabLabel'
        );


    if (labelEl) {

        labelEl.innerText =
            label;
    }


    switchTab(
        tabId
    );
}


function toggleMobileMenu() {

    let drawer =
        document.getElementById(
            'mobileMenuDrawer'
        );


    if (!drawer) {
        return;
    }


    if (
        drawer.classList.contains(
            'hidden'
        )
    ) {

        drawer.classList.remove(
            'hidden'
        );

    } else {

        drawer.classList.add(
            'hidden'
        );
    }
}


// ======================================================
// USER PROFILE
// ======================================================

function openUserProfileModal() {

    let modal =
        document.getElementById(
            'userProfileModal'
        );


    if (modal) {

        modal.classList.remove(
            'hidden'
        );

        modal.classList.add(
            'flex'
        );
    }
}


function closeUserProfileModal() {

    let modal =
        document.getElementById(
            'userProfileModal'
        );


    if (modal) {

        modal.classList.add(
            'hidden'
        );

        modal.classList.remove(
            'flex'
        );
    }
}


// ======================================================
// CONFIRM
// ======================================================

function showActionConfirm(
    message,
    callback
) {

    let textEl =
        document.getElementById(
            'actionConfirmText'
        );


    if (textEl) {

        textEl.innerText =
            message;
    }


    pendingActionCallback =
        callback;


    let modal =
        document.getElementById(
            'actionConfirmModal'
        );


    let okBtn =
        document.getElementById(
            'actionConfirmOkBtn'
        );


    if (
        !modal ||
        !okBtn
    ) {
        return;
    }


    okBtn.disabled =
        false;

    okBtn.classList.remove(
        'opacity-50',
        'cursor-not-allowed'
    );


    okBtn.onclick =
        function() {

            // Chặn double-click/double-tap: vô hiệu hóa
            // ngay lập tức, không chờ modal ẩn xong.
            if (okBtn.disabled) {
                return;
            }

            okBtn.disabled =
                true;

            okBtn.classList.add(
                'opacity-50',
                'cursor-not-allowed'
            );


            closeActionConfirmModal(
                true
            );
        };


    modal.classList.remove(
        'hidden'
    );

    modal.classList.add(
        'flex'
    );
}


function closeActionConfirmModal(
    isConfirmed
) {

    let modal =
        document.getElementById(
            'actionConfirmModal'
        );


    if (modal) {

        modal.classList.add(
            'hidden'
        );

        modal.classList.remove(
            'flex'
        );
    }


    // Rút callback ra và xóa NGAY LẬP TỨC trước khi
    // thực thi, để không thể vô tình chạy 2 lần dù
    // hàm này bị gọi lại bằng đường nào khác.
    let callback =
        pendingActionCallback;

    pendingActionCallback =
        null;


    if (
        isConfirmed &&
        typeof callback ===
            'function'
    ) {

        callback();
    }
}


function showCustomConfirm(
    message,
    onConfirm
) {

    let modal =
        document.getElementById(
            'customConfirmModal'
        );

    let textEl =
        document.getElementById(
            'customConfirmText'
        );

    let okBtn =
        document.getElementById(
            'customConfirmOkBtn'
        );

    let cancelBtn =
        document.getElementById(
            'customConfirmCancelBtn'
        );


    if (
        !modal ||
        !textEl ||
        !okBtn ||
        !cancelBtn
    ) {
        return;
    }


    textEl.innerText =
        message;


    modal.classList.remove(
        'hidden'
    );

    modal.classList.add(
        'flex'
    );


    let newOkBtn =
        okBtn.cloneNode(
            true
        );


    let newCancelBtn =
        cancelBtn.cloneNode(
            true
        );


    okBtn.parentNode.replaceChild(
        newOkBtn,
        okBtn
    );


    cancelBtn.parentNode.replaceChild(
        newCancelBtn,
        cancelBtn
    );


    newOkBtn.addEventListener(
        'click',
        function() {

            modal.classList.add(
                'hidden'
            );

            modal.classList.remove(
                'flex'
            );

            onConfirm(
                true
            );
        }
    );


    newCancelBtn.addEventListener(
        'click',
        function() {

            modal.classList.add(
                'hidden'
            );

            modal.classList.remove(
                'flex'
            );

            onConfirm(
                false
            );
        }
    );
}


// ======================================================
// BẢNG VÀNG
// ======================================================

function openNotificationModal() {

    if (
        typeof renderGamification ===
        'function'
    ) {

        renderGamification();
    }


    let modal =
        document.getElementById(
            'notificationModal'
        );


    if (modal) {

        modal.classList.remove(
            'hidden'
        );

        modal.classList.add(
            'flex'
        );
    }
}


function closeNotificationModal() {

    let modal =
        document.getElementById(
            'notificationModal'
        );


    if (modal) {

        modal.classList.add(
            'hidden'
        );

        modal.classList.remove(
            'flex'
        );
    }
}


// ======================================================
// EXCEL
// ======================================================

// (v2.0 - điểm yếu #12): bản cũ chỉ xuất 3 bảng (ThanhVien/TranDau/
// NopTienGoc) từ dữ liệu ĐANG có sẵn trên máy (không đầy đủ, không
// phục hồi được). Bản này gọi GET /api/data/backup (owner-only, dùng
// action getFullBackupData_ ở backend) để lấy TOÀN BỘ dữ liệu hệ
// thống rồi xuất thành 1 file Excel nhiều sheet - đúng nghĩa 1 bản
// backup có thể dùng để phục hồi.
async function exportToExcel() {

    showToast("Đang tải dữ liệu backup đầy đủ...");

    let backup;

    try {
        backup = await callBackendRead_("/api/data/backup");
    } catch (err) {
        alert("Không thể tải dữ liệu backup: " + ((err && err.message) || err));
        return;
    }

    let wb = XLSX.utils.book_new();

    let sheetDefs = [
        { key: "members", name: "ThanhVien" },
        { key: "matches", name: "TranDau" },
        { key: "gocLogs", name: "NopTienGoc" },
        { key: "quyLogs", name: "NopQuy" },
        { key: "bookingLogs", name: "ThuongSan" },
        { key: "cashbookLogs", name: "SoThuChi" },
        { key: "rules", name: "QuyDinh" },
        { key: "monthlyBalances", name: "SoDuThang" },
        { key: "memberStats", name: "ThongKe" },
        { key: "balanceAdjustments", name: "DieuChinhSoDu" },
        { key: "auditLogs", name: "NhatKyThaoTac" }
    ];

    sheetDefs.forEach(function(def) {
        let rows = Array.isArray(backup[def.key]) ? backup[def.key] : [];
        let ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
        XLSX.utils.book_append_sheet(wb, ws, def.name);
    });

    // settings + openingBalance không phải mảng bản ghi -> gộp vào 1 sheet riêng.
    let settingsRow = Object.assign(
        { openingBalance: backup.openingBalance, generatedAt: backup.generatedAt },
        (backup.settings && typeof backup.settings === "object") ? backup.settings : {}
    );

    let wsSettings = XLSX.utils.json_to_sheet([settingsRow]);
    XLSX.utils.book_append_sheet(wb, wsSettings, "CaiDat");

    let stamp = String(backup.generatedAt || new Date().toISOString()).replace(/[:.]/g, "-");

    XLSX.writeFile(
        wb,
        `CLB_Tennis_Thang_Long_v2.0.0_FullBackup_${stamp}.xlsx`
    );

    showToast("Đã tải xong file backup đầy đủ!");
}


// ======================================================
// PHASE 3B - PWA INSTALL
// ======================================================

let thangLongDeferredInstallPrompt =
    null;


function isIosDevice_() {

    let ua =
        window.navigator.userAgent ||
        '';


    let iOS =
        /iPad|iPhone|iPod/i
            .test(
                ua
            );


    let iPadDesktopMode =
        navigator.platform ===
            'MacIntel' &&
        navigator.maxTouchPoints >
            1;


    return (
        iOS ||
        iPadDesktopMode
    );
}


function isPwaStandalone_() {

    let displayStandalone =
        window.matchMedia &&
        window
            .matchMedia(
                '(display-mode: standalone)'
            )
            .matches;


    let iosStandalone =
        window.navigator.standalone ===
        true;


    return (
        displayStandalone ||
        iosStandalone
    );
}


function ensurePwaInstallButton_() {

    let profileButton =
        document.querySelector(
            'button[onclick="openUserProfileModal()"]'
        );


    if (
        !profileButton ||
        !profileButton.parentElement
    ) {
        return;
    }


    let installButton =
        document.getElementById(
            'pwaInstallButton'
        );


    if (!installButton) {

        installButton =
            document.createElement(
                'button'
            );


        installButton.id =
            'pwaInstallButton';


        installButton.type =
            'button';


        installButton.className =
            'pwa-install-btn hidden bg-amber-400 hover:bg-amber-300 text-emerald-950 p-2 rounded-full shadow transition';


        installButton.title =
            'Cài Tennis Thăng Long lên thiết bị';


        installButton.innerHTML =
            '<i class="fa-solid fa-download text-sm"></i>';


        installButton.onclick =
            installPwaApp;


        profileButton
            .parentElement
            .insertBefore(
                installButton,
                profileButton
            );
    }


    let shouldShow =
        !isPwaStandalone_() &&
        (
            !!thangLongDeferredInstallPrompt ||
            isIosDevice_()
        );


    if (shouldShow) {

        installButton.classList.remove(
            'hidden'
        );

    } else {

        installButton.classList.add(
            'hidden'
        );
    }
}


async function installPwaApp() {

    if (
        isPwaStandalone_()
    ) {

        showToast(
            'Ứng dụng đã được cài trên thiết bị.'
        );

        return;
    }


    if (
        thangLongDeferredInstallPrompt
    ) {

        let promptEvent =
            thangLongDeferredInstallPrompt;


        promptEvent.prompt();


        try {

            let choice =
                await promptEvent.userChoice;


            if (
                choice &&
                choice.outcome ===
                    'accepted'
            ) {

                showToast(
                    'Đã xác nhận cài Tennis Thăng Long.'
                );
            }

        } catch (error) {

            console.warn(
                'PWA INSTALL CHOICE ERROR:',
                error
            );
        }


        thangLongDeferredInstallPrompt =
            null;


        ensurePwaInstallButton_();

        return;
    }


    if (
        isIosDevice_()
    ) {

        alert(
            "Cài Tennis Thăng Long trên iPhone/iPad:\n\n" +
            "1. Mở trang bằng Safari.\n" +
            "2. Bấm nút Chia sẻ.\n" +
            "3. Chọn “Thêm vào Màn hình chính”.\n" +
            "4. Bấm Thêm."
        );

        return;
    }


    alert(
        "Trình duyệt chưa sẵn sàng hiển thị nút cài ứng dụng.\n\n" +
        "Hãy tải lại trang sau khi PWA được triển khai."
    );
}


function registerPwaServiceWorker_() {

    if (
        !(
            'serviceWorker' in
            navigator
        )
    ) {
        return;
    }


    window.addEventListener(
        'load',
        function() {

            navigator
                .serviceWorker
                .register(
                    '/service-worker.js',
                    {
                        scope:
                            '/'
                    }
                )
                .then(
                    function(registration) {

                        console.log(
                            'PWA SERVICE WORKER READY:',
                            registration.scope
                        );
                    }
                )
                .catch(
                    function(error) {

                        console.warn(
                            'PWA SERVICE WORKER ERROR:',
                            error
                        );
                    }
                );
        }
    );
}


window.addEventListener(
    'beforeinstallprompt',
    function(event) {

        event.preventDefault();


        thangLongDeferredInstallPrompt =
            event;


        ensurePwaInstallButton_();
    }
);


window.addEventListener(
    'appinstalled',
    function() {

        thangLongDeferredInstallPrompt =
            null;


        ensurePwaInstallButton_();


        showToast(
            'Tennis Thăng Long đã được cài thành công!'
        );
    }
);


document.addEventListener(
    'DOMContentLoaded',
    function() {

        ensurePwaInstallButton_();
    }
);


registerPwaServiceWorker_();


// ======================================================
// BOTTOM NAV (MOBILE) — Tổng quan / Tài chính / Ghi nhận / Sổ thu chi / Thêm
// ======================================================

var __lastFinanceTab = 'finance';
var __cbGroup = 'thu';

var FINANCE_CLUSTER_TABS = ['booking', 'gocLogs', 'quy', 'finance'];
var FINANCE_TAB_LABELS = {
    booking: 'Thưởng Sân',
    gocLogs: 'Nộp Tiền',
    quy: 'Đóng Quỹ',
    finance: 'Bảng Tổng Kết'
};

// Gọi ở cuối switchTab() cho MỌI lần chuyển tab (desktop lẫn mobile) để:
// 1. Bật đúng icon đang active ở bottom nav.
// 2. Hiện/ẩn dải pill "Tài chính" và tô đậm đúng pill.
// 3. Đổi màu nút Ghi nhận khi đang ở Ghi Trận.
// 4. Khởi tạo bộ lọc Thu/Chi khi vào Sổ thu chi trên mobile.
// Toàn bộ hàm chỉ thao tác trên các phần tử .md:hidden (chỉ hiện trên mobile) nên
// không ảnh hưởng gì tới giao diện desktop.
function syncBottomNavState(tabId) {

    document.querySelectorAll('.bn-item').forEach(function(el) {
        el.classList.remove('active');
    });

    var isFinance = FINANCE_CLUSTER_TABS.indexOf(tabId) !== -1;

    var highlightId = null;
    if (tabId === 'dashboard') highlightId = 'bn-dashboard';
    else if (tabId === 'cashbook') highlightId = 'bn-cashbook';
    else if (isFinance) highlightId = 'bn-finance';

    if (highlightId) {
        var navEl = document.getElementById(highlightId);
        if (navEl) navEl.classList.add('active');
    }

    var pillsBar = document.getElementById('financePillsBar');
    if (pillsBar) {

        if (isFinance) {

            pillsBar.classList.remove('hidden');
            __lastFinanceTab = tabId;

            document.querySelectorAll('.fp-pill').forEach(function(el) {
                el.classList.remove('active');
            });

            var activePill = document.getElementById('fp-' + tabId);
            if (activePill) activePill.classList.add('active');

        } else {

            pillsBar.classList.add('hidden');
        }
    }

    var fabBtn = document.getElementById('ghiNhanFabBtn');
    if (fabBtn && !fabBtn.classList.contains('is-open')) {
        fabBtn.style.background = (tabId === 'matches') ? '#0f172a' : '#047857';
    }

    if (
        tabId === 'cashbook' &&
        window.innerWidth < 768 &&
        typeof setCashbookGroup === 'function'
    ) {
        setCashbookGroup(__cbGroup);
    }
}


function openFinanceHub() {

    var tabId = __lastFinanceTab || 'finance';
    switchTabMobile(tabId, FINANCE_TAB_LABELS[tabId] || 'Tài chính');
}


function goFinanceTab(tabId, label) {

    switchTabMobile(tabId, label);
}


function toggleGhiNhanSheet() {

    var sheet = document.getElementById('ghiNhanSheet');
    var overlay = document.getElementById('ghiNhanOverlay');

    if (!sheet || !overlay) return;

    if (sheet.classList.contains('is-open')) {
        closeGhiNhanSheet();
        return;
    }

    overlay.classList.remove('hidden');
    sheet.classList.remove('hidden');

    requestAnimationFrame(function() {
        sheet.classList.add('is-open');
    });

    var fabBtn = document.getElementById('ghiNhanFabBtn');
    var fabIcon = document.getElementById('ghiNhanFabIcon');

    if (fabBtn) fabBtn.classList.add('is-open');

    if (fabIcon) {
        fabIcon.classList.remove('fa-pen-to-square');
        fabIcon.classList.add('fa-xmark');
    }
}


function closeGhiNhanSheet() {

    var sheet = document.getElementById('ghiNhanSheet');
    var overlay = document.getElementById('ghiNhanOverlay');

    if (!sheet || !overlay) return;

    sheet.classList.remove('is-open');

    var fabBtn = document.getElementById('ghiNhanFabBtn');
    var fabIcon = document.getElementById('ghiNhanFabIcon');

    if (fabBtn) fabBtn.classList.remove('is-open');

    if (fabIcon) {
        fabIcon.classList.remove('fa-xmark');
        fabIcon.classList.add('fa-pen-to-square');
    }

    setTimeout(function() {
        sheet.classList.add('hidden');
        overlay.classList.add('hidden');
    }, 180);
}


// action: 'match' | 'dat16' | 'dat18' | 'quy'
// Dùng lại nguyên vẹn logic đã có ở khối "TÁC VỤ NHANH" trên Tổng quan
// (input[name="actType"] + handleDashboardSubmit trong dashboard.js) — khối đó
// vẫn còn trong DOM (chỉ ẩn trên mobile bằng CSS), nên không cần viết lại nghiệp vụ.
function ghiNhanGo(action) {

    closeGhiNhanSheet();

    if (action === 'match') {
        switchTabMobile('matches', 'Ghi Trận');
        return;
    }

    var radio = document.querySelector(
        'input[name="actType"][value="' + action + '"]'
    );

    if (!radio) return;

    radio.checked = true;

    if (typeof handleDashboardSubmit === 'function') {
        handleDashboardSubmit();
    }
}


function openMoreSheet() {

    var sheet = document.getElementById('moreSheet');
    var overlay = document.getElementById('moreOverlay');

    if (!sheet || !overlay) return;

    overlay.classList.remove('hidden');
    sheet.classList.remove('hidden');

    requestAnimationFrame(function() {
        sheet.classList.add('is-open');
    });
}


function closeMoreSheet() {

    var sheet = document.getElementById('moreSheet');
    var overlay = document.getElementById('moreOverlay');

    if (!sheet || !overlay) return;

    sheet.classList.remove('is-open');

    setTimeout(function() {
        sheet.classList.add('hidden');
        overlay.classList.add('hidden');
    }, 200);
}


function moreGo(tabId, label) {

    closeMoreSheet();
    switchTabMobile(tabId, label);
}


// Lọc danh mục Sổ thu chi theo Thu/Chi (chỉ áp dụng trên mobile — các nút
// data-cbgroup vẫn hiển thị đầy đủ, không lọc, trên desktop vì hàm này chỉ được
// gọi từ bottom nav / pill mobile).
function setCashbookGroup(group) {

    __cbGroup = group;
    window.__cbGroup = group;

    document.querySelectorAll('[data-cbgroup]').forEach(function(el) {
        el.style.display =
            (el.getAttribute('data-cbgroup') === group) ? '' : 'none';
    });

    var pillThu = document.getElementById('cbPillThu');
    var pillChi = document.getElementById('cbPillChi');

    if (pillThu) pillThu.classList.toggle('active', group === 'thu');
    if (pillChi) pillChi.classList.toggle('active', group === 'chi');
}


// ======================================================
// PULL-TO-REFRESH (mobile) — thay cho nút 🔄 làm mới cũ.
// Không dùng preventDefault (listener passive) để không phá
// cuộn trang mặc định của iOS; chỉ vẽ chỉ báo trực quan bằng
// cách tăng chiều cao #ptrIndicator (phần tử nằm trong luồng
// trang, KHÔNG position:fixed) rồi gọi lại refreshCloudData().
// ======================================================

(function initPullToRefresh_() {

    var PTR_THRESHOLD = 62;
    var PTR_MAX = 78;

    var startY = 0;
    var pulling = false;
    var refreshing = false;

    var indicator, iconEl, textEl;

    function els_() {
        if (!indicator) indicator = document.getElementById('ptrIndicator');
        if (!iconEl) iconEl = document.getElementById('ptrIcon');
        if (!textEl) textEl = document.getElementById('ptrText');
        return !!(indicator && iconEl && textEl);
    }

    function atTop_() {
        return (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    }

    function sheetOpen_() {
        var g = document.getElementById('ghiNhanSheet');
        var m = document.getElementById('moreSheet');
        return (g && g.classList.contains('is-open')) ||
               (m && m.classList.contains('is-open'));
    }

    function resetIndicator_() {
        if (!els_()) return;
        indicator.style.height = '0px';
        iconEl.classList.remove('fa-rotate-180', 'fa-spinner', 'fa-spin');
        iconEl.classList.add('fa-arrow-down');
        textEl.innerText = 'Kéo xuống để làm mới';
    }

    function onTouchStart_(e) {
        if (refreshing || window.innerWidth >= 768) { pulling = false; return; }

        var appScreen = document.getElementById('appScreen');
        if (!appScreen || appScreen.classList.contains('hidden')) { pulling = false; return; }

        if (sheetOpen_() || !atTop_() || !e.touches || e.touches.length !== 1) {
            pulling = false;
            return;
        }

        startY = e.touches[0].clientY;
        pulling = true;
    }

    function onTouchMove_(e) {
        if (!pulling || refreshing || !els_()) return;

        if (!atTop_() || sheetOpen_()) {
            pulling = false;
            indicator.style.height = '0px';
            return;
        }

        var dy = e.touches[0].clientY - startY;

        if (dy <= 0) {
            indicator.style.height = '0px';
            return;
        }

        var dist = Math.min(dy * 0.5, PTR_MAX);
        indicator.style.height = dist + 'px';

        if (dist >= PTR_THRESHOLD) {
            iconEl.classList.add('fa-rotate-180');
            textEl.innerText = 'Thả ra để làm mới';
        } else {
            iconEl.classList.remove('fa-rotate-180');
            textEl.innerText = 'Kéo xuống để làm mới';
        }
    }

    function onTouchEnd_() {
        if (!pulling || refreshing || !els_()) { pulling = false; return; }

        pulling = false;

        var dist = parseFloat(indicator.style.height) || 0;

        if (dist < PTR_THRESHOLD) {
            indicator.style.height = '0px';
            return;
        }

        refreshing = true;
        indicator.style.height = PTR_MAX + 'px';
        iconEl.classList.remove('fa-arrow-down', 'fa-rotate-180');
        iconEl.classList.add('fa-spinner', 'fa-spin');
        textEl.innerText = 'Đang làm mới...';

        function done_() {
            refreshing = false;
            resetIndicator_();
        }

        try {
            if (typeof window.refreshCloudData === 'function') {
                Promise.resolve(window.refreshCloudData(null)).then(done_).catch(done_);
            } else {
                setTimeout(done_, 600);
            }
        } catch (err) {
            done_();
        }
    }

    document.addEventListener('touchstart', onTouchStart_, { passive: true });
    document.addEventListener('touchmove', onTouchMove_, { passive: true });
    document.addEventListener('touchend', onTouchEnd_, { passive: true });
    document.addEventListener('touchcancel', function() {
        pulling = false;
        if (!refreshing) resetIndicator_();
    }, { passive: true });

})();

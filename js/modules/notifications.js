// ======================================================
// CHUÔNG THÔNG BÁO (v2.0)
//
// - Lịch sử thông báo lưu TRÊN TỪNG THIẾT BỊ (localStorage),
//   không đồng bộ qua Cloud - đúng như đã thống nhất.
// - Việc GỬI thông báo đẩy THẬT (Web Push, hiện cả khi tắt app)
//   giờ HOÀN TOÀN do SERVER thực hiện, tự động ngay sau khi 1
//   action nghiệp vụ đã được Apps Script XÁC NHẬN COMMIT (xem
//   frontend/api/_lib/pushSender.js + api/actions/write.js).
//   Trình duyệt không còn tải danh sách Push Subscription của
//   người khác, và không còn tự gọi endpoint gửi push nào (điểm
//   yếu #8 đã sửa). File này giờ chỉ còn quản lý: (1) lịch sử
//   thông báo cục bộ hiển thị ở chuông, (2) đăng ký/huỷ đăng ký
//   nhận Push của CHÍNH thiết bị, (3) gửi thông báo thủ công cho
//   cả CLB qua /api/push/broadcast (chỉ Admin/Owner).
// ======================================================

const NOTIF_STORAGE_KEY = 'tlt_notifications_v1';
const NOTIF_MAX_ITEMS = 50;

// Chỉ hiện tối đa một lần trong mỗi lần tải trang. Nếu thành viên đã
// bật Push trên thiết bị thì hàm kiểm tra trạng thái sẽ tự bỏ qua.
let pushPermissionPromptShownThisSession_ = false;
let pushPermissionPromptTimer_ = null;


// ======================================================
// LƯU TRỮ CỤC BỘ (từng thiết bị)
// ======================================================

function loadNotificationHistory_() {

    try {

        let raw = window.localStorage.getItem(NOTIF_STORAGE_KEY);
        let list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];

    } catch (err) {

        console.warn('NOTIF LOAD ERROR:', err);
        return [];
    }
}


function saveNotificationHistory_(list) {

    try {

        window.localStorage.setItem(
            NOTIF_STORAGE_KEY,
            JSON.stringify((list || []).slice(0, NOTIF_MAX_ITEMS))
        );

    } catch (err) {

        console.warn('NOTIF SAVE ERROR:', err);
    }
}


function addNotificationToHistory_(title, body) {

    let list = loadNotificationHistory_();

    list.unshift({
        id: 'n_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
        title: title || 'Thông báo',
        body: body || '',
        time: formatVNDateTime_(),
        read: false
    });

    saveNotificationHistory_(list);

    if (typeof renderNotificationBadge === 'function') {
        renderNotificationBadge();
    }

    if (typeof renderNotificationCenter === 'function') {
        renderNotificationCenter();
    }
}


function deleteNotificationItem(id) {

    let list = loadNotificationHistory_().filter(function(n) {
        return n.id !== id;
    });

    saveNotificationHistory_(list);
    renderNotificationBadge();
    renderNotificationCenter();
}


function clearAllNotifications() {

    showActionConfirm(
        'Xoá toàn bộ thông báo trên thiết bị này?',
        function() {

            saveNotificationHistory_([]);
            renderNotificationBadge();
            renderNotificationCenter();
        }
    );
}


// ======================================================
// BELL BADGE (số thông báo chưa đọc)
// ======================================================

function renderNotificationBadge() {

    let badge = document.getElementById('notifBadge');
    if (!badge) return;

    let unreadCount = loadNotificationHistory_().filter(function(n) {
        return !n.read;
    }).length;

    if (unreadCount > 0) {
        badge.classList.remove('hidden');
        badge.innerText = unreadCount > 9 ? '9+' : String(unreadCount);
    } else {
        badge.classList.add('hidden');
    }
}


// ======================================================
// TRUNG TÂM THÔNG BÁO (modal)
// ======================================================

function renderNotificationCenter() {

    let container = document.getElementById('notificationCenterList');
    if (!container) return;

    let list = loadNotificationHistory_();

    if (list.length === 0) {

        container.innerHTML =
            '<div class="text-center text-xs text-slate-400 italic py-8">Chưa có thông báo nào.</div>';

        return;
    }

    container.innerHTML = list.map(function(n) {

        return (
            '<div class="flex items-start gap-2.5 p-3 border-b border-slate-100 last:border-0">' +
                '<div class="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">' +
                    '<i class="fa-solid fa-bell text-xs"></i>' +
                '</div>' +
                '<div class="flex-1 min-w-0">' +
                    '<p class="text-xs font-bold text-slate-800">' + escapeHtml_(n.title) + '</p>' +
                    '<p class="text-[11px] text-slate-500 mt-0.5">' + escapeHtml_(n.body) + '</p>' +
                    '<p class="text-[10px] text-slate-300 mt-1">' + escapeHtml_(formatVNTimeForDisplay_(n.time)) + '</p>' +
                '</div>' +
                '<button type="button" onclick="deleteNotificationItem(\'' + n.id + '\')" class="text-slate-300 hover:text-red-500 flex-shrink-0 p-1">' +
                    '<i class="fa-solid fa-xmark text-xs"></i>' +
                '</button>' +
            '</div>'
        );

    }).join('');
}


function escapeHtml_(text) {

    let div = document.createElement('div');
    div.innerText = text == null ? '' : String(text);
    return div.innerHTML;
}


function openNotificationCenterModal() {

    if (typeof closeMoreSheet === 'function') closeMoreSheet();

    // Mở trung tâm thông báo -> coi như đã đọc hết.
    let list = loadNotificationHistory_().map(function(n) {
        n.read = true;
        return n;
    });

    saveNotificationHistory_(list);
    renderNotificationBadge();
    renderNotificationCenter();

    let modal = document.getElementById('notificationCenterModal');

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}


function closeNotificationCenterModal() {

    let modal = document.getElementById('notificationCenterModal');

    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}


// ======================================================
// BẬT THÔNG BÁO ĐẨY (Web Push) TRÊN THIẾT BỊ NÀY
// ======================================================

function urlBase64ToUint8Array_(base64String) {

    let padding = '='.repeat((4 - base64String.length % 4) % 4);
    let base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    let rawData = window.atob(base64);
    let outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}


function isPushSupported_() {

    return (
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        typeof VAPID_PUBLIC_KEY === 'string' &&
        VAPID_PUBLIC_KEY.length > 0
    );
}


async function enablePushNotifications(options) {

    options = options || {};

    if (!isPushSupported_()) {

        if (!options.silent) {
            showToast('Trình duyệt này chưa hỗ trợ thông báo đẩy. Trên iPhone cần thêm app ra Màn hình chính (Add to Home Screen) và dùng iOS 16.4 trở lên.');
        }

        return { status: 'unsupported' };
    }

    try {

        let permission = Notification.permission;

        if (permission !== 'granted' && permission !== 'denied') {
            permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {

            if (!options.silent) {
                showToast('Bạn chưa cho phép thông báo. Có thể bật lại trong Cài đặt trình duyệt/điện thoại.');
            }

            updatePushToggleUi_();
            return { status: permission === 'denied' ? 'denied' : 'dismissed' };
        }

        let registration = await navigator.serviceWorker.ready;

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array_(VAPID_PUBLIC_KEY)
            });
        }

        let subJson = subscription.toJSON();

        enqueueAction(
            'savePushSubscription',
            {
                subscription: {
                    memberName: loggedInMemberName || '',
                    endpoint: subJson.endpoint,
                    p256dh: subJson.keys && subJson.keys.p256dh,
                    auth: subJson.keys && subJson.keys.auth
                }
            },
            'Đã bật thông báo đẩy trên thiết bị này!'
        );

        updatePushToggleUi_();

        return { status: 'enabled', subscription: subscription };

    } catch (err) {

        console.error('ENABLE PUSH ERROR:', err);

        if (!options.silent) {
            showToast('Không bật được thông báo đẩy trên thiết bị này.');
        }

        return { status: 'error', error: err };
    }
}


// ======================================================
// HỘP YÊU CẦU BẬT PUSH SAU HƯỚNG DẪN / SAU ĐĂNG NHẬP
//
// Browser chỉ cho gọi Notification.requestPermission() từ thao tác
// bấm trực tiếp của người dùng. Vì vậy app hiện modal riêng, đưa nút
// "Bật thông báo ngay" ra trước mặt thành viên thay vì bắt họ tự tìm
// chuông. Modal không có nút X và không đóng khi chạm ra ngoài.
// ======================================================

function schedulePushPermissionPrompt_(delayMs) {

    if (pushPermissionPromptShownThisSession_) return;

    if (pushPermissionPromptTimer_) {
        clearTimeout(pushPermissionPromptTimer_);
    }

    pushPermissionPromptTimer_ = setTimeout(function() {
        pushPermissionPromptTimer_ = null;
        maybeShowPushPermissionPrompt_();
    }, Math.max(0, Number(delayMs) || 0));
}


async function maybeShowPushPermissionPrompt_() {

    if (pushPermissionPromptShownThisSession_) return;

    let modal = document.getElementById('pushPermissionPromptModal');
    if (!modal) return;

    let state = 'needs-permission';

    if (!isPushSupported_()) {
        state = 'unsupported';
    } else if (Notification.permission === 'denied') {
        state = 'denied';
    } else if (Notification.permission === 'granted') {

        try {
            let registration = await navigator.serviceWorker.ready;
            let existing = await registration.pushManager.getSubscription();

            if (existing) {
                updatePushToggleUi_();
                return;
            }

            state = 'needs-subscription';

        } catch (err) {
            console.warn('PUSH PROMPT STATE ERROR:', err);
            state = 'error';
        }
    }

    pushPermissionPromptShownThisSession_ = true;
    renderPushPermissionPromptState_(state);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}


function renderPushPermissionPromptState_(state) {

    let title = document.getElementById('pushPermissionPromptTitle');
    let desc = document.getElementById('pushPermissionPromptDesc');
    let note = document.getElementById('pushPermissionPromptNote');
    let enableBtn = document.getElementById('pushPermissionPromptEnableBtn');
    let continueBtn = document.getElementById('pushPermissionPromptContinueBtn');

    if (!title || !desc || !note || !enableBtn || !continueBtn) return;

    enableBtn.disabled = false;
    enableBtn.innerHTML = '<i class="fa-solid fa-bell"></i> BẬT THÔNG BÁO NGAY';
    enableBtn.classList.remove('hidden');
    continueBtn.classList.add('hidden');
    note.classList.add('hidden');
    note.innerText = '';

    if (state === 'unsupported') {

        title.innerText = 'CẦN CÀI APP ĐỂ NHẬN THÔNG BÁO';
        desc.innerText = 'Trên iPhone/iPad, hãy mở bằng Safari và chọn Chia sẻ → Thêm vào Màn hình chính. Sau đó mở app vừa cài để bật thông báo.';
        enableBtn.classList.add('hidden');
        continueBtn.classList.remove('hidden');
        continueBtn.innerText = 'ĐÃ HIỂU, TIẾP TỤC';
        return;
    }

    if (state === 'denied') {

        title.innerText = 'THÔNG BÁO ĐANG BỊ CHẶN';
        desc.innerText = 'Thiết bị đã từ chối quyền thông báo. Hãy mở Cài đặt của trình duyệt/điện thoại, cho phép Thông báo đối với app CLB Tennis Thăng Long.';
        enableBtn.classList.add('hidden');
        continueBtn.classList.remove('hidden');
        continueBtn.innerText = 'ĐÃ HIỂU, TIẾP TỤC';
        return;
    }

    if (state === 'error') {

        title.innerText = 'CHƯA KIỂM TRA ĐƯỢC THÔNG BÁO';
        desc.innerText = 'Dịch vụ thông báo chưa sẵn sàng. Bạn có thể tiếp tục vào ứng dụng và thử lại sau.';
        enableBtn.classList.add('hidden');
        continueBtn.classList.remove('hidden');
        continueBtn.innerText = 'TIẾP TỤC VÀO ỨNG DỤNG';
        return;
    }

    title.innerText = 'BẬT THÔNG BÁO TỪ CLB';
    desc.innerText = 'Nhận ngay thông báo về trận đấu, thưởng sân, đóng quỹ và các hoạt động mới của CLB.';
}


async function confirmPushPermissionFromPrompt_() {

    let btn = document.getElementById('pushPermissionPromptEnableBtn');
    let note = document.getElementById('pushPermissionPromptNote');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG BẬT...';
    }

    let result = await enablePushNotifications({ silent: true });

    if (result && result.status === 'enabled') {
        closePushPermissionPrompt_();
        return;
    }

    if (result && result.status === 'denied') {
        renderPushPermissionPromptState_('denied');
        return;
    }

    if (result && result.status === 'unsupported') {
        renderPushPermissionPromptState_('unsupported');
        return;
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> THỬ BẬT LẠI';
    }

    if (note) {
        note.innerText = 'Chưa bật được thông báo. Hãy kiểm tra mạng rồi thử lại.';
        note.classList.remove('hidden');
    }
}


function closePushPermissionPrompt_() {

    let modal = document.getElementById('pushPermissionPromptModal');

    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}


async function updatePushToggleUi_() {

    let btn = document.getElementById('pushToggleBtn');
    if (!btn || !isPushSupported_()) return;

    try {

        let registration = await navigator.serviceWorker.ready;
        let existing = await registration.pushManager.getSubscription();

        if (existing && Notification.permission === 'granted') {

            btn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> <span class="flex-1 text-left">Thông báo đẩy: Đã bật</span>';
            btn.classList.add('text-emerald-700');

        } else {

            btn.innerHTML = '<i class="fa-solid fa-bell"></i> <span class="flex-1 text-left">Bật thông báo đẩy</span>';
            btn.classList.remove('text-emerald-700');
        }

    } catch (err) {

        console.warn('PUSH UI STATE ERROR:', err);
    }
}


// ======================================================
// GỬI THÔNG BÁO CHO CẢ CLB (gọi khi có sự kiện đáng báo)
//
// 1. Ghi ngay vào lịch sử của THIẾT BỊ ĐANG THAO TÁC (để
//    người vừa bấm cũng thấy trong chuông của họ).
// 2. Lấy danh sách Push Subscription từ Apps Script rồi gọi
//    API /api/send-push để đẩy tới TẤT CẢ thiết bị đã bật.
//
// Không chặn luồng chính (fire-and-forget) - lỗi ở bước gửi
// đẩy không ảnh hưởng tới việc ghi nhận dữ liệu chính.
// ======================================================

function triggerClubPushNotification(title, body) {

    // ==================================================
    // v2.0 (sửa điểm yếu #8): CHỈ còn ghi vào lịch sử thông báo
    // CỤC BỘ của chính thiết bị đang thao tác (chuông ở góc màn
    // hình). Việc gửi Web Push THẬT tới TẤT CẢ thiết bị khác giờ
    // do SERVER tự làm ngay sau khi backend xác nhận commit (xem
    // frontend/api/_lib/pushSender.js, gọi từ api/actions/write.js)
    // - trình duyệt không bao giờ còn tải danh sách subscription
    // hay tự gọi endpoint gửi push nữa.
    // ==================================================

    try {
        addNotificationToHistory_(title, body);
    } catch (err) {
        console.warn('LOCAL NOTIF ERROR:', err);
    }
}

// Gửi thông báo thủ công cho CẢ CLB - CHỈ Admin/Owner (server tự
// xác minh lại role qua whoAmI, xem api/push/broadcast.js). Dùng
// cho ô "Soạn thông báo" trong Cài đặt (nếu có) thay cho việc tự
// gọi thẳng /api/send-push như v1.6.
function sendClubBroadcast_(title, body) {

    return fetch('/api/push/broadcast', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, body: body })
    }).then(function(res) { return res.json(); });
}


// ======================================================
// PHÂN LOẠI SỰ KIỆN -> NỘI DUNG THÔNG BÁO
//
// Được gọi từ enqueueAction() ngay sau khi 1 thao tác được
// đưa vào hàng đợi đồng bộ thành công (xem js/api.js).
// ======================================================

function maybeNotifyPush_(actionName, payload) {

    if (!payload) return;

    if (actionName === 'addBooking' && payload.booking) {

        let b = payload.booking;
        let label = (b.frame || '').indexOf('16h') === 0 ? '16h' : '18h';
        let amount = (parseInt(b.reward) || 0).toLocaleString('vi-VN');

        triggerClubPushNotification(
            'Thưởng sân ' + label,
            'Đã ghi nhận thưởng đặt sân ' + label + ' cho ' + b.name + ' (' + amount + 'đ).'
        );

    } else if (actionName === 'addQuyLog' && payload.quyLog) {

        let q = payload.quyLog;
        let amount = (parseInt(q.amount) || 0).toLocaleString('vi-VN');

        triggerClubPushNotification(
            'Đóng quỹ',
            'Đã ghi nhận đóng quỹ ' + q.quarter + '/' + q.year + ' của ' + q.name + ' (' + amount + 'đ).'
        );

    } else if (actionName === 'addGocLog' && payload.gocLog) {

        let g = payload.gocLog;
        let amount = (parseInt(g.amount) || 0).toLocaleString('vi-VN');

        triggerClubPushNotification(
            'Nộp tiền góc',
            'Đã ghi nhận nộp tiền góc ' + amount + 'đ từ ' + (g.name || '') + '.'
        );

    } else if (actionName === 'addMatch' && payload.match) {

        triggerClubPushNotification(
            'Trận đấu mới',
            'Có 1 trận đấu mới vừa được ghi nhận hôm nay.'
        );

    } else if (actionName === 'addRule' && payload.rule) {

        triggerClubPushNotification(
            'Quy định mới',
            payload.rule.title || 'Có thông báo/quy định mới từ CLB.'
        );
    }
}

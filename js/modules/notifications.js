// ======================================================
// CHUÔNG THÔNG BÁO (v1.6)
//
// - Lịch sử thông báo lưu TRÊN TỪNG THIẾT BỊ (localStorage),
//   không đồng bộ qua Cloud - đúng như đã thống nhất.
// - Việc GỬI thông báo đẩy thật (Web Push, hiện cả khi tắt
//   app) đi qua API /api/send-push (Vercel) + danh sách
//   Push Subscription lưu trên Google Sheet (để biết cần
//   gửi tới thiết bị nào - xem PushSubscriptionService.gs).
// ======================================================

const NOTIF_STORAGE_KEY = 'tlt_notifications_v1';
const NOTIF_MAX_ITEMS = 50;


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
        time: new Date().toLocaleString('vi-VN'),
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
                    '<p class="text-[10px] text-slate-300 mt-1">' + escapeHtml_(n.time) + '</p>' +
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
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        typeof VAPID_PUBLIC_KEY === 'string' &&
        VAPID_PUBLIC_KEY.length > 0
    );
}


async function enablePushNotifications() {

    if (!isPushSupported_()) {

        showToast('Trình duyệt này chưa hỗ trợ thông báo đẩy. Trên iPhone cần thêm app ra Màn hình chính (Add to Home Screen) và dùng iOS 16.4 trở lên.');
        return;
    }

    try {

        let permission = await Notification.requestPermission();

        if (permission !== 'granted') {

            showToast('Bạn chưa cho phép thông báo. Có thể bật lại trong Cài đặt trình duyệt/điện thoại.');
            updatePushToggleUi_();
            return;
        }

        let registration = await navigator.serviceWorker.ready;

        let subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array_(VAPID_PUBLIC_KEY)
        });

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

    } catch (err) {

        console.error('ENABLE PUSH ERROR:', err);
        showToast('Không bật được thông báo đẩy trên thiết bị này.');
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

    try {
        addNotificationToHistory_(title, body);
    } catch (err) {
        console.warn('LOCAL NOTIF ERROR:', err);
    }

    try {

        if (typeof fetchJsonpPhase3_ !== 'function' || !PUSH_API_ENDPOINT) {
            return;
        }

        fetchJsonpPhase3_(
            { action: 'getPushSubscriptions' },
            false,
            function(error, data) {

                if (error || !data || data.status !== 'SUCCESS') {
                    return;
                }

                let subscriptions = data.subscriptions || [];
                if (subscriptions.length === 0) return;

                fetch(PUSH_API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subscriptions: subscriptions,
                        title: title,
                        body: body
                    })
                }).catch(function(err) {
                    console.warn('SEND PUSH API ERROR:', err);
                });
            }
        );

    } catch (err) {

        console.warn('TRIGGER PUSH ERROR:', err);
    }
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

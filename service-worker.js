// ======================================================
// CLB TENNIS THĂNG LONG - SERVICE WORKER
// v2.1.0 CUP TEST
//
// - Không cache dữ liệu tài chính/API.
// - Không cache HTML/JS/CSS (network-only cho mọi GET cùng origin),
//   nên không có rủi ro "cache cũ phục vụ code v1 đã lỗi thời" sau
//   khi nâng cấp lên v2.0 - không cần cơ chế xoá Cache Storage cũ.
// - Luôn ưu tiên dữ liệu mới nhất từ Network.
// ======================================================

const SERVICE_WORKER_VERSION =
    'tennis-thang-long-pwa-v2.1.0-cup-test';


self.addEventListener(
    'install',
    function(event) {

        console.log(
            'SERVICE WORKER INSTALL:',
            SERVICE_WORKER_VERSION
        );

        self.skipWaiting();
    }
);


self.addEventListener(
    'activate',
    function(event) {

        console.log(
            'SERVICE WORKER ACTIVATE:',
            SERVICE_WORKER_VERSION
        );

        event.waitUntil(
            self.clients.claim()
        );
    }
);


// ======================================================
// PUSH - hiển thị thông báo hệ thống khi Vercel /api/send-push
// đẩy 1 tin tới thiết bị này, kể cả khi app đang tắt.
// ======================================================

self.addEventListener(
    'push',
    function(event) {

        let payload = {};

        try {
            payload = event.data ? event.data.json() : {};
        } catch (err) {
            payload = { title: 'CLB Tennis Thăng Long', body: event.data ? event.data.text() : '' };
        }

        let title = payload.title || 'CLB Tennis Thăng Long';

        let options = {
            body: payload.body || '',
            icon: 'icons/tennis-thang-long.svg',
            badge: 'icons/tennis-thang-long.svg',
            data: { url: payload.url || './' }
        };

        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    }
);


// ======================================================
// NOTIFICATIONCLICK - mở/focus lại app khi bấm vào thông báo.
// ======================================================

self.addEventListener(
    'notificationclick',
    function(event) {

        event.notification.close();

        let targetUrl = (event.notification.data && event.notification.data.url) || './';

        event.waitUntil(
            self.clients
                .matchAll({ type: 'window', includeUncontrolled: true })
                .then(function(clientList) {

                    for (let i = 0; i < clientList.length; i++) {

                        let client = clientList[i];

                        if ('focus' in client) {
                            return client.focus();
                        }
                    }

                    if (self.clients.openWindow) {
                        return self.clients.openWindow(targetUrl);
                    }
                })
        );
    }
);


self.addEventListener(
    'fetch',
    function(event) {

        let request =
            event.request;

        if (
            !request ||
            request.method !== 'GET'
        ) {
            return;
        }

        let requestUrl =
            new URL(
                request.url
            );

        // Không can thiệp API/CDN bên ngoài
        if (
            requestUrl.origin !==
            self.location.origin
        ) {
            return;
        }

        // Network-only:
        // luôn lấy phiên bản mới nhất.
        event.respondWith(
            fetch(
                request
            )
        );
    }
);

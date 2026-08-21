// ======================================================
// CLB TENNIS THĂNG LONG - SERVICE WORKER
// PHASE 3B
//
// - Không cache dữ liệu tài chính/API.
// - Không cache HTML/JS/CSS.
// - Luôn ưu tiên dữ liệu mới nhất từ Network.
// ======================================================

const SERVICE_WORKER_VERSION =
    'tennis-thang-long-pwa-v1';


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

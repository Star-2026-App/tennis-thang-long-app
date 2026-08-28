// ======================================================
// CLB TENNIS THĂNG LONG - SERVICE WORKER
// v2.1.1 PERFORMANCE TEST
// ======================================================

const SERVICE_WORKER_VERSION = 'tennis-thang-long-pwa-v2.1.1-performance-test';
const APP_SHELL_CACHE = SERVICE_WORKER_VERSION + '-shell';
const APP_SHELL = [
    './', './index.html', './manifest.json', './css/main.css',
    './icons/tennis-thang-long.svg',
    './js/config.js', './js/state.js', './js/storage.js', './js/api.js',
    './js/auth.js', './js/ui.js', './js/modules/analytics.js',
    './js/modules/members.js', './js/modules/rules.js', './js/modules/cup.js',
    './js/modules/booking.js', './js/modules/finance.js',
    './js/modules/matches.js', './js/modules/dashboard.js',
    './js/modules/settings.js', './js/modules/notifications.js',
    './js/modules/onboarding.js', './js/init.js', './js/app.js'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(APP_SHELL_CACHE)
            .then(function(cache) {
                return Promise.all(APP_SHELL.map(function(url) {
                    return cache.add(url).catch(function(err) {
                        console.warn('APP SHELL CACHE SKIP:', url, err && err.message);
                    });
                }));
            })
            .then(function() { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys()
            .then(function(keys) {
                return Promise.all(keys.map(function(key) {
                    if (key.indexOf('tennis-thang-long-pwa-') === 0 && key !== APP_SHELL_CACHE) {
                        return caches.delete(key);
                    }
                    return null;
                }));
            })
            .then(function() { return self.clients.claim(); })
    );
});

self.addEventListener('push', function(event) {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (err) {
        payload = { title: 'CLB Tennis Thăng Long', body: event.data ? event.data.text() : '' };
    }

    event.waitUntil(self.registration.showNotification(
        payload.title || 'CLB Tennis Thăng Long',
        {
            body: payload.body || '',
            icon: 'icons/tennis-thang-long.svg',
            badge: 'icons/tennis-thang-long.svg',
            data: { url: payload.url || './' }
        }
    ));
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    let targetUrl = (event.notification.data && event.notification.data.url) || './';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function(clientList) {
                for (let i = 0; i < clientList.length; i++) {
                    if ('focus' in clientList[i]) return clientList[i].focus();
                }
                if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
                return null;
            })
    );
});

function cacheSuccessfulResponse_(request, response) {
    if (!response || !response.ok || response.type === 'opaque') return response;
    caches.open(APP_SHELL_CACHE).then(function(cache) {
        cache.put(request, response.clone());
    });
    return response;
}

function navigationNetworkFirst_(request) {
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 5000);

    return fetch(request, { signal: controller.signal })
        .then(function(response) {
            clearTimeout(timeoutId);
            return cacheSuccessfulResponse_(request, response);
        })
        .catch(function() {
            clearTimeout(timeoutId);
            return caches.match(request).then(function(exact) {
                return exact || caches.match('./index.html') || caches.match('./');
            });
        });
}

self.addEventListener('fetch', function(event) {
    var request = event.request;
    if (!request || request.method !== 'GET') return;

    var requestUrl = new URL(request.url);

    // API luôn network-only; không bao giờ cache dữ liệu CLB/tài chính.
    if (requestUrl.origin !== self.location.origin || requestUrl.pathname.indexOf('/api/') === 0) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(navigationNetworkFirst_(request));
        return;
    }

    // Static: hiển thị cache ngay, đồng thời cập nhật ở background.
    event.respondWith(
        caches.match(request).then(function(cached) {
            var network = fetch(request)
                .then(function(response) { return cacheSuccessfulResponse_(request, response); })
                .catch(function() { return cached; });
            return cached || network;
        })
    );
});

// ======================================================
// /api/send-push
//
// Vercel Serverless Function (Node.js runtime).
// Nhận danh sách Push Subscription + nội dung thông báo từ
// frontend (js/modules/notifications.js), rồi dùng thư viện
// "web-push" để gửi thông báo đẩy thật tới từng thiết bị đã
// đăng ký, kể cả khi app đang tắt (Web Push chuẩn RFC8291).
//
// Cần khai báo 2 biến môi trường trên Vercel (Project
// Settings > Environment Variables):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
// (giá trị do Claude tạo sẵn, xem file HUONG_DAN_TRIEN_KHAI.md)
//
// và tuỳ chọn:
//   VAPID_CONTACT_EMAIL  (mặc định "mailto:admin@example.com")
// ======================================================

const webpush = require('web-push');

module.exports = async function handler(req, res) {

    if (req.method !== 'POST') {
        res.status(405).json({ status: 'ERROR', message: 'Chỉ hỗ trợ POST.' });
        return;
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
        res.status(500).json({
            status: 'ERROR',
            message: 'Server chưa cấu hình VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (Environment Variables trên Vercel).'
        });
        return;
    }

    webpush.setVapidDetails(
        process.env.VAPID_CONTACT_EMAIL || 'mailto:admin@example.com',
        publicKey,
        privateKey
    );

    let body = req.body;

    // Vercel thường tự parse JSON body; phòng khi chưa parse (content-type khác).
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (err) {
            res.status(400).json({ status: 'ERROR', message: 'Body không phải JSON hợp lệ.' });
            return;
        }
    }

    const subscriptions = Array.isArray(body && body.subscriptions) ? body.subscriptions : [];
    const title = (body && body.title) || 'CLB Tennis Thăng Long';
    const text = (body && body.body) || '';

    if (subscriptions.length === 0) {
        res.status(200).json({ status: 'SUCCESS', sent: 0, failed: 0, message: 'Không có thiết bị nào đã đăng ký nhận thông báo.' });
        return;
    }

    const payload = JSON.stringify({ title: title, body: text });

    let sent = 0;
    let failed = 0;
    const expiredEndpoints = [];

    await Promise.all(
        subscriptions.map(async function(sub) {

            if (!sub || !sub.endpoint || !sub.p256dh || !sub.auth) {
                failed++;
                return;
            }

            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {

                await webpush.sendNotification(pushSubscription, payload);
                sent++;

            } catch (err) {

                failed++;

                // 404/410 = subscription hết hạn hoặc người dùng đã tắt thông báo.
                // Trả về danh sách này để frontend/Apps Script có thể dọn dẹp sau.
                if (err && (err.statusCode === 404 || err.statusCode === 410)) {
                    expiredEndpoints.push(sub.endpoint);
                }

                console.error('SEND PUSH ERROR:', sub.endpoint, err && err.message);
            }
        })
    );

    res.status(200).json({
        status: 'SUCCESS',
        sent: sent,
        failed: failed,
        expiredEndpoints: expiredEndpoints
    });
};

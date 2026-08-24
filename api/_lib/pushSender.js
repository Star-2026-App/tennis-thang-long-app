// ======================================================
// _lib/pushSender.js (v2.0)
// ======================================================
//
// SỬA lỗ hổng #8 (điểm yếu nghiêm trọng): trình duyệt KHÔNG BAO
// GIỜ còn tải danh sách Push Subscription, và endpoint gửi push
// công khai (frontend/api/send-push.js cũ) đã bị loại bỏ hoàn
// toàn. Toàn bộ việc gửi push giờ CHỈ xảy ra ở server (module
// này), do chính Vercel gọi:
//
//   1. Tự động SAU KHI 1 action nghiệp vụ đã COMMIT thành công ở
//      Apps Script (gọi từ api/actions/write.js) - nội dung thông
//      báo do SERVER tự soạn theo action/data, không nhận title/
//      body tuỳ ý từ client.
//   2. Thông báo thủ công do Admin/Owner soạn (api/push/broadcast.js)
//      - vẫn yêu cầu session hợp lệ + role >= admin, và danh sách
//      subscription vẫn được lấy nội bộ, không đi qua client.
//
// Danh sách subscription được lấy qua system action
// "pushGetSubscriptionsForSend" (server-to-server, không lộ ra
// trình duyệt) và endpoint hết hạn được dọn qua
// "pushRemoveExpiredEndpoints".
// ======================================================

const webpush = require("web-push");
const env = require("./env");
const appsScript = require("./appsScript");

let vapidConfigured = false;

function ensureVapidConfigured_() {
  if (vapidConfigured) return true;

  var publicKey = env.vapidPublicKey();
  var privateKey = env.vapidPrivateKey();

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(env.vapidContactEmail(), publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

// Soạn nội dung thông báo TỪ DỮ LIỆU SERVER ĐÃ XÁC THỰC (kết quả
// trả về bởi Apps Script sau khi commit), không dùng bất kỳ chuỗi
// tự do nào do client gửi trực tiếp.
function buildEventNotification_(action, result, actorName) {
  var vnd = function (n) { return (parseInt(n) || 0).toLocaleString("vi-VN"); };

  switch (action) {
    case "addBooking": {
      var label = result && /18h/.test(String(result.frame || "")) ? "18h" : "16h";
      return {
        title: "Thưởng sân " + label,
        body: "Đã ghi nhận thưởng đặt sân " + label + " cho " + (result.name || actorName) + " (" + vnd(result.reward) + "đ)."
      };
    }

    case "addQuyLog":
      return {
        title: "Quỹ CLB",
        body: (actorName || "Một thành viên") + " vừa đóng quỹ."
      };

    case "addCashbook":
      return {
        title: "Sổ thu chi",
        body: "Có giao dịch thu chi mới do " + (actorName || "Admin") + " ghi nhận."
      };

    case "closeMonth":
      return {
        title: "Chốt tháng",
        body: "Tháng " + (result && result.month) + "/" + (result && result.year) + " đã được chốt bởi " + (actorName || "Admin") + "."
      };

    case "addRule":
      return {
        title: "Quy định mới",
        body: "CLB vừa cập nhật quy định mới. Xem chi tiết trong mục Quy định."
      };

    default:
      return null; // action này không cần bắn push
  }
}

async function sendToAllSubscriptions_(title, body) {
  if (!ensureVapidConfigured_()) {
    console.warn("PUSH SKIPPED: thiếu VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY.");
    return { sent: 0, failed: 0 };
  }

  var subsResult = await appsScript.callSystemAction("pushGetSubscriptionsForSend", {});
  var subscriptions = (subsResult && subsResult.subscriptions) || [];

  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  var payload = JSON.stringify({ title: title, body: body });
  var sent = 0, failed = 0;
  var expiredEndpoints = [];

  await Promise.all(subscriptions.map(async function (sub) {
    if (!sub || !sub.endpoint || !sub.p256dh || !sub.auth) { failed++; return; }

    var pushSubscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };

    try {
      await webpush.sendNotification(pushSubscription, payload);
      sent++;
    } catch (err) {
      failed++;
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        expiredEndpoints.push(sub.endpoint);
      }
      console.error("SEND PUSH ERROR:", sub.endpoint, err && err.message);
    }
  }));

  if (expiredEndpoints.length > 0) {
    try {
      await appsScript.callSystemAction("pushRemoveExpiredEndpoints", { endpoints: expiredEndpoints });
    } catch (err) {
      console.error("CLEANUP EXPIRED PUSH ERROR:", err && err.message);
    }
  }

  return { sent: sent, failed: failed };
}

// Gọi SAU KHI write.js đã nhận kết quả SUCCESS từ Apps Script.
// Không bao giờ throw ra ngoài - lỗi gửi push không được làm hỏng
// phản hồi của thao tác nghiệp vụ chính (P3: fire-and-forget,
// nhưng ở phía SERVER thay vì phía trình duyệt như v1.6).
async function notifyAfterCommit(action, result, actorName) {
  try {
    var notif = buildEventNotification_(action, result, actorName);
    if (!notif) return;

    await sendToAllSubscriptions_(notif.title, notif.body);
  } catch (err) {
    console.error("notifyAfterCommit ERROR:", err && err.message);
  }
}

// Thông báo thủ công do Admin/Owner soạn (đã được xác thực role ở
// api/push/broadcast.js trước khi gọi hàm này).
async function sendBroadcast(title, body) {
  return sendToAllSubscriptions_(String(title || "").slice(0, 200), String(body || "").slice(0, 500));
}

module.exports = { notifyAfterCommit: notifyAfterCommit, sendBroadcast: sendBroadcast };

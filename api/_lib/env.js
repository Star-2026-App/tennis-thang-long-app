// ======================================================
// _lib/env.js (v2.0)
// ======================================================
//
// Đọc toàn bộ biến môi trường (Environment Variables) của Vercel
// ở MỘT nơi duy nhất. KHÔNG bao giờ có secret nào trong code
// frontend - toàn bộ nằm ở đây, chỉ tồn tại trên server Vercel.
//
// Cần khai báo trên Vercel (Project Settings > Environment
// Variables):
//   APPS_SCRIPT_URL              - URL /exec của Apps Script Web App
//   APPS_SCRIPT_CLAIM_SECRET     - PHẢI khớp Script Property cùng tên
//   SESSION_COOKIE_SECRET        - chuỗi ngẫu nhiên dài, ký cookie phiên
//   VAPID_PUBLIC_KEY              - khoá công khai Web Push
//   VAPID_PRIVATE_KEY             - khoá riêng Web Push
//   VAPID_CONTACT_EMAIL           - (tuỳ chọn) mailto:...
//   APPS_SCRIPT_TIMEOUT_MS         - (tuỳ chọn) timeout mỗi lượt gọi
//                                    Apps Script; mặc định 40000ms
//                                    (v2.1.2 FIX 04/09/2026 - xem ghi
//                                    chú tại appsScriptTimeoutMs bên
//                                    dưới: tăng từ 25000ms vì mỗi lượt
//                                    gọi giờ luôn tốn thêm 1 chặng
//                                    round-trip mạng cho redirect
//                                    script.googleusercontent.com)
// ======================================================

function required_(name) {
  var value = process.env[name];

  if (!value) {
    var err = new Error(
      "Server chưa cấu hình biến môi trường " + name + " (Vercel > Project Settings > Environment Variables)."
    );
    err.isConfigError = true;
    throw err;
  }

  return value;
}

function optionalInt_(name, fallback, min, max) {
  var parsed = parseInt(process.env[name], 10);
  if (!isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

module.exports = {
  appsScriptUrl: function () { return required_("APPS_SCRIPT_URL"); },
  claimSecret: function () { return required_("APPS_SCRIPT_CLAIM_SECRET"); },
  sessionCookieSecret: function () { return required_("SESSION_COOKIE_SECRET"); },
  vapidPublicKey: function () { return process.env.VAPID_PUBLIC_KEY || ""; },
  vapidPrivateKey: function () { return process.env.VAPID_PRIVATE_KEY || ""; },
  vapidContactEmail: function () { return process.env.VAPID_CONTACT_EMAIL || "mailto:admin@example.com"; },
  // (v2.1.2 FIX 04/09/2026) Nâng mặc định 25000ms -> 40000ms và trần
  // cho phép 30000ms -> 45000ms. Log Apps Script Executions thực tế
  // cho thấy bản thân script CHƯA BAO GIỜ chạy quá ~15s (không phải
  // lỗi code chậm), nhưng từ khi vá lỗi redirect 502 (04/09/2026),
  // mỗi lượt gọi ghi (action cần lock) luôn tốn thêm 1 chặng round-
  // trip mạng riêng để lấy nội dung ở script.googleusercontent.com -
  // cộng dồn độ trễ mạng của cả 2 chặng vào cùng 15s thực thi thỉnh
  // thoảng vượt ngưỡng 25s cũ dù script không hề chậm. Vẫn giữ dưới
  // ngưỡng cứng ~60s của trình duyệt.
  appsScriptTimeoutMs: function () { return optionalInt_("APPS_SCRIPT_TIMEOUT_MS", 40000, 5000, 45000); },
  cookieName: "tlt_session",
  sessionTtlHours: 12
};

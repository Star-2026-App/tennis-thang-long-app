// ======================================================
// CONFIG.JS (v2.0)
// ======================================================
//
// THAY ĐỔI LỚN NHẤT so với v1.6: KHÔNG còn GOOGLE_SCRIPT_URL và
// KHÔNG còn API_TOKEN trong frontend (điểm yếu #1/#2 - token và
// URL Apps Script từng lộ nguyên văn trong DevTools/lịch sử trình
// duyệt qua JSONP). Trình duyệt giờ CHỈ gọi các đường dẫn same-
// origin "/api/..." (Vercel BFF) kèm session cookie HttpOnly - xem
// js/api.js (callBackendAction_/callBackendRead_) và js/auth.js.
//
// URL Apps Script thật + mọi secret (APPS_SCRIPT_CLAIM_SECRET,
// SESSION_COOKIE_SECRET, VAPID_PRIVATE_KEY...) giờ CHỈ tồn tại
// trong Environment Variables của Vercel (xem
// frontend/api/_lib/env.js) - không nơi nào trong code frontend
// này có thể đọc được các giá trị đó.
// ======================================================

// ======================================================
// PUSH NOTIFICATION (v2.0)
//
// VAPID_PUBLIC_KEY: khoá công khai dùng để trình duyệt tạo Push
// Subscription - KHÔNG phải bí mật, an toàn khi để lộ trong code
// frontend (khoá riêng VAPID_PRIVATE_KEY chỉ nằm ở Environment
// Variables trên Vercel, không bao giờ xuất hiện ở đây).
//
// PHẢI khớp với giá trị VAPID_PUBLIC_KEY đã cấu hình trên Vercel -
// nếu đổi cặp khoá VAPID, phải cập nhật lại giá trị này.
// ======================================================
const VAPID_PUBLIC_KEY = "BMJjag_XlNBSNCQFWurhaht0LlSlhayeG-uezHcjLV12_02_OInIYLh_KxX660qYMDS8rLrqNLCfeahFwgG1s6o";

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwbPZaEG-qqUB-pN49zMts278NJ5AhIFRukDzUnNMn-mTEgPcwiLOI_9DEkhK7cUlBRGw/exec";

// ======================================================
// API_TOKEN (v1.5)
//
// Giá trị này PHẢI khớp với "API_SECRET" đã set trong d
// Script Properties của Apps Script (Project Settings >
// Script Properties). Đổi giá trị bên dưới thì cũng phải
// đổi lại giá trị API_SECRET tương ứng ở backend.
// ======================================================
const API_TOKEN = "e330c8170c3cafb385ebdafaf321d324cfc0ccbf1083ff99";

// ======================================================
// PUSH NOTIFICATION (v1.6)
//
// VAPID_PUBLIC_KEY: khoá công khai dùng để trình duyệt tạo
// Push Subscription - KHÔNG phải bí mật, an toàn khi để lộ
// trong code frontend (khoá riêng tương ứng chỉ nằm ở biến
// môi trường VAPID_PRIVATE_KEY trên Vercel, không bao giờ
// xuất hiện ở đây).
//
// PUSH_API_ENDPOINT: API gửi push, nằm CÙNG domain Vercel
// đang deploy frontend này (file api/send-push.js ở gốc
// repo) - để trống "/api/send-push" là dùng đường dẫn
// tương đối, không cần sửa khi đổi domain.
// ======================================================
const VAPID_PUBLIC_KEY = "BMJjag_XlNBSNCQFWurhaht0LlSlhayeG-uezHcjLV12_02_OInIYLh_KxX660qYMDS8rLrqNLCfeahFwgG1s6o";
const PUSH_API_ENDPOINT = "/api/send-push";

// ======================================================
// _lib/cookies.js (v2.0)
// ======================================================
//
// Đọc/ghi cookie thủ công (không thêm dependency ngoài) - đủ dùng
// cho 1 cookie phiên đăng nhập duy nhất.
// ======================================================

function parseCookies(req) {
  var header = (req.headers && req.headers.cookie) || "";
  var result = {};

  header.split(";").forEach(function (part) {
    var idx = part.indexOf("=");
    if (idx === -1) return;

    var key = part.slice(0, idx).trim();
    var value = part.slice(idx + 1).trim();

    if (!key) return;

    try {
      result[key] = decodeURIComponent(value);
    } catch (err) {
      result[key] = value;
    }
  });

  return result;
}

// options: { maxAgeSeconds, clear }
function serializeCookie(name, value, options) {
  options = options || {};

  var parts = [
    encodeURIComponent(name) + "=" + encodeURIComponent(value || ""),
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict"
  ];

  if (options.clear) {
    parts.push("Max-Age=0");
  } else if (options.maxAgeSeconds) {
    parts.push("Max-Age=" + Math.floor(options.maxAgeSeconds));
  }

  return parts.join("; ");
}

module.exports = { parseCookies: parseCookies, serializeCookie: serializeCookie };

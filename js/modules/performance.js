// ============================================================================
// js/modules/performance.js — Module "Điểm Phong độ"
// File MỚI. Đã đối chiếu lại với source thật (js/api.js, js/ui.js, js/state.js,
// js/modules/cup.js, api/data/[type].js) — không còn chỗ nào là suy đoán.
//
// Quy ước tuân theo ĐÚNG như module CUP đã có:
//   - Hook mở tab: activatePerfTab_() (gọi từ switchTab() trong js/ui.js,
//     giống hệt cách 'cup' gọi activateCupTab_()).
//   - Đọc dữ liệu: callBackendRead_(path) — hàm CHUNG có sẵn ở js/api.js,
//     tự xử lý cookie/lỗi mạng/status !== "SUCCESS", trả thẳng .result.
//     KHÔNG tự viết fetch() riêng.
//   - Danh sách thành viên: biến toàn cục `members` (js/state.js), lọc
//     `member.isActive !== false` — đúng dòng cup.js:451 đang dùng.
//   - Định danh người chơi: dùng STT (member.stt), không dùng tên — khớp với
//     cách Matches/Members nối với nhau qua STT trong toàn hệ thống.
//   - Session hiện tại: `loggedInMemberStt`, `loggedInMemberName`,
//     `currentUserRole` — 3 biến toàn cục thật ở js/state.js.
//   - Ẩn/hiện theo quyền: class `.admin-only`/`.owner-only` +
//     applyRolePermissions() có sẵn ở js/auth.js.
// ============================================================================

var PerfModuleState_ = {
  initialized: false,
  targetStt: 0,           // STT thành viên đang xem (mặc định = chính mình)
  // (mở rộng 06/09/2026 - theo yêu cầu Star) Mặc định 'month' — dùng luôn dữ
  // liệu nhẹ perfGetMonthlyBase (đã tải cho ô "Điểm Base") để vẽ, KHÔNG cần
  // tải lịch sử chi tiết từng trận. Chỉ khi người dùng chủ động bấm "Theo
  // ngày"/"Theo tuần" mới tải rawHistory (đầy đủ, nặng hơn) — xem perfSetGranularity.
  granularity: 'month',   // 'day' | 'week' | 'month'
  rawHistory: [],         // [{matchId, date, yearMonth, deltaStep, displayLevel}, ...]
  rawHistoryLoadedForStt: 0, // STT đã tải rawHistory gần nhất (0 = chưa tải cho ai) — tránh tải lại thừa
  chartInstance: null,
  // Điểm Base hiện tại + Điểm Base đã chốt theo từng tháng
  currentBase: null,      // number|null — Điểm Base thật đang có trong Members
  monthlyBase: []         // [{yearMonth, baseBefore, baseAfter}, ...] tăng dần theo thời gian
};

/**
 * Gọi khi người dùng mở tab "Phong độ" lần đầu — hook đặt trong switchTab()
 * ở js/ui.js, ngay dưới nhánh 'cup':
 *
 *   if (tabId === 'perf' && typeof activatePerfTab_ === 'function') {
 *       activatePerfTab_();
 *   }
 */
function activatePerfTab_() {
  if (!PerfModuleState_.initialized) {
    PerfModuleState_.initialized = true;
    PerfModuleState_.targetStt = loggedInMemberStt || 0;
    perfRenderMemberSelector_();
    // (mới 06/09/2026) Chỉ cần gắn listener 1 lần lúc khởi tạo — Owner có thể
    // kéo giãn/thu nhỏ cửa sổ trình duyệt qua lại mốc 768px trong lúc đang mở
    // tab, nên phải tính lại quyền xem ngày/tuần mỗi khi resize, không chỉ lúc
    // mở tab lần đầu (giống quy ước queueEnhance đã dùng ở index.html).
    window.addEventListener('resize', perfApplyGranularityVisibility_, { passive: true });
  }
  // (mở rộng 06/09/2026) CHỈ tải perfGetMonthlyBase (nhẹ) lúc mở tab — đủ để
  // vẽ chart mặc định "Theo tháng" luôn (xem perfLoadMonthlyBase_). Lịch sử
  // chi tiết từng trận (rawHistory, nặng hơn) chỉ tải khi người dùng chủ động
  // bấm "Theo ngày"/"Theo tuần" — xem perfSetGranularity.
  perfLoadMonthlyBase_();
  perfApplyGranularityVisibility_(); // (mới 06/09/2026) ẩn/hiện nút ngày/tuần theo quyền TRƯỚC khi tô màu nút
  perfUpdateGranularityButtons_(); // tô xanh đúng nút "Theo tháng" ngay từ đầu, không cần chờ API
}

/**
 * (mới 06/09/2026 - yêu cầu Star mục 2, ĐỔI Ý so với bản đầu): biểu đồ
 * "Theo ngày"/"Theo tuần" giờ CHỈ dành cho Owner (là Star), và CHỈ trên bản
 * Desktop — lý do Star nêu: "cần check xem hoạt động của function của app có
 * chuẩn không". Member/Admin (kể cả Admin đang xem người khác) chỉ còn thấy
 * "Theo tháng" vì họ chỉ quan tâm Điểm Base đã chốt, không cần xem hằng ngày.
 *
 * Đây CHỈ là lớp ẩn/hiện UI (ẩn nút bấm) — bảo vệ THẬT nằm ở backend
 * (perfGetHistory đã gate `actor.role !== 'owner'` ở PerfQueryService.txt),
 * nên dù ai đó cố tình gọi thẳng API cũng không lấy được dữ liệu.
 *
 * Dùng chung quy ước "Desktop" đã có sẵn trong code (index.html dòng ~2913):
 * window.matchMedia('(min-width: 768px)').matches.
 *
 * Nếu người dùng đang xem "Theo ngày"/"Theo tuần" mà MẤT quyền giữa chừng
 * (ví dụ Owner thu nhỏ cửa sổ xuống dưới 768px) -> tự động chuyển về "Theo
 * tháng" (không để lại UI hiển thị 1 chart mà nút chọn nó đã bị ẩn).
 */
function perfApplyGranularityVisibility_() {
  var eligible = currentUserRole === 'owner' && window.matchMedia('(min-width: 768px)').matches;

  document.querySelectorAll('.perf-owner-only-granularity').forEach(function (btn) {
    btn.classList.toggle('hidden', !eligible);
  });

  if (!eligible && PerfModuleState_.granularity !== 'month') {
    perfSetGranularity('month');
  }
}

/**
 * (mới 06/09/2026) Tô đậm (xanh) đúng nút granularity đang được chọn, để
 * người dùng biết đang xem theo thang đo nào — dựa vào thuộc tính
 * data-granularity gắn sẵn trên mỗi nút trong index.html.
 */
function perfUpdateGranularityButtons_() {
  document.querySelectorAll('.perf-granularity-btn').forEach(function (btn) {
    var isActive = btn.getAttribute('data-granularity') === PerfModuleState_.granularity;
    btn.classList.toggle('bg-emerald-600', isActive);
    btn.classList.toggle('text-white', isActive);
    btn.classList.toggle('border-emerald-600', isActive);
  });
}

/**
 * Dựng dropdown "Xem phong độ của...". Member thường không thấy dropdown này
 * (chỉ xem của chính mình) — Admin/Owner mới thấy để chọn người khác, đúng
 * quyết định đã chốt với Star. Ẩn/hiện UI qua class admin-only/owner-only
 * (bảo vệ THẬT nằm ở perfAssertCanViewMember_ phía backend).
 */
function perfRenderMemberSelector_() {
  var container = document.getElementById('perf-member-selector');
  if (!container) return; // khối #tab-perf chưa dựng UI này -> bỏ qua, không throw

  var isAdminOrOwner = currentUserRole === 'admin' || currentUserRole === 'owner';

  if (!isAdminOrOwner) {
    container.innerHTML = '';
    return;
  }

  var activeMembers = (members || []).filter(function (m) { return m && m.isActive !== false; });

  var options = activeMembers.map(function (m) {
    var stt = parseInt(m.stt);
    var selected = stt === PerfModuleState_.targetStt ? ' selected' : '';
    return '<option value="' + stt + '"' + selected + '>' + perfEscapeHtml_(m.name) + '</option>';
  }).join('');

  container.innerHTML =
    '<label for="perf-member-select">Xem phong độ của:</label>' +
    '<select id="perf-member-select" class="admin-only owner-only">' + options + '</select>';

  document.getElementById('perf-member-select').addEventListener('change', function (e) {
    PerfModuleState_.targetStt = parseInt(e.target.value) || 0;
    // (mở rộng 06/09/2026) Đổi thành viên -> rawHistory (nếu có) là của người
    // CŨ, không còn dùng được -> đánh dấu chưa tải để lần tới cần tới "Theo
    // ngày"/"Theo tuần" sẽ tự tải lại đúng người mới (xem perfSetGranularity).
    PerfModuleState_.rawHistory = [];
    PerfModuleState_.rawHistoryLoadedForStt = 0;
    perfLoadMonthlyBase_(); // nhẹ — luôn tải, phục vụ cả ô "Điểm Base" lẫn chart "Theo tháng"
    if (PerfModuleState_.granularity !== 'month') {
      perfSetGranularity(PerfModuleState_.granularity); // đang xem ngày/tuần -> tải lại rawHistory cho đúng người mới
    }
  });
}

/**
 * (mới 06/09/2026) Tải Điểm Base hiện tại + Điểm Base đã chốt theo từng tháng
 * của PerfModuleState_.targetStt, đổ vào ô "Điểm Base" + dropdown chọn tháng.
 * Đây cũng là NGUỒN DỮ LIỆU cho chart khi granularity='month' (nhẹ hơn nhiều
 * so với tải lịch sử chi tiết từng trận) — nên sau khi tải xong, nếu đang ở
 * chế độ "Theo tháng" thì vẽ lại chart luôn từ đây, không cần rawHistory.
 */
function perfLoadMonthlyBase_() {
  if (!PerfModuleState_.targetStt) return;
  var panel = document.getElementById('perf-base-panel');
  if (!panel) return; // khối #tab-perf chưa dựng UI này -> bỏ qua, không throw

  callBackendRead_('/api/data/performance?scope=monthlyBase&targetStt=' + PerfModuleState_.targetStt)
    .then(function (result) {
      PerfModuleState_.currentBase = (result && result.currentBase != null) ? result.currentBase : null;
      PerfModuleState_.monthlyBase = (result && result.months) || [];
      perfRenderBaseSelector_();
      if (PerfModuleState_.granularity === 'month') {
        perfRenderChart_();
      }
    })
    .catch(function (err) {
      // Không dùng perfShowError_ chung với chart — lỗi ở đây không nghiêm
      // trọng bằng lỗi tải biểu đồ, chỉ log để không đè mất thông báo lỗi
      // (nếu có) của luồng tải chart.
      console.error('perfLoadMonthlyBase_ error:', err);
    });
}

/**
 * Dựng dropdown chọn tháng cho ô "Điểm Base" — option đầu luôn là "Hiện tại"
 * (giá trị Điểm Base thật đang có trong Members ngay lúc này), các option sau
 * là từng tháng đã CHỐT (theo đúng thứ tự tăng dần), hiển thị BaseAfter của
 * tháng đó — đúng giá trị đã "khoá" tại thời điểm chốt tháng, không đổi ngược
 * dù Điểm Base thật sau đó có biến động tiếp ở các tháng kế tiếp.
 */
function perfRenderBaseSelector_() {
  var select = document.getElementById('perf-base-month-select');
  var valueEl = document.getElementById('perf-base-value');
  if (!select || !valueEl) return;

  var options = ['<option value="current">Hiện tại</option>'];
  PerfModuleState_.monthlyBase.forEach(function (m) {
    options.push('<option value="' + perfEscapeHtml_(m.yearMonth) + '">' + perfEscapeHtml_(m.yearMonth) + '</option>');
  });
  select.innerHTML = options.join('');
  select.value = 'current';

  valueEl.textContent = perfFormatBaseValue_(PerfModuleState_.currentBase);

  // Gán onchange (không addEventListener) để tránh cộng dồn listener mỗi lần
  // perfRenderBaseSelector_ được gọi lại (đổi thành viên xem, tải lại...).
  select.onchange = function () {
    if (select.value === 'current') {
      valueEl.textContent = perfFormatBaseValue_(PerfModuleState_.currentBase);
      return;
    }
    // (fix 06/09/2026 - theo đúng ngữ nghĩa Star chốt): "Điểm Base của tháng X"
    // = giá trị ÁP DỤNG SUỐT tháng X (BaseBefore của dòng chốt tháng X) — tức
    // đúng bằng giá trị đã chốt CUỐI tháng (X-1). KHÔNG dùng BaseAfter (đó là
    // giá trị đã trở thành Điểm Base của tháng KẾ TIẾP, không phải của chính
    // tháng X).
    var found = PerfModuleState_.monthlyBase.filter(function (m) { return m.yearMonth === select.value; })[0];
    valueEl.textContent = found ? perfFormatBaseValue_(found.baseBefore) : '--';
  };
}

/**
 * (mới 06/09/2026 - yêu cầu Star) Định dạng Điểm Base hiển thị LUÔN đúng 3
 * chữ số sau dấu phẩy (ví dụ 6,252) — trước đây hiển thị số thô nên số 0 ở
 * cuối bị JS tự cắt (6.40 -> hiện "6.4"), và dấu phân cách thập phân là "."
 * kiểu Mỹ thay vì "," quen thuộc với người Việt. Backend đã làm tròn đúng 3
 * chữ số khi ghi (PERF_DISPLAY_PRECISION_, PerfCalcService.txt) — hàm này chỉ
 * lo phần HIỂN THỊ, không đổi giá trị thật.
 */
function perfFormatBaseValue_(value) {
  if (value == null || isNaN(value)) return '--';
  return Number(value).toFixed(3).replace('.', ',');
}

/**
 * Đổi granularity (ngày/tuần/tháng).
 *
 * (mở rộng 06/09/2026 - theo yêu cầu Star, giảm tải dữ liệu mặc định):
 * 'month' luôn vẽ được ngay từ PerfModuleState_.monthlyBase đã có sẵn (nhẹ,
 * tải từ lúc mở tab) — KHÔNG gọi API. 'day'/'week' cần lịch sử chi tiết từng
 * trận (rawHistory, nặng hơn — quét toàn bộ PerformanceHistory của thành
 * viên) — CHỈ tải khi người dùng thật sự bấm sang 1 trong 2 chế độ này, và
 * chỉ tải nếu chưa có sẵn đúng cho thành viên đang xem
 * (rawHistoryLoadedForStt) — tránh gọi lại API thừa khi bấm qua lại "Theo
 * ngày" <-> "Theo tuần" nhiều lần.
 */
function perfSetGranularity(granularity) {
  PerfModuleState_.granularity = granularity;
  perfUpdateGranularityButtons_();

  if (granularity === 'month') {
    perfRenderChart_();
    return;
  }

  if (PerfModuleState_.rawHistoryLoadedForStt === PerfModuleState_.targetStt) {
    perfRenderChart_();
    return;
  }

  perfShowError_(''); // xoá lỗi cũ (nếu có) trước lượt tải mới
  perfShowLoadingState_(true);

  callBackendRead_('/api/data/performance?scope=history&targetStt=' + PerfModuleState_.targetStt)
    .then(function (result) {
      PerfModuleState_.rawHistory = (result && result.history) || [];
      PerfModuleState_.rawHistoryLoadedForStt = PerfModuleState_.targetStt;
      perfShowLoadingState_(false);
      perfRenderChart_();
    })
    .catch(function (err) {
      perfShowLoadingState_(false);
      perfShowError_((err && err.message) || 'Không tải được dữ liệu phong độ.');
    });
}

/**
 * Vẽ chart bằng Chart.js. 'month' lấy thẳng từ monthlyBase (Điểm Base đã
 * CHỐT mỗi tháng — xem perfLoadMonthlyBase_); 'day'/'week' gộp từ rawHistory
 * (lịch sử chi tiết từng trận) qua perfAggregateHistory_.
 * 'day': mỗi trận 1 điểm (dùng đúng displayLevel tại thời điểm đó).
 * 'week': trung bình cộng displayLevel của các trận trong tuần.
 */
function perfRenderChart_() {
  // (fix 06/09/2026) dùng baseBefore — xem giải thích ngữ nghĩa ở perfRenderBaseSelector_.
  var points = PerfModuleState_.granularity === 'month'
    ? PerfModuleState_.monthlyBase.map(function (m) { return { label: m.yearMonth, value: m.baseBefore }; })
    : perfAggregateHistory_(PerfModuleState_.rawHistory, PerfModuleState_.granularity);
  var canvas = document.getElementById('perf-chart-canvas');
  if (!canvas || typeof Chart === 'undefined') return; // Chart.js chưa tải xong/chưa có canvas -> bỏ qua

  if (PerfModuleState_.chartInstance) {
    PerfModuleState_.chartInstance.destroy();
  }

  PerfModuleState_.chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: points.map(function (p) { return p.label; }),
      datasets: [{
        label: 'Điểm phong độ',
        data: points.map(function (p) { return p.value; }),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.25,
        pointRadius: 3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 100, // (fix 05/09/2026) debounce resize để tránh vòng lặp resize dội lại khi đổi granularity
      scales: {
        y: {
          title: { display: true, text: 'Điểm phong độ' }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

/**
 * Gộp rawHistory theo granularity — chỉ dùng cho 'day'/'week' (từ 06/09/2026,
 * 'month' lấy thẳng từ monthlyBase trong perfRenderChart_, không qua đây nữa).
 *
 * @param {Array<Object>} history [{date, displayLevel, yearMonth}, ...] đã sắp theo thời gian
 * @param {string} granularity 'day' | 'week'
 * @return {Array<{label:string, value:number}>}
 */
function perfAggregateHistory_(history, granularity) {
  if (!history || history.length === 0) return [];
  if (granularity === 'day') {
    return history.map(function (h) { return { label: h.date, value: h.displayLevel }; });
  }

  // granularity === 'week'
  var groups = {}; // key -> [displayLevel, ...]
  var order = [];
  history.forEach(function (h) {
    var key = perfWeekKeyOf_(h.date);
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(h.displayLevel);
  });

  return order.map(function (key) {
    var values = groups[key];
    var avg = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
    // (mở rộng 06/09/2026) 3 chữ số thập phân, khớp PERF_DISPLAY_PRECISION_ backend.
    return { label: key, value: Math.round(avg * 1000) / 1000 };
  });
}

/** Tính "tuần" đơn giản theo số tuần trong năm, dùng cho gộp granularity='week'. */
function perfWeekKeyOf_(dateStr) {
  var m = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return dateStr;
  var d = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  var firstJan = new Date(d.getFullYear(), 0, 1);
  var week = Math.ceil((((d - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);
  return 'Tuần ' + week + '/' + d.getFullYear();
}

function perfShowLoadingState_(isLoading) {
  var el = document.getElementById('perf-loading');
  if (el) el.style.display = isLoading ? 'block' : 'none';
}

function perfShowError_(message) {
  var el = document.getElementById('perf-error');
  if (!el) { if (message) console.error(message); return; }
  if (!message) { el.style.display = 'none'; el.textContent = ''; return; }
  el.style.display = 'block';
  el.textContent = message;
}

function perfEscapeHtml_(str) {
  var div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

/**
 * Ẩn/hiện mọi phần tử `.perf-nav-entry` (nút tab desktop/mobile/moreSheet)
 * theo `systemSettings.performanceModuleEnabled`. Được gọi tự động từ
 * applyRolePermissions() (js/auth.js) — đúng ĐÚNG chỗ syncCupNavVisibility()
 * đã được gọi — nên tự chạy lại sau đăng nhập, sau bootstrap/sync dữ liệu,
 * và sau khi Owner lưu Cài Đặt, không cần thêm móc riêng ở từng nơi.
 */
function perfSyncNavVisibility_() {
  var visible = typeof systemSettings !== 'undefined' && systemSettings.performanceModuleEnabled === true;
  document.querySelectorAll('.perf-nav-entry').forEach(function (el) {
    el.classList.toggle('hidden', !visible);
  });
}
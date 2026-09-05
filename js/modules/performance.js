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
  granularity: 'day',     // 'day' | 'week' | 'month'
  rawHistory: [],         // [{matchId, date, yearMonth, deltaStep, displayLevel}, ...]
  chartInstance: null
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
  }
  perfLoadAndRenderChart_();
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
    perfLoadAndRenderChart_();
  });
}

/**
 * Tải lịch sử phong độ của PerfModuleState_.targetStt và vẽ lại chart. Tách
 * riêng khỏi activatePerfTab_() để nút đổi thành viên đều gọi lại được.
 */
function perfLoadAndRenderChart_() {
  if (!PerfModuleState_.targetStt) return;

  perfShowError_(''); // xoá lỗi cũ (nếu có) trước lượt tải mới
  perfShowLoadingState_(true);

  callBackendRead_('/api/data/performance?scope=history&targetStt=' + PerfModuleState_.targetStt)
    .then(function (result) {
      PerfModuleState_.rawHistory = (result && result.history) || [];
      perfShowLoadingState_(false);
      perfRenderChart_();
    })
    .catch(function (err) {
      perfShowLoadingState_(false);
      perfShowError_((err && err.message) || 'Không tải được dữ liệu phong độ.');
    });
}

/** Đổi granularity (ngày/tuần/tháng) — chỉ tính lại ở trình duyệt, không gọi lại API. */
function perfSetGranularity(granularity) {
  PerfModuleState_.granularity = granularity;
  perfRenderChart_();
}

/**
 * Gộp dữ liệu thô theo granularity đã chọn, rồi vẽ bằng Chart.js.
 * 'day': mỗi trận 1 điểm (dùng đúng displayLevel tại thời điểm đó).
 * 'week'/'month': trung bình cộng displayLevel của các trận trong kỳ.
 */
function perfRenderChart_() {
  var points = perfAggregateHistory_(PerfModuleState_.rawHistory, PerfModuleState_.granularity);
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
 * @param {Array<Object>} history [{date, displayLevel, yearMonth}, ...] đã sắp theo thời gian
 * @param {string} granularity 'day' | 'week' | 'month'
 * @return {Array<{label:string, value:number}>}
 */
function perfAggregateHistory_(history, granularity) {
  if (!history || history.length === 0) return [];
  if (granularity === 'day') {
    return history.map(function (h) { return { label: h.date, value: h.displayLevel }; });
  }

  var groups = {}; // key -> [displayLevel, ...]
  var order = [];
  history.forEach(function (h) {
    var key = granularity === 'month' ? h.yearMonth : perfWeekKeyOf_(h.date);
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(h.displayLevel);
  });

  return order.map(function (key) {
    var values = groups[key];
    var avg = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
    return { label: key, value: Math.round(avg * 100) / 100 };
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

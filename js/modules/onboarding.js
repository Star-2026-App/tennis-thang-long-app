// ======================================================
// ONBOARDING TOUR (v1.7)
//
// Bong bóng hướng dẫn kiểu "coachmark" cuốn chiếu từng bước,
// chỉ vào từng nút cụ thể trên bottom nav mới - giúp thành
// viên cũ không bị lạc khi giao diện đổi sang bố cục mới.
//
// - Chỉ chạy trên mobile (giao diện mới chỉ áp dụng mobile).
// - Tự động hiện 1 LẦN DUY NHẤT / thiết bị (lưu cờ trong
//   localStorage), có nút "Xem hướng dẫn sử dụng" trong mục
//   "Thêm" để xem lại bất cứ lúc nào.
// - Không dùng overlay tối vẽ riêng: dùng box-shadow khổng lồ
//   trên chính vòng highlight để tạo hiệu ứng spotlight, và
//   1 lớp chặn chạm trong suốt có "lỗ" clip-path đúng vị trí
//   nút đang giới thiệu (để nút đó vẫn bấm thử được).
// ======================================================

const ONBOARDING_STORAGE_KEY = 'tlt_onboarding_seen_v1';

const ONBOARDING_STEPS = [
    {
        selector: '#bn-dashboard',
        radius: 16,
        title: 'Tổng quan',
        desc: 'Xem tổng số tiền cá nhân, chỉ số trong tháng và nhật ký thưởng sân/nộp tiền/trận đấu của bạn tại đây.'
    },
    {
        selector: '#bn-finance',
        radius: 16,
        title: 'Tài chính',
        desc: 'Thưởng sân, Nộp tiền, Đóng quỹ và Bảng tổng kết của cả CLB được gộp chung vào 1 mục để dễ tìm hơn.'
    },
    {
        selector: '#bn-ghinhan',
        radius: 20,
        title: 'Ghi nhận',
        desc: 'Nút nổi này để ghi trận đấu, thưởng sân 16h/18h hoặc đóng quỹ thật nhanh - bấm vào sẽ hiện các lựa chọn.'
    },
    {
        selector: '#bn-cashbook',
        radius: 16,
        title: 'Sổ thu chi',
        desc: 'Theo dõi các khoản thu/chi thực tế của quỹ CLB.'
    },
    {
        selector: '#bn-more',
        radius: 16,
        title: 'Thêm',
        desc: 'Nhật ký trận, Thành viên, Phân tích, Quy định, Cài đặt, Tài khoản và Đăng xuất đều nằm ở đây.'
    },
    {
        selector: '#notifBellBtn',
        radius: 9999,
        title: 'Thông báo',
        desc: 'Bấm chuông để bật thông báo đẩy - nhận tin ngay khi có ai ghi nhận thưởng sân, đóng quỹ hay trận đấu mới.'
    }
];

let onbStepIndex_ = 0;
let onbResizeHandlerBound_ = false;


function hasSeenOnboarding_() {

    try {
        return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
    } catch (err) {
        return true; // không đọc được localStorage -> coi như đã xem, tránh phiền
    }
}


function markOnboardingSeen_() {

    try {
        window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    } catch (err) {
        console.warn('ONBOARDING SAVE ERROR:', err);
    }
}


// ======================================================
// BẮT ĐẦU TOUR (tự động sau đăng nhập lần đầu, hoặc xem lại
// thủ công qua mục "Thêm")
// ======================================================

function startOnboardingTour() {

    if (window.innerWidth >= 768) return; // giao diện mới chỉ áp dụng mobile

    onbStepIndex_ = 0;

    let blocker = document.getElementById('onbClickBlocker');
    let ring = document.getElementById('onbHighlightRing');
    let tooltip = document.getElementById('onbTooltip');

    if (!blocker || !ring || !tooltip) return;

    blocker.classList.remove('hidden');
    ring.classList.remove('hidden');
    tooltip.classList.remove('hidden');

    if (!onbResizeHandlerBound_) {

        window.addEventListener('resize', function() {

            if (!ring.classList.contains('hidden')) {
                showOnboardingStep_(onbStepIndex_);
            }
        });

        onbResizeHandlerBound_ = true;
    }

    showOnboardingStep_(0);
}


function maybeAutoStartOnboarding_() {

    if (hasSeenOnboarding_()) return;
    if (window.innerWidth >= 768) return;

    // Đợi layout ổn định (đăng nhập xong, bottom nav đã render)
    // trước khi đo vị trí các nút để chỉ bong bóng vào đúng chỗ.
    setTimeout(function() {
        startOnboardingTour();
    }, 700);
}


function replayOnboardingTour() {

    if (typeof closeMoreSheet === 'function') closeMoreSheet();

    setTimeout(function() {
        startOnboardingTour();
    }, 250); // đợi sheet "Thêm" đóng lại hẳn trước khi mở tour
}


// ======================================================
// HIỂN THỊ 1 BƯỚC CỤ THỂ
// ======================================================

function showOnboardingStep_(index) {

    let step = ONBOARDING_STEPS[index];

    if (!step) {
        finishOnboardingTour();
        return;
    }

    let target = document.querySelector(step.selector);

    if (!target) {
        // Nút không tồn tại (VD DOM thay đổi) -> bỏ qua bước này, không kẹt tour.
        onbStepIndex_ = index + 1;
        showOnboardingStep_(onbStepIndex_);
        return;
    }

    onbStepIndex_ = index;

    positionHighlight_(target, step.radius);

    document.getElementById('onbStepTitle').innerText = step.title;
    document.getElementById('onbStepDesc').innerText = step.desc;

    document.getElementById('onbNextBtn').innerText =
        (index === ONBOARDING_STEPS.length - 1) ? 'Xong' : 'Tiếp theo';

    renderOnboardingDots_(index);

    positionTooltip_(target);
}


function renderOnboardingDots_(activeIndex) {

    let dotsEl = document.getElementById('onbStepDots');
    if (!dotsEl) return;

    dotsEl.innerHTML = ONBOARDING_STEPS.map(function(_, i) {

        let activeClass = (i === activeIndex) ? 'bg-emerald-700' : 'bg-slate-200';
        return '<span class="w-1.5 h-1.5 rounded-full ' + activeClass + '"></span>';

    }).join('');
}


// ======================================================
// ĐỊNH VỊ VÒNG SPOTLIGHT + LỖ CHẶN CHẠM
// ======================================================

function positionHighlight_(target, radius) {

    let rect = target.getBoundingClientRect();
    let pad = 8;

    let x1 = Math.max(0, rect.left - pad);
    let y1 = Math.max(0, rect.top - pad);
    let x2 = Math.min(window.innerWidth, rect.right + pad);
    let y2 = Math.min(window.innerHeight, rect.bottom + pad);

    let ring = document.getElementById('onbHighlightRing');

    ring.style.left = x1 + 'px';
    ring.style.top = y1 + 'px';
    ring.style.width = (x2 - x1) + 'px';
    ring.style.height = (y2 - y1) + 'px';
    ring.style.borderRadius = radius + 'px';

    let blocker = document.getElementById('onbClickBlocker');

    // "Khoét lỗ" hình chữ nhật (x1,y1)-(x2,y2) khỏi lớp chặn chạm bằng
    // 1 polygon duy nhất (kỹ thuật nối viền ngoài với viền trong qua
    // 1 "khe" chung 1 điểm) - để nút đang giới thiệu vẫn bấm thử được.
    blocker.style.clipPath =
        'polygon(' +
        '0% 0%, 0% 100%, ' +
        x1 + 'px 100%, ' +
        x1 + 'px ' + y1 + 'px, ' +
        x2 + 'px ' + y1 + 'px, ' +
        x2 + 'px ' + y2 + 'px, ' +
        x1 + 'px ' + y2 + 'px, ' +
        x1 + 'px 100%, ' +
        '100% 100%, 100% 0%)';
}


function positionTooltip_(target) {

    let rect = target.getBoundingClientRect();
    let tooltip = document.getElementById('onbTooltip');
    let margin = 14;
    let viewportPad = 12;

    // Đặt tạm để đo chiều cao thật (nội dung mỗi bước dài ngắn khác nhau).
    tooltip.style.left = '-9999px';
    tooltip.style.top = '-9999px';

    let tooltipWidth = tooltip.offsetWidth || 260;
    let tooltipHeight = tooltip.offsetHeight || 140;

    let spaceAbove = rect.top;
    let spaceBelow = window.innerHeight - rect.bottom;
    let placeAbove = spaceAbove > spaceBelow;

    let top = placeAbove
        ? (rect.top - margin - tooltipHeight)
        : (rect.bottom + margin);

    top = Math.max(viewportPad, Math.min(top, window.innerHeight - tooltipHeight - viewportPad));

    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    left = Math.max(viewportPad, Math.min(left, window.innerWidth - tooltipWidth - viewportPad));

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}


// ======================================================
// ĐIỀU HƯỚNG TOUR
// ======================================================

function nextOnboardingStep() {

    let next = onbStepIndex_ + 1;

    if (next >= ONBOARDING_STEPS.length) {
        finishOnboardingTour();
        return;
    }

    showOnboardingStep_(next);
}


function skipOnboardingTour() {
    finishOnboardingTour();
}


function finishOnboardingTour() {

    let blocker = document.getElementById('onbClickBlocker');
    let ring = document.getElementById('onbHighlightRing');
    let tooltip = document.getElementById('onbTooltip');

    if (blocker) blocker.classList.add('hidden');
    if (ring) ring.classList.add('hidden');
    if (tooltip) tooltip.classList.add('hidden');

    markOnboardingSeen_();
}

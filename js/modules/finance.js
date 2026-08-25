function getGocDefaultPerMatch_() {
    let value = parseInt(systemSettings && systemSettings.gocDefaultPerMatch);
    return value > 0 ? value : 10000;
}

function getGocMonthlyCap_() {
    let value = parseInt(systemSettings && systemSettings.gocMonthlyCap);
    return value > 0 ? value : 150000;
}

function getDatePartsFromLogTime_(value) {
    let text = String(value || '').trim();
    let match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

    if (!match) return null;

    return {
        day: parseInt(match[1]) || 0,
        month: parseInt(match[2]) || 0,
        year: parseInt(match[3]) || 0
    };
}

function isLogInMonth_(timeValue, targetMonth, targetYear) {
    let parts = getDatePartsFromLogTime_(timeValue);

    if (!parts) return false;

    return (
        parts.month === parseInt(targetMonth) &&
        parts.year === parseInt(targetYear)
    );
}

// (v2.0 fix - gói 1, mục 3+4) Định dạng ngày giờ CỐ ĐỊNH cho toàn app,
// KHÔNG dùng new Date().toLocaleString('vi-VN')/toLocaleDateString('vi-VN')
// nữa - 2 hàm đó phụ thuộc trình duyệt/thiết bị/phiên bản Chrome nên trả
// về thứ tự trường VÀ cách đệm số 0 KHÁC NHAU tùy máy (đã xác nhận qua
// dữ liệu thực tế: máy cũ ghi "08:34:47 17/8/2026" - giờ trước ngày sau,
// tháng KHÔNG đệm 0; máy/bản Chrome mới ghi "24/08/2026 18:47:52" - ngày
// trước giờ sau, tháng CÓ đệm 0). Chính sự khác biệt đệm số 0 này làm vỡ
// các bộ lọc theo tháng kiểu string.includes(`/${thang}/${nam}`) ở
// dashboard.js/booking.js (thiếu "0" nên không khớp chuỗi đã đệm).
// Từ nay TẤT CẢ nơi tạo "time" mới trong app phải gọi 2 hàm dưới đây -
// luôn ĐÚNG 1 định dạng, tự đệm số 0, không phụ thuộc trình duyệt/locale.
function pad2_(n) {
    n = parseInt(n) || 0;
    return (n < 10 ? "0" : "") + n;
}

// "17/08/2026 08:34:47" - dùng cho các trường "time" đầy đủ ngày+giờ
// (GocLogs, QuyLogs, Bookings, Matches, Rules, Notifications...).
function formatVNDateTime_(date) {
    let d = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
    return (
        pad2_(d.getDate()) + "/" + pad2_(d.getMonth() + 1) + "/" + d.getFullYear() +
        " " +
        pad2_(d.getHours()) + ":" + pad2_(d.getMinutes()) + ":" + pad2_(d.getSeconds())
    );
}

// "17/08/2026" - dùng cho các trường "time" chỉ cần ngày (Cashbook).
function formatVNDateOnly_(date) {
    let d = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
    return pad2_(d.getDate()) + "/" + pad2_(d.getMonth() + 1) + "/" + d.getFullYear();
}

// (v2.0 fix - theo yêu cầu 25/08/2026) HIỂN THỊ "time" luôn GIỜ:PHÚT:GIÂY
// TRƯỚC, ngày/tháng/năm SAU - bất kể chuỗi "time" gốc (lấy từ Sheet, do
// backend Apps Script ghi bằng nowDisplayTime_/Utilities.formatDate) lưu
// theo thứ tự ngày trước hay dòng dữ liệu CŨ (trước khi backend chuẩn
// hoá) lưu theo thứ tự giờ trước - hàm này tự tách riêng phần ngày
// (bằng getDatePartsFromLogTime_ đã có) và phần giờ (regex riêng bên
// dưới) rồi LUÔN ghép lại theo đúng 1 thứ tự cố định, không phụ thuộc
// thứ tự/đệm số 0 của chuỗi gốc. CHỈ dùng cho HIỂN THỊ - không dùng hàm
// này ở bất kỳ đâu tạo dữ liệu gửi lên server (đã có formatVNDateTime_/
// formatVNDateOnly_ riêng cho việc đó).
function formatVNTimeForDisplay_(value) {
    let text = String(value == null ? "" : value).trim();
    if (!text) return text;

    let dateParts = getDatePartsFromLogTime_(text);
    let timeMatch = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);

    // Không tách được cả ngày lẫn giờ (dữ liệu lạ/rỗng) - giữ nguyên
    // chuỗi gốc, tránh làm mất/méo dữ liệu chưa từng gặp.
    if (!dateParts && !timeMatch) return text;

    let datePart = dateParts
        ? pad2_(dateParts.day) + "/" + pad2_(dateParts.month) + "/" + dateParts.year
        : "";

    let timePart = timeMatch
        ? pad2_(timeMatch[1]) + ":" + timeMatch[2] + ":" + (timeMatch[3] || "00")
        : "";

    if (timePart && datePart) return timePart + " " + datePart;
    return timePart || datePart;
}

// (v2.0 fix) "GOC_ADJUSTMENT_HIDE_TAG_": các dòng addGocLogAdjustment
// (số ÂM) do payOutMemberCreditByAdmin() (dashboard.js) tạo ra khi CLB
// trả tiền dư thưởng đặt sân cho thành viên - CHỈ để đưa Dư/Nợ RIÊNG
// của thành viên đó về 0 (vẫn phải cộng đầy đủ ở getUserGocPaidForMonth_
// bên dưới - KHÔNG lọc ở đó), KHÔNG phải tiền thật thành viên nộp vào.
// Dòng tiền thật của khoản trả này đã ghi RIÊNG 1 lần ở Cashbook (mục
// "Tiền thưởng đặt sân"). Theo góp ý của người vận hành CLB: những dòng
// này không nên hiện/tính vào tab "Nộp Tiền" (dành cho tiền thành viên
// NỘP VÀO) hay bất kỳ chỗ nào khác coi GocLogs là tiền thật đã về quỹ -
// dùng getRealGocLogs_() ở TẤT CẢ các chỗ đó (renderGocLogsTab, tổng
// quỹ, lịch sử "Tiền góc thực thu"...), thay vì đọc thẳng biến gocLogs.
var GOC_ADJUSTMENT_HIDE_TAG_ = "[ĐÃ GHI CASHBOOK]";

function getRealGocLogs_() {
    return (gocLogs || []).filter(function(g) {
        return String(g.note || '').indexOf(GOC_ADJUSTMENT_HIDE_TAG_) === -1;
    });
}

function getUserGocPaidForMonth_(memberName, targetMonth, targetYear) {
    // Cố ý dùng thẳng gocLogs (KHÔNG lọc qua getRealGocLogs_) - Dư/Nợ
    // RIÊNG của từng thành viên bắt buộc phải thấy đủ dòng điều chỉnh
    // này thì mới về đúng 0 sau khi được trả tiền dư.
    return (gocLogs || []).reduce(function(sum, log) {

        if (
            String(log.name || '').trim().toLowerCase() ===
                String(memberName || '').trim().toLowerCase() &&
            isLogInMonth_(
                log.time,
                targetMonth,
                targetYear
            )
        ) {

            return sum + (parseInt(log.amount) || 0);
        }

        return sum;

    }, 0);
}

function getUserBookingRewardForMonth_(memberName, targetMonth, targetYear) {

    return (bookingLogs || []).reduce(function(sum, booking) {

        if (
            String(booking.name || '').trim().toLowerCase() ===
                String(memberName || '').trim().toLowerCase() &&
            isLogInMonth_(
                booking.time,
                targetMonth,
                targetYear
            )
        ) {

            return sum + (parseInt(booking.reward) || 0);
        }

        return sum;

    }, 0);
}

// ======================================================
// MONTHLY BALANCE SNAPSHOT
// ======================================================

function getMonthlyBalanceSnapshot_(
    memberName,
    month,
    year
) {
    
        return (window.monthlyBalances || [])
            .find(function(item) {
    
                return (
                    String(item.name || '')
                        .trim()
                        .toLowerCase() ===
    
                    String(memberName || '')
                        .trim()
                        .toLowerCase()
    
                    &&
    
                    parseInt(item.month) ===
                        parseInt(month)
    
                    &&
    
                    parseInt(item.year) ===
                        parseInt(year)
                );
            }) || null;
    }
    
    
    
function mergeMonthlyBalanceSnapshots_(
    snapshots,
    month,
    year
) {

    if (!Array.isArray(snapshots)) {
        return;
    }


    if (!Array.isArray(window.monthlyBalances)) {
        window.monthlyBalances = [];
    }


    let targetMonth =
        parseInt(month);


    let targetYear =
        parseInt(year);


    // Xóa snapshot cũ của đúng kỳ này rồi nạp lại
    // dữ liệu Backend vừa xác nhận.
    window.monthlyBalances =
        window.monthlyBalances
            .filter(function(item) {

                return !(
                    parseInt(item.month) === targetMonth &&
                    parseInt(item.year) === targetYear
                );
            });


    snapshots.forEach(function(item) {

        window.monthlyBalances.push(
            item
        );
    });
}


function getMonthCloseStatusCache_() {

    if (
        !window.monthCloseStatusCache ||
        typeof window.monthCloseStatusCache !== 'object'
    ) {

        window.monthCloseStatusCache = {};
    }


    return window.monthCloseStatusCache;
}


function getMonthCloseStatusKey_(
    month,
    year
) {

    return (
        parseInt(month) +
        "_" +
        parseInt(year)
    );
}


function setMonthCloseStatusLocal_(
    month,
    year,
    isClosed
) {

    let cache =
        getMonthCloseStatusCache_();


    cache[
        getMonthCloseStatusKey_(
            month,
            year
        )
    ] = !!isClosed;
}


function getMonthCloseStatusLocal_(
    month,
    year
) {

    let targetMonth =
        parseInt(month);


    let targetYear =
        parseInt(year);


    let targetPeriod =
        targetYear * 12 +
        (targetMonth - 1);


    // Nếu hệ thống đã có snapshot của một tháng bằng hoặc sau
    // tháng đang xem, thì tháng đang xem thuộc vùng lịch sử đã khóa.
    // Ví dụ đã chốt 8/2026 thì 7/2026 và 8/2026 đều phải khóa.
    let latestClosedPeriod =
        (window.monthlyBalances || [])
            .reduce(function(maxPeriod, item) {

                let itemMonth =
                    parseInt(item.month) || 0;


                let itemYear =
                    parseInt(item.year) || 0;


                if (
                    !itemMonth ||
                    !itemYear
                ) {
                    return maxPeriod;
                }


                let itemPeriod =
                    itemYear * 12 +
                    (itemMonth - 1);


                return Math.max(
                    maxPeriod,
                    itemPeriod
                );
            }, -1);


    if (
        latestClosedPeriod >=
        targetPeriod
    ) {

        setMonthCloseStatusLocal_(
            targetMonth,
            targetYear,
            true
        );

        return true;
    }


    let cache =
        getMonthCloseStatusCache_();


    let key =
        getMonthCloseStatusKey_(
            targetMonth,
            targetYear
        );


    if (
        Object.prototype.hasOwnProperty.call(
            cache,
            key
        )
    ) {

        return (
            cache[key] ===
            true
        );
    }


    return null;
}


function isMonthClosed_(
    month,
    year
) {

    return (
        getMonthCloseStatusLocal_(
            month,
            year
        ) === true
    );
}


// ======================================================
// CHỈ CHO PHÉP CHỐT THÁNG ĐÃ KẾT THÚC
// ======================================================

function isMonthClosePeriodEnded_(
    month,
    year
) {

    let m =
        parseInt(
            month
        );


    let y =
        parseInt(
            year
        );


    if (
        !m ||
        m < 1 ||
        m > 12 ||
        !y
    ) {
        return false;
    }


    let now =
        new Date();


    let selectedPeriod =
        y * 12 +
        (m - 1);


    let currentPeriod =
        now.getFullYear() * 12 +
        now.getMonth();


    return (
        selectedPeriod <
        currentPeriod
    );
}


function isMonthClosePeriodFuture_(
    month,
    year
) {

    let m =
        parseInt(month);


    let y =
        parseInt(year);


    if (
        !m ||
        m < 1 ||
        m > 12 ||
        !y
    ) {
        return false;
    }


    let now =
        new Date();


    let selectedPeriod =
        y * 12 +
        (m - 1);


    let currentPeriod =
        now.getFullYear() * 12 +
        now.getMonth();


    return (
        selectedPeriod >
        currentPeriod
    );
}


// ======================================================
// GET NHẸ - KIỂM TRA TRẠNG THÁI CHỐT THÁNG
// ======================================================

// ======================================================
// v2.0 - thay JSONP (script tag + token trong URL) bằng
// GET /api/data/month-close-status qua callBackendRead_ (fetch
// same-origin, cookie session HttpOnly). Giữ NGUYÊN chữ ký hàm và
// hành vi thử lại (retry) cho các nơi gọi khác không cần sửa.
// ======================================================

function fetchMonthCloseStatusLight_(
    month,
    year,
    callback,
    options
) {

    options =
        options || {};


    let maxAttempts =
        parseInt(
            options.maxAttempts
        ) || 3;


    let retryDelayMs =
        parseInt(
            options.retryDelayMs
        ) || 1200;


    let attempt = 0;
    let finished = false;


    function finish_(
        error,
        result
    ) {

        if (finished) {
            return;
        }


        finished = true;


        if (
            typeof callback ===
            'function'
        ) {

            callback(
                error,
                result
            );
        }
    }


    function applyValidResponse_(
        data
    ) {

        if (
            data &&
            data.isExactClosed === true &&
            Array.isArray(
                data.snapshots
            )
        ) {

            mergeMonthlyBalanceSnapshots_(
                data.snapshots,
                month,
                year
            );
        }


        if (
            data &&
            data.status ===
                'SUCCESS'
        ) {

            setMonthCloseStatusLocal_(
                month,
                year,
                data.isClosed === true
            );
        }
    }


    function runAttempt_() {

        if (finished) {
            return;
        }

        attempt++;

        callBackendRead_(
            '/api/data/month-close-status?month=' +
            encodeURIComponent(month) +
            '&year=' +
            encodeURIComponent(year)
        )

        .then(function(data) {

            if (finished) {

                try {
                    applyValidResponse_(data);
                } catch (e) {
                    console.warn('LATE MONTH CLOSE STATUS RESPONSE:', e);
                }

                return;
            }

            applyValidResponse_(data);
            finish_(null, data);
        })

        .catch(function(err) {

            if (finished) return;

            if (attempt < maxAttempts) {

                setTimeout(runAttempt_, retryDelayMs);
                return;
            }

            finish_(err, null);
        });
    }


    runAttempt_();
}


// ======================================================
// TRẠNG THÁI NÚT CHỐT THÁNG
// ======================================================

function setMonthCloseButtonState_(
    state,
    month,
    year
) {

    let button =
        document.getElementById(
            'btnMonthCloseAdmin'
        );


    if (!button) {
        return;
    }


    let monthSelect =
        document.getElementById(
            'selectFinanceMonth'
        );


    let yearSelect =
        document.getElementById(
            'selectFinanceYear'
        );


    if (
        !monthSelect ||
        !yearSelect
    ) {
        return;
    }


    if (
        parseInt(
            monthSelect.value
        ) !==
            parseInt(month)

        ||

        parseInt(
            yearSelect.value
        ) !==
            parseInt(year)
    ) {

        return;
    }


    if (
        state ===
        'closed'
    ) {

        button.disabled =
            true;


        button.innerHTML =
            '<i class="fa-solid fa-lock"></i> ĐÃ CHỐT';


        button.className =
            'ml-2 px-3 py-2 rounded-lg bg-slate-300 text-slate-600 text-xs font-black cursor-not-allowed';


        button.title =
            `Tháng ${month}/${year} đã được chốt.`;

        return;
    }


    if (
        state ===
        'not_due'
    ) {

        button.disabled =
            true;


        button.innerHTML =
            '<i class="fa-solid fa-clock"></i> CHƯA ĐẾN KỲ CHỐT';


        button.className =
            'ml-2 px-3 py-2 rounded-lg bg-slate-200 text-slate-600 text-xs font-black cursor-not-allowed';


        button.title =
            `Tháng ${month}/${year} chưa kết thúc nên chưa được phép chốt.`;

        return;
    }


    if (
        state ===
        'checking'
    ) {

        button.disabled =
            true;


        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> KIỂM TRA...';


        button.className =
            'ml-2 px-3 py-2 rounded-lg bg-amber-100 text-amber-800 text-xs font-black cursor-wait';


        button.title =
            'Đang kiểm tra trạng thái chốt tháng trên Cloud.';

        return;
    }


    if (
        state ===
        'error'
    ) {

        button.disabled =
            true;


        button.innerHTML =
            '<i class="fa-solid fa-triangle-exclamation"></i> CHƯA KIỂM TRA ĐƯỢC';


        button.className =
            'ml-2 px-3 py-2 rounded-lg bg-amber-200 text-amber-900 text-xs font-black cursor-not-allowed';


        button.title =
            'Không kiểm tra được trạng thái Cloud. Tạm khóa nút để tránh chốt trùng.';

        return;
    }


    button.disabled =
        false;


    button.innerHTML =
        '<i class="fa-solid fa-lock"></i> CHỐT THÁNG';


    button.className =
        'ml-2 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow';


    button.title =
        `Chốt tài chính tháng ${month}/${year}.`;
}


// ======================================================
// POLL SAU KHI GỬI LỆNH CHỐT
// ======================================================

function pollMonthCloseStatus_(
    month,
    year,
    callback
) {

    let maxPolls =
        8;


    let pollCount =
        0;


    function poll_() {

        pollCount++;


        fetchMonthCloseStatusLight_(
            month,
            year,

            function(
                error,
                result
            ) {

                if (
                    !error &&
                    result &&
                    result.isClosed ===
                        true
                ) {

                    callback(
                        true,
                        result
                    );

                    return;
                }


                if (
                    pollCount >=
                    maxPolls
                ) {

                    callback(
                        false,
                        result || null
                    );

                    return;
                }


                setTimeout(
                    poll_,
                    1800
                );
            },

            {
                maxAttempts: 1,
                timeoutMs: 6000,
                retryDelayMs: 500
            }
        );
    }


    poll_();
}


function calculateUserFinanceForMonth(
    memberName,
    targetMonth,
    targetYear
) {

    let totalWins = 0;
    let totalLosses = 0;
    let totalDraws = 0;
    let totalMatchCount = 0;

    let monthMatchCount = 0;

    let monthRegularFee = 0;
    let monthSpecialBetFee = 0;

    let gocDefaultPerMatch =
        getGocDefaultPerMatch_();

    let gocMonthlyCap =
        getGocMonthlyCap_();


    (matches || []).forEach(function(match) {

        let isV1 =
            match.p1_v1 === memberName ||
            match.p2_v1 === memberName;

        let isV2 =
            match.p1_v2 === memberName ||
            match.p2_v2 === memberName;


        if (!isV1 && !isV2) {
            return;
        }


        let scoreA =
            parseInt(match.scoreA) || 0;

        let scoreB =
            parseInt(match.scoreB) || 0;


        totalMatchCount++;


        let isDraw =
            scoreA === scoreB;


        let isWin =
            (isV1 && scoreA > scoreB) ||
            (isV2 && scoreB > scoreA);


        if (isDraw) {

            totalDraws++;

        } else if (isWin) {

            totalWins++;

        } else {

            totalLosses++;
        }


        if (
            !isLogInMonth_(
                match.time,
                targetMonth,
                targetYear
            )
        ) {

            return;
        }


        monthMatchCount++;


        let mustPayGoc =
            isDraw || !isWin;


        if (!mustPayGoc) {
            return;
        }


        let specialBet =
            parseInt(match.specialBet) || 0;


        if (specialBet > 0) {

            // Kèo đặc biệt thay cho góc mặc định.
            // Không chịu ngưỡng tháng.
            monthSpecialBetFee +=
                specialBet;

        } else {

            monthRegularFee +=
                gocDefaultPerMatch;
        }
    });


    if (!members || members.length === 0) {
        members = defaultFallbackMembers;
    }


    let m =
        members.find(function(item) {
            return item.name === memberName;
        }) || {
            noOld: 0
        };


    let cappedBaseFee =
        Math.min(
            gocMonthlyCap,
            monthRegularFee
        );


    // Tiền thành viên đã thực nộp
    // chỉ tính đúng tháng/năm đang xem
    let monthPaidAmount =
        getUserGocPaidForMonth_(
            memberName,
            targetMonth,
            targetYear
        );


    // Thưởng đặt sân
    // chỉ tính đúng tháng/năm đang xem
    let monthRewardAmount =
        getUserBookingRewardForMonth_(
            memberName,
            targetMonth,
            targetYear
        );


    // Dương = đang nợ CLB
    // Âm = thành viên đang có tiền dư
    let carryBalance =
        parseInt(m.noOld) || 0;


    // =============================================
    // CÔNG THỨC TÀI CHÍNH CHÍNH
    //
    // Góc cơ bản
    // + Kèo đặc biệt
    // + Dư/Nợ chuyển kỳ
    // - Tiền đã thực nộp
    // - Thưởng đặt sân
    // =============================================
    // ======================================================
// THÁNG ĐÃ CHỐT
//
// Nếu đã có snapshot MonthlyBalances,
// dùng dữ liệu lịch sử đã khóa.
// Không dùng Members.noOld hiện tại.
// ======================================================

let snapshot =
    getMonthlyBalanceSnapshot_(
        memberName,
        targetMonth,
        targetYear
    );


if (snapshot) {

    cappedBaseFee =
        parseInt(snapshot.baseFee) || 0;

    monthSpecialBetFee =
        parseInt(snapshot.specialFee) || 0;

    monthPaidAmount =
        parseInt(snapshot.paid) || 0;

    monthRewardAmount =
        parseInt(snapshot.reward) || 0;

    carryBalance =
        parseInt(snapshot.openingBalance) || 0;


    return {

        totalMatchCount,
        totalWins,
        totalLosses,
        totalDraws,

        monthMatchCount,

        gocDefaultPerMatch,
        gocMonthlyCap,

        monthRegularFee:
            cappedBaseFee,

        monthSpecialBetFee,

        cappedBaseFee,

        monthPaidAmount,
        monthRewardAmount,

        carryBalance,

        totalPay:
            parseInt(
                snapshot.closingBalance
            ) || 0,

        closingBalance:
            parseInt(
                snapshot.closingBalance
            ) || 0,

        isClosed:
            true
    };
}
    let totalPay =
        cappedBaseFee +
        monthSpecialBetFee +
        carryBalance -
        monthPaidAmount -
        monthRewardAmount;


    return {

        totalMatchCount,
        totalWins,
        totalLosses,
        totalDraws,

        monthMatchCount,

        gocDefaultPerMatch,
        gocMonthlyCap,

        monthRegularFee,
        monthSpecialBetFee,

        cappedBaseFee,

        monthPaidAmount,
        monthRewardAmount,

        carryBalance,

        totalPay,

        closingBalance: totalPay,
        isClosed: false
    };
}


function calculateUserFinance(memberName) {

    let mSel =
        document.getElementById('selectFinanceMonth')
            ? document.getElementById('selectFinanceMonth').value
            : "8";


    let ySel =
        document.getElementById('selectFinanceYear')
            ? document.getElementById('selectFinanceYear').value
            : "2026";


    return calculateUserFinanceForMonth(
        memberName,
        mSel,
        ySel
    );
}


function submitUserPayment() {

    let main =
        document.getElementById(
            'dashMainUser'
        ).value;


    let val =
        parseInt(
            document.getElementById(
                'userPaidInput'
            ).value
        ) || 0;


    // GocLogs chỉ ghi nhận tiền thành viên thực nộp.
    // Hoàn tiền cho thành viên đi qua Cashbook.
    if (val <= 0) {

        alert(
            "Số tiền nộp góc phải lớn hơn 0."
        );

        return;
    }


    showActionConfirm(

        `Xác nhận nộp số tiền ${val.toLocaleString('vi-VN')} VNĐ cho thành viên [${main}]?`,

        () => {

            let newGoc = {

                id: Date.now(),

                time:
                    formatVNDateTime_(),

                name: main,

                amount: val,

                note:
                    "Thành viên tự nhập CK"
            };


            document
                .getElementById(
                    'userPaidInput'
                )
                .value = '';


            enqueueAction(

                "addGocLog",

                {
                    gocLog: newGoc
                },

                "Đã ghi nhận giao dịch thành công!"
            );
        }
    );
}


function renderGocLogsTab() {

    let filterUser =
        document
            .getElementById(
                'filterGocUser'
            )
            .value;


    let tbody =
        document.getElementById(
            'gocLogsTableBody'
        );


    tbody.innerHTML = '';


    // (v2.0 fix) Tab "Nộp Tiền" chỉ dành cho tiền thành viên THỰC NỘP
    // VÀO - các dòng điều chỉnh trả tiền dư thưởng đặt sân (tiền CHI RA,
    // đã ghi riêng ở Cashbook) không nên hiện/tính vào đây, theo đúng
    // góp ý của người vận hành CLB. Dùng getRealGocLogs_() thay vì đọc
    // thẳng gocLogs (xem định nghĩa đầu file).
    let logsToDisplay =
        getRealGocLogs_();


    if (filterUser !== 'ALL') {

        logsToDisplay =
            logsToDisplay.filter(
                function(g) {

                    return (
                        g.name ===
                        filterUser
                    );
                }
            );
    }


    logsToDisplay.sort(
        function(a, b) {

            return (
                (parseInt(b.id) || 0) -
                (parseInt(a.id) || 0)
            );
        }
    );


    let totalFiltered =
        logsToDisplay.reduce(
            function(sum, g) {

                return (
                    sum +
                    (parseInt(g.amount) || 0)
                );
            },
            0
        );


    document
        .getElementById(
            'totalGocCollectedDisplay'
        )
        .innerText =
            totalFiltered
                .toLocaleString('vi-VN') +
            " đ";


    logsToDisplay.forEach(
        function(g, idx) {

            let stt =
                logsToDisplay.length -
                idx;


            let amount =
                parseInt(g.amount) || 0;


            let idArg =
                JSON.stringify(
                    String(g.id)
                );


            // (v2.0 - điểm yếu #9): tên thành viên + ghi chú là dữ
            // liệu người dùng nhập - escape trước khi chèn HTML.
            let safeName_ =
                (typeof escapeHtml_ === 'function')
                    ? escapeHtml_(g.name)
                    : String(g.name || '');

            let safeNote_ =
                (typeof escapeHtml_ === 'function')
                    ? escapeHtml_(g.note || '-')
                    : String(g.note || '-');


            tbody.innerHTML += `

                <tr class="border-b hover:bg-slate-50">

                    <td class="p-2.5 text-center font-bold text-slate-500">
                        ${stt}
                    </td>

                    <td class="p-2.5 font-semibold text-slate-600">
                        ${formatVNTimeForDisplay_(g.time)}
                    </td>

                    <td class="p-2.5 font-bold text-slate-900">
                        ${safeName_}
                    </td>

                    <td class="
                        p-2.5 text-right font-black
                        ${
                            amount < 0
                                ? 'text-red-600'
                                : 'text-emerald-700'
                        }
                    ">
                        ${amount.toLocaleString('vi-VN')} đ
                    </td>

                    <td class="p-2.5 text-slate-500">
                        ${safeNote_}
                    </td>

                    <td class="
                        p-2.5 text-center admin-only
                        ${
                            (currentUserRole === 'admin' || currentUserRole === 'owner')
                                ? ''
                                : 'hidden'
                        }
                    ">

                        <button
                            onclick='openEditGocLog(${idArg})'
                            class="text-blue-600 font-bold mr-2"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            onclick='deleteGocLog(${idArg})'
                            class="text-red-600 font-bold"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>

                    </td>

                </tr>
            `;
        }
    );


    applyRolePermissions();
}


function sortFinanceTable(field) {

    if (financeSortField === field) {

        financeSortAsc =
            !financeSortAsc;

    } else {

        financeSortField =
            field;

        financeSortAsc =
            true;
    }


    renderFinance();
}


function renderFinance() {
    ensureMonthCloseAdminUI_();
    let mSel =
        document
            .getElementById(
                'selectFinanceMonth'
            )
            .value;


    let ySel =
        document
            .getElementById(
                'selectFinanceYear'
            )
            .value;


    // Trạng thái khóa của tháng đang xem.
    // true  = đã chốt -> không cho sửa Dư/Nợ.
    // false = chưa chốt -> Admin được phép sửa.
    // null  = chưa xác minh -> tạm khóa để an toàn.
    let financeMonthCloseStatus =
        getMonthCloseStatusLocal_(
            mSel,
            ySel
        );


    // Tháng tương lai chắc chắn chưa thể chốt vì Backend
    // đã chặn chốt tháng hiện tại/tương lai. Không cần chờ API.
    if (
        financeMonthCloseStatus === null &&
        isMonthClosePeriodFuture_(
            mSel,
            ySel
        )
    ) {

        setMonthCloseStatusLocal_(
            mSel,
            ySel,
            false
        );


        financeMonthCloseStatus =
            false;
    }


    let tbody =
        document.getElementById(
            'financeTableBody'
        );


    tbody.innerHTML = '';


    [
        'stt',
        'name',
        'wins',
        'losses',
        'draws',
        'monthMatches',
        'winRate',
        'baseFee',
        'specialFee',
        'paid',
        'noOld',
        'totalPay'

    ].forEach(function(f) {

        let iconEl =
            document.getElementById(
                'sort-icon-' + f
            );


        if (iconEl) {
            iconEl.innerText = '↕';
        }
    });


    let activeIcon =
        document.getElementById(
            'sort-icon-' +
            financeSortField
        );


    if (activeIcon) {

        activeIcon.innerText =
            financeSortAsc
                ? '▲'
                : '▼';
    }


    if (!members || members.length === 0) {

        members =
            defaultFallbackMembers;
    }


    let dataList =
        members.map(
            function(m, originalIdx) {

                let f =
                    calculateUserFinanceForMonth(
                        m.name,
                        mSel,
                        ySel
                    );


                let winRateVal =
                    f.totalMatchCount > 0
                        ? (
                            f.totalWins /
                            f.totalMatchCount
                        )
                        : 0;


                return {

                    originalIdx:
                        originalIdx + 1,

                    m: m,

                    f: f,

                    winRateVal:
                        winRateVal
                };
            }
        );


    dataList.sort(
        function(a, b) {

            let valA;
            let valB;


            if (
                financeSortField ===
                'stt'
            ) {

                valA =
                    a.originalIdx;

                valB =
                    b.originalIdx;
            }

            else if (
                financeSortField ===
                'name'
            ) {

                valA =
                    a.m.name;

                valB =
                    b.m.name;
            }

            else if (
                financeSortField ===
                'wins'
            ) {

                valA =
                    a.f.totalWins;

                valB =
                    b.f.totalWins;
            }

            else if (
                financeSortField ===
                'losses'
            ) {

                valA =
                    a.f.totalLosses;

                valB =
                    b.f.totalLosses;
            }

            else if (
                financeSortField ===
                'draws'
            ) {

                valA =
                    a.f.totalDraws;

                valB =
                    b.f.totalDraws;
            }

            else if (
                financeSortField ===
                'monthMatches'
            ) {

                valA =
                    a.f.monthMatchCount;

                valB =
                    b.f.monthMatchCount;
            }

            else if (
                financeSortField ===
                'winRate'
            ) {

                valA =
                    a.winRateVal;

                valB =
                    b.winRateVal;
            }

            else if (
                financeSortField ===
                'baseFee'
            ) {

                valA =
                    a.f.cappedBaseFee;

                valB =
                    b.f.cappedBaseFee;
            }

            else if (
                financeSortField ===
                'specialFee'
            ) {

                valA =
                    a.f.monthSpecialBetFee;

                valB =
                    b.f.monthSpecialBetFee;
            }

            else if (
                financeSortField ===
                'paid'
            ) {

                valA =
                    a.f.monthPaidAmount;

                valB =
                    b.f.monthPaidAmount;
            }

            else if (
                financeSortField ===
                'noOld'
            ) {

                valA =
                    a.f.carryBalance;

                valB =
                    b.f.carryBalance;
            }

            else if (
                financeSortField ===
                'totalPay'
            ) {

                valA =
                    a.f.totalPay;

                valB =
                    b.f.totalPay;
            }


            if (
                typeof valA ===
                'string'
            ) {

                return financeSortAsc
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            }


            return financeSortAsc
                ? (valA - valB)
                : (valB - valA);
        }
    );


    dataList.forEach(
        function(item) {

            let m =
                item.m;


            let f =
                item.f;


            let winRateStr =
                f.totalMatchCount > 0
                    ? (
                        (
                            f.totalWins /
                            f.totalMatchCount
                        ) * 100
                    ).toFixed(0) + '%'
                    : '0%';


            let totalPayColor =
                f.totalPay < 0

                    ? 'text-cyan-700 bg-cyan-50'

                    : (
                        f.totalPay > 0

                            ? 'text-emerald-800 bg-emerald-50'

                            : 'text-slate-700 bg-slate-50'
                    );


            let rewardHint =
                f.monthRewardAmount > 0
            
                    ? `
                        <div class="
                            finance-reward-hint
                            text-[9px]
                            font-semibold
                            text-purple-600
                            mt-0.5
                        ">
                            <span class="finance-reward-label">
                                Thưởng sân:
                            </span>
            
                            <span class="finance-reward-value">
                                -${f.monthRewardAmount.toLocaleString('vi-VN')} đ
                            </span>
                        </div>
                    `
            
                    : '';


            // (v2.0 - điểm yếu #9): tên thành viên - escape trước
            // khi chèn HTML (bảng Tài chính hiển thị cho MỌI thành
            // viên xem, rủi ro cao nhất nếu không escape).
            let safeMemberName_ =
                (typeof escapeHtml_ === 'function')
                    ? escapeHtml_(m.name)
                    : String(m.name || '');


            tbody.innerHTML += `

                <tr class="border-b hover:bg-slate-50">

                    <td class="p-2 text-center font-bold text-slate-500">
                        ${item.originalIdx}
                    </td>

                    <td class="p-2 sticky-col font-bold text-slate-900 border-r">
                        ${safeMemberName_}
                    </td>

                    <td class="p-2 text-center font-bold text-blue-600">
                        ${f.totalWins}
                    </td>

                    <td class="p-2 text-center font-bold text-red-600">
                        ${f.totalLosses}
                    </td>

                    <td class="p-2 text-center font-bold text-amber-600">
                        ${f.totalDraws}
                    </td>

                    <td class="p-2 text-center font-black text-emerald-700 bg-emerald-50/50">
                        ${f.monthMatchCount}
                    </td>

                    <td class="p-2 text-center font-bold">
                        ${winRateStr}
                    </td>

                    <td
                        class="p-2 text-right font-semibold"
                        title="
                            ${f.gocDefaultPerMatch.toLocaleString('vi-VN')}đ/trận,
                            ngưỡng ${f.gocMonthlyCap.toLocaleString('vi-VN')}đ/tháng
                        "
                    >
                    <span class="finance-money-number">
                        ${f.cappedBaseFee.toLocaleString('vi-VN')}
                        </span>
                        <span class="finance-money-unit">đ</span>    
                    </td>

                    <td class="p-2 text-right font-bold text-amber-800">
                        <span class="finance-money-number">
                        ${f.monthSpecialBetFee.toLocaleString('vi-VN')}
                    </span>
                    <span class="finance-money-unit">đ</span>
                    </td>

                    <td class="p-2 text-right text-emerald-700 font-black">
                        <span class="finance-money-number">
                        ${f.monthPaidAmount.toLocaleString('vi-VN')}
                    </span>
                    <span class="finance-money-unit">đ</span>
                    </td>

                    <td class="
                        p-2 text-right font-bold
                        ${
                            f.carryBalance < 0

                                ? 'text-cyan-700'

                                : (
                                    f.carryBalance > 0

                                        ? 'text-red-600'

                                        : 'text-slate-500'
                                )
                        }
                    ">
                        <span class="finance-money-number">
                        ${f.carryBalance.toLocaleString('vi-VN')}
                    </span>
                    <span class="finance-money-unit">đ</span>
                    </td>

                    <td class="
                        p-2 text-right font-black
                        ${totalPayColor}
                    ">
                        <span class="finance-money-number">
                        ${f.totalPay.toLocaleString('vi-VN')}
                    </span>
                    <span class="finance-money-unit">đ</span>
                    
                    ${rewardHint}
                    </td>

                    <td class="p-2 text-center space-x-1">

                        <button
                            onclick="openQRModal('${m.name}', ${f.totalPay})"
                            class="
                                bg-blue-600
                                text-white
                                text-[10px]
                                font-bold
                                px-2 py-1
                                rounded shadow
                                hover:bg-blue-700
                            "
                        >
                            QR
                        </button>

                        ${
                            (currentUserRole === 'admin' || currentUserRole === 'owner')

                                ? (
                                    financeMonthCloseStatus === true

                                        ? `
                                            <button
                                                type="button"
                                                disabled
                                                class="
                                                    bg-slate-200
                                                    text-slate-500
                                                    text-[10px]
                                                    font-bold
                                                    px-2 py-1
                                                    rounded
                                                    cursor-not-allowed
                                                "
                                                title="Tháng ${mSel}/${ySel} đã chốt, Dư/Nợ lịch sử đã khóa"
                                            >
                                                <i class="fa-solid fa-lock mr-1"></i>
                                                Đã khóa
                                            </button>
                                        `

                                        : (
                                            financeMonthCloseStatus === false

                                                ? `
                                                    <button
                                                        onclick="openEditFinanceModal(${members.indexOf(m)})"
                                                        class="
                                                            bg-amber-500
                                                            text-slate-900
                                                            text-[10px]
                                                            font-bold
                                                            px-2 py-1
                                                            rounded shadow
                                                            hover:bg-amber-600
                                                        "
                                                    >
                                                        Sửa Dư/Nợ
                                                    </button>
                                                `

                                                : `
                                                    <button
                                                        type="button"
                                                        disabled
                                                        class="
                                                            bg-amber-100
                                                            text-amber-700
                                                            text-[10px]
                                                            font-bold
                                                            px-2 py-1
                                                            rounded
                                                            cursor-wait
                                                        "
                                                        title="Đang kiểm tra trạng thái chốt tháng"
                                                    >
                                                        Kiểm tra...
                                                    </button>
                                                `
                                        )
                                )

                                : ''
                        }

                    </td>

                </tr>
            `;
        }
    );
}


function openEditFinanceModal(idx) {

    if (
        currentUserRole !== 'admin' &&
        currentUserRole !== 'owner'
    ) {
        return;
    }


    let monthSelect =
        document.getElementById(
            'selectFinanceMonth'
        );


    let yearSelect =
        document.getElementById(
            'selectFinanceYear'
        );


    if (
        !monthSelect ||
        !yearSelect
    ) {

        alert(
            "Không xác định được tháng đang xem."
        );

        return;
    }


    let month =
        parseInt(
            monthSelect.value
        );


    let year =
        parseInt(
            yearSelect.value
        );


    // Nếu local đã biết tháng đã chốt thì khóa ngay.
    if (
        isMonthClosed_(
            month,
            year
        )
    ) {

        alert(
            `Tháng ${month}/${year} đã chốt.\n\nKhông được sửa Dư/Nợ của tháng lịch sử.`
        );

        renderFinance();

        return;
    }


    // Tháng tương lai không thể đã được chốt vì Backend
    // đã chặn việc chốt tháng hiện tại/tương lai.
    // Vì vậy cho phép Admin sửa Dư/Nợ ngay, không cần chờ API.
    if (
        isMonthClosePeriodFuture_(
            month,
            year
        )
    ) {

        setMonthCloseStatusLocal_(
            month,
            year,
            false
        );


        openEditFinanceModalConfirmed_(
            idx,
            month,
            year
        );

        return;
    }


    // Với tháng hiện tại hoặc tháng quá khứ chưa xác định,
    // kiểm tra lại Backend để tránh sửa nhầm tháng đã khóa.
    // Mục đích: tránh trường hợp một tháng vừa được chốt ở thiết bị khác.
    showToast(
        `Đang kiểm tra tháng ${month}/${year}...`
    );


    fetchMonthCloseStatusLight_(
        month,
        year,

        function(
            error,
            result
        ) {

            if (error) {

                console.warn(
                    'EDIT CARRY MONTH STATUS ERROR:',
                    error
                );


                alert(
                    "Chưa xác minh được trạng thái tháng trên Cloud.\n\nTạm thời không cho sửa Dư/Nợ để tránh thay đổi dữ liệu của tháng đã chốt."
                );

                return;
            }


            if (
                result &&
                result.isClosed === true
            ) {

                setMonthCloseStatusLocal_(
                    month,
                    year,
                    true
                );


                renderFinance();


                alert(
                    `Tháng ${month}/${year} đã chốt.\n\nKhông được sửa Dư/Nợ của tháng lịch sử.`
                );

                return;
            }


            setMonthCloseStatusLocal_(
                month,
                year,
                false
            );


            openEditFinanceModalConfirmed_(
                idx,
                month,
                year
            );
        },

        {
            maxAttempts: 2,
            timeoutMs: 6000,
            retryDelayMs: 1000
        }
    );
}


function openEditFinanceModalConfirmed_(
    idx,
    month,
    year
) {

    let m =
        members[idx];


    if (!m) {

        alert(
            "Không tìm thấy thành viên."
        );

        return;
    }


    document
        .getElementById(
            'efMemberIdx'
        )
        .value = idx;


    document
        .getElementById(
            'efMemberName'
        )
        .value = m.name;


    document
        .getElementById(
            'efNoOld'
        )
        .value =
            m.noOld || 0;


    let modal =
        document.getElementById(
            'editFinanceModal'
        );


    if (!modal) {
        return;
    }


    // Ghi lại kỳ đang sửa để dễ kiểm soát và debug.
    modal.dataset.financeMonth =
        String(month);


    modal.dataset.financeYear =
        String(year);


    modal
        .classList
        .remove('hidden');


    modal
        .classList
        .add('flex');
}


function closeEditFinanceModal() {

    document
        .getElementById(
            'editFinanceModal'
        )
        .classList
        .add('hidden');


    document
        .getElementById(
            'editFinanceModal'
        )
        .classList
        .remove('flex');
}


// ======================================================
// v2.0 (sửa điểm yếu #5 - "Sửa nợ cũ" kiến trúc sai):
//
// v1.6 ghi ĐÈ TRỰC TIẾP member.noOld (cột Dư/Nợ Chuyển Kỳ, dùng
// chung cho MỌI kỳ) bất kể đang xem tháng nào - có thể làm sai
// lệch số dư mở đầu của một tháng CHƯA CHỐT khi admin sửa trong
// lúc đang xem một tháng KHÁC.
//
// v2.0: KHÔNG còn ghi đè trực tiếp. Thay vào đó tạo 1 bản ghi
// "điều chỉnh" (BalanceAdjustments) - CHỈ áp dụng cho kỳ hiện
// đang mở (backend tự chặn nếu không phải kỳ mở, xem
// BalanceAdjustmentService.gs.txt) - không bao giờ đụng tới lịch
// sử các tháng đã chốt. Số dư hiển thị được tính lại từ server
// sau khi tải lại dữ liệu, không suy đoán ở client nữa.
// ======================================================

function saveFinanceData(e) {

    e.preventDefault();


    let idx =
        parseInt(
            document
                .getElementById(
                    'efMemberIdx'
                )
                .value
        );


    let member =
        members[idx];


    if (!member) {

        alert(
            "Không tìm thấy thành viên."
        );

        return;
    }


    let newValue =
        parseInt(
            document
                .getElementById(
                    'efNoOld'
                )
                .value
        ) || 0;


    let currentEffective =
        parseInt(
            member.noOld
        ) || 0;


    let delta =
        newValue - currentEffective;


    if (delta === 0) {

        closeEditFinanceModal();
        return;
    }


    let reason =
        (window.prompt(
            "Nhập lý do điều chỉnh Dư/Nợ chuyển kỳ cho " +
            member.name +
            " (bắt buộc - sẽ được lưu vào lịch sử điều chỉnh, không sửa trực tiếp số dư gốc):",
            ""
        ) || "").trim();


    if (!reason) {

        alert(
            "Phải nhập lý do điều chỉnh. Đã huỷ thao tác."
        );

        return;
    }


    closeEditFinanceModal();

    showToast(
        "Đang gửi điều chỉnh Dư/Nợ chuyển kỳ..."
    );


    callBackendAction_(

        "addBalanceAdjustment",

        {
            adjustment: {
                memberStt: member.stt,
                amount: delta,
                reason: reason
            }
        },

        generateIdempotencyKey_()
    )

    .then(function(data) {

        if (
            data.status !==
            "SUCCESS"
        ) {

            alert(
                (
                    data.message ||
                    "Không thể ghi điều chỉnh Dư/Nợ chuyển kỳ."
                ) +

                "\n\nKHÔNG có gì thay đổi (v2.0 không còn ghi đè " +
                "trực tiếp số dư trên màn hình trước khi có xác " +
                "nhận thật từ máy chủ)."
            );

            return;
        }


        showToast(
            "Đã ghi điều chỉnh. Đang tải lại số dư mới nhất..."
        );


        if (typeof fetchCloudData === "function") {

            fetchCloudData(false);
        }
    })

    .catch(function() {

        alert(
            "Không thể kết nối hệ thống.\n\n" +
            "Điều chỉnh CHƯA được ghi nhận, vui lòng thử lại."
        );
    });
}


function openQRModal(
    memberName,
    amount
) {

    let payAmt =
        Math.max(
            0,
            amount
        );


    let content =
        "NOP TIEN GOC " +
        memberName.replace(
            /[^a-zA-Z0-9]/g,
            ''
        );


    let qrUrl =
        `https://img.vietqr.io/image/` +
        `${systemSettings.bankId}-` +
        `${systemSettings.bankAccount}-compact2.png` +
        `?amount=${payAmt}` +
        `&addInfo=${encodeURIComponent(content)}` +
        `&accountName=${encodeURIComponent(systemSettings.accountName)}`;


    document
        .getElementById(
            'qrImage'
        )
        .src = qrUrl;


    document
        .getElementById(
            'qrAmountDisplay'
        )
        .innerText =

            payAmt
                .toLocaleString(
                    'vi-VN'
                ) +

            " đ" +

            (
                amount < 0
                    ? " (Dư quỹ cấn trừ)"
                    : ""
            );


    document
        .getElementById(
            'qrModal'
        )
        .classList
        .remove('hidden');


    document
        .getElementById(
            'qrModal'
        )
        .classList
        .add('flex');
}


function closeQRModal() {

    document
        .getElementById(
            'qrModal'
        )
        .classList
        .add('hidden');


    document
        .getElementById(
            'qrModal'
        )
        .classList
        .remove('flex');
}


function openQRZoomModal() {

    let qrUrl =
        `https://img.vietqr.io/image/` +
        `${systemSettings.bankId}-` +
        `${systemSettings.bankAccount}-compact2.png` +
        `?accountName=${encodeURIComponent(systemSettings.accountName)}`;


    document
        .getElementById(
            'zoomQrImg'
        )
        .src = qrUrl;


    let modal =
        document.getElementById(
            'qrZoomModal'
        );


    if (modal) {

        modal.classList.remove(
            'hidden'
        );

        modal.classList.add(
            'flex'
        );
    }
}


function closeQRZoomModal() {

    let modal =
        document.getElementById(
            'qrZoomModal'
        );


    if (modal) {

        modal.classList.add(
            'hidden'
        );

        modal.classList.remove(
            'flex'
        );
    }
}


// ======================================================
// QUẢN LÝ QUỸ QUÝ
// ======================================================

function initQuyPeriodSelectors() {

    let qSelect =
        document.getElementById(
            'selectQuy'
        );


    let ySelect =
        document.getElementById(
            'selectNam'
        );


    if (!qSelect || !ySelect) {
        return;
    }


    if (
        qSelect.dataset.autoInitialized ===
        '1'
    ) {

        return;
    }


    let now =
        new Date();


    let currentQuarter =
        "Q" +
        Math.ceil(
            (
                now.getMonth() +
                1
            ) / 3
        );


    let currentYear =
        now.getFullYear();


    qSelect.value =
        currentQuarter;


    let firstYear =
        2026;


    let lastYear =
        Math.max(
            2036,
            currentYear + 10
        );


    ySelect.innerHTML =
        '';


    for (
        let year = firstYear;
        year <= lastYear;
        year++
    ) {

        let option =
            document.createElement(
                'option'
            );


        option.value =
            year;


        option.textContent =
            year;


        if (
            year ===
            currentYear
        ) {

            option.selected =
                true;
        }


        ySelect.appendChild(
            option
        );
    }


    qSelect.dataset.autoInitialized =
        '1';
}


function renderQuyTable() {

    if (
        !members ||
        members.length === 0
    ) {

        members =
            defaultFallbackMembers;
    }


    initQuyPeriodSelectors();


    let qSelect =
        document.getElementById(
            'selectQuy'
        );


    let ySelect =
        document.getElementById(
            'selectNam'
        );


    if (!qSelect || !ySelect) {
        return;
    }


    let q =
        qSelect.value;


    let y =
        ySelect.value;


    document
        .getElementById(
            'thQuyTitle'
        )
        .innerText =

            "Số Tiền " +

            q.replace(
                'Q',
                'Quý '
            ) +

            "/" +

            y;


    let tbody =
        document.getElementById(
            'quyTableBody'
        );


    tbody.innerHTML =
        '';


    members.forEach(
        function(m, idx) {

            let quyLog =
                (quyLogs || [])
                    .find(
                        function(log) {

                            return (

                                String(
                                    log.name || ''
                                )
                                .trim()
                                .toLowerCase() ===

                                String(
                                    m.name || ''
                                )
                                .trim()
                                .toLowerCase()

                                &&

                                String(
                                    log.quarter || ''
                                )
                                .trim()
                                .toUpperCase() ===
                                q

                                &&

                                parseInt(
                                    log.year
                                ) ===
                                parseInt(
                                    y
                                )
                            );
                        }
                    );


            let paidAmount =
                quyLog
                    ? (
                        parseInt(
                            quyLog.amount
                        ) || 0
                    )
                    : 0;


            let isOk =
                !!quyLog;


            let statusColor =

                m.status ===
                'Đang tham gia'

                    ? 'bg-emerald-100 text-emerald-800'

                    : (
                        m.status ===
                        'Bận tạm nghỉ'

                            ? 'bg-amber-100 text-amber-800'

                            : 'bg-purple-100 text-purple-800'
                    );


            let actionHtml =
                '<span class="text-slate-300">-</span>';


            if (
                (currentUserRole === 'admin' || currentUserRole === 'owner') &&
                quyLog
            ) {

                let isMigration =

                    String(
                        quyLog.id || ''
                    )
                    .startsWith(
                        'MIG_'
                    )

                    ||

                    String(
                        quyLog.note || ''
                    )
                    .includes(
                        'Migration từ Members'
                    );


                if (!isMigration) {

                    actionHtml = `

                        <button
                            onclick='deleteQuyLog(${JSON.stringify(String(quyLog.id))})'
                            class="text-red-600 hover:text-red-800 font-bold"
                            title="Xóa xác nhận đóng quỹ"
                        >

                            <i class="fa-solid fa-trash"></i>

                        </button>
                    `;
                }
            }


            let safeQuyMemberName_ =
                (typeof escapeHtml_ === 'function')
                    ? escapeHtml_(m.name)
                    : String(m.name || '');


            tbody.innerHTML += `

                <tr class="border-b hover:bg-slate-50">

                    <td class="p-2.5 text-center font-bold text-slate-500">
                        ${idx + 1}
                    </td>

                    <td class="p-2.5 font-bold text-slate-900">
                        ${safeQuyMemberName_}
                    </td>

                    <td class="p-2.5 text-center">

                        <span class="
                            px-2
                            py-0.5
                            rounded
                            text-[10px]
                            font-bold
                            ${statusColor}
                        ">
                            ${
                                m.status ||
                                'Đang tham gia'
                            }
                        </span>

                    </td>

                    <td class="
                        p-2.5
                        text-right
                        font-bold
                        ${
                            isOk
                                ? 'text-emerald-700'
                                : 'text-slate-400'
                        }
                    ">
                        ${paidAmount.toLocaleString('vi-VN')} đ
                    </td>

                    <td class="p-2.5 text-center">

                        <span class="
                            px-2
                            py-0.5
                            rounded-full
                            text-[10px]
                            font-bold
                            ${
                                isOk
                                    ? 'bg-cyan-100 text-cyan-800'
                                    : 'bg-red-100 text-red-800'
                            }
                        ">
                            ${
                                isOk
                                    ? 'OK'
                                    : 'Chưa'
                            }
                        </span>

                    </td>

                    <td class="
                        p-2.5
                        text-center
                        admin-only
                        ${
                            (currentUserRole === 'admin' || currentUserRole === 'owner')
                                ? ''
                                : 'hidden'
                        }
                    ">
                        ${actionHtml}
                    </td>

                </tr>
            `;
        }
    );


    applyRolePermissions();
}


function deleteQuyLog(id) {

    if (
        currentUserRole !== 'admin' &&
        currentUserRole !== 'owner'
    ) {

        alert(
            "Chỉ Admin hoặc Owner mới được xóa xác nhận đóng quỹ."
        );

        return;
    }


    let log =
        (quyLogs || [])
            .find(
                function(item) {

                    return (
                        String(item.id) ===
                        String(id)
                    );
                }
            );


    if (!log) {

        alert(
            "Không tìm thấy bản ghi đóng quỹ."
        );

        return;
    }


    let isMigration =

        String(
            log.id || ''
        )
        .startsWith(
            'MIG_'
        )

        ||

        String(
            log.note || ''
        )
        .includes(
            'Migration từ Members'
        );


    if (isMigration) {

        alert(
            "Không được xóa dữ liệu lịch sử đã migration."
        );

        return;
    }


    showActionConfirm(

        `Xóa xác nhận đóng quỹ ${log.quarter}/${log.year} của [${log.name}]?`,

        () => {

            let backupLog =
                {
                    ...log
                };


            quyLogs =
                (quyLogs || [])
                    .filter(
                        function(item) {

                            return (
                                String(item.id) !==
                                String(id)
                            );
                        }
                    );


            renderQuyTable();


            if (
                typeof renderDashboard ===
                "function"
            ) {

                renderDashboard();
            }


            if (
                typeof renderCashbook ===
                "function"
            ) {

                renderCashbook();
            }


            showToast(

                `Đang xóa xác nhận quỹ ${log.quarter}/${log.year}...`
            );


            callBackendAction_(

                "deleteItem",

                {
                    sheetName: "QuyLogs",
                    id: log.id
                },

                generateIdempotencyKey_()
            )

            .then(
                function(data) {

                    if (
                        data.status !==
                        "SUCCESS"
                    ) {

                        let exists =
                            (quyLogs || [])
                                .some(
                                    function(item) {

                                        return (
                                            String(item.id) ===
                                            String(backupLog.id)
                                        );
                                    }
                                );


                        if (!exists) {

                            quyLogs.push(
                                backupLog
                            );
                        }


                        renderQuyTable();


                        if (
                            typeof renderDashboard ===
                            "function"
                        ) {

                            renderDashboard();
                        }


                        if (
                            typeof renderCashbook ===
                            "function"
                        ) {

                            renderCashbook();
                        }


                        let message =
                            data.message ||
                            "Không thể xóa xác nhận đóng quỹ.";


                        message =
                            message.replace(
                                /^Error:\s*/i,
                                ""
                            );


                        alert(

                            message +

                            "\n\nDữ liệu đã được khôi phục trên màn hình."
                        );


                        return;
                    }


                    showToast(

                        `Đã xóa quỹ ${log.quarter}/${log.year} của ${log.name}!`
                    );
                }
            )

            .catch(
                function() {

                    let exists =
                        (quyLogs || [])
                            .some(
                                function(item) {

                                    return (
                                        String(item.id) ===
                                        String(backupLog.id)
                                    );
                                }
                            );


                    if (!exists) {

                        quyLogs.push(
                            backupLog
                        );
                    }


                    renderQuyTable();


                    if (
                        typeof renderDashboard ===
                        "function"
                    ) {

                        renderDashboard();
                    }


                    if (
                        typeof renderCashbook ===
                        "function"
                    ) {

                        renderCashbook();
                    }


                    alert(

                        "Không thể kết nối hệ thống.\n\n" +
                        "Lệnh xóa đã được hoàn tác."
                    );
                }
            );
        }
    );
}


function addCashbookEntry(e) {

    e.preventDefault();


    let category =
        document
            .getElementById(
                'cbCategory'
            )
            .value;


    let amount =
        parseInt(
            document
                .getElementById(
                    'cbAmount'
                )
                .value
        ) || 0;


    let note =
        document
            .getElementById(
                'cbNote'
            )
            .value ||
        category;


    showActionConfirm(

        `Xác nhận ghi nhận khoản [${category}] với số tiền ${amount.toLocaleString('vi-VN')} đ?`,

        () => {

            let newCashbook = {

                id:
                    Date.now(),

                category:
                    category,

                amount:
                    amount,

                note:
                    note,

                time:
                    new Date()
                        .toLocaleDateString(
                            'vi-VN'
                        )
            };


            document
                .getElementById(
                    'cbAmount'
                )
                .value = '';


            document
                .getElementById(
                    'cbNote'
                )
                .value = '';


            enqueueAction(

                "addCashbook",

                {
                    cashbook:
                        newCashbook
                },

                "Đã ghi nhận khoản thu/chi thành công!"
            );
        }
    );
}


function deleteCashbookLog(id) {

    let c =
        (cashbookLogs || []).find(
            function(item) {
                return String(item.id) === String(id);
            }
        );

    let message =
        c
            ? `Bạn có muốn xóa khoản [${c.category}] số tiền ${(parseInt(c.amount) || 0).toLocaleString('vi-VN')}đ này không?`
            : "Bạn có chắc chắn muốn xóa giao dịch thu/chi này không?";

    showActionConfirm(
        message,
        function() {

            enqueueAction(

                "deleteItem",

                {
                    sheetName:
                        "Cashbook",

                    id:
                        id
                },

                "Đã xóa giao dịch thành công!"
            );
        }
    );
}


function openEditGocLog(id) {

    let g =
        (gocLogs || [])
            .find(
                function(item) {

                    return (
                        String(item.id) ===
                        String(id)
                    );
                }
            );


    if (!g) {
        return;
    }


    document
        .getElementById(
            'egLogId'
        )
        .value =
            g.id;


    document
        .getElementById(
            'egMemberName'
        )
        .value =
            g.name;


    document
        .getElementById(
            'egAmount'
        )
        .value =
            g.amount;


    document
        .getElementById(
            'egNote'
        )
        .value =
            g.note || '';


    document
        .getElementById(
            'editGocLogModal'
        )
        .classList
        .remove(
            'hidden'
        );


    document
        .getElementById(
            'editGocLogModal'
        )
        .classList
        .add(
            'flex'
        );
}


function closeEditGocLogModal() {

    document
        .getElementById(
            'editGocLogModal'
        )
        .classList
        .add(
            'hidden'
        );


    document
        .getElementById(
            'editGocLogModal'
        )
        .classList
        .remove(
            'flex'
        );
}


function saveGocLogEdit(e) {

    e.preventDefault();


    let id =
        String(
            document
                .getElementById(
                    'egLogId'
                )
                .value ||
            ''
        );


    let g =
        (gocLogs || [])
            .find(
                function(item) {

                    return (
                        String(item.id) ===
                        id
                    );
                }
            );


    if (!g) {

        alert(
            "Không tìm thấy bản ghi tiền góc."
        );

        return;
    }


    let newAmount =
        parseInt(
            document
                .getElementById(
                    'egAmount'
                )
                .value
        ) || 0;


    let newNote =
        document
            .getElementById(
                'egNote'
            )
            .value ||
        '';


    if (newAmount <= 0) {

        alert(
            "Số tiền góc phải lớn hơn 0."
        );

        return;
    }


    let backup = {

        id:
            g.id,

        time:
            g.time,

        name:
            g.name,

        amount:
            g.amount,

        note:
            g.note
    };


    let payload = {

        id:
            g.id,

        time:
            g.time,

        name:
            g.name,

        amount:
            newAmount,

        note:
            newNote
    };


    closeEditGocLogModal();


    // Optimistic UI
    g.amount =
        newAmount;


    g.note =
        newNote;


    renderGocLogsTab();

    renderFinance();


    if (
        typeof renderDashboard ===
        "function"
    ) {

        renderDashboard();
    }


    if (
        typeof renderCashbook ===
        "function"
    ) {

        renderCashbook();
    }


    showToast(
        "Đang cập nhật tiền góc..."
    );


    callBackendAction_(

        "updateGocLog",

        { gocLog: payload },

        generateIdempotencyKey_()
    )

    .then(
        function(data) {

            if (
                data.status !==
                "SUCCESS"
            ) {

                Object.assign(
                    g,
                    backup
                );


                renderGocLogsTab();

                renderFinance();


                if (
                    typeof renderDashboard ===
                    "function"
                ) {

                    renderDashboard();
                }


                if (
                    typeof renderCashbook ===
                    "function"
                ) {

                    renderCashbook();
                }


                alert(

                    (
                        data.message ||
                        "Không thể cập nhật tiền góc."
                    ) +

                    "\n\nDữ liệu đã được hoàn tác."
                );


                return;
            }


            if (data.result) {

                Object.assign(
                    g,
                    data.result
                );
            }


            renderGocLogsTab();

            renderFinance();


            if (
                typeof renderDashboard ===
                "function"
            ) {

                renderDashboard();
            }


            if (
                typeof renderCashbook ===
                "function"
            ) {

                renderCashbook();
            }


            showToast(
                "Đã cập nhật tiền góc thành công!"
            );
        }
    )

    .catch(
        function() {

            Object.assign(
                g,
                backup
            );


            renderGocLogsTab();

            renderFinance();


            if (
                typeof renderDashboard ===
                "function"
            ) {

                renderDashboard();
            }


            if (
                typeof renderCashbook ===
                "function"
            ) {

                renderCashbook();
            }


            alert(

                "Không thể kết nối hệ thống.\n\n" +
                "Dữ liệu tiền góc đã được hoàn tác."
            );
        }
    );
}


function deleteGocLog(id) {

    let g =
        (gocLogs || []).find(
            function(item) {
                return String(item.id) === String(id);
            }
        );

    let message =
        g
            ? `Bạn có muốn xóa lượt nộp góc [${g.name}], số tiền ${(parseInt(g.amount) || 0).toLocaleString('vi-VN')}đ này không?`
            : "Bạn có chắc chắn muốn xóa lượt nộp tiền góc này không?";

    showActionConfirm(
        message,
        function() {

            enqueueAction(

                "deleteItem",

                {

                    sheetName:
                        "GocLogs",

                    id:
                        id
                },

                "Đã xóa lượt nộp thành công!"
            );
        }
    );
}


function selectCategory(cat) {

    document
        .getElementById(
            'selectedCatTitle'
        )
        .innerText =
            "LỊCH SỬ: " +
            cat;


    let tbody =
        document.getElementById(
            'categoryLogBody'
        );


    tbody.innerHTML =
        '';


    let catTotal =
        0;


    if (
        cat ===
        'Tiền quỹ QUÝ'
    ) {

        let logs =
            (quyLogs || [])
                .slice();


        logs.sort(
            function(a, b) {

                let yearDiff =

                    (parseInt(b.year) || 0) -

                    (parseInt(a.year) || 0);


                if (
                    yearDiff !==
                    0
                ) {

                    return yearDiff;
                }


                let qA =
                    parseInt(
                        String(
                            a.quarter || ''
                        )
                        .replace(
                            'Q',
                            ''
                        )
                    ) || 0;


                let qB =
                    parseInt(
                        String(
                            b.quarter || ''
                        )
                        .replace(
                            'Q',
                            ''
                        )
                    ) || 0;


                return (
                    qB -
                    qA
                );
            }
        );


        logs.forEach(
            function(log) {

                let amount =
                    parseInt(
                        log.amount
                    ) || 0;


                catTotal +=
                    amount;


                let safeLogName_ =
                    (typeof escapeHtml_ === 'function')
                        ? escapeHtml_(log.name)
                        : String(log.name || '');


                tbody.innerHTML += `

                    <tr class="border-b">

                        <td class="p-1.5">
                            ${log.quarter}/${log.year}
                        </td>

                        <td class="p-1.5 font-bold">
                            ${safeLogName_}
                        </td>

                        <td class="p-1.5 text-right font-bold text-emerald-700">
                            ${amount.toLocaleString('vi-VN')} đ
                        </td>

                        <td class="p-1.5 text-center">
                            -
                        </td>

                    </tr>
                `;
            }
        );
    }


    else if (
        cat ===
        'Tiền góc thực thu'
    ) {

        // (v2.0 fix) Cùng lý do như renderGocLogsTab()/renderCashbook() -
        // đây là view "gương" dựng từ GocLogs (không phải từ cashbookLogs
        // thật), nên cũng phải loại các dòng điều chỉnh trả tiền dư ra để
        // không hiện/tính trùng ở màn "Tiền góc thực thu" này.
        getRealGocLogs_()
            .forEach(
                function(g) {

                    let amount =
                        parseInt(
                            g.amount
                        ) || 0;


                    let idArg =
                        JSON.stringify(
                            String(g.id)
                        );


                    catTotal +=
                        amount;


                    let safeGocName_ =
                        (typeof escapeHtml_ === 'function')
                            ? escapeHtml_(g.name)
                            : String(g.name || '');


                    tbody.innerHTML += `

                        <tr class="border-b">

                            <td class="p-1.5">
                                ${formatVNTimeForDisplay_(g.time)}
                            </td>

                            <td class="p-1.5 font-bold">
                                ${safeGocName_}
                            </td>

                            <td class="
                                p-1.5
                                text-right
                                font-bold
                                ${
                                    amount < 0
                                        ? 'text-red-600'
                                        : 'text-emerald-700'
                                }
                            ">
                                ${amount.toLocaleString('vi-VN')} đ
                            </td>

                            <td class="
                                p-1.5
                                text-center
                                admin-only
                                ${
                                    (currentUserRole === 'admin' || currentUserRole === 'owner')
                                        ? ''
                                        : 'hidden'
                                }
                            ">

                                <button
                                    onclick='deleteGocLog(${idArg})'
                                    class="text-red-600 font-bold"
                                >

                                    <i class="fa-solid fa-trash"></i>

                                </button>

                            </td>

                        </tr>
                    `;
                }
            );
    }


    else {

        let filtered =
            (cashbookLogs || [])
                .filter(
                    function(c) {

                        return (
                            c.category ===
                            cat
                        );
                    }
                );


        filtered.forEach(
            function(c) {

                catTotal +=
                    parseInt(
                        c.amount
                    ) || 0;


                let safeCashNote_ =
                    (typeof escapeHtml_ === 'function')
                        ? escapeHtml_(c.note)
                        : String(c.note || '');


                tbody.innerHTML += `

                    <tr class="border-b">

                        <td class="p-1.5">
                            ${formatVNTimeForDisplay_(c.time)}
                        </td>

                        <td class="p-1.5 font-bold">
                            ${safeCashNote_}
                        </td>

                        <td class="p-1.5 text-right font-bold">
                            ${
                                (
                                    parseInt(
                                        c.amount
                                    ) || 0
                                )
                                .toLocaleString(
                                    'vi-VN'
                                )
                            } đ
                        </td>

                        <td class="
                            p-1.5
                            text-center
                            admin-only
                            ${
                                (currentUserRole === 'admin' || currentUserRole === 'owner')
                                    ? ''
                                    : 'hidden'
                            }
                        ">

                            <button
                                onclick="deleteCashbookLog(${c.id})"
                                class="text-red-600 font-bold"
                            >

                                <i class="fa-solid fa-trash"></i>

                            </button>

                        </td>

                    </tr>
                `;
            }
        );
    }


    document
        .getElementById(
            'selectedCatTotal'
        )
        .innerText =

            catTotal
                .toLocaleString(
                    'vi-VN'
                ) +

            " đ";


    applyRolePermissions();
}


// ======================================================
// DƯ ĐẦU KỲ THEO QUÝ
//
// "Dư đầu kỳ" hiển thị số dư tại thời điểm bắt đầu quý
// hiện tại (= số dư cuối quý trước chuyển sang), để CLB
// biết sau mỗi quý đóng quỹ còn lại bao nhiêu tiền.
//
// Cách tính: mốc dư ban đầu (Settings > DU_QUY_DAU) cộng
// dồn toàn bộ thu/chi xảy ra TRƯỚC ngày 1 của quý hiện tại.
// "Dư quỹ hiện tại" (cashbookBalance) vẫn là tổng số dư
// thực tế tính đến hôm nay, không đổi.
// ======================================================

function parseVNDateOnly_(text) {

    let match =
        String(text || '')
            .match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

    if (!match) {
        return null;
    }

    let day = parseInt(match[1]);
    let month = parseInt(match[2]);
    let year = parseInt(match[3]);

    if (!day || !month || !year) {
        return null;
    }

    return new Date(year, month - 1, day);
}


function getCurrentQuarterInfo_() {

    let now = new Date();
    let month = now.getMonth() + 1;
    let year = now.getFullYear();
    let quarterNum = Math.ceil(month / 3);
    let startMonthIndex = (quarterNum - 1) * 3;

    return {
        quarterNum: quarterNum,
        year: year,
        startDate: new Date(year, startMonthIndex, 1)
    };
}


function computeQuarterOpeningBalance_(quarterInfo) {

    // Mốc dư ban đầu (trước khi app bắt đầu ghi sổ).
    let base = openingBalance;

    let quyBefore =
        (quyLogs || [])
            .filter(function(q) {

                let qYear = parseInt(q.year) || 0;
                let qNum =
                    parseInt(String(q.quarter || '').replace('Q', '')) || 0;

                return (
                    qYear < quarterInfo.year ||
                    (qYear === quarterInfo.year && qNum < quarterInfo.quarterNum)
                );
            })
            .reduce(function(sum, q) {
                return sum + (parseInt(q.amount) || 0);
            }, 0);

    // (v2.0 fix) Cùng lý do loại trừ như totalGocThu trong renderCashbook()
    // ở trên - nếu không, "DƯ ĐẦU KỲ" của quý SAU sẽ tiếp tục tính trùng
    // 2 lần các khoản trả tiền dư thưởng đặt sân đã ghi qua
    // payOutMemberCreditByAdmin() (dashboard.js) mỗi khi sang quý mới.
    let gocBefore =
        getRealGocLogs_()
            .filter(function(g) {
                let d = parseVNDateOnly_(g.time);
                return d && d < quarterInfo.startDate;
            })
            .reduce(function(sum, g) {
                return sum + (parseInt(g.amount) || 0);
            }, 0);

    let cbBefore =
        (cashbookLogs || [])
            .filter(function(c) {
                let d = parseVNDateOnly_(c.time);
                return d && d < quarterInfo.startDate;
            });

    let thuBefore =
        cbBefore
            .filter(function(c) {
                return (
                    c.category === "Tiền bán sân" ||
                    c.category === "Tiền ủng hộ / Tài trợ"
                );
            })
            .reduce(function(sum, c) {
                return sum + (parseInt(c.amount) || 0);
            }, 0);

    let chiBefore =
        cbBefore
            .filter(function(c) {
                let cat = String(c.category || '');
                return (
                    cat.includes("Tiền app") ||
                    cat.includes("mua bóng") ||
                    cat.includes("thưởng") ||
                    cat.includes("liên hoan") ||
                    cat.includes("chi khác")
                );
            })
            .reduce(function(sum, c) {
                return sum + (parseInt(c.amount) || 0);
            }, 0);

    return base + quyBefore + gocBefore + thuBefore - chiBefore;
}


function renderCashbook() {

    let quarterInfo =
        getCurrentQuarterInfo_();

    let quarterOpeningBalance =
        computeQuarterOpeningBalance_(
            quarterInfo
        );

    let totalQuyThu =
        (quyLogs || [])
            .reduce(
                function(sum, log) {

                    return (
                        sum +
                        (
                            parseInt(
                                log.amount
                            ) || 0
                        )
                    );
                },
                0
            );


    // (v2.0 fix) "Dư Quỹ Hiện Tại" cộng NGUYÊN tổng GocLogs vào đây coi
    // như tiền thật đã về quỹ - đúng với addGocLog/addGocLogAdjustment
    // bình thường (điều chỉnh sổ sau khi chốt - P2). NHƯNG dòng điều
    // chỉnh do payOutMemberCreditByAdmin() (dashboard.js) tạo ra khi trả
    // tiền dư thưởng đặt sân cho thành viên KHÔNG phải tiền thật ra/vào
    // quỹ - nó chỉ để đưa Dư/Nợ riêng của thành viên đó về 0, còn dòng
    // tiền CHI thật đã được ghi RIÊNG 1 lần vào Cashbook mục "Tiền
    // thưởng đặt sân" (tính trong totalChi ở dưới). Cộng luôn cả ở đây
    // sẽ bị trừ trùng 2 lần trên quỹ thật (thành viên phát hiện) - loại
    // trừ đúng các dòng có thẻ đánh dấu này ra khỏi tổng.
    let totalGocThu =
        getRealGocLogs_()
            .reduce(
                function(sum, g) {

                    return (
                        sum +
                        (
                            parseInt(
                                g.amount
                            ) || 0
                        )
                    );
                },
                0
            );


    let banSan =
        (cashbookLogs || [])
            .filter(
                function(c) {

                    return (
                        c.category ===
                        "Tiền bán sân"
                    );
                }
            )
            .reduce(
                function(s, c) {

                    return (
                        s +
                        (
                            parseInt(
                                c.amount
                            ) || 0
                        )
                    );
                },
                0
            );


    let ungHo =
        (cashbookLogs || [])
            .filter(
                function(c) {

                    return (
                        c.category ===
                        "Tiền ủng hộ / Tài trợ"
                    );
                }
            )
            .reduce(
                function(s, c) {

                    return (
                        s +
                        (
                            parseInt(
                                c.amount
                            ) || 0
                        )
                    );
                },
                0
            );


    let totalChi =
        (cashbookLogs || [])
            .filter(
                function(c) {

                    let cat =
                        String(
                            c.category || ''
                        );


                    return (

                        cat.includes(
                            "Tiền app"
                        )

                        ||

                        cat.includes(
                            "mua bóng"
                        )

                        ||

                        cat.includes(
                            "thưởng"
                        )

                        ||

                        cat.includes(
                            "liên hoan"
                        )

                        ||

                        cat.includes(
                            "chi khác"
                        )
                    );
                }
            )
            .reduce(
                function(s, c) {

                    return (
                        s +
                        (
                            parseInt(
                                c.amount
                            ) || 0
                        )
                    );
                },
                0
            );


    let totalThu =
        totalQuyThu +
        totalGocThu +
        banSan +
        ungHo;


    let balance =
        openingBalance +
        totalThu -
        totalChi;


    document
        .getElementById(
            'cashbookBalance'
        )
        .innerText =
            balance
                .toLocaleString(
                    'vi-VN'
                ) +
            " đ";


    document
        .getElementById(
            'openingBalanceDisplay'
        )
        .innerText =
            quarterOpeningBalance
                .toLocaleString(
                    'vi-VN'
                ) +
            " đ";


    let openingLabelEl =
        document.getElementById(
            'openingBalanceLabel'
        );

    if (openingLabelEl) {

        openingLabelEl.innerText =
            "DƯ ĐẦU KỲ (Q" +
            quarterInfo.quarterNum +
            "/" +
            quarterInfo.year +
            "):";
    }


    selectCategory(
        'Tiền góc thực thu'
    );
}
// ======================================================
// ADMIN - CHỐT THÁNG
// ======================================================


function ensureMonthCloseAdminUI_() {

    let oldButton =
        document.getElementById(
            'btnMonthCloseAdmin'
        );


    // (v2.0 - theo đúng ma trận quyền của Chủ CLB): "Chốt tháng" cho
    // phép CẢ Owner và Admin, không chỉ riêng Admin như bản cũ - nếu
    // không sửa, Owner sẽ không bao giờ thấy nút này dù backend
    // (Router.gs.txt: closeMonth cấp độ 2) đã cho phép cả hai.
    if (
        currentUserRole !== 'admin' &&
        currentUserRole !== 'owner'
    ) {

        if (oldButton) {
            oldButton.remove();
        }

        return;
    }


    let monthSelect =
        document.getElementById(
            'selectFinanceMonth'
        );


    let yearSelect =
        document.getElementById(
            'selectFinanceYear'
        );


    if (
        !monthSelect ||
        !yearSelect
    ) {
        return;
    }


    let month =
        parseInt(
            monthSelect.value
        );


    let year =
        parseInt(
            yearSelect.value
        );


    if (!oldButton) {

        oldButton =
            document.createElement(
                'button'
            );


        oldButton.id =
            'btnMonthCloseAdmin';


        oldButton.type =
            'button';


        oldButton.onclick =
            openMonthClosePreview_;


        yearSelect.insertAdjacentElement(
            'afterend',
            oldButton
        );
    }


    let localStatus =
        getMonthCloseStatusLocal_(
            month,
            year
        );


    // Nếu local đã có snapshot/trạng thái khóa thì xử lý ngay.
    if (
        localStatus ===
        true
    ) {

        setMonthCloseButtonState_(
            'closed',
            month,
            year
        );

        return;
    }


    // Tháng tương lai chắc chắn chưa thể chốt.
    // Không gọi Apps Script chỉ để xác nhận điều đã được Backend cấm.
    if (
        isMonthClosePeriodFuture_(
            month,
            year
        )
    ) {

        setMonthCloseStatusLocal_(
            month,
            year,
            false
        );


        setMonthCloseButtonState_(
            'not_due',
            month,
            year
        );

        return;
    }


    if (
        !window.monthCloseStatusPending
    ) {

        window.monthCloseStatusPending =
            {};
    }


    if (
        !window.monthCloseStatusLastCheck
    ) {

        window.monthCloseStatusLastCheck =
            {};
    }


    let key =
        getMonthCloseStatusKey_(
            month,
            year
        );


    let lastCheck =
        window
            .monthCloseStatusLastCheck[
                key
            ];


    // Nếu vừa kiểm tra Cloud trong 15 giây gần nhất,
    // dùng lại kết quả. Với tháng chưa chốt, trạng thái nút
    // còn phụ thuộc kỳ đó đã kết thúc hay chưa.
    if (
        lastCheck &&
        (
            Date.now() -
            lastCheck.time
        ) < 15000
    ) {

        if (lastCheck.closed) {

            setMonthCloseButtonState_(
                'closed',
                month,
                year
            );

        } else if (
            isMonthClosePeriodEnded_(
                month,
                year
            )
        ) {

            setMonthCloseButtonState_(
                'open',
                month,
                year
            );

        } else {

            setMonthCloseButtonState_(
                'not_due',
                month,
                year
            );
        }

        return;
    }


    if (
        window
            .monthCloseStatusPending[
                key
            ]
    ) {

        setMonthCloseButtonState_(
            'checking',
            month,
            year
        );

        return;
    }


    // QUAN TRỌNG:
    // Luôn hỏi Backend trước, kể cả tháng hiện tại/tương lai.
    // Vì tháng hiện tại có thể đã được chốt trong dữ liệu TEST
    // hoặc một thiết bị khác vừa chốt. Chỉ sau khi Backend xác
    // nhận CHƯA chốt mới xét "chưa đến kỳ chốt".
    window
        .monthCloseStatusPending[
            key
        ] = true;


    setMonthCloseButtonState_(
        'checking',
        month,
        year
    );


    fetchMonthCloseStatusLight_(
        month,
        year,

        function(
            error,
            result
        ) {

            delete window
                .monthCloseStatusPending[
                    key
                ];


            if (error) {

                console.warn(
                    'MONTH CLOSE STATUS CHECK ERROR:',
                    error
                );


                setMonthCloseButtonState_(
                    'error',
                    month,
                    year
                );

                return;
            }


            let closed =
                !!(
                    result &&
                    result.isClosed ===
                        true
                );


            window
                .monthCloseStatusLastCheck[
                    key
                ] = {

                    time:
                        Date.now(),

                    closed:
                        closed
                };


            if (closed) {

                setMonthCloseButtonState_(
                    'closed',
                    month,
                    year
                );

            } else if (
                isMonthClosePeriodEnded_(
                    month,
                    year
                )
            ) {

                setMonthCloseButtonState_(
                    'open',
                    month,
                    year
                );

            } else {

                setMonthCloseButtonState_(
                    'not_due',
                    month,
                    year
                );
            }


            // fetchMonthCloseStatusLight_ đã nạp snapshot nếu
            // đây là tháng chốt chính xác. Render lại để bảng
            // sử dụng dữ liệu lịch sử thay vì Members.noOld hiện tại.
            if (
                typeof renderFinance ===
                'function'
            ) {

                renderFinance();
            }
        }
    );
}

function ensureMonthCloseModal_() {

    if (
        document.getElementById(
            'monthCloseModal'
        )
    ) {
        return;
    }


    let modal =
        document.createElement(
            'div'
        );


    modal.id =
        'monthCloseModal';


    modal.className =
        'hidden fixed inset-0 z-[9999] bg-black/50 items-center justify-center p-4';


    modal.innerHTML = `

        <div class="
            bg-white
            rounded-2xl
            shadow-2xl
            w-full
            max-w-2xl
            max-h-[90vh]
            overflow-y-auto
        ">

            <div class="
                px-5 py-4
                bg-red-700
                text-white
                rounded-t-2xl
            ">

                <div class="text-lg font-black">
                    <i class="fa-solid fa-lock mr-2"></i>
                    CHỐT TÀI CHÍNH THÁNG
                </div>

                <div
                    id="monthClosePeriod"
                    class="text-xs opacity-90 mt-1"
                ></div>

            </div>


            <div class="p-5 space-y-4">

                <div class="
                    bg-amber-50
                    border border-amber-300
                    rounded-xl
                    p-3
                    text-xs
                    font-semibold
                    text-amber-900
                ">

                    Sau khi chốt, hệ thống sẽ lưu lịch sử
                    tài chính của từng thành viên và chuyển
                    Dư/Nợ cuối kỳ thành Dư/Nợ đầu kỳ của
                    tháng tiếp theo.

                    <br><br>

                    Một tháng chỉ được chốt một lần.

                </div>


                <div
                    id="monthCloseSummary"
                    class="grid grid-cols-2 md:grid-cols-3 gap-3"
                ></div>


                <div class="
                    bg-red-50
                    border border-red-200
                    rounded-xl
                    p-3
                    text-xs
                    text-red-800
                    font-bold
                ">

                    Chỉ thực hiện sau khi đã đối soát xong
                    tiền góc, thưởng đặt sân và tiền thực nộp.

                </div>


                <div class="flex gap-3">

                    <button
                        type="button"
                        onclick="closeMonthCloseModal_()"
                        class="
                            flex-1
                            bg-slate-200
                            hover:bg-slate-300
                            text-slate-800
                            py-3
                            rounded-xl
                            font-black
                        "
                    >
                        HỦY
                    </button>


                    <button
                        type="button"
                        id="btnConfirmMonthClose"
                        onclick="executeMonthClose_()"
                        class="
                            flex-1
                            bg-red-700
                            hover:bg-red-800
                            text-white
                            py-3
                            rounded-xl
                            font-black
                        "
                    >
                        XÁC NHẬN CHỐT
                    </button>

                </div>

            </div>

        </div>
    `;


    document.body.appendChild(
        modal
    );
}


// ======================================================
// PREVIEW
// ======================================================


function buildMonthCloseClientPreview_(
    month,
    year
) {

    let rows =
        [];


    let totals = {

        opening:
            0,

        base:
            0,

        special:
            0,

        paid:
            0,

        reward:
            0,

        closing:
            0
    };


    (members || [])
        .forEach(
            function(member) {

                let f =
                    calculateUserFinanceForMonth(
                        member.name,
                        month,
                        year
                    );


                let row = {

                    name:
                        member.name,

                    openingBalance:
                        parseInt(
                            f.carryBalance
                        ) || 0,

                    baseFee:
                        parseInt(
                            f.cappedBaseFee
                        ) || 0,

                    specialFee:
                        parseInt(
                            f.monthSpecialBetFee
                        ) || 0,

                    paid:
                        parseInt(
                            f.monthPaidAmount
                        ) || 0,

                    reward:
                        parseInt(
                            f.monthRewardAmount
                        ) || 0,

                    closingBalance:
                        parseInt(
                            f.totalPay
                        ) || 0
                };


                rows.push(
                    row
                );


                totals.opening +=
                    row.openingBalance;


                totals.base +=
                    row.baseFee;


                totals.special +=
                    row.specialFee;


                totals.paid +=
                    row.paid;


                totals.reward +=
                    row.reward;


                totals.closing +=
                    row.closingBalance;
            }
        );


    return {

        month:
            parseInt(month),

        year:
            parseInt(year),

        memberCount:
            rows.length,

        rows:
            rows,

        totals:
            totals
    };
}


function applyMonthCloseLocalSnapshot_(
    preview
) {

    if (
        !preview ||
        !preview.rows
    ) {
        return;
    }


    if (
        !Array.isArray(
            window.monthlyBalances
        )
    ) {

        window.monthlyBalances =
            [];
    }


    preview.rows.forEach(
        function(row, idx) {

            let exists =
                window.monthlyBalances
                    .some(
                        function(item) {

                            return (
                                String(
                                    item.name || ''
                                )
                                .trim()
                                .toLowerCase() ===

                                String(
                                    row.name || ''
                                )
                                .trim()
                                .toLowerCase()

                                &&

                                parseInt(
                                    item.month
                                ) ===
                                parseInt(
                                    preview.month
                                )

                                &&

                                parseInt(
                                    item.year
                                ) ===
                                parseInt(
                                    preview.year
                                )
                            );
                        }
                    );


            if (!exists) {

                window.monthlyBalances.push({

                    id:
                        "LOCAL_" +
                        preview.year +
                        "_" +
                        preview.month +
                        "_" +
                        idx,

                    name:
                        row.name,

                    month:
                        preview.month,

                    year:
                        preview.year,

                    openingBalance:
                        row.openingBalance,

                    baseFee:
                        row.baseFee,

                    specialFee:
                        row.specialFee,

                    paid:
                        row.paid,

                    reward:
                        row.reward,

                    closingBalance:
                        row.closingBalance,

                    note:
                        "Local snapshot sau khi Backend xác nhận đã chốt",

                    localOnly:
                        true
                });
            }


            let member =
                (members || [])
                    .find(
                        function(item) {

                            return (
                                String(
                                    item.name || ''
                                )
                                .trim()
                                .toLowerCase() ===

                                String(
                                    row.name || ''
                                )
                                .trim()
                                .toLowerCase()
                            );
                        }
                    );


            if (member) {

                member.noOld =
                    row.closingBalance;
            }
        }
    );


    setMonthCloseStatusLocal_(
        preview.month,
        preview.year,
        true
    );
}


function showMonthClosePreviewModal_(
    month,
    year
) {

    let preview =
        buildMonthCloseClientPreview_(
            month,
            year
        );


    window.pendingMonthClosePreview =
        preview;


    ensureMonthCloseModal_();


    document.getElementById(
        'monthClosePeriod'
    ).innerText =
        `Tháng ${month}/${year} • ${preview.memberCount} thành viên`;


    function card_(
        title,
        amount,
        className
    ) {

        return `

            <div class="
                border rounded-xl p-3
                ${className}
            ">

                <div class="
                    text-[10px]
                    uppercase
                    font-bold
                    opacity-70
                ">
                    ${title}
                </div>

                <div class="
                    text-lg
                    font-black
                    mt-1
                ">
                    ${amount.toLocaleString('vi-VN')} đ
                </div>

            </div>
        `;
    }


    document.getElementById(
        'monthCloseSummary'
    ).innerHTML =

        card_(
            'Dư/Nợ đầu kỳ',
            preview.totals.opening,
            'bg-slate-50'
        )

        +

        card_(
            'Góc cơ bản',
            preview.totals.base,
            'bg-amber-50'
        )

        +

        card_(
            'Kèo đặc biệt',
            preview.totals.special,
            'bg-orange-50'
        )

        +

        card_(
            'Đã nộp',
            preview.totals.paid,
            'bg-emerald-50'
        )

        +

        card_(
            'Thưởng sân',
            preview.totals.reward,
            'bg-purple-50'
        )

        +

        card_(
            'Dư/Nợ cuối kỳ',
            preview.totals.closing,
            preview.totals.closing < 0
                ? 'bg-cyan-50 text-cyan-800'
                : 'bg-red-50 text-red-800'
        );


    let modal =
        document.getElementById(
            'monthCloseModal'
        );


    modal.classList.remove(
        'hidden'
    );


    modal.classList.add(
        'flex'
    );
}


function openMonthClosePreview_() {

    if (
        currentUserRole !== 'admin' &&
        currentUserRole !== 'owner'
    ) {
        return;
    }


    let month =
        parseInt(
            document.getElementById(
                'selectFinanceMonth'
            ).value
        );


    let year =
        parseInt(
            document.getElementById(
                'selectFinanceYear'
            ).value
        );


    if (
        isMonthClosed_(
            month,
            year
        )
    ) {

        setMonthCloseButtonState_(
            'closed',
            month,
            year
        );


        alert(
            `Tháng ${month}/${year} đã được chốt.`
        );

        return;
    }


    if (
        !isMonthClosePeriodEnded_(
            month,
            year
        )
    ) {

        setMonthCloseButtonState_(
            'not_due',
            month,
            year
        );


        alert(
            `Tháng ${month}/${year} chưa kết thúc.\n\nChỉ được chốt tài chính sau khi tháng đã kết thúc.`
        );

        return;
    }


    setMonthCloseButtonState_(
        'checking',
        month,
        year
    );


    fetchMonthCloseStatusLight_(
        month,
        year,

        function(
            error,
            result
        ) {

            if (error) {

                console.warn(
                    'MONTH CLOSE PREVIEW STATUS ERROR:',
                    error
                );


                setMonthCloseButtonState_(
                    'error',
                    month,
                    year
                );


                alert(
                    "Chưa kiểm tra được trạng thái chốt tháng trên Cloud.\n\n" +
                    "Hệ thống tạm khóa thao tác để tránh chốt trùng."
                );

                return;
            }


            if (
                result &&
                result.isClosed ===
                    true
            ) {

                setMonthCloseButtonState_(
                    'closed',
                    month,
                    year
                );


                alert(
                    `Tháng ${month}/${year} đã được chốt.`
                );

                return;
            }


            setMonthCloseButtonState_(
                'open',
                month,
                year
            );


            showMonthClosePreviewModal_(
                month,
                year
            );
        }
    );
}


function closeMonthCloseModal_() {

    let modal =
        document.getElementById(
            'monthCloseModal'
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
        'hidden'
    );


    modal.classList.remove(
        'flex'
    );
}


// ======================================================
// THỰC HIỆN CHỐT
// ======================================================


function executeMonthClose_() {

    let month =
        parseInt(
            document.getElementById(
                'selectFinanceMonth'
            ).value
        );


    let year =
        parseInt(
            document.getElementById(
                'selectFinanceYear'
            ).value
        );


    let confirmButton =
        document.getElementById(
            'btnConfirmMonthClose'
        );


    function resetConfirmButton_() {

        if (confirmButton) {

            confirmButton.disabled =
                false;


            confirmButton.innerText =
                'XÁC NHẬN CHỐT';
        }
    }


    if (
        isMonthClosed_(
            month,
            year
        )
    ) {

        closeMonthCloseModal_();


        setMonthCloseButtonState_(
            'closed',
            month,
            year
        );


        alert(
            `Tháng ${month}/${year} đã được chốt.`
        );

        return;
    }


    if (
        !isMonthClosePeriodEnded_(
            month,
            year
        )
    ) {

        closeMonthCloseModal_();


        setMonthCloseButtonState_(
            'not_due',
            month,
            year
        );


        alert(
            `Tháng ${month}/${year} chưa kết thúc.\n\nHệ thống không gửi lệnh chốt tháng.`
        );

        return;
    }


    if (confirmButton) {

        confirmButton.disabled =
            true;


        confirmButton.innerText =
            'ĐANG KIỂM TRA...';
    }


    setMonthCloseButtonState_(
        'checking',
        month,
        year
    );


    // ==================================================
    // KIỂM TRA BACKEND LẦN CUỐI TRƯỚC KHI POST
    // ==================================================

    fetchMonthCloseStatusLight_(
        month,
        year,

        function(
            statusError,
            statusResult
        ) {

            if (statusError) {

                console.warn(
                    'MONTH CLOSE PRECHECK ERROR:',
                    statusError
                );


                resetConfirmButton_();


                setMonthCloseButtonState_(
                    'error',
                    month,
                    year
                );


                alert(
                    "Chưa kiểm tra được trạng thái chốt tháng trên Cloud.\n\n" +
                    "Hệ thống không gửi lệnh chốt để tránh chốt trùng."
                );

                return;
            }


            if (
                statusResult &&
                statusResult.isClosed ===
                    true
            ) {

                closeMonthCloseModal_();


                setMonthCloseButtonState_(
                    'closed',
                    month,
                    year
                );


                resetConfirmButton_();


                alert(
                    `Tháng ${month}/${year} đã được chốt trước đó.`
                );

                return;
            }


            let preview =
                window.pendingMonthClosePreview;


            if (
                !preview ||
                parseInt(
                    preview.month
                ) !== month ||
                parseInt(
                    preview.year
                ) !== year
            ) {

                preview =
                    buildMonthCloseClientPreview_(
                        month,
                        year
                    );
            }


            if (confirmButton) {

                confirmButton.innerText =
                    'ĐANG CHỐT...';
            }


            showToast(
                `Đang chốt tháng ${month}/${year}...`
            );


            // ==================================================
            // POST CHỐT THÁNG
            // ==================================================

            // ==================================================
            // POST CHỐT THÁNG (v2.0)
            //
            // Trước đây (v1.6): POST no-cors "bắn và quên" rồi PHẢI
            // polling riêng để biết kết quả, và khi xác nhận xong lại
            // áp dụng "preview" tự tính ở CLIENT (có thể lệch với
            // dữ liệu thật) thay vì dữ liệu authoritative backend vừa
            // trả về (điểm yếu #4, phần cuối).
            //
            // v2.0: gọi thẳng qua BFF, ĐỌC ĐƯỢC kết quả thật ngay
            // trong 1 request - không cần polling nữa, và áp dụng
            // TRỰC TIẾP data.result (đã có đủ month/year/rows/totals
            // giống hệt shape "preview" cũ) làm snapshot chính thức.
            // ==================================================

            callBackendAction_(

                'closeMonth',

                { monthClose: { month: month, year: year } },

                generateIdempotencyKey_()
            )

            .then(
                function(data) {

                    if (
                        data.status !==
                        'SUCCESS'
                    ) {

                        resetConfirmButton_();

                        setMonthCloseButtonState_(
                            'error',
                            month,
                            year
                        );

                        alert(
                            (data.message || 'Không thể chốt tháng.') +
                            '\n\nChưa có gì được ghi nhận trên hệ thống.'
                        );

                        return;
                    }


                    closeMonthCloseModal_();


                    // Dùng ĐÚNG dữ liệu authoritative backend vừa trả
                    // về (data.result: {month,year,rows,totals,...})
                    // thay vì preview tự đoán ở client.
                    applyMonthCloseLocalSnapshot_(
                        data.result
                    );


                    if (
                        !window.monthCloseStatusLastCheck
                    ) {

                        window.monthCloseStatusLastCheck =
                            {};
                    }


                    window
                        .monthCloseStatusLastCheck[
                            getMonthCloseStatusKey_(
                                month,
                                year
                            )
                        ] = {

                            time:
                                Date.now(),

                            closed:
                                true
                        };


                    resetConfirmButton_();

                    setMonthCloseButtonState_(
                        'closed',
                        month,
                        year
                    );


                    showToast(
                        `Đã chốt tháng ${month}/${year} thành công!`
                    );


                    if (
                        typeof renderFinance ===
                        'function'
                    ) {

                        renderFinance();
                    }


                    if (
                        typeof renderDashboard ===
                        'function'
                    ) {

                        renderDashboard();
                    }


                    if (
                        typeof renderCashbook ===
                        'function'
                    ) {

                        renderCashbook();
                    }
                }
            )

            .catch(
                function(err) {

                    console.error(
                        'MONTH CLOSE POST ERROR:',
                        err
                    );


                    resetConfirmButton_();


                    setMonthCloseButtonState_(
                        'error',
                        month,
                        year
                    );


                    alert(
                        "Không thể kết nối hệ thống.\n\n" +
                        "Nếu vừa mất mạng NGAY SAU KHI gửi lệnh, có thể " +
                        "backend đã chốt thành công - vui lòng tải lại " +
                        "trang để kiểm tra trước khi bấm chốt lại " +
                        "(idempotencyKey đã gửi giúp chống chốt trùng)."
                    );
                }
            );
        },

        {
            maxAttempts: 3,
            timeoutMs: 7000,
            retryDelayMs: 1000
        }
    );
}

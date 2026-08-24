function renderGamification() {
    let curMonth = document.getElementById('selectFinanceMonth') ? document.getElementById('selectFinanceMonth').value : (new Date().getMonth() + 1);
    let curYear = document.getElementById('selectFinanceYear') ? document.getElementById('selectFinanceYear').value : new Date().getFullYear();
    
    document.getElementById('gamificationMonthLabel').innerText = `Tháng ${curMonth}/${curYear}`;

    let statsMap = {};
    if (members && members.length > 0) {
        members.forEach(m => { statsMap[m.name] = { name: m.name, matches: 0, wins: 0 }; });
    }

    matches.forEach(m => {
        let mTime = m.time || "";
        let isThisMonth = mTime.includes(`/${curMonth}/${curYear}`) || mTime.includes(` ${curMonth}/${curYear}`);
        if (!isThisMonth) return;

        let players = [m.p1_v1, m.p2_v1, m.p1_v2, m.p2_v2];
        players.forEach(p => {
            if (!p) return;
            if (!statsMap[p]) statsMap[p] = { name: p, matches: 0, wins: 0 };
            statsMap[p].matches++;
        });

        if (m.scoreA !== m.scoreB) {
            let winningTeam = m.scoreA > m.scoreB ? [m.p1_v1, m.p2_v1] : [m.p1_v2, m.p2_v2];
            winningTeam.forEach(p => { if (p && statsMap[p]) statsMap[p].wins++; });
        }
    });

    let arr = Object.values(statsMap);
    
    let mostMatches = [...arr].sort((a, b) => b.matches - a.matches)[0];
    document.getElementById('vuaCaysan').innerText = (mostMatches && mostMatches.matches > 0) ? `${mostMatches.name} (${mostMatches.matches} trận)` : "Chưa có dữ liệu";

    let mostWins = [...arr].sort((a, b) => b.wins - a.wins)[0];
    document.getElementById('vuaThangtran').innerText = (mostWins && mostWins.wins > 0) ? `${mostWins.name} (${mostWins.wins} trận thắng)` : "Chưa có dữ liệu";

    let qualified = arr.filter(x => x.matches >= 3);
    qualified.sort((a, b) => (b.wins / b.matches) - (a.wins / a.matches));
    let bestRate = qualified[0];
    document.getElementById('vuaTyletang').innerText = (bestRate && bestRate.matches > 0) ? `${bestRate.name} (${((bestRate.wins/bestRate.matches)*100).toFixed(0)}%)` : "Cần >= 3 trận";
}

function copyReminderText() {
    let mSel = document.getElementById('selectFinanceMonth').value;
    let ySel = document.getElementById('selectFinanceYear').value;

    let debtList = [];
    if (members && members.length > 0) {
        members.forEach(m => {
            let f = calculateUserFinanceForMonth(m.name, mSel, ySel);
            if (f.totalPay > 0) debtList.push(`- ${m.name}: ${f.totalPay.toLocaleString()} đ`);
        });
    }

    let text = `🎾 CLB TENNIS THĂNG LONG - NHẮC NỢ TÀI CHÍNH THÁNG ${mSel}/${ySel} 🎾\n`;
    text += `Thân gửi anh em, hệ thống ghi nhận các khoản đóng góp và góc tháng ${mSel} như sau:\n\n`;
    if (debtList.length === 0) text += `Tuyệt vời! Hiện tại tất cả anh em đều đã hoàn thành nghĩa vụ tài chính.\n`;
    else text += debtList.join('\n') + `\n\n`;
    
    text += `👉 Anh em chuyển khoản về:\n`;
    text += `- Ngân hàng: ${systemSettings.bankId} (${systemSettings.bankAccount})\n`;
    text += `- Chủ TK: ${systemSettings.accountName}\n`;
    text += `- Nội dung CK: Nop tien goc <Tên của bạn>\n`;
    text += `Trân trọng cảm ơn anh em! 🙏`;

    navigator.clipboard.writeText(text).then(() => {
        showToast("Đã sao chép nội dung tin nhắn nhắc nợ vào bộ nhớ tạm!");
    }).catch(err => { alert("Không thể tự động sao chép. Vui lòng thử lại!"); });
}

// ======================================================
// QUỸ QUÝ - HÀM DÙNG CHUNG
// ======================================================

function getCurrentQuyPeriod() {
    let now = new Date();

    return {
        quarter: "Q" + Math.ceil((now.getMonth() + 1) / 3),
        year: now.getFullYear()
    };
}


function findQuyLogForMember(memberName, quarter, year) {
    return (quyLogs || []).find(function(log) {
        return (
            String(log.name || '').trim().toLowerCase() ===
                String(memberName || '').trim().toLowerCase() &&

            String(log.quarter || '').trim().toUpperCase() ===
                String(quarter || '').trim().toUpperCase() &&

            parseInt(log.year) === parseInt(year)
        );
    });
}

function handleDashboardSubmit() {

    let main = document.getElementById('dashMainUser').value;
    let actType = document.querySelector('input[name="actType"]:checked').value;

    if (!members || members.length === 0) {
        members = defaultFallbackMembers;
    }

    let m = members.find(item => item.name === main) || members[0];


    // ==================================================
    // TIỀN GÓC
    // ==================================================

    if (actType === "goc") {

        switchTab('matches');


    // ==================================================
    // THƯỞNG SÂN 16H
    // ==================================================

    } else if (actType === "dat16") {

        showActionConfirm(
            `Xác nhận ghi nhận Thưởng sân 16h cho thành viên [${main}]?`,
            () => {

                let NOW = new Date().getTime();
                let TIME_LIMIT = 18 * 60 * 60 * 1000;

                let duplicateReward = bookingLogs.find(b => {
                    return (
                        b.name === main &&
                        b.frame === "16h-18h" &&
                        (
                            NOW - new Date(b.id || 0).getTime() <= TIME_LIMIT ||
                            b.time.includes(new Date().toLocaleDateString('vi-VN'))
                        )
                    );
                });

                if (duplicateReward) {

                    let confirmDup = confirm(
                        `⚠️ Thành viên [${main}] đã được ghi nhận Thưởng sân 16h trong vòng 18 giờ qua!\n\nBạn có muốn tiếp tục lưu (OK) hay hủy bỏ (Hủy)?`
                    );

                    if (!confirmDup) return;
                }


                let curMonth =
                    document.getElementById('selectFinanceMonth').value;

                let curYear =
                    document.getElementById('selectFinanceYear').value;


                let userBookingsThisMonth = bookingLogs.filter(b => {

                    if (b.name !== main) return false;

                    let t = b.time || "";

                    return (
                        t.includes(`/${curMonth}/${curYear}`) ||
                        t.includes(` ${curMonth}/${curYear}`)
                    );
                });


                if (
                    userBookingsThisMonth.length >=
                    systemSettings.maxRewardLimit
                ) {

                    alert(
                        `Thành viên ${main} đã đạt giới hạn tối đa ${systemSettings.maxRewardLimit} lần nhận thưởng đặt sân trong tháng này!`
                    );

                    return;
                }


                // (v2.0 fix) Backend (BookingService.addBookingData) giờ CHỈ
                // nhận `frameType` ("16h"/"18h") + `targetStt` - tự tính lại
                // reward/frame/time/name phía server, KHÔNG còn tin số liệu
                // client gửi lên (xem ghi chú đầu BookingService.txt). Thiếu
                // `frameType` khiến server luôn báo "Khung giờ không hợp lệ."
                // - đây chính là lỗi "thử nhiều lần vẫn không ghi nhận được
                // thưởng đặt sân". Vẫn giữ đủ id/time/name/frame/reward để
                // cache tạm (addBookingToLocalMonthCache_) và phần kiểm tra
                // trùng/hiển thị ở trên tiếp tục hoạt động ngay - server sẽ
                // bỏ qua các trường thừa này.
                let newBooking = {
                    id: Date.now(),
                    time: new Date().toLocaleString('vi-VN'),
                    name: main,
                    frame: "16h-18h",
                    reward: systemSettings.reward16h,
                    frameType: "16h",
                    targetStt: m.stt
                };


                enqueueAction(
                    "addBooking",
                    { booking: newBooking },
                    "Đã ghi nhận Thưởng sân 16h thành công!"
                );
            }
        );


    // ==================================================
    // THƯỞNG SÂN 18H
    // ==================================================

    } else if (actType === "dat18") {

        showActionConfirm(
            `Xác nhận ghi nhận Thưởng sân 18h cho thành viên [${main}]?`,
            () => {

                let NOW = new Date().getTime();
                let TIME_LIMIT = 18 * 60 * 60 * 1000;


                let duplicateReward = bookingLogs.find(b => {

                    return (
                        b.name === main &&
                        b.frame.includes("18h") &&
                        (
                            NOW - new Date(b.id || 0).getTime() <= TIME_LIMIT ||
                            b.time.includes(new Date().toLocaleDateString('vi-VN'))
                        )
                    );
                });


                if (duplicateReward) {

                    let confirmDup = confirm(
                        `⚠️ Thành viên [${main}] đã được ghi nhận Thưởng sân 18h trong vòng 18 giờ qua!\n\nBạn có muốn tiếp tục lưu (OK) hay hủy bỏ (Hủy)?`
                    );

                    if (!confirmDup) return;
                }


                let isHoangVanThai =
                    main.toLowerCase().includes("hoàng văn thái") ||
                    m.username === "Thanglong15";


                let rewardAmount =
                    isHoangVanThai
                        ? (parseInt(systemSettings.rewardCVTT5) || 0)
                        : systemSettings.reward18h;


                let frameLabel =
                    isHoangVanThai
                        ? "18h-20h (CVTT5)"
                        : "18h-20h";


                // (v2.0 fix) Cùng lý do như nhánh 16h ở trên - server tự
                // xác định CVTT5 qua Script Property CVTT5_MEMBER_STT dựa
                // trên targetStt, không dựa vào frame label client gửi.
                let newBooking = {
                    id: Date.now(),
                    time: new Date().toLocaleString('vi-VN'),
                    name: main,
                    frame: frameLabel,
                    reward: rewardAmount,
                    frameType: "18h",
                    targetStt: m.stt
                };


                enqueueAction(
                    "addBooking",
                    { booking: newBooking },

                    isHoangVanThai
                        ? `Đã ghi nhận lịch sân 18h (Hoàng Văn Thái đặc cách thưởng ${rewardAmount.toLocaleString('vi-VN')}đ)!`
                        : "Đã ghi nhận Thưởng sân 18h thành công!"
                );
            }
        );


    // ==================================================
    // XÁC NHẬN ĐÓNG QUỸ QUÝ
    // ==================================================
} else if (actType === "quy") {

    let period = getCurrentQuyPeriod();

    // ==================================================
    // 1. CHẶN TRÙNG NGAY TRÊN TRÌNH DUYỆT
    // ==================================================

    let existingLog = findQuyLogForMember(
        main,
        period.quarter,
        period.year
    );

    if (existingLog) {
        alert(
            `${main} đã xác nhận đóng quỹ ${period.quarter}/${period.year}.`
        );
        return;
    }


    showActionConfirm(
        `Xác nhận thành viên [${main}] đã chuyển khoản tiền quỹ ${period.quarter}/${period.year}?`,

        () => {

            let newQuyLog = {
                id: "QUY_" + Date.now(),
                time: new Date().toLocaleString('vi-VN'),
                name: main,
                quarter: period.quarter,
                year: period.year,
                amount: parseInt(systemSettings.quyAmount) || 0,
                note: "Xác nhận đóng đủ quỹ " + period.quarter + "/" + period.year
            };

            enqueueAction(
                "addQuyLog",
                { quyLog: newQuyLog },
                `Đã ghi nhận đóng quỹ ${period.quarter}/${period.year} thành công!`
            );
        }
    );

}

}

function renderDashboard() {
    if (!members || members.length === 0) members = defaultFallbackMembers;
    let main = document.getElementById('dashMainUser').value;
    if (!main && members.length > 0) main = members[0].name;
    if (!main) return;

    let f = calculateUserFinance(main);
    let m = members.find(item => item.name === main) || members[0];

    // ======================================================
    // KIỂM TRA QUỸ QUÝ HIỆN TẠI
    // ======================================================

    let period = getCurrentQuyPeriod();

    let hasPaidCurrentQuarter = !!findQuyLogForMember(
        m.name,
        period.quarter,
        period.year
    );

    let currentQuarter = period.quarter;
    let currentYear = period.year;

    let warningBanner =
        document.getElementById('quyWarningBanner');

    let hasOldDebt = (m.noOld || 0) > 0;

    let hasWarning =
        m.status === 'Đang tham gia' &&
        (hasOldDebt || !hasPaidCurrentQuarter);

    if (hasWarning) {
        warningBanner.classList.remove('hidden');
        warningBanner.classList.add('flex');

        let warningMsg = [];

        if (hasOldDebt) {
            warningMsg.push(
                `có số tiền Nợ cũ là ${m.noOld.toLocaleString()} đ`
            );
        }

        if (!hasPaidCurrentQuarter) {
            warningMsg.push(
                `chưa đóng quỹ ${currentQuarter}/${currentYear}`
            );
        }

        document.getElementById('quyWarningText').innerText =
            `${m.name} ơi, bạn ${warningMsg.join(' và ')}. Vui lòng hoàn thành nhé!`;

    } else {
        warningBanner.classList.add('hidden');
        warningBanner.classList.remove('flex');
    }

    document.getElementById('statTotal').innerText = f.totalMatchCount;
    let winRate = f.totalMatchCount > 0 ? ((f.totalWins / f.totalMatchCount) * 100).toFixed(0) + '%' : '0%';
    document.getElementById('statWins').innerText = f.totalWins + " (" + winRate + ")";
    document.getElementById('statDraws').innerText = f.totalDraws;
    document.getElementById('statLosses').innerText = f.totalLosses;

    let curMonth = document.getElementById('selectFinanceMonth').value;
    let curYear = document.getElementById('selectFinanceYear').value;
    let userBookingsThisMonth = bookingLogs.filter(b => {
        if (b.name !== main) return false;
        let t = b.time || "";
        return t.includes(`/${curMonth}/${curYear}`) || t.includes(` ${curMonth}/${curYear}`);
    });

    let totalReward = userBookingsThisMonth.reduce((sum, b) => sum + parseInt(b.reward), 0);
    document.getElementById('statReward').innerText = totalReward.toLocaleString() + " đ";

    document.getElementById('statDebt').innerText = f.totalPay.toLocaleString() + " đ";
    document.getElementById('statPaidDisplay').innerText = (m.paidUser || 0).toLocaleString() + " đ";

    let matchBody = document.getElementById('userMatchHistoryBody');
    matchBody.innerHTML = '';
    let userMatchesThisMonth = matches.filter(match => {
        let isUserIn = (match.p1_v1 === main || match.p2_v1 === main || match.p1_v2 === main || match.p2_v2 === main);
        if (!isUserIn) return false;
        let t = match.time || "";
        return t.includes(`/${curMonth}/${curYear}`) || t.includes(` ${curMonth}/${curYear}`);
    });

    userMatchesThisMonth.forEach((mItem, idx) => {
        let isV1 = (mItem.p1_v1 === main || mItem.p2_v1 === main);
        let teammate = isV1 ? (mItem.p1_v1 === main ? mItem.p2_v1 : mItem.p1_v1) : (mItem.p1_v2 === main ? mItem.p2_v2 : mItem.p1_v2);
        let opponents = isV1 ? (mItem.p1_v2 + " & " + mItem.p2_v2) : (mItem.p1_v1 + " & " + mItem.p2_v1);
        
        let displayScore = isV1 ? `${mItem.scoreA}-${mItem.scoreB}` : `${mItem.scoreB}-${mItem.scoreA}`;

        // (v2.0 - điểm yếu #9): teammate/opponents lấy từ tên thành
        // viên (dữ liệu người dùng có thể sửa qua "Sửa thành viên") -
        // phải escape trước khi chèn HTML.
        let esc_ = (typeof escapeHtml_ === 'function') ? escapeHtml_ : (s => String(s == null ? '' : s));

        matchBody.innerHTML += `<tr class="border-b"><td class="p-2 text-center font-bold">${userMatchesThisMonth.length - idx}</td><td class="p-2 font-semibold text-slate-800">${esc_(teammate)}</td><td class="p-2 font-semibold text-slate-800">${esc_(opponents)}</td><td class="p-2 text-center font-bold text-emerald-800">${displayScore}</td><td class="p-2 text-right font-bold text-amber-800">${mItem.specialBet > 0 ? parseInt(mItem.specialBet).toLocaleString() + 'đ' : '-'}</td></tr>`;
    });

    let rewardBody = document.getElementById('userRewardHistoryBody');
    rewardBody.innerHTML = '';
    userBookingsThisMonth.forEach(b => {
        rewardBody.innerHTML += `<tr class="border-b"><td class="p-1.5">${b.time}</td><td class="p-1.5 text-center font-bold text-amber-700">${b.frame}</td><td class="p-1.5 text-right font-black text-emerald-700">${parseInt(b.reward).toLocaleString()} đ</td></tr>`;
    });

    let gocBody = document.getElementById('userGocHistoryBody');
    gocBody.innerHTML = '';
    let userGocs = gocLogs.filter(g => g.name === main);
    if (userGocs.length === 0) {
        gocBody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-400 italic">Chưa có lượt nộp</td></tr>`;
    } else {
        userGocs.forEach(g => {
            // (v2.0 - điểm yếu #9): g.note là ghi chú tự do do người
            // dùng nhập khi nộp tiền góc - phải escape.
            let safeNote = (typeof escapeHtml_ === 'function') ? escapeHtml_(g.note || '-') : String(g.note || '-');

            gocBody.innerHTML += `
                <tr class="border-b">
                    <td class="p-1.5 text-slate-600">${g.time}</td>
                    <td class="p-1.5 text-right font-bold text-emerald-700">${parseInt(g.amount).toLocaleString()} đ</td>
                    <td class="p-1.5 text-slate-500 truncate max-w-[90px]">${safeNote}</td>
                </tr>
            `;
        });
    }
}


// ======================================================
// PHASE 3 A8 - DASHBOARD UI PATCH
//
// CHỈ cần thay dashboard.js.
// Không cần sửa index.html.
// ======================================================

(function () {

    function period_() {
        let now = new Date();
        return {
            month: now.getMonth() + 1,
            year: now.getFullYear()
        };
    }

    function money_(value) {
        return (parseInt(value) || 0).toLocaleString("vi-VN") + " đ";
    }

    function setText_(id, value) {
        let el = document.getElementById(id);
        if (el) el.innerText = value;
    }

    function monthMatches_() {
        let p = period_();

        if (typeof getMonthMatchesCached_ === "function") {
            return getMonthMatchesCached_(p.month, p.year) || [];
        }

        return (matches || []).filter(function (m) {
            return typeof isLogInMonth_ === "function"
                ? isLogInMonth_(m.time, p.month, p.year)
                : false;
        });
    }

    function monthBookings_() {
        let p = period_();

        if (typeof getMonthBookingsCached_ === "function") {
            return getMonthBookingsCached_(p.month, p.year) || [];
        }

        return (bookingLogs || []).filter(function (b) {
            return typeof isLogInMonth_ === "function"
                ? isLogInMonth_(b.time, p.month, p.year)
                : false;
        });
    }

    function lifetimeStats_(memberName) {
        let key = String(memberName || "").trim().toLowerCase();

        let stat = (window.memberStats || []).find(function (item) {
            return String(item.name || "").trim().toLowerCase() === key;
        });

        return {
            total: stat ? (parseInt(stat.totalMatches) || 0) : 0,
            wins: stat ? (parseInt(stat.wins) || 0) : 0,
            draws: stat ? (parseInt(stat.draws) || 0) : 0,
            losses: stat ? (parseInt(stat.losses) || 0) : 0
        };
    }

    function monthStats_(memberName, list) {
        let result = {
            total: 0,
            wins: 0,
            draws: 0,
            losses: 0
        };

        (list || []).forEach(function (m) {
            let isV1 =
                m.p1_v1 === memberName ||
                m.p2_v1 === memberName;

            let isV2 =
                m.p1_v2 === memberName ||
                m.p2_v2 === memberName;

            if (!isV1 && !isV2) return;

            let scoreA = parseInt(m.scoreA) || 0;
            let scoreB = parseInt(m.scoreB) || 0;

            result.total++;

            if (scoreA === scoreB) {
                result.draws++;
                return;
            }

            let isWin =
                (isV1 && scoreA > scoreB) ||
                (isV2 && scoreB > scoreA);

            if (isWin) result.wins++;
            else result.losses++;
        });

        return result;
    }

    function ensureStatsUi_() {
        if (document.getElementById("statLifetimeRate")) return;

        let statTotal = document.getElementById("statTotal");

        let grid =
            statTotal &&
            statTotal.parentElement &&
            statTotal.parentElement.parentElement
                ? statTotal.parentElement.parentElement
                : null;

        if (!grid) return;

        grid.className = "grid grid-cols-1 md:grid-cols-2 gap-3";

        grid.innerHTML = `
            <div class="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
                <div class="flex items-center justify-between gap-3 mb-3">
                    <div>
                        <span class="text-[10px] font-black text-emerald-800 uppercase tracking-wide">THÀNH TÍCH TỔNG</span>
                        <p class="text-[10px] text-slate-500 font-semibold mt-0.5">Toàn bộ lịch sử thi đấu</p>
                    </div>

                    <div class="bg-emerald-700 text-white rounded-xl px-3 py-2 text-center min-w-[72px]">
                        <span class="block text-[9px] uppercase font-bold opacity-80">Tổng trận</span>
                        <span id="statTotal" class="text-2xl font-black leading-none">0</span>
                    </div>
                </div>

                <div class="grid grid-cols-4 gap-2 text-center">
                    <div class="bg-blue-50 rounded-xl p-2 border border-blue-100">
                        <span class="block text-[9px] font-bold text-blue-600 uppercase">Thắng</span>
                        <span id="statWins" class="text-lg font-black text-blue-800">0</span>
                    </div>

                    <div class="bg-amber-50 rounded-xl p-2 border border-amber-100">
                        <span class="block text-[9px] font-bold text-amber-600 uppercase">Hòa</span>
                        <span id="statDraws" class="text-lg font-black text-amber-800">0</span>
                    </div>

                    <div class="bg-red-50 rounded-xl p-2 border border-red-100">
                        <span class="block text-[9px] font-bold text-red-600 uppercase">Thua</span>
                        <span id="statLosses" class="text-lg font-black text-red-800">0</span>
                    </div>

                    <div class="bg-slate-100 rounded-xl p-2 border border-slate-200">
                        <span class="block text-[9px] font-bold text-slate-600 uppercase">Tỷ lệ</span>
                        <span id="statLifetimeRate" class="text-lg font-black text-emerald-800">0%</span>
                    </div>
                </div>
            </div>

            <div class="bg-gradient-to-br from-blue-50 to-white p-4 rounded-2xl border border-blue-200 shadow-sm">
                <div class="flex items-center justify-between gap-3 mb-3">
                    <div>
                        <span id="statMonthLabel" class="text-[10px] font-black text-blue-800 uppercase tracking-wide">THÁNG --/----</span>
                        <p class="text-[10px] text-slate-500 font-semibold mt-0.5">Phong độ tháng hiện tại</p>
                    </div>

                    <div class="bg-blue-700 text-white rounded-xl px-3 py-2 text-center min-w-[72px]">
                        <span class="block text-[9px] uppercase font-bold opacity-80">Tổng trận</span>
                        <span id="statMonthTotal" class="text-2xl font-black leading-none">0</span>
                    </div>
                </div>

                <div class="grid grid-cols-4 gap-2 text-center">
                    <div class="bg-blue-50 rounded-xl p-2 border border-blue-100">
                        <span class="block text-[9px] font-bold text-blue-600 uppercase">Thắng</span>
                        <span id="statMonthWins" class="text-lg font-black text-blue-800">0</span>
                    </div>

                    <div class="bg-amber-50 rounded-xl p-2 border border-amber-100">
                        <span class="block text-[9px] font-bold text-amber-600 uppercase">Hòa</span>
                        <span id="statMonthDraws" class="text-lg font-black text-amber-800">0</span>
                    </div>

                    <div class="bg-red-50 rounded-xl p-2 border border-red-100">
                        <span class="block text-[9px] font-bold text-red-600 uppercase">Thua</span>
                        <span id="statMonthLosses" class="text-lg font-black text-red-800">0</span>
                    </div>

                    <div class="bg-slate-100 rounded-xl p-2 border border-slate-200">
                        <span class="block text-[9px] font-bold text-slate-600 uppercase">Tỷ lệ</span>
                        <span id="statMonthRate" class="text-lg font-black text-blue-800">0%</span>
                    </div>
                </div>
            </div>
        `;
    }

    function ensureFinanceUi_() {
        if (document.getElementById("dashboardQuyStatus")) return;

        let statReward = document.getElementById("statReward");

        let grid =
            statReward &&
            statReward.parentElement &&
            statReward.parentElement.parentElement
                ? statReward.parentElement.parentElement
                : null;

        if (!grid) return;

        grid.className =
            "bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-3";

        grid.innerHTML = `
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                    <div class="text-[10px] font-black text-emerald-900 uppercase">TÀI CHÍNH THÁNG HIỆN TẠI</div>
                    <div id="dashboardFinancePeriodLabel" class="text-[10px] text-slate-500 font-semibold mt-0.5">Tháng --/----</div>
                </div>

                <div id="dashboardQuyStatus" class="inline-flex items-center gap-1.5 self-start md:self-auto px-3 py-1.5 rounded-full text-[10px] font-black border bg-slate-100 text-slate-600 border-slate-200">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>Đang kiểm tra quỹ quý...</span>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
                <div class="bg-white p-3 rounded-xl border border-emerald-300 shadow-sm flex flex-col justify-between">
                    <div>
                        <span id="dashboardRewardLabel" class="text-[10px] font-bold text-slate-600 uppercase">THƯỞNG ĐẶT SÂN THÁNG:</span>
                        <div id="statReward" class="text-lg font-black text-emerald-700 mt-0.5">0 đ</div>

                        <div class="mt-2">
                            <span class="text-[10px] font-bold text-slate-600 uppercase">TỔNG CẦN ĐÓNG:</span>
                            <div id="statDebt" class="text-xl font-black text-red-600 mt-0.5">0 đ</div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onclick="openDashboardFinanceDetailModal()"
                        class="mt-3 w-full bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-[10px] px-3 py-2 rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    >
                        <i class="fa-solid fa-circle-info"></i>
                        Xem chi tiết tài chính
                    </button>
                </div>

                <div class="bg-white p-3 rounded-xl border border-emerald-300 shadow-sm">
                    <label class="block text-[10px] font-extrabold text-emerald-900 uppercase mb-1">Tự nhập tiền GÓC CK:</label>

                    <div class="flex gap-2">
                        <input type="number" id="userPaidInput" placeholder="Số tiền" class="w-full border rounded-lg p-2 text-xs font-bold text-slate-900">

                        <button onclick="submitUserPayment()" class="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] px-3 py-2 rounded-lg shadow whitespace-nowrap">
                            + NỘP
                        </button>
                    </div>

                    <p class="text-[10px] text-slate-500 mt-1">
                        Đã nộp tháng:
                        <span id="statPaidDisplay" class="font-bold text-emerald-700">0 đ</span>
                    </p>
                </div>

                <div class="bg-white p-2.5 rounded-xl border border-emerald-300 shadow-sm flex flex-col items-center text-center">
                    <span class="text-[9px] font-extrabold text-emerald-900 uppercase mb-1">MÃ QR (BẤM PHÓNG TO)</span>
                    <img id="dashQrImg" src="" alt="VietQR" onclick="openQRZoomModal()" class="w-20 h-20 object-contain rounded border cursor-pointer hover:scale-105 transition">
                </div>
            </div>
        `;
    }

    function ensureFinanceModal_() {
        if (document.getElementById("dashboardFinanceDetailModal")) return;

        document.body.insertAdjacentHTML(
            "beforeend",
            `
            <div id="dashboardFinanceDetailModal"
                 class="fixed inset-0 bg-slate-900/70 backdrop-blur-sm hidden items-center justify-center z-[260] p-4"
                 onclick="closeDashboardFinanceDetailModal()">

                <div class="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden"
                     onclick="event.stopPropagation()">

                    <div class="bg-emerald-800 text-white px-5 py-4 flex items-start justify-between gap-3">
                        <div>
                            <h3 class="font-black text-sm uppercase flex items-center gap-2">
                                <i class="fa-solid fa-file-invoice-dollar text-amber-300"></i>
                                CHI TIẾT TÀI CHÍNH
                            </h3>

                            <p id="dashboardFinanceDetailMember" class="text-xs font-bold text-emerald-100 mt-1">Thành viên</p>
                            <p id="dashboardFinanceDetailPeriod" class="text-[10px] text-emerald-200 mt-0.5">Tháng --/----</p>
                        </div>

                        <button type="button"
                                onclick="closeDashboardFinanceDetailModal()"
                                class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div class="p-5 space-y-3">
                        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
                            <div class="flex justify-between items-center gap-3">
                                <span class="font-bold text-slate-600">Dư/Nợ đầu kỳ</span>
                                <span id="dashboardFdOpening" class="font-black text-slate-900">0 đ</span>
                            </div>

                            <div class="flex justify-between items-center gap-3">
                                <span class="font-bold text-slate-600">+ Góc cơ bản</span>
                                <span id="dashboardFdBase" class="font-black text-amber-800">0 đ</span>
                            </div>

                            <div class="flex justify-between items-center gap-3">
                                <span class="font-bold text-slate-600">+ Kèo đặc biệt</span>
                                <span id="dashboardFdSpecial" class="font-black text-orange-700">0 đ</span>
                            </div>

                            <div class="flex justify-between items-center gap-3">
                                <span class="font-bold text-slate-600">- Đã nộp</span>
                                <span id="dashboardFdPaid" class="font-black text-emerald-700">0 đ</span>
                            </div>

                            <div class="flex justify-between items-center gap-3">
                                <span class="font-bold text-slate-600">- Thưởng sân</span>
                                <span id="dashboardFdReward" class="font-black text-purple-700">0 đ</span>
                            </div>

                            <div class="border-t border-dashed border-slate-300 pt-3 mt-2 flex justify-between items-center gap-3">
                                <span id="dashboardFdClosingLabel" class="font-black text-slate-800 uppercase">= Còn cần đóng</span>
                                <span id="dashboardFdClosing" class="font-black text-xl text-red-600">0 đ</span>
                            </div>
                        </div>

                        <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[10px] font-semibold text-blue-900 leading-relaxed">
                            Công thức: Dư/Nợ đầu kỳ + Góc cơ bản + Kèo đặc biệt - Đã nộp - Thưởng sân = Dư/Nợ cuối kỳ.
                        </div>

                        <!-- (v2.0) 2 nút cho Admin/Owner, hiện tùy dấu của "còn cần
                        đóng"/"đang dư" (KHÔNG dùng class admin-only chung - ẩn/hiện
                        tự quản lý trong openDashboardFinanceDetailModal() vì còn phụ
                        thuộc số tiền, không chỉ vai trò, xem hàm đó + markMemberFullyPaidByAdmin()/
                        payOutMemberCreditByAdmin()). Mặc định ẩn để tránh nháy hình
                        trước khi JS tính lại đúng trạng thái. -->
                        <button type="button"
                                id="dashboardFdMarkPaidBtn"
                                onclick="markMemberFullyPaidByAdmin()"
                                class="hidden w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-2">
                            <i class="fa-solid fa-circle-check"></i>
                            Xác nhận ĐÃ NỘP đủ (ghi hộ thành viên)
                        </button>

                        <!-- Thành viên đang DƯ (thưởng sân > tiền cần đóng) và CLB
                        đã trả tiền dư đó bằng tiền mặt/CK cho họ - đưa Dư/Nợ về 0 +
                        ghi 1 khoản CHI "Tiền thưởng đặt sân" vào Sổ Thu Chi, tránh
                        Admin phải tự sửa tay Dư/Nợ ở Bảng Tổng Kết. -->
                        <button type="button"
                                id="dashboardFdPayoutBtn"
                                onclick="payOutMemberCreditByAdmin()"
                                class="hidden w-full bg-cyan-600 hover:bg-cyan-700 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-2">
                            <i class="fa-solid fa-hand-holding-dollar"></i>
                            Đã trả tiền (thành viên đang dư)
                        </button>

                        <button type="button"
                                onclick="closeDashboardFinanceDetailModal()"
                                class="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-black py-2.5 rounded-xl text-xs">
                            ĐÓNG
                        </button>
                    </div>
                </div>
            </div>
            `
        );
    }

    function ensureUi_() {
        ensureStatsUi_();
        ensureFinanceUi_();
        ensureFinanceModal_();
    }

    function updateQuarterStatus_(memberName) {
        let badge = document.getElementById("dashboardQuyStatus");
        if (!badge) return;

        let p = getCurrentQuyPeriod();

        let paid =
            !!findQuyLogForMember(
                memberName,
                p.quarter,
                p.year
            );

        if (paid) {
            badge.className =
                "inline-flex items-center gap-1.5 self-start md:self-auto px-3 py-1.5 rounded-full text-[10px] font-black border bg-emerald-100 text-emerald-800 border-emerald-300";

            badge.innerHTML =
                `<i class="fa-solid fa-circle-check"></i><span>Đã đóng quỹ ${p.quarter}/${p.year}</span>`;
        } else {
            badge.className =
                "inline-flex items-center gap-1.5 self-start md:self-auto px-3 py-1.5 rounded-full text-[10px] font-black border bg-amber-100 text-amber-800 border-amber-300";

            badge.innerHTML =
                `<i class="fa-solid fa-circle-exclamation"></i><span>Chưa đóng quỹ ${p.quarter}/${p.year}</span>`;
        }
    }

    function renderNewDashboardValues_() {
        if (!members || members.length === 0) {
            members = defaultFallbackMembers;
        }

        let mainEl = document.getElementById("dashMainUser");
        if (!mainEl) return;

        let main =
            mainEl.value ||
            (members[0] ? members[0].name : "");

        if (!main) return;

        let p = period_();
        let life = lifetimeStats_(main);
        let monthList = monthMatches_();
        let monthStat = monthStats_(main, monthList);

        let finance =
            calculateUserFinanceForMonth(
                main,
                p.month,
                p.year
            );

        let lifeRate =
            life.total > 0
                ? ((life.wins / life.total) * 100).toFixed(0) + "%"
                : "0%";

        let monthRate =
            monthStat.total > 0
                ? ((monthStat.wins / monthStat.total) * 100).toFixed(0) + "%"
                : "0%";

        setText_("statTotal", life.total);
        setText_("statWins", life.wins);
        setText_("statDraws", life.draws);
        setText_("statLosses", life.losses);
        setText_("statLifetimeRate", lifeRate);

        setText_("statMonthLabel", `THÁNG ${p.month}/${p.year}`);
        setText_("statMonthTotal", monthStat.total);
        setText_("statMonthWins", monthStat.wins);
        setText_("statMonthDraws", monthStat.draws);
        setText_("statMonthLosses", monthStat.losses);
        setText_("statMonthRate", monthRate);

        setText_("dashboardFinancePeriodLabel", `Tháng ${p.month}/${p.year}`);
        setText_("dashboardRewardLabel", `THƯỞNG ĐẶT SÂN THÁNG ${p.month}:`);
        setText_("statReward", money_(finance.monthRewardAmount));
        setText_("statPaidDisplay", money_(finance.monthPaidAmount));

        let debtEl = document.getElementById("statDebt");

        if (debtEl) {
            debtEl.innerText = money_(finance.totalPay);

            debtEl.className =
                finance.totalPay < 0
                    ? "text-xl font-black text-cyan-700 mt-0.5"
                    : (
                        finance.totalPay > 0
                            ? "text-xl font-black text-red-600 mt-0.5"
                            : "text-xl font-black text-emerald-700 mt-0.5"
                    );
        }

        updateQuarterStatus_(main);

        let qr = document.getElementById("dashQrImg");

        if (qr) {
            qr.src =
                `https://img.vietqr.io/image/` +
                `${systemSettings.bankId}-` +
                `${systemSettings.bankAccount}-compact2.png` +
                `?accountName=${encodeURIComponent(systemSettings.accountName)}`;
        }

        // Nhật ký trận - luôn là tháng hiện tại
        let matchBody =
            document.getElementById(
                "userMatchHistoryBody"
            );

        let userMatches =
            monthList
                .filter(function (m) {
                    return (
                        m.p1_v1 === main ||
                        m.p2_v1 === main ||
                        m.p1_v2 === main ||
                        m.p2_v2 === main
                    );
                })
                .slice()
                .sort(function (a, b) {
                    return (parseInt(b.id) || 0) - (parseInt(a.id) || 0);
                });

        if (matchBody) {
            matchBody.innerHTML = "";

            if (userMatches.length === 0) {
                matchBody.innerHTML =
                    `<tr><td colspan="5" class="p-3 text-center text-slate-400 italic">Chưa có trận trong tháng ${p.month}/${p.year}</td></tr>`;
            } else {
                userMatches.forEach(function (m, idx) {
                    let isV1 =
                        m.p1_v1 === main ||
                        m.p2_v1 === main;

                    let teammate =
                        isV1
                            ? (
                                m.p1_v1 === main
                                    ? m.p2_v1
                                    : m.p1_v1
                            )
                            : (
                                m.p1_v2 === main
                                    ? m.p2_v2
                                    : m.p1_v2
                            );

                    let opponents =
                        isV1
                            ? `${m.p1_v2} & ${m.p2_v2}`
                            : `${m.p1_v1} & ${m.p2_v1}`;

                    let score =
                        isV1
                            ? `${m.scoreA}-${m.scoreB}`
                            : `${m.scoreB}-${m.scoreA}`;

                    let special =
                        parseInt(m.specialBet) > 0
                            ? parseInt(m.specialBet).toLocaleString("vi-VN") + "đ"
                            : "-";

                    let escTeammate_ = (typeof escapeHtml_ === 'function') ? escapeHtml_(teammate) : String(teammate || '');
                    let escOpponents_ = (typeof escapeHtml_ === 'function') ? escapeHtml_(opponents) : String(opponents || '');

                    matchBody.innerHTML += `
                        <tr class="border-b">
                            <td class="p-2 text-center font-bold">${userMatches.length - idx}</td>
                            <td class="p-2 font-semibold text-slate-800">${escTeammate_}</td>
                            <td class="p-2 font-semibold text-slate-800">${escOpponents_}</td>
                            <td class="p-2 text-center font-bold text-emerald-800">${score}</td>
                            <td class="p-2 text-right font-bold text-amber-800">${special}</td>
                        </tr>
                    `;
                });
            }
        }

        // Thưởng sân - luôn là tháng hiện tại
        let rewardBody =
            document.getElementById(
                "userRewardHistoryBody"
            );

        let userBookings =
            monthBookings_()
                .filter(function (b) {
                    return b.name === main;
                })
                .slice()
                .sort(function (a, b) {
                    return (parseInt(b.id) || 0) - (parseInt(a.id) || 0);
                });

        if (rewardBody) {
            rewardBody.innerHTML = "";

            if (userBookings.length === 0) {
                rewardBody.innerHTML =
                    `<tr><td colspan="3" class="p-3 text-center text-slate-400 italic">Chưa có thưởng sân trong tháng</td></tr>`;
            } else {
                userBookings.forEach(function (b) {
                    rewardBody.innerHTML += `
                        <tr class="border-b">
                            <td class="p-1.5">${b.time}</td>
                            <td class="p-1.5 text-center font-bold text-amber-700">${b.frame}</td>
                            <td class="p-1.5 text-right font-black text-emerald-700">${money_(b.reward)}</td>
                        </tr>
                    `;
                });
            }
        }

        // Lịch sử nộp góc - luôn là tháng hiện tại
        let gocBody =
            document.getElementById(
                "userGocHistoryBody"
            );

        let userGocs =
            (gocLogs || [])
                .filter(function (g) {
                    return (
                        g.name === main &&
                        (
                            typeof isLogInMonth_ !== "function" ||
                            isLogInMonth_(
                                g.time,
                                p.month,
                                p.year
                            )
                        )
                    );
                })
                .slice()
                .sort(function (a, b) {
                    return (parseInt(b.id) || 0) - (parseInt(a.id) || 0);
                });

        if (gocBody) {
            gocBody.innerHTML = "";

            if (userGocs.length === 0) {
                gocBody.innerHTML =
                    `<tr><td colspan="3" class="p-3 text-center text-slate-400 italic">Chưa có lượt nộp trong tháng</td></tr>`;
            } else {
                userGocs.forEach(function (g) {
                    let safeNote_ = (typeof escapeHtml_ === 'function') ? escapeHtml_(g.note || "-") : String(g.note || "-");

                    gocBody.innerHTML += `
                        <tr class="border-b">
                            <td class="p-1.5 text-slate-600">${g.time}</td>
                            <td class="p-1.5 text-right font-bold text-emerald-700">${money_(g.amount)}</td>
                            <td class="p-1.5 text-slate-500 truncate max-w-[90px]">${safeNote_}</td>
                        </tr>
                    `;
                });
            }
        }
    }

    // Giữ nguyên renderDashboard cũ làm lớp nền,
    // sau đó A8 chỉ nâng UI và ghi đè số liệu cần thiết.
    const renderDashboardBeforeA8_ = renderDashboard;

    renderDashboard = function () {
        renderDashboardBeforeA8_.apply(this, arguments);

        ensureUi_();

        renderNewDashboardValues_();
    };

    window.openDashboardFinanceDetailModal =
        function () {
            ensureUi_();

            if (!members || members.length === 0) {
                members = defaultFallbackMembers;
            }

            let mainEl =
                document.getElementById(
                    "dashMainUser"
                );

            let main =
                mainEl && mainEl.value
                    ? mainEl.value
                    : (
                        members[0]
                            ? members[0].name
                            : ""
                    );

            if (!main) return;

            let p = period_();

            let f =
                calculateUserFinanceForMonth(
                    main,
                    p.month,
                    p.year
                );

            setText_(
                "dashboardFinanceDetailMember",
                main
            );

            setText_(
                "dashboardFinanceDetailPeriod",
                `Tháng ${p.month}/${p.year}`
            );

            setText_(
                "dashboardFdOpening",
                money_(f.carryBalance)
            );

            setText_(
                "dashboardFdBase",
                money_(f.cappedBaseFee)
            );

            setText_(
                "dashboardFdSpecial",
                money_(f.monthSpecialBetFee)
            );

            setText_(
                "dashboardFdPaid",
                money_(f.monthPaidAmount)
            );

            setText_(
                "dashboardFdReward",
                money_(f.monthRewardAmount)
            );

            let closing =
                parseInt(
                    f.totalPay
                ) || 0;

            let label =
                document.getElementById(
                    "dashboardFdClosingLabel"
                );

            let amount =
                document.getElementById(
                    "dashboardFdClosing"
                );

            if (label) {
                label.innerText =
                    closing < 0
                        ? "= Thành viên đang dư"
                        : "= Còn cần đóng";
            }

            if (amount) {
                amount.innerText = money_(closing);

                amount.className =
                    closing < 0
                        ? "font-black text-xl text-cyan-700"
                        : (
                            closing > 0
                                ? "font-black text-xl text-red-600"
                                : "font-black text-xl text-emerald-700"
                        );
            }

            let modal =
                document.getElementById(
                    "dashboardFinanceDetailModal"
                );

            if (modal) {
                modal.classList.remove("hidden");
                modal.classList.add("flex");
            }

            // (v2.0) 2 nút Admin/Owner: hiện đúng 1 trong 2 tùy dấu của
            // "closing" - không dùng chung cơ chế admin-only/applyRolePermissions()
            // vì còn phụ thuộc số tiền (vd: Admin nhưng thành viên không nợ/không
            // dư thì KHÔNG hiện nút nào), nên tự tính ở đây mỗi lần mở modal.
            let isAdminOrOwner =
                currentUserRole === "admin" ||
                currentUserRole === "owner";

            let markPaidBtn =
                document.getElementById(
                    "dashboardFdMarkPaidBtn"
                );

            let payoutBtn =
                document.getElementById(
                    "dashboardFdPayoutBtn"
                );

            if (markPaidBtn) {
                markPaidBtn.classList.toggle(
                    "hidden",
                    !(isAdminOrOwner && closing > 0)
                );
            }

            if (payoutBtn) {
                payoutBtn.classList.toggle(
                    "hidden",
                    !(isAdminOrOwner && closing < 0)
                );
            }
        };

    window.closeDashboardFinanceDetailModal =
        function () {
            let modal =
                document.getElementById(
                    "dashboardFinanceDetailModal"
                );

            if (!modal) return;

            modal.classList.add("hidden");
            modal.classList.remove("flex");
        };

    // ==================================================
    // (v2.0) ADMIN/OWNER GHI HỘ "ĐÃ NỘP ĐỦ TIỀN GÓC"
    // ==================================================
    // Lý do: nhiều thành viên (đặc biệt người lớn tuổi) chuyển khoản
    // riêng đúng số tiền thông báo cho thủ quỹ (Nguyễn Anh Thi) nhưng
    // không tự thao tác "Tự nhập tiền GÓC CK" trên app - Admin/Owner
    // trước đây phải tự tính lại đúng số "còn cần đóng" rồi nhập tay.
    // Nút này lấy ĐÚNG số tiền hệ thống đang tính cho thành viên đang
    // xem (main = dashMainUser, tháng hiện tại) và ghi 1 LẦN xuống CẢ
    // 2 nơi: GocLogs (để trừ vào "còn cần đóng" của thành viên - đúng
    // vai trò hiện có của addGocLog) và Cashbook mục "Tiền góc thực
    // thu" (để sổ thu chi thật của CLB phản ánh đúng khoản tiền mặt
    // đã về tay thủ quỹ - trước giờ 2 sổ này hoàn toàn tách rời, addGocLog
    // không tự động ghi Cashbook). Admin/Owner vẫn có thể chỉnh sửa/xóa
    // lại 2 dòng này sau đó ở tab Nộp Tiền/Sổ Thu Chi như bình thường
    // nếu ghi nhầm.
    window.markMemberFullyPaidByAdmin =
        function () {

            if (currentUserRole !== "admin" && currentUserRole !== "owner") {
                alert("Chỉ Admin hoặc Owner mới được dùng chức năng này.");
                return;
            }

            if (!members || members.length === 0) {
                members = defaultFallbackMembers;
            }

            let mainEl = document.getElementById("dashMainUser");
            let main = mainEl && mainEl.value
                ? mainEl.value
                : (members[0] ? members[0].name : "");

            if (!main) return;

            let p = period_();
            let f = calculateUserFinanceForMonth(main, p.month, p.year);
            let amountDue = parseInt(f.totalPay) || 0;

            if (amountDue <= 0) {
                alert(
                    `Thành viên [${main}] hiện không còn khoản tiền góc nào cần đóng trong tháng ${p.month}/${p.year} (đã nộp đủ hoặc đang dư quỹ) - không cần ghi thêm.`
                );
                return;
            }

            showActionConfirm(
                `Xác nhận thành viên [${main}] ĐÃ CHUYỂN KHOẢN đủ ${amountDue.toLocaleString('vi-VN')} đ cho tháng ${p.month}/${p.year}?\n\n` +
                `Hệ thống sẽ tự ghi 1 dòng "Nộp tiền góc" và 1 dòng Cashbook (Tiền góc thực thu) đúng bằng số tiền này. ` +
                `CHỈ xác nhận khi bạn chắc chắn tiền đã thực sự chuyển vào tài khoản thủ quỹ.`,
                () => {

                    let newGoc = {
                        id: Date.now(),
                        time: new Date().toLocaleString('vi-VN'),
                        name: main,
                        amount: amountDue,
                        note: `${loggedInMemberName || 'Admin/Owner'} xác nhận đã nộp đủ (chuyển khoản riêng cho thủ quỹ)`
                    };

                    enqueueAction(
                        "addGocLog",
                        { gocLog: newGoc },
                        `Đã ghi nhận [${main}] nộp đủ tiền góc tháng ${p.month}/${p.year}!`
                    );

                    let newCashbook = {
                        id: Date.now(),
                        category: "Tiền góc thực thu",
                        amount: amountDue,
                        note: `${main} đã nộp đủ tháng ${p.month}/${p.year} (xác nhận qua nút "Đã nộp" - ${loggedInMemberName || 'Admin/Owner'})`,
                        time: new Date().toLocaleDateString('vi-VN')
                    };

                    enqueueAction(
                        "addCashbook",
                        { cashbook: newCashbook },
                        "Đã ghi nhận vào Sổ Thu Chi!"
                    );

                    closeDashboardFinanceDetailModal();

                    if (typeof renderDashboard === "function") {
                        renderDashboard();
                    }
                }
            );
        };

    // ==================================================
    // (v2.0) ADMIN/OWNER TRẢ TIỀN DƯ (THƯỞNG SÂN) BẰNG TIỀN MẶT
    // ==================================================
    // Trường hợp ngược lại với markMemberFullyPaidByAdmin(): thành
    // viên có Thưởng sân tích lũy nhiều hơn số Góc cơ bản cần đóng
    // ("closing" = f.totalPay ÂM, hiển thị "THÀNH VIÊN ĐANG DƯ"). Thay
    // vì để khoản dư đó tiếp tục treo sang tháng sau, CLB trả thẳng
    // bằng tiền mặt/CK cho thành viên - nút này:
    // 1. Ghi 1 dòng addGocLogAdjustment (P2 - CHỈ Admin/Owner, cho phép
    //    số âm, luôn ở kỳ hiện tại) với amount = ĐÚNG closing (số âm) để
    //    trừ thẳng vào "Đã nộp" của tháng, đưa Dư/Nợ về CHÍNH XÁC 0 -
    //    không dùng addGocLog thường vì action đó bắt buộc amount > 0
    //    (addGocLogData: "Số tiền góc phải lớn hơn 0").
    // 2. Ghi 1 khoản CHI vào Cashbook đúng mục có sẵn "Tiền thưởng đặt
    //    sân" (nằm trong CASHBOOK_ALLOWED_CATEGORIES_ - Router đã cho
    //    phép) bằng đúng số tiền dương đã trả - khoản này tự động hiện
    //    trong "Lịch sử: Tiền thưởng đặt sân" ở tab Sổ Thu Chi vì UI đó
    //    vốn lọc theo category, không cần sửa gì thêm ở tab Sổ Thu Chi.
    window.payOutMemberCreditByAdmin =
        function () {

            if (currentUserRole !== "admin" && currentUserRole !== "owner") {
                alert("Chỉ Admin hoặc Owner mới được dùng chức năng này.");
                return;
            }

            if (!members || members.length === 0) {
                members = defaultFallbackMembers;
            }

            let mainEl = document.getElementById("dashMainUser");
            let main = mainEl && mainEl.value
                ? mainEl.value
                : (members[0] ? members[0].name : "");

            if (!main) return;

            let p = period_();
            let f = calculateUserFinanceForMonth(main, p.month, p.year);
            let closing = parseInt(f.totalPay) || 0;

            if (closing >= 0) {
                alert(
                    `Thành viên [${main}] hiện không có khoản tiền dư nào cần trả trong tháng ${p.month}/${p.year}.`
                );
                return;
            }

            let payoutAmount = Math.abs(closing);

            showActionConfirm(
                `Xác nhận CLB ĐÃ TRẢ ${payoutAmount.toLocaleString('vi-VN')} đ tiền dư (thưởng đặt sân) bằng tiền mặt/CK cho thành viên [${main}] - tháng ${p.month}/${p.year}?\n\n` +
                `Dư/Nợ tháng này của thành viên sẽ về 0 đ, đồng thời hệ thống ghi 1 khoản CHI "Tiền thưởng đặt sân" vào Sổ Thu Chi. ` +
                `CHỈ xác nhận khi bạn đã thực sự chi tiền cho thành viên.`,
                () => {

                    let adjustment = {
                        id: Date.now(),
                        time: new Date().toLocaleString('vi-VN'),
                        name: main,
                        // closing đang ÂM - ghi ĐÚNG giá trị này (không đổi dấu) để
                        // trừ thẳng vào Đã nộp, đưa Dư/Nợ về đúng 0 (xem công thức
                        // trong calculateUserFinanceForMonth: totalPay = ... - Đã nộp - Thưởng sân).
                        amount: closing,
                        reason: `Trả tiền dư (thưởng đặt sân) bằng tiền mặt/CK - ${loggedInMemberName || 'Admin/Owner'} xác nhận`
                    };

                    enqueueAction(
                        "addGocLogAdjustment",
                        { gocLog: adjustment },
                        `Đã đưa Dư/Nợ của [${main}] về 0!`
                    );

                    let newCashbook = {
                        id: Date.now(),
                        category: "Tiền thưởng đặt sân",
                        amount: payoutAmount,
                        note: `Trả tiền dư thưởng đặt sân cho ${main} - Tháng ${p.month}/${p.year} (xác nhận qua nút "Đã trả tiền" - ${loggedInMemberName || 'Admin/Owner'})`,
                        time: new Date().toLocaleDateString('vi-VN')
                    };

                    enqueueAction(
                        "addCashbook",
                        { cashbook: newCashbook },
                        "Đã ghi nhận khoản chi vào Sổ Thu Chi!"
                    );

                    closeDashboardFinanceDetailModal();

                    if (typeof renderDashboard === "function") {
                        renderDashboard();
                    }
                }
            );
        };

})();
// ======================================================
// PHASE 3 A9 - FINANCE TOOLBAR + ZALO FINANCE REPORT
//
// - Giữ nguyên Finance V2 / Month Close.
// - Đổi tên nút nhắc nợ thành "Nhắc nợ Zalo".
// - Thêm nút Admin "Báo cáo tài chính".
// - Báo cáo chỉ tổng hợp toàn CLB, không liệt kê từng thành viên.
// ======================================================

(function () {

    function moneyA9_(value) {
        return (parseInt(value) || 0).toLocaleString("vi-VN") + " đ";
    }

    function ensureFinanceToolbarA9_() {
        let reminderButton =
            document.querySelector(
                'button[onclick="copyReminderText()"]'
            );

        if (!reminderButton) {
            return;
        }

        reminderButton.innerHTML =
            '<i class="fa-solid fa-bell"></i> Nhắc nợ Zalo';

        reminderButton.title =
            "Sao chép danh sách thành viên còn cần đóng để gửi Zalo";

        let reportButton =
            document.getElementById(
                "btnFinanceReportA9"
            );

        if (!reportButton) {
            reportButton =
                document.createElement(
                    "button"
                );

            reportButton.id =
                "btnFinanceReportA9";

            reportButton.type =
                "button";

            reportButton.onclick =
                window.copyFinanceReportText;

            reminderButton.insertAdjacentElement(
                "afterend",
                reportButton
            );
        }

        reportButton.className =
            "bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow flex items-center gap-1.5 transition admin-only" +
            (
                (currentUserRole === "admin" || currentUserRole === "owner")
                    ? ""
                    : " hidden"
            );

        reportButton.innerHTML =
            '<i class="fa-solid fa-chart-column"></i> Báo cáo tài chính';

        reportButton.title =
            "Sao chép báo cáo tài chính tổng hợp tháng để gửi Zalo";
    }

    window.copyFinanceReportText =
        function () {

            if (
                currentUserRole !== "admin" &&
                currentUserRole !== "owner"
            ) {
                alert(
                    "Chỉ Admin hoặc Owner mới được tạo báo cáo tài chính tổng hợp."
                );
                return;
            }

            let monthEl =
                document.getElementById(
                    "selectFinanceMonth"
                );

            let yearEl =
                document.getElementById(
                    "selectFinanceYear"
                );

            if (
                !monthEl ||
                !yearEl
            ) {
                alert(
                    "Không xác định được tháng tài chính đang xem."
                );
                return;
            }

            let month =
                parseInt(
                    monthEl.value
                );

            let year =
                parseInt(
                    yearEl.value
                );

            if (
                !members ||
                members.length === 0
            ) {
                members =
                    defaultFallbackMembers;
            }

            let summary = {
                memberCount: 0,
                opening: 0,
                base: 0,
                special: 0,
                paid: 0,
                reward: 0,
                closing: 0,
                debtCount: 0,
                settledCount: 0,
                creditCount: 0
            };

            (members || []).forEach(
                function (member) {

                    let normalizedName =
                        String(member.name || "")
                            .trim()
                            .toLowerCase();

                    // Không đưa các dòng Khách mời vào báo cáo tài chính CLB.
                    if (
                        normalizedName === "khách mời" ||
                        normalizedName.startsWith("khách mời ")
                    ) {
                        return;
                    }

                    let f =
                        calculateUserFinanceForMonth(
                            member.name,
                            month,
                            year
                        );

                    let opening =
                        parseInt(
                            f.carryBalance
                        ) || 0;

                    let base =
                        parseInt(
                            f.cappedBaseFee
                        ) || 0;

                    let special =
                        parseInt(
                            f.monthSpecialBetFee
                        ) || 0;

                    let paid =
                        parseInt(
                            f.monthPaidAmount
                        ) || 0;

                    let reward =
                        parseInt(
                            f.monthRewardAmount
                        ) || 0;

                    let closing =
                        parseInt(
                            f.totalPay
                        ) || 0;

                    summary.memberCount++;
                    summary.opening += opening;
                    summary.base += base;
                    summary.special += special;
                    summary.paid += paid;
                    summary.reward += reward;
                    summary.closing += closing;

                    if (closing > 0) {
                        summary.debtCount++;
                    } else if (closing < 0) {
                        summary.creditCount++;
                    } else {
                        summary.settledCount++;
                    }
                }
            );

            let closingLabel =
                summary.closing > 0
                    ? "CLB còn phải thu"
                    : (
                        summary.closing < 0
                            ? "Thành viên đang dư ròng"
                            : "Dư/Nợ cuối kỳ"
                    );

            let text =
                `🎾 CLB TENNIS THĂNG LONG - BÁO CÁO TÀI CHÍNH THÁNG ${month}/${year}\n\n`;

            text +=
                `Tổng số thành viên: ${summary.memberCount}\n`;

            text +=
                `Dư/Nợ đầu kỳ: ${moneyA9_(summary.opening)}\n`;

            text +=
                `Góc cơ bản: ${moneyA9_(summary.base)}\n`;

            text +=
                `Kèo đặc biệt: ${moneyA9_(summary.special)}\n`;

            text +=
                `Thực nộp: ${moneyA9_(summary.paid)}\n`;

            text +=
                `Thưởng sân: ${moneyA9_(summary.reward)}\n`;

            text +=
                `${closingLabel}: ${moneyA9_(summary.closing)}\n\n`;

            text +=
                `Tình trạng thành viên:\n`;

            text +=
                `- Còn nợ: ${summary.debtCount} người\n`;

            text +=
                `- Đã cân bằng: ${summary.settledCount} người\n`;

            text +=
                `- Đang dư: ${summary.creditCount} người\n\n`;

            text +=
                `Công thức: Dư/Nợ đầu kỳ + Góc cơ bản + Kèo đặc biệt - Thực nộp - Thưởng sân = Dư/Nợ cuối kỳ.`;

            if (
                navigator.clipboard &&
                typeof navigator.clipboard.writeText ===
                    "function"
            ) {
                navigator.clipboard
                    .writeText(
                        text
                    )
                    .then(
                        function () {
                            showToast(
                                `Đã sao chép báo cáo tài chính tháng ${month}/${year}!`
                            );
                        }
                    )
                    .catch(
                        function () {
                            alert(
                                "Không thể tự động sao chép báo cáo. Vui lòng thử lại."
                            );
                        }
                    );

                return;
            }

            // Fallback cho trình duyệt không hỗ trợ Clipboard API.
            let textarea =
                document.createElement(
                    "textarea"
                );

            textarea.value =
                text;

            textarea.style.position =
                "fixed";

            textarea.style.opacity =
                "0";

            document.body.appendChild(
                textarea
            );

            textarea.focus();
            textarea.select();

            try {
                document.execCommand(
                    "copy"
                );

                showToast(
                    `Đã sao chép báo cáo tài chính tháng ${month}/${year}!`
                );
            } catch (error) {
                alert(
                    "Không thể tự động sao chép báo cáo. Vui lòng thử lại."
                );
            }

            textarea.remove();
        };


    // Finance.js đã được load trước dashboard.js,
    // vì vậy chỉ bọc phần render giao diện ở đây.
    // Không thay đổi bất kỳ công thức Finance V2 nào.
    if (
        typeof renderFinance ===
        "function"
    ) {
        const renderFinanceBeforeA9_ =
            renderFinance;

        renderFinance =
            function () {
                renderFinanceBeforeA9_.apply(
                    this,
                    arguments
                );

                ensureFinanceToolbarA9_();
            };
    }


    // DOM của index.html đã có sẵn khi dashboard.js chạy.
    // Gọi thêm một lần để nút đổi tên ngay cả trước lần renderFinance kế tiếp.
    setTimeout(
        ensureFinanceToolbarA9_,
        0
    );

})();

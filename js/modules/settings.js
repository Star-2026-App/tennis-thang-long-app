// ======================================================
// SETTINGS FRONTEND V2
// ======================================================

function populateSettingsForm() {

    document.getElementById('stQuyAmount').value =
        parseInt(systemSettings.quyAmount) || 600000;

    document.getElementById('stReward16').value =
        parseInt(systemSettings.reward16h) || 20000;

    document.getElementById('stReward18').value =
        parseInt(systemSettings.reward18h) || 30000;

    document.getElementById('stMaxLimit').value =
        parseInt(systemSettings.maxRewardLimit) || 15;


    // ==================================================
    // TIỀN GÓC - CẤU HÌNH MỚI
    // ==================================================

    document.getElementById('stGocDefaultPerMatch').value =
        parseInt(systemSettings.gocDefaultPerMatch) || 10000;

    document.getElementById('stGocMonthlyCap').value =
        parseInt(systemSettings.gocMonthlyCap) || 150000;


    // ==================================================
    // NGÂN HÀNG
    // ==================================================

    document.getElementById('stBankId').value =
        systemSettings.bankId || "TCB";

    document.getElementById('stBankAccount').value =
        systemSettings.bankAccount || "";

    document.getElementById('stAccountName').value =
        systemSettings.accountName || "";


    let qrUrl =
        `https://img.vietqr.io/image/` +
        `${systemSettings.bankId}-` +
        `${systemSettings.bankAccount}-compact2.png` +
        `?accountName=${encodeURIComponent(systemSettings.accountName)}`;


    document.getElementById('dashQrImg').src =
        qrUrl;
}


// ======================================================
// SAVE SETTINGS
// ======================================================

function saveSystemSettings(e) {

    e.preventDefault();


    showActionConfirm(
        "Bạn có chắc chắn muốn lưu các cài đặt hệ thống mới lên Cloud?",

        () => {

            let quyAmount =
                parseInt(
                    document.getElementById('stQuyAmount').value
                );

            let reward16h =
                parseInt(
                    document.getElementById('stReward16').value
                );

            let reward18h =
                parseInt(
                    document.getElementById('stReward18').value
                );

            let maxRewardLimit =
                parseInt(
                    document.getElementById('stMaxLimit').value
                );


            // ==========================================
            // TIỀN GÓC
            // ==========================================

            let gocDefaultPerMatch =
                parseInt(
                    document.getElementById(
                        'stGocDefaultPerMatch'
                    ).value
                );

            let gocMonthlyCap =
                parseInt(
                    document.getElementById(
                        'stGocMonthlyCap'
                    ).value
                );


            // ==========================================
            // VALIDATE
            // ==========================================

            if (
                !gocDefaultPerMatch ||
                gocDefaultPerMatch <= 0
            ) {

                alert(
                    "Tiền góc mặc định/trận phải lớn hơn 0."
                );

                return;
            }


            if (
                !gocMonthlyCap ||
                gocMonthlyCap <= 0
            ) {

                alert(
                    "Ngưỡng tiền góc/tháng phải lớn hơn 0."
                );

                return;
            }


            if (
                gocMonthlyCap <
                gocDefaultPerMatch
            ) {

                alert(
                    "Ngưỡng tiền góc/tháng không được nhỏ hơn tiền góc mặc định của một trận."
                );

                return;
            }


            // ==========================================
            // UPDATE LOCAL SETTINGS
            // ==========================================

            systemSettings.quyAmount =
                quyAmount || 600000;

            systemSettings.reward16h =
                reward16h || 20000;

            systemSettings.reward18h =
                reward18h || 30000;

            systemSettings.maxRewardLimit =
                maxRewardLimit || 15;

            systemSettings.gocDefaultPerMatch =
                gocDefaultPerMatch;

            systemSettings.gocMonthlyCap =
                gocMonthlyCap;


            systemSettings.bankId =
                document
                    .getElementById('stBankId')
                    .value
                    .trim()
                    .toUpperCase();


            systemSettings.bankAccount =
                document
                    .getElementById('stBankAccount')
                    .value
                    .trim();


            systemSettings.accountName =
                document
                    .getElementById('stAccountName')
                    .value
                    .trim()
                    .toUpperCase();


            // ==========================================
            // SAVE BACKEND
            // ==========================================

            enqueueAction(
                "updateSettings",
                {
                    settings: systemSettings
                },
                "Đã lưu cài đặt hệ thống lên Cloud thành công!"
            );
        }
    );
}
// ======================================================
// FINANCE V2 HOTFIX - 5 ISSUES
// ======================================================
// 1) Cảnh báo nợ cũ trừ tiền góc đã nộp trong tháng.
// 2) Bảng Cạ cứng ăn ý nhất chỉ Top 10.
// 3) Bỏ chữ 10k cố định ở lựa chọn không có kèo đặc biệt.
// 4) Mỗi trận giữ snapshot mức góc mặc định tại lúc ghi trận.
// 5) Khóa lịch sử trước thời điểm Finance V2 (08/2026).
//
// File này phải được load SAU các module hiện tại và TRƯỚC init.js.
// ======================================================

(function () {
    const FINANCE_V2_START_YEAR = 2026;
    const FINANCE_V2_START_MONTH = 8;
    const LEGACY_MATCH_GOC_FEE = 10000;

    function periodIndex_(month, year) {
        return (parseInt(year) || 0) * 12 + ((parseInt(month) || 0) - 1);
    }

    function isLegacyFinanceHistory_(month, year) {
        return periodIndex_(month, year) < periodIndex_(FINANCE_V2_START_MONTH, FINANCE_V2_START_YEAR);
    }

    function getMatchAppliedGocFee_(match) {
        let value = parseInt(
            match && (
                match.gocFee ||
                match.defaultGocFee ||
                match.gocDefaultPerMatchAtMatch
            )
        );

        // Tất cả trận cũ chưa có snapshot được giữ lịch sử ở 10.000đ.
        return value > 0 ? value : LEGACY_MATCH_GOC_FEE;
    }

    // ==================================================
    // ISSUE 4 - TÍNH TÀI CHÍNH THEO GÓC CỦA TỪNG TRẬN
    // ==================================================

    calculateUserFinanceForMonth = function (
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

        let gocDefaultPerMatch = getGocDefaultPerMatch_();
        let gocMonthlyCap = getGocMonthlyCap_();

        (matches || []).forEach(function (match) {
            let isV1 =
                match.p1_v1 === memberName ||
                match.p2_v1 === memberName;

            let isV2 =
                match.p1_v2 === memberName ||
                match.p2_v2 === memberName;

            if (!isV1 && !isV2) {
                return;
            }

            let scoreA = parseInt(match.scoreA) || 0;
            let scoreB = parseInt(match.scoreB) || 0;

            totalMatchCount++;

            let isDraw = scoreA === scoreB;
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

            let mustPayGoc = isDraw || !isWin;

            if (!mustPayGoc) {
                return;
            }

            let specialBet = parseInt(match.specialBet) || 0;

            if (specialBet > 0) {
                // Kèo đặc biệt thay cho góc mặc định của chính trận đó.
                monthSpecialBetFee += specialBet;
            } else {
                // Quan trọng: lấy mức góc đã chốt trên từng trận,
                // KHÔNG lấy Settings hiện tại để tính lại lịch sử.
                monthRegularFee += getMatchAppliedGocFee_(match);
            }
        });

        if (!members || members.length === 0) {
            members = defaultFallbackMembers;
        }

        let m =
            members.find(function (item) {
                return item.name === memberName;
            }) || { noOld: 0 };

        let cappedBaseFee = Math.min(
            gocMonthlyCap,
            monthRegularFee
        );

        let monthPaidAmount =
            getUserGocPaidForMonth_(
                memberName,
                targetMonth,
                targetYear
            );

        let monthRewardAmount =
            getUserBookingRewardForMonth_(
                memberName,
                targetMonth,
                targetYear
            );

        let carryBalance = parseInt(m.noOld) || 0;

        // Nếu tháng đã có snapshot chính thức thì luôn dùng snapshot.
        let snapshot =
            getMonthlyBalanceSnapshot_(
                memberName,
                targetMonth,
                targetYear
            );

        if (snapshot) {
            cappedBaseFee = parseInt(snapshot.baseFee) || 0;
            monthSpecialBetFee = parseInt(snapshot.specialFee) || 0;
            monthPaidAmount = parseInt(snapshot.paid) || 0;
            monthRewardAmount = parseInt(snapshot.reward) || 0;
            carryBalance = parseInt(snapshot.openingBalance) || 0;

            return {
                totalMatchCount,
                totalWins,
                totalLosses,
                totalDraws,
                monthMatchCount,
                gocDefaultPerMatch,
                gocMonthlyCap,
                monthRegularFee: cappedBaseFee,
                monthSpecialBetFee,
                cappedBaseFee,
                monthPaidAmount,
                monthRewardAmount,
                carryBalance,
                totalPay: parseInt(snapshot.closingBalance) || 0,
                closingBalance: parseInt(snapshot.closingBalance) || 0,
                isClosed: true
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
    };

    // ==================================================
    // ISSUE 4 - KHI GHI TRẬN MỚI, CHỐT MỨC GÓC HIỆN TẠI
    // ==================================================

    saveNewMatchData = function (
        p1A,
        p2A,
        p1B,
        p2B,
        scoreA,
        scoreB,
        specialBet
    ) {
        let newMatch = {
            id: Date.now(),
            time: new Date().toLocaleString('vi-VN'),
            p1_v1: p1A,
            p2_v1: p2A,
            scoreA: scoreA,
            scoreB: scoreB,
            p1_v2: p1B,
            p2_v2: p2B,
            specialBet: specialBet,
            // Snapshot mức góc mặc định tại thời điểm ghi trận.
            gocFee: getGocDefaultPerMatch_()
        };

        enqueueAction(
            "addMatch",
            { match: newMatch },
            "Đã lưu kết quả trận đấu thành công!"
        );

        document.getElementById('matchForm').reset();
        populateSelectors();

        document
            .querySelectorAll('input[name="scoreA"]')
            .forEach(function (el) {
                el.checked = false;
            });

        document
            .querySelectorAll('input[name="scoreB"]')
            .forEach(function (el) {
                el.checked = false;
            });

        document.getElementById('specialBet').value = "0";
    };

    // ==================================================
    // ISSUE 1 - CẢNH BÁO NỢ CŨ PHẢI TRỪ TIỀN ĐÃ NỘP
    // ==================================================

    if (typeof renderDashboard === 'function') {
        const originalRenderDashboard_ = renderDashboard;

        renderDashboard = function () {
            originalRenderDashboard_.apply(this, arguments);

            try {
                if (!members || members.length === 0) {
                    return;
                }

                let mainEl = document.getElementById('dashMainUser');
                let warningBanner = document.getElementById('quyWarningBanner');
                let warningText = document.getElementById('quyWarningText');

                if (!mainEl || !warningBanner || !warningText) {
                    return;
                }

                let main = mainEl.value || members[0].name;
                let member =
                    members.find(function (item) {
                        return item.name === main;
                    }) || members[0];

                let oldDebt = Math.max(
                    0,
                    parseInt(member.noOld) || 0
                );

                // Cảnh báo Nợ cũ luôn xét tiền thực nộp của THÁNG HIỆN TẠI,
                // không phụ thuộc bộ lọc tháng đang chọn ở tab Tiền Góc.
                let now = new Date();
                let paidThisMonth = Math.max(
                    0,
                    getUserGocPaidForMonth_(
                        main,
                        now.getMonth() + 1,
                        now.getFullYear()
                    )
                );

                // Tiền thực nộp được ưu tiên cấn Nợ cũ trước.
                let remainingOldDebt = Math.max(
                    0,
                    oldDebt - paidThisMonth
                );

                let period = getCurrentQuyPeriod();
                let hasPaidCurrentQuarter =
                    !!findQuyLogForMember(
                        member.name,
                        period.quarter,
                        period.year
                    );

                let warningItems = [];

                if (remainingOldDebt > 0) {
                    warningItems.push(
                        `còn Nợ cũ ${remainingOldDebt.toLocaleString('vi-VN')} đ`
                    );
                }

                if (!hasPaidCurrentQuarter) {
                    warningItems.push(
                        `chưa đóng quỹ ${period.quarter}/${period.year}`
                    );
                }

                let hasWarning =
                    member.status === 'Đang tham gia' &&
                    warningItems.length > 0;

                if (hasWarning) {
                    warningBanner.classList.remove('hidden');
                    warningBanner.classList.add('flex');
                    warningText.innerText =
                        `${member.name} ơi, bạn ${warningItems.join(' và ')}. Vui lòng hoàn thành nhé!`;
                } else {
                    warningBanner.classList.add('hidden');
                    warningBanner.classList.remove('flex');
                }
            } catch (err) {
                console.warn('HOTFIX DASHBOARD WARNING ERROR:', err);
            }
        };
    }

    // ==================================================
    // ISSUE 2 - CHỈ TOP 10 CẠ CỨNG ĂN Ý NHẤT
    // ==================================================

    if (typeof renderBestDuosTable === 'function') {
        const originalRenderBestDuosTable_ = renderBestDuosTable;

        renderBestDuosTable = function () {
            originalRenderBestDuosTable_.apply(this, arguments);

            let tbody = document.getElementById('bestDuosTableBody');
            if (!tbody) return;

            let rows = Array.from(
                tbody.querySelectorAll('tr')
            );

            if (rows.length <= 10) {
                return;
            }

            rows.slice(10).forEach(function (row) {
                row.remove();
            });
        };
    }

    // ==================================================
    // ISSUE 3 - BỎ CHỮ 10K CỐ ĐỊNH TRÊN GIAO DIỆN
    // ==================================================

    function normalizeSpecialBetLabels_() {
        ['specialBet', 'emSpecialBet'].forEach(function (id) {
            let select = document.getElementById(id);
            if (!select) return;

            let option = select.querySelector('option[value="0"]');
            if (option) {
                option.textContent = 'Không có kèo góc đặc biệt';
            }
        });
    }

    normalizeSpecialBetLabels_();

    // ==================================================
    // ISSUE 5 - KHÓA LỊCH SỬ TRƯỚC 08/2026
    // ==================================================

    if (typeof getMonthCloseStatusLocal_ === 'function') {
        const originalGetMonthCloseStatusLocal_ = getMonthCloseStatusLocal_;

        getMonthCloseStatusLocal_ = function (month, year) {
            if (isLegacyFinanceHistory_(month, year)) {
                return true;
            }

            return originalGetMonthCloseStatusLocal_(
                month,
                year
            );
        };
    }

    if (typeof ensureMonthCloseAdminUI_ === 'function') {
        const originalEnsureMonthCloseAdminUI_ = ensureMonthCloseAdminUI_;

        ensureMonthCloseAdminUI_ = function () {
            originalEnsureMonthCloseAdminUI_.apply(this, arguments);

            let monthEl = document.getElementById('selectFinanceMonth');
            let yearEl = document.getElementById('selectFinanceYear');
            let button = document.getElementById('btnMonthCloseAdmin');

            if (!monthEl || !yearEl || !button) {
                return;
            }

            let month = parseInt(monthEl.value);
            let year = parseInt(yearEl.value);

            if (!isLegacyFinanceHistory_(month, year)) {
                return;
            }

            button.disabled = true;
            button.innerHTML =
                '<i class="fa-solid fa-lock"></i> ĐÃ KHÓA';
            button.className =
                'ml-2 px-3 py-2 rounded-lg bg-slate-300 text-slate-600 text-xs font-black cursor-not-allowed';
            button.title =
                `Tháng ${month}/${year} thuộc lịch sử trước Finance V2 và chỉ được xem.`;
        };
    }

    if (typeof openEditFinanceModal === 'function') {
        const originalOpenEditFinanceModal_ = openEditFinanceModal;

        openEditFinanceModal = function (idx) {
            let monthEl = document.getElementById('selectFinanceMonth');
            let yearEl = document.getElementById('selectFinanceYear');

            if (monthEl && yearEl) {
                let month = parseInt(monthEl.value);
                let year = parseInt(yearEl.value);

                if (isLegacyFinanceHistory_(month, year)) {
                    alert(
                        `Tháng ${month}/${year} là dữ liệu lịch sử đã khóa.\n\nKhông được sửa Dư/Nợ.`
                    );
                    return;
                }
            }

            return originalOpenEditFinanceModal_.apply(
                this,
                arguments
            );
        };
    }

    if (typeof openMonthClosePreview_ === 'function') {
        const originalOpenMonthClosePreview_ = openMonthClosePreview_;

        openMonthClosePreview_ = function () {
            let monthEl = document.getElementById('selectFinanceMonth');
            let yearEl = document.getElementById('selectFinanceYear');

            if (monthEl && yearEl) {
                let month = parseInt(monthEl.value);
                let year = parseInt(yearEl.value);

                if (isLegacyFinanceHistory_(month, year)) {
                    alert(
                        `Tháng ${month}/${year} thuộc lịch sử trước Finance V2 và đã khóa.\n\nKhông thể chốt ngược tháng cũ.`
                    );
                    return;
                }
            }

            return originalOpenMonthClosePreview_.apply(
                this,
                arguments
            );
        };
    }

    // Đảm bảo chữ trên select được sửa cả sau các lần render/reset form.
    setTimeout(normalizeSpecialBetLabels_, 0);
})();

// ======================================================
// SETTINGS FRONTEND V2
// ======================================================

function populateSettingsForm() {

    // Helper an toàn: không crash nếu thiếu phần tử HTML
    // (ví dụ do cache PWA cũ chưa cập nhật kịp).
    function setVal_(id, value) {

        let el =
            document.getElementById(id);

        if (el) {
            el.value = value;
        } else {
            console.warn(
                "populateSettingsForm: không tìm thấy #" + id
            );
        }
    }


    setVal_('stQuyAmount', parseInt(systemSettings.quyAmount) || 600000);

    setVal_('stReward16', parseInt(systemSettings.reward16h) || 20000);

    setVal_('stReward18', parseInt(systemSettings.reward18h) || 30000);

    setVal_('stRewardCVTT5', parseInt(systemSettings.rewardCVTT5) || 0);

    setVal_('stMaxLimit', parseInt(systemSettings.maxRewardLimit) || 15);


    // ==================================================
    // TIỀN GÓC - CẤU HÌNH MỚI
    // ==================================================

    setVal_('stGocDefaultPerMatch', parseInt(systemSettings.gocDefaultPerMatch) || 10000);

    setVal_('stGocMonthlyCap', parseInt(systemSettings.gocMonthlyCap) || 150000);


    // ==================================================
    // NGÂN HÀNG
    // ==================================================

    setVal_('stBankId', systemSettings.bankId || "TCB");

    setVal_('stBankAccount', systemSettings.bankAccount || "");

    setVal_('stAccountName', systemSettings.accountName || "");


    // ==================================================
    // (v2.1.2) TỰ ĐỘNG CHỐT THÁNG
    // ==================================================

    let autoCloseEl =
        document.getElementById('stAutoCloseMonth');

    if (autoCloseEl) {
        // Mặc định BẬT nếu backend cũ chưa từng gửi field này
        // (VD vừa nâng cấp lên v2.1.2, Settings sheet chưa có dòng
        // AUTO_CLOSE_MONTH_ENABLED).
        autoCloseEl.checked =
            systemSettings.autoCloseMonthEnabled !== false;
    } else {
        console.warn(
            "populateSettingsForm: không tìm thấy #stAutoCloseMonth"
        );
    }


    let qrUrl =
        `https://img.vietqr.io/image/` +
        `${systemSettings.bankId}-` +
        `${systemSettings.bankAccount}-compact2.png` +
        `?accountName=${encodeURIComponent(systemSettings.accountName)}`;


    let qrImgEl =
        document.getElementById('dashQrImg');

    if (qrImgEl) {
        qrImgEl.src = qrUrl;
    }
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

            let rewardCVTT5 =
                parseInt(
                    document.getElementById('stRewardCVTT5').value
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


            if (
                isNaN(rewardCVTT5) ||
                rewardCVTT5 < 0
            ) {

                alert(
                    "Thưởng đặc cách CVTT5 không được để trống hoặc là số âm (có thể để 0)."
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

            systemSettings.rewardCVTT5 =
                rewardCVTT5;

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
            // (v2.1.2) TỰ ĐỘNG CHỐT THÁNG
            // ==========================================

            let autoCloseEl =
                document.getElementById('stAutoCloseMonth');

            systemSettings.autoCloseMonthEnabled =
                autoCloseEl
                    ? autoCloseEl.checked === true
                    : (systemSettings.autoCloseMonthEnabled !== false);


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
// FINANCE V2 + PHASE 3 COMPATIBILITY
// ======================================================
//
// Giữ 5 FIX đã PASS, đồng thời:
// - Thành tích tổng lấy từ MemberStats.
// - Matches chỉ dùng dữ liệu tháng đang tải.
// - GocLogs vẫn giữ toàn bộ ở Phase 3 bước này.
// ======================================================

(function () {

    const FINANCE_V2_START_YEAR =
        2026;


    const FINANCE_V2_START_MONTH =
        8;


    const LEGACY_MATCH_GOC_FEE =
        10000;


    function periodIndex_(
        month,
        year
    ) {

        return (
            (
                parseInt(year) ||
                0
            ) *
            12
            +
            (
                (
                    parseInt(month) ||
                    0
                ) -
                1
            )
        );
    }


    function isLegacyFinanceHistory_(
        month,
        year
    ) {

        return (
            periodIndex_(
                month,
                year
            ) <
            periodIndex_(
                FINANCE_V2_START_MONTH,
                FINANCE_V2_START_YEAR
            )
        );
    }


    function getMatchAppliedGocFee_(
        match
    ) {

        let value =
            parseInt(
                match &&
                (
                    match.gocFee ||
                    match.defaultGocFee ||
                    match.gocDefaultPerMatchAtMatch
                )
            );


        return value > 0
            ? value
            : LEGACY_MATCH_GOC_FEE;
    }


    function getLifetimeMemberStats_(
        memberRef
    ) {

        let identity =
            resolveMemberIdentity_(
                memberRef
            );


        let stat =
            (
                window.memberStats ||
                []
            )
            .find(
                function(item) {

                    return recordBelongsToMember_(
                        item,
                        identity,
                        "stt",
                        "name"
                    );
                }
            );


        return {

            totalWins:
                stat
                    ? (
                        parseInt(
                            stat.wins
                        ) ||
                        0
                    )
                    : 0,

            totalLosses:
                stat
                    ? (
                        parseInt(
                            stat.losses
                        ) ||
                        0
                    )
                    : 0,

            totalDraws:
                stat
                    ? (
                        parseInt(
                            stat.draws
                        ) ||
                        0
                    )
                    : 0,

            totalMatchCount:
                stat
                    ? (
                        parseInt(
                            stat.totalMatches
                        ) ||
                        0
                    )
                    : 0
        };
    }


    // ==================================================
    // ISSUE 4 + PHASE 3
    //
    // Thành tích tổng = MemberStats.
    // Tiền góc tháng = Matches tháng đang tải.
    // ==================================================

    calculateUserFinanceForMonth =
        function(
            memberRef,
            targetMonth,
            targetYear
        ) {

            let memberIdentity =
                resolveMemberIdentity_(
                    memberRef
                );


            let memberName =
                memberIdentity.name;

            let lifetime =
                getLifetimeMemberStats_(
                    memberIdentity
                );


            let totalWins =
                lifetime.totalWins;


            let totalLosses =
                lifetime.totalLosses;


            let totalDraws =
                lifetime.totalDraws;


            let totalMatchCount =
                lifetime.totalMatchCount;


            let monthMatchCount =
                0;


            let monthRegularFee =
                0;


            let monthSpecialBetFee =
                0;


            let gocDefaultPerMatch =
                getGocDefaultPerMatch_();


            let gocMonthlyCap =
                getGocMonthlyCap_();


            let monthMatches =
                typeof getMonthMatchesCached_ ===
                    "function"
                    ? getMonthMatchesCached_(
                        targetMonth,
                        targetYear
                    )
                    : (
                        matches ||
                        []
                    );


            monthMatches.forEach(
                function(match) {

                    let participation =
                        getMatchParticipationForMember_(
                            match,
                            memberIdentity
                        );


                    let isV1 =
                        participation.isV1;


                    let isV2 =
                        participation.isV2;


                    if (
                        !isV1 &&
                        !isV2
                    ) {

                        return;
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


                    let scoreA =
                        parseInt(
                            match.scoreA
                        ) ||
                        0;


                    let scoreB =
                        parseInt(
                            match.scoreB
                        ) ||
                        0;


                    monthMatchCount++;


                    let isDraw =
                        scoreA ===
                        scoreB;


                    let isWin =
                        (
                            isV1 &&
                            scoreA >
                                scoreB
                        )
                        ||
                        (
                            isV2 &&
                            scoreB >
                                scoreA
                        );


                    let mustPayGoc =
                        isDraw ||
                        !isWin;


                    if (!mustPayGoc) {
                        return;
                    }


                    let specialBet =
                        parseInt(
                            match.specialBet
                        ) ||
                        0;


                    if (
                        specialBet >
                        0
                    ) {

                        monthSpecialBetFee +=
                            specialBet;

                    } else {

                        monthRegularFee +=
                            getMatchAppliedGocFee_(
                                match
                            );
                    }
                }
            );


            if (
                !members ||
                members.length === 0
            ) {

                members =
                    defaultFallbackMembers;
            }


            let m =
                memberIdentity.member ||
                {
                    noOld:
                        0
                };


            let cappedBaseFee =
                Math.min(
                    gocMonthlyCap,
                    monthRegularFee
                );


            let monthPaidAmount =
                getUserGocPaidForMonth_(
                    memberIdentity,
                    targetMonth,
                    targetYear
                );


            let monthRewardAmount;


            if (
                typeof getMonthBookingsCached_ ===
                "function"
            ) {

                monthRewardAmount =
                    getMonthBookingsCached_(
                        targetMonth,
                        targetYear
                    )
                    .reduce(
                        function(
                            sum,
                            booking
                        ) {

                            if (!recordBelongsToMember_(
                                booking,
                                memberIdentity,
                                "memberStt",
                                "name"
                            )) {

                                return sum;
                            }


                            return (
                                sum +
                                (
                                    parseInt(
                                        booking.reward
                                    ) ||
                                    0
                                )
                            );
                        },
                        0
                    );

            } else {

                monthRewardAmount =
                    getUserBookingRewardForMonth_(
                        memberIdentity,
                        targetMonth,
                        targetYear
                    );
            }


            let carryBalance =
                parseInt(
                    m.noOld
                ) ||
                0;


            let snapshot =
                getMonthlyBalanceSnapshot_(
                    memberIdentity,
                    targetMonth,
                    targetYear
                );


            if (snapshot) {

                cappedBaseFee =
                    parseInt(
                        snapshot.baseFee
                    ) ||
                    0;


                monthSpecialBetFee =
                    parseInt(
                        snapshot.specialFee
                    ) ||
                    0;


                monthPaidAmount =
                    parseInt(
                        snapshot.paid
                    ) ||
                    0;


                monthRewardAmount =
                    parseInt(
                        snapshot.reward
                    ) ||
                    0;


                carryBalance =
                    parseInt(
                        snapshot.openingBalance
                    ) ||
                    0;


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
                        ) ||
                        0,

                    closingBalance:
                        parseInt(
                            snapshot.closingBalance
                        ) ||
                        0,

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

                closingBalance:
                    totalPay,

                isClosed:
                    false
            };
        };


    // ==================================================
    // ISSUE 4 - TRẬN MỚI GIỮ SNAPSHOT GÓC
    // ==================================================

    saveNewMatchData =
        function(
            p1A,
            p2A,
            p1B,
            p2B,
            scoreA,
            scoreB,
            specialBet
        ) {

            let newMatch = {

                id:
                    Date.now(),

                time:
                    formatVNDateTime_(),

                p1_v1:
                    p1A,

                p2_v1:
                    p2A,

                scoreA:
                    scoreA,

                scoreB:
                    scoreB,

                p1_v2:
                    p1B,

                p2_v2:
                    p2B,

                specialBet:
                    specialBet,

                gocFee:
                    getGocDefaultPerMatch_()
            };


            enqueueAction(
                "addMatch",
                {
                    match:
                        newMatch
                },
                "Đã lưu kết quả trận đấu thành công!"
            );


            document
                .getElementById(
                    "matchForm"
                )
                .reset();


            populateSelectors();


            document
                .querySelectorAll(
                    'input[name="scoreA"]'
                )
                .forEach(
                    function(el) {

                        el.checked =
                            false;
                    }
                );


            document
                .querySelectorAll(
                    'input[name="scoreB"]'
                )
                .forEach(
                    function(el) {

                        el.checked =
                            false;
                    }
                );


            document
                .getElementById(
                    "specialBet"
                )
                .value =
                    "0";
        };


    // ==================================================
    // ISSUE 1 - CẢNH BÁO NỢ CŨ TRỪ TIỀN ĐÃ NỘP
    // ==================================================

    if (
        typeof renderDashboard ===
        "function"
    ) {

        const originalRenderDashboard_ =
            renderDashboard;


        renderDashboard =
            function() {

                originalRenderDashboard_
                    .apply(
                        this,
                        arguments
                    );


                try {

                    if (
                        !members ||
                        members.length === 0
                    ) {
                        return;
                    }


                    let mainEl =
                        document.getElementById(
                            "dashMainUser"
                        );


                    let warningBanner =
                        document.getElementById(
                            "quyWarningBanner"
                        );


                    let warningText =
                        document.getElementById(
                            "quyWarningText"
                        );


                    if (
                        !mainEl ||
                        !warningBanner ||
                        !warningText
                    ) {
                        return;
                    }


                    let main =
                        mainEl.value ||
                        members[0].name;


                    let member =
                        members.find(
                            function(item) {

                                return (
                                    item.name ===
                                    main
                                );
                            }
                        ) ||
                        members[0];


                    let oldDebt =
                        Math.max(
                            0,
                            parseInt(
                                member.noOld
                            ) ||
                            0
                        );


                    let now =
                        new Date();


                    // GocLogs vẫn đang giữ toàn bộ lịch sử,
                    // nên helper này luôn đọc đúng tháng hiện tại
                    // kể cả Admin đang xem tháng cũ.
                    let paidThisMonth =
                        Math.max(
                            0,
                            getUserGocPaidForMonth_(
                                member,
                                now.getMonth() +
                                    1,
                                now.getFullYear()
                            )
                        );


                    let remainingOldDebt =
                        Math.max(
                            0,
                            oldDebt -
                            paidThisMonth
                        );


                    let period =
                        getCurrentQuyPeriod();


                    let hasPaidCurrentQuarter =
                        !!findQuyLogForMember(
                            member.name,
                            period.quarter,
                            period.year
                        );


                    let warningItems =
                        [];


                    if (
                        remainingOldDebt >
                        0
                    ) {

                        warningItems.push(
                            `còn Nợ cũ ${remainingOldDebt.toLocaleString("vi-VN")} đ`
                        );
                    }


                    if (
                        !hasPaidCurrentQuarter
                    ) {

                        warningItems.push(
                            `chưa đóng quỹ ${period.quarter}/${period.year}`
                        );
                    }


                    let hasWarning =
                        member.status ===
                            "Đang tham gia" &&
                        warningItems.length >
                            0;


                    if (hasWarning) {

                        warningBanner
                            .classList
                            .remove(
                                "hidden"
                            );


                        warningBanner
                            .classList
                            .add(
                                "flex"
                            );


                        warningText.innerText =
                            `${member.name} ơi, bạn ${warningItems.join(" và ")}. Vui lòng hoàn thành nhé!`;

                    } else {

                        warningBanner
                            .classList
                            .add(
                                "hidden"
                            );


                        warningBanner
                            .classList
                            .remove(
                                "flex"
                            );
                    }


                } catch (err) {

                    console.warn(
                        "PHASE3 DASHBOARD WARNING ERROR:",
                        err
                    );
                }
            };
    }


    // ==================================================
    // ISSUE 3 - BỎ CHỮ 10K CỐ ĐỊNH
    // ==================================================

    function normalizeSpecialBetLabels_() {

        [
            "specialBet",
            "emSpecialBet"
        ]
        .forEach(
            function(id) {

                let select =
                    document.getElementById(
                        id
                    );


                if (!select) {
                    return;
                }


                let option =
                    select.querySelector(
                        'option[value="0"]'
                    );


                if (option) {

                    option.textContent =
                        "Không có kèo góc đặc biệt";
                }
            }
        );
    }


    normalizeSpecialBetLabels_();


    // ==================================================
    // ISSUE 5 - KHÓA LỊCH SỬ TRƯỚC 08/2026
    // ==================================================

    if (
        typeof getMonthCloseStatusLocal_ ===
        "function"
    ) {

        const originalGetMonthCloseStatusLocal_ =
            getMonthCloseStatusLocal_;


        getMonthCloseStatusLocal_ =
            function(
                month,
                year
            ) {

                if (
                    isLegacyFinanceHistory_(
                        month,
                        year
                    )
                ) {

                    return true;
                }


                return originalGetMonthCloseStatusLocal_(
                    month,
                    year
                );
            };
    }


    if (
        typeof ensureMonthCloseAdminUI_ ===
        "function"
    ) {

        const originalEnsureMonthCloseAdminUI_ =
            ensureMonthCloseAdminUI_;


        ensureMonthCloseAdminUI_ =
            function() {

                originalEnsureMonthCloseAdminUI_
                    .apply(
                        this,
                        arguments
                    );


                let monthEl =
                    document.getElementById(
                        "selectFinanceMonth"
                    );


                let yearEl =
                    document.getElementById(
                        "selectFinanceYear"
                    );


                let button =
                    document.getElementById(
                        "btnMonthCloseAdmin"
                    );


                if (
                    !monthEl ||
                    !yearEl ||
                    !button
                ) {
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
                    !isLegacyFinanceHistory_(
                        month,
                        year
                    )
                ) {
                    return;
                }


                button.disabled =
                    true;


                button.innerHTML =
                    '<i class="fa-solid fa-lock"></i> ĐÃ KHÓA';


                button.className =
                    "ml-2 px-3 py-2 rounded-lg bg-slate-300 text-slate-600 text-xs font-black cursor-not-allowed";


                button.title =
                    `Tháng ${month}/${year} thuộc lịch sử trước Finance V2 và chỉ được xem.`;
            };
    }


    if (
        typeof openEditFinanceModal ===
        "function"
    ) {

        const originalOpenEditFinanceModal_ =
            openEditFinanceModal;


        openEditFinanceModal =
            function(idx) {

                let monthEl =
                    document.getElementById(
                        "selectFinanceMonth"
                    );


                let yearEl =
                    document.getElementById(
                        "selectFinanceYear"
                    );


                if (
                    monthEl &&
                    yearEl
                ) {

                    let month =
                        parseInt(
                            monthEl.value
                        );


                    let year =
                        parseInt(
                            yearEl.value
                        );


                    if (
                        isLegacyFinanceHistory_(
                            month,
                            year
                        )
                    ) {

                        alert(
                            `Tháng ${month}/${year} là dữ liệu lịch sử đã khóa.\n\nKhông được sửa Dư/Nợ.`
                        );

                        return;
                    }
                }


                return originalOpenEditFinanceModal_
                    .apply(
                        this,
                        arguments
                    );
            };
    }


    if (
        typeof openMonthClosePreview_ ===
        "function"
    ) {

        const originalOpenMonthClosePreview_ =
            openMonthClosePreview_;


        openMonthClosePreview_ =
            function() {

                let monthEl =
                    document.getElementById(
                        "selectFinanceMonth"
                    );


                let yearEl =
                    document.getElementById(
                        "selectFinanceYear"
                    );


                if (
                    monthEl &&
                    yearEl
                ) {

                    let month =
                        parseInt(
                            monthEl.value
                        );


                    let year =
                        parseInt(
                            yearEl.value
                        );


                    if (
                        isLegacyFinanceHistory_(
                            month,
                            year
                        )
                    ) {

                        alert(
                            `Tháng ${month}/${year} thuộc lịch sử trước Finance V2 và đã khóa.\n\nKhông thể chốt ngược tháng cũ.`
                        );

                        return;
                    }
                }


                return originalOpenMonthClosePreview_
                    .apply(
                        this,
                        arguments
                    );
            };
    }


    setTimeout(
        normalizeSpecialBetLabels_,
        0
    );
})();

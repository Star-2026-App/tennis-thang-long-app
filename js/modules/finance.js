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

function getUserGocPaidForMonth_(memberName, targetMonth, targetYear) {
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

        closingBalance: totalPay
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
                    new Date()
                        .toLocaleString('vi-VN'),

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


    let logsToDisplay =
        (gocLogs || []).slice();


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


            tbody.innerHTML += `

                <tr class="border-b hover:bg-slate-50">

                    <td class="p-2.5 text-center font-bold text-slate-500">
                        ${stt}
                    </td>

                    <td class="p-2.5 font-semibold text-slate-600">
                        ${g.time}
                    </td>

                    <td class="p-2.5 font-bold text-slate-900">
                        ${g.name}
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
                        ${g.note || '-'}
                    </td>

                    <td class="
                        p-2.5 text-center admin-only
                        ${
                            currentUserRole === 'admin'
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
                            text-[9px]
                            font-semibold
                            text-purple-600
                            mt-0.5
                        ">
                            Thưởng sân:
                            -${f.monthRewardAmount.toLocaleString('vi-VN')} đ
                        </div>
                    `

                    : '';


            tbody.innerHTML += `

                <tr class="border-b hover:bg-slate-50">

                    <td class="p-2 text-center font-bold text-slate-500">
                        ${item.originalIdx}
                    </td>

                    <td class="p-2 sticky-col font-bold text-slate-900 border-r">
                        ${m.name}
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
                        ${f.cappedBaseFee.toLocaleString('vi-VN')} đ
                    </td>

                    <td class="p-2 text-right font-bold text-amber-800">
                        ${f.monthSpecialBetFee.toLocaleString('vi-VN')} đ
                    </td>

                    <td class="p-2 text-right text-emerald-700 font-black">
                        ${f.monthPaidAmount.toLocaleString('vi-VN')} đ
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
                        ${f.carryBalance.toLocaleString('vi-VN')} đ
                    </td>

                    <td class="
                        p-2 text-right font-black
                        ${totalPayColor}
                    ">
                        ${f.totalPay.toLocaleString('vi-VN')} đ

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
                            currentUserRole === 'admin'

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

                                : ''
                        }

                    </td>

                </tr>
            `;
        }
    );
}


function openEditFinanceModal(idx) {

    let m =
        members[idx];


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


    document
        .getElementById(
            'editFinanceModal'
        )
        .classList
        .remove('hidden');


    document
        .getElementById(
            'editFinanceModal'
        )
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


    let newCarry =
        parseInt(
            document
                .getElementById(
                    'efNoOld'
                )
                .value
        ) || 0;


    let oldCarry =
        parseInt(
            member.noOld
        ) || 0;


    let payloadMember = {

        stt:
            member.stt,

        name:
            member.name,

        status:
            member.status ||
            "Đang tham gia",

        base:
            parseFloat(
                member.base
            ) || 6.2,

        noOld:
            newCarry,

        role:
            member.role ||
            "member"
    };


    closeEditFinanceModal();


    // Optimistic UI
    member.noOld =
        newCarry;


    renderFinance();


    if (
        typeof renderDashboard ===
        "function"
    ) {

        renderDashboard();
    }


    showToast(
        "Đang cập nhật Dư/Nợ chuyển kỳ..."
    );


    fetch(

        GOOGLE_SCRIPT_URL,

        {

            method:
                "POST",

            headers: {

                "Content-Type":
                    "text/plain;charset=utf-8"
            },

            body:
                JSON.stringify({

                    action:
                        "updateSingleMember",

                    member:
                        payloadMember
                })
        }
    )

    .then(function(res) {

        return res.json();
    })

    .then(function(data) {

        if (
            data.status !==
            "SUCCESS"
        ) {

            member.noOld =
                oldCarry;


            renderFinance();


            if (
                typeof renderDashboard ===
                "function"
            ) {

                renderDashboard();
            }


            alert(

                (
                    data.message ||
                    "Không thể cập nhật Dư/Nợ chuyển kỳ."
                ) +

                "\n\nDữ liệu đã được hoàn tác trên màn hình."
            );


            return;
        }


        if (data.result) {

            member.noOld =
                parseInt(
                    data.result.noOld
                ) || 0;
        }


        renderFinance();


        if (
            typeof renderDashboard ===
            "function"
        ) {

            renderDashboard();
        }


        showToast(
            "Đã cập nhật Dư/Nợ chuyển kỳ thành công!"
        );
    })

    .catch(function() {

        member.noOld =
            oldCarry;


        renderFinance();


        if (
            typeof renderDashboard ===
            "function"
        ) {

            renderDashboard();
        }


        alert(

            "Không thể kết nối hệ thống.\n\n" +
            "Dữ liệu Dư/Nợ đã được hoàn tác."
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
                currentUserRole ===
                    'admin' &&
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


            tbody.innerHTML += `

                <tr class="border-b hover:bg-slate-50">

                    <td class="p-2.5 text-center font-bold text-slate-500">
                        ${idx + 1}
                    </td>

                    <td class="p-2.5 font-bold text-slate-900">
                        ${m.name}
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
                            currentUserRole ===
                            'admin'
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
        currentUserRole !==
        'admin'
    ) {

        alert(
            "Chỉ Admin mới được xóa xác nhận đóng quỹ."
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


            fetch(

                GOOGLE_SCRIPT_URL,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "text/plain;charset=utf-8"
                    },

                    body:
                        JSON.stringify({

                            action:
                                "deleteItem",

                            sheetName:
                                "QuyLogs",

                            id:
                                log.id
                        })
                }
            )

            .then(
                function(res) {

                    return res.json();
                }
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

    if (
        confirm(
            "Xóa giao dịch thu/chi này?"
        )
    ) {

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


    fetch(

        GOOGLE_SCRIPT_URL,

        {

            method:
                "POST",

            headers: {

                "Content-Type":
                    "text/plain;charset=utf-8"
            },

            body:
                JSON.stringify({

                    action:
                        "updateGocLog",

                    gocLog:
                        payload
                })
        }
    )

    .then(
        function(res) {

            return res.json();
        }
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

    if (
        confirm(
            "Xóa lượt nộp tiền góc này?"
        )
    ) {

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


                tbody.innerHTML += `

                    <tr class="border-b">

                        <td class="p-1.5">
                            ${log.quarter}/${log.year}
                        </td>

                        <td class="p-1.5 font-bold">
                            ${log.name}
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

        (gocLogs || [])
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


                    tbody.innerHTML += `

                        <tr class="border-b">

                            <td class="p-1.5">
                                ${g.time}
                            </td>

                            <td class="p-1.5 font-bold">
                                ${g.name}
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
                                    currentUserRole ===
                                    'admin'
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


                tbody.innerHTML += `

                    <tr class="border-b">

                        <td class="p-1.5">
                            ${c.time}
                        </td>

                        <td class="p-1.5 font-bold">
                            ${c.note}
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
                                currentUserRole ===
                                'admin'
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


function renderCashbook() {

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


    let totalGocThu =
        (gocLogs || [])
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
            openingBalance
                .toLocaleString(
                    'vi-VN'
                ) +
            " đ";


    selectCategory(
        'Tiền góc thực thu'
    );
}

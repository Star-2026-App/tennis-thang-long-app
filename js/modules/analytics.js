// ======================================================
// ANALYTICS.JS - PHASE 3 LAZY LOAD
// ======================================================
//
// Toàn bộ Matches lịch sử KHÔNG tải khi mở app.
// Chỉ khi mở tab Phân tích mới gọi analyticsData.
//
// ======================================================


function getAnalyticsMatches_() {

    return Array.isArray(
        window.analyticsMatches
    )
        ? window.analyticsMatches
        : [];
}


function showAnalyticsLoading_() {

    let targets = [
        {
            id:
                "bestDuosTableBody",
            colspan:
                7
        },
        {
            id:
                "rivalsDuyenNoBody",
            colspan:
                2
        },
        {
            id:
                "rivalsCanSucBody",
            colspan:
                2
        },
        {
            id:
                "rivalsKhacTinhBody",
            colspan:
                2
        }
    ];


    targets.forEach(
        function(item) {

            let body =
                document.getElementById(
                    item.id
                );


            if (!body) {
                return;
            }


            body.innerHTML = `
                <tr>
                    <td
                        colspan="${item.colspan}"
                        class="p-4 text-center text-slate-400 italic"
                    >
                        <i class="fa-solid fa-spinner fa-spin mr-1"></i>
                        Đang tải dữ liệu phân tích...
                    </td>
                </tr>
            `;
        }
    );
}


function renderAnalyticsLoaded_() {

    renderBestDuosTable();

    renderRivalsAnalytics();
}


function renderAnalyticsTab() {

    if (
        window.analyticsDataLoaded ===
            true
    ) {

        renderAnalyticsLoaded_();

        return;
    }


    showAnalyticsLoading_();


    if (
        typeof fetchAnalyticsData !==
        "function"
    ) {

        console.error(
            "Không tìm thấy fetchAnalyticsData."
        );

        return;
    }


    fetchAnalyticsData(
        true,
        function() {

            renderAnalyticsLoaded_();
        }
    );
}


function renderBestDuosTable() {

    let tbody =
        document.getElementById(
            "bestDuosTableBody"
        );


    if (!tbody) {
        return;
    }


    tbody.innerHTML =
        "";


    let duoMap =
        {};


    getAnalyticsMatches_()
    .forEach(
        function(m) {

            let teamA = [
                m.p1_v1,
                m.p2_v1
            ]
            .filter(Boolean)
            .sort();


            if (
                teamA.length === 2
            ) {

                let keyA =
                    teamA[0] +
                    " & " +
                    teamA[1];


                if (!duoMap[keyA]) {

                    duoMap[keyA] = {

                        p1:
                            teamA[0],

                        p2:
                            teamA[1],

                        total:
                            0,

                        wins:
                            0,

                        draws:
                            0,

                        losses:
                            0
                    };
                }


                duoMap[keyA]
                    .total++;


                if (
                    m.scoreA ===
                    m.scoreB
                ) {

                    duoMap[keyA]
                        .draws++;

                } else if (
                    m.scoreA >
                    m.scoreB
                ) {

                    duoMap[keyA]
                        .wins++;

                } else {

                    duoMap[keyA]
                        .losses++;
                }
            }


            let teamB = [
                m.p1_v2,
                m.p2_v2
            ]
            .filter(Boolean)
            .sort();


            if (
                teamB.length === 2
            ) {

                let keyB =
                    teamB[0] +
                    " & " +
                    teamB[1];


                if (!duoMap[keyB]) {

                    duoMap[keyB] = {

                        p1:
                            teamB[0],

                        p2:
                            teamB[1],

                        total:
                            0,

                        wins:
                            0,

                        draws:
                            0,

                        losses:
                            0
                    };
                }


                duoMap[keyB]
                    .total++;


                if (
                    m.scoreA ===
                    m.scoreB
                ) {

                    duoMap[keyB]
                        .draws++;

                } else if (
                    m.scoreB >
                    m.scoreA
                ) {

                    duoMap[keyB]
                        .wins++;

                } else {

                    duoMap[keyB]
                        .losses++;
                }
            }
        }
    );


    // (v2.1.2 FIX) Ẩn cặp đấu có ÍT NHẤT 1 người là "Khách mời"/
    // "Khách mời N" (tài khoản khách vãng lai dùng chung, mỗi buổi là
    // 1 người thật khác nhau) - vinh danh 1 cặp cố định không có ý
    // nghĩa trong trường hợp này.
    let duosArr =
        Object
            .values(
                duoMap
            )
            .filter(
                function(d) {

                    return (
                        d.total >= 3 &&
                        !isPhase3GuestName_(d.p1) &&
                        !isPhase3GuestName_(d.p2)
                    );
                }
            );


    duosArr.sort(
        function(a, b) {

            let rateA =
                a.wins /
                a.total;


            let rateB =
                b.wins /
                b.total;


            if (
                rateB !== rateA
            ) {

                return (
                    rateB -
                    rateA
                );
            }


            if (
                b.wins !==
                a.wins
            ) {

                return (
                    b.wins -
                    a.wins
                );
            }


            return (
                b.total -
                a.total
            );
        }
    );


    // FIX5: chỉ Top 10.
    duosArr =
        duosArr.slice(
            0,
            10
        );

    // (v2.0 - điểm yếu #9): tên thành viên trong danh sách cặp đôi -
    // escape trước khi chèn HTML.
    let esc_ = (typeof escapeHtml_ === 'function') ? escapeHtml_ : (s => String(s == null ? '' : s));


    if (
        duosArr.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="p-4 text-center text-slate-400 italic"
                >
                    Chưa có cặp đôi nào đạt ngưỡng tối thiểu từ 3 trận đấu chung trở lên.
                </td>
            </tr>
        `;

        return;
    }


    duosArr.forEach(
        function(
            d,
            idx
        ) {

            let winRate =
                (
                    (
                        d.wins /
                        d.total
                    ) *
                    100
                )
                .toFixed(
                    0
                );


            let rankBadge =
                idx === 0
                    ? "🥇"
                    : (
                        idx === 1
                            ? "🥈"
                            : (
                                idx === 2
                                    ? "🥉"
                                    : "#" +
                                      (
                                          idx +
                                          1
                                      )
                            )
                    );


            tbody.innerHTML += `
                <tr class="border-b hover:bg-slate-50">
                    <td class="p-2.5 text-center font-black text-sm">
                        ${rankBadge}
                    </td>
                    <td class="p-2.5 font-bold text-slate-900">
                        ${esc_(d.p1)} & ${esc_(d.p2)}
                    </td>
                    <td class="p-2.5 text-center font-semibold">
                        ${d.total}
                    </td>
                    <td class="p-2.5 text-center font-bold text-blue-600">
                        ${d.wins}
                    </td>
                    <td class="p-2.5 text-center font-bold text-amber-600">
                        ${d.draws}
                    </td>
                    <td class="p-2.5 text-center font-bold text-red-600">
                        ${d.losses}
                    </td>
                    <td class="p-2.5 text-right font-black text-emerald-700 text-sm">
                        ${winRate}%
                    </td>
                </tr>
            `;
        }
    );
}


function renderRivalsAnalytics() {

    let duyenNoBody =
        document.getElementById(
            "rivalsDuyenNoBody"
        );


    let canSucBody =
        document.getElementById(
            "rivalsCanSucBody"
        );


    let khacTinhBody =
        document.getElementById(
            "rivalsKhacTinhBody"
        );


    if (
        !duyenNoBody ||
        !canSucBody ||
        !khacTinhBody
    ) {
        return;
    }


    duyenNoBody.innerHTML =
        "";


    canSucBody.innerHTML =
        "";


    khacTinhBody.innerHTML =
        "";

    // (v2.0 - điểm yếu #9): tên thành viên trong bảng "cạ cứng"/"khắc tinh" -
    // escape trước khi chèn HTML.
    let esc_ = (typeof escapeHtml_ === 'function') ? escapeHtml_ : (s => String(s == null ? '' : s));


    let headToHeadMap =
        {};


    let pairDuyenNoMap =
        {};


    getAnalyticsMatches_()
    .forEach(
        function(m) {

            let teamA = [
                m.p1_v1,
                m.p2_v1
            ]
            .filter(Boolean);


            let teamB = [
                m.p1_v2,
                m.p2_v2
            ]
            .filter(Boolean);


            if (
                teamA.length > 0 &&
                teamB.length > 0
            ) {

                let teamASortedStr =
                    [
                        ...teamA
                    ]
                    .sort()
                    .join(
                        " & "
                    );


                let teamBSortedStr =
                    [
                        ...teamB
                    ]
                    .sort()
                    .join(
                        " & "
                    );


                let pairKey =
                    [
                        teamASortedStr,
                        teamBSortedStr
                    ]
                    .sort()
                    .join(
                        " vs "
                    );


                if (
                    !pairDuyenNoMap[
                        pairKey
                    ]
                ) {

                    pairDuyenNoMap[
                        pairKey
                    ] = {

                        t1:
                            teamASortedStr,

                        t2:
                            teamBSortedStr,

                        count:
                            0
                    };
                }


                pairDuyenNoMap[
                    pairKey
                ]
                .count++;


                teamA.forEach(
                    function(a) {

                        teamB.forEach(
                            function(b) {

                                let k1 =
                                    a +
                                    " vs " +
                                    b;


                                let k2 =
                                    b +
                                    " vs " +
                                    a;


                                if (
                                    !headToHeadMap[
                                        k1
                                    ]
                                ) {

                                    headToHeadMap[
                                        k1
                                    ] = {

                                        player:
                                            a,

                                        vs:
                                            b,

                                        matches:
                                            0,

                                        wins:
                                            0,

                                        losses:
                                            0,

                                        draws:
                                            0
                                    };
                                }


                                headToHeadMap[
                                    k1
                                ]
                                .matches++;


                                if (
                                    m.scoreA >
                                    m.scoreB
                                ) {

                                    headToHeadMap[
                                        k1
                                    ]
                                    .wins++;

                                } else if (
                                    m.scoreA <
                                    m.scoreB
                                ) {

                                    headToHeadMap[
                                        k1
                                    ]
                                    .losses++;

                                } else {

                                    headToHeadMap[
                                        k1
                                    ]
                                    .draws++;
                                }


                                if (
                                    !headToHeadMap[
                                        k2
                                    ]
                                ) {

                                    headToHeadMap[
                                        k2
                                    ] = {

                                        player:
                                            b,

                                        vs:
                                            a,

                                        matches:
                                            0,

                                        wins:
                                            0,

                                        losses:
                                            0,

                                        draws:
                                            0
                                    };
                                }


                                headToHeadMap[
                                    k2
                                ]
                                .matches++;


                                if (
                                    m.scoreB >
                                    m.scoreA
                                ) {

                                    headToHeadMap[
                                        k2
                                    ]
                                    .wins++;

                                } else if (
                                    m.scoreB <
                                    m.scoreA
                                ) {

                                    headToHeadMap[
                                        k2
                                    ]
                                    .losses++;

                                } else {

                                    headToHeadMap[
                                        k2
                                    ]
                                    .draws++;
                                }
                            }
                        );
                    }
                );
            }
        }
    );


    let duyenNoArr =
        Object
            .values(
                pairDuyenNoMap
            )
            .sort(
                function(a, b) {

                    return (
                        b.count -
                        a.count
                    );
                }
            )
            .slice(
                0,
                5
            );


    if (
        duyenNoArr.length ===
        0
    ) {

        duyenNoBody.innerHTML = `
            <tr>
                <td
                    colspan="2"
                    class="p-3 text-center text-slate-400 italic"
                >
                    Chưa có dữ liệu
                </td>
            </tr>
        `;

    } else {

        duyenNoArr.forEach(
            function(d) {

                duyenNoBody.innerHTML += `
                    <tr class="border-b">
                        <td class="p-1.5 font-semibold text-xs text-slate-800">
                            <span class="text-emerald-800 font-bold">${esc_(d.t1)}</span>
                            <div class="text-center my-0.5"><span class="text-lg">🔥</span></div>
                            <span class="text-blue-800 font-bold">${esc_(d.t2)}</span>
                        </td>
                        <td class="p-1.5 text-center font-black text-amber-600 align-middle">
                            ${d.count} trận
                        </td>
                    </tr>
                `;
            }
        );
    }


    let h2hArr =
        Object
            .values(
                headToHeadMap
            )
            .filter(
                function(h) {

                    return (
                        h.matches >=
                        2
                    );
                }
            );


    h2hArr.sort(
        function(a, b) {

            let rateA =
                Math.abs(
                    (
                        a.wins /
                        a.matches
                    ) -
                    0.5
                );


            let rateB =
                Math.abs(
                    (
                        b.wins /
                        b.matches
                    ) -
                    0.5
                );


            return (
                rateA -
                rateB
            );
        }
    );


    let canSucArr =
        h2hArr.slice(
            0,
            5
        );


    if (
        canSucArr.length ===
        0
    ) {

        canSucBody.innerHTML = `
            <tr>
                <td
                    colspan="2"
                    class="p-3 text-center text-slate-400 italic"
                >
                    Chưa có dữ liệu
                </td>
            </tr>
        `;

    } else {

        canSucArr.forEach(
            function(c) {

                let winR =
                    (
                        (
                            c.wins /
                            c.matches
                        ) *
                        100
                    )
                    .toFixed(
                        0
                    );


                canSucBody.innerHTML += `
                    <tr class="border-b">
                        <td class="p-1.5 font-semibold text-xs text-slate-800">
                            <span class="text-emerald-800 font-bold">${esc_(c.player)}</span>
                            <div class="text-center my-0.5"><span class="text-lg">🔥</span></div>
                            <span class="text-blue-800 font-bold">${esc_(c.vs)}</span>
                        </td>
                        <td class="p-1.5 text-center font-bold text-blue-700 align-middle">
                            ${c.wins}T - ${c.losses}B (${winR}%)
                        </td>
                    </tr>
                `;
            }
        );
    }


    let khacTinhArr =
        Object
            .values(
                headToHeadMap
            )
            .filter(
                function(h) {

                    return (
                        h.matches >=
                        2
                    );
                }
            );


    khacTinhArr.sort(
        function(a, b) {

            let lossRateA =
                a.losses /
                a.matches;


            let lossRateB =
                b.losses /
                b.matches;


            if (
                lossRateB !==
                lossRateA
            ) {

                return (
                    lossRateB -
                    lossRateA
                );
            }


            return (
                b.losses -
                a.losses
            );
        }
    );


    let topKhacTinh =
        khacTinhArr.slice(
            0,
            5
        );


    if (
        topKhacTinh.length ===
        0
    ) {

        khacTinhBody.innerHTML = `
            <tr>
                <td
                    colspan="2"
                    class="p-3 text-center text-slate-400 italic"
                >
                    Chưa có dữ liệu
                </td>
            </tr>
        `;

    } else {

        topKhacTinh.forEach(
            function(k) {

                let lossRate =
                    (
                        (
                            k.losses /
                            k.matches
                        ) *
                        100
                    )
                    .toFixed(
                        0
                    );


                khacTinhBody.innerHTML += `
                    <tr class="border-b">
                        <td class="p-1.5 font-semibold text-xs text-slate-800">
                            <span class="text-purple-800 font-bold">${esc_(k.player)}</span>
                            <div class="text-center my-0.5"><span class="text-lg">🔥</span></div>
                            <span class="text-red-700 font-bold">${esc_(k.vs)}</span>
                        </td>
                        <td class="p-1.5 text-right font-black text-purple-700 align-middle">
                            ${lossRate}% (${k.losses}T)
                        </td>
                    </tr>
                `;
            }
        );
    }
}


// ======================================================
// PERSONAL FINDER
// ======================================================

function ensureAnalyticsReady_(
    callback
) {

    if (
        window.analyticsDataLoaded ===
        true
    ) {

        callback();

        return;
    }


    fetchAnalyticsData(
        true,
        function() {

            callback();
        }
    );
}


function openPersonalMatchFinderModal() {

    ensureAnalyticsReady_(
        function() {

            populateFinderSelectors();

            updatePersonalMatchFinder();


            let modal =
                document.getElementById(
                    "personalMatchFinderModal"
                );


            if (modal) {

                modal.classList.remove(
                    "hidden"
                );


                modal.classList.add(
                    "flex"
                );
            }
        }
    );
}


function closePersonalMatchFinderModal() {

    let modal =
        document.getElementById(
            "personalMatchFinderModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );


        modal.classList.remove(
            "flex"
        );
    }
}


function populateFinderSelectors() {

    if (
        !members ||
        members.length === 0
    ) {
        return;
    }


    [
        "finderMainUser",
        "finderPartnerUser",
        "finderRivalUser"
    ]
    .forEach(
        function(id) {

            let sel =
                document.getElementById(
                    id
                );


            if (!sel) {
                return;
            }


            let currentVal =
                sel.value;


            sel.innerHTML =
                "";


            if (
                id !==
                "finderMainUser"
            ) {

                let optDefault =
                    document.createElement(
                        "option"
                    );


                optDefault.value =
                    "";


                optDefault.textContent =
                    "-- Chọn thành viên --";


                sel.appendChild(
                    optDefault
                );
            }


            members.forEach(
                function(m) {

                    let opt =
                        document.createElement(
                            "option"
                        );


                    opt.value =
                        m.name;


                    opt.textContent =
                        m.name;


                    sel.appendChild(
                        opt
                    );
                }
            );


            if (
                id ===
                    "finderMainUser" &&
                loggedInMemberName
            ) {

                sel.value =
                    loggedInMemberName;

            } else if (
                currentVal
            ) {

                sel.value =
                    currentVal;
            }
        }
    );
}


function updatePersonalMatchFinder() {

    let mainUser =
        document
            .getElementById(
                "finderMainUser"
            )
            .value;


    let partnerUser =
        document
            .getElementById(
                "finderPartnerUser"
            )
            .value;


    let rivalUser =
        document
            .getElementById(
                "finderRivalUser"
            )
            .value;


    let analyticsMatches =
        getAnalyticsMatches_();


    let partnerBox =
        document.getElementById(
            "partnerResultBox"
        );


    if (!partnerUser) {

        partnerBox
            .classList
            .add(
                "hidden"
            );

    } else {

        partnerBox
            .classList
            .remove(
                "hidden"
            );


        document
            .getElementById(
                "partnerNameTitle"
            )
            .innerText =
                `${mainUser} & ${partnerUser}`;


        let pTotal = 0;
        let pWins = 0;
        let pDraws = 0;
        let pLosses = 0;


        analyticsMatches.forEach(
            function(m) {

                let isV1 =
                    (
                        m.p1_v1 ===
                            mainUser &&
                        m.p2_v1 ===
                            partnerUser
                    )
                    ||
                    (
                        m.p1_v1 ===
                            partnerUser &&
                        m.p2_v1 ===
                            mainUser
                    );


                let isV2 =
                    (
                        m.p1_v2 ===
                            mainUser &&
                        m.p2_v2 ===
                            partnerUser
                    )
                    ||
                    (
                        m.p1_v2 ===
                            partnerUser &&
                        m.p2_v2 ===
                            mainUser
                    );


                if (
                    isV1 ||
                    isV2
                ) {

                    pTotal++;


                    if (
                        m.scoreA ===
                        m.scoreB
                    ) {

                        pDraws++;

                    } else if (
                        (
                            isV1 &&
                            m.scoreA >
                                m.scoreB
                        )
                        ||
                        (
                            isV2 &&
                            m.scoreB >
                                m.scoreA
                        )
                    ) {

                        pWins++;

                    } else {

                        pLosses++;
                    }
                }
            }
        );


        document
            .getElementById(
                "resPartnerTotal"
            )
            .innerText =
                pTotal;


        document
            .getElementById(
                "resPartnerWins"
            )
            .innerText =
                pWins;


        document
            .getElementById(
                "resPartnerDraws"
            )
            .innerText =
                pDraws;


        document
            .getElementById(
                "resPartnerLosses"
            )
            .innerText =
                pLosses;


        let pRate =
            pTotal > 0
                ? (
                    (
                        pWins /
                        pTotal
                    ) *
                    100
                )
                .toFixed(
                    0
                ) +
                "%"
                : "0%";


        document
            .getElementById(
                "resPartnerRate"
            )
            .innerText =
                pRate;
    }


    let rivalBox =
        document.getElementById(
            "rivalResultBox"
        );


    if (!rivalUser) {

        rivalBox
            .classList
            .add(
                "hidden"
            );

    } else {

        rivalBox
            .classList
            .remove(
                "hidden"
            );


        document
            .getElementById(
                "rivalNameTitle"
            )
            .innerText =
                `${mainUser} vs ${rivalUser}`;


        let rTotal = 0;
        let rWins = 0;
        let rDraws = 0;
        let rLosses = 0;


        analyticsMatches.forEach(
            function(m) {

                let inV1 =
                    (
                        m.p1_v1 ===
                            mainUser ||
                        m.p2_v1 ===
                            mainUser
                    );


                let inV2 =
                    (
                        m.p1_v2 ===
                            mainUser ||
                        m.p2_v2 ===
                            mainUser
                    );


                let rivalInV1 =
                    (
                        m.p1_v1 ===
                            rivalUser ||
                        m.p2_v1 ===
                            rivalUser
                    );


                let rivalInV2 =
                    (
                        m.p1_v2 ===
                            rivalUser ||
                        m.p2_v2 ===
                            rivalUser
                    );


                if (
                    (
                        inV1 &&
                        rivalInV2
                    )
                    ||
                    (
                        inV2 &&
                        rivalInV1
                    )
                ) {

                    rTotal++;


                    if (
                        m.scoreA ===
                        m.scoreB
                    ) {

                        rDraws++;

                    } else if (
                        (
                            inV1 &&
                            m.scoreA >
                                m.scoreB
                        )
                        ||
                        (
                            inV2 &&
                            m.scoreB >
                                m.scoreA
                        )
                    ) {

                        rWins++;

                    } else {

                        rLosses++;
                    }
                }
            }
        );


        document
            .getElementById(
                "resRivalTotal"
            )
            .innerText =
                rTotal;


        document
            .getElementById(
                "resRivalWins"
            )
            .innerText =
                rWins;


        document
            .getElementById(
                "resRivalDraws"
            )
            .innerText =
                rDraws;


        document
            .getElementById(
                "resRivalLosses"
            )
            .innerText =
                rLosses;


        let rRate =
            rTotal > 0
                ? (
                    (
                        rWins /
                        rTotal
                    ) *
                    100
                )
                .toFixed(
                    0
                ) +
                "%"
                : "0%";


        document
            .getElementById(
                "resRivalRate"
            )
            .innerText =
                rRate;
    }
}


function openTop5PersonalModal() {

    ensureAnalyticsReady_(
        function() {

            openTop5PersonalModalReady_();
        }
    );
}


function openTop5PersonalModalReady_() {

    let mainUser =
        document
            .getElementById(
                "finderMainUser"
            )
            .value;


    if (!mainUser) {

        alert(
            "Vui lòng chọn thành viên tra cứu!"
        );

        return;
    }


    document
        .getElementById(
            "top5ModalTitle"
        )
        .innerText =
            `TOP 5 CẠ CỨNG & KHẮC TINH: ${mainUser}`;


    let partnerMap =
        {};


    let rivalMap =
        {};


    getAnalyticsMatches_()
    .forEach(
        function(m) {

            let teamA = [
                m.p1_v1,
                m.p2_v1
            ]
            .filter(Boolean);


            let teamB = [
                m.p1_v2,
                m.p2_v2
            ]
            .filter(Boolean);


            let inA =
                teamA.includes(
                    mainUser
                );


            let inB =
                teamB.includes(
                    mainUser
                );


            if (inA) {

                let partner =
                    teamA.find(
                        function(p) {

                            return (
                                p !==
                                mainUser
                            );
                        }
                    );


                if (partner) {

                    if (
                        !partnerMap[
                            partner
                        ]
                    ) {

                        partnerMap[
                            partner
                        ] = {

                            name:
                                partner,

                            total:
                                0,

                            wins:
                                0
                        };
                    }


                    partnerMap[
                        partner
                    ]
                    .total++;


                    if (
                        m.scoreA >
                        m.scoreB
                    ) {

                        partnerMap[
                            partner
                        ]
                        .wins++;
                    }
                }


                teamB.forEach(
                    function(opp) {

                        if (
                            !rivalMap[
                                opp
                            ]
                        ) {

                            rivalMap[
                                opp
                            ] = {

                                name:
                                    opp,

                                total:
                                    0,

                                losses:
                                    0
                            };
                        }


                        rivalMap[
                            opp
                        ]
                        .total++;


                        if (
                            m.scoreB >
                            m.scoreA
                        ) {

                            rivalMap[
                                opp
                            ]
                            .losses++;
                        }
                    }
                );


            } else if (
                inB
            ) {

                let partner =
                    teamB.find(
                        function(p) {

                            return (
                                p !==
                                mainUser
                            );
                        }
                    );


                if (partner) {

                    if (
                        !partnerMap[
                            partner
                        ]
                    ) {

                        partnerMap[
                            partner
                        ] = {

                            name:
                                partner,

                            total:
                                0,

                            wins:
                                0
                        };
                    }


                    partnerMap[
                        partner
                    ]
                    .total++;


                    if (
                        m.scoreB >
                        m.scoreA
                    ) {

                        partnerMap[
                            partner
                        ]
                        .wins++;
                    }
                }


                teamA.forEach(
                    function(opp) {

                        if (
                            !rivalMap[
                                opp
                            ]
                        ) {

                            rivalMap[
                                opp
                            ] = {

                                name:
                                    opp,

                                total:
                                    0,

                                losses:
                                    0
                            };
                        }


                        rivalMap[
                            opp
                        ]
                        .total++;


                        if (
                            m.scoreA >
                            m.scoreB
                        ) {

                            rivalMap[
                                opp
                            ]
                            .losses++;
                        }
                    }
                );
            }
        }
    );


    let partnersArr =
        Object
            .values(
                partnerMap
            )
            .sort(
                function(a, b) {

                    let rateA =
                        a.total > 0
                            ? (
                                a.wins /
                                a.total
                            )
                            : 0;


                    let rateB =
                        b.total > 0
                            ? (
                                b.wins /
                                b.total
                            )
                            : 0;


                    if (
                        rateB !==
                        rateA
                    ) {

                        return (
                            rateB -
                            rateA
                        );
                    }


                    return (
                        b.total -
                        a.total
                    );
                }
            )
            .slice(
                0,
                5
            );


    let partBody =
        document.getElementById(
            "top5PartnerBody"
        );


    partBody.innerHTML =
        "";

    // (v2.0 - điểm yếu #9): tên thành viên trong Top 5 - escape trước khi
    // chèn HTML.
    let esc_ = (typeof escapeHtml_ === 'function') ? escapeHtml_ : (s => String(s == null ? '' : s));


    if (
        partnersArr.length ===
        0
    ) {

        partBody.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="p-3 text-center text-slate-400 italic"
                >
                    Chưa có dữ liệu phối hợp đồng đội.
                </td>
            </tr>
        `;

    } else {

        partnersArr.forEach(
            function(p) {

                let rate =
                    p.total > 0
                        ? (
                            (
                                p.wins /
                                p.total
                            ) *
                            100
                        )
                        .toFixed(
                            0
                        ) +
                        "%"
                        : "0%";


                partBody.innerHTML += `
                    <tr class="border-b">
                        <td class="p-2 font-bold text-slate-900">${esc_(p.name)}</td>
                        <td class="p-2 text-center font-semibold">${p.total}</td>
                        <td class="p-2 text-center font-bold text-blue-600">${p.wins}</td>
                        <td class="p-2 text-right font-black text-emerald-700">${rate}</td>
                    </tr>
                `;
            }
        );
    }


    let rivalsArr =
        Object
            .values(
                rivalMap
            )
            .sort(
                function(a, b) {

                    let rateA =
                        a.total > 0
                            ? (
                                a.losses /
                                a.total
                            )
                            : 0;


                    let rateB =
                        b.total > 0
                            ? (
                                b.losses /
                                b.total
                            )
                            : 0;


                    if (
                        rateB !==
                        rateA
                    ) {

                        return (
                            rateB -
                            rateA
                        );
                    }


                    return (
                        b.total -
                        a.total
                    );
                }
            )
            .slice(
                0,
                5
            );


    let rivalBody =
        document.getElementById(
            "top5RivalBody"
        );


    rivalBody.innerHTML =
        "";


    if (
        rivalsArr.length ===
        0
    ) {

        rivalBody.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="p-3 text-center text-slate-400 italic"
                >
                    Chưa có dữ liệu đối đầu.
                </td>
            </tr>
        `;

    } else {

        rivalsArr.forEach(
            function(r) {

                let lossRate =
                    r.total > 0
                        ? (
                            (
                                r.losses /
                                r.total
                            ) *
                            100
                        )
                        .toFixed(
                            0
                        ) +
                        "%"
                        : "0%";


                rivalBody.innerHTML += `
                    <tr class="border-b">
                        <td class="p-2 font-bold text-slate-900">${esc_(r.name)}</td>
                        <td class="p-2 text-center font-semibold">${r.total}</td>
                        <td class="p-2 text-center font-bold text-red-600">${r.losses}</td>
                        <td class="p-2 text-right font-black text-purple-700">${lossRate}</td>
                    </tr>
                `;
            }
        );
    }


    let modal =
        document.getElementById(
            "top5PersonalModal"
        );


    if (modal) {

        modal.classList.remove(
            "hidden"
        );


        modal.classList.add(
            "flex"
        );
    }
}


function closeTop5PersonalModal() {

    let modal =
        document.getElementById(
            "top5PersonalModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );


        modal.classList.remove(
            "flex"
        );
    }
}

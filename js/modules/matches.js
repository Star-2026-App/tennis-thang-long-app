// ======================================================
// MATCHES.JS - PHASE 3 A7 FIX
//
// NỀN TẢNG: A6 ĐÃ PASS
//
// Chỉ bổ sung:
// - Nút "↩ Tháng hiện tại" khi đang chọn một ngày.
// - Bấm nút -> xóa ngày lọc -> trở lại toàn bộ trận tháng hiện tại.
//
// KHÔNG thay đổi:
// - Month cache
// - Lazy loading
// - activeDataMonth / activeDataYear
// - Dashboard / Finance
// ======================================================


// ======================================================
// STATE RIÊNG CHO NHẬT KÝ TRẬN
// ======================================================

window.matchLogViewMatches =
    Array.isArray(
        window.matchLogViewMatches
    )
        ? window.matchLogViewMatches
        : [];


window.matchLogViewMonth =
    parseInt(
        window.matchLogViewMonth
    ) || 0;


window.matchLogViewYear =
    parseInt(
        window.matchLogViewYear
    ) || 0;


window.matchLogLoadingKey =
    window.matchLogLoadingKey ||
    "";


// ======================================================
// BỎ NÚT "TẤT CẢ CÁC NGÀY" CŨ
// ======================================================

function removeLegacyAllDatesButton_() {

    let dateInput =
        document.getElementById(
            "filterMatchDate"
        );


    if (
        !dateInput ||
        !dateInput.parentElement
    ) {
        return;
    }


    let buttons =
        dateInput
            .parentElement
            .querySelectorAll(
                "button"
            );


    buttons.forEach(
        function(button) {

            // Không xóa nút mới của Phase 3 A7 FIX
            if (
                button.id ===
                "btnMatchCurrentMonth"
            ) {
                return;
            }


            let onclickText =
                String(
                    button.getAttribute(
                        "onclick"
                    ) || ""
                );


            if (
                onclickText.indexOf(
                    "clearMatchDateFilter"
                ) !== -1
            ) {

                button.remove();
            }
        }
    );
}


// ======================================================
// NÚT "THÁNG HIỆN TẠI"
// ======================================================

function ensureMatchCurrentMonthButton_() {

    let dateInput =
        document.getElementById(
            "filterMatchDate"
        );


    if (!dateInput) {
        return;
    }


    let button =
        document.getElementById(
            "btnMatchCurrentMonth"
        );


    if (!button) {

        button =
            document.createElement(
                "button"
            );


        button.id =
            "btnMatchCurrentMonth";


        button.type =
            "button";


        button.innerHTML =
            '<i class="fa-solid fa-rotate-left mr-1"></i> Tháng hiện tại';


        button.className =
            "ml-2 px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black shadow-sm";


        button.title =
            "Bỏ lọc ngày và quay về toàn bộ trận của tháng hiện tại";


        button.addEventListener(
            "click",
            function() {

                returnMatchLogToCurrentMonth_();
            }
        );


        dateInput.insertAdjacentElement(
            "afterend",
            button
        );
    }


    // Chỉ hiện khi đang lọc một ngày cụ thể
    if (dateInput.value) {

        button.classList.remove(
            "hidden"
        );

    } else {

        button.classList.add(
            "hidden"
        );
    }
}


// ======================================================
// QUAY VỀ THÁNG HIỆN TẠI
//
// CHỈ:
// - xóa ngày đang lọc
// - gọi lại renderAllMatchLog()
//
// renderAllMatchLog() của A6 tự xác định tháng hiện tại.
// Không can thiệp activeDataMonth.
// ======================================================

function returnMatchLogToCurrentMonth_() {

    let dateInput =
        document.getElementById(
            "filterMatchDate"
        );


    if (dateInput) {

        dateInput.value =
            "";
    }


    renderAllMatchLog();
}


// ======================================================
// CHUẨN HÓA THỜI GIAN TRẬN
//
// Dữ liệu cũ: HH:mm:ss dd/MM/yyyy hoặc dd/MM/yyyy HH:mm:ss
// Dữ liệu mới: ISO UTC, ví dụ 2026-08-16T15:02:13.000Z
// Mọi giá trị ISO được đổi sang giờ Việt Nam trước khi hiển thị/lọc.
// ======================================================

function padMatchDatePart_(value) {

    return String(
        parseInt(value) || 0
    ).padStart(
        2,
        "0"
    );
}


function getMatchDateTimeParts_(
    value
) {

    let text =
        String(
            value || ""
        ).trim();


    if (!text) {
        return null;
    }


    // Chuỗi ngày giờ kiểu Việt Nam hiện có trong dữ liệu cũ.
    let localDateMatch =
        text.match(
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/
        );


    if (localDateMatch) {

        let localTimeMatch =
            text.match(
                /(?:^|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s|$)/
            );


        return {
            day: parseInt(localDateMatch[1]) || 0,
            month: parseInt(localDateMatch[2]) || 0,
            year: parseInt(localDateMatch[3]) || 0,
            hour: localTimeMatch ? parseInt(localTimeMatch[1]) || 0 : 0,
            minute: localTimeMatch ? parseInt(localTimeMatch[2]) || 0 : 0,
            second: localTimeMatch ? parseInt(localTimeMatch[3]) || 0 : 0,
            hasTime: Boolean(localTimeMatch)
        };
    }


    let parsedDate =
        Object.prototype.toString.call(value) ===
        "[object Date]"
            ? value
            : new Date(text);


    if (
        !parsedDate ||
        isNaN(
            parsedDate.getTime()
        )
    ) {
        return null;
    }


    try {

        let formatter =
            new Intl.DateTimeFormat(
                "en-GB",
                {
                    timeZone: "Asia/Ho_Chi_Minh",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hourCycle: "h23"
                }
            );


        let result = {};


        formatter
            .formatToParts(
                parsedDate
            )
            .forEach(
                function(part) {

                    if (
                        part.type !==
                        "literal"
                    ) {
                        result[part.type] =
                            part.value;
                    }
                }
            );


        return {
            day: parseInt(result.day) || 0,
            month: parseInt(result.month) || 0,
            year: parseInt(result.year) || 0,
            hour: parseInt(result.hour) || 0,
            minute: parseInt(result.minute) || 0,
            second: parseInt(result.second) || 0,
            hasTime: true
        };

    } catch (error) {

        return {
            day: parsedDate.getDate(),
            month: parsedDate.getMonth() + 1,
            year: parsedDate.getFullYear(),
            hour: parsedDate.getHours(),
            minute: parsedDate.getMinutes(),
            second: parsedDate.getSeconds(),
            hasTime: true
        };
    }
}


function getMatchDateParts_(
    value
) {

    let parts =
        getMatchDateTimeParts_(
            value
        );


    if (!parts) {
        return null;
    }


    return {
        day: parts.day,
        month: parts.month,
        year: parts.year
    };
}


function formatMatchLogTime_(
    value
) {

    let text =
        String(
            value || ""
        ).trim();


    if (!text) {
        return "-";
    }


    let parts =
        getMatchDateTimeParts_(
            value
        );


    if (!parts) {
        return text;
    }


    let dateText =
        padMatchDatePart_(parts.day) +
        "/" +
        padMatchDatePart_(parts.month) +
        "/" +
        parts.year;


    if (!parts.hasTime) {
        return dateText;
    }


    return (
        padMatchDatePart_(parts.hour) +
        ":" +
        padMatchDatePart_(parts.minute) +
        ":" +
        padMatchDatePart_(parts.second) +
        " " +
        dateText
    );
}


// ======================================================
// PARSE NGÀY ĐƯỢC CHỌN TRÊN INPUT TYPE=DATE
// yyyy-mm-dd
// ======================================================

function getSelectedMatchDateParts_() {

    let dateInput =
        document.getElementById(
            "filterMatchDate"
        );


    if (
        !dateInput ||
        !dateInput.value
    ) {
        return null;
    }


    let parts =
        String(
            dateInput.value
        ).split(
            "-"
        );


    if (
        parts.length !==
        3
    ) {
        return null;
    }


    let year =
        parseInt(
            parts[0]
        ) || 0;


    let month =
        parseInt(
            parts[1]
        ) || 0;


    let day =
        parseInt(
            parts[2]
        ) || 0;


    if (
        !day ||
        !month ||
        !year
    ) {
        return null;
    }


    return {

        day:
            day,

        month:
            month,

        year:
            year
    };
}


// ======================================================
// CACHE THÁNG CHO NHẬT KÝ TRẬN
// ======================================================

function getMatchLogMonthCache_(
    month,
    year
) {

    if (
        typeof getCachedMonthData_ ===
        "function"
    ) {

        return getCachedMonthData_(
            month,
            year
        );
    }


    let key =
        parseInt(year) +
        "_" +
        parseInt(month);


    return (
        window.monthDataCache &&
        window.monthDataCache[
            key
        ]
    ) || null;
}


function setMatchLogViewFromCache_(
    month,
    year
) {

    let cache =
        getMatchLogMonthCache_(
            month,
            year
        );


    if (!cache) {
        return false;
    }


    window.matchLogViewMatches =
        Array.isArray(
            cache.matches
        )
            ? cache.matches.slice()
            : [];


    window.matchLogViewMonth =
        parseInt(
            month
        );


    window.matchLogViewYear =
        parseInt(
            year
        );


    return true;
}


// ======================================================
// LƯU MONTH DATA VÀO CACHE NHƯNG KHÔNG ACTIVATE
//
// Chọn ngày tháng cũ trong Nhật ký Trận không được làm
// Dashboard/Finance chuyển sang tháng cũ theo.
// ======================================================

function saveMatchLogMonthDataToCache_(
    month,
    year,
    data
) {

    if (
        typeof setCachedMonthData_ ===
        "function"
    ) {

        setCachedMonthData_(
            month,
            year,
            {

                matches:
                    data &&
                    Array.isArray(
                        data.matches
                    )
                        ? data.matches
                        : [],

                bookingLogs:
                    data &&
                    Array.isArray(
                        data.bookingLogs
                    )
                        ? data.bookingLogs
                        : []
            }
        );


        return;
    }


    if (
        !window.monthDataCache ||
        typeof window.monthDataCache !==
            "object"
    ) {

        window.monthDataCache =
            {};
    }


    let key =
        parseInt(year) +
        "_" +
        parseInt(month);


    window.monthDataCache[
        key
    ] = {

        month:
            parseInt(
                month
            ),

        year:
            parseInt(
                year
            ),

        matches:
            data &&
            Array.isArray(
                data.matches
            )
                ? data.matches.slice()
                : [],

        bookingLogs:
            data &&
            Array.isArray(
                data.bookingLogs
            )
                ? data.bookingLogs.slice()
                : [],

        loadedAt:
            Date.now()
    };
}


// ======================================================
// TẢI DỮ LIỆU THÁNG RIÊNG CHO NHẬT KÝ TRẬN
//
// GIỮ NGUYÊN LOGIC A6 ĐÃ PASS.
// ======================================================

function ensureMatchLogMonthLoaded_(
    month,
    year
) {

    month =
        parseInt(
            month
        );


    year =
        parseInt(
            year
        );


    if (
        !month ||
        !year
    ) {
        return;
    }


    if (
        setMatchLogViewFromCache_(
            month,
            year
        )
    ) {

        return;
    }


    let key =
        year +
        "_" +
        month;


    if (
        window.matchLogLoadingKey ===
        key
    ) {
        return;
    }


    // Nếu đúng tháng đang active nhưng cache chưa sẵn,
    // dùng state hiện tại trước khi Cloud hoàn tất.
    if (
        parseInt(
            window.activeDataMonth
        ) === month &&
        parseInt(
            window.activeDataYear
        ) === year &&
        Array.isArray(
            matches
        )
    ) {

        window.matchLogViewMatches =
            matches.slice();


        window.matchLogViewMonth =
            month;


        window.matchLogViewYear =
            year;


        return;
    }


    if (
        typeof fetchJsonpPhase3_ !==
        "function"
    ) {

        console.error(
            "MATCH LOG MONTH LOAD ERROR: fetchJsonpPhase3_ chưa sẵn sàng."
        );


        return;
    }


    window.matchLogLoadingKey =
        key;


    let tbody =
        document.getElementById(
            "allMatchTableBody"
        );


    if (tbody) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="p-5 text-center text-slate-400 italic"
                >
                    Đang tải dữ liệu tháng ${month}/${year}...
                </td>

            </tr>
        `;
    }


    fetchJsonpPhase3_(
        {

            action:
                "monthData",

            month:
                month,

            year:
                year
        },

        true,

        function(
            error,
            data
        ) {

            window.matchLogLoadingKey =
                "";


            if (error) {

                console.error(
                    "MATCH LOG MONTH DATA ERROR:",
                    error
                );


                if (
                    typeof showToast ===
                    "function"
                ) {

                    showToast(
                        `Chưa tải được Nhật ký trận tháng ${month}/${year}.`
                    );
                }


                if (tbody) {

                    tbody.innerHTML = `

                        <tr>

                            <td
                                colspan="7"
                                class="p-5 text-center text-red-500 italic"
                            >
                                Không tải được dữ liệu tháng ${month}/${year}.
                            </td>

                        </tr>
                    `;
                }


                return;
            }


            if (
                !data ||
                data.status !==
                    "SUCCESS"
            ) {

                console.error(
                    "MATCH LOG MONTH DATA INVALID:",
                    data
                );


                return;
            }


            saveMatchLogMonthDataToCache_(
                month,
                year,
                data
            );


            setMatchLogViewFromCache_(
                month,
                year
            );


            renderAllMatchLog();
        }
    );
}


// ======================================================
// GIỮ HÀM CŨ ĐỂ TƯƠNG THÍCH
// ======================================================

function clearMatchDateFilter() {

    let dateInput =
        document.getElementById(
            "filterMatchDate"
        );


    if (dateInput) {

        dateInput.value =
            "";
    }


    renderAllMatchLog();
}


// ======================================================
// DANH SÁCH TRẬN THÁNG HIỆN TẠI CHO BADGE "HÔM NAY"
// ======================================================

function getCurrentMonthMatchesForTodayBadge_() {

    let now =
        new Date();


    let month =
        now.getMonth() +
        1;


    let year =
        now.getFullYear();


    let cache =
        getMatchLogMonthCache_(
            month,
            year
        );


    if (
        cache &&
        Array.isArray(
            cache.matches
        )
    ) {

        return cache.matches;
    }


    if (
        parseInt(
            window.activeDataMonth
        ) === month &&
        parseInt(
            window.activeDataYear
        ) === year &&
        Array.isArray(
            matches
        )
    ) {

        return matches;
    }


    return [];
}


// ======================================================
// RENDER NHẬT KÝ TRẬN
// ======================================================

function renderAllMatchLog() {

    let tbody =
        document.getElementById(
            "allMatchTableBody"
        );


    if (!tbody) {
        return;
    }


    removeLegacyAllDatesButton_();


    // A7 FIX:
    // Chỉ thêm/ẩn/hiện nút giao diện.
    // Không gọi render từ helper này.
    ensureMatchCurrentMonthButton_();


    let selectedDate =
        getSelectedMatchDateParts_();


    let now =
        new Date();


    let targetMonth =
        selectedDate
            ? selectedDate.month
            : (
                now.getMonth() +
                1
            );


    let targetYear =
        selectedDate
            ? selectedDate.year
            : now.getFullYear();


    let cache =
        getMatchLogMonthCache_(
            targetMonth,
            targetYear
        );


    // ==================================================
    // NẾU CHƯA CÓ CACHE THÁNG CẦN XEM -> TẢI THEO NHU CẦU
    // ==================================================

    if (!cache) {

        ensureMatchLogMonthLoaded_(
            targetMonth,
            targetYear
        );


        return;
    }


    setMatchLogViewFromCache_(
        targetMonth,
        targetYear
    );


    let monthMatches =
        (
            window.matchLogViewMatches ||
            []
        )
        .slice()
        .sort(
            function(
                a,
                b
            ) {

                return (
                    (
                        parseInt(
                            b.id
                        ) || 0
                    ) -
                    (
                        parseInt(
                            a.id
                        ) || 0
                    )
                );
            }
        );


    let filteredMatches =
        monthMatches;


    if (selectedDate) {

        filteredMatches =
            monthMatches.filter(
                function(match) {

                    let parts =
                        getMatchDateParts_(
                            match.time
                        );


                    if (!parts) {
                        return false;
                    }


                    return (
                        parts.day ===
                            selectedDate.day &&
                        parts.month ===
                            selectedDate.month &&
                        parts.year ===
                            selectedDate.year
                    );
                }
            );
    }


    // ==================================================
    // BADGE HÔM NAY
    // ==================================================

    let todayMatches =
        getCurrentMonthMatchesForTodayBadge_();


    let todayDay =
        now.getDate();


    let todayMonth =
        now.getMonth() +
        1;


    let todayYear =
        now.getFullYear();


    let todayCount =
        todayMatches.filter(
            function(match) {

                let parts =
                    getMatchDateParts_(
                        match.time
                    );


                return (
                    parts &&
                    parts.day ===
                        todayDay &&
                    parts.month ===
                        todayMonth &&
                    parts.year ===
                        todayYear
                );
            }
        )
        .length;


    let todayText =
        document.getElementById(
            "todayMatchCountText"
        );


    if (todayText) {

        if (selectedDate) {

            todayText.innerText =
                `Ngày ${selectedDate.day}/${selectedDate.month}/${selectedDate.year} có ${filteredMatches.length} trận đấu`;

        } else {

            todayText.innerText =
                `Ngày hôm nay có thêm ${todayCount} trận đấu được ghi nhận`;
        }
    }


    // ==================================================
    // TABLE
    // ==================================================

    tbody.innerHTML =
        "";


    if (
        filteredMatches.length ===
        0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="p-5 text-center text-slate-400 italic"
                >
                    ${
                        selectedDate
                            ? `Không có trận đấu ngày ${selectedDate.day}/${selectedDate.month}/${selectedDate.year}.`
                            : `Chưa có trận đấu trong tháng ${targetMonth}/${targetYear}.`
                    }
                </td>

            </tr>
        `;


        if (
            typeof applyRolePermissions ===
            "function"
        ) {

            applyRolePermissions();
        }


        return;
    }


    filteredMatches.forEach(
        function(
            m,
            idx
        ) {

            let stt =
                filteredMatches.length -
                idx;


            let idArg =
                JSON.stringify(
                    String(
                        m.id
                    )
                );


            tbody.innerHTML += `

                <tr class="border-b hover:bg-slate-50">

                    <td class="p-2.5 text-center font-bold text-slate-500">
                        ${stt}
                    </td>

                    <td class="p-2.5 text-slate-600">
                        ${formatMatchLogTime_(m.time)}
                    </td>

                    <td class="p-2.5 font-semibold text-slate-900">
                        ${m.p1_v1} & ${m.p2_v1}
                    </td>

                    <td class="p-2.5 font-semibold text-slate-900">
                        ${m.p1_v2} & ${m.p2_v2}
                    </td>

                    <td class="p-2.5 text-center font-black text-emerald-800">
                        ${m.scoreA} - ${m.scoreB}
                    </td>

                    <td class="p-2.5 text-right font-bold text-amber-800">
                        ${
                            parseInt(
                                m.specialBet
                            ) > 0
                                ? (
                                    parseInt(
                                        m.specialBet
                                    )
                                    .toLocaleString(
                                        "vi-VN"
                                    ) +
                                    " đ"
                                )
                                : "-"
                        }
                    </td>

                    <td class="
                        p-2.5
                        text-center
                        admin-only
                        ${
                            currentUserRole ===
                                "admin"
                                ? ""
                                : "hidden"
                        }
                        space-x-2
                    ">

                        <button
                            onclick='openEditMatchModal(${idArg})'
                            class="text-blue-600 font-bold"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            onclick='deleteMatch(${idArg})'
                            class="text-red-600 font-bold"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>

                    </td>

                </tr>
            `;
        }
    );


    if (
        typeof applyRolePermissions ===
        "function"
    ) {

        applyRolePermissions();
    }
}


// ======================================================
// TÌM MATCH TRONG TOÀN BỘ CACHE ĐÃ TẢI
// ======================================================

function findMatchForEdit_(
    id
) {

    if (
        typeof findMatchInMonthCaches_ ===
        "function"
    ) {

        let found =
            findMatchInMonthCaches_(
                id
            );


        if (found) {
            return found;
        }
    }


    let viewMatch =
        (
            window.matchLogViewMatches ||
            []
        )
        .find(
            function(item) {

                return (
                    String(
                        item.id
                    ) ===
                    String(
                        id
                    )
                );
            }
        );


    if (viewMatch) {
        return viewMatch;
    }


    return (
        matches ||
        []
    )
    .find(
        function(item) {

            return (
                String(
                    item.id
                ) ===
                    String(
                        id
                    )
            );
        }
    ) || null;
}


// ======================================================
// SỬA TRẬN
// ======================================================

function openEditMatchModal(
    id
) {

    let m =
        findMatchForEdit_(
            id
        );


    if (!m) {
        return;
    }


    document.getElementById(
        "emMatchId"
    ).value =
        m.id;


    document.getElementById(
        "emMatchInfo"
    ).value =
        `${m.time} | (${m.p1_v1}&${m.p2_v1}) vs (${m.p1_v2}&${m.p2_v2})`;


    document.getElementById(
        "emScoreA"
    ).value =
        m.scoreA;


    document.getElementById(
        "emScoreB"
    ).value =
        m.scoreB;


    document.getElementById(
        "emSpecialBet"
    ).value =
        m.specialBet ||
        0;


    document
        .getElementById(
            "editMatchModal"
        )
        .classList
        .remove(
            "hidden"
        );


    document
        .getElementById(
            "editMatchModal"
        )
        .classList
        .add(
            "flex"
        );
}


function closeEditMatchModal() {

    document
        .getElementById(
            "editMatchModal"
        )
        .classList
        .add(
            "hidden"
        );


    document
        .getElementById(
            "editMatchModal"
        )
        .classList
        .remove(
            "flex"
        );
}


function saveMatchEdit(
    e
) {

    e.preventDefault();


    let id =
        String(
            document
                .getElementById(
                    "emMatchId"
                )
                .value ||
            ""
        );


    let scoreA =
        parseInt(
            document
                .getElementById(
                    "emScoreA"
                )
                .value
        ) || 0;


    let scoreB =
        parseInt(
            document
                .getElementById(
                    "emScoreB"
                )
                .value
        ) || 0;


    let specialBet =
        parseInt(
            document
                .getElementById(
                    "emSpecialBet"
                )
                .value
        ) || 0;


    closeEditMatchModal();


    enqueueAction(
        "updateMatch",
        {

            match: {

                id:
                    id,

                scoreA:
                    scoreA,

                scoreB:
                    scoreB,

                specialBet:
                    specialBet
            }
        },
        "Đã cập nhật trận đấu thành công!"
    );
}


// ======================================================
// XÓA TRẬN
// ======================================================

function deleteMatch(
    id
) {

    if (
        confirm(
            "Xóa trận đấu này?"
        )
    ) {

        enqueueAction(
            "deleteItem",
            {

                sheetName:
                    "Matches",

                id:
                    id
            },
            "Đã xóa trận đấu thành công!"
        );
    }
}


// ======================================================
// CÁC TRẬN ĐÃ LOAD DÙNG KIỂM TRA TRÙNG
// ======================================================

function getLoadedMatchesForDuplicateCheck_() {

    let result = [];

    let seen = {};


    Object.keys(
        window.monthDataCache ||
        {}
    )
    .forEach(
        function(key) {

            let cache =
                window.monthDataCache[
                    key
                ];


            (
                cache &&
                Array.isArray(
                    cache.matches
                )
                    ? cache.matches
                    : []
            )
            .forEach(
                function(item) {

                    let itemKey =
                        String(
                            item.id
                        );


                    if (
                        seen[
                            itemKey
                        ]
                    ) {
                        return;
                    }


                    seen[
                        itemKey
                    ] =
                        true;


                    result.push(
                        item
                    );
                }
            );
        }
    );


    (
        matches ||
        []
    )
    .forEach(
        function(item) {

            let itemKey =
                String(
                    item.id
                );


            if (
                seen[
                    itemKey
                ]
            ) {
                return;
            }


            seen[
                itemKey
            ] =
                true;


            result.push(
                item
            );
        }
    );


    return result;
}


// ======================================================
// THÊM TRẬN
// ======================================================

function addMatch(
    e
) {

    e.preventDefault();


    let p1A =
        document.getElementById(
            "matchP1A"
        ).value;


    let p2A =
        document.getElementById(
            "matchP2A"
        ).value;


    let p1B =
        document.getElementById(
            "matchP1B"
        ).value;


    let p2B =
        document.getElementById(
            "matchP2B"
        ).value;


    if (
        !p1A ||
        !p2A ||
        !p1B ||
        !p2B
    ) {

        alert(
            "⚠️ Vui lòng chọn đầy đủ tên của cả 4 cầu thủ trước khi lưu trận đấu!"
        );


        return;
    }


    let playersSet =
        new Set(
            [
                p1A,
                p2A,
                p1B,
                p2B
            ]
        );


    if (
        playersSet.size <
        4
    ) {

        alert(
            "⚠️ Lỗi: 4 cầu thủ trong một trận đấu đôi phải là 4 cá nhân khác nhau hoàn toàn! Vui lòng kiểm tra lại danh sách lựa chọn."
        );


        return;
    }


    let checkedScoreA =
        document.querySelector(
            'input[name="scoreA"]:checked'
        );


    let checkedScoreB =
        document.querySelector(
            'input[name="scoreB"]:checked'
        );


    if (
        !checkedScoreA ||
        !checkedScoreB
    ) {

        alert(
            "⚠️ Vui lòng chọn đầy đủ điểm số cho cả Vế A và Vế B trước khi lưu trận đấu!"
        );


        return;
    }


    let scoreA =
        parseInt(
            checkedScoreA.value
        );


    let scoreB =
        parseInt(
            checkedScoreB.value
        );


    let specialBet =
        parseInt(
            document.getElementById(
                "specialBet"
            ).value
        ) || 0;


    showActionConfirm(
        `Xác nhận lưu kết quả trận đấu:\n(${p1A} & ${p2A}) vs (${p1B} & ${p2B})\nTỉ số: ${scoreA} - ${scoreB}?`,
        function() {

            const NOW =
                new Date()
                    .getTime();


            const TIME_LIMIT =
                18 *
                60 *
                60 *
                1000;


            let teamANew =
                [
                    p1A,
                    p2A
                ]
                .sort();


            let teamBNew =
                [
                    p1B,
                    p2B
                ]
                .sort();


            let duplicateSource =
                getLoadedMatchesForDuplicateCheck_();


            let isDuplicateMatch =
                duplicateSource.some(
                    function(item) {

                        let itemTime =
                            parseInt(
                                item.id
                            ) || 0;


                        let isWithin18h =
                            (
                                NOW -
                                itemTime
                            ) <=
                            TIME_LIMIT;


                        if (
                            !isWithin18h
                        ) {
                            return false;
                        }


                        let teamAOld =
                            [
                                item.p1_v1,
                                item.p2_v1
                            ]
                            .sort();


                        let teamBOld =
                            [
                                item.p1_v2,
                                item.p2_v2
                            ]
                            .sort();


                        let sameAsDirect =
                            (
                                teamAOld[0] ===
                                    teamANew[0] &&
                                teamAOld[1] ===
                                    teamANew[1] &&
                                teamBOld[0] ===
                                    teamBNew[0] &&
                                teamBOld[1] ===
                                    teamBNew[1] &&
                                parseInt(
                                    item.scoreA
                                ) ===
                                    scoreA &&
                                parseInt(
                                    item.scoreB
                                ) ===
                                    scoreB
                            );


                        let sameAsSwapped =
                            (
                                teamAOld[0] ===
                                    teamBNew[0] &&
                                teamAOld[1] ===
                                    teamBNew[1] &&
                                teamBOld[0] ===
                                    teamANew[0] &&
                                teamBOld[1] ===
                                    teamANew[1] &&
                                parseInt(
                                    item.scoreA
                                ) ===
                                    scoreB &&
                                parseInt(
                                    item.scoreB
                                ) ===
                                    scoreA
                            );


                        return (
                            sameAsDirect ||
                            sameAsSwapped
                        );
                    }
                );


            if (
                isDuplicateMatch
            ) {

                showCustomConfirm(
                    "Phát hiện có trận đấu tương tự đã được nhập trong 18 giờ trước đó. Nếu thực sự là trận đấu mới thì chọn OK, nếu không phải chọn Hủy",
                    function(
                        confirmed
                    ) {

                        if (
                            !confirmed
                        ) {
                            return;
                        }


                        saveNewMatchData(
                            p1A,
                            p2A,
                            p1B,
                            p2B,
                            scoreA,
                            scoreB,
                            specialBet
                        );
                    }
                );

            } else {

                saveNewMatchData(
                    p1A,
                    p2A,
                    p1B,
                    p2B,
                    scoreA,
                    scoreB,
                    specialBet
                );
            }
        }
    );
}


function saveNewMatchData(
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
            new Date()
                .toLocaleString(
                    "vi-VN"
                ),

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
            specialBet
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
}

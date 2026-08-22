// ======================================================
// API.JS - PHASE 3 DATA LOADING
// ======================================================
//
// GET:
// - initialData   -> dữ liệu nền + MemberStats + Matches/Bookings tháng hiện tại
// - monthData     -> Matches/Bookings của tháng được chọn
// - analyticsData -> toàn bộ Matches, chỉ khi mở tab Phân tích
//
// GocLogs tạm thời vẫn tải toàn bộ để giữ nguyên logic Sổ Thu Chi.
// POST giữ cơ chế no-cors + Backend chống trùng theo ID.
//
// ======================================================


// ======================================================
// PHASE 3 STATE
// ======================================================

window.memberStats =
    Array.isArray(window.memberStats)
        ? window.memberStats
        : [];


window.monthDataCache =
    window.monthDataCache &&
    typeof window.monthDataCache === "object"
        ? window.monthDataCache
        : {};


window.analyticsMatches =
    Array.isArray(window.analyticsMatches)
        ? window.analyticsMatches
        : [];


window.analyticsDataLoaded =
    window.analyticsDataLoaded === true;


window.activeDataMonth =
    parseInt(window.activeDataMonth) || 0;


window.activeDataYear =
    parseInt(window.activeDataYear) || 0;


// ======================================================
// COMMON HELPERS
// ======================================================

function getPhase3MonthKey_(
    month,
    year
) {

    return (
        parseInt(year) +
        "_" +
        parseInt(month)
    );
}


function normalizePhase3Name_(value) {

    return String(
        value || ""
    )
    .trim()
    .toLowerCase();
}


function isPhase3GuestName_(value) {

    let name =
        normalizePhase3Name_(
            value
        );


    return (
        name === "khách mời" ||
        name.indexOf(
            "khách mời "
        ) === 0
    );
}


function getClientMonthYearFromTime_(
    value
) {

    let text =
        String(
            value || ""
        ).trim();


    let match =
        text.match(
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/
        );


    if (!match) {
        return null;
    }


    return {

        month:
            parseInt(
                match[2]
            ) || 0,

        year:
            parseInt(
                match[3]
            ) || 0
    };
}


function getCachedMonthData_(
    month,
    year
) {

    return (
        window.monthDataCache[
            getPhase3MonthKey_(
                month,
                year
            )
        ] ||
        null
    );
}


function setCachedMonthData_(
    month,
    year,
    data
) {

    let key =
        getPhase3MonthKey_(
            month,
            year
        );


    window.monthDataCache[
        key
    ] = {

        month:
            parseInt(month),

        year:
            parseInt(year),

        matches:
            Array.isArray(
                data && data.matches
            )
                ? data.matches.slice()
                : [],

        bookingLogs:
            Array.isArray(
                data && data.bookingLogs
            )
                ? data.bookingLogs.slice()
                : [],

        loadedAt:
            Date.now()
    };


    return window.monthDataCache[
        key
    ];
}


function activateCachedMonthData_(
    month,
    year
) {

    let cached =
        getCachedMonthData_(
            month,
            year
        );


    if (!cached) {
        return false;
    }


    matches =
        cached.matches;


    bookingLogs =
        cached.bookingLogs;


    window.activeDataMonth =
        parseInt(month);


    window.activeDataYear =
        parseInt(year);


    sortCollectionsByTime();


    savePhase3LocalState_();


    return true;
}


function getMonthMatchesCached_(
    month,
    year
) {

    let cached =
        getCachedMonthData_(
            month,
            year
        );


    if (cached) {

        return cached.matches || [];
    }


    if (
        parseInt(
            window.activeDataMonth
        ) === parseInt(month) &&
        parseInt(
            window.activeDataYear
        ) === parseInt(year)
    ) {

        return matches || [];
    }


    return [];
}


function getMonthBookingsCached_(
    month,
    year
) {

    let cached =
        getCachedMonthData_(
            month,
            year
        );


    if (cached) {

        return cached.bookingLogs || [];
    }


    if (
        parseInt(
            window.activeDataMonth
        ) === parseInt(month) &&
        parseInt(
            window.activeDataYear
        ) === parseInt(year)
    ) {

        return bookingLogs || [];
    }


    return [];
}


// ======================================================
// MEMBER STATS LOCAL
// ======================================================

function getMemberStatLocal_(
    memberName
) {

    let key =
        normalizePhase3Name_(
            memberName
        );


    return (
        window.memberStats || []
    )
    .find(
        function(item) {

            return (
                normalizePhase3Name_(
                    item.name
                ) === key
            );
        }
    ) || null;
}


function applyMemberStatsMatchLocal_(
    match,
    multiplier
) {

    if (!match) {
        return;
    }


    multiplier =
        parseInt(
            multiplier
        ) || 0;


    if (!multiplier) {
        return;
    }


    let scoreA =
        parseInt(
            match.scoreA
        ) || 0;


    let scoreB =
        parseInt(
            match.scoreB
        ) || 0;


    let isDraw =
        scoreA === scoreB;


    let teamAResult =
        isDraw
            ? "DRAW"
            : (
                scoreA > scoreB
                    ? "WIN"
                    : "LOSS"
            );


    let teamBResult =
        isDraw
            ? "DRAW"
            : (
                scoreB > scoreA
                    ? "WIN"
                    : "LOSS"
            );


    function applyPlayer_(
        name,
        resultType
    ) {

        if (
            !name ||
            isPhase3GuestName_(
                name
            )
        ) {
            return;
        }


        let stat =
            getMemberStatLocal_(
                name
            );


        // MemberStats chỉ chứa thành viên thật hiện tại.
        if (!stat) {
            return;
        }


        if (
            resultType ===
            "WIN"
        ) {

            stat.wins =
                Math.max(
                    0,
                    (
                        parseInt(
                            stat.wins
                        ) || 0
                    ) +
                    multiplier
                );
        }


        else if (
            resultType ===
            "LOSS"
        ) {

            stat.losses =
                Math.max(
                    0,
                    (
                        parseInt(
                            stat.losses
                        ) || 0
                    ) +
                    multiplier
                );
        }


        else {

            stat.draws =
                Math.max(
                    0,
                    (
                        parseInt(
                            stat.draws
                        ) || 0
                    ) +
                    multiplier
                );
        }


        stat.totalMatches =
            Math.max(
                0,
                (
                    parseInt(
                        stat.totalMatches
                    ) || 0
                ) +
                multiplier
            );
    }


    [
        match.p1_v1,
        match.p2_v1
    ]
    .forEach(
        function(name) {

            applyPlayer_(
                name,
                teamAResult
            );
        }
    );


    [
        match.p1_v2,
        match.p2_v2
    ]
    .forEach(
        function(name) {

            applyPlayer_(
                name,
                teamBResult
            );
        }
    );
}


function invalidateAnalyticsCache_() {

    window.analyticsMatches =
        [];


    window.analyticsDataLoaded =
        false;
}


// ======================================================
// LOCAL MONTH CACHE MUTATION
// ======================================================

function getOrCreateCacheForItemTime_(
    timeValue
) {

    let parts =
        getClientMonthYearFromTime_(
            timeValue
        );


    if (!parts) {
        return null;
    }


    let cache =
        getCachedMonthData_(
            parts.month,
            parts.year
        );


    if (!cache) {

        cache =
            setCachedMonthData_(
                parts.month,
                parts.year,
                {
                    matches: [],
                    bookingLogs: []
                }
            );
    }


    return cache;
}


function addMatchToLocalMonthCache_(
    match
) {

    let cache =
        getOrCreateCacheForItemTime_(
            match && match.time
        );


    if (!cache) {
        return;
    }


    let exists =
        (cache.matches || [])
        .some(
            function(item) {

                return (
                    String(item.id) ===
                    String(match.id)
                );
            }
        );


    if (!exists) {

        cache.matches.unshift(
            match
        );
    }


    if (
        cache.month ===
            parseInt(
                window.activeDataMonth
            ) &&
        cache.year ===
            parseInt(
                window.activeDataYear
            )
    ) {

        matches =
            cache.matches;
    }
}


function addBookingToLocalMonthCache_(
    booking
) {

    let cache =
        getOrCreateCacheForItemTime_(
            booking &&
            booking.time
        );


    if (!cache) {
        return;
    }


    let exists =
        (cache.bookingLogs || [])
        .some(
            function(item) {

                return (
                    String(item.id) ===
                    String(booking.id)
                );
            }
        );


    if (!exists) {

        cache.bookingLogs.unshift(
            booking
        );
    }


    if (
        cache.month ===
            parseInt(
                window.activeDataMonth
            ) &&
        cache.year ===
            parseInt(
                window.activeDataYear
            )
    ) {

        bookingLogs =
            cache.bookingLogs;
    }
}


function findMatchInMonthCaches_(
    id
) {

    let result =
        null;


    Object.keys(
        window.monthDataCache || {}
    )
    .some(
        function(key) {

            let cache =
                window.monthDataCache[
                    key
                ];


            let match =
                (cache.matches || [])
                .find(
                    function(item) {

                        return (
                            String(item.id) ===
                            String(id)
                        );
                    }
                );


            if (match) {

                result =
                    match;

                return true;
            }


            return false;
        }
    );


    if (!result) {

        result =
            (matches || [])
            .find(
                function(item) {

                    return (
                        String(item.id) ===
                        String(id)
                    );
                }
            ) ||
            null;
    }


    return result;
}


function updateMatchInMonthCaches_(
    updated
) {

    Object.keys(
        window.monthDataCache || {}
    )
    .forEach(
        function(key) {

            let cache =
                window.monthDataCache[
                    key
                ];


            let match =
                (cache.matches || [])
                .find(
                    function(item) {

                        return (
                            String(item.id) ===
                            String(updated.id)
                        );
                    }
                );


            if (match) {

                Object.assign(
                    match,
                    updated
                );
            }
        }
    );
}


function removeIdFromMonthCaches_(
    collectionName,
    id
) {

    Object.keys(
        window.monthDataCache || {}
    )
    .forEach(
        function(key) {

            let cache =
                window.monthDataCache[
                    key
                ];


            if (
                !Array.isArray(
                    cache[
                        collectionName
                    ]
                )
            ) {
                return;
            }


            cache[
                collectionName
            ] =
                cache[
                    collectionName
                ]
                .filter(
                    function(item) {

                        return (
                            String(item.id) !==
                            String(id)
                        );
                    }
                );
        }
    );


    let active =
        getCachedMonthData_(
            window.activeDataMonth,
            window.activeDataYear
        );


    if (active) {

        matches =
            active.matches;


        bookingLogs =
            active.bookingLogs;
    }
}


// ======================================================
// ACTION QUEUE
// ======================================================

function enqueueAction(
    actionName,
    payload,
    successMessage
) {

    payload.action =
        actionName;


    // ==================================================
    // 0. CHỤP DỮ LIỆU CŨ TRƯỚC KHI OPTIMISTIC UPDATE
    // ==================================================

    let oldMatchForStats =
        null;


    if (
        actionName ===
            "updateMatch" &&
        payload.match
    ) {

        let old =
            findMatchInMonthCaches_(
                payload.match.id
            );


        if (old) {

            oldMatchForStats =
                Object.assign(
                    {},
                    old
                );
        }
    }


    if (
        actionName ===
            "deleteItem" &&
        payload.sheetName ===
            "Matches"
    ) {

        let old =
            findMatchInMonthCaches_(
                payload.id
            );


        if (old) {

            oldMatchForStats =
                Object.assign(
                    {},
                    old
                );
        }
    }


    // ==================================================
    // SNAPSHOT GÓC CHO TRẬN MỚI
    // ==================================================

    if (
        actionName ===
            "addMatch" &&
        payload.match
    ) {

        if (
            !parseInt(
                payload.match.gocFee
            )
        ) {

            payload.match.gocFee =
                parseInt(
                    systemSettings &&
                    systemSettings
                        .gocDefaultPerMatch
                ) ||
                10000;
        }
    }


    syncQueue.push(
        payload
    );


    // ==================================================
    // 1. CẬP NHẬT STATE CỤC BỘ
    // ==================================================

    if (
        actionName ===
            "addMatch" &&
        payload.match
    ) {

        addMatchToLocalMonthCache_(
            payload.match
        );


        applyMemberStatsMatchLocal_(
            payload.match,
            1
        );


        invalidateAnalyticsCache_();
    }


    else if (
        actionName ===
            "updateMatch" &&
        payload.match
    ) {

        if (
            oldMatchForStats
        ) {

            applyMemberStatsMatchLocal_(
                oldMatchForStats,
                -1
            );
        }


        let currentMatch =
            findMatchInMonthCaches_(
                payload.match.id
            );


        let merged =
            Object.assign(
                {},
                currentMatch || {},
                payload.match
            );


        updateMatchInMonthCaches_(
            merged
        );


        applyMemberStatsMatchLocal_(
            merged,
            1
        );


        invalidateAnalyticsCache_();
    }


    else if (
        actionName ===
            "addGocLog" &&
        payload.gocLog
    ) {

        // GocLogs tạm thời vẫn giữ toàn bộ lịch sử.
        gocLogs.unshift(
            payload.gocLog
        );
    }


    else if (
        actionName ===
            "addQuyLog" &&
        payload.quyLog
    ) {

        quyLogs.unshift(
            payload.quyLog
        );
    }


    else if (
        actionName ===
            "addBooking" &&
        payload.booking
    ) {

        addBookingToLocalMonthCache_(
            payload.booking
        );
    }


    else if (
        actionName ===
            "addCashbook" &&
        payload.cashbook
    ) {

        cashbookLogs.unshift(
            payload.cashbook
        );
    }


    else if (
        actionName ===
            "addRule" &&
        payload.rule
    ) {

        rulesList.unshift(
            payload.rule
        );
    }


    else if (
        actionName ===
            "updateSettings" &&
        payload.settings
    ) {

        systemSettings =
            Object.assign(
                {},
                systemSettings,
                payload.settings
            );
    }


    else if (
        actionName ===
            "deleteItem"
    ) {

        let id =
            payload.id;


        if (
            payload.sheetName ===
            "Matches"
        ) {

            if (
                oldMatchForStats
            ) {

                applyMemberStatsMatchLocal_(
                    oldMatchForStats,
                    -1
                );
            }


            removeIdFromMonthCaches_(
                "matches",
                id
            );


            invalidateAnalyticsCache_();
        }


        if (
            payload.sheetName ===
            "Bookings"
        ) {

            removeIdFromMonthCaches_(
                "bookingLogs",
                id
            );
        }


        if (
            payload.sheetName ===
            "Cashbook"
        ) {

            cashbookLogs =
                cashbookLogs.filter(
                    function(x) {

                        return (
                            x.id != id
                        );
                    }
                );
        }


        if (
            payload.sheetName ===
            "GocLogs"
        ) {

            gocLogs =
                gocLogs.filter(
                    function(x) {

                        return (
                            x.id != id
                        );
                    }
                );
        }


        if (
            payload.sheetName ===
            "Rules"
        ) {

            rulesList =
                rulesList.filter(
                    function(x) {

                        return (
                            x.id != id
                        );
                    }
                );
        }


        if (
            payload.sheetName ===
            "QuyLogs"
        ) {

            quyLogs =
                quyLogs.filter(
                    function(x) {

                        return (
                            x.id != id
                        );
                    }
                );
        }
    }


    sortCollectionsByTime();


    saveLocalData();


    savePhase3LocalState_();


    // ==================================================
    // 2. RENDER CỤC BỘ
    // ==================================================

    if (
        actionName === "addGocLog" ||
        (
            actionName ===
                "deleteItem" &&
            payload.sheetName ===
                "GocLogs"
        )
    ) {

        if (
            typeof recalculateMemberPaidTotals ===
            "function"
        ) {
            recalculateMemberPaidTotals();
        }


        if (
            typeof renderGocLogsTab ===
            "function"
        ) {
            renderGocLogsTab();
        }


        if (
            typeof renderDashboard ===
            "function"
        ) {
            renderDashboard();
        }


        if (
            typeof renderFinance ===
            "function"
        ) {
            renderFinance();
        }


        if (
            typeof renderCashbook ===
            "function"
        ) {
            renderCashbook();
        }


        applyRolePermissions();
    }


    else if (
        actionName ===
            "addBooking" ||
        (
            actionName ===
                "deleteItem" &&
            payload.sheetName ===
                "Bookings"
        )
    ) {

        if (
            typeof renderBookingLogs ===
            "function"
        ) {
            renderBookingLogs();
        }


        if (
            typeof renderDashboard ===
            "function"
        ) {
            renderDashboard();
        }


        if (
            typeof renderFinance ===
            "function"
        ) {
            renderFinance();
        }


        applyRolePermissions();
    }


    else if (
        actionName === "addMatch" ||
        actionName === "updateMatch" ||
        (
            actionName ===
                "deleteItem" &&
            payload.sheetName ===
                "Matches"
        )
    ) {

        if (
            typeof renderAllMatchLog ===
            "function"
        ) {
            renderAllMatchLog();
        }


        if (
            typeof renderGamification ===
            "function"
        ) {
            renderGamification();
        }


        if (
            typeof renderDashboard ===
            "function"
        ) {
            renderDashboard();
        }


        if (
            typeof renderFinance ===
            "function"
        ) {
            renderFinance();
        }


        applyRolePermissions();
    }


    else if (
        actionName ===
            "addCashbook" ||
        (
            actionName ===
                "deleteItem" &&
            payload.sheetName ===
                "Cashbook"
        )
    ) {

        if (
            typeof renderCashbook ===
            "function"
        ) {
            renderCashbook();
        }


        applyRolePermissions();
    }


    else if (
        actionName ===
            "addRule" ||
        (
            actionName ===
                "deleteItem" &&
            payload.sheetName ===
                "Rules"
        )
    ) {

        if (
            typeof renderRulesTab ===
            "function"
        ) {
            renderRulesTab();
        }


        applyRolePermissions();
    }


    else if (
        actionName ===
            "deleteItem" &&
        payload.sheetName ===
            "QuyLogs"
    ) {

        if (
            typeof renderQuyTable ===
            "function"
        ) {
            renderQuyTable();
        }


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


        applyRolePermissions();
    }


    else if (
        actionName ===
            "updateSettings"
    ) {

        if (
            typeof populateSettingsForm ===
            "function"
        ) {
            populateSettingsForm();
        }


        if (
            typeof renderDashboard ===
            "function"
        ) {
            renderDashboard();
        }


        if (
            typeof renderFinance ===
            "function"
        ) {
            renderFinance();
        }


        applyRolePermissions();
    }


    else {

        initApp();
    }


    showToast(
        successMessage ||
        "Đã ghi nhận thành công!"
    );


    processQueue();
}


// ======================================================
// POST QUEUE
// ======================================================

function processQueue() {

    if (
        isSyncing ||
        syncQueue.length === 0 ||
        !GOOGLE_SCRIPT_URL
    ) {
        return;
    }


    isSyncing =
        true;


    let item =
        syncQueue[0];


    let itemWithToken =
        Object.assign(
            {},
            item,
            {
                token:
                    API_TOKEN || ""
            }
        );


    fetch(
        GOOGLE_SCRIPT_URL,
        {

            method:
                "POST",

            mode:
                "no-cors",

            headers: {

                "Content-Type":
                    "text/plain;charset=utf-8"
            },

            body:
                JSON.stringify(
                    itemWithToken
                )
        }
    )

    .then(
        function() {

            syncQueue.shift();


            isSyncing =
                false;


            saveLocalData();


            savePhase3LocalState_();


            if (
                syncQueue.length > 0
            ) {

                processQueue();
            }
        }
    )

    .catch(
        function(err) {

            console.error(
                "POST CLOUD NETWORK ERROR:",
                err
            );


            isSyncing =
                false;
        }
    );
}


// ======================================================
// CLOUD LOADING
// ======================================================

function showCloudLoading_() {

    let overlay =
        document.getElementById(
            "loadingOverlay"
        );


    if (!overlay) {
        return;
    }


    overlay.classList.remove(
        "hidden"
    );


    overlay.classList.add(
        "flex"
    );
}


function hideCloudLoading_() {

    let overlay =
        document.getElementById(
            "loadingOverlay"
        );


    if (!overlay) {
        return;
    }


    overlay.classList.add(
        "hidden"
    );


    overlay.classList.remove(
        "flex"
    );
}


// ======================================================
// GENERIC JSONP
// ======================================================

function fetchJsonpPhase3_(
    params,
    showSpinner,
    callback
) {

    if (!GOOGLE_SCRIPT_URL) {
        return;
    }


    if (showSpinner) {

        showCloudLoading_();
    }


    let callbackName =
        "__thanglong_phase3_" +
        Date.now() +
        "_" +
        Math.floor(
            Math.random() *
            100000
        );


    let script =
        document.createElement(
            "script"
        );


    let finished =
        false;


    let slowTimer =
        null;


    function removeScript_() {

        if (
            script &&
            script.parentNode
        ) {

            script.parentNode
                .removeChild(
                    script
                );
        }
    }


    function finish_(
        error,
        data
    ) {

        if (finished) {
            return;
        }


        finished =
            true;


        if (slowTimer) {

            clearTimeout(
                slowTimer
            );
        }


        removeScript_();


        if (showSpinner) {

            hideCloudLoading_();
        }


        if (
            typeof callback ===
            "function"
        ) {

            callback(
                error,
                data
            );
        }


        // Sau khi nhận response thật mới dọn callback.
        setTimeout(
            function() {

                try {

                    delete window[
                        callbackName
                    ];

                } catch (e) {

                    window[
                        callbackName
                    ] =
                        undefined;
                }
            },
            0
        );
    }


    window[
        callbackName
    ] = function(data) {

        if (
            !data
        ) {

            finish_(
                new Error(
                    "Apps Script không trả dữ liệu."
                ),
                null
            );

            return;
        }


        finish_(
            null,
            data
        );
    };


    script.onerror =
        function() {

            // Giữ callback an toàn để response muộn không gây ReferenceError.
            window[
                callbackName
            ] = function() {};


            removeScript_();


            if (showSpinner) {

                hideCloudLoading_();
            }


            if (
                !finished &&
                typeof callback ===
                    "function"
            ) {

                finished =
                    true;


                callback(
                    new Error(
                        "Không tải được Apps Script."
                    ),
                    null
                );
            }
        };


    // 15 giây chỉ báo chậm và ẩn spinner.
    // Không xóa callback.
    slowTimer =
        setTimeout(
            function() {

                if (finished) {
                    return;
                }


                if (showSpinner) {

                    hideCloudLoading_();
                }


                console.warn(
                    "PHASE3 JSONP SLOW - vẫn tiếp tục chờ dữ liệu..."
                );
            },
            15000
        );


    let query =
        Object.keys(
            params || {}
        )
        .map(
            function(key) {

                return (
                    encodeURIComponent(
                        key
                    ) +
                    "=" +
                    encodeURIComponent(
                        params[
                            key
                        ]
                    )
                );
            }
        );


    query.push(
        "prefix=" +
        encodeURIComponent(
            callbackName
        )
    );


    query.push(
        "token=" +
        encodeURIComponent(
            API_TOKEN || ""
        )
    );


    query.push(
        "_=" +
        Date.now()
    );


    let separator =
        GOOGLE_SCRIPT_URL
            .includes("?")
                ? "&"
                : "?";


    script.src =
        GOOGLE_SCRIPT_URL +
        separator +
        query.join("&");


    script.async =
        true;


    document.head.appendChild(
        script
    );
}


// ======================================================
// INITIAL CLOUD DATA
// ======================================================

function fetchCloudData(
    showSpinner,
    onSuccess
) {

    fetchJsonpPhase3_(
        {
            action:
                "initialData"
        },
        showSpinner,
        function(
            error,
            data
        ) {

            if (error) {

                console.error(
                    "INITIAL DATA ERROR:",
                    error
                );

                return;
            }


            try {

                updateStateFromCloud(
                    data
                );


                if (
                    typeof onSuccess ===
                    "function"
                ) {

                    onSuccess(
                        data
                    );
                }


            } catch (err) {

                console.error(
                    "UPDATE INITIAL STATE ERROR:",
                    err
                );
            }
        }
    );
}


// ======================================================
// UPDATE INITIAL STATE
// ======================================================

function updateStateFromCloud(
    data
) {

    if (!data) {

        console.error(
            "updateStateFromCloud: Không có dữ liệu."
        );

        return;
    }


    if (
        data.members &&
        data.members.length > 0
    ) {

        members =
            data.members;
    }


    if (
        Array.isArray(
            data.memberStats
        )
    ) {

        window.memberStats =
            data.memberStats;
    }


    if (
        Array.isArray(
            data.cashbookLogs
        )
    ) {

        cashbookLogs =
            data.cashbookLogs;
    }


    // GocLogs giữ toàn bộ ở Phase 3 bước này.
    if (
        Array.isArray(
            data.gocLogs
        )
    ) {

        gocLogs =
            data.gocLogs;
    }


    if (
        Array.isArray(
            data.quyLogs
        )
    ) {

        quyLogs =
            data.quyLogs;
    }


    if (
        Array.isArray(
            data.monthlyBalances
        )
    ) {

        window.monthlyBalances =
            data.monthlyBalances;

    } else {

        window.monthlyBalances =
            [];
    }


    if (
        Array.isArray(
            data.rules
        )
    ) {

        rulesList =
            data.rules;
    }


    if (
        data.openingBalance !==
        undefined
    ) {

        openingBalance =
            data.openingBalance;
    }


    if (
        data.settings
    ) {

        systemSettings =
            Object.assign(
                {},
                systemSettings,
                data.settings
            );
    }


    let loadedMonth =
        parseInt(
            data.loadedMonth
        );


    let loadedYear =
        parseInt(
            data.loadedYear
        );


    if (
        loadedMonth &&
        loadedYear
    ) {

        setCachedMonthData_(
            loadedMonth,
            loadedYear,
            {
                matches:
                    data.matches || [],

                bookingLogs:
                    data.bookingLogs || []
            }
        );


        activateCachedMonthData_(
            loadedMonth,
            loadedYear
        );
    }


    sortCollectionsByTime();


    saveLocalData();


    savePhase3LocalState_();


    initApp();
}


// ======================================================
// MONTH DATA
// ======================================================

function fetchMonthData(
    month,
    year,
    showSpinner,
    onSuccess,
    forceReload
) {

    month =
        parseInt(
            month
        );


    year =
        parseInt(
            year
        );


    let cached =
        getCachedMonthData_(
            month,
            year
        );


    if (
        cached &&
        forceReload !== true
    ) {

        activateCachedMonthData_(
            month,
            year
        );


        renderMonthDependentViews_();


        if (
            typeof onSuccess ===
            "function"
        ) {

            onSuccess(
                cached
            );
        }


        return;
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
        showSpinner,
        function(
            error,
            data
        ) {

            if (error) {

                console.error(
                    "MONTH DATA ERROR:",
                    error
                );


                showToast(
                    `Chưa tải được dữ liệu tháng ${month}/${year}.`
                );

                return;
            }


            if (
                !data ||
                data.status !==
                    "SUCCESS"
            ) {

                console.error(
                    "MONTH DATA INVALID:",
                    data
                );


                showToast(
                    `Dữ liệu tháng ${month}/${year} không hợp lệ.`
                );

                return;
            }


            setCachedMonthData_(
                month,
                year,
                {
                    matches:
                        data.matches || [],

                    bookingLogs:
                        data.bookingLogs || []
                }
            );


            activateCachedMonthData_(
                month,
                year
            );


            saveLocalData();


            savePhase3LocalState_();


            renderMonthDependentViews_();


            if (
                typeof onSuccess ===
                "function"
            ) {

                onSuccess(
                    data
                );
            }
        }
    );
}


function renderMonthDependentViews_() {

    if (
        typeof recalculateMemberPaidTotals ===
        "function"
    ) {

        recalculateMemberPaidTotals();
    }


    if (
        typeof renderGamification ===
        "function"
    ) {

        renderGamification();
    }


    if (
        typeof renderDashboard ===
        "function"
    ) {

        renderDashboard();
    }


    if (
        typeof renderFinance ===
        "function"
    ) {

        renderFinance();
    }


    if (
        typeof renderAllMatchLog ===
        "function"
    ) {

        renderAllMatchLog();
    }


    if (
        typeof renderBookingLogs ===
        "function"
    ) {

        renderBookingLogs();
    }


    applyRolePermissions();
}


// ======================================================
// ANALYTICS DATA - LAZY LOAD
// ======================================================

function fetchAnalyticsData(
    showSpinner,
    onSuccess,
    forceReload
) {

    if (
        window.analyticsDataLoaded ===
            true &&
        Array.isArray(
            window.analyticsMatches
        ) &&
        forceReload !== true
    ) {

        if (
            typeof onSuccess ===
            "function"
        ) {

            onSuccess(
                window.analyticsMatches
            );
        }


        return;
    }


    fetchJsonpPhase3_(
        {
            action:
                "analyticsData"
        },
        showSpinner,
        function(
            error,
            data
        ) {

            if (error) {

                console.error(
                    "ANALYTICS DATA ERROR:",
                    error
                );


                showToast(
                    "Chưa tải được dữ liệu Phân tích."
                );

                return;
            }


            if (
                !data ||
                !Array.isArray(
                    data.matches
                )
            ) {

                console.error(
                    "ANALYTICS DATA INVALID:",
                    data
                );

                return;
            }


            window.analyticsMatches =
                data.matches;


            window.analyticsDataLoaded =
                true;


            if (
                typeof onSuccess ===
                "function"
            ) {

                onSuccess(
                    window.analyticsMatches
                );
            }
        }
    );
}


// ======================================================
// PHASE 3 LOCAL STORAGE
// ======================================================

function savePhase3LocalState_() {

    try {

        localStorage.setItem(
            "clb_memberStats_phase3",
            JSON.stringify(
                window.memberStats || []
            )
        );


        localStorage.setItem(
            "clb_activeMonth_phase3",
            String(
                window.activeDataMonth || 0
            )
        );


        localStorage.setItem(
            "clb_activeYear_phase3",
            String(
                window.activeDataYear || 0
            )
        );


    } catch (err) {

        console.warn(
            "SAVE PHASE3 LOCAL ERROR:",
            err
        );
    }
}


function restorePhase3LocalState_(
    currentMonth,
    currentYear
) {

    try {

        let storedStats =
            JSON.parse(
                localStorage.getItem(
                    "clb_memberStats_phase3"
                ) ||
                "[]"
            );


        if (
            Array.isArray(
                storedStats
            )
        ) {

            window.memberStats =
                storedStats;
        }


        let storedMonth =
            parseInt(
                localStorage.getItem(
                    "clb_activeMonth_phase3"
                )
            ) || 0;


        let storedYear =
            parseInt(
                localStorage.getItem(
                    "clb_activeYear_phase3"
                )
            ) || 0;


        if (
            storedMonth ===
                parseInt(
                    currentMonth
                ) &&
            storedYear ===
                parseInt(
                    currentYear
                )
        ) {

            setCachedMonthData_(
                storedMonth,
                storedYear,
                {
                    matches:
                        matches || [],

                    bookingLogs:
                        bookingLogs || []
                }
            );


            activateCachedMonthData_(
                storedMonth,
                storedYear
            );


        } else {

            // Tránh hiển thị nhầm dữ liệu tháng cũ ngay khi mở app.
            matches =
                [];


            bookingLogs =
                [];


            window.activeDataMonth =
                parseInt(
                    currentMonth
                );


            window.activeDataYear =
                parseInt(
                    currentYear
                );
        }


    } catch (err) {

        console.warn(
            "RESTORE PHASE3 LOCAL ERROR:",
            err
        );
    }
}

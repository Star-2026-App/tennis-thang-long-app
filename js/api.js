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
// v2.0 - TRANSPORT DUY NHẤT TỚI BACKEND (Vercel BFF)
// ======================================================
//
// TOÀN BỘ network call trong app (api.js, finance.js, matches.js,
// notifications.js...) đi qua 2 hàm này. KHÔNG còn JSONP, KHÔNG
// còn GOOGLE_SCRIPT_URL/API_TOKEN trong frontend - mọi request
// đều same-origin (`credentials:'include'` để gửi kèm session
// cookie HttpOnly).
// ======================================================

function generateIdempotencyKey_() {

    if (
        window.crypto &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return (
        "idem-" + Date.now() + "-" +
        Math.random().toString(36).slice(2)
    );
}

// Gọi 1 action GHI qua POST /api/actions/write. Trả về Promise
// resolve với JSON {status, result} hoặc {status:"ERROR", message}
// - KHÔNG BAO GIỜ reject vì lỗi nghiệp vụ (chỉ reject khi mất
// mạng/không parse được JSON), để nơi gọi tự phân biệt 2 loại lỗi
// giống hệt hành vi JSONP cũ.
function callBackendAction_(action, data, idempotencyKey) {

    return fetch("/api/actions/write", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: action,
            data: data || {},
            idempotencyKey: idempotencyKey || generateIdempotencyKey_()
        })
    }).then(function(res) {
        return res.json();
    });
}

// Gọi 1 action ĐỌC qua GET /api/data/<đường dẫn tương ứng>. Trả về
// Promise resolve với PHẦN "result" đã bóc vỏ (shape giống hệt
// response Apps Script trả trực tiếp trước đây - có .status ở
// gốc), để updateStateFromCloud()/các callback cũ không cần sửa gì.
function callBackendRead_(path) {

    return fetch(path, {
        method: "GET",
        credentials: "include"
    }).then(function(res) {
        return res.json().then(function(json) {
            return { statusCode: res.status, json: json };
        }).catch(function(err) {
            err.statusCode = res.status;
            throw err;
        });
    }).then(function(response) {

        var json = response.json;

        if (!json || json.status !== "SUCCESS") {
            var readErr = new Error((json && json.message) || "Không tải được dữ liệu.");
            readErr.statusCode = response.statusCode;
            throw readErr;
        }

        return json.result;
    });
}

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


    // ==================================================
    // v2.0: gắn idempotencyKey (chống ghi trùng khi mất mạng
    // sau commit), chủ sở hữu hàng đợi (chống 1 thiết bị gửi
    // nhầm queue của người đăng nhập trước đó - điểm yếu #6),
    // và câu thông báo thành công THẬT (chỉ hiển thị SAU KHI
    // backend xác nhận - xem onQueueItemDone_ trong processQueue).
    // ==================================================

    payload.idempotencyKey =
        payload.idempotencyKey ||
        generateIdempotencyKey_();

    payload.__ownerStt =
        (typeof loggedInMemberStt !== "undefined" && loggedInMemberStt) || 0;

    payload.__successMessage =
        successMessage ||
        "Đã ghi nhận thành công!";

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
        (
            actionName === "addGocLog" ||
            actionName === "addGocLogAdjustment"
        ) &&
        payload.gocLog
    ) {

        // GocLogs tạm thời vẫn giữ toàn bộ lịch sử. addGocLogAdjustment
        // (v2.0) ghi cùng sheet GocLogs qua cùng khóa payload "gocLog",
        // chỉ khác amount có thể âm - dùng chung 1 nhánh cache tạm này.
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
        actionName === "addGocLogAdjustment" ||
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


    // ==================================================
    // v2.0 (P3): KHÔNG báo "thành công" ở đây nữa - đây mới chỉ
    // là đưa vào hàng đợi, CHƯA có xác nhận thật từ backend. Câu
    // thông báo thành công thật (payload.__successMessage) chỉ
    // hiển thị trong onQueueItemDone_ khi backend đã commit xong.
    //
    // Push notification cũng KHÔNG còn bắn từ trình duyệt ở đây
    // (điểm yếu #8: v1.6 gọi maybeNotifyPush_ ngay khi enqueue,
    // trước khi backend xác nhận, và tải cả danh sách subscription
    // về máy). Từ v2.0, server (api/actions/write.js) tự bắn push
    // SAU KHI Apps Script xác nhận commit.
    // ==================================================

    showToast("Đang đồng bộ...");

    processQueue();
}


// ======================================================
// POST QUEUE
// ======================================================

function processQueue() {

    if (
        isSyncing ||
        syncQueue.length === 0
    ) {
        return;
    }


    let item =
        syncQueue[0];


    // ==================================================
    // v2.0 (điểm yếu #6): mỗi thiết bị chỉ được xử lý hàng đợi
    // của CHÍNH actor đang đăng nhập. Nếu người dùng B đăng nhập
    // trên thiết bị vừa đăng xuất người dùng A, các item còn sót
    // của A (nếu storage.js chưa dọn kịp) sẽ bị BỎ QUA ở đây thay
    // vì âm thầm gửi thay B.
    // ==================================================

    let currentOwnerStt =
        (typeof loggedInMemberStt !== "undefined" && loggedInMemberStt) || 0;

    if (
        item.__ownerStt &&
        currentOwnerStt &&
        item.__ownerStt !== currentOwnerStt
    ) {

        console.warn(
            "SYNC QUEUE: bỏ qua item không thuộc actor hiện tại.",
            item
        );

        syncQueue.shift();
        saveLocalData();

        if (syncQueue.length > 0) processQueue();
        return;
    }


    isSyncing =
        true;


    function onQueueItemDone_(
        success
    ) {

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


    let action =
        item.action;

    let idempotencyKey =
        item.idempotencyKey;

    // data gửi lên = toàn bộ payload TRỪ các trường transport nội bộ
    // (action/idempotencyKey/__ownerStt/__successMessage) - giữ
    // nguyên shape { match: {...} } / { gocLog: {...} } ... mà
    // Router.gs.txt đang mong đợi, không cần sửa các module gọi
    // enqueueAction() ở nơi khác.
    let data =
        Object.assign({}, item);

    delete data.action;
    delete data.idempotencyKey;
    delete data.__ownerStt;
    delete data.__successMessage;


    callBackendAction_(
        action,
        data,
        idempotencyKey
    )

    .then(function(responseJson) {

        if (
            !responseJson ||
            responseJson.status !== "SUCCESS"
        ) {

            // Backend TỪ CHỐI GHI THẬT SỰ (lỗi nghiệp vụ) -> loại
            // khỏi hàng đợi (thử lại cũng sẽ lỗi y hệt), báo rõ
            // cho người dùng, và TẢI LẠI dữ liệu gốc từ server để
            // thay thế trạng thái optimistic có thể đã sai (P3:
            // "Rollback hoặc reload authoritative state khi backend
            // từ chối" - chọn reload vì an toàn hơn viết rollback
            // tay cho từng loại action).
            let message =
                (responseJson && responseJson.message)
                    ? responseJson.message
                    : "Không rõ nguyên nhân.";

            console.error(
                "WRITE ACTION REJECTED:",
                action,
                message
            );

            onQueueItemDone_(false);

            alert(
                "Một thao tác đã KHÔNG được lưu lên hệ thống:\n\n" +
                message +
                "\n\nDữ liệu sẽ được tải lại từ máy chủ để đảm bảo chính xác."
            );

            if (typeof fetchCloudData === "function") {
                fetchCloudData(false);
            }

            return;
        }


        // THÀNH CÔNG - ĐÃ XÁC NHẬN THẬT TỪ BACKEND
        showToast(
            item.__successMessage ||
            "Đã đồng bộ thành công!"
        );

        // Ghi vào lịch sử thông báo CỤC BỘ (chuông) của chính thiết
        // bị này - việc gửi Web Push thật cho các thiết bị KHÁC đã
        // do server tự làm (xem pushSender.js), không phải ở đây.
        if (typeof maybeNotifyPush_ === "function") {

            try {
                maybeNotifyPush_(action, data);
            } catch (err) {
                console.warn("LOCAL NOTIF HOOK ERROR:", err);
            }
        }

        onQueueItemDone_(true);
    })

    .catch(function(err) {

        // Lỗi mạng/timeout -> GIỮ LẠI hàng đợi, sẽ tự thử lại ở
        // lượt processQueue kế tiếp (setInterval trong auth.js).
        console.error(
            "WRITE ACTION NETWORK ERROR:",
            err
        );

        isSyncing = false;
    });
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
// v2.0 - THAY THẾ JSONP CŨ (điểm yếu #1/#2/#8: JSONP để lộ
// API_TOKEN + payload nguyên văn trong URL, ai xem DevTools/lịch
// sử trình duyệt/log server trung gian cũng thấy được).
//
// Giữ NGUYÊN chữ ký hàm fetchJsonpPhase3_(params, showSpinner,
// callback) vì matches.js và notifications.js gọi trực tiếp hàm
// này - đổi nội bộ, không cần sửa các nơi gọi.
//
// Cách dịch params -> route mới:
//   {action:'initialData'}                  -> GET /api/data/initial
//   {action:'monthData', month, year}        -> GET /api/data/month
//   {action:'analyticsData'}                 -> GET /api/data/analytics
//   {payload: '<json 1 item trong syncQueue>'} -> xử lý qua
//        processQueue()/callBackendAction_ (KHÔNG dùng nữa ở đây
//        kể từ v2.0 - processQueue() giờ gọi callBackendAction_
//        trực tiếp, xem phía trên).
//   {action:'getPushSubscriptions'}          -> ĐÃ NGƯNG (điểm yếu
//        #8): trình duyệt không bao giờ được phép tải danh sách
//        subscription của người khác nữa - trả lỗi ngay.
// ======================================================

function fetchJsonpPhase3_(
    params,
    showSpinner,
    callback
) {

    params = params || {};


    if (showSpinner) {

        showCloudLoading_();
    }


    function finish_(error, data) {

        if (showSpinner) {

            hideCloudLoading_();
        }

        if (typeof callback === "function") {

            callback(error, data);
        }
    }


    var action = params.action;
    var readPath = null;

    if (action === "initialData") {

        readPath = "/api/data/initial";

    } else if (action === "monthData") {

        readPath =
            "/api/data/month?month=" +
            encodeURIComponent(params.month) +
            "&year=" +
            encodeURIComponent(params.year);

    } else if (action === "analyticsData") {

        readPath = "/api/data/analytics";

    } else if (action === "monthCloseStatus") {

        readPath =
            "/api/data/month-close-status?month=" +
            encodeURIComponent(params.month) +
            "&year=" +
            encodeURIComponent(params.year);

    } else if (action === "getPushSubscriptions") {

        // (v2.0) Đã loại bỏ vĩnh viễn - xem _lib/pushSender.js phía
        // Vercel: trình duyệt không bao giờ còn thấy danh sách
        // subscription nữa. Bất kỳ code cũ nào còn gọi tới đây sẽ
        // nhận lỗi rõ ràng thay vì âm thầm thất bại.
        finish_(
            new Error(
                "getPushSubscriptions đã ngưng dùng từ v2.0 - push chỉ gửi từ server."
            ),
            null
        );
        return;

    } else if (params.payload !== undefined) {

        // Đường ghi cũ (dùng bởi processQueue() phiên bản trước) -
        // processQueue() v2.0 không còn gọi qua đây nữa (gọi thẳng
        // callBackendAction_), giữ lại nhánh này chỉ để không vỡ
        // nếu còn code nào khác lỡ gọi theo shape cũ.
        try {

            var item = JSON.parse(params.payload);
            var data = Object.assign({}, item);

            delete data.action;
            delete data.idempotencyKey;
            delete data.__ownerStt;
            delete data.__successMessage;

            callBackendAction_(item.action, data, item.idempotencyKey)
                .then(function(json) { finish_(null, json); })
                .catch(function(err) { finish_(err, null); });

        } catch (err) {

            finish_(err, null);
        }

        return;

    } else {

        finish_(new Error("Action không xác định: " + action), null);
        return;
    }


    callBackendRead_(readPath)
        .then(function(result) {
            finish_(null, result);
        })
        .catch(function(err) {
            finish_(err, null);
        });
}


// ======================================================
// INITIAL CLOUD DATA
// ======================================================

function fetchCloudData(
    showSpinner,
    onSuccess,
    onFailure
) {

    var attempt = 0;
    var maxAttempts = 2;

    function isRetryableInitialError_(error) {
        var statusCode = parseInt(error && error.statusCode) || 0;
        return !statusCode || statusCode === 408 || statusCode === 429 || statusCode >= 500;
    }

    function loadInitialData_() {

        attempt++;

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

                    if (attempt < maxAttempts && isRetryableInitialError_(error)) {
                        console.warn(
                            "INITIAL DATA RETRY " + attempt + "/" + maxAttempts + ":",
                            error
                        );

                        // Giữ trạng thái loading trong lúc chờ retry để màn
                        // hình không hiện số 0 như thể đã tải xong.
                        if (showSpinner) showCloudLoading_();

                        setTimeout(loadInitialData_, 1200);
                        return;
                    }

                    console.error(
                        "INITIAL DATA ERROR AFTER " + attempt + " ATTEMPT(S):",
                        error
                    );

                    if (typeof showToast === "function") {
                        showToast("Chưa tải được dữ liệu. Vui lòng thử nút Làm mới.", "warning");
                    }

                    if (typeof onFailure === "function") {
                        onFailure(error);
                    }

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

                    if (typeof onFailure === "function") {
                        onFailure(err);
                    }
                }
            }
        );
    }

    loadInitialData_();
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

        // (v2.0 fix) Backend giờ trả về CẢ thành viên đã xóa mềm
        // (IsActive=false) để các service khác tra cứu lịch sử theo
        // STT (xem MemberService.txt). Nếu gán thẳng vào `members`
        // không lọc, thành viên vừa xóa sẽ "sống lại" trên UI ngay
        // lần fetchCloudData() kế tiếp (vd: sau khi thêm thành viên
        // mới) dù server đã xóa đúng - trông như xóa không có tác
        // dụng. Chỉ giữ thành viên đang hoạt động cho toàn bộ giao
        // diện (danh sách, dropdown chọn người...); lịch sử trận đấu/
        // sổ quỹ vẫn dùng tên/STT lưu sẵn trong chính bản ghi đó, KHÔNG
        // tra cứu lại qua mảng `members` này nên không bị ảnh hưởng.
        members =
            data.members.filter(function(m) {
                return m && m.isActive !== false;
            });
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


    if (
        data.ownerStt !== undefined
    ) {

        window.ownerStt =
            parseInt(data.ownerStt) || 0;
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

    // (v2.0) Không đăng nhập -> không ghi (giống saveLocalData()).
    if (!loggedInMemberStt) return;

    try {

        localStorage.setItem(
            getActorStorageKey_("clb_memberStats_phase3"),
            JSON.stringify(
                window.memberStats || []
            )
        );


        localStorage.setItem(
            getActorStorageKey_("clb_activeMonth_phase3"),
            String(
                window.activeDataMonth || 0
            )
        );


        localStorage.setItem(
            getActorStorageKey_("clb_activeYear_phase3"),
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

    // (v2.0) Chưa đăng nhập -> không đọc gì (được gọi từ
    // enterAppScreen_() trong auth.js, LUÔN SAU khi đã có actor).
    if (!loggedInMemberStt) return;

    try {

        let storedStats =
            JSON.parse(
                localStorage.getItem(
                    getActorStorageKey_("clb_memberStats_phase3")
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
                    getActorStorageKey_("clb_activeMonth_phase3")
                )
            ) || 0;


        let storedYear =
            parseInt(
                localStorage.getItem(
                    getActorStorageKey_("clb_activeYear_phase3")
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

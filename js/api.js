// ======================================================
// API.JS - CLEAN VERSION
// ======================================================
//
// GET  : JSONP -> tránh CORS Google Apps Script
// POST : no-cors + Backend chống trùng theo ID
//
// ======================================================


// ======================================================
// ACTION QUEUE
// ======================================================

function enqueueAction(actionName, payload, successMessage) {

    payload.action = actionName;

    syncQueue.push(payload);


    // ==================================================
    // 1. CẬP NHẬT STATE CỤC BỘ
    // ==================================================

    if (
        actionName === "addMatch" &&
        payload.match
    ) {

        matches.unshift(payload.match);

    }


    else if (
        actionName === "updateMatch" &&
        payload.match
    ) {

        let m =
            matches.find(
                x => x.id == payload.match.id
            );

        if (m) {

            m.scoreA =
                payload.match.scoreA;

            m.scoreB =
                payload.match.scoreB;

            m.specialBet =
                payload.match.specialBet;
        }

    }


    else if (
        actionName === "addGocLog" &&
        payload.gocLog
    ) {

        gocLogs.unshift(
            payload.gocLog
        );

    }


    else if (
        actionName === "addBooking" &&
        payload.booking
    ) {

        bookingLogs.unshift(
            payload.booking
        );

    }


    else if (
        actionName === "addCashbook" &&
        payload.cashbook
    ) {

        cashbookLogs.unshift(
            payload.cashbook
        );

    }


    else if (
        actionName === "addRule" &&
        payload.rule
    ) {

        rulesList.unshift(
            payload.rule
        );

    }


    else if (
        actionName === "updateSettings" &&
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
        actionName === "deleteItem"
    ) {

        let id =
            payload.id;


        if (
            payload.sheetName ===
            "Matches"
        ) {

            matches =
                matches.filter(
                    x => x.id != id
                );
        }


        if (
            payload.sheetName ===
            "Bookings"
        ) {

            bookingLogs =
                bookingLogs.filter(
                    x => x.id != id
                );
        }


        if (
            payload.sheetName ===
            "Cashbook"
        ) {

            cashbookLogs =
                cashbookLogs.filter(
                    x => x.id != id
                );
        }


        if (
            payload.sheetName ===
            "GocLogs"
        ) {

            gocLogs =
                gocLogs.filter(
                    x => x.id != id
                );
        }


        if (
            payload.sheetName ===
            "Rules"
        ) {

            rulesList =
                rulesList.filter(
                    x => x.id != id
                );
        }


        if (
            payload.sheetName ===
            "QuyLogs"
        ) {

            quyLogs =
                quyLogs.filter(
                    x => x.id != id
                );
        }
    }


    sortCollectionsByTime();

    saveLocalData();


    // ==================================================
    // 2. RENDER CỤC BỘ
    // ==================================================


    // TIỀN GÓC
    if (
        actionName === "addGocLog" ||

        (
            actionName === "deleteItem" &&
            payload.sheetName === "GocLogs"
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


    // THƯỞNG ĐẶT SÂN
    else if (
        actionName === "addBooking" ||

        (
            actionName === "deleteItem" &&
            payload.sheetName === "Bookings"
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


    // TRẬN ĐẤU
    else if (
        actionName === "addMatch" ||

        actionName === "updateMatch" ||

        (
            actionName === "deleteItem" &&
            payload.sheetName === "Matches"
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


        if (
            typeof renderAnalyticsTab ===
            "function"
        ) {
            renderAnalyticsTab();
        }


        applyRolePermissions();
    }


    // SỔ THU CHI
    else if (
        actionName === "addCashbook" ||

        (
            actionName === "deleteItem" &&
            payload.sheetName === "Cashbook"
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


    // QUY ĐỊNH
    else if (
        actionName === "addRule" ||

        (
            actionName === "deleteItem" &&
            payload.sheetName === "Rules"
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


    // QUỸ QUÝ
    else if (
        actionName === "deleteItem" &&
        payload.sheetName === "QuyLogs"
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


    // SETTINGS
    else if (
        actionName === "updateSettings"
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


    // ACTION KHÁC
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
                JSON.stringify(item)
        }
    )

    .then(function() {

        // Browser đã gửi request.
        // Backend có lớp chống trùng theo ID.

        syncQueue.shift();

        isSyncing =
            false;


        saveLocalData();


        if (
            syncQueue.length > 0
        ) {

            processQueue();
        }
    })

    .catch(function(err) {

        console.error(
            "POST CLOUD NETWORK ERROR:",
            err
        );


        isSyncing =
            false;
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
// JSONP GET CLOUD DATA
// ======================================================

function fetchCloudData(
    showSpinner,
    onSuccess
) {

    if (!GOOGLE_SCRIPT_URL) {
        return;
    }


    if (showSpinner) {

        showCloudLoading_();
    }


    let callbackName =

        "__thanglong_cloud_" +

        Date.now() +

        "_" +

        Math.floor(
            Math.random() * 100000
        );


    let script =
        document.createElement(
            "script"
        );


    let finished =
        false;


    let timeoutId =
        null;


    // ==================================================
    // CLEANUP
    // ==================================================

    function cleanup_() {

        if (finished) {
            return;
        }


        finished =
            true;


        if (timeoutId) {

            clearTimeout(
                timeoutId
            );
        }


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


        if (
            script &&
            script.parentNode
        ) {

            script.parentNode.removeChild(
                script
            );
        }


        if (showSpinner) {

            hideCloudLoading_();
        }
    }


    // ==================================================
    // JSONP CALLBACK
    //
    // BIẾN data CHỈ TỒN TẠI TRONG HÀM NÀY
    // ==================================================

    window[
        callbackName
    ] = function(data) {

        if (finished) {
            return;
        }


        if (!data) {

            console.error(
                "JSONP CLOUD ERROR: Không có dữ liệu."
            );


            cleanup_();

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
                "UPDATE CLOUD STATE ERROR:",
                err
            );

        } finally {

            cleanup_();
        }
    };


    // ==================================================
    // LOAD ERROR
    // ==================================================

    script.onerror =
        function() {

            if (finished) {
                return;
            }


            console.error(
                "JSONP CLOUD ERROR: Không tải được Apps Script."
            );


            cleanup_();
        };


    // ==================================================
    // SLOW CLOUD
    //
    // 15 giây chỉ ẩn loading.
    // Không xóa callback.
    // ==================================================

    timeoutId =
        setTimeout(
            function() {

                if (finished) {
                    return;
                }


                if (showSpinner) {

                    hideCloudLoading_();
                }


                console.warn(
                    "JSONP CLOUD SLOW - vẫn tiếp tục chờ dữ liệu..."
                );

            },
            15000
        );


    // ==================================================
    // JSONP URL
    // ==================================================

    let separator =
        GOOGLE_SCRIPT_URL.includes("?")
            ? "&"
            : "?";


    script.src =

        GOOGLE_SCRIPT_URL +

        separator +

        "prefix=" +

        encodeURIComponent(
            callbackName
        ) +

        "&_=" +

        Date.now();


    script.async =
        true;


    document.head.appendChild(
        script
    );
}


// ======================================================
// UPDATE TOÀN BỘ STATE TỪ CLOUD
// ======================================================

function updateStateFromCloud(data) {

    if (!data) {

        console.error(
            "updateStateFromCloud: Không có dữ liệu."
        );

        return;
    }


    // MEMBERS
    if (
        data.members &&
        data.members.length > 0
    ) {

        members =
            data.members;
    }


    // MATCHES
    if (
        Array.isArray(
            data.matches
        )
    ) {

        matches =
            data.matches;
    }


    // BOOKINGS
    if (
        Array.isArray(
            data.bookingLogs
        )
    ) {

        bookingLogs =
            data.bookingLogs;
    }


    // CASHBOOK
    if (
        Array.isArray(
            data.cashbookLogs
        )
    ) {

        cashbookLogs =
            data.cashbookLogs;
    }


    // GOC LOGS
    if (
        Array.isArray(
            data.gocLogs
        )
    ) {

        gocLogs =
            data.gocLogs;
    }


    // QUY LOGS
    if (
        Array.isArray(
            data.quyLogs
        )
    ) {

        quyLogs =
            data.quyLogs;
    }


    // MONTHLY BALANCES
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


    // RULES
    if (
        Array.isArray(
            data.rules
        )
    ) {

        rulesList =
            data.rules;
    }


    // OPENING BALANCE
    if (
        data.openingBalance !==
        undefined
    ) {

        openingBalance =
            data.openingBalance;
    }


    // SETTINGS
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


    // ==================================================
    // HOÀN TẤT
    // ==================================================

    sortCollectionsByTime();

    saveLocalData();

    initApp();
}

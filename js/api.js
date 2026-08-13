// ======================================================
// API.JS V2
//
// GET Cloud:
//   JSONP -> tránh CORS của Google Apps Script
//
// POST:
//   giữ cơ chế hiện tại
//
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

        matches.unshift(
            payload.match
        );

    }


    else if (
        actionName === "updateMatch" &&
        payload.match
    ) {

        let m =
            matches.find(
                x =>
                    x.id ==
                    payload.match.id
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
            payload.settings;

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
                    x =>
                        x.id != id
                );
        }


        if (
            payload.sheetName ===
            "Bookings"
        ) {

            bookingLogs =
                bookingLogs.filter(
                    x =>
                        x.id != id
                );
        }


        if (
            payload.sheetName ===
            "Cashbook"
        ) {

            cashbookLogs =
                cashbookLogs.filter(
                    x =>
                        x.id != id
                );
        }


        if (
            payload.sheetName ===
            "GocLogs"
        ) {

            gocLogs =
                gocLogs.filter(
                    x =>
                        x.id != id
                );
        }


        if (
            payload.sheetName ===
            "Rules"
        ) {

            rulesList =
                rulesList.filter(
                    x =>
                        x.id != id
                );
        }
    }


    sortCollectionsByTime();

    saveLocalData();


    // ==================================================
    // 2. CHỈ RENDER MÀN HÌNH LIÊN QUAN
    // ==================================================


    // --------------------------------------------------
    // TIỀN GÓC
    // --------------------------------------------------

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


        renderGocLogsTab();

        renderDashboard();

        renderFinance();

        renderCashbook();

        applyRolePermissions();
    }


    // --------------------------------------------------
    // THƯỞNG ĐẶT SÂN
    // --------------------------------------------------

    else if (
        actionName === "addBooking" ||

        (
            actionName ===
                "deleteItem" &&

            payload.sheetName ===
                "Bookings"
        )
    ) {

        renderBookingLogs();

        renderDashboard();

        renderFinance();

        applyRolePermissions();
    }


    // --------------------------------------------------
    // TRẬN ĐẤU
    // --------------------------------------------------

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

        renderAllMatchLog();

        renderGamification();

        renderDashboard();

        renderFinance();

        renderAnalyticsTab();

        applyRolePermissions();
    }


    // --------------------------------------------------
    // SỔ THU CHI
    // --------------------------------------------------

    else if (
        actionName === "addCashbook" ||

        (
            actionName ===
                "deleteItem" &&

            payload.sheetName ===
                "Cashbook"
        )
    ) {

        renderCashbook();

        applyRolePermissions();
    }


    // --------------------------------------------------
    // QUY ĐỊNH
    // --------------------------------------------------

    else if (
        actionName === "addRule" ||

        (
            actionName ===
                "deleteItem" &&

            payload.sheetName ===
                "Rules"
        )
    ) {

        renderRulesTab();

        applyRolePermissions();
    }


    // --------------------------------------------------
    // SETTINGS
    // --------------------------------------------------

    else if (
        actionName ===
        "updateSettings"
    ) {

        populateSettingsForm();

        renderDashboard();

        renderFinance();

        applyRolePermissions();
    }


    // --------------------------------------------------
    // CÁC ACTION KHÁC
    // --------------------------------------------------

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

    isSyncing = true;

    let item = syncQueue[0];


    // ==================================================
    // POST QUA no-cors
    //
    // Apps Script vẫn nhận được request.
    // Browser không cần đọc response nên không bị
    // CORS làm hiểu nhầm là gửi thất bại.
    // ==================================================

    fetch(
        GOOGLE_SCRIPT_URL,
        {
            method: "POST",

            mode: "no-cors",

            headers: {
                "Content-Type":
                    "text/plain;charset=utf-8"
            },

            body:
                JSON.stringify(item)
        }
    )

    .then(function() {

        // Request đã được browser gửi thành công.
        // Bỏ khỏi queue để KHÔNG gửi lại cùng payload.

        syncQueue.shift();

        isSyncing = false;

        saveLocalData();


        if (syncQueue.length > 0) {
            processQueue();
        }
    })

    .catch(function(err) {

        console.error(
            "POST CLOUD NETWORK ERROR:",
            err
        );

        // Chỉ giữ lại queue nếu thật sự lỗi mạng.
        isSyncing = false;
    });
}


// ======================================================
// JSONP CLOUD LOADER
// ======================================================

function fetchCloudData(showSpinner, onSuccess) {

    if (!GOOGLE_SCRIPT_URL) {
        return;
    }


    if (showSpinner) {
        showCloudLoading_();
    }


    // Callback riêng cho mỗi lần tải
    let callbackName =
        "__thanglong_cloud_" +
        Date.now() +
        "_" +
        Math.floor(Math.random() * 100000);


    let script =
        document.createElement("script");


    let finished = false;

    let timeoutId = null;


    // ==================================================
    // CLEANUP
    // ==================================================

    function cleanup_() {

        if (finished) {
            return;
        }

        finished = true;


        if (timeoutId) {
            clearTimeout(timeoutId);
        }


        try {

            delete window[callbackName];

        } catch (e) {

            window[callbackName] =
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
    // CHỈ TẠI ĐÂY mới có biến "data"
    // ==================================================

    window[callbackName] =
        function(data) {

            if (finished) {
                return;
            }


            if (!data) {

                cleanup_();

                console.error(
                    "JSONP CLOUD ERROR: Không có dữ liệu."
                );

                return;
            }


            // Nhận dữ liệu Cloud
            updateStateFromCloud(
                data
            );


            // Callback phụ nếu caller cần
            if (
                typeof onSuccess ===
                "function"
            ) {

                onSuccess(
                    data
                );
            }


            cleanup_();
        };


    // ==================================================
    // SCRIPT ERROR
    // ==================================================

    script.onerror =
        function() {

            if (finished) {
                return;
            }


            cleanup_();


            console.error(
                "JSONP CLOUD ERROR: Không tải được Apps Script."
            );
        };


    // ==================================================
    // GOOGLE APPS SCRIPT CÓ THỂ LOAD CHẬM
    //
    // Sau 15 giây chỉ ẩn spinner.
    // KHÔNG xóa callback.
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
    // BUILD JSONP URL
    // ==================================================

    let separator =
        GOOGLE_SCRIPT_URL.includes("?")
            ? "&"
            : "?";


    script.src =
        GOOGLE_SCRIPT_URL +
        separator +
        "prefix=" +
        encodeURIComponent(callbackName) +
        "&_=" +
        Date.now();


    script.async =
        true;


    document.head.appendChild(
        script
    );
}


// ======================================================
// LOADING OVERLAY
// ======================================================

function showCloudLoading_() {

    let overlay =
        document.getElementById(
            'loadingOverlay'
        );


    if (!overlay) {
        return;
    }


    overlay.classList.remove(
        'hidden'
    );


    overlay.classList.add(
        'flex'
    );
}


function hideCloudLoading_() {

    let overlay =
        document.getElementById(
            'loadingOverlay'
        );


    if (!overlay) {
        return;
    }


    overlay.classList.add(
        'hidden'
    );


    overlay.classList.remove(
        'flex'
    );
}



// ======================================================
// UPDATE STATE FROM CLOUD
// ======================================================

function fetchCloudData(showSpinner, onSuccess) {

    if (
        data.members &&
        data.members.length > 0
    ) {

        members =
            data.members;
    }


    if (data.matches) {

        matches =
            data.matches;
    }


    if (data.bookingLogs) {

        bookingLogs =
            data.bookingLogs;
    }


    if (data.cashbookLogs) {

        cashbookLogs =
            data.cashbookLogs;
    }


    if (data.gocLogs) {

        gocLogs =
            data.gocLogs;
    }


    if (data.quyLogs) {

        quyLogs =
            data.quyLogs;
    }
    
    if (data.rules) {

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


    if (data.settings) {

        systemSettings =
            Object.assign(
                systemSettings,
                data.settings
            );
    }


    sortCollectionsByTime();

    saveLocalData();

    initApp();
}
// ======================================================
// UPDATE STATE FROM CLOUD
// ======================================================

function updateStateFromCloud(data) {

    if (!data) {
        console.error(
            "updateStateFromCloud: Không có dữ liệu."
        );
        return;
    }


    // =========================
    // MEMBERS
    // =========================

    if (
        data.members &&
        data.members.length > 0
    ) {
        members = data.members;
    }


    // =========================
    // MATCHES
    // =========================

    if (data.matches) {
        matches = data.matches;
    }


    // =========================
    // BOOKINGS
    // =========================

    if (data.bookingLogs) {
        bookingLogs = data.bookingLogs;
    }


    // =========================
    // CASHBOOK
    // =========================

    if (data.cashbookLogs) {
        cashbookLogs = data.cashbookLogs;
    }


    // =========================
    // GOC LOGS
    // =========================

    if (data.gocLogs) {
        gocLogs = data.gocLogs;
    }


    // =========================
    // QUY LOGS
    // =========================

    if (data.quyLogs) {
        quyLogs = data.quyLogs;
    }


    // =========================
    // MONTHLY BALANCES
    // =========================

    if (data.monthlyBalances) {
        window.monthlyBalances =
            data.monthlyBalances;
    } else {
        window.monthlyBalances =
            [];
    }


    // =========================
    // RULES
    // =========================

    if (data.rules) {
        rulesList = data.rules;
    }


    // =========================
    // OPENING BALANCE
    // =========================

    if (
        data.openingBalance !==
        undefined
    ) {
        openingBalance =
            data.openingBalance;
    }


    // =========================
    // SETTINGS
    // =========================

    if (data.settings) {

        systemSettings =
            Object.assign(
                {},
                systemSettings,
                data.settings
            );
    }


    // =========================
    // FINALIZE
    // =========================

    sortCollectionsByTime();

    saveLocalData();

    initApp();
}

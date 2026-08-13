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


    isSyncing =
        true;


    let item =
        syncQueue[0];


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
                JSON.stringify(
                    item
                )
        }
    )

    .then(
        function(res) {

            return res.json();
        }
    )

    .then(
        function(data) {

            // Apps Script thường trả HTTP 200
            // ngay cả khi nghiệp vụ ERROR.
            if (
                data &&
                data.status ===
                "ERROR"
            ) {

                throw new Error(
                    data.message ||
                    "Backend báo lỗi."
                );
            }


            syncQueue.shift();

            isSyncing =
                false;


            saveLocalData();


            if (
                syncQueue.length >
                0
            ) {

                processQueue();
            }
        }
    )

    .catch(
        function(err) {

            console.error(
                "POST CLOUD ERROR:",
                err
            );


            isSyncing =
                false;


            // Không tự xóa item khỏi queue.
            // Giữ lại để tránh mất thao tác.
        }
    );
}



// ======================================================
// JSONP CLOUD LOADER
// ======================================================

function fetchCloudData(showSpinner) {

    if (!GOOGLE_SCRIPT_URL) {
        return;
    }


    if (showSpinner) {

        showCloudLoading_();
    }


    // Callback duy nhất cho mỗi request
    let callbackName =

        "__thanglong_cloud_" +

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


    let timeoutId =
        null;


    let finished =
        false;



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
            ] = undefined;
        }


        if (
            script &&
            script.parentNode
        ) {

            script.parentNode
                .removeChild(
                    script
                );
        }


        if (showSpinner) {

            hideCloudLoading_();
        }
    }



    // ==================================================
    // CALLBACK JSONP
    // ==================================================

    window[
        callbackName
    ] = function(data) {

        if (finished) {
            return;
        }


        cleanup_();


        if (!data) {

            console.error(
                "JSONP CLOUD ERROR: Không có dữ liệu."
            );

            return;
        }


        updateStateFromCloud(
            data
        );
    };



    // ==================================================
    // SCRIPT LOAD ERROR
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
    // TIMEOUT
    // ==================================================
    timeoutId =
    setTimeout(
        function() {

            if (finished) {
                return;
            }

            // Google Apps Script đôi lúc khởi động chậm.
            // Chỉ ẩn vòng loading, KHÔNG xóa callback.
            // Khi dữ liệu về sau đó, app vẫn nhận bình thường.

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
    // BUILD URL
    // ==================================================

    let separator =
        GOOGLE_SCRIPT_URL.includes(
            "?"
        )
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

function updateStateFromCloud(data) {

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

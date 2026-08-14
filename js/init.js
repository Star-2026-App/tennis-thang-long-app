// ======================================================
// INIT.JS - PHASE 3
// ======================================================

function initApp() {

    if (
        !members ||
        members.length === 0
    ) {

        members =
            defaultFallbackMembers;
    }


    populateSettingsForm();

    populateSelectors();

    recalculateMemberPaidTotals();

    renderGamification();

    renderDashboard();

    renderFinance();

    renderAllMatchLog();

    renderGocLogsTab();

    renderBookingLogs();

    renderQuyTable();

    renderCashbook();

    renderMemberList();

    renderRulesTab();


    // ==================================================
    // PHÂN TÍCH KHÔNG RENDER KHI MỞ APP
    //
    // Toàn bộ Matches lịch sử chỉ được tải khi người dùng
    // thực sự mở tab Phân tích.
    // ==================================================


    applyRolePermissions();
}


function onFinanceMonthYearChange() {

    let m =
        document
            .getElementById(
                "selectFinanceMonth"
            )
            .value;


    let y =
        document
            .getElementById(
                "selectFinanceYear"
            )
            .value;


    if (
        document.getElementById(
            "selectBookingMonth"
        )
    ) {

        document
            .getElementById(
                "selectBookingMonth"
            )
            .value = m;
    }


    if (
        document.getElementById(
            "selectBookingYear"
        )
    ) {

        document
            .getElementById(
                "selectBookingYear"
            )
            .value = y;
    }


    // ==================================================
    // PHASE 3:
    // Nếu tháng đã có trong cache -> đổi ngay.
    // Nếu chưa có -> chỉ tải Matches + Bookings tháng đó.
    // ==================================================

    if (
        typeof fetchMonthData ===
        "function"
    ) {

        fetchMonthData(
            m,
            y,
            true
        );


        return;
    }


    // Fallback an toàn nếu API Phase 3 chưa được load.
    renderFinance();

    renderBookingLogs();
}


// ======================================================
// BOOKING MONTH/YEAR CHANGE
//
// Booking và Finance dùng cùng một "tháng dữ liệu đang hoạt động"
// để tránh global Matches/Bookings bị lệch kỳ.
// ======================================================

function onBookingMonthYearChangePhase3() {

    let m =
        document
            .getElementById(
                "selectBookingMonth"
            )
            .value;


    let y =
        document
            .getElementById(
                "selectBookingYear"
            )
            .value;


    let financeMonth =
        document.getElementById(
            "selectFinanceMonth"
        );


    let financeYear =
        document.getElementById(
            "selectFinanceYear"
        );


    if (financeMonth) {

        financeMonth.value =
            m;
    }


    if (financeYear) {

        financeYear.value =
            y;
    }


    if (
        typeof fetchMonthData ===
        "function"
    ) {

        fetchMonthData(
            m,
            y,
            true
        );


        return;
    }


    renderBookingLogs();
}


function recalculateMemberPaidTotals() {

    if (
        !members ||
        members.length === 0
    ) {
        return;
    }


    members.forEach(
        function(m) {

            let userLogs =
                (gocLogs || [])
                .filter(
                    function(g) {

                        return (
                            g.name ===
                            m.name
                        );
                    }
                );


            m.paidUser =
                userLogs.reduce(
                    function(
                        sum,
                        g
                    ) {

                        return (
                            sum +
                            (
                                parseInt(
                                    g.amount ||
                                    0
                                ) ||
                                0
                            )
                        );
                    },
                    0
                );
        }
    );
}


function populateSelectors() {

    if (
        !members ||
        members.length === 0
    ) {
        return;
    }


    [
        "dashMainUser",
        "filterGocUser"
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


            if (
                id ===
                "filterGocUser"
            ) {

                sel.innerHTML =
                    '<option value="ALL">-- Tất cả thành viên --</option>';

            } else {

                sel.innerHTML =
                    "";
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


            if (currentVal) {

                sel.value =
                    currentVal;
            }
        }
    );


    [
        "matchP1A",
        "matchP2A",
        "matchP1B",
        "matchP2B"
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


            sel.innerHTML =
                '<option value="" disabled selected>-- Chọn thành viên --</option>';


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
        }
    );


    if (loggedInMemberName) {

        let dashSelect =
            document.getElementById(
                "dashMainUser"
            );


        if (dashSelect) {

            dashSelect.value =
                loggedInMemberName;


            if (
                currentUserRole !==
                "admin"
            ) {

                dashSelect.disabled =
                    true;
            }
        }
    }
}

// ======================================================
// APP.JS - PHASE 3 STARTUP
// ======================================================

window.addEventListener(
    "DOMContentLoaded",
    function() {

        let now =
            new Date();


        let curMonth =
            now.getMonth() + 1;


        let curYear =
            now.getFullYear();


        if (
            document.getElementById(
                "selectFinanceMonth"
            )
        ) {

            document
                .getElementById(
                    "selectFinanceMonth"
                )
                .value =
                    curMonth;
        }


        if (
            document.getElementById(
                "selectFinanceYear"
            )
        ) {

            document
                .getElementById(
                    "selectFinanceYear"
                )
                .value =
                    curYear;
        }


        if (
            document.getElementById(
                "selectBookingMonth"
            )
        ) {

            document
                .getElementById(
                    "selectBookingMonth"
                )
                .value =
                    curMonth;
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
                .value =
                    curYear;
        }


        // ==============================================
        // BOOKING SELECTORS DÙNG CHUNG KỲ VỚI FINANCE
        // ==============================================

        let bookingMonthEl =
            document.getElementById(
                "selectBookingMonth"
            );


        let bookingYearEl =
            document.getElementById(
                "selectBookingYear"
            );


        if (
            bookingMonthEl &&
            typeof onBookingMonthYearChangePhase3 ===
                "function"
        ) {

            bookingMonthEl.onchange =
                onBookingMonthYearChangePhase3;
        }


        if (
            bookingYearEl &&
            typeof onBookingMonthYearChangePhase3 ===
                "function"
        ) {

            bookingYearEl.onchange =
                onBookingMonthYearChangePhase3;
        }


        // ==============================================
        // LOCAL FIRST
        // ==============================================

        loadLocalData();


        if (
            typeof restorePhase3LocalState_ ===
            "function"
        ) {

            restorePhase3LocalState_(
                curMonth,
                curYear
            );
        }


        if (
            !members ||
            members.length === 0
        ) {

            members =
                defaultFallbackMembers;
        }


        // Hiển thị cache/local trước để app mở nhanh.
        initApp();


        // ==============================================
        // CLOUD INITIAL DATA NHẸ
        // ==============================================

        fetchCloudData(
            false
        );
    }
);

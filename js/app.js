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
        // (v2.1.2) GOC + CASHBOOK SELECTORS - tải theo tháng đang
        // xem, giống Booking/Finance ở trên (Tab "Nộp Tiền" và
        // "Sổ Thu Chi" trước đây tải toàn bộ lịch sử không điều
        // kiện, gây chậm khi CLB chạy lâu ngày).
        // ==============================================

        if (
            document.getElementById(
                "selectGocMonth"
            )
        ) {

            document
                .getElementById(
                    "selectGocMonth"
                )
                .value =
                    curMonth;
        }


        if (
            document.getElementById(
                "selectGocYear"
            )
        ) {

            document
                .getElementById(
                    "selectGocYear"
                )
                .value =
                    curYear;
        }


        if (
            document.getElementById(
                "selectCashbookMonth"
            )
        ) {

            document
                .getElementById(
                    "selectCashbookMonth"
                )
                .value =
                    curMonth;
        }


        if (
            document.getElementById(
                "selectCashbookYear"
            )
        ) {

            document
                .getElementById(
                    "selectCashbookYear"
                )
                .value =
                    curYear;
        }


        let gocMonthEl =
            document.getElementById(
                "selectGocMonth"
            );


        let gocYearEl =
            document.getElementById(
                "selectGocYear"
            );


        if (
            gocMonthEl &&
            typeof onGocMonthYearChangePhase3 ===
                "function"
        ) {

            gocMonthEl.onchange =
                onGocMonthYearChangePhase3;
        }


        if (
            gocYearEl &&
            typeof onGocMonthYearChangePhase3 ===
                "function"
        ) {

            gocYearEl.onchange =
                onGocMonthYearChangePhase3;
        }


        let cashbookMonthEl =
            document.getElementById(
                "selectCashbookMonth"
            );


        let cashbookYearEl =
            document.getElementById(
                "selectCashbookYear"
            );


        if (
            cashbookMonthEl &&
            typeof onCashbookMonthYearChangePhase3 ===
                "function"
        ) {

            cashbookMonthEl.onchange =
                onCashbookMonthYearChangePhase3;
        }


        if (
            cashbookYearEl &&
            typeof onCashbookMonthYearChangePhase3 ===
                "function"
        ) {

            cashbookYearEl.onchange =
                onCashbookMonthYearChangePhase3;
        }


        // ==============================================
        // v2.0 (sửa điểm yếu #11): KHÔNG còn loadLocalData()/
        // fetchCloudData() vô điều kiện ở đây. Trước đây app.js
        // tải toàn bộ dữ liệu CLB (kể cả tài chính) ngay khi mở
        // trang, TRƯỚC khi biết người dùng đã đăng nhập hay chưa
        // - màn hình đăng nhập chỉ là lớp phủ hình ảnh, dữ liệu
        // vẫn nằm sẵn trong bộ nhớ/localStorage.
        //
        // Từ v2.0, bước ĐẦU TIÊN và DUY NHẤT là hỏi server "tôi
        // có đang đăng nhập không" (GET /api/auth/session, xem
        // auth.js checkExistingSession_()). CHỈ khi server xác
        // nhận có phiên hợp lệ, enterAppScreen_() mới gọi
        // loadLocalData() (đã namespace theo actor - storage.js)
        // và fetchCloudData(). Nếu chưa đăng nhập, màn hình đăng
        // nhập là nơi DUY NHẤT hiển thị, không có dữ liệu CLB nào
        // được đưa vào bộ nhớ trình duyệt.
        // ==============================================

        // restorePhase3LocalState_ (khôi phục memberStats/tháng đang
        // xem từ localStorage) chuyển vào enterAppScreen_() trong
        // auth.js - cũng là dữ liệu CLB, không nên đụng tới trước
        // khi có xác nhận phiên đăng nhập hợp lệ.
        window.__pendingCurMonth = curMonth;
        window.__pendingCurYear = curYear;

        checkExistingSession_();
    }
);

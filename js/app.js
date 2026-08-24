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

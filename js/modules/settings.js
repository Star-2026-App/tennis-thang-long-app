// ======================================================
// SETTINGS FRONTEND V2
// ======================================================

function populateSettingsForm() {

    document.getElementById('stQuyAmount').value =
        parseInt(systemSettings.quyAmount) || 600000;

    document.getElementById('stReward16').value =
        parseInt(systemSettings.reward16h) || 20000;

    document.getElementById('stReward18').value =
        parseInt(systemSettings.reward18h) || 30000;

    document.getElementById('stMaxLimit').value =
        parseInt(systemSettings.maxRewardLimit) || 15;


    // ==================================================
    // TIỀN GÓC - CẤU HÌNH MỚI
    // ==================================================

    document.getElementById('stGocDefaultPerMatch').value =
        parseInt(systemSettings.gocDefaultPerMatch) || 10000;

    document.getElementById('stGocMonthlyCap').value =
        parseInt(systemSettings.gocMonthlyCap) || 150000;


    // ==================================================
    // NGÂN HÀNG
    // ==================================================

    document.getElementById('stBankId').value =
        systemSettings.bankId || "TCB";

    document.getElementById('stBankAccount').value =
        systemSettings.bankAccount || "";

    document.getElementById('stAccountName').value =
        systemSettings.accountName || "";


    let qrUrl =
        `https://img.vietqr.io/image/` +
        `${systemSettings.bankId}-` +
        `${systemSettings.bankAccount}-compact2.png` +
        `?accountName=${encodeURIComponent(systemSettings.accountName)}`;


    document.getElementById('dashQrImg').src =
        qrUrl;
}


// ======================================================
// SAVE SETTINGS
// ======================================================

function saveSystemSettings(e) {

    e.preventDefault();


    showActionConfirm(
        "Bạn có chắc chắn muốn lưu các cài đặt hệ thống mới lên Cloud?",

        () => {

            let quyAmount =
                parseInt(
                    document.getElementById('stQuyAmount').value
                );

            let reward16h =
                parseInt(
                    document.getElementById('stReward16').value
                );

            let reward18h =
                parseInt(
                    document.getElementById('stReward18').value
                );

            let maxRewardLimit =
                parseInt(
                    document.getElementById('stMaxLimit').value
                );


            // ==========================================
            // TIỀN GÓC
            // ==========================================

            let gocDefaultPerMatch =
                parseInt(
                    document.getElementById(
                        'stGocDefaultPerMatch'
                    ).value
                );

            let gocMonthlyCap =
                parseInt(
                    document.getElementById(
                        'stGocMonthlyCap'
                    ).value
                );


            // ==========================================
            // VALIDATE
            // ==========================================

            if (
                !gocDefaultPerMatch ||
                gocDefaultPerMatch <= 0
            ) {

                alert(
                    "Tiền góc mặc định/trận phải lớn hơn 0."
                );

                return;
            }


            if (
                !gocMonthlyCap ||
                gocMonthlyCap <= 0
            ) {

                alert(
                    "Ngưỡng tiền góc/tháng phải lớn hơn 0."
                );

                return;
            }


            if (
                gocMonthlyCap <
                gocDefaultPerMatch
            ) {

                alert(
                    "Ngưỡng tiền góc/tháng không được nhỏ hơn tiền góc mặc định của một trận."
                );

                return;
            }


            // ==========================================
            // UPDATE LOCAL SETTINGS
            // ==========================================

            systemSettings.quyAmount =
                quyAmount || 600000;

            systemSettings.reward16h =
                reward16h || 20000;

            systemSettings.reward18h =
                reward18h || 30000;

            systemSettings.maxRewardLimit =
                maxRewardLimit || 15;

            systemSettings.gocDefaultPerMatch =
                gocDefaultPerMatch;

            systemSettings.gocMonthlyCap =
                gocMonthlyCap;


            systemSettings.bankId =
                document
                    .getElementById('stBankId')
                    .value
                    .trim()
                    .toUpperCase();


            systemSettings.bankAccount =
                document
                    .getElementById('stBankAccount')
                    .value
                    .trim();


            systemSettings.accountName =
                document
                    .getElementById('stAccountName')
                    .value
                    .trim()
                    .toUpperCase();


            // ==========================================
            // SAVE BACKEND
            // ==========================================

            enqueueAction(
                "updateSettings",
                {
                    settings: systemSettings
                },
                "Đã lưu cài đặt hệ thống lên Cloud thành công!"
            );
        }
    );
}

function populateSettingsForm() {
    document.getElementById('stQuyAmount').value = systemSettings.quyAmount;
    document.getElementById('stReward16').value = systemSettings.reward16h;
    document.getElementById('stReward18').value = systemSettings.reward18h;
    document.getElementById('stMaxLimit').value = systemSettings.maxRewardLimit;
    document.getElementById('stBankId').value = systemSettings.bankId;
    document.getElementById('stBankAccount').value = systemSettings.bankAccount;
    document.getElementById('stAccountName').value = systemSettings.accountName;

    let qrUrl = `https://img.vietqr.io/image/${systemSettings.bankId}-${systemSettings.bankAccount}-compact2.png?accountName=${encodeURIComponent(systemSettings.accountName)}`;
    document.getElementById('dashQrImg').src = qrUrl;
}

function saveSystemSettings(e) {
    e.preventDefault();
    showActionConfirm("Bạn có chắc chắn muốn lưu các cài đặt hệ thống mới lên Cloud?", () => {
        systemSettings.quyAmount = parseFloat(document.getElementById('stQuyAmount').value) || 600000;
        systemSettings.reward16h = parseFloat(document.getElementById('stReward16').value) || 20000;
        systemSettings.reward18h = parseFloat(document.getElementById('stReward18').value) || 30000;
        systemSettings.maxRewardLimit = parseInt(document.getElementById('stMaxLimit').value) || 15;
        systemSettings.bankId = document.getElementById('stBankId').value.trim().toUpperCase();
        systemSettings.bankAccount = document.getElementById('stBankAccount').value.trim();
        systemSettings.accountName = document.getElementById('stAccountName').value.trim().toUpperCase();

        enqueueAction("updateSettings", { settings: systemSettings }, "Đã lưu cài đặt hệ thống lên Cloud thành công!");
    });
}

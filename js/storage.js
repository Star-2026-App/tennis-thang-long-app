function sortCollectionsByTime() {
    if (matches && matches.length > 0) {
        matches.sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));
    }
    if (gocLogs && gocLogs.length > 0) {
        gocLogs.sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));
    }
    if (bookingLogs && bookingLogs.length > 0) {
        bookingLogs.sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));
    }
    if (cashbookLogs && cashbookLogs.length > 0) {
        cashbookLogs.sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));
    }
}

function saveLocalData() {
    sortCollectionsByTime();
    localStorage.setItem('clb_members', JSON.stringify(members));
    localStorage.setItem('clb_matches', JSON.stringify(matches));
    localStorage.setItem('clb_bookingLogs', JSON.stringify(bookingLogs));
    localStorage.setItem('clb_cashbookLogs', JSON.stringify(cashbookLogs));
    localStorage.setItem('clb_gocLogs', JSON.stringify(gocLogs));
    localStorage.setItem('clb_quyLogs', JSON.stringify(quyLogs));
    localStorage.setItem('clb_rulesList', JSON.stringify(rulesList));
    localStorage.setItem('clb_openingBalance', openingBalance);
    localStorage.setItem('clb_settings', JSON.stringify(systemSettings));
    localStorage.setItem('clb_syncQueue', JSON.stringify(syncQueue));
}

function loadLocalData() {
    members = JSON.parse(localStorage.getItem('clb_members')) || [];
    matches = JSON.parse(localStorage.getItem('clb_matches')) || [];
    bookingLogs = JSON.parse(localStorage.getItem('clb_bookingLogs')) || [];
    cashbookLogs = JSON.parse(localStorage.getItem('clb_cashbookLogs')) || [];
    gocLogs = JSON.parse(localStorage.getItem('clb_gocLogs')) || [];
    quyLogs = JSON.parse(localStorage.getItem('clb_quyLogs')) || [];
    rulesList = JSON.parse(localStorage.getItem('clb_rulesList')) || [];
    let storedBal = localStorage.getItem('clb_openingBalance');
    if (storedBal !== null) openingBalance = parseFloat(storedBal);
    let storedSets = JSON.parse(localStorage.getItem('clb_settings'));
    if (storedSets) systemSettings = Object.assign(systemSettings, storedSets);
    syncQueue = JSON.parse(localStorage.getItem('clb_syncQueue')) || [];

    sortCollectionsByTime();
}

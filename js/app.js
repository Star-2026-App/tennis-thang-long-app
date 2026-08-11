window.addEventListener('DOMContentLoaded', () => {
    let now = new Date();
    let curMonth = now.getMonth() + 1;
    let curYear = now.getFullYear();
    
    if (document.getElementById('selectFinanceMonth')) document.getElementById('selectFinanceMonth').value = curMonth;
    if (document.getElementById('selectFinanceYear')) document.getElementById('selectFinanceYear').value = curYear;
    if (document.getElementById('selectBookingMonth')) document.getElementById('selectBookingMonth').value = curMonth;
    if (document.getElementById('selectBookingYear')) document.getElementById('selectBookingYear').value = curYear;

    loadLocalData();
    if (!members || members.length === 0) members = defaultFallbackMembers;

    initApp();
    fetchCloudData(false);
});

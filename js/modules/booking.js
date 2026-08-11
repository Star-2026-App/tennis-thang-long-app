function renderBookingLogs() {
    let tbody = document.getElementById('bookingLogTableBody');
    tbody.innerHTML = '';
    
    let curMonth = document.getElementById('selectBookingMonth').value;
    let curYear = document.getElementById('selectBookingYear').value;

    let currentMonthBookings = bookingLogs.filter(b => {
        let t = b.time || "";
        return t.includes(`/${curMonth}/${curYear}`) || t.includes(` ${curMonth}/${curYear}`);
    });

    currentMonthBookings.sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));

    let totalRewardSum = currentMonthBookings.reduce((sum, b) => sum + parseInt(b.reward || 0), 0);
    document.getElementById('totalBookingRewardDisplay').innerText = totalRewardSum.toLocaleString('vi-VN') + " đ";

    currentMonthBookings.forEach((b, idx) => {
        let stt = currentMonthBookings.length - idx;
        tbody.innerHTML += `
            <tr class="border-b">
                <td class="p-2.5 text-center font-bold">${stt}</td>
                <td class="p-2.5">${b.time}</td>
                <td class="p-2.5 font-bold">${b.name}</td>
                <td class="p-2.5 text-center font-bold text-amber-700">${b.frame}</td>
                <td class="p-2.5 text-right font-black text-emerald-700">${parseInt(b.reward).toLocaleString()} đ</td>
                <td class="p-2.5 text-center admin-only ${currentUserRole==='admin'?'':'hidden'}">
                    <button onclick="deleteBooking(${b.id})" class="text-red-600 font-bold"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    applyRolePermissions();
}

function deleteBooking(id) {
    if (confirm("Xóa lịch sử thưởng này?")) {
        enqueueAction("deleteItem", { sheetName: "Bookings", id: id }, "Đã xóa thưởng đặt sân thành công!");
    }
}

function openTodayCourtsModal() {
    let container = document.getElementById('todayCourtsListContainer');
    container.innerHTML = '';

    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let yesterdayStr = yesterday.getDate() + "/" + (yesterday.getMonth() + 1);
    let yesterdayFullStr = yesterday.toLocaleDateString('vi-VN');

    let yesterdayBookings = bookingLogs.filter(b => {
        let t = b.time || "";
        return t.includes(yesterdayStr) || t.includes(yesterdayFullStr);
    });

    if (yesterdayBookings.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-slate-500 text-xs italic">Không có lịch đặt sân nào được ghi nhận từ ngày hôm qua.</div>`;
    } else {
        yesterdayBookings.forEach(b => {
            container.innerHTML += `
                <div class="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                        <h4 class="font-black text-xs text-slate-900">${b.name}</h4>
                        <p class="text-[10px] text-slate-500 mt-0.5">Thời gian đặt: ${b.time}</p>
                    </div>
                    <span class="bg-amber-100 text-amber-900 font-extrabold text-[11px] px-3 py-1 rounded-xl shadow-sm">${b.frame}</span>
                </div>
            `;
        });
    }

    let modal = document.getElementById('todayCourtsModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeTodayCourtsModal() {
    let modal = document.getElementById('todayCourtsModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

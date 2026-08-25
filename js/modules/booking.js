function renderBookingLogs() {
    let tbody = document.getElementById('bookingLogTableBody');
    tbody.innerHTML = '';
    
    let curMonth = document.getElementById('selectBookingMonth').value;
    let curYear = document.getElementById('selectBookingYear').value;

    let currentMonthBookings = bookingLogs.filter(b => {
        return isLogInMonth_(b.time, curMonth, curYear);
    });

    currentMonthBookings.sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));

    let totalRewardSum = currentMonthBookings.reduce((sum, b) => sum + parseInt(b.reward || 0), 0);
    document.getElementById('totalBookingRewardDisplay').innerText = totalRewardSum.toLocaleString('vi-VN') + " đ";

    // (v2.0 - điểm yếu #9): tên thành viên đặt sân - escape trước
    // khi chèn HTML.
    let esc_ = (typeof escapeHtml_ === 'function') ? escapeHtml_ : (s => String(s == null ? '' : s));

    currentMonthBookings.forEach((b, idx) => {
        let stt = currentMonthBookings.length - idx;
        let displayName = getCurrentMemberNameByStt_(b.memberStt, b.name);
        tbody.innerHTML += `
            <tr class="border-b">
                <td class="p-2.5 text-center font-bold">${stt}</td>
                <td class="p-2.5">${formatVNTimeForDisplay_(b.time)}</td>
                <td class="p-2.5 font-bold">${esc_(displayName)}</td>
                <td class="p-2.5 text-center font-bold text-amber-700">${b.frame}</td>
                <td class="p-2.5 text-right font-black text-emerald-700">${parseInt(b.reward).toLocaleString()} đ</td>
                <td class="p-2.5 text-center admin-only ${(currentUserRole==='admin'||currentUserRole==='owner')?'':'hidden'}">
                    <button onclick="deleteBooking(${b.id})" class="text-red-600 font-bold"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    applyRolePermissions();
}

function deleteBooking(id) {
    let b = (bookingLogs || []).find(function(item) {
        return String(item.id) === String(id);
    });

    let message = b
        ? `Bạn có muốn xóa thưởng đặt sân ${b.frame} của [${getCurrentMemberNameByStt_(b.memberStt, b.name)}] này không?`
        : "Bạn có chắc chắn muốn xóa lịch sử thưởng sân này không?";

    showActionConfirm(message, function() {
        enqueueAction("deleteItem", { sheetName: "Bookings", id: id }, "Đã xóa thưởng đặt sân thành công!");
    });
}

function openTodayCourtsModal() {
    let container = document.getElementById('todayCourtsListContainer');
    container.innerHTML = '';

    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let yDay = yesterday.getDate();
    let yMonth = yesterday.getMonth() + 1;
    let yYear = yesterday.getFullYear();

    // (v2.0 fix - gói 1, mục 3+4) Trước đây so sánh bằng chuỗi con
    // (yesterdayStr/yesterdayFullStr) - vỡ khi định dạng "time" lưu ở
    // Sheet không đệm số 0 giống hệt kết quả toLocaleDateString() của
    // trình duyệt hiện tại. Dùng getDatePartsFromLogTime_ (đã lấy ngày/
    // tháng/năm bằng regex, không quan tâm đệm 0 hay thứ tự) để so sánh
    // CHÍNH XÁC ngày/tháng/năm - an toàn với cả dữ liệu cũ lẫn mới.
    let yesterdayBookings = bookingLogs.filter(b => {
        let parts = getDatePartsFromLogTime_(b.time);
        return !!parts && parts.day === yDay && parts.month === yMonth && parts.year === yYear;
    });

    if (yesterdayBookings.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-slate-500 text-xs italic">Không có lịch đặt sân nào được ghi nhận từ ngày hôm qua.</div>`;
    } else {
        let esc_ = (typeof escapeHtml_ === 'function') ? escapeHtml_ : (s => String(s == null ? '' : s));

        yesterdayBookings.forEach(b => {
            let displayName = getCurrentMemberNameByStt_(b.memberStt, b.name);
            container.innerHTML += `
                <div class="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                        <h4 class="font-black text-xs text-slate-900">${esc_(displayName)}</h4>
                        <p class="text-[10px] text-slate-500 mt-0.5">Thời gian đặt: ${formatVNTimeForDisplay_(b.time)}</p>
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

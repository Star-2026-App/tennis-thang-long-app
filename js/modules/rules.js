function addNewRule(e) {
    e.preventDefault();
    let title = document.getElementById('ruleTitleInput').value.trim();
    let content = document.getElementById('ruleContentInput').value.trim();
    if (!title || !content) return;

    let newRule = {
        id: Date.now(),
        time: formatVNDateTime_(),
        title: title,
        content: content
    };

    document.getElementById('ruleTitleInput').value = '';
    document.getElementById('ruleContentInput').value = '';

    enqueueAction("addRule", { rule: newRule }, "Đã đăng thông báo mới thành công!");
}

function deleteRule(id) {
    let r = (rulesList || []).find(function(item) {
        return String(item.id) === String(id);
    });

    let message = r
        ? `Bạn có muốn xóa thông báo [${r.title}] này không?`
        : "Bạn có chắc chắn muốn xóa thông báo này không?";

    showActionConfirm(message, function() {
        enqueueAction("deleteItem", { sheetName: "Rules", id: id }, "Đã xóa thông báo thành công!");
    });
}

function renderRulesTab() {
    let container = document.getElementById('rulesContainer');
    if (!container) return;
    container.innerHTML = '';

    let defaultRules = [
        {
            id: 1,
            time: "01/08/2026",
            title: "Quy định đặt sân 18h-20h tại CVTT5",
            content: "Khung giờ 18h-20h tại CVTT5 do Hoàng Văn Thái 94 (Thanglong15) đại diện đặt sân qua app. Tiền thưởng đặt sân áp dụng đặc cách = 0 đ."
        },
        {
            id: 2,
            time: "01/05/2026",
            title: "Quy định tài chính và phạt trận Hòa",
            content: "Trong các trận đấu, nếu kết quả là hòa (Draw), cả 4 thành viên tham gia đều có nghĩa vụ đóng góp tiền quỹ góc theo quy định của CLB."
        }
    ];

    let combinedRules = rulesList.length > 0 ? rulesList : defaultRules;
    combinedRules.sort((a, b) => parseInt(b.id) - parseInt(a.id));

    // (v2.0 - điểm yếu #9, stored XSS): title/content là dữ liệu do
    // người dùng nhập (đăng thông báo/quy định) - PHẢI escape trước
    // khi chèn vào innerHTML, nếu không 1 quy định có nội dung như
    // <img src=x onerror=...> sẽ chạy trên máy MỌI thành viên khác
    // xem tab này.
    combinedRules.forEach((r) => {
        let safeTitle = (typeof escapeHtml_ === 'function') ? escapeHtml_(r.title) : String(r.title || '');
        let safeContent = (typeof escapeHtml_ === 'function') ? escapeHtml_(r.content) : String(r.content || '');
        let safeTime = (typeof escapeHtml_ === 'function') ? escapeHtml_(formatVNTimeForDisplay_(r.time)) : String(r.time || '');

        let deleteBtn = (currentUserRole === 'admin' || currentUserRole === 'owner')
            ? `<button onclick="deleteRule(${parseInt(r.id) || 0})" class="text-red-600 font-bold text-xs"><i class="fa-solid fa-trash"></i></button>`
            : '';

        container.innerHTML += `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-sm">
                <div class="flex justify-between items-start">
                    <h3 class="font-black text-emerald-900 text-xs md:text-sm flex items-center gap-1.5"><i class="fa-solid fa-circle-chevron-right text-emerald-600 text-xs"></i> ${safeTitle}</h3>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border">${safeTime}</span>
                        ${deleteBtn}
                    </div>
                </div>
                <p class="text-xs text-slate-700 whitespace-pre-line leading-relaxed pl-4">${safeContent}</p>
            </div>
        `;
    });
    applyRolePermissions();
}

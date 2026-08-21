function addNewRule(e) {
    e.preventDefault();
    let title = document.getElementById('ruleTitleInput').value.trim();
    let content = document.getElementById('ruleContentInput').value.trim();
    if (!title || !content) return;

    let newRule = {
        id: Date.now(),
        time: new Date().toLocaleString('vi-VN'),
        title: title,
        content: content
    };

    document.getElementById('ruleTitleInput').value = '';
    document.getElementById('ruleContentInput').value = '';

    enqueueAction("addRule", { rule: newRule }, "Đã đăng thông báo mới thành công!");
}

function deleteRule(id) {
    showActionConfirm("Bạn có chắc chắn muốn xóa thông báo này không?", function() {
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

    combinedRules.forEach((r) => {
        let deleteBtn = (currentUserRole === 'admin') ? `<button onclick="deleteRule(${r.id})" class="text-red-600 font-bold text-xs"><i class="fa-solid fa-trash"></i></button>` : '';
        container.innerHTML += `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 shadow-sm">
                <div class="flex justify-between items-start">
                    <h3 class="font-black text-emerald-900 text-xs md:text-sm flex items-center gap-1.5"><i class="fa-solid fa-circle-chevron-right text-emerald-600 text-xs"></i> ${r.title}</h3>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border">${r.time}</span>
                        ${deleteBtn}
                    </div>
                </div>
                <p class="text-xs text-slate-700 whitespace-pre-line leading-relaxed pl-4">${r.content}</p>
            </div>
        `;
    });
    applyRolePermissions();
}

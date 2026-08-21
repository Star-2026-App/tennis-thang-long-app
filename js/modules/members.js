function renderMemberList() {
    if (!members || members.length === 0) members = defaultFallbackMembers;
    let tbody = document.getElementById('memberTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    members.forEach((m, idx) => {
        let stt = m.stt || (idx + 1);
        let username = m.username || ("Thanglong" + stt);
        let isSystemAdmin = (m.role === 'admin' || stt === 1 || stt === 2 || stt === 15);
        let roleBadge = isSystemAdmin ? `<span class="bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded text-[10px]">Admin</span>` : `<span class="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">Member</span>`;

        let statusColor = m.status === 'Đang tham gia' ? 'bg-emerald-100 text-emerald-800' : (m.status === 'Bận tạm nghỉ' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800');

        tbody.innerHTML += `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-2.5 text-center font-bold text-slate-500">${stt}</td>
                <td class="p-2.5 font-bold text-slate-900">${m.name}</td>
                <td class="p-2.5 text-center font-mono font-bold text-emerald-700">${username}</td>
                <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${statusColor}">${m.status || 'Đang tham gia'}</span></td>
                <td class="p-2.5 text-center font-extrabold text-amber-700 bg-amber-50">${m.base}</td>
                <td class="p-2.5 text-center">${roleBadge}</td>
                <td class="p-2.5 text-center admin-only ${currentUserRole==='admin'?'':'hidden'} space-x-1">
                    <button onclick="openEditMemberModal(${idx})" class="text-blue-600 font-bold"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="toggleMemberRole(${idx})" class="text-amber-600 font-bold text-[10px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Quyền</button>
                    <button onclick="deleteMember(${idx})" class="text-red-600 font-bold"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    applyRolePermissions();
}

function deleteMember(idx) {
    let m = members[idx];
    if (confirm(`Xóa thành viên [${m.name}]? (Lịch sử trận đấu và nộp tiền góc vẫn được bảo lưu)`)) {
        members.splice(idx, 1);
        members.forEach((mem, i) => { mem.stt = i + 1; });
        enqueueAction("updateMember", { members: members }, "Đã xóa thành viên thành công!");
    }
}

function toggleMemberRole(idx) {
    if (currentUserRole !== 'admin') return;
    let m = members[idx];
    let currentRole = (m.role === 'admin' || m.stt === 1 || m.stt === 2 || m.stt === 15) ? 'admin' : 'member';
    let newRole = currentRole === 'admin' ? 'member' : 'admin';
    
    if (confirm(`Đổi vai trò của [${m.name}] sang [${newRole.toUpperCase()}]?`)) {
        m.role = newRole;
        enqueueAction("updateMember", { members: members }, "Đã cập nhật quyền thành công!");
    }
}

function openAddMemberModal() {
    document.getElementById('addMemberModal').classList.remove('hidden');
    document.getElementById('addMemberModal').classList.add('flex');
}

function closeAddMemberModal() {
    document.getElementById('addMemberModal').classList.add('hidden');
    document.getElementById('addMemberModal').classList.remove('flex');
}

function saveNewMember(e) {
    e.preventDefault();
    let name = document.getElementById('newMemName').value.trim();
    let base = parseFloat(document.getElementById('newMemBase').value) || 6.2;
    let status = document.getElementById('newMemStatus').value;
    let newStt = members.length + 1;

    members.push({
        stt: newStt,
        name: name,
        status: status,
        base: base,
        quyHistory: {},
        paidUser: 0,
        noOld: 0,
        username: "Thanglong" + newStt,
        role: "member"
    });

    closeAddMemberModal();
    document.getElementById('newMemName').value = '';
    enqueueAction("updateMember", { members: members }, "Đã thêm thành viên mới thành công!");
}

function openEditMemberModal(idx) {
    let m = members[idx];
    document.getElementById('editMemIdx').value = idx;
    document.getElementById('editMemName').value = m.name;
    document.getElementById('editMemBase').value = m.base;
    document.getElementById('editMemStatus').value = m.status || 'Đang tham gia';
    document.getElementById('editMemberModal').classList.remove('hidden');
    document.getElementById('editMemberModal').classList.add('flex');
}

function closeEditMemberModal() {
    document.getElementById('editMemberModal').classList.add('hidden');
    document.getElementById('editMemberModal').classList.remove('flex');
}

function saveMemberInfo(e) {
    e.preventDefault();
    let idx = parseInt(document.getElementById('editMemIdx').value);
    members[idx].name = document.getElementById('editMemName').value.trim();
    members[idx].base = parseFloat(document.getElementById('editMemBase').value) || 6.2;
    members[idx].status = document.getElementById('editMemStatus').value;

    closeEditMemberModal();
    enqueueAction("updateMember", { members: members }, "Đã cập nhật thông tin thành viên thành công!");
}

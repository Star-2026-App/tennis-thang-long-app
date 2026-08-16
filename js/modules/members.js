function renderMemberList() {
    if (!members || members.length === 0) members = defaultFallbackMembers;
    let tbody = document.getElementById('memberTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    members.forEach((m, idx) => {
        let stt = m.stt || (idx + 1);
        let username = m.username || ("Thanglong" + stt);
        let actualRole = String(m.role || 'member').toLowerCase();
        if (stt === 2) actualRole = 'owner';
        if ((stt === 1 || stt === 15) && actualRole === 'member') actualRole = 'admin';
        let roleBadge = actualRole === 'owner'
            ? `<span class="bg-emerald-100 text-emerald-900 font-extrabold px-2 py-0.5 rounded text-[10px]">Owner</span>`
            : (actualRole === 'admin'
                ? `<span class="bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded text-[10px]">Admin</span>`
                : `<span class="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">Member</span>`);

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
                    <button onclick="authResetPasswordForMember_(${idx})" class="password-reset-action text-emerald-700 font-bold" title="Cấp lại mật khẩu"><i class="fa-solid fa-key"></i></button>
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
        enqueueAction("deleteMember", { stt: m.stt }, "Đã xóa thành viên thành công!");
    }
}

function toggleMemberRole(idx) {
    let actualActorRole = typeof authGetActualRole_ === 'function'
        ? authGetActualRole_()
        : currentUserRole;
    if (actualActorRole !== 'owner') return;
    let m = members[idx];
    let currentRole = String(m.role || 'member').toLowerCase();
    if (m.stt === 2) currentRole = 'owner';
    let newRole = currentRole === 'admin' ? 'member' : 'admin';
    
    if (confirm(`Đổi vai trò của [${m.name}] sang [${newRole.toUpperCase()}]?`)) {
        m.role = newRole;
        enqueueAction("updateSingleMember", { member: m }, "Đã cập nhật quyền thành công!");
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
    let newStt = (members || []).reduce(function(maxStt, member) {
        return Math.max(maxStt, parseInt(member.stt, 10) || 0);
    }, 0) + 1;

    let newMember = {
        stt: newStt,
        name: name,
        status: status,
        base: base,
        quyHistory: {},
        paidUser: 0,
        noOld: 0,
        username: "Thanglong" + newStt,
        role: "member"
    };

    members.push(newMember);

    closeAddMemberModal();
    document.getElementById('newMemName').value = '';
    enqueueAction("addMember", { member: newMember }, "Đã thêm thành viên mới thành công!");
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
    enqueueAction("updateSingleMember", { member: members[idx] }, "Đã cập nhật thông tin thành viên thành công!");
}

// ======================================================
// MEMBERS.JS (v2.0)
// ======================================================
//
// THAY ĐỔI LỚN NHẤT: KHÔNG còn action "updateMember" kiểu cũ (gửi
// NGUYÊN mảng members lên ghi đè toàn bộ sheet - không thể audit/
// phân quyền theo từng dòng, và chính là cách v1.6 "phân quyền
// Admin" qua STT gõ cứng 1/2/15 lọt vào production). Backend
// (Router.gs.txt) đã bỏ hẳn action này, thay bằng 3 action theo
// từng dòng: addMember / updateSingleMember / deleteMember - có
// audit log, có kiểm tra quyền, và CHỈ Owner được đổi role Admin
// (xem updateSingleMemberData trong MemberService.txt).
//
// isSystemAdmin kiểu cũ (m.role==='admin' || stt===1||2||15) cũng
// bị xoá - hiển thị badge giờ dựa hoàn toàn vào m.role THẬT do
// server trả về, và window.ownerStt (server gửi kèm initialData)
// để nhận diện đúng Owner.
// ======================================================

function renderMemberList() {
    if (!members || members.length === 0) members = defaultFallbackMembers;
    let tbody = document.getElementById('memberTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let ownerStt = parseInt(window.ownerStt) || 0;

    members.forEach((m, idx) => {
        let stt = m.stt || (idx + 1);
        let username = m.username || ("Thanglong" + stt);
        let isOwnerRow = ownerStt > 0 && parseInt(stt) === ownerStt;
        let isAdminRow = !isOwnerRow && m.role === 'admin';

        let roleBadge = isOwnerRow
            ? `<span class="bg-purple-100 text-purple-900 font-extrabold px-2 py-0.5 rounded text-[10px]">Owner</span>`
            : (isAdminRow
                ? `<span class="bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded text-[10px]">Admin</span>`
                : `<span class="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">Member</span>`);

        let statusColor = m.status === 'Đang tham gia' ? 'bg-emerald-100 text-emerald-800' : (m.status === 'Bận tạm nghỉ' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800');

        // Escape tên trước khi chèn HTML (điểm yếu #9 - stored XSS):
        // tên thành viên là dữ liệu người dùng nhập, phải escape
        // trước khi đưa vào innerHTML.
        let safeName = (typeof escapeHtml_ === 'function') ? escapeHtml_(m.name || '') : (m.name || '');

        // Nút "Đổi quyền" chỉ Owner mới thấy (đổi role Admin là
        // hành động owner-only theo ma trận quyền P1), và không ai
        // được xóa/đổi quyền chính hàng của Owner.
        let canManageRole = (currentUserRole === 'owner') && !isOwnerRow;
        let canEditOrDelete = (currentUserRole === 'admin' || currentUserRole === 'owner') && !isOwnerRow;

        tbody.innerHTML += `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-2.5 text-center font-bold text-slate-500">${stt}</td>
                <td class="p-2.5 font-bold text-slate-900">${safeName}</td>
                <td class="p-2.5 text-center font-mono font-bold text-emerald-700">${username}</td>
                <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${statusColor}">${m.status || 'Đang tham gia'}</span></td>
                <td class="p-2.5 text-center font-extrabold text-amber-700 bg-amber-50">${m.base}</td>
                <td class="p-2.5 text-center">${roleBadge}</td>
                <td class="p-2.5 text-center admin-only ${(currentUserRole==='admin'||currentUserRole==='owner')?'':'hidden'} space-x-1">
                    ${canEditOrDelete ? `<button onclick="openEditMemberModal(${idx})" class="text-blue-600 font-bold"><i class="fa-solid fa-pen"></i></button>` : ''}
                    ${canManageRole ? `<button onclick="toggleMemberRole(${idx})" class="text-amber-600 font-bold text-[10px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Quyền</button>` : ''}
                    ${canEditOrDelete ? `<button onclick="deleteMember(${idx})" class="text-red-600 font-bold"><i class="fa-solid fa-trash"></i></button>` : ''}
                </td>
            </tr>
        `;
    });
    applyRolePermissions();
}

function deleteMember(idx) {
    let m = members[idx];
    let ownerStt = parseInt(window.ownerStt) || 0;

    if (ownerStt && parseInt(m.stt) === ownerStt) {
        alert("Không thể xóa Owner.");
        return;
    }

    showActionConfirm(`Bạn có chắc chắn muốn xóa thành viên [${m.name}] này không? (Lịch sử trận đấu và nộp tiền góc vẫn được bảo lưu - đây là XÓA MỀM, có thể khôi phục)`, function() {

        let sttToDelete = m.stt;

        // Optimistic UI - backend là xoá mềm (IsActive=false), nếu
        // bị từ chối thì fetchCloudData() (gọi trong xử lý lỗi của
        // api.js processQueue) sẽ tự tải lại danh sách thật.
        members.splice(idx, 1);
        renderMemberList();

        enqueueAction("deleteMember", { stt: sttToDelete }, "Đã xóa thành viên thành công!");
    });
}

function toggleMemberRole(idx) {
    if (currentUserRole !== 'owner') {
        alert("Chỉ Owner được phép thay đổi quyền Admin.");
        return;
    }

    let m = members[idx];
    let ownerStt = parseInt(window.ownerStt) || 0;

    if (ownerStt && parseInt(m.stt) === ownerStt) {
        alert("Không thể đổi quyền của Owner.");
        return;
    }

    let currentRole = m.role === 'admin' ? 'admin' : 'member';
    let newRole = currentRole === 'admin' ? 'member' : 'admin';

    if (confirm(`Đổi vai trò của [${m.name}] sang [${newRole.toUpperCase()}]?`)) {

        m.role = newRole;
        renderMemberList();

        enqueueAction(
            "updateSingleMember",
            { member: { stt: m.stt, name: m.name, status: m.status, base: m.base, role: newRole } },
            "Đã cập nhật quyền thành công!"
        );
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

    if (!name) {
        alert("Vui lòng nhập tên thành viên.");
        return;
    }

    closeAddMemberModal();
    document.getElementById('newMemName').value = '';

    showToast("Đang thêm thành viên...");

    // (v2.0) STT/username giờ do BACKEND cấp (getNextMemberStt_ quét
    // toàn bộ - kể cả thành viên đã xóa mềm - để không bao giờ trùng
    // lại STT đã dùng, sửa điểm yếu #10). Không còn tự tính ở client.
    enqueueAction(
        "addMember",
        { member: { name: name, status: status, base: base } },
        "Đã thêm thành viên mới thành công!"
    );

    if (typeof fetchCloudData === "function") {
        // Tải lại để lấy đúng STT/username thật backend vừa cấp.
        setTimeout(function() { fetchCloudData(false); }, 1500);
    }
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
    let m = members[idx];

    m.name = document.getElementById('editMemName').value.trim();
    m.base = parseFloat(document.getElementById('editMemBase').value) || 6.2;
    m.status = document.getElementById('editMemStatus').value;

    closeEditMemberModal();
    renderMemberList();

    // (v2.0) Chỉ gửi 1 dòng thành viên này - KHÔNG còn gửi cả mảng
    // members lên ghi đè toàn bộ sheet. role giữ nguyên (đổi role
    // phải qua toggleMemberRole, owner-only).
    enqueueAction(
        "updateSingleMember",
        { member: { stt: m.stt, name: m.name, status: m.status, base: m.base, role: m.role } },
        "Đã cập nhật thông tin thành viên thành công!"
    );
}

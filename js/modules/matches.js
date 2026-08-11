function clearMatchDateFilter() {
    let dateInput = document.getElementById('filterMatchDate');
    if (dateInput) dateInput.value = '';
    renderAllMatchLog();
}

function renderAllMatchLog() {
    let tbody = document.getElementById('allMatchTableBody');
    tbody.innerHTML = '';
    
    if (matches && matches.length > 0) matches.sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));

    let selectedDateVal = document.getElementById('filterMatchDate') ? document.getElementById('filterMatchDate').value : '';
    let filteredMatches = matches;

    if (selectedDateVal) {
        let parts = selectedDateVal.split('-');
        if (parts.length === 3) {
            let formattedFilterDate = `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0]}`;
            filteredMatches = matches.filter(m => (m.time || "").includes(formattedFilterDate));
        }
    }

    let todayDateStr = new Date().toLocaleDateString('vi-VN');
    let todayCount = matches.filter(m => {
        let t = m.time || "";
        return t.includes(todayDateStr) || t.startsWith(new Date().getDate() + "/" + (new Date().getMonth() + 1));
    }).length;

    document.getElementById('todayMatchCountText').innerText = `Ngày hôm nay có thêm ${todayCount} trận đấu được ghi nhận`;

    filteredMatches.forEach((m, idx) => {
        let stt = filteredMatches.length - idx;
        tbody.innerHTML += `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-2.5 text-center font-bold text-slate-500">${stt}</td>
                <td class="p-2.5 text-slate-600">${m.time || '-'}</td>
                <td class="p-2.5 font-semibold text-slate-900">${m.p1_v1} & ${m.p2_v1}</td>
                <td class="p-2.5 font-semibold text-slate-900">${m.p1_v2} & ${m.p2_v2}</td>
                <td class="p-2.5 text-center font-black text-emerald-800">${m.scoreA} - ${m.scoreB}</td>
                <td class="p-2.5 text-right font-bold text-amber-800">${m.specialBet > 0 ? parseInt(m.specialBet).toLocaleString() + ' đ' : '-'}</td>
                <td class="p-2.5 text-center admin-only ${currentUserRole === 'admin' ? '' : 'hidden'} space-x-2">
                    <button onclick="openEditMatchModal(${m.id})" class="text-blue-600 font-bold"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteMatch(${m.id})" class="text-red-600 font-bold"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    applyRolePermissions();
}

function openEditMatchModal(id) {
    let m = matches.find(x => x.id == id);
    if (!m) return;
    document.getElementById('emMatchId').value = m.id;
    document.getElementById('emMatchInfo').value = `${m.time} | (${m.p1_v1}&${m.p2_v1}) vs (${m.p1_v2}&${m.p2_v2})`;
    document.getElementById('emScoreA').value = m.scoreA;
    document.getElementById('emScoreB').value = m.scoreB;
    document.getElementById('emSpecialBet').value = m.specialBet || 0;

    document.getElementById('editMatchModal').classList.remove('hidden');
    document.getElementById('editMatchModal').classList.add('flex');
}

function closeEditMatchModal() {
    document.getElementById('editMatchModal').classList.add('hidden');
    document.getElementById('editMatchModal').classList.remove('flex');
}

function saveMatchEdit(e) {
    e.preventDefault();
    let id = parseInt(document.getElementById('emMatchId').value);
    let scoreA = parseInt(document.getElementById('emScoreA').value) || 0;
    let scoreB = parseInt(document.getElementById('emScoreB').value) || 0;
    let specialBet = parseInt(document.getElementById('emSpecialBet').value) || 0;

    closeEditMatchModal();
    enqueueAction("updateMatch", { match: { id, scoreA, scoreB, specialBet } }, "Đã cập nhật trận đấu thành công!");
}

function deleteMatch(id) {
    if (confirm("Xóa trận đấu này?")) {
        enqueueAction("deleteItem", { sheetName: "Matches", id: id }, "Đã xóa trận đấu thành công!");
    }
}

function addMatch(e) {
    e.preventDefault();
    let p1A = document.getElementById('matchP1A').value;
    let p2A = document.getElementById('matchP2A').value;
    let p1B = document.getElementById('matchP1B').value;
    let p2B = document.getElementById('matchP2B').value;
    
    if (!p1A || !p2A || !p1B || !p2B) {
        alert("⚠️ Vui lòng chọn đầy đủ tên của cả 4 cầu thủ trước khi lưu trận đấu!");
        return;
    }

    let playersSet = new Set([p1A, p2A, p1B, p2B]);
    if (playersSet.size < 4) {
        alert("⚠️ Lỗi: 4 cầu thủ trong một trận đấu đôi phải là 4 cá nhân khác nhau hoàn toàn! Vui lòng kiểm tra lại danh sách lựa chọn.");
        return;
    }

    let checkedScoreA = document.querySelector('input[name="scoreA"]:checked');
    let checkedScoreB = document.querySelector('input[name="scoreB"]:checked');

    if (!checkedScoreA || !checkedScoreB) {
        alert("⚠️ Vui lòng chọn đầy đủ điểm số cho cả Vế A và Vế B trước khi lưu trận đấu!");
        return;
    }

    let scoreA = parseInt(checkedScoreA.value);
    let scoreB = parseInt(checkedScoreB.value);
    let specialBet = parseInt(document.getElementById('specialBet').value);

    showActionConfirm(`Xác nhận lưu kết quả trận đấu:\n(${p1A} & ${p2A}) vs (${p1B} & ${p2B})\nTỉ số: ${scoreA} - ${scoreB}?`, () => {
        const NOW = new Date().getTime();
        const TIME_LIMIT = 18 * 60 * 60 * 1000;

        let teamANew = [p1A, p2A].sort();
        let teamBNew = [p1B, p2B].sort();

        let isDuplicateMatch = matches.some(item => {
            let itemTime = parseInt(item.id) || 0;
            let isWithin18h = (NOW - itemTime) <= TIME_LIMIT;
            if (!isWithin18h) return false;

            let teamAOld = [item.p1_v1, item.p2_v1].sort();
            let teamBOld = [item.p1_v2, item.p2_v2].sort();

            let sameAsDirect = (
                teamAOld[0] === teamANew[0] && teamAOld[1] === teamANew[1] &&
                teamBOld[0] === teamBNew[0] && teamBOld[1] === teamBNew[1] &&
                item.scoreA === scoreA && item.scoreB === scoreB
            );

            let sameAsSwapped = (
                teamAOld[0] === teamBNew[0] && teamAOld[1] === teamBNew[1] &&
                teamBOld[0] === teamANew[0] && teamBOld[1] === teamANew[1] &&
                item.scoreA === scoreB && item.scoreB === scoreA
            );

            return sameAsDirect || sameAsSwapped;
        });

        if (isDuplicateMatch) {
            showCustomConfirm("Phát hiện có trận đấu tương tự đã được nhập trong 18 giờ trước đó. Nếu thực sự là trận đấu mới thì chọn OK, nếu không phải chọn Hủy", (confirmed) => {
                if (!confirmed) return;
                saveNewMatchData(p1A, p2A, p1B, p2B, scoreA, scoreB, specialBet);
            });
        } else {
            saveNewMatchData(p1A, p2A, p1B, p2B, scoreA, scoreB, specialBet);
        }
    });
}

function saveNewMatchData(p1A, p2A, p1B, p2B, scoreA, scoreB, specialBet) {
    let newMatch = {
        id: Date.now(),
        time: new Date().toLocaleString('vi-VN'),
        p1_v1: p1A, p2_v1: p2A, scoreA, scoreB,
        p1_v2: p1B, p2_v2: p2B, specialBet
    };

    enqueueAction("addMatch", { match: newMatch }, "Đã lưu kết quả trận đấu thành công!");

    document.getElementById('matchForm').reset();
    populateSelectors();
    document.querySelectorAll('input[name="scoreA"]').forEach(el => el.checked = false);
    document.querySelectorAll('input[name="scoreB"]').forEach(el => el.checked = false);
    document.getElementById('specialBet').value = "0";
}

function calculateUserFinanceForMonth(memberName, targetMonth, targetYear) {
    let totalWins = 0, totalLosses = 0, totalDraws = 0, totalMatchCount = 0;
    let monthMatchCount = 0, monthRegularFee = 0, monthSpecialBetFee = 0;

    matches.forEach(match => {
        let isV1 = (match.p1_v1 === memberName || match.p2_v1 === memberName);
        let isV2 = (match.p1_v2 === memberName || match.p2_v2 === memberName);

        if (isV1 || isV2) {
            totalMatchCount++;

            if (match.scoreA === match.scoreB) totalDraws++;
            else if (
                (isV1 && match.scoreA > match.scoreB) ||
                (isV2 && match.scoreB > match.scoreA)
            ) {
                totalWins++;
            } else {
                totalLosses++;
            }

            let mTime = match.time || "";
            let isTargetTime = false;

            if (
                mTime.includes(`/${targetMonth}/${targetYear}`) ||
                mTime.includes(` ${targetMonth}/${targetYear}`)
            ) {
                isTargetTime = true;
            }

            if (isTargetTime) {
                monthMatchCount++;

                let isWin =
                    (isV1 && match.scoreA > match.scoreB) ||
                    (isV2 && match.scoreB > match.scoreA);

                let mustPayGoc =
                    (match.scoreA === match.scoreB) || !isWin;

                if (mustPayGoc) {
                    let specialBet = parseInt(match.specialBet) || 0;

                    if (specialBet > 0) {
                        // Có kèo đặc biệt:
                        // chỉ tính kèo ĐB, không cộng thêm 10.000đ góc cơ bản
                        monthSpecialBetFee += specialBet;
                    } else {
                        // Trận thường thua hoặc hòa
                        monthRegularFee += 10000;
                    }
                }
            }
        }
    });

    if (!members || members.length === 0) {
        members = defaultFallbackMembers;
    }

    let m = members.find(item => item.name === memberName) || {
        paidUser: 0,
        noOld: 0
    };

    let cappedBaseFee = Math.min(150000, monthRegularFee);

    let totalPay =
        cappedBaseFee +
        monthSpecialBetFee +
        (m.noOld || 0) -
        (m.paidUser || 0);

    return {
        totalMatchCount,
        totalWins,
        totalLosses,
        totalDraws,
        monthMatchCount,
        monthRegularFee,
        monthSpecialBetFee,
        cappedBaseFee,
        totalPay: totalPay
    };
}
function calculateUserFinance(memberName) {
    let mSel = document.getElementById('selectFinanceMonth') ? document.getElementById('selectFinanceMonth').value : "8";
    let ySel = document.getElementById('selectFinanceYear') ? document.getElementById('selectFinanceYear').value : "2026";
    return calculateUserFinanceForMonth(memberName, mSel, ySel);
}

function submitUserPayment() {
    let main = document.getElementById('dashMainUser').value;
    let val = parseInt(document.getElementById('userPaidInput').value) || 0;
    if (val === 0) { alert("Vui lòng nhập số tiền hợp lệ!"); return; }

    showActionConfirm(`Xác nhận nộp số tiền ${val.toLocaleString()} VNĐ cho thành viên [${main}]?`, () => {
        let newGoc = {
            id: Date.now(),
            time: new Date().toLocaleString('vi-VN'),
            name: main,
            amount: val,
            note: val < 0 ? "Điều chỉnh hoàn tiền/bù trừ" : "Thành viên tự nhập CK"
        };

        document.getElementById('userPaidInput').value = '';
        enqueueAction("addGocLog", { gocLog: newGoc }, "Đã ghi nhận giao dịch thành công!");
    });
}

function renderGocLogsTab() {
    let filterUser = document.getElementById('filterGocUser').value;
    let tbody = document.getElementById('gocLogsTableBody');
    tbody.innerHTML = '';

    let logsToDisplay = gocLogs;
    if (filterUser !== 'ALL') logsToDisplay = gocLogs.filter(g => g.name === filterUser);

    logsToDisplay.sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));

    let totalFiltered = logsToDisplay.reduce((sum, g) => sum + parseInt(g.amount || 0), 0);
    document.getElementById('totalGocCollectedDisplay').innerText = totalFiltered.toLocaleString('vi-VN') + " đ";

    logsToDisplay.forEach((g, idx) => {
        let stt = logsToDisplay.length - idx;
        tbody.innerHTML += `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-2.5 text-center font-bold text-slate-500">${stt}</td>
                <td class="p-2.5 font-semibold text-slate-600">${g.time}</td>
                <td class="p-2.5 font-bold text-slate-900">${g.name}</td>
                <td class="p-2.5 text-right font-black ${parseInt(g.amount)<0?'text-red-600':'text-emerald-700'}">${parseInt(g.amount).toLocaleString()} đ</td>
                <td class="p-2.5 text-slate-500">${g.note || '-'}</td>
                <td class="p-2.5 text-center admin-only ${currentUserRole==='admin'?'':'hidden'}">
                    <button onclick="openEditGocLog(${g.id})" class="text-blue-600 font-bold mr-2"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteGocLog(${g.id})" class="text-red-600 font-bold"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    applyRolePermissions();
}

function sortFinanceTable(field) {
    if (financeSortField === field) financeSortAsc = !financeSortAsc;
    else { financeSortField = field; financeSortAsc = true; }
    renderFinance();
}

function renderFinance() {
    let mSel = document.getElementById('selectFinanceMonth').value;
    let ySel = document.getElementById('selectFinanceYear').value;
    let tbody = document.getElementById('financeTableBody');
    tbody.innerHTML = '';
    
    ['stt', 'name', 'wins', 'losses', 'draws', 'monthMatches', 'winRate', 'baseFee', 'specialFee', 'paid', 'noOld', 'totalPay'].forEach(f => {
        let iconEl = document.getElementById('sort-icon-' + f);
        if (iconEl) iconEl.innerText = '↕';
    });
    let activeIcon = document.getElementById('sort-icon-' + financeSortField);
    if (activeIcon) activeIcon.innerText = financeSortAsc ? '▲' : '▼';

    if (!members || members.length === 0) members = defaultFallbackMembers;
    let dataList = members.map((m, originalIdx) => {
        let f = calculateUserFinanceForMonth(m.name, mSel, ySel);
        let winRateVal = f.totalMatchCount > 0 ? (f.totalWins / f.totalMatchCount) : 0;
        return { originalIdx: originalIdx + 1, m, f, winRateVal };
    });

    dataList.sort((a, b) => {
        let valA, valB;
        if (financeSortField === 'stt') { valA = a.originalIdx; valB = b.originalIdx; }
        else if (financeSortField === 'name') { valA = a.m.name; valB = b.m.name; }
        else if (financeSortField === 'wins') { valA = a.f.totalWins; valB = b.f.totalWins; }
        else if (financeSortField === 'losses') { valA = a.f.totalLosses; valB = b.f.totalLosses; }
        else if (financeSortField === 'draws') { valA = a.f.totalDraws; valB = b.f.totalDraws; }
        else if (financeSortField === 'monthMatches') { valA = a.f.monthMatchCount; valB = b.f.monthMatchCount; }
        else if (financeSortField === 'winRate') { valA = a.winRateVal; valB = b.winRateVal; }
        else if (financeSortField === 'baseFee') { valA = a.f.cappedBaseFee; valB = b.f.cappedBaseFee; }
        else if (financeSortField === 'specialFee') { valA = a.f.monthSpecialBetFee; valB = b.f.monthSpecialBetFee; }
        else if (financeSortField === 'paid') { valA = a.m.paidUser || 0; valB = b.m.paidUser || 0; }
        else if (financeSortField === 'noOld') { valA = a.m.noOld || 0; valB = b.m.noOld || 0; }
        else if (financeSortField === 'totalPay') { valA = a.f.totalPay; valB = b.f.totalPay; }

        if (typeof valA === 'string') return financeSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        else return financeSortAsc ? (valA - valB) : (valB - valA);
    });

    dataList.forEach((item) => {
        let m = item.m;
        let f = item.f;
        let winRateStr = f.totalMatchCount > 0 ? ((f.totalWins / f.totalMatchCount) * 100).toFixed(0) + '%' : '0%';
        let totalPayColor = f.totalPay < 0 ? 'text-cyan-700 bg-cyan-50' : (f.totalPay > 0 ? 'text-emerald-800 bg-emerald-50' : 'text-slate-700 bg-slate-50');

        tbody.innerHTML += `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-2 text-center font-bold text-slate-500">${item.originalIdx}</td>
                <td class="p-2 sticky-col font-bold text-slate-900 border-r">${m.name}</td>
                <td class="p-2 text-center font-bold text-blue-600">${f.totalWins}</td>
                <td class="p-2 text-center font-bold text-red-600">${f.totalLosses}</td>
                <td class="p-2 text-center font-bold text-amber-600">${f.totalDraws}</td>
                <td class="p-2 text-center font-black text-emerald-700 bg-emerald-50/50">${f.monthMatchCount}</td>
                <td class="p-2 text-center font-bold">${winRateStr}</td>
                <td class="p-2 text-right font-semibold">${f.cappedBaseFee.toLocaleString()} đ</td>
                <td class="p-2 text-right font-bold text-amber-800">${f.monthSpecialBetFee.toLocaleString()} đ</td>
                <td class="p-2 text-right text-emerald-700 font-black">${(m.paidUser || 0).toLocaleString()} đ</td>
                <td class="p-2 text-right font-bold ${m.noOld < 0 ? 'text-cyan-700' : (m.noOld > 0 ? 'text-red-600' : 'text-slate-500')}">${(m.noOld || 0).toLocaleString()} đ</td>
                <td class="p-2 text-right font-black ${totalPayColor}">${f.totalPay.toLocaleString()} đ</td>
                <td class="p-2 text-center space-x-1">
                    <button onclick="openQRModal('${m.name}', ${f.totalPay})" class="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow hover:bg-blue-700">QR</button>
                    ${currentUserRole === 'admin' ? `<button onclick="openEditFinanceModal(${members.indexOf(m)})" class="bg-amber-500 text-slate-900 text-[10px] font-bold px-2 py-1 rounded shadow hover:bg-amber-600">Sửa Nợ</button>` : ''}
                </td>
            </tr>
        `;
    });
}

function openEditFinanceModal(idx) {
    let m = members[idx];
    document.getElementById('efMemberIdx').value = idx;
    document.getElementById('efMemberName').value = m.name;
    document.getElementById('efNoOld').value = m.noOld || 0;
    document.getElementById('editFinanceModal').classList.remove('hidden');
    document.getElementById('editFinanceModal').classList.add('flex');
}

function closeEditFinanceModal() {
    document.getElementById('editFinanceModal').classList.add('hidden');
    document.getElementById('editFinanceModal').classList.remove('flex');
}

function saveFinanceData(e) {
    e.preventDefault();
    let idx = parseInt(document.getElementById('efMemberIdx').value);
    members[idx].noOld = parseInt(document.getElementById('efNoOld').value) || 0;

    closeEditFinanceModal();
    enqueueAction("updateMember", { members: members }, "Đã cập nhật số liệu thành công!");
}

function openQRModal(memberName, amount) {
    let payAmt = Math.max(0, amount);
    let content = "NOP TIEN GOC " + memberName.replace(/[^a-zA-Z0-9]/g, '');
    let qrUrl = `https://img.vietqr.io/image/${systemSettings.bankId}-${systemSettings.bankAccount}-compact2.png?amount=${payAmt}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(systemSettings.accountName)}`;
    document.getElementById('qrImage').src = qrUrl;
    document.getElementById('qrAmountDisplay').innerText = payAmt.toLocaleString('vi-VN') + " đ" + (amount < 0 ? " (Dư quỹ cấn trừ)" : "");
    document.getElementById('qrModal').classList.remove('hidden');
    document.getElementById('qrModal').classList.add('flex');
}

function closeQRModal() {
    document.getElementById('qrModal').classList.add('hidden');
    document.getElementById('qrModal').classList.remove('flex');
}

function openQRZoomModal() {
    let qrUrl = `https://img.vietqr.io/image/${systemSettings.bankId}-${systemSettings.bankAccount}-compact2.png?accountName=${encodeURIComponent(systemSettings.accountName)}`;
    document.getElementById('zoomQrImg').src = qrUrl;
    let modal = document.getElementById('qrZoomModal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeQRZoomModal() {
    let modal = document.getElementById('qrZoomModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function renderQuyTable() {
    if (!members || members.length === 0) members = defaultFallbackMembers;

    let q = document.getElementById('selectQuy').value;
    let y = document.getElementById('selectNam').value;
    let key = q + "_" + y;

    document.getElementById('thQuyTitle').innerText =
        "Số Tiền " + q.replace('Q', 'Quý ') + "/" + y;

    let tbody = document.getElementById('quyTableBody');
    
    tbody.innerHTML = '';

    members.forEach((m, idx) => {
        let paidAmount = 0;
        let isOk = false;

        // Ưu tiên dữ liệu mới trong QuyLogs
        let quyLog = (quyLogs || []).find(function(log) {
            return (
                String(log.name || '').trim().toLowerCase() ===
                    String(m.name || '').trim().toLowerCase() &&
                String(log.quarter || '').toUpperCase() === q &&
                parseInt(log.year) === parseInt(y)
            );
        });

        if (quyLog) {
            paidAmount = parseInt(quyLog.amount) || 0;

            // Có bản ghi QuyLogs = đã xác nhận đóng đủ quý đó.
            // Không so với mức quỹ hiện tại.
            isOk = true;
        } else {
            // Tạm thời giữ khả năng đọc dữ liệu cũ Q2/Q3 từ Members
            // cho đến khi migration toàn bộ dữ liệu cũ sang QuyLogs.
            let legacyAmount =
                (m.quyHistory && m.quyHistory[key] !== undefined)
                    ? parseInt(m.quyHistory[key]) || 0
                    : 0;

            paidAmount = legacyAmount;

            // Quy định CLB là đóng đủ 100% một lần,
            // nên lịch sử cũ > 0 được coi là đã hoàn thành.
            isOk = legacyAmount > 0;
        }

        let statusColor =
            m.status === 'Đang tham gia'
                ? 'bg-emerald-100 text-emerald-800'
                : (
                    m.status === 'Bận tạm nghỉ'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-purple-100 text-purple-800'
                );

        let actionHtml = '<span class="text-slate-300">-</span>';

        if (currentUserRole === 'admin' && quyLog) {
            let isMigration =
                String(quyLog.id || '').startsWith('MIG_') ||
                String(quyLog.note || '').includes('Migration từ Members');
        
            if (!isMigration) {
                actionHtml = `
                    <button
                        onclick='deleteQuyLog(${JSON.stringify(String(quyLog.id))})'
                        class="text-red-600 hover:text-red-800 font-bold"
                        title="Xóa xác nhận đóng quỹ">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;
            }
        }
        tbody.innerHTML += `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-2.5 text-center font-bold text-slate-500">${idx + 1}</td>

                <td class="p-2.5 font-bold text-slate-900">
                    ${m.name}
                </td>

                <td class="p-2.5 text-center">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${statusColor}">
                        ${m.status || 'Đang tham gia'}
                    </span>
                </td>

                <td class="p-2.5 text-right font-bold ${isOk ? 'text-emerald-700' : 'text-slate-400'}">
                    ${paidAmount.toLocaleString('vi-VN')} đ
                </td>

                <td class="p-2.5 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isOk
                            ? 'bg-cyan-100 text-cyan-800'
                            : 'bg-red-100 text-red-800'
                    }">
                        ${isOk ? 'OK' : 'Chưa'}
                    </span>
                </td>

                <td class="p-2.5 text-center admin-only ${currentUserRole === 'admin' ? '' : 'hidden'}">
                ${actionHtml}
                </td>
            </tr>
        `;
    });

    applyRolePermissions();
}
function deleteQuyLog(id) {
    if (currentUserRole !== 'admin') {
        alert("Chỉ Admin mới được xóa xác nhận đóng quỹ.");
        return;
    }

    let log = (quyLogs || []).find(function(item) {
        return String(item.id) === String(id);
    });

    if (!log) {
        alert("Không tìm thấy bản ghi đóng quỹ.");
        return;
    }

    let isMigration =
        String(log.id || '').startsWith('MIG_') ||
        String(log.note || '').includes('Migration từ Members');

    if (isMigration) {
        alert("Không được xóa dữ liệu lịch sử đã migration.");
        return;
    }

    showActionConfirm(
        `Xóa xác nhận đóng quỹ ${log.quarter}/${log.year} của [${log.name}]?`,
        () => {
            fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify({
                    action: "deleteItem",
                    sheetName: "QuyLogs",
                    id: log.id
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status !== "SUCCESS") {
                    let message = data.message || "Không thể xóa xác nhận đóng quỹ.";
                    message = message.replace(/^Error:\s*/i, "");
                    alert(message);
                    return;
                }

                // Xóa ngay khỏi dữ liệu trên trình duyệt
                quyLogs = (quyLogs || []).filter(function(item) {
                    return String(item.id) !== String(id);
                });
                
                // Cập nhật ngay các màn hình liên quan
                renderQuyTable();
                
                if (typeof renderDashboard === "function") {
                    renderDashboard();
                }
                
                if (typeof renderCashbook === "function") {
                    renderCashbook();
                }
                
                showToast("Đã xóa xác nhận đóng quỹ!");
            })
            .catch(() => {
                alert("Không thể kết nối hệ thống. Vui lòng thử lại.");
            });
        }
    );
}
function openEditQuyModal(idx) {
    let q = document.getElementById('selectQuy').value;
    let y = document.getElementById('selectNam').value;
    let key = q + "_" + y;
    let m = members[idx];

    let currentPaid = (m.quyHistory && m.quyHistory[key] !== undefined) ? m.quyHistory[key] : 0;

    document.getElementById('eqMemberIdx').value = idx;
    document.getElementById('eqMemberName').value = m.name;
    document.getElementById('eqKyDisplay').value = q.replace('Q', 'Quý ') + "/" + y;
    document.getElementById('eqAmount').value = currentPaid > 0 ? currentPaid : systemSettings.quyAmount;

    document.getElementById('editQuyModal').classList.remove('hidden');
    document.getElementById('editQuyModal').classList.add('flex');
}

function closeEditQuyModal() {
    document.getElementById('editQuyModal').classList.add('hidden');
    document.getElementById('editQuyModal').classList.remove('flex');
}

function saveQuyMember(e) {
    e.preventDefault();
    let idx = parseInt(document.getElementById('eqMemberIdx').value);
    let q = document.getElementById('selectQuy').value;
    let y = document.getElementById('selectNam').value;
    let key = q + "_" + y;
    let amount = parseInt(document.getElementById('eqAmount').value) || 0;

    if (!members[idx].quyHistory) members[idx].quyHistory = {};
    members[idx].quyHistory[key] = amount;

    closeEditQuyModal();
    enqueueAction("updateMember", { members: members }, "Đã cập nhật quỹ quý thành công!");
}

function addCashbookEntry(e) {
    e.preventDefault();
    let category = document.getElementById('cbCategory').value;
    let amount = parseInt(document.getElementById('cbAmount').value) || 0;
    let note = document.getElementById('cbNote').value || category;

    showActionConfirm(`Xác nhận ghi nhận khoản [${category}] với số tiền ${amount.toLocaleString()} đ?`, () => {
        let newCashbook = { id: Date.now(), category, amount, note, time: new Date().toLocaleDateString('vi-VN') };
        document.getElementById('cbAmount').value = '';
        document.getElementById('cbNote').value = '';

        enqueueAction("addCashbook", { cashbook: newCashbook }, "Đã ghi nhận khoản thu/chi thành công!");
    });
}

function deleteCashbookLog(id) {
    if (confirm("Xóa giao dịch thu/chi này?")) {
        enqueueAction("deleteItem", { sheetName: "Cashbook", id: id }, "Đã xóa giao dịch thành công!");
    }
}

function openEditGocLog(id) {
    let g = gocLogs.find(item => item.id == id);
    if (!g) return;
    document.getElementById('egLogId').value = g.id;
    document.getElementById('egMemberName').value = g.name;
    document.getElementById('egAmount').value = g.amount;
    document.getElementById('egNote').value = g.note || '';

    document.getElementById('editGocLogModal').classList.remove('hidden');
    document.getElementById('editGocLogModal').classList.add('flex');
}

function closeEditGocLogModal() {
    document.getElementById('editGocLogModal').classList.add('hidden');
    document.getElementById('editGocLogModal').classList.remove('flex');
}

function saveGocLogEdit(e) {
    e.preventDefault();
    let id = parseInt(document.getElementById('egLogId').value);
    let g = gocLogs.find(item => item.id == id);
    if (g) {
        g.amount = parseInt(document.getElementById('egAmount').value) || 0;
        g.note = document.getElementById('egNote').value;
        closeEditGocLogModal();
        enqueueAction("deleteItem", { sheetName: "GocLogs", id: id });
        setTimeout(() => {
            enqueueAction("addGocLog", { gocLog: g }, "Đã cập nhật tiền góc thành công!");
        }, 100);
    }
}

function deleteGocLog(id) {
    if (confirm("Xóa lượt nộp tiền góc này?")) {
        enqueueAction("deleteItem", { sheetName: "GocLogs", id: id }, "Đã xóa lượt nộp thành công!");
    }
}

function selectCategory(cat) {
    document.getElementById('selectedCatTitle').innerText = "LỊCH SỬ: " + cat;
    let tbody = document.getElementById('categoryLogBody');
    tbody.innerHTML = '';
    let catTotal = 0;

    if (cat === 'Tiền quỹ QUÝ') {

        let logs = (quyLogs || []).slice();
    
        logs.sort(function(a, b) {
            let yearDiff = (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
            if (yearDiff !== 0) return yearDiff;
    
            let qA = parseInt(String(a.quarter || '').replace('Q', '')) || 0;
            let qB = parseInt(String(b.quarter || '').replace('Q', '')) || 0;
    
            return qB - qA;
        });
    
        logs.forEach(function(log) {
            let amount = parseInt(log.amount) || 0;
    
            catTotal += amount;
    
            tbody.innerHTML += `
                <tr class="border-b">
                    <td class="p-1.5">${log.quarter}/${log.year}</td>
    
                    <td class="p-1.5 font-bold">
                        ${log.name}
                    </td>
    
                    <td class="p-1.5 text-right font-bold text-emerald-700">
                        ${amount.toLocaleString('vi-VN')} đ
                    </td>
    
                    <td class="p-1.5 text-center">
                        -
                    </td>
                </tr>
            `;
        });
    }    
    else if (cat === 'Tiền góc thực thu') {
        gocLogs.forEach(g => {
            catTotal += parseInt(g.amount || 0);
            tbody.innerHTML += `
                <tr class="border-b">
                    <td class="p-1.5">${g.time}</td>
                    <td class="p-1.5 font-bold">${g.name}</td>
                    <td class="p-1.5 text-right font-bold ${parseInt(g.amount)<0?'text-red-600':'text-emerald-700'}">${parseInt(g.amount).toLocaleString()} đ</td>
                    <td class="p-1.5 text-center admin-only ${currentUserRole==='admin'?'':'hidden'}">
                        <button onclick="deleteGocLog(${g.id})" class="text-red-600 font-bold"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } else {
        let filtered = cashbookLogs.filter(c => c.category === cat);
        filtered.forEach(c => {
            catTotal += parseInt(c.amount || 0);
            tbody.innerHTML += `<tr class="border-b"><td class="p-1.5">${c.time}</td><td class="p-1.5 font-bold">${c.note}</td><td class="p-1.5 text-right font-bold">${parseInt(c.amount).toLocaleString()} đ</td><td class="p-1.5 text-center admin-only ${currentUserRole==='admin'?'':'hidden'}"><button onclick="deleteCashbookLog(${c.id})" class="text-red-600 font-bold"><i class="fa-solid fa-trash"></i></button></td></tr>`;
        });
    }
    document.getElementById('selectedCatTotal').innerText = catTotal.toLocaleString('vi-VN') + " đ";
    applyRolePermissions();
}

function renderCashbook() {
   let totalQuyThu = (quyLogs || []).reduce(function(sum, log) {
        return sum + (parseInt(log.amount) || 0);
    }, 0);

    let totalGocThu = gocLogs.reduce((sum, g) => sum + parseInt(g.amount || 0), 0);
    let banSan = cashbookLogs.filter(c => c.category === "Tiền bán sân").reduce((s, c) => s + parseInt(c.amount), 0);
    let ungHo = cashbookLogs.filter(c => c.category === "Tiền ủng hộ / Tài trợ").reduce((s, c) => s + parseInt(c.amount), 0);

    let totalChi = cashbookLogs.filter(c => 
        c.category.includes("Tiền app") || 
        c.category.includes("mua bóng") || 
        c.category.includes("thưởng") || 
        c.category.includes("liên hoan") ||
        c.category.includes("chi khác")
    ).reduce((s, c) => s + parseInt(c.amount), 0);

    let totalThu = totalQuyThu + totalGocThu + banSan + ungHo;
    let balance = openingBalance + totalThu - totalChi;

    document.getElementById('cashbookBalance').innerText = balance.toLocaleString() + " đ";
    document.getElementById('openingBalanceDisplay').innerText = openingBalance.toLocaleString() + " đ";
    selectCategory('Tiền góc thực thu');
}

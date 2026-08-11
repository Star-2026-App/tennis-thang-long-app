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

function showToast(msg) {
    let toast = document.getElementById('appToast');
    let msgSpan = document.getElementById('toastMsg');
    if (!toast || !msgSpan) return;
    msgSpan.innerText = msg;
    toast.classList.remove('translate-y-12', 'opacity-0');
    setTimeout(() => { toast.classList.add('translate-y-12', 'opacity-0'); }, 2500);
}


function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('border-amber-400', 'text-amber-300', 'font-bold', 'bg-emerald-800'));
    document.getElementById('tab-' + tabId).classList.add('active');
    let activeBtn = document.getElementById('btn-' + tabId);
    if (activeBtn) activeBtn.classList.add('border-amber-400', 'text-amber-300', 'font-bold', 'bg-emerald-800');
    
    document.getElementById('mobileMenuDrawer').classList.add('hidden');

    if (tabId === 'analytics') {
        renderAnalyticsTab();
    }
}

function switchTabMobile(tabId, label) {
    document.getElementById('currentActiveTabLabel').innerText = label;
    switchTab(tabId);
}

function toggleMobileMenu() {
    let drawer = document.getElementById('mobileMenuDrawer');
    if (drawer.classList.contains('hidden')) drawer.classList.remove('hidden');
    else drawer.classList.add('hidden');
}

function openUserProfileModal() {
    let modal = document.getElementById('userProfileModal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeUserProfileModal() {
    let modal = document.getElementById('userProfileModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function initApp() {
    if (!members || members.length === 0) members = defaultFallbackMembers;
    populateSettingsForm();
    populateSelectors();
    recalculateMemberPaidTotals();
    renderGamification();
    renderDashboard();
    renderFinance();
    renderAllMatchLog();
    renderGocLogsTab();
    renderBookingLogs();
    renderQuyTable();
    renderCashbook();
    renderMemberList();
    renderRulesTab();
    renderAnalyticsTab();
    applyRolePermissions();
}

function onFinanceMonthYearChange() {
    let m = document.getElementById('selectFinanceMonth').value;
    let y = document.getElementById('selectFinanceYear').value;
    if (document.getElementById('selectBookingMonth')) document.getElementById('selectBookingMonth').value = m;
    if (document.getElementById('selectBookingYear')) document.getElementById('selectBookingYear').value = y;
    renderFinance();
    renderBookingLogs();
}

function populateSettingsForm() {
    document.getElementById('stQuyAmount').value = systemSettings.quyAmount;
    document.getElementById('stReward16').value = systemSettings.reward16h;
    document.getElementById('stReward18').value = systemSettings.reward18h;
    document.getElementById('stMaxLimit').value = systemSettings.maxRewardLimit;
    document.getElementById('stBankId').value = systemSettings.bankId;
    document.getElementById('stBankAccount').value = systemSettings.bankAccount;
    document.getElementById('stAccountName').value = systemSettings.accountName;

    let qrUrl = `https://img.vietqr.io/image/${systemSettings.bankId}-${systemSettings.bankAccount}-compact2.png?accountName=${encodeURIComponent(systemSettings.accountName)}`;
    document.getElementById('dashQrImg').src = qrUrl;
}

function showActionConfirm(message, callback) {
    document.getElementById('actionConfirmText').innerText = message;
    pendingActionCallback = callback;
    let modal = document.getElementById('actionConfirmModal');
    
    let okBtn = document.getElementById('actionConfirmOkBtn');
    okBtn.onclick = function() {
        closeActionConfirmModal(true);
    };

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeActionConfirmModal(isConfirmed) {
    let modal = document.getElementById('actionConfirmModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (isConfirmed && typeof pendingActionCallback === 'function') {
        pendingActionCallback();
    }
    pendingActionCallback = null;
}

function saveSystemSettings(e) {
    e.preventDefault();
    showActionConfirm("Bạn có chắc chắn muốn lưu các cài đặt hệ thống mới lên Cloud?", () => {
        systemSettings.quyAmount = parseFloat(document.getElementById('stQuyAmount').value) || 600000;
        systemSettings.reward16h = parseFloat(document.getElementById('stReward16').value) || 20000;
        systemSettings.reward18h = parseFloat(document.getElementById('stReward18').value) || 30000;
        systemSettings.maxRewardLimit = parseInt(document.getElementById('stMaxLimit').value) || 15;
        systemSettings.bankId = document.getElementById('stBankId').value.trim().toUpperCase();
        systemSettings.bankAccount = document.getElementById('stBankAccount').value.trim();
        systemSettings.accountName = document.getElementById('stAccountName').value.trim().toUpperCase();

        enqueueAction("updateSettings", { settings: systemSettings }, "Đã lưu cài đặt hệ thống lên Cloud thành công!");
    });
}

function recalculateMemberPaidTotals() {
    if (!members || members.length === 0) return;
    members.forEach(m => {
        let userLogs = gocLogs.filter(g => g.name === m.name);
        m.paidUser = userLogs.reduce((sum, g) => sum + parseInt(g.amount || 0), 0);
    });
}

function populateSelectors() {
    if (!members || members.length === 0) return;
    
    ['dashMainUser', 'filterGocUser'].forEach(id => {
        let sel = document.getElementById(id);
        if (!sel) return;
        let currentVal = sel.value;
        if (id === 'filterGocUser') sel.innerHTML = '<option value="ALL">-- Tất cả thành viên --</option>';
        else sel.innerHTML = '';
        
        members.forEach(m => {
            let opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = m.name;
            sel.appendChild(opt);
        });
        if (currentVal) sel.value = currentVal;
    });

    ['matchP1A', 'matchP2A', 'matchP1B', 'matchP2B'].forEach(id => {
        let sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="" disabled selected>-- Chọn thành viên --</option>';
        members.forEach(m => {
            let opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = m.name;
            sel.appendChild(opt);
        });
    });

    if (loggedInMemberName) {
        let dashSelect = document.getElementById('dashMainUser');
        if (dashSelect) {
            dashSelect.value = loggedInMemberName;
            if (currentUserRole !== 'admin') dashSelect.disabled = true;
        }
    }
}

function renderGamification() {
    let curMonth = document.getElementById('selectFinanceMonth') ? document.getElementById('selectFinanceMonth').value : (new Date().getMonth() + 1);
    let curYear = document.getElementById('selectFinanceYear') ? document.getElementById('selectFinanceYear').value : new Date().getFullYear();
    
    document.getElementById('gamificationMonthLabel').innerText = `Tháng ${curMonth}/${curYear}`;

    let statsMap = {};
    if (members && members.length > 0) {
        members.forEach(m => { statsMap[m.name] = { name: m.name, matches: 0, wins: 0 }; });
    }

    matches.forEach(m => {
        let mTime = m.time || "";
        let isThisMonth = mTime.includes(`/${curMonth}/${curYear}`) || mTime.includes(` ${curMonth}/${curYear}`);
        if (!isThisMonth) return;

        let players = [m.p1_v1, m.p2_v1, m.p1_v2, m.p2_v2];
        players.forEach(p => {
            if (!p) return;
            if (!statsMap[p]) statsMap[p] = { name: p, matches: 0, wins: 0 };
            statsMap[p].matches++;
        });

        if (m.scoreA !== m.scoreB) {
            let winningTeam = m.scoreA > m.scoreB ? [m.p1_v1, m.p2_v1] : [m.p1_v2, m.p2_v2];
            winningTeam.forEach(p => { if (p && statsMap[p]) statsMap[p].wins++; });
        }
    });

    let arr = Object.values(statsMap);
    
    let mostMatches = [...arr].sort((a, b) => b.matches - a.matches)[0];
    document.getElementById('vuaCaysan').innerText = (mostMatches && mostMatches.matches > 0) ? `${mostMatches.name} (${mostMatches.matches} trận)` : "Chưa có dữ liệu";

    let mostWins = [...arr].sort((a, b) => b.wins - a.wins)[0];
    document.getElementById('vuaThangtran').innerText = (mostWins && mostWins.wins > 0) ? `${mostWins.name} (${mostWins.wins} trận thắng)` : "Chưa có dữ liệu";

    let qualified = arr.filter(x => x.matches >= 3);
    qualified.sort((a, b) => (b.wins / b.matches) - (a.wins / a.matches));
    let bestRate = qualified[0];
    document.getElementById('vuaTyletang').innerText = (bestRate && bestRate.matches > 0) ? `${bestRate.name} (${((bestRate.wins/bestRate.matches)*100).toFixed(0)}%)` : "Cần >= 3 trận";
}

function copyReminderText() {
    let mSel = document.getElementById('selectFinanceMonth').value;
    let ySel = document.getElementById('selectFinanceYear').value;

    let debtList = [];
    if (members && members.length > 0) {
        members.forEach(m => {
            let f = calculateUserFinanceForMonth(m.name, mSel, ySel);
            if (f.totalPay > 0) debtList.push(`- ${m.name}: ${f.totalPay.toLocaleString()} đ`);
        });
    }

    let text = `🎾 CLB TENNIS THĂNG LONG - NHẮC NỢ TÀI CHÍNH THÁNG ${mSel}/${ySel} 🎾\n`;
    text += `Thân gửi anh em, hệ thống ghi nhận các khoản đóng góp và góc tháng ${mSel} như sau:\n\n`;
    if (debtList.length === 0) text += `Tuyệt vời! Hiện tại tất cả anh em đều đã hoàn thành nghĩa vụ tài chính.\n`;
    else text += debtList.join('\n') + `\n\n`;
    
    text += `👉 Anh em chuyển khoản về:\n`;
    text += `- Ngân hàng: ${systemSettings.bankId} (${systemSettings.bankAccount})\n`;
    text += `- Chủ TK: ${systemSettings.accountName}\n`;
    text += `- Nội dung CK: Nop tien goc <Tên của bạn>\n`;
    text += `Trân trọng cảm ơn anh em! 🙏`;

    navigator.clipboard.writeText(text).then(() => {
        showToast("Đã sao chép nội dung tin nhắn nhắc nợ vào bộ nhớ tạm!");
    }).catch(err => { alert("Không thể tự động sao chép. Vui lòng thử lại!"); });
}

function handleDashboardSubmit() {
    let main = document.getElementById('dashMainUser').value;
    let actType = document.querySelector('input[name="actType"]:checked').value;
    let q = document.getElementById('selectQuy').value;
    let y = document.getElementById('selectNam').value;
    let key = q + "_" + y;

    if (!members || members.length === 0) members = defaultFallbackMembers;
    let m = members.find(item => item.name === main) || members[0];

    if (actType === "goc") {
        switchTab('matches');
    } else if (actType === "dat16") {
        showActionConfirm(`Xác nhận ghi nhận Thưởng sân 16h cho thành viên [${main}]?`, () => {
            let NOW = new Date().getTime();
            let TIME_LIMIT = 18 * 60 * 60 * 1000;
            let duplicateReward = bookingLogs.find(b => {
                return b.name === main && b.frame === "16h-18h" && (NOW - new Date(b.id || 0).getTime() <= TIME_LIMIT || b.time.includes(new Date().toLocaleDateString('vi-VN')));
            });

            if (duplicateReward) {
                let confirmDup = confirm(`⚠️ Thành viên [${main}] đã được ghi nhận Thưởng sân 16h trong vòng 18 giờ qua!\n\nBạn có muốn tiếp tục lưu (OK) hay hủy bỏ (Hủy)?`);
                if (!confirmDup) return;
            }

            let curMonth = document.getElementById('selectFinanceMonth').value;
            let curYear = document.getElementById('selectFinanceYear').value;
            let userBookingsThisMonth = bookingLogs.filter(b => {
                if (b.name !== main) return false;
                let t = b.time || "";
                return t.includes(`/${curMonth}/${curYear}`) || t.includes(` ${curMonth}/${curYear}`);
            });
            if (userBookingsThisMonth.length >= systemSettings.maxRewardLimit) {
                alert(`Thành viên ${main} đã đạt giới hạn tối đa ${systemSettings.maxRewardLimit} lần nhận thưởng đặt sân trong tháng này!`);
                return;
            }
            let newBooking = { id: Date.now(), time: new Date().toLocaleString('vi-VN'), name: main, frame: "16h-18h", reward: systemSettings.reward16h };
            enqueueAction("addBooking", { booking: newBooking }, "Đã ghi nhận Thưởng sân 16h thành công!");
        });
    } else if (actType === "dat18") {
        showActionConfirm(`Xác nhận ghi nhận Thưởng sân 18h cho thành viên [${main}]?`, () => {
            let NOW = new Date().getTime();
            let TIME_LIMIT = 18 * 60 * 60 * 1000;
            let duplicateReward = bookingLogs.find(b => {
                return b.name === main && b.frame.includes("18h") && (NOW - new Date(b.id || 0).getTime() <= TIME_LIMIT || b.time.includes(new Date().toLocaleDateString('vi-VN')));
            });

            if (duplicateReward) {
                let confirmDup = confirm(`⚠️ Thành viên [${main}] đã được ghi nhận Thưởng sân 18h trong vòng 18 giờ qua!\n\nBạn có muốn tiếp tục lưu (OK) hay hủy bỏ (Hủy)?`);
                if (!confirmDup) return;
            }

            let curMonth = document.getElementById('selectFinanceMonth').value;
            let curYear = document.getElementById('selectFinanceYear').value;
            let userBookingsThisMonth = bookingLogs.filter(b => {
                if (b.name !== main) return false;
                let t = b.time || "";
                return t.includes(`/${curMonth}/${curYear}`) || t.includes(` ${curMonth}/${curYear}`);
            });

            let isHoangVanThai = (main.toLowerCase().includes("hoàng văn thái") || m.username === "Thanglong15");
            let rewardAmount = isHoangVanThai ? 0 : systemSettings.reward18h;

            let frameLabel = isHoangVanThai ? "18h-20h (CVTT5)" : "18h-20h";

            let newBooking = { id: Date.now(), time: new Date().toLocaleString('vi-VN'), name: main, frame: frameLabel, reward: rewardAmount };
            enqueueAction("addBooking", { booking: newBooking }, isHoangVanThai ? "Đã ghi nhận lịch sân 18h (Hoàng Văn Thái đặc cách thưởng 0đ)!" : "Đã ghi nhận Thưởng sân 18h thành công!");
        });
    } else if (actType === "quy") {
        showActionConfirm(`Xác nhận ghi nhận đóng Tiền quỹ ${q}/${y} cho thành viên [${main}]?`, () => {
            let alreadyPaid = (m.quyHistory && m.quyHistory[key] !== undefined && m.quyHistory[key] >= systemSettings.quyAmount);
            if (alreadyPaid) {
                alert("Hệ thống đã ghi nhận bạn đã đóng quỹ rồi!");
                return;
            }

            if (!m.quyHistory) m.quyHistory = {};
            m.quyHistory[key] = systemSettings.quyAmount;
            enqueueAction("updateMember", { members: members }, "Đã ghi nhận Tiền quỹ QUÝ thành công!");
        });
    }
}

function calculateUserFinanceForMonth(memberName, targetMonth, targetYear) {
    let totalWins = 0, totalLosses = 0, totalDraws = 0, totalMatchCount = 0;
    let monthMatchCount = 0, monthRegularFee = 0, monthSpecialBetFee = 0;

    matches.forEach(match => {
        let isV1 = (match.p1_v1 === memberName || match.p2_v1 === memberName);
        let isV2 = (match.p1_v2 === memberName || match.p2_v2 === memberName);
        
        if (isV1 || isV2) {
            totalMatchCount++;
            if (match.scoreA === match.scoreB) totalDraws++;
            else if ((isV1 && match.scoreA > match.scoreB) || (isV2 && match.scoreB > match.scoreA)) totalWins++;
            else totalLosses++;

            let mTime = match.time || "";
            let isTargetTime = false;
            if (mTime.includes(`/${targetMonth}/${targetYear}`) || mTime.includes(` ${targetMonth}/${targetYear}`)) isTargetTime = true;

            if (isTargetTime) {
                monthMatchCount++;
                if (match.scoreA === match.scoreB) monthRegularFee += 10000;
                else if ((isV1 && match.scoreA > match.scoreB) || (isV2 && match.scoreB > match.scoreA)) { }
                else {
                    monthRegularFee += 10000;
                    if (match.specialBet > 0) monthSpecialBetFee += parseInt(match.specialBet);
                }
            }
        }
    });

    if (!members || members.length === 0) members = defaultFallbackMembers;
    let m = members.find(item => item.name === memberName) || { paidUser: 0, noOld: 0 };
    let cappedBaseFee = Math.min(150000, monthRegularFee);
    let totalPay = cappedBaseFee + monthSpecialBetFee + (m.noOld || 0) - (m.paidUser || 0);

    return {
        totalMatchCount, totalWins, totalLosses, totalDraws,
        monthMatchCount, monthRegularFee, monthSpecialBetFee, cappedBaseFee,
        totalPay: totalPay
    };
}

function calculateUserFinance(memberName) {
    let mSel = document.getElementById('selectFinanceMonth') ? document.getElementById('selectFinanceMonth').value : "8";
    let ySel = document.getElementById('selectFinanceYear') ? document.getElementById('selectFinanceYear').value : "2026";
    return calculateUserFinanceForMonth(memberName, mSel, ySel);
}

function renderDashboard() {
    if (!members || members.length === 0) members = defaultFallbackMembers;
    let main = document.getElementById('dashMainUser').value;
    if (!main && members.length > 0) main = members[0].name;
    if (!main) return;

    let f = calculateUserFinance(main);
    let m = members.find(item => item.name === main) || members[0];

    let qSel = document.getElementById('selectQuy').value;
    let ySel = document.getElementById('selectNam').value;
    let key = qSel + "_" + ySel;
    let paidQuy = (m.quyHistory && m.quyHistory[key] !== undefined) ? parseInt(m.quyHistory[key]) : 0;
    let warningBanner = document.getElementById('quyWarningBanner');

    let hasWarning = (m.status === 'Đang tham gia' && ((m.noOld || 0) > 0 || paidQuy < systemSettings.quyAmount));
    if (hasWarning) {
        warningBanner.classList.remove('hidden');
        warningBanner.classList.add('flex');
        let warningMsg = [];
        if ((m.noOld || 0) > 0) warningMsg.push(`có số tiền Nợ cũ là ${m.noOld.toLocaleString()} đ`);
        if (paidQuy < systemSettings.quyAmount) warningMsg.push(`chưa đóng quỹ ${qSel}/${ySel}`);
        document.getElementById('quyWarningText').innerText = `${m.name} ơi, bạn ${warningMsg.join(' và ')}. Vui lòng hoàn thành nhé!`;
    } else {
        warningBanner.classList.add('hidden');
        warningBanner.classList.remove('flex');
    }

    document.getElementById('statTotal').innerText = f.totalMatchCount;
    let winRate = f.totalMatchCount > 0 ? ((f.totalWins / f.totalMatchCount) * 100).toFixed(0) + '%' : '0%';
    document.getElementById('statWins').innerText = f.totalWins + " (" + winRate + ")";
    document.getElementById('statDraws').innerText = f.totalDraws;
    document.getElementById('statLosses').innerText = f.totalLosses;

    let curMonth = document.getElementById('selectFinanceMonth').value;
    let curYear = document.getElementById('selectFinanceYear').value;
    let userBookingsThisMonth = bookingLogs.filter(b => {
        if (b.name !== main) return false;
        let t = b.time || "";
        return t.includes(`/${curMonth}/${curYear}`) || t.includes(` ${curMonth}/${curYear}`);
    });

    let totalReward = userBookingsThisMonth.reduce((sum, b) => sum + parseInt(b.reward), 0);
    document.getElementById('statReward').innerText = totalReward.toLocaleString() + " đ";

    document.getElementById('statDebt').innerText = f.totalPay.toLocaleString() + " đ";
    document.getElementById('statPaidDisplay').innerText = (m.paidUser || 0).toLocaleString() + " đ";

    let matchBody = document.getElementById('userMatchHistoryBody');
    matchBody.innerHTML = '';
    let userMatchesThisMonth = matches.filter(match => {
        let isUserIn = (match.p1_v1 === main || match.p2_v1 === main || match.p1_v2 === main || match.p2_v2 === main);
        if (!isUserIn) return false;
        let t = match.time || "";
        return t.includes(`/${curMonth}/${curYear}`) || t.includes(` ${curMonth}/${curYear}`);
    });

    userMatchesThisMonth.forEach((mItem, idx) => {
        let isV1 = (mItem.p1_v1 === main || mItem.p2_v1 === main);
        let teammate = isV1 ? (mItem.p1_v1 === main ? mItem.p2_v1 : mItem.p1_v1) : (mItem.p1_v2 === main ? mItem.p2_v2 : mItem.p1_v2);
        let opponents = isV1 ? (mItem.p1_v2 + " & " + mItem.p2_v2) : (mItem.p1_v1 + " & " + mItem.p2_v1);
        
        let displayScore = isV1 ? `${mItem.scoreA}-${mItem.scoreB}` : `${mItem.scoreB}-${mItem.scoreA}`;

        matchBody.innerHTML += `<tr class="border-b"><td class="p-2 text-center font-bold">${userMatchesThisMonth.length - idx}</td><td class="p-2 font-semibold text-slate-800">${teammate}</td><td class="p-2 font-semibold text-slate-800">${opponents}</td><td class="p-2 text-center font-bold text-emerald-800">${displayScore}</td><td class="p-2 text-right font-bold text-amber-800">${mItem.specialBet > 0 ? parseInt(mItem.specialBet).toLocaleString() + 'đ' : '-'}</td></tr>`;
    });

    let rewardBody = document.getElementById('userRewardHistoryBody');
    rewardBody.innerHTML = '';
    userBookingsThisMonth.forEach(b => {
        rewardBody.innerHTML += `<tr class="border-b"><td class="p-1.5">${b.time}</td><td class="p-1.5 text-center font-bold text-amber-700">${b.frame}</td><td class="p-1.5 text-right font-black text-emerald-700">${parseInt(b.reward).toLocaleString()} đ</td></tr>`;
    });

    let gocBody = document.getElementById('userGocHistoryBody');
    gocBody.innerHTML = '';
    let userGocs = gocLogs.filter(g => g.name === main);
    if (userGocs.length === 0) {
        gocBody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-400 italic">Chưa có lượt nộp</td></tr>`;
    } else {
        userGocs.forEach(g => {
            gocBody.innerHTML += `
                <tr class="border-b">
                    <td class="p-1.5 text-slate-600">${g.time}</td>
                    <td class="p-1.5 text-right font-bold text-emerald-700">${parseInt(g.amount).toLocaleString()} đ</td>
                    <td class="p-1.5 text-slate-500 truncate max-w-[90px]">${g.note || '-'}</td>
                </tr>
            `;
        });
    }
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

function renderQuyTable() {
    if (!members || members.length === 0) members = defaultFallbackMembers;
    let q = document.getElementById('selectQuy').value;
    let y = document.getElementById('selectNam').value;
    let key = q + "_" + y;

    document.getElementById('thQuyTitle').innerText = "Số Tiền " + q.replace('Q', 'Quý ') + "/" + y;

    let tbody = document.getElementById('quyTableBody');
    tbody.innerHTML = '';

    members.forEach((m, idx) => {
        let paidAmount = 0;
        if (m.quyHistory && m.quyHistory[key] !== undefined) paidAmount = parseInt(m.quyHistory[key]);

        let isOk = paidAmount >= systemSettings.quyAmount;
        let statusColor = m.status === 'Đang tham gia' ? 'bg-emerald-100 text-emerald-800' : (m.status === 'Bận tạm nghỉ' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800');

        tbody.innerHTML += `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-2.5 text-center font-bold text-slate-500">${idx + 1}</td>
                <td class="p-2.5 font-bold text-slate-900">${m.name}</td>
                <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${statusColor}">${m.status || 'Đang tham gia'}</span></td>
                <td class="p-2.5 text-right font-bold ${isOk ? 'text-emerald-700' : 'text-slate-400'}">${paidAmount.toLocaleString()} đ</td>
                <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isOk ? 'bg-cyan-100 text-cyan-800' : 'bg-red-100 text-red-800'}">${isOk ? 'OK' : 'Chưa'}</span></td>
                <td class="p-2.5 text-center admin-only ${currentUserRole==='admin'?'':'hidden'}">
                    <button onclick="openEditQuyModal(${idx})" class="text-blue-600 font-bold"><i class="fa-solid fa-pen"></i></button>
                </td>
            </tr>
        `;
    });
    applyRolePermissions();
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
        if (!members || members.length === 0) members = defaultFallbackMembers;
        members.forEach(m => {
            let totalQuy = 0;
            if (m.quyHistory) Object.values(m.quyHistory).forEach(val => totalQuy += parseInt(val));
            if (totalQuy > 0) {
                catTotal += totalQuy;
                tbody.innerHTML += `<tr class="border-b"><td class="p-1.5">Tất cả Quý</td><td class="p-1.5 font-bold">${m.name}</td><td class="p-1.5 text-right font-bold text-emerald-700">${totalQuy.toLocaleString()} đ</td><td class="p-1.5 text-center">-</td></tr>`;
            }
        });
    } else if (cat === 'Tiền góc thực thu') {
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
    if (!members || members.length === 0) members = defaultFallbackMembers;
    let totalQuyThu = 0;
    members.forEach(m => {
        if (m.quyHistory) Object.values(m.quyHistory).forEach(val => totalQuyThu += parseInt(val));
    });

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
    if (confirm("Xóa thông báo này?")) {
        enqueueAction("deleteItem", { sheetName: "Rules", id: id }, "Đã xóa thông báo thành công!");
    }
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

function showCustomConfirm(message, onConfirm) {
    let modal = document.getElementById('customConfirmModal');
    let textEl = document.getElementById('customConfirmText');
    let okBtn = document.getElementById('customConfirmOkBtn');
    let cancelBtn = document.getElementById('customConfirmCancelBtn');

    textEl.innerText = message;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    let newOkBtn = okBtn.cloneNode(true);
    let newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        onConfirm(true);
    });

    newCancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        onConfirm(false);
    });
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

function openNotificationModal() {
    renderGamification();
    document.getElementById('notificationModal').classList.remove('hidden');
    document.getElementById('notificationModal').classList.add('flex');
}

function closeNotificationModal() {
    document.getElementById('notificationModal').classList.add('hidden');
    document.getElementById('notificationModal').classList.remove('flex');
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

function exportToExcel() {
    let wb = XLSX.utils.book_new();
    let wsMem = XLSX.utils.json_to_sheet(members); XLSX.utils.book_append_sheet(wb, wsMem, "ThanhVien");
    let wsMatch = XLSX.utils.json_to_sheet(matches); XLSX.utils.book_append_sheet(wb, wsMatch, "TranDau");
    let wsGoc = XLSX.utils.json_to_sheet(gocLogs); XLSX.utils.book_append_sheet(wb, wsGoc, "NopTienGoc");
    XLSX.writeFile(wb, "CLB_Tennis_Thang_Long_Ver1.2_Backup.xlsx");
}



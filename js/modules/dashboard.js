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

    showActionConfirm(
        `Xác nhận thành viên [${main}] đã chuyển khoản tiền quỹ quý hiện tại?`,
        () => {

            fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify({
                    action: "addQuyLog",
                    quyLog: {
                        name: main
                    }
                })
            })
            .then(res => res.json())
            .then(data => {

                if (data.status !== "SUCCESS") {
                    let message = data.message || "Không thể ghi nhận đóng quỹ.";

                    // Bỏ chữ "Error:" cho thông báo dễ đọc
                    message = message.replace(/^Error:\s*/i, "");

                    alert(message);
                    return;
                }

                showToast("Đã ghi nhận Tiền quỹ QUÝ thành công!");

                // Đọc lại dữ liệu thật từ Google Sheet
                fetchCloudData(true);
            })
            .catch(err => {
                alert("Không thể kết nối hệ thống. Vui lòng thử lại.");
            });
        }
    );
}
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

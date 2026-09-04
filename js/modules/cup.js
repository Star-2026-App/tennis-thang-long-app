// ======================================================
// CUP TOURNAMENT UI - V2.1.2
// ======================================================
// CUP chỉ dùng cupData/CupTournament. Không ghi Matches, GocLogs,
// MemberStats hay bất kỳ dữ liệu tài chính thường ngày nào.
// ======================================================

var cupActiveSection_ = "overview";
var cupParticipantDraft_ = null;
var cupPairDraft_ = null;
var cupPairDraftManual_ = false;
var cupBusy_ = false;
var cupRefreshTimer_ = null;
var cupBottomNavHookInstalled_ = false;
var cupOriginalSyncBottomNavState_ = null;

function cupIsManager_() {
    return currentUserRole === "admin" || currentUserRole === "owner";
}

function cupEscape_(value) {
    return String(value === undefined || value === null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function cupCloneClient_(value) {
    return JSON.parse(JSON.stringify(value || {}));
}

function cupDefaultClient_() {
    return {
        version: 0,
        enabled: false,
        status: "draft",
        tournamentId: "",
        name: "CUP THĂNG LONG",
        date: "",
        startTime: "06:00",
        courtCount: 4,
        matchDuration: 45,
        groupCount: 4,
        pairsPerGroup: 4,
        pairingMode: "auto",
        participantsLocked: false,
        pairsLocked: false,
        participants: [],
        pairs: [],
        matches: [],
        tieBreakLots: {},
        rules: "",
        standings: {},
        qualifiers: [],
        bestThirds: [],
        qualificationBlocked: [],
        progress: { groupCompleted: 0, groupTotal: 0, allCompleted: 0, allTotal: 0 },
        championPairId: "",
        championName: ""
    };
}

function cupCurrent_() {
    return Object.assign(cupDefaultClient_(), cupData && typeof cupData === "object" ? cupData : {});
}

function cupExpectedPlayers_(cup) {
    cup = cup || cupCurrent_();
    return (parseInt(cup.groupCount) || 0) * (parseInt(cup.pairsPerGroup) || 0) * 2;
}

function cupStoredPayload_(value) {
    var source = cupCloneClient_(value);
    [
        "standings", "qualifiers", "bestThirds", "qualificationBlocked",
        "qualificationReady", "progress", "championPairId", "championName"
    ].forEach(function(key) { delete source[key]; });
    return source;
}

function cupFormatDate_(isoDate) {
    var match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? (match[3] + "/" + match[2] + "/" + match[1]) : "Chưa đặt ngày";
}

function cupStatusInfo_(cup) {
    if (!cup.enabled) return { text: "Chưa kích hoạt", cls: "is-draft" };
    if (cup.status === "completed") return { text: "Đã hoàn thành", cls: "is-completed" };
    if (cup.pairsLocked) return { text: "Đang thi đấu", cls: "is-active" };
    if (cup.participantsLocked) return { text: "Đang ghép cặp", cls: "is-pairing" };
    return { text: "Đang đăng ký", cls: "is-registration" };
}

function cupStageLabel_(stage) {
    return stage === "QF" ? "Tứ kết" : stage === "SF" ? "Bán kết" : stage === "F" ? "Chung kết" : "Vòng bảng";
}

function cupMatchSort_(a, b) {
    var dateA = String(a.scheduledDate || "9999-99-99") + " " + String(a.scheduledTime || "99:99");
    var dateB = String(b.scheduledDate || "9999-99-99") + " " + String(b.scheduledTime || "99:99");
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (parseInt(a.matchNo) || 0) - (parseInt(b.matchNo) || 0);
}

function syncCupNavVisibility() {
    var cup = cupCurrent_();
    var visible = cup.enabled === true || cupIsManager_();

    document.querySelectorAll(".cup-nav-entry").forEach(function(el) {
        el.classList.toggle("hidden", !visible);
    });

    var activeTab = document.getElementById("tab-cup");
    if (!visible && activeTab && activeTab.classList.contains("active") && typeof switchTab === "function") {
        switchTab("dashboard");
    }

    installCupBottomNavHook_();
    syncCupMobilePriority_(cup, visible);
}

function ensureCupMobilePriorityElements_() {
    var cashbookBottom = document.getElementById("bn-cashbook");
    var cupBottom = document.getElementById("bn-cup");

    if (cashbookBottom && !cupBottom) {
        cupBottom = document.createElement("button");
        cupBottom.type = "button";
        cupBottom.id = "bn-cup";
        cupBottom.className = "bn-item hidden flex flex-col items-center gap-0.5 py-1";
        cupBottom.setAttribute("onclick", "switchTabMobile('cup','Giải đấu CUP')");
        cupBottom.innerHTML = '<i class="fa-solid fa-trophy text-lg"></i><span class="text-[9.5px] font-bold">CUP</span>';
        cashbookBottom.insertAdjacentElement("afterend", cupBottom);
    }

    var cupMore = document.querySelector("#moreSheet button[onclick*=\"moreGo('cup'\"]");
    var cashbookMore = document.getElementById("more-cashbook-cup-active");

    if (cupMore && !cashbookMore) {
        cashbookMore = document.createElement("button");
        cashbookMore.type = "button";
        cashbookMore.id = "more-cashbook-cup-active";
        cashbookMore.className = "more-row hidden";
        cashbookMore.setAttribute("onclick", "moreGo('cashbook','Sổ thu chi')");
        cashbookMore.innerHTML = '<span class="more-row-icon"><i class="fa-solid fa-book-bookmark"></i></span><span class="flex-1 text-left">Sổ thu chi</span><i class="fa-solid fa-chevron-right text-slate-300 text-xs"></i>';
        cupMore.insertAdjacentElement("beforebegin", cashbookMore);
    }

    return {
        cashbookBottom: cashbookBottom,
        cupBottom: cupBottom,
        cupMore: cupMore,
        cashbookMore: cashbookMore
    };
}

function syncCupMobilePriority_(cup, cupVisible) {
    var elements = ensureCupMobilePriorityElements_();
    var cupActive = cup && cup.enabled === true;

    if (elements.cashbookBottom) {
        elements.cashbookBottom.classList.toggle("hidden", cupActive);
    }
    if (elements.cupBottom) {
        elements.cupBottom.classList.toggle("hidden", !cupActive);
    }
    if (elements.cashbookMore) {
        elements.cashbookMore.classList.toggle("hidden", !cupActive);
    }
    if (elements.cupMore) {
        // CUP đang chạy đã có nút ưu tiên ở thanh dưới. Khi reset,
        // CUP trở lại mục Thêm nhưng chỉ Admin/Owner nhìn thấy để
        // có thể cấu hình giải tiếp theo.
        elements.cupMore.classList.toggle("hidden", cupActive || !cupVisible);
    }
}

function installCupBottomNavHook_() {
    if (cupBottomNavHookInstalled_ || typeof syncBottomNavState !== "function") return;

    cupOriginalSyncBottomNavState_ = syncBottomNavState;
    syncBottomNavState = function(tabId) {
        cupOriginalSyncBottomNavState_(tabId);

        var cup = cupCurrent_();
        if (!cup.enabled) return;

        if (tabId === "cup") {
            var cupButton = document.getElementById("bn-cup");
            if (cupButton) cupButton.classList.add("active");
        } else if (tabId === "cashbook") {
            var moreButton = document.getElementById("bn-more");
            if (moreButton) moreButton.classList.add("active");
        }
    };

    cupBottomNavHookInstalled_ = true;
}

function ensureCupAutoRefresh_() {
    if (cupRefreshTimer_) return;
    cupRefreshTimer_ = setInterval(function() {
        var tab = document.getElementById("tab-cup");
        if (document.visibilityState !== "visible" || !tab || !tab.classList.contains("active") || !navigator.onLine || cupBusy_) return;

        // Poll chỉ lấy summary/version rất nhỏ; chỉ tải toàn bộ CUP
        // khi version thật sự thay đổi.
        callBackendRead_("/api/data/cup-version")
            .then(function(summary) {
                var currentVersion = parseInt(cupData && cupData.version) || 0;
                var serverVersion = parseInt(summary && summary.version) || 0;
                if (!cupData || cupData.summaryOnly === true || serverVersion !== currentVersion) {
                    return fetchCupData(false, true);
                }
                return null;
            })
            .catch(function() {});
    }, 60000);
}

function activateCupTab_() {
    renderCupTab();
    if (!cupData || cupData.summaryOnly === true) {
        fetchCupData(true, true).catch(function() {});
    }
}

function fetchCupData(showSpinner, silent) {
    if (showSpinner && typeof showCloudLoading_ === "function") showCloudLoading_();

    return callBackendRead_("/api/data/cup")
        .then(function(result) {
            var oldVersion = parseInt(cupData && cupData.version) || 0;
            cupData = result || cupDefaultClient_();
            cupData.summaryOnly = false;
            if ((parseInt(cupData.version) || 0) !== oldVersion) {
                cupParticipantDraft_ = null;
                cupPairDraft_ = null;
                cupPairDraftManual_ = false;
            }
            if (typeof saveLocalData === "function") saveLocalData();
            syncCupNavVisibility();
            renderCupTab();
            return cupData;
        })
        .catch(function(err) {
            if (!silent && typeof showToast === "function") {
                showToast((err && err.message) || "Chưa tải được dữ liệu CUP.");
            }
            throw err;
        })
        .finally(function() {
            if (showSpinner && typeof hideCloudLoading_ === "function") hideCloudLoading_();
        });
}

function cupCallWrite_(action, data, successMessage) {
    if (cupBusy_) return Promise.resolve(null);
    if (!navigator.onLine) {
        showToast("CUP cần kết nối mạng để tránh ghi đè kết quả.");
        return Promise.resolve(null);
    }

    cupBusy_ = true;
    renderCupBusyState_();

    var idempotencyKey = generateIdempotencyKey_();
    return callBackendActionWithRetry_(action, data, idempotencyKey, 3)
        .then(function(json) {
            if (!json || json.status !== "SUCCESS") {
                throw new Error((json && json.message) || "Thao tác CUP không thành công.");
            }

            cupData = json.result || cupDefaultClient_();
            cupData.summaryOnly = false;
            cupParticipantDraft_ = null;
            cupPairDraft_ = null;
            cupPairDraftManual_ = false;
            if (typeof saveLocalData === "function") saveLocalData();
            syncCupNavVisibility();
            renderCupTab();
            if (successMessage) showToast(successMessage);
            return cupData;
        })
        .catch(function(err) {
            var message = (err && err.message) || "Thao tác CUP thất bại.";
            showToast(message);

            if (/vừa được người khác cập nhật/i.test(message)) {
                fetchCupData(true, true).catch(function() {});
            }
            return null;
        })
        .finally(function() {
            cupBusy_ = false;
            renderCupBusyState_();
        });
}

function cupSaveSnapshot_(nextCup, successMessage) {
    var current = cupCurrent_();
    return cupCallWrite_("saveCupData", {
        expectedVersion: current.version,
        cupData: cupStoredPayload_(nextCup)
    }, successMessage);
}

function renderCupBusyState_() {
    document.querySelectorAll("#cupRoot button, #cupRoot input, #cupRoot select, #cupRoot textarea")
        .forEach(function(el) {
            if (el.dataset.cupAllowBusy === "1") return;
            el.disabled = cupBusy_;
        });

    var busy = document.getElementById("cupBusyBar");
    if (busy) busy.classList.toggle("hidden", !cupBusy_);
}

function switchCupSection(section) {
    if (!cupIsManager_() && section === "settings") section = "overview";
    cupActiveSection_ = section;
    renderCupTab();
}

function cupSubnavHtml_() {
    var items = [
        ["overview", "fa-house", "Tổng quan"],
        ["participants", "fa-user-check", "Người chơi"],
        ["pairs", "fa-people-arrows-left-right", "Cặp đấu"],
        ["groups", "fa-table-list", "Bảng đấu"],
        ["schedule", "fa-calendar-days", "Lịch đấu"],
        ["knockout", "fa-trophy", "Vòng trong"],
        ["rules", "fa-scale-balanced", "Rule"]
    ];
    if (cupIsManager_()) items.push(["settings", "fa-sliders", "Cài đặt"]);

    return items.map(function(item) {
        return '<button type="button" onclick="switchCupSection(\'' + item[0] + '\')" class="cup-subtab ' +
            (cupActiveSection_ === item[0] ? "is-active" : "") + '"><i class="fa-solid ' + item[1] + '"></i><span>' + item[2] + '</span></button>';
    }).join("");
}

function renderCupTab() {
    var root = document.getElementById("cupRoot");
    if (!root) return;

    var cup = cupCurrent_();
    var status = cupStatusInfo_(cup);
    var expectedPlayers = cupExpectedPlayers_(cup);
    var completed = cup.progress || { groupCompleted: 0, groupTotal: 0, allCompleted: 0, allTotal: 0 };

    root.innerHTML =
        '<div id="cupBusyBar" class="cup-busy-bar ' + (cupBusy_ ? "" : "hidden") + '"><i class="fa-solid fa-spinner fa-spin"></i> Đang đồng bộ dữ liệu CUP...</div>' +
        '<div class="cup-hero">' +
            '<div class="min-w-0"><div class="cup-kicker"><i class="fa-solid fa-trophy"></i> GIẢI ĐẤU CUP · ĐÁNH ĐÔI</div>' +
            '<h2>' + cupEscape_(cup.name || "CUP THĂNG LONG") + '</h2>' +
            '<div class="cup-hero-meta"><span><i class="fa-regular fa-calendar"></i> ' + cupEscape_(cupFormatDate_(cup.date)) + '</span>' +
            '<span><i class="fa-regular fa-clock"></i> ' + cupEscape_(cup.startTime || "06:00") + ' dự kiến</span>' +
            '<span><i class="fa-solid fa-table-tennis-paddle-ball"></i> ' + (parseInt(cup.courtCount) || 0) + ' sân</span></div></div>' +
            '<div class="cup-status ' + status.cls + '"><span class="cup-status-dot"></span>' + status.text + '</div>' +
        '</div>' +
        '<div class="cup-metrics">' +
            cupMetricHtml_("fa-user-check", (cup.summaryOnly ? (parseInt(cup.participantCount) || 0) : (cup.participants || []).length) + "/" + expectedPlayers, "Người đăng ký") +
            cupMetricHtml_("fa-people-group", (cup.summaryOnly ? (parseInt(cup.pairCount) || 0) : (cup.pairs || []).length) + "/" + (expectedPlayers / 2), "Cặp thi đấu") +
            cupMetricHtml_("fa-circle-check", completed.groupCompleted + "/" + completed.groupTotal, "Trận vòng bảng") +
            cupMetricHtml_("fa-flag-checkered", completed.allCompleted + "/" + completed.allTotal, "Tổng trận xong") +
        '</div>' +
        '<div class="cup-subnav">' + cupSubnavHtml_() + '</div>' +
        '<div class="cup-pane">' + renderCupPane_(cup) + '</div>' +
        cupResultModalHtml_() + cupScheduleModalHtml_();

    renderCupBusyState_();
    ensureCupAutoRefresh_();
    syncCupNavVisibility();
}

function cupMetricHtml_(icon, value, label) {
    return '<div class="cup-metric"><span class="cup-metric-icon"><i class="fa-solid ' + icon + '"></i></span>' +
        '<div><strong>' + cupEscape_(value) + '</strong><small>' + cupEscape_(label) + '</small></div></div>';
}

function renderCupPane_(cup) {
    if (cup.summaryOnly === true) {
        return '<div class="cup-empty"><i class="fa-solid fa-spinner fa-spin"></i><h3>Đang tải chi tiết CUP</h3><p>Ứng dụng chỉ tải bảng đấu và lịch khi bạn mở mục này.</p></div>';
    }

    if (!cup.enabled && !cupIsManager_()) {
        return '<div class="cup-empty"><i class="fa-solid fa-trophy"></i><h3>Chưa có giải CUP đang hoạt động</h3><p>Khi Ban tổ chức kích hoạt giải, thông tin sẽ xuất hiện tại đây.</p></div>';
    }

    switch (cupActiveSection_) {
        case "participants": return renderCupParticipants_(cup);
        case "pairs": return renderCupPairs_(cup);
        case "groups": return renderCupGroups_(cup);
        case "schedule": return renderCupSchedule_(cup);
        case "knockout": return renderCupKnockout_(cup);
        case "rules": return renderCupRules_(cup);
        case "settings": return cupIsManager_() ? renderCupSettings_(cup) : renderCupOverview_(cup);
        default: return renderCupOverview_(cup);
    }
}

function renderCupOverview_(cup) {
    var nextMatches = (cup.matches || []).filter(function(match) {
        return match.status !== "completed" && match.pairAId && match.pairBId;
    }).sort(cupMatchSort_).slice(0, 5);

    var steps = [
        { label: "Danh sách đăng ký", done: cup.participantsLocked, text: (cup.participants || []).length + "/" + cupExpectedPlayers_(cup) + " người" },
        { label: "Ghép cặp và chia bảng", done: cup.pairsLocked, text: (cup.pairs || []).length + " cặp" },
        { label: "Thi đấu vòng bảng", done: !!(cup.progress && cup.progress.groupTotal && cup.progress.groupCompleted === cup.progress.groupTotal), text: (cup.progress ? cup.progress.groupCompleted : 0) + "/" + (cup.progress ? cup.progress.groupTotal : 0) + " trận" },
        { label: "Vòng loại trực tiếp", done: cup.status === "completed", text: cup.status === "completed" ? "Đã tìm ra nhà vô địch" : "Chờ kết quả" }
    ];

    var champion = cup.championPairId
        ? '<div class="cup-champion"><div class="cup-crown">🏆</div><div><small>NHÀ VÔ ĐỊCH</small><strong>' + cupEscape_(cup.championName) + '</strong></div></div>'
        : "";

    return champion +
        '<div class="cup-grid-2">' +
            '<div class="cup-card"><div class="cup-card-head"><div><span class="cup-eyebrow">TIẾN ĐỘ GIẢI</span><h3>Hôm nay cần làm gì?</h3></div></div>' +
            '<div class="cup-step-list">' + steps.map(function(step, index) {
                return '<button type="button" onclick="switchCupSection(\'' + ["participants", "pairs", "groups", "knockout"][index] + '\')" class="cup-step ' + (step.done ? "is-done" : "") + '">' +
                    '<span class="cup-step-mark">' + (step.done ? '<i class="fa-solid fa-check"></i>' : (index + 1)) + '</span>' +
                    '<span><strong>' + cupEscape_(step.label) + '</strong><small>' + cupEscape_(step.text) + '</small></span><i class="fa-solid fa-chevron-right"></i></button>';
            }).join("") + '</div></div>' +
            '<div class="cup-card"><div class="cup-card-head"><div><span class="cup-eyebrow">SẮP THI ĐẤU</span><h3>Lịch gần nhất</h3></div><button type="button" onclick="switchCupSection(\'schedule\')" class="cup-link-btn">Xem lịch</button></div>' +
            (nextMatches.length ? '<div class="cup-next-list">' + nextMatches.map(cupNextMatchHtml_).join("") + '</div>' :
                '<div class="cup-inline-empty"><i class="fa-regular fa-calendar"></i><span>Chưa có trận tiếp theo.</span></div>') + '</div>' +
        '</div>' +
        '<div class="cup-note"><i class="fa-solid fa-shield-halved"></i><span>Kết quả CUP được lưu riêng, không tính tiền góc và không cộng vào thành tích trận thường.</span></div>';
}

function cupNextMatchHtml_(match) {
    return '<div class="cup-next-match"><div class="cup-next-time"><strong>' + cupEscape_(match.scheduledTime || "--:--") + '</strong><small>' + cupEscape_(match.court || "Chờ sân") + '</small></div>' +
        '<div class="cup-next-teams"><span>' + cupEscape_(match.pairAName || "Chờ xác định") + '</span><em>vs</em><span>' + cupEscape_(match.pairBName || "Chờ xác định") + '</span></div>' +
        '<span class="cup-stage-chip">' + cupEscape_(match.stage === "group" ? "Bảng " + match.group + " · L" + match.round : cupStageLabel_(match.stage)) + '</span></div>';
}

function cupInitParticipantDraft_(cup) {
    if (!Array.isArray(cupParticipantDraft_)) {
        cupParticipantDraft_ = (cup.participants || []).map(function(item) { return parseInt(item.stt); });
    }
}

function renderCupParticipants_(cup) {
    cupInitParticipantDraft_(cup);
    var expected = cupExpectedPlayers_(cup);
    var allMembers = (members || []).filter(function(member) { return member && member.isActive !== false; });
    var canEdit = cupIsManager_() && !cup.participantsLocked;

    var controls = cupIsManager_()
        ? '<div class="cup-action-row">' +
            (cup.participantsLocked
                ? '<button type="button" onclick="unlockCupParticipants()" class="cup-btn cup-btn-secondary"><i class="fa-solid fa-lock-open"></i> Mở khóa đăng ký</button>'
                : '<button type="button" onclick="clearCupParticipantDraft()" class="cup-btn cup-btn-ghost">Bỏ chọn hết</button><button type="button" onclick="confirmCupParticipants()" class="cup-btn cup-btn-primary"><i class="fa-solid fa-user-check"></i> Xác nhận danh sách</button>') +
          '</div>'
        : "";

    return '<div class="cup-card"><div class="cup-card-head cup-card-head-wrap"><div><span class="cup-eyebrow">BƯỚC 1</span><h3>Chọn người tham gia</h3><p>Giải này cần đúng <strong>' + expected + ' người</strong> để tạo ' + (expected / 2) + ' cặp.</p></div>' + controls + '</div>' +
        (canEdit ? '<div class="cup-member-tools"><div class="cup-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" oninput="filterCupMembers(this.value)" placeholder="Tìm tên hoặc STT..."></div>' +
            '<div class="cup-selection-count ' + (cupParticipantDraft_.length === expected ? "is-ready" : "") + '"><strong id="cupSelectedCount">' + cupParticipantDraft_.length + '</strong> / ' + expected + ' đã chọn</div></div>' : "") +
        '<div id="cupMemberGrid" class="cup-member-grid">' + allMembers.map(function(member) {
            var selected = cupParticipantDraft_.indexOf(parseInt(member.stt)) !== -1;
            return '<label class="cup-member-item ' + (selected ? "is-selected" : "") + '" data-cup-search="' + cupEscape_((member.stt + " " + member.name).toLowerCase()) + '">' +
                (canEdit ? '<input type="checkbox" ' + (selected ? "checked" : "") + ' onchange="toggleCupParticipantDraft(' + parseInt(member.stt) + ',this.checked,this)">' : '<span class="cup-member-check"><i class="fa-solid ' + (selected ? "fa-check" : "fa-minus") + '"></i></span>') +
                '<span class="cup-member-stt">' + parseInt(member.stt) + '</span><span class="cup-member-name">' + cupEscape_(member.name) + '</span><span class="cup-rating">' + cupEscape_(Number(member.base || 0).toFixed(2)) + '</span></label>';
        }).join("") + '</div>' +
        (!canEdit && !(cup.participants || []).length ? '<div class="cup-inline-empty"><i class="fa-solid fa-users"></i><span>Ban tổ chức chưa xác nhận danh sách.</span></div>' : "") + '</div>';
}

function filterCupMembers(value) {
    var query = String(value || "").trim().toLowerCase();
    document.querySelectorAll("#cupMemberGrid .cup-member-item").forEach(function(item) {
        item.classList.toggle("hidden", query && String(item.dataset.cupSearch || "").indexOf(query) === -1);
    });
}

function toggleCupParticipantDraft(stt, checked, checkbox) {
    cupInitParticipantDraft_(cupCurrent_());
    stt = parseInt(stt);
    var index = cupParticipantDraft_.indexOf(stt);
    if (checked && index === -1) cupParticipantDraft_.push(stt);
    if (!checked && index !== -1) cupParticipantDraft_.splice(index, 1);

    var expected = cupExpectedPlayers_(cupCurrent_());
    var count = document.getElementById("cupSelectedCount");
    if (count) {
        count.textContent = cupParticipantDraft_.length;
        if (count.parentElement) count.parentElement.classList.toggle("is-ready", cupParticipantDraft_.length === expected);
    }
    if (checkbox && checkbox.closest(".cup-member-item")) {
        checkbox.closest(".cup-member-item").classList.toggle("is-selected", checked);
    }
}

function clearCupParticipantDraft() {
    cupParticipantDraft_ = [];
    renderCupTab();
}

function confirmCupParticipants() {
    var cup = cupCurrent_();
    cupInitParticipantDraft_(cup);
    var expected = cupExpectedPlayers_(cup);
    if (cupParticipantDraft_.length !== expected) {
        showToast("Cần chọn đúng " + expected + " người. Hiện đang chọn " + cupParticipantDraft_.length + ".");
        return;
    }

    var next = cupCloneClient_(cup);
    next.participants = cupParticipantDraft_.map(function(stt) { return { stt: stt }; });
    next.participantsLocked = true;
    next.pairsLocked = false;
    next.pairs = [];
    next.matches = [];
    next.tieBreakLots = {};
    next.status = "pairing";
    cupSaveSnapshot_(next, "Đã xác nhận danh sách người chơi.");
}

function unlockCupParticipants() {
    if (!confirm("Mở khóa sẽ xóa cặp đấu, lịch và toàn bộ kết quả CUP hiện tại. Tiếp tục?")) return;
    var next = cupCloneClient_(cupCurrent_());
    next.participantsLocked = false;
    next.pairsLocked = false;
    next.pairs = [];
    next.matches = [];
    next.tieBreakLots = {};
    next.status = "registration";
    cupSaveSnapshot_(next, "Đã mở khóa danh sách đăng ký.");
}

function cupParticipantByStt_(cup, stt) {
    return (cup.participants || []).filter(function(item) { return parseInt(item.stt) === parseInt(stt); })[0] || null;
}

function cupPairDisplayName_(pair) {
    return (pair && pair.player1Name ? pair.player1Name : "Chưa chọn") + " / " + (pair && pair.player2Name ? pair.player2Name : "Chưa chọn");
}

function cupShuffle_(items) {
    var output = items.slice();
    for (var i = output.length - 1; i > 0; i--) {
        var rand;
        if (window.crypto && crypto.getRandomValues) {
            var values = new Uint32Array(1);
            crypto.getRandomValues(values);
            rand = values[0] / 4294967296;
        } else {
            rand = Math.random();
        }
        var j = Math.floor(rand * (i + 1));
        var temp = output[i]; output[i] = output[j]; output[j] = temp;
    }
    return output;
}

function cupSnakeGroup_(index, groupCount) {
    var cycle = Math.floor(index / groupCount);
    var position = index % groupCount;
    var groupIndex = cycle % 2 === 0 ? position : (groupCount - 1 - position);
    return String.fromCharCode(65 + groupIndex);
}

function cupBuildPair_(id, seed, group, player1, player2) {
    return {
        id: id,
        seed: seed,
        group: group,
        player1Stt: player1 ? player1.stt : 0,
        player1Name: player1 ? player1.name : "",
        player1Rating: player1 ? Number(player1.rating || 0) : 0,
        player2Stt: player2 ? player2.stt : 0,
        player2Name: player2 ? player2.name : "",
        player2Rating: player2 ? Number(player2.rating || 0) : 0,
        totalRating: Number(((player1 ? Number(player1.rating || 0) : 0) + (player2 ? Number(player2.rating || 0) : 0)).toFixed(3))
    };
}

function drawCupPairsAuto() {
    var cup = cupCurrent_();
    if (!cup.participantsLocked) {
        showToast("Hãy xác nhận danh sách người chơi trước.");
        return;
    }
    if (cup.pairsLocked) {
        showToast("Hãy mở khóa cặp trước khi bốc lại.");
        return;
    }

    var sorted = (cup.participants || []).slice().sort(function(a, b) {
        if (Number(b.rating) !== Number(a.rating)) return Number(b.rating) - Number(a.rating);
        return parseInt(a.stt) - parseInt(b.stt);
    });
    var half = sorted.length / 2;
    var high = cupShuffle_(sorted.slice(0, half));
    var low = cupShuffle_(sorted.slice(half));
    var rawPairs = high.map(function(player, index) {
        return cupBuildPair_("TMP" + (index + 1), 0, "", player, low[index]);
    });

    rawPairs.sort(function(a, b) {
        if (b.totalRating !== a.totalRating) return b.totalRating - a.totalRating;
        return String(a.player1Stt + "-" + a.player2Stt).localeCompare(String(b.player1Stt + "-" + b.player2Stt));
    });

    rawPairs = rawPairs.map(function(pair, index) {
        pair.id = "P" + (index + 1);
        pair.seed = index + 1;
        pair.group = cupSnakeGroup_(index, cup.groupCount);
        return pair;
    });

    var next = cupCloneClient_(cup);
    next.pairingMode = "auto";
    next.pairs = rawPairs;
    next.pairsLocked = false;
    next.matches = [];
    next.tieBreakLots = {};
    cupSaveSnapshot_(next, "Đã bốc cặp cân bằng và chia bảng.");
}

function startManualCupPairs() {
    var cup = cupCurrent_();
    if (!cup.participantsLocked || cup.pairsLocked) return;
    var participants = (cup.participants || []).slice().sort(function(a, b) { return a.stt - b.stt; });
    cupPairDraft_ = [];
    cupPairDraftManual_ = true;
    for (var i = 0; i < participants.length; i += 2) {
        cupPairDraft_.push(cupBuildPair_(
            "P" + (cupPairDraft_.length + 1),
            cupPairDraft_.length + 1,
            cupSnakeGroup_(cupPairDraft_.length, cup.groupCount),
            participants[i], participants[i + 1]
        ));
    }
    renderCupTab();
}

function cupInitPairDraft_(cup) {
    if (!Array.isArray(cupPairDraft_)) cupPairDraft_ = cupCloneClient_(cup.pairs || []);
}

function setCupManualPairValue(index, field, value) {
    var cup = cupCurrent_();
    cupInitPairDraft_(cup);
    var pair = cupPairDraft_[parseInt(index)];
    if (!pair) return;

    if (field === "group") {
        pair.group = String(value || "").toUpperCase();
        return;
    }

    var participant = cupParticipantByStt_(cup, parseInt(value));
    var prefix = field === "player1" ? "player1" : "player2";
    pair[prefix + "Stt"] = participant ? participant.stt : 0;
    pair[prefix + "Name"] = participant ? participant.name : "";
    pair[prefix + "Rating"] = participant ? Number(participant.rating || 0) : 0;
    pair.totalRating = Number((Number(pair.player1Rating || 0) + Number(pair.player2Rating || 0)).toFixed(3));

    var totalEl = document.getElementById("cupPairTotal-" + index);
    if (totalEl) totalEl.textContent = pair.totalRating.toFixed(2);
}

function cupValidatePairDraft_(cup, pairs) {
    var expectedPairs = cupExpectedPlayers_(cup) / 2;
    if (!Array.isArray(pairs) || pairs.length !== expectedPairs) return "Cần đủ " + expectedPairs + " cặp.";

    var used = {};
    var groupCounts = {};
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i];
        if (!pair.player1Stt || !pair.player2Stt) return "Cặp " + (i + 1) + " chưa chọn đủ hai người.";
        if (pair.player1Stt === pair.player2Stt) return "Một người không thể tự ghép với chính mình.";
        if (used[pair.player1Stt] || used[pair.player2Stt]) return "Có người đang xuất hiện ở nhiều hơn một cặp.";
        used[pair.player1Stt] = true; used[pair.player2Stt] = true;
        groupCounts[pair.group] = (groupCounts[pair.group] || 0) + 1;
    }

    for (var g = 0; g < cup.groupCount; g++) {
        var group = String.fromCharCode(65 + g);
        if ((groupCounts[group] || 0) !== cup.pairsPerGroup) return "Bảng " + group + " phải có đúng " + cup.pairsPerGroup + " cặp.";
    }
    return "";
}

function saveManualCupPairs() {
    var cup = cupCurrent_();
    cupInitPairDraft_(cup);
    var error = cupValidatePairDraft_(cup, cupPairDraft_);
    if (error) { showToast(error); return; }
    var next = cupCloneClient_(cup);
    next.pairingMode = "manual";
    next.pairs = cupCloneClient_(cupPairDraft_);
    next.pairsLocked = false;
    next.matches = [];
    next.tieBreakLots = {};
    cupSaveSnapshot_(next, "Đã lưu cặp ghép thủ công.");
}

function lockCupPairs() {
    var cup = cupCurrent_();
    var pairs = Array.isArray(cupPairDraft_) ? cupPairDraft_ : (cup.pairs || []);
    var error = cupValidatePairDraft_(cup, pairs);
    if (error) { showToast(error); return; }
    if (!confirm("Khóa cặp và tạo toàn bộ trận vòng bảng cùng lịch dự kiến?")) return;
    var next = cupCloneClient_(cup);
    next.pairs = cupCloneClient_(pairs);
    next.pairsLocked = true;
    next.matches = [];
    next.tieBreakLots = {};
    next.status = "active";
    cupSaveSnapshot_(next, "Đã khóa cặp và tạo lịch thi đấu.");
}

function unlockCupPairs() {
    if (!confirm("Mở khóa cặp sẽ xóa lịch và toàn bộ kết quả CUP. Tiếp tục?")) return;
    var next = cupCloneClient_(cupCurrent_());
    next.pairsLocked = false;
    next.matches = [];
    next.tieBreakLots = {};
    next.status = "pairing";
    cupSaveSnapshot_(next, "Đã mở khóa cặp đấu.");
}

function cupParticipantOptions_(cup, selectedStt) {
    return '<option value="">-- Chọn người --</option>' + (cup.participants || []).map(function(player) {
        return '<option value="' + player.stt + '" ' + (parseInt(selectedStt) === parseInt(player.stt) ? "selected" : "") + '>' + cupEscape_(player.name) + ' · ' + Number(player.rating || 0).toFixed(2) + '</option>';
    }).join("");
}

function renderCupPairs_(cup) {
    if (!cup.participantsLocked) {
        return '<div class="cup-empty"><i class="fa-solid fa-user-check"></i><h3>Chưa chốt người chơi</h3><p>Hãy hoàn tất tab Người chơi trước khi ghép cặp.</p><button type="button" onclick="switchCupSection(\'participants\')" class="cup-btn cup-btn-primary">Sang Người chơi</button></div>';
    }

    cupInitPairDraft_(cup);
    var pairs = cupPairDraft_ || [];
    var managerControls = cupIsManager_()
        ? '<div class="cup-action-row">' +
            (cup.pairsLocked
                ? '<button type="button" onclick="unlockCupPairs()" class="cup-btn cup-btn-secondary"><i class="fa-solid fa-lock-open"></i> Mở khóa cặp</button>'
                : '<button type="button" onclick="drawCupPairsAuto()" class="cup-btn cup-btn-primary"><i class="fa-solid fa-shuffle"></i> Bốc cặp cân bằng</button><button type="button" onclick="startManualCupPairs()" class="cup-btn cup-btn-secondary"><i class="fa-solid fa-hand"></i> Ghép thủ công</button>') +
          '</div>'
        : "";

    var manualEditing = cupIsManager_() && !cup.pairsLocked && Array.isArray(cupPairDraft_) && (cupPairDraftManual_ || cup.pairingMode === "manual");
    var pairCards = pairs.length ? pairs.map(function(pair, index) {
        if (manualEditing) {
            var groupOptions = [];
            for (var g = 0; g < cup.groupCount; g++) {
                var group = String.fromCharCode(65 + g);
                groupOptions.push('<option value="' + group + '" ' + (pair.group === group ? "selected" : "") + '>Bảng ' + group + '</option>');
            }
            return '<div class="cup-pair-card is-editing"><div class="cup-pair-top"><span class="cup-seed">#' + (index + 1) + '</span><select onchange="setCupManualPairValue(' + index + ',\'group\',this.value)" class="cup-compact-select">' + groupOptions.join("") + '</select><span class="cup-total">Σ <strong id="cupPairTotal-' + index + '">' + Number(pair.totalRating || 0).toFixed(2) + '</strong></span></div>' +
                '<select onchange="setCupManualPairValue(' + index + ',\'player1\',this.value)" class="cup-player-select">' + cupParticipantOptions_(cup, pair.player1Stt) + '</select>' +
                '<div class="cup-pair-plus">+</div><select onchange="setCupManualPairValue(' + index + ',\'player2\',this.value)" class="cup-player-select">' + cupParticipantOptions_(cup, pair.player2Stt) + '</select></div>';
        }
        return '<div class="cup-pair-card"><div class="cup-pair-top"><span class="cup-seed">Hạt giống ' + (pair.seed || index + 1) + '</span><span class="cup-group-badge">Bảng ' + cupEscape_(pair.group) + '</span><span class="cup-total">Σ <strong>' + Number(pair.totalRating || 0).toFixed(2) + '</strong></span></div>' +
            '<div class="cup-pair-player"><span>' + cupEscape_(pair.player1Name) + '</span><small>' + Number(pair.player1Rating || 0).toFixed(2) + '</small></div><div class="cup-pair-plus">+</div>' +
            '<div class="cup-pair-player"><span>' + cupEscape_(pair.player2Name) + '</span><small>' + Number(pair.player2Rating || 0).toFixed(2) + '</small></div></div>';
    }).join("") : '<div class="cup-inline-empty cup-span-all"><i class="fa-solid fa-people-arrows-left-right"></i><span>Chưa tạo cặp đấu.</span></div>';

    var footer = cupIsManager_() && !cup.pairsLocked && pairs.length
        ? '<div class="cup-pair-footer">' + (manualEditing ? '<button type="button" onclick="saveManualCupPairs()" class="cup-btn cup-btn-secondary">Lưu cặp thủ công</button>' : "") + '<button type="button" onclick="lockCupPairs()" class="cup-btn cup-btn-primary"><i class="fa-solid fa-lock"></i> Khóa cặp & tạo lịch</button></div>'
        : "";

    return '<div class="cup-card"><div class="cup-card-head cup-card-head-wrap"><div><span class="cup-eyebrow">BƯỚC 2</span><h3>Bốc cặp và chia bảng</h3><p>Nhóm trình cao được ghép ngẫu nhiên với nhóm trình thấp, sau đó rải hạt giống zích-zắc.</p></div>' + managerControls + '</div>' +
        '<div class="cup-pair-grid">' + pairCards + '</div>' + footer + '</div>';
}

function cupScoreHtml_(match) {
    if (match.scoreA === null || match.scoreA === undefined) return '<span class="cup-score-pending">Chưa có</span>';
    return '<span class="cup-score">' + parseInt(match.scoreA) + '<em>–</em>' + parseInt(match.scoreB) + '</span>';
}

function cupResultButtonHtml_(match) {
    var completed = match.scoreA !== null && match.scoreA !== undefined;
    if (completed && !cupIsManager_()) return "";
    if (!match.pairAId || !match.pairBId) return "";
    return '<button type="button" onclick="openCupResultModal(\'' + cupEscape_(match.id) + '\')" class="cup-icon-btn" title="' + (completed ? "Sửa kết quả" : "Nhập kết quả") + '"><i class="fa-solid ' + (completed ? "fa-pen" : "fa-plus") + '"></i></button>';
}

function cupGroupMatchRow_(match) {
    return '<div class="cup-match-row"><div class="cup-match-round"><strong>L' + (parseInt(match.round) || 0) + '</strong><small>' + cupEscape_(match.scheduledTime || "--:--") + '</small></div>' +
        '<div class="cup-match-team is-a">' + cupEscape_(match.pairAName || "Chờ xác định") + '</div>' + cupScoreHtml_(match) +
        '<div class="cup-match-team is-b">' + cupEscape_(match.pairBName || "Chờ xác định") + '</div><div class="cup-match-action">' + cupResultButtonHtml_(match) + '</div></div>';
}

function renderCupStandingsTable_(cup, group) {
    var rows = (cup.standings && cup.standings[group]) || [];
    if (!rows.length) return '<div class="cup-inline-empty"><span>Chưa có dữ liệu bảng.</span></div>';

    return '<div class="cup-table-scroll"><table class="cup-table"><thead><tr><th>Hạng</th><th>Cặp đấu</th><th>Tr</th><th>T</th><th>H</th><th>B</th><th>HS</th><th>Điểm</th></tr></thead><tbody>' + rows.map(function(row) {
        var qualifyLimit = cup.groupCount === 3 ? 3 : 2;
        return '<tr class="' + (row.rank <= qualifyLimit ? "is-qualifying" : "") + '"><td><span class="cup-rank">' + row.rank + '</span></td><td><strong>' + cupEscape_(row.pairName) + '</strong>' +
            (row.tieType === "Bốc thăm" ? '<small class="cup-tie-label">Cần bốc thăm</small>' : row.tieType === "Đã bốc thăm" ? '<small class="cup-lot-label">Bốc thăm: ' + row.lot + '</small>' : "") +
            '</td><td>' + row.played + '</td><td>' + row.wins + '</td><td>' + row.draws + '</td><td>' + row.losses + '</td><td>' + (row.diff > 0 ? "+" : "") + row.diff + '</td><td><strong>' + row.points + '</strong></td></tr>';
    }).join("") + '</tbody></table></div>';
}

function cupTieActionsHtml_(cup, group) {
    if (!cupIsManager_()) return "";
    var blocks = (cup.qualificationBlocked || []).filter(function(item) {
        return item.scope === "GROUP_" + group;
    });
    return blocks.map(function(block) {
        return '<button type="button" onclick=\'drawCupTieBreak("' + cupEscape_(block.scope) + '","' + group + '",' + JSON.stringify(block.pairIds) + ')\' class="cup-btn cup-btn-warning"><i class="fa-solid fa-shuffle"></i> Bốc thăm phân hạng bảng ' + group + '</button>';
    }).join("");
}

function renderCupGroups_(cup) {
    if (!cup.pairsLocked) {
        return '<div class="cup-empty"><i class="fa-solid fa-lock"></i><h3>Chưa khóa cặp đấu</h3><p>Bảng đấu và lịch chỉ được tạo sau khi khóa cặp.</p><button type="button" onclick="switchCupSection(\'pairs\')" class="cup-btn cup-btn-primary">Sang Cặp đấu</button></div>';
    }

    var cards = [];
    for (var g = 0; g < cup.groupCount; g++) {
        var group = String.fromCharCode(65 + g);
        var matchesInGroup = (cup.matches || []).filter(function(match) { return match.stage === "group" && match.group === group; });
        cards.push('<div class="cup-card cup-group-card"><div class="cup-card-head"><div><span class="cup-eyebrow">VÒNG BẢNG</span><h3>Bảng ' + group + '</h3></div><span class="cup-stage-chip">' + matchesInGroup.filter(function(m) { return m.status === "completed"; }).length + '/' + matchesInGroup.length + ' trận</span></div>' +
            renderCupStandingsTable_(cup, group) + cupTieActionsHtml_(cup, group) + '<div class="cup-group-matches">' + matchesInGroup.map(cupGroupMatchRow_).join("") + '</div></div>');
    }

    var globalBlock = (cup.qualificationBlocked || []).filter(function(item) { return item.scope === "GLOBAL_THIRD"; })[0];
    var bestThird = cup.groupCount === 3 && (cup.bestThirds || []).length
        ? '<div class="cup-card cup-span-all"><div class="cup-card-head"><div><span class="cup-eyebrow">SO SÁNH LIÊN BẢNG</span><h3>Các cặp hạng ba</h3></div>' +
            (globalBlock && cupIsManager_() ? '<button type="button" onclick=\'drawCupTieBreak("GLOBAL_THIRD","",' + JSON.stringify(globalBlock.pairIds) + ')\' class="cup-btn cup-btn-warning"><i class="fa-solid fa-shuffle"></i> Bốc thăm hạng ba</button>' : "") + '</div>' +
            '<div class="cup-table-scroll"><table class="cup-table"><thead><tr><th>Thứ tự</th><th>Cặp</th><th>Bảng</th><th>Điểm</th><th>HS</th><th>Game thắng</th><th>Kết quả</th></tr></thead><tbody>' +
            cup.bestThirds.map(function(row, index) { return '<tr class="' + (index < 2 ? "is-qualifying" : "") + '"><td>' + (index + 1) + '</td><td><strong>' + cupEscape_(row.pairName) + '</strong></td><td>' + cupEscape_(row.group) + '</td><td>' + row.points + '</td><td>' + row.diff + '</td><td>' + row.gamesFor + '</td><td>' + (index < 2 ? '<span class="cup-qualified">Đi tiếp</span>' : "Dừng") + '</td></tr>'; }).join("") +
            '</tbody></table></div></div>'
        : "";

    return '<div class="cup-group-grid">' + cards.join("") + bestThird + '</div>';
}

function drawCupTieBreak(scope, group, pairIds) {
    if (!confirm("Bốc thăm ngẫu nhiên để quyết định thứ tự các cặp đang bằng toàn bộ chỉ số?")) return;
    var cup = cupCurrent_();
    cupCallWrite_("drawCupTieBreak", {
        expectedVersion: cup.version,
        scope: scope,
        group: group,
        pairIds: pairIds
    }, "Đã bốc thăm phân hạng.");
}

function renderCupSchedule_(cup) {
    if (!cup.pairsLocked) return '<div class="cup-empty"><i class="fa-regular fa-calendar"></i><h3>Chưa có lịch thi đấu</h3><p>Lịch được tạo tự động sau khi khóa cặp.</p></div>';
    var sorted = (cup.matches || []).slice().sort(cupMatchSort_);
    var controls = cupIsManager_() ? '<div class="cup-action-row"><button type="button" onclick="regenerateCupSchedule()" class="cup-btn cup-btn-secondary"><i class="fa-solid fa-arrows-rotate"></i> Tạo lại lịch tự động</button></div>' : "";

    return '<div class="cup-card"><div class="cup-card-head cup-card-head-wrap"><div><span class="cup-eyebrow">LỊCH DỰ KIẾN</span><h3>Lượt đấu, giờ và sân</h3><p>Giờ có thể thay đổi theo tiến độ thực tế; lượt và sân là thông tin ưu tiên.</p></div>' + controls + '</div>' +
        '<div class="cup-schedule-list">' + sorted.map(function(match) {
            return '<div class="cup-schedule-row ' + (match.status === "completed" ? "is-completed" : "") + '"><div class="cup-schedule-when"><strong>' + cupEscape_(match.scheduledTime || "--:--") + '</strong><small>' + cupEscape_(cupFormatDate_(match.scheduledDate)) + '</small></div>' +
                '<div class="cup-schedule-court"><i class="fa-solid fa-location-dot"></i><span>' + cupEscape_(match.court || "Chờ xếp sân") + '</span></div>' +
                '<div class="cup-schedule-stage"><strong>' + cupEscape_(match.stage === "group" ? "Bảng " + match.group + " · Lượt " + match.round : cupStageLabel_(match.stage)) + '</strong><small>' + cupEscape_(match.id) + '</small></div>' +
                '<div class="cup-schedule-teams"><span>' + cupEscape_(match.pairAName || "Chờ xác định") + '</span><em>vs</em><span>' + cupEscape_(match.pairBName || "Chờ xác định") + '</span></div>' +
                '<div class="cup-schedule-result">' + cupScoreHtml_(match) + cupResultButtonHtml_(match) + (cupIsManager_() ? '<button type="button" onclick="openCupScheduleModal(\'' + cupEscape_(match.id) + '\')" class="cup-icon-btn" title="Sửa lịch"><i class="fa-solid fa-calendar-pen"></i></button>' : "") + '</div></div>';
        }).join("") + '</div></div>';
}

function regenerateCupSchedule() {
    if (!confirm("Tạo lại toàn bộ ngày, giờ và sân theo Cài đặt CUP? Kết quả trận vẫn được giữ nguyên.")) return;
    var next = cupCloneClient_(cupCurrent_());
    (next.matches || []).forEach(function(match) {
        match.scheduledDate = "";
        match.scheduledTime = "";
        match.court = "";
    });
    cupSaveSnapshot_(next, "Đã tạo lại lịch thi đấu.");
}

function cupKnockoutCard_(match) {
    if (!match) return '<div class="cup-bracket-match is-waiting"><span>Chờ xác định</span></div>';
    var winner = match.winnerPairId;
    return '<div class="cup-bracket-match ' + (match.status === "completed" ? "is-completed" : "") + '"><div class="cup-bracket-meta"><span>' + cupEscape_(match.scheduledTime || "--:--") + '</span><span>' + cupEscape_(match.court || "Chờ sân") + '</span></div>' +
        '<div class="cup-bracket-team ' + (winner && winner === match.pairAId ? "is-winner" : "") + '"><span>' + cupEscape_(match.pairAName || "Chờ xác định") + '</span><strong>' + (match.scoreA === null ? "–" : match.scoreA) + '</strong></div>' +
        '<div class="cup-bracket-team ' + (winner && winner === match.pairBId ? "is-winner" : "") + '"><span>' + cupEscape_(match.pairBName || "Chờ xác định") + '</span><strong>' + (match.scoreB === null ? "–" : match.scoreB) + '</strong></div>' +
        '<div class="cup-bracket-action">' + cupResultButtonHtml_(match) + '</div></div>';
}

function renderCupKnockout_(cup) {
    if (!cup.pairsLocked) return '<div class="cup-empty"><i class="fa-solid fa-trophy"></i><h3>Chưa có nhánh vòng trong</h3><p>Hãy khóa cặp và hoàn thành vòng bảng trước.</p></div>';
    var qf = (cup.matches || []).filter(function(m) { return m.stage === "QF"; }).sort(function(a, b) { return a.matchNo - b.matchNo; });
    var sf = (cup.matches || []).filter(function(m) { return m.stage === "SF"; }).sort(function(a, b) { return a.matchNo - b.matchNo; });
    var finalMatch = (cup.matches || []).filter(function(m) { return m.stage === "F"; })[0];
    var groupComplete = cup.progress && cup.progress.groupTotal && cup.progress.groupCompleted === cup.progress.groupTotal;
    var blocked = (cup.qualificationBlocked || []).length > 0;

    if (!qf.length && !sf.length && !groupComplete) {
        return '<div class="cup-empty"><i class="fa-solid fa-hourglass-half"></i><h3>Đang chờ vòng bảng</h3><p>Nhánh loại trực tiếp sẽ tự xuất hiện khi toàn bộ trận vòng bảng hoàn thành.</p><button type="button" onclick="switchCupSection(\'groups\')" class="cup-btn cup-btn-primary">Xem Bảng đấu</button></div>';
    }
    if (!qf.length && !sf.length && blocked) {
        return '<div class="cup-empty is-warning"><i class="fa-solid fa-shuffle"></i><h3>Cần bốc thăm phân hạng</h3><p>Có cặp bằng toàn bộ chỉ số. Admin cần bốc thăm tại tab Bảng đấu trước khi tạo nhánh vòng trong.</p><button type="button" onclick="switchCupSection(\'groups\')" class="cup-btn cup-btn-warning">Sang Bảng đấu</button></div>';
    }

    return (cup.championPairId ? '<div class="cup-champion"><div class="cup-crown">🏆</div><div><small>VÔ ĐỊCH ' + cupEscape_(cup.name) + '</small><strong>' + cupEscape_(cup.championName) + '</strong></div></div>' : "") +
        '<div class="cup-bracket">' +
            (qf.length ? '<div class="cup-bracket-column"><h3>Tứ kết</h3>' + qf.map(cupKnockoutCard_).join("") + '</div>' : "") +
            '<div class="cup-bracket-column"><h3>Bán kết</h3>' + (sf.length ? sf.map(cupKnockoutCard_).join("") : cupKnockoutCard_(null) + cupKnockoutCard_(null)) + '</div>' +
            '<div class="cup-bracket-column is-final"><h3>Chung kết</h3>' + cupKnockoutCard_(finalMatch) + '</div>' +
        '</div>';
}

function renderCupRulesText_(rules) {
    var lines = String(rules || "").split(/\r?\n/).map(function(line) { return line.trim(); }).filter(Boolean);
    if (!lines.length) return '<div class="cup-inline-empty"><span>Chưa có Rule của giải.</span></div>';
    return '<ol class="cup-rule-list">' + lines.map(function(line) {
        return '<li>' + cupEscape_(line.replace(/^[-•]\s*/, "")) + '</li>';
    }).join("") + '</ol>';
}

function renderCupRules_(cup) {
    return '<div class="cup-grid-2 cup-rule-layout"><div class="cup-card"><div class="cup-card-head"><div><span class="cup-eyebrow">RULE GIẢI ĐẤU</span><h3>Luật thi đấu CUP</h3></div></div>' + renderCupRulesText_(cup.rules) + '</div>' +
        (cupIsManager_() ? '<div class="cup-card"><div class="cup-card-head"><div><span class="cup-eyebrow">BAN TỔ CHỨC</span><h3>Chỉnh sửa Rule</h3></div></div><form onsubmit="saveCupRules(event)" class="cup-form"><label>Nội dung, mỗi quy định một dòng</label><textarea id="cupRulesInput" rows="14" maxlength="16000">' + cupEscape_(cup.rules) + '</textarea><button type="submit" class="cup-btn cup-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Lưu Rule</button></form></div>' : "") + '</div>';
}

function saveCupRules(event) {
    event.preventDefault();
    var next = cupCloneClient_(cupCurrent_());
    next.rules = document.getElementById("cupRulesInput").value.trim();
    cupSaveSnapshot_(next, "Đã lưu Rule của giải.");
}

function renderCupSettings_(cup) {
    return '<div class="cup-grid-2"><div class="cup-card"><div class="cup-card-head"><div><span class="cup-eyebrow">THIẾT LẬP GIẢI</span><h3>Thông tin và thể thức</h3></div></div>' +
        '<form onsubmit="saveCupSettings(event)" class="cup-form"><label class="cup-switch-row"><span><strong>Kích hoạt Giải đấu CUP</strong><small>Khi bật, mọi thành viên sẽ thấy tab CUP.</small></span><input type="checkbox" id="cupEnabledInput" ' + (cup.enabled ? "checked" : "") + '><i></i></label>' +
        '<label>Tên giải đấu<input type="text" id="cupNameInput" maxlength="160" required value="' + cupEscape_(cup.name) + '"></label>' +
        '<div class="cup-form-grid"><label>Ngày thi đấu<input type="date" id="cupDateInput" value="' + cupEscape_(cup.date) + '"></label><label>Giờ bắt đầu<input type="time" id="cupStartInput" required value="' + cupEscape_(cup.startTime) + '"></label>' +
        '<label>Số sân<input type="number" id="cupCourtCountInput" min="1" max="12" required value="' + parseInt(cup.courtCount) + '"></label><label>Thời lượng/trận (phút)<input type="number" id="cupDurationInput" min="15" max="180" step="5" required value="' + parseInt(cup.matchDuration) + '"></label>' +
        '<label>Số bảng<select id="cupGroupCountInput"><option value="2" ' + (cup.groupCount === 2 ? "selected" : "") + '>2 bảng</option><option value="3" ' + (cup.groupCount === 3 ? "selected" : "") + '>3 bảng</option><option value="4" ' + (cup.groupCount === 4 ? "selected" : "") + '>4 bảng</option></select></label>' +
        '<label>Số cặp mỗi bảng<select id="cupPairsPerGroupInput">' + [3,4,5,6,7,8].map(function(n) { return '<option value="' + n + '" ' + (cup.pairsPerGroup === n ? "selected" : "") + '>' + n + ' cặp</option>'; }).join("") + '</select></label></div>' +
        '<div class="cup-form-note"><i class="fa-solid fa-circle-info"></i><span>Thay số bảng hoặc số cặp chỉ thực hiện được trước khi xác nhận người chơi. Sau khi đổi ngày/giờ/sân, vào Lịch đấu và bấm “Tạo lại lịch tự động”.</span></div>' +
        '<button type="submit" class="cup-btn cup-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Lưu cài đặt CUP</button></form></div>' +
        '<div class="cup-card cup-danger-card"><div class="cup-card-head"><div><span class="cup-eyebrow">KẾT THÚC GIẢI</span><h3>Reset dữ liệu CUP</h3></div></div><p>Reset sẽ xóa đăng ký, cặp đấu, lịch và mọi kết quả CUP. Trận thường, tiền góc và thành tích CLB không bị ảnh hưởng.</p><div class="cup-reset-summary"><span><i class="fa-solid fa-users"></i> ' + (cup.participants || []).length + ' người</span><span><i class="fa-solid fa-people-group"></i> ' + (cup.pairs || []).length + ' cặp</span><span><i class="fa-solid fa-list-check"></i> ' + (cup.matches || []).length + ' trận</span></div><button type="button" onclick="resetCupTournament()" class="cup-btn cup-btn-danger"><i class="fa-solid fa-rotate-left"></i> Reset toàn bộ giải CUP</button></div></div>';
}

function saveCupSettings(event) {
    event.preventDefault();
    var cup = cupCurrent_();
    var next = cupCloneClient_(cup);
    var newGroupCount = parseInt(document.getElementById("cupGroupCountInput").value);
    var newPairsPerGroup = parseInt(document.getElementById("cupPairsPerGroupInput").value);

    if (cup.participantsLocked && (newGroupCount !== cup.groupCount || newPairsPerGroup !== cup.pairsPerGroup)) {
        showToast("Hãy mở khóa danh sách người chơi trước khi đổi số bảng hoặc số cặp.");
        return;
    }

    next.enabled = document.getElementById("cupEnabledInput").checked;
    next.name = document.getElementById("cupNameInput").value.trim();
    next.date = document.getElementById("cupDateInput").value;
    next.startTime = document.getElementById("cupStartInput").value;
    next.courtCount = parseInt(document.getElementById("cupCourtCountInput").value);
    next.matchDuration = parseInt(document.getElementById("cupDurationInput").value);
    next.groupCount = newGroupCount;
    next.pairsPerGroup = newPairsPerGroup;
    next.status = next.enabled ? (next.participantsLocked ? (next.pairsLocked ? "active" : "pairing") : "registration") : "draft";
    cupSaveSnapshot_(next, "Đã lưu cài đặt CUP.");
}

function resetCupTournament() {
    var cup = cupCurrent_();
    var typed = prompt('Để xác nhận reset, hãy nhập chữ: RESET CUP');
    if (String(typed || "").trim().toUpperCase() !== "RESET CUP") {
        if (typed !== null) showToast("Nội dung xác nhận chưa đúng.");
        return;
    }
    cupCallWrite_("resetCupData", { expectedVersion: cup.version }, "Đã reset dữ liệu CUP.");
}

function cupFindMatch_(matchId) {
    return (cupCurrent_().matches || []).filter(function(match) { return String(match.id) === String(matchId); })[0] || null;
}

function cupResultModalHtml_() {
    return '<div id="cupResultModal" class="cup-modal hidden"><div class="cup-modal-card"><button type="button" onclick="closeCupResultModal()" class="cup-modal-close"><i class="fa-solid fa-xmark"></i></button><span class="cup-eyebrow">KẾT QUẢ CUP</span><h3 id="cupResultTitle">Nhập tỷ số</h3><form onsubmit="submitCupResultForm(event)" class="cup-result-form"><input type="hidden" id="cupResultMatchId"><div class="cup-result-team"><span id="cupResultTeamA">Đội A</span><input type="number" id="cupResultScoreA" min="0" max="6" required inputmode="numeric"></div><div class="cup-result-separator">–</div><div class="cup-result-team"><span id="cupResultTeamB">Đội B</span><input type="number" id="cupResultScoreB" min="0" max="6" required inputmode="numeric"></div><p id="cupResultHint"></p><button type="submit" class="cup-btn cup-btn-primary">Lưu kết quả</button></form></div></div>';
}

function openCupResultModal(matchId) {
    var match = cupFindMatch_(matchId);
    if (!match || !match.pairAId || !match.pairBId) return;
    var completed = match.scoreA !== null && match.scoreA !== undefined;
    if (completed && !cupIsManager_()) {
        showToast("Kết quả đã được ghi. Chỉ Admin / Owner được sửa.");
        return;
    }
    document.getElementById("cupResultMatchId").value = match.id;
    document.getElementById("cupResultTitle").textContent = (completed ? "Sửa " : "Nhập ") + cupStageLabel_(match.stage);
    document.getElementById("cupResultTeamA").textContent = match.pairAName;
    document.getElementById("cupResultTeamB").textContent = match.pairBName;
    document.getElementById("cupResultScoreA").value = completed ? match.scoreA : "";
    document.getElementById("cupResultScoreB").value = completed ? match.scoreB : "";
    document.getElementById("cupResultHint").textContent = match.stage === "group" ? "Vòng bảng: chấp nhận 5–5 hoặc một cặp thắng 6 game." : "Loại trực tiếp: bắt buộc có một cặp thắng 6 game.";
    document.getElementById("cupResultModal").classList.remove("hidden");
}

function closeCupResultModal() {
    var modal = document.getElementById("cupResultModal");
    if (modal) modal.classList.add("hidden");
}

function submitCupResultForm(event) {
    event.preventDefault();
    var cup = cupCurrent_();
    var matchId = document.getElementById("cupResultMatchId").value;
    var scoreA = parseInt(document.getElementById("cupResultScoreA").value);
    var scoreB = parseInt(document.getElementById("cupResultScoreB").value);
    closeCupResultModal();
    cupCallWrite_("submitCupResult", {
        expectedVersion: cup.version,
        matchId: matchId,
        scoreA: scoreA,
        scoreB: scoreB
    }, "Đã lưu kết quả CUP.");
}

function cupScheduleModalHtml_() {
    return '<div id="cupScheduleModal" class="cup-modal hidden"><div class="cup-modal-card"><button type="button" onclick="closeCupScheduleModal()" class="cup-modal-close"><i class="fa-solid fa-xmark"></i></button><span class="cup-eyebrow">SỬA LỊCH</span><h3 id="cupScheduleTitle">Trận CUP</h3><form onsubmit="saveCupScheduleForm(event)" class="cup-form"><input type="hidden" id="cupScheduleMatchId"><label>Ngày dự kiến<input type="date" id="cupScheduleDate" required></label><label>Giờ dự kiến<input type="time" id="cupScheduleTime" required></label><label>Sân<input type="text" id="cupScheduleCourt" maxlength="60" required placeholder="Ví dụ: Sân 1"></label><button type="submit" class="cup-btn cup-btn-primary">Lưu lịch trận</button></form></div></div>';
}

function openCupScheduleModal(matchId) {
    if (!cupIsManager_()) return;
    var match = cupFindMatch_(matchId);
    if (!match) return;
    document.getElementById("cupScheduleMatchId").value = match.id;
    document.getElementById("cupScheduleTitle").textContent = match.pairAName + " vs " + match.pairBName;
    document.getElementById("cupScheduleDate").value = match.scheduledDate || cupCurrent_().date || "";
    document.getElementById("cupScheduleTime").value = match.scheduledTime || cupCurrent_().startTime || "06:00";
    document.getElementById("cupScheduleCourt").value = match.court || "";
    document.getElementById("cupScheduleModal").classList.remove("hidden");
}

function closeCupScheduleModal() {
    var modal = document.getElementById("cupScheduleModal");
    if (modal) modal.classList.add("hidden");
}

function saveCupScheduleForm(event) {
    event.preventDefault();
    var next = cupCloneClient_(cupCurrent_());
    var matchId = document.getElementById("cupScheduleMatchId").value;
    var match = (next.matches || []).filter(function(item) { return item.id === matchId; })[0];
    if (!match) return;
    match.scheduledDate = document.getElementById("cupScheduleDate").value;
    match.scheduledTime = document.getElementById("cupScheduleTime").value;
    match.court = document.getElementById("cupScheduleCourt").value.trim();
    closeCupScheduleModal();
    cupSaveSnapshot_(next, "Đã cập nhật lịch trận CUP.");
}

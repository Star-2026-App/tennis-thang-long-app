// Rich-text implementation for Ver2.0.9.

// ======================================================
// RULES / NOTIFICATIONS RICH-TEXT EDITOR (v2.0.9)
// Module dùng chung cho tạo mới, sửa, xem trước và lưu nháp.
// ======================================================

let ruleEditorInstance_ = null;
let editingRuleId_ = null;
let ruleDraftLoadedActor_ = null;

function canManageRules_() {
    return currentUserRole === 'admin' || currentUserRole === 'owner';
}

function initRuleEditor_() {
    let editorElement = document.getElementById('ruleContentEditor');
    if (!editorElement || ruleEditorInstance_) return;

    if (window.Quill) {
        try {
            let Font = Quill.import('formats/font');
            Font.whitelist = ['serif', 'monospace', 'arial', 'times-new-roman'];
            Quill.register(Font, true);
        } catch (err) {
            console.warn('QUILL FONT REGISTER WARNING:', err);
        }

        ruleEditorInstance_ = new Quill('#ruleContentEditor', {
            theme: 'snow',
            placeholder: 'Nhập nội dung thông báo hoặc quy định...',
            modules: {
                toolbar: '#ruleEditorToolbar'
            }
        });
    } else {
        // CDN lỗi không được làm hỏng toàn bộ tab. Người quản trị vẫn
        // có thể nhập văn bản cơ bản; HTML đầu ra vẫn được lọc như cũ.
        editorElement.contentEditable = 'true';
        editorElement.classList.add('rule-editor-fallback');
        let toolbar = document.getElementById('ruleEditorToolbar');
        if (toolbar) toolbar.classList.add('hidden');
    }

    restoreRuleDraft_();
}

function getRuleEditorElement_() {
    if (ruleEditorInstance_ && ruleEditorInstance_.root) {
        return ruleEditorInstance_.root;
    }
    return document.getElementById('ruleContentEditor');
}

function getRuleEditorHtml_() {
    let editor = getRuleEditorElement_();
    return editor ? String(editor.innerHTML || '') : '';
}

function getRuleEditorText_() {
    if (ruleEditorInstance_ && typeof ruleEditorInstance_.getText === 'function') {
        return String(ruleEditorInstance_.getText() || '').trim();
    }
    let editor = getRuleEditorElement_();
    return editor ? String(editor.innerText || editor.textContent || '').trim() : '';
}

function setRuleEditorHtml_(html) {
    initRuleEditor_();
    let safeHtml = sanitizeRuleHtmlClient_(html);

    if (ruleEditorInstance_ && ruleEditorInstance_.clipboard) {
        ruleEditorInstance_.setText('');
        ruleEditorInstance_.clipboard.dangerouslyPasteHTML(safeHtml);
        return;
    }

    let editor = getRuleEditorElement_();
    if (editor) editor.innerHTML = safeHtml;
}

function escapeRuleText_(value) {
    if (typeof escapeHtml_ === 'function') return escapeHtml_(value);
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function plainTextToRuleHtml_(value) {
    return String(value || '')
        .replace(/\r/g, '')
        .split('\n')
        .map(function(line) {
            return '<p>' + (line ? escapeRuleText_(line) : '<br>') + '</p>';
        })
        .join('');
}

function getRuleItemHtml_(rule) {
    if (!rule) return '';

    let isHtml = String(rule.format || '').toLowerCase() === 'html' || !!rule.contentHtml;
    let source = isHtml ? (rule.contentHtml || rule.content || '') : plainTextToRuleHtml_(rule.content || '');
    return sanitizeRuleHtmlClient_(source);
}

function sanitizeRuleHtmlClient_(input) {
    let allowedTags = [
        'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE',
        'H1', 'H2', 'H3', 'OL', 'UL', 'LI', 'BLOCKQUOTE', 'A', 'SPAN'
    ];
    let allowedAttrs = ['href', 'target', 'rel', 'class', 'style', 'data-list'];
    let source = String(input || '');

    if (window.DOMPurify) {
        source = DOMPurify.sanitize(source, {
            ALLOWED_TAGS: allowedTags.map(function(tag) { return tag.toLowerCase(); }),
            ALLOWED_ATTR: allowedAttrs
        });
    }

    let template = document.createElement('template');
    template.innerHTML = source;

    Array.from(template.content.querySelectorAll('*')).forEach(function(element) {
        if (allowedTags.indexOf(element.tagName) === -1) {
            element.replaceWith(document.createTextNode(element.textContent || ''));
            return;
        }

        let originalClass = String(element.getAttribute('class') || '');
        let originalStyle = String(element.getAttribute('style') || '');
        let originalListType = String(element.getAttribute('data-list') || '');
        let originalHref = String(element.getAttribute('href') || '');

        Array.from(element.attributes).forEach(function(attribute) {
            element.removeAttribute(attribute.name);
        });

        let safeClasses = originalClass
            .split(/\s+/)
            .filter(function(name) {
                return /^(ql-align-(center|right|justify)|ql-indent-[1-8]|ql-font-(serif|monospace|arial|times-new-roman)|ql-size-(small|large|huge))$/.test(name);
            })
            .join(' ');

        if (safeClasses) element.setAttribute('class', safeClasses);

        if (element.tagName === 'SPAN' || element.tagName === 'P' || /^H[1-3]$/.test(element.tagName)) {
            let safeStyles = [];

            originalStyle.split(';').forEach(function(part) {
                let separator = part.indexOf(':');
                if (separator < 1) return;

                let property = part.substring(0, separator).trim().toLowerCase();
                let cssValue = part.substring(separator + 1).trim().toLowerCase();

                if (property !== 'color' && property !== 'background-color') return;
                if (!/^(#[0-9a-f]{3,8}|rgba?\([0-9.,\s%]+\))$/i.test(cssValue)) return;

                safeStyles.push(property + ': ' + cssValue);
            });

            if (safeStyles.length) element.setAttribute('style', safeStyles.join('; '));
        }

        if (
            element.tagName === 'LI' &&
            (originalListType === 'ordered' || originalListType === 'bullet')
        ) {
            element.setAttribute('data-list', originalListType);
        }

        if (
            element.tagName === 'A' &&
            /^(https?:\/\/|mailto:|tel:|#)/i.test(originalHref.trim())
        ) {
            element.setAttribute('href', originalHref.trim().slice(0, 1000));
            element.setAttribute('target', '_blank');
            element.setAttribute('rel', 'noopener noreferrer');
        }
    });

    return template.innerHTML;
}

function getRuleDraftKey_() {
    let actorStt = (typeof loggedInMemberStt !== 'undefined' && loggedInMemberStt) || 0;
    return 'tlt_rule_rich_draft_v209_' + actorStt;
}

function saveRuleDraft() {
    if (!canManageRules_()) return;
    initRuleEditor_();

    let draft = {
        title: String(document.getElementById('ruleTitleInput').value || ''),
        contentHtml: sanitizeRuleHtmlClient_(getRuleEditorHtml_()),
        editingRuleId: editingRuleId_,
        savedAt: new Date().toISOString()
    };

    try {
        localStorage.setItem(getRuleDraftKey_(), JSON.stringify(draft));
        updateRuleDraftStatus_('Đã lưu nháp trên thiết bị này.');
        showToast('Đã lưu bản nháp!');
    } catch (err) {
        console.warn('SAVE RULE DRAFT ERROR:', err);
        showToast('Thiết bị không cho phép lưu bản nháp.', 'warning');
    }
}

function restoreRuleDraft_() {
    if (!canManageRules_()) return;

    let actorStt = (typeof loggedInMemberStt !== 'undefined' && loggedInMemberStt) || 0;
    if (ruleDraftLoadedActor_ === actorStt) return;

    // Không để nội dung đang soạn của Admin trước xuất hiện khi một
    // Admin/Owner khác đăng nhập trên cùng thiết bị.
    if (ruleDraftLoadedActor_ !== null && ruleDraftLoadedActor_ !== actorStt) {
        editingRuleId_ = null;
        let titleInput = document.getElementById('ruleTitleInput');
        if (titleInput) titleInput.value = '';
        if (ruleEditorInstance_) ruleEditorInstance_.setText('');
        else {
            let editor = getRuleEditorElement_();
            if (editor) editor.innerHTML = '';
        }
        updateRuleComposerMode_();
        updateRuleDraftStatus_('');
    }

    ruleDraftLoadedActor_ = actorStt;

    try {
        let raw = localStorage.getItem(getRuleDraftKey_());
        if (!raw) return;

        let draft = JSON.parse(raw);
        if (!draft || (!draft.title && !draft.contentHtml)) return;

        let titleInput = document.getElementById('ruleTitleInput');
        if (titleInput && !titleInput.value && !getRuleEditorText_()) {
            titleInput.value = String(draft.title || '');
            setRuleEditorHtml_(draft.contentHtml || '');
            editingRuleId_ = draft.editingRuleId || null;
            updateRuleComposerMode_();
            updateRuleDraftStatus_('Đã khôi phục bản nháp trên thiết bị.');
        }
    } catch (err) {
        console.warn('RESTORE RULE DRAFT ERROR:', err);
    }
}

function removeRuleDraft_() {
    try {
        localStorage.removeItem(getRuleDraftKey_());
    } catch (err) {
        console.warn('REMOVE RULE DRAFT ERROR:', err);
    }
    updateRuleDraftStatus_('');
}

function updateRuleDraftStatus_(message) {
    let element = document.getElementById('ruleDraftStatus');
    if (!element) return;
    element.textContent = message || '';
    element.classList.toggle('hidden', !message);
}

function updateRuleComposerMode_() {
    let heading = document.getElementById('ruleComposerHeading');
    let submit = document.getElementById('ruleSubmitBtn');
    let cancel = document.getElementById('ruleCancelEditBtn');

    if (heading) {
        heading.innerHTML = editingRuleId_
            ? '<i class="fa-solid fa-pen-to-square"></i> CHỈNH SỬA THÔNG BÁO / QUY ĐỊNH'
            : '<i class="fa-solid fa-pen-nib"></i> ĐĂNG THÔNG BÁO / QUY ĐỊNH MỚI';
    }
    if (submit) {
        submit.innerHTML = editingRuleId_
            ? '<i class="fa-solid fa-cloud-arrow-up"></i> LƯU CẬP NHẬT'
            : '<i class="fa-solid fa-cloud-arrow-up"></i> ĐĂNG LÊN CLOUD';
    }
    if (cancel) cancel.classList.toggle('hidden', !editingRuleId_);
}

function resetRuleEditor_(removeDraft) {
    editingRuleId_ = null;

    let titleInput = document.getElementById('ruleTitleInput');
    if (titleInput) titleInput.value = '';

    if (ruleEditorInstance_) {
        ruleEditorInstance_.setText('');
    } else {
        let editor = getRuleEditorElement_();
        if (editor) editor.innerHTML = '';
    }

    updateRuleComposerMode_();
    if (removeDraft) removeRuleDraft_();
}

function cancelRuleEdit() {
    resetRuleEditor_(true);
}

function startEditRule(id) {
    if (!canManageRules_()) return;

    let rule = (rulesList || []).find(function(item) {
        return String(item.id) === String(id);
    });

    if (!rule) {
        showToast('Không tìm thấy nội dung cần chỉnh sửa.', 'warning');
        return;
    }

    initRuleEditor_();
    editingRuleId_ = rule.id;

    let titleInput = document.getElementById('ruleTitleInput');
    if (titleInput) titleInput.value = String(rule.title || '');
    setRuleEditorHtml_(getRuleItemHtml_(rule));
    updateRuleComposerMode_();
    updateRuleDraftStatus_('Đang chỉnh sửa nội dung đã đăng.');

    let adminBox = document.getElementById('adminRuleBox');
    if (adminBox) adminBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function addNewRule(e) {
    e.preventDefault();
    if (!canManageRules_()) return;

    initRuleEditor_();

    let title = String(document.getElementById('ruleTitleInput').value || '').trim();
    let contentHtml = sanitizeRuleHtmlClient_(getRuleEditorHtml_()).trim();
    let contentText = getRuleEditorText_();

    if (!title) {
        showToast('Bạn chưa nhập tiêu đề.', 'warning');
        return;
    }
    if (!contentText) {
        showToast('Bạn chưa nhập nội dung.', 'warning');
        return;
    }
    if (title.length > 200) {
        showToast('Tiêu đề tối đa 200 ký tự.', 'warning');
        return;
    }
    if (contentText.length > 10000 || contentHtml.length > 20000) {
        showToast('Nội dung quá dài hoặc có quá nhiều định dạng.', 'warning');
        return;
    }

    let isUpdate = editingRuleId_ !== null && editingRuleId_ !== undefined;
    let rule = {
        id: isUpdate ? editingRuleId_ : Date.now(),
        time: formatVNDateTime_(),
        title: title,
        content: contentHtml,
        contentHtml: contentHtml,
        contentText: contentText,
        format: 'html'
    };

    resetRuleEditor_(true);

    enqueueAction(
        isUpdate ? 'updateRule' : 'addRule',
        { rule: rule },
        isUpdate
            ? 'Đã cập nhật thông báo/quy định thành công!'
            : 'Đã đăng thông báo/quy định mới thành công!'
    );
}

function previewRule() {
    initRuleEditor_();

    let title = String(document.getElementById('ruleTitleInput').value || '').trim();
    let contentText = getRuleEditorText_();
    if (!title && !contentText) {
        showToast('Hãy nhập tiêu đề hoặc nội dung để xem trước.', 'warning');
        return;
    }

    let previewTitle = document.getElementById('rulePreviewTitle');
    let previewContent = document.getElementById('rulePreviewContent');
    let modal = document.getElementById('rulePreviewModal');

    if (previewTitle) previewTitle.textContent = title || 'Chưa có tiêu đề';
    if (previewContent) previewContent.innerHTML = sanitizeRuleHtmlClient_(getRuleEditorHtml_());
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeRulePreview() {
    let modal = document.getElementById('rulePreviewModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function deleteRule(id) {
    let rule = (rulesList || []).find(function(item) {
        return String(item.id) === String(id);
    });

    let message = rule
        ? 'Bạn có muốn xóa thông báo [' + rule.title + '] này không?'
        : 'Bạn có chắc chắn muốn xóa thông báo này không?';

    showActionConfirm(message, function() {
        if (String(editingRuleId_) === String(id)) resetRuleEditor_(true);
        enqueueAction('deleteItem', { sheetName: 'Rules', id: id }, 'Đã xóa thông báo thành công!');
    });
}

function renderRulesTab() {
    let container = document.getElementById('rulesContainer');
    if (!container) return;

    initRuleEditor_();
    updateRuleComposerMode_();
    container.innerHTML = '';

    let defaultRules = [
        {
            id: 1,
            time: '01/08/2026',
            title: 'Quy định đặt sân 18h-20h tại CVTT5',
            content: 'Khung giờ 18h-20h tại CVTT5 do Hoàng Văn Thái 94 (Thanglong15) đại diện đặt sân qua app. Tiền thưởng đặt sân áp dụng đặc cách = 0 đ.',
            format: 'plain'
        },
        {
            id: 2,
            time: '01/05/2026',
            title: 'Quy định tài chính và phạt trận Hòa',
            content: 'Trong các trận đấu, nếu kết quả là hòa (Draw), cả 4 thành viên tham gia đều có nghĩa vụ đóng góp tiền quỹ góc theo quy định của CLB.',
            format: 'plain'
        }
    ];

    let usingFallback = !Array.isArray(rulesList) || rulesList.length === 0;
    let combinedRules = (usingFallback ? defaultRules : rulesList.slice()).sort(function(a, b) {
        return (parseInt(b.id) || 0) - (parseInt(a.id) || 0);
    });

    combinedRules.forEach(function(rule) {
        let safeTitle = escapeRuleText_(rule.title);
        let safeTime = escapeRuleText_(formatVNTimeForDisplay_(rule.time));
        let safeContentHtml = getRuleItemHtml_(rule);
        let numericId = parseInt(rule.id) || 0;
        let actions = '';

        if (canManageRules_() && !usingFallback) {
            actions =
                '<button type="button" onclick="startEditRule(' + numericId + ')" class="rule-action-btn text-emerald-700" title="Chỉnh sửa">' +
                    '<i class="fa-solid fa-pen-to-square"></i>' +
                '</button>' +
                '<button type="button" onclick="deleteRule(' + numericId + ')" class="rule-action-btn text-red-600" title="Xóa">' +
                    '<i class="fa-solid fa-trash"></i>' +
                '</button>';
        }

        container.innerHTML +=
            '<article class="rule-card bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 shadow-sm">' +
                '<div class="flex justify-between items-start gap-3">' +
                    '<h3 class="font-black text-emerald-900 text-sm md:text-base flex items-start gap-1.5 min-w-0">' +
                        '<i class="fa-solid fa-circle-chevron-right text-emerald-600 text-xs mt-1"></i>' +
                        '<span>' + safeTitle + '</span>' +
                    '</h3>' +
                    '<div class="flex items-center gap-1.5 shrink-0">' +
                        '<span class="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border">' + safeTime + '</span>' +
                        actions +
                    '</div>' +
                '</div>' +
                '<div class="rule-rich-content ql-editor text-sm text-slate-700 leading-relaxed">' + safeContentHtml + '</div>' +
            '</article>';
    });

    applyRolePermissions();
    restoreRuleDraft_();
}

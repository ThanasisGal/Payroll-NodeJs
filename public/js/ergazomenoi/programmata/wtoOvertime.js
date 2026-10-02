'use strict';

(() => {
    const app = document.getElementById('wtoOvertimeApp');
    if (!app) return;
    const card = document.getElementById('wtoOvertimeCard');
    const branch = document.getElementById('wtoOvertimeBranch');
    const from = document.getElementById('wtoOvertimeFrom');
    const to = document.getElementById('wtoOvertimeTo');
    const previewButton = document.getElementById('wtoOvertimePreviewButton');
    const submitButton = document.getElementById('wtoOvertimeSubmitButton');
    const status = document.getElementById('wtoOvertimeStatus');
    const summary = document.getElementById('wtoOvertimeSummary');
    const rowsBody = document.getElementById('wtoOvertimeRows');
    const canExport = app.dataset.canExport === 'true';
    const excessTooltipText = 'Η απολογιστική νόμιμη υπερωρία της ημέρας υπερβαίνει τις 3 ώρες. Στην αυτόματη υποβολή θα συμπεριληφθούν έως 3 ώρες. Ο επιπλέον χρόνος δεν περιλαμβάνεται στην αυτόματη υποβολή.';
    let validPreview = null;
    let inputRevision = 0;
    let layoutFrame = null;

    function syncCardHeight() {
        if (!card) return;
        const cardTop = card.getBoundingClientRect().top;
        const footer = document.querySelector('.footer');
        const footerTop = footer ? Math.min(footer.getBoundingClientRect().top, window.innerHeight) : window.innerHeight;
        const cardHeight = Math.max(360, Math.floor(footerTop - cardTop - 25));
        card.style.height = `${cardHeight}px`;
        card.style.maxHeight = `${cardHeight}px`;
    }
    function scheduleCardHeightSync() {
        if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
        layoutFrame = window.requestAnimationFrame(() => { layoutFrame = null; syncCardHeight(); });
    }
    function initLayout() {
        syncCardHeight();
        window.addEventListener('resize', scheduleCardHeightSync);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLayout, { once: true });
    } else initLayout();

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        })[char]);
    }
    function formatGreekDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
        return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value ?? '');
    }
    function formatMinutes(value) {
        const minutes = Math.max(0, Number.parseInt(value, 10) || 0);
        return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
    }
    function csrfHeaders() {
        const token = document.getElementById('wtoOvertimeCsrf')?.value || '';
        return { 'Content-Type': 'application/json', ...(token ? { 'x-csrf-token': token } : {}) };
    }
    function input() {
        return { ypokatasthma: branch.value, from_date: from.value, to_date: to.value };
    }
    function invalidatePreview(message = 'Τα φίλτρα άλλαξαν. Εκτελέστε νέα προεπισκόπηση.') {
        inputRevision += 1;
        validPreview = null;
        submitButton.disabled = true;
        status.className = 'alert alert-secondary mt-3 mb-0';
        status.textContent = message;
    }
    function setBusy(busy) {
        previewButton.disabled = busy;
        submitButton.disabled = busy || !validPreview || !canExport;
    }
    function initializeStatusTooltips() {
        if (!window.bootstrap?.Tooltip) return;
        rowsBody.querySelectorAll('[data-wto-overtime-tooltip]')
            .forEach((element) => window.bootstrap.Tooltip.getOrCreateInstance(element, {
                title: () => element.dataset.wtoOvertimeTooltip || '',
                customClass: 'wto-overtime-tooltip',
                trigger: 'hover focus',
                placement: 'top',
                container: 'body'
            }));
    }
    function disposeStatusTooltips() {
        if (!window.bootstrap?.Tooltip) return;
        rowsBody.querySelectorAll('[data-wto-overtime-tooltip]')
            .forEach((element) => window.bootstrap.Tooltip.getInstance(element)?.dispose());
    }
    function renderSubmissionRow(row) {
        const requiresAttention = Number(row.excess_minutes) > 0;
        const statusCell = requiresAttention
            ? `<td class="wto-overtime-status-attention fw-semibold" tabindex="0"
                data-bs-toggle="tooltip" data-wto-overtime-tooltip="${escapeHtml(excessTooltipText)}">ΠΡΟΣΟΧΗ</td>`
            : '<td class="text-success fw-semibold">ΕΤΟΙΜΟ</td>';
        return `<tr>
            <td>${escapeHtml(row.employee_code)}</td><td>${escapeHtml(row.afm)}</td>
            <td>${escapeHtml(`${row.eponymo} ${row.onoma}`)}</td><td>${escapeHtml(formatGreekDate(row.date))}</td>
            <td>${escapeHtml(formatMinutes(row.submitted_overtime_minutes))}</td>
            <td>${escapeHtml(row.f_type)}</td><td>${escapeHtml(row.f_from)}</td>
            <td>${escapeHtml(row.f_to)}</td>${statusCell}
        </tr>`;
    }
    function renderBlockingRow(item) {
        return `<tr>
            <td>${escapeHtml(item.employee_code || '—')}</td><td>—</td><td>—</td>
            <td>${escapeHtml(formatGreekDate(item.date || ''))}</td>
            <td>—</td><td>—</td><td>—</td><td>—</td>
            <td class="text-danger fw-semibold" tabindex="0" data-bs-toggle="tooltip"
                data-wto-overtime-tooltip="${escapeHtml(item.message || '')}">ΑΠΑΙΤΕΙ ΕΛΕΓΧΟ</td>
        </tr>`;
    }
    function render(data) {
        summary.hidden = false;
        document.getElementById('wtoOvertimeEmployeeCount').textContent = data.employee_count;
        document.getElementById('wtoOvertimeDayCount').textContent = data.employee_day_count;
        document.getElementById('wtoOvertimeSubmittedTotal').textContent = formatMinutes(data.total_submitted_overtime_minutes);
        disposeStatusTooltips();
        const visibleRows = [
            ...(Array.isArray(data.rows) ? data.rows.map(renderSubmissionRow) : []),
            ...(Array.isArray(data.blockers) ? data.blockers.map(renderBlockingRow) : [])
        ];
        rowsBody.innerHTML = visibleRows.length ? visibleRows.join('') :
            '<tr><td colspan="9" class="text-center text-muted">Δεν βρέθηκαν υποβλητέες νόμιμες υπερωρίες.</td></tr>';
        initializeStatusTooltips();
        validPreview = data.submission_eligible && data.parity?.exact ? data : null;
        submitButton.disabled = !validPreview || !canExport;
        status.className = validPreview ? (data.warning_count ? 'alert alert-warning mt-3 mb-0' :
            'alert alert-success mt-3 mb-0') : data.blocker_count ? 'alert alert-danger mt-3 mb-0' :
            'alert alert-info mt-3 mb-0';
        status.textContent = validPreview
            ? data.warning_count
                ? 'Η προεπισκόπηση είναι έτοιμη για υποβολή στο ΕΡΓΑΝΗ.\nΟι ημέρες που χρειάζονται προσοχή επισημαίνονται στη στήλη «Κατάσταση».'
                : 'Η προεπισκόπηση είναι έτοιμη για υποβολή στο ΕΡΓΑΝΗ.'
            : data.blocker_count ? 'Η προεπισκόπηση δεν μπορεί να υποβληθεί ακόμη.\nΕλέγξτε τις γραμμές με ένδειξη στη στήλη «Κατάσταση».'
                : 'Δεν υπάρχουν υποβλητέες νόμιμες υπερωρίες στο επιλεγμένο φίλτρο.';
    }
    async function requestJson(url, body) {
        const response = await fetch(url, { method: 'POST', headers: csrfHeaders(),
            credentials: 'same-origin', body: JSON.stringify(body) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success !== true) throw new Error(data.message || 'Αποτυχία αιτήματος.');
        return data;
    }
    previewButton.addEventListener('click', async () => {
        if (!branch.value || !from.value || !to.value || from.value > to.value) {
            if (window.Swal) await window.Swal.fire('Μη έγκυρα φίλτρα',
                'Συμπληρώστε υποκατάστημα και έγκυρο διάστημα ημερομηνιών.', 'warning');
            return;
        }
        invalidatePreview('Φόρτωση προεπισκόπησης…');
        const requestedInput = input();
        const requestedRevision = inputRevision;
        setBusy(true);
        try {
            const data = await requestJson('/api/ergazomenoi/programmata/wto-overtime/preview', requestedInput);
            if (requestedRevision !== inputRevision || JSON.stringify(requestedInput) !== JSON.stringify(input())) return;
            render(data);
        } catch (error) {
            status.className = 'alert alert-danger mt-3 mb-0';
            status.textContent = error.message;
            if (window.Swal) await window.Swal.fire('Σφάλμα προεπισκόπησης', error.message, 'error');
        } finally { setBusy(false); }
    });
    submitButton.addEventListener('click', async () => {
        if (!validPreview || !canExport) return;
        const selectedBranch = branch.options[branch.selectedIndex]?.textContent?.trim() || branch.value;
        const confirmationHtml = `<div class="text-start">
            <p><strong>Εταιρεία:</strong> ${escapeHtml(app.dataset.companyName)}</p>
            <p><strong>Υποκατάστημα:</strong> ${escapeHtml(selectedBranch)}</p>
            <p><strong>Πραγματικό διάστημα:</strong> ${escapeHtml(validPreview.actual_from)} – ${escapeHtml(validPreview.actual_to)}</p>
            <p><strong>Εργαζόμενοι:</strong> ${validPreview.employee_count}<br>
            <strong>Ημέρες υπερωρίας:</strong> ${validPreview.employee_day_count}<br>
            <strong>Σύνολο υποβαλλόμενων υπερωριών:</strong> ${formatMinutes(validPreview.total_submitted_overtime_minutes)}</p>
            <p class="text-danger"><strong>Η ενέργεια θα πραγματοποιήσει οριστική υποβολή WTOOvA στο ΕΡΓΑΝΗ.</strong></p></div>`;
        const result = window.Swal ? await window.Swal.fire({ title: 'Οριστική υποβολή υπερωριών',
            html: confirmationHtml, icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Οριστική υποβολή', cancelButtonText: 'Ακύρωση', focusCancel: true }) :
            { isConfirmed: window.confirm('Η ενέργεια θα πραγματοποιήσει οριστική υποβολή WTOOvA στο ΕΡΓΑΝΗ.') };
        if (!result.isConfirmed) return;
        setBusy(true);
        try {
            const requestId = window.crypto?.randomUUID ? window.crypto.randomUUID() :
                `wtoova-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const data = await requestJson('/api/ergazomenoi/programmata/wto-overtime/submit',
                { ...input(), request_id: requestId });
            validPreview = null;
            submitButton.disabled = true;
            if (data.idempotent === true && window.Swal) {
                await window.Swal.fire({ title: 'Ήδη υποβλημένο', icon: 'success',
                    html: `<p>Η ίδια υποβολή WTOOvA έχει ήδη ολοκληρωθεί.</p>
                        <p>Πρωτόκολλο: <strong>${escapeHtml(data.protocol || '—')}</strong></p>
                        <p>Δεν πραγματοποιήθηκε νέα υποβολή.</p>` });
            }
            await window.ErganiRestSubmissionUi.presentSubmissionResultSafely({
                ...data, processDescription: 'Οργάνωση Χρόνου Εργασίας - Υπερωρίες - Απολογιστικό',
                pdfViewerVariant: 'compact-portrait'
            });
        } catch (error) {
            if (window.Swal) await window.Swal.fire('Αποτυχία υποβολής', error.message, 'error');
        } finally { setBusy(false); }
    });
    [branch, from, to].forEach((element) => element.addEventListener('change', () => invalidatePreview()));
})();

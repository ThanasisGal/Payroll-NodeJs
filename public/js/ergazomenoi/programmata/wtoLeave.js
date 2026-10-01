'use strict';

(() => {
    const app = document.getElementById('wtoLeaveApp');
    if (!app) return;
    const card = document.getElementById('wtoLeaveCard');
    const branch = document.getElementById('wtoLeaveBranch');
    const from = document.getElementById('wtoLeaveFrom');
    const to = document.getElementById('wtoLeaveTo');
    const previewButton = document.getElementById('wtoLeavePreviewButton');
    const submitButton = document.getElementById('wtoLeaveSubmitButton');
    const status = document.getElementById('wtoLeaveStatus');
    const summary = document.getElementById('wtoLeaveSummary');
    const rowsBody = document.getElementById('wtoLeaveRows');
    const blockers = document.getElementById('wtoLeaveBlockers');
    const json = document.getElementById('wtoLeaveJson');
    const canExport = app.dataset.canExport === 'true';
    let validPreview = null;
    let inputRevision = 0;
    let layoutFrame = null;

    function syncWtoLeaveCardHeight() {
        if (!card) return;
        const minimumHeight = 320;
        const footerClearance = 25;
        const cardTop = card.getBoundingClientRect().top;
        const footer = document.querySelector('.footer');
        const footerTop = footer
            ? Math.min(footer.getBoundingClientRect().top, window.innerHeight)
            : window.innerHeight;
        const availableHeight = footerTop - cardTop - footerClearance;
        const cardHeight = Math.max(minimumHeight, Math.floor(availableHeight));
        card.style.height = `${cardHeight}px`;
        card.style.maxHeight = `${cardHeight}px`;
    }

    function scheduleWtoLeaveCardHeightSync() {
        if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
        layoutFrame = window.requestAnimationFrame(() => {
            layoutFrame = null;
            syncWtoLeaveCardHeight();
        });
    }

    function initWtoLeaveLayout() {
        syncWtoLeaveCardHeight();
        window.addEventListener('resize', scheduleWtoLeaveCardHeightSync);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWtoLeaveLayout, { once: true });
    } else {
        initWtoLeaveLayout();
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        })[char]);
    }
    function formatGreekDate(value) {
        const normalized = String(value ?? '').trim();
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
        return match ? `${match[3]}/${match[2]}/${match[1]}` : normalized;
    }
    function csrfHeaders() {
        const token = document.getElementById('wtoLeaveCsrf')?.value || '';
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
    function render(data) {
        summary.hidden = false;
        document.getElementById('wtoLeaveActualRange').textContent =
            data.actual_from && data.actual_to ? `${data.actual_from} – ${data.actual_to}` : '—';
        document.getElementById('wtoLeaveEmployeeCount').textContent = data.employee_count;
        document.getElementById('wtoLeaveDayCount').textContent = data.employee_day_count;
        document.getElementById('wtoLeaveAnalyticsCount').textContent = data.analytics_count;
        rowsBody.innerHTML = data.rows.length ? data.rows.map((row) => `<tr>
            <td>${escapeHtml(formatGreekDate(row.date))}</td><td>${escapeHtml(row.employee_code)}</td>
            <td>${escapeHtml(row.afm)}</td><td>${escapeHtml(`${row.eponymo} ${row.onoma}`)}</td>
            <td>${escapeHtml(row.leave_type)}</td><td>${row.full_day ? 'Ολοήμερη' : 'Ωριαία'}</td>
            <td>${escapeHtml(row.full_day ? '—' : row.intervals.map((item) => `${item.from}–${item.to}`).join(', '))}</td>
            <td>${escapeHtml(row.reference_year || '—')}</td><td>${escapeHtml(row.required_days || '—')}</td>
        </tr>`).join('') : '<tr><td colspan="9" class="text-center text-muted">Δεν βρέθηκαν υποβλητέες άδειες.</td></tr>';
        blockers.hidden = data.blockers.length === 0;
        blockers.innerHTML = data.blockers.length ? `<strong>Προβλήματα που εμποδίζουν την υποβολή</strong><ul class="mb-0">${data.blockers
            .map((item) => `<li>${escapeHtml(item.code)}: ${escapeHtml(item.message)} (${escapeHtml(item.employee_code || '—')} ${escapeHtml(item.date || '')})</li>`).join('')}</ul>` : '';
        json.textContent = data.payload ? JSON.stringify(data.payload, null, 2) :
            'Δεν υπάρχουν επιλέξιμα δεδομένα προς υποβολή.';
        validPreview = data.submission_eligible && data.parity?.exact ? data : null;
        submitButton.disabled = !validPreview || !canExport;
        status.className = validPreview ? 'alert alert-success mt-3 mb-0' :
            data.blockers.length ? 'alert alert-danger mt-3 mb-0' : 'alert alert-info mt-3 mb-0';
        status.textContent = validPreview
            ? 'Η προεπισκόπηση είναι έγκυρη και συμφωνεί ακριβώς με τα δεδομένα προς υποβολή.'
            : data.blockers.length ? 'Η προεπισκόπηση έχει blockers και δεν μπορεί να υποβληθεί.'
                : 'Δεν υπάρχουν υποβλητέες άδειες στο επιλεγμένο φίλτρο.';
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
        invalidatePreview('Φόρτωση προεπισκόπησης από τα επίσημα δεδομένα…');
        const requestedInput = input();
        const requestedRevision = inputRevision;
        setBusy(true);
        try {
            const data = await requestJson('/api/ergazomenoi/programmata/wto-leave/preview', requestedInput);
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
            <strong>Ημέρες αδειών:</strong> ${validPreview.employee_day_count}<br>
            <strong>Αναλυτικές εγγραφές:</strong> ${validPreview.analytics_count}</p>
            <p class="text-danger"><strong>Η ενέργεια θα πραγματοποιήσει οριστική υποβολή αδειών στο ΕΡΓΑΝΗ.</strong></p></div>`;
        const result = window.Swal ? await window.Swal.fire({ title: 'Οριστική υποβολή αδειών',
            html: confirmationHtml, icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Οριστική υποβολή', cancelButtonText: 'Ακύρωση', focusCancel: true }) :
            { isConfirmed: window.confirm('Η ενέργεια θα πραγματοποιήσει οριστική υποβολή αδειών στο ΕΡΓΑΝΗ.') };
        if (!result.isConfirmed) return;
        setBusy(true);
        try {
            const requestId = window.crypto?.randomUUID ? window.crypto.randomUUID() :
                `wtoleave-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const data = await requestJson('/api/ergazomenoi/programmata/wto-leave/submit',
                { ...input(), request_id: requestId });
            validPreview = null;
            submitButton.disabled = true;
            if (data.idempotent === true && window.Swal) {
                await window.Swal.fire({ title: 'Ήδη υποβλημένο', icon: 'success',
                    html: `<p>Η συγκεκριμένη υποβολή αδειών έχει ήδη ολοκληρωθεί στο ΕΡΓΑΝΗ.</p>
                        <p>Πρωτόκολλο: <strong>${escapeHtml(data.protocol || '—')}</strong></p>
                        <p>Δεν πραγματοποιήθηκε νέα υποβολή.</p>` });
            }
            await window.ErganiRestSubmissionUi.presentSubmissionResultSafely({
                ...data,
                processDescription: 'Οργάνωση Χρόνου Εργασίας - Άδειες'
            });
        } catch (error) {
            if (window.Swal) await window.Swal.fire('Αποτυχία υποβολής', error.message, 'error');
        } finally { setBusy(false); }
    });
    [branch, from, to].forEach((element) => element.addEventListener('change', () => invalidatePreview()));
})();

(function attachOrphanQualityCheck(root) {
    'use strict';

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        })[character]);
    }

    function formatDate(date) {
        const match = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return match ? `${match[3]}/${match[2]}/${match[1]}` : String(date || '');
    }

    function renderDates(dates = []) {
        return dates.map((item) =>
            `${escapeHtml(formatDate(item.date))}${Number(item.count) > 1 ? ` ×${Number(item.count)}` : ''}`
        ).join(', ');
    }

    function buildHtml(employees = []) {
        const rows = employees.map((employee) => `<tr>
            <td class="text-nowrap">${escapeHtml(employee.kodikos)}</td>
            <td>${escapeHtml(`${employee.eponymo || ''} ${employee.onoma || ''}`.trim() || '-')}</td>
            <td class="text-center fw-semibold">${Number(employee.orphan_count) || 0}</td>
            <td>${renderDates(employee.dates)}</td>
        </tr>`).join('');
        return `<p class="text-start">Οι παρακάτω εργαζόμενοι έχουν περισσότερα από 3 ορφανά χτυπήματα στην επιλεγμένη περίοδο. Παρακαλώ λάβετε το υπόψη κατά τον έλεγχο.</p>
            <div class="table-responsive text-start" style="max-height:min(55vh,32rem);overflow-y:auto">
                <table class="table table-sm table-bordered table-striped align-middle mb-0">
                    <thead class="table-light sticky-top"><tr><th>Κωδικός</th><th>Εργαζόμενος</th><th>Ορφανά χτυπήματα</th><th>Ημερομηνίες</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    }

    async function run({ params, csrfToken, fetchImpl = root.fetch,
        showDialog, logError = root.console?.error } = {}) {
        try {
            const response = await fetchImpl(
                `/api/prodhlomena-oraria/review/orphan-quality-check?${params.toString()}`,
                { method: 'GET', headers: { 'CSRF-Token': csrfToken } }
            );
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message ||
                'Δεν κατέστη δυνατός ο έλεγχος ορφανών χτυπημάτων.');
            if (!Array.isArray(payload.employees) || payload.employees.length === 0) return payload;
            await showDialog({ icon: 'warning', title: 'Προειδοποίηση ορφανών χτυπημάτων',
                html: buildHtml(payload.employees), confirmButtonText: 'Εντάξει', width: 'min(72rem, 96vw)' });
            return payload;
        } catch (error) {
            logError?.('[orphanQualityCheck]', error);
            await showDialog({ icon: 'warning', title: 'Έλεγχος ορφανών χτυπημάτων',
                text: 'Δεν κατέστη δυνατός ο έλεγχος ορφανών χτυπημάτων.',
                confirmButtonText: 'Εντάξει' });
            return null;
        }
    }

    const api = Object.freeze({ buildHtml, formatDate, renderDates, run });
    root.EmploymentReviewOrphanQualityCheck = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

'use strict';
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./employmentReviewGuidance'));
    else root.EmploymentReviewGuidanceUi = factory(root.EmploymentReviewGuidance);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (guidance) {
    const introductions = Object.freeze({
        STAGE1: 'Ελέγξτε τις εκκρεμείς ημέρες και επιβεβαιώστε τον έλεγχο των εβδομάδων.',
        STAGE2: 'Εξετάστε τις εκκρεμείς αποφάσεις μεταφοράς ρεπό.',
        STAGE3: 'Χαρακτηρίστε τις ημέρες που απομένουν προς τελική απόφαση.',
        STAGE4: 'Ελέγξτε τις εκκρεμότητες του τελικού εβδομαδιαίου αποτελέσματος.'
    });
    const escape = value => String(value ?? '').replace(/[&<>"']/g, ch =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch]);
    const formatDate = value => {
        const key = guidance.dateKey(value);
        return key ? key.slice(8, 10) + '/' + key.slice(5, 7) + '/' + key.slice(0, 4) : '';
    };
    function issues(payload = {}, stageKey = 'STAGE1') {
        const stage = payload.lifecycle_projection?.stages?.[stageKey.toLowerCase()] || {};
        if (['COMPLETED', 'DEFERRED_TO_NEXT_PERIOD'].includes(stage.business_status)) return [];
        const codes = [...new Set([...(stage.blockers || []), ...(stage.pending_reasons || [])])];
        if (stage.business_status === 'STALE') codes.unshift('STAGE1_INPUT_CHANGED');
        if (!codes.length && stage.business_status === 'BLOCKED') codes.push('UNKNOWN');
        return [...new Set(codes)].map(code => {
            const details = (stage.diagnostics || []).filter(item => item.code === code);
            const specificDates = details.flatMap(item => item.dates || []);
            const pendingDates = details.length ? [] : stage.pending_dates || [];
            return { code, ...guidance.describe(code), dates: [...new Set(
                [...specificDates, ...pendingDates].map(guidance.dateKey).filter(Boolean))].sort(),
            evidence: details.map(item => ({ dates: item.dates || [], facts: item.evidence || {} })),
            reference: guidance.reference(code) };
        });
    }
    function targets(payloads = [], stageKey = 'STAGE1') {
        return payloads.flatMap(payload => {
            const reasons = issues(payload, stageKey);
            if (!reasons.length) return [];
            const dates = [...new Set(reasons.flatMap(reason => reason.dates))].sort();
            if (reasons.some(reason => !reason.dates.length)) dates.push(null);
            return dates.map(date => ({ payload, stage: stageKey, date,
                issues: reasons.filter(reason => date ? reason.dates.includes(date) : !reason.dates.length) }));
        });
    }
    function evidenceHtml(items = []) {
        const text = [];
        items.forEach(item => {
            const f = item.facts;
            for (const [key, label] of [['missing_dates', 'Λείπουν ημέρες'],
                ['duplicate_dates', 'Επαναλαμβάνονται ημέρες'], ['unexpected_dates', 'Ημέρες εκτός απαιτούμενου διαστήματος']]) {
                const values = (Array.isArray(f[key]) ? f[key] : []).map(formatDate).filter(Boolean);
                if (values.length) text.push(label + ': ' + values.join(', '));
            }
            if (Number.isInteger(f.invalid_date_count) && f.invalid_date_count > 0)
                text.push('Εγγραφές χωρίς έγκυρη ημερομηνία: ' + f.invalid_date_count);
            if (Number.isInteger(f.required_count) && Number.isInteger(f.actual_count))
                text.push('Απαιτούμενες ημερήσιες εγγραφές: ' + f.required_count + ' · Διαθέσιμες: ' + f.actual_count);
            if (Number.isInteger(f.scheduled_work_days)) text.push('Δηλωμένες εργάσιμες ημέρες εβδομάδας: ' + f.scheduled_work_days);
            if (Number.isInteger(f.contractual_weekly_days)) text.push('Συμβατικές ημέρες εργασίας εβδομάδας: ' + f.contractual_weekly_days);
            const daily = [];
            for (const [key, label] of [['declared_hours', 'Δηλωμένες ώρες'], ['card_hours', 'Ώρες κάρτας'], ['actual_hours', 'Επιβεβαιωμένες ώρες εργασίας']])
                if (typeof f[key] === 'number' && Number.isFinite(f[key])) daily.push(label + ': ' + f[key]);
            for (const [key, label] of [['declared_category', 'Προδηλωμένος χαρακτηρισμός'], ['actual_category', 'Απολογιστικός χαρακτηρισμός']])
                if (['ΕΡΓ', 'ΑΝ', 'ΜΕ', 'ΑΔΕΙΑ', 'ΑΣΘΕΝΕΙΑ', 'ΑΠΟΥΣΙΑ', 'ΑΡΓΙΑ'].includes(f[key])) daily.push(label + ': ' + f[key]);
            for (const [key, label] of [['declared_repo', 'Δηλωμένο ρεπό'], ['actual_repo', 'Απολογιστικό ρεπό']])
                if (typeof f[key] === 'boolean') daily.push(label + ': ' + (f[key] ? 'Ναι' : 'Όχι'));
            const time = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : 'λείπει';
            const intervals = (Array.isArray(f.card_intervals) ? f.card_intervals : []).slice(0, 3)
                .map(interval => time(interval.start) + '–' + time(interval.end));
            if (intervals.length) daily.push('Είσοδος–έξοδος κάρτας: ' + intervals.join(', '));
            if (daily.length) text.push((item.dates.map(formatDate).filter(Boolean).join(', ') || 'Ημέρα') + ' — ' + daily.join(' · '));
        });
        return text.length ? '<ul class="review-guidance-evidence">' + [...new Set(text)].map(value => '<li>' + escape(value) + '</li>').join('') + '</ul>' : '';
    }
    function detailHtml(target) {
        if (!target) return '';
        const scope = target.payload.scope || {};
        return '<section class="review-guidance-detail" tabindex="-1" aria-label="Συγκεκριμένες εκκρεμότητες εβδομάδας">' +
            '<p><strong>Εργαζόμενος:</strong> ' + escape(scope.employee_kodikos) + ' · ' + escape(target.payload.employee_name || 'Το ονοματεπώνυμο δεν είναι διαθέσιμο.') +
            '<br><strong>Εβδομάδα:</strong> ' + escape(formatDate(scope.week_start)) + '–' + escape(formatDate(scope.week_end)) +
            (target.date ? '<br><strong>Ημέρα εντοπισμού:</strong> ' + escape(formatDate(target.date)) : '') + '</p>' +
            target.issues.map(issue => '<article class="review-guidance-issue">' +
                '<h3>' + (issue.dates.length ? escape(issue.dates.map(formatDate).join(', ')) + ' · ' : '') + escape(issue.message) + '</h3><p class="text-muted">' + escape(issue.category_label) + '</p>' +
                '<p><strong>Επηρεαζόμενες ημέρες:</strong> ' + escape(issue.dates.length ? issue.dates.map(formatDate).join(', ') : 'Δεν επιστράφηκαν συγκεκριμένες ημερομηνίες για αυτή την αιτία. Αφορά τον έλεγχο της εβδομάδας.') + '</p>' +
                evidenceHtml(issue.evidence) + '<p><strong>Γιατί σταματά η ενέργεια:</strong> ' + escape(issue.why) + '</p>' +
                '<strong>Τι πρέπει να κάνετε:</strong><ol>' + issue.steps.map(step => '<li>' + escape(step) + '</li>').join('') + '</ol>' +
                '<p><strong>Επόμενο βήμα:</strong> ' + escape(issue.next) + '</p>' +
                (issue.category === 'TECHNICAL' ? '<p class="small text-muted">Αναφορά τεχνικής υποστήριξης: ' + escape(issue.reference) + '</p>' : '') + '</article>').join('') +
            '<p class="small text-muted mb-0">Η προβολή και η μετάβαση στις εκκρεμότητες δεν αλλάζουν ούτε αποθηκεύουν στοιχεία.</p></section>';
    }
    function stageHtml(stage, target, index, count) {
        return '<p class="review-guidance-intro">' + escape(introductions[stage] || '') + '</p>' +
            (count ? '<div class="review-guidance-navigation" aria-label="Εντοπισμός εκκρεμοτήτων"><span role="status">Εκκρεμότητα ' + (index + 1) + ' από ' + count + '</span>' +
                '<button type="button" class="btn btn-sm employment-review-action-btn employment-review-action-primary" data-guidance-move="first">Πρώτη εκκρεμότητα</button>' +
                '<button type="button" class="btn btn-sm employment-review-action-btn employment-review-action-secondary" data-guidance-move="previous"' + (index <= 0 ? ' disabled' : '') + '>Προηγούμενη</button>' +
                '<button type="button" class="btn btn-sm employment-review-action-btn employment-review-action-primary" data-guidance-move="next"' + (index >= count - 1 ? ' disabled' : '') + '>Επόμενη εκκρεμότητα</button>' +
                '<button type="button" class="btn btn-sm employment-review-action-btn employment-review-action-secondary" data-guidance-move="locate">Εντοπισμός ημέρας / εβδομάδας</button></div>' : '');
    }
    function failureHtml(item = {}, { readOnly = false } = {}) {
        const codes = [...new Set([item.code || 'UNKNOWN', ...(item.blocking_reasons || [])])];
        const descriptions = codes.map(guidance.describe);
        return descriptions.map(entry => '<p>' + escape(entry.message) + ' ' + escape(entry.why) + '</p>').join('') +
            '<ol>' + [...new Set(descriptions.flatMap(entry => entry.steps))].map(step => '<li>' + escape(step) + '</li>').join('') + '</ol>' +
            '<p>' + (readOnly ? 'Ο έλεγχος αυτός δεν αποθήκευσε επιχειρησιακές αλλαγές.' :
                'Η συγκεκριμένη αλλαγή δεν επιβεβαιώθηκε. Ελέγξτε τη νέα κατάσταση πριν επαναλάβετε την ενέργεια.') + '</p>' +
            '<small>Αναφορά τεχνικής υποστήριξης: ' + escape(guidance.reference(item.code)) + '</small>';
    }
    return Object.freeze({ introductions, issues, targets, detailHtml, stageHtml, failureHtml });
});

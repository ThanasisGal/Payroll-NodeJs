'use strict';

// PR406 Stage5F. This is ONLY the guarded work-terms branch of the existing
// employee Save handler; it must not register another Save click listener.
// No history rows, approved editions, scopes or permissions are supplied by UI.
(function (root) {
    const DAYS = 'hmeres_ergasias_ebdomadas';
    const WEEK = 'typos_ebdomadas';
    const CONTRACT = 'apasxolhsh_basei_symbashs';
    const HOURS = 'ores_ergasias_ebdomadas';
    const DAILY = 'mo_oron_hmerhsias_ergasias';
    const FIELDS = [DAYS, WEEK, HOURS, DAILY];
    const objectId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
    const exactDay = value => {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const d = new Date(value + 'T00:00:00.000Z');
        return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value;
    };
    const asNumber = value => value === '' || value == null ? NaN : Number(value);
    const terms = data => data && ({
        [DAYS]: asNumber(data[DAYS]),
        [WEEK]: String(data[WEEK] ?? '').trim(),
        [HOURS]: asNumber(data[HOURS]),
        [DAILY]: asNumber(data[DAILY])
    });
    function validTerms(data) {
        const t = terms(data);
        if (!t || ![5, 6].includes(t[DAYS]) ||
            t[WEEK] !== (t[DAYS] === 5 ? '5HMERH' : '6HMERH') ||
            !Number.isFinite(t[HOURS]) || t[HOURS] <= 0 || t[HOURS] > 80 ||
            !Number.isFinite(t[DAILY]) || t[DAILY] <= 0 || t[DAILY] > 24 ||
            Math.abs(t[HOURS] - t[DAYS] * t[DAILY]) > t[DAYS] * 0.005 + 1e-8) return null;
        return t;
    }
    function sameTerms(a, b) {
        const x = terms(a), y = terms(b);
        return Boolean(x && y && FIELDS.every(field => field === WEEK
            ? x[field] === y[field]
            : Number.isFinite(x[field]) && Number.isFinite(y[field]) &&
              Math.abs(x[field] - y[field]) < 0.000001));
    }
    const contractDays = value => /^[56]$/.test(String(value ?? '').trim())
        ? Number(String(value).trim()) : null;
    const weekForDays = days => days === 5 ? '5HMERH' : days === 6 ? '6HMERH' : '';
    // A hidden TomSelect mirror must agree with the visible selection. Reject
    // mismatches rather than assuming a 5/6-day contractual choice.
    function submittedContractDays(formData) {
        const provided = [formData[CONTRACT], formData[CONTRACT+'_stathera']]
            .filter(value => value != null && String(value).trim() !== '');
        if (!provided.length) return null;
        const codes = provided.map(contractDays);
        return codes.every(value => value !== null && value === codes[0]) ? codes[0] : -1;
    }
    function baselineFromNode(node) {
        if (!node?.dataset) return null;
        const d = node.dataset;
        const raw = { [DAYS]:d.atomicDays, [WEEK]:d.atomicWeek,
            [HOURS]:d.atomicHours, [DAILY]:d.atomicDaily };
        const complete = validTerms(raw);
        if (complete) return complete;
        // The stored type may really be absent. A recorded, agreeing contract
        // code is corroboration for detecting a change, NOT a rewritten old
        // fact, a historical approval or a CLEAN certificate.
        const contract = contractDays(d.atomicContract);
        if (String(d.atomicWeek ?? '').trim() || contract === null ||
            contract !== asNumber(d.atomicDays)) return null;
        const numbers = validTerms({ ...raw, [WEEK]:weekForDays(contract) });
        return numbers ? { ...numbers, [WEEK]:'' } : null;
    }
    function changedFromRenderedBaseline(form, dataset) {
        if (!dataset) return true; // Missing evidence: never silently use legacy Save.
        const changedNumeric = [[DAYS,'atomicDays'],[HOURS,'atomicHours'],[DAILY,'atomicDaily']]
            .some(([field, key]) => asNumber(form[field]) !== asNumber(dataset[key]));
        const originalWeek = String(dataset.atomicWeek ?? '').trim();
        const enteredWeek = String(form[WEEK] ?? '').trim();
        const originalContract = contractDays(dataset.atomicContract);
        const equivalentMissingWeek = !originalWeek && enteredWeek &&
            originalContract === asNumber(dataset.atomicDays) &&
            enteredWeek === weekForDays(originalContract);
        const changedWeek = Boolean(enteredWeek) && enteredWeek !== originalWeek && !equivalentMissingWeek;
        const selectedContract = submittedContractDays(form);
        const changedContract = selectedContract === -1 ||
            (selectedContract !== null && selectedContract !== originalContract);
        return changedNumeric || changedWeek || changedContract;
    }
    function submittedTerms(form, baselineNode) {
        const selected = submittedContractDays(form), days = asNumber(form[DAYS]);
        if (selected === -1 || selected !== null && selected !== days) return null;
        const explicitWeek = String(form[WEEK] ?? '').trim();
        if (selected !== null && explicitWeek && explicitWeek !== weekForDays(selected)) return null;
        const oldWeek = String(baselineNode?.dataset?.atomicWeek ?? '').trim();
        const typed = explicitWeek || (selected !== null ? weekForDays(selected) :
            oldWeek ? weekForDays(days) : '');
        return validTerms({ ...form, [WEEK]:typed });
    }
    function hasSelectedExternalActions(selected) {
        return Object.entries(selected || {}).some(([key, value]) =>
            !['isPermanent', 'erganiUploadMethod'].includes(key) && value === true);
    }
    function createClient() {
        let running = false;
        let completed = false;
        let uncertain = false;
        async function tryHandle({ formData, baselineNode, employeeId, csrfToken,
            selectedActions, pendingHistory, isRehire, isTemporary, pendingAttachments,
            swal, fetcher, reload }) {
            const baseline = baselineFromNode(baselineNode);
            if (!changedFromRenderedBaseline(formData, baselineNode?.dataset)) return { handled:false };
            // Never permit a changed work-term field to escape into the old
            // update route when the persisted baseline is incomplete.
            if (!baseline) {
                await swal.fire({icon:'warning',title:'Δεν επαληθεύτηκε η αρχική εβδομάδα',
                    text:'Δεν υπάρχει συμβατή αποθηκευμένη βάση ημερών, ωρών και τύπου σύμβασης. '
                      +'Η ιστορική μεταβολή δεν θα σταλεί στην παλαιά αποθήκευση.',
                    confirmButtonText:'Κλείσιμο',allowOutsideClick:false});
                return {handled:true,saved:false};
            }
            if (running || completed || uncertain) return { handled: true,
                skipped: true, outcome: uncertain ? 'UNKNOWN' : 'ALREADY_IN_PROGRESS' };
            running = true;
            let applyAttempted = false;
            const notify = (icon, title, message) => swal.fire({ icon, title, text:message,
                confirmButtonText:'Κλείσιμο', allowOutsideClick:false });
            const request = async (base, suffix, data) => {
                const response = await fetcher(base + suffix, {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type':'application/json', 'CSRF-Token':csrfToken },
                    body: JSON.stringify(data)
                });
                const body = await response.json().catch(() => null);
                return { response, body };
            };
            try {
                if (pendingHistory) {
                    await notify('warning','Εκκρεμές Ιστορικό',
                        'Πρέπει πρώτα να επιλυθεί η υπάρχουσα ιστορική εκκρεμότητα. Οι ανεξάρτητες ενημερώσεις διατηρούν τη συνηθισμένη αποθήκευσή τους.');
                    return { handled:true, saved:false };
                }
                if (isRehire || isTemporary) {
                    await notify('warning','Αποθήκευση ιστορικής μεταβολής',
                        'Η νέα ιστορική μεταβολή επιτρέπεται μόνο από οριστικοποιημένη Συντήρηση Εργαζομένου, όχι από προσωρινή αποθήκευση ή επαναπρόσληψη.');
                    return { handled:true, saved:false };
                }
                if (hasSelectedExternalActions(selectedActions) || pendingAttachments) {
                    await notify('warning','Ξεχωριστή αποθήκευση ενεργειών',
                        'Επιλέχθηκαν έγγραφα ή ενέργειες ΕΡΓΑΝΗ. Για να μη γίνει διπλή υποβολή, καταχωρίστε την ιστορική μεταβολή ξεχωριστά, χωρίς επιλεγμένες εξωτερικές ενέργειες. Δεν εκτελέστηκε καμία ενέργεια.');
                    return { handled:true, saved:false };
                }
                const correctedTerms = submittedTerms(formData,baselineNode);
                if (!correctedTerms) {
                    await notify('warning','Ασυνεπείς ημέρες και ώρες',
                        'Οι ημέρες πρέπει να συμφωνούν με την «Απασχόληση Βάσει Σύμβασης» (5ήμερη/6ήμερη), καθώς και με τις εβδομαδιαίες και τις ημερήσιες ώρες. Δεν αποθηκεύτηκε αλλαγή.');
                    return { handled:true, saved:false };
                }
                if (!objectId(employeeId) || typeof csrfToken !== 'string' || !csrfToken) {
                    await notify('error','Αδύνατη ασφαλής αποθήκευση',
                        'Λείπει επαληθεύσιμο αναγνωριστικό εργαζομένου ή διακριτικό ασφαλείας. Δεν αποθηκεύτηκε αλλαγή.');
                    return { handled:true, saved:false };
                }
                const base = '/api/ergazomenoi/' + encodeURIComponent(employeeId) + '/history-approved-maintenance';
                const ctx = await request(base, '-context', {});
                if (!ctx.response.ok || ctx.body?.success !== true || ctx.body?.contextOnly !== true) {
                    await notify('warning','Η μεταβολή δεν είναι ακόμη διαθέσιμη',
                        ctx.body?.message || 'Η ασφαλής διαδικασία δεν έχει ενεργοποιηθεί. Δεν αποθηκεύτηκε καμία αλλαγή.');
                    return { handled:true, saved:false };
                }
                if (ctx.body.pendingHistory === true) {
                    await notify('warning','Εκκρεμές Ιστορικό',
                        'Υπάρχει ανεπίλυτη ιστορική εκκρεμότητα. Δεν επιτρέπεται δεύτερη μεταβολή.');
                    return { handled:true, saved:false };
                }
                if (!sameTerms(ctx.body.currentTerms, baseline) ||
                    String(ctx.body.currentContract ?? '') !== String(baselineNode.dataset.atomicContract ?? '')) {
                    await notify('warning','Τα στοιχεία άλλαξαν',
                        'Η αποθηκευμένη έκδοση διαφέρει από τη φόρμα. Ανοίξτε ξανά τον εργαζόμενο. Δεν αποθηκεύτηκε αλλαγή.');
                    return { handled:true, saved:false };
                }
                const kindResult = await swal.fire({
                    icon:'question', title:'Είδος ιστορικής ενέργειας',
                    text:'Η πραγματική μεταβολή και η διόρθωση λανθασμένης καταχώρισης είναι διαφορετικές ενέργειες.',
                    input:'radio', inputOptions:{
                        NEW_CHANGE:'Πραγματική νέα μεταβολή με νέα ημερομηνία ισχύος',
                        CORRECT_SAVED_ERROR:'Διόρθωση λάθους στην ίδια ιστορική περίοδο'
                    }, inputValidator:v=>['NEW_CHANGE','CORRECT_SAVED_ERROR'].includes(v)
                        ? undefined : 'Επιλέξτε είδος ιστορικής ενέργειας.',
                    showCancelButton:true, confirmButtonText:'Συνέχεια',
                    cancelButtonText:'Ακύρωση', focusCancel:true, allowOutsideClick:false
                });
                if (!kindResult.isConfirmed) return { handled:true, cancelled:true };
                const kind = kindResult.value;
                if (!['NEW_CHANGE','CORRECT_SAVED_ERROR'].includes(kind)) {
                    await notify('warning','Απαιτείται επιλογή', 'Δεν επιλέχθηκε έγκυρη ιστορική ενέργεια.');
                    return { handled:true, saved:false };
                }
                let effectiveFrom;
                if (kind === 'NEW_CHANGE') {
                    const dateResult = await swal.fire({
                        icon:'question', title:'Ημερομηνία ισχύος της πραγματικής μεταβολής',
                        text:'Καταχωρίστε την ημερομηνία από την οποία ισχύουν οι νέοι όροι.',
                        input:'date', inputValidator:v=>exactDay(v)
                            ? undefined : 'Απαιτείται πραγματική ημερομηνία ΕΕΕΕ-ΜΜ-ΗΗ.',
                        showCancelButton:true, confirmButtonText:'Προεπισκόπηση',
                        cancelButtonText:'Ακύρωση', focusCancel:true, allowOutsideClick:false
                    });
                    if (!dateResult.isConfirmed) return { handled:true, cancelled:true };
                    effectiveFrom = dateResult.value;
                } else {
                    effectiveFrom = ctx.body.effectiveFrom;
                    if (!objectId(ctx.body.targetHistoryId) || !exactDay(effectiveFrom)) {
                        await notify('warning','Ανεπαρκής τεκμηρίωση',
                            'Δεν εντοπίστηκε αξιόπιστα η τελευταία ιστορική περίοδος για διόρθωση. Καμία αλλαγή δεν έγινε.');
                        return { handled:true, saved:false };
                    }
                }
                if (!exactDay(effectiveFrom)) {
                    await notify('warning','Μη έγκυρη ημερομηνία',
                        'Επιλέξτε έγκυρη ημερομηνία ισχύος. Δεν αποθηκεύτηκε αλλαγή.');
                    return { handled:true, saved:false };
                }
                const change = { kind, effectiveFrom, correctedTerms,
                    ...(kind === 'CORRECT_SAVED_ERROR' ? { targetHistoryId:ctx.body.targetHistoryId } : {}) };
                const preview = await request(base, '-preview', { change });
                if (!preview.response.ok || preview.body?.success !== true ||
                    preview.body.previewOnly !== true || preview.body.status !== 'READY_FOR_SIGNED_ATOMIC_COMMIT' ||
                    typeof preview.body.approval !== 'string' || !preview.body.approval) {
                    await notify('warning','Απορρίφθηκε η ιστορική μεταβολή',
                        preview.body?.message || 'Δεν επαληθεύτηκε η νέα μεταβολή ή η προϋπάρχουσα ιστορική περίοδος. Δεν αποθηκεύτηκε αλλαγή.');
                    return { handled:true, saved:false };
                }
                const label = kind === 'NEW_CHANGE' ? 'Νέα πραγματική μεταβολή' : 'Διόρθωση λάθους στην ίδια περίοδο';
                const confirmed = await swal.fire({
                    icon:'warning', title:'Υπογεγραμμένη επιβεβαίωση',
                    text:`${label}, με ισχύ ${effectiveFrom}. ${baseline[DAYS]} → ${correctedTerms[DAYS]} ημέρες, `+
                        `${correctedTerms[HOURS]} ώρες/εβδομάδα, ${correctedTerms[DAILY]} ώρες/ημέρα. `+
                        'Η συναλλαγή αφορά μόνο ημέρες, τύπο εβδομάδας, ώρες και αντίστοιχο Ιστορικό/audit. ' +
                        'Άλλες αλλαγές της φόρμας, έγγραφα και ΕΡΓΑΝΗ ΔΕΝ αποθηκεύονται με αυτό το βήμα. ' +
                        'Οι επαληθευμένες παλαιές εγκρίσεις δεν ξαναζητούνται.',
                    showCancelButton:true, confirmButtonText:'Έγκριση και αποθήκευση',
                    cancelButtonText:'Ακύρωση', focusCancel:true,
                    allowOutsideClick:false, allowEscapeKey:false
                });
                if (!confirmed.isConfirmed) return { handled:true, cancelled:true };
                applyAttempted = true;
                const applied = await request(base, '-apply', {
                    change, approval:{token:preview.body.approval, confirmed:true}
                });
                if (applied.response.ok && applied.body?.success === true &&
                    applied.body.employeeUpdated === true && applied.body.historyUpdated === true &&
                    typeof applied.body.auditId === 'string' && applied.body.auditId) {
                    completed = true; // a committed write cannot become UNKNOWN due to a UI error
                    try {
                        await notify('success','Η ιστορική μεταβολή αποθηκεύτηκε',
                            'Επιβεβαιώθηκε η ατομική ενημέρωση εργαζομένου, Ιστορικού και audit. ' +
                            'Δεν εκτελέστηκαν ενέργειες εγγράφων/ΕΡΓΑΝΗ. Θα ανανεωθεί η φόρμα.');
                    } catch (_) { /* UI presentation must not erase the confirmed audit. */ }
                    if (typeof reload === 'function') {
                        try { reload(); } catch (_) { /* Navigation failure never retries a write. */ }
                    }
                    return { handled:true, saved:true, operation:kind };
                }
                // Once APPLY was issued, a malformed or partial response is NOT
                // evidence of rollback. Only an explicit server rejection is safe.
                const explicitRejection = applied.body?.saved === false &&
                    (applied.body?.outcome === 'REJECTED' || applied.response.status === 423);
                const unknown = !explicitRejection;
                if (unknown) uncertain = true;
                await notify(unknown ? 'error' : 'warning',
                    unknown ? 'Αβέβαιη κατάσταση συναλλαγής' : 'Δεν ολοκληρώθηκε η αποθήκευση',
                    unknown ? 'Δεν έχει επιβεβαιωθεί αν ολοκληρώθηκε η συναλλαγή. ΜΗΝ επαναλάβετε την αποθήκευση πριν από ανεξάρτητο έλεγχο.' :
                        (applied.body?.message || 'Η συναλλαγή απορρίφθηκε. Καμία επιτυχία δεν πιστοποιήθηκε.'));
                return { handled:true, saved:false, outcome:unknown ? 'UNKNOWN' : 'REJECTED' };
            } catch (_) {
                // A lost connection after apply may hide a successful commit.
                // Never silently retry and never submit the ordinary Save.
                uncertain = applyAttempted;
                await notify('error','Δεν επαληθεύτηκε η σύνδεση',
                    applyAttempted
                        ? 'Η επικοινωνία χάθηκε μετά την έναρξη εφαρμογής. ΜΗΝ επαναλάβετε πριν από ανεξάρτητη επαλήθευση της συναλλαγής.'
                        : 'Η επικοινωνία απέτυχε πριν από την εφαρμογή. Δεν έχει επιβεβαιωθεί αποθήκευση.');
                return { handled:true, saved:false, outcome:applyAttempted ? 'UNKNOWN' : 'NOT_APPLIED' };
            } finally { running = false; }
        }
        return Object.freeze({ tryHandle });
    }
    const api = Object.freeze({ createClient, baselineFromNode, validTerms,
        sameTerms, exactDay, hasSelectedExternalActions });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.employeeApprovedHistoryAtomicSaveUi = createClient();
})(typeof window !== 'undefined' ? window : null);

'use strict';
(function () {
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const duration = option => { const minute = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
        const total = (minute(option.end) - minute(option.start) + 1440) % 1440;
        return `${Math.floor(total / 60)} ώρες και ${total % 60} λεπτά`; };
    const pairs = row => ['01', '02', '03'].map(pair => {
        const start = row?.[`apo_ora_${pair}_apologistika`];
        const end = row?.[`eos_ora_${pair}_apologistika`];
        return start || end ? `${escape(start)}–${escape(end)}` : '—';
    }).join('<br>');
    function reportHtml(preview) {
        const before = preview.before_report?.rows || [];
        const after = new Map((preview.control_report?.rows || []).map(row => [row.source_record_id, row]));
        const unresolved = new Set((preview.unresolved || []).map(row => row.row_id));
        return '<div class="wto-revision-table-wrap" tabindex="0" aria-label="Συνολική προεπισκόπηση περιόδου">' +
            '<table class="table table-sm wto-revision-table"><thead><tr><th>Εργαζόμενος</th><th>Ημερομηνία</th><th>ΠΡΙΝ — Παγωμένα</th><th>ΜΕΤΑ — Διορθωτική έκδοση</th></tr></thead><tbody>' +
            before.map(row => {
                const next = after.get(row.source_record_id) || {};
                const intervals = item => [item.zeugos1, item.zeugos2, item.zeugos3].map(escape).join('<br>');
                return `<tr><td>${escape(row.kodikos)} · ${escape(row.eponymo)} ${escape(row.onoma)}</td>` +
                    `<td>${escape(row.hmeromhnia)}</td><td>${intervals(row)}</td>` +
                    `<td>${unresolved.has(row.source_record_id) ? 'Απαιτείται επιλογή πραγματικών ωρών' : intervals(next)}</td></tr>`;
            }).join('') + '</tbody></table></div>';
    }
    function choicesHtml(preview) {
        return (preview.unresolved || []).map((row, index) => {
            const employee = preview.before_report.rows.find(item => item.source_record_id === row.row_id);
            return `<fieldset class="wto-revision-choice"><legend>${escape(employee?.eponymo)} ${escape(employee?.onoma)} · ${escape(row.date.split('-').reverse().join('/'))}</legend>` +
                `<p>Αρχικά παγωμένα διαστήματα:<br>${pairs(row.before)}</p>` +
                '<p>Επιλέξτε ποιο ζεύγος αποτυπώνει την πραγματική εργασία. Η λήξη μετά τα μεσάνυχτα ανήκει στην επόμενη ημέρα.</p>' +
                row.options.map(option => `<label class="wto-revision-option"><input type="radio" name="wto-choice-${index}" value="${option.pairNumber}"> Διατήρηση ${escape(option.start)}–${escape(option.end)} (${duration(option)}) και αφαίρεση των άλλων ζευγών</label>`).join('') +
                `<details class="wto-revision-manual"><summary>Αναλυτικός έλεγχος πραγματικών ωρών, για μερική επικάλυψη ή διαφορετική διόρθωση</summary>` +
                `<label class="wto-revision-option"><input type="radio" name="wto-choice-${index}" value="manual"> Διατήρηση των παρακάτω επιβεβαιωμένων διαστημάτων</label>` +
                [0, 1, 2].map(pair => `<div class="wto-revision-time-pair"><span>Διάστημα ${pair + 1}</span><label>Από <input type="time" id="wto-manual-${index}-${pair}-start"></label><label>Έως <input type="time" id="wto-manual-${index}-${pair}-end"></label></div>`).join('') +
                '</details>' +
                `<label class="wto-revision-option"><input type="checkbox" id="wto-hours-confirm-${index}"> Επιβεβαιώνω τις συγκεκριμένες πραγματικές ώρες που επέλεξα.</label>` +
                '</fieldset>';
        }).join('');
    }
    async function open({ scope, getScope, csrfToken, showDialog }) {
        const unchangedScope = () => {
            if (getScope && JSON.stringify(getScope()) !== JSON.stringify(scope)) {
                throw new Error('Η επιλεγμένη περίοδος ή το παράρτημα άλλαξε. 1. Κλείστε την προεπισκόπηση. 2. Ανοίξτε τη ξανά για τη σωστή περίοδο. Δεν αποθηκεύτηκε αλλαγή.');
            }
        };
        const post = async (action, command) => {
            unchangedScope();
            const response = await fetch(`/api/prodhlomena-oraria/review/period-control/submission/revision/${action}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'CSRF-Token': csrfToken },
                body: JSON.stringify({ ypokatasthma: scope.ypokatasthma, ...command })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message ||
                'Η ενέργεια δεν επιβεβαιώθηκε. 1. Ζητήστε έλεγχο της διορθωτικής έκδοσης. 2. Επαναλάβετε μόνο αφού επιβεβαιωθεί η κατάστασή της. Η κατάσταση αποθήκευσης χρειάζεται επιβεβαίωση. Δεν στάλθηκε υποβολή.');
            return result;
        };
        const approved = await post('current', {});
        if (approved.revision) {
            const revision = approved.revision;
            const transmission = approved.transmission;
            if (transmission) {
                await showDialog({ icon: transmission.status === 'SUCCESS' ? 'success' : 'warning',
                    title: transmission.status === 'SUCCESS' ? 'Καταγεγραμμένη επιτυχής υποβολή' : 'Υπάρχει ήδη απόπειρα αποστολής',
                    text: transmission.status === 'SUCCESS' ? `Πρωτόκολλο: ${transmission.result?.protocol || ''}. Δεν θα σταλεί ξανά.` :
                        'Η προηγούμενη απόπειρα αποκλείει νέα αποστολή. 1. Ελέγξτε την κατάσταση στο ΕΡΓΑΝΗ. 2. Ζητήστε συμφωνία της καταγραφής. Δεν έγινε νέα αποστολή ή αποθήκευση από αυτή την ενέργεια.' }); return;
            }
            const requestId = `wto-revision-send-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
            const sent = await showDialog({ title: 'Εγκεκριμένη διορθωτική έκδοση — χωριστή αποστολή',
                customClass: { popup: 'wto-revision-swal' }, showCancelButton: true, cancelButtonText: 'Κλείσιμο',
                showConfirmButton: approved.send_enabled === true, confirmButtonText: 'Εγκρίνω την πραγματική αποστολή στο ΕΡΓΑΝΗ',
                showLoaderOnConfirm: true, allowOutsideClick: () => !Swal.isLoading(),
                html: '<div class="wto-revision-content"><p>Το αρχικό στιγμιότυπο παραμένει αμετάβλητο. Θα αποσταλούν ακριβώς τα παρακάτω εγκεκριμένα διαστήματα.</p>' +
                    reportHtml({ before_report: revision.control_report, control_report: revision.control_report }) +
                    (approved.send_enabled ?
                        '<label class="wto-revision-option"><input type="checkbox" id="wto-send-previous"> Έλεγξα στο ΕΡΓΑΝΗ ότι η προηγούμενη απόπειρα δεν έγινε δεκτή.</label>' +
                        '<label for="wto-send-evidence">Τεκμηρίωση ελέγχου προηγούμενης απόπειρας</label><textarea id="wto-send-evidence" class="swal2-textarea"></textarea>' +
                        '<label class="wto-revision-option"><input type="checkbox" id="wto-send-review"> Έλεγξα όλο το περιεχόμενο και τις οριακές εβδομάδες και εγκρίνω χωριστά την πραγματική αποστολή.</label>' :
                        '<p>Η πραγματική αποστολή παραμένει απενεργοποιημένη μέχρι τον επιτυχή υποχρεωτικό έλεγχο και τη χωριστή εξουσιοδότηση ενεργοποίησης.</p>') + '</div>',
                preConfirm: async () => {
                    const evidence = document.getElementById('wto-send-evidence')?.value.trim();
                    if (!evidence || !document.getElementById('wto-send-previous')?.checked || !document.getElementById('wto-send-review')?.checked) {
                        Swal.showValidationMessage('Η αποστολή δεν εγκρίθηκε πλήρως. 1. Επιβεβαιώστε και τεκμηριώστε την προηγούμενη απόπειρα. 2. Ελέγξτε όλο το περιεχόμενο και τις οριακές εβδομάδες. Δεν αποθηκεύτηκε αλλαγή και δεν έγινε αποστολή.'); return false;
                    }
                    try {
                        const response = await post('submit', { revision_id: revision._id,
                            expected_preview_fingerprint: revision.preview_fingerprint, request_id: requestId,
                            approve_submission: true, previous_attempt_not_accepted: true, previous_attempt_evidence: evidence,
                            reviewed_entire_payload: true, boundary_reviewed: true });
                        return response;
                    } catch (error) { Swal.showValidationMessage(error.message); Swal.getConfirmButton().disabled = true; return false; }
                } });
            if (sent.isConfirmed) await showDialog({ icon: 'success', title: 'Η υποβολή καταγράφηκε',
                text: sent.value.message + ` Πρωτόκολλο: ${sent.value.transmission?.result?.protocol || ''}` });
            return;
        }
        const reasonResult = await showDialog({ title: 'Διορθωτική έκδοση απολογιστικών διαστημάτων',
            text: 'Το αρχικό οριστικοποιημένο στιγμιότυπο παραμένει αμετάβλητο. Θα ελεγχθεί ολόκληρη η περίοδος πριν από χωριστή αποθήκευση.',
            input: 'textarea', inputLabel: 'Αιτιολογία', showCancelButton: true,
            confirmButtonText: 'Προεπισκόπηση', cancelButtonText: 'Ακύρωση',
            inputValidator: value => String(value || '').trim() ? undefined :
                'Δεν δόθηκε αιτιολογία. 1. Περιγράψτε τη διόρθωση. 2. Πατήστε Προεπισκόπηση. Δεν αποθηκεύτηκε αλλαγή.' });
        if (!reasonResult.isConfirmed) return;
        const command = { reason: String(reasonResult.value).trim(), corrections: [] };
        let preview = (await post('preview', command)).preview;
        const dialogOptions = { customClass: { popup: 'wto-revision-swal' }, showCancelButton: true,
            cancelButtonText: 'Ακύρωση', showLoaderOnConfirm: true, allowOutsideClick: () => !Swal.isLoading() };
        if (preview.unresolved.length) {
            const selection = await showDialog({ ...dialogOptions, title: 'Επιβεβαίωση αντικρουόμενων ωρών',
                html: '<div class="wto-revision-content"><p>Δεν αποθηκεύτηκε αλλαγή. Επιβεβαιώστε κάθε ημέρα πριν συνεχίσετε.</p>' +
                    reportHtml(preview) + choicesHtml(preview) + '</div>', confirmButtonText: 'Ενημέρωση συνολικής προεπισκόπησης',
                preConfirm: async () => {
                    const corrections = [];
                    for (const [index, row] of preview.unresolved.entries()) {
                        const value = document.querySelector(`input[name="wto-choice-${index}"]:checked`)?.value;
                        const selected = row.options.find(option => option.pairNumber === Number(value));
                        if ((!selected && value !== 'manual') || !document.getElementById(`wto-hours-confirm-${index}`)?.checked) {
                            Swal.showValidationMessage('Υπάρχουν ανεπιβεβαίωτες ώρες. 1. Επιλέξτε ένα ζεύγος ή αναλυτική διόρθωση για κάθε ημέρα. 2. Επιβεβαιώστε τις ώρες με το αντίστοιχο πλαίσιο. Δεν αποθηκεύτηκε αλλαγή.'); return false;
                        }
                        let intervals;
                        if (value === 'manual') {
                            intervals = [0, 1, 2].map(pair => ({
                                start: document.getElementById(`wto-manual-${index}-${pair}-start`)?.value || '',
                                end: document.getElementById(`wto-manual-${index}-${pair}-end`)?.value || ''
                            })).filter(item => item.start || item.end);
                            if (!intervals.length || intervals.some(item => !item.start || !item.end)) {
                                Swal.showValidationMessage('Οι πραγματικές ώρες είναι ελλιπείς. 1. Συμπληρώστε Από και Έως για κάθε διάστημα εργασίας. 2. Αφήστε εντελώς κενά τα αχρησιμοποίητα διαστήματα. Δεν αποθηκεύτηκε αλλαγή.'); return false;
                            }
                        } else intervals = [{ start: selected.start, end: selected.end }];
                        corrections.push({ row_id: row.row_id, date: row.date,
                            ...(value === 'manual' ? {} : { keep_pair: Number(value) }),
                            confirmed_actual_hours: true, intervals });
                    }
                    try { return { corrections, preview: (await post('preview', { ...command, corrections })).preview }; }
                    catch (error) { Swal.showValidationMessage(error.message); return false; }
                } });
            if (!selection.isConfirmed) return;
            command.corrections = selection.value.corrections; preview = selection.value.preview;
        }
        if (!preview.ready_to_create) {
            await showDialog({ icon: 'info', title: 'Δεν προκύπτει διαθέσιμη διορθωτική έκδοση',
                text: 'Οι ώρες δεν χρειάζονται συνένωση ή υπάρχουν ανεπίλυτες διαφορές. 1. Ελέγξτε την επιλεγμένη περίοδο. 2. Ζητήστε έλεγχο των πραγματικών ωρών εφόσον χρειάζεται. Δεν αποθηκεύτηκε αλλαγή.' }); return;
        }
        const requestId = `wto-revision-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
        const approval = await showDialog({ ...dialogOptions, title: 'Συνολική προεπισκόπηση ΠΡΙΝ / ΜΕΤΑ',
            html: '<div class="wto-revision-content"><p>Το αρχικό οριστικοποιημένο στιγμιότυπο δεν μεταβάλλεται. Η νέα έκδοση αφορά μόνο τα διαστήματα προς υποβολή· οι υπολογισμοί μισθοδοσίας παραμένουν ως έχουν.</p>' +
                reportHtml(preview) + '<label class="wto-revision-option"><input type="checkbox" id="wto-revision-approve"> Έλεγξα ολόκληρη την περίοδο και εγκρίνω ρητά τη δημιουργία αυτής της διορθωτικής έκδοσης.</label>' +
                '<p>Δεν θα γίνει αποστολή στο ΕΡΓΑΝΗ.</p></div>', confirmButtonText: 'Έγκριση και δημιουργία διορθωτικής έκδοσης',
            preConfirm: async () => {
                if (!document.getElementById('wto-revision-approve')?.checked) {
                    Swal.showValidationMessage('Δεν δόθηκε ρητή έγκριση. 1. Ελέγξτε όλη την προεπισκόπηση. 2. Επιλέξτε το πλαίσιο έγκρισης για να συνεχίσετε. Δεν αποθηκεύτηκε αλλαγή.'); return false;
                }
                try { return await post('create', { ...command, approve: true, reviewed_entire_preview: true,
                    expected_preview_fingerprint: preview.preview_fingerprint, request_id: requestId }); }
                catch (error) { Swal.showValidationMessage(error.message); return false; }
            } });
        if (approval.isConfirmed) await showDialog({ icon: 'success', title: 'Δημιουργήθηκε διορθωτική έκδοση',
            text: approval.value.message });
    }
    window.WtoDailySubmissionRevisionUi = { open, reportHtml, choicesHtml };
})();

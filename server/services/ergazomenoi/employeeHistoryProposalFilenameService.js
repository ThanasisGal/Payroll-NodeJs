'use strict';

const C = require('./employeeHistoryAutomaticReconstructionContract');
const { calendarDate } = require('../../utils/ergazomenoi/employmentProfileContract');
function component(value) {
    if (typeof value !== 'string' || /^[a-f\d]{24}$/i.test(value)) return '';
    const text = value.normalize('NFC').replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, '_')
        .replace(/\s+/g, '_').replace(/\.{2,}/g, '_').replace(/^[. _]+|[. _]+$/g, '').slice(0, 32);
    return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(text) ? `_${text}` : text;
}
const date = value => { try { return calendarDate(value)?.toISOString().slice(0, 10) || ''; } catch { return ''; } };
function employeeHistoryProposalFilename(input, selectedCase) {
    const row = input.completeHistoryRows.find(item => String(item._id) === selectedCase.targetHistoryId);
    const action = selectedCase.operation === 'REVIEW_REQUIRED' ? 'REVIEW' : selectedCase.operation;
    const codes = [input.scope.team, input.companyBusinessCode, input.scope.kodikos,
        row?.ypokatasthma ?? input.currentEmployee.ypokatasthma].map(component).filter(Boolean);
    const identity = action === 'UPDATE' && component(row?.aa_eggrafhs) ? [`ΙΣΤ${component(row.aa_eggrafhs)}`] : [];
    const description = action === 'INSERT' ? 'Ελλείπουσα_Περίοδος' : action === 'UPDATE' ? 'Διόρθωση_Εγγραφής' : 'Έλεγχος_Ιστορικού';
    const dates = action === 'INSERT' ? [selectedCase.period.from, selectedCase.period.to].map(date).filter(Boolean) :
        [date(row?.[C.CHANGE]) || date(selectedCase.period.from)].filter(Boolean);
    const chars = Array.from([...codes, ...identity, action, description, ...dates].join('_'));
    while (Buffer.byteLength(chars.join(''), 'utf8') > 220) chars.pop();
    return `${chars.join('').replace(/[. _]+$/g, '')}.xlsx`;
}
module.exports = { employeeHistoryProposalFilename };

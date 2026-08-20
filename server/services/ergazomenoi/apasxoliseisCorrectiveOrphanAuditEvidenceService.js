'use strict';

const mongoose = require('mongoose');
const { canonicalize } = require('./apasxoliseisPeriodFrozenSnapshotService');

function evidenceError(code, message) {
    const error = new Error(message); error.code = code; error.statusCode = 400; return error;
}
function dateKey(value) { return String(value instanceof Date ? value.toISOString() : value || '').slice(0, 10); }
function validTime(value) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')); }

function validateOrphanAuditEvidence({ baselineSnapshot, finalizedAt, commands, auditRecords }) {
    const requestedIds = [...new Set(commands.flatMap((command) => command.evidence_audit_ids || []).map(String))];
    const recordsById = new Map((auditRecords || []).map((record) => [String(record._id), record]));
    const baselineById = new Map((baselineSnapshot?.daily_results || []).map((row) => [String(row._id), row]));
    const finalizedTime = new Date(finalizedAt).getTime();
    if (!Number.isFinite(finalizedTime)) throw evidenceError('CORRECTIVE_EVIDENCE_FINALIZED_AT_INVALID',
        'Δεν υπάρχει έγκυρος χρόνος οριστικοποίησης για την επαλήθευση evidence.');
    return requestedIds.map((auditId) => {
        const audit = recordsById.get(auditId);
        if (!audit) throw evidenceError('CORRECTIVE_ORPHAN_AUDIT_NOT_FOUND', 'Δεν βρέθηκε το αναφερόμενο orphan audit.');
        const rowId = String(audit.prodhlomena_oraria_id || ''); const row = baselineById.get(rowId);
        const command = commands.find((item) => (item.evidence_audit_ids || []).map(String).includes(auditId));
        const resolution = audit.newValues?.orphan_card_resolution;
        const changedAt = new Date(audit.changedAt).getTime();
        const approvedAt = new Date(resolution?.approved_at).getTime();
        if (!row || String(audit.team) !== String(baselineSnapshot.scope?.team) ||
            String(audit.company_kod) !== String(baselineSnapshot.scope?.company_kod) ||
            String(row.kodikos) !== String(command?.employee_kodikos) ||
            String(audit.kodikos) !== String(row.kodikos) ||
            String(audit.ypokatasthma || '').padStart(4, '0') !==
                String(row.ypokatasthma || baselineSnapshot.scope?.ypokatasthma || '').padStart(4, '0') ||
            dateKey(audit.hmeromhnia) !== dateKey(row.hmeromhnia) ||
            dateKey(row.hmeromhnia) < command.week_start ||
            dateKey(row.hmeromhnia) > dateKey(new Date(
                new Date(`${command.week_start}T00:00:00.000Z`).getTime() + 6 * 86400000)) ||
            resolution?.status !== 'HR_APPROVED' || !validTime(resolution.approved_start) ||
            !validTime(resolution.approved_end) || resolution.approved_start === resolution.approved_end ||
            !(Number(resolution.approved_hours) > 0 && Number(resolution.approved_hours) <= 24) ||
            !Number.isFinite(changedAt) || !Number.isFinite(approvedAt) ||
            changedAt > finalizedTime || approvedAt > finalizedTime) {
            throw evidenceError('CORRECTIVE_ORPHAN_AUDIT_INVALID', 'Το orphan audit δεν συμφωνεί με το immutable frozen baseline.');
        }
        return Object.freeze(canonicalize({ audit_id: auditId, row_id: rowId,
            employee_kodikos: String(row.kodikos), date: dateKey(row.hmeromhnia),
            evidence_type: 'PRODHLomena_ORARIA_HR_APPROVED_ORPHAN_AUDIT',
            orphan_card_resolution: resolution }));
    });
}

async function loadVerifiedOrphanAuditEvidence({ baselineSnapshot, finalizedAt, commands,
    auditModel, session = null }) {
    const ids = [...new Set(commands.flatMap((command) => command.evidence_audit_ids || []).map(String))];
    if (!ids.length) return [];
    const query = auditModel.find({ _id: mongoose.trusted({ $in: ids }) }).select({ _id: 1,
        team: 1, company_kod: 1, prodhlomena_oraria_id: 1, kodikos: 1,
        ypokatasthma: 1, hmeromhnia: 1, changedAt: 1,
        'newValues.orphan_card_resolution': 1 });
    if (session && typeof query.session === 'function') query.session(session);
    const records = await query.lean();
    return validateOrphanAuditEvidence({ baselineSnapshot, finalizedAt, commands, auditRecords: records });
}

module.exports = { validateOrphanAuditEvidence, loadVerifiedOrphanAuditEvidence };

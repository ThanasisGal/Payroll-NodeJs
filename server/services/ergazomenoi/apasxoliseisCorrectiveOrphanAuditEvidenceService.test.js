'use strict';

const assert = require('assert');
const { canonicalize } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { normalizeCorrectionCommands, reconstructCorrectedHistoricalResult } =
    require('./apasxoliseisPeriodCorrectiveService');
const { validateOrphanAuditEvidence } =
    require('./apasxoliseisCorrectiveOrphanAuditEvidenceService');

const auditId = '6a7f73f539204eb71c90bee9';
const rowId = '6a7c515e6aeaefb3c8764b54';
const rows = Array.from({ length: 7 }, (_, index) => ({
    _id: index === 6 ? rowId : `00000000000000000000000${index}`,
    kodikos: '0004', ypokatasthma: '0000', is_locked: true,
    hmeromhnia: new Date(Date.UTC(2026, 5, 8 + index)).toISOString()
}));
const baselineSnapshot = canonicalize({
    snapshot_schema_version: 'employment-period-frozen:v3',
    source_calculation_version: 'employment-calculation:v2',
    scope: { team: 'THA', company_kod: '69e8e92fb198b803164b824a', ypokatasthma: '0000',
        period_start: '2026-06-01', period_end: '2026-06-30' },
    daily_results: rows, deviations: [], weekly_calculation_context: { rows }
});
const commands = normalizeCorrectionCommands({ corrections: [{ type: 'RECOMPUTE_FROZEN_WEEK',
    employee_kodikos: '0004', week_start: '2026-06-08', evidence_audit_ids: [auditId] }] });
const resolution = { status: 'HR_APPROVED', approved_start: '14:51', approved_end: '23:21',
    approved_hours: 8, approved_by: 'ΘΑΝΑΣΗΣ', approved_at: '2026-08-14T20:00:45.630Z' };
const audit = { _id: auditId, team: 'THA', company_kod: '69e8e92fb198b803164b824a',
    prodhlomena_oraria_id: rowId, kodikos: '0004', ypokatasthma: '0000',
    hmeromhnia: '2026-06-14T00:00:00.000Z', changedAt: '2026-08-14T20:00:53.396Z',
    newValues: { orphan_card_resolution: resolution } };

const baselineBefore = JSON.stringify(baselineSnapshot);
const verified = validateOrphanAuditEvidence({ baselineSnapshot,
    finalizedAt: '2026-08-19T20:53:30.973Z', commands, auditRecords: [audit] });
let runnerSawResolution;
const result = reconstructCorrectedHistoricalResult({ baselineSnapshot, commands, verifiedEvidence: verified,
    runAuthoritativeWeek: ({ frozenRows }) => {
        runnerSawResolution = frozenRows[6].orphan_card_resolution;
        return { correctedRows: frozenRows, deviations: [], diagnostics: [], canonical: [{ status: 'READY' }] };
    } });
assert.deepStrictEqual(runnerSawResolution, canonicalize(resolution));
assert.strictEqual(result.correctedContext.verified_evidence[0].audit_id, auditId);
assert.strictEqual(result.correctedContext.verified_evidence[0].row_id, rowId);
assert.strictEqual(JSON.stringify(baselineSnapshot), baselineBefore);

for (const invalidAudit of [
    { ...audit, kodikos: '9999' },
    { ...audit, hmeromhnia: '2026-06-13T00:00:00.000Z' },
    { ...audit, prodhlomena_oraria_id: '000000000000000000000099' },
    { ...audit, newValues: { orphan_card_resolution: { ...resolution, status: 'PENDING' } } }
]) assert.throws(() => validateOrphanAuditEvidence({ baselineSnapshot,
    finalizedAt: '2026-08-19T20:53:30.973Z', commands, auditRecords: [invalidAudit] }),
    (error) => error.code === 'CORRECTIVE_ORPHAN_AUDIT_INVALID');

assert.throws(() => validateOrphanAuditEvidence({ baselineSnapshot,
    finalizedAt: '2026-08-19T20:53:30.973Z', commands,
    auditRecords: [{ ...audit, changedAt: '2026-08-20T00:00:00.000Z' }] }),
    (error) => error.code === 'CORRECTIVE_ORPHAN_AUDIT_INVALID');

assert.throws(() => normalizeCorrectionCommands({ corrections: [{ type: 'RECOMPUTE_FROZEN_WEEK',
    employee_kodikos: '0004', week_start: '2026-06-08', orphan_card_resolution: resolution }] }),
    (error) => error.code === 'CORRECTIVE_AUTHORITATIVE_FIELD_FORBIDDEN');

console.log('corrective orphan audit evidence validation/in-memory application: PASS');

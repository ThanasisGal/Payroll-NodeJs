'use strict';

const PeriodControlModel = require('../../models/apasxoliseisPeriodControl');
const FrozenModel = require('../../models/apasxoliseisPeriodFrozenSnapshot');
const { trusted } = require('mongoose');
const { rejected } = require('./employeeHistoryProposalImportFileService');

// Read-only queries against the existing period contracts. Never call lifecycle
// transitions, reconstruction, calculation, reference fences or transactions.
async function readImportProtection({ scope, branch, period }, {
    periodControlModel = PeriodControlModel, frozenModel = FrozenModel
} = {}) {
    const query = { team: scope.team, company_kod: scope.company_kod, ypokatasthma: branch,
        period_start: trusted({ $lte: new Date(period.to || '9999-12-31') }), period_end: trusted({ $gte: new Date(period.from) }) };
    const load = model => model.find(query).select('team company_kod ypokatasthma period_start period_end status frozen_snapshot_id')
        .limit(1001).lean();
    const [controls, snapshots] = await Promise.all([load(periodControlModel), load(frozenModel)]);
    if (controls.length > 1000 || snapshots.length > 1000) throw rejected('PROTECTION_UNKNOWN', 409);
    return { controls, snapshots };
}
function assertImportProtection(protection, { scope, branch, period }) {
    if (!protection || !Array.isArray(protection.controls) || !Array.isArray(protection.snapshots)) throw rejected('PROTECTION_UNKNOWN', 409);
    for (const row of [...protection.controls, ...protection.snapshots]) {
        const from = new Date(row.period_start).getTime(), to = new Date(row.period_end).getTime();
        if (row.period_start==null || row.period_end==null || row.team !== scope.team || row.company_kod !== scope.company_kod || row.ypokatasthma !== branch ||
            !Number.isFinite(from) || !Number.isFinite(to) || to < from) throw rejected('PROTECTION_UNKNOWN', 409);
        if (from <= new Date(period.to || '9999-12-31').getTime() && to >= new Date(period.from).getTime() &&
            (protection.snapshots.includes(row) || row.frozen_snapshot_id || ['LOCKED','FINALIZED'].includes(row.status)))
            throw rejected('PERIOD_PROTECTED', 409);
        if (protection.controls.includes(row) && !['OPEN','LOCKED','FINALIZED'].includes(row.status)) throw rejected('PROTECTION_UNKNOWN', 409);
    }
}
module.exports = { readImportProtection, assertImportProtection };

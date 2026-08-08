'use strict';

const FrozenModel = require('../../models/apasxoliseisPeriodFrozenSnapshot');
const CorrectiveModel = require('../../models/apasxoliseisPeriodCorrectiveCase');
const PostingModel = require('../../models/apasxoliseisCorrectivePayrollPosting');
const BalanceModel = require('../../models/apasxoliseisCorrectivePayrollBalance');
const { ApasxolhseisModel } = require('../../models/kinhseis');

const REQUIRED_INDEXES = Object.freeze([
    Object.freeze({ model: 'frozen', name: 'unique_apasxoliseis_frozen_snapshot_scope', unique: true }),
    Object.freeze({ model: 'frozen', name: 'unique_apasxoliseis_finalize_request', unique: true }),
    Object.freeze({ model: 'corrective', name: 'unique_active_apasxoliseis_corrective_case', unique: true }),
    Object.freeze({ model: 'corrective', name: 'unique_apasxoliseis_corrective_case_id', unique: true }),
    Object.freeze({ model: 'posting', name: 'unique_corrective_payroll_posting_business_key', unique: true }),
    Object.freeze({ model: 'posting', name: 'unique_corrective_payroll_posting_request', unique: true }),
    Object.freeze({ model: 'balance', name: 'unique_corrective_payroll_balance_scope', unique: true })
    , Object.freeze({ model: 'payroll', name: 'uniq_apasxolhseis_team_company_ypok_kod_xrhsh_period_typos_aa', unique: true })
]);
async function getPeriodLifecycleIndexState({ loaders = {
    frozen: () => FrozenModel.collection.indexes(), corrective: () => CorrectiveModel.collection.indexes(),
    posting: () => PostingModel.collection.indexes(), balance: () => BalanceModel.collection.indexes(),
    payroll: () => ApasxolhseisModel.collection.indexes()
} } = {}) {
    try {
        const loaded = { frozen: await loaders.frozen(), corrective: await loaders.corrective(),
            posting: await loaders.posting(), balance: await loaders.balance(), payroll: await loaders.payroll() };
        const missing = REQUIRED_INDEXES.filter((required) => !loaded[required.model]?.some((index) =>
            index?.name === required.name && index?.unique === required.unique)).map((item) => item.name);
        return Object.freeze({ ready: missing.length === 0, missing });
    } catch { return Object.freeze({ ready: false, missing: REQUIRED_INDEXES.map((item) => item.name) }); }
}
async function assertPeriodLifecycleIndexesReady(options) {
    const state = await getPeriodLifecycleIndexState(options);
    if (!state.ready) { const error = new Error('Η ασφαλής οριστικοποίηση ή διορθωτική διαδικασία δεν είναι διαθέσιμη.');
        error.code = 'PERIOD_LIFECYCLE_INDEXES_NOT_READY'; error.statusCode = 503; throw error; }
    return state;
}
module.exports = { REQUIRED_INDEXES, getPeriodLifecycleIndexState, assertPeriodLifecycleIndexesReady };

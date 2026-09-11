'use strict';
const assert = require('node:assert/strict');
const { buildPreparedPhaseHistoryMaps } = require('./preparedPhaseHistoryDatasetService');
const contractOnly = { _id: 'contract', aa_eggrafhs: '7',
    hmeromhnia_allaghs_symbashs: new Date('2026-07-01'),
    afora_allagh_oron_ergasias: false };
const workingTerms = { _id: 'terms', aa_eggrafhs: '7',
    afora_allagh_oron_ergasias: true,
    hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-06-15'),
    hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-07-15') };
const wrongAa = { ...workingTerms, _id: 'wrong-aa', aa_eggrafhs: '8' };
const result = buildPreparedPhaseHistoryMaps({
    historyByEmployee: new Map([['001', [contractOnly, workingTerms, wrongAa]]]),
    employeeByCode: new Map([['001', { aa_eggrafhs: '7' }]]),
    periodStart: new Date('2026-07-01'), periodEnd: new Date('2026-07-31') });
assert.deepEqual(result.contractStatusHistoryByEmployee.get('001'), [contractOnly]);
assert.deepEqual(result.workingTermsHistoryByEmployee.get('001'), [workingTerms]);
console.log('prepared phase history dataset tests passed');

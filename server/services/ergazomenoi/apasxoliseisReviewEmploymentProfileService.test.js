const assert = require('assert');
const {
    EMPLOYMENT_REGIME,
    resolveFullTimeFromWorkTerms,
    resolveEmploymentRegimeFromWorkTerms,
    resolveEmploymentRegimeForDate,
    resolveNoWorkDaySemanticFromWorkTerms,
    resolveNoWorkDaySemanticForDate,
    resolveReviewIsFullTimeProfile
} = require('./apasxoliseisReviewEmploymentProfileService');

assert.strictEqual(resolveFullTimeFromWorkTerms({ kathestos_apasxolhshs: '0' }), true);
assert.strictEqual(resolveFullTimeFromWorkTerms({ typos_apasxolhshs: 'ΠΛΗΡΗΣ' }), true);
assert.strictEqual(
    resolveFullTimeFromWorkTerms({
        kathestos_apasxolhshs: '',
        typos_apasxolhshs: '0'
    }),
    true
);
assert.strictEqual(resolveFullTimeFromWorkTerms({ kathestos_apasxolhshs: '1' }), false);
assert.strictEqual(resolveFullTimeFromWorkTerms({ kathestos_apasxolhshs: '2' }), false);
assert.strictEqual(
    resolveFullTimeFromWorkTerms({
        hmeres_ergasias_ebdomadas: 5,
        mo_oron_hmerhsias_ergasias: 8
    }),
    true
);

// Οι όροι εργασίας υπερισχύουν απόλυτα της λειτουργικής φάσης ωραρίου.
assert.strictEqual(
    resolveReviewIsFullTimeProfile({ kathestos_apasxolhshs: '0' }, '2'),
    true
);
assert.strictEqual(
    resolveReviewIsFullTimeProfile({ kathestos_apasxolhshs: '1' }, '0'),
    false
);

// Άγνωστοι όροι δεν μετατρέπονται σε καθεστώς από τη φάση.
assert.strictEqual(resolveReviewIsFullTimeProfile({}, '0'), null);
assert.strictEqual(resolveReviewIsFullTimeProfile({}, '1'), null);
assert.strictEqual(resolveReviewIsFullTimeProfile({}, ''), null);

assert.strictEqual(resolveEmploymentRegimeFromWorkTerms({ typos_apasxolhshs: '0' }),
    EMPLOYMENT_REGIME.FULL_TIME);
assert.strictEqual(resolveEmploymentRegimeFromWorkTerms({ typos_apasxolhshs: '1' }),
    EMPLOYMENT_REGIME.NON_FULL);
assert.strictEqual(resolveEmploymentRegimeFromWorkTerms({}), EMPLOYMENT_REGIME.UNKNOWN);
assert.deepStrictEqual(resolveEmploymentRegimeForDate({ date: '2026-06-02',
    effectiveProfile: { typos_apasxolhshs: '1' },
    effectiveProfilesByDate: { '2026-06-02': { typos_apasxolhshs: '0' } }
}), { regime: 'FULL_TIME', workTerms: { typos_apasxolhshs: '0' },
source: 'DATE_EFFECTIVE' });
assert.strictEqual(resolveEmploymentRegimeForDate({ date: '2026-06-02',
    effectiveProfile: { typos_apasxolhshs: '0' },
    effectiveProfilesByDate: { '2026-06-02': {} }
}).regime, EMPLOYMENT_REGIME.UNKNOWN);

const semantic = (type, system, days) => resolveNoWorkDaySemanticFromWorkTerms({
    typos_apasxolhshs: type, typos_ebdomadas: system,
    hmeres_ergasias_ebdomadas: days
});
for (const [type, system, days, classification, code] of [
    ['0', '5ΗΜΕΡΗ', 5, 'REST_REPO', 'ΑΝ'],
    ['0', '6ΗΜΕΡΗ', 6, 'REST_REPO', 'ΑΝ'],
    ['2', '5ΗΜΕΡΗ', 2, 'NON_WORK', 'ΜΕ'],
    ['2', '6ΗΜΕΡΗ', 5, 'NON_WORK', 'ΜΕ'],
    ['2', '6ΗΜΕΡΗ', 6, 'NON_WORK', 'ΜΕ'],
    ['1', '5ΗΜΕΡΗ', 5, 'REST_REPO', 'ΑΝ'],
    ['1', '5ΗΜΕΡΗ', 6, 'REST_REPO', 'ΑΝ'],
    ['1', '5ΗΜΕΡΗ', 4, 'NON_WORK', 'ΜΕ'],
    ['1', '5ΗΜΕΡΗ', 1, 'NON_WORK', 'ΜΕ'],
    ['1', '6ΗΜΕΡΗ', 6, 'REST_REPO', 'ΑΝ'],
    ['1', '6ΗΜΕΡΗ', 5, 'NON_WORK', 'ΜΕ'],
    ['1', '6ΗΜΕΡΗ', 4, 'NON_WORK', 'ΜΕ']
]) {
    const result = semantic(type, system, days);
    assert.strictEqual(result.status, 'RESOLVED');
    assert.strictEqual(result.classification, classification);
    assert.strictEqual(result.ergani_code, code);
}
for (const input of [
    { typos_apasxolhshs: '1', hmeres_ergasias_ebdomadas: 5 },
    { typos_apasxolhshs: '1', typos_ebdomadas: '5ΗΜΕΡΗ' },
    { typos_apasxolhshs: 'UNKNOWN', typos_ebdomadas: '5ΗΜΕΡΗ', hmeres_ergasias_ebdomadas: 5 },
    { kathestos_apasxolhshs: '0', typos_apasxolhshs: '1',
        typos_ebdomadas: '5ΗΜΕΡΗ', hmeres_ergasias_ebdomadas: 5 }
]) assert.strictEqual(resolveNoWorkDaySemanticFromWorkTerms(input).status, 'UNKNOWN');

const changedTerms = {
    '2026-08-10': { typos_apasxolhshs: '1', typos_ebdomadas: '5ΗΜΕΡΗ',
        hmeres_ergasias_ebdomadas: 5 },
    '2026-08-20': { typos_apasxolhshs: '1', typos_ebdomadas: '5ΗΜΕΡΗ',
        hmeres_ergasias_ebdomadas: 4 }
};
assert.strictEqual(resolveNoWorkDaySemanticForDate({ date: '2026-08-10',
    effectiveProfilesByDate: changedTerms,
    effectiveProfile: changedTerms['2026-08-20'] }).classification, 'REST_REPO');
assert.strictEqual(resolveNoWorkDaySemanticForDate({ date: '2026-08-20',
    effectiveProfilesByDate: changedTerms,
    effectiveProfile: changedTerms['2026-08-10'] }).classification, 'NON_WORK');

console.log('PASS review employment profile classification');

const assert = require('assert');
const {
    EMPLOYMENT_REGIME,
    resolveFullTimeFromWorkTerms,
    resolveEmploymentRegimeFromWorkTerms,
    resolveEmploymentRegimeForDate,
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

console.log('PASS review employment profile classification');

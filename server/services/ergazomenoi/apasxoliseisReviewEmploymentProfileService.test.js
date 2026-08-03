const assert = require('assert');
const {
    resolveFullTimeFromWorkTerms,
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

// Η ημερήσια schedule phase υπερισχύει, επειδή το καθεστώς μπορεί να αλλάζει
// μέσα στην ίδια εβδομάδα χωρίς να αποτελεί ενιαίο εβδομαδιαίο profile.
assert.strictEqual(
    resolveReviewIsFullTimeProfile({ kathestos_apasxolhshs: '0' }, '2'),
    false
);
assert.strictEqual(
    resolveReviewIsFullTimeProfile({ kathestos_apasxolhshs: '1' }, '0'),
    true
);

// Phase fallback μόνο όταν οι όροι εργασίας δεν δίνουν ασφαλή απάντηση.
assert.strictEqual(resolveReviewIsFullTimeProfile({}, '0'), true);
assert.strictEqual(resolveReviewIsFullTimeProfile({}, '1'), false);
assert.strictEqual(resolveReviewIsFullTimeProfile({}, ''), true);

console.log('PASS review employment profile classification');

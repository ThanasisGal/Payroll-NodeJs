'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { CANONICAL_STATUSES, canonicalizeEmployeeHistory } =
    require('./employeeHistoryCanonicalizationService');
const { identifyEmployeeHistoryProblemScope } =
    require('./employeeHistoryProblemScopeService');
const { REDUNDANT_REFERENCED } =
    require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { NEVER_IMPLICITLY_MUTATE, REGISTRY_VERSION, registryEntry,
    normalizeConfirmedFieldValue, validateWorkTermRelationships } =
    require('./employeeHistoryCorrectionFieldRegistryService');
const { PLAN_STATUSES, SHAPE_KINDS, INTENTS, FIELD_REQUIREMENT_STATES,
    determineRequiredCorrectionFields,
    planEmployeeHistoryUserConfirmedCorrection,
    resolveEmployeeHistoryUserConfirmedCorrection,
    applyConfirmedFieldDecisionToTimeline } =
    require('./employeeHistoryUserConfirmedCorrectionPlannerService');
const { h1MissingInitialProfileFixture, h2KpkBoundaryFixture,
    h3IntermediateOverlapFixture } =
    require('./fixtures/userConfirmedEmployeeHistoryCorrectionFixtures');

function planner(fixture) {
    const canonicalResult = canonicalizeEmployeeHistory({ scope: fixture.scope,
        currentEmployee: fixture.currentEmployee, historyRows: fixture.completeHistoryRows });
    const problemScope = identifyEmployeeHistoryProblemScope({ scope: fixture.scope,
        currentEmployee: fixture.currentEmployee,
        completeHistoryRows: fixture.completeHistoryRows });
    return planEmployeeHistoryUserConfirmedCorrection({ ...fixture,
        canonicalResult, problemScope });
}

function resolve(fixture, decisions) {
    return resolveEmployeeHistoryUserConfirmedCorrection({ plannerResult: planner(fixture),
        confirmation: { responsibilityAccepted: true, decisions },
        currentEmployee: fixture.currentEmployee,
        completeHistoryRows: fixture.completeHistoryRows });
}

function assertClean(result) {
    assert.equal(result.hypotheticalCanonicalResult.status, CANONICAL_STATUSES.CLEAN);
    assert.equal(result.hypotheticalCanonicalResult.cleanupRequired, false);
    assert.equal(result.hypotheticalCanonicalResult.idempotent, true);
    assert.equal(result.secondCanonicalResult.status, CANONICAL_STATUSES.CLEAN);
    assert.deepEqual(result.secondCanonicalResult.canonicalRows,
        result.hypotheticalCanonicalResult.canonicalRows);
}

function initialDecisions(fieldDecision = null) {
    return [
        { conflictId: 'INITIAL_PROFILE_START', intent: INTENTS.FROM_HIRE },
        { conflictId: 'INITIAL_PROFILE_TERMS', intent: INTENTS.CONFIRM_EXISTING,
            value: 'PROFILE_CANDIDATE_1' },
        ...(fieldDecision ? [{ conflictId: 'FIELD_KPK', ...fieldDecision }] : [])
    ];
}

function profileFieldIds(plan) {
    return plan.conflicts.find(conflict => conflict.conflictId === 'INITIAL_PROFILE_TERMS')
        ?.intents.find(intent => intent.id === INTENTS.ENTER_DIFFERENT_VALUE)
        ?.valueControl.fields.map(field => field.id) || [];
}

function h1DifferentValueDecisions(values = {
    KPK: '0109', WORK_DAYS: 5, WEEKLY_HOURS: 40, DAILY_HOURS: 8
}) {
    return [
        { conflictId: 'INITIAL_PROFILE_START', intent: INTENTS.FROM_HIRE },
        { conflictId: 'INITIAL_PROFILE_TERMS', intent: INTENTS.ENTER_DIFFERENT_VALUE,
            value: 'PROFILE_CANDIDATE_1', values }
    ];
}

test('το δημόσιο κείμενο H1 εξηγεί τις ημερομηνίες και ποια στοιχεία λείπουν', () => {
    const plan = planner(h1MissingInitialProfileFixture());
    const start = plan.conflicts.find(item => item.conflictId === 'INITIAL_PROFILE_START');
    assert.match(start.issue, /προσλήφθηκε στις 23\/04\/2026/);
    assert.match(start.issue, /25\/05\/2026/);
    assert.match(start.decisionRequired, /Από ποια ημερομηνία ίσχυαν/);
    const terms = plan.conflicts.find(item => item.conflictId === 'INITIAL_PROFILE_TERMS');
    assert.match(terms.issue, /λείπουν μερικά στοιχεία/);
    assert.match(terms.issue, /ΚΠΚ/);
    assert.match(terms.issue, /Ημέρες εργασίας ανά εβδομάδα/);
    assert.match(terms.issue, /δεν μπορεί να τα συμπληρώσει μόνη της/);
    assert.equal(terms.decisionRequired, 'Τι ίσχυε σε αυτό το διάστημα;');
});

test('το δημόσιο κείμενο H2 ξεχωρίζει το λάθος ΚΠΚ από την πραγματική αλλαγή', () => {
    const plan = planner(h2KpkBoundaryFixture());
    const field = plan.conflicts.find(item => item.conflictId === 'FIELD_KPK');
    assert.match(field.issue, /24\/04\/2026 έως 24\/05\/2026/);
    assert.match(field.issue, /ΚΠΚ: 0111 — ΣΥΝΤΑΞΗ/);
    assert.match(field.issue, /ΚΠΚ: 0115 — ΣΥΝΤΑΞΗ, ΒΑΡΕΑ, ΙΚΑ-ΤΕΑΜ/);
    assert.match(field.issue, /δύο ΚΠΚ δεν είναι το ίδιο/);
    assert.match(field.issue, /Πείτε τι ίσχυε πραγματικά/);
    const correction = field.intents.find(item => item.id === INTENTS.CORRECT_EXISTING_HISTORICAL_FACT);
    assert.match(correction.description, /μόνο το ΚΠΚ/);
    assert.match(correction.description, /Δεν θα δημιουργηθεί νέα αλλαγή σύμβασης/);
    assert.equal(correction.effectiveDateControl, undefined);
    const change = field.intents.find(item => item.id === INTENTS.REAL_HISTORICAL_CHANGE);
    assert.match(change.description, /παλιό ΚΠΚ ήταν σωστό στην αρχή/);
    assert.match(change.description, /ημερομηνία που έγινε η αλλαγή/);
    assert.equal(change.effectiveDateControl.label, 'Ημερομηνία που έγινε η αλλαγή');
    const start = plan.conflicts.find(item => item.conflictId === 'INITIAL_PROFILE_START');
    assert.equal(start.intents.find(item => item.id === INTENTS.OTHER_DATE)
        .effectiveDateControl.label, 'Ημερομηνία που άρχισαν να ισχύουν οι όροι');
});

test('το δημόσιο κείμενο H3 εξηγεί την πραγματική περίοδο και την εγγραφή από λάθος', () => {
    const plan = planner(h3IntermediateOverlapFixture());
    const meaning = plan.conflicts.find(item => item.conflictId === 'INTERMEDIATE_PERIOD_MEANING');
    assert.match(meaning.issue, /18\/05\/2026 έως 24\/05\/2026/);
    assert.match(meaning.issue, /δεν έχει όλα τα στοιχεία/);
    assert.match(meaning.issue, /πραγματική αλλαγή στους όρους εργασίας/);
    assert.match(meaning.issue, /μπήκε κατά λάθος/);
    assert.match(meaning.decisionRequired, /διαφορετικοί όροι/);
    assert.match(meaning.intents[0].label, /Ναι/);
    assert.match(meaning.intents[1].label, /Όχι/);
    assert.match(meaning.intents[1].description, /δεν θα θεωρεί αυτή την εγγραφή ξεχωριστή περίοδο/);
    for (const fixture of [h1MissingInitialProfileFixture, h2KpkBoundaryFixture, h3IntermediateOverlapFixture]) {
        const publicText = JSON.stringify(planner(fixture()).conflicts);
        assert.doesNotMatch(publicText, /επιχειρησιακή εκδοχή|πλήρης εκδοχή|τεχνικό ιστορικό|φυσική εγγραφή|λογική χρονογραμμή/);
    }
});

test('η γενική εξήγηση και η επιβεβαίωση λένε απλά τι πρέπει να ελέγξει ο χρήστης', () => {
    const { buildUserConfirmedCorrectionAnalysis, buildUserConfirmedCorrectionPublicResolution } =
        require('./employeeHistoryResolutionAnalysisService');
    const userCorrectionPlan = planner(h2KpkBoundaryFixture());
    const fingerprint = 'a'.repeat(64);
    const analysis = buildUserConfirmedCorrectionAnalysis({ userCorrectionPlan,
        sourceStateFingerprint: fingerprint });
    const publicResolution = buildUserConfirmedCorrectionPublicResolution({ analysis, fingerprint });
    assert.equal(publicResolution.title, 'Χρειάζεται διόρθωση του ιστορικού');
    assert.match(publicResolution.explanation, /δεν συμφωνούν μεταξύ τους ή δεν έχουν όλα τα στοιχεία/);
    assert.match(publicResolution.explanation, /δεν θα διαλέξει μόνη της/);
    assert.match(publicResolution.explanation, /δεν θα αλλάξει τίποτα πριν/);
    assert.match(publicResolution.responsibilityText, /έλεγξα τις παραπάνω επιλογές/);
    assert.match(publicResolution.responsibilityText, /ίσχυαν πραγματικά/);
});

test('τα συνθετικά H1/H2/H3 αναγνωρίζονται γενικά και παράγουν σταθερό φύλλο συγκρούσεων', () => {
    const cases = [
        [h1MissingInitialProfileFixture,
            SHAPE_KINDS.INITIAL_PROFILE_BOUNDARY_WITH_INCOMPLETE_EVIDENCE, 2],
        [h2KpkBoundaryFixture,
            SHAPE_KINDS.INITIAL_PROFILE_BOUNDARY_WITH_FIELD_CONFLICT, 3],
        [h3IntermediateOverlapFixture,
            SHAPE_KINDS.INTERMEDIATE_PERIOD_WITH_OVERLAPPING_CANDIDATES, 4]
    ];
    for (const [factory, shapeKind, conflictCount] of cases) {
        const first = planner(factory());
        const second = planner(factory());
        assert.equal(first.status, PLAN_STATUSES.APPLICABLE);
        assert.equal(first.resolutionClass, 'BUSINESS_FACT_REQUIRED');
        assert.equal(first.resolutionKind, 'USER_CONFIRMED_HISTORY_CORRECTION');
        assert.equal(first.shapeKind, shapeKind);
        assert.equal(first.conflicts.length, conflictCount);
        assert.equal(first.worksheetFingerprint, second.worksheetFingerprint);
        assert.deepEqual(first.conflicts, second.conflicts);
        assert.equal(first.fieldImpactRegistryVersion, REGISTRY_VERSION);
    }
});

test('ο σχεδιαστής παραγωγής δεν περιέχει κωδικούς εργαζομένων αποδοχής', () => {
    const source = fs.readFileSync(path.join(__dirname,
        'employeeHistoryUserConfirmedCorrectionPlannerService.js'), 'utf8');
    for (const code of ['THA/0004/0006', 'THA/0004/0010', 'THA/0004/0002']) {
        assert.equal(source.includes(code), false);
    }
});

test('H1: επιβεβαιωμένοι πλήρεις αρχικοί όροι παράγουν συνεχή, επαναλήψιμη CLEAN χρονογραμμή', () => {
    const result = resolve(h1MissingInitialProfileFixture(), initialDecisions());
    assertClean(result);
    assert.equal(result.insertedRows.length, 0);
    assert.equal(result.physicalDeleteIds.length, 0);
    assert.ok(result.desiredHistoryRows.some(row =>
        row.employment_history_canonical_status === REDUNDANT_REFERENCED));
});

test('H1: το φύλλο διαφορετικής τιμής ζητά ακριβώς τα τέσσερα άγνωστα πεδία', () => {
    const fields = profileFieldIds(planner(h1MissingInitialProfileFixture()));
    assert.deepEqual(fields, ['KPK', 'WORK_DAYS', 'WEEKLY_HOURS', 'DAILY_HOURS']);
    assert.equal(fields.length, 4);
    for (const known of ['SPECIALTY', 'CONTRACT_TYPE', 'CONTRACT_CATEGORY',
        'LEGAL_PAY', 'ACTUAL_PAY', 'CONTRACT_PAY']) assert.equal(fields.includes(known), false);
});

test('η καθαρή παραγωγή απαιτήσεων ελαχιστοποιεί ελλείψεις, συγκρούσεις και αποτυγχάνει σε μη υποστηριζόμενο απαιτούμενο πεδίο', () => {
    const onlyKpk = determineRequiredCorrectionFields({
        canonicalRequirements: ['krathsh_01'], sourceProfile: {}
    });
    assert.deepEqual(onlyKpk.requiredUserFieldIds, ['KPK']);

    const onlyHours = determineRequiredCorrectionFields({
        canonicalRequirements: ['hmeres_ergasias_ebdomadas',
            'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias'],
        sourceProfile: {}
    });
    assert.deepEqual(onlyHours.requiredUserFieldIds,
        ['WORK_DAYS', 'WEEKLY_HOURS', 'DAILY_HOURS']);

    const complete = determineRequiredCorrectionFields({
        canonicalRequirements: ['krathsh_01', 'hmeres_ergasias_ebdomadas'],
        sourceProfile: { krathsh_01: '0111', hmeres_ergasias_ebdomadas: 5 }
    });
    assert.deepEqual(complete.requiredUserFieldIds, []);

    const conflict = determineRequiredCorrectionFields({
        canonicalRequirements: ['krathsh_01'],
        sourceProfile: { krathsh_01: '0111' }, explicitConflicts: ['KPK']
    });
    assert.deepEqual(conflict.requiredUserFieldIds, ['KPK']);
    assert.equal(conflict.classifications.find(item => item.fieldId === 'KPK').state,
        FIELD_REQUIREMENT_STATES.CONFLICTING);

    const unsupported = determineRequiredCorrectionFields({
        logicalPeriod: { from: '2026-01-01', to: '2026-01-31' },
        canonicalRequirements: ['required_but_unsupported'], sourceProfile: {}
    });
    assert.equal(unsupported.status, PLAN_STATUSES.BLOCKED);
    assert.deepEqual(unsupported.requiredUserFieldIds, []);
    assert.deepEqual(unsupported.unsupportedRequiredFields, ['required_but_unsupported']);
    assert.equal(unsupported.classifications.at(-1).state,
        FIELD_REQUIREMENT_STATES.UNSUPPORTED);
});

test('H1: η συμπλήρωση μόνο των τεσσάρων απαιτούμενων πεδίων διατηρεί τα γνωστά στοιχεία και καταλήγει δύο φορές CLEAN', () => {
    const fixture = h1MissingInitialProfileFixture();
    const before = fixture.completeHistoryRows.find(row => row._id === 'h1-incomplete-initial');
    const result = resolve(fixture, h1DifferentValueDecisions());
    assertClean(result);
    const after = result.desiredHistoryRows.find(row => row._id === 'h1-incomplete-initial');
    for (const field of ['eidikothta_symbashs', 'symbash', 'kathgoria_symbashs',
        'nomimosMisthos', 'pragmatikosMisthos', 'synolo_symbashs',
        'hmeromhnia_allaghs_symbashs', 'hmeromhnia_allaghs_orarioy_apo',
        'hmeromhnia_allaghs_orarioy_eos']) assert.deepEqual(after[field], before[field], field);
    assert.deepEqual(result.normalizedDecisions.find(decision =>
        decision.conflictId === 'INITIAL_PROFILE_TERMS').values,
    { KPK: '0109', WORK_DAYS: 5, WEEKLY_HOURS: 40, DAILY_HOURS: 8 });
});

test('γνωστά specialty, σύμβαση και αποδοχές δεν γίνονται ποτέ επεξεργάσιμες όταν λείπουν μόνο KPK/ώρες', () => {
    const fixture = h1MissingInitialProfileFixture();
    const legacy = fixture.completeHistoryRows.find(row => row._id === 'h1-incomplete-initial');
    assert.equal(legacy.eidikothta_symbashs, '0003');
    assert.equal(legacy.symbash, '0002');
    assert.equal(legacy.kathgoria_symbashs, '0004');
    assert.equal(legacy.nomimosMisthos, 1146.30);
    assert.equal(legacy.pragmatikosMisthos, 1146.30);
    assert.equal(legacy.synolo_symbashs, 1146.30);
    assert.deepEqual(profileFieldIds(planner(fixture)),
        ['KPK', 'WORK_DAYS', 'WEEKLY_HOURS', 'DAILY_HOURS']);
});

test('όταν δεν μένει άγνωστο απαιτούμενο πεδίο δεν εμφανίζεται αυθαίρετη φόρμα μητρώου', () => {
    const fixture = h1MissingInitialProfileFixture();
    Object.assign(fixture.completeHistoryRows.find(row => row._id === 'h1-incomplete-initial'), {
        krathsh_01: '0109', hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8
    });
    const terms = planner(fixture).conflicts.find(conflict =>
        conflict.conflictId === 'INITIAL_PROFILE_TERMS');
    assert.equal(terms.intents.some(intent => intent.id === INTENTS.ENTER_DIFFERENT_VALUE), false);
});

test('αλλαγή της πηγής που καθιστά τη SPECIALTY άγνωστη αλλάζει πεδία και fingerprint', () => {
    const original = planner(h1MissingInitialProfileFixture());
    const changedFixture = h1MissingInitialProfileFixture();
    changedFixture.completeHistoryRows.find(row => row._id === 'h1-incomplete-initial')
        .eidikothta_symbashs = null;
    const changed = planner(changedFixture);
    assert.deepEqual(profileFieldIds(changed),
        ['KPK', 'SPECIALTY', 'WORK_DAYS', 'WEEKLY_HOURS', 'DAILY_HOURS']);
    assert.notEqual(changed.worksheetFingerprint, original.worksheetFingerprint);
});

test('H2: correcting historical KPK does not create a contract-change event', () => {
    const fixture = h2KpkBoundaryFixture();
    const result = resolve(fixture, initialDecisions({
        intent: INTENTS.CORRECT_EXISTING_HISTORICAL_FACT, value: '0115' }));
    assertClean(result);
    const before = fixture.completeHistoryRows.find(row => row._id === 'h2-incomplete-initial');
    const after = result.desiredHistoryRows.find(row => row._id === 'h2-incomplete-initial');
    assert.equal(after.krathsh_01, '0115');
    assert.equal(result.desiredHistoryRows.find(row => row._id === 'h2-later-profile').krathsh_01,
        '0115');
    assert.equal(after.hmeromhnia_allaghs_symbashs, before.hmeromhnia_allaghs_symbashs);
    assert.equal(after.hmeromhnia_proslhpshs.toISOString().slice(0, 10), '2026-04-24');
    assert.equal(after.hmeromhnia_allaghs_orarioy_apo,
        before.hmeromhnia_allaghs_orarioy_apo);
    assert.equal(after.hmeromhnia_allaghs_orarioy_eos,
        before.hmeromhnia_allaghs_orarioy_eos);
    assert.equal(result.insertedRows.length, 0);
});

test('H2: πραγματική αλλαγή ΚΠΚ διατηρεί και τις δύο τιμές με ελάχιστο όριο χωρίς συμβατική αλλαγή', () => {
    const fixture = h2KpkBoundaryFixture();
    const result = resolve(fixture, initialDecisions({
        intent: INTENTS.REAL_HISTORICAL_CHANGE, value: '0115',
        effectiveDate: '2026-05-13' }));
    assertClean(result);
    const earlier = result.desiredHistoryRows.find(row => row._id === 'h2-incomplete-initial');
    const later = result.desiredHistoryRows.find(row => row._id === 'h2-later-profile');
    assert.equal(earlier.krathsh_01, '0111');
    assert.equal(later.krathsh_01, '0115');
    assert.equal(earlier.hmeromhnia_isxyos_oron_ergasias_eos.toISOString().slice(0, 10),
        '2026-05-12');
    assert.equal(later.hmeromhnia_isxyos_oron_ergasias_apo.toISOString().slice(0, 10),
        '2026-05-13');
    assert.equal(earlier.hmeromhnia_allaghs_symbashs, '2026-04-24');
    assert.equal(later.hmeromhnia_allaghs_symbashs, '2026-04-24');
    assert.equal(result.insertedRows.length, 0);
});

test('η καθαρή διόρθωση ΚΠΚ απομονώνει απολύτως το πεδίο και όλες τις χρονικές ταυτότητες', () => {
    const source = h2KpkBoundaryFixture().completeHistoryRows
        .find(row => row._id === 'h2-later-profile');
    const before = structuredClone(source);
    before._id = 'isolated-kpk';
    before.krathsh_01 = '0111';
    const result = applyConfirmedFieldDecisionToTimeline({ rows: [before],
        targetHistoryId: before._id, fieldId: 'KPK',
        decision: { intent: INTENTS.CORRECT_EXISTING_HISTORICAL_FACT, value: '0115' },
        allowedValues: [{ value: '0111' }, { value: '0115' }] });
    assert.equal(result.rows.length, 1);
    const after = result.rows[0];
    assert.equal(after.krathsh_01, '0115');
    for (const [field, value] of Object.entries(before)) {
        if (field !== 'krathsh_01') assert.deepEqual(after[field], value, field);
    }
    for (const field of [...NEVER_IMPLICITLY_MUTATE,
        'hmeromhnia_isxyos_oron_ergasias_apo',
        'hmeromhnia_isxyos_oron_ergasias_eos']) {
        assert.deepEqual(after[field], before[field], field);
    }
});

test('η πραγματική αλλαγή πεδίου είναι διακριτή: διασπά μόνο το όριο ισχύος', () => {
    const row = h2KpkBoundaryFixture().completeHistoryRows
        .find(item => item._id === 'h2-later-profile');
    const source = { ...structuredClone(row), _id: 'real-change', krathsh_01: '0111',
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-04-24T00:00:00Z'),
        hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-06-30T00:00:00Z') };
    const result = applyConfirmedFieldDecisionToTimeline({ rows: [source],
        targetHistoryId: source._id, fieldId: 'KPK',
        decision: { intent: INTENTS.REAL_HISTORICAL_CHANGE,
            value: '0115', effectiveDate: '2026-05-13' },
        allowedValues: [{ value: '0111' }, { value: '0115' }] });
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].krathsh_01, '0111');
    assert.equal(result.rows[1].krathsh_01, '0115');
    assert.equal(result.rows[0].hmeromhnia_isxyos_oron_ergasias_eos.toISOString().slice(0, 10),
        '2026-05-12');
    assert.equal(result.rows[1].hmeromhnia_isxyos_oron_ergasias_apo.toISOString().slice(0, 10),
        '2026-05-13');
    for (const field of NEVER_IMPLICITLY_MUTATE) {
        assert.deepEqual(result.rows[0][field], source[field], field);
        assert.deepEqual(result.rows[1][field], source[field], field);
    }
    for (const field of ['eidikothta_symbashs', 'synolo_symbashs',
        'ores_ergasias_ebdomadas', 'hmeres_ergasias_ebdomadas']) {
        assert.deepEqual(result.rows[0][field], source[field], field);
        assert.deepEqual(result.rows[1][field], source[field], field);
    }
});

test('η απομόνωση ισχύει επίσης για ειδικότητα και εβδομαδιαίες ώρες', () => {
    const base = { _id: 'isolation', krathsh_01: '0115', eidikothta_symbashs: '0003',
        ores_ergasias_ebdomadas: 40, synolo_symbashs: 1146.3,
        hmeromhnia_allaghs_symbashs: '2026-04-24' };
    const specialty = applyConfirmedFieldDecisionToTimeline({ rows: [base],
        targetHistoryId: base._id, fieldId: 'SPECIALTY',
        decision: { intent: INTENTS.CORRECT_EXISTING_HISTORICAL_FACT, value: '0004' },
        allowedValues: [{ value: '0003' }, { value: '0004' }] }).rows[0];
    assert.equal(specialty.eidikothta_symbashs, '0004');
    assert.equal(specialty.krathsh_01, base.krathsh_01);
    assert.equal(specialty.synolo_symbashs, base.synolo_symbashs);
    assert.equal(specialty.ores_ergasias_ebdomadas, base.ores_ergasias_ebdomadas);

    const hours = applyConfirmedFieldDecisionToTimeline({ rows: [base],
        targetHistoryId: base._id, fieldId: 'WEEKLY_HOURS',
        decision: { intent: INTENTS.CORRECT_EXISTING_HISTORICAL_FACT, value: 35 },
        allowedValues: [] }).rows[0];
    assert.equal(hours.ores_ergasias_ebdomadas, 35);
    assert.equal(hours.eidikothta_symbashs, base.eidikothta_symbashs);
    assert.equal(hours.krathsh_01, base.krathsh_01);
    assert.equal(hours.synolo_symbashs, base.synolo_symbashs);
});

test('άγνωστος ΚΠΚ και ασυνεπείς ημέρες/ώρες απορρίπτονται από τον διακομιστή', () => {
    assert.throws(() => normalizeConfirmedFieldValue('KPK', '9999', {
        allowedValues: [{ value: '0111' }, { value: '0115' }] }),
    error => error.code === 'EMPLOYEE_HISTORY_USER_CORRECTION_INVALID_VALUE');
    assert.throws(() => validateWorkTermRelationships({
        hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 7
    }), error => error.code === 'EMPLOYEE_HISTORY_USER_CORRECTION_INVALID_VALUE');
    assert.equal(registryEntry('KPK').fields[0], 'krathsh_01');
});

test('H3: και οι δύο ρητές επιχειρησιακές ερμηνείες καταλήγουν CLEAN χωρίς φυσική διαγραφή', () => {
    for (const decisions of [
        [
            { conflictId: 'INITIAL_PROFILE_START', intent: INTENTS.FROM_HIRE },
            { conflictId: 'INTERMEDIATE_PERIOD_MEANING',
                intent: INTENTS.RETIRE_ERRONEOUS_ARTIFACT },
            { conflictId: 'LATER_PROFILE_START', intent: INTENTS.FROM_KNOWN_HISTORY_DATE }
        ],
        [
            { conflictId: 'INITIAL_PROFILE_START', intent: INTENTS.FROM_HIRE },
            { conflictId: 'INTERMEDIATE_PERIOD_MEANING', intent: INTENTS.CONFIRM_REAL_PERIOD },
            { conflictId: 'INTERMEDIATE_PROFILE_TERMS', intent: INTENTS.CONFIRM_EXISTING,
                value: 'PROFILE_CANDIDATE_1' },
            { conflictId: 'LATER_PROFILE_START', intent: INTENTS.FROM_KNOWN_HISTORY_DATE }
        ]
    ]) {
        const result = resolve(h3IntermediateOverlapFixture(), decisions);
        assertClean(result);
        assert.equal(result.physicalDeleteIds.length, 0);
    }
});

test('ελλιπές φύλλο, πρόσθετα πεδία, διπλές αποφάσεις και μη αποδοχή ευθύνης απορρίπτονται', () => {
    const fixture = h2KpkBoundaryFixture();
    const plan = planner(fixture);
    const attempts = [
        { responsibilityAccepted: false, decisions: initialDecisions({
            intent: INTENTS.CORRECT_EXISTING_HISTORICAL_FACT, value: '0115' }) },
        { responsibilityAccepted: true, decisions: initialDecisions() },
        { responsibilityAccepted: true, decisions: [
            ...initialDecisions({ intent: INTENTS.CORRECT_EXISTING_HISTORICAL_FACT,
                value: '0115' }),
            { conflictId: 'FIELD_KPK', intent: INTENTS.CONFIRM_EXISTING }
        ] },
        { responsibilityAccepted: true, decisions: initialDecisions({
            intent: INTENTS.CORRECT_EXISTING_HISTORICAL_FACT, value: '0115', patch: {} }) }
    ];
    for (const confirmation of attempts) {
        assert.throws(() => resolveEmployeeHistoryUserConfirmedCorrection({
            plannerResult: plan, confirmation, currentEmployee: fixture.currentEmployee,
            completeHistoryRows: fixture.completeHistoryRows }), error =>
            String(error.code || '').startsWith('EMPLOYEE_HISTORY_USER_CORRECTION'));
    }
});

test('ο browser δεν μπορεί να ζητήσει υποστηριζόμενο αλλά μη εμφανισμένο πεδίο', () => {
    const fixture = h2KpkBoundaryFixture();
    const plan = planner(fixture);
    assert.throws(() => resolveEmployeeHistoryUserConfirmedCorrection({
        plannerResult: plan,
        confirmation: { responsibilityAccepted: true, decisions: [
            { conflictId: 'INITIAL_PROFILE_START', intent: INTENTS.FROM_HIRE },
            { conflictId: 'INITIAL_PROFILE_TERMS', intent: INTENTS.ENTER_DIFFERENT_VALUE,
                value: 'PROFILE_CANDIDATE_1', values: { KPK: '0115' } },
            { conflictId: 'FIELD_KPK', intent: INTENTS.CORRECT_EXISTING_HISTORICAL_FACT,
                value: '0115' }
        ] },
        currentEmployee: fixture.currentEmployee,
        completeHistoryRows: fixture.completeHistoryRows
    }), error => error.code === 'EMPLOYEE_HISTORY_USER_CORRECTION_INVALID_REQUEST' &&
        error.reason === 'UNSUPPORTED_PROFILE_FIELD');
});

test('H1: η επανάληψη απορρίπτει γνωστό αλλά μη διαφημισμένο SPECIALTY και κάθε ελλιπές σύνολο', () => {
    const fixture = h1MissingInitialProfileFixture();
    const plan = planner(fixture);
    for (const values of [
        { KPK: '0109', WORK_DAYS: 5, WEEKLY_HOURS: 40, DAILY_HOURS: 8,
            SPECIALTY: '0003' },
        { KPK: '0109', WORK_DAYS: 5, WEEKLY_HOURS: 40 }
    ]) {
        assert.throws(() => resolveEmployeeHistoryUserConfirmedCorrection({
            plannerResult: plan,
            confirmation: { responsibilityAccepted: true,
                decisions: h1DifferentValueDecisions(values) },
            currentEmployee: fixture.currentEmployee,
            completeHistoryRows: fixture.completeHistoryRows
        }), error => error.code === 'EMPLOYEE_HISTORY_USER_CORRECTION_INVALID_REQUEST');
    }
});

test('LIVE και UNKNOWN συσχετίσεις αποτυγχάνουν κλειστά και η φυσική διαγραφή μένει απαγορευμένη', () => {
    const unknown = h1MissingInitialProfileFixture();
    delete unknown.protectedReferenceSummary['h1-incomplete-initial'];
    assert.equal(planner(unknown).status, PLAN_STATUSES.BLOCKED);

    const live = h1MissingInitialProfileFixture();
    const result = planEmployeeHistoryUserConfirmedCorrection({ ...live,
        canonicalResult: canonicalizeEmployeeHistory({ scope: live.scope,
            currentEmployee: live.currentEmployee, historyRows: live.completeHistoryRows }),
        problemScope: identifyEmployeeHistoryProblemScope({ scope: live.scope,
            currentEmployee: live.currentEmployee,
            completeHistoryRows: live.completeHistoryRows }),
        referencePartitioner: references => ({ frozenProvenance: [], liveDereference: references }) });
    assert.equal(result.status, PLAN_STATUSES.BLOCKED);
    assert.match(result.reason, /LIVE_REFERENCE/);
});

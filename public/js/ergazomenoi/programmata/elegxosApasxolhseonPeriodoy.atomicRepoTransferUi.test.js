const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ejs = require('ejs');
const { execFileSync } = require('child_process');
const {
    POLICY_RESULT_STATUS,
    POLICY_MODE,
    getApasxoliseisPolicyCatalog
} = require('../../../../server/services/ergazomenoi/apasxoliseisPolicyCatalogService');
const {
    SCENARIO_CODES,
    REASON_CODES
} = require('../../../../server/services/ergazomenoi/apasxoliseisScenarioMatcherService');

const sourcePath = path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const viewPath = path.join(__dirname, '..', '..', '..', '..', 'views', 'ergazomenoi', 'programmata', 'elegxosApasxolhseonPeriodoy.ejs');
const viewSource = fs.readFileSync(viewPath, 'utf8');
const cssPath = path.join(__dirname, '..', '..', '..', 'css', 'main.css');
const cssSource = fs.readFileSync(cssPath, 'utf8');
const dropdownHelperPath = path.join(__dirname, '..', '..', '..', 'js', 'dropdown-item.js');
const dropdownHelperSource = fs.readFileSync(dropdownHelperPath, 'utf8');
const branchDropdownSource = fs.readFileSync(
    path.join(__dirname, 'initYpokatasthmataDropdowns.js'),
    'utf8'
);
const elementsById = new Map();
let fetchCalls = 0;
const documentStub = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: (id) => elementsById.get(id) || null,
    addEventListener: () => {},
    createElement: () => ({
        addEventListener: () => {},
        appendChild: () => {},
        classList: { add: () => {}, toggle: () => {} },
        dataset: {},
        setAttribute: () => {},
        style: {}
    }),
    head: { appendChild: () => {} },
    body: { appendChild: () => {} }
};
const sandbox = {
    console,
    document: documentStub,
    window: {},
    URLSearchParams,
    fetch: async () => {
        fetchCalls++;
        throw new Error('Unexpected fetch');
    },
    setTimeout: () => {},
    clearTimeout: () => {}
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: sourcePath });
vm.runInContext(`currentEmploymentPeriodControl = {
    effective_mode: 'NORMAL', calculation: { authoritative_result: true },
    allowed_actions: { record_decision: true, repo_transfer: true }
}`, sandbox);

function setRepoTransferPermissions({ decision, apply, manageReusable } = {}) {
    vm.runInContext(`currentEmploymentPeriodControl = {
        effective_mode: 'NORMAL', calculation: { authoritative_result: true },
        allowed_actions: { record_decision: true, repo_transfer: true }
    }`, sandbox);
    if (decision === undefined) elementsById.delete('canRecordRepoTransferDecision');
    else elementsById.set('canRecordRepoTransferDecision', { value: decision ? '1' : '0' });
    if (apply === undefined) elementsById.delete('canApplyRepoTransferDecision');
    else elementsById.set('canApplyRepoTransferDecision', { value: apply ? '1' : '0' });
    if (manageReusable === undefined) elementsById.delete('canManageReusablePolicyApproval');
    else elementsById.set('canManageReusablePolicyApproval', {
        value: manageReusable ? '1' : '0'
    });
}

setRepoTransferPermissions({ decision: true, apply: true, manageReusable: true });
elementsById.set('hrReviewWorkspace', {
    classList: { contains: (name) => name === 'd-none' ? false : false }
});
elementsById.set('advancedReviewWorkspace', {
    classList: { contains: (name) => name === 'd-none' ? true : false }
});
elementsById.set('hr_apo_hmeromhnia', { value: '2026-07-01' });
elementsById.set('hr_eos_hmeromhnia', { value: '2026-07-31' });

function proposedValues({ category, repo, hours, intervals = [] }) {
    const values = {
        kathgoria_ergasias_apologistika: category,
        repo_apologistika: repo,
        ores_ergasias_apologistika: hours
    };

    [1, 2, 3].forEach((number) => {
        const pair = String(number).padStart(2, '0');
        values[`apo_ora_${pair}_apologistika`] = intervals[number - 1]?.[0] || '';
        values[`eos_ora_${pair}_apologistika`] = intervals[number - 1]?.[1] || '';
    });
    return values;
}

function readyProjection({ targetCategory = 'ΑΝ', sourceIntervals } = {}) {
    return {
        version: 1,
        scope: 'filtered_period_complete_weeks',
        projection_status: 'READY',
        summary: {
            weeks_evaluated: 1,
            groups_count: 1,
            decision_units_count: 1,
            items_count: 2,
            employees_count: 1,
            ready_count: 1,
            not_available_count: 0,
            invalid_projection_count: 0
        },
        reason_counts: {},
        warning_counts: {},
        groups: [
            {
                group_id: 'atomic-group-1',
                group_key: 'atomic-group-key-1',
                group_type: 'ATOMIC_PAIRED_PROPOSAL',
                decision_grain: 'ATOMIC_LINKED_SET',
                status: 'NEEDS_REVIEW',
                title: 'Μεταφορά ρεπό εντός εβδομάδας',
                description: 'Ασφαλής πρόταση για ανθρώπινο έλεγχο.',
                first_date: '2026-07-06',
                last_date: '2026-07-09',
                count: 2,
                decision_units_count: 1,
                pair_contract: {
                    proposal_version: 'repo-transfer-single-pair-proposal:v4',
                    choice_code: 'TRANSFER_REPO_WITHIN_WEEK_SINGLE_PAIR'
                },
                warnings: [],
                repo_resolution: {
                    effective_expected_weekly_repo: 2,
                    current_actual_repo: 0,
                    resolved_repo: 1,
                    actual_workdays: 6,
                    sixth_day_count: 1,
                    seventh_day_count: 0
                },
                items: [
                    {
                        role: 'SOURCE_BECOMES_WORK',
                        prodhlomena_oraria_id: '507f1f77bcf86cd799439021',
                        employee_kodikos: '001',
                        hmeromhnia: '2026-07-06',
                        kathgoria_ergasias: 'ΑΝ',
                        proposed_values: proposedValues({
                            category: 'ΕΡΓ',
                            repo: false,
                            hours: 7.5,
                            intervals:
                                sourceIntervals || [
                                    ['08:00', '12:00'],
                                    ['12:30', '16:00'],
                                    ['', '']
                                ]
                        })
                    },
                    {
                        role: 'TARGET_BECOMES_REPO',
                        prodhlomena_oraria_id: '507f1f77bcf86cd799439022',
                        employee_kodikos: '001',
                        hmeromhnia: '2026-07-09',
                        kathgoria_ergasias: 'ΕΡΓ',
                        proposed_values: proposedValues({
                            category: targetCategory,
                            repo: true,
                            hours: 0,
                            intervals: [
                                ['', ''],
                                ['', ''],
                                ['', '']
                            ]
                        })
                    }
                ]
            }
        ]
    };
}

function render(projection) {
    return sandbox.renderAtomicRepoTransferProjection(projection);
}

function assertContains(html, values) {
    values.forEach((value) => assert.ok(html.includes(value), `Missing: ${value}`));
}

function testWeeklyResolutionShowsRepoAndSixthDayFacts() {
    const html = render(readyProjection());
    assertContains(html, [
        'Αναμενόμενα ρεπό',
        'Τρέχοντα πραγματικά ρεπό',
        'Προτεινόμενα/επιλυμένα ρεπό',
        'Πραγματικές ημέρες εργασίας',
        '6η ημέρα εργασίας',
        '7η ημέρα/παράβαση'
    ]);
    assert.ok(html.includes('<strong>2</strong>'));
    assert.ok(html.includes('<strong>6</strong>'));
}

function testSixthDayCardsBadgeShowsApplicableRate() {
    assertContains(
        sandbox.renderSixthDayCardsBadge({
            is_sixth_day: true,
            sixth_day_premium_rate: 10
        }),
        ['6η ημέρα · 10%']
    );
    assertContains(
        sandbox.renderSixthDayCardsBadge({
            is_sixth_day: true,
            sixth_day_premium_rate: 0
        }),
        ['6η ημέρα · 0%']
    );
    assert.strictEqual(sandbox.renderSixthDayCardsBadge({}), '');
}

function testSixthDayCardsBadgeUsesWeeklyLifecycleRateIncludingZero() {
    const setLifecycle = (premiumRate) => vm.runInContext(`
        weeklyHrStage1Payloads.clear();
        weeklyHrStage1Payloads.set('0025:2026-06-08', {
            scope: { employee_kodikos: '0025', ypokatasthma: '0000' },
            lifecycle_projection: { stages: { stage4: { final_weekly_analysis: {
                sixthDay: { hmeromhnia: '2026-06-14', premiumRate: ${premiumRate} }
            } } } }
        });
    `, sandbox);
    setLifecycle(0);
    assertContains(sandbox.renderSixthDayCardsBadge({
        kodikos: '0025', ypokatasthma: '0000', hmeromhnia: '2026-06-14'
    }), ['6η ημέρα', '0%']);
    setLifecycle(40);
    assertContains(sandbox.renderSixthDayCardsBadge({
        kodikos: '0025', ypokatasthma: '0000', hmeromhnia: '2026-06-14'
    }), ['6η ημέρα', '40%']);
    vm.runInContext('weeklyHrStage1Payloads.clear();', sandbox);
}

function testCompletedSingleDayNoActionHidesPossibleLeaveOnlyFromPresentation() {
    vm.runInContext(`
        weeklyHrStage1Payloads.clear();
        weeklyHrStage1Payloads.set('0022:2026-06-01', {
            scope: { employee_kodikos: '0022', ypokatasthma: '0000' },
            lifecycle_projection: {
                requires_hr_action: false,
                total_pending_count: 0,
                employment_date_scope: { employment_owned_dates: ['2026-06-01'] },
                stages: {
                    stage1: { business_status: 'COMPLETED' },
                    stage2: { business_status: 'COMPLETED' },
                    stage3: { business_status: 'COMPLETED' },
                    stage4: { business_status: 'COMPLETED' }
                }
            }
        });
    `, sandbox);
    const row0022 = { kodikos: '0022', ypokatasthma: '0000',
        hmeromhnia: '2026-06-01', cards_ores_ergasias: 0,
        ores_pragmatikhs_ergasias_apologistika: 0,
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' };
    const completed = sandbox.resolveReviewApologistikoPresentation(row0022,
        { apologistikoText: '' });
    assert.ok(!completed.text.includes('ΠΙΘΑΝΗ ΑΔΕΙΑ'));
    vm.runInContext(`weeklyHrStage1Payloads.get('0022:2026-06-01')
        .lifecycle_projection.requires_hr_action = true;`, sandbox);
    const actionable = sandbox.resolveReviewApologistikoPresentation(row0022,
        { apologistikoText: '' });
    assert.strictEqual(actionable.text, 'ΠΙΘΑΝΗ ΑΔΕΙΑ');
    vm.runInContext('weeklyHrStage1Payloads.clear();', sandbox);
}

function getVisibleText(html) {
    return String(html || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function testPersistedRepoCategoryOverridesDerivedLeave() {
    const applied = sandbox.resolveReviewApologistikoPresentation({
        kathgoria_ergasias: 'ΕΡΓ',
        cards_ores_ergasias: 0,
        noCardsDisplayStatus: 'ΑΔΕΙΑ',
        kathgoria_ergasias_apologistika: 'ΑΝ',
        repo_apologistika: true,
        adeia_apologistika: false
    }, { apologistikoText: '' });
    assert.strictEqual(applied.text, 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ');
    assert.strictEqual(applied.className, 'cell-repo-day');
    assert.strictEqual(applied.source, 'persisted');

    const derived = sandbox.resolveReviewApologistikoPresentation({
        kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: 8,
        cards_ores_ergasias: 0,
        noCardsDisplayStatus: 'ΑΔΕΙΑ',
        kathgoria_ergasias_apologistika: '',
        repo_apologistika: false,
        adeia: false,
        kathgoria_adeias: '',
        ores_apoysias: 0,
        adeia_apologistika: false,
        kathgoria_adeias_apologistika: ''
    }, { apologistikoText: '' });
    assert.strictEqual(derived.text, 'ΠΙΘΑΝΗ ΑΔΕΙΑ');
    assert.strictEqual(derived.className, 'cell-adeia-suggestion');
    assert.strictEqual(derived.source, 'derived');
}

function testStage1DailyClassificationPresentationPriority() {
    const possible = { kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
        cards_ores_ergasias: 0, noCardsDisplayStatus: 'ΑΔΕΙΑ',
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' };
    const storedLeave = sandbox.resolveReviewApologistikoPresentation({ ...possible,
        is_locked: true, adeia_apologistika: true,
        kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' }, {});
    assert.strictEqual(storedLeave.text, 'ΑΔΕΙΑ');
    assert.strictEqual(storedLeave.source, 'persisted_stage1');
    assert.strictEqual(sandbox.resolveReviewApologistikoPresentation({ ...possible,
        astheneia_apologistika: true, adeia_apologistika: false,
        kathgoria_adeias_apologistika: 'ΑΔΑΣ' }, {}).text, 'ΑΣΘΕΝΕΙΑ');
    const storedAbsence = sandbox.resolveReviewApologistikoPresentation({ ...possible,
        apousia_apologistika: true, kathgoria_adeias_apologistika: '' }, {});
    assert.strictEqual(storedAbsence.text, 'ΑΠΟΥΣΙΑ');
    assert.ok(storedAbsence.className.includes('cell-stage1-absence'));
    assert.ok(!storedLeave.className.includes('cell-stage1-absence'));
    assert.match(source, /\.cell-stage1-absence\s*\{[^}]*color:\s*#dc3545\s*!important/s);
    assert.strictEqual(sandbox.resolveReviewApologistikoPresentation(possible, {}).text,
        'ΠΙΘΑΝΗ ΑΔΕΙΑ');
    assert.notStrictEqual(sandbox.resolveReviewApologistikoPresentation(possible, {}).text,
        'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ');
    assert.notStrictEqual(sandbox.resolveReviewApologistikoPresentation({ ...possible,
        effective_is_full_time: false }, {}).text, 'ΜΗ ΕΡΓΑΣΙΑ');
}

function testPossibleLeaveResolverAndModalPresentationContract() {
    const derivedRow = {
        kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: 8,
        cards_ores_ergasias: 0,
        noCardsDisplayStatus: 'ΑΔΕΙΑ',
        adeia: false,
        kathgoria_adeias: '',
        ores_apoysias: 0,
        adeia_apologistika: false,
        kathgoria_adeias_apologistika: ''
    };
    assert.strictEqual(
        sandbox.resolvePossibleLeavePresentationState(derivedRow),
        'DERIVED_POSSIBLE_LEAVE'
    );
    const derivedHtml = sandbox.renderApologistikaFields(derivedRow);
    assert.ok(getVisibleText(derivedHtml).includes('ΠΙΘΑΝΗ ΑΔΕΙΑ'));
    assert.ok(derivedHtml.includes('data-derived-possible-leave="true"'));
    assert.ok(derivedHtml.includes('data-presentation-value="POSSIBLE_LEAVE"'));
    assert.ok(derivedHtml.includes('id="edit_kathgoria_adeias_apologistika_hidden"\n                        value=""'));
    assert.ok(!/id="edit_adeia_apologistika"[^>]*checked/s.test(derivedHtml));

    [
        [{ cards_apo_ora_01: '14:51', cards_eos_ora_01: '' }, 'ΟΡΦΑΝΟ ΧΤΥΠΗΜΑ'],
        [{ cards_apo_ora_01: '', cards_eos_ora_01: '22:51' }, 'ΟΡΦΑΝΟ ΧΤΥΠΗΜΑ'],
        [{ cards_apo_ora_01: 'invalid', cards_eos_ora_01: '' }, 'ΜΗ ΕΓΚΥΡΟ ΣΤΟΙΧΕΙΟ ΚΑΡΤΑΣ'],
        [{ cards_apo_ora_01: '14:51', cards_eos_ora_01: '14:51' }, 'ΜΗ ΕΓΚΥΡΟ ΣΤΟΙΧΕΙΟ ΚΑΡΤΑΣ']
    ].forEach(([cardEvidence, expectedStatus]) => {
        const unsafeRow = { ...derivedRow, ...cardEvidence };
        assert.strictEqual(
            sandbox.resolvePossibleLeavePresentationState(unsafeRow),
            'NONE'
        );
        assert.strictEqual(
            sandbox.resolveReviewApologistikoPresentation(unsafeRow, {}).text,
            expectedStatus
        );
        const unsafeHtml = sandbox.renderApologistikaFields(unsafeRow);
        assert.ok(getVisibleText(unsafeHtml).includes(expectedStatus));
        assert.ok(!getVisibleText(unsafeHtml).includes('ΠΙΘΑΝΗ ΑΔΕΙΑ'));
        assert.ok(!unsafeHtml.includes('value="POSSIBLE_LEAVE"'));
        assert.ok(!/id="edit_adeia_apologistika"[^>]*checked/s.test(unsafeHtml));
    });

    const persistedRow = {
        ...derivedRow,
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE'
    };
    assert.strictEqual(
        sandbox.resolvePossibleLeavePresentationState(persistedRow),
        'PERSISTED_POSSIBLE_LEAVE'
    );
    const persistedHtml = sandbox.renderApologistikaFields(persistedRow);
    assert.ok(getVisibleText(persistedHtml).includes('ΠΙΘΑΝΗ ΑΔΕΙΑ'));
    assert.ok(persistedHtml.includes('value="POSSIBLE_LEAVE"'));
    assert.ok(!persistedHtml.includes('<option value="POSSIBLE_LEAVE"'));
    assert.ok(!/id="edit_adeia_apologistika"[^>]*checked/s.test(persistedHtml));

    const confirmedRow = {
        ...derivedRow,
        adeia: true,
        adeia_apologistika: true,
        kathgoria_adeias: 'ΚΑΝΟΝΙΚΗ',
        kathgoria_adeias_apologistika: 'ΚΑΝΟΝΙΚΗ',
        leave_provenance: 'HR_DECLARED_LEAVE'
    };
    assert.strictEqual(
        sandbox.resolvePossibleLeavePresentationState(confirmedRow),
        'CONFIRMED_LEAVE'
    );
    assert.strictEqual(
        sandbox.resolveReviewApologistikoPresentation(confirmedRow, {}).text,
        'ΑΔΕΙΑ'
    );
}

function testPossibleLeaveValidationAndTomSelectCheckboxContract() {
    const errors = sandbox.validateReviewSave({
        adeia_apologistika: true,
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE',
        repo_apologistika: false
    });
    assert.ok(errors.some((error) => error.includes(
        'Η ΠΙΘΑΝΗ ΑΔΕΙΑ δεν αποτελεί επιβεβαιωμένη άδεια'
    )));

    const listeners = {};
    const select = { dataset: { api: '/test' }, tomselect: null };
    const hidden = {
        value: '',
        dataset: {
            derivedPossibleLeave: 'true',
            presentationValue: 'POSSIBLE_LEAVE'
        }
    };
    const checkbox = {
        checked: true,
        addEventListener: (name, handler) => { listeners[name] = handler; }
    };
    elementsById.set('edit_kathgoria_adeias_apologistika', select);
    elementsById.set('edit_kathgoria_adeias_apologistika_hidden', hidden);
    elementsById.set('edit_adeia_apologistika', checkbox);

    let config;
    const instance = {
        options: [],
        value: '',
        addOption(option) { this.options.push(option); },
        setValue(value) { this.value = value; },
        clear() { this.value = ''; }
    };
    sandbox.TomSelect = function (_select, options) {
        config = options;
        options.onInitialize.call(instance);
        return instance;
    };

    sandbox.initModalKathgoriaAdeiasTomSelect();
    assert.strictEqual(instance.value, '');
    assert.strictEqual(instance.options.length, 0);
    assert.strictEqual(checkbox.checked, false);
    assert.strictEqual(hidden.value, '');

    config.onChange.call(instance, 'POSSIBLE_LEAVE');
    assert.strictEqual(checkbox.checked, false);
    assert.strictEqual(hidden.value, '');
    config.onChange.call(instance, 'ΚΑΝΟΝΙΚΗ');
    assert.strictEqual(checkbox.checked, true);
    assert.strictEqual(hidden.value, 'ΚΑΝΟΝΙΚΗ');

    hidden.value = 'POSSIBLE_LEAVE';
    hidden.dataset.presentationValue = 'POSSIBLE_LEAVE';
    checkbox.checked = true;
    listeners.change();
    assert.strictEqual(hidden.value, '');
    assert.strictEqual(instance.value, '');

    assert.strictEqual(sandbox.isHrSelectableLeaveCategoryOption({
        value: 'POSSIBLE_LEAVE', label: 'ΠΙΘΑΝΗ ΑΔΕΙΑ'
    }), false);
    assert.strictEqual(sandbox.isHrSelectableLeaveCategoryOption({
        value: 'ΑΔΚΑΝ', label: 'ΑΔΚΑΝ - Κανονική άδεια'
    }), true);
    assert.ok(!sandbox.stage1LeaveCategoryOptions('POSSIBLE_LEAVE')
        .includes('POSSIBLE_LEAVE'));

    delete sandbox.TomSelect;
    ['edit_kathgoria_adeias_apologistika',
        'edit_kathgoria_adeias_apologistika_hidden',
        'edit_adeia_apologistika'].forEach((id) => elementsById.delete(id));
}

function testAutoCalculatedAndHrDeclaredLeaveHaveDistinctPresentation() {
    const autoCalculated = sandbox.resolveReviewApologistikoPresentation({
        kathgoria_ergasias_original: 'ΕΡΓ',
        kathgoria_ergasias_apologistika: 'ΑΔΕΙΑ',
        ores_ergasias: 8,
        cards_ores_ergasias: 0,
        adeia: false,
        adeia_apologistika: true,
        kathgoria_adeias_apologistika: 'ΑΔΑΛ',
        leave_provenance: 'AUTO_CALCULATED_LEAVE'
    }, { apologistikoText: '' });
    assert.strictEqual(autoCalculated.text, 'ΠΙΘΑΝΗ ΑΔΕΙΑ');
    assert.strictEqual(autoCalculated.className, 'cell-adeia-suggestion');
    assert.strictEqual(autoCalculated.source, 'derived');

    const hrDeclared = sandbox.resolveReviewApologistikoPresentation({
        kathgoria_ergasias_original: 'ΕΡΓ',
        kathgoria_ergasias_apologistika: 'ΑΔΕΙΑ',
        ores_ergasias: 8,
        cards_ores_ergasias: 0,
        adeia: true,
        adeia_apologistika: true,
        kathgoria_adeias: 'ΚΑΝΟΝΙΚΗ',
        kathgoria_adeias_apologistika: 'ΑΔΑΛ',
        leave_provenance: 'HR_DECLARED_LEAVE'
    }, { apologistikoText: '' });
    assert.strictEqual(hrDeclared.text, 'ΑΔΕΙΑ');
    assert.notStrictEqual(hrDeclared.className, 'cell-adeia-suggestion');
}

function testContractualEmploymentTypeWinsOverOperationalPhaseForRestDisplay() {
    assert.strictEqual(
        sandbox.resolveReviewIsFullTimePresentation({
            effective_is_full_time: true,
            review_phase_code: '2'
        }),
        true
    );
    assert.strictEqual(
        sandbox.resolveReviewIsFullTimePresentation({
            effective_is_full_time: false,
            review_phase_code: '0'
        }),
        false
    );
    assert.strictEqual(
        sandbox.resolveReviewIsFullTimePresentation({
            effective_kathestos_apasxolhshs: '',
            effective_typos_apasxolhshs: '0',
            review_phase_code: '2'
        }),
        true
    );
}

function testPersistedAnWithCardsIsNotBlanketRepoPresentation() {
    const presentation = sandbox.resolveReviewApologistikoPresentation({
        kathgoria_ergasias: 'ΑΝ',
        kathgoria_ergasias_apologistika: 'ΑΝ',
        repo_apologistika: false,
        cards_ores_ergasias: 7.6,
        apo_ora_01_apologistika: '08:30',
        eos_ora_01_apologistika: '16:06'
    }, {
        apologistikoText: '08:30–16:06',
        isApologistikoRepoRow: false,
        isApologistikoNonWorkRow: false
    });

    assert.strictEqual(presentation.text, '08:30–16:06');
    assert.strictEqual(presentation.className, 'cell-apologistiko');
    assert.notStrictEqual(presentation.text, 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ');
}

function testFullTimeDeclaredWorkWithCardsNeverDisplaysPersistedNonWork() {
    const baseRow = {
        kathgoria_ergasias_original: 'ΕΡΓ',
        kathgoria_ergasias_apologistika: 'ΜΕ',
        ores_ergasias: 8,
        cards_ores_ergasias: 2.88,
        cards_apo_ora_01: '09:04',
        cards_eos_ora_01: '12:27',
        effective_is_full_time: true
    };

    const neutral = sandbox.resolveReviewApologistikoPresentation(baseRow, {
        apologistikoText: '',
        isApologistikoRepoRow: false,
        isApologistikoNonWorkRow: false
    });
    assert.strictEqual(neutral.text, '');
    assert.notStrictEqual(neutral.text, 'ΜΗ ΕΡΓΑΣΙΑ');

    const nonFullPhase = sandbox.resolveReviewApologistikoPresentation({
        ...baseRow,
        effective_is_full_time: false
    }, {
        apologistikoText: '',
        isApologistikoRepoRow: false,
        isApologistikoNonWorkRow: false
    });
    assert.strictEqual(nonFullPhase.text, '');
    assert.notStrictEqual(nonFullPhase.text, 'ΜΗ ΕΡΓΑΣΙΑ');

    const intervals = sandbox.resolveReviewApologistikoPresentation({
        ...baseRow,
        apo_ora_01_apologistika: '09:04',
        eos_ora_01_apologistika: '12:27'
    }, {
        apologistikoText: '09:04–12:27',
        isApologistikoRepoRow: false,
        isApologistikoNonWorkRow: false
    });
    assert.strictEqual(intervals.text, '09:04–12:27');
    assert.strictEqual(intervals.className, 'cell-apologistiko');
}

function testAppliedTargetRowOverridesGenericPendingBadgeOnlyForExactRow() {
    vm.runInContext(`
        currentAtomicRepoTransferProjection = { groups: [] };
        currentRepoTransferDecisionsByProposalId = new Map([[
            'applied-proposal',
            {
                current_execution: { execution_status: 'APPLIED' },
                applied_history: {
                    source: { prodhlomena_oraria_id: 'source-row' },
                    target: { prodhlomena_oraria_id: 'target-row' }
                }
            }
        ]]);
    `, sandbox);

    const states = sandbox.buildRepoTransferReviewRowStates();
    assert.strictEqual(states.size, 2);
    assert.strictEqual(states.get('target-row').applied, true);
    assert.strictEqual(states.get('target-row').role, 'target');
    assert.strictEqual(states.has('unrelated-row'), false);

    const pendingScenario = {
        scenarioDecision: {
            scenario_code: 'UNKNOWN_PATTERN_REQUIRES_REVIEW',
            requires_review: true
        }
    };
    const appliedBadge = sandbox.renderScenarioBadge(
        pendingScenario,
        states.get('target-row')
    );
    assert.ok(appliedBadge.includes('ΕΦΑΡΜΟΣΤΗΚΕ'));
    assert.ok(!appliedBadge.includes('ΠΡΟΣ ΕΛΕΓΧΟ'));
    assert.strictEqual(sandbox.renderScenarioBadge(pendingScenario, null), '');
}

function testDeclaredRepoPresentationDistinguishesNeutralWorkAndAppliedStates() {
    const neutral = sandbox.resolveReviewRowPresentation({
        kathgoria_ergasias_original: 'ΑΝ',
        kathgoria_ergasias_apologistika: 'ΑΝ',
        repo_apologistika: true,
        cards_ores_ergasias: 0
    }, {
        declaredText: 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ',
        declaredClass: 'cell-declared-repo-day',
        apologistikoText: '-',
        isApologistikoRepoRow: false,
        isApologistikoNonWorkRow: false
    }, null);
    assert.strictEqual(neutral.declared.text, 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ');
    assert.strictEqual(neutral.apologistiko.text, '-');
    assert.strictEqual(neutral.apologistiko.className, '');
    assert.strictEqual(neutral.isOriginalDeclaredRepo, true);
    assert.strictEqual(
        sandbox.renderScenarioBadge({
            scenarioDecision: {
                scenario_code: 'UNKNOWN_PATTERN_REQUIRES_REVIEW',
                requires_review: true
            }
        }, neutral.badgeState),
        ''
    );

    const unexpectedWork = sandbox.resolveReviewRowPresentation({
        kathgoria_ergasias_original: 'ΑΝ',
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: false,
        cards_ores_ergasias: 7.5,
        cards_apo_ora_01: '08:00',
        cards_eos_ora_01: '15:30',
        apo_ora_01_apologistika: '08:00',
        eos_ora_01_apologistika: '15:30'
    }, {
        declaredText: 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ',
        declaredClass: 'cell-declared-repo-day',
        apologistikoText: '08:00–15:30',
        isApologistikoRepoRow: false,
        isApologistikoNonWorkRow: false
    }, { pending: true, applied: false });
    assert.strictEqual(unexpectedWork.isOriginalDeclaredRepo, false);
    assert.strictEqual(unexpectedWork.apologistiko.text, '08:00–15:30');
    assert.strictEqual(unexpectedWork.badgeState.pending, true);

    const applied = sandbox.resolveReviewRowPresentation({
        kathgoria_ergasias_original: 'ΕΡΓ',
        kathgoria_ergasias_apologistika: 'ΑΝ',
        repo_apologistika: true,
        cards_ores_ergasias: 0
    }, {
        declaredText: '08:30–16:30',
        declaredClass: '',
        apologistikoText: '-',
        isApologistikoRepoRow: false,
        isApologistikoNonWorkRow: false
    }, { pending: false, applied: true, role: 'target' });
    assert.strictEqual(applied.apologistiko.text, 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ');
    assert.strictEqual(applied.apologistiko.className, 'cell-repo-day-applied');
    assert.strictEqual(applied.isAppliedRepoTarget, true);
}

function testDeclaredNonWorkStaysOnlyInDeclaredColumn() {
    const neutral = sandbox.resolveReviewRowPresentation({
        kathgoria_ergasias_original: 'ΜΕ',
        kathgoria_ergasias_apologistika: 'ΑΝ',
        repo_apologistika: true,
        cards_ores_ergasias: 0,
        effective_is_full_time: false
    }, {
        declaredText: 'ΜΗ ΕΡΓΑΣΙΑ',
        declaredClass: 'cell-non-work-day',
        apologistikoText: '',
        isApologistikoRepoRow: false,
        isApologistikoNonWorkRow: true
    }, null);

    assert.strictEqual(neutral.declared.text, 'ΜΗ ΕΡΓΑΣΙΑ');
    assert.strictEqual(neutral.apologistiko.text, '-');
    assert.strictEqual(neutral.apologistiko.className, '');
    assert.strictEqual(neutral.apologistiko.source, 'declared_non_work_neutral');
    assert.strictEqual(neutral.isOriginalDeclaredNonWork, true);
    assert.strictEqual(neutral.isOriginalDeclaredNeutral, true);
}

function mockClassList(initial = []) {
    const values = new Set(initial);
    return {
        contains: (value) => values.has(value),
        toggle: (value, force) => {
            if (force === true) values.add(value);
            else if (force === false) values.delete(value);
            else if (values.has(value)) values.delete(value);
            else values.add(value);
        }
    };
}

function testEmployeeGroupsUseAccessibleSingleOpenAccordion() {
    const groups = ['0001', '0002', '0003'].map((groupId) => {
        const attributes = { 'aria-expanded': 'false' };
        return {
            dataset: { groupId },
            classList: mockClassList(['collapsed']),
            setAttribute: (key, value) => { attributes[key] = value; },
            getAttribute: (key) => attributes[key]
        };
    });
    const detailRows = new Map(
        groups.map((group) => [
            group.dataset.groupId,
            [{ classList: mockClassList(['d-none']) }]
        ])
    );
    const originalQuerySelectorAll = documentStub.querySelectorAll;
    documentStub.querySelectorAll = (selector) => {
        if (selector.includes('employee-group-row')) {
            return groups.filter(
                (group) => group.getAttribute('aria-expanded') === 'true'
            );
        }
        const groupId = selector.match(/data-group-id="([^"]+)"/)?.[1];
        return detailRows.get(groupId) || [];
    };

    try {
        sandbox.toggleEmployeeGroupAccordion(groups[0]);
        assert.strictEqual(groups[0].getAttribute('aria-expanded'), 'true');
        assert.strictEqual(groups.filter(
            (group) => group.getAttribute('aria-expanded') === 'true'
        ).length, 1);

        sandbox.toggleEmployeeGroupAccordion(groups[1]);
        assert.strictEqual(groups[0].getAttribute('aria-expanded'), 'false');
        assert.strictEqual(groups[1].getAttribute('aria-expanded'), 'true');
        assert.strictEqual(groups[2].getAttribute('aria-expanded'), 'false');
        assert.strictEqual(groups.filter(
            (group) => group.getAttribute('aria-expanded') === 'true'
        ).length, 1);
        assert.strictEqual(detailRows.get('0001')[0].classList.contains('d-none'), true);
        assert.strictEqual(detailRows.get('0002')[0].classList.contains('d-none'), false);

        sandbox.toggleEmployeeGroupAccordion(groups[1]);
        assert.strictEqual(groups[1].getAttribute('aria-expanded'), 'false');
        assert.strictEqual(groups.filter(
            (group) => group.getAttribute('aria-expanded') === 'true'
        ).length, 0);
    } finally {
        documentStub.querySelectorAll = originalQuerySelectorAll;
    }

    assert.ok(source.includes("groupTr.tabIndex = 0"));
    assert.ok(source.includes("groupTr.setAttribute('role', 'button')"));
    assert.ok(source.includes("groupTr.setAttribute('aria-expanded', 'false')"));
    assert.ok(source.includes("event.key !== 'Enter' && event.key !== ' '"));
    assert.ok(source.includes('event.preventDefault()'));
}

function testAppliedHistoryRendersWithoutCurrentProjectionGroup() {
    vm.runInContext(`currentRepoTransferDecisionsByProposalId = new Map([[
        'resolved-proposal',
        {
            apply_state: 'ALREADY_APPLIED',
            can_apply: false,
            current_execution: { execution_status: 'APPLIED' },
            applied_history: {
                execution_id: 'execution-1',
                employee_name: 'Δοκιμή Εργαζομένου',
                employee_kodikos: '0001',
                week_start: '2026-06-22',
                week_end: '2026-06-28',
                source: { hmeromhnia: '2026-06-22', result: 'ΕΡΓ' },
                target: { hmeromhnia: '2026-06-26', result: 'ΑΝ', repo_apologistika: true },
                applied_at: '2026-07-29T04:00:00.000Z',
                applied_by_user_name: 'Admin'
            }
        }
    ]]); currentHrReviewProjection = { groups: [] }`, sandbox);
    const html = sandbox.renderAppliedRepoTransferHistory();
    assertContains(html, [
        'Εφαρμοσμένες μεταφορές ρεπό',
        'Εφαρμόστηκε',
        'Δοκιμή Εργαζομένου',
        '0001',
        '22/06/2026',
        '26/06/2026',
        'ΕΡΓ',
        'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ'
    ]);
    assert.ok(!html.includes('hr-review-apply-btn'));
    assert.ok(!html.includes('hr-review-decision-btn'));
    assert.strictEqual(sandbox.window.EmploymentReviewHrTest.diagnostics().pendingGroups, 0);
}

function testReadyFullTimeAndSplitShift() {
    const html = render(readyProjection());
    assertContains(html, [
        'Προτάσεις Μεταφοράς Ρεπό',
        'Ροή έγκρισης HR',
        'Πρόταση προς έλεγχο από HR',
        'Η πρόταση μεταφοράς ρεπό περιλαμβάνει δύο συνδεδεμένες αλλαγές',
        'Η προεπισκόπηση δεν αλλάζει δεδομένα',
        'Ημέρα που γίνεται εργασία',
        'Ημέρα που γίνεται ρεπό',
        'ΑΝ',
        'ΕΡΓ',
        'Ωράριο 01:',
        '08:00–12:00',
        'Ωράριο 02:',
        '12:30–16:00',
        'Ωράριο 03:',
        '7,50',
        '0,00'
    ]);
    assert.ok(!/\batomic\b/i.test(getVisibleText(html)));
}

function testNoTargetFallbackIsInformationalOnly() {
    const html = render({
        summary: {
            review_outcomes_count: 1,
            review_outcome_employees_count: 1,
            employees_count: 1
        },
        reason_counts: { NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS: 1 },
        warning_counts: {},
        groups: [],
        review_outcomes: [{
            outcome_code: 'PARTIAL_UNEXPECTED_WORK_WITHOUT_OFFSET_DAY',
            source: {
                hmeromhnia: '2026-07-06',
                cards_ores_ergasias: 4.5,
                proposed_category: 'ΕΡΓ'
            },
            employee_kodikos: '001',
            ypokatasthma: '0001',
            week_start: '2026-07-05',
            week_end: '2026-07-11',
            investigation_guidance: ['ΑΔΕΙΑ', 'ΑΠΟΥΣΙΑ'],
            runtime_apply_supported: false
        }]
    });
    assertContains(getVisibleText(html), [
        'Έλεγχος Μεταφοράς Ρεπό',
        'Μη προγραμματισμένη εργασία χωρίς ημέρα αντιστάθμισης',
        'Βρέθηκε πραγματική εργασία, αλλά δεν βρέθηκε κατάλληλη ημέρα',
        'άδεια ή απουσία',
        'Εργαζόμενος 001',
        'Εβδομάδα:',
        '05/07/2026',
        '11/07/2026',
        '4,50',
        'Άνοιγμα στον πίνακα',
        'Εκκρεμότητες που απαιτούν ενέργεια'
    ]);
    const visibleText = getVisibleText(html);
    assert.ok(!visibleText.includes('δύο συνδεδεμένες αλλαγές'));
    assert.ok(!visibleText.includes('εφαρμόζεται μόνο ως σύνολο'));
    assert.ok(!visibleText.includes('Εφαρμογή εγκεκριμένης μεταφοράς'));
    assert.ok(!visibleText.includes('NaN'));
    assert.ok(!html.includes('atomic-repo-transfer-apply-btn'));
    assert.ok(!html.includes('atomic-repo-transfer-decision-btn'));
}

function testNoTargetGuidanceComesOnlyFromServer() {
    const html = render({
        summary: { review_outcomes_count: 1 },
        groups: [],
        review_outcomes: [{
            outcome_code: 'PARTIAL_UNEXPECTED_WORK_WITHOUT_OFFSET_DAY',
            employee_kodikos: '001',
            week_start: '2026-07-05',
            week_end: '2026-07-11',
            source: { hmeromhnia: '2026-07-06', cards_ores_ergasias: 4.5 },
            investigation_guidance: []
        }]
    });
    assert.ok(!getVisibleText(html).includes('άδεια ή απουσία'));
    assert.ok(!getVisibleText(html).includes('Πιθανή αιτία προς διερεύνηση'));

    const unknown = render({
        summary: { review_outcomes_count: 1 },
        groups: [],
        review_outcomes: [{
            outcome_code: 'PARTIAL_UNEXPECTED_WORK_WITHOUT_OFFSET_DAY',
            source: { hmeromhnia: '2026-07-06', cards_ores_ergasias: 4.5 },
            investigation_guidance: ['UNKNOWN']
        }]
    });
    assert.ok(!getVisibleText(unknown).includes('UNKNOWN'));
    assert.ok(!getVisibleText(unknown).includes('Πιθανή αιτία προς διερεύνηση'));
}

function testBlockedTargetOutcomeIsDistinctAndReadOnly() {
    const html = render({
        summary: { review_outcomes_count: 1, review_outcome_employees_count: 1 },
        reason_counts: { TARGET_LOCKED: 1 },
        groups: [],
        review_outcomes: [{
            outcome_code: 'PARTIAL_OFFSET_TARGET_BLOCKED',
            employee_kodikos: '001',
            week_start: '2026-07-05',
            week_end: '2026-07-11',
            source: { hmeromhnia: '2026-07-06', cards_ores_ergasias: 4.5 },
            blocked_target_reasons: ['TARGET_LOCKED'],
            investigation_guidance: []
        }]
    });
    const visible = getVisibleText(html);
    assert.ok(visible.includes('Η πιθανή ημέρα ρεπό είναι κλειδωμένη'));
    assert.ok(!visible.includes('Δεν βρέθηκε προδηλωμένη ημέρα'));
    assert.ok(!visible.includes('άδεια ή απουσία'));
    assert.ok(!visible.includes('TARGET_LOCKED'));
    assert.ok(!html.includes('atomic-repo-transfer-decision-btn'));
    assert.ok(!html.includes('atomic-repo-transfer-apply-btn'));
}

function testCardConflictedTargetOutcomeIsSpecificAndReadOnly() {
    const html = render({
        summary: { review_outcomes_count: 1, review_outcome_employees_count: 1 },
        reason_counts: { TARGET_ZERO_HOURS_WITH_CARD_INTERVALS: 1 },
        groups: [],
        review_outcomes: [{
            outcome_code: 'PARTIAL_OFFSET_TARGET_BLOCKED',
            employee_kodikos: '001',
            week_start: '2026-07-05',
            week_end: '2026-07-11',
            source: { hmeromhnia: '2026-07-06', cards_ores_ergasias: 4.5 },
            blocked_target_reasons: ['TARGET_ZERO_HOURS_WITH_CARD_INTERVALS'],
            investigation_guidance: []
        }]
    });
    const visible = getVisibleText(html);
    assert.ok(visible.includes(
        'Η προδηλωμένη ημέρα έχει μηδενικές συνολικές ώρες καρτών αλλά περιέχει πλήρες διάστημα κάρτας.'
    ));
    assert.ok(!visible.includes('Δεν βρέθηκε προδηλωμένη ημέρα'));
    assert.ok(!visible.includes('άδεια ή απουσία'));
    assert.ok(!visible.includes('TARGET_ZERO_HOURS_WITH_CARD_INTERVALS'));
    assert.ok(!html.includes('atomic-repo-transfer-decision-btn'));
    assert.ok(!html.includes('atomic-repo-transfer-apply-btn'));

    const incomplete = render({
        summary: { review_outcomes_count: 1 },
        groups: [],
        review_outcomes: [{
            outcome_code: 'PARTIAL_OFFSET_TARGET_BLOCKED',
            source: { hmeromhnia: '2026-07-06', cards_ores_ergasias: 4.5 },
            blocked_target_reasons: ['TARGET_ZERO_HOURS_WITH_INCOMPLETE_CARD_PAIR'],
            investigation_guidance: []
        }]
    });
    const incompleteVisible = getVisibleText(incomplete);
    assert.ok(incompleteVisible.includes(
        'Η προδηλωμένη ημέρα περιέχει ελλιπές ζεύγος εισόδου–εξόδου κάρτας.'
    ));
    assert.ok(!incompleteVisible.includes('TARGET_ZERO_HOURS_WITH_INCOMPLETE_CARD_PAIR'));
}

function testBlockedTargetCandidateDetailsAreSafeAndScoped() {
    vm.runInContext(`currentReviewRows = [{
        _id: '0009-target', kodikos: '0009', ypokatasthma: '0000',
        hmeromhnia: '2026-06-09', kathgoria_ergasias_apologistika: 'ΑΝ',
        repo_apologistika: true
    }]`, sandbox);
    assert.strictEqual(vm.runInContext(`getBlockedTargetCandidateDiagnosticLabel(
        'TARGET_CONFLICTING_APOLOGISTIKA_CATEGORY',
        { prodhlomena_oraria_id: '0009-target', hmeromhnia: '2026-06-09' },
        { employee_kodikos: '0009', ypokatasthma: '0000' }
    )`, sandbox),
    '09/06/2026: Προδηλωμένη εργασία χωρίς κάρτες — ' +
        'απολογιστικά χαρακτηρίστηκε ΑΝΑΠΑΥΣΗ / ΡΕΠΟ.');
    const presentationOnlyCase = {
        employee_kodikos: '0009', ypokatasthma: '0000',
        pending_count: 0, requires_hr_action: false, status: 'COMPLETED'
    };
    const presentationOnlyCandidate = {
        prodhlomena_oraria_id: '0009-target', hmeromhnia: '2026-06-09',
        blocker_reasons: ['TARGET_CONFLICTING_APOLOGISTIKA_CATEGORY']
    };
    const presentationOnlyBefore = structuredClone({
        presentationOnlyCase, presentationOnlyCandidate
    });
    sandbox.renderActionableBlockedTargetCandidate(
        presentationOnlyCandidate, presentationOnlyCase
    );
    assert.deepStrictEqual({ presentationOnlyCase, presentationOnlyCandidate },
        presentationOnlyBefore);
    const html = render({
        summary: { review_outcomes_count: 1 },
        groups: [],
        review_outcomes: [{
            outcome_code: 'PARTIAL_OFFSET_TARGET_BLOCKED',
            source: { hmeromhnia: '2026-07-06', cards_ores_ergasias: 4.5 },
            blocked_target_reasons: [
                'TARGET_INVALID_CARD_HOURS_VALUE',
                'TARGET_ZERO_HOURS_WITH_INCOMPLETE_CARD_PAIR'
            ],
            blocked_target_candidates_count: 3,
            blocked_target_candidates: [
                {
                    prodhlomena_oraria_id: '0009-target',
                    hmeromhnia: '2026-06-09',
                    current_category: 'ΕΡΓ',
                    blocker_reasons: ['TARGET_CONFLICTING_APOLOGISTIKA_CATEGORY']
                },
                {
                    prodhlomena_oraria_id: 'must-not-render-1',
                    hmeromhnia: '2026-07-08',
                    current_category: 'ΕΡΓ',
                    blocker_reasons: ['TARGET_ZERO_HOURS_WITH_INCOMPLETE_CARD_PAIR']
                },
                {
                    prodhlomena_oraria_id: 'must-not-render-2',
                    hmeromhnia: '2026-07-10',
                    current_category: '<ΕΡΓ>',
                    blocker_reasons: ['TARGET_INVALID_CARD_HOURS_VALUE']
                }
            ],
            investigation_guidance: []
        }]
    });
    const visible = getVisibleText(html);
    assert.ok(visible.includes('Πιθανές ημέρες: 3'));
    assert.ok(visible.includes(
        '09/06/2026: Προδηλωμένη εργασία χωρίς κάρτες — απολογιστικά χαρακτηρίστηκε ΑΝΑΠΑΥΣΗ / ΡΕΠΟ.'
    ));
    assert.ok(!visible.includes(
        'Η προδηλωμένη ημέρα χωρίς κάρτες έχει διαφορετική απολογιστική κατηγορία.'
    ));
    assert.ok(visible.includes('08/07/2026 — ΕΡΓ'));
    assert.ok(visible.includes('10/07/2026 — &lt;ΕΡΓ&gt;'));
    assert.ok(visible.includes('Η προδηλωμένη ημέρα περιέχει ελλιπές ζεύγος εισόδου–εξόδου κάρτας.'));
    assert.ok(visible.includes('Η συνολική τιμή ωρών καρτών της ημέρας δεν είναι έγκυρη.'));
    assert.ok(!visible.includes('must-not-render'));
    assert.ok(!visible.includes('TARGET_INVALID_CARD_HOURS_VALUE'));
    assert.ok(!html.includes('atomic-repo-transfer-decision-btn'));
    assert.ok(!html.includes('atomic-repo-transfer-apply-btn'));

    const singular = render({
        summary: { review_outcomes_count: 1 },
        groups: [],
        review_outcomes: [{
            outcome_code: 'PARTIAL_OFFSET_TARGET_BLOCKED',
            source: { hmeromhnia: '2026-07-06', cards_ores_ergasias: 4.5 },
            blocked_target_reasons: ['TARGET_ZERO_HOURS_WITH_ZERO_LENGTH_CARD_INTERVAL'],
            blocked_target_candidates: [{
                hmeromhnia: '2026-07-08',
                current_category: 'ΕΡΓ',
                blocker_reasons: ['TARGET_ZERO_HOURS_WITH_ZERO_LENGTH_CARD_INTERVAL']
            }]
        }]
    });
    assert.ok(getVisibleText(singular).includes('Πιθανές ημέρες: 1'));
    assert.ok(getVisibleText(singular).includes(
        'Η ημέρα περιέχει ζεύγος κάρτας με ίδια ώρα εισόδου και εξόδου.'
    ));

    const malformed = render({
        summary: { review_outcomes_count: 1 },
        groups: [],
        review_outcomes: [{
            outcome_code: 'PARTIAL_OFFSET_TARGET_BLOCKED',
            source: { hmeromhnia: '2026-07-06', cards_ores_ergasias: 4.5 },
            blocked_target_reasons: ['TARGET_INVALID_CARD_TIME_VALUE'],
            blocked_target_candidates: [{ hmeromhnia: 'not-a-date', blocker_reasons: null }]
        }]
    });
    const malformedVisible = getVisibleText(malformed);
    assert.ok(malformedVisible.includes('Η ημέρα περιέχει μη έγκυρη τιμή ώρας κάρτας.'));
    assert.ok(!malformedVisible.includes('Υποψήφιες ημέρες'));
}

function testGroupsAndReviewOutcomesRenderSeparateSafetyMessages() {
    const projection = readyProjection({ targetCategory: 'ΜΕ' });
    projection.review_outcomes = [{
        outcome_code: 'PARTIAL_UNEXPECTED_WORK_WITHOUT_OFFSET_DAY',
        employee_kodikos: '002',
        week_start: '2026-07-05',
        week_end: '2026-07-11',
        source: { hmeromhnia: '2026-07-07', cards_ores_ergasias: 3.5 },
        investigation_guidance: ['ΑΔΕΙΑ', 'ΑΠΟΥΣΙΑ']
    }];
    const html = render(projection);
    assertContains(html, [
        'δύο συνδεδεμένες αλλαγές',
        'εφαρμόζεται μόνο ως σύνολο',
        'Εκκρεμότητες που απαιτούν ενέργεια',
        'Άνοιγμα στον πίνακα',
        'Συνδεδεμένη πρόταση μεταφοράς ρεπό',
        'Μη προγραμματισμένη εργασία χωρίς ημέρα αντιστάθμισης'
    ]);
}

function testCompleteVisibleSectionContainsNoTechnicalTerms() {
    const projection = readyProjection();
    projection.projection_status = 'READY';
    projection.groups[0].status = 'READY';
    projection.groups[0].title = 'Atomic READY group projection';
    projection.groups[0].description =
        'Η atomic read-only πρόταση απαιτεί ενιαία αποδοχή. Runtime apply blocked.';
    projection.groups[0].warnings = ['APPLY_SUPPORTED'];
    const visibleText = getVisibleText(render(projection));

    [
        /\batomic\b/i,
        /read[\s-]*only/i,
        /\bprojection\b/i,
        /\beligibility\b/i,
        /runtime\s+apply/i,
        /apply\s+supported/i,
        /\bready\b/i,
        /\bgroup\b/i,
        /\bblocked\b/i
    ].forEach((forbiddenPattern) => {
        assert.ok(
            !forbiddenPattern.test(visibleText),
            `Technical term is visible: ${forbiddenPattern}`
        );
    });

    assert.ok(
        visibleText.includes(
            'Η πρόταση μεταφοράς ρεπό περιλαμβάνει δύο συνδεδεμένες αλλαγές'
        )
    );
    assert.ok(visibleText.includes('Η προεπισκόπηση δεν αλλάζει δεδομένα'));
    assert.ok(visibleText.includes('Συνδεδεμένη πρόταση μεταφοράς ρεπό'));
    assert.ok(visibleText.includes('Η ενέργεια εφαρμογής εμφανίζεται μόνο μετά από έγκριση'));
    assert.ok(visibleText.includes('Ροή έγκρισης HR'));
}

function testPartTimeTargetIsNotAnError() {
    const html = render(readyProjection({ targetCategory: 'ΜΕ' }));
    assertContains(html, [
        'Πρόταση',
        'ΜΕ',
        'Ημέρα που γίνεται ρεπό — προδηλωμένη εργασία χωρίς κάρτες, Προτείνεται ΜΕ'
    ]);
    assert.ok(!html.includes('πρώτη προδηλωμένη ημέρα'));
    assert.ok(!html.includes('ΜΕ</dd> error'));
}

function testEmptyFirstIntervalDoesNotCompactSecond() {
    const html = render(
        readyProjection({
            sourceIntervals: [
                ['', ''],
                ['12:00', '16:00'],
                ['', '']
            ]
        })
    );
    const firstSlot = html.indexOf('Ωράριο 01:');
    const emptyMarker = html.indexOf('—', firstSlot);
    const secondSlot = html.indexOf('Ωράριο 02:');
    const secondInterval = html.indexOf('12:00–16:00', secondSlot);

    assert.ok(firstSlot >= 0 && emptyMarker > firstSlot);
    assert.ok(secondSlot > emptyMarker && secondInterval > secondSlot);
}

function testReadOnlySafety() {
    const html = render(readyProjection());
    [
        'APPROVE_PREFILL',
        'Αποθήκευση',
        'Εφαρμογή'
    ].forEach((value) => assert.ok(!html.includes(value), `Forbidden atomic HTML: ${value}`));
    assert.strictEqual((html.match(/atomic-repo-transfer-decision-btn/g) || []).length, 3);
    assert.ok(html.includes('Έγκριση πρότασης'));
    assert.ok(html.includes('Απόρριψη πρότασης'));
    assert.ok(html.includes('Χρειάζεται περαιτέρω έλεγχο'));
    assert.ok(html.includes('Απόφαση για ολόκληρη τη συνδεδεμένη πρόταση'));
    assert.ok(!html.includes('onclick='));
}

function testServerDerivedRepoTransferPermissionsAndRoleVisibility() {
    assert.ok(viewSource.includes('id="canRecordRepoTransferDecision"'));
    assert.ok(viewSource.includes('id="canApplyRepoTransferDecision"'));
    assert.ok(viewSource.includes("['A', 'S', 'HR'].includes(normalizedUserRole)"));
    assert.ok(viewSource.includes('id="canReviewEdit"'));
    assert.ok(!viewSource.includes('id="currentUserRole"'));
    assert.ok(!viewSource.includes('id="userRole"'));
    assert.ok(!source.includes('userCanRecordRepoTransferDecision() {\n    return userCanReviewEdit()'));
    assert.ok(!source.includes('userCanApplyRepoTransferDecision() {\n    return userCanReviewEdit()'));

    vm.runInContext("currentPolicyPreviewBaseParams = new URLSearchParams('ypokatasthma=0000')", sandbox);
    for (const permissions of [
        { role: 'A', decision: true, apply: true },
        { role: 'S', decision: true, apply: true },
        { role: 'HR', decision: true, apply: true },
        { role: 'UNKNOWN', decision: false, apply: false }
    ]) {
        setRepoTransferPermissions(permissions);
        vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: 'READY_TO_APPLY', can_apply: true, apply_allowed: true, current_decision: { id: '507f191e810c19729de860ea', decision_code: 'APPROVE_PROPOSAL', decision_status: 'RECORDED', is_current: true }, history: [] }]])", sandbox);
        const html = render(readyProjection());
        assert.strictEqual((html.match(/atomic-repo-transfer-decision-btn/g) || []).length, permissions.decision ? 3 : 0, permissions.role);
        assert.strictEqual(html.includes('atomic-repo-transfer-apply-btn'), permissions.apply, permissions.role);
    }

    setRepoTransferPermissions();
    const missing = render(readyProjection());
    assert.strictEqual((missing.match(/atomic-repo-transfer-decision-btn/g) || []).length, 0);
    assert.ok(!missing.includes('atomic-repo-transfer-apply-btn'));
    elementsById.set('canReviewEdit', { value: '1' });
    const noFallback = render(readyProjection());
    assert.strictEqual((noFallback.match(/atomic-repo-transfer-decision-btn/g) || []).length, 0);
    assert.ok(!noFallback.includes('atomic-repo-transfer-apply-btn'));
    elementsById.delete('canReviewEdit');
    setRepoTransferPermissions({ decision: true, apply: true });
    vm.runInContext('currentRepoTransferDecisionsByProposalId = new Map(); currentPolicyPreviewBaseParams = null', sandbox);
}

function testConfidenceAndDecisionTerminology() {
    const primary = sandbox.renderScenarioBadge({ scenarioDecision: { scenario_code: 'UNKNOWN_PATTERN_REQUIRES_REVIEW', confidence: 'HIGH', requires_review: true } });
    assert.ok(primary.includes('ΠΡΟΣ ΕΛΕΓΧΟ'));
    assert.ok(!getVisibleText(primary).includes('Υψηλή'));
    assert.ok(!getVisibleText(primary).includes('Μεσαία'));
    assert.ok(!getVisibleText(primary).includes('Χαμηλή'));
    const details = sandbox.renderScenarioDetailsSection({ scenarioDecision: { scenario_code: 'UNKNOWN_PATTERN_REQUIRES_REVIEW', confidence: 'HIGH', requires_review: true } });
    assert.ok(details.includes('Βεβαιότητα αντιστοίχισης: Υψηλή'));
    assert.ok(!details.includes('Προτεραιότητα'));
    assert.ok(source.includes("NEEDS_MORE_REVIEW: 'Χρειάζεται περαιτέρω έλεγχο'"));
    assert.ok(source.includes('Καμία αλλαγή δεν γίνεται από την προεπισκόπηση.'));
    assert.ok(!source.includes('<span>Δεν μπορεί να εφαρμοστεί</span>'));
}

function testResolvedUnscheduledWorkDoesNotRenderReviewBadge() {
    const resolved = sandbox.renderScenarioBadge({
        scenarioDecision: {
            scenario_code: 'UNSCHEDULED_DAY_WITH_CARDS',
            confidence: 'HIGH',
            requires_review: false,
            display_labels: { show_badge: false }
        }
    });
    assert.strictEqual(resolved, '');
    assert.strictEqual(
        sandbox.isScenarioReviewRow({
            scenarioDecision: {
                scenario_code: 'UNSCHEDULED_DAY_WITH_CARDS',
                requires_review: false
            }
        }),
        false
    );
}

function testBranchRequiredForDecisionButtons() {
    vm.runInContext("currentPolicyPreviewBaseParams = new URLSearchParams('ypokatasthma=ALL')", sandbox);
    const withoutBranch = render(readyProjection());
    assert.ok(withoutBranch.includes('Για την καταγραφή απόφασης επιλέξτε συγκεκριμένο υποκατάστημα.'));
    assert.strictEqual((withoutBranch.match(/atomic-repo-transfer-decision-btn[^>]+disabled/g) || []).length, 3);
    const visible = getVisibleText(withoutBranch).toLowerCase();
    ['fingerprint', 'stale', 'canonical', 'runtime apply'].forEach((term) => assert.ok(!visible.includes(term)));
    vm.runInContext("currentPolicyPreviewBaseParams = new URLSearchParams('ypokatasthma=0000')", sandbox);
    const withBranch = render(readyProjection());
    assert.strictEqual((withBranch.match(/atomic-repo-transfer-decision-btn[^>]+disabled/g) || []).length, 0);
    vm.runInContext('currentPolicyPreviewBaseParams = null', sandbox);
}

async function testAllBranchSkipsDecisionRequests() {
    fetchCalls = 0;
    vm.runInContext("currentPolicyPreviewBaseParams = new URLSearchParams('ypokatasthma=ALL')", sandbox);
    vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['old', {}]])", sandbox);
    await sandbox.refreshRepoTransferDecisions();
    assert.strictEqual(fetchCalls, 0);
    assert.strictEqual(vm.runInContext('currentRepoTransferDecisionsByProposalId.size', sandbox), 0);
    vm.runInContext('currentPolicyPreviewBaseParams = null', sandbox);
}

function testOnlyCurrentDecisionDisablesButtons() {
    vm.runInContext("currentPolicyPreviewBaseParams = new URLSearchParams('ypokatasthma=0000')", sandbox);
    vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { current_decision: { decision_code: 'APPROVE_PROPOSAL', created_at: '2026-06-20', created_by_user_name: 'HR', is_current: true }, history: [] }]])", sandbox);
    const currentHtml = render(readyProjection());
    assert.strictEqual((currentHtml.match(/atomic-repo-transfer-decision-btn/g) || []).length, 0);
    vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { current_decision: null, history: [{ decision_code: 'REJECT_PROPOSAL', created_at: '2026-06-19', created_by_user_name: 'HR', is_current: false }] }]])", sandbox);
    const staleOnlyHtml = render(readyProjection());
    assert.strictEqual((staleOnlyHtml.match(/atomic-repo-transfer-decision-btn[^>]+disabled/g) || []).length, 0);
    assert.ok(staleOnlyHtml.includes('Προηγούμενες καταγεγραμμένες αποφάσεις'));
    vm.runInContext('currentPolicyPreviewBaseParams = null', sandbox);
}

async function testBatchHistoryUsesOneFetchForManyGroups() {
    fetchCalls = 0;
    const projection = readyProjection();
    projection.groups = Array.from({ length: 20 }, (_, index) => ({
        ...projection.groups[0],
        group_id: `atomic-group-${index + 1}`
    }));
    vm.runInContext("currentPolicyPreviewBaseParams = new URLSearchParams('ypokatasthma=0000&apo_hmeromhnia=2026-06-14&eos_hmeromhnia=2026-06-20')", sandbox);
    vm.runInContext(`currentAtomicRepoTransferProjection = ${JSON.stringify(projection)}`, sandbox);
    sandbox.fetch = async (url, options) => {
        fetchCalls++;
        assert.ok(String(url).startsWith('/api/prodhlomena-oraria/review/repo-transfer-decisions/current?'));
        assert.strictEqual(options.method, undefined);
        return {
            ok: true,
            json: async () => ({
                success: true,
                records: projection.groups.map((group) => ({
                    proposal_id: group.group_id,
                    current_decision: null,
                    history: [],
                    history_count: 0
                }))
            })
        };
    };
    await sandbox.refreshRepoTransferDecisions();
    assert.strictEqual(fetchCalls, 1);
    assert.strictEqual(vm.runInContext('currentRepoTransferDecisionsByProposalId.size', sandbox), 20);
    assert.ok(!source.slice(source.indexOf('async function refreshRepoTransferDecisions'), source.indexOf('async function submitRepoTransferDecision')).includes('for (const group'));
    vm.runInContext('currentPolicyPreviewBaseParams = null', sandbox);
}

function testCurrentAndPreviousHistoryAreEscaped() {
    vm.runInContext("currentPolicyPreviewBaseParams = new URLSearchParams('ypokatasthma=0000')", sandbox);
    vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { current_decision: { decision_code: 'APPROVE_PROPOSAL', created_by_user_name: '<b>HR</b>', notes: '<img src=x>', is_current: true }, history: [{ decision_code: 'APPROVE_PROPOSAL', is_current: true }, { decision_code: 'REJECT_PROPOSAL', created_by_user_name: '<script>x</script>', notes: '<svg>', is_current: false }], history_count: 2 }]])", sandbox);
    const html = render(readyProjection());
    assert.ok(!html.includes('Προηγούμενες καταγεγραμμένες αποφάσεις'));
    assert.ok(!html.includes('&lt;b&gt;HR&lt;/b&gt;'));
    assert.ok(!html.includes('&lt;script&gt;x&lt;/script&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<img src=x>'));
    assert.ok(!html.includes('<svg>'));
    vm.runInContext('currentRepoTransferDecisionsByProposalId = new Map(); currentPolicyPreviewBaseParams = null', sandbox);
}

function testAdvancedStaleDecisionRequiresNewDecisionWithoutApply() {
    setRepoTransferPermissions({ decision: true, apply: true });
    vm.runInContext("currentPolicyPreviewBaseParams = new URLSearchParams('ypokatasthma=0000')", sandbox);
    vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: 'STALE_DECISION', can_apply: false, current_decision: null, apply_readiness: { status: 'BLOCKED', reason: 'STALE_DECISION' }, history: [{ decision_code: 'APPROVE_PROPOSAL', created_by_user_name: '<Old Admin>', is_current: false }] }]])", sandbox);
    const html = render(readyProjection());
    const visible = getVisibleText(html);
    assert.ok(visible.includes('Η προηγούμενη έγκριση δεν ισχύει πλέον, επειδή τα δεδομένα της πρότασης έχουν αλλάξει. Απαιτείται νέος έλεγχος και νέα απόφαση.'));
    assert.strictEqual((html.match(/atomic-repo-transfer-decision-btn/g) || []).length, 3);
    assert.ok(!html.includes('atomic-repo-transfer-apply-btn'));
    assert.ok(html.includes('Προηγούμενες καταγεγραμμένες αποφάσεις'));
    assert.ok(html.includes('&lt;Old Admin&gt;'));
    assert.ok(!visible.includes('STALE_DECISION'));
    assert.ok(!visible.includes('fingerprint'));
    vm.runInContext('currentRepoTransferDecisionsByProposalId = new Map(); currentPolicyPreviewBaseParams = null', sandbox);
}

function testApplyPresentationStatesAndSafetyContract() {
    vm.runInContext("currentPolicyPreviewBaseParams = new URLSearchParams('ypokatasthma=0000')", sandbox);
    const states = {
        READY_TO_APPLY: 'Εφαρμογή εγκεκριμένης μεταφοράς',
        RUNTIME_DISABLED: 'Η εφαρμογή δεν είναι ακόμη ενεργοποιημένη.',
        INDEXES_NOT_READY: 'Η ασφαλής εφαρμογή δεν είναι ακόμη διαθέσιμη.'
    };
    Object.entries(states).forEach(([applyState, text]) => {
        vm.runInContext(`currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: '${applyState}', can_apply: ${applyState === 'READY_TO_APPLY'}, apply_allowed: ${applyState === 'READY_TO_APPLY'}, current_decision: { id: '507f191e810c19729de860ea', decision_code: 'APPROVE_PROPOSAL', decision_status: 'RECORDED', is_current: true }, history: [] }]])`, sandbox);
        const html = render(readyProjection());
        assert.strictEqual(html.includes(text), applyState === 'READY_TO_APPLY');
        assert.strictEqual(html.includes('atomic-repo-transfer-apply-btn'), applyState === 'READY_TO_APPLY');
    });
    vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: 'ALREADY_APPLIED', current_execution: { applied_at: '2026-07-15T10:00:00.000Z' }, current_decision: { id: '507f191e810c19729de860ea', decision_code: 'APPROVE_PROPOSAL', is_current: true }, history: [] }]])", sandbox);
    const applied = render(readyProjection());
    assert.ok(!applied.includes('Η πρόταση εφαρμόστηκε'));
    assert.ok(!applied.includes('atomic-repo-transfer-apply-btn'));
    vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: 'ALREADY_APPLIED', current_execution: { applied_at: '2026-07-16T11:00:00.000Z', created_by_user_name: '<Executor>' }, current_decision: null, history: [{ decision_code: 'APPROVE_PROPOSAL', created_by_user_name: '<HR>', is_current: false }] }]])", sandbox);
    const appliedWithoutCurrent = render(readyProjection());
    assert.ok(!appliedWithoutCurrent.includes('Η πρόταση εφαρμόστηκε'));
    assert.ok(!appliedWithoutCurrent.includes('16/07/2026'));
    assert.ok(!appliedWithoutCurrent.includes('atomic-repo-transfer-apply-btn'));
    assert.ok(!appliedWithoutCurrent.includes('&lt;HR&gt;'));
    assert.ok(!appliedWithoutCurrent.includes('<HR>'));
    for (const code of ['REJECT_PROPOSAL', 'NEEDS_MORE_REVIEW']) {
        vm.runInContext(`currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: 'NOT_APPROVED', current_decision: { decision_code: '${code}', is_current: true }, history: [] }]])`, sandbox);
        assert.ok(!render(readyProjection()).includes('atomic-repo-transfer-apply-btn'));
    }
    const applySource = source.slice(source.indexOf('async function submitRepoTransferApply'), source.indexOf('function renderAtomicRepoTransferProjection'));
    assert.ok(applySource.includes('Εφαρμογή εγκεκριμένης μεταφοράς ρεπό'));
    assert.ok(applySource.includes('Ημέρα προέλευσης:') && applySource.includes('Ημέρα στόχος:'));
    assert.strictEqual((applySource.match(/method: 'POST'/g) || []).length, 1);
    assert.ok(applySource.includes('body: JSON.stringify({ request_id:'));
    assert.ok(!applySource.includes('body: JSON.stringify({ decision_id'));
    assert.ok(applySource.includes("'x-csrf-token': token"));
    assert.ok(applySource.includes('repoTransferApplySubmitting.has(decisionId)'));
    assert.ok(applySource.includes('await refreshRepoTransferDecisions()'));
    assert.ok(!applySource.includes('retry'));
    assert.ok(!/\son[a-z]+\s*=/.test(applied));
    vm.runInContext('currentRepoTransferDecisionsByProposalId = new Map(); currentPolicyPreviewBaseParams = null', sandbox);
}

function testImmediatePostApplyRefreshKeepsBadgeForTemporaryOldGroup() {
    // The pre-apply projection intentionally remains in memory until a full page reload.
    vm.runInContext("currentPolicyPreviewBaseParams = new URLSearchParams('ypokatasthma=0000')", sandbox);
    vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { proposal_id: 'atomic-group-1', current_decision: null, current_execution: { applied_at: '2026-07-15T10:00:00.000Z', execution_status: 'APPLIED' }, apply_state: 'ALREADY_APPLIED', apply_allowed: false, history: [{ decision_code: 'APPROVE_PROPOSAL', is_current: false }] }]])", sandbox);
    const html = render(readyProjection());
    assert.ok(!html.includes('Η πρόταση εφαρμόστηκε'));
    assert.ok(!html.includes('atomic-repo-transfer-apply-btn'));
    vm.runInContext('currentRepoTransferDecisionsByProposalId = new Map(); currentPolicyPreviewBaseParams = null', sandbox);
}

function applyGroup() {
    const projection = readyProjection();
    return projection.groups[0];
}

function setupApplyBehavior({ response, networkError, refreshError } = {}) {
    const calls = { post: 0, refresh: 0, render: 0, swal: [], requestIds: [] };
    sandbox.Swal = {
        fire: async (options) => {
            calls.swal.push(options);
            if (options?.showCancelButton) return { isConfirmed: true };
            return {};
        },
        close: () => {},
        showLoading: () => {}
    };
    sandbox.fetch = async (_url, options) => {
        calls.post++;
        assert.strictEqual(options.method, 'POST');
        calls.requestIds.push(JSON.parse(options.body).request_id);
        if (networkError) throw new Error('private network detail');
        return response || { ok: true, json: async () => ({ success: true, message: 'Ασφαλές μήνυμα επιτυχίας.' }) };
    };
    sandbox.getPolicyPreviewCsrfToken = async () => 'csrf-test';
    sandbox.refreshRepoTransferDecisions = async () => {
        calls.refresh++;
        if (refreshError) throw new Error('private refresh detail');
        vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: 'ALREADY_APPLIED', can_apply: false, current_execution: { execution_status: 'APPLIED', applied_at: '2026-07-15T10:00:00.000Z' } }]])", sandbox);
    };
    sandbox.renderPolicyPreviewGroups = () => { calls.render++; };
    vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: 'READY_TO_APPLY', can_apply: true, apply_context: { company_kodikos: '0004', ypokatasthma: '0000', week_start: '2026-06-14', week_end: '2026-06-20' } }]])", sandbox);
    return calls;
}

async function testApplyPostSuccessAndRefreshSuccess() {
    const calls = setupApplyBehavior();
    const button = { disabled: false };
    await sandbox.submitRepoTransferApply(applyGroup(), '507f191e810c19729de860ea', button);
    assert.strictEqual(calls.post, 1);
    assert.strictEqual(calls.refresh, 1);
    assert.strictEqual(calls.render, 1);
    assert.ok(calls.swal.some((call) => call.title === 'Η μεταφορά ρεπό εφαρμόστηκε επιτυχώς.' && call.icon === 'success'));
    assert.strictEqual(button.disabled, true);
}

async function testApplyPostSuccessAndRefreshFailure() {
    const calls = setupApplyBehavior({ refreshError: true });
    const button = { disabled: false };
    await sandbox.submitRepoTransferApply(applyGroup(), '507f191e810c19729de860eb', button);
    assert.strictEqual(calls.post, 1);
    assert.strictEqual(calls.refresh, 1);
    assert.ok(calls.swal.some((call) => call.title === 'Απαιτείται ανανέωση κατάστασης' && call.icon === 'warning' && call.text.includes('η προβολή δεν επιβεβαίωσε')));
    assert.ok(!calls.swal.some((call) => call.title === 'Δεν εφαρμόστηκε η πρόταση'));
    assert.strictEqual(button.disabled, true);
}

async function testApplyServerAndNetworkFailures() {
    const serverCalls = setupApplyBehavior({ response: { ok: false, json: async () => ({ success: false, message: 'Ασφαλές μήνυμα server.' }) } });
    const serverButton = { disabled: false };
    await sandbox.submitRepoTransferApply(applyGroup(), '507f191e810c19729de860ec', serverButton);
    assert.strictEqual(serverCalls.post, 1);
    assert.strictEqual(serverCalls.refresh, 0);
    assert.ok(serverCalls.swal.some((call) => call.title === 'Δεν εφαρμόστηκε η πρόταση' && call.text === 'Ασφαλές μήνυμα server.'));
    assert.strictEqual(serverButton.disabled, false);

    const networkCalls = setupApplyBehavior({ networkError: true });
    const networkButton = { disabled: false };
    await sandbox.submitRepoTransferApply(applyGroup(), '507f191e810c19729de860ed', networkButton);
    assert.strictEqual(networkCalls.post, 1);
    assert.strictEqual(networkCalls.refresh, 0);
    assert.ok(networkCalls.swal.some((call) => call.title === 'Δεν εφαρμόστηκε η πρόταση' && call.text.includes('Δεν είναι βέβαιο αν η αποστολή ολοκληρώθηκε.')));
    assert.ok(!networkCalls.swal.some((call) => String(call.text || '').includes('private network detail')));
}

async function testApplyDoubleClickUsesOnePost() {
    const calls = setupApplyBehavior();
    const button = { disabled: false };
    const first = sandbox.submitRepoTransferApply(applyGroup(), '507f191e810c19729de860ee', button);
    const second = sandbox.submitRepoTransferApply(applyGroup(), '507f191e810c19729de860ee', button);
    await Promise.all([first, second]);
    assert.strictEqual(calls.post, 1);
    assert.strictEqual(calls.refresh, 1);
    assert.strictEqual(button.disabled, true);
}

async function testApplyRetryKeepsRequestIdAfterNetworkUncertainty() {
    const calls = setupApplyBehavior({ networkError: true });
    const decisionId = '507f191e810c19729de860ef';
    const button = { disabled: false };
    await sandbox.submitRepoTransferApply(applyGroup(), decisionId, button);
    assert.strictEqual(calls.requestIds.length, 1);
    sandbox.fetch = async (_url, options) => {
        calls.post++;
        calls.requestIds.push(JSON.parse(options.body).request_id);
        return { ok: true, json: async () => ({ success: true, message: 'ok' }) };
    };
    await sandbox.submitRepoTransferApply(applyGroup(), decisionId, button);
    assert.deepStrictEqual(calls.requestIds, [calls.requestIds[0], calls.requestIds[0]]);
}

function testEscaping() {
    const projection = readyProjection();
    projection.groups[0].title = '<script>alert(1)</script>';
    projection.groups[0].description = '<img src=x onerror=alert(1)>';
    projection.groups[0].items[0].employee_kodikos = '<b>001</b>';
    projection.groups[0].items[0].proposed_values.apo_ora_01_apologistika = '<svg>';
    const html = render(projection);

    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<img src=x'));
    assert.ok(!html.includes('<b>001</b>'));
    assert.ok(!html.includes('<svg>'));
    assert.ok(!html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('&lt;img'));
    assertContains(html, ['&lt;b&gt;001&lt;/b&gt;', '&lt;svg&gt;']);
}

function testDiagnostics() {
    const projection = readyProjection();
    projection.reason_counts = {
        PARTIAL_WEEK_OUTSIDE_FILTER_RANGE: 8,
        NO_SOURCE_CANDIDATE: 7,
        REPO_DEFICIT_REMAINS: 6,
        INCOMPLETE_EMPLOYEE_WEEK: 5,
        ROTATIONAL_EMPLOYMENT_NOT_SUPPORTED: 4,
        NO_TARGET_CANDIDATE: 3,
        MULTIPLE_SOURCE_CANDIDATES: 1
    };
    projection.actionable_issue_groups = [
        ['INCOMPLETE_EMPLOYEE_WEEK', 5],
        ['ROTATIONAL_EMPLOYMENT_NOT_SUPPORTED', 4],
        ['MULTIPLE_SOURCE_CANDIDATES', 1]
    ].map(([issue_code, count]) => ({
        issue_code,
        category: 'ACTION_REQUIRED',
        count,
        employees_count: 1,
        cases: Array.from({ length: count }, (_, index) => ({
            team: 'team-a', company_kod: 'company-a', ypokatasthma: '0001',
            employee_kodikos: '001', week_start: `2026-07-${String(index + 1).padStart(2, '0')}`,
            week_end: `2026-07-${String(index + 7).padStart(2, '0')}`
        }))
    }));
    projection.warning_counts = { TARGET_ZERO_HOURS_WITH_CARD_INTERVALS: 1 };
    const html = render(projection);
    const visibleText = getVisibleText(html);

    assertContains(visibleText, [
        'Εκκρεμότητες που απαιτούν ενέργεια',
        '5 περιπτώσεις — Ελλιπή στοιχεία εβδομάδας εργαζομένου',
        '4 περιπτώσεις — Η περίπτωση εκ περιτροπής απασχόλησης χρειάζεται έλεγχο',
        '1 περίπτωση — Πολλαπλές πιθανές ημέρες εργασίας σε δηλωμένο ρεπό',
        'μηδενικές συνολικές ώρες αλλά περιέχει στοιχεία καρτών'
    ]);
    assert.ok(!html.includes('Δεν βρέθηκε ημέρα ρεπό κατά την οποία ο εργαζόμενος απασχολήθηκε.'));
    assert.ok(!html.includes('Το επιλεγμένο διάστημα κόβει ήδη ολοκληρωμένη εβδομάδα.'));
    assert.ok(!html.includes('Δεν βρέθηκε διαθέσιμη ημέρα για τη μεταφορά του ρεπό.'));

    assert.ok(!visibleText.includes('Διαγνωστικοί κωδικοί'));
    Object.keys(projection.reason_counts).forEach((code) => {
        assert.ok(!visibleText.includes(code), `Raw diagnostic code is visible: ${code}`);
    });
    assert.ok(!visibleText.includes('TARGET_ZERO_HOURS_WITH_CARD_INTERVALS'));

}

function testUnknownDiagnosticUsesSafeFallbackAndStableLabelOrdering() {
    const projection = readyProjection();
    projection.reason_counts = {
        FUTURE_PRIVATE_DIAGNOSTIC: 3,
        NO_TARGET_CANDIDATE: 3
    };
    projection.actionable_issue_groups = ['UNKNOWN_A', 'UNKNOWN_B'].map(
        (issue_code, index) => ({
            issue_code,
            category: 'ACTION_REQUIRED',
            count: 1,
            employees_count: 1,
            cases: [{ employee_kodikos: `00${index + 1}`, week_start: '2026-07-06', week_end: '2026-07-12' }]
        })
    );
    const visibleText = getVisibleText(render(projection));

    assert.ok(!visibleText.includes('FUTURE_PRIVATE_DIAGNOSTIC'));
    assert.strictEqual((visibleText.match(/1 περίπτωση — Απαιτείται περαιτέρω έλεγχος/g) || []).length, 2);
    assert.ok(!visibleText.includes('UNKNOWN_A'));
    assert.ok(!visibleText.includes('UNKNOWN_B'));
    assert.ok(!visibleText.includes('Δεν βρέθηκε διαθέσιμη ημέρα για τη μεταφορά του ρεπό.'));
}

function testPartialFamilyDiagnosticsHaveSpecificGreekLabels() {
    const reasonCodes = [
        'MULTIPLE_TARGET_CANDIDATES',
        'REPO_LIMIT_EXCEEDED',
        'TARGET_LOCKED',
        'TARGET_MANUAL_OVERRIDE',
        'TARGET_LEAVE_OR_SICKNESS',
        'TARGET_HOLIDAY',
        'SOURCE_LOCKED',
        'SOURCE_MANUAL_OVERRIDE',
        'SOURCE_LEAVE_OR_SICKNESS',
        'SOURCE_HOLIDAY',
        'SOURCE_INVALID_CARD_EVIDENCE',
        'SOURCE_ALREADY_PROCESSED',
        'TARGET_ALREADY_PROCESSED',
        'UNSUPPORTED_EMPLOYMENT_TYPE',
        'CROSS_WEEK_ROWS'
    ];
    const projection = readyProjection();
    projection.reason_counts = Object.fromEntries(
        reasonCodes.map((code, index) => [code, index + 1])
    );
    projection.actionable_issue_groups = reasonCodes.map((issue_code, index) => ({
        issue_code,
        category: 'ACTION_REQUIRED',
        count: index + 1,
        employees_count: 1,
        cases: Array.from({ length: index + 1 }, () => ({
            employee_kodikos: '001', week_start: '2026-07-06', week_end: '2026-07-12'
        }))
    }));
    const visibleText = getVisibleText(render(projection));
    reasonCodes.forEach((code) => assert.ok(!visibleText.includes(code)));
    assert.ok(!visibleText.includes('Άλλη περίπτωση που χρειάζεται έλεγχο.'));
    [
        'Πολλαπλές πιθανές ημέρες μεταφοράς ρεπό',
        'Η προτεινόμενη αλλαγή θα υπερέβαινε τον προβλεπόμενο αριθμό ημερών ανάπαυσης',
        'Η πιθανή ημέρα ρεπό είναι κλειδωμένη',
        'Ο τύπος απασχόλησης δεν αναγνωρίζεται',
        'Τα στοιχεία εκτείνονται σε περισσότερες από μία φυσικές εβδομάδες'
    ].forEach((label) => assert.ok(visibleText.includes(label), label));
}

function testEmptyProjection() {
    const projection = readyProjection();
    projection.groups = [];
    projection.summary.groups_count = 0;
    projection.summary.decision_units_count = 0;
    const html = render(projection);

    assert.strictEqual(html, '');
    assert.ok(!getVisibleText(html).includes('Χρειάζεται έλεγχο'));
    assert.ok(!getVisibleText(html).includes('Πρόταση προς έλεγχο από HR'));
}

function testRepoTransferStatusAndSafeMarkup() {
    const projection = readyProjection();
    projection.groups[0].warnings = ['TARGET_ZERO_HOURS_WITH_CARD_INTERVALS'];
    const html = render(projection);
    const visibleText = getVisibleText(html);

    assert.ok(visibleText.includes('Πρόταση προς έλεγχο από HR'));
    assert.ok(!visibleText.includes('Χρειάζεται έλεγχο'));
    assert.ok(!visibleText.includes('TARGET_ZERO_HOURS_WITH_CARD_INTERVALS'));
    assert.ok(!/\sstyle\s*=/i.test(html));
    assert.ok(!/\son[a-z]+\s*=/i.test(html));
    assert.ok(html.includes('atomic-repo-transfer-toggle'));
    assert.ok(html.includes('btn-outline-secondary'));
}

function testScopedSemanticButtonCss() {
    assert.ok(cssSource.includes('#policyPreviewGroupsContainer .btn.btn-primary'));
    assert.ok(cssSource.includes('--policy-preview-button-bg: #cfe2ff;'));
    assert.ok(cssSource.includes('--policy-preview-button-hover-bg: #0d6efd;'));
    assert.ok(cssSource.includes('--policy-preview-button-bg: #d1e7dd;'));
    assert.ok(cssSource.includes('--policy-preview-button-hover-bg: #198754;'));
    assert.ok(cssSource.includes('--policy-preview-button-bg: #fff3cd;'));
    assert.ok(cssSource.includes('--policy-preview-button-hover-bg: #ffc107;'));
    assert.ok(cssSource.includes('--policy-preview-button-bg: #f8d7da;'));
    assert.ok(cssSource.includes('--policy-preview-button-hover-bg: #dc3545;'));
    assert.ok(cssSource.includes('--policy-preview-button-bg: #e2e3e5;'));
    assert.ok(cssSource.includes('--policy-preview-button-hover-bg: #6c757d;'));
    assert.ok(cssSource.includes('color: #ffffff !important;'));
    assert.ok(cssSource.includes('#policyPreviewGroupsContainer .btn:focus-visible'));
    assert.ok(cssSource.includes('#policyPreviewGroupsContainer .btn:disabled'));
    assert.ok(cssSource.includes('cursor: not-allowed;'));
    assert.ok(!cssSource.includes('style="'));
}

function testEmployeeWeekEvaluationLabel() {
    const html = render(readyProjection());
    assert.ok(!html.includes('Εβδομάδες εργαζομένων που αξιολογήθηκαν'));
    assert.ok(!html.includes('Εβδομάδες που ελέγχθηκαν'));
}

function testProposalDateRangeWording() {
    const html = render(readyProjection());

    assert.ok(html.includes('Ημερομηνίες πρότασης:'));
    assert.ok(!html.includes('Εβδομάδα:'));
}

function testGenericIsolationSourceContract() {
    const atomicStart = source.indexOf('function renderAtomicRepoTransferSummary');
    const genericStart = source.indexOf('function renderPolicyPreviewGroups');
    const atomicSource = source.slice(atomicStart, genericStart);
    const genericSource = source.slice(genericStart, source.indexOf('async function loadResults'));

    assert.ok(atomicStart >= 0 && genericStart > atomicStart);
    assert.ok(atomicSource.includes(
        "submitPolicyPreviewDecision(group, 'APPROVE_PROPOSAL', {"
    ));
    assert.ok(atomicSource.includes('forceAtomicReuse: true'));
    assert.ok(!atomicSource.includes('renderPolicyPreviewApprovalPanel'));
    assert.ok(!atomicSource.includes('getPolicyPreviewDecisionButtons'));
    assert.ok(genericSource.includes('renderPolicyPreviewApprovalPanel(group, index)'));
    assert.ok(source.includes('atomicGroupProjection: payload.atomic_group_projection || null'));
    assert.ok(!source.includes('grouping.groups.push(payload.atomic_group_projection'));
}

function testAtomicStateSurvivesGenericRerenderAndClearsOnRequestState() {
    const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
    };
    const grouping = {
        version: 1,
        scope: 'page',
        summary: { total: 0, groups_count: 0, by_status: {} },
        groups: []
    };
    elementsById.set('policyPreviewGroupsContainer', container);

    sandbox.renderPolicyPreviewGroups(grouping, {
        atomicGroupProjection: readyProjection()
    });
    assert.ok(container.innerHTML.includes('Προτάσεις Μεταφοράς Ρεπό'));

    sandbox.renderPolicyPreviewGroups(grouping, { expandedGroupId: 'generic-group' });
    assert.ok(container.innerHTML.includes('Προτάσεις Μεταφοράς Ρεπό'));

    sandbox.renderPolicyPreviewGroups(null, { loading: true });
    sandbox.renderPolicyPreviewGroups(grouping);
    assert.ok(!container.innerHTML.includes('Προτάσεις Μεταφοράς Ρεπό'));

    sandbox.renderPolicyPreviewGroups(grouping, {
        atomicGroupProjection: readyProjection()
    });
    sandbox.renderPolicyPreviewGroups(null, { error: 'preview failed' });
    sandbox.renderPolicyPreviewGroups(grouping);
    assert.ok(!container.innerHTML.includes('Προτάσεις Μεταφοράς Ρεπό'));

    elementsById.delete('policyPreviewGroupsContainer');
}

function testPolicyDecisionAccordionIsCompactAndDecisionOnly() {
    const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
    };
    const item = {
        prodhlomena_oraria_id: 'row-1',
        employee_kodikos: '0006',
        hmeromhnia: '2026-06-06',
        kathgoria_ergasias: 'ΕΡΓ',
        kathgoria_ergasias_apologistika: '',
        cards_ores_ergasias: 7,
        proposed_values: {},
        flags: {}
    };
    const group = (status, id, count, title) => ({
        group_id: id,
        status,
        policy_code: 'UNKNOWN',
        scenario_code: 'UNKNOWN',
        action_type: 'UNKNOWN',
        reason_code: 'UNKNOWN',
        title,
        count,
        employees_count: 1,
        items: [item]
    });
    const grouping = {
        version: 1,
        scope: 'page',
        summary: { total: 22, groups_count: 3, by_status: {} },
        groups: [
            group('NEEDS_REVIEW', 'decision-group', 3, 'Απόφαση HR'),
            group('UNKNOWN_PATTERN', 'diagnostic-group', 17, 'Τεχνική εκκρεμότητα'),
            group('OK', 'ok-group', 2, 'Αυτόματα OK')
        ]
    };
    elementsById.set('policyPreviewGroupsContainer', container);
    elementsById.set('canManageReusablePolicyApproval', { value: '1' });

    sandbox.renderPolicyPreviewGroups(grouping);

    assert.ok(container.innerHTML.includes('employment-review-pending-summary'));
    assert.ok(!container.innerHTML.includes('17 τεχνικές εκκρεμότητες'));
    assert.ok(!container.innerHTML.includes('2 ολοκληρώθηκαν αυτόματα'));
    assert.ok(!container.innerHTML.includes('Τεχνικές εκκρεμότητες πολιτικής'));
    assert.ok(!container.innerHTML.includes('Αυτόματα OK'));
    assert.strictEqual((container.innerHTML.match(/Απόφαση ελέγχου/g) || []).length, 1);
    assert.ok(container.innerHTML.includes('Καταγραφή ως ελεγμένο'));
    assert.ok(container.innerHTML.includes('Χρειάζεται περαιτέρω έλεγχο'));
    assert.ok(!container.innerHTML.includes('Έγκριση πρότασης για μελλοντική εφαρμογή'));
    assert.ok(!container.innerHTML.includes('Απόρριψη πρότασης'));
    assert.ok(!container.innerHTML.includes('Ιστορικό Αποφάσεων Ελέγχου'));
    assert.ok(!container.innerHTML.includes('Προεπισκόπηση Εφαρμογής'));
    assert.strictEqual(sandbox.isScenarioReviewRow({
        policyResult: { result_status: 'OK' },
        scenarioDecision: { requires_review: true }
    }), false);
    assert.strictEqual(sandbox.isScenarioReviewRow({
        policyResult: { result_status: 'UNKNOWN_PATTERN' },
        scenarioDecision: { requires_review: true }
    }), false);
    assert.strictEqual(sandbox.isScenarioReviewRow({
        policyResult: { result_status: 'NEEDS_REVIEW' }
    }), true);
    assert.deepStrictEqual(
        Array.from(
            sandbox.getPolicyPreviewDecisionButtons({
                status: 'PREFILLED_PENDING_APPROVAL',
                items: [{ proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' } }]
            }),
            (button) => button.type
        ),
        ['NEEDS_MORE_REVIEW', 'REJECT_PROPOSAL', 'APPROVE_PREFILL']
    );

    elementsById.delete('policyPreviewGroupsContainer');
    elementsById.delete('canManageReusablePolicyApproval');
}

async function testResolvedInheritedGroupOffersOnlySharedPolicyRevoke() {
    const approvalId = '6a743bc11cc18bdde16f3dcd';
    let revokeClickHandler = null;
    let revokedApprovalId = null;
    const revokeButton = {
        dataset: { approvalId },
        addEventListener(eventName, handler) {
            if (eventName === 'click') revokeClickHandler = handler;
        }
    };
    const container = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll(selector) {
            return selector === '.policy-preview-revoke-btn' ? [revokeButton] : [];
        }
    };
    const resolvedGroup = {
        group_id: 'resolved-inherited-group',
        status: 'RESOLVED_BY_POLICY',
        policy_code: 'DECLARED_REPO_OR_NON_WORK_WITH_CARDS',
        scenario_code: 'DECLARED_REPO_WITH_CARDS',
        action_type: 'SUGGESTION',
        reason_code: 'DECLARED_REPO_WITH_CARDS',
        title: 'Ρεπό, μη εργασία ή μη προδηλωμένη ημέρα με κάρτες',
        count: 15,
        employees_count: 6,
        reusable_decision: {
            approval_id: approvalId,
            approved_by_user_name: 'HR',
            approved_at: '2026-08-06T07:46:09.390Z'
        },
        items: []
    };
    const grouping = {
        version: 1,
        scope: 'page',
        summary: { total: 15, groups_count: 1, by_status: { RESOLVED_BY_POLICY: 15 } },
        groups: [resolvedGroup]
    };
    const saved = snapshotSandboxFunctions(['revokePolicyPreviewApproval']);
    elementsById.set('policyPreviewGroupsContainer', container);

    try {
        for (const role of ['A', 'S', 'HR']) {
            elementsById.set('canManageReusablePolicyApproval', { value: '1', role });
            sandbox.renderPolicyPreviewGroups(grouping);
            assert.ok(container.innerHTML.includes('Εγκρίνεται βάσει παλιότερης απόφασης HR'));
            assert.ok(container.innerHTML.includes('Ανάκληση πολιτικής'), role);
            assert.ok(container.innerHTML.includes(`data-approval-id="${approvalId}"`), role);
            assert.ok(!container.innerHTML.includes('policy-preview-decision-btn'), role);
            assert.ok(!container.innerHTML.includes('Έγκριση πρότασης για μελλοντική εφαρμογή'), role);
            assert.ok(!container.innerHTML.includes('Απόρριψη πρότασης'), role);
            assert.ok(!container.innerHTML.includes('Χρειάζεται περαιτέρω έλεγχο'), role);
        }

        sandbox.revokePolicyPreviewApproval = async (id) => { revokedApprovalId = id; };
        assert.ok(revokeClickHandler);
        await revokeClickHandler();
        assert.strictEqual(revokedApprovalId, approvalId);

        elementsById.set('canManageReusablePolicyApproval', { value: '0' });
        sandbox.renderPolicyPreviewGroups(grouping);
        assert.ok(!container.innerHTML.includes('Ανάκληση πολιτικής'));

        for (const reusableDecision of [null, { approved_by_user_name: 'HR' }]) {
            elementsById.set('canManageReusablePolicyApproval', { value: '1' });
            sandbox.renderPolicyPreviewGroups({
                ...grouping,
                groups: [{ ...resolvedGroup, reusable_decision: reusableDecision }]
            });
            assert.ok(!container.innerHTML.includes('Ανάκληση πολιτικής'));
        }

        const revokeSource = source.slice(
            source.indexOf('async function revokePolicyPreviewApproval'),
            source.indexOf('async function confirmPolicyPreviewDecision')
        );
        assert.ok(revokeSource.includes('Υποχρεωτική αιτιολογία'));
        assert.ok(revokeSource.includes('refreshPolicyPreviewApprovals(currentPolicyPreviewBaseParams)'));
        assert.ok(revokeSource.includes('fetchPolicyPreviewGrouping(currentPolicyPreviewBaseParams)'));
    } finally {
        restoreSandboxFunctions(saved);
        elementsById.delete('policyPreviewGroupsContainer');
        elementsById.delete('canManageReusablePolicyApproval');
    }
}

function testRevokedReusableHistoryDoesNotBlockNewApproval() {
    const groupId = 'policy-preview-group-e00c43d2f21c212a';
    const revoked = {
        _id: '6a743bc11cc18bdde16f3dcd',
        group_id: groupId,
        decision_type: 'APPROVE_PREFILL',
        decision_status: 'RECORDED',
        reuse_scope: 'FUTURE_IDENTICAL',
        reuse_status: 'REVOKED',
        created_at: '2026-08-06T07:46:09.390Z'
    };
    const oneTimeReject = {
        _id: 'one-time-reject',
        group_id: groupId,
        decision_type: 'REJECT_PROPOSAL',
        decision_status: 'RECORDED',
        reuse_scope: 'ONE_TIME',
        reuse_status: 'NOT_APPLICABLE',
        created_at: '2026-08-06T08:00:00.000Z'
    };
    const state = sandbox.buildPolicyPreviewApprovalsMap([revoked, oneTimeReject]).get(groupId);

    assert.strictEqual(state.count, 2);
    assert.strictEqual(state.historyDecisionTypes.has('APPROVE_PREFILL'), true);
    assert.strictEqual(state.historyDecisionTypes.has('REJECT_PROPOSAL'), true);
    assert.strictEqual(state.blockingDecisionTypes.has('APPROVE_PREFILL'), false);
    assert.strictEqual(state.blockingDecisionTypes.has('REJECT_PROPOSAL'), true);
    assert.strictEqual(state.latest._id, oneTimeReject._id);

    const activeState = sandbox.buildPolicyPreviewApprovalsMap([{
        ...revoked,
        _id: 'active-reusable',
        reuse_status: 'ACTIVE'
    }]).get(groupId);
    assert.strictEqual(activeState.count, 1);
    assert.strictEqual(activeState.historyDecisionTypes.has('APPROVE_PREFILL'), true);
    assert.strictEqual(activeState.blockingDecisionTypes.has('APPROVE_PREFILL'), true);

    elementsById.set('canManageReusablePolicyApproval', { value: '1' });
    try {
        vm.runInContext('currentPolicyPreviewApprovalsByGroupId = new Map()', sandbox);
        sandbox.currentPolicyPreviewApprovalsByGroupId = new Map([[groupId, state]]);
        vm.runInContext(
            `currentPolicyPreviewApprovalsByGroupId = buildPolicyPreviewApprovalsMap(${JSON.stringify([
                revoked,
                oneTimeReject
            ])})`,
            sandbox
        );
        const html = sandbox.renderPolicyPreviewApprovalPanel({
            group_id: groupId,
            status: 'PREFILLED_PENDING_APPROVAL',
            items: [{ proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' } }]
        });
        assert.ok(html.includes('Καταγεγραμμένες αποφάσεις:</span>\n                2'));
        assert.ok(!/data-decision-type="APPROVE_PREFILL"[^>]*disabled/.test(html));
        assert.ok(/data-decision-type="REJECT_PROPOSAL"[^>]*disabled/.test(html));
        assert.ok(!/data-decision-type="NEEDS_MORE_REVIEW"[^>]*disabled/.test(html));

        vm.runInContext(
            `currentPolicyPreviewApprovalsByGroupId = buildPolicyPreviewApprovalsMap(${JSON.stringify([{
                ...revoked,
                _id: 'active-reusable',
                reuse_status: 'ACTIVE'
            }])})`,
            sandbox
        );
        const activeHtml = sandbox.renderPolicyPreviewApprovalPanel({
            group_id: groupId,
            status: 'PREFILLED_PENDING_APPROVAL',
            items: [{ proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' } }]
        });
        assert.ok(/data-decision-type="APPROVE_PREFILL"[^>]*disabled/.test(activeHtml));

        vm.runInContext(
            `currentPolicyPreviewApprovalRecords = ${JSON.stringify([revoked])}; ` +
                'currentPolicyPreviewApprovalsByGroupId = buildPolicyPreviewApprovalsMap(currentPolicyPreviewApprovalRecords)',
            sandbox
        );
        assert.strictEqual(
            vm.runInContext('currentPolicyPreviewApprovalRecords.length', sandbox),
            1
        );
        assert.strictEqual(
            vm.runInContext('currentPolicyPreviewApprovalRecords[0].reuse_status', sandbox),
            'REVOKED'
        );
    } finally {
        elementsById.delete('canManageReusablePolicyApproval');
        vm.runInContext('currentPolicyPreviewApprovalsByGroupId = new Map()', sandbox);
    }
}

function minimalElement(overrides = {}) {
    const classes = new Set(String(overrides.className || '').split(/\s+/).filter(Boolean));
    return {
        value: '',
        innerHTML: '',
        textContent: '',
        disabled: false,
        dataset: {},
        className: overrides.className || '',
        classList: {
            add: (...values) => values.forEach((value) => classes.add(value)),
            remove: (...values) => values.forEach((value) => classes.delete(value)),
            toggle: (value, force) => {
                if (force === true) classes.add(value);
                else if (force === false) classes.delete(value);
                else if (classes.has(value)) classes.delete(value);
                else classes.add(value);
            },
            contains: (value) => classes.has(value)
        },
        querySelectorAll: () => [],
        addEventListener: () => {},
        ...overrides
    };
}

function setMinimalRenderElements() {
    const ids = [
        'hrReviewStatus',
        'hrReviewProgress',
        'hrReviewPendingContainer',
        'hrReviewCompletedContainer'
    ];
    ids.forEach((id) => elementsById.set(id, minimalElement()));
}

function clearMinimalRenderElements() {
    [
        'hrReviewStatus',
        'hrReviewProgress',
        'hrReviewPendingContainer',
        'hrReviewCompletedContainer'
    ].forEach((id) => elementsById.delete(id));
}

function renderViewForRole(userRole) {
    return ejs.render(viewSource, {
        userRole,
        csrfToken: 'csrf-test',
        companyId: 'company-test',
        periodRec: { apo: '2026-07-01', eos: '2026-07-31' },
        dateInputValue: (value) => value,
        script: (value) => `/scripts/${value}`
    }, { filename: viewPath });
}

function duplicateIds(html) {
    const ids = [...String(html).matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
}

function decisionReadyProjection() {
    const projection = readyProjection();
    const group = projection.groups[0];
    group.pair_contract = {
        proposal_version: 'repo-transfer-single-pair-proposal:v1',
        choice_code: 'TRANSFER_REPO_WITHIN_WEEK_SINGLE_PAIR'
    };
    group.items[0].prodhlomena_oraria_id = '507f191e810c19729de860ea';
    group.items[1].prodhlomena_oraria_id = '507f191e810c19729de860eb';
    return projection;
}

function setHrDecisionState(projection = decisionReadyProjection()) {
    vm.runInContext(`
        currentEmploymentPeriodControl = {
            effective_mode: 'NORMAL', calculation: { authoritative_result: true },
            allowed_actions: { record_decision: true, repo_transfer: true }
        };
        currentHrReviewProjection = ${JSON.stringify(projection)};
        currentAtomicRepoTransferProjection = currentHrReviewProjection;
        currentHrReviewLoaded = true;
        currentPolicyPreviewBaseParams = new URLSearchParams('apo_hmeromhnia=2026-07-06&eos_hmeromhnia=2026-07-12&ypokatasthma=0000');
        currentRepoTransferDecisionsByProposalId = new Map();
        repoTransferDecisionSubmitting.clear();
    `, sandbox);
    sandbox.classifyHrReviewGroups();
    return projection.groups[0];
}

function snapshotSandboxFunctions(names) {
    return new Map(names.map((name) => [name, sandbox[name]]));
}

function restoreSandboxFunctions(snapshot) {
    snapshot.forEach((value, name) => {
        sandbox[name] = value;
    });
}

function testMinimalWorkspaceEjsContract() {
    assert.ok(viewSource.includes("const canUseAdvancedEmploymentReview = ['A', 'S', 'HR'].includes(normalizedUserRole)"));
    assert.ok(viewSource.includes('id="canUseAdvancedEmploymentReview"'));
    assert.ok(viewSource.includes('id="hrReviewWorkspace"'));
    assert.ok(viewSource.includes('<% if (canUseAdvancedEmploymentReview) { %>'));
    assert.ok(viewSource.includes('id="advancedReviewWorkspace" class="d-none"'));
    assert.ok(!viewSource.includes('id="userRole"'));
    assert.ok(!viewSource.includes('id="normalizedUserRole"'));
    assertContains(viewSource, [
        'id="ypokatasthmata"',
        'id="ypokatasthmata_stathera"',
        '/api/dropdown/erganh/ypokatasthmata?company=',
        'initYpokatasthmataDropdowns.js',
        'id="hrReviewStartBtn"'
    ]);
}

function testEmploymentReviewScrollContainerContract() {
    assert.ok(viewSource.includes('employment-review-scroll-container'));
    assert.ok(viewSource.includes('id="hrReviewWorkspace"'));
    assert.ok(viewSource.includes('id="advancedReviewWorkspace"'));
    assert.ok(!/style=["'][^"']*overflow-y\s*:\s*auto/i.test(viewSource));

    const selectorStart = cssSource.indexOf('.employment-review-scroll-container {');
    assert.ok(selectorStart >= 0);
    const selectorEnd = cssSource.indexOf('}', selectorStart);
    const scrollCss = cssSource.slice(selectorStart, selectorEnd);
    assert.ok(/overflow\s*:\s*auto\s*;/.test(scrollCss));
    assert.ok(!/overflow-x\s*:\s*hidden\s*;/.test(scrollCss));
    assert.ok(/max-height\s*:[^;]*(?:100vh|100dvh)/.test(scrollCss));
    assert.ok(/--employment-review-table-sticky-top\s*:\s*0px/.test(scrollCss));

    const wrapperSelector =
        '.employment-review-scroll-container .results-table-wrapper {';
    const wrapperStart = cssSource.indexOf(wrapperSelector);
    const wrapperCss = cssSource.slice(
        wrapperStart,
        cssSource.indexOf('}', wrapperStart)
    );
    assert.ok(/overflow\s*:\s*visible/.test(wrapperCss));

    const stickySelector =
        '.employment-review-scroll-container #resultsTable thead th {';
    const stickyStart = cssSource.indexOf(stickySelector);
    const stickyCss = cssSource.slice(
        stickyStart,
        cssSource.indexOf('}', stickyStart)
    );
    assert.ok(/position\s*:\s*sticky/.test(stickyCss));
    assert.ok(/top\s*:\s*var\(--employment-review-table-sticky-top\)/.test(stickyCss));
    assert.ok(/z-index\s*:\s*15/.test(stickyCss));
    assert.ok(/background-color\s*:\s*#212529/.test(stickyCss));
    assert.ok(/border-color\s*:\s*#495057/.test(stickyCss));
    assert.ok(/background-clip\s*:\s*padding-box/.test(stickyCss));
    assert.ok(cssSource.includes(
        '.employment-review-scroll-container #resultsTable {\n' +
        '    width: max(100%, 89.25rem);\n' +
        '    min-width: 89.25rem;\n' +
        '    table-layout: fixed;'
    ));
    assert.ok(!cssSource.includes(
        '.employment-review-scroll-container #resultsTable th,\n' +
        '.employment-review-scroll-container #resultsTable td {\n' +
        '    overflow-wrap: anywhere;'
    ));
    const colgroupMarkup = viewSource.match(
        /<colgroup class="employment-review-results-columns">[\s\S]*?<\/colgroup>/
    )?.[0] || '';
    assert.strictEqual((colgroupMarkup.match(/<col\b/g) || []).length, 13);
    assert.ok(colgroupMarkup.includes('review-col-apologistiko'));
    assert.ok(cssSource.includes(
        '.employment-review-results-columns .review-col-apologistiko {\n    width: 13rem;'
    ));
    assert.ok(cssSource.includes(
        '.employment-review-results-columns .review-col-date {\n    width: 9rem;'
    ));
    assert.ok(cssSource.includes(
        '.employment-review-scroll-container #resultsTable > thead > tr > th {\n' +
        '    white-space: nowrap;\n' +
        '    overflow-wrap: normal;\n' +
        '    word-break: normal;'
    ));
    assert.ok(cssSource.includes(
        '.employment-review-scroll-container #resultsTable .review-interval-line {\n' +
        '    white-space: nowrap;'
    ));
    assert.ok(cssSource.includes(
        '.employment-review-scroll-container #resultsTable th:nth-child(6),'
    ));
    assert.ok(cssSource.includes(
        '.employment-review-scroll-container #resultsTable td:nth-child(6) {\n' +
        '    overflow: hidden;'
    ));
    assert.ok(source.includes('max-width: 100%;'));
    assert.ok(source.includes('white-space: normal;'));
    assert.ok(source.includes('overflow-wrap: break-word;'));
    assert.ok(source.includes('word-break: normal;'));
    assert.ok(source.includes('text-align: center;'));

    const cssDiff = execFileSync('git', ['diff', '--unified=0', '--', cssPath], {
        encoding: 'utf8'
    });
    const addedCss = cssDiff
        .split('\n')
        .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
        .map((line) => line.slice(1))
        .join('\n');
    assert.ok(!/(?:^|\n)\s*(?:body|html)\b[^{}]*\{[^}]*overflow\s*:/im.test(addedCss));
}

function testAllKnownBackendGroupingCodesHaveGreekLabels() {
    const known = [
        [Object.values(POLICY_RESULT_STATUS), sandbox.getPolicyPreviewStatusLabel],
        [getApasxoliseisPolicyCatalog().map((policy) => policy.policy_code), sandbox.getPolicyPreviewPolicyLabel],
        [Object.values(SCENARIO_CODES), sandbox.getPolicyPreviewScenarioLabel],
        [Object.values(POLICY_MODE), sandbox.getPolicyPreviewActionLabel],
        [
            [...Object.values(REASON_CODES), 'EMPLOYEE_CARD_NOT_REQUIRED', 'NO_APOLOGISTIKO_REVIEW_REQUIRED'],
            sandbox.getPolicyPreviewReasonLabel
        ]
    ];
    known.forEach(([codes, resolver]) => {
        codes.forEach((code) => {
            const resolved = resolver(code);
            const label = typeof resolved === 'string' ? resolved : resolved.label;
            assert.ok(label);
            assert.ok(!label.includes('Άγνωστο μοτίβ'));
            assert.ok(!label.includes('Μη χαρτογραφημένο αποτέλεσμα'), `${code} is not mapped`);
        });
    });

    const unmapped = sandbox.getPolicyPreviewPolicyLabel('CUSTOM_<script>_CODE');
    assert.strictEqual(unmapped, 'Απαιτείται έλεγχος της περίπτωσης.');
    assert.ok(!unmapped.includes('<'));
}

function testCategoryPresentationKeepsDeclaredDisplayedAndProposedDistinct() {
    const item = {
        employee_kodikos: '0001',
        hmeromhnia: '2026-06-26',
        kathgoria_ergasias: 'ΕΡΓ',
        current_kathgoria_ergasias_apologistika: 'ΑΔΕΙΑ',
        proposed_values: {
            kathgoria_ergasias_apologistika: 'ΑΝ',
            repo_apologistika: true
        }
    };
    const detailed = sandbox.renderAtomicRepoTransferItem(item, 'TARGET_BECOMES_REPO');
    assertContains(detailed, [
        'Προδηλωμένη κατηγορία',
        'Απολογιστική/εμφανιζόμενη κατηγορία',
        'Προτεινόμενη κατηγορία',
        'ΕΡΓ',
        'ΑΔΕΙΑ',
        'ΑΝ'
    ]);
    assert.ok(
        detailed.indexOf('ΕΡΓ') <
            detailed.indexOf('ΑΔΕΙΑ') &&
            detailed.indexOf('ΑΔΕΙΑ') <
                detailed.lastIndexOf('ΑΝ')
    );

    const compact = sandbox.renderHrReviewDay(item, 'rest');
    assertContains(compact, [
        'Προδηλωμένη',
        'Απολογιστική',
        'Πρόταση μεταφοράς',
        'ΕΡΓ',
        'ΑΔΕΙΑ',
        'ΑΝ'
    ]);
}

function testOpenAndCompletedPartialWeekMessagesStayDistinct() {
    vm.runInContext(
        "currentPolicyPreviewBaseParams = new URLSearchParams('apo_hmeromhnia=2026-06-01&eos_hmeromhnia=2026-06-30')",
        sandbox
    );
    assert.strictEqual(
        sandbox.getAtomicRepoTransferDiagnosticLabel('OPEN_WEEK_PENDING_COMPLETION'),
        'Η εβδομάδα 29/06/2026–05/07/2026 δεν έχει ακόμη ολοκληρωθεί και θα επανελεγχθεί μετά την Κυριακή.'
    );
    assert.strictEqual(
        sandbox.getAtomicRepoTransferDiagnosticLabel('PARTIAL_WEEK_OUTSIDE_FILTER_RANGE'),
        'Το επιλεγμένο διάστημα κόβει ήδη ολοκληρωμένη εβδομάδα.'
    );
    const pendingHtml = sandbox.renderActionableIssueGroups([{
        issue_code: 'OPEN_WEEK_PENDING_COMPLETION',
        count: 1,
        cases: [{ employee_kodikos: '001', week_start: '2026-06-29', week_end: '2026-07-05' }]
    }]);
    assert.strictEqual(pendingHtml, '');
}

function testWeeklyDeviationPresentationUsesMondaySundayPolicy() {
    assert.ok(source.includes('Εβδομάδα Δευτέρα–Κυριακή'));
    assert.ok(source.includes("data-week-policy=\"${dev.is_legacy_policy === true ? 'LEGACY' : 'MONDAY_SUNDAY'}\""));
    assert.ok(source.includes('Ιστορική εγγραφή παλιάς πολιτικής'));
    assert.ok(source.includes("dev.status === 'OPEN_WEEK_PENDING_COMPLETION'"));
    assert.ok(source.includes('currentPendingDeviationWeeks = payload.pendingDeviationWeeks || []'));
    assert.ok(source.includes('currentLegacyDeviations = payload.legacyDeviations || []'));
    assert.ok(!source.includes('Υπερισχύουν οι όροι εργασίας που ίσχυαν το Σάββατο'));
}

function testEmploymentReviewFinalUiContract() {
    assert.ok(viewSource.includes('data-dropdown-direction="down"'));
    const repositionStart = dropdownHelperSource.indexOf('const reposition = () => {');
    const repositionEnd = dropdownHelperSource.indexOf('requestAnimationFrame(reposition)', repositionStart);
    const repositionSource = dropdownHelperSource.slice(repositionStart, repositionEnd);
    assert.ok(repositionSource.includes("el.dataset.dropdownDirection || 'auto'"));
    assert.ok(repositionSource.includes("['auto', 'up', 'down'].includes("));
    assert.ok(repositionSource.includes("forcedDirection === 'down'"));
    assert.ok(repositionSource.includes("ddEl.classList.add('place-below', 'maxh-ideal')"));
    assert.ok(repositionSource.includes("ddEl.classList.add('place-below', 'maxh-limited')"));
    const forcedDownSource = repositionSource.slice(
        repositionSource.indexOf("if (forcedDirection === 'down')"),
        repositionSource.indexOf("} else if (forcedDirection === 'up')")
    );
    assert.ok(!forcedDownSource.includes('place-above'));
    assert.ok(repositionSource.includes('else if (idealHeight <= spaceBelow)'));
    assert.ok(repositionSource.includes("ddEl.classList.add('place-above', 'maxh-ideal')"));
    assert.ok(!/new TomSelect\([\s\S]*?dropdownDirection\s*[:,]/.test(dropdownHelperSource));

    const outerCards = viewSource.match(/class="card[^"]*employment-review-card[^"]*z-depth-5[^"]*"/g) || [];
    assert.strictEqual(outerCards.length, 2);
    assert.ok(viewSource.includes('container-fluid mt-3 employment-review-page-shell'));
    assert.ok(!/id="hrReviewWorkspace"[^>]*employment-review-page-shell/.test(viewSource));
    assert.ok(!/employment-review-page-shell[^"']*\bw-70\b|\bw-70\b[^"']*employment-review-page-shell/.test(viewSource));
    assert.ok(cssSource.includes('width: 100% !important'));
    assert.ok(cssSource.includes('max-width: 100%'));
    assert.ok(cssSource.includes('min-width: 0'));
    assert.ok(!/\.employment-review-card\s*\{[^}]*?(?:width|margin-(?:left|right)|--employment-review-(?:width|right))/s.test(cssSource));
    assert.ok(/@media \(max-width: 991\.98px\)[\s\S]*?\.employment-review-page-shell[\s\S]*?width:\s*100%[\s\S]*?margin-left:\s*0[\s\S]*?margin-right:\s*0/.test(cssSource));
    const shellCssStart = cssSource.indexOf('.employment-review-page-shell {');
    const shellCss = cssSource.slice(shellCssStart, cssSource.indexOf('}', shellCssStart));
    assert.ok(!/(?:transform|translate)\s*[:(]/.test(shellCss));
    assert.ok(!/#hrReviewStartBtn\s*\{[^}]*(?:transform|translate|position|margin)/s.test(cssSource));
    assert.ok(cssSource.includes('--employment-review-bottom-clearance: 3.25rem'));
    assert.ok(cssSource.includes('--employment-review-viewport-offset: 20.25rem'));
    assert.ok(cssSource.includes('--employment-review-viewport-offset: 28.75rem'));
    assert.ok(20.25 - 17 >= 3);
    assert.ok(28.75 - 25.5 >= 3);
    assert.ok(/\.employment-review-card\s*\{[^}]*overflow:\s*visible/.test(cssSource));
    assert.ok(/\.employment-review-page-shell\s*\{[^}]*padding-bottom:\s*0\.5rem/.test(cssSource));
    assert.ok(cssSource.includes('overflow-y: auto'));

    ['hrReviewStartBtn', 'showAdvancedReviewBtn', 'showMinimalReviewBtn'].forEach((id) => {
        assert.ok(new RegExp(`class="[^"]*employment-review-action-btn[^"]*" id="${id}"`).test(viewSource));
    });
    assert.ok(!/id="(?:showAdvancedReviewBtn|showMinimalReviewBtn)"[^>]*btn-outline-|class="[^"]*btn-outline-[^"]*" id="(?:showAdvancedReviewBtn|showMinimalReviewBtn)"/.test(viewSource));
    assert.ok(source.includes('hr-review-decision-btn employment-review-action-btn employment-review-action-success'));
    assert.ok(source.includes('hr-review-decision-btn employment-review-action-btn employment-review-action-danger'));
    assert.ok(source.includes('hr-review-decision-btn employment-review-action-btn employment-review-action-warning'));

    ['secondary', 'success', 'danger', 'warning'].forEach((variant) => {
        const start = cssSource.indexOf(`.employment-review-action-${variant} {`);
        assert.ok(start >= 0);
        const block = cssSource.slice(start, cssSource.indexOf('}', start));
        assert.ok(/background\s*:\s*(?!transparent)/.test(block));
    });

    const cssDiff = execFileSync('git', ['diff', '--unified=0', '--', cssPath], { encoding: 'utf8' });
    const addedSelectors = cssDiff
        .split('\n')
        .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
        .map((line) => line.slice(1))
        .filter((line) => line.includes('{'));
    assert.ok(!addedSelectors.some((line) => /^\s*\.btn(?:\b|[-.:#])/.test(line)));
    assert.ok(!addedSelectors.some((line) => /^\s*\.btn-outline-/.test(line)));

    assert.ok(viewSource.includes('id="hrReviewWorkspace"'));
    assert.ok(viewSource.includes('id="advancedReviewWorkspace"'));
    assert.ok(viewSource.includes('id="canUseAdvancedEmploymentReview"'));
    assert.ok(viewSource.includes('meta name="csrf-token"'));
    assert.ok(source.includes('body: JSON.stringify({ proposal_id: group.group_id'));
    assert.ok(!viewSource.includes('id="currentUserRole"'));
}

function testSharedLifecyclePanelAndActiveWorkspaceScopeContract() {
    const lifecycleIds = [
        'employmentPeriodControlPanel',
        'lockEmploymentPeriodBtn',
        'historicalReconstructionBtn',
        'unlockEmploymentPeriodBtn',
        'finalizeEmploymentPeriodBtn',
        'submitFinalWTODayilyABtn',
        'openCorrectivePayrollBtn',
        'calculateCorrectivePayrollBtn',
        'closeCorrectivePayrollBtn',
        'postCorrectivePayrollBtn'
    ];
    lifecycleIds.forEach((id) => {
        assert.strictEqual((viewSource.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
    });
    const panelIndex = viewSource.indexOf('id="employmentPeriodControlPanel"');
    const simpleIndex = viewSource.indexOf('id="hrReviewWorkspace"');
    const advancedIndex = viewSource.indexOf('id="advancedReviewWorkspace"');
    assert.ok(panelIndex >= 0 && panelIndex < simpleIndex && panelIndex < advancedIndex);
    assert.ok(source.includes('await loadEmploymentPeriodControl(advancedBranch)'));
    assert.ok(source.includes("HISTORICAL_RECONSTRUCTION_REQUIRED: 'ΕΚΠΡΟΘΕΣΜΗ — ΧΩΡΙΣ ΟΡΙΣΤΙΚΟΠΟΙΗΜΕΝΟ BASELINE'"));
    assert.ok(source.includes("state?.past_deadline ? 'ΕΚΠΡΟΘΕΣΜΗ' : 'ΕΝΤΟΣ ΠΡΟΘΕΣΜΙΑΣ'"));
    assert.ok(source.includes("actions.historical_reconstruct === true || actions.historical_reassess === true"));
    assert.ok(source.includes('body: JSON.stringify({ apo_hmeromhnia: scope.apo_hmeromhnia'));
    assert.ok(source.includes('eos_hmeromhnia: scope.eos_hmeromhnia'));
    assert.ok(source.includes("if (scope.workspace === 'ADVANCED') await loadResults();"));
    assert.ok(source.includes('else await loadHrReviewQueue();'));
    assert.ok(source.includes('const branch = getActiveEmploymentReviewScope().ypokatasthma'));
    assert.ok(source.includes('return getActiveEmploymentReviewScope().ypokatasthma'));

    const workspace = (hidden) => ({
        classList: { contains: (name) => name === 'd-none' && hidden }
    });
    const setValue = (id, value) => elementsById.set(id, { value });
    try {
        elementsById.set('advancedReviewWorkspace', workspace(false));
        elementsById.set('hrReviewWorkspace', workspace(true));
        setValue('apo_hmeromhnia', '2026-06-01');
        setValue('eos_hmeromhnia', '2026-06-30');
        setValue('ypokatasthma_stathera_advanced', '0000');
        setValue('hr_apo_hmeromhnia', '1999-01-01');
        setValue('hr_eos_hmeromhnia', '1999-01-31');
        setValue('ypokatasthmata_stathera', 'STALE');
        let scope = sandbox.getActiveEmploymentReviewScope();
        assert.strictEqual(scope.workspace, 'ADVANCED');
        assert.strictEqual(scope.apo_hmeromhnia, '2026-06-01');
        assert.strictEqual(scope.eos_hmeromhnia, '2026-06-30');
        assert.strictEqual(scope.ypokatasthma, '0000');

        elementsById.set('advancedReviewWorkspace', workspace(true));
        elementsById.set('hrReviewWorkspace', workspace(false));
        setValue('hr_apo_hmeromhnia', '2026-07-01');
        setValue('hr_eos_hmeromhnia', '2026-07-31');
        setValue('ypokatasthmata_stathera', '0001');
        setValue('apo_hmeromhnia', '1999-02-01');
        setValue('eos_hmeromhnia', '1999-02-28');
        setValue('ypokatasthma_stathera_advanced', 'STALE');
        scope = sandbox.getActiveEmploymentReviewScope();
        assert.strictEqual(scope.workspace, 'SIMPLE');
        assert.strictEqual(scope.apo_hmeromhnia, '2026-07-01');
        assert.strictEqual(scope.eos_hmeromhnia, '2026-07-31');
        assert.strictEqual(scope.ypokatasthma, '0001');

        setValue('hr_eos_hmeromhnia', '');
        assert.throws(() => sandbox.getActiveEmploymentReviewScope(), /πλήρως επιλεγμένα/);
    } finally {
        elementsById.set('hrReviewWorkspace', workspace(false));
        elementsById.set('advancedReviewWorkspace', workspace(true));
        setValue('hr_apo_hmeromhnia', '2026-07-01');
        setValue('hr_eos_hmeromhnia', '2026-07-31');
        ['apo_hmeromhnia', 'eos_hmeromhnia', 'ypokatasthma_stathera_advanced']
            .forEach((id) => elementsById.delete(id));
    }
}

function testCorrectiveDropdownAndPageShellContract() {
    const repositionStart = dropdownHelperSource.indexOf('const reposition = () => {');
    const repositionEnd = dropdownHelperSource.indexOf('requestAnimationFrame(reposition)', repositionStart);
    const repositionSource = dropdownHelperSource.slice(repositionStart, repositionEnd);
    const forcedDownStart = repositionSource.indexOf("if (forcedDirection === 'down')");
    const forcedUpStart = repositionSource.indexOf("} else if (forcedDirection === 'up')");
    const forcedDownSource = repositionSource.slice(forcedDownStart, forcedUpStart);

    assert.ok(forcedDownStart >= 0 && forcedUpStart > forcedDownStart);
    assert.ok(forcedDownSource.includes('spaceBelow - 8'));
    assert.ok(forcedDownSource.includes("'place-below', 'maxh-limited'"));
    assert.ok(!forcedDownSource.includes('place-above'));
    assert.ok(cssSource.includes('var(--ts-available-space, 260px)'));

    const shellMarkup = viewSource.match(/<div class="[^"]*employment-review-page-shell[^"]*">/)?.[0] || '';
    assert.ok(shellMarkup.includes('employment-review-page-shell'));
    assert.ok(!shellMarkup.includes('w-70'));
    assert.ok(cssSource.includes('width: 100% !important'));
    assert.ok(!/\.hr-review-card\s*\{[^}]*max-width/s.test(cssSource));
    assert.ok(!/#hrReviewStartBtn\s*\{/s.test(cssSource));
}

function testResponsiveSharedShellAndCompactHistoricalModalContract() {
    assert.ok(viewSource.includes('employment-period-control-layout'));
    assert.ok(viewSource.includes('employment-period-control-summary'));
    assert.ok(/id="employmentPeriodControlActions" class="[^"]*flex-wrap/.test(viewSource));
    assert.ok(cssSource.includes('.employment-review-page-shell > #employmentPeriodControlPanel,'));
    assert.ok(cssSource.includes('.employment-review-page-shell > #hrReviewWorkspace,'));
    assert.ok(cssSource.includes('.employment-review-page-shell > #advancedReviewWorkspace,'));
    assert.ok(/\.employment-review-page-shell\s*\{[^}]*width:\s*100%\s*!important[^}]*max-width:\s*100%[^}]*min-width:\s*0[^}]*box-sizing:\s*border-box/s.test(cssSource));
    assert.ok(/#employmentPeriodControlActions\s*\{[^}]*max-width:\s*100%/s.test(cssSource));
    assert.ok(/\.employment-review-scroll-container--advanced\s*\{[^}]*overflow-x:\s*auto/s.test(cssSource));
    assert.ok(/\.employment-review-scroll-container #resultsTable\s*\{[^}]*min-width:\s*89\.25rem/s.test(cssSource));

    const reconstructionStart = source.indexOf('async function runHistoricalReconstruction()');
    const reconstructionEnd = source.indexOf('function currentCorrectiveBranch()', reconstructionStart);
    const reconstructionSource = source.slice(reconstructionStart, reconstructionEnd);
    assert.ok(reconstructionSource.includes("popup: 'historical-reconstruction-swal'"));
    assert.ok(reconstructionSource.includes("input: 'historical-reconstruction-swal__reason'"));
    assert.ok(reconstructionSource.includes("inputValidator: value => String(value || '').trim()"));
    assert.ok(/\.historical-reconstruction-swal\s*\{[^}]*width:\s*min\(720px, calc\(100vw - 2rem\)\)[^}]*max-width:\s*calc\(100vw - 2rem\)/s.test(cssSource));
    assert.ok(/\.historical-reconstruction-swal__reason\s*\{[^}]*min-height:\s*6rem[^}]*max-height:\s*7\.5rem/s.test(cssSource));
}

function testEmploymentReviewBranchActionLayoutContract() {
    assert.ok(!viewSource.includes('col-md-6 employment-review-branch-action-group'));
    assert.ok(viewSource.includes('hr-review-filters employment-review-filter-grid'));
    assert.ok(viewSource.includes('class="employment-review-branch-control"'));
    assert.ok(viewSource.includes('class="employment-review-start-action d-grid"'));

    const gridStart = cssSource.indexOf('.employment-review-filter-grid {');
    const gridCss = cssSource.slice(gridStart, cssSource.indexOf('}', gridStart));
    assert.ok(/display:\s*grid/.test(gridCss));
    assert.ok(/grid-template-columns:[\s\S]*2\.5rem[\s\S]*max-content/.test(gridCss));
    assert.ok(/minmax\(18rem,\s*2fr\)/.test(gridCss));
    assert.ok(/column-gap:\s*0\.75rem/.test(gridCss));
    assert.ok(viewSource.includes('class="col-md-4 employment-review-advanced-branch"'));

    const branchStart = cssSource.indexOf('.employment-review-branch-control {');
    const branchCss = cssSource.slice(branchStart, cssSource.indexOf('}', branchStart));
    assert.ok(/grid-column:\s*3/.test(branchCss));
    assert.ok(/min-width:\s*0/.test(branchCss));
    assert.ok(cssSource.includes('.employment-review-branch-control .ts-wrapper {'));
    assert.ok(cssSource.includes('width: calc(100% - 2rem)'));

    const actionStart = cssSource.indexOf('.employment-review-start-action {');
    const actionCss = cssSource.slice(actionStart, cssSource.indexOf('}', actionStart));
    assert.ok(/grid-column:\s*5/.test(actionCss));
    assert.ok(!/(?:position\s*:\s*absolute|transform\s*:|translate\s*:)/.test(actionCss));
    assert.ok(!/#hrReviewStartBtn\s*\{/s.test(cssSource));

    assert.ok(cssSource.includes('width: 100% !important'));
    assert.ok(cssSource.includes('.hr-review-card {\n    width: 100%;'));
    assert.ok(dropdownHelperSource.includes("ddEl.classList.add('place-below', 'maxh-limited')"));
    assert.ok(viewSource.includes('id="hrReviewStartBtn"'));
    assert.ok(source.includes("getElementById('hrReviewStartBtn')?.addEventListener('click', loadHrReviewQueue)"));
}

function testRoleScopedRenderedEjs() {
    const hr = renderViewForRole('HR');
    assert.ok(hr.includes('id="hrReviewWorkspace"'));
    assert.ok(hr.includes('id="advancedReviewWorkspace"'));
    assert.ok(hr.includes('id="resultsTable"'));
    assert.ok(hr.includes('id="policyPreviewGroupsContainer"'));
    assert.ok(hr.includes('id="ypokatasthmata"'));
    assert.ok(hr.includes('initYpokatasthmataDropdowns.js'));
    assert.ok(/id="canManageReusablePolicyApproval"\s+value="1"/.test(hr));

    ['A', 'S', 'HR'].forEach((role) => {
        const html = renderViewForRole(role);
        assert.ok(html.includes('id="hrReviewWorkspace"'));
        assert.ok(html.includes('id="advancedReviewWorkspace"'));
        assert.ok(html.includes('id="resultsTable"'));
        assert.ok(html.includes('id="policyPreviewGroupsContainer"'));
        assert.ok(html.includes('id="ypokatasthmata"'));
        assert.ok(html.includes('initYpokatasthmataDropdowns.js'));
        assert.ok(/id="canManageReusablePolicyApproval"\s+value="1"/.test(html));
        assert.deepStrictEqual(duplicateIds(html), [], `${role} rendered duplicate IDs`);
    });

    const unknown = renderViewForRole('UNKNOWN');
    assert.ok(!unknown.includes('id="hrReviewWorkspace"'));
    assert.ok(!unknown.includes('id="advancedReviewWorkspace"'));
    assert.ok(!unknown.includes('id="ypokatasthmata"'));
    assert.ok(!unknown.includes('initYpokatasthmataDropdowns.js'));
    assert.ok(unknown.includes('Δεν έχετε δικαίωμα χρήσης του ελέγχου απασχολήσεων.'));
    assert.ok(!unknown.includes('hr-review-decision-btn'));
    assert.ok(/id="canManageReusablePolicyApproval"\s+value="0"/.test(unknown));
    assert.deepStrictEqual(duplicateIds(hr), [], 'HR rendered duplicate IDs');
    assert.deepStrictEqual(duplicateIds(unknown), [], 'UNKNOWN rendered duplicate IDs');
}

function testHrQueueClassification() {
    const projection = readyProjection();
    projection.groups = [
        { ...projection.groups[0], group_id: 'pending' },
        { ...projection.groups[0], group_id: 'decided' },
        { ...projection.groups[0], group_id: 'applied-state' },
        { ...projection.groups[0], group_id: 'applied-execution' },
        { ...projection.groups[0], group_id: 'stale-only' }
    ];
    vm.runInContext(`currentHrReviewProjection = ${JSON.stringify(projection)}`, sandbox);
    vm.runInContext(`currentRepoTransferDecisionsByProposalId = new Map([
        ['decided', { current_decision: { decision_code: 'REJECT_PROPOSAL' } }],
        ['applied-state', { apply_state: 'ALREADY_APPLIED' }],
        ['applied-execution', { current_execution: { execution_status: 'APPLIED' } }],
        ['stale-only', { current_decision: null, history: [{ decision_code: 'APPROVE_PROPOSAL', is_current: false }] }]
    ])`, sandbox);
    sandbox.classifyHrReviewGroups();
    assert.deepStrictEqual(
        Array.from(vm.runInContext('currentHrPendingGroups.map((group) => group.group_id)', sandbox)),
        ['pending', 'stale-only']
    );
    assert.deepStrictEqual(
        Array.from(vm.runInContext('currentHrCompletedGroups.map((group) => group.group_id)', sandbox)),
        ['decided', 'applied-state', 'applied-execution']
    );
}

function testMinimalRenderingAndTerminology() {
    setMinimalRenderElements();
    const projection = readyProjection({
        sourceIntervals: [
            ['', ''],
            ['12:00', '16:00'],
            ['', '']
        ]
    });
    projection.groups[0].items[0].employee_name = '<img src=x onerror=alert(1)>';
    vm.runInContext(`currentHrReviewProjection = ${JSON.stringify(projection)}; currentHrReviewLoaded = true; currentRepoTransferDecisionsByProposalId = new Map()`, sandbox);
    sandbox.classifyHrReviewGroups();
    sandbox.renderHrReviewWorkspace();
    const html = elementsById.get('hrReviewPendingContainer').innerHTML;
    const visible = getVisibleText(html);
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;img'));
    assertContains(html, [
        'Ημέρα που θα καταχωριστεί ως εργασία',
        'Ημέρα που θα καταχωριστεί ως ρεπό',
        'Ωράριο 01',
        'Ωράριο 02',
        'Ωράριο 03',
        '12:00–16:00',
        'Αποδοχή πρότασης',
        'Δεν ισχύει',
        'Χρειάζομαι οδηγία'
    ]);
    assert.ok(html.indexOf('Ωράριο 01') < html.indexOf('Ωράριο 02'));
    assert.ok(html.indexOf('Ωράριο 02') < html.indexOf('12:00–16:00'));
    [
        /\batomic\b/i,
        /\bprojection\b/i,
        /\bgroup(?:_id)?\b/i,
        /policy_code/i,
        /scenario_code/i,
        /reason_code/i,
        /action_type/i,
        /confidence/i,
        /runtime/i,
        /fingerprint/i,
        /\bstale\b/i,
        /dry-run/i,
        /eligibility/i,
        /\bREADY\b/,
        /\bblocked\b/i
    ].forEach((pattern) => assert.ok(!pattern.test(visible), `Visible minimal term: ${pattern}`));
    assert.ok(
        getVisibleText(elementsById.get('hrReviewProgress').innerHTML).includes(
            '1 περιπτώσεις χρειάζονται απόφαση'
        )
    );
    setRepoTransferPermissions({ decision: false, apply: false });
    sandbox.renderHrPendingCase();
    assert.ok(!elementsById.get('hrReviewPendingContainer').innerHTML.includes('hr-review-decision-btn'));
    setRepoTransferPermissions({ decision: true, apply: true });
    clearMinimalRenderElements();
}

function testMinimalCompletionAndClosedCompletedSection() {
    setMinimalRenderElements();
    const projection = readyProjection();
    vm.runInContext(`currentHrReviewProjection = ${JSON.stringify(projection)}; currentHrReviewLoaded = true; currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: 'READY_TO_APPLY', can_apply: true, current_decision: { id: '507f191e810c19729de860ea', decision_code: 'APPROVE_PROPOSAL', created_by_user_name: '<Admin>', notes: '<note>' } }]])`, sandbox);
    sandbox.classifyHrReviewGroups();
    sandbox.renderHrReviewWorkspace();
    const status = elementsById.get('hrReviewStatus').innerHTML;
    const completed = elementsById.get('hrReviewCompletedContainer').innerHTML;
    assert.ok(status.includes('Ο έλεγχος ολοκληρώθηκε'));
    assert.ok(completed.includes('<details'));
    assert.ok(!completed.includes('<details open'));
    assert.ok(completed.includes('&lt;Admin&gt;'));
    assert.ok(completed.includes('&lt;note&gt;'));
    assert.ok(completed.includes('hr-review-apply-btn'));
    vm.runInContext("currentRepoTransferDecisionsByProposalId.get('atomic-group-1').apply_state = 'RUNTIME_DISABLED'; currentRepoTransferDecisionsByProposalId.get('atomic-group-1').can_apply = false", sandbox);
    sandbox.renderHrCompletedCases();
    const blocked = elementsById.get('hrReviewCompletedContainer').innerHTML;
    assert.ok(!blocked.includes('hr-review-apply-btn'));
    assert.ok(blocked.includes('Η πρόταση έχει εγκριθεί, αλλά η εφαρμογή δεν είναι ακόμη ενεργοποιημένη.'));
    clearMinimalRenderElements();
}

function testMinimalStaleDecisionRemainsPending() {
    setMinimalRenderElements();
    setRepoTransferPermissions({ decision: true, apply: true });
    const projection = readyProjection();
    vm.runInContext(`currentHrReviewProjection = ${JSON.stringify(projection)}; currentHrReviewLoaded = true; currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: 'STALE_DECISION', can_apply: false, current_decision: null, history: [{ decision_code: 'APPROVE_PROPOSAL', is_current: false }] }]])`, sandbox);
    sandbox.classifyHrReviewGroups();
    sandbox.renderHrReviewWorkspace();
    const pending = elementsById.get('hrReviewPendingContainer').innerHTML;
    const completed = elementsById.get('hrReviewCompletedContainer').innerHTML;
    const visible = getVisibleText(pending);
    assert.strictEqual(vm.runInContext('currentHrPendingGroups.length', sandbox), 1);
    assert.strictEqual(vm.runInContext('currentHrCompletedGroups.length', sandbox), 0);
    assert.ok(visible.includes('Υπήρχε προηγούμενη έγκριση, αλλά τα δεδομένα της πρότασης έχουν αλλάξει. Ελέγξτε ξανά και καταγράψτε νέα απόφαση.'));
    assert.strictEqual((pending.match(/hr-review-decision-btn/g) || []).length, 3);
    assert.ok(!pending.includes('hr-review-apply-btn'));
    assert.ok(!visible.includes('STALE_DECISION'));
    assert.strictEqual(completed, '');
    clearMinimalRenderElements();
}

function testStaleNoticesDoNotLeakIntoOtherStates() {
    const advancedMessage = 'Η προηγούμενη έγκριση δεν ισχύει πλέον';
    const minimalMessage = 'Υπήρχε προηγούμενη έγκριση, αλλά τα δεδομένα της πρότασης έχουν αλλάξει';
    const states = [
        { apply_state: 'NOT_APPROVED', can_apply: false, current_decision: null, history: [] },
        { apply_state: 'NOT_APPROVED', can_apply: false, current_decision: { decision_code: 'REJECT_PROPOSAL', is_current: true }, history: [] },
        { apply_state: 'NOT_APPROVED', can_apply: false, current_decision: { decision_code: 'NEEDS_MORE_REVIEW', is_current: true }, history: [] },
        { apply_state: 'READY_TO_APPLY', can_apply: true, current_decision: { decision_code: 'APPROVE_PROPOSAL', is_current: true }, history: [] },
        { apply_state: 'ALREADY_APPLIED', can_apply: false, current_decision: null, current_execution: { execution_status: 'APPLIED' }, history: [{ decision_code: 'APPROVE_PROPOSAL', is_current: false }] }
    ];
    vm.runInContext("currentPolicyPreviewBaseParams = new URLSearchParams('ypokatasthma=0000')", sandbox);
    for (const state of states) {
        vm.runInContext(`currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', ${JSON.stringify(state)}]])`, sandbox);
        assert.ok(!getVisibleText(render(readyProjection())).includes(advancedMessage));
    }
    setMinimalRenderElements();
    for (const state of states) {
        vm.runInContext(`currentHrReviewProjection = ${JSON.stringify(readyProjection())}; currentHrReviewLoaded = true; currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', ${JSON.stringify(state)}]])`, sandbox);
        sandbox.classifyHrReviewGroups();
        sandbox.renderHrReviewWorkspace();
        assert.ok(!getVisibleText(elementsById.get('hrReviewPendingContainer').innerHTML).includes(minimalMessage));
    }
    clearMinimalRenderElements();
    vm.runInContext('currentRepoTransferDecisionsByProposalId = new Map(); currentPolicyPreviewBaseParams = null', sandbox);
}

function testMinimalSafetySourceContracts() {
    const minimalStart = source.indexOf('function userCanUseAdvancedEmploymentReview');
    const minimalEnd = source.indexOf('function renderAtomicRepoTransferProjection');
    const minimalSource = source.slice(minimalStart, minimalEnd);
    assert.ok(minimalSource.includes('fetchPolicyPreviewGrouping(params)'));
    assert.ok(minimalSource.includes('await refreshRepoTransferDecisions()'));
    assert.ok(!minimalSource.includes('loadResults()'));
    assert.ok(!minimalSource.includes('renderReviewRows('));
    assert.ok(!minimalSource.includes('fetchScenarioClassifications('));
    assert.ok(!minimalSource.includes('refreshPolicyPreviewApprovals('));
    assert.ok(!minimalSource.includes('fetchPolicyPreviewApplyDryRun('));
    assert.ok(!/\son[a-z]+\s*=/i.test(minimalSource));
    assert.ok(source.includes("data-decision-code=\"APPROVE_PROPOSAL\">Αποδοχή πρότασης"));
    assert.ok(source.includes("data-decision-code=\"REJECT_PROPOSAL\">Δεν ισχύει"));
    assert.ok(source.includes("data-decision-code=\"NEEDS_MORE_REVIEW\">Χρειάζομαι οδηγία"));
    assert.ok(source.includes("options.mode === 'hr'"));
    assert.ok(source.includes("String(value || '').trim()"));
}

async function testLightweightHrLoadingRequests() {
    setMinimalRenderElements();
    elementsById.set('hrReviewStartBtn', minimalElement());
    elementsById.set('hr_apo_hmeromhnia', minimalElement({ value: '2026-07-06' }));
    elementsById.set('hr_eos_hmeromhnia', minimalElement({ value: '2026-07-12' }));
    elementsById.set('ypokatasthmata_stathera', minimalElement({ value: '0000' }));
    const urls = [];
    const projection = readyProjection();
    sandbox.fetch = async (url, options = {}) => {
        urls.push({ url: String(url), method: options.method || 'GET' });
        if (String(url).startsWith('/api/prodhlomena-oraria/review/period-control/current?')) {
            return {
                ok: true,
                json: async () => ({ success: true, effective_mode: 'NORMAL', deadline: '2026-08-31',
                    version: 0, calculation: { authoritative_result: true },
                    allowed_actions: {}, index_readiness: { ready: false } })
            };
        }
        if (String(url).startsWith('/api/prodhlomena-oraria/review/policies/preview?')) {
            return {
                ok: true,
                json: async () => ({
                    success: true,
                    grouping: { version: 1, groups: [], summary: {} },
                    atomic_group_projection: projection
                })
            };
        }
        if (String(url).startsWith('/api/prodhlomena-oraria/review/repo-transfer-decisions/current?')) {
            return { ok: true, json: async () => ({ success: true, records: [] }) };
        }
        throw new Error(`Unexpected HR loading request: ${url}`);
    };
    vm.runInContext('currentHrReviewLoading = false; currentHrReviewLoaded = false', sandbox);
    await sandbox.loadHrReviewQueue();
    assert.strictEqual(urls.length, 3);
    assert.ok(urls[0].url.startsWith('/api/prodhlomena-oraria/review/period-control/current?'));
    assert.ok(urls[1].url.startsWith('/api/prodhlomena-oraria/review/policies/preview?'));
    assert.ok(urls[2].url.startsWith('/api/prodhlomena-oraria/review/repo-transfer-decisions/current?'));
    assert.ok(urls.every((call) => call.method === 'GET'));
    const allUrls = urls.map((call) => call.url).join('\n');
    assert.ok(!allUrls.includes('/api/prodhlomena-oraria/review?'));
    assert.ok(!allUrls.includes('/review/scenarios'));
    assert.ok(!allUrls.includes('/review/policies/approvals'));
    assert.ok(!allUrls.includes('/review/policies/apply-dry-run'));
    ['hrReviewStartBtn', 'hr_apo_hmeromhnia', 'hr_eos_hmeromhnia', 'ypokatasthmata_stathera'].forEach((id) => elementsById.delete(id));
    clearMinimalRenderElements();
}

function testPreAndPostCalculationWorkflowGating() {
    const loadResultsStart = source.indexOf('async function loadResults()');
    const loadResultsEnd = source.indexOf('function pairNo(n)', loadResultsStart);
    const loadResultsSource = source.slice(loadResultsStart, loadResultsEnd);
    assert.ok(loadResultsSource.includes(
        'if (payload.finalized !== true && !hasAuthoritativeResult)'
    ));
    assert.ok(loadResultsSource.includes('renderPreCalculationDataIssues(rows);'));
    assert.ok(loadResultsSource.includes(
        'currentPolicyPreviewBaseParams = hasAuthoritativeResult && payload.finalized !== true'
    ));
    assert.ok(!loadResultsSource.includes('fetchPolicyPreviewGrouping(params)'));
    assert.ok(source.includes('async function loadPolicyPreviewOnDemand()'));

    const provisionalState = {
        effective_mode: 'NORMAL',
        calculation: { authoritative_result: false },
        rows: [{ id: 'not-authoritative' }],
        reason_counts: { MULTIPLE_TARGET_CANDIDATES: 1 },
        actionable_issue_groups: [{ issue_code: 'MULTIPLE_TARGET_CANDIDATES' }]
    };
    assert.strictEqual(sandbox.hasAuthoritativeEmploymentCalculation(provisionalState), false);
    assert.strictEqual(sandbox.hasAuthoritativeEmploymentCalculation({
        effective_mode: 'HISTORICAL_RECONSTRUCTION_REQUIRED',
        historical_reconstruction: { status: 'AUTHORIZED', version: 0 },
        calculation: { authoritative_result: false }
    }), false);
    assert.strictEqual(sandbox.hasAuthoritativeEmploymentCalculation({
        effective_mode: 'HISTORICAL_RECONSTRUCTION_REQUIRED',
        historical_reconstruction: { status: 'FAILED', version: 0 },
        calculation: { authoritative_result: false }
    }), false);
    assert.strictEqual(sandbox.hasAuthoritativeEmploymentCalculation({
        effective_mode: 'NORMAL', calculation: { authoritative_result: true }
    }), true);
    assert.strictEqual(sandbox.hasAuthoritativeEmploymentCalculation({
        effective_mode: 'HISTORICAL_RECONSTRUCTED',
        historical_reconstruction: { status: 'COMPLETED', version: 1 },
        calculation: { authoritative_result: true }
    }), true);
    assert.strictEqual(sandbox.hasAuthoritativeEmploymentCalculation({
        effective_mode: 'HISTORICAL_RECONSTRUCTION_STALE',
        historical_reconstruction: { status: 'COMPLETED', version: 1 },
        calculation: { authoritative_result: true }
    }), false);
    assert.strictEqual(sandbox.canRecordCanonicalEmploymentDecision({
        effective_mode: 'NORMAL', calculation: { authoritative_result: false },
        allowed_actions: { record_decision: true }
    }), false);
    assert.strictEqual(sandbox.canRecordCanonicalEmploymentDecision({
        effective_mode: 'NORMAL', calculation: { authoritative_result: true },
        allowed_actions: { record_decision: true }
    }), true);
    assert.strictEqual(sandbox.canRecordCanonicalEmploymentDecision({
        effective_mode: 'NORMAL', calculation: { authoritative_result: true },
        allowed_actions: { record_decision: false }
    }), false);
    assert.strictEqual(sandbox.canRecordCanonicalEmploymentDecision({
        effective_mode: 'HISTORICAL_RECONSTRUCTION_STALE',
        calculation: { authoritative_result: true },
        allowed_actions: { record_decision: true }
    }), false);
    assert.strictEqual(sandbox.canRecordCanonicalEmploymentDecision({
        effective_mode: 'HISTORICAL_RECONSTRUCTION_STALE',
        calculation: { authoritative_result: false },
        allowed_actions: {
            record_decision: false,
            record_stale_canonical_decision: true,
            calculate: false,
            repo_transfer: false
        }
    }), true);

    const weeklyRendererStart = source.indexOf('function appendEmployeeDeviationRows(');
    const weeklyRendererEnd = source.indexOf('const canonicalApplicabilityLabels', weeklyRendererStart);
    const weeklyRendererSource = source.slice(weeklyRendererStart, weeklyRendererEnd);
    assert.ok(weeklyRendererSource.includes(
        "dev.status === 'NEEDS_HR_DECISION' && dev.requires_new_hr_decision !== false && canRecordCanonicalEmploymentDecision()"
    ));
    assert.ok(source.includes(
        'Ελέγξτε την ποιότητα των δεδομένων πριν εκτελέσετε τον υπολογισμό ή την ανακατασκευή της περιόδου.'
    ));

    const container = minimalElement();
    elementsById.set('policyPreviewGroupsContainer', container);
    sandbox.renderPreCalculationDataIssues([{
        _id: 'orphan-row', kodikos: '0004', eponymo: 'ΤΣΙΤΟΓΛΟΥ', onoma: 'ΧΡΗΣΤΟΣ',
        hmeromhnia: '2026-06-14', cards_ores_ergasias: 0,
        cards_apo_ora_01: '14:51', cards_eos_ora_01: ''
    }]);
    assert.ok(container.innerHTML.includes('Εκκρεμότητες δεδομένων πριν τον υπολογισμό'));
    assert.ok(container.innerHTML.includes('Ορφανό χτύπημα κάρτας'));
    assert.ok(container.innerHTML.includes('0004'));
    assert.ok(container.innerHTML.includes('14:51'));
    assert.ok(!container.innerHTML.includes('Εκκρεμότητες που απαιτούν ενέργεια'));
    assert.ok(!container.innerHTML.includes('Καταγραφή απόφασης'));
    elementsById.delete('policyPreviewGroupsContainer');
}

async function testPreCalculationCanonicalDecisionEntryGuard() {
    const savedSwal = sandbox.Swal;
    const savedFetch = sandbox.fetch;
    let message = '';
    let networkCalls = 0;
    try {
        vm.runInContext(`currentEmploymentPeriodControl = {
            effective_mode: 'NORMAL', calculation: { authoritative_result: false },
            allowed_actions: { record_decision: true }
        }`, sandbox);
        sandbox.Swal = { fire: async (options) => { message = options.text; return {}; } };
        sandbox.fetch = async () => { networkCalls++; throw new Error('Unexpected network call'); };
        await sandbox.openCanonicalDecisionPanel({ employee_kodikos: '0004' });
        assert.strictEqual(networkCalls, 0);
        assert.ok(message.includes('μετά την ολοκλήρωση του Υπολογισμού Απασχολήσεων'));

        vm.runInContext(`currentEmploymentPeriodControl = {
            effective_mode: 'HISTORICAL_RECONSTRUCTION_STALE',
            calculation: { authoritative_result: true },
            allowed_actions: { record_decision: true }
        }`, sandbox);
        await sandbox.openCanonicalDecisionPanel({ employee_kodikos: '0004' });
        assert.strictEqual(networkCalls, 0);
    } finally {
        vm.runInContext(`currentEmploymentPeriodControl = {
            effective_mode: 'NORMAL', calculation: { authoritative_result: true },
            allowed_actions: { record_decision: true, repo_transfer: true }
        }`, sandbox);
        sandbox.Swal = savedSwal;
        sandbox.fetch = savedFetch;
    }
}

async function testHrDecisionPresentationAndLocalRerender() {
    setMinimalRenderElements();
    setRepoTransferPermissions({ decision: true, apply: false });
    const group = setHrDecisionState();
    const calls = { swal: [], posts: 0, heavyLoads: 0 };
    const saved = snapshotSandboxFunctions([
        'loadResults', 'getPolicyPreviewCsrfToken', 'refreshRepoTransferDecisions', 'fetch', 'Swal'
    ]);
    try {
        sandbox.loadResults = async () => { calls.heavyLoads++; };
        sandbox.getPolicyPreviewCsrfToken = async () => 'csrf-test';
        sandbox.refreshRepoTransferDecisions = async () => {
            vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { current_decision: { decision_code: 'NEEDS_MORE_REVIEW', notes: 'Διευκρίνιση' } }]])", sandbox);
        };
        sandbox.fetch = async (url, options) => {
            calls.posts++;
            assert.strictEqual(url, '/api/prodhlomena-oraria/review/repo-transfer-decisions');
            assert.strictEqual(options.method, 'POST');
            assert.strictEqual(options.credentials, 'same-origin');
            assert.strictEqual(options.headers['CSRF-Token'], 'csrf-test');
            assert.strictEqual(options.headers['x-csrf-token'], 'csrf-test');
            const body = JSON.parse(options.body);
            assert.deepStrictEqual(Object.keys(body).sort(), [
                'decision_code', 'expected_choice_code', 'expected_proposal_version',
                'expected_source_id', 'expected_target_id', 'notes', 'proposal_id', 'request_id'
            ]);
            return { ok: true, json: async () => ({ success: true }) };
        };
        sandbox.Swal = {
            fire: async (options) => {
                calls.swal.push(options);
                if (options.title === 'Χρειάζομαι οδηγία') {
                    assert.strictEqual(options.inputValidator('   '), 'Συμπληρώστε τι χρειάζεται διευκρίνιση.');
                    assert.strictEqual(options.inputValidator(' κείμενο '), undefined);
                    return { isConfirmed: true, value: ' Διευκρίνιση ' };
                }
                return {};
            }
        };
        await sandbox.submitRepoTransferDecision(group, 'NEEDS_MORE_REVIEW', { mode: 'hr' });
        assert.strictEqual(calls.posts, 1);
        assert.strictEqual(calls.heavyLoads, 0);
        assert.ok(calls.swal.some((call) => call.title === 'Η απόφαση καταγράφηκε'));
        assert.strictEqual(vm.runInContext('currentHrPendingGroups.length', sandbox), 0);
        assert.strictEqual(vm.runInContext('currentHrCompletedGroups.length', sandbox), 1);
    } finally {
        restoreSandboxFunctions(saved);
        setRepoTransferPermissions({ decision: true, apply: true });
        clearMinimalRenderElements();
    }
}

async function testHrDecisionCancelAndEmptyNoteDoNotPost() {
    setMinimalRenderElements();
    setRepoTransferPermissions({ decision: true, apply: false });
    const saved = snapshotSandboxFunctions(['fetch', 'Swal', 'refreshRepoTransferDecisions']);
    let posts = 0;
    let refreshes = 0;
    try {
        sandbox.fetch = async () => { posts++; throw new Error('POST must not run'); };
        sandbox.refreshRepoTransferDecisions = async () => { refreshes++; };

        let group = setHrDecisionState();
        sandbox.Swal = { fire: async () => ({ isConfirmed: false }) };
        await sandbox.submitRepoTransferDecision(group, 'APPROVE_PROPOSAL', { mode: 'hr' });
        assert.strictEqual(posts, 0);
        assert.strictEqual(refreshes, 0);
        assert.strictEqual(vm.runInContext('currentHrCompletedGroups.length', sandbox), 0);

        group = setHrDecisionState();
        sandbox.Swal = {
            fire: async (options) => {
                assert.strictEqual(options.inputValidator('   '), 'Συμπληρώστε τι χρειάζεται διευκρίνιση.');
                return { isConfirmed: false };
            }
        };
        await sandbox.submitRepoTransferDecision(group, 'NEEDS_MORE_REVIEW', { mode: 'hr' });
        assert.strictEqual(posts, 0);
        assert.strictEqual(refreshes, 0);
        assert.strictEqual(vm.runInContext('currentHrCompletedGroups.length', sandbox), 0);
    } finally {
        restoreSandboxFunctions(saved);
        setRepoTransferPermissions({ decision: true, apply: true });
        clearMinimalRenderElements();
    }
}

async function testHrApproveAndRejectPostPaths() {
    setMinimalRenderElements();
    setRepoTransferPermissions({ decision: true, apply: false });
    const saved = snapshotSandboxFunctions([
        'fetch', 'Swal', 'refreshRepoTransferDecisions', 'getPolicyPreviewCsrfToken'
    ]);
    try {
        for (const decisionCode of ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL']) {
            const group = setHrDecisionState();
            let posts = 0;
            let refreshes = 0;
            sandbox.getPolicyPreviewCsrfToken = async () => 'csrf-test';
            sandbox.Swal = { fire: async (options) =>
                options.title === 'Η απόφαση καταγράφηκε'
                    ? {}
                    : { isConfirmed: true }
            };
            sandbox.fetch = async (url, options) => {
                posts++;
                const body = JSON.parse(options.body);
                assert.strictEqual(url, '/api/prodhlomena-oraria/review/repo-transfer-decisions');
                assert.strictEqual(body.decision_code, decisionCode);
                assert.strictEqual(body.notes, '');
                assert.deepStrictEqual(Object.keys(body).sort(), [
                    'decision_code', 'expected_choice_code', 'expected_proposal_version',
                    'expected_source_id', 'expected_target_id', 'notes', 'proposal_id', 'request_id'
                ]);
                return { ok: true, json: async () => ({ success: true }) };
            };
            sandbox.refreshRepoTransferDecisions = async () => {
                refreshes++;
                vm.runInContext(`currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { current_decision: { decision_code: '${decisionCode}' } }]])`, sandbox);
            };
            await sandbox.submitRepoTransferDecision(group, decisionCode, { mode: 'hr' });
            assert.strictEqual(posts, 1);
            assert.strictEqual(refreshes, 1);
            assert.strictEqual(vm.runInContext('currentHrPendingGroups.length', sandbox), 0);
            assert.strictEqual(vm.runInContext('currentHrCompletedGroups.length', sandbox), 1);
        }
    } finally {
        restoreSandboxFunctions(saved);
        setRepoTransferPermissions({ decision: true, apply: true });
        clearMinimalRenderElements();
    }
}

async function testHrPostSuccessRefreshFailureWarning() {
    setMinimalRenderElements();
    setRepoTransferPermissions({ decision: true, apply: false });
    const group = setHrDecisionState();
    const decisionButton = minimalElement();
    const originalQuerySelectorAll = documentStub.querySelectorAll;
    const saved = snapshotSandboxFunctions([
        'fetch', 'Swal', 'refreshRepoTransferDecisions', 'getPolicyPreviewCsrfToken',
        'loadResults', 'renderPolicyPreviewGroups'
    ]);
    const dialogs = [];
    let posts = 0;
    let heavyLoads = 0;
    let advancedRenders = 0;
    try {
        documentStub.querySelectorAll = (selector) =>
            selector === '#hrReviewPendingContainer .hr-review-decision-btn' ? [decisionButton] : [];
        sandbox.getPolicyPreviewCsrfToken = async () => 'csrf-test';
        sandbox.fetch = async () => {
            posts++;
            return { ok: true, json: async () => ({ success: true }) };
        };
        sandbox.refreshRepoTransferDecisions = async () => { throw new Error('refresh failed'); };
        sandbox.loadResults = async () => { heavyLoads++; };
        sandbox.renderPolicyPreviewGroups = () => { advancedRenders++; };
        sandbox.Swal = {
            fire: async (options) => {
                dialogs.push(options);
                return dialogs.length === 1 ? { isConfirmed: true } : {};
            }
        };
        await sandbox.submitRepoTransferDecision(group, 'APPROVE_PROPOSAL', { mode: 'hr' });
        assert.strictEqual(posts, 1);
        assert.strictEqual(heavyLoads, 0);
        assert.strictEqual(advancedRenders, 0);
        assert.strictEqual(decisionButton.disabled, true);
        assert.ok(dialogs.some((dialog) => dialog.title === 'Η απόφαση καταγράφηκε'));
        assert.ok(dialogs.some((dialog) => String(dialog.text || '').includes('Η προβολή δεν ανανεώθηκε')));
        assert.ok(!dialogs.some((dialog) => dialog.title === 'Δεν καταγράφηκε η απόφαση'));
        assert.strictEqual(vm.runInContext('repoTransferDecisionSubmitting.size', sandbox), 0);
    } finally {
        documentStub.querySelectorAll = originalQuerySelectorAll;
        restoreSandboxFunctions(saved);
        setRepoTransferPermissions({ decision: true, apply: true });
        clearMinimalRenderElements();
    }
}

async function testHrLoadingLocksAndRestoresFilters() {
    setMinimalRenderElements();
    const start = minimalElement();
    const from = minimalElement({ value: '2026-07-06' });
    const to = minimalElement({ value: '2026-07-12' });
    const hidden = minimalElement({ value: '0000' });
    const tomCalls = { disable: 0, enable: 0 };
    const select = minimalElement({
        value: '0000',
        tomselect: {
            getValue: () => '0000',
            disable: () => { tomCalls.disable++; },
            enable: () => { tomCalls.enable++; }
        }
    });
    elementsById.set('hrReviewStartBtn', start);
    elementsById.set('hr_apo_hmeromhnia', from);
    elementsById.set('hr_eos_hmeromhnia', to);
    elementsById.set('ypokatasthmata_stathera', hidden);
    elementsById.set('ypokatasthmata', select);
    const saved = snapshotSandboxFunctions(['fetch']);
    try {
        let releasePreview;
        const previewWait = new Promise((resolve) => { releasePreview = resolve; });
        let requestNumber = 0;
        sandbox.fetch = async () => {
            requestNumber++;
            if (requestNumber === 1) {
                await previewWait;
                return { ok: true, json: async () => ({ success: true, grouping: {}, atomic_group_projection: readyProjection() }) };
            }
            return { ok: true, json: async () => ({ success: true, records: [] }) };
        };
        vm.runInContext('currentHrReviewLoading = false', sandbox);
        const loading = sandbox.loadHrReviewQueue();
        assert.strictEqual(from.disabled, true);
        assert.strictEqual(to.disabled, true);
        assert.strictEqual(select.disabled, true);
        assert.strictEqual(start.disabled, true);
        assert.strictEqual(tomCalls.disable, 1);
        releasePreview();
        await loading;
        assert.strictEqual(from.disabled, false);
        assert.strictEqual(to.disabled, false);
        assert.strictEqual(select.disabled, false);
        assert.strictEqual(start.disabled, false);
        assert.strictEqual(tomCalls.enable, 1);

        sandbox.fetch = async () => { throw new Error('preview failed'); };
        vm.runInContext('currentHrReviewLoading = false', sandbox);
        await sandbox.loadHrReviewQueue();
        assert.strictEqual(from.disabled, false);
        assert.strictEqual(to.disabled, false);
        assert.strictEqual(select.disabled, false);
        assert.strictEqual(start.disabled, false);
        assert.strictEqual(tomCalls.disable, 2);
        assert.strictEqual(tomCalls.enable, 2);
    } finally {
        restoreSandboxFunctions(saved);
        ['hrReviewStartBtn', 'hr_apo_hmeromhnia', 'hr_eos_hmeromhnia', 'ypokatasthmata_stathera', 'ypokatasthmata']
            .forEach((id) => elementsById.delete(id));
        clearMinimalRenderElements();
    }
}

function testAtomicReusablePendingResolvedAndConflictUi() {
    vm.runInContext("currentPolicyPreviewBaseParams = new URLSearchParams('apo_hmeromhnia=2026-07-01&eos_hmeromhnia=2026-07-31&ypokatasthma=0001')", sandbox);
    vm.runInContext('currentRepoTransferDecisionsByProposalId = new Map()', sandbox);
    setRepoTransferPermissions({ decision: true, apply: true, manageReusable: true });
    const pending = render(readyProjection());
    assert.strictEqual((pending.match(/atomic-repo-transfer-decision-btn/g) || []).length, 3);
    assert.strictEqual((pending.match(/atomic-repo-transfer-reusable-btn/g) || []).length, 1);
    assert.ok(pending.includes('Έγκριση πρότασης για μελλοντική εφαρμογή'));
    assert.ok(!pending.includes('data-item-decision-code'));

    setRepoTransferPermissions({ decision: true, apply: false, manageReusable: false });
    const unauthorized = render(readyProjection());
    assert.ok(!unauthorized.includes('atomic-repo-transfer-reusable-btn'));
    assert.strictEqual((unauthorized.match(/atomic-repo-transfer-decision-btn/g) || []).length, 3);

    setRepoTransferPermissions({ decision: true, apply: true, manageReusable: true });
    const resolvedProjection = readyProjection();
    Object.assign(resolvedProjection.groups[0], {
        status: 'RESOLVED_BY_POLICY',
        reusable_decision: {
            approval_id: 'approval-v5',
            approved_by_user_name: 'HR User',
            approved_at: '2026-07-20T10:00:00.000Z',
            effective_from: '2026-07-01',
            effective_to: null,
            fingerprint_version: 5
        }
    });
    const resolved = render(resolvedProjection);
    assert.strictEqual(resolved, '');
    assert.ok(!resolved.includes('atomic-repo-transfer-decision-btn'));
    assert.ok(!resolved.includes('atomic-repo-transfer-reusable-btn'));
    assert.ok(!resolved.includes('atomic-repo-transfer-apply-btn'));

    const conflictProjection = readyProjection();
    Object.assign(conflictProjection.groups[0], {
        reusable_conflict: true,
        atomic_reusable_diagnostics: ['ATOMIC_LINKED_SET_ROW_OVERLAP']
    });
    const conflict = render(conflictProjection);
    assert.ok(conflict.includes('Η ίδια ημέρα συμμετέχει σε περισσότερες από μία προτάσεις'));
    assert.ok(!conflict.includes('atomic-repo-transfer-reusable-btn'));
    assert.strictEqual((conflict.match(/atomic-repo-transfer-decision-btn/g) || []).length, 3);

    setMinimalRenderElements();
    elementsById.set('ypokatasthmata_stathera', { value: '0001' });
    vm.runInContext(`currentHrReviewProjection = ${JSON.stringify(readyProjection())}; currentHrReviewLoaded = true; currentRepoTransferDecisionsByProposalId = new Map()`, sandbox);
    sandbox.classifyHrReviewGroups();
    sandbox.renderHrReviewWorkspace();
    const minimalPending = elementsById.get('hrReviewPendingContainer').innerHTML;
    assert.strictEqual((minimalPending.match(/hr-review-decision-btn/g) || []).length, 3);
    assert.strictEqual((minimalPending.match(/hr-review-reusable-btn/g) || []).length, 1);

    vm.runInContext(`currentHrReviewProjection = ${JSON.stringify(resolvedProjection)}; currentHrReviewLoaded = true; currentRepoTransferDecisionsByProposalId = new Map()`, sandbox);
    sandbox.classifyHrReviewGroups();
    sandbox.renderHrReviewWorkspace();
    const minimalResolved = elementsById.get('hrReviewCompletedContainer').innerHTML;
    assert.ok(minimalResolved.includes('Εγκρίθηκε βάσει παλιότερης απόφασης HR'));
    assert.ok(minimalResolved.includes('Ανάκληση πολιτικής'));
    assert.ok(!minimalResolved.includes('hr-review-decision-btn'));
    assert.ok(!minimalResolved.includes('hr-review-apply-btn'));
    clearMinimalRenderElements();
    elementsById.delete('ypokatasthmata_stathera');
}

async function testAtomicReusableSubmitUsesGenericApprovalContract() {
    const projection = readyProjection();
    const group = projection.groups[0];
    let submitted = null;
    const saved = snapshotSandboxFunctions([
        'confirmPolicyPreviewDecision',
        'getPolicyPreviewCsrfToken',
        'refreshPolicyPreviewApprovals',
        'fetchPolicyPreviewGrouping',
        'attachPolicyPreviewResults',
        'renderCurrentReviewRows',
        'renderPolicyPreviewGroups',
        'fetch'
    ]);
    const savedSwal = sandbox.Swal;
    try {
        vm.runInContext("currentPolicyPreviewBaseParams = new URLSearchParams('apo_hmeromhnia=2026-07-01&eos_hmeromhnia=2026-07-31&ypokatasthma=0001')", sandbox);
        vm.runInContext('currentPolicyPreviewGrouping = { scope: "page" }; currentReviewRows = []', sandbox);
        sandbox.confirmPolicyPreviewDecision = async (_group, decisionType, options) => {
            assert.strictEqual(decisionType, 'APPROVE_PROPOSAL');
            assert.strictEqual(options.forceAtomicReuse, true);
            return { notes: 'future atomic', reuseScope: 'FUTURE_IDENTICAL' };
        };
        sandbox.getPolicyPreviewCsrfToken = async () => 'csrf';
        sandbox.refreshPolicyPreviewApprovals = async () => {};
        sandbox.fetchPolicyPreviewGrouping = async () => ({
            grouping: { scope: 'page', groups: [] },
            previewRows: [],
            atomicGroupProjection: projection
        });
        sandbox.attachPolicyPreviewResults = () => {};
        sandbox.renderCurrentReviewRows = () => {};
        sandbox.renderPolicyPreviewGroups = () => {};
        sandbox.Swal = { fire: async () => ({ isConfirmed: true }) };
        sandbox.fetch = async (url, options) => {
            assert.strictEqual(url, '/api/prodhlomena-oraria/review/policies/approvals');
            submitted = JSON.parse(options.body);
            return { ok: true, status: 201, json: async () => ({ success: true }) };
        };
        await sandbox.submitPolicyPreviewDecision(group, 'APPROVE_PROPOSAL', {
            forceAtomicReuse: true
        });
        assert.strictEqual(submitted.group.decision_grain, 'ATOMIC_LINKED_SET');
        assert.strictEqual(submitted.group.group_type, 'ATOMIC_PAIRED_PROPOSAL');
        assert.strictEqual(submitted.decision_type, 'APPROVE_PROPOSAL');
        assert.strictEqual(submitted.reuse_scope, 'FUTURE_IDENTICAL');
        assert.deepStrictEqual(submitted.items.map((item) => item.prodhlomena_oraria_id),
            ['507f1f77bcf86cd799439021', '507f1f77bcf86cd799439022']);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(submitted, 'reuse_fingerprint'), false);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(submitted, 'reuse_match_criteria'), false);
    } finally {
        sandbox.Swal = savedSwal;
        restoreSandboxFunctions(saved);
    }
}

async function testAtomicReusableConfirmationUsesApproveProposalLabel() {
    const group = readyProjection().groups[0];
    const savedSwal = sandbox.Swal;
    let modalOptions = null;
    try {
        sandbox.Swal = {
            getPopup: () => ({
                querySelector: (selector) => selector === '#policyPreviewDecisionNotes'
                    ? { value: '' }
                    : null
            }),
            fire: async (options) => {
                modalOptions = options;
                return { isConfirmed: true, value: options.preConfirm() };
            }
        };

        const result = await sandbox.confirmPolicyPreviewDecision(
            group,
            'APPROVE_PROPOSAL',
            { forceAtomicReuse: true }
        );

        assert.ok(modalOptions.html.includes('Έγκριση πρότασης'));
        assert.ok(!modalOptions.html.includes('Άγνωστη απόφαση'));
        assert.ok(modalOptions.html.includes('policyPreviewReuseFutureIdentical'));
        assert.strictEqual(result.reuseScope, 'FUTURE_IDENTICAL');
    } finally {
        sandbox.Swal = savedSwal;
    }
}

function testUnifiedEmploymentReviewWorkspaceContract() {
    assert.strictEqual((viewSource.match(/id="employmentReviewWorkspace"/g) || []).length, 1);
    assert.ok(!viewSource.includes('id="hrReviewWorkspace"'));
    assert.ok(!viewSource.includes('id="advancedReviewWorkspace"'));
    assert.strictEqual((viewSource.match(/employment-review-card z-depth-5/g) || []).length, 1);
    ['Έναρξη ελέγχου', 'Αναλυτική προβολή', 'Επιστροφή στον απλό έλεγχο']
        .forEach((text) => assert.ok(!viewSource.includes(text)));
    ['apo_hmeromhnia', 'eos_hmeromhnia', 'ypokatasthma', 'kodikos',
        'reviewEmployee', 'searchBtn', 'exportExcelBtn', 'exportPdfBtn',
        'resultsTable']
        .forEach((id) => assert.strictEqual((viewSource.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id));
    assertContains(viewSource, ['Εξαγωγή Excel', 'Εξαγωγή PDF', 'Εργαζόμενος']);
    ['only_apologistiko', 'only_nyxta', 'only_argia', 'only_yperergasia',
        'scenarioRequiresReviewOnly'].forEach((id) => assert.ok(!viewSource.includes(`id="${id}"`)));
    assert.ok(!viewSource.includes('Export Excel'));
    assert.ok(!viewSource.includes('Export PDF'));
}

function testMinimalWorkspaceEjsContract() {
    testUnifiedEmploymentReviewWorkspaceContract();
    assert.ok(viewSource.includes('initYpokatasthmataDropdowns.js'));
    assert.ok(!viewSource.includes('id="ypokatasthmata"'));
    assert.ok(!branchDropdownSource.includes('SIMPLE_ID'));
    assert.ok(branchDropdownSource.includes("const REVIEW_BRANCH_ID = 'ypokatasthma'"));
}

function testEmploymentReviewScrollContainerContract() {
    assert.ok(/\.employment-review-page-shell\s*\{[^}]*display:\s*grid[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)[^}]*overflow:\s*hidden/s.test(cssSource));
    assert.ok(/\.employment-review-card\s*\{[^}]*display:\s*flex[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s.test(cssSource));
    assert.ok(/\.review-card-body\s*\{[^}]*display:\s*flex[^}]*flex:\s*1 1 auto[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s.test(cssSource));
    assert.ok(/\.employment-review-scroll-container\s*\{[^}]*flex:\s*1 1 auto[^}]*min-height:\s*0[^}]*overflow:\s*auto/s.test(cssSource));
    assert.ok(!cssSource.includes('--employment-review-viewport-offset'));
    assert.ok(/\.employment-review-scroll-container #resultsTable\s*\{[^}]*min-width:\s*89\.25rem/s.test(cssSource));
    assert.ok(/\.employment-review-scroll-container #resultsTable thead th\s*\{[^}]*position:\s*sticky/s.test(cssSource));
    const colgroupMarkup = viewSource.match(/<colgroup class="employment-review-results-columns">[\s\S]*?<\/colgroup>/)?.[0] || '';
    assert.strictEqual((colgroupMarkup.match(/<col\b/g) || []).length, 13);
    const tableHeadMarkup = (viewSource.match(/id="resultsTable"[\s\S]*?<thead[\s\S]*?<tr>([\s\S]*?)<\/tr>/)?.[1] || '')
        .replace(/<!--[\s\S]*?-->/g, '');
    const headers = Array.from(tableHeadMarkup.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g))
        .map((match) => getVisibleText(match[1]));
    assert.deepStrictEqual(headers, ['Ημ/νία', 'Παράρτημα', 'Κωδικός', 'Προδηλωμένο',
        'Κάρτες', 'Απολογιστικό', 'Ώρες', 'Απουσίες', 'Νύχτα', 'Αργία',
        'Πρόσθ.', 'Υπερεργ.', 'Υπερωρ.']);
    assert.ok(!/createElement\(['"]th['"]\)[\s\S]{0,400}Απουσίες/.test(source));
}

function testWeeklyHrReasonPresentationIsGreekAndSafe() {
    const messages = sandbox.reviewHrReasonMessages([
        'CARD_VERIFICATION_PENDING',
        'MULTIPLE_TARGET_CANDIDATES',
        'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC',
        'CARD_VERIFICATION_PENDING',
        'OPEN_WEEK_PENDING_COMPLETION',
        'NO_SOURCE_CANDIDATE',
        'UNKNOWN_INTERNAL_REASON_CODE'
    ]);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(messages)), [
        'Εκκρεμεί επιβεβαίωση των στοιχείων της κάρτας εργασίας.',
        'Βρέθηκαν περισσότερες από μία πιθανές ημέρες για τη μεταφορά του ρεπό και απαιτείται επιλογή.',
        'Δεν μπορούν να προσδιοριστούν με βεβαιότητα οι ημέρες ανάπαυσης/ρεπό της εβδομάδας και απαιτείται έλεγχος.',
        'Απαιτείται έλεγχος της περίπτωσης.'
    ]);
    const html = sandbox.renderReviewHrReasonList(messages);
    ['CARD_VERIFICATION_PENDING', 'MULTIPLE_TARGET_CANDIDATES',
        'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC', 'UNKNOWN_INTERNAL_REASON_CODE',
        'OPEN_WEEK_PENDING_COMPLETION', 'NO_SOURCE_CANDIDATE']
        .forEach((code) => assert.ok(!getVisibleText(html).includes(code)));
    assert.strictEqual((html.match(/<li>/g) || []).length, 4);
    assert.strictEqual(sandbox.looksLikeInternalReviewCode('PDF'), false);
    assert.strictEqual(sandbox.looksLikeInternalReviewCode('ΕΡΓΑΝΗ II'), false);
}

function testOpenWeekAndDeviationNotesStayHrSafe() {
    assert.strictEqual(sandbox.isHrVisibleDeviation({
        status: 'OPEN_WEEK_PENDING_COMPLETION'
    }), false);
    assert.strictEqual(sandbox.renderDeviationNoteCell({
        status: 'OPEN_WEEK_PENDING_COMPLETION',
        week_apo: '2026-08-10',
        week_eos: '2026-08-16'
    }), '');

    const humanNote = 'Επιβεβαιώστε την πραγματική ημέρα ανάπαυσης.';
    const legacyHuman = sandbox.renderDeviationNoteCell({
        is_legacy_policy: true,
        note: humanNote
    });
    assert.ok(legacyHuman.includes(humanNote));
    assert.ok(!sandbox.renderDeviationNoteCell({
        is_legacy_policy: true,
        note: 'UNKNOWN_PRIVATE_REASON_CODE'
    }).includes('UNKNOWN_PRIVATE_REASON_CODE'));
    assert.ok(!sandbox.renderDeviationNoteCell({
        profile_changed_inside_week: true,
        note: 'UNKNOWN_PRIVATE_REASON_CODE'
    }).includes('UNKNOWN_PRIVATE_REASON_CODE'));
}

function testWeeklyDeviationUsesAuthoritativePresentationReasons() {
    const resolvedHtml = sandbox.renderDeviationNoteCell({
        status: 'READY',
        sixth_day_date: '2026-06-14',
        presentation_reasons: ['CARD_VERIFICATION_PENDING'],
        repo_transfer_reasons: ['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC']
    });
    const resolvedText = getVisibleText(resolvedHtml);
    assert.ok(resolvedText.includes('6η ημέρα: Κυ 14/06/2026'));
    assert.ok(resolvedText.includes(
        'Εκκρεμεί επιβεβαίωση των στοιχείων της κάρτας εργασίας.'));
    assert.ok(!resolvedText.includes(
        'Δεν μπορούν να προσδιοριστούν με βεβαιότητα οι ημέρες ανάπαυσης/ρεπό'));

    const unresolvedText = getVisibleText(sandbox.renderDeviationNoteCell({
        status: 'NEEDS_HR_DECISION',
        presentation_reasons: ['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC']
    }));
    assert.ok(unresolvedText.includes(
        'Δεν μπορούν να προσδιοριστούν με βεβαιότητα οι ημέρες ανάπαυσης/ρεπό'));

    const staleText = getVisibleText(sandbox.renderDeviationNoteCell({
        status: 'NEEDS_HR_DECISION',
        presentation_reasons: [
            'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC',
            'CANONICAL_DECISION_STALE'
        ]
    }));
    assert.ok(staleText.includes(
        'Η προηγούμενη απόφαση χρειάζεται επανέλεγχο επειδή άλλαξαν τα δεδομένα'));
}

function testScenarioDetailsNeverExposeReasonCodes() {
    const html = sandbox.renderScenarioDetailsSection({
        scenarioDecision: {
            scenario_code: 'UNKNOWN_PATTERN_REQUIRES_REVIEW',
            confidence: 'HIGH',
            decision_status: 'NEEDS_REVIEW',
            requires_review: true,
            reasons: ['CARD_VERIFICATION_PENDING', 'UNKNOWN_PRIVATE_REASON_CODE'],
            warnings: ['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC']
        }
    });
    const visibleText = getVisibleText(html);
    assertContains(visibleText, [
        'Εκκρεμεί επιβεβαίωση των στοιχείων της κάρτας εργασίας.',
        'Δεν μπορούν να προσδιοριστούν με βεβαιότητα οι ημέρες ανάπαυσης/ρεπό της εβδομάδας και απαιτείται έλεγχος.',
        'Απαιτείται έλεγχος της περίπτωσης.'
    ]);
    ['CARD_VERIFICATION_PENDING', 'UNKNOWN_PRIVATE_REASON_CODE',
        'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC']
        .forEach((code) => assert.ok(!visibleText.includes(code)));
}

function testEmploymentReviewFinalUiContract() {
    testUnifiedEmploymentReviewWorkspaceContract();
    assert.strictEqual((viewSource.match(/id="employmentPeriodControlPanel"/g) || []).length, 1);
    assert.ok(viewSource.indexOf('id="employmentPeriodControlPanel"') < viewSource.indexOf('id="employmentReviewWorkspace"'));
    assert.ok(source.includes("workspace: 'UNIFIED'"));
    assert.ok(source.includes("HISTORICAL_RECONSTRUCTION_REQUIRED: 'ΕΚΠΡΟΘΕΣΜΗ — ΧΩΡΙΣ ΟΡΙΣΤΙΚΟΠΟΙΗΜΕΝΟ ΑΠΟΤΕΛΕΣΜΑ'"));
    assert.ok(!sandbox.renderAtomicRepoTransferSummary({ summary: { weeks_evaluated: 200 } }).includes('200'));
}

function testSharedLifecyclePanelAndActiveWorkspaceScopeContract() {
    const lifecycleIds = ['employmentPeriodControlPanel', 'lockEmploymentPeriodBtn',
        'historicalReconstructionBtn', 'unlockEmploymentPeriodBtn', 'finalizeEmploymentPeriodBtn',
        'submitFinalWTODayilyABtn', 'openCorrectivePayrollBtn', 'calculateCorrectivePayrollBtn',
        'closeCorrectivePayrollBtn', 'postCorrectivePayrollBtn'];
    lifecycleIds.forEach((id) => assert.strictEqual((viewSource.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id));
    assert.ok(!viewSource.includes('Η XML ενέργεια αποτελεί προεπισκόπηση'));
    assert.ok(!source.includes('Η κανονική εκτέλεση παραμένει κλειστή'));
    assert.ok(source.includes("document.getElementById('employmentHistoricalReconstructionMeta')?.classList.toggle"));
    const setValue = (id, value) => elementsById.set(id, { value });
    setValue('apo_hmeromhnia', '2026-06-01'); setValue('eos_hmeromhnia', '2026-06-30');
    setValue('ypokatasthma_stathera_advanced', '0000');
    const scope = sandbox.getActiveEmploymentReviewScope();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(scope)), { workspace: 'UNIFIED', apo_hmeromhnia: '2026-06-01', eos_hmeromhnia: '2026-06-30', ypokatasthma: '0000' });
}

function testEmploymentReviewBranchActionLayoutContract() {
    testUnifiedEmploymentReviewWorkspaceContract();
    assert.ok(viewSource.includes('class="col-md-4 employment-review-advanced-branch"'));
    assert.ok(viewSource.includes('employment-review-search-actions'));
    assert.ok(!viewSource.includes('id="hrReviewStartBtn"'));
}

function testResponsiveSharedShellAndCompactHistoricalModalContract() {
    assert.ok(/\.historical-reconstruction-swal\s*\{[^}]*width:\s*min\(600px, calc\(100vw - 2rem\)\)[^}]*max-width:\s*min\(620px, calc\(100vw - 2rem\)\)/s.test(cssSource));
    assert.ok(/\.historical-reconstruction-swal__reason\s*\{[^}]*min-height:\s*4\.5rem[^}]*height:\s*5rem[^}]*max-height:\s*5\.625rem/s.test(cssSource));
    assert.ok(source.includes("popup: 'historical-reconstruction-swal'"));
    assert.ok(source.includes("input: 'historical-reconstruction-swal__reason'"));
    assert.ok(source.includes('Η περίοδος έχει λήξει. Η ανακατασκευή δεν αλλάζει την εκπρόθεσμη κατάστασή της'));
    assert.ok(source.includes("inputValidator: value => String(value || '').trim()"));
}

function testRoleScopedRenderedEjs() {
    ['A', 'S', 'HR'].forEach((role) => {
        const html = renderViewForRole(role);
        assert.strictEqual((html.match(/id="employmentReviewWorkspace"/g) || []).length, 1);
        assert.ok(html.includes('id="resultsTable"'));
        assert.ok(html.includes('id="ypokatasthma"'));
        assert.ok(!html.includes('id="hrReviewWorkspace"'));
        assert.ok(!html.includes('id="advancedReviewWorkspace"'));
        assert.deepStrictEqual(duplicateIds(html), [], `${role} rendered duplicate IDs`);
    });
    const unknown = renderViewForRole('UNKNOWN');
    assert.ok(!unknown.includes('id="employmentReviewWorkspace"'));
    assert.ok(unknown.includes('Δεν έχετε δικαίωμα χρήσης του ελέγχου απασχολήσεων.'));
    assert.deepStrictEqual(duplicateIds(unknown), []);
}

const tests = [
    testWeeklyResolutionShowsRepoAndSixthDayFacts,
    testSixthDayCardsBadgeShowsApplicableRate,
    testSixthDayCardsBadgeUsesWeeklyLifecycleRateIncludingZero,
    testCompletedSingleDayNoActionHidesPossibleLeaveOnlyFromPresentation,
    testPersistedRepoCategoryOverridesDerivedLeave,
    testStage1DailyClassificationPresentationPriority,
    testPossibleLeaveResolverAndModalPresentationContract,
    testPossibleLeaveValidationAndTomSelectCheckboxContract,
    testAutoCalculatedAndHrDeclaredLeaveHaveDistinctPresentation,
    testContractualEmploymentTypeWinsOverOperationalPhaseForRestDisplay,
    testPersistedAnWithCardsIsNotBlanketRepoPresentation,
    testFullTimeDeclaredWorkWithCardsNeverDisplaysPersistedNonWork,
    testAppliedTargetRowOverridesGenericPendingBadgeOnlyForExactRow,
    testDeclaredRepoPresentationDistinguishesNeutralWorkAndAppliedStates,
    testDeclaredNonWorkStaysOnlyInDeclaredColumn,
    testEmployeeGroupsUseAccessibleSingleOpenAccordion,
    testAppliedHistoryRendersWithoutCurrentProjectionGroup,
    testReadyFullTimeAndSplitShift,
    testNoTargetFallbackIsInformationalOnly,
    testNoTargetGuidanceComesOnlyFromServer,
    testBlockedTargetOutcomeIsDistinctAndReadOnly,
    testCardConflictedTargetOutcomeIsSpecificAndReadOnly,
    testBlockedTargetCandidateDetailsAreSafeAndScoped,
    testGroupsAndReviewOutcomesRenderSeparateSafetyMessages,
    testCompleteVisibleSectionContainsNoTechnicalTerms,
    testPartTimeTargetIsNotAnError,
    testEmptyFirstIntervalDoesNotCompactSecond,
    testReadOnlySafety,
    testServerDerivedRepoTransferPermissionsAndRoleVisibility,
    testConfidenceAndDecisionTerminology,
    testResolvedUnscheduledWorkDoesNotRenderReviewBadge,
    testBranchRequiredForDecisionButtons,
    testAllBranchSkipsDecisionRequests,
    testOnlyCurrentDecisionDisablesButtons,
    testBatchHistoryUsesOneFetchForManyGroups,
    testCurrentAndPreviousHistoryAreEscaped,
    testAdvancedStaleDecisionRequiresNewDecisionWithoutApply,
    testApplyPresentationStatesAndSafetyContract,
    testImmediatePostApplyRefreshKeepsBadgeForTemporaryOldGroup,
    testEscaping,
    testDiagnostics,
    testUnknownDiagnosticUsesSafeFallbackAndStableLabelOrdering,
    testPartialFamilyDiagnosticsHaveSpecificGreekLabels,
    testEmptyProjection,
    testRepoTransferStatusAndSafeMarkup,
    testScopedSemanticButtonCss,
    testEmployeeWeekEvaluationLabel,
    testProposalDateRangeWording,
    testGenericIsolationSourceContract,
    testAtomicStateSurvivesGenericRerenderAndClearsOnRequestState,
    testPolicyDecisionAccordionIsCompactAndDecisionOnly,
    testResolvedInheritedGroupOffersOnlySharedPolicyRevoke,
    testRevokedReusableHistoryDoesNotBlockNewApproval,
    testMinimalWorkspaceEjsContract,
    testEmploymentReviewScrollContainerContract,
    testWeeklyHrReasonPresentationIsGreekAndSafe,
    testOpenWeekAndDeviationNotesStayHrSafe,
    testWeeklyDeviationUsesAuthoritativePresentationReasons,
    testScenarioDetailsNeverExposeReasonCodes,
    testAllKnownBackendGroupingCodesHaveGreekLabels,
    testCategoryPresentationKeepsDeclaredDisplayedAndProposedDistinct,
    testOpenAndCompletedPartialWeekMessagesStayDistinct,
    testWeeklyDeviationPresentationUsesMondaySundayPolicy,
    testEmploymentReviewFinalUiContract,
    testSharedLifecyclePanelAndActiveWorkspaceScopeContract,
    testCorrectiveDropdownAndPageShellContract,
    testEmploymentReviewBranchActionLayoutContract,
    testResponsiveSharedShellAndCompactHistoricalModalContract,
    testRoleScopedRenderedEjs,
    testHrQueueClassification,
    testMinimalRenderingAndTerminology,
    testMinimalCompletionAndClosedCompletedSection,
    testMinimalStaleDecisionRemainsPending,
    testStaleNoticesDoNotLeakIntoOtherStates,
    testMinimalSafetySourceContracts,
    testPreAndPostCalculationWorkflowGating,
    testPreCalculationCanonicalDecisionEntryGuard,
    testLightweightHrLoadingRequests,
    testHrDecisionPresentationAndLocalRerender,
    testHrDecisionCancelAndEmptyNoteDoNotPost,
    testHrApproveAndRejectPostPaths,
    testHrPostSuccessRefreshFailureWarning,
    testHrLoadingLocksAndRestoresFilters,
    testAtomicReusablePendingResolvedAndConflictUi,
    testAtomicReusableConfirmationUsesApproveProposalLabel,
    testAtomicReusableSubmitUsesGenericApprovalContract,
    testApplyPostSuccessAndRefreshSuccess,
    testApplyPostSuccessAndRefreshFailure,
    testApplyServerAndNetworkFailures,
    testApplyDoubleClickUsesOnePost,
    testApplyRetryKeepsRequestIdAfterNetworkUncertainty
];

async function run() {
    for (const test of tests) await test();
    console.log(`PASS atomic repo-transfer read-only UI (${tests.length} tests)`);
}
run().catch((error) => { console.error(error); process.exitCode = 1; });

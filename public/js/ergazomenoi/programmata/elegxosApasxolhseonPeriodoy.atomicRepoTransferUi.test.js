const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const cssPath = path.join(__dirname, '..', '..', '..', 'css', 'main.css');
const cssSource = fs.readFileSync(cssPath, 'utf8');
const elementsById = new Map();
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
    setTimeout: () => {},
    clearTimeout: () => {}
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: sourcePath });

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
                status: 'NEEDS_REVIEW',
                title: 'Μεταφορά ρεπό εντός εβδομάδας',
                description: 'Ασφαλής πρόταση για ανθρώπινο έλεγχο.',
                first_date: '2026-07-06',
                last_date: '2026-07-09',
                count: 2,
                decision_units_count: 1,
                warnings: [],
                items: [
                    {
                        role: 'SOURCE_BECOMES_WORK',
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

function getVisibleText(html) {
    return String(html || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function testReadyFullTimeAndSplitShift() {
    const html = render(readyProjection());
    assertContains(html, [
        'Προτάσεις Μεταφοράς Ρεπό',
        'Μόνο για έλεγχο',
        'Πρόταση προς έλεγχο από HR',
        'Η πρόταση μεταφοράς ρεπό περιλαμβάνει δύο συνδεδεμένες αλλαγές',
        'Η πρόταση εμφανίζεται μόνο για έλεγχο',
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
    assert.ok(visibleText.includes('Η πρόταση εμφανίζεται μόνο για έλεγχο'));
    assert.ok(visibleText.includes('Συνδεδεμένη πρόταση μεταφοράς ρεπό'));
    assert.ok(visibleText.includes('Η εφαρμογή της πρότασης δεν είναι ακόμη διαθέσιμη'));
}

function testPartTimeTargetIsNotAnError() {
    const html = render(readyProjection({ targetCategory: 'ΜΕ' }));
    assertContains(html, ['Πρόταση', 'ΜΕ']);
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
        'policy-preview-decision-btn',
        'policy-preview-approval-panel',
        'Αποθήκευση',
        'Εφαρμογή'
    ].forEach((value) => assert.ok(!html.includes(value), `Forbidden atomic HTML: ${value}`));
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
        INVALID_MHNIAIA_REPO: 2,
        MULTIPLE_SOURCE_CANDIDATES: 1
    };
    projection.warning_counts = { TARGET_ZERO_HOURS_WITH_CARD_INTERVALS: 1 };
    const html = render(projection);
    const visibleText = getVisibleText(html);

    assertContains(html, [
        'Περιπτώσεις χωρίς αυτόματη πρόταση',
        'Για τις παρακάτω περιπτώσεις δεν δημιουργήθηκε ασφαλής πρόταση μεταφοράς ρεπό:',
        '8 περιπτώσεις: Το επιλεγμένο διάστημα δεν περιλαμβάνει ολόκληρη εβδομάδα.',
        '7 περιπτώσεις: Δεν βρέθηκε ημέρα ρεπό κατά την οποία ο εργαζόμενος απασχολήθηκε.',
        '6 περιπτώσεις: Η προτεινόμενη αλλαγή δεν αποκαθιστά τον απαιτούμενο αριθμό ρεπό.',
        '5 περιπτώσεις: Δεν υπάρχουν πλήρη στοιχεία για ολόκληρη την εβδομάδα.',
        '4 περιπτώσεις: Η εκ περιτροπής απασχόληση δεν υποστηρίζεται ακόμη από την αυτόματη διαδικασία.',
        '3 περιπτώσεις: Δεν βρέθηκε διαθέσιμη ημέρα για τη μεταφορά του ρεπό.',
        '2 περιπτώσεις: Ο προβλεπόμενος αριθμός εβδομαδιαίων ρεπό δεν είναι έγκυρος.',
        '1 περίπτωση: Βρέθηκαν περισσότερες από μία πιθανές ημέρες εργασίας σε δηλωμένο ρεπό και απαιτείται επιλογή.',
        'μηδενικές συνολικές ώρες αλλά περιέχει στοιχεία καρτών'
    ]);

    assert.ok(!visibleText.includes('Διαγνωστικοί κωδικοί'));
    Object.keys(projection.reason_counts).forEach((code) => {
        assert.ok(!visibleText.includes(code), `Raw diagnostic code is visible: ${code}`);
    });
    assert.ok(!visibleText.includes('TARGET_ZERO_HOURS_WITH_CARD_INTERVALS'));

    const orderedLabels = [
        '8 περιπτώσεις:',
        '7 περιπτώσεις:',
        '6 περιπτώσεις:',
        '5 περιπτώσεις:',
        '4 περιπτώσεις:',
        '3 περιπτώσεις:',
        '2 περιπτώσεις:',
        '1 περίπτωση:'
    ];
    orderedLabels.reduce((previousIndex, label) => {
        const currentIndex = visibleText.indexOf(label);
        assert.ok(currentIndex > previousIndex, `Unexpected diagnostic order for: ${label}`);
        return currentIndex;
    }, -1);
}

function testUnknownDiagnosticUsesSafeFallbackAndStableLabelOrdering() {
    const projection = readyProjection();
    projection.reason_counts = {
        FUTURE_PRIVATE_DIAGNOSTIC: 3,
        NO_TARGET_CANDIDATE: 3
    };
    const visibleText = getVisibleText(render(projection));

    assert.ok(!visibleText.includes('FUTURE_PRIVATE_DIAGNOSTIC'));
    assert.ok(visibleText.includes('3 περιπτώσεις: Άλλη περίπτωση που χρειάζεται έλεγχο.'));
    assert.ok(
        visibleText.indexOf('Άλλη περίπτωση που χρειάζεται έλεγχο.') <
            visibleText.indexOf('Δεν βρέθηκε διαθέσιμη ημέρα για τη μεταφορά του ρεπό.')
    );
}

function testEmptyProjection() {
    const projection = readyProjection();
    projection.groups = [];
    projection.summary.groups_count = 0;
    projection.summary.decision_units_count = 0;
    const html = render(projection);

    assertContains(html, ['Δεν δημιουργήθηκε αυτόματη πρόταση.']);
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
    assert.ok(cssSource.includes('--policy-preview-button-hover-bg: #9ec5fe;'));
    assert.ok(cssSource.includes('--policy-preview-button-bg: #d1e7dd;'));
    assert.ok(cssSource.includes('--policy-preview-button-hover-bg: #a3cfbb;'));
    assert.ok(cssSource.includes('--policy-preview-button-bg: #fff3cd;'));
    assert.ok(cssSource.includes('--policy-preview-button-hover-bg: #ffe69c;'));
    assert.ok(cssSource.includes('--policy-preview-button-bg: #f8d7da;'));
    assert.ok(cssSource.includes('--policy-preview-button-hover-bg: #f1aeb5;'));
    assert.ok(cssSource.includes('--policy-preview-button-bg: #e2e3e5;'));
    assert.ok(cssSource.includes('--policy-preview-button-hover-bg: #c4c8cb;'));
    assert.ok(cssSource.includes('color: #000000 !important;'));
    assert.ok(cssSource.includes('#policyPreviewGroupsContainer .btn:focus-visible'));
    assert.ok(cssSource.includes('#policyPreviewGroupsContainer .btn:disabled'));
    assert.ok(cssSource.includes('cursor: not-allowed;'));
    assert.ok(!cssSource.includes('style="'));
}

function testEmployeeWeekEvaluationLabel() {
    const html = render(readyProjection());
    assert.ok(html.includes('Εβδομάδες εργαζομένων που αξιολογήθηκαν'));
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
    assert.ok(!atomicSource.includes('submitPolicyPreviewDecision'));
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

const tests = [
    testReadyFullTimeAndSplitShift,
    testCompleteVisibleSectionContainsNoTechnicalTerms,
    testPartTimeTargetIsNotAnError,
    testEmptyFirstIntervalDoesNotCompactSecond,
    testReadOnlySafety,
    testEscaping,
    testDiagnostics,
    testUnknownDiagnosticUsesSafeFallbackAndStableLabelOrdering,
    testEmptyProjection,
    testRepoTransferStatusAndSafeMarkup,
    testScopedSemanticButtonCss,
    testEmployeeWeekEvaluationLabel,
    testProposalDateRangeWording,
    testGenericIsolationSourceContract,
    testAtomicStateSurvivesGenericRerenderAndClearsOnRequestState
];

tests.forEach((test) => test());
console.log(`PASS atomic repo-transfer read-only UI (${tests.length} tests)`);

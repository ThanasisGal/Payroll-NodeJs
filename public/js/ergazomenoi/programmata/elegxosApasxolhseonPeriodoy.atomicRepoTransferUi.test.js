const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js');
const source = fs.readFileSync(sourcePath, 'utf8');
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

function testReadyFullTimeAndSplitShift() {
    const html = render(readyProjection());
    assertContains(html, [
        'Προτάσεις Μεταφοράς Ρεπό',
        'ΜΟΝΟ ΠΡΟΒΟΛΗ',
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
    assertContains(html, ['&lt;script&gt;', '&lt;img', '&lt;b&gt;001&lt;/b&gt;', '&lt;svg&gt;']);
}

function testDiagnostics() {
    const projection = readyProjection();
    projection.reason_counts = {
        ATOMIC_DATE_RANGE_EXCEEDS_LIMIT: 1,
        EMPLOYMENT_PROFILE_NOT_RESOLVED: 1,
        INCOMPLETE_EMPLOYEE_WEEK: 1,
        ATOMIC_HOLIDAY_CONTEXT_NOT_RESOLVED: 1,
        INVALID_MHNIAIA_REPO: 1
    };
    projection.warning_counts = { TARGET_ZERO_HOURS_WITH_CARD_INTERVALS: 1 };
    const html = render(projection);

    assertContains(html, [
        'έως 62 ημερολογιακές ημέρες',
        'δεν περιέχονταν πλήρως',
        'δεν επιλύθηκε με ασφάλεια το εργασιακό προφίλ',
        'πλήρες πλαίσιο αργιών',
        'τα αναμενόμενα εβδομαδιαία ρεπό δεν ήταν διαθέσιμα ως 1 ή 2',
        'μηδενικές συνολικές ώρες αλλά περιέχει στοιχεία καρτών'
    ]);
}

function testEmptyProjection() {
    const projection = readyProjection();
    projection.groups = [];
    projection.summary.groups_count = 0;
    projection.summary.decision_units_count = 0;
    const html = render(projection);

    assertContains(html, [
        'Δεν βρέθηκαν ασφαλείς προτάσεις μεταφοράς ρεπό για τις πλήρεις εβδομάδες'
    ]);
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
    testPartTimeTargetIsNotAnError,
    testEmptyFirstIntervalDoesNotCompactSecond,
    testReadOnlySafety,
    testEscaping,
    testDiagnostics,
    testEmptyProjection,
    testEmployeeWeekEvaluationLabel,
    testProposalDateRangeWording,
    testGenericIsolationSourceContract,
    testAtomicStateSurvivesGenericRerenderAndClearsOnRequestState
];

tests.forEach((test) => test());
console.log(`PASS atomic repo-transfer read-only UI (${tests.length} tests)`);

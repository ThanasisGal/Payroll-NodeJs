const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ejs = require('ejs');
const { execFileSync } = require('child_process');

const sourcePath = path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const viewPath = path.join(__dirname, '..', '..', '..', '..', 'views', 'ergazomenoi', 'programmata', 'elegxosApasxolhseonPeriodoy.ejs');
const viewSource = fs.readFileSync(viewPath, 'utf8');
const cssPath = path.join(__dirname, '..', '..', '..', 'css', 'main.css');
const cssSource = fs.readFileSync(cssPath, 'utf8');
const dropdownHelperPath = path.join(__dirname, '..', '..', '..', 'js', 'dropdown-item.js');
const dropdownHelperSource = fs.readFileSync(dropdownHelperPath, 'utf8');
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

function setRepoTransferPermissions({ decision, apply } = {}) {
    if (decision === undefined) elementsById.delete('canRecordRepoTransferDecision');
    else elementsById.set('canRecordRepoTransferDecision', { value: decision ? '1' : '0' });
    if (apply === undefined) elementsById.delete('canApplyRepoTransferDecision');
    else elementsById.set('canApplyRepoTransferDecision', { value: apply ? '1' : '0' });
}

setRepoTransferPermissions({ decision: true, apply: true });

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
    assert.ok(viewSource.includes("['A', 'S'].includes(normalizedUserRole)"));
    assert.ok(viewSource.includes('id="canReviewEdit"'));
    assert.ok(!viewSource.includes('id="currentUserRole"'));
    assert.ok(!viewSource.includes('id="userRole"'));
    assert.ok(!source.includes('userCanRecordRepoTransferDecision() {\n    return userCanReviewEdit()'));
    assert.ok(!source.includes('userCanApplyRepoTransferDecision() {\n    return userCanReviewEdit()'));

    vm.runInContext("currentPolicyPreviewBaseParams = new URLSearchParams('ypokatasthma=0000')", sandbox);
    for (const permissions of [
        { role: 'A', decision: true, apply: true },
        { role: 'S', decision: true, apply: true },
        { role: 'HR', decision: true, apply: false },
        { role: 'UNKNOWN', decision: false, apply: false }
    ]) {
        setRepoTransferPermissions(permissions);
        vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: 'READY_TO_APPLY', apply_allowed: true, current_decision: { id: '507f191e810c19729de860ea', decision_code: 'APPROVE_PROPOSAL', decision_status: 'RECORDED', is_current: true }, history: [] }]])", sandbox);
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
    assert.ok(source.includes('Η πρόταση δεν είναι διαθέσιμη για εφαρμογή στην παρούσα κατάσταση.'));
    assert.ok(!source.includes('<span>Δεν μπορεί να εφαρμοστεί</span>'));
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
    assert.strictEqual((currentHtml.match(/atomic-repo-transfer-decision-btn[^>]+disabled/g) || []).length, 3);
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
    assert.ok(html.includes('Προηγούμενες καταγεγραμμένες αποφάσεις'));
    assert.ok(html.includes('&lt;b&gt;HR&lt;/b&gt;'));
    assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<img src=x>'));
    assert.ok(!html.includes('<svg>'));
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
        vm.runInContext(`currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: '${applyState}', apply_allowed: ${applyState === 'READY_TO_APPLY'}, current_decision: { id: '507f191e810c19729de860ea', decision_code: 'APPROVE_PROPOSAL', decision_status: 'RECORDED', is_current: true }, history: [] }]])`, sandbox);
        const html = render(readyProjection());
        assert.ok(html.includes(text));
        assert.strictEqual(/atomic-repo-transfer-apply-btn[^>]+disabled/.test(html), applyState !== 'READY_TO_APPLY');
    });
    vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: 'ALREADY_APPLIED', current_execution: { applied_at: '2026-07-15T10:00:00.000Z' }, current_decision: { id: '507f191e810c19729de860ea', decision_code: 'APPROVE_PROPOSAL', is_current: true }, history: [] }]])", sandbox);
    const applied = render(readyProjection());
    assert.ok(applied.includes('Η πρόταση εφαρμόστηκε'));
    assert.ok(!applied.includes('atomic-repo-transfer-apply-btn'));
    vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: 'ALREADY_APPLIED', current_execution: { applied_at: '2026-07-16T11:00:00.000Z', created_by_user_name: '<Executor>' }, current_decision: null, history: [{ decision_code: 'APPROVE_PROPOSAL', created_by_user_name: '<HR>', is_current: false }] }]])", sandbox);
    const appliedWithoutCurrent = render(readyProjection());
    assert.ok(appliedWithoutCurrent.includes('Η πρόταση εφαρμόστηκε'));
    assert.ok(appliedWithoutCurrent.includes('16/07/2026'));
    assert.ok(!appliedWithoutCurrent.includes('atomic-repo-transfer-apply-btn'));
    assert.ok(appliedWithoutCurrent.includes('&lt;HR&gt;'));
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
    assert.ok(html.includes('Η πρόταση εφαρμόστηκε'));
    assert.ok(!html.includes('atomic-repo-transfer-apply-btn'));
    vm.runInContext('currentRepoTransferDecisionsByProposalId = new Map(); currentPolicyPreviewBaseParams = null', sandbox);
}

function applyGroup() {
    const projection = readyProjection();
    return projection.groups[0];
}

function setupApplyBehavior({ response, networkError, refreshError } = {}) {
    const calls = { post: 0, refresh: 0, render: 0, swal: [] };
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
        if (networkError) throw new Error('private network detail');
        return response || { ok: true, json: async () => ({ success: true, message: 'Ασφαλές μήνυμα επιτυχίας.' }) };
    };
    sandbox.getPolicyPreviewCsrfToken = async () => 'csrf-test';
    sandbox.refreshRepoTransferDecisions = async () => {
        calls.refresh++;
        if (refreshError) throw new Error('private refresh detail');
    };
    sandbox.renderPolicyPreviewGroups = () => { calls.render++; };
    vm.runInContext("currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { apply_state: 'READY_TO_APPLY' }]])", sandbox);
    return calls;
}

async function testApplyPostSuccessAndRefreshSuccess() {
    const calls = setupApplyBehavior();
    const button = { disabled: false };
    await sandbox.submitRepoTransferApply(applyGroup(), '507f191e810c19729de860ea', button);
    assert.strictEqual(calls.post, 1);
    assert.strictEqual(calls.refresh, 1);
    assert.strictEqual(calls.render, 1);
    assert.ok(calls.swal.some((call) => call.title === 'Η πρόταση εφαρμόστηκε' && call.icon === 'success'));
    assert.strictEqual(button.disabled, true);
}

async function testApplyPostSuccessAndRefreshFailure() {
    const calls = setupApplyBehavior({ refreshError: true });
    const button = { disabled: false };
    await sandbox.submitRepoTransferApply(applyGroup(), '507f191e810c19729de860eb', button);
    assert.strictEqual(calls.post, 1);
    assert.strictEqual(calls.refresh, 1);
    assert.ok(calls.swal.some((call) => call.title === 'Η πρόταση εφαρμόστηκε' && call.icon === 'warning' && call.text.includes('η προβολή δεν ανανεώθηκε')));
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
    assert.ok(networkCalls.swal.some((call) => call.title === 'Δεν εφαρμόστηκε η πρόταση' && call.text === 'Η εφαρμογή δεν ολοκληρώθηκε.'));
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
        currentHrReviewProjection = ${JSON.stringify(projection)};
        currentAtomicRepoTransferProjection = currentHrReviewProjection;
        currentHrReviewLoaded = true;
        currentPolicyPreviewBaseParams = new URLSearchParams('apo_hmeromhnia=2026-07-06&eos_hmeromhnia=2026-07-12&ypokatasthma=0000');
        currentRepoTransferDecisionsByProposalId = new Map();
        repoTransferDecisionSubmitting = false;
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
    assert.ok(viewSource.includes("const canUseAdvancedEmploymentReview = ['A', 'S'].includes(normalizedUserRole)"));
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
    assert.ok(/overflow-y\s*:\s*auto\s*;/.test(scrollCss));
    assert.ok(/overflow-x\s*:\s*hidden\s*;/.test(scrollCss));
    assert.ok(/max-height\s*:[^;]*(?:100vh|100dvh)/.test(scrollCss));

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
    assert.ok(cssSource.includes('width: calc(70% + 1.5rem) !important'));
    assert.ok(cssSource.includes('margin-left: 15%'));
    assert.ok(!/\.employment-review-card\s*\{[^}]*?(?:width|margin-(?:left|right)|--employment-review-(?:width|right))/s.test(cssSource));
    assert.ok(/@media \(max-width: 991\.98px\)[\s\S]*?\.employment-review-page-shell[\s\S]*?width:\s*100%[\s\S]*?margin-left:\s*0[\s\S]*?margin-right:\s*0/.test(cssSource));
    const shellCssStart = cssSource.indexOf('.employment-review-page-shell {');
    const shellCss = cssSource.slice(shellCssStart, cssSource.indexOf('}', shellCssStart));
    assert.ok(!/(?:transform|translate)\s*[:(]/.test(shellCss));
    assert.ok(!/#hrReviewStartBtn\s*\{[^}]*(?:transform|translate|position|margin)/s.test(cssSource));
    assert.ok(cssSource.includes('--employment-review-viewport-offset: 17rem'));
    assert.ok(cssSource.includes('--employment-review-viewport-offset: 25.5rem'));
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
    assert.ok(cssSource.includes('width: calc(70% + 1.5rem) !important'));
    assert.ok(!/\.hr-review-card\s*\{[^}]*max-width/s.test(cssSource));
    assert.ok(!/#hrReviewStartBtn\s*\{/s.test(cssSource));
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
    assert.ok(/column-gap:\s*0\.75rem/.test(gridCss));

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

    assert.ok(cssSource.includes('width: calc(70% + 1.5rem) !important'));
    assert.ok(cssSource.includes('.hr-review-card {\n    width: 100%;'));
    assert.ok(dropdownHelperSource.includes("ddEl.classList.add('place-below', 'maxh-limited')"));
    assert.ok(viewSource.includes('id="hrReviewStartBtn"'));
    assert.ok(source.includes("getElementById('hrReviewStartBtn')?.addEventListener('click', loadHrReviewQueue)"));
}

function testRoleScopedRenderedEjs() {
    const hr = renderViewForRole('HR');
    assert.ok(hr.includes('id="hrReviewWorkspace"'));
    assert.ok(!hr.includes('id="advancedReviewWorkspace"'));
    assert.ok(!hr.includes('id="resultsTable"'));
    assert.ok(!hr.includes('id="policyPreviewGroupsContainer"'));
    assert.ok(hr.includes('id="ypokatasthmata"'));
    assert.ok(hr.includes('initYpokatasthmataDropdowns.js'));

    ['A', 'S'].forEach((role) => {
        const html = renderViewForRole(role);
        assert.ok(html.includes('id="hrReviewWorkspace"'));
        assert.ok(html.includes('id="advancedReviewWorkspace"'));
        assert.ok(html.includes('id="resultsTable"'));
        assert.ok(html.includes('id="policyPreviewGroupsContainer"'));
        assert.ok(html.includes('id="ypokatasthmata"'));
        assert.ok(html.includes('initYpokatasthmataDropdowns.js'));
        assert.deepStrictEqual(duplicateIds(html), [], `${role} rendered duplicate IDs`);
    });

    const unknown = renderViewForRole('UNKNOWN');
    assert.ok(!unknown.includes('id="hrReviewWorkspace"'));
    assert.ok(!unknown.includes('id="advancedReviewWorkspace"'));
    assert.ok(!unknown.includes('id="ypokatasthmata"'));
    assert.ok(!unknown.includes('initYpokatasthmataDropdowns.js'));
    assert.ok(unknown.includes('Δεν έχετε δικαίωμα χρήσης του ελέγχου απασχολήσεων.'));
    assert.ok(!unknown.includes('hr-review-decision-btn'));
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
    vm.runInContext(`currentHrReviewProjection = ${JSON.stringify(projection)}; currentHrReviewLoaded = true; currentRepoTransferDecisionsByProposalId = new Map([['atomic-group-1', { current_decision: { decision_code: 'APPROVE_PROPOSAL', created_by_user_name: '<Admin>', notes: '<note>' } }]])`, sandbox);
    sandbox.classifyHrReviewGroups();
    sandbox.renderHrReviewWorkspace();
    const status = elementsById.get('hrReviewStatus').innerHTML;
    const completed = elementsById.get('hrReviewCompletedContainer').innerHTML;
    assert.ok(status.includes('Ο έλεγχος ολοκληρώθηκε'));
    assert.ok(completed.includes('<details'));
    assert.ok(!completed.includes('<details open'));
    assert.ok(completed.includes('&lt;Admin&gt;'));
    assert.ok(completed.includes('&lt;note&gt;'));
    clearMinimalRenderElements();
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
    assert.strictEqual(urls.length, 2);
    assert.ok(urls[0].url.startsWith('/api/prodhlomena-oraria/review/policies/preview?'));
    assert.ok(urls[1].url.startsWith('/api/prodhlomena-oraria/review/repo-transfer-decisions/current?'));
    assert.ok(urls.every((call) => call.method === 'GET'));
    const allUrls = urls.map((call) => call.url).join('\n');
    assert.ok(!allUrls.includes('/api/prodhlomena-oraria/review?'));
    assert.ok(!allUrls.includes('/review/scenarios'));
    assert.ok(!allUrls.includes('/review/policies/approvals'));
    assert.ok(!allUrls.includes('/review/policies/apply-dry-run'));
    ['hrReviewStartBtn', 'hr_apo_hmeromhnia', 'hr_eos_hmeromhnia', 'ypokatasthmata_stathera'].forEach((id) => elementsById.delete(id));
    clearMinimalRenderElements();
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
        assert.strictEqual(vm.runInContext('repoTransferDecisionSubmitting', sandbox), false);
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

const tests = [
    testReadyFullTimeAndSplitShift,
    testCompleteVisibleSectionContainsNoTechnicalTerms,
    testPartTimeTargetIsNotAnError,
    testEmptyFirstIntervalDoesNotCompactSecond,
    testReadOnlySafety,
    testServerDerivedRepoTransferPermissionsAndRoleVisibility,
    testConfidenceAndDecisionTerminology,
    testBranchRequiredForDecisionButtons,
    testAllBranchSkipsDecisionRequests,
    testOnlyCurrentDecisionDisablesButtons,
    testBatchHistoryUsesOneFetchForManyGroups,
    testCurrentAndPreviousHistoryAreEscaped,
    testApplyPresentationStatesAndSafetyContract,
    testImmediatePostApplyRefreshKeepsBadgeForTemporaryOldGroup,
    testEscaping,
    testDiagnostics,
    testUnknownDiagnosticUsesSafeFallbackAndStableLabelOrdering,
    testEmptyProjection,
    testRepoTransferStatusAndSafeMarkup,
    testScopedSemanticButtonCss,
    testEmployeeWeekEvaluationLabel,
    testProposalDateRangeWording,
    testGenericIsolationSourceContract,
    testAtomicStateSurvivesGenericRerenderAndClearsOnRequestState,
    testMinimalWorkspaceEjsContract,
    testEmploymentReviewScrollContainerContract,
    testEmploymentReviewFinalUiContract,
    testCorrectiveDropdownAndPageShellContract,
    testEmploymentReviewBranchActionLayoutContract,
    testRoleScopedRenderedEjs,
    testHrQueueClassification,
    testMinimalRenderingAndTerminology,
    testMinimalCompletionAndClosedCompletedSection,
    testMinimalSafetySourceContracts,
    testLightweightHrLoadingRequests,
    testHrDecisionPresentationAndLocalRerender,
    testHrDecisionCancelAndEmptyNoteDoNotPost,
    testHrApproveAndRejectPostPaths,
    testHrPostSuccessRefreshFailureWarning,
    testHrLoadingLocksAndRestoresFilters,
    testApplyPostSuccessAndRefreshSuccess,
    testApplyPostSuccessAndRefreshFailure,
    testApplyServerAndNetworkFailures,
    testApplyDoubleClickUsesOnePost
];

async function run() {
    for (const test of tests) await test();
    console.log(`PASS atomic repo-transfer read-only UI (${tests.length} tests)`);
}
run().catch((error) => { console.error(error); process.exitCode = 1; });

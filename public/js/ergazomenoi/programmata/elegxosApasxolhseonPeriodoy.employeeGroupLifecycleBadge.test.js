'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');

function sourceFunction(name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `Δεν βρέθηκε η ${name}`);
    let depth = 0;
    let parentheses = 0;
    let parametersStarted = false;
    let bodyStarted = false;
    for (let index = start; index < source.length; index += 1) {
        if (!bodyStarted && source[index] === '(') {
            parentheses += 1;
            parametersStarted = true;
        } else if (!bodyStarted && source[index] === ')') {
            parentheses -= 1;
        } else if (source[index] === '{' && parametersStarted && parentheses === 0) {
            depth += 1;
            bodyStarted = true;
        } else if (source[index] === '{' && bodyStarted) {
            depth += 1;
        } else if (source[index] === '}' && bodyStarted) {
            depth -= 1;
            if (bodyStarted && depth === 0) return source.slice(start, index + 1);
        }
    }
    throw new Error(`Δεν ολοκληρώθηκε η ${name}`);
}

const helpers = new Function(`${sourceFunction('escapeHtml')}
${sourceFunction('compareLifecyclePendingItems')}
${sourceFunction('derivePeriodLifecyclePresentation')}
${sourceFunction('employeeGroupLifecycleBadge')}
${sourceFunction('employeeGroupHeaderContent')}
${sourceFunction('stage4ReviewRows')}
${sourceFunction('isEmployeeLifecycleFullyCompleted')}
${sourceFunction('isEmployeeVisibleInGeneralReview')}
${sourceFunction('visibleWeeklyHrPayloads')}
${sourceFunction('isReviewLifecycleRecordVisible')}
${sourceFunction('filterReviewLifecycleGroups')}
${sourceFunction('filterGeneralReviewRows')}
${sourceFunction('renderReviewNoPendingEmployees')}
return { derivePeriodLifecyclePresentation, employeeGroupLifecycleBadge, employeeGroupHeaderContent, stage4ReviewRows,
    isEmployeeLifecycleFullyCompleted,
    filterGeneralReviewRows, visibleWeeklyHrPayloads,
    filterReviewLifecycleGroups,
    renderReviewNoPendingEmployees };`)();

function payload(employeeKodikos, statuses, pendingCounts = {}) {
    const stages = {};
    ['stage1', 'stage2', 'stage3', 'stage4'].forEach((stage) => {
        stages[stage] = {
            business_status: statuses[stage] || 'COMPLETED',
            pending_count: pendingCounts[stage] || 0,
            pending_reasons: [],
            pending_dates: []
        };
    });
    return {
        scope: { employee_kodikos: employeeKodikos, ypokatasthma: '0000',
            week_start: '2026-06-01', week_end: '2026-06-07' },
        lifecycle_projection: { stages }
    };
}

test('ολοκληρωμένος κύκλος ζωής εμφανίζεται ως ολοκληρωμένος στο Στάδιο 4', () => {
    const badge = helpers.employeeGroupLifecycleBadge('0014', '0000', [payload('0014', {})]);
    assert.match(badge, /ΟΛΟΚΛΗΡΩΜΕΝΟ/);
});

test('το header εργαζομένου Σταδίου 4 περιέχει παράρτημα, κωδικό, όνομα και status', () => {
    const badge = helpers.employeeGroupLifecycleBadge('0003', '0000', [payload('0003', {})]);
    const header = helpers.employeeGroupHeaderContent({ ypokatasthma: '0000', kodikos: '0003',
        employeeName: 'ΘΕΟΔΩΡΟΥ ΘΕΟΔΩΡΟΣ' }, badge);
    for (const expected of ['0000', '0003', 'ΘΕΟΔΩΡΟΥ ΘΕΟΔΩΡΟΣ', 'ΟΛΟΚΛΗΡΩΜΕΝΟ']) {
        assert.match(header, new RegExp(expected));
    }
});

test('requires_hr_action εμφανίζεται ως απαίτηση ενέργειας στο Στάδιο 4', () => {
    const badge = helpers.employeeGroupLifecycleBadge('0001', '0000', [payload('0001', {
        stage1: 'OPEN', stage2: 'OPEN', stage3: 'OPEN'
    }, { stage1: 2, stage2: 3, stage3: 4 })]);
    assert.match(badge, /ΑΠΑΙΤΕΙ ΕΝΕΡΓΕΙΑ/);
    assert.doesNotMatch(badge, /ΟΛΟΚΛΗΡΩΜΕΝΟ/);
});

test('πραγματική εκκρεμότητα Σταδίου 4 διατηρεί την ενέργεια', () => {
    const badge = helpers.employeeGroupLifecycleBadge('0004', '0000', [payload('0004', {
        stage4: 'BLOCKED'
    }, { stage4: 2 })]);
    assert.match(badge, /ΑΠΑΙΤΕΙ ΕΝΕΡΓΕΙΑ/);
});

test('εργαζόμενος χωρίς εβδομαδιαίες προβολές εμφανίζεται ολοκληρωμένος', () => {
    const badge = helpers.employeeGroupLifecycleBadge('0003', '0000', []);
    assert.match(badge, /ΟΛΟΚΛΗΡΩΜΕΝΟ/);
    assert.doesNotMatch(badge, /ΑΠΑΙΤΕΙ ΕΝΕΡΓΕΙΑ/);
});

test('επιλυμένο data-quality εύρημα του 0003 εμφανίζεται ολοκληρωμένο', () => {
    const badge = helpers.employeeGroupLifecycleBadge('0003', '0000', []);
    assert.match(badge, /ΟΛΟΚΛΗΡΩΜΕΝΟ/);
});

test('οι 0001–0005 χωρίς πραγματική εκκρεμότητα εμφανίζονται ολοκληρωμένοι', () => {
    ['0001', '0002', '0003', '0004', '0005'].forEach((employeeKodikos) => {
        const projections = employeeKodikos === '0003' ? [] : [payload(employeeKodikos, {})];
        assert.match(helpers.employeeGroupLifecycleBadge(
            employeeKodikos, '0000', projections
        ), /ΟΛΟΚΛΗΡΩΜΕΝΟ/);
    });
});

test('το χωρίς ευρήματα δεν χρησιμοποιείται ως κύριο badge του Σταδίου 4', () => {
    assert.doesNotMatch(sourceFunction('employeeGroupLifecycleBadge'),
        /ΧΩΡΙΣ ΕΥΡΗΜΑΤΑ ΠΡΟΣ ΕΛΕΓΧΟ/);
});

test('παλιό POSSIBLE_LEAVE δεν τροφοδοτεί τη συγκεντρωτική γραμμή', () => {
    const renderSource = sourceFunction('renderReviewRows');
    assert.match(renderSource, /employeeGroupLifecycleBadge/);
    assert.doesNotMatch(renderSource, /hasAdeiaSuggestionInRows|POSSIBLE_LEAVE/);
    assert.match(helpers.employeeGroupLifecycleBadge(
        '0004', '0000', [payload('0004', {})]
    ), /ΟΛΟΚΛΗΡΩΜΕΝΟ/);
});

test('η λίστα Σταδίου 4 περιλαμβάνει όλους τους κωδικούς σε αριθμητική σειρά', () => {
    const rows = [
        { kodikos: '0004', hmeromhnia: '2026-06-02' },
        { kodikos: '0001', hmeromhnia: '2026-06-01' },
        { kodikos: '0003', hmeromhnia: '2026-06-01' },
        { kodikos: '0002', hmeromhnia: '2026-06-01' },
        { kodikos: '0004', hmeromhnia: '2026-06-01' }
    ];
    assert.deepEqual(helpers.stage4ReviewRows(
        rows, ['0001', '0002', '0003', '0004']
    ).map((row) => `${row.kodikos}:${row.hmeromhnia}`), [
        '0001:2026-06-01', '0002:2026-06-01', '0003:2026-06-01',
        '0004:2026-06-01', '0004:2026-06-02'
    ]);
});

test('οι εργαζόμενοι χωρίς ευρήματα και οι ολοκληρωμένοι δεν αυξάνουν τις εκκρεμότητες', () => {
    const stage4Pending = payload('0004', { stage4: 'BLOCKED' }, { stage4: 2 });
    const lifecycle = helpers.derivePeriodLifecyclePresentation([
        payload('0002', {}), stage4Pending
    ]);
    assert.equal(lifecycle?.stages?.STAGE4?.pending_count, 2);
    assert.match(helpers.employeeGroupLifecycleBadge('0001', '0000', []),
        /ΟΛΟΚΛΗΡΩΜΕΝΟ/);
    assert.match(helpers.employeeGroupLifecycleBadge('0002', '0000', [payload('0002', {})]),
        /ΟΛΟΚΛΗΡΩΜΕΝΟ/);
});

test('γενική λίστα αποκρύπτει μόνο πλήρως ολοκληρωμένο εργαζόμενο', () => {
    const rows = [
        { kodikos: '0014', ypokatasthma: '0000', kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' },
        { kodikos: '0001', ypokatasthma: '0000', adeia_apologistika: true,
            kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' },
        { kodikos: '0004', ypokatasthma: '0000', next_required_hr_stage: 'REPO_RESOLUTION' },
        { kodikos: '0002', ypokatasthma: '0000' }
    ];
    const completedPayload = payload('0014', {});
    completedPayload.workflow = { next_required_hr_stage: 'REPO_RESOLUTION' };
    const payloads = [completedPayload, payload('0001', {}), payload('0004', {}),
        payload('0002', { stage1: 'OPEN' }, { stage1: 2 })];
    assert.deepEqual(helpers.filterGeneralReviewRows(rows, {
        lifecycleReady: true, lifecyclePayloads: payloads
    }).map((row) => row.kodikos), ['0002']);
});

test('γενική λίστα διατηρεί ενεργά Στάδια 2, 3 και 4', () => {
    const rows = ['0002', '0003', '0004'].map((kodikos) =>
        ({ kodikos, ypokatasthma: '0000' }));
    const payloads = [
        payload('0002', { stage2: 'OPEN' }, { stage2: 1 }),
        payload('0003', { stage3: 'OPEN' }, { stage3: 1 }),
        payload('0004', { stage4: 'OPEN' }, { stage4: 1 })
    ];
    assert.deepEqual(helpers.filterGeneralReviewRows(rows, {
        lifecycleReady: true, lifecyclePayloads: payloads
    }).map((row) => row.kodikos), ['0002', '0003', '0004']);
});

test('requires_hr_action διατηρεί εργαζόμενο ακόμη και με μηδενικό pending', () => {
    const rows = [{ kodikos: '0006', ypokatasthma: '0000' }];
    assert.deepEqual(helpers.filterGeneralReviewRows(rows, {
        lifecycleReady: true,
        lifecyclePayloads: [payload('0006', { stage2: 'OPEN' }, { stage2: 0 })]
    }), rows);
});

test('το κριτήριο απόκρυψης δεν εξαρτάται από presentation_status', () => {
    const completionSource = sourceFunction('isEmployeeLifecycleFullyCompleted');
    assert.match(completionSource, /requires_hr_action === false/);
    assert.match(completionSource, /total_pending_count/);
    assert.doesNotMatch(completionSource, /presentation_status|POSSIBLE_LEAVE|next_required_hr_stage/);
});

test('ρητό kodikos διατηρεί πλήρως ολοκληρωμένο εργαζόμενο', () => {
    const rows = [{ kodikos: '0014', ypokatasthma: '0000' }];
    assert.deepEqual(helpers.filterGeneralReviewRows(rows, {
        selectedKodikos: '0014', lifecycleReady: true,
        lifecyclePayloads: [payload('0014', {})]
    }), rows);
});

test('η γενική λίστα περιμένει την προβολή κύκλου ζωής πριν εμφανίσει γραμμές', () => {
    const rows = [{ kodikos: '0014', ypokatasthma: '0000' }];
    assert.deepEqual(helpers.filterGeneralReviewRows(rows, {
        lifecycleReady: false, lifecyclePayloads: []
    }), []);
});

test('η κενή γενική λίστα εμφανίζει σαφή ένδειξη', () => {
    const tbody = { innerHTML: '' };
    assert.equal(helpers.renderReviewNoPendingEmployees(tbody, {
        lifecycleReady: true, selectedKodikos: ''
    }), true);
    assert.match(tbody.innerHTML, /Δεν υπάρχουν εργαζόμενοι με εκκρεμότητες ελέγχου\./);
    const selectedTbody = { innerHTML: '' };
    assert.equal(helpers.renderReviewNoPendingEmployees(selectedTbody, {
        lifecycleReady: true, selectedKodikos: '0014'
    }), false);
    assert.equal(selectedTbody.innerHTML, '');
});

test('η παρουσίαση του HR δεν εμφανίζει πληροφοριακό Επόμενο', () => {
    assert.doesNotMatch(source, /Επόμενο:\s*Επίλυση/);
    assert.doesNotMatch(sourceFunction('renderWeeklyHrStage1Card'), /nextStage/);
});

test('η ορατή εβδομαδιαία συλλογή αφαιρεί όλες τις εβδομάδες ολοκληρωμένου εργαζομένου', () => {
    const completedWeeks = ['01', '08', '15', '22', '29'].map((day) => {
        const item = payload('0001', {});
        item.scope.week_start = `2026-06-${day}`;
        item.workflow = { next_required_hr_stage: 'REPO_RESOLUTION' };
        return item;
    });
    const active = payload('0002', { stage2: 'OPEN' }, { stage2: 1 });
    const visible = helpers.visibleWeeklyHrPayloads([...completedWeeks, active], '');
    assert.deepEqual(visible.map((item) => item.scope.employee_kodikos), ['0002']);
});

test('ρητό kodikos επαναφέρει όλες τις εβδομάδες ολοκληρωμένου εργαζομένου', () => {
    const completedWeeks = ['01', '08'].map((day) => {
        const item = payload('0001', {});
        item.scope.week_start = `2026-06-${day}`;
        return item;
    });
    assert.equal(helpers.visibleWeeklyHrPayloads(completedWeeks, '0001').length, 2);
});

test('η κοινή ορατότητα αφαιρεί ολοκληρωμένο εργαζόμενο από μεταγενέστερα Στάδια', () => {
    const lifecyclePayloads = [payload('0001', {}),
        payload('0003', { stage3: 'OPEN' }, { stage3: 1 })];
    const groups = [{ group_id: 'completed', items: [
        { employee_kodikos: '0001', ypokatasthma: '0000' }
    ] }, { group_id: 'active', items: [
        { employee_kodikos: '0003', ypokatasthma: '0000' }
    ] }];
    assert.deepEqual(helpers.filterReviewLifecycleGroups(
        groups, lifecyclePayloads, ''
    ).map((group) => group.group_id), ['active']);
    assert.equal(helpers.filterReviewLifecycleGroups(
        groups, lifecyclePayloads, '0001'
    ).length, 2);
});

const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright');

function group(id, code, day) {
    return {
        group_id: id,
        first_date: `2026-07-${day}`,
        last_date: `2026-07-${String(Number(day) + 1).padStart(2, '0')}`,
        items: [
            { role: 'SOURCE_BECOMES_WORK', employee_kodikos: code, employee_name: `Employee ${code}`, hmeromhnia: `2026-07-${day}`, proposed_values: {} },
            { role: 'TARGET_BECOMES_REPO', employee_kodikos: code, employee_name: `Employee ${code}`, hmeromhnia: `2026-07-${String(Number(day) + 1).padStart(2, '0')}`, proposed_values: {} }
        ]
    };
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setContent(`
            <input id="canRecordRepoTransferDecision" value="1"><input id="canUseAdvancedEmploymentReview" value="0">
            <div id="hrReviewProgress" class="d-none"></div><div id="hrReviewStatus"></div>
            <div id="hrReviewPendingContainer"></div><div id="hrReviewCompletedContainer"></div>`);
        await page.evaluate(() => {
            window.Swal = { async fire() { return { isConfirmed: false }; } };
            window.bootstrap = { Modal: class {}, Tooltip: class {} };
        });
        await page.addScriptTag({ path: path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js') });
        const groups = [group('g-1a', '0001', '01'), group('g-1b', '0001', '03'), group('g-2', '0002', '05'), group('g-3', '0003', '07')];
        const result = await page.evaluate((payload) => {
            EmploymentReviewHrTest.setGroups(payload, ['g-3']);
            EmploymentReviewHrTest.render();
            const diagnostics = EmploymentReviewHrTest.diagnostics();
            const pendingCards = [...document.querySelectorAll('.hr-review-proposal-card')];
            const correctGroup = EmploymentReviewHrTest.groupForId('g-2');
            const firstSubmit = EmploymentReviewHrTest.beginSubmit('g-2');
            const duplicateSubmit = EmploymentReviewHrTest.beginSubmit('g-2');
            const otherGroupSubmit = EmploymentReviewHrTest.beginSubmit('g-1a');
            EmploymentReviewHrTest.endSubmit('g-2');
            EmploymentReviewHrTest.endSubmit('g-1a');
            return {
                diagnostics,
                pendingCardIds: pendingCards.map((card) => card.dataset.groupId),
                pendingText: document.getElementById('hrReviewPendingContainer').textContent,
                completedText: document.getElementById('hrReviewCompletedContainer').textContent,
                correctGroupId: correctGroup?.group_id,
                firstSubmit, duplicateSubmit, otherGroupSubmit
            };
        }, groups);
        assert.deepStrictEqual(result.diagnostics, {
            totalGroups: 4, pendingGroups: 3, completedGroups: 1,
            uniqueEmployees: 3, employeeCodes: ['0001', '0002', '0003']
        });
        assert.deepStrictEqual(result.pendingCardIds, ['g-1a', 'g-1b', 'g-2']);
        assert.ok(result.pendingText.includes('0001') && result.pendingText.includes('0002'));
        assert.ok(result.completedText.includes('0003'));
        assert.strictEqual(result.correctGroupId, 'g-2');
        assert.deepStrictEqual([result.firstSubmit, result.duplicateSubmit, result.otherGroupSubmit], [true, false, true]);

        const empty = await page.evaluate(() => {
            EmploymentReviewHrTest.setGroups([]);
            EmploymentReviewHrTest.render();
            return {
                cards: document.querySelectorAll('.hr-review-proposal-card').length,
                status: document.getElementById('hrReviewStatus').textContent
            };
        });
        assert.strictEqual(empty.cards, 0);
        assert.match(empty.status, /Δεν υπάρχουν/);
        console.log('PASS HR all-groups rendering (0001/0002/0003, duplicates, per-group guard, reclassification, empty state)');
    } finally {
        await browser.close();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setContent(`
            <div id="sidebarMenu"><ul>
                <li id="parent-a"><a class="disabled">Parent A</a><ul>
                    <li><a id="read" class="disabled" data-privilege-form="ReadForm" href="/read">Read</a></li>
                    <li><a id="closed" class="disabled" data-privilege-form="ClosedForm" href="/closed">Closed</a></li>
                </ul></li>
                <li><a id="standard-schedules" class="disabled" data-privilege-form="StandardSchedules"
                    data-borrowed-standard-label="true" href="/standard-schedules"><span class="sidebar-menu-label">ΜΗ Δανειζόμενων Εργαζόμενων</span></a></li>
                <li><a id="standard-cards" class="disabled" data-privilege-form="StandardCards"
                    data-borrowed-standard-label="true" href="/standard-cards"><span class="sidebar-menu-label">ΜΗ Δανειζόμενων Εργαζόμενων</span></a></li>
                <li id="parent-b"><a class="disabled">Parent B</a><ul>
                    <li><a id="admin" class="disabled" data-privilege-form="AdminForm" href="/admin-form">Admin</a></li>
                </ul></li>
                <li id="parent-c"><a class="disabled">Parent C</a><ul>
                    <li><a id="none" class="disabled" data-privilege-form="MissingForm" href="/none">None</a></li>
                </ul></li>
                <li><a id="borrowed-schedules" class="disabled" data-privilege-form="BorrowedSchedules"
                    data-requires-borrowed-transfer="true" href="/borrowed-schedules">Borrowed schedules</a></li>
                <li><a id="borrowed-cards" class="disabled" data-privilege-form="BorrowedCards"
                    data-requires-borrowed-transfer="true" href="/borrowed-cards">Borrowed cards</a></li>
                <li><a id="home" class="disabled" data-sidebar-special data-sidebar-authorized="true" href="/mainapp">Home</a></li>
                <li><a id="roleDenied" class="disabled" data-sidebar-special data-sidebar-authorized="false" href="/role">Role</a></li>
            </ul></div>`);
        await page.addScriptTag({ path: path.join(__dirname, 'getUserRole.js') });
        const result = await page.evaluate(() => {
            const state = (id) => ({
                enabled: document.getElementById(id).classList.contains('enabled'),
                disabled: document.getElementById(id).classList.contains('disabled'),
                ariaDisabled: document.getElementById(id).getAttribute('aria-disabled')
            });
            const permissions = {
                ReadForm: { read: true, admin: false },
                AdminForm: { read: false, admin: true },
                ClosedForm: { read: false, admin: false },
                StandardSchedules: { read: true, admin: false },
                StandardCards: { read: true, admin: false },
                BorrowedSchedules: { read: true, admin: false },
                BorrowedCards: { read: true, admin: false }
            };
            SidebarPrivileges.applySidebarPermissions(document.getElementById('sidebarMenu'), permissions, {
                borrowedEmployeeTransfers: false
            });
            const unavailable = {
                schedules: state('borrowed-schedules'), cards: state('borrowed-cards'),
                standardSchedulesLabel: document.querySelector('#standard-schedules .sidebar-menu-label').textContent,
                standardCardsLabel: document.querySelector('#standard-cards .sidebar-menu-label').textContent
            };
            SidebarPrivileges.applySidebarPermissions(document.getElementById('sidebarMenu'), permissions, {
                borrowedEmployeeTransfers: true
            });
            return {
                read: state('read'), admin: state('admin'), closed: state('closed'), none: state('none'),
                unavailable,
                available: { schedules: state('borrowed-schedules'), cards: state('borrowed-cards') },
                availableLabels: {
                    schedules: document.querySelector('#standard-schedules .sidebar-menu-label').textContent,
                    cards: document.querySelector('#standard-cards .sidebar-menu-label').textContent
                },
                home: state('home'), roleDenied: state('roleDenied'),
                parentA: document.querySelector('#parent-a > a').classList.contains('enabled'),
                parentB: document.querySelector('#parent-b > a').classList.contains('enabled'),
                parentC: document.querySelector('#parent-c > a').classList.contains('enabled'),
                canRead: SidebarPrivileges.canOpenForm({ read: true }),
                canAdmin: SidebarPrivileges.canOpenForm({ admin: true }),
                cannotOpen: SidebarPrivileges.canOpenForm({ read: false, admin: false })
            };
        });
        assert.strictEqual(result.canRead, true);
        assert.strictEqual(result.canAdmin, true);
        assert.strictEqual(result.cannotOpen, false);
        assert.strictEqual(result.read.enabled, true);
        assert.strictEqual(result.admin.enabled, true);
        assert.strictEqual(result.closed.disabled, true);
        assert.strictEqual(result.none.disabled, true);
        assert.strictEqual(result.unavailable.schedules.disabled, true);
        assert.strictEqual(result.unavailable.cards.disabled, true);
        assert.strictEqual(result.unavailable.standardSchedulesLabel, 'ΟΛΩΝ των Εργαζόμενων');
        assert.strictEqual(result.unavailable.standardCardsLabel, 'ΟΛΩΝ των Εργαζόμενων');
        assert.strictEqual(result.available.schedules.enabled, true);
        assert.strictEqual(result.available.cards.enabled, true);
        assert.strictEqual(result.availableLabels.schedules, 'ΜΗ Δανειζόμενων Εργαζόμενων');
        assert.strictEqual(result.availableLabels.cards, 'ΜΗ Δανειζόμενων Εργαζόμενων');
        assert.strictEqual(result.home.enabled, true);
        assert.strictEqual(result.roleDenied.disabled, true);
        assert.deepStrictEqual([result.parentA, result.parentB, result.parentC], [true, true, false]);
        console.log('PASS sidebar canonical permissions (read/admin/disabled, parents, always/role-gated)');
    } finally {
        await browser.close();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

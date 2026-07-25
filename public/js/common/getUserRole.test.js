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
                <li id="parent-b"><a class="disabled">Parent B</a><ul>
                    <li><a id="admin" class="disabled" data-privilege-form="AdminForm" href="/admin-form">Admin</a></li>
                </ul></li>
                <li id="parent-c"><a class="disabled">Parent C</a><ul>
                    <li><a id="none" class="disabled" data-privilege-form="MissingForm" href="/none">None</a></li>
                </ul></li>
                <li><a id="home" class="disabled" data-sidebar-special data-sidebar-authorized="true" href="/mainapp">Home</a></li>
                <li><a id="roleDenied" class="disabled" data-sidebar-special data-sidebar-authorized="false" href="/role">Role</a></li>
            </ul></div>`);
        await page.addScriptTag({ path: path.join(__dirname, 'getUserRole.js') });
        const result = await page.evaluate(() => {
            SidebarPrivileges.applySidebarPermissions(document.getElementById('sidebarMenu'), {
                ReadForm: { read: true, admin: false },
                AdminForm: { read: false, admin: true },
                ClosedForm: { read: false, admin: false }
            });
            const state = (id) => ({
                enabled: document.getElementById(id).classList.contains('enabled'),
                disabled: document.getElementById(id).classList.contains('disabled'),
                ariaDisabled: document.getElementById(id).getAttribute('aria-disabled')
            });
            return {
                read: state('read'), admin: state('admin'), closed: state('closed'), none: state('none'),
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

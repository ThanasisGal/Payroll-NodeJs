'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const ejs = require('ejs');
const { getSelectableAdminUserRoles } = require('../../../server/constants/userRoles');
const root = path.resolve(__dirname, '../../..');

test('User forms retain safe password controls and fit available content in Chromium', { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    const artifacts = process.env.PAYROLL_VISUAL_ARTIFACT_DIR || await fs.mkdtemp(path.join(os.tmpdir(), 'payroll-admin-users-browser-'));
    await fs.mkdir(artifacts, { recursive: true });
    const errors = [], requests = [];
    const forbiddenHash = 'SYNTHETIC_STORED_HASH_MUST_NOT_RENDER';
    const users = { id: '650000000000000000000002', _id: '650000000000000000000002',
        firstName: 'Δοκιμαστικός', lastName: 'Χρήστης', email: 'synthetic@example.invalid',
        team: 'TEAM1', privileges: 'HR', situation: 'A', details: '', password: forbiddenHash, updatedAt: new Date(0) };
    try {
        for (const mode of ['add', 'edit']) {
            const filename = path.join(root, `views/users/${mode}.ejs`);
            const html = await ejs.renderFile(filename, { users, userRoleOptions: getSelectableAdminUserRoles(),
                normalizedUserRole: 'HR', managedTeam: 'TEAM1', canManageAllTeams: false,
                csrfToken: 'synthetic-csrf', script: name => `/static/js/${name}.js` });
            assert.ok(!html.includes(forbiddenHash));
            const page = await browser.newPage();
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', async route => {
                const url = new URL(route.request().url());
                requests.push({ method: route.request().method(), url: url.origin + url.pathname });
                if (url.origin !== 'http://synthetic-users.invalid') return route.abort();
                if (url.pathname === '/static/js/admin/userPasswordFields.js') return route.fulfill({
                    contentType: 'text/javascript', body: await fs.readFile(path.join(root, 'public/js/admin/userPasswordFields.js'), 'utf8') });
                if (url.pathname === '/form') return route.fulfill({ contentType: 'text/html', body: `<!doctype html>
                    <html lang="el"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
                    <body><main class="payroll-form-layout" style="height:100vh;overflow:auto;width:100%;padding:8px">${html}</main></body></html>` });
                return route.abort();
            });
            await page.goto('http://synthetic-users.invalid/form');
            for (const file of ['public/css/bootstrap.min.css', 'public/css/main.css'])
                await page.addStyleTag({ path: path.join(root, file) });
            await page.addScriptTag({ path: path.join(root, 'public/js/common/formLayout.js') });
            for (const [width, height] of [[1440,900], [1024,768], [800,700], [640,600], [390,700]]) {
                await page.setViewportSize({ width, height });
                for (const sidebar of [false, true]) {
                    const sidebarWidth = sidebar ? Math.min(336, Math.round(width * .3)) : 0;
                    await page.locator('main').evaluate((main, left) => {
                        main.style.setProperty('margin-left', left + 'px', 'important');
                        main.style.setProperty('width', `calc(100% - ${left}px)`, 'important');
                    }, sidebarWidth);
                    const measurements = await page.locator('.maintenance-responsive-form').evaluate(form => {
                        const bounds = form.getBoundingClientRect();
                        return [...form.querySelectorAll('.input-group input, .input-group button')].map(control => {
                            const r = control.getBoundingClientRect();
                            return { left: r.left, right: r.right, width: r.width, font: parseFloat(getComputedStyle(control).fontSize),
                                formLeft: bounds.left, formRight: bounds.right };
                        });
                    });
                    for (let index = 0; index < measurements.length; index += 2) {
                        assert.ok(measurements[index].right <= measurements[index + 1].left + .5,
                            `${mode} password input and toggle overlap at ${width}`);
                    }
                    for (const box of measurements) {
                        assert.ok(box.left >= box.formLeft - 1 && box.right <= box.formRight + 1,
                            `${mode} password control overflows ${width} sidebar=${sidebar}: ${JSON.stringify(box)}`);
                        assert.ok(box.width >= 28 && box.font >= 13.6, JSON.stringify(box));
                        assert.ok(box.formLeft >= 0 && box.formRight <= width + 1, JSON.stringify(box));
                    }
                    await page.screenshot({ path: path.join(artifacts, `admin-user-${mode}-${width}-${sidebar ? 'open' : 'closed'}.png`), fullPage: true });
                }
            }
            await page.setViewportSize({ width: 1024, height: 768 });
            await page.locator('main').evaluate(main => { main.style.setProperty('margin-left', '0', 'important'); main.style.setProperty('width', '100%', 'important'); });
            const ids = mode === 'add' ? ['password'] : ['newPassword', 'newPasswordConfirmation'];
            for (const id of ids) {
                const input = page.locator('#' + id);
                const toggle = page.locator(`[data-toggle-password][aria-controls="${id}"]`);
                assert.equal(await input.inputValue(), '');
                await input.fill(' SyntheticBrowser1! ');
                await toggle.click();
                assert.equal(await input.getAttribute('type'), 'text');
                assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
                assert.equal(await toggle.getAttribute('aria-label'), 'Απόκρυψη κωδικού');
                assert.equal(await input.inputValue(), ' SyntheticBrowser1! ');
                await toggle.press('Space');
                assert.equal(await input.getAttribute('type'), 'password');
                assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
            }
            assert.equal(await page.locator('input[name="_csrf"]').first().inputValue(), 'synthetic-csrf');
            await page.close();
        }
        assert.deepEqual(errors, []);
        assert.ok(requests.every(request => request.method === 'GET'));
    } finally { await browser.close(); }
});

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { allowedCountries } = require('../../config/geo.json');

function fixture(country) {
    const events = [];
    const sandbox = {
        module: { exports: {} },
        require(name) {
            if (name === 'geoip-lite') return {
                lookup(ip) {
                    assert.equal(ip, '192.0.2.1');
                    return { country };
                }
            };
            if (name === '../../config/geo.json') return { allowedCountries };
            if (name === '../utils/logger') return {
                warn(message) { events.push(['warn', message]); }
            };
            throw new Error(`Unexpected dependency: ${name}`);
        }
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('./geoGuard'), 'utf8'), sandbox, {
        filename: 'geoGuard.js'
    });
    return {
        events,
        run(role, fromSession = false) {
            const req = {
                ip: '192.0.2.1',
                body: fromSession ? {} : { role },
                session: fromSession ? { userRole: role } : {}
            };
            const res = {
                async flash(type, message) { events.push(['flash', type, message]); },
                redirect(url) { events.push(['redirect', url]); }
            };
            return sandbox.module.exports(req, res, () => events.push(['next']));
        }
    };
}

for (const role of ['A', 'C']) {
    test(`role ${role} outside allowlist logs and blocks before next`, async () => {
        assert.ok(!allowedCountries.includes('US'));
        const f = fixture('US');
        await f.run(role, role === 'C');
        assert.deepEqual(f.events, [
            ['warn', 'Admin login attempt from 192.0.2.1 (US) blocked'],
            ['flash', 'warning', 'Η πρόσβαση για admin επιτρέπεται μόνο από επιλεγμένες χώρες.'],
            ['redirect', '/login']
        ]);
    });
}

test('protected roles from every allowed country proceed normally', async () => {
    for (const country of allowedCountries) {
        for (const role of ['A', 'C']) {
            const f = fixture(country);
            await f.run(role);
            assert.deepEqual(f.events, [['next']]);
        }
    }
});

test('non-protected role outside allowlist proceeds normally', async () => {
    const f = fixture('US');
    await f.run('B');
    assert.deepEqual(f.events, [['next']]);
});

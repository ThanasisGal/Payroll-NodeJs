'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requireSafeUri, requireIsolatedPrivileges } = require('./preflight.cjs');
const uri = 'mongodb+srv://payroll_dev_test:synthetic-only@synthetic.mongodb.net/payroll_test_isolated?authSource=admin';
const status = () => ({ authInfo: {
    authenticatedUsers: [{ user: 'payroll_dev_test', db: 'admin' }],
    authenticatedUserRoles: [{ role: 'readWrite', db: 'payroll_test_isolated' }],
    authenticatedUserPrivileges: [{ resource: { db: 'payroll_test_isolated', collection: '' }, actions: ['find', 'insert', 'update'] }]
} });

test('accepts only the isolated Atlas target and expected effective privileges', () => {
    assert.doesNotThrow(() => requireSafeUri(uri));
    assert.equal(requireIsolatedPrivileges(status()).productionWritePrivilege, false);
});
test('rejects production databases, accounts, insecure TLS, alternate hosts and duplicate options', () => {
    for (const value of [uri.replace('/payroll_test_isolated', '/payrollDB'),
        uri.replace('payroll_dev_test', 'payroll_app_prod'), uri.replace('payroll_dev_test', 'payroll_migration_user'),
        uri.replace('synthetic.mongodb.net', 'localhost'), uri + '&tls=false', uri + '&tlsInsecure=true',
        uri + '&authSource=payrollDB', uri + '&authSource=admin', uri + '&dbName=payrollDB']) {
        assert.throws(() => requireSafeUri(value));
    }
});
test('rejects extra roles and missing effective privilege evidence', () => {
    const extra = status();
    extra.authInfo.authenticatedUserRoles.push({ role: 'readWrite', db: 'payrollDB' });
    assert.throws(() => requireIsolatedPrivileges(extra));
    const missing = status();
    delete missing.authInfo.authenticatedUserPrivileges;
    assert.throws(() => requireIsolatedPrivileges(missing));
});
test('rejects wildcard, production, cluster and anyResource privileges without a production write', () => {
    for (const resource of [{ db: 'payrollDB', collection: '' }, { db: '', collection: '' },
        { cluster: true }, { anyResource: true }, { db: 'payroll_test_isolated', collection: '', anyResource: true }]) {
        const value = status();
        value.authInfo.authenticatedUserPrivileges.push({ resource, actions: ['insert'] });
        assert.throws(() => requireIsolatedPrivileges(value));
    }
});

'use strict';
const assert = require('node:assert/strict');
const URI = 'mongodb://127.0.0.1:27139/payroll_settlement_test_ci?replicaSet=payrollDraftTest';
const DISPOSABLE = 'ci-validation.yml:payrollDraftTest:27139';
const JOB = 'employee-history-settlement-mongo';

// Called BEFORE connect, never reads application configuration or credentials.
// Only the replica set provisioned by the existing CI step is authorized.
function assertMongoTarget({ uri, ci, disposable, job }) {
    assert.equal(uri, URI, 'Settlement tests require the exact isolated CI URI');
    assert.equal(ci, 'true', 'Settlement MongoDB tests are restricted to the disposable CI runner');
    assert.equal(disposable, DISPOSABLE, 'The existing CI provisioning marker is required');
    assert.equal(job, JOB, 'Only the dedicated settlement CI job may use this adapter');
}
function assertMongoConnection(connection) {
    assertMongoTarget({ uri: process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI,
        ci: process.env.GITHUB_ACTIONS, disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE,
        job: process.env.GITHUB_JOB });
    assert.equal(connection.readyState, 1);
    assert.equal(connection.host, '127.0.0.1');
    assert.equal(connection.port, 27139);
    assert.equal(connection.name, 'payroll_settlement_test_ci');
    assert.equal(connection.db.databaseName, 'payroll_settlement_test_ci');
    const options = connection.getClient().options;
    assert.equal(options.replicaSet, 'payrollDraftTest');
    assert.equal(options.dbName, 'payroll_settlement_test_ci');
    assert.deepEqual(options.hosts.map(String), ['127.0.0.1:27139']);
}
module.exports = { URI, DISPOSABLE, JOB, assertMongoTarget, assertMongoConnection };

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const diagnostics = require('./scheduleDownloadDiagnostics');
const { requestHarness } = require('../../../test/helpers/scheduleDownloadHarness');

for (const code of ['EMPLOYEE_WORK_WRITE_OUTSIDE_EMPLOYMENT', 'EMPLOYEE_WORK_WRITE_NOT_APPLIED',
    'EMPLOYEE_WORK_WRITE_PERIOD_PROTECTED', 'EMPLOYEE_WORK_WRITE_COMMIT_UNCONFIRMED']) {
    test(`${code} distinguishes file receipt from transaction persistence`, () => {
        const { req, res } = requestHarness();
        req.scheduleDownloadDiagnostics.storageState = 'uncertain';
        diagnostics.setScheduleDownloadStage(req, 'processing');
        assert.equal(diagnostics.scheduleDownloadFailureCode(req, { code }), code);
        diagnostics.sendScheduleDownloadFailure(req, res, 409, code);
        assert.equal(res.body.success, false);
        assert.ok(res.body.message.endsWith(`${code} / ${res.body.error.correlationId}`));
        assert.match(res.body.message, /1\..*2\./);
        if (code.endsWith('COMMIT_UNCONFIRMED')) {
            assert.match(res.body.message, /Δεν μπορεί να επιβεβαιωθεί αν αποθηκεύτηκαν αλλαγές/);
            assert.doesNotMatch(res.body.message, /Δεν αποθηκεύτηκε καμία αλλαγή/);
        } else assert.match(res.body.message, /Δεν αποθηκεύτηκε καμία αλλαγή στις εγγραφές ωραρίων/);
    });
}

for (const [status, code] of [[400, 'SCHEDULE_INVALID_REQUEST'], [401, 'SCHEDULE_AUTH_REQUIRED'],
    [403, 'SCHEDULE_FORBIDDEN'], [404, 'SCHEDULE_RESOURCE_UNAVAILABLE'],
    [409, 'SCHEDULE_CONFLICT'], [500, 'SCHEDULE_INTERNAL_ERROR']]) {
    test(`structured ${status} response and persistent diagnostic use the same reference`, () => {
        const { req, res, entries } = requestHarness();
        diagnostics.sendScheduleDownloadFailure(req, res, status, code);
        assert.equal(res.statusCode, status);
        assert.equal(res.body.success, false);
        assert.equal(res.body.error.code, code);
        assert.equal(res.headers['X-Correlation-ID'], res.body.error.correlationId);
        assert.equal(entries.length, 1);
        assert.equal(entries[0].details.httpStatus, status);
        assert.equal(entries[0].details.correlationId, res.body.error.correlationId);
        assert.equal(entries[0].details.storageState, 'not_started');
        assert.match(res.body.message, /1\..*2\./);
        assert.match(res.body.message, /Δεν αποθηκεύτηκε καμία αλλαγή/);
    });
}

test('only the schedule POST is instrumented, including Express case and trailing slash aliases', () => {
    for (const overrides of [{ method: 'GET' }, { path: '/another-download' }]) {
        const { req, res, entries } = requestHarness(overrides);
        assert.equal(req.scheduleDownloadDiagnostics, undefined);
        assert.equal(res.headers['X-Correlation-ID'], undefined);
        assert.deepEqual(entries, []);
    }
    assert.ok(requestHarness({ path: '/ERGAZOMENOI/PROGRAMMATA/DOWNLOADSCHEDULE/' })
        .req.scheduleDownloadDiagnostics);
});

test('untrusted codes, stages, headers, messages and payloads never enter diagnostics', () => {
    const { req, res, entries } = requestHarness({
        headers: { 'x-correlation-id': 'synthetic-secret-marker' },
        body: { token: 'synthetic-secret-marker' }
    });
    diagnostics.setScheduleDownloadStage(req, 'synthetic-secret-marker');
    diagnostics.sendScheduleDownloadFailure(req, res, 500, 'synthetic-secret-marker');
    assert.equal(res.body.error.stage, 'unknown');
    assert.equal(res.body.error.code, 'SCHEDULE_INTERNAL_ERROR');
    assert.equal(JSON.stringify({ entries, body: res.body }).includes('synthetic-secret-marker'), false);
    assert.deepEqual(Object.keys(entries[0].details).sort(),
        ['correlationId', 'errorCode', 'httpStatus', 'stage', 'storageState']);
});

test('parse failures and disconnected responses retain safe diagnostics', () => {
    const malformed = requestHarness();
    diagnostics.scheduleDownloadRequestError({ type: 'entity.parse.failed', body: 'synthetic-secret' },
        malformed.req, malformed.res, () => assert.fail('must handle invalid JSON'));
    assert.equal(malformed.res.statusCode, 400);
    const disconnected = requestHarness();
    disconnected.res.emit('close');
    assert.equal(disconnected.entries[0].details.httpStatus, null);
    const ordinary = requestHarness({ path: '/ordinary' });
    let forwarded;
    const error = Error('ordinary-error');
    diagnostics.scheduleDownloadRequestError(error, ordinary.req, ordinary.res, value => { forwarded = value; });
    assert.equal(forwarded, error);
});

test('only controlled error names and system codes explain failures without raw error messages', () => {
    const h = requestHarness();
    diagnostics.setScheduleDownloadStage(h.req, 'local-save');
    const code = diagnostics.scheduleDownloadFailureCode(h.req,
        Object.assign(Error('synthetic-secret-marker'), { code: 'ENOSPC' }));
    diagnostics.sendScheduleDownloadFailure(h.req, h.res, 500, code);
    assert.equal(h.entries[0].details.systemCode, 'ENOSPC');
    assert.equal(h.entries[0].details.failureName, 'Error');
    assert.equal(JSON.stringify(h.entries).includes('synthetic-secret-marker'), false);
});

test('a redirect or an early response cannot be logged as a completed schedule download', () => {
    for (const status of [200, 302]) {
        const h = requestHarness();
        h.res.statusCode = status;
        h.res.emit('finish');
        assert.equal(h.entries[0].details.errorCode, 'SCHEDULE_RESPONSE_UNCONFIRMED');
        assert.equal(h.entries[0].level, 'error');
    }
});

test('the existing Winston mechanism writes the safe error to disk without the terminal', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-schedule-diagnostics-'));
    try {
        const modulePath = require.resolve('./scheduleDownloadDiagnostics');
        const helperPath = require.resolve('../../../test/helpers/scheduleDownloadHarness');
        const loggerPath = require.resolve('../logger');
        execFileSync(process.execPath, ['-e', `
            const d = require(${JSON.stringify(modulePath)});
            const { req, res } = require(${JSON.stringify(helperPath)}).requestHarness();
            req.scheduleDownloadDiagnostics.logger = undefined;
            req.body = { password: 'synthetic-secret-marker' };
            d.sendScheduleDownloadFailure(req, res, 500, 'SCHEDULE_PROCESSING_FAILED');
            require(${JSON.stringify(loggerPath)}).end();
        `], { cwd: temp, env: { PATH: process.env.PATH, NODE_ENV: 'test' }, stdio: 'pipe' });
        for (const filename of ['app.log', 'error.log']) {
            const content = fs.readFileSync(path.join(temp, 'logs', filename), 'utf8');
            assert.match(content, /SCHEDULE_PROCESSING_FAILED/);
            assert.match(content, /correlationId/);
            assert.equal(content.includes('synthetic-secret-marker'), false);
        }
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
test('CastError diagnostic preserves privacy and correlation', () => {
    const h = requestHarness();
    diagnostics.setScheduleDownloadStage(h.req, 'processing');
    h.req.scheduleDownloadDiagnostics.storageState = 'uncertain';

    const error = Object.assign(
        new Error('synthetic-secret-marker'),
        { name: 'CastError', path: 'period_end' }
    );

    const code = diagnostics.scheduleDownloadFailureCode(h.req, error);
    assert.equal(code, 'SCHEDULE_PROCESSING_FAILED');

    diagnostics.sendScheduleDownloadFailure(h.req, h.res, 500, code);

    const details = h.entries[0].details;
    assert.equal(details.failureName, 'CastError');
    assert.equal(details.errorCode, 'SCHEDULE_PROCESSING_FAILED');
    assert.equal(details.correlationId, h.res.body.error.correlationId);
    assert.equal(details.storageState, 'uncertain');

    assert.equal(
        JSON.stringify(h.entries).includes('synthetic-secret-marker'),
        false
    );
    assert.equal(JSON.stringify(h.entries).includes('period_end'), false);
});

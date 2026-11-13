'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const diagnostics = require('../../utils/erganh/scheduleDownloadDiagnostics');
const { requestHarness } = require('../../../test/helpers/scheduleDownloadHarness');
const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const start = source.indexOf('    static lhpshOrarionApoErganh =');
const end = source.indexOf('    static mainLhpshOrarionApoKartesForm =', start);
const method = source.slice(start, end).replace(/^\s*static lhpshOrarionApoErganh =\s*/, '').trim().replace(/;$/, '');

function controllerHarness(failure) {
    const harness = requestHarness();
    const calls = [];
    const raw = Object.assign(Error('synthetic-secret-marker'), { code: 'untrusted-secret-code' });
    const action = async (name, result) => {
        calls.push(name);
        if (failure === name) throw raw;
        return result;
    };
    const controller = vm.runInNewContext(`(${method})`, {
        ...diagnostics, path, process: { cwd: () => '/synthetic-workspace' },
        PasswordsModel: { findOne: () => action('credentials', failure === 'missing-credentials'
            ? null : { username: 'synthetic-secret-marker', password: 'synthetic-secret-marker' }) },
        PeriodsModel: { findOne: () => ({ lean: () => action('period', { perigrafh: 'Οκτώβριος' }) }) },
        fs: { promises: {
            unlink: () => action('unlink'), mkdir: () => action('mkdir'),
            writeFile: () => action('local-save'), readFile: () => action('archive-read', Buffer.from('synthetic'))
        } },
        downloadOrariaToBuffer: async (...args) => {
            assert.deepEqual(args.slice(2, 5), ['01/10/2026', '31/10/2026', '0000']);
            args[5].onStage('excel-response');
            if (failure === 'browser-launch') {
                args[5].onStage('browser-launch');
                throw raw;
            }
            if (failure === 'known-download-error') {
                args[5].logger.error('ignored', { stage: 'branch-selection',
                    errorCode: 'ERGANI_BRANCH_SELECTION_FAILED', payload: 'synthetic-secret-marker' });
                throw Object.assign(raw, { code: 'ERGANI_BRANCH_SELECTION_FAILED' });
            }
            return action('download', Buffer.from('synthetic'));
        },
        processOrariaXlsx: async (_file, _year, scope) => {
            assert.equal(scope.ypokatasthma, '0000');
            if (failure === 'storage-conflict') {
                throw Object.assign(raw, { code: 'EMPLOYEE_WORK_WRITE_PROTECTION_UNAVAILABLE', statusCode: 409 });
            }
            return action('processing');
        },
        require: name => {
            assert.equal(name, '../../utils/s3Helper');
            return { uploadBufferToS3: () => action('archive-upload') };
        }
    });
    harness.req.programmataAccessScope = { effectiveTeam: 'TEST', companyId: '507f1f77bcf86cd799439011',
        externalDateRange: { startValue: '01/10/2026', endValue: '31/10/2026' }, ypokatasthma: '0000' };
    return { ...harness, calls, controller };
}

for (const [failure, status, code, stage, storage] of [
    ['missing-credentials', 404, 'SCHEDULE_CREDENTIALS_MISSING', 'credentials', 'not_started'],
    ['credentials', 500, 'SCHEDULE_INTERNAL_ERROR', 'credentials', 'not_started'],
    ['period', 500, 'SCHEDULE_PERIOD_FAILED', 'period', 'not_started'],
    ['mkdir', 500, 'SCHEDULE_FILE_PREPARATION_FAILED', 'file-preparation', 'uncertain'],
    ['download', 500, 'SCHEDULE_EXPORT_FAILED', 'excel-response', 'uncertain'],
    ['browser-launch', 500, 'SCHEDULE_BROWSER_FAILED', 'browser-launch', 'uncertain'],
    ['known-download-error', 500, 'ERGANI_BRANCH_SELECTION_FAILED', 'branch-selection', 'uncertain'],
    ['local-save', 500, 'SCHEDULE_LOCAL_SAVE_FAILED', 'local-save', 'uncertain'],
    ['processing', 500, 'SCHEDULE_PROCESSING_FAILED', 'processing', 'uncertain'],
    ['storage-conflict', 409, 'EMPLOYEE_WORK_WRITE_PROTECTION_UNAVAILABLE', 'processing', 'uncertain']
]) {
    test(`controller identifies ${failure} without leaking the underlying error`, async () => {
        const { req, res, controller, entries, calls } = controllerHarness(failure);
        await controller(req, res);
        assert.equal(res.statusCode, status);
        assert.equal(res.body.success, false);
        assert.equal(res.body.error.code, code);
        assert.equal(res.body.error.stage, stage);
        assert.equal(res.body.error.storageState, storage);
        assert.equal(entries.at(-1).details.httpStatus, status);
        assert.equal(entries.at(-1).details.correlationId, res.body.error.correlationId);
        assert.equal(JSON.stringify({ body: res.body, entries }).includes('synthetic-secret-marker'), false);
        assert.ok(calls.filter(name => name === 'download').length <= 1);
        if (failure !== 'processing') assert.equal(calls.includes('archive-upload'), false);
    });
}

test('success preserves download, local processing and archive order with no retries', async () => {
    const { req, res, controller, calls, entries } = controllerHarness();
    await controller(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.redirectUrl, '/ergazomenoi/programmata/lhpshOrarionApoErganh');
    assert.deepEqual(calls, ['credentials', 'period', 'unlink', 'mkdir', 'download',
        'local-save', 'processing', 'archive-read', 'archive-upload']);
    assert.equal(entries.at(-1).details.errorCode, 'SCHEDULE_OK');
    assert.equal(entries.at(-1).details.storageState, 'completed');
});

for (const failure of ['archive-read', 'archive-upload']) {
    test(`${failure} remains a nonfatal archive warning after successful processing`, async () => {
        const { req, res, controller, calls, entries } = controllerHarness(failure);
        await controller(req, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(entries[0].level, 'warn');
        assert.equal(entries[0].details.errorCode, 'SCHEDULE_ARCHIVE_FAILED');
        assert.equal(entries[0].details.storageState, 'completed');
        assert.equal(calls.filter(name => name === 'download').length, 1);
    });
}

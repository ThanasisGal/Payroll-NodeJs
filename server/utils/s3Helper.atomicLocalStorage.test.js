const test = require('node:test');
const assert = require('node:assert/strict');

const { __atomicLocalStorageTestHooks } = require('./s3Helper');
const { saveToLocalStorage } = __atomicLocalStorageTestHooks;

function fakeFileSystem(options = {}) {
    const finalPath = '/local/xlsx/cards.xlsx';
    const files = new Map([[finalPath, Buffer.from('old')]]);
    const calls = [];
    return {
        finalPath,
        files,
        calls,
        api: {
            mkdir: async () => { calls.push('mkdir'); },
            writeFile: async (name, data) => {
                calls.push('write');
                files.set(name, Buffer.from(options.partialWrite ? 'partial' : data));
                if (options.writeFailure) throw Object.assign(new Error('raw write'), { code: 'EIO' });
            },
            rename: async (from, to) => {
                calls.push('rename');
                if (options.renameFailure) throw Object.assign(new Error('raw rename'), { code: 'EIO' });
                files.set(to, files.get(from));
                files.delete(from);
            },
            unlink: async (name) => {
                calls.push('unlink');
                if (!files.has(name)) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
                files.delete(name);
            }
        }
    };
}

function dependencies(storage, logger = { error() {} }) {
    return {
        fileSystem: storage.api,
        localStorageDir: '/local',
        randomSuffix: 'fixed',
        logger
    };
}

test('atomic local success replaces once and leaves no temp file', async () => {
    const storage = fakeFileSystem();
    await saveToLocalStorage('xlsx/cards.xlsx', Buffer.from('new'), dependencies(storage));
    assert.equal(storage.files.get(storage.finalPath).toString(), 'new');
    assert.equal([...storage.files.keys()].some((name) => name.endsWith('.tmp')), false);
    assert.deepEqual(storage.calls, ['mkdir', 'write', 'rename', 'unlink']);
});

test('partial write failure preserves old final and always cleans temp', async () => {
    const storage = fakeFileSystem({ partialWrite: true, writeFailure: true });
    await assert.rejects(saveToLocalStorage(
        'xlsx/cards.xlsx', Buffer.from('new'), dependencies(storage)
    ), /raw write/);
    assert.equal(storage.files.get(storage.finalPath).toString(), 'old');
    assert.equal([...storage.files.keys()].some((name) => name.endsWith('.tmp')), false);
    assert.deepEqual(storage.calls, ['mkdir', 'write', 'unlink']);
});

test('rename failure preserves old final and cleans temp', async () => {
    const storage = fakeFileSystem({ renameFailure: true });
    await assert.rejects(saveToLocalStorage(
        'xlsx/cards.xlsx', Buffer.from('new'), dependencies(storage)
    ), /raw rename/);
    assert.equal(storage.files.get(storage.finalPath).toString(), 'old');
    assert.equal([...storage.files.keys()].some((name) => name.endsWith('.tmp')), false);
    assert.deepEqual(storage.calls, ['mkdir', 'write', 'rename', 'unlink']);
});

test('non-ENOENT cleanup failure emits only allowlisted diagnostics', async () => {
    const storage = fakeFileSystem({ renameFailure: true });
    storage.api.unlink = async () => { throw Object.assign(new Error('raw cleanup path'), { code: 'EACCES' }); };
    const entries = [];
    await assert.rejects(saveToLocalStorage(
        'xlsx/cards.xlsx', Buffer.from('new'), dependencies(storage, {
            error: (...args) => entries.push(args)
        })
    ));
    const serialized = JSON.stringify(entries);
    assert.match(serialized, /LOCAL_TEMP_CLEANUP_FAILED/);
    assert.equal(serialized.includes('raw cleanup path'), false);
    assert.equal(serialized.includes('/local'), false);
});

test('cleanup logger failure never masks the original storage error', async () => {
    const storage = fakeFileSystem({ renameFailure: true });
    storage.api.unlink = async () => {
        throw Object.assign(new Error('raw cleanup path'), { code: 'EACCES' });
    };
    await assert.rejects(saveToLocalStorage(
        'xlsx/cards.xlsx', Buffer.from('new'), dependencies(storage, {
            error: () => { throw new Error('raw logger failure'); }
        })
    ), /raw rename/);
    assert.equal(storage.files.get(storage.finalPath).toString(), 'old');
});

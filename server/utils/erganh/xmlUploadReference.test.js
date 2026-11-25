'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const syncFs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { Readable } = require('node:stream');
const { resolveXmlUploadReference, xmlReferenceFailure } = require('./xmlUploadReference');

const bytes = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><test>Ελληνικά &amp; Latin</test>');
const bucket = 'synthetic-bucket';
const urlKey = key => key.split('/').map(encodeURIComponent).join('/');

async function fixture(t, key = 'xmls/BLG/0008_Εταιρεία/E3N/Επώνυμο Όνομα.xml') {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'payroll-xml-reference-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const filename = path.join(root, key);
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, bytes);
    return { root, key, filename, options: { root, bucket, useLocalStorage: true,
        downloadS3UriToTempFile() { assert.fail('No real S3 or network access allowed'); } } };
}

for (const name of ['Ελληνικά όνομα', 'Latin name', 'όνομα + & # ? % 100%', 'literal_%CE%A9_%20_%2520']) {
    test(`DEV: URL, opaque key, path and file URL preserve bytes: ${name}`, async t => {
        const f = await fixture(t, `xmls/BLG/0008_${name}/E3N/${name}.xml`);
        for (const reference of [f.key, `s3://${bucket}/${f.key}`, f.filename,
            `uploads/s3-mock/${f.key}`, `file://${f.filename}`, pathToFileURL(f.filename).href,
            '/uploads/s3-mock/' + urlKey(f.key),
            `https://${bucket}.s3.eu-central-1.amazonaws.com/${urlKey(f.key)}?X-Amz-Signature=synthetic`]) {
            const result = await resolveXmlUploadReference(reference, 'synthetic-company', f.options);
            assert.equal(result.localXmlPath, f.filename);
            assert.equal(result.tempDownloaded, false);
            assert.deepEqual(await fs.readFile(result.localXmlPath), bytes);
        }
    });
}

test('legacy encoded filenames remain addressable without decoding their opaque key', async t => {
    const key = 'xmls/BLG/0008_%CE%A9/E3N/%CE%94.xml';
    const f = await fixture(t, key);
    for (const reference of [key, `file://${f.filename}`, '/uploads/s3-mock/' + key,
        '/uploads/s3-mock/' + urlKey(key)]) {
        assert.equal((await resolveXmlUploadReference(reference, 'test', f.options)).localXmlPath, f.filename);
    }
});

test('URL decoding is exactly once and does not select a different literal-percent file', async t => {
    const f = await fixture(t, 'xmls/BLG/0008_%20/E3N/%CE%A9.xml');
    const other = path.join(f.root, 'xmls/BLG/0008_ /E3N/Ω.xml');
    await fs.mkdir(path.dirname(other), { recursive: true });
    await fs.writeFile(other, 'wrong-file');
    const result = await resolveXmlUploadReference('/uploads/s3-mock/' + urlKey(f.key), 'test', f.options);
    assert.equal(result.localXmlPath, f.filename);
    assert.deepEqual(await fs.readFile(result.localXmlPath), bytes);
});

test('invalid, traversal and symlink references stop before any submission', async t => {
    const f = await fixture(t);
    const outside = path.join(f.root, 'outside.xml');
    await fs.writeFile(outside, bytes);
    await fs.symlink(outside, path.join(f.root, 'xmls', 'linked.xml'));
    for (const reference of ['/etc/passwd', '../outside.xml', 'xmls/../outside.xml',
        '/uploads/s3-mock/xmls/%2e%2e/outside.xml', '/uploads/s3-mock/xmls/%2foutside.xml',
        '/uploads/s3-mock/xmls/%5coutside.xml', '/uploads/s3-mock/xmls/%00.xml',
        '/uploads/s3-mock/xmls/%CE.xml', 'xmls/linked.xml', 'file://host/file.xml',
        `https://${bucket}.s3.eu-central-1.amazonaws.com/xmls/../outside.xml`,
        `https://${bucket}.s3.eu-central-1.amazonaws.com/xmls/%2e%2e/outside.xml`,
        'https://untrusted.test/xmls/file.xml', 's3://other-bucket/xmls/file.xml']) {
        await assert.rejects(resolveXmlUploadReference(reference, 'test', f.options),
            { code: 'XML_REFERENCE_INVALID' }, reference);
    }
});

function productionDownloader(legacyKey) {
    const calls = [];
    const module = { exports: {} };
    const silent = { log() {}, warn() {}, error() {} };
    const source = syncFs.readFileSync(path.join(__dirname, '../s3Helper.js'), 'utf8');
    vm.runInNewContext(source, {
        module, exports: module.exports, __dirname: path.resolve(__dirname, '..'), console: silent,
        process: { env: { NODE_ENV: 'production' } },
        require(name) {
            if (name === '../config/aws') return { S3_BUCKET_NAME: bucket,
                s3Client: { async send(command) {
                    calls.push(command.input);
                    if (legacyKey && command.input.Key !== legacyKey) {
                        throw Object.assign(new Error('synthetic missing key'), { name: 'NoSuchKey' });
                    }
                    return { Body: Readable.from([bytes]) };
                } } };
            if (name === '@aws-sdk/client-s3') return {
                GetObjectCommand: class { constructor(input) { this.input = input; } }
            };
            if (name === '@aws-sdk/s3-request-presigner') return {};
            return require(name);
        }
    });
    return { calls, downloadS3UriToTempFile: module.exports.downloadS3UriToTempFile };
}

for (const name of ['Ελληνικά', 'Latin', 'space + # ? % &', '%CE%A9_%20_%2520']) {
    test(`Production S3 SDK receives exact opaque key and preserves XML: ${name}`, async t => {
        const mock = productionDownloader();
        const key = `xmls/BLG/0008_${name}/E3N/${name}.xml`;
        const encoded = urlKey(key);
        const references = [key, `s3://${bucket}/${key}`,
            `https://${bucket}.s3.eu-central-1.amazonaws.com/${encoded}?X-Amz-Signature=test`,
            `https://s3.eu-central-1.amazonaws.com/${bucket}/${encoded}`,
            `https://${bucket}.s3.amazonaws.com/${encoded}`];
        for (const reference of references) {
            const result = await resolveXmlUploadReference(reference, 'test', {
                bucket, useLocalStorage: false, ...mock
            });
            t.after(() => fs.rm(result.localXmlPath, { force: true }));
            assert.equal(result.tempDownloaded, true);
            assert.deepEqual(await fs.readFile(result.localXmlPath), bytes);
            assert.equal(mock.calls.at(-1).Key, key);
            assert.equal(mock.calls.at(-1).Bucket, bucket);
        }
        assert.equal(mock.calls.length, references.length, 'No double encoding retry');
    });
}

test('production rejects local references without invoking S3', async () => {
    await assert.rejects(resolveXmlUploadReference('/uploads/s3-mock/xmls/file.xml', 'test', {
        bucket, useLocalStorage: false,
        downloadS3UriToTempFile() { assert.fail('Unexpected download'); }
    }), { code: 'XML_REFERENCE_INVALID' });
});

test('existing S3 encoded-key fallback remains compatible without renaming objects', async t => {
    const key = 'xmls/BLG/0008_Εταιρεία/E3N/Όνομα.xml';
    const storedKey = encodeURI(key);
    const mock = productionDownloader(storedKey);
    const result = await resolveXmlUploadReference(
        `https://${bucket}.s3.eu-central-1.amazonaws.com/${urlKey(key)}`, 'test', {
            bucket, useLocalStorage: false, ...mock
        });
    t.after(() => fs.rm(result.localXmlPath, { force: true }));
    assert.deepEqual(mock.calls.map(call => call.Key), [key, storedKey]);
    assert.deepEqual(await fs.readFile(result.localXmlPath), bytes);
});

function endpoint(options, upload, credentialsRead) {
    const source = syncFs.readFileSync(path.join(__dirname, '../../controllers/ergazomenoi/ergazomenoiController.js'), 'utf8');
    const handler = source.match(/static uploadE3ToErganh = (async[\s\S]*?\n    });/)[1];
    const silent = { log() {}, info() {}, warn() {}, error() {} };
    return vm.runInNewContext(`(${handler})`, {
        console: silent, logger: silent, path, S3_BUCKET_NAME: bucket,
        process: { env: { NODE_ENV: options.useLocalStorage ? 'development' : 'production' } },
        erganiLastStart: new Map(), erganiInflight: new Map(), ERGANI_COOLDOWN_MS: 0,
        isS3Url: reference => /^s3:|^https?:/.test(reference),
        resolveXmlUploadReference: (reference, company, actualOptions) => {
            assert.equal(actualOptions.useLocalStorage, options.useLocalStorage);
            assert.equal(actualOptions.bucket, bucket);
            return resolveXmlUploadReference(reference, company, { ...actualOptions, root: options.root });
        },
        xmlReferenceFailure, downloadS3UriToTempFile: options.downloadS3UriToTempFile,
        fs: { stat: fs.stat, remove: filename => fs.rm(filename, { force: true }),
            pathExists: async filename => { try { await fs.access(filename); return true; } catch { return false; } } },
        PasswordsModel: { findOne() { credentialsRead(); return { lean: async () => ({ username: 'synthetic', password: 'synthetic' }) }; } },
        require(name) {
            if (name === '../../socket') return { emitToUser() {} };
            if (name === '../../utils/erganh/e3Uploader') return { uploadE3ToErganh: upload };
            assert.fail(`Unexpected real dependency: ${name}`);
        }
    });
}

test('real E3 endpoint reaches mock temporary uploader exactly once with existing XML', async t => {
    const f = await fixture(t);
    let uploads = 0, reads = 0, body;
    const handler = endpoint(f.options, async (company, filename, user, creds, options) => {
        uploads++;
        assert.equal(options.isPermanent, false);
        assert.equal(filename, f.filename);
        assert.deepEqual(await fs.readFile(filename), bytes);
        return { success: true, userMessage: 'synthetic temporary submission' };
    }, () => reads++);
    await handler({ session: { companyInUse: 'test', userId: 'test' }, body: {
        ergazomenosId: 'synthetic-employee', s3Url: '/uploads/s3-mock/' + urlKey(f.key), isPermanent: false
    } }, { status() { return this; }, json(payload) { body = payload; } });
    assert.equal(body.success, true);
    assert.equal(uploads, 1);
    assert.equal(reads, 1);
    assert.deepEqual(await fs.readFile(f.filename), bytes);
});

test('missing XML stops real endpoint before credential lookup or any ERGANI call', async t => {
    const f = await fixture(t);
    let body;
    const handler = endpoint(f.options, () => assert.fail('No ERGANI submission allowed'),
        () => assert.fail('No credentials read allowed'));
    await handler({ session: { companyInUse: 'test', userId: 'test' }, body: {
        ergazomenosId: 'synthetic-employee', s3Url: '/uploads/s3-mock/xmls/missing.xml', isPermanent: false
    } }, { status() { return this; }, json(payload) { body = payload; } });
    assert.equal(body.success, false);
    assert.match(body.userMessage, /Δεν έγινε επικοινωνία ή υποβολή/);
    assert.match(body.userMessage, /1\..*\n2\./);
    assert.match(body.userMessage, /δεν αποθηκεύτηκε καμία νέα αλλαγή/);
    assert.equal(body.errorDetails, '');
});

test('production endpoint sends the raw key to mock S3 and cleans only its downloaded temporary XML', async t => {
    const f = await fixture(t);
    const mock = productionDownloader();
    let uploadedPath, body;
    const handler = endpoint({ useLocalStorage: false, ...mock }, async (company, filename, user, creds, options) => {
        uploadedPath = filename;
        assert.equal(options.isPermanent, false);
        assert.deepEqual(await fs.readFile(filename), bytes);
        return { success: true };
    }, () => {});
    await handler({ session: { companyInUse: 'test', userId: 'test' }, body: {
        ergazomenosId: 'synthetic-employee', s3Url: f.key, isPermanent: false
    } }, { status() { return this; }, json(payload) { body = payload; } });
    assert.equal(body.success, true);
    assert.equal(mock.calls[0].Key, f.key);
    // The endpoint intentionally schedules cleanup without blocking its response.
    for (let attempt = 0; attempt < 20; attempt++) {
        try { await fs.access(uploadedPath); } catch (error) {
            if (error.code === 'ENOENT') break;
            throw error;
        }
        await new Promise(resolve => setImmediate(resolve));
    }
    await assert.rejects(fs.access(uploadedPath), { code: 'ENOENT' });
    assert.deepEqual(await fs.readFile(f.filename), bytes);
});

test('E3 frontend passes exact storage key before display URLs in both save continuations', () => {
    const source = syncFs.readFileSync(path.join(__dirname, '../../../public/js/ergazomenoi/genika/putFieldValues.js'), 'utf8');
    const selections = [...source.matchAll(/const e3UrlToSend =([\s\S]*?);/g)];
    assert.equal(selections.length, 2);
    for (const selection of selections) {
        const key = 'xmls/BLG/0008_Εταιρεία %20/E3N/Όνομα + # ?.xml';
        assert.equal(vm.runInNewContext(selection[1], { e3XmlData: {
            s3Key: key, s3Url: 'legacy-display-url', downloadUrl: 'encoded-display-url'
        } }), key);
    }
});

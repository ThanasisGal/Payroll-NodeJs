'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const User = require('../models/userModel');

test('Template upload scope is enforced by the real route and role middleware', async t => {
    const uploads = [], folders = [];
    const stubs = [
        ['../utils/s3Helper', { uploadBufferToS3: async (buffer, key) => {
            assert.equal(buffer.toString(), 'synthetic'); uploads.push(key); return { s3Key: key, s3Url: 'synthetic' };
        } }],
        ['../utils/textCacheManager', { refresh: async () => ({ totalFiles: 1 }) }],
        ['../utils/userContext', { getCompanyFolder: async (company, team) => {
            folders.push({ company, team }); return company === 'foreign-company' ? '0000_UNKNOWN' : '0001_SYNTHETIC';
        } }],
        ['../config/multer', { uploadTextTemplate: { array: () => (req, res, next) => {
            req.files = [{ originalname: '_FIELD_0001.txt', buffer: Buffer.from('synthetic') }]; next();
        } } }]
    ];
    const previous = new Map();
    for (const [name, exports] of stubs) {
        const resolved = require.resolve(name); previous.set(resolved, require.cache[resolved]);
        require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
    }
    const originalFind = User.findById;
    const users = {
        global: { _id: '650000000000000000000001', privileges: 'A', situation: 'A', team: 'THA' },
        admin: { _id: '650000000000000000000002', privileges: 'A', situation: 'A', team: 'TEAM1' },
        supervisor: { _id: '650000000000000000000003', privileges: 'S', situation: 'A', team: 'TEAM1' },
        supervisorTHA: { _id: '650000000000000000000004', privileges: 'S', situation: 'A', team: 'THA' },
        hr: { _id: '650000000000000000000005', privileges: 'HR', situation: 'A', team: 'TEAM1' },
        inactive: { _id: '650000000000000000000006', privileges: 'A', situation: 'I', team: 'TEAM1' }
    };
    const app = express(); app.use(express.json());
    app.use((req, res, next) => {
        const actor = users[req.get('X-Synthetic-Actor')];
        req.session = actor ? { userId: actor._id, userTeam: 'FORGED_SESSION_TEAM', userRole: 'A' } : {};
        next();
    });
    let server;
    try {
        User.findById = id => ({ select() { return this; }, lean: async () => Object.values(users).find(user => user._id === id) });
        app.use('/admin', require('../routes/adminRoutes'));
        server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
        const request = async (actor, body = {}) => {
            const before = uploads.length;
            const response = await fetch(`http://127.0.0.1:${server.address().port}/admin/templates/upload`, {
                method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', 'X-Synthetic-Actor': actor },
                body: JSON.stringify({ company: 'synthetic-company', category: 'symbash', prefix: '_TEST_', ...body }) });
            const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {};
            return { response, data, written: uploads.slice(before) };
        };
        for (const [actor, team, expected] of [
            ['global', 'TEAM2', 'TEAM2'], ['global', ' team2 ', 'TEAM2'],
            ['admin', 'TEAM1', 'TEAM1'], ['supervisor', 'team1', 'TEAM1'], ['supervisorTHA', 'THA', 'THA'],
            ['global', undefined, 'THA'], ['admin', undefined, 'TEAM1'], ['supervisor', undefined, 'TEAM1']
        ]) await t.test(`${actor} may upload only into authorized ${expected}`, async () => {
            const result = await request(actor, team === undefined ? {} : { team });
            assert.equal(result.response.status, 200); assert.equal(result.data.success, true);
            assert.deepEqual(result.written, [`txt/${expected}/0001_SYNTHETIC/symbash/_TEST_/_FIELD_0001.txt`]);
            assert.equal(folders.at(-1).team, expected);
        });
        for (const actor of ['admin', 'supervisor', 'supervisorTHA']) await t.test(`${actor} cannot bypass group scope with direct HTTP`, async () => {
            const result = await request(actor, { team: 'TEAM2', adminActor: users.global });
            assert.equal(result.response.status, 403); assert.deepEqual(result.written, []);
            assert.equal(result.data.code, 'TEMPLATE_UPLOAD_TEAM_FORBIDDEN');
            assert.match(result.data.error, /1\..*2\..*Δεν μεταφορτώθηκε κανένα αρχείο/s);
        });
        const invalid = ['', '  ', null, 123, true, [], ['TEAM1'], { $ne: null }, '../TEAM2', 'TEAM/OTHER'];
        for (const actor of ['global', 'supervisor']) for (let index = 0; index < invalid.length; index++)
            await t.test(`${actor} rejects invalid group shape ${index} without fallback`, async () => {
                const result = await request(actor, { team: invalid[index] });
                assert.equal(result.response.status, 400); assert.deepEqual(result.written, []);
                assert.equal(result.data.code, 'TEMPLATE_UPLOAD_INVALID_TEAM');
            });
        for (const [actor, status] of [['missing', 302], ['hr', 403], ['inactive', 403]])
            await t.test(`${actor} cannot bypass role or active-account authorization`, async () => {
                const result = await request(actor, { team: 'TEAM1' });
                assert.equal(result.response.status, status); assert.deepEqual(result.written, []);
            });
        await t.test('a company outside the authorized group cannot create an UNKNOWN upload folder', async () => {
            const result = await request('admin', { team: 'TEAM1', company: 'foreign-company' });
            assert.equal(result.response.status, 403); assert.deepEqual(result.written, []);
            assert.equal(result.data.code, 'TEMPLATE_UPLOAD_COMPANY_FORBIDDEN');
        });
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        User.findById = originalFind;
        for (const [resolved, entry] of previous) {
            if (entry) require.cache[resolved] = entry; else delete require.cache[resolved];
        }
    }
});

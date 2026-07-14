const assert = require('assert');
const http = require('http');
const express = require('express');
const { createRepoTransferDecisionBodyMiddleware } = require('./repoTransferDecisionBodyParser');

function request(port, body, includeLength) {
    return new Promise((resolve, reject) => {
        const headers = { 'Content-Type': 'application/json' };
        if (includeLength) headers['Content-Length'] = Buffer.byteLength(body);
        const req = http.request({ port, path: '/api/prodhlomena-oraria/review/repo-transfer-decisions', method: 'POST', headers }, (res) => {
            let response = '';
            res.on('data', (chunk) => { response += chunk; });
            res.on('end', () => resolve({
                status: res.statusCode,
                body: response,
                contentType: res.headers['content-type'] || ''
            }));
        });
        req.on('error', reject);
        if (includeLength) req.end(body);
        else { req.write(body.slice(0, Math.floor(body.length / 2))); req.end(body.slice(Math.floor(body.length / 2))); }
    });
}

async function run() {
    const app = express();
    app.use(
        '/api/prodhlomena-oraria/review/repo-transfer-decisions',
        ...createRepoTransferDecisionBodyMiddleware()
    );
    app.use(express.json({ limit: '50mb' }));
    let controllerCalls = 0;
    app.post('/api/prodhlomena-oraria/review/repo-transfer-decisions', (req, res) => {
        controllerCalls++;
        return res.json({ size: JSON.stringify(req.body).length });
    });
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    try {
        const valid = await request(port, JSON.stringify({ value: 'ok' }), true);
        assert.strictEqual(valid.status, 200);
        assert.match(valid.contentType, /application\/json/);
        const oversized = JSON.stringify({ value: 'x'.repeat(17 * 1024) });
        for (const includeLength of [true, false]) {
            const response = await request(port, oversized, includeLength);
            assert.strictEqual(response.status, 413);
            assert.match(response.contentType, /application\/json/);
            assert.deepStrictEqual(JSON.parse(response.body), {
                success: false,
                message: 'Η εντολή απόφασης υπερβαίνει το επιτρεπτό μέγεθος.'
            });
        }
        const malformed = await request(port, '{"broken":', false);
        assert.strictEqual(malformed.status, 400);
        assert.match(malformed.contentType, /application\/json/);
        assert.deepStrictEqual(JSON.parse(malformed.body), {
            success: false,
            message: 'Η εντολή απόφασης δεν περιέχει έγκυρα δεδομένα JSON.'
        });
        assert.strictEqual(controllerCalls, 1);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
    console.log('repo transfer decision body parser tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });

'use strict';

// Small, serial, in-memory BSON benchmark. The optional latency is an explicit
// simulation per read, not a MongoDB or DEV measurement. No database is opened.
// Usage: node --require ./test/fixtures/correction3OfflineGuard.cjs this-file
//        /absolute/before-service.js /tmp/report.json
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { syntheticProtectionStore, row } = require('./employeeHistoryProtectionSyntheticReadStore');
const file = require.resolve('../../server/services/ergazomenoi/employeeHistoryLegacyProtectionService');
const beforeFile = process.argv[2], output = process.argv[3];
assert.ok(beforeFile && path.isAbsolute(beforeFile) && output && path.isAbsolute(output));
const baseline = new Module(file, module);
baseline.filename = file; baseline.paths = Module._nodeModulePaths(path.dirname(file));
baseline._compile(fs.readFileSync(beforeFile, 'utf8'), file);
const readers = { before: baseline.exports.readLegacyProtection, after: require(file).readLegacyProtection };
const median = values => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function main() {
    const samples = [];
    for (const scenario of ['empty', 'small-snapshot']) {
        for (const latencyMs of [0, 5]) {
            const source = scenario === 'empty' ? {} : { controls: [row()], snapshots: [row({
                frozen_snapshot: { amount: 1234.56, syntheticPayload: 'x'.repeat(16384) }
            })] };
            let expected;
            for (const [version, read] of Object.entries(readers)) {
                const measured = [];
                for (let index = 0; index < 6; index++) {
                    const store = syntheticProtectionStore({ ...source, latencyMs });
                    const started = performance.now();
                    const proof = await read({ ...store, preserveOriginal: true });
                    const wallMs = performance.now() - started;
                    expected ||= proof;
                    assert.deepEqual(proof, expected, 'Every field and BSON fingerprint must remain identical');
                    if (index) measured.push({ wallMs, readCount: store.reads.length,
                        returnedBsonBytes: store.reads.reduce((sum, item) => sum + item.bytes, 0) });
                }
                samples.push({ scenario, latencyMs, version, samples: measured.length,
                    medianMs: Number(median(measured.map(item => item.wallMs)).toFixed(3)),
                    readCount: measured[0].readCount, returnedBsonBytes: measured[0].returnedBsonBytes });
            }
        }
    }
    const report = { node: process.version, database: false, serial: true,
        note: 'latencyMs is simulated per read; returnedBsonBytes counts the synthetic BSON payload, not network traffic', samples };
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });

'use strict';
// Only Legacy Fence may replay this contract. It cannot authorize settlement.
// The old receipt predates contract-version metadata and stores no proposal:
// identify a supported contract by reproducing its ENTIRE original digest.
const { readFileSync } = require('node:fs');
const { createHash, timingSafeEqual } = require('node:crypto');
const vm = require('node:vm');
const path = require('node:path').posix;
const S = require('./employeeHistoryAutomaticSettlementPreparationContract');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const COMMIT = 'd4483357f91679dabca97996ad7614a143f4d1f1';
const BUNDLE_SHA256 = '5e2833a4542f6fc5c751f60dc742286e8dd241ea83a9c600c55afc6130fdea17';
const PREFIX = 'server/services/ergazomenoi/';
let bundle;
function historicalContract(input) {
    if (!bundle) {
        const bytes = readFileSync(__dirname + '/legacyApprovalContracts/d4483357.json');
        if (createHash('sha256').update(bytes).digest('hex') !== BUNDLE_SHA256) throw Error('LEGACY_CONTRACT_INTEGRITY');
        const parsed = JSON.parse(bytes);
        if (parsed.commit !== COMMIT) throw Error('LEGACY_CONTRACT_VERSION');
        bundle = parsed;
    }
    // No application require, models, filesystem, environment or connection is
    // supplied to archived code. Only pure code and BSON identity construction.
    const context = vm.createContext({ Date, Buffer }, { codeGeneration: { strings: false, wasm: false } });
    const cache = new Map();
    const crypto = Object.freeze({ createHash, timingSafeEqual });
    const mongoose = Object.freeze({ Types: Object.freeze({ ObjectId: require('mongoose').Types.ObjectId }) });
    function load(filename) {
        if (cache.has(filename)) return cache.get(filename).exports;
        const entry = bundle.files[filename];
        if (!entry) throw Error('LEGACY_CONTRACT_DEPENDENCY');
        const source = entry.source.join('\n');
        const bytes = Buffer.from(source);
        if (createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex') !== entry.gitBlob)
            throw Error('LEGACY_CONTRACT_INTEGRITY');
        const module = { exports: {} };
        cache.set(filename, module);
        const localRequire = name => {
            if (name === 'node:crypto') return crypto;
            if (name === 'mongoose') return mongoose;
            if (!name.startsWith('.')) throw Error('LEGACY_CONTRACT_DEPENDENCY');
            const target = path.normalize(path.join(path.dirname(filename), name));
            return load(target.endsWith('.js') ? target : target + '.js');
        };
        new vm.Script('(function(require,module,exports){\n' + source + '\n})', { filename: COMMIT + '/' + filename })
            .runInContext(context, { timeout: 2000 })(localRequire, module, module.exports);
        return module.exports;
    }
    context.input = S.clone(input);
    context.loadContract = load;
    return new vm.Script(`
        const U = loadContract('${PREFIX}employeeHistoryCoordinatedSettlementContract.js');
        const S = loadContract('${PREFIX}employeeHistoryAutomaticSettlementPreparationContract.js');
        const proposal = U.buildCoordinatedSettlementProposal(input);
        ({ proposal, fingerprint: proposal.status === 'CLEAN' && !proposal.noOp
            ? S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal }) : null });
    `).runInContext(context, { timeout: 2000 });
}
function verifyLegacyApprovalContract(input, fingerprint) {
    // Current unversioned receipts remain supported by the original full check.
    // A current planning rejection cannot invalidate a genuinely old approval.
    try {
        const proposal = require('./employeeHistoryCoordinatedSettlementContract').buildCoordinatedSettlementProposal(input);
        if (proposal.status === 'CLEAN' && !proposal.noOp && A.tokenMatches(
            S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal }), fingerprint)) return 'CURRENT';
    } catch (error) {
        if (error.statusCode !== 409 && error.statusCode !== 400) throw error;
    }
    const historical = historicalContract(input);
    return historical.fingerprint && A.tokenMatches(historical.fingerprint, fingerprint) ? COMMIT : null;
}
module.exports = { COMMIT, verifyLegacyApprovalContract };

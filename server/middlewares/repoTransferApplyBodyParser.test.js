const assert = require('assert');
const fs = require('fs');
const { REPO_TRANSFER_APPLY_BODY_LIMIT, validateRepoTransferApplyBody, handleRepoTransferApplyBodyParserError } = require('./repoTransferApplyBodyParser');

function invoke(body, contentType = 'application/json') {
    let result = null; let nextCalled = false;
    const req = { body, is: (type) => type === contentType ? type : false };
    const res = { status(code) { result = { code }; return this; }, json(payload) { result.payload = payload; return result; } };
    validateRepoTransferApplyBody(req, res, () => { nextCalled = true; });
    return { result, nextCalled };
}
assert.strictEqual(REPO_TRANSFER_APPLY_BODY_LIMIT, '4kb');
assert.strictEqual(invoke({ request_id: 'request-123' }).nextCalled, true);
for (const body of [[], 'x', 1, { request_id: 'x', decision_id: 'abc' }, { other: 'x' }, { '$set': 'x' }, { 'a.b': 'x' }, { request_id: {} }, { request_id: [] }]) assert.strictEqual(invoke(body).result.code, 400);
assert.strictEqual(invoke({ request_id: 'x' }, 'text/plain').result.code, 415);
let parserResult; handleRepoTransferApplyBodyParserError({ type: 'entity.too.large' }, {}, { status(code) { parserResult = { code }; return this; }, json(value) { parserResult.value = value; } }, () => {});
assert.strictEqual(parserResult.code, 413);
const syntax = new SyntaxError('bad'); syntax.status = 400;
handleRepoTransferApplyBodyParserError(syntax, {}, { status(code) { parserResult = { code }; return this; }, json(value) { parserResult.value = value; } }, () => {});
assert.strictEqual(parserResult.code, 400);
const source = fs.readFileSync(__filename.replace(/\.test\.js$/, '.js'), 'utf8');
assert.ok(source.includes("limit: REPO_TRANSFER_APPLY_BODY_LIMIT"));
assert.ok(!source.includes('syncIndexes') && !source.includes('createIndexes'));
console.log('PASS repo-transfer apply dedicated body parser (15 tests)');

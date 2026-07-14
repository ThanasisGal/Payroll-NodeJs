const assert = require('assert');
const { validateApplyCommand, commandIdentity, validateApplySession, MAX_COMMAND_BYTES } = require('./apasxoliseisWeeklyRepoTransferApplyCommandService');
const valid = { decision_id: '507f1f77bcf86cd799439011', request_id: 'request-0001' };
const session = { userTeam: 'team', companyInUse: 'company', userId: '507f191e810c19729de860ea', userName: 'Actor', userStatus: 'A', userRole: 'A' };
function fails(value, code) { assert.throws(() => validateApplyCommand(value), (error) => error.code === code); }
assert.deepStrictEqual(validateApplyCommand(valid), valid);
[null, [], 'x', { decision_id: valid.decision_id }, { request_id: valid.request_id }, { ...valid, decision_id: 'bad' }, { ...valid, request_id: 'short' }, { ...valid, extra: 1 }, { ...valid, nested: {} }, { ...valid, request_id: [] }, { ...valid, '$set': 'x' }, { ...valid, 'x.y': 'x' }].forEach((value) => fails(value, value?.decision_id === 'bad' ? 'INVALID_DECISION_ID' : value?.request_id === 'short' ? 'INVALID_REQUEST_ID' : 'INVALID_APPLY_COMMAND'));
assert.throws(() => validateApplyCommand({ ...valid, request_id: `r${'x'.repeat(MAX_COMMAND_BYTES)}` }), (error) => ['APPLY_COMMAND_TOO_LARGE','INVALID_REQUEST_ID'].includes(error.code));
assert.strictEqual(commandIdentity(valid), commandIdentity({ ...valid, request_id: 'request-9999' }));
['A','S'].forEach((role) => assert.strictEqual(validateApplySession({ ...session, userRole: role }).created_by_user_role, role));
for (const changed of [{ userRole: 'HR' }, { userStatus: 'I' }]) assert.throws(() => validateApplySession({ ...session, ...changed }), (error) => error.statusCode === 403 && error.code === 'APPLY_NOT_AUTHORIZED');
console.log('weekly repo-transfer apply command tests passed');

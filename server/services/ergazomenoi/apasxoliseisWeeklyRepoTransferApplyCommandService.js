const crypto = require('crypto');
const mongoose = require('mongoose');
const { validateSessionScope } = require('./apasxoliseisPolicyPreviewApprovalService');

const ACTION_CODE = 'APPLY_APPROVED_LINKED_REPO_TRANSFER';
const COMMAND_KEYS = Object.freeze(['decision_id', 'request_id']);
const MAX_COMMAND_BYTES = 512;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/;

function applyError(code, statusCode, message = code) { const error = new Error(message); error.code = code; error.statusCode = statusCode; return error; }
function isPlainObject(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) return false; const prototype = Object.getPrototypeOf(value); return prototype === Object.prototype || prototype === null; }
function validateApplyCommand(payload) {
    if (!isPlainObject(payload)) throw applyError('INVALID_APPLY_COMMAND', 400);
    let encoded; try { encoded = JSON.stringify(payload); } catch { throw applyError('INVALID_APPLY_COMMAND', 400); }
    if (Buffer.byteLength(encoded, 'utf8') > MAX_COMMAND_BYTES) throw applyError('APPLY_COMMAND_TOO_LARGE', 413);
    const keys = Object.keys(payload);
    if (keys.length !== 2 || keys.some((key) => !COMMAND_KEYS.includes(key) || key.startsWith('$') || key.includes('.'))) throw applyError('INVALID_APPLY_COMMAND', 400);
    if (keys.some((key) => typeof payload[key] !== 'string')) throw applyError('INVALID_APPLY_COMMAND', 400);
    const decision_id = payload.decision_id.trim().toLowerCase(); const request_id = payload.request_id.trim();
    if (!mongoose.isValidObjectId(decision_id)) throw applyError('INVALID_DECISION_ID', 400);
    if (!REQUEST_ID_PATTERN.test(request_id)) throw applyError('INVALID_REQUEST_ID', 400);
    return Object.freeze({ decision_id, request_id });
}
function commandIdentity(command) { return crypto.createHash('sha256').update(`${ACTION_CODE}:${command.decision_id}`).digest('hex'); }
function validateApplySession(session) {
    let scope; try { scope = validateSessionScope(session); } catch (error) { throw applyError('APPLY_NOT_AUTHORIZED', 403, error.message); }
    if (!['A', 'S'].includes(scope.created_by_user_role)) throw applyError('APPLY_NOT_AUTHORIZED', 403);
    return Object.freeze({ ...scope, company_kodikos: String(session.companyKodikos || '').trim(), year: String(session.yearInUse || '').trim() });
}

module.exports = { ACTION_CODE, COMMAND_KEYS, MAX_COMMAND_BYTES, REQUEST_ID_PATTERN, applyError, validateApplyCommand, commandIdentity, validateApplySession };

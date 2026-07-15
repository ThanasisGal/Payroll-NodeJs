const { json } = require('express');

const REPO_TRANSFER_APPLY_BODY_LIMIT = '4kb';
const SAFE_MESSAGE = 'Η εντολή εφαρμογής δεν περιέχει έγκυρα δεδομένα.';

function createRepoTransferApplyBodyParser() {
    return json({ limit: REPO_TRANSFER_APPLY_BODY_LIMIT, type: 'application/json', strict: true });
}
function validateRepoTransferApplyBody(req, res, next) {
    if (!req.is('application/json')) return res.status(415).json({ success: false, message: 'Απαιτούνται δεδομένα JSON.' });
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ success: false, message: SAFE_MESSAGE });
    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== 'request_id' || keys.some((key) => key.startsWith('$') || key.includes('.')) || typeof body.request_id !== 'string') {
        return res.status(400).json({ success: false, message: SAFE_MESSAGE });
    }
    return next();
}
function handleRepoTransferApplyBodyParserError(error, _req, res, next) {
    if (error?.type === 'entity.too.large' || error?.status === 413) return res.status(413).json({ success: false, message: 'Η εντολή εφαρμογής υπερβαίνει το επιτρεπτό μέγεθος.' });
    if (error instanceof SyntaxError && error?.status === 400) return res.status(400).json({ success: false, message: SAFE_MESSAGE });
    return next(error);
}
function createRepoTransferApplyBodyMiddleware() {
    return [createRepoTransferApplyBodyParser(), handleRepoTransferApplyBodyParserError, validateRepoTransferApplyBody];
}

module.exports = { REPO_TRANSFER_APPLY_BODY_LIMIT, createRepoTransferApplyBodyParser, validateRepoTransferApplyBody, handleRepoTransferApplyBodyParserError, createRepoTransferApplyBodyMiddleware };

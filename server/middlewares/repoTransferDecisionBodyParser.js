const { json } = require('express');

const REPO_TRANSFER_DECISION_BODY_LIMIT = '16kb';

function createRepoTransferDecisionBodyParser() {
    return json({ limit: REPO_TRANSFER_DECISION_BODY_LIMIT });
}

function handleRepoTransferDecisionBodyParserError(error, _req, res, next) {
    if (error?.type === 'entity.too.large' || error?.status === 413) {
        return res.status(413).json({
            success: false,
            message: 'Η εντολή απόφασης υπερβαίνει το επιτρεπτό μέγεθος.'
        });
    }
    if (error instanceof SyntaxError && error?.status === 400 && 'body' in error) {
        return res.status(400).json({
            success: false,
            message: 'Η εντολή απόφασης δεν περιέχει έγκυρα δεδομένα JSON.'
        });
    }
    return next(error);
}

function createRepoTransferDecisionBodyMiddleware() {
    return [
        createRepoTransferDecisionBodyParser(),
        handleRepoTransferDecisionBodyParserError
    ];
}

module.exports = {
    REPO_TRANSFER_DECISION_BODY_LIMIT,
    createRepoTransferDecisionBodyParser,
    handleRepoTransferDecisionBodyParserError,
    createRepoTransferDecisionBodyMiddleware
};

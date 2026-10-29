'use strict';
const mongoose = require('mongoose');
const assert = require('node:assert/strict');
function forbidRealSettlementMongo(mock) {
    const forbidden = () => assert.fail('Απαγορεύεται πρόσβαση σε πραγματική MongoDB στη συνθετική δοκιμή');
    for (const method of ['connect', 'createConnection', 'startSession']) mock.method(mongoose, method, forbidden);
    for (const method of ['openUri', 'startSession', 'transaction']) mock.method(mongoose.connection, method, forbidden);
    mock.method(mongoose.Model.prototype, 'save', forbidden);
    for (const method of ['find', 'findOne', 'findById', 'aggregate', 'create', 'updateOne', 'updateMany',
        'deleteOne', 'deleteMany', 'insertMany', 'bulkWrite']) mock.method(mongoose.Model, method, forbidden);
}
module.exports = { forbidRealSettlementMongo };

'use strict';
// Preload for offline regressions only. Never import the application bootstrap,
// database configuration, .env, credentials or submission controllers here.
const deny = () => { throw Error('CORRECTION3_REAL_DATABASE_OR_EXTERNAL_ACTION_FORBIDDEN'); };
const mongoose = require('mongoose');
mongoose.connect = deny; mongoose.createConnection = deny;
mongoose.connection.openUri = deny;
mongoose.mongo.MongoClient.connect = deny;
mongoose.mongo.MongoClient.prototype.connect = deny;
require('@aws-sdk/client-s3').S3Client.prototype.send = deny;
require('nodemailer').createTransport = deny;
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (!['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)) deny();
    return originalFetch(input, options);
};
for (const moduleName of ['node:http', 'node:https']) {
    const http = require(moduleName), original = http.request;
    http.request = function(input, ...args) {
        const host = typeof input === 'string' || input instanceof URL ? new URL(input).hostname : input?.hostname || input?.host;
        if (host && !['127.0.0.1', '::1', '[::1]', 'localhost'].includes(host)) deny();
        return original.call(this, input, ...args);
    };
}

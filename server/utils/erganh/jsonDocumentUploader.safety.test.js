'use strict';
const assert = require('assert');
const { assertRestSubmitAllowed } = require('./jsonDocumentUploader');
const original = { env: process.env.ERGANI_ENV, submit: process.env.ALLOW_ERGANI_SUBMIT,
    production: process.env.ALLOW_ERGANI_PRODUCTION_SUBMIT };
try {
    process.env.ERGANI_ENV = 'trial'; delete process.env.ALLOW_ERGANI_SUBMIT;
    assert.throws(() => assertRestSubmitAllowed(), /ALLOW_ERGANI_SUBMIT=true/);
    process.env.ERGANI_ENV = 'production'; process.env.ALLOW_ERGANI_SUBMIT = 'true';
    delete process.env.ALLOW_ERGANI_PRODUCTION_SUBMIT;
    assert.throws(() => assertRestSubmitAllowed(), /ALLOW_ERGANI_PRODUCTION_SUBMIT=true/);
    console.log('ERGANI REST submit safety guards passed');
} finally {
    const restore = (name, value) => value === undefined ? delete process.env[name] : process.env[name] = value;
    restore('ERGANI_ENV', original.env); restore('ALLOW_ERGANI_SUBMIT', original.submit);
    restore('ALLOW_ERGANI_PRODUCTION_SUBMIT', original.production);
}

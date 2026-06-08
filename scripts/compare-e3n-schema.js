const fs = require('fs');
const path = require('path');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function getRecord(obj, label) {
    const arr = obj?.AnaggeliesE3N?.AnaggeliaE3N;
    if (!Array.isArray(arr) || !arr[0] || typeof arr[0] !== 'object') {
        throw new Error(`${label}: Δεν βρέθηκε AnaggeliesE3N.AnaggeliaE3N[0]`);
    }
    return arr[0];
}

const [schemaPath, payloadPath] = process.argv.slice(2);

if (!schemaPath || !payloadPath) {
    console.error('Usage: node scripts/compare-e3n-schema.js <schema-sample.json> <payload.json>');
    process.exit(1);
}

const schemaRecord = getRecord(readJson(schemaPath), 'Schema');
const payloadRecord = getRecord(readJson(payloadPath), 'Payload');

const schemaKeys = Object.keys(schemaRecord).sort();
const payloadKeys = Object.keys(payloadRecord).sort();

const missing = schemaKeys.filter((key) => !payloadKeys.includes(key));
const extra = payloadKeys.filter((key) => !schemaKeys.includes(key));

console.log('Schema keys:', schemaKeys.length);
console.log('Payload keys:', payloadKeys.length);
console.log('Missing:', missing.length ? missing : 'None');
console.log('Extra:', extra.length ? extra : 'None');

if (missing.length || extra.length) process.exitCode = 2;

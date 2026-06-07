'use strict';

require('dotenv').config();
const fs = require('fs-extra');

const {
    authenticateErgani,
    logoutErgani,
    getSubmissions,
    getDocumentSchema
} = require('./server/utils/erganh/erganiRestClient');

function collectKeys(obj, prefix = '') {
    const keys = new Set();

    if (Array.isArray(obj)) {
        if (obj[0]) {
            for (const key of collectKeys(obj[0], prefix)) keys.add(key);
        }
        return keys;
    }

    if (!obj || typeof obj !== 'object') return keys;

    for (const [k, v] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${k}` : k;
        keys.add(full);

        if (v && typeof v === 'object') {
            for (const childKey of collectKeys(v, full)) keys.add(childKey);
        }
    }

    return keys;
}

async function main() {
    let accessToken = null;
    let refreshToken = null;

    try {
        const auth = await authenticateErgani({
            username: process.env.ERGANI_USERNAME,
            password: process.env.ERGANI_PASSWORD,
            usertype: '01'
        });

        accessToken = auth.accessToken;
        refreshToken = auth.refreshToken;

        const submissions = await getSubmissions(accessToken);
        const e7n = submissions.find((x) => x.code === 'WebE7N');

        if (!e7n) {
            throw new Error('Δεν βρέθηκε WebE7N στο Lookup/Submissions');
        }

        const schemaResponse = await getDocumentSchema(accessToken, e7n.code);
        const schemaJson = schemaResponse.json;

        const payload = await fs.readJson('./public/json/testLyshSymbashsNew.json');

        const schemaKeys = collectKeys(schemaJson);
        const payloadKeys = collectKeys(payload);

        const missingFromPayload = [...schemaKeys].filter((k) => !payloadKeys.has(k));
        const extraInPayload = [...payloadKeys].filter((k) => !schemaKeys.has(k));

        console.log('========================================');
        console.log('E7N SCHEMA COMPARE');
        console.log('========================================');
        console.log('Submission:', e7n);
        console.log('Schema keys :', schemaKeys.size);
        console.log('Payload keys:', payloadKeys.size);

        console.log('\n--- Missing from payload ---');
        console.log(missingFromPayload.length ? missingFromPayload.join('\n') : 'None');

        console.log('\n--- Extra in payload ---');
        console.log(extraInPayload.length ? extraInPayload.join('\n') : 'None');

        await fs.writeJson('./tmp-e7n-schema.json', schemaResponse, { spaces: 2 });
        console.log('\n✅ Saved schema to tmp-e7n-schema.json');
    } catch (err) {
        console.error('❌ ERROR');
        console.error(err.message);
    } finally {
        if (refreshToken) {
            await logoutErgani(accessToken, refreshToken).catch((e) =>
                console.warn('⚠️ Logout failed:', e.message)
            );
        }
    }
}

main();

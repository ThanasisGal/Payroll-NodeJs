'use strict';

const assert = require('assert');
const qualityCheck = require('./elegxosApasxolhseonPeriodoy.orphanQualityCheck');

const html = qualityCheck.buildHtml([{ kodikos: '0004', eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΕΝΑ',
    orphan_count: 4, dates: [{ date: '2026-06-03', count: 1 },
        { date: '2026-06-08', count: 2 }, { date: '2026-06-17', count: 1 }] }]);
assert.match(html, /0004/);
assert.match(html, /ΔΟΚΙΜΗ ΕΝΑ/);
assert.match(html, />4</);
assert.match(html, /08\/06\/2026 ×2/);
assert.match(html, /max-height/);

(async () => {
    let dialogs = [];
    const base = { params: new URLSearchParams('apo_hmeromhnia=2026-06-01'), csrfToken: 'x',
        showDialog: async (options) => dialogs.push(options), logError: () => {} };
    await qualityCheck.run({ ...base, fetchImpl: async () => ({ ok: true,
        json: async () => ({ success: true, employees: [] }) }) });
    assert.strictEqual(dialogs.length, 0);

    await qualityCheck.run({ ...base, fetchImpl: async () => ({ ok: true,
        json: async () => ({ success: true, employees: [
            { kodikos: '0004', orphan_count: 4, dates: [] }
        ] }) }) });
    assert.strictEqual(dialogs.length, 1);
    assert.strictEqual(dialogs[0].title, 'Προειδοποίηση ορφανών χτυπημάτων');
    assert.strictEqual(dialogs[0].confirmButtonText, 'Εντάξει');

    dialogs = [];
    await qualityCheck.run({ ...base, fetchImpl: async () => { throw new Error('τεχνικό'); } });
    assert.strictEqual(dialogs.length, 1);
    assert.strictEqual(dialogs[0].text,
        'Δεν κατέστη δυνατός ο έλεγχος ορφανών χτυπημάτων.');
    console.log('orphan quality check UI tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });

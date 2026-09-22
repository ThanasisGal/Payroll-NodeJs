'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Controller = require('./kinhseisController');
const { AdeiesModel, ApasxolhseisModel } = require('../../models/kinhseis');

const date = value => new Date(`${value}T00:00:00.000Z`);
const start = date('2026-01-01');
const end = date('2026-06-30');
const scope = { team: 'SYNTHETIC', company_kod: '0001', xrhsh: '2026', kodikos: '0001' };

function matches(record, filter) {
    return Object.entries(filter).every(([field, selector]) => {
        if (field === '$or') return selector.some(clause => matches(record, clause));
        if (selector && typeof selector === 'object' && '$gte' in selector) {
            return record[field] instanceof Date && record[field] >= selector.$gte && record[field] <= selector.$lte;
        }
        return record[field] === selector;
    });
}

test('previous leave uses real five-slot schemas and counts only starts inside range', async () => {
    const previousSanitize = mongoose.get('sanitizeFilter');
    const previousFind = ApasxolhseisModel.find;
    const records = [
        new ApasxolhseisModel({ ...scope, apo_hmeromhnia_adeias_01: date('2026-02-01'), hmeres_adeias_01: 2 }),
        new ApasxolhseisModel({ ...scope, apo_hmeromhnia_adeias_03: date('2026-03-01'), hmeres_adeias_03: 3 }),
        new ApasxolhseisModel({ ...scope, apo_hmeromhnia_adeias_01: date('2025-12-01'), hmeres_adeias_01: 9 }),
        new ApasxolhseisModel({ ...scope, apo_hmeromhnia_adeias_01: date('2026-08-01'), hmeres_adeias_01: 11 }),
        new ApasxolhseisModel({ ...scope, apo_hmeromhnia_adeias_01: date('2026-04-01'), hmeres_adeias_01: 4,
            apo_hmeromhnia_adeias_02: date('2026-05-01'), hmeres_adeias_02: 5,
            apo_hmeromhnia_adeias_03: date('2026-09-01'), hmeres_adeias_03: 7 })
    ];
    mongoose.set('sanitizeFilter', true);
    try {
        for (let i = 1; i <= 5; i++) {
            const field = `apo_hmeromhnia_adeias_0${i}`;
            assert.equal(AdeiesModel.schema.path(field).instance, 'Date');
            assert.equal(ApasxolhseisModel.schema.path(field).instance, 'Date');
        }
        let selectedRecords = records;
        ApasxolhseisModel.find = filter => {
            const query = previousFind.call(ApasxolhseisModel, filter);
            mongoose.sanitizeFilter(query.getFilter());
            assert.doesNotThrow(() => query.cast(ApasxolhseisModel));
            const adeiesQuery = AdeiesModel.find(filter);
            mongoose.sanitizeFilter(adeiesQuery.getFilter());
            assert.doesNotThrow(() => adeiesQuery.cast(AdeiesModel));
            return Promise.resolve(selectedRecords.filter(record => matches(record, filter)));
        };
        for (const [label, cases, expected] of [
            ['slot 01 inside', [records[0]], 2],
            ['slot 03 inside', [records[1]], 3],
            ['all slots outside', [records[2]], 0],
            ['future leave after end', [records[3]], 0],
            ['multiple slots in one document', [records[4]], 9],
            ['all documents together', records, 14]
        ]) {
            selectedRecords = cases;
            let payload;
            await Controller.getSynoloProhgoymenonAdeion(
                { body: { ...scope, startDate: start.toISOString(), endDate: end.toISOString() } },
                { json(value) { payload = value; return this; }, status(code) { throw new Error(`HTTP ${code}`); } }
            );
            assert.equal(payload.synola.synolo_hmeron_adeias, expected, label);
        }
    } finally {
        ApasxolhseisModel.find = previousFind;
        mongoose.set('sanitizeFilter', previousSanitize);
    }
});

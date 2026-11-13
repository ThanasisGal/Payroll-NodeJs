'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const PeriodControlModel = require('../../models/apasxoliseisPeriodControl');

test('period filter casts correctly with sanitizeFilter enabled', () => {
    const date = new Date('2026-01-15');

    const filter = {
        team: 'TEST',
        company_kod: 'TEST',
        ypokatasthma: '0000',
        $or: mongoose.trusted([{
            period_start: mongoose.trusted({ $lte: date }),
            period_end: mongoose.trusted({ $gte: date })
        }])
    };

    const query = PeriodControlModel.find(filter)
        .setOptions({ sanitizeFilter: true });

    query._castConditions();

    if (query.error()) throw query.error();

    const casted = query.getFilter();

    assert.ok(casted.$or);
    assert.ok(casted.$or[0].period_start.$lte instanceof Date);
    assert.ok(casted.$or[0].period_end.$gte instanceof Date);
});

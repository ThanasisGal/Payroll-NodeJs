'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { ErgazomenoiModel, ProdhlomenaOrariaModel, ErgazomenoiErganhModel } = require('./models/ergazomenoi');
const { ApasxolhseisModel, AstheneiesModel } = require('./models/kinhseis');
const { ArgiesModel, AsfalistikesKlaseisModel, EidikothtesErganhModel } = require('./models/stathera_arxeia');
const DecisionModel = require('./models/apasxoliseisWeeklyRepoTransferDecision');
const confirmedLeaveRepair = require(
    './services/ergazomenoi/apasxoliseisConfirmedFullDayLeaveHoursRepairService');
const { audit, auditSource } = require('./audits/checkMongooseRawSelectors');

function cast(model, filter) {
    const query = model.find(filter);
    mongoose.sanitizeFilter(query.getFilter());
    return query.cast(model);
}

const objectId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
const start = new Date('2026-01-01T00:00:00.000Z');
const end = new Date('2026-01-31T00:00:00.000Z');
const cases = [
    { family: 'String comparison', model: ApasxolhseisModel, field: 'periodos', operator: { $lt: '09' } },
    { family: 'Date range', model: ProdhlomenaOrariaModel, field: 'hmeromhnia', operator: { $gte: start, $lte: end } },
    { family: 'holiday Date range', model: ArgiesModel, field: 'hmeromhnia', operator: { $gte: start, $lte: end } },
    { family: 'sickness Date range', model: AstheneiesModel, field: 'apo_hmeromhnia_01', operator: { $gte: start, $lte: end } },
    { family: 'ObjectId $in', model: ApasxolhseisModel, field: '_id', operator: { $in: [objectId] } },
    { family: 'deferred String $in', model: DecisionModel, field: 'deferred_week_id', operator: { $in: ['synthetic-deferred-week'] } },
    { family: 'employee code $in', model: ErgazomenoiModel, field: 'kodikos', operator: { $in: ['0001'] } },
    { family: 'Number $type/$gt', model: ErgazomenoiErganhModel, field: 'submission_id', operator: { $type: 'number', $gt: 0 } },
    { family: 'Number range', model: AsfalistikesKlaseisModel, field: 'apo_orio', operator: { $lte: 25 } },
    { family: '$exists', model: ErgazomenoiModel, field: '_id', operator: { $exists: false } },
    { family: 'String $regex', model: ErgazomenoiModel, field: 'afm', operator: { $regex: '^\\s*123456789\\s*$' } }
];

test('server-owned operator families fail raw and cast when trusted with real schemas', () => {
    const previous = mongoose.get('sanitizeFilter');
    mongoose.set('sanitizeFilter', true);
    try {
        for (const { family, model, field, operator } of cases) {
            assert.throws(() => cast(model, { [field]: { ...operator } }),
                error => error.name === 'CastError' && error.path === field, family);
            assert.doesNotThrow(() => cast(model, { [field]: mongoose.trusted({ ...operator }) }), family);
        }
        assert.doesNotThrow(() => cast(ErgazomenoiModel, {
            $or: [{ afm: mongoose.trusted({ $regex: /^123/ }) }, { team: 'BLG' }]
        }));
        assert.throws(() => cast(EidikothtesErganhModel, {
            $or: [{ kodikos: { $regex: 'synthetic', $options: 'i' } }]
        }), error => error.name === 'CastError' && error.path === 'kodikos');
        assert.doesNotThrow(() => cast(EidikothtesErganhModel, {
            $or: [{ kodikos: mongoose.trusted({ $regex: 'synthetic', $options: 'i' }) },
                { perigrafh: mongoose.trusted({ $regex: 'synthetic', $options: 'i' }) }]
        }));
    } finally {
        mongoose.set('sanitizeFilter', previous);
    }
});

test('countDocuments and findOneAndUpdate cast filter operators through the same guard', () => {
    const previous = mongoose.get('sanitizeFilter');
    mongoose.set('sanitizeFilter', true);
    try {
        const count = ErgazomenoiModel.countDocuments({ kodikos: { $in: ['0001'] } });
        mongoose.sanitizeFilter(count.getFilter());
        assert.throws(() => count.cast(ErgazomenoiModel), { name: 'CastError', path: 'kodikos' });
        const safeCount = ErgazomenoiModel.countDocuments({ kodikos: mongoose.trusted({ $in: ['0001'] }) });
        mongoose.sanitizeFilter(safeCount.getFilter());
        assert.doesNotThrow(() => safeCount.cast(ErgazomenoiModel));

        const update = ErgazomenoiModel.findOneAndUpdate({ _id: { $exists: false } }, { $set: { energos: false } });
        mongoose.sanitizeFilter(update.getFilter());
        assert.throws(() => update.cast(ErgazomenoiModel), { name: 'CastError', path: '_id' });
        const safeUpdate = ErgazomenoiModel.findOneAndUpdate(
            { _id: mongoose.trusted({ $exists: false }) }, { $set: { energos: false } });
        mongoose.sanitizeFilter(safeUpdate.getFilter());
        assert.doesNotThrow(() => safeUpdate.cast(ErgazomenoiModel));
    } finally {
        mongoose.set('sanitizeFilter', previous);
    }
});

test('Stage-1 review write keeps the unlocked-row guard castable with narrow trust', () => {
    const previous = mongoose.get('sanitizeFilter');
    mongoose.set('sanitizeFilter', true);
    try {
        const scope = { _id: objectId, team: 'SYNTHETIC_TEAM',
            company_kod: 'SYNTHETIC_COMPANY' };
        const rawFilter = { ...scope, is_locked: { $ne: true } };
        const rawQuery = ProdhlomenaOrariaModel.find(rawFilter);
        mongoose.sanitizeFilter(rawQuery.getFilter());
        assert.deepEqual(rawQuery.getFilter().is_locked, { $eq: { $ne: true } });
        assert.throws(() => rawQuery.cast(ProdhlomenaOrariaModel),
            error => error.name === 'CastError' && error.path === 'is_locked');

        const trustedFilter = {
            ...scope,
            is_locked: mongoose.trusted({ $ne: true })
        };
        assert.equal(Object.getOwnPropertySymbols(trustedFilter).length, 0,
            'the complete selector must not be trusted');
        assert.ok(Object.getOwnPropertySymbols(trustedFilter.is_locked).length > 0,
            'only the server-owned operator boundary must be trusted');
        assert.doesNotThrow(() => cast(ProdhlomenaOrariaModel, trustedFilter));
        assert.equal(trustedFilter._id, objectId);
        assert.equal(trustedFilter.team, scope.team);
        assert.equal(trustedFilter.company_kod, scope.company_kod);
        assert.equal(trustedFilter.is_locked.$ne, true);
        assert.deepEqual(Object.keys(trustedFilter.is_locked), ['$ne']);
    } finally {
        mongoose.set('sanitizeFilter', previous);
    }
});

test('confirmed full-day leave repair keeps its date range narrowly trusted', () => {
    const previous = mongoose.get('sanitizeFilter');
    mongoose.set('sanitizeFilter', true);
    try {
        const filter = {
            team: 'SYNTHETIC_TEAM',
            company_kod: 'SYNTHETIC_COMPANY',
            ypokatasthma: '0000',
            hmeromhnia: mongoose.trusted({ $gte: start, $lte: end }),
            adeia_apologistika: true
        };
        assert.equal(Object.getOwnPropertySymbols(filter).length, 0,
            'the complete repair selector must not be trusted');
        assert.ok(Object.getOwnPropertySymbols(filter.hmeromhnia).length > 0,
            'only the server-owned date operator boundary must be trusted');
        assert.doesNotThrow(() => cast(ProdhlomenaOrariaModel, filter));
        assert.deepEqual(Object.keys(filter.hmeromhnia), ['$gte', '$lte']);
    } finally {
        mongoose.set('sanitizeFilter', previous);
    }
});

test('confirmed full-day leave repair CAS keeps missing fields narrowly trusted', () => {
    const previous = mongoose.get('sanitizeFilter');
    mongoose.set('sanitizeFilter', true);
    try {
        const filter = confirmedLeaveRepair.casFilter({ source: {
            _id: objectId,
            team: 'SYNTHETIC_TEAM',
            company_kod: 'SYNTHETIC_COMPANY',
            astheneia_apologistika: undefined
        } });
        assert.equal(Object.getOwnPropertySymbols(filter).length, 0,
            'the complete CAS selector must not be trusted');
        assert.ok(Object.getOwnPropertySymbols(filter.astheneia_apologistika).length > 0,
            'only the server-owned missing-field operator boundary must be trusted');
        assert.deepEqual(Object.keys(filter.astheneia_apologistika), ['$exists']);
        assert.doesNotThrow(() => cast(ProdhlomenaOrariaModel, filter));
    } finally {
        mongoose.set('sanitizeFilter', previous);
    }
});

test('production selectors retain narrow trust boundaries', () => {
    const root = path.resolve(__dirname, '..');
    const read = file => fs.readFileSync(path.join(root, file), 'utf8');
    const checks = [
        ['server/controllers/Kinhseis/kinhseisController.js', /periodos: mongoose\.trusted\(\{ \$lt: periodos \}\)/],
        ['server/controllers/Kinhseis/kinhseisController.js', /hmeromhnia: mongoose\.trusted\(\{\s*\$gte: rangeStart,\s*\$lte: rangeEnd/],
        ['server/controllers/Kinhseis/kinhseisController.js', /apo_hmeromhnia_01: mongoose\.trusted\(\{\s*\$gte: rangeStart,\s*\$lte: rangeEnd/],
        ['server/controllers/ergazomenoi/ergazomenoiController.js', /hmeromhnia: mongoose\.trusted\(\{\s*\$gte: new Date\(formData\.hmeromhnia_allaghs_orarioy_apo\)/],
        ['server/services/ergazomenoi/apasxoliseisCorrectivePayrollPostingService.js', /_id: mongoose\.trusted\(\{ \$in: originalIds \}\)/],
        ['server/services/ergazomenoi/apasxoliseisPeriodLifecycleService.js', /submission_id: mongoose\.trusted\(\{ \$type: 'number', \$gt: 0 \}\)/],
        ['server/services/ergazomenoi/wtoDailyDeferredBoundaryContextService.js', /deferred_week_id: mongoose\.trusted\(\{ \$in: ids \}\)/],
        ['server/middlewares/programmataAccessScope.js', /kodikos: mongoose\.trusted\(\{ \$in: codes \}\)/],
        ['server/controllers/genikaAPIsController.js', /kodikos: mongoose\.trusted\(\{ \$regex: safeSearchTerm, \$options: 'i' \}\)/],
        ['server/controllers/ergazomenoi/erganhController.js',
            /is_locked: mongoose\.trusted\(\{ \$ne: true \}\)/],
        ['server/services/ergazomenoi/apasxoliseisConfirmedFullDayLeaveHoursRepairService.js',
            /hmeromhnia: mongoose\.trusted\(\{\s*\$gte:[\s\S]*\$lte:/],
        ['server/services/ergazomenoi/apasxoliseisConfirmedFullDayLeaveHoursRepairService.js',
            /value === undefined\s*\? mongoose\.trusted\(\{ \$exists: false \}\)\s*:\s*value/]
    ];
    for (const [file, pattern] of checks) assert.match(read(file), pattern, file);
    const controller = read('server/controllers/ergazomenoi/erganhController.js');
    const writePath = controller.slice(
        controller.indexOf('static updateProdhlomenaOrariaReviewRecord = async'),
        controller.indexOf('static unlockProdhlomenaOrariaReviewRecord = async')
    );
    assert.match(writePath, /is_locked: mongoose\.trusted\(\{ \$ne: true \}\)/);
    assert.doesNotMatch(writePath,
        /ProdhlomenaOrariaModel\.updateOne\(\s*mongoose\.trusted\(/);
});

test('no new unclassified direct Mongoose field selectors', () => {
    assert.deepEqual(audit(), []);
});

test('audit catches a raw nested leave selector in the production controller', () => {
    const file = 'server/controllers/Kinhseis/kinhseisController.js';
    const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
    const trusted = 'apo_hmeromhnia_adeias_03: mongoose.trusted({ $gte: rangeStart, $lte: rangeEnd })';
    assert.ok(source.includes(trusted));
    const raw = 'apo_hmeromhnia_adeias_03: { $gte: rangeStart, $lte: rangeEnd }';
    const found = auditSource(source.replace(trusted, raw), file);
    assert.ok(found.some(item => item.id.includes('apo_hmeromhnia_adeias_03:$gte')));
    assert.ok(found.some(item => item.id.includes('apo_hmeromhnia_adeias_03:$lte')));
});

test('audit distinguishes Mongoose filters from pipelines, native queries and updates', () => {
    const file = 'server/synthetic.js';
    assert.equal(auditSource('Model.find({ afm: { $regex: "synthetic" } });', file).length, 1);
    assert.equal(auditSource('const filter = { date: { $gte: new Date() } }; Model.find(filter);', file).length, 1);
    assert.equal(auditSource('let filter = {}; filter = { afm: { $regex: "synthetic" } }; Model.find(filter);', file).length, 1);
    assert.equal(auditSource('Model.find({ $or: [{ afm: { $regex: "synthetic" } }] });', file).length, 1);
    assert.equal(auditSource('Model.find(mongoose.trusted({ $or: [{ afm: { $regex: "synthetic" } }] }));', file).length, 1);
    assert.equal(auditSource('Model.findOneAndUpdate({ afm: { $regex: "synthetic" } }, { $set: { team: "SYNTHETIC" } });', file).length, 1);
    assert.deepEqual(auditSource('Model.find({ afm: mongoose.trusted({ $regex: "synthetic" }) });', file), []);
    assert.deepEqual(auditSource('Model.aggregate([{ $match: { afm: { $regex: "synthetic" } } }]);', file), []);
    assert.deepEqual(auditSource('collection.find({ afm: { $regex: "synthetic" } });', file), []);
    assert.deepEqual(auditSource('Model.collection.find({ afm: { $regex: "synthetic" } });', file), []);
    assert.deepEqual(auditSource('Model.updateOne({ team: "BLG" }, { $set: { afm: "synthetic" } });', file), []);
});

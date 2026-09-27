const assert = require('node:assert/strict');
const test = require('node:test');

const { ParamModel } = require('../models/param');
const { PeriodsModel } = require('../models/stathera_arxeia');
const mainAppController = require('./mainAppController');

test('changePeriod persists and caches the selected period end date', async (t) => {
    const originalParamFindOne = ParamModel.findOne;
    const originalParamFindByIdAndUpdate = ParamModel.findByIdAndUpdate;
    const originalPeriodFindOne = PeriodsModel.findOne;
    const originalConsoleError = console.error;

    t.after(() => {
        ParamModel.findOne = originalParamFindOne;
        ParamModel.findByIdAndUpdate = originalParamFindByIdAndUpdate;
        PeriodsModel.findOne = originalPeriodFindOne;
        console.error = originalConsoleError;
    });

    async function runChange({ year, period, description, endDate, oldAppDate }) {
        const writes = [];
        let sessionSaveCount = 0;
        const redirects = [];
        const parameter = {
            _id: `parameter-${year}`,
            usedYear: year,
            usedPeriod: '01',
            appDate: oldAppDate
        };
        const session = {
            userId: 'user-1',
            yearInUse: year,
            periodInUse: '01',
            periodInUseDescr: 'ΙΑΝΟΥΑΡΙΟΣ',
            appDate: oldAppDate,
            save(callback) {
                sessionSaveCount += 1;
                callback();
            }
        };

        ParamModel.findOne = async (query) => {
            assert.deepEqual(query, { usrId: 'user-1' });
            return parameter;
        };
        ParamModel.findByIdAndUpdate = async (id, update) => {
            writes.push({ id, update });
        };
        PeriodsModel.findOne = async (query) => {
            assert.deepEqual(query, { xrhsh: year, kodikos: period });
            return { xrhsh: year, kodikos: period, perigrafh: description, eos: endDate };
        };

        await mainAppController.changePeriod(
            { body: { periodoi: period }, session },
            { redirect(path) { redirects.push(path); } }
        );

        return { writes, session, sessionSaveCount, redirects };
    }

    const february2026 = await runChange({
        year: '2026',
        period: '02',
        description: 'ΦΕΒΡΟΥΑΡΙΟΣ',
        endDate: new Date('2026-02-28T00:00:00.000Z'),
        oldAppDate: '2026-01-31'
    });
    assert.deepEqual(february2026.writes, [{
        id: 'parameter-2026',
        update: {
            usedPeriod: '02',
            usedPeriodDescr: 'ΦΕΒΡΟΥΑΡΙΟΣ',
            appDate: '2026-02-28'
        }
    }]);
    assert.equal(february2026.session.periodInUse, '02');
    assert.equal(february2026.session.appDate, '2026-02-28');
    assert.notEqual(february2026.session.appDate, '2026-01-31');
    assert.equal(february2026.sessionSaveCount, 1);
    assert.deepEqual(february2026.redirects, ['/mainapp']);

    const february2028 = await runChange({
        year: '2028',
        period: '02',
        description: 'ΦΕΒΡΟΥΑΡΙΟΣ',
        endDate: new Date('2028-02-29T00:00:00.000Z'),
        oldAppDate: '2028-01-31'
    });
    assert.equal(february2028.writes[0].update.appDate, '2028-02-29');
    assert.equal(february2028.session.appDate, '2028-02-29');

    console.error = () => {};
    const invalidEndDate = await runChange({
        year: '2026',
        period: '03',
        description: 'ΜΑΡΤΙΟΣ',
        endDate: null,
        oldAppDate: '2026-02-28'
    });
    assert.deepEqual(invalidEndDate.writes, []);
    assert.equal(invalidEndDate.session.periodInUse, '01');
    assert.equal(invalidEndDate.session.appDate, '2026-02-28');
    assert.equal(invalidEndDate.sessionSaveCount, 0);
    assert.deepEqual(invalidEndDate.redirects, ['/mainapp']);
});

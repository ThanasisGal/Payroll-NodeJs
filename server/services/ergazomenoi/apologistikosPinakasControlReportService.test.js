'use strict';

const assert = require('assert');
const service = require('./apologistikosPinakasControlReportService');

function modelReturning(rows, calls, label) {
    return { find(query) { calls.push({ label, query }); return {
        select(projection) { calls.at(-1).projection = projection; return {
            lean: async () => label === 'prodhlomena'
                ? rows.filter((row) => row.apologistiko_biblio === query.apologistiko_biblio)
                : rows
        }; }
    }; } };
}

function companyModelReturning(company, calls) {
    return { findOne(query) { calls.push({ query }); return {
        select(projection) { calls.at(-1).projection = projection; return {
            lean: async () => company
        }; }
    }; } };
}

(async () => {
    for (const input of [
        { ypokatasthma: '', apo_hmeromhnia: '2026-08-01', eos_hmeromhnia: '2026-08-02' },
        { ypokatasthma: 'ALL', apo_hmeromhnia: '2026-08-01', eos_hmeromhnia: '2026-08-02' },
        { ypokatasthma: '0001,0002', apo_hmeromhnia: '2026-08-01', eos_hmeromhnia: '2026-08-02' },
        { ypokatasthma: '0001', apo_hmeromhnia: 'bad', eos_hmeromhnia: '2026-08-02' },
        { ypokatasthma: '0001', apo_hmeromhnia: '2026-08-03', eos_hmeromhnia: '2026-08-02' }
    ]) assert.throws(() => service.validateRequest(input));

    const calls = [];
    const storedRows = [
        { ypokatasthma: '0000', kodikos: '0002', hmeromhnia: new Date('2026-08-01T00:00:00Z'),
            apologistiko_biblio: true, kathgoria_ergasias: 'ΛΑΘΟΣ', kathgoria_ergasias_apologistika: 'ΕΡΓ',
            apo_ora_01_apologistika: '09:32', eos_ora_01_apologistika: '14:31',
            apo_ora_02_apologistika: '18:04', eos_ora_02_apologistika: '21:04' },
        { ypokatasthma: '0000', kodikos: '0001', hmeromhnia: new Date('2026-08-02T00:00:00Z'),
            apologistiko_biblio: true, kathgoria_ergasias: '', kathgoria_ergasias_apologistika: '',
            apo_ora_01_apologistika: '09:32', apo_ora_02_apologistika: null, eos_ora_02_apologistika: '16:15' },
        { ypokatasthma: '0000', kodikos: '0001', hmeromhnia: new Date('2026-08-01T00:00:00Z'),
            apologistiko_biblio: true, kathgoria_ergasias_apologistika: 'ΑΝ', apo_ora_01_apologistika: '09:32' },
        { ypokatasthma: '0000', kodikos: '9999', hmeromhnia: new Date('2026-08-01T00:00:00Z'),
            apologistiko_biblio: true, kathgoria_ergasias_apologistika: 'ΜΕ' },
        { ypokatasthma: '0000', kodikos: '7777', hmeromhnia: new Date('2026-08-01T00:00:00Z'),
            apologistiko_biblio: false, kathgoria_ergasias_apologistika: 'ΔΕΝ ΠΡΕΠΕΙ ΝΑ ΕΜΦΑΝΙΣΤΕΙ' }
    ];
    const employees = [
        { kodikos: '0001', afm: '111111111', eponymo: 'ΑΛΦΑ', onoma: 'ΑΝΝΑ' },
        { kodikos: '0002', afm: '222222222', eponymo: 'ΒΗΤΑ', onoma: 'ΒΑΣΩ' }
    ];
    const report = await service.buildReport({ team: 'team-session', company_kod: 'company-session',
        input: { team: 'browser-team', company_kod: 'browser-company', ypokatasthma: '0',
            apo_hmeromhnia: '2026-08-01', eos_hmeromhnia: '2026-08-02' },
        models: { ProdhlomenaOrariaModel: modelReturning(storedRows, calls, 'prodhlomena'),
            ErgazomenoiModel: modelReturning(employees, calls, 'employees') } });

    assert.deepStrictEqual(report.columns, ['Παράρτημα', 'Κωδικός', 'ΑΦΜ', 'Επώνυμο', 'Όνομα', 'Ημερομηνία',
        'Κατηγορία', 'ΑΠΟ-ΕΩΣ ΩΡΑ 1', 'ΑΠΟ-ΕΩΣ ΩΡΑ 2', 'ΑΠΟ-ΕΩΣ ΩΡΑ 3']);
    assert.strictEqual(calls[0].query.team, 'team-session');
    assert.strictEqual(calls[0].query.company_kod, 'company-session');
    assert.strictEqual(calls[0].query.ypokatasthma, '0000');
    assert.strictEqual(calls[0].query.hmeromhnia.$gte.getTime(), new Date('2026-08-01T00:00:00Z').getTime());
    assert.strictEqual(calls[0].query.hmeromhnia.$lte.getTime(), new Date('2026-08-02T00:00:00Z').getTime());
    assert.strictEqual(calls[0].query.apologistiko_biblio, true);
    assert.strictEqual(calls[1].query.team, 'team-session');
    assert.strictEqual(calls[1].query.company_kod, 'company-session');
    assert.deepStrictEqual(calls[1].query.kodikos.$in, ['0002', '0001', '9999']);
    assert.deepStrictEqual(report.rows.map((row) => `${row.kodikos}:${row.hmeromhnia}`),
        ['9999:01/08/2026', '0001:01/08/2026', '0001:02/08/2026', '0002:01/08/2026']);
    assert.ok(!report.rows.some((row) => row.kodikos === '7777'));
    assert.strictEqual(report.rows[1].zeugos1, '09:32 – —');
    assert.strictEqual(report.rows[2].zeugos2, '— – 16:15');
    assert.strictEqual(report.rows[3].zeugos1, '09:32 – 14:31');
    assert.strictEqual(report.rows[3].zeugos2, '18:04 – 21:04');
    assert.strictEqual(report.rows[3].zeugos3, '— – —');
    assert.strictEqual(report.rows[1].category, 'ΑΝ');
    assert.strictEqual(report.rows[2].category, '—');
    assert.strictEqual(report.rows[3].category, 'ΕΡΓ');
    assert.deepStrictEqual(report.rows[0].afm, '—');
    assert.deepStrictEqual(service.PRODHLomena_PROJECTION, [
        'ypokatasthma', 'kodikos', 'hmeromhnia', 'apologistiko_biblio', 'kathgoria_ergasias_apologistika',
        'kathgoria_ergasias',
        'apo_ora_01_apologistika', 'eos_ora_01_apologistika',
        'apo_ora_02_apologistika', 'eos_ora_02_apologistika',
        'apo_ora_03_apologistika', 'eos_ora_03_apologistika'
    ]);
    assert.ok(!service.PRODHLomena_PROJECTION.includes('kathgoria_adeias_apologistika'));
    assert.strictEqual(calls[0].projection, `${service.PRODHLomena_PROJECTION.join(' ')} -_id`);
    assert.strictEqual(calls[1].projection, `${service.EMPLOYEE_PROJECTION.join(' ')} -_id`);
    const sortProbe = [
        { ypokatasthma: '0001', eponymo: 'Α', onoma: 'Α', kodikos: '0001', _date: new Date('2026-08-01') },
        { ypokatasthma: '0000', eponymo: 'Β', onoma: 'Β', kodikos: '0002', _date: new Date('2026-08-01') },
        { ypokatasthma: '0000', eponymo: 'Α', onoma: 'Α', kodikos: '0001', _date: new Date('2026-08-02') },
        { ypokatasthma: '0000', eponymo: 'Α', onoma: 'Α', kodikos: '0001', _date: new Date('2026-08-01') }
    ].sort(service.compareRows);
    assert.deepStrictEqual(sortProbe.map((row) => `${row.ypokatasthma}:${row.kodikos}:${row._date.toISOString().slice(0, 10)}`),
        ['0000:0001:2026-08-01', '0000:0001:2026-08-02', '0000:0002:2026-08-01', '0001:0001:2026-08-01']);
    const categoryCases = [
        [{ kathgoria_ergasias_apologistika: 'ΕΡΓ', kathgoria_ergasias: 'ΑΝ' }, 'ΕΡΓ'],
        [{ kathgoria_ergasias_apologistika: '', kathgoria_ergasias: 'ΑΝ' }, 'ΑΝ'],
        [{ kathgoria_ergasias_apologistika: null, kathgoria_ergasias: 'ΜΕ' }, 'ΜΕ'],
        [{ kathgoria_ergasias: '' }, '—'],
        [{ kathgoria_ergasias_apologistika: '   ', kathgoria_ergasias: 'ΕΡΓ' }, 'ΕΡΓ']
    ];
    categoryCases.forEach(([row, expected]) => assert.strictEqual(service.projectRow(row, null).category, expected));

    const companyCalls = [];
    const companyNameA = await service.loadCompanyName({ team: 'team-session', company_kod: 'company-session',
        model: companyModelReturning({ eponymia: 'ΧΡΗΣΤΟΣ ΚΑΡΡΑΣ ΚΑΙ ΒΑΣΙΛΙΚΗ ΤΣΟΥΡΑΠΑ ΕΠΕ', firstname: '' },
            companyCalls) });
    assert.strictEqual(companyNameA, 'ΧΡΗΣΤΟΣ ΚΑΡΡΑΣ ΚΑΙ ΒΑΣΙΛΙΚΗ ΤΣΟΥΡΑΠΑ ΕΠΕ');
    assert.deepStrictEqual(companyCalls[0].query, { _id: 'company-session', team: 'team-session' });
    assert.strictEqual(companyCalls[0].projection, 'eponymia firstname');
    const companyNameB = await service.loadCompanyName({ team: 'team-session', company_kod: 'company-session',
        model: companyModelReturning({ eponymia: 'ΠΑΠΑΔΟΠΟΥΛΟΣ', firstname: 'ΓΕΩΡΓΙΟΣ' }, companyCalls) });
    assert.strictEqual(companyNameB, 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ');
    assert.strictEqual(service.companyDisplayName({}), '—');
    for (const forbidden of ['update', 'create', 'delete', 'bulkWrite', 'save']) {
        assert.ok(!service.buildReport.toString().includes(`.${forbidden}(`));
    }
    console.log('PASS accounting control report query, scope, projection, pairs and sorting');
})().catch((error) => { console.error(error); process.exitCode = 1; });

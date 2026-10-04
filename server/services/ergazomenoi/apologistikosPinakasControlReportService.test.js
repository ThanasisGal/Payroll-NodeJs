'use strict';

const assert = require('assert');
const service = require('./apologistikosPinakasControlReportService');
const { buildWtoDailySubmissionProjection, buildWTODayilyAPayload,
    assertWtoDailyControlPayloadParity } = require('./wtoDailySubmissionProjectionService');

function modelReturning(rows, calls, label) {
    return { find(query) { calls.push({ label, query }); return {
        select(projection) { calls.at(-1).projection = projection; return { lean: async () =>
            label === 'prodhlomena' ? rows.filter((row) => row.apologistiko_biblio === true) : rows }; }
    }; } };
}
function companyModelReturning(company, calls) {
    return { findOne(query) { calls.push({ query }); return {
        select(projection) { calls.at(-1).projection = projection; return { lean: async () => company }; }
    }; } };
}

(async () => {
    for (const input of [
        { ypokatasthma: '', apo_hmeromhnia: '2026-08-01', eos_hmeromhnia: '2026-08-02' },
        { ypokatasthma: 'ALL', apo_hmeromhnia: '2026-08-01', eos_hmeromhnia: '2026-08-02' },
        { ypokatasthma: '0001', apo_hmeromhnia: 'bad', eos_hmeromhnia: '2026-08-02' },
        { ypokatasthma: '0001', apo_hmeromhnia: '2026-08-03', eos_hmeromhnia: '2026-08-02' }
    ]) assert.throws(() => service.validateRequest(input));

    const calls = [];
    const storedRows = [
        { _id: 'source-2', ypokatasthma: '0000', kodikos: '0002', hmeromhnia: new Date('2026-08-01T00:00:00Z'),
            apologistiko_biblio: true, kathgoria_ergasias: 'ΛΑΘΟΣ', kathgoria_ergasias_apologistika: ' εργ ',
            apo_ora_01_apologistika: '09:32', eos_ora_01_apologistika: '14:31',
            apo_ora_02_apologistika: '18:04', eos_ora_02_apologistika: '21:04' },
        { _id: 'source-1', ypokatasthma: '0000', kodikos: '0001', hmeromhnia: '2026-08-02',
            apologistiko_biblio: true, kathgoria_ergasias_apologistika: '', kathgoria_ergasias: 'αν',
            apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
            apo_ora_02_apologistika: '09:32', eos_ora_02_apologistika: '' },
        { _id: 'lending-side', ypokatasthma: '0000', kodikos: '0003', hmeromhnia: '2026-08-02',
            apologistiko_biblio: true, kathgoria_ergasias_apologistika: 'ΕΡΓ',
            apo_ora_01_apologistika: '08:00', eos_ora_01_apologistika: '16:00' },
        { _id: 'preserved-repo', ypokatasthma: '0000', kodikos: '0004',
            hmeromhnia: '2026-08-02', apologistiko_biblio: true,
            repo: true, repo_apologistika: true,
            kathgoria_ergasias_apologistika: 'ΑΝ' },
        { _id: 'hidden', ypokatasthma: '0000', kodikos: '7777', hmeromhnia: '2026-08-01',
            apologistiko_biblio: false, kathgoria_ergasias_apologistika: 'ΜΕ' }
    ];
    const employees = [
        { kodikos: '0001', afm: '111111111', eponymo: 'ΑΛΦΑ', onoma: 'ΑΝΝΑ',
            afora_daneismo_ergazomenoy: false, typos_ergodoth_daneismoy: false },
        { kodikos: '0002', afm: '222222222', eponymo: 'ΒΗΤΑ', onoma: 'ΒΑΣΩ',
            afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: true },
        { kodikos: '0003', afm: '333333333', eponymo: 'ΓΑΜΜΑ', onoma: 'ΓΕΩΡΓΙΑ',
            afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false },
        { kodikos: '0004', afm: '444444444', eponymo: 'ΔΕΛΤΑ', onoma: 'ΔΗΜΗΤΡΑ',
            afora_daneismo_ergazomenoy: false, typos_ergodoth_daneismoy: false }
    ];
    const report = await service.buildReport({ team: 'team-session', company_kod: 'company-session',
        input: { ypokatasthma: '0', apo_hmeromhnia: '2026-08-01', eos_hmeromhnia: '2026-08-02' },
        models: { ProdhlomenaOrariaModel: modelReturning(storedRows, calls, 'prodhlomena'),
            ErgazomenoiModel: modelReturning(employees, calls, 'employees') } });

    assert.strictEqual(report.canonicalRows.length, 2);
    assert.deepStrictEqual(report.canonicalRows[0], {
        source_record_id: 'source-1', ypokatasthma: '0000', employee_code: '0001',
        afm: '111111111', eponymo: 'ΑΛΦΑ', onoma: 'ΑΝΝΑ', date: '2026-08-02',
        category: 'ΑΝ', intervals: [{ from: '09:32', to: '' }], apologistiko_biblio: true
    });
    assert.strictEqual(report.rows[0].zeugos1, '09:32 – —');
    assert.strictEqual(report.rows[0].zeugos2, '—');
    assert.strictEqual(report.rows[1].category, 'ΕΡΓ');
    assert.strictEqual(report.rows[1].zeugos2, '18:04 – 21:04');
    assert.ok(!report.rows.some((row) => row.source_record_id === 'hidden'));
    assert.ok(!report.rows.some((row) => row.source_record_id === 'lending-side'));
    assert.ok(!report.rows.some((row) => row.source_record_id === 'preserved-repo'));
    assert.strictEqual(calls[0].projection, service.PRODHLomena_PROJECTION.join(' '));
    assert.ok(service.PRODHLomena_PROJECTION.includes('_id'));
    for (const field of ['repo', 'repo_apologistika', 'kathgoria_ergasias_apologistika',
        'apologistiko_biblio', 'orphan_card_resolution']) {
        assert.ok(service.PRODHLomena_PROJECTION.includes(field),
            `${field} is required by the canonical Apologistiko Book predicate`);
    }
    assert.ok(!calls[0].projection.includes('cards_'));
    assert.deepStrictEqual(calls[1].query.kodikos.$in, ['0002', '0001', '0003', '0004']);
    assert.ok(calls[1].projection.includes('afora_daneismo_ergazomenoy'));
    assert.ok(calls[1].projection.includes('typos_ergodoth_daneismoy'));

    const eligibilityCases = [
        [false, false, true], [true, false, false], [true, true, true], [false, true, true]
    ];
    for (const [afora, typos, included] of eligibilityCases) {
        const sourceRows = [{ ...storedRows[0], kodikos: 'CASE' }];
        const sourceEmployees = [{ ...employees[0], kodikos: 'CASE',
            afora_daneismo_ergazomenoy: afora, typos_ergodoth_daneismoy: typos }];
        const filtered = service.filterEligibleApologistikosSource({
            rows: sourceRows, employees: sourceEmployees });
        assert.strictEqual(filtered.rows.length, included ? 1 : 0);
        assert.strictEqual(filtered.employees.length, included ? 1 : 0);
        assert.strictEqual(sourceRows.length, 1);
        assert.strictEqual(sourceEmployees.length, 1);
    }

    const frozenRow = { ...storedRows[0], kodikos: 'FROZEN' };
    const frozenEmployee = (fields) => {
        const { afora_daneismo_ergazomenoy: _afora, typos_ergodoth_daneismoy: _typos,
            ...identity } = employees[0];
        return { ...identity, kodikos: 'FROZEN', ...fields };
    };
    for (const fields of [
        { afora_daneismo_ergazomenoy: false, typos_ergodoth_daneismoy: false },
        { afora_daneismo_ergazomenoy: false, typos_ergodoth_daneismoy: true },
        { afora_daneismo_ergazomenoy: false },
        { afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: true }
    ]) {
        const filtered = service.filterEligibleApologistikosSource({ rows: [frozenRow],
            employees: [frozenEmployee(fields)], requireFrozenEligibility: true });
        assert.strictEqual(filtered.rows.length, 1);
        assert.strictEqual(filtered.employees.length, 1);
    }
    const frozenExcluded = service.filterEligibleApologistikosSource({ rows: [frozenRow],
        employees: [frozenEmployee({ afora_daneismo_ergazomenoy: true,
            typos_ergodoth_daneismoy: false })], requireFrozenEligibility: true });
    assert.strictEqual(frozenExcluded.rows.length, 0);
    assert.strictEqual(frozenExcluded.employees.length, 0);
    for (const fields of [
        { afora_daneismo_ergazomenoy: true },
        { afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: 'false' },
        {},
        { afora_daneismo_ergazomenoy: 'false' }
    ]) {
        assert.throws(() => service.filterEligibleApologistikosSource({ rows: [frozenRow],
            employees: [frozenEmployee(fields)], requireFrozenEligibility: true }),
        (error) => error.code === 'WTODAILY_FROZEN_EMPLOYEE_ELIGIBILITY_MISSING' &&
            error.details.employee_code === 'FROZEN');
    }

    const projection = buildWtoDailySubmissionProjection({ canonicalRows: report.canonicalRows,
        branch: '0000', periodStart: '2026-08-01', periodEnd: '2026-08-31' });
    const payload = buildWTODayilyAPayload(projection);
    const payloadEmployees = payload.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO;
    assert.ok(!payloadEmployees.some((employee) => employee.f_afm === '333333333'));
    assert.strictEqual(assertWtoDailyControlPayloadParity(report.canonicalRows, payload).valid, true);

    const emptyRemoved = service.buildCanonicalApologistikosRows({ rows: [{ ...storedRows[0],
        apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
        apo_ora_02_apologistika: '18:00', eos_ora_02_apologistika: '20:00' }], employees });
    assert.deepStrictEqual(emptyRemoved[0].intervals, [{ from: '18:00', to: '20:00' }]);

    const exactPreserved = { ...storedRows[0], repo: true, repo_apologistika: true,
        kathgoria_ergasias_apologistika: 'ΑΝ' };
    assert.strictEqual(service.buildCanonicalApologistikosRows({
        rows: [exactPreserved], employees }).length, 0);
    for (const nonmatching of [
        { ...exactPreserved, repo: false },
        { ...exactPreserved, repo_apologistika: false },
        { ...exactPreserved, kathgoria_ergasias_apologistika: 'ΜΕ' },
        { ...exactPreserved, kathgoria_ergasias_apologistika: 'ΕΡΓ' }
    ]) assert.strictEqual(service.buildCanonicalApologistikosRows({
        rows: [nonmatching], employees }).length, 1);
    for (const orphanType of ['START_ONLY', 'END_ONLY']) {
        const approvedOrphan = { ...exactPreserved, _id: `orphan-${orphanType}`,
            orphan_card_resolution: { status: 'HR_APPROVED',
                policy_version: 'orphan-card-continuous:v1', orphan_type: orphanType } };
        const orphanCanonical = service.buildCanonicalApologistikosRows({
            rows: [approvedOrphan], employees });
        assert.strictEqual(orphanCanonical.length, 1);
        assert.strictEqual(orphanCanonical[0].source_record_id, `orphan-${orphanType}`);
    }

    const companyCalls = [];
    assert.strictEqual(await service.loadCompanyName({ team: 'T', company_kod: 'C',
        model: companyModelReturning({ eponymia: 'ΠΑΠΑΔΟΠΟΥΛΟΣ', firstname: 'ΓΕΩΡΓΙΟΣ' }, companyCalls) }),
    'ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ');
    assert.deepStrictEqual(companyCalls[0].query, { _id: 'C', team: 'T' });
    console.log('Canonical accounting control report tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });

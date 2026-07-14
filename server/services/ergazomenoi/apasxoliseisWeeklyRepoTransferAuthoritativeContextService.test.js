const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    ATOMIC_REPO_TRANSFER_ROW_FIELDS,
    getCompanyHolidayFlags,
    buildArgiesByDateKey,
    getProfileDateForDeviation,
    getWeeklyRepoProfileInfo,
    buildNoCardsDisplayContext
} = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
const { ROW_FIELDS } = require('./apasxoliseisWeeklyRepoTransferDecisionReconstructionService');

function testRowFieldEquivalence() {
    const authoritative = new Set(ATOMIC_REPO_TRANSFER_ROW_FIELDS.split(/\s+/).filter(Boolean));
    assert.deepStrictEqual(new Set(ROW_FIELDS), authoritative);
    [
        'argia_apologistika',
        'ores_nyxtas_apologistika',
        'ores_argion_prosayxhsh_apologistika',
        'ores_argion_ergasia_apologistika',
        'ores_prostheths_ergasias_apologistika',
        'ores_yperergasias_argion_nyxtas_apologistika',
        'ores_nominhs_yperorias_argion_nyxtas_apologistika',
        'ores_paranomhs_yperorias_argion_nyxtas_apologistika'
    ].forEach((field) => assert.ok(authoritative.has(field), `missing ${field}`));
}

function testHolidayContexts() {
    assert.strictEqual(buildArgiesByDateKey([], {}).size, 0);
    const mandatory = buildArgiesByDateKey(
        [{ hmeromhnia: '2026-06-15', ypoxreotikh_argia: true, perigrafh: 'Υποχρεωτική' }],
        getCompanyHolidayFlags({ apasxolhsh_kata_tis_argies: true })
    ).get('2026-06-15');
    assert.strictEqual(mandatory.isMandatoryHoliday, true);
    assert.strictEqual(mandatory.companyOperatesOnHoliday, true);
    assert.strictEqual(mandatory.blocksRepoTransfer, true);
    const closed = buildArgiesByDateKey(
        [{ hmeromhnia: '2026-06-16', ypoxreotikh_argia: false }],
        getCompanyHolidayFlags({ leitoyrgia_stis_mh_ypoxreotikes_argies: false })
    ).get('2026-06-16');
    assert.strictEqual(closed.isOptionalHoliday, true);
    assert.strictEqual(closed.blocksRepoTransfer, true);
    const open = buildArgiesByDateKey(
        [{ hmeromhnia: '2026-06-16', ypoxreotikh_argia: false }],
        getCompanyHolidayFlags({ leitoyrgia_stis_mh_ypoxreotikes_argies: true })
    ).get('2026-06-16');
    assert.strictEqual(open.companyOperatesOnHoliday, true);
    assert.strictEqual(open.blocksRepoTransfer, false);
}

function testCanonicalWeeklyProfile() {
    const employee = {
        kathestos_apasxolhshs: '0', mhniaia_repo: 2,
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8
    };
    const week = {
        naturalWeekEnd: new Date('2026-06-20T23:59:59.999Z'),
        weekStart: new Date('2026-06-14T00:00:00.000Z'),
        weekEnd: new Date('2026-06-20T23:59:59.999Z'),
        isFullWeek: true
    };
    const fallback = getWeeklyRepoProfileInfo({ week, ergazomenos: employee });
    assert.strictEqual(fallback.effectiveProfile.source, 'ERG_AKTUAL');
    assert.strictEqual(fallback.expectedWeeklyRepo, 2);
    assert.strictEqual(fallback.profileChangedInsideWeek, false);
    const history = [
        { _id: 'h1', hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-06-01'), hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-06-17'), kathestos_apasxolhshs: '0', mhniaia_repo: 2, hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40 },
        { _id: 'h2', hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-06-18'), kathestos_apasxolhshs: '1', mhniaia_repo: 1, hmeres_ergasias_ebdomadas: 6, ores_ergasias_ebdomadas: 30 }
    ];
    const changed = getWeeklyRepoProfileInfo({ week, istorikoRows: history, ergazomenos: employee });
    assert.strictEqual(String(changed.effectiveProfile.istorikoId), 'h2');
    assert.strictEqual(changed.expectedWeeklyRepo, 1);
    assert.strictEqual(changed.profileChangedInsideWeek, true);
    assert.strictEqual(
        changed.effectiveProfileDate,
        getProfileDateForDeviation(changed.effectiveProfile, week.naturalWeekEnd)
    );
    assert.strictEqual(
        changed.previousProfileDate,
        getProfileDateForDeviation(changed.previousProfile, week.weekStart)
    );
}

function testProfileDateForDeviationPrecedenceAndFallbacks() {
    assert.strictEqual(getProfileDateForDeviation({
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-06-18T08:30:00.000Z',
        hmeromhnia_allaghs_orarioy_apo: '2026-06-17',
        hmeromhnia_allaghs_symbashs: '2026-06-16'
    }, '2026-06-15'), '2026-06-18');
    assert.strictEqual(getProfileDateForDeviation({
        hmeromhnia_allaghs_orarioy_apo: new Date('2026-06-17T22:00:00.000Z'),
        hmeromhnia_allaghs_symbashs: '2026-06-16'
    }, '2026-06-15'), '2026-06-17');
    assert.strictEqual(getProfileDateForDeviation({
        hmeromhnia_allaghs_symbashs: '2026-06-16T12:00:00.000Z'
    }, '2026-06-15'), '2026-06-16');
    assert.strictEqual(getProfileDateForDeviation({}, '2026-06-15T23:59:59.999Z'), '2026-06-15');
    assert.strictEqual(getProfileDateForDeviation({
        hmeromhnia_isxyos_oron_ergasias_apo: 'invalid',
        hmeromhnia_allaghs_orarioy_apo: '',
        hmeromhnia_allaghs_symbashs: null
    }, 'also-invalid'), null);
    assert.strictEqual(getProfileDateForDeviation(), null);
}

function testControllerImportsSharedProfileDateHelper() {
    const controllerSource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'controllers', 'ergazomenoi', 'erganhController.js'),
        'utf8'
    );
    const importStart = controllerSource.indexOf('const {\n    ATOMIC_REPO_TRANSFER_ROW_FIELDS');
    const importEnd = controllerSource.indexOf(
        "} = require('../../services/ergazomenoi/apasxoliseisWeeklyRepoTransferAuthoritativeContextService');",
        importStart
    );
    const sharedImport = controllerSource.slice(importStart, importEnd);

    assert.ok(importStart >= 0 && importEnd > importStart);
    assert.ok(sharedImport.includes('getProfileDateForDeviation'));
    assert.strictEqual(
        (controllerSource.match(/getProfileDateForDeviation\s*\(/g) || []).length,
        2
    );
    assert.doesNotMatch(controllerSource, /function\s+getProfileDateForDeviation\s*\(/);
}

function queryResult(value) {
    return { select() { return this; }, lean: async () => value };
}

async function testTeamScopedCompanyResolution() {
    const thaId = '69e8e92fb198b803164b824a';
    const blgId = '69e7812a74cb535fd4d1a6e1';
    const companies = [
        { _id: blgId, team: 'BLG', kod: '0004' },
        { _id: thaId, team: 'THA', kod: '0004' }
    ];
    const companyQueries = [];
    const argiesQueries = [];
    const companiesModel = {
        findOne(filter) {
            companyQueries.push(filter);
            const found = companies.find((company) => {
                if (String(company.team) !== String(filter.team)) return false;
                if (filter._id) return String(company._id) === String(filter._id);
                return company.kod === filter.kod;
            }) || null;
            return queryResult(found);
        }
    };
    const argiesModel = {
        find(filter) {
            argiesQueries.push(filter);
            return queryResult([]);
        }
    };
    const base = {
        team: 'THA', etos: '2026',
        periodStart: new Date('2026-06-14T00:00:00Z'),
        periodEnd: new Date('2026-06-20T23:59:59Z'),
        companiesModel, argiesModel
    };
    const byCode = await buildNoCardsDisplayContext({ ...base, companyId: '0004' });
    assert.strictEqual(byCode.company_kodikos, '0004');
    assert.deepStrictEqual(companyQueries[0], { kod: '0004', team: 'THA' });
    assert.strictEqual(argiesQueries[0].team, 'THA');
    assert.strictEqual(argiesQueries[0].company_kod, '0004');
    const byId = await buildNoCardsDisplayContext({ ...base, companyId: thaId });
    assert.strictEqual(byId.company_kodikos, '0004');
    assert.strictEqual(String(companyQueries[1]._id), thaId);
    assert.strictEqual(companyQueries[1].team, 'THA');
    await assert.rejects(
        () => buildNoCardsDisplayContext({ ...base, companyId: blgId }),
        (error) => error.statusCode === 409
    );
    await assert.rejects(
        () => buildNoCardsDisplayContext({ ...base, companyId: '9999' }),
        (error) => error.statusCode === 409
    );
}

async function run() {
    testRowFieldEquivalence();
    testHolidayContexts();
    testProfileDateForDeviationPrecedenceAndFallbacks();
    testCanonicalWeeklyProfile();
    testControllerImportsSharedProfileDateHelper();
    await testTeamScopedCompanyResolution();
    console.log('weekly repo transfer authoritative context tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });

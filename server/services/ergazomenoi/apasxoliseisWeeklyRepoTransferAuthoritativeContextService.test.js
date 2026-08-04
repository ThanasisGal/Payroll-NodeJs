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
const {
    resolveEffectiveExpectedWeeklyRepo
} = require('./apasxoliseisWeeklyRepoTransferExpectedRepoResolverService');
const {
    buildWeeklyRepoTransferSinglePairGroupProjection
} = require('./apasxoliseisWeeklyRepoTransferSinglePairGroupProjectionService');

function testRowFieldEquivalence() {
    const authoritative = new Set(ATOMIC_REPO_TRANSFER_ROW_FIELDS.split(/\s+/).filter(Boolean));
    assert.deepStrictEqual(new Set(ROW_FIELDS), authoritative);
    [
        'argia_apologistika',
        'ores_nyxtas_apologistika',
        'ores_argion_prosayxhsh_apologistika',
        'ores_argion_ergasia_apologistika',
        'ores_apoysias',
        'ores_prostheths_ergasias_apologistika',
        'ores_yperergasias_argion_nyxtas_apologistika',
        'ores_nominhs_yperorias_argion_nyxtas_apologistika',
        'ores_paranomhs_yperorias_argion_nyxtas_apologistika',
        'ores_pragmatikhs_ergasias_apologistika',
        'ores_adeias_pistomenes_apologistika',
        'ores_argias_pistomenes_apologistika',
        'compensation_breakdown_apologistika'
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
        kathestos_apasxolhshs: '0',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8
    };
    const week = {
        naturalWeekEnd: new Date('2026-06-21T23:59:59.999Z'),
        weekStart: new Date('2026-06-15T00:00:00.000Z'),
        weekEnd: new Date('2026-06-21T23:59:59.999Z'),
        isFullWeek: true
    };
    const fallback = getWeeklyRepoProfileInfo({ week, ergazomenos: employee });
    assert.strictEqual(fallback.effectiveProfile.source, 'ERG_AKTUAL');
    assert.strictEqual(fallback.expectedWeeklyRepo, 2);
    assert.strictEqual(fallback.profileChangedInsideWeek, false);
    const history = [
        { _id: 'h1', hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-06-01'), hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-06-17'), kathestos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40 },
        { _id: 'h2', hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-06-18'), kathestos_apasxolhshs: '1', hmeres_ergasias_ebdomadas: 6, ores_ergasias_ebdomadas: 30 }
    ];
    const changed = getWeeklyRepoProfileInfo({ week, istorikoRows: history, ergazomenos: employee });
    assert.strictEqual(String(changed.effectiveProfile.istorikoId), 'h2');
    assert.strictEqual(changed.expectedWeeklyRepo, 1);
    assert.strictEqual(changed.repoResolutionReason, null);
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

function naturalWeek(start = '2026-06-08') {
    return {
        naturalWeekEnd: new Date('2026-06-14T23:59:59.999Z'),
        weekStart: new Date(`${start}T00:00:00.000Z`),
        weekEnd: new Date('2026-06-14T23:59:59.999Z'),
        isFullWeek: true
    };
}

function scheduledRows(count) {
    return Array.from({ length: 7 }, (_, index) => ({
        hmeromhnia: `2026-06-${String(8 + index).padStart(2, '0')}`,
        kathgoria_ergasias: index < count ? 'ΕΡΓ' : 'ΜΕ',
        ores_ergasias: index < count ? 8 : 0,
        apo_ora_01: index < count ? '09:00' : '',
        eos_ora_01: index < count ? '17:00' : ''
    }));
}

function repoTransferProfile(profile) {
    return {
        typos_apasxolhshs: profile.typos_apasxolhshs,
        hmeres_ergasias_ebdomadas: profile.hmeres_ergasias_ebdomadas
    };
}

function resolveThroughAuthoritativeProfile({ employee, history = [], rows }) {
    const profileInfo = getWeeklyRepoProfileInfo({
        week: naturalWeek(),
        istorikoRows: history,
        ergazomenos: employee
    });
    return {
        profileInfo,
        result: resolveEffectiveExpectedWeeklyRepo({
            weekRows: rows,
            effectiveProfile: repoTransferProfile(profileInfo.effectiveProfile)
        })
    };
}

function testContractualWeeklyRepoResolution() {
    const employee = {
        kathestos_apasxolhshs: '1',
        hmeres_ergasias_ebdomadas: 4
    };
    const employeeResult = resolveThroughAuthoritativeProfile({
        employee,
        rows: scheduledRows(5)
    });
    assert.strictEqual(employeeResult.result.ok, true);
    assert.strictEqual(employeeResult.result.effectiveExpectedWeeklyRepo, 3);
    assert.strictEqual(employeeResult.result.repoResolutionSource, 'CONTRACTUAL_WEEKLY_WORKDAYS');

    const history = [{
        _id: 'history-authoritative',
        afora_allagh_oron_ergasias: true,
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-06-01',
        kathestos_apasxolhshs: '1',
        hmeres_ergasias_ebdomadas: 4
    }];
    const historyResult = resolveThroughAuthoritativeProfile({
        employee: { ...employee, hmeres_ergasias_ebdomadas: 5 },
        history,
        rows: scheduledRows(5)
    });
    assert.strictEqual(historyResult.profileInfo.effectiveProfile.source, 'ISTORIKO');
    assert.strictEqual(historyResult.result.ok, true);
    assert.strictEqual(historyResult.result.effectiveExpectedWeeklyRepo, 3);

    const fiveDay = resolveThroughAuthoritativeProfile({
        employee: { ...employee, hmeres_ergasias_ebdomadas: 5 },
        rows: scheduledRows(5)
    }).result;
    assert.strictEqual(fiveDay.ok, true);
    assert.strictEqual(fiveDay.effectiveExpectedWeeklyRepo, 2);
    assert.strictEqual(fiveDay.repoResolutionSource, 'CONTRACTUAL_WEEKLY_WORKDAYS');

    for (const [workdays, expected] of [[1, 6], [2, 5], [3, 4], [4, 3], [5, 2], [6, 1]]) {
        const fallback = resolveThroughAuthoritativeProfile({
            employee: { ...employee, hmeres_ergasias_ebdomadas: workdays },
            rows: scheduledRows(5)
        }).result;
        assert.strictEqual(fallback.effectiveExpectedWeeklyRepo, expected);
        assert.strictEqual(fallback.repoResolutionSource, 'CONTRACTUAL_WEEKLY_WORKDAYS');
    }

    const sixScheduled = resolveThroughAuthoritativeProfile({
        employee: { ...employee, hmeres_ergasias_ebdomadas: 5 },
        rows: scheduledRows(6)
    }).result;
    assert.strictEqual(sixScheduled.effectiveExpectedWeeklyRepo, 2);
    assert.strictEqual(
        sixScheduled.repoResolutionSource,
        'CONTRACTUAL_WEEKLY_WORKDAYS'
    );
}

function regression0002Rows() {
    const categories = ['ΕΡΓ', 'ΑΝ', 'ΕΡΓ', 'ΕΡΓ', 'ΕΡΓ', 'ΕΡΓ', 'ΕΡΓ'];
    return categories.map((category, index) => {
        const hasCards = index === 1 || (category === 'ΕΡΓ' && index !== 3);
        return {
            _id: `0002-row-${index}`,
            team: 'THA',
            company_kod: '0004',
            ypokatasthma: '0000',
            kodikos: '0002',
            hmeromhnia: `2026-06-${String(8 + index).padStart(2, '0')}`,
            kathgoria_ergasias: category,
            ores_ergasias: category === 'ΕΡΓ' ? 8 : 0,
            apo_ora_01: category === 'ΕΡΓ' ? '09:00' : '',
            eos_ora_01: category === 'ΕΡΓ' ? '17:00' : '',
            cards_ores_ergasias: hasCards ? 8 : 0,
            cards_apo_ora_01: hasCards ? '09:00' : '',
            cards_eos_ora_01: hasCards ? '17:00' : '',
            is_locked: false
        };
    });
}

function test0002ThroughAuthoritativeProjectionPath() {
    const rows = regression0002Rows();
    const profileInfo = getWeeklyRepoProfileInfo({
        week: naturalWeek(),
        ergazomenos: {
            kodikos: '0002',
            kathestos_apasxolhshs: '0',
            hmeres_ergasias_ebdomadas: 5
        }
    });
    const projection = buildWeeklyRepoTransferSinglePairGroupProjection({
        weekRows: rows,
        employmentProfile: repoTransferProfile(profileInfo.effectiveProfile)
    });
    assert.strictEqual(projection.projection_status, 'NOT_AVAILABLE');
    assert.strictEqual(projection.groups.length, 0);
    assert.ok(projection.reasons.includes('MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE'));
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
    await buildNoCardsDisplayContext({
        ...base,
        companyId: '0004',
        periodStart: new Date('2026-12-28T00:00:00Z'),
        periodEnd: new Date('2027-01-03T23:59:59Z')
    });
    assert.deepStrictEqual(argiesQueries[2].etos.$in, ['2026', '2027']);
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
    testContractualWeeklyRepoResolution();
    test0002ThroughAuthoritativeProjectionPath();
    testControllerImportsSharedProfileDateHelper();
    await testTeamScopedCompanyResolution();
    console.log('weekly repo transfer authoritative context tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });

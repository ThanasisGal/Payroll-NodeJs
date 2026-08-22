'use strict';

const mongoose = require('mongoose');
const { CompaniesModel } = require('../../models/companies');
const { ErgazomenoiModel, ProdhlomenaOrariaModel } = require('../../models/ergazomenoi');
const {
    DECLARED_SCHEDULE_SOURCE_FIELDS,
    buildDeclaredScheduleUpdate
} = require('./prodhlomenaOrariaSchedulePolicy');

const BULK_CHUNK_SIZE = 1000;

function normalizeAfm(value) {
    const afm = String(value || '').trim();
    if (!/^\d{9}$/.test(afm)) return '';
    const checksum = afm
        .slice(0, 8)
        .split('')
        .reduce((sum, digit, index) => sum + Number(digit) * (2 ** (8 - index)), 0);
    return checksum % 11 % 10 === Number(afm[8]) ? afm : '';
}

function candidateEmployeeFilter(scope) {
    return {
        team: scope.team,
        company_kod: scope.company_kod,
        ypokatasthma: scope.target_ypokatasthma,
        afora_daneismo_ergazomenoy: true,
        typos_ergodoth_daneismoy: false
    };
}

function sourceCompaniesFilter(team, afms) {
    return {
        team,
        afm: mongoose.trusted({ $in: afms })
    };
}

function sourceSchedulesFilter({ team, sourceCompanyId, sourceBranch, sourceCodes, startDate, endDate }) {
    return {
        team,
        company_kod: String(sourceCompanyId),
        ypokatasthma: sourceBranch,
        kodikos: mongoose.trusted({ $in: sourceCodes }),
        hmeromhnia: mongoose.trusted({ $gte: startDate, $lte: endDate })
    };
}

function targetSchedulesFilter({ scope, targetCodes }) {
    return {
        team: scope.team,
        company_kod: scope.company_kod,
        ypokatasthma: scope.target_ypokatasthma,
        kodikos: mongoose.trusted({ $in: targetCodes }),
        hmeromhnia: mongoose.trusted({ $gte: scope.startDate, $lte: scope.endDate })
    };
}

async function resolveBorrowedSourceContext({ scope, models = {} }) {
    const employeeModel = models.employeeModel || ErgazomenoiModel;
    const companiesModel = models.companiesModel || CompaniesModel;
    const employees = await employeeModel.find(candidateEmployeeFilter(scope))
        .select('kodikos afm_daneizomenoy_ergodoth kodikos_ergazomenoy_alloy_ergodoth')
        .lean();
    const afms = [...new Set(employees
        .map((employee) => normalizeAfm(employee.afm_daneizomenoy_ergodoth))
        .filter(Boolean))];
    const companies = afms.length
        ? await companiesModel.find(sourceCompaniesFilter(scope.team, afms)).select('_id afm').lean()
        : [];
    const companiesByAfm = new Map();
    for (const company of companies) {
        const afm = normalizeAfm(company.afm);
        if (!companiesByAfm.has(afm)) companiesByAfm.set(afm, []);
        companiesByAfm.get(afm).push(company);
    }
    const resolvedIds = new Set();
    let ambiguousCompanyAfm = false;
    for (const afm of afms) {
        const matches = companiesByAfm.get(afm) || [];
        if (matches.length > 1) ambiguousCompanyAfm = true;
        if (matches.length === 1) resolvedIds.add(String(matches[0]._id));
    }
    const reason = employees.length === 0 || resolvedIds.size === 0
        ? 'SOURCE_COMPANY_NOT_FOUND'
        : ambiguousCompanyAfm || resolvedIds.size > 1
          ? 'MULTIPLE_SOURCE_COMPANIES'
          : null;
    return Object.freeze({
        employees: Object.freeze(employees),
        companiesByAfm,
        sourceCompanyId: reason ? '' : [...resolvedIds][0],
        reason
    });
}

function sourceMappingKey(companyId, sourceCode) {
    return `${String(companyId)}|${String(sourceCode).trim()}`;
}

function sourceRowKey(sourceBranch, sourceCode, date) {
    return `${String(sourceBranch).trim()}|${String(sourceCode).trim()}|${new Date(date).toISOString()}`;
}

function targetRowKey({ team, company_kod, ypokatasthma, kodikos, hmeromhnia }) {
    return [team, company_kod, ypokatasthma, String(kodikos).trim(), new Date(hmeromhnia).toISOString()]
        .map(String)
        .join('|');
}

async function updateBorrowedEmployeeDeclaredSchedules({ scope, models = {}, sourceContext = null }) {
    const prodhlomenaModel = models.prodhlomenaModel || ProdhlomenaOrariaModel;
    const summary = {
        targetEmployeesFound: 0,
        validMappings: 0,
        sourceCompaniesFound: 0,
        sourceRowsFound: 0,
        targetRowsInserted: 0,
        targetRowsUpdated: 0,
        skippedMappings: 0,
        employeesWithoutSourceRows: 0,
        conflicts: 0,
        ambiguities: 0,
        targetAmbiguities: 0,
        sourceCompanyResolved: false,
        sourceBranchValidated: Boolean(scope.source_ypokatasthma),
        validationError: null
    };

    const resolved = sourceContext || await resolveBorrowedSourceContext({ scope, models });
    const employees = resolved.employees;
    summary.targetEmployeesFound = employees.length;
    if (resolved.reason) {
        summary.validationError = resolved.reason;
        return summary;
    }
    summary.sourceCompanyResolved = true;
    if (!scope.source_ypokatasthma) {
        summary.sourceBranchValidated = false;
        summary.validationError = 'SOURCE_BRANCH_REQUIRED';
        return summary;
    }

    const employeeCandidates = employees.map((employee) => ({
        employee,
        sourceAfm: normalizeAfm(employee.afm_daneizomenoy_ergodoth),
        sourceCode: String(employee.kodikos_ergazomenoy_alloy_ergodoth || '').trim(),
        targetCode: String(employee.kodikos || '').trim()
    }));
    const mappings = [];
    for (const candidate of employeeCandidates) {
        if (!candidate.sourceAfm || !candidate.sourceCode || !candidate.targetCode) {
            summary.skippedMappings++;
            continue;
        }
        const matches = resolved.companiesByAfm.get(candidate.sourceAfm) || [];
        if (matches.length !== 1 || String(matches[0]._id) !== resolved.sourceCompanyId) {
            summary.skippedMappings++;
            if (matches.length > 1) summary.conflicts++;
            continue;
        }
        mappings.push({
            sourceCompanyId: String(matches[0]._id),
            sourceCode: candidate.sourceCode,
            targetCode: candidate.targetCode
        });
    }
    summary.sourceCompaniesFound = new Set(mappings.map((item) => item.sourceCompanyId)).size;

    const mappingsBySource = new Map();
    for (const mapping of mappings) {
        const key = sourceMappingKey(mapping.sourceCompanyId, mapping.sourceCode);
        if (!mappingsBySource.has(key)) mappingsBySource.set(key, []);
        mappingsBySource.get(key).push(mapping);
    }
    const validMappings = [];
    for (const groupedMappings of mappingsBySource.values()) {
        if (groupedMappings.length > 1) {
            summary.conflicts++;
            summary.skippedMappings += groupedMappings.length;
        } else {
            validMappings.push(groupedMappings[0]);
        }
    }
    summary.validMappings = validMappings.length;
    if (validMappings.length === 0) return summary;

    const mappingsByCompany = new Map();
    for (const mapping of validMappings) {
        if (!mappingsByCompany.has(mapping.sourceCompanyId)) {
            mappingsByCompany.set(mapping.sourceCompanyId, []);
        }
        mappingsByCompany.get(mapping.sourceCompanyId).push(mapping);
    }

    const pendingTargetRows = [];
    const mappingsWithSourceEvidence = new Set();
    for (const [sourceCompanyId, companyMappings] of mappingsByCompany.entries()) {
        const sourceCodes = [...new Set(companyMappings.map((item) => item.sourceCode))];
        const sourceRows = await prodhlomenaModel.find(sourceSchedulesFilter({
            team: scope.team,
            sourceCompanyId,
            sourceBranch: scope.source_ypokatasthma,
            sourceCodes,
            startDate: scope.startDate,
            endDate: scope.endDate
        }))
            .select(['kodikos', 'hmeromhnia', 'ypokatasthma', ...DECLARED_SCHEDULE_SOURCE_FIELDS].join(' '))
            .lean();
        summary.sourceRowsFound += sourceRows.length;

        const sourceRowsByKey = new Map();
        for (const row of sourceRows) {
            const key = sourceRowKey(scope.source_ypokatasthma, row.kodikos, row.hmeromhnia);
            if (!sourceRowsByKey.has(key)) sourceRowsByKey.set(key, []);
            sourceRowsByKey.get(key).push(row);
        }
        const mappingByCode = new Map(companyMappings.map((item) => [item.sourceCode, item]));
        for (const [key, rows] of sourceRowsByKey.entries()) {
            const sourceCode = key.split('|')[1];
            const mapping = mappingByCode.get(sourceCode);
            if (!mapping) continue;
            mappingsWithSourceEvidence.add(sourceMappingKey(sourceCompanyId, sourceCode));
            if (rows.length !== 1) {
                summary.ambiguities++;
                continue;
            }
            const sourceRow = rows[0];
            const identity = {
                team: scope.team,
                company_kod: scope.company_kod,
                ypokatasthma: scope.target_ypokatasthma,
                kodikos: mapping.targetCode,
                hmeromhnia: new Date(sourceRow.hmeromhnia)
            };
            pendingTargetRows.push({ identity, sourceRow });
        }
    }
    summary.employeesWithoutSourceRows = validMappings.filter((mapping) =>
        !mappingsWithSourceEvidence.has(sourceMappingKey(mapping.sourceCompanyId, mapping.sourceCode))).length;
    if (pendingTargetRows.length === 0) return summary;

    const targetCodes = [...new Set(validMappings.map((mapping) => mapping.targetCode))];
    const existingTargetRows = await prodhlomenaModel.find(targetSchedulesFilter({ scope, targetCodes }))
        .select('team company_kod ypokatasthma kodikos hmeromhnia')
        .lean();
    const existingTargetRowsByKey = new Map();
    for (const row of existingTargetRows) {
        const key = targetRowKey(row);
        if (!existingTargetRowsByKey.has(key)) existingTargetRowsByKey.set(key, []);
        existingTargetRowsByKey.get(key).push(row);
    }

    const bulkOps = [];
    for (const { identity, sourceRow } of pendingTargetRows) {
        if ((existingTargetRowsByKey.get(targetRowKey(identity)) || []).length > 1) {
            summary.targetAmbiguities++;
            continue;
        }
        bulkOps.push({
            updateOne: {
                filter: identity,
                update: {
                    $set: buildDeclaredScheduleUpdate(sourceRow),
                    $setOnInsert: identity
                },
                upsert: true
            }
        });
    }
    if (bulkOps.length === 0) return summary;

    for (let index = 0; index < bulkOps.length; index += BULK_CHUNK_SIZE) {
        const result = await prodhlomenaModel.bulkWrite(
            bulkOps.slice(index, index + BULK_CHUNK_SIZE),
            { ordered: false }
        );
        summary.targetRowsInserted += result.upsertedCount || 0;
        summary.targetRowsUpdated += result.modifiedCount || 0;
    }
    return summary;
}

module.exports = {
    candidateEmployeeFilter,
    normalizeAfm,
    sourceCompaniesFilter,
    sourceSchedulesFilter,
    targetSchedulesFilter,
    resolveBorrowedSourceContext,
    updateBorrowedEmployeeDeclaredSchedules
};

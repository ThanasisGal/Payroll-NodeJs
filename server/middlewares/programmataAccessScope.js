'use strict';

const mongoose = require('mongoose');
const path = require('path');
const { CompaniesModel, YpokatasthmataModel } = require('../models/companies');
const { ErgazomenoiModel } = require('../models/ergazomenoi');
const {
    CANONICAL_ALL_TEAMS_CODE,
    normalizeRequiredUserTeam,
    normalizeUserTeam
} = require('../services/userTeamScopeService');

const MAX_EMPLOYEE_CODES = 500;
const MAX_DATE_RANGE_DAYS = 366;
const CODE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function accessError(status) {
    return Object.assign(new Error('Programmata access denied'), { status });
}

function sendError(res, error) {
    const status = Number(error?.status) || 500;
    const message =
        status === 400
            ? 'Μη έγκυρα δεδομένα'
            : status === 500
              ? 'Σφάλμα ελέγχου πρόσβασης'
              : 'Δεν βρέθηκε πόρος';
    return res.status(status).json({ success: false, message });
}

function stringValue(value, { required = true, max = 128 } = {}) {
    if (typeof value !== 'string') throw accessError(400);
    const normalized = value.trim();
    if ((required && !normalized) || normalized.length > max) throw accessError(400);
    return normalized;
}

function employeeCode(value) {
    const normalized = stringValue(value, { max: 64 });
    if (!CODE_PATTERN.test(normalized)) throw accessError(400);
    return normalized;
}

function employeeCodes(value) {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_EMPLOYEE_CODES) {
        throw accessError(400);
    }
    const normalized = [...new Set(value.map(employeeCode))];
    if (normalized.length === 0) throw accessError(400);
    return normalized;
}

function isoDate(value) {
    const normalized = stringValue(value, { max: 10 });
    if (!ISO_DATE_PATTERN.test(normalized)) throw accessError(400);
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
        throw accessError(400);
    }
    return date;
}

function dateRange(startValue, endValue, maxDays = MAX_DATE_RANGE_DAYS) {
    const startDate = isoDate(startValue);
    const endDate = isoDate(endValue);
    const days = Math.floor((endDate - startDate) / 86400000);
    if (days < 0 || days > maxDays) throw accessError(400);
    return Object.freeze({ startDate, endDate, startIso: startValue, endIso: endValue });
}

function externalDate(value) {
    const normalized = stringValue(value, { max: 10 });
    if (ISO_DATE_PATTERN.test(normalized)) return { value: normalized, date: isoDate(normalized) };
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
    if (!match) throw accessError(400);
    const iso = `${match[3]}-${match[2]}-${match[1]}`;
    return { value: normalized, date: isoDate(iso) };
}

function externalDateRange(startValue, endValue) {
    const start = externalDate(startValue);
    const end = externalDate(endValue);
    const days = Math.floor((end.date - start.date) / 86400000);
    if (days < 0 || days > MAX_DATE_RANGE_DAYS) throw accessError(400);
    return Object.freeze({
        startDate: start.date,
        endDate: end.date,
        startValue: start.value,
        endValue: end.value
    });
}

async function resolveCompany(req, requestedTeamValue, companyIdValue) {
    const sessionTeam = normalizeRequiredUserTeam(req.authenticatedUserTeam);
    const requestedTeam = normalizeRequiredUserTeam(requestedTeamValue);
    if (sessionTeam !== CANONICAL_ALL_TEAMS_CODE && requestedTeam !== sessionTeam) {
        throw accessError(404);
    }
    const companyId = stringValue(companyIdValue, { max: 64 });
    if (!mongoose.isValidObjectId(companyId)) throw accessError(400);
    const company = await CompaniesModel.findById(companyId).select('_id team kod').lean();
    if (!company) throw accessError(404);
    const companyTeam = normalizeRequiredUserTeam(company.team);
    if (
        companyTeam !== requestedTeam ||
        (sessionTeam !== CANONICAL_ALL_TEAMS_CODE && companyTeam !== sessionTeam)
    ) {
        throw accessError(404);
    }
    return { sessionTeam, effectiveTeam: companyTeam, companyId, companyKod: String(company.kod || '').trim() };
}

async function assertEmployees(scope, codes, ypokatasthma = '') {
    const query = {
        team: scope.effectiveTeam,
        company_kod: scope.companyId,
        kodikos: { $in: codes }
    };
    if (ypokatasthma) query.ypokatasthma = ypokatasthma;
    const rows = await ErgazomenoiModel.find(query).select('kodikos').lean();
    const found = new Set(rows.map((row) => String(row.kodikos).trim()));
    if (codes.some((code) => !found.has(code))) throw accessError(404);
}

async function assertYpokatasthma(scope, ypokatasthma) {
    const row = await YpokatasthmataModel.findOne({
        team: scope.effectiveTeam,
        companykod_object: scope.companyId,
        kodikos: ypokatasthma
    })
        .select('_id')
        .lean();
    if (!row) throw accessError(404);
}

function freezeScope(req, base, extra = {}) {
    req.programmataAccessScope = Object.freeze({
        userId: String(req.session.userId),
        ...base,
        ...extra
    });
}

function requestedTeam(req) {
    return req.params.selectedTeam ?? req.body?.selectedTeam ?? req.body?.team;
}

function requestedCompany(req) {
    return req.params.selectedCompany ?? req.body?.selectedCompany ?? req.body?.company;
}

async function authorizeList(req, res, next) {
    try {
        const base = await resolveCompany(req, requestedTeam(req), requestedCompany(req));
        freezeScope(req, base);
        return next();
    } catch (error) {
        return sendError(res, error);
    }
}

async function authorizeEmployee(req, res, next) {
    try {
        const base = await resolveCompany(req, requestedTeam(req), requestedCompany(req));
        const code = employeeCode(req.params.selectedKodikos);
        await assertEmployees(base, [code]);
        freezeScope(req, base, { employeeCode: code, employeeCodes: Object.freeze([code]) });
        return next();
    } catch (error) {
        return sendError(res, error);
    }
}

async function authorizeUpdate(req, res, next) {
    try {
        const base = await resolveCompany(req, requestedTeam(req), requestedCompany(req));
        const code = employeeCode(req.params.selectedKodikos);
        const range = dateRange(
            req.body?.hmeromhnia_allaghs_orarioy_apo_hidden,
            req.body?.hmeromhnia_allaghs_orarioy_eos_hidden
        );
        await assertEmployees(base, [code]);
        freezeScope(req, base, { employeeCode: code, employeeCodes: Object.freeze([code]), dateRange: range });
        return next();
    } catch (error) {
        return sendError(res, error);
    }
}

async function authorizeDelete(req, res, next) {
    try {
        const base = await resolveCompany(req, requestedTeam(req), requestedCompany(req));
        const code = employeeCode(req.params.selectedKodikos);
        const range = dateRange(req.params.startDate, req.params.endDate);
        await assertEmployees(base, [code]);
        freezeScope(req, base, { employeeCode: code, employeeCodes: Object.freeze([code]), dateRange: range });
        return next();
    } catch (error) {
        return sendError(res, error);
    }
}

async function authorizeCopy(req, res, next) {
    try {
        const base = await resolveCompany(req, requestedTeam(req), requestedCompany(req));
        const sourceCode = employeeCode(req.body?.fromSelectedKodikos);
        const destinationCode = employeeCode(req.body?.toSelectedKodikos);
        const sourceRange = dateRange(req.body?.fromStartDate, req.body?.fromEndDate, 31);
        const destinationRange = dateRange(req.body?.toStartDate, req.body?.toEndDate, 31);
        await assertEmployees(base, [sourceCode, destinationCode]);
        freezeScope(req, base, {
            sourceEmployeeCode: sourceCode,
            destinationEmployeeCode: destinationCode,
            employeeCodes: Object.freeze([...new Set([sourceCode, destinationCode])]),
            sourceRange,
            destinationRange
        });
        return next();
    } catch (error) {
        return sendError(res, error);
    }
}

async function authorizeGetOraria(req, res, next) {
    try {
        const base = await resolveCompany(req, requestedTeam(req), requestedCompany(req));
        const codes = employeeCodes(req.body?.kodikoi);
        const range = dateRange(req.body?.apoHmeromhnia, req.body?.eosHmeromhnia);
        const filetype = stringValue(req.body?.filetype, { max: 8 }).toLowerCase();
        const diadikasia = stringValue(req.body?.diadikasia, { max: 3 });
        if (!['xml', 'xlsx', 'json'].includes(filetype) || !['182', '183'].includes(diadikasia)) {
            throw accessError(400);
        }
        const rawYpokatasthma = stringValue(req.body?.ypokatasthma, { max: 4 });
        if (!/^\d{1,4}$/.test(rawYpokatasthma)) throw accessError(400);
        const ypokatasthma = rawYpokatasthma.padStart(4, '0');
        await assertYpokatasthma(base, ypokatasthma);
        await assertEmployees(base, codes, ypokatasthma);
        freezeScope(req, base, {
            employeeCodes: Object.freeze(codes),
            dateRange: range,
            filetype,
            diadikasia,
            ypokatasthma
        });
        return next();
    } catch (error) {
        return sendError(res, error);
    }
}

async function authorizeSessionCompany(req, res, next) {
    try {
        const sessionTeam = normalizeRequiredUserTeam(req.authenticatedUserTeam);
        const companyId = stringValue(req.session?.companyInUse, { max: 64 });
        if (!mongoose.isValidObjectId(companyId)) throw accessError(400);
        const company = await CompaniesModel.findById(companyId).select('_id team kod').lean();
        if (!company) throw accessError(404);
        const companyTeam = normalizeRequiredUserTeam(company.team);
        if (sessionTeam !== CANONICAL_ALL_TEAMS_CODE && companyTeam !== sessionTeam) {
            throw accessError(404);
        }
        for (const key of ['team', 'selectedTeam']) {
            if (
                req.body?.[key] !== undefined &&
                normalizeUserTeam(req.body[key]) !== companyTeam
            ) {
                throw accessError(404);
            }
        }
        for (const key of ['company', 'selectedCompany']) {
            if (
                req.body?.[key] !== undefined &&
                stringValue(req.body[key], { max: 64 }) !== companyId
            ) {
                throw accessError(404);
            }
        }
        freezeScope(req, {
            sessionTeam,
            effectiveTeam: companyTeam,
            companyId,
            companyKod: String(company.kod || '').trim()
        });
        return next();
    } catch (error) {
        return sendError(res, error);
    }
}

async function validatePdfDelete(req, res, next) {
    try {
        const pdfUrl = stringValue(req.body?.pdfUrl, { max: 255 });
        const publicPdfRoot = path.resolve(__dirname, '..', '..', 'public', 'pdf');
        const relative = pdfUrl.replace(/^\/+/, '');
        const resolved = path.resolve(__dirname, '..', '..', 'public', relative);
        if (
            !resolved.startsWith(`${publicPdfRoot}${path.sep}`) ||
            path.extname(resolved).toLowerCase() !== '.pdf'
        ) {
            throw accessError(400);
        }
        freezeScope(req, req.programmataAccessScope, { pdfFilePath: resolved });
        return next();
    } catch (error) {
        return sendError(res, error);
    }
}

async function authorizeCalculation(req, res, next) {
    try {
        await authorizeSessionCompany(req, res, async () => {
            try {
                const range = dateRange(req.body?.apo_hmeromhnia, req.body?.eos_hmeromhnia);
                const ypokatasthmaValue = req.body?.ypokatasthmata_stathera;
                let ypokatasthma = '';
                if (ypokatasthmaValue !== undefined && ypokatasthmaValue !== '') {
                    const raw = stringValue(ypokatasthmaValue, { max: 4 });
                    if (!/^\d{1,4}$/.test(raw)) throw accessError(400);
                    ypokatasthma = raw.padStart(4, '0');
                    await assertYpokatasthma(req.programmataAccessScope, ypokatasthma);
                }
                freezeScope(req, req.programmataAccessScope, { dateRange: range, ypokatasthma });
                return next();
            } catch (error) {
                return sendError(res, error);
            }
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function authorizeExternalAction(req, res, next) {
    return authorizeSessionCompany(req, res, async () => {
        try {
            const isSchedule = req.path === '/ergazomenoi/programmata/downloadSchedule';
            const isCards = req.path === '/ergazomenoi/programmata/downloadCards';
            const startValue = isSchedule
                ? req.body?.fromDate
                : isCards
                  ? req.body?.apoHmeromhnia
                  : req.body?.apo_hmeromhnia;
            const endValue = isSchedule
                ? req.body?.toDate
                : isCards
                  ? req.body?.eosHmeromhnia
                  : req.body?.eos_hmeromhnia;
            const rawYpokatasthma =
                (isSchedule || isCards
                    ? req.body?.selectedPararthma
                    : req.body?.ypokatasthmata_stathera ?? req.body?.ypokatasthmata);
            const range = externalDateRange(startValue, endValue);
            const raw = stringValue(rawYpokatasthma, { max: 4 });
            if (!/^\d{1,4}$/.test(raw)) throw accessError(400);
            const ypokatasthma = raw.padStart(4, '0');
            await assertYpokatasthma(req.programmataAccessScope, ypokatasthma);
            freezeScope(req, req.programmataAccessScope, {
                externalDateRange: range,
                ypokatasthma
            });
            return next();
        } catch (error) {
            return sendError(res, error);
        }
    });
}

module.exports = {
    authorizeList,
    authorizeEmployee,
    authorizeUpdate,
    authorizeDelete,
    authorizeCopy,
    authorizeGetOraria,
    authorizeSessionCompany,
    authorizeCalculation,
    authorizeExternalAction,
    validatePdfDelete,
    employeeCode,
    employeeCodes,
    dateRange
};

const mongoose = require('mongoose');
const { CompaniesModel, AntistoixiseisModel } = require('../models/companies');
const UserModel = require('../models/userModel');
const {
    CANONICAL_ALL_TEAMS_CODE,
    normalizeRequiredUserTeam,
    normalizeUserTeam
} = require('../services/userTeamScopeService');

const MAX_TEXT_LENGTH = 500;
const MAX_SECRET_LENGTH = 2048;
const MAX_SELECTED_USERS = 200;

function sendError(res, status, message) {
    return res.status(status).json({ success: false, message });
}

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function stringValue(value, { required = false, max = MAX_TEXT_LENGTH } = {}) {
    if (value === undefined || value === null) {
        if (required) throw Object.assign(new Error('Μη έγκυρα δεδομένα'), { status: 400 });
        return '';
    }
    if (typeof value !== 'string') {
        throw Object.assign(new Error('Μη έγκυρα δεδομένα'), { status: 400 });
    }
    const normalized = value.trim();
    if ((required && !normalized) || normalized.length > max) {
        throw Object.assign(new Error('Μη έγκυρα δεδομένα'), { status: 400 });
    }
    return normalized;
}

function assertPlainBody(req) {
    if (!isPlainObject(req.body)) {
        throw Object.assign(new Error('Μη έγκυρα δεδομένα'), { status: 400 });
    }
}

function assertPrimitiveFields(body, arrayFields = []) {
    const allowedArrays = new Set(arrayFields);
    for (const [key, value] of Object.entries(body)) {
        if (Array.isArray(value) && allowedArrays.has(key)) continue;
        if (
            value !== null &&
            value !== undefined &&
            !['string', 'number', 'boolean'].includes(typeof value)
        ) {
            throw Object.assign(new Error('Μη έγκυρα δεδομένα'), { status: 400 });
        }
    }
}

function assertOptionalOwnershipValue(body, key, expected, normalizer = String) {
    if (body[key] === undefined || body[key] === null || body[key] === '') return;
    if (typeof body[key] !== 'string' || normalizer(body[key]) !== normalizer(expected)) {
        throw Object.assign(new Error('Μη έγκυρο scope'), { status: 403 });
    }
}

function resolveCreateTeam(sessionTeamValue, requestedTeamValue) {
    const sessionTeam = normalizeRequiredUserTeam(sessionTeamValue);
    if (sessionTeam === CANONICAL_ALL_TEAMS_CODE) {
        return normalizeRequiredUserTeam(requestedTeamValue);
    }
    if (
        requestedTeamValue !== undefined &&
        normalizeUserTeam(requestedTeamValue) !== sessionTeam
    ) {
        throw Object.assign(new Error('Μη έγκυρο scope'), { status: 403 });
    }
    return sessionTeam;
}

function companyScopeObject(req, company, effectiveTeam) {
    return Object.freeze({
        userId: String(req.session.userId),
        sessionTeam: normalizeRequiredUserTeam(req.authenticatedUserTeam),
        effectiveTeam,
        companyTeamFilter: String(company.team || '').trim(),
        companyId: String(company._id),
        companyKod: String(company.kod || '').trim()
    });
}

function handleScopeError(error, res) {
    const status = Number(error?.status) || 500;
    if (error?.code === 'COMPANY_USERS_REQUIRED') {
        return res.status(400).json({
            success: false,
            code: 'COMPANY_USERS_REQUIRED',
            message: 'Πρέπει να επιλεγεί τουλάχιστον ένας χρήστης στη σελίδα «Διάφορα».'
        });
    }
    if (status === 500) return sendError(res, 500, 'Σφάλμα ελέγχου πρόσβασης');
    return sendError(res, status, status === 400 ? 'Μη έγκυρα δεδομένα' : 'Δεν βρέθηκε πόρος');
}

function validateSelectedUsers(body) {
    if (!Array.isArray(body.selectedUsers) || body.selectedUsers.length === 0) {
        throw Object.assign(new Error('Απαιτείται χρήστης εταιρείας'), {
            status: 400,
            code: 'COMPANY_USERS_REQUIRED'
        });
    }
    if (body.selectedUsers.length > MAX_SELECTED_USERS) {
        throw Object.assign(new Error('Μη έγκυρα δεδομένα'), { status: 400 });
    }
    const normalized = [...new Set(body.selectedUsers.map((value) => stringValue(value, {
        required: true,
        max: 64
    })))];
    if (!normalized.every((value) => mongoose.isValidObjectId(value))) {
        throw Object.assign(new Error('Μη έγκυρα δεδομένα'), { status: 400 });
    }
    body.selectedUsers = normalized;
    return normalized;
}

async function assertSelectedUsersInTeam(userIds, effectiveTeam) {
    const users = await UserModel.find({
        _id: { $in: userIds },
        team: new RegExp(`^\\s*${effectiveTeam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')
    })
        .select('_id')
        .lean();
    const found = new Set(users.map((user) => String(user._id)));
    if (userIds.some((userId) => !found.has(userId))) {
        throw Object.assign(new Error('Δεν βρέθηκε πόρος'), { status: 404 });
    }
}

async function authorizeCompanyCreate(req, res, next) {
    try {
        assertPlainBody(req);
        assertPrimitiveFields(req.body, ['selectedUsers']);
        const effectiveTeam = resolveCreateTeam(req.authenticatedUserTeam, req.body.companyTeam);
        stringValue(req.body.eponymia, { required: true, max: 200 });
        stringValue(req.body.afm, { required: true, max: 16 });
        const selectedUsers = validateSelectedUsers(req.body);
        await assertSelectedUsersInTeam(selectedUsers, effectiveTeam);
        req.companyAccessScope = Object.freeze({
            userId: String(req.session.userId),
            sessionTeam: normalizeRequiredUserTeam(req.authenticatedUserTeam),
            effectiveTeam
        });
        return next();
    } catch (error) {
        return handleScopeError(error, res);
    }
}

async function findScopedCompany(req, companyId) {
    if (!mongoose.isValidObjectId(companyId)) {
        throw Object.assign(new Error('Μη έγκυρα δεδομένα'), { status: 400 });
    }
    const sessionTeam = normalizeRequiredUserTeam(req.authenticatedUserTeam);
    const company = await CompaniesModel.findById(companyId).select('_id team kod').lean();
    if (!company) throw Object.assign(new Error('Δεν βρέθηκε πόρος'), { status: 404 });
    const companyTeam = normalizeRequiredUserTeam(company.team);
    if (sessionTeam !== CANONICAL_ALL_TEAMS_CODE && companyTeam !== sessionTeam) {
        throw Object.assign(new Error('Δεν βρέθηκε πόρος'), { status: 404 });
    }
    return { company, companyTeam };
}

async function authorizeCompanyUpdate(req, res, next) {
    try {
        assertPlainBody(req);
        assertPrimitiveFields(req.body, ['selectedUsers']);
        const { company, companyTeam } = await findScopedCompany(req, req.params.companyId);
        if (req.body._id !== undefined || req.body.team !== undefined) {
            throw Object.assign(new Error('Μη έγκυρα δεδομένα'), { status: 400 });
        }
        assertOptionalOwnershipValue(req.body, 'companyTeam', companyTeam, normalizeUserTeam);
        const selectedUsers = validateSelectedUsers(req.body);
        await assertSelectedUsersInTeam(selectedUsers, companyTeam);
        req.companyAccessScope = companyScopeObject(req, company, companyTeam);
        return next();
    } catch (error) {
        return handleScopeError(error, res);
    }
}

async function authorizeCompanyChildCreate(req, res, next) {
    try {
        assertPlainBody(req);
        assertPrimitiveFields(req.body);
        const companyId = stringValue(req.session.companyInUse, { required: true, max: 64 });
        const { company, companyTeam } = await findScopedCompany(req, companyId);
        assertOptionalOwnershipValue(req.body, 'companyId', companyId);
        assertOptionalOwnershipValue(req.body, 'companyTeam', companyTeam, normalizeUserTeam);
        assertOptionalOwnershipValue(req.body, 'companyKodikos', company.kod);
        req.companyAccessScope = companyScopeObject(req, company, companyTeam);
        return next();
    } catch (error) {
        return handleScopeError(error, res);
    }
}

async function validateYpokatasthmaCreate(req, res, next) {
    try {
        assertPlainBody(req);
        assertPrimitiveFields(req.body);
        stringValue(req.body.perigrafh, { required: true, max: 200 });
        return next();
    } catch (error) {
        return handleScopeError(error, res);
    }
}

async function validatePasswordCreate(req, res, next) {
    try {
        assertPlainBody(req);
        assertPrimitiveFields(req.body);
        const code = stringValue(req.body.Kodikos, { required: true, max: 4 });
        if (!/^\d{1,4}$/.test(code)) {
            throw Object.assign(new Error('Μη έγκυρα δεδομένα'), { status: 400 });
        }
        stringValue(req.body.perigrafh, { required: true, max: 200 });
        stringValue(req.body.username, { required: true, max: 320 });
        stringValue(req.body.password, { required: true, max: MAX_SECRET_LENGTH });
        return next();
    } catch (error) {
        return handleScopeError(error, res);
    }
}

async function authorizeAntistoixishUpdate(req, res, next) {
    try {
        assertPlainBody(req);
        assertPrimitiveFields(req.body);
        const id = req.params.antistoixishId;
        if (!mongoose.isValidObjectId(id)) {
            throw Object.assign(new Error('Μη έγκυρα δεδομένα'), { status: 400 });
        }
        const record = await AntistoixiseisModel.findById(id).select('_id companyId team').lean();
        if (!record?.companyId) throw Object.assign(new Error('Δεν βρέθηκε πόρος'), { status: 404 });
        const { company, companyTeam } = await findScopedCompany(req, String(record.companyId));
        if (normalizeUserTeam(record.team) !== companyTeam) {
            throw Object.assign(new Error('Δεν βρέθηκε πόρος'), { status: 404 });
        }
        req.companyAccessScope = Object.freeze({
            ...companyScopeObject(req, company, companyTeam),
            resourceId: String(record._id)
        });
        return next();
    } catch (error) {
        return handleScopeError(error, res);
    }
}

module.exports = {
    authorizeCompanyCreate,
    authorizeCompanyUpdate,
    authorizeCompanyChildCreate,
    validateYpokatasthmaCreate,
    validatePasswordCreate,
    authorizeAntistoixishUpdate,
    resolveCreateTeam,
    stringValue
};

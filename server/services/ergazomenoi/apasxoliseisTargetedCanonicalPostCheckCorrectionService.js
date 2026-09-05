'use strict';

const mongoose = require('mongoose');
const { ProdhlomenaOrariaModel, ProdhlomenaOrariaAuditModel } = require('../../models/ergazomenoi');
const { normalizeScope, runWithPeriodWriteFence } = require('./apasxoliseisPeriodControlService');

// Only persisted fields emitted by the weekly post-check are eligible. This is
// a server-side adapter, never a client-supplied update or a calculation engine.
const ALLOWED_FIELDS = new Set([
    'apologistiko_biblio', 'kathgoria_ergasias_apologistika', 'repo_apologistika',
    'adeia_apologistika', 'kathgoria_adeias_apologistika', 'argia',
    'ores_ergasias_apologistika', 'ores_apoysias_apologistika',
    'ores_pragmatikhs_ergasias_apologistika', 'ores_adeias_pistomenes_apologistika',
    'ores_argias_pistomenes_apologistika', 'compensation_breakdown_apologistika',
    ...['01', '02', '03'].flatMap((pair) => [
        `apo_ora_${pair}_apologistika`, `eos_ora_${pair}_apologistika`
    ]),
    ...['yperergasias', 'nominhs_yperorias', 'paranomhs_yperorias'].flatMap((kind) =>
        ['', '_nyxtas', '_argion', '_argion_nyxtas'].map((suffix) => `ores_${kind}${suffix}_apologistika`))
]);
const BUSINESS_FIELDS = ['team', 'company_kod', 'ypokatasthma', 'kodikos'];
const IDENTITY_FIELDS = ['_id', ...BUSINESS_FIELDS, 'hmeromhnia'];
const plans = new WeakMap();
const plain = (value) => value !== null && typeof value === 'object' &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
const fail = (code) => { throw Object.assign(new Error(code), { code, statusCode: 409 }); };
const invalid = () => fail('TARGETED_CANONICAL_PLAN_INVALID');

// Deliberately narrow: reject BSON wrappers and unexpected prototypes rather
// than coercing them. Undefined is supported in snapshots, never serialized.
function clone(value, ancestors = new Set()) {
    const unsupported = () => fail('TARGETED_CANONICAL_SNAPSHOT_UNSUPPORTED_TYPE');
    if (value === null || value === undefined || ['string', 'boolean'].includes(typeof value)) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value instanceof Date && Object.getPrototypeOf(value) === Date.prototype &&
        Number.isFinite(value.getTime())) return new Date(value.getTime());
    if (value instanceof mongoose.Types.ObjectId &&
        Object.getPrototypeOf(value) === mongoose.Types.ObjectId.prototype) {
        return new mongoose.Types.ObjectId(value.toHexString());
    }
    if ((!plain(value) && !Array.isArray(value)) || ancestors.has(value)) unsupported();
    if (Array.isArray(value) && Object.getPrototypeOf(value) !== Array.prototype) unsupported();
    ancestors.add(value);
    const result = Array.isArray(value) ? new Array(value.length) : {};
    for (const key of Reflect.ownKeys(value)) {
        if (Array.isArray(value) && key === 'length') continue;
        if (Array.isArray(value) && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key))) unsupported();
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) unsupported();
        Object.defineProperty(result, key, { value: clone(descriptor.value, ancestors),
            enumerable: true, writable: true, configurable: true });
    }
    ancestors.delete(value);
    return result;
}

function sameSnapshot(left, right) {
    if (Object.is(left, right)) return true;
    if (left instanceof Date || right instanceof Date) return left instanceof Date &&
        right instanceof Date && left.getTime() === right.getTime();
    if (left instanceof mongoose.Types.ObjectId || right instanceof mongoose.Types.ObjectId) {
        return left instanceof mongoose.Types.ObjectId && right instanceof mongoose.Types.ObjectId &&
            left.toHexString() === right.toHexString();
    }
    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    } else if (!plain(left) || !plain(right)) return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) =>
        Object.hasOwn(right, key) && sameSnapshot(left[key], right[key]));
}

// BSON cannot faithfully store own undefined (or sparse array holes) in audit
// values. Keep them for stale detection, but fail closed if a changed field
// would require serializing them in the update/audit.
function assertPersistable(value) {
    if (value === undefined) fail('TARGETED_CANONICAL_AUDIT_UNREPRESENTABLE_VALUE');
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) assertPersistable(value[i]);
    } else if (plain(value)) {
        // The existing audit schema minimizes empty objects on insert.
        if (!Object.keys(value).length) fail('TARGETED_CANONICAL_AUDIT_UNREPRESENTABLE_VALUE');
        Object.values(value).forEach(assertPersistable);
    }
}

function exactAuditDiff(storedRow, changes) {
    return { oldValues: Object.fromEntries(Object.keys(changes)
        .filter((key) => Object.hasOwn(storedRow, key)).map((key) => [key, clone(storedRow[key])])),
    newValues: clone(changes) };
}

// Leaf predicates avoid embedded-document field-order equality. Complete
// object shape is checked by the transactional re-read; concurrent changes to
// that document must abort through MongoDB transaction write-conflict handling.
function oldValuePredicates(path, value, present = true) {
    if (!present) return [{ [path]: mongoose.trusted({ $exists: false }) }];
    const predicates = [{ [path]: mongoose.trusted({ $exists: true }) }];
    if (plain(value) || Array.isArray(value)) {
        predicates.push({ [path]: mongoose.trusted(Array.isArray(value)
            ? { $type: 'array', $size: value.length } : { $type: 'object' }) });
        for (const key of Object.keys(value)) {
            if (key.includes('.') || key.startsWith('$')) invalid();
            predicates.push(...oldValuePredicates(`${path}.${key}`, value[key]));
        }
    } else predicates.push({ [path]: mongoose.trusted({ $eq: clone(value) }) });
    return predicates;
}

function freeze(value) {
    if (value && typeof value === 'object' && (plain(value) || Array.isArray(value))) {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}

function identity(row) {
    if (!plain(row) || !/^[a-f\d]{24}$/i.test(String(row._id || '')) ||
        BUSINESS_FIELDS.some((key) => typeof row[key] !== 'string' || !row[key].trim()) ||
        !(typeof row.hmeromhnia === 'string' || row.hmeromhnia instanceof Date)) invalid();
    const date = new Date(row.hmeromhnia);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(11) !== '00:00:00.000Z') invalid();
    return { _id: String(row._id).toLowerCase(),
        ...Object.fromEntries(BUSINESS_FIELDS.map((key) => [key, row[key]])),
        hmeromhnia: date.toISOString() };
}

function fingerprint(value) {
    if (typeof value !== 'string' || !/^[a-f\d]{64}$/.test(value)) invalid();
    return value;
}

/**
 * Pure dry-run over the trusted output of buildWeeklyRepoPostCheckWritePlan.
 * The caller must provide the complete lean stored row, not a projection, and
 * must obtain the canonical plan from existing daily/post-check logic (including
 * buildDailyCompensationBreakdown), never from a request body.
 *
 * expectedContextFingerprint is a SHA-256 token over exactly the calculation
 * input facts: natural-week rows, effective profiles/history, holiday/policy
 * facts, decisions and applied-protection context, with deterministic encoding
 * and the canonical source/semantics version. The future integration owns that
 * encoding and the matching read-only resolver; this adapter does no payroll
 * calculation and has no controller, route, CLI or period-wide loader.
 */
function buildTargetedCanonicalPostCheckCorrectionPlan({ target, storedRow,
    canonicalWritePlan, periodScope, expectedPeriodToken, expectedWriteFenceVersion,
    expectedContextFingerprint } = {}) {
    storedRow = clone(storedRow);
    canonicalWritePlan = clone(canonicalWritePlan);
    const expected = identity(target);
    if (!sameSnapshot(expected, identity(storedRow)) || storedRow.is_locked === true ||
        !Number.isSafeInteger(storedRow.__v) || storedRow.__v < 0) invalid();
    const scope = normalizeScope(periodScope);
    if (['team', 'company_kod', 'ypokatasthma'].some((key) => scope[key] !== expected[key]) ||
        new Date(expected.hmeromhnia) < scope.period_start ||
        new Date(expected.hmeromhnia) > scope.period_end) invalid();
    if (expectedPeriodToken?.exists !== true || expectedPeriodToken.stored_status !== 'OPEN' ||
        !Number.isSafeInteger(expectedPeriodToken.version) || expectedPeriodToken.version < 1 ||
        !Number.isSafeInteger(expectedWriteFenceVersion) || expectedWriteFenceVersion < 0) invalid();
    fingerprint(expectedContextFingerprint);
    const operations = canonicalWritePlan?.bulkOps;
    if (!Array.isArray(operations) || operations.length !== 1) invalid();
    const operation = operations[0];
    if (!plain(operation) || Object.keys(operation).join() !== 'updateOne') invalid();
    const write = operation.updateOne;
    if (!plain(write) || Object.keys(write).sort().join() !== 'filter,update,upsert' ||
        write.upsert !== false || !plain(write.filter) ||
        String(write.filter._id).toLowerCase() !== expected._id ||
        Object.keys(write.filter).some((key) => !IDENTITY_FIELDS.includes(key))) invalid();
    for (const key of IDENTITY_FIELDS.slice(1)) {
        if (!Object.hasOwn(write.filter, key)) continue;
        let value = write.filter[key];
        if (key === 'hmeromhnia') {
            if (!(value instanceof Date || typeof value === 'string') ||
                !Number.isFinite(new Date(value).getTime())) invalid();
            value = new Date(value).toISOString();
        }
        if (!sameSnapshot(value, expected[key])) invalid();
    }
    if (!plain(write.update) || Object.keys(write.update).join() !== '$set' ||
        !plain(write.update.$set) || Object.keys(write.update.$set).length === 0 ||
        Object.keys(write.update.$set).some((key) => !ALLOWED_FIELDS.has(key) ||
            write.update.$set[key] === undefined)) invalid();
    // Every canonical post-check also produces the breakdown. Do not accept a
    // bucket-only patch that would bypass that part of the canonical result.
    if (!plain(write.update.$set.compensation_breakdown_apologistika)) invalid();
    const minimalCanonicalDiff = Object.fromEntries(Object.entries(write.update.$set)
        .filter(([key, value]) => !sameSnapshot(storedRow[key], value)));
    for (const key of Object.keys(minimalCanonicalDiff)) {
        assertPersistable(minimalCanonicalDiff[key]);
        if (Object.hasOwn(storedRow, key)) assertPersistable(storedRow[key]);
        oldValuePredicates(key, storedRow[key], Object.hasOwn(storedRow, key));
    }
    const state = clone({ target: expected, storedRow, periodScope: scope,
        expectedPeriodToken, expectedWriteFenceVersion, expectedContextFingerprint,
        minimalCanonicalDiff });
    const result = freeze(clone({ target: expected, periodScope: scope,
        expectedPeriodToken, expectedWriteFenceVersion, expectedContextFingerprint,
        minimalCanonicalDiff, changedFieldCount: Object.keys(minimalCanonicalDiff).length }));
    // Persist accepts only a plan issued here. Caller mutation (including Dates
    // or BSON objects) cannot change the private dry-run snapshot.
    plans.set(result, state);
    return result;
}

/**
 * resolveCurrentContextFingerprint MUST read current input facts using the
 * supplied transaction session and the same encoding as the dry-run. It must
 * not return a cached/request token. Integration must coordinate context writers
 * with this fence; no claim of protection for unfenced external DB writers.
 */
async function persistTargetedCanonicalPostCheckCorrection({ plan, changedBy, reason,
    resolveCurrentContextFingerprint, rowModel = ProdhlomenaOrariaModel,
    auditModel = ProdhlomenaOrariaAuditModel, periodFence = runWithPeriodWriteFence } = {}) {
    const saved = plans.get(plan);
    if (!saved || typeof changedBy !== 'string' || !changedBy.trim() ||
        typeof reason !== 'string' || !reason.trim() ||
        typeof resolveCurrentContextFingerprint !== 'function') invalid();
    const state = clone(saved);
    const { storedRow, minimalCanonicalDiff } = state;
    if (!Object.keys(minimalCanonicalDiff).length) return { updated: false, idempotent: true };
    const fenced = await periodFence({ scope: state.periodScope,
        expectedToken: state.expectedPeriodToken,
        expectedWriteFenceVersion: state.expectedWriteFenceVersion,
        work: async ({ session }) => {
            if (!session) fail('TARGETED_CANONICAL_TRANSACTION_REQUIRED');
            const current = await resolveCurrentContextFingerprint({
                session, target: clone(state.target), periodScope: clone(state.periodScope)
            });
            if (current !== state.expectedContextFingerprint) fail('TARGETED_CANONICAL_CONTEXT_STALE');
            const identityFilter = Object.fromEntries(IDENTITY_FIELDS.map((key) => [key, clone(storedRow[key])]));
            const fresh = await rowModel.findOne(identityFilter).session(session).lean();
            let freshSnapshot;
            try { freshSnapshot = clone(fresh); } catch (error) {
                if (error.code !== 'TARGETED_CANONICAL_SNAPSHOT_UNSUPPORTED_TYPE') throw error;
                fail('TARGETED_CANONICAL_ROW_STALE');
            }
            if (!freshSnapshot || !sameSnapshot(storedRow, freshSnapshot)) fail('TARGETED_CANONICAL_ROW_STALE');
            const filter = { ...identityFilter, __v: storedRow.__v,
                $and: Object.keys(minimalCanonicalDiff).flatMap((key) =>
                    oldValuePredicates(key, storedRow[key], Object.hasOwn(storedRow, key))) };
            const result = await rowModel.updateOne(filter,
                { $set: clone(minimalCanonicalDiff) }, { session });
            if (result?.matchedCount !== 1) fail('TARGETED_CANONICAL_ROW_STALE');
            const { oldValues, newValues } = exactAuditDiff(storedRow, minimalCanonicalDiff);
            await auditModel.create([{
                team: storedRow.team, company_kod: storedRow.company_kod,
                prodhlomena_oraria_id: storedRow._id, kodikos: storedRow.kodikos,
                ypokatasthma: storedRow.ypokatasthma, hmeromhnia: storedRow.hmeromhnia,
                changedBy: changedBy.trim(), reason: reason.trim(), oldValues, newValues
            }], { session });
            return { updated: true, idempotent: false, rowId: state.target._id,
                changedFields: Object.keys(minimalCanonicalDiff) };
        } });
    return fenced.result;
}

module.exports = { buildTargetedCanonicalPostCheckCorrectionPlan,
    persistTargetedCanonicalPostCheckCorrection };

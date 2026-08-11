'use strict';

const assert = require('assert');
const {
    DIAGNOSTIC,
    PROTECTION_STATE,
    ROLE,
    IDENTITY_FIELDS,
    SNAPSHOT_FIELDS,
    normalizeRowId,
    buildAppliedRepoTransferProtectionContext,
    sanitizeAppliedRepoTransferUpdate
} = require('./apasxoliseisWeeklyRepoTransferAppliedProtectionService');

const IDS = Object.freeze({
    execution1: '100000000000000000000001',
    execution2: '100000000000000000000002',
    decision1: '200000000000000000000001',
    decision2: '200000000000000000000002',
    employee: '300000000000000000000001',
    source: '400000000000000000000001',
    target: '400000000000000000000002',
    otherSource: '400000000000000000000003',
    otherTarget: '400000000000000000000004'
});

const SCOPE = Object.freeze({
    team: 'TEST_TEAM',
    company_kod: 'TEST_COMPANY',
    ypokatasthma: 'TEST_BRANCH'
});

let passed = 0;

function test(name, fn) {
    try {
        fn();
        passed += 1;
    } catch (error) {
        error.message = `${name}: ${error.message}`;
        throw error;
    }
}

function clone(value) {
    return structuredClone(value);
}

function snapshot(category, repo) {
    return {
        kathgoria_ergasias_apologistika: category,
        repo_apologistika: repo,
        apologistiko_biblio: repo,
        adeia_apologistika: false,
        kathgoria_adeias_apologistika: '',
        ores_apoysias_apologistika: 0,
        apo_ora_01_apologistika: '',
        eos_ora_01_apologistika: '',
        apo_ora_02_apologistika: '',
        eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '',
        eos_ora_03_apologistika: '',
        ores_ergasias_apologistika: 0,
        ores_pragmatikhs_ergasias_apologistika: 0,
        ores_adeias_pistomenes_apologistika: 0,
        ores_argias_pistomenes_apologistika: 0,
        compensation_breakdown_apologistika: null
    };
}

function execution(overrides = {}) {
    const base = {
        _id: IDS.execution1,
        decision_id: IDS.decision1,
        decision_fingerprint: 'f'.repeat(64),
        proposal_id: 'proposal-v1',
        source_prodhlomena_oraria_id: IDS.source,
        target_prodhlomena_oraria_id: IDS.target,
        team: SCOPE.team,
        company_kod: SCOPE.company_kod,
        ypokatasthma: SCOPE.ypokatasthma,
        employee_id: IDS.employee,
        employee_kodikos: 'EMP-001',
        week_start: '2026-06-15T00:00:00.000Z',
        week_end: '2026-06-21T00:00:00.000Z',
        request_id: 'request-0001',
        command_identity: 'c'.repeat(64),
        created_by_user_id: IDS.employee,
        created_by_user_name: 'Synthetic Actor',
        created_by_user_role: 'A',
        execution_status: 'APPLIED',
        before_snapshot: {
            source: snapshot('ΑΝ', true),
            target: snapshot('ΕΡΓ', false),
            source_locked: false,
            target_locked: false
        },
        after_snapshot: {
            source: snapshot('ΕΡΓ', false),
            target: snapshot('ΑΝ', true),
            source_locked: false,
            target_locked: false
        },
        applied_at: '2026-06-15T10:00:00.000Z',
        created_at: '2026-06-15T10:00:00.000Z'
    };
    return {
        ...base,
        ...overrides,
        after_snapshot: overrides.after_snapshot === undefined
            ? base.after_snapshot
            : overrides.after_snapshot
    };
}

function context(executions = [execution()], loadedRowIds) {
    return buildAppliedRepoTransferProtectionContext({
        executions,
        scope: SCOPE,
        ...(loadedRowIds === undefined ? {} : { loadedRowIds })
    });
}

function protectedCurrent(category, repo, extra = {}) {
    return {
        kathgoria_ergasias_apologistika: category,
        repo_apologistika: repo,
        apologistiko_biblio: repo,
        ...extra
    };
}

function diagnosticCodes(value) {
    return value.diagnostics.map((item) => typeof item === 'string' ? item : item.code);
}

test('exports stable protected identity fields and exact snapshot field count', () => {
    assert.deepStrictEqual(IDENTITY_FIELDS, [
        'kathgoria_ergasias_apologistika',
        'repo_apologistika',
        'apologistiko_biblio'
    ]);
    assert.strictEqual(SNAPSHOT_FIELDS.length, 17);
});

test('legacy applied snapshots remain protected without silently inventing book state', () => {
    const legacy = execution();
    for (const phase of ['before_snapshot', 'after_snapshot']) {
        delete legacy[phase].source.apologistiko_biblio;
        delete legacy[phase].target.apologistiko_biblio;
    }
    const context = buildAppliedRepoTransferProtectionContext({
        executions: [legacy], scope: SCOPE, loadedRowIds: [IDS.source, IDS.target]
    });
    assert.strictEqual(context.entriesByRowId[IDS.source].state, PROTECTION_STATE.PROTECTED);
    assert.strictEqual(Object.hasOwn(
        context.entriesByRowId[IDS.source].protectedValues, 'apologistiko_biblio'
    ), false);
});

test('valid APPLIED source creates SOURCE protection from after snapshot', () => {
    const result = context();
    const entry = result.entriesByRowId[IDS.source];
    assert.strictEqual(entry.state, PROTECTION_STATE.PROTECTED);
    assert.strictEqual(entry.role, ROLE.SOURCE);
    assert.deepStrictEqual(entry.protectedValues, {
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: false,
        apologistiko_biblio: false
    });
});

test('valid APPLIED target creates TARGET ΑΝ protection from after snapshot', () => {
    const entry = context().entriesByRowId[IDS.target];
    assert.strictEqual(entry.role, ROLE.TARGET);
    assert.deepStrictEqual(entry.protectedValues, {
        kathgoria_ergasias_apologistika: 'ΑΝ',
        repo_apologistika: true,
        apologistiko_biblio: true
    });
});

test('valid APPLIED target preserves ΜΕ from after snapshot', () => {
    const value = execution({
        after_snapshot: {
            source: snapshot('ΕΡΓ', false),
            target: snapshot('ΜΕ', true),
            source_locked: false,
            target_locked: false
        }
    });
    assert.strictEqual(
        context([value]).entriesByRowId[IDS.target].protectedValues
            .kathgoria_ergasias_apologistika,
        'ΜΕ'
    );
});

test('both loaded rows create two entries', () => {
    assert.deepStrictEqual(
        Object.keys(context([execution()], [IDS.source, IDS.target]).entriesByRowId).sort(),
        [IDS.source, IDS.target].sort()
    );
});

test('only source loaded protects source without pair diagnostic', () => {
    const result = context([execution()], [IDS.source]);
    assert.deepStrictEqual(Object.keys(result.entriesByRowId), [IDS.source]);
    assert.deepStrictEqual(result.diagnostics, []);
});

test('only target loaded protects target without pair diagnostic', () => {
    const result = context([execution()], [IDS.target]);
    assert.deepStrictEqual(Object.keys(result.entriesByRowId), [IDS.target]);
    assert.deepStrictEqual(result.diagnostics, []);
});

test('omitted loadedRowIds deterministically includes all valid evidence rows', () => {
    assert.deepStrictEqual(Object.keys(context().entriesByRowId).sort(), [IDS.source, IDS.target]);
});

test('non-APPLIED execution creates no protection', () => {
    const value = execution({ execution_status: 'PENDING' });
    const result = context([value]);
    assert.deepStrictEqual(result.entriesByRowId, {});
    assert.strictEqual(result.hasConflicts, false);
});

test('missing source ID fails closed for identifiable loaded target', () => {
    const value = execution({ source_prodhlomena_oraria_id: undefined });
    const result = context([value], [IDS.target]);
    assert.strictEqual(result.entriesByRowId[IDS.target].state, PROTECTION_STATE.CONFLICT);
    assert.ok(diagnosticCodes(result).includes(DIAGNOSTIC.MALFORMED_PAIR));
});

test('missing target ID fails closed for identifiable loaded source', () => {
    const value = execution({ target_prodhlomena_oraria_id: undefined });
    const result = context([value], [IDS.source]);
    assert.strictEqual(result.entriesByRowId[IDS.source].state, PROTECTION_STATE.CONFLICT);
});

test('same source and target ID fails closed', () => {
    const value = execution({ target_prodhlomena_oraria_id: IDS.source });
    const result = context([value], [IDS.source]);
    assert.strictEqual(result.entriesByRowId[IDS.source].state, PROTECTION_STATE.CONFLICT);
    assert.ok(diagnosticCodes(result).includes(DIAGNOSTIC.MALFORMED_PAIR));
});

test('malformed source after snapshot fails closed', () => {
    const value = execution();
    delete value.after_snapshot.source.ores_ergasias_apologistika;
    const result = context([value], [IDS.source]);
    assert.ok(diagnosticCodes(result).includes(DIAGNOSTIC.MALFORMED_AFTER_SNAPSHOT));
    assert.strictEqual(result.entriesByRowId[IDS.source].state, PROTECTION_STATE.CONFLICT);
});

test('malformed target after snapshot fails closed', () => {
    const value = execution();
    value.after_snapshot.target.repo_apologistika = 'true';
    const result = context([value], [IDS.target]);
    assert.ok(diagnosticCodes(result).includes(DIAGNOSTIC.MALFORMED_AFTER_SNAPSHOT));
});

test('invalid SOURCE applied identity fails closed', () => {
    const value = execution();
    value.after_snapshot.source.kathgoria_ergasias_apologistika = 'ΑΝ';
    const result = context([value], [IDS.source]);
    assert.ok(diagnosticCodes(result).includes(DIAGNOSTIC.INVALID_SOURCE_APPLIED_IDENTITY));
});

test('invalid TARGET category fails closed', () => {
    const value = execution();
    value.after_snapshot.target.kathgoria_ergasias_apologistika = 'ΕΡΓ';
    const result = context([value], [IDS.target]);
    assert.ok(diagnosticCodes(result).includes(DIAGNOSTIC.INVALID_TARGET_APPLIED_IDENTITY));
});

test('invalid TARGET repo flag fails closed', () => {
    const value = execution();
    value.after_snapshot.target.repo_apologistika = false;
    const result = context([value], [IDS.target]);
    assert.ok(diagnosticCodes(result).includes(DIAGNOSTIC.INVALID_TARGET_APPLIED_IDENTITY));
});

test('scope mismatch marks referenced loaded row conflict', () => {
    const value = execution({ company_kod: 'FOREIGN_COMPANY' });
    const result = context([value], [IDS.source]);
    assert.strictEqual(result.entriesByRowId[IDS.source].state, PROTECTION_STATE.CONFLICT);
    assert.ok(diagnosticCodes(result).includes(DIAGNOSTIC.SCOPE_MISMATCH));
});

test('duplicate distinct executions sharing source fail closed', () => {
    const second = execution({
        _id: IDS.execution2,
        decision_id: IDS.decision2,
        proposal_id: 'proposal-v2',
        target_prodhlomena_oraria_id: IDS.otherTarget
    });
    const result = context([execution(), second], [IDS.source]);
    assert.strictEqual(result.entriesByRowId[IDS.source].state, PROTECTION_STATE.CONFLICT);
    assert.ok(diagnosticCodes(result).includes(DIAGNOSTIC.DUPLICATE_APPLIED_EXECUTION));
});

test('duplicate distinct executions sharing target fail closed', () => {
    const second = execution({
        _id: IDS.execution2,
        decision_id: IDS.decision2,
        proposal_id: 'proposal-v2',
        source_prodhlomena_oraria_id: IDS.otherSource
    });
    assert.strictEqual(
        context([execution(), second], [IDS.target]).entriesByRowId[IDS.target].state,
        PROTECTION_STATE.CONFLICT
    );
});

test('row reused as source then target fails closed', () => {
    const second = execution({
        _id: IDS.execution2,
        decision_id: IDS.decision2,
        proposal_id: 'proposal-v2',
        source_prodhlomena_oraria_id: IDS.otherSource,
        target_prodhlomena_oraria_id: IDS.source
    });
    assert.strictEqual(
        context([execution(), second], [IDS.source]).entriesByRowId[IDS.source].state,
        PROTECTION_STATE.CONFLICT
    );
});

test('exact execution replay is safely deduplicated', () => {
    const value = execution();
    const result = context([value, clone(value)]);
    assert.strictEqual(Object.keys(result.entriesByRowId).length, 2);
    assert.strictEqual(result.hasConflicts, false);
});

test('same execution ID with changed evidence fails closed', () => {
    const changed = execution({ target_prodhlomena_oraria_id: IDS.otherTarget });
    const result = context([execution(), changed], [IDS.source, IDS.target, IDS.otherTarget]);
    assert.strictEqual(result.entriesByRowId[IDS.source].state, PROTECTION_STATE.CONFLICT);
    assert.strictEqual(result.entriesByRowId[IDS.target].state, PROTECTION_STATE.CONFLICT);
    assert.strictEqual(result.entriesByRowId[IDS.otherTarget].state, PROTECTION_STATE.CONFLICT);
    assert.ok(diagnosticCodes(result).includes(DIAGNOSTIC.DUPLICATE_APPLIED_EXECUTION));
});

test('ObjectId-like toHexString normalization is accepted', () => {
    const objectIdLike = { toHexString: () => IDS.source.toUpperCase() };
    assert.strictEqual(normalizeRowId(objectIdLike), IDS.source);
    assert.ok(context([execution()], [objectIdLike]).entriesByRowId[IDS.source]);
});

test('safe custom toString normalization is accepted', () => {
    assert.strictEqual(normalizeRowId({ toString: () => IDS.target }), IDS.target);
});

test('invalid row ID representation is diagnosed', () => {
    const result = context([execution()], [{}]);
    assert.ok(diagnosticCodes(result).includes(DIAGNOSTIC.INVALID_ROW_ID));
    assert.deepStrictEqual(result.entriesByRowId, {});
});

test('unknown old execution shape produces global diagnostic only when no row is identifiable', () => {
    const result = context([{ execution_status: 'APPLIED' }], [IDS.source]);
    assert.ok(diagnosticCodes(result).includes(DIAGNOSTIC.INVALID_EXECUTION));
    assert.deepStrictEqual(result.entriesByRowId, {});
});

test('builder never mutates executions, scope or loaded IDs', () => {
    const executions = [execution()];
    const scope = { ...SCOPE };
    const loaded = [IDS.source];
    const before = clone({ executions, scope, loaded });
    buildAppliedRepoTransferProtectionContext({ executions, scope, loadedRowIds: loaded });
    assert.deepStrictEqual({ executions, scope, loaded }, before);
});

test('builder replay is deterministic', () => {
    const input = { executions: [execution()], scope: SCOPE, loadedRowIds: [IDS.target] };
    assert.deepStrictEqual(
        buildAppliedRepoTransferProtectionContext(input),
        buildAppliedRepoTransferProtectionContext(input)
    );
});

test('builder output and nested context are frozen', () => {
    const result = context();
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.entriesByRowId));
    assert.ok(Object.isFrozen(result.entriesByRowId[IDS.source]));
    assert.ok(Object.isFrozen(result.entriesByRowId[IDS.source].protectedValues));
    assert.ok(Object.isFrozen(result.diagnostics));
});

test('unprotected row update is cloned unchanged', () => {
    const update = { repo_apologistika: false, ores_ergasias_apologistika: 3 };
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.otherSource,
        currentRow: {},
        update,
        protectionContext: context()
    });
    assert.strictEqual(result.protectionState, PROTECTION_STATE.UNPROTECTED);
    assert.deepStrictEqual(result.sanitizedUpdate, update);
    assert.notStrictEqual(result.sanitizedUpdate, update);
});

test('protected SOURCE matching category is removed as no-op', () => {
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.source,
        currentRow: protectedCurrent('ΕΡΓ', false),
        update: { kathgoria_ergasias_apologistika: 'ΕΡΓ' },
        protectionContext: context()
    });
    assert.deepStrictEqual(result.sanitizedUpdate, {});
    assert.deepStrictEqual(result.removedIdentityFields, ['kathgoria_ergasias_apologistika']);
});

test('protected SOURCE matching repo false is removed as no-op', () => {
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.source,
        currentRow: protectedCurrent('ΕΡΓ', false),
        update: { repo_apologistika: false },
        protectionContext: context()
    });
    assert.deepStrictEqual(result.removedIdentityFields, ['repo_apologistika']);
});

test('protected SOURCE both matching identity fields are removed', () => {
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.source,
        currentRow: protectedCurrent('ΕΡΓ', false),
        update: protectedCurrent('ΕΡΓ', false),
        protectionContext: context()
    });
    assert.deepStrictEqual(result.sanitizedUpdate, {});
    assert.strictEqual(result.removedIdentityFields.length, 3);
});

test('protected TARGET ΑΝ matching identity fields are removed', () => {
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.target,
        currentRow: protectedCurrent('ΑΝ', true),
        update: protectedCurrent('ΑΝ', true),
        protectionContext: context()
    });
    assert.deepStrictEqual(result.sanitizedUpdate, {});
    assert.strictEqual(result.hasConflict, false);
});

test('protected TARGET ΜΕ matching identity fields are removed', () => {
    const value = execution();
    value.after_snapshot.target = snapshot('ΜΕ', true);
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.target,
        currentRow: protectedCurrent('ΜΕ', true),
        update: protectedCurrent('ΜΕ', true),
        protectionContext: context([value])
    });
    assert.strictEqual(result.removedIdentityFields.length, 3);
});

for (const testCase of [
    { name: 'SOURCE category', rowId: IDS.source, current: ['ΕΡΓ', false], update: { kathgoria_ergasias_apologistika: 'ΑΝ' } },
    { name: 'SOURCE repo', rowId: IDS.source, current: ['ΕΡΓ', false], update: { repo_apologistika: true } },
    { name: 'TARGET category', rowId: IDS.target, current: ['ΑΝ', true], update: { kathgoria_ergasias_apologistika: 'ΕΡΓ' } },
    { name: 'TARGET repo', rowId: IDS.target, current: ['ΑΝ', true], update: { repo_apologistika: false } }
]) {
    test(`conflicting ${testCase.name} identity write is blocked`, () => {
        const result = sanitizeAppliedRepoTransferUpdate({
            rowId: testCase.rowId,
            currentRow: protectedCurrent(...testCase.current),
            update: testCase.update,
            protectionContext: context()
        });
        assert.deepStrictEqual(result.sanitizedUpdate, {});
        assert.strictEqual(result.blockedIdentityFields.length, 1);
        assert.ok(result.diagnostics.includes(
            DIAGNOSTIC.APPLIED_REPO_TRANSFER_IDENTITY_WRITE_CONFLICT
        ));
    });
}

test('one matching and one conflicting identity field are classified separately', () => {
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.target,
        currentRow: protectedCurrent('ΑΝ', true),
        update: protectedCurrent('ΑΝ', false, { apologistiko_biblio: true }),
        protectionContext: context()
    });
    assert.deepStrictEqual(result.removedIdentityFields,
        ['apologistiko_biblio', 'kathgoria_ergasias_apologistika']);
    assert.deepStrictEqual(result.blockedIdentityFields, ['repo_apologistika']);
});

test('Class-B hours and actual hours pass unchanged', () => {
    const update = {
        ores_ergasias_apologistika: 4,
        ores_pragmatikhs_ergasias_apologistika: 4
    };
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.target,
        currentRow: protectedCurrent('ΑΝ', true),
        update,
        protectionContext: context()
    });
    assert.deepStrictEqual(result.sanitizedUpdate, update);
});

test('Class-B intervals pass unchanged', () => {
    const update = { apo_ora_01_apologistika: '22:00', eos_ora_01_apologistika: '02:00' };
    assert.deepStrictEqual(sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.target,
        currentRow: protectedCurrent('ΑΝ', true),
        update,
        protectionContext: context()
    }).sanitizedUpdate, update);
});

test('night holiday and overtime fields pass unchanged', () => {
    const update = {
        ores_nyxtas_apologistika: 1,
        ores_argion_prosayxhsh_apologistika: 2,
        ores_nominhs_yperorias_apologistika: 0.5,
        ores_paranomhs_yperorias_apologistika: 1
    };
    assert.deepStrictEqual(sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.target,
        currentRow: protectedCurrent('ΑΝ', true),
        update,
        protectionContext: context()
    }).sanitizedUpdate, update);
});

test('compensation object passes unchanged', () => {
    const update = { compensation_breakdown_apologistika: { status: 'READY', amounts: { gross: 10 } } };
    assert.deepStrictEqual(sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.source,
        currentRow: protectedCurrent('ΕΡΓ', false),
        update,
        protectionContext: context()
    }).sanitizedUpdate, update);
});

test('Class-C leave sickness and absence fields pass unchanged', () => {
    const update = {
        adeia_apologistika: true,
        kathgoria_adeias_apologistika: 'ΑΔΑΛ',
        astheneia_apologistika: true,
        ores_apoysias_apologistika: 2
    };
    assert.deepStrictEqual(sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.source,
        currentRow: protectedCurrent('ΕΡΓ', false),
        update,
        protectionContext: context()
    }).sanitizedUpdate, update);
});

test('conflicting identity is blocked while Class-B fields remain', () => {
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.target,
        currentRow: protectedCurrent('ΑΝ', true),
        update: { repo_apologistika: false, ores_pragmatikhs_ergasias_apologistika: 4 },
        protectionContext: context()
    });
    assert.deepStrictEqual(result.sanitizedUpdate, {
        ores_pragmatikhs_ergasias_apologistika: 4
    });
});

test('matching current identity has no integrity diagnostic', () => {
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.source,
        currentRow: protectedCurrent('ΕΡΓ', false),
        update: {},
        protectionContext: context()
    });
    assert.deepStrictEqual(result.diagnostics, []);
});

for (const testCase of [
    { name: 'category', current: protectedCurrent('ΑΝ', false) },
    { name: 'repo', current: protectedCurrent('ΕΡΓ', true) },
    { name: 'both fields', current: protectedCurrent('ΑΝ', true) }
]) {
    test(`current ${testCase.name} mismatch produces deterministic integrity diagnostic`, () => {
        const result = sanitizeAppliedRepoTransferUpdate({
            rowId: IDS.source,
            currentRow: testCase.current,
            update: {},
            protectionContext: context()
        });
        assert.deepStrictEqual(result.diagnostics, [
            DIAGNOSTIC.CURRENT_IDENTITY_DIFFERS_FROM_APPLIED_EXECUTION
        ]);
        assert.strictEqual(result.hasConflict, true);
    });
}

test('current mismatch plus matching proposal does not restore identity', () => {
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.target,
        currentRow: protectedCurrent('ΕΡΓ', false),
        update: protectedCurrent('ΑΝ', true, { ores_ergasias_apologistika: 3 }),
        protectionContext: context()
    });
    assert.deepStrictEqual(result.sanitizedUpdate, { ores_ergasias_apologistika: 3 });
    assert.strictEqual(result.removedIdentityFields.length, 3);
    assert.ok(result.diagnostics.includes(
        DIAGNOSTIC.CURRENT_IDENTITY_DIFFERS_FROM_APPLIED_EXECUTION
    ));
});

test('CONFLICT entry blocks all Class-A writes and preserves safe fields', () => {
    const second = execution({
        _id: IDS.execution2,
        decision_id: IDS.decision2,
        proposal_id: 'proposal-v2',
        target_prodhlomena_oraria_id: IDS.otherTarget
    });
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.source,
        currentRow: protectedCurrent('ΕΡΓ', false),
        update: {
            kathgoria_ergasias_apologistika: 'ΕΡΓ',
            repo_apologistika: false,
            ores_ergasias_apologistika: 5
        },
        protectionContext: context([execution(), second], [IDS.source])
    });
    assert.strictEqual(result.protectionState, PROTECTION_STATE.CONFLICT);
    assert.deepStrictEqual(result.sanitizedUpdate, { ores_ergasias_apologistika: 5 });
    assert.strictEqual(result.blockedIdentityFields.length, 2);
});

test('approval decision and reusable metadata without execution have no effect', () => {
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.source,
        currentRow: {
            approval_id: IDS.decision1,
            reusable_status: 'ACTIVE',
            decision_status: 'APPROVE_PROPOSAL',
            resolution: 'RESOLVED_BY_POLICY',
            fingerprint: 'synthetic'
        },
        update: { repo_apologistika: true },
        protectionContext: context([])
    });
    assert.strictEqual(result.protectionState, PROTECTION_STATE.UNPROTECTED);
    assert.deepStrictEqual(result.sanitizedUpdate, { repo_apologistika: true });
});

test('REVOKED reusable metadata does not disable valid APPLIED protection', () => {
    const value = execution({ reusable_status: 'REVOKED' });
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.source,
        currentRow: protectedCurrent('ΕΡΓ', false, { reusable_status: 'REVOKED' }),
        update: { repo_apologistika: true },
        protectionContext: context([value])
    });
    assert.deepStrictEqual(result.blockedIdentityFields, ['repo_apologistika']);
});

test('new target work passes through while target identity remains no-op', () => {
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.target,
        currentRow: protectedCurrent('ΑΝ', true),
        update: protectedCurrent('ΑΝ', true, {
            ores_ergasias_apologistika: 4,
            ores_pragmatikhs_ergasias_apologistika: 4,
            ores_nyxtas_apologistika: 1
        }),
        protectionContext: context()
    });
    assert.deepStrictEqual(result.sanitizedUpdate, {
        ores_ergasias_apologistika: 4,
        ores_pragmatikhs_ergasias_apologistika: 4,
        ores_nyxtas_apologistika: 1
    });
});

test('invalid sanitizer row ID blocks identity but preserves safe fields', () => {
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: '',
        update: { repo_apologistika: false, ores_ergasias_apologistika: 2 },
        protectionContext: context()
    });
    assert.deepStrictEqual(result.sanitizedUpdate, { ores_ergasias_apologistika: 2 });
    assert.deepStrictEqual(result.diagnostics, [DIAGNOSTIC.INVALID_ROW_ID]);
});

test('sanitizer never mutates update current row or protection context', () => {
    const protectionContext = context();
    const currentRow = protectedCurrent('ΑΝ', true, { nested: { value: 1 } });
    const update = protectedCurrent('ΑΝ', false, {
        compensation_breakdown_apologistika: { nested: { value: 2 } }
    });
    const before = clone({ currentRow, update, protectionContext });
    sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.target,
        currentRow,
        update,
        protectionContext
    });
    assert.deepStrictEqual({ currentRow, update, protectionContext }, before);
    assert.strictEqual(Object.isFrozen(update.compensation_breakdown_apologistika), false);
    assert.strictEqual(Object.isFrozen(update.compensation_breakdown_apologistika.nested), false);
});

test('sanitizer output and all returned nested values are frozen', () => {
    const result = sanitizeAppliedRepoTransferUpdate({
        rowId: IDS.target,
        currentRow: protectedCurrent('ΑΝ', true),
        update: { compensation_breakdown_apologistika: { nested: { value: 2 } } },
        protectionContext: context()
    });
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.sanitizedUpdate));
    assert.ok(Object.isFrozen(result.sanitizedUpdate.compensation_breakdown_apologistika));
    assert.ok(Object.isFrozen(result.sanitizedUpdate.compensation_breakdown_apologistika.nested));
    assert.ok(Object.isFrozen(result.diagnostics));
});

test('sanitizer replay is deterministic and idempotent', () => {
    const input = {
        rowId: IDS.target,
        currentRow: protectedCurrent('ΑΝ', true),
        update: protectedCurrent('ΑΝ', true, {
            ores_ergasias_apologistika: 3,
            ores_pragmatikhs_ergasias_apologistika: 3,
            ores_nyxtas_apologistika: 1
        }),
        protectionContext: context()
    };
    assert.deepStrictEqual(
        sanitizeAppliedRepoTransferUpdate(input),
        sanitizeAppliedRepoTransferUpdate(input)
    );
});

process.stdout.write(
    `apasxoliseisWeeklyRepoTransferAppliedProtectionService: ${passed}/${passed} PASS\n`
);

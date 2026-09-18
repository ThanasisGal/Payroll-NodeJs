'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    writeEmployeeRehire
} = require('./employeeEmploymentProfileWriter');

const scope = {
    team: 'THA',
    company_kod: 'company',
    kodikos: '0001'
};

function clone(value) {
    return structuredClone(value);
}

function matches(row, filter) {
    return row && Object.entries(filter).every(([key, value]) => {
        const actual = row[key];
        if (value == null) return actual == null;
        if (value instanceof Date) {
            return new Date(actual).getTime() === value.getTime();
        }
        return String(actual) === String(value);
    });
}

function database(initial, fail = '') {
    let committed = clone(initial);
    let draft = null;
    let writes = 0;
    let ended = false;

    const session = {
        async withTransaction(work) {
            draft = clone(committed);
            try {
                await work();
                committed = draft;
            } finally {
                draft = null;
            }
        },
        async endSession() {
            ended = true;
        }
    };

    function query(read) {
        return {
            session(value) {
                assert.equal(value, session);
                return this;
            },
            async lean() {
                return clone(read());
            }
        };
    }

    const employeeModel = {
        findOne(filter) {
            return query(() => matches(draft.employee, filter) ? draft.employee : null);
        },
        async updateOne(filter, update, options) {
            assert.equal(options.session, session);
            writes += 1;
            if (!matches(draft.employee, filter)) return { matchedCount: 0 };
            Object.assign(draft.employee, clone(update.$set));
            return { matchedCount: 1 };
        }
    };

    const historyModel = {
        find(filter) {
            return query(() => draft.history.filter(row => matches(row, filter)));
        },
        async updateOne(filter, update, options) {
            assert.equal(options.session, session);
            writes += 1;
            if (fail === 'prior-close' && update.$set?.hmeromhnia_apoxorhshs) {
                throw new Error('prior close failed');
            }
            const row = draft.history.find(item => matches(item, filter));
            if (!row) return { matchedCount: 0 };
            Object.assign(row, clone(update.$set));
            return { matchedCount: 1 };
        },
        async create([record], options) {
            assert.equal(options.session, session);
            writes += 1;
            if (fail === 'new-history') throw new Error('new history failed');
            const row = {
                _id: `history-${draft.history.length + 1}`,
                ...clone(record)
            };
            draft.history.push(row);
            return [row];
        }
    };

    return {
        deps: {
            connection: {
                async startSession() {
                    return session;
                }
            },
            capabilityProbe: async () => true,
            employeeModel,
            historyModel
        },
        state: () => clone(committed),
        writes: () => writes,
        ended: () => ended
    };
}

function initialClosed() {
    return {
        employee: {
            _id: 'employee-1',
            ...scope,
            archived: false,
            energos: false,
            hmeromhnia_proslhpshs: '2025-01-01',
            hmeromhnia_apoxorhshs: '2026-07-31',
            hmeromhnia_allaghs_symbashs: '2025-01-01',
            hmeromhnia_allaghs_orarioy_apo: '2025-01-01',
            hmeromhnia_isxyos_oron_ergasias_apo: '2025-01-01'
        },
        history: [
            {
                _id: 'history-old',
                ...scope,
                aa_eggrafhs: '0001',
                archived: false,
                hmeromhnia_proslhpshs: '2025-01-01',
                hmeromhnia_apoxorhshs: '2026-07-31',
                hmeromhnia_allaghs_symbashs: '2025-01-01',
                hmeromhnia_allaghs_orarioy_apo: '2025-01-01',
                hmeromhnia_isxyos_oron_ergasias_apo: '2025-01-01',
                hmeromhnia_isxyos_oron_ergasias_eos: null,
                afora_proslhpsh: true
            }
        ]
    };
}

function dateKey(value) {
    return value == null ? null : new Date(value).toISOString().slice(0, 10);
}

test('rehire atomically closes old relationship at departure and appends new cycle', async () => {
    const db = database(initialClosed());

    const result = await writeEmployeeRehire({
        ...db.deps,
        scope,
        employeeId: 'employee-1',
        rehireDate: '2026-09-17',
        employeeChanges: {
            hmeres_ergasias_ebdomadas: 5,
            ores_ergasias_ebdomadas: 40,
            mo_oron_hmerhsias_ergasias: 8,
            pososto_prosayxhshs_6hs_hmeras: 40
        }
    });

    const stored = db.state();
    assert.equal(result.cycle_no, 2);
    assert.equal(result.rehire_date, '2026-09-17');
    assert.equal(stored.history.length, 2);

    assert.equal(dateKey(stored.history[0].hmeromhnia_proslhpshs), '2025-01-01');
    assert.equal(dateKey(stored.history[0].hmeromhnia_apoxorhshs), '2026-07-31');
    assert.equal(
        dateKey(stored.history[0].hmeromhnia_isxyos_oron_ergasias_eos),
        '2026-07-31'
    );

    assert.equal(dateKey(stored.employee.hmeromhnia_proslhpshs), '2026-09-17');
    assert.equal(stored.employee.hmeromhnia_apoxorhshs ?? null, null);
    assert.equal(stored.employee.energos, true);

    const newest = stored.history[1];
    assert.equal(dateKey(newest.hmeromhnia_proslhpshs), '2026-09-17');
    assert.equal(newest.hmeromhnia_apoxorhshs ?? null, null);
    assert.equal(dateKey(newest.hmeromhnia_isxyos_oron_ergasias_apo), '2026-09-17');
    assert.equal(newest.hmeromhnia_isxyos_oron_ergasias_eos ?? null, null);
    assert.equal(newest.afora_proslhpsh, true);
    assert.equal(newest.aa_eggrafhs, '0002');

    assert.equal(db.ended(), true);
});

test('new-history failure rolls back both old-history closure and master update', async () => {
    const initial = initialClosed();
    const db = database(initial, 'new-history');

    await assert.rejects(
        writeEmployeeRehire({
            ...db.deps,
            scope,
            employeeId: 'employee-1',
            rehireDate: '2026-09-17'
        }),
        /new history failed/
    );

    assert.deepEqual(db.state(), initial);
    assert.equal(db.ended(), true);
});

test('failure while closing previous relationship rolls back with no partial rehire', async () => {
    const initial = initialClosed();
    const db = database(initial, 'prior-close');

    await assert.rejects(
        writeEmployeeRehire({
            ...db.deps,
            scope,
            employeeId: 'employee-1',
            rehireDate: '2026-09-17'
        }),
        /prior close failed/
    );

    assert.deepEqual(db.state(), initial);
    assert.equal(db.ended(), true);
});

test('open current relationship is rejected before any write', async () => {
    const initial = initialClosed();
    initial.employee.hmeromhnia_apoxorhshs = null;
    initial.employee.energos = true;
    initial.history[0].hmeromhnia_apoxorhshs = null;
    const db = database(initial);

    await assert.rejects(
        writeEmployeeRehire({
            ...db.deps,
            scope,
            employeeId: 'employee-1',
            rehireDate: '2026-09-17'
        }),
        error => error.code === 'EMPLOYEE_REHIRE_CURRENT_RELATIONSHIP_OPEN'
    );

    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initial);
});

test('unavailable transactions never fall back to partial writes', async () => {
    const db = database(initialClosed());

    await assert.rejects(
        writeEmployeeRehire({
            ...db.deps,
            capabilityProbe: async () => false,
            scope,
            employeeId: 'employee-1',
            rehireDate: '2026-09-17'
        }),
        error => error.code === 'EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE'
    );

    assert.equal(db.writes(), 0);
    assert.deepEqual(db.state(), initialClosed());
});

test('a third relationship appends cycle 3 without changing cycle 1', async () => {
    const initial = {
        employee: {
            _id: 'employee-1',
            ...scope,
            archived: false,
            energos: false,
            hmeromhnia_proslhpshs: '2026-09-17',
            hmeromhnia_apoxorhshs: '2026-12-31',
            hmeromhnia_allaghs_symbashs: '2026-09-17',
            hmeromhnia_allaghs_orarioy_apo: '2026-09-17',
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-17'
        },
        history: [
            {
                _id: 'cycle-1',
                ...scope,
                aa_eggrafhs: '0001',
                hmeromhnia_proslhpshs: '2025-01-01',
                hmeromhnia_apoxorhshs: '2026-07-31',
                hmeromhnia_allaghs_symbashs: '2025-01-01',
                hmeromhnia_allaghs_orarioy_apo: '2025-01-01',
                hmeromhnia_isxyos_oron_ergasias_apo: '2025-01-01',
                hmeromhnia_isxyos_oron_ergasias_eos: '2026-07-31',
                afora_proslhpsh: true
            },
            {
                _id: 'cycle-2',
                ...scope,
                aa_eggrafhs: '0002',
                hmeromhnia_proslhpshs: '2026-09-17',
                hmeromhnia_apoxorhshs: '2026-12-31',
                hmeromhnia_allaghs_symbashs: '2026-09-17',
                hmeromhnia_allaghs_orarioy_apo: '2026-09-17',
                hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-17',
                hmeromhnia_isxyos_oron_ergasias_eos: null,
                afora_proslhpsh: true
            }
        ]
    };
    const cycleOneBefore = clone(initial.history[0]);
    const db = database(initial);

    const result = await writeEmployeeRehire({
        ...db.deps,
        scope,
        employeeId: 'employee-1',
        rehireDate: '2027-02-01'
    });

    assert.equal(result.cycle_no, 3);
    assert.equal(db.state().history.length, 3);
    assert.deepEqual(db.state().history[0], cycleOneBefore);
    assert.equal(
        dateKey(db.state().history[1].hmeromhnia_isxyos_oron_ergasias_eos),
        '2026-12-31'
    );
    assert.equal(dateKey(db.state().history[2].hmeromhnia_proslhpshs), '2027-02-01');
});

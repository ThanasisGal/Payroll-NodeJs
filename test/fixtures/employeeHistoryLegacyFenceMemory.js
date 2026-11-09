'use strict';
// The existing snapshot/transaction store, with database-shaped read adapters.
// No MongoDB client, environment configuration or CI guard is involved.
const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const { Types } = require('mongoose');
function createLegacyFenceMemory() {
    const fixture = require('./employeeHistoryCoordinatedSettlementFixture').acceptanceB();
    const scope = { team: 'THA', company_kod: '507f1f77bcf86cd799439011', kodikos: fixture.scope.kodikos };
    const employeeId = '507f1f77bcf86cd799439012', actorUserId = '507f1f77bcf86cd799439013';
    const references = [], ids = new Map(fixture.completeHistoryRows.map((row, i) =>
        [String(row._id), new Types.ObjectId('507f1f77bcf86cd79943902' + i)]));
    for (const [historyId, refs] of Object.entries(fixture.protectedReferenceSummary))
        for (const ref of refs) references.push({ ...S.clone(ref), historyId: String(ids.get(historyId)) });
    const employee = { ...fixture.currentEmployee, ...scope, _id: new Types.ObjectId(employeeId) };
    const history = fixture.completeHistoryRows.map(row => ({ ...row, ...scope, _id: ids.get(String(row._id)) }));
    const db = require('./employeeProfileTransactionStore').store([{ employee, history }], { cloneFn: S.clone });
    const { connection, employeeModel, historyModel } = db.deps;
    connection.db = { admin: () => ({ command: async () => ({ setName: 'MEMORY_ONLY', logicalSessionTimeoutMinutes: 30 }) }) };
    connection.collection = collection => ({ async findOne(filter) {
        const wanted = filter.$or.flatMap(item => Object.values(item)[0].$in).map(String);
        const found = references.filter(ref => ref.collection === collection && wanted.includes(ref.historyId))
            .sort((a, b) => a.documentId.localeCompare(b.documentId))[0];
        return found ? { _id: found.documentId } : null;
    } });
    const state = session => session ? session.draft : db.state();
    const matches = (row, filter) => row && Object.entries(filter).every(([key, value]) =>
        String(key.split('.').reduce((item, field) => item?.[field], row)) === String(value));
    const query = read => ({ select() { return this; }, session(value) { this.s = value; return this; },
        read() { return this; }, readConcern() { return this; }, async lean() { return S.clone(read(this.s)); } });
    const receipts = new Map(), records = session => [...state(session).audits, ...receipts.values()];
    let failAudit = false;
    const auditModel = { db: connection,
        findById: id => query(session => records(session).find(row => String(row._id) === String(id)) || null),
        findOne: filter => query(session => records(session).find(row => matches(row, filter)) || null),
        async create(rows, options) {
            rows = rows.map(row => ({ ...S.clone(row), employeeScope: { ...row.employeeScope,
                employee_id: new Types.ObjectId(String(row.employeeScope.employee_id)) } }));
            if (options.session) {
                const result = await db.deps.auditModel.create(rows, options);
                if (failAudit) throw Error('SYNTHETIC_AUDIT_FAILURE');
                return result;
            }
            if (receipts.has(String(rows[0]._id))) throw Object.assign(Error('DUPLICATE_RECEIPT'), { code: 11000 });
            receipts.set(String(rows[0]._id), S.clone(rows[0])); return S.clone(rows);
        }
    };
    historyModel.collection = { find(filter, { session }) { return { sort() { return this; }, async toArray() {
        return S.clone(state(session).history.filter(row => matches(row, filter)))
            .sort((a, b) => String(a._id).localeCompare(String(b._id)));
    } }; } };
    let actor = { _id: new Types.ObjectId(actorUserId), team: 'THA', situation: 'A', privileges: 'A' };
    let permission = { admin: true, update: true };
    const userModel = { db: connection, findById: id => query(() => String(actor?._id) === String(id) ? actor : null) };
    const privilegeModel = { db: connection, findOne: () => query(() => ({ privileges: permission })) };
    const companyModel = { db: connection, findOne: filter => query(() =>
        filter._id === scope.company_kod && filter.team === scope.team ? { _id: scope.company_kod, team: scope.team } : null) };
    employeeModel.db = connection; historyModel.db = connection;
    const context = { legacyFenceEnabled: true, deps: { employeeModel, historyModel, auditModel, userModel, privilegeModel, companyModel } };
    const input = { connection, context, scope, employeeId, actorUserId };
    return { input, auditModel,
        async approvalInput() {
            const snapshot = db.state();
            return { scope, employeeId, actorUserId, currentEmployee: snapshot.employees[0], completeHistoryRows: snapshot.history,
                protectedReferenceSummary: await require('../../server/services/ergazomenoi/employeeHistoryLegacyFenceService')
                    .legacyFenceReferenceSummary(connection, snapshot.history) };
        },
        state: () => S.clone({ ...db.state(), receipts: [...receipts.values()], references }),
        failAudit(value = true) { failAudit = value; },
        changeActor(patch) { actor = { ...actor, ...patch }; },
        changePermission(value) { permission = value; },
        changeEmployee(patch) { db.changeCommittedEmployee(employeeId, patch); },
        changeHistory(id, patch) { db.changeCommittedHistory(id, patch); },
        changeReceipt(id, mutate) { mutate(receipts.get(String(id))); },
        changeReference() { references[0].documentId += '-changed'; }
    };
}
module.exports = { createLegacyFenceMemory };

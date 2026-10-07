'use strict';
const { fixture, scope, historyId } = require('./employeeProfileTransactionStore');
const { buildEmployeeHistoryEditorStateToken } = require('../../server/services/ergazomenoi/employeeHistoryEditorStateService');
const { identifyEmployeeHistoryProblemScope } = require('../../server/services/ergazomenoi/employeeHistoryProblemScopeService');
const supervisor = { privileges: 'S', team: 'BLG', situation: 'A' };
function userModel(user = supervisor, onRead = () => {}) {
    return { findById(id) {
        return { select(fields) { this.fields = fields; return this; },
            session(session) { this.activeSession = session; return this; },
            async lean() { onRead({ id, fields: this.fields, session: this.activeSession }); return user; } };
    } };
}
function problemFixture(id = 'employee', employeeScope = scope) {
    const initial = fixture(id, employeeScope);
    initial.history[0].hmeromhnia_isxyos_oron_ergasias_eos = null;
    return initial;
}
function snapshot(db, id = 'employee') {
    const state = db.state(), currentEmployee = state.employees.find(row => row._id === id);
    const historyRows = state.history.filter(row => ['team', 'company_kod', 'kodikos']
        .every(field => row[field] === currentEmployee[field]));
    return { currentEmployee, historyRows };
}
const token = (db, id) => buildEmployeeHistoryEditorStateToken(snapshot(db, id));
const problemScope = (db, id) => {
    const { currentEmployee, historyRows } = snapshot(db, id);
    return identifyEmployeeHistoryProblemScope({ scope: currentEmployee, currentEmployee, completeHistoryRows: historyRows });
};
function modify(id = historyId('employee', 0)) {
    return { state: 'modified', historyId: id,
        maintenance: { historyChanges: { hmeromhnia_lhxhs_symbashs: '2026-11-30' },
            employeeChanges: { hmeromhnia_lhxhs_symbashs: '2026-11-30' },
            submittedFields: ['hmeromhnia_lhxhs_symbashs'] } };
}
module.exports = { supervisor, userModel, problemFixture, snapshot, token, problemScope, modify };

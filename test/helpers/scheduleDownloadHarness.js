'use strict';

const { EventEmitter } = require('node:events');
const diagnostics = require('../../server/utils/erganh/scheduleDownloadDiagnostics');

function requestHarness(overrides = {}) {
    const entries = [];
    const req = { method: 'POST', path: '/ergazomenoi/programmata/downloadSchedule',
        session: { userId: 'synthetic-user', companyInUse: '507f1f77bcf86cd799439011',
            companyKodikos: 'TEST', companyDescription: 'synthetic-company',
            periodInUseDescr: 'Οκτώβριος', yearInUse: '2026' },
        authenticatedUserTeam: 'TEST', params: {},
        body: { selectedTeam: 'TEST', selectedCompany: '507f1f77bcf86cd799439011',
            fromDate: '01/10/2026', toDate: '31/10/2026', selectedPararthma: '0' },
        ...overrides };
    const res = Object.assign(new EventEmitter(), {
        statusCode: 200, headers: {}, body: null,
        setHeader(name, value) { this.headers[name] = value; },
        status(status) { this.statusCode = status; return this; },
        json(body) { this.body = body; this.emit('finish'); return this; },
        send(body) { this.body = body; this.emit('finish'); return this; }
    });
    const logger = Object.fromEntries(['info', 'warn', 'error'].map(level =>
        [level, (tag, details) => entries.push({ level, tag, details })]));
    diagnostics.createScheduleDownloadDiagnosticsMiddleware({ logger })(req, res, () => {});
    return { req, res, entries };
}

module.exports = { requestHarness };

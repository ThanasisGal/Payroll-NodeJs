'use strict';
const crypto = require('crypto');
const { canonicalize } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { SNAPSHOT_SCHEMA_VERSION } = require('./apasxoliseisPeriodFrozenSnapshotService');

function assertWtoDailyFrozenSnapshotVersion(snapshot) {
    if (snapshot?.snapshot_schema_version !== SNAPSHOT_SCHEMA_VERSION) {
        const error = new Error('Η frozen ταυτότητα εργαζομένων δεν ανήκει στο υποστηριζόμενο WTODayilyA snapshot schema.');
        error.code = 'WTODAILY_FROZEN_IDENTITY_VERSION_UNSUPPORTED'; error.statusCode = 409; throw error;
    }
    return snapshot;
}

function resolveWtoDailyRestIdentity(restResult, environment = process.env.ERGANI_ENV) {
    const code = String(restResult?.submission?.code || '').trim();
    const id = Number(restResult?.submission?.id);
    if (code !== 'WTODayilyA' || !Number.isInteger(id) || id <= 0) {
        const error = new Error('Το REST result δεν περιέχει valid resolved WTODayilyA submission identity.');
        error.code = 'WTODAILY_RESOLVED_SUBMISSION_INVALID'; error.statusCode = 502; throw error;
    }
    return Object.freeze({
        environment: String(environment || 'trial').trim().toLowerCase(),
        submission_code: code,
        submission_id: id
    });
}

function buildWtoDailyPayloadFingerprint({ team, company, branch, periodStart, periodEnd, payload }) {
    return crypto.createHash('sha256').update(JSON.stringify(canonicalize({
        team, company, branch, period_start: periodStart, period_end: periodEnd,
        submission_code: 'WTODayilyA', payload
    }))).digest('hex');
}

module.exports = { assertWtoDailyFrozenSnapshotVersion, resolveWtoDailyRestIdentity,
    buildWtoDailyPayloadFingerprint };

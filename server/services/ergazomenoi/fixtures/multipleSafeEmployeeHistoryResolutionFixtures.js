'use strict';

const { buildCompleteProfileSnapshot } =
    require('../../../utils/ergazomenoi/employmentProfileHistory');

const provenance = id => [{
    collection: 'Apasxoliseis_Period_Frozen_Snapshots',
    documentId: `synthetic-reference-${id}`
}];

function scopeFor(shape) {
    return { team: 'TEST', company_kod: `synthetic-${shape}`, kodikos: '0099' };
}

function profile({ id, scope, hire, start, end = null, days, hours, specialty = '0001',
    sequence, createdAt, scheduleStart = start, departure = null, baseEarnings = null,
    current = {} }) {
    const values = {
        ...current,
        hmeromhnia_proslhpshs: hire,
        hmeromhnia_allaghs_symbashs: start,
        hmeromhnia_allaghs_orarioy_apo: scheduleStart,
        hmeromhnia_allaghs_orarioy_eos: end,
        hmeromhnia_apoxorhshs: departure,
        hmeres_ergasias_ebdomadas: days,
        ores_ergasias_ebdomadas: hours,
        mo_oron_hmerhsias_ergasias: hours / days,
        eidikothta_symbashs: specialty,
        kathestos_apasxolhshs: days === 5 && hours === 40 ? '0' : '2',
        typos_apasxolhshs: '5',
        synolo_symbashs: 1000,
        synolo_symbashs_basei_oron_ergasias: baseEarnings ?? (1000 * hours) / 40,
        nomimosMisthos: 1000,
        pragmatikosMisthos: (1000 * hours) / 40
    };
    return {
        _id: id,
        ...scope,
        ...buildCompleteProfileSnapshot({ current: values, effectiveFrom: start }),
        ...values,
        aa_eggrafhs: String(sequence).padStart(4, '0'),
        createdAt: new Date(createdAt),
        updatedAt: new Date(createdAt),
        afora_proslhpsh: sequence === 1,
        afora_allagh_oron_ergasias: true,
        hmeromhnia_isxyos_oron_ergasias_apo: start,
        hmeromhnia_isxyos_oron_ergasias_eos: end
    };
}

function currentEmployee({ id, scope, row, departure = null, active = true }) {
    return {
        ...row,
        _id: id,
        ...scope,
        aa_eggrafhs: undefined,
        hmeromhnia_apoxorhshs: departure,
        energos: active,
        archived: false
    };
}

function summary(rows, referenced = true) {
    return Object.fromEntries(rows.map(row => [String(row._id), referenced
        ? provenance(row._id) : []]));
}

function samePeriodMateriallyDifferentProfilesFixture() {
    const scope = scopeFor('same-period-alternatives');
    const hire = '2026-06-25';
    const rows = [
        profile({ id: 'm1-initial', scope, hire, start: hire, end: '2026-06-26',
            days: 1, hours: 4, sequence: 1, createdAt: '2026-06-25T08:00:00Z' }),
        profile({ id: 'm1-two-day', scope, hire, start: '2026-06-27', end: '2026-07-05',
            days: 2, hours: 14, baseEarnings: 418.18, sequence: 2,
            createdAt: '2026-06-27T08:00:00Z' }),
        profile({ id: 'm1-four-day', scope, hire, start: '2026-06-27', end: '2026-07-05',
            scheduleStart: '2026-06-29', days: 4, hours: 30, baseEarnings: 896.10,
            sequence: 3, createdAt: '2026-06-29T08:00:00Z' }),
        profile({ id: 'm1-full-time', scope, hire, start: '2026-07-06', end: '2026-08-31',
            days: 5, hours: 40, sequence: 4, createdAt: '2026-07-06T08:00:00Z' }),
        profile({ id: 'm1-departure', scope, hire, start: '2026-07-06', end: '2026-08-31',
            departure: '2026-08-31', days: 5, hours: 40, sequence: 5,
            createdAt: '2026-09-01T08:00:00Z' })
    ];
    return {
        name: 'SAME_PERIOD_MATERIALLY_DIFFERENT_PROFILE_ALTERNATIVES',
        scope,
        currentEmployee: currentEmployee({ id: 'm1-employee', scope, row: rows[4],
            departure: '2026-08-31', active: false }),
        completeHistoryRows: rows,
        protectedReferenceSummary: summary(rows)
    };
}

function correctionFromHireOrSpecialtyChangeFixture() {
    const scope = scopeFor('specialty-correction-or-change');
    const hire = '2026-06-24';
    const rows = [
        profile({ id: '507f1f77bcf86cd799439211', scope, hire, start: hire, end: '2026-07-01',
            days: 5, hours: 40, specialty: '0003', sequence: 1,
            createdAt: '2026-06-24T08:00:00Z' }),
        profile({ id: '507f1f77bcf86cd799439212', scope, hire, start: hire,
            days: 5, hours: 40, specialty: '0004', sequence: 2,
            createdAt: '2026-07-06T08:00:00Z' })
    ];
    return {
        name: 'CORRECTION_FROM_HIRE_OR_REAL_SPECIALTY_CHANGE',
        scope,
        currentEmployee: currentEmployee({ id: 'm2-employee', scope, row: rows[1] }),
        completeHistoryRows: rows,
        protectedReferenceSummary: summary(rows, false)
    };
}

function optionalIntermediateProfileFixture() {
    const scope = scopeFor('optional-intermediate-profile');
    const hire = '2026-04-26';
    const rows = [
        profile({ id: 'm3-initial', scope, hire, start: hire, end: '2026-05-24',
            days: 1, hours: 8, sequence: 1, createdAt: '2026-04-26T08:00:00Z' }),
        profile({ id: 'm3-four-day', scope, hire, start: '2026-05-25', end: '2026-06-08',
            days: 4, hours: 32, sequence: 2, createdAt: '2026-05-25T08:00:00Z' }),
        profile({ id: 'm3-two-day', scope, hire, start: '2026-05-25', end: '2026-06-21',
            scheduleStart: '2026-06-02', days: 2, hours: 16, sequence: 3,
            createdAt: '2026-06-02T08:00:00Z' }),
        profile({ id: 'm3-three-day', scope, hire, start: '2026-06-09', end: '2026-06-21',
            days: 3, hours: 24, sequence: 4, createdAt: '2026-06-09T08:00:00Z' }),
        profile({ id: 'm3-full-time', scope, hire, start: '2026-06-22', end: '2026-09-15',
            days: 5, hours: 40, sequence: 5, createdAt: '2026-06-22T08:00:00Z' }),
        profile({ id: 'm3-departure', scope, hire, start: '2026-06-22', end: '2026-09-15',
            departure: '2026-09-15', days: 5, hours: 40, sequence: 6,
            createdAt: '2026-09-16T08:00:00Z' })
    ];
    return {
        name: 'OPTIONAL_REAL_INTERMEDIATE_TWO_DAY_PROFILE',
        scope,
        currentEmployee: currentEmployee({ id: 'm3-employee', scope, row: rows[5],
            departure: '2026-09-15', active: false }),
        completeHistoryRows: rows,
        protectedReferenceSummary: summary(rows)
    };
}

function realStartOfFourDayProfileFixture() {
    const scope = scopeFor('four-day-profile-start');
    const hire = '2026-06-27';
    const rows = [
        profile({ id: 'm4-two-day', scope, hire, start: hire, end: '2026-07-22',
            days: 2, hours: 16, sequence: 1, createdAt: '2026-06-27T08:00:00Z' }),
        profile({ id: 'm4-four-day', scope, hire, start: hire, scheduleStart: '2026-07-13',
            days: 4, hours: 34, sequence: 2, createdAt: '2026-07-13T08:00:00Z' }),
        profile({ id: 'm4-full-time', scope, hire, start: '2026-07-23',
            days: 5, hours: 40, sequence: 3, createdAt: '2026-07-23T08:00:00Z' })
    ];
    return {
        name: 'REAL_START_DATE_OF_FOUR_DAY_PROFILE',
        scope,
        currentEmployee: currentEmployee({ id: 'm4-employee', scope, row: rows[2] }),
        completeHistoryRows: rows,
        protectedReferenceSummary: summary(rows)
    };
}

module.exports = {
    provenance,
    samePeriodMateriallyDifferentProfilesFixture,
    correctionFromHireOrSpecialtyChangeFixture,
    optionalIntermediateProfileFixture,
    realStartOfFourDayProfileFixture
};

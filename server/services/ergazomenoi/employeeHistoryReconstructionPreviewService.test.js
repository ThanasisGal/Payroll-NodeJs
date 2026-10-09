'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const { IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const L = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const P = require('./employeeHistoryReconstructionPreviewService');
const { planEmployeeHistoryAutomaticReconstruction: plan } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const F = require('./fixtures/automaticEmployeeHistoryReconstructionFixtures');
const preview = input => P.buildEmployeeHistoryReconstructionPreview({ plan: plan(input), completeHistoryRows: input.completeHistoryRows });

test('all 118 schema fields have an explicit display/exclusion decision and all 105 business fields have Greek labels', () => {
    const hidden = [...C.FIELD_GROUPS.IDENTITY_PROTECTED.filter(f => f !== 'aa_eggrafhs'),
        ...C.FIELD_GROUPS.CANONICAL_METADATA, ...C.FIELD_GROUPS.INTERNAL_MONGOOSE];
    assert.deepEqual([...P.DISPLAY_FIELDS, ...hidden].sort(), Object.keys(IstorikoProslhpseonAllagonModel.schema.paths).sort());
    assert.equal(P.DISPLAY_FIELDS.length, 105);
    for (const field of P.DISPLAY_FIELDS) assert.match(L[field], /[Α-Ωα-ω]/u, field);
    const dto = preview(F.caseA());
    assert.equal(dto.originalRows[0].groups.flatMap(group => group.fields).length, 105);
    assert.deepEqual(dto.originalRows[0].groups.map(group => group.title), P.GROUP_TITLES);
});

test('schedule dates are visible and explicitly informational, never evidence or proposed changes', () => {
    const dto = preview(F.caseA());
    const schedule = dto.originalRows[0].groups.flatMap(group => group.fields).filter(field => field.informational);
    assert.equal(schedule.length, 2);
    for (const field of schedule) assert.equal(field.note, P.INFORMATIONAL_NOTE);
    assert.ok(!dto.changes.some(change => /Ωραρίου Από|Ωραρίου Έως/.test(change.field)));
    const modified = F.caseA();
    modified.completeHistoryRows.forEach(row => { row.hmeromhnia_allaghs_orarioy_apo = '2040-01-01'; });
    const second = preview(modified);
    assert.deepEqual(second.periods, dto.periods);
    assert.deepEqual(second.changes, dto.changes);
    assert.deepEqual(second.attention, dto.attention);
});

test('meaningful changes precede exact numeric-zero defaults grouped by public row label', () => {
    for (const [factory, count, rows] of [[F.caseA, 86, 2], [F.caseB, 129, 3]]) {
        const dto = preview(factory());
        assert.equal(dto.summary.numericDefaults, count);
        assert.equal(dto.defaultGroups.length, rows);
        assert.ok(dto.defaultGroups.every(group => group.count === 43));
        assert.equal(dto.defaultGroups.flatMap(group => group.changes).length, count);
        assert.ok(dto.defaultGroups.flatMap(group => group.changes).every(change => change.after === '0' && change.confidence === 'Προεπιλογή'));
        assert.ok(dto.changes.every(change => change.confidence !== 'Προεπιλογή'));
        assert.match(dto.changes[0].field, /Ισχύος Όρων/);
    }
});

test('public DTO omits every raw identity, planner token, internal code, protected field and unrelated PII', () => {
    const input = F.caseBWithProfileEvidence();
    input.currentEmployee.afm = 'PRIVATE_TAX_SENTINEL';
    input.completeHistoryRows.forEach((row, index) => {
        row._id = new Types.ObjectId(`507f1f77bcf86cd7994390${index}1`);
        row.history_reference_fence = 'PRIVATE_FENCE_SENTINEL';
        row.createdAt = new Date('2000-01-01');
        row.employment_profile_source = 'PRIVATE_SOURCE_SENTINEL';
    });
    const result = plan(input);
    const dto = P.buildEmployeeHistoryReconstructionPreview({ plan: result, completeHistoryRows: input.completeHistoryRows });
    const json = JSON.stringify(dto);
    assert.doesNotMatch(json, /\b[a-f\d]{24}\b|PRIVATE_|_id|ObjectId|fingerprint|sourceHistoryId|schema|canonical|fence|rowDiff|diagnostics|SAME_DATE_NON_EMPTY_CONFLICT|APPLICATION_ASSUMPTION|REVIEW_REQUIRED/i);
    assert.ok(!json.includes(result.semanticFingerprint));
    for (const field of P.DISPLAY_FIELDS) assert.ok(!json.includes(`"${field}"`), field);
});

test('unexpected objects and identity-shaped string values are never dumped to the browser', () => {
    assert.equal(P.formatValue('symbash', new Types.ObjectId()), 'Μη διαθέσιμη περιγραφή');
    assert.equal(P.formatValue('symbash', { private: 'SECRET' }), 'Μη διαθέσιμη περιγραφή');
    assert.equal(P.formatValue('symbash', '507f1f77bcf86cd799439011'), 'Μη διαθέσιμη περιγραφή');
});

test('same-period conflict explains original values, selected value and public row labels in Greek', () => {
    const dto = preview(F.caseBWithProfileEvidence());
    assert.equal(dto.status, 'review');
    assert.equal(dto.summary.assumptions, 1);
    assert.match(dto.attention[0].message, /διαφορετικές τιμές.*ΚΠΚ.*προτείνει 0115/);
    assert.ok(dto.attention[0].message.includes('0111'));
    assert.ok(dto.attention[0].message.includes('0115'));
    const conflict = dto.changes.find(change => change.field.includes('ΚΠΚ'));
    assert.equal(conflict.before, '0111');
    assert.equal(conflict.after, '0115');
    assert.equal(conflict.source, 'Υπόθεση Εφαρμογής');
    assert.equal(conflict.confidence, 'Χρειάζεται Έλεγχο');
});

test('NO_OP and empty History return normal Greek unchanged states', () => {
    const input = F.caseA();
    input.completeHistoryRows = plan(input).proposedRows;
    const dto = preview(input);
    assert.equal(dto.status, 'unchanged');
    assert.equal(dto.message, 'Το Ιστορικό δεν χρειάζεται τακτοποίηση.');
    assert.equal(dto.summary.changes, 0);
    input.completeHistoryRows = [];
    assert.equal(preview(input).status, 'unchanged');
});

test('BLOCKED technical and absent-baseline states preserve original rows without leaking reasons', () => {
    for (const mutate of [
        input => { input.completeHistoryRows[1]._id = input.completeHistoryRows[0]._id; },
        input => { delete input.currentEmployee[C.HIRE]; input.completeHistoryRows.forEach(row => {
            for (const field of [C.HIRE, C.START, C.CHANGE]) delete row[field];
        }); }
    ]) {
        const input = F.caseA(); mutate(input);
        const dto = preview(input);
        assert.equal(dto.status, 'unavailable');
        assert.equal(dto.originalRows.length, 2);
        assert.equal(dto.summary.changes, 0);
        assert.match(dto.message, /Δεν ήταν δυνατό.*Δεν έχει αποθηκευτεί.*\n1\..*\n2\./s);
        assert.doesNotMatch(JSON.stringify(dto), /BLOCKED|INVALID_OR|NO_TEMPORAL/);
    }
});

test('formatting preserves false/zero, empty facts, calendar dates and meaningful weekday names', () => {
    assert.equal(P.formatValue('synexes_diakekomeno', false), 'Συνεχές');
    assert.equal(P.formatValue('synexes_diakekomeno', true), 'Διακεκομμένο');
    assert.equal(P.formatValue('dialleima_entos_ektos_orarioy', true), 'Εντός Ωραρίου');
    assert.equal(P.formatValue('typos_orarioy', false), 'Σταθερό');
    assert.equal(P.formatValue('afora_proslhpsh', false), 'Όχι');
    assert.equal(P.formatValue('pragmatikosMisthos', 0), '0');
    assert.equal(P.formatValue(C.START, '2026-04-24'), '24/04/2026');
    assert.equal(P.formatValue(C.START, 'not-a-date'), 'Μη έγκυρη ημερομηνία');
    assert.equal(P.formatValue('symbash', undefined), 'Δεν έχει καταχωριστεί');
    assert.equal(P.formatValue('hmeres_efarmoghs_egkekrimenhs_rythmishs', [1, 7]), 'Δευτέρα, Κυριακή');
});

for (const count of [1, 3, 20]) test(`${count} History rows project completely without mutation and within a practical time`, () => {
    const input = F.caseA();
    input.completeHistoryRows = Array.from({ length: count }, (_, i) => F.row(String(i).padStart(4, '0'), {
        [C.HIRE]: '2026-04-24', [C.START]: `2026-05-${String(i + 1).padStart(2, '0')}`, ...F.workTerms }));
    const before = structuredClone(input), started = performance.now();
    const dto = preview(input);
    assert.equal(dto.originalRows.length, count);
    assert.equal(dto.periods.length, count);
    assert.deepEqual(input, before);
    assert.ok(performance.now() - started < 3000);
});

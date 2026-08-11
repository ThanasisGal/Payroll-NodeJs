'use strict';

const assert = require('assert');
const {
    LEAVE_PROVENANCE,
    classifyLeaveProvenance
} = require('./apasxoliseisLeaveProvenanceService');

const declaredWork = {
    kathgoria_ergasias: 'ΕΡΓ',
    ores_ergasias: 8,
    repo_apologistika: false,
    astheneia: false,
    astheneia_apologistika: false
};

const atlasCardRows = [
    { date: '2026-06-01', cards_ores_ergasias: 8.166666666666666, ores_apoysias: 0.33 },
    { date: '2026-06-05', cards_ores_ergasias: 7.55, ores_apoysias: 0.95 },
    { date: '2026-06-06', cards_ores_ergasias: 8.283333333333333, ores_apoysias: 0.22 },
    { date: '2026-06-07', cards_ores_ergasias: 8.166666666666666, ores_apoysias: 0.33 }
];

for (const fixture of atlasCardRows) {
    assert.strictEqual(
        classifyLeaveProvenance({
            ...declaredWork,
            ...fixture,
            adeia: false,
            adeia_apologistika: false,
            kathgoria_adeias: '',
            kathgoria_adeias_apologistika: ''
        }),
        LEAVE_PROVENANCE.NONE,
        `${fixture.date}: residual absence without confirmed leave must not become HR leave`
    );
}

assert.strictEqual(
    classifyLeaveProvenance({
        ...declaredWork,
        cards_ores_ergasias: 0,
        adeia_apologistika: false,
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE'
    }),
    LEAVE_PROVENANCE.POSSIBLE_LEAVE,
    'persisted POSSIBLE_LEAVE must remain distinct from confirmed leave'
);

for (const confirmed of [
    { adeia: true },
    { kathgoria_adeias: 'ΚΑΝΟΝΙΚΗ' },
    { hr_declared_leave: true }
]) {
    assert.strictEqual(
        classifyLeaveProvenance({
            ...declaredWork,
            cards_ores_ergasias: 7.5,
            ...confirmed
        }),
        LEAVE_PROVENANCE.HR_DECLARED_LEAVE,
        'explicit confirmed leave evidence must remain authoritative even with card evidence'
    );
}

console.log('PASS leave provenance: residual absence, possible leave, and confirmed leave');

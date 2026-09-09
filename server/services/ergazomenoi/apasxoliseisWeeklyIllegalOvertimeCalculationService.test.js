'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const service = require('./apasxoliseisWeeklyIllegalOvertimeCalculationService');
// Immutable baseline: controller at 45b046b33e209f26be59cba6a634db4800f86519.
// No Git checkout/history is needed to verify source and behavioral parity.
const SOURCE_HASHES = {
    "timeToMinutesSafe": "c35a43318ec1c078042e0a203e7e6da68e3aefcec69351b918ace27383bc6bf0",
    "minutesToTimeSafe": "b247f083f9d1120e94f9c7382a91dbb5b38d8e23e8d1469905af4f06f4177b4e",
    "hasTime": "437731daaae2d20c1405b0f0266817e49f925e725acc19b04105e7caf5468da1",
    "addDaysUtc": "297b24ab69c9f22952be0b0d9070302de9ead046c3ef9668f820eee6562db14d",
    "dateKeyUtc": "8757b05263e5c01dd00b6cbaa01450c7a4bdb082980f2c40bf511f111eff390d",
    "isSundayOrHoliday": "536d340667566c65c0f9e68ee1777d8669a8b98819eb57e5ef8d85cab1f8d763",
    "getBreakOffsetMinutes": "b04bc2baf2bc28ad4edf35935ee5555a3bdf23b99811bbef50f626a3d539e089",
    "isDeclaredContinuousSchedule": "fa6ec3066701147599bb7c7afaa280aa0417dfe1272e7d9a07de725a107f1c0b",
    "isCardsContinuousSchedule": "97bf83822eea66e5f3595eee91a45661e4c0da1985d5dbbbbea02646d1acd91e",
    "isZeroLengthTimePair": "dba83228844b56877eaf5b0dcf58c93ee33bbad2e7d221a194610ec4aa59a37f",
    "getRawCardIntervals": "3f37d7c026a2e5ee67c166761d0e7613e9951e56b78df8599a3d9414e14de406",
    "getRawDailyCardsMinutes": "d72f3c29a73a00bb1c0cd0a4ccb192c344253414e3227fcc441ac995c2b8ae93",
    "shouldSubtractExternalBreak": "bc2bb6ba65a07a6532218c6d8b8cd3bbac89e8a58ec21439485cdfe0a1391612",
    "expandIntervalFromTimes": "90cf58800b5d55cdd8c29378f6feeb7a522c7916d2724b6340a3ffe5e041d2a2",
    "emptyClassifiedMinutes": "88e6c3b98c9e70f51005883e2059857fe9d1efd56c93b4cc44aefce7fab739e3",
    "addClassifiedMinute": "ae68e6d2babfdb591b909f5b91d1ed61157c634705a03e930c26db7fb592bf30",
    "toHours": "ef92a450b5da6f6d83a3f4b775c9e54b9846483e6b8e44bcae5590721aa33a09",
    "buildWeeklyIllegalOvertimeUpdate": "d2dfbeac70c5fcd76df5c4a87164980f28bf9ca644a75893e1723b3608330c94",
    "getCardIntervals": "413abb10426f1e569b2628d33a08091f441b81c0cee20085f4f67073c744484e",
    "isMinuteNight": "5e832a7ed7bd6e29f8deb2b568fd150675e2e39a4559317b2e50fa9f367e7b62",
    "isMinuteSundayOrHoliday": "a28b0a5d0eee062101ac7142fd10d2afdd687134a5e9fd4012a793eae456cd0e",
    "getApologistikaIntervals": "ae1ca7310596193cd5338390495fbecbecf2ed09326f67d815bce35e7fdd4612",
    "getPayrollCalculationIntervals": "22b25e08d14a6425ba78b85a55e8af7d7484865f0dcdf1efbd32c8e56ed1c416"
};
const VECTOR_HASHES = {
    "exact legacy parity 2026-04-03 12:30-17:59": "50719fa788265bea5601d10acf5455b785a0127394f2fb143dd94b1237edb07e",
    "exact legacy parity 2026-04-03 22:00-06:00": "ad8bfe1ac814a1894a0ba023df95cee466cac79e5129b3de669bd8a08983d91d",
    "exact legacy parity 2026-04-03 21:59-06:01": "194ac2e33c7649408536fe4845b43257a32b9c67317c9f2314937729954d7c3d",
    "exact legacy parity 2026-04-03 00:00-00:00": "86b17d2b4a72d540545d14b774afb8cde558484deebb203f8f0b7bd6293ab0ee",
    "exact legacy parity 2026-04-03 -": "50719fa788265bea5601d10acf5455b785a0127394f2fb143dd94b1237edb07e",
    "exact legacy parity 2026-04-03 12:30-": "86b17d2b4a72d540545d14b774afb8cde558484deebb203f8f0b7bd6293ab0ee",
    "exact legacy parity 2026-04-03 07:00-11:00": "50719fa788265bea5601d10acf5455b785a0127394f2fb143dd94b1237edb07e",
    "exact legacy parity 2026-04-03 07:00-11:29": "50719fa788265bea5601d10acf5455b785a0127394f2fb143dd94b1237edb07e",
    "exact legacy parity 2026-04-03 07:00-11:30": "50719fa788265bea5601d10acf5455b785a0127394f2fb143dd94b1237edb07e",
    "exact legacy parity 2026-04-04 12:30-17:59": "50719fa788265bea5601d10acf5455b785a0127394f2fb143dd94b1237edb07e",
    "exact legacy parity 2026-04-04 22:00-06:00": "e74ec865188374f029cf494826dc8d797d75bf5b439c801a339a7ed621a19670",
    "exact legacy parity 2026-04-04 21:59-06:01": "59edeffcb1b9215c7302d18606846fde98ab08e981f7d5f3deb9f7de13458288",
    "exact legacy parity 2026-04-04 00:00-00:00": "86b17d2b4a72d540545d14b774afb8cde558484deebb203f8f0b7bd6293ab0ee",
    "exact legacy parity 2026-04-04 -": "50719fa788265bea5601d10acf5455b785a0127394f2fb143dd94b1237edb07e",
    "exact legacy parity 2026-04-04 12:30-": "86b17d2b4a72d540545d14b774afb8cde558484deebb203f8f0b7bd6293ab0ee",
    "exact legacy parity 2026-04-04 07:00-11:00": "50719fa788265bea5601d10acf5455b785a0127394f2fb143dd94b1237edb07e",
    "exact legacy parity 2026-04-04 07:00-11:29": "50719fa788265bea5601d10acf5455b785a0127394f2fb143dd94b1237edb07e",
    "exact legacy parity 2026-04-04 07:00-11:30": "50719fa788265bea5601d10acf5455b785a0127394f2fb143dd94b1237edb07e",
    "exact legacy parity 2026-04-05 12:30-17:59": "04fcff93c9af88466add7d97a39068f489f0a73453ef7eacb6f5c2bab8f2f79d",
    "exact legacy parity 2026-04-05 22:00-06:00": "327ea47c2a0987c9c152f16016c8b03b4b1064f9555bfeb78f83a3ce12a48c3f",
    "exact legacy parity 2026-04-05 21:59-06:01": "90221445dc642b0ca47c205704daa896f849ad17232b2e971c48fea0a614f11d",
    "exact legacy parity 2026-04-05 00:00-00:00": "52c1508e68627f75c85a276d4d1efa617525803912ac58fccca3f38b068666be",
    "exact legacy parity 2026-04-05 -": "04fcff93c9af88466add7d97a39068f489f0a73453ef7eacb6f5c2bab8f2f79d",
    "exact legacy parity 2026-04-05 12:30-": "52c1508e68627f75c85a276d4d1efa617525803912ac58fccca3f38b068666be",
    "exact legacy parity 2026-04-05 07:00-11:00": "04fcff93c9af88466add7d97a39068f489f0a73453ef7eacb6f5c2bab8f2f79d",
    "exact legacy parity 2026-04-05 07:00-11:29": "04fcff93c9af88466add7d97a39068f489f0a73453ef7eacb6f5c2bab8f2f79d",
    "exact legacy parity 2026-04-05 07:00-11:30": "04fcff93c9af88466add7d97a39068f489f0a73453ef7eacb6f5c2bab8f2f79d",
    "exact extraction parity for multiple, overnight and partially verified slots": "7bead52fb15e9c9bd5def5e1e6ba58fbb7c419436aff5d6ce500bd0d88325c54"
};
// Οι τέσσερις χρονικές περιπτώσεις αλλάζουν από τη νέα θέση του διαλείμματος
// και τη συνεπή τοποθέτηση διαδοχικών καρτών μετά τα μεσάνυχτα.
// Τα υπόλοιπα ιστορικά αποτυπώματα διατηρούνται αμετάβλητα.
const TEMPORAL_POLICY_HASHES = {
    'exact legacy parity 2026-04-03 21:59-06:01': '31c08e074d2984faa17d291b054115ee1374327f643699fc04d11f9190cba56a',
    'exact legacy parity 2026-04-04 21:59-06:01': '38a417e464b2d024b85d1963910238b4d2d2ecd0e4e5a67fa9e6dde85c7c7690',
    'exact legacy parity 2026-04-05 21:59-06:01': 'a22a581c7b5abf8d37664d34ddcbe91d4ecc7c64d0b36cedfdc9ec9be36dc99d',
    'exact extraction parity for multiple, overnight and partially verified slots': 'fb54c630ebfc0e2d6e757733cc2d59b96612c378196ddfa64114648a9eefabbe'
};
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
test('unchanged extracted function bodies match immutable production baseline', () => {
    const names = Object.keys(service).filter((name) => typeof service[name] === 'function').sort();
    assert.deepEqual(names, Object.keys(SOURCE_HASHES).sort());
    // Μόνο οι επιλυτές διαλείμματος άλλαξαν. Όρια και ταξινομητές παραμένουν αμετάβλητοι.
    const temporalSelectors = new Set(['getCardIntervals', 'getPayrollCalculationIntervals', 'shouldSubtractExternalBreak']);
    for (const name of names.filter(name => !temporalSelectors.has(name))) {
        assert.equal(sha256(service[name].toString().replace(/\r\n/g, '\n')), SOURCE_HASHES[name], name);
    }
});
const fixtures = [
    ['12:30', '17:59'], ['22:00', '06:00'], ['21:59', '06:01'], ['00:00', '00:00'],
    ['', ''], ['12:30', ''], ['07:00', '11:00'], ['07:00', '11:29'], ['07:00', '11:30']
];
for (const day of ['2026-04-03', '2026-04-04', '2026-04-05']) {
    for (const [start, end] of fixtures) test(`exact legacy parity ${day} ${start}-${end}`, () => {
        const outputs = [];
        for (const holiday of [false, true]) for (const breakMinutes of [0, 30]) {
            for (const approved of [false, true]) for (const hours of [0, 0.01, 1.23, 4.98, 10]) {
                const row = { hmeromhnia: day, apo_ora_01: '12:30', eos_ora_01: '19:10',
                    cards_apo_ora_01: start, cards_eos_ora_01: end,
                    apo_ora_01_apologistika: '12:30', eos_ora_01_apologistika: '19:10',
                    ...(approved ? { orphan_card_resolution: { status: 'HR_APPROVED' } } : {}) };
                const before = structuredClone(row);
                const args = [row, { dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: breakMinutes }, hours,
                    new Set(holiday ? [day] : []), { clearOverlappingLegal: true }];
                outputs.push(service.buildWeeklyIllegalOvertimeUpdate(...args));
                assert.deepEqual(row, before);
            }
        }
        const key = `exact legacy parity ${day} ${start}-${end}`;
        assert.equal(sha256(JSON.stringify(outputs)), TEMPORAL_POLICY_HASHES[key] || VECTOR_HASHES[key]);
    });
}

test('exact extraction parity for multiple, overnight and partially verified slots', () => {
    const outputs = [];
    for (const secondEnd of ['', '02:30', '23:50']) for (const thirdEnd of ['', '06:00']) {
        const row = { hmeromhnia: '2026-04-04', apo_ora_01: '08:00', eos_ora_01: '12:00',
            cards_apo_ora_01: '08:00', cards_eos_ora_01: '12:00',
            cards_apo_ora_02: '22:00', cards_eos_ora_02: secondEnd,
            cards_apo_ora_03: '04:00', cards_eos_ora_03: thirdEnd };
        for (const hours of [1.23, 4.98, 10]) {
            const args = [row, { dialleima_se_lepta: 30 }, hours, new Set(['2026-04-04'])];
            outputs.push(service.buildWeeklyIllegalOvertimeUpdate(...args));
        }
    }
    assert.equal(sha256(JSON.stringify(outputs)), TEMPORAL_POLICY_HASHES['exact extraction parity for multiple, overnight and partially verified slots']);
});

test('το τελευταίο λεπτό 06:00–06:01 παραμένει ημερήσιο αντί να περικοπεί από το διάλειμμα', () => {
    const rec = { hmeromhnia: '2026-04-04', cards_apo_ora_01: '21:59', cards_eos_ora_01: '06:01' };
    const profile = { dialleima_se_lepta: 30, dialleima_entos_ektos_orarioy: false };
    assert.deepEqual(service.getPayrollCalculationIntervals(rec, profile).map(({start,end}) => [start,end]),
        [[1319, 1559], [1589, 1801]]);
    const buckets = service.emptyClassifiedMinutes();
    for (const {start,end} of service.getPayrollCalculationIntervals(rec, profile))
        for (let m = start; m < end; m++) service.addClassifiedMinute(buckets, rec, m, new Set());
    assert.deepEqual(buckets, {normal: 1, night: 120, holiday: 1, holidayNight: 330});
});
test('διαδοχικές κάρτες μετά τα μεσάνυχτα ανήκουν στην επόμενη ημερομηνία', () => {
    const rec = { hmeromhnia: '2026-04-04', cards_apo_ora_01: '08:00', cards_eos_ora_01: '12:00',
        cards_apo_ora_02: '22:00', cards_eos_ora_02: '02:30', cards_apo_ora_03: '04:00', cards_eos_ora_03: '06:00' };
    assert.deepEqual(service.getPayrollCalculationIntervals(rec, {dialleima_se_lepta: 30})
        .map(({start,end}) => [start,end]), [[480,720], [1320,1560], [1680,1800]]);
});

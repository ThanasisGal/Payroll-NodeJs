const interval = (from, to) => ({
    cards_apo_ora_01: from,
    cards_eos_ora_01: to
});

const work = (date, cards, from, to, overrides = {}) => ({
    hmeromhnia: date,
    kathgoria_ergasias: 'ΕΡΓ',
    kathgoria_ergasias_apologistika: 'ΕΡΓ',
    ores_ergasias: 8,
    ores_ergasias_apologistika: cards > 0 ? cards - 0.5 : 0,
    cards_ores_ergasias: cards,
    repo: false,
    repo_apologistika: false,
    adeia: false,
    kathgoria_adeias: '',
    ores_apoysias: 0,
    adeia_apologistika: false,
    kathgoria_adeias_apologistika: '',
    ores_apoysias_apologistika: 0,
    astheneia: false,
    astheneia_apologistika: false,
    argia: false,
    argia_apologistika: false,
    apologistiko_biblio: cards > 0,
    is_locked: false,
    apo_ora_01: '',
    eos_ora_01: '',
    apo_ora_02: '',
    eos_ora_02: '',
    apo_ora_03: '',
    eos_ora_03: '',
    apo_ora_01_apologistika: '',
    eos_ora_01_apologistika: '',
    apo_ora_02_apologistika: '',
    eos_ora_02_apologistika: '',
    apo_ora_03_apologistika: '',
    eos_ora_03_apologistika: '',
    cards_apo_ora_02: '',
    cards_eos_ora_02: '',
    cards_apo_ora_03: '',
    cards_eos_ora_03: '',
    ores_nyxtas_apologistika: 0,
    ores_argion_prosayxhsh_apologistika: 0,
    ores_argion_ergasia_apologistika: 0,
    ores_prostheths_ergasias_apologistika: 0,
    ores_yperergasias_apologistika: 0,
    ores_nominhs_yperorias_apologistika: 0,
    ores_paranomhs_yperorias_apologistika: 0,
    ...interval(from, to),
    ...overrides
});

const autoLeave = (date, from, to) =>
    work(date, 0, '', '', {
        apo_ora_01: from,
        eos_ora_01: to,
        kathgoria_ergasias_apologistika: '',
        adeia_apologistika: true,
        kathgoria_adeias_apologistika: 'ΑΔΑΛ'
    });

const profile = (premiumRate, effectiveDate) => ({
    typos_apasxolhshs: '0',
    hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 8,
    pososto_prosayxhshs_6hs_hmeras: premiumRate,
    dialleima_se_lepta: 30,
    dialleima_entos_ektos_orarioy: false,
    external_break_minutes: 30,
    source: 'ERG_AKTUAL',
    effective_date: effectiveDate,
    eidikh_kathgoria_ergazomenoy: '0009'
});

module.exports = Object.freeze([
    {
        employeeCode: '0005',
        week: '2026-06-01/2026-06-07',
        employmentProfile: profile(0, '2026-06-01'),
        rows: [
            work('2026-06-01', 8.35, '14:11', '22:32', { ores_ergasias_apologistika: 7.85 }),
            work('2026-06-02', 7.1, '15:12', '22:18', {
                kathgoria_ergasias: 'ΑΝ', repo: true, ores_ergasias: 0,
                ores_ergasias_apologistika: 6.6,
                apo_ora_01_apologistika: '15:12',
                eos_ora_01_apologistika: '23:12',
                ores_nyxtas_apologistika: 0.3
            }),
            work('2026-06-03', 10.2, '12:09', '22:21', { ores_ergasias_apologistika: 9.7 }),
            autoLeave('2026-06-04', '13:00', '21:00'),
            work('2026-06-05', 8.083333, '14:36', '22:41', { ores_ergasias_apologistika: 7.58 }),
            work('2026-06-06', 8.316667, '14:35', '22:54', { ores_ergasias_apologistika: 7.82 }),
            work('2026-06-07', 8.183333, '14:38', '22:49', {
                kathgoria_ergasias_apologistika: 'ΑΝ',
                repo_apologistika: true,
                ores_ergasias_apologistika: 7.68
            })
        ]
    },
    {
        employeeCode: '0002',
        week: '2026-06-15/2026-06-21',
        employmentProfile: profile(0, '2026-06-15'),
        rows: [
            work('2026-06-15', 8.816667, '14:08', '22:57', {
                kathgoria_ergasias: 'ΑΝ', repo: true, ores_ergasias: 0,
                ores_ergasias_apologistika: 8.32,
                apo_ora_01_apologistika: '14:08',
                eos_ora_01_apologistika: '22:08',
                ores_nyxtas_apologistika: 0.95
            }),
            work('2026-06-16', 8.18333, '14:17', '22:28', {
                ores_ergasias_apologistika: 7.68
            }),
            autoLeave('2026-06-17', '13:00', '21:00'),
            work('2026-06-18', 7.83333, '14:35', '22:25', {
                ores_ergasias_apologistika: 7.33,
                ores_apoysias_apologistika: 0.67
            }),
            work('2026-06-19', 9.05, '13:18', '22:21', {
                ores_ergasias_apologistika: 8.55
            }),
            work('2026-06-20', 8.58333, '14:58', '23:33', {
                ores_ergasias_apologistika: 8.08
            }),
            work('2026-06-21', 7.31667, '15:39', '22:58', {
                kathgoria_ergasias_apologistika: 'ΑΝ',
                repo_apologistika: true,
                ores_ergasias_apologistika: 6.82,
                ores_apoysias_apologistika: 1.18
            })
        ]
    },
    {
        employeeCode: '0002',
        week: '2026-06-22/2026-06-28',
        employmentProfile: profile(0, '2026-06-22'),
        rows: [
            work('2026-06-22', 7.6667, '14:49', '22:29', {
                kathgoria_ergasias: 'ΑΝ', repo: true, ores_ergasias: 0,
                ores_ergasias_apologistika: 7.17,
                apo_ora_01_apologistika: '14:49',
                eos_ora_01_apologistika: '22:49',
                ores_nyxtas_apologistika: 0.48
            }),
            work('2026-06-23', 8.1333, '14:22', '22:30', { ores_ergasias_apologistika: 7.63 }),
            autoLeave('2026-06-24', '13:00', '21:00'),
            work('2026-06-25', 8.0333, '15:06', '23:08', { ores_ergasias_apologistika: 7.53 }),
            work('2026-06-26', 8.4333, '13:58', '22:24', { ores_ergasias_apologistika: 7.93 }),
            work('2026-06-27', 8.3, '14:49', '23:07', { ores_ergasias_apologistika: 7.8 }),
            work('2026-06-28', 8.2333, '15:14', '23:28', {
                kathgoria_ergasias_apologistika: 'ΑΝ',
                repo_apologistika: true,
                ores_ergasias_apologistika: 7.73
            })
        ]
    },
    {
        employeeCode: '0003',
        week: '2026-06-01/2026-06-07',
        employmentProfile: profile(null, '2026-06-01'),
        rows: [
            work('2026-06-01', 0, '', '', {
                kathgoria_ergasias: 'ΑΝ', kathgoria_ergasias_apologistika: 'ΑΝ',
                repo: true, repo_apologistika: true, ores_ergasias: 0,
                ores_ergasias_apologistika: 0
            }),
            work('2026-06-02', 8, '10:09', '', {
                apo_ora_01: '09:00',
                eos_ora_01: '17:00',
                apo_ora_01_apologistika: '10:09',
                eos_ora_01_apologistika: '18:09',
                ores_ergasias_apologistika: 7.5
            }),
            autoLeave('2026-06-03', '09:00', '17:00'),
            autoLeave('2026-06-04', '09:00', '17:00'),
            autoLeave('2026-06-05', '09:00', '17:00'),
            autoLeave('2026-06-06', '09:00', '17:00'),
            autoLeave('2026-06-07', '09:00', '17:00')
        ]
    }
]);

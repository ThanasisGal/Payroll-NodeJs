'use strict';

const DECLARED_SCHEDULE_SOURCE_FIELDS = Object.freeze([
    'kathgoria_ergasias',
    'apo_ora_01', 'eos_ora_01',
    'apo_ora_02', 'eos_ora_02',
    'apo_ora_03', 'eos_ora_03',
    'repo', 'argia', 'perigrafh_argias', 'ores_ergasias'
]);

function buildDeclaredScheduleUpdate(source = {}) {
    return {
        kathgoria_ergasias: String(source.kathgoria_ergasias || '').trim(),
        apo_ora_01: String(source.apo_ora_01 || '').trim(),
        eos_ora_01: String(source.eos_ora_01 || '').trim(),
        apo_ora_02: String(source.apo_ora_02 || '').trim(),
        eos_ora_02: String(source.eos_ora_02 || '').trim(),
        apo_ora_03: String(source.apo_ora_03 || '').trim(),
        eos_ora_03: String(source.eos_ora_03 || '').trim(),
        repo: source.repo === true,
        argia: source.argia === true,
        perigrafh_argias: source.argia === true ? String(source.perigrafh_argias || '').trim() : '',
        ores_ergasias: Number.isFinite(Number(source.ores_ergasias)) ? Number(source.ores_ergasias) : 0,

        cards_apo_ora_01: '',
        cards_eos_ora_01: '',
        cards_apo_ora_02: '',
        cards_eos_ora_02: '',
        cards_apo_ora_03: '',
        cards_eos_ora_03: '',
        cards_ores_ergasias: 0,
        check_ergasia: false,

        apologistiko_biblio: false,
        apo_ora_01_apologistika: '',
        eos_ora_01_apologistika: '',
        apo_ora_02_apologistika: '',
        eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '',
        eos_ora_03_apologistika: '',
        ores_nyxtas_apologistika: 0,
        ores_argion_prosayxhsh_apologistika: 0,
        ores_argion_ergasia_apologistika: 0,
        kyriakes_apologistika: false,
        ores_prostheths_ergasias_apologistika: 0,
        ores_yperergasias_apologistika: 0,
        ores_yperergasias_nyxtas_apologistika: 0,
        ores_yperergasias_argion_apologistika: 0,
        ores_yperergasias_argion_nyxtas_apologistika: 0,
        ores_nominhs_yperorias_apologistika: 0,
        ores_nominhs_yperorias_nyxtas_apologistika: 0,
        ores_nominhs_yperorias_argion_apologistika: 0,
        ores_nominhs_yperorias_argion_nyxtas_apologistika: 0,
        ores_paranomhs_yperorias_apologistika: 0,
        ores_paranomhs_yperorias_nyxtas_apologistika: 0,
        ores_paranomhs_yperorias_argion_apologistika: 0,
        ores_paranomhs_yperorias_argion_nyxtas_apologistika: 0,
        repo_apologistika: false,
        adeia_apologistika: false,
        kathgoria_adeias_apologistika: '',
        astheneia_apologistika: false
    };
}

module.exports = {
    DECLARED_SCHEDULE_SOURCE_FIELDS,
    buildDeclaredScheduleUpdate
};

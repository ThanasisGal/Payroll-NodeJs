const companiesModel = require('../../models/companies.js');

const YpokatasthmataModel = companiesModel.YpokatasthmataModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/ypokatasthma',
    model: YpokatasthmataModel,
    options: {
    searchFields: ['kodikos', 'perigrafh'],
    extraQueryBuilder: (q) => {
        const f = {};
        if (q.team && String(q.team).trim()) {
            f.team = String(q.team).trim();
        }
        if (q.company && String(q.company).trim()) {
            f.companykod_object = String(q.company).trim();
        }
        return f; // αν δεν υπάρχουν, γυρνάει {} και δεν κόβει τα πάντα
    },
    sort: { kodikos: 1 }
    }
};

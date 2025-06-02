const companiesModel = require('../models/companies.js');

const YpokatasthmataModel = companiesModel.YpokatasthmataModel;

module.exports = {
    path: '/api/dropdown/ypokatasthmata',
    model: YpokatasthmataModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        extraQueryBuilder: (query) => ({
            team: query.team,
            companykod_object: query.company
        }),
    }
};

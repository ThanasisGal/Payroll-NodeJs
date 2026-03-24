const companiesModel = require('../../models/companies.js');
const YpokatasthmataModel = companiesModel.YpokatasthmataModel;

module.exports = {
    path: '/api/dropdown/erganh/ypokatasthmata',
    model: YpokatasthmataModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        extraQueryBuilder: (query) => {
            const f = {};

            // Φιλτράρισμα με βάση τα query parameters που έρχονται από το frontend
            if (query.company && String(query.company).trim()) {
                f.companykod_object = String(query.company).trim();
            }

            return f;
        },
        sort: { sort_order: 1, kodikos: 1 } // Χρήση του νέου sort_order!
    }
};

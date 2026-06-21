const statheraArxeiaModel = require('../models/stathera_arxeia');

const { PeriodsModel } = statheraArxeiaModel;

const clean = (value) => String(value ?? '').trim();

module.exports = {
    path: '/api/dropdown/periodoi',
    model: PeriodsModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikosSort: 1 },
        extraQueryBuilder: (query) => ({
            xrhsh: clean(query.xrhsh) || new Date().getFullYear().toString()
        }),
        mapItem: (item) => {
            const kodikos = clean(item.kodikos);
            const perigrafh = clean(item.perigrafh);

            return {
                value: kodikos,
                id: kodikos,
                kodikos,
                perigrafh,
                label: perigrafh || kodikos,
                text: perigrafh || kodikos
            };
        }
    }
};

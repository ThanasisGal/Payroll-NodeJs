const ergazomenoiModels = require('../../models/ergazomenoi.js');

const ErgazomenoiModel = ergazomenoiModels.ErgazomenoiModel;

const cleanQueryValue = (value) => {
    if (value === undefined || value === null) return '';

    return String(value)
        .trim()
        .replace(/^['\"]+|['\"]+$/g, '')
        .trim();
};

const isTruthyQueryValue = (value, defaultValue = true) => {
    const normalizedValue = cleanQueryValue(value).toLowerCase();

    if (!normalizedValue) return defaultValue;

    return ['1', 'true', 'yes', 'on', 'nai', 'ναι'].includes(normalizedValue);
};

const buildYpokatasthmaFilterValues = (ypokatasthma) => {
    const normalizedYpokatasthma = cleanQueryValue(ypokatasthma);

    if (!normalizedYpokatasthma || normalizedYpokatasthma === '__ALL__') {
        return [];
    }

    const values = new Set([normalizedYpokatasthma]);

    const asNumber = Number(normalizedYpokatasthma);
    if (Number.isFinite(asNumber)) {
        values.add(String(asNumber));
        values.add(String(asNumber).padStart(4, '0'));
    }

    return [...values].filter(Boolean);
};

module.exports = {
    path: '/api/dropdown/kinhseis/apasxolhseis/ergazomenoi',
    model: ErgazomenoiModel,
    options: {
        pk: 'kodikos',
        searchFields: ['kodikos', 'eponymo', 'onoma', 'afm', 'amka'],
        extraQueryBuilder: (query) => {
            const f = {};

            const team = cleanQueryValue(query.team);
            const company = cleanQueryValue(query.company || query.company_kod || query.companyKod);
            const ypokatasthma = cleanQueryValue(query.ypokatasthma || query.ypokatasthma_Hidden);

            if (team) {
                f.team = team;
            }

            if (company) {
                f.company_kod = company;
            }

            const ypokatasthmaValues = buildYpokatasthmaFilterValues(ypokatasthma);
            if (ypokatasthmaValues.length === 1) {
                f.ypokatasthma = ypokatasthmaValues[0];
            } else if (ypokatasthmaValues.length > 1) {
                f.ypokatasthma = { $in: ypokatasthmaValues };
            }

            if (isTruthyQueryValue(query.energoi ?? query.energos ?? query.active, true)) {
                f.energos = true;
                f.archived = false;
            }

            return f;
        },
        sort: { eponymo: 1, onoma: 1, kodikos: 1 },
        mapItem: (item) => {
            const kodikos = cleanQueryValue(item.kodikos);
            const eponymo = cleanQueryValue(item.eponymo).toUpperCase();
            const onoma = cleanQueryValue(item.onoma).toUpperCase();
            const afm = cleanQueryValue(item.afm);
            const ypokatasthma = cleanQueryValue(item.ypokatasthma);

            const nameParts = [eponymo, onoma].filter(Boolean);
            const fullLabel = [kodikos, nameParts.join(' ')].filter(Boolean).join(' - ');

            return {
                value: kodikos,
                kodikos,
                eponymo,
                onoma,
                afm,
                ypokatasthma,
                label: fullLabel,
                text: fullLabel,
                raw: item
            };
        }
    }
};

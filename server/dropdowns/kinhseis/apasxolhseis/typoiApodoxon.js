const mongoose = require('mongoose');

const cleanQueryValue = (value) => {
    if (value === undefined || value === null) return '';

    return String(value)
        .trim()
        .replace(/^[\'\"]+|[\'\"]+$/g, '')
        .trim();
};

const tryRequire = (modulePath) => {
    try {
        return require(modulePath);
    } catch (error) {
        if (error && error.code === 'MODULE_NOT_FOUND') {
            return null;
        }

        throw error;
    }
};

const findExportedModel = (exportsObject, candidateNames) => {
    if (!exportsObject || typeof exportsObject !== 'object') return null;

    for (const candidateName of candidateNames) {
        if (exportsObject[candidateName]) {
            return exportsObject[candidateName];
        }
    }

    return null;
};

const resolveTypoiApodoxonModel = () => {
    const candidateNames = [
        'TypoiApodoxonModel',
        'Typoi_ApodoxonModel',
        'TyposApodoxonModel',
        'Typos_ApodoxonModel',
        'TypoiApodoxwnModel',
        'TyposApodoxonMisthodosiasModel',
        'TypoiApodoxon',
        'Typoi_Apodoxon',
        'TyposApodoxon',
        'Typos_Apodoxon'
    ];

    const candidateModules = [
        tryRequire('../../../models/kinhseis.js'),
        tryRequire('../../../models/parametroi.js'),
        tryRequire('../../../models/typoiApodoxon.js'),
        tryRequire('../../../models/typoi_apodoxon.js')
    ].filter(Boolean);

    for (const moduleExports of candidateModules) {
        const model = findExportedModel(moduleExports, candidateNames);
        if (model) return model;
    }

    for (const candidateName of candidateNames) {
        if (mongoose.models[candidateName]) {
            return mongoose.models[candidateName];
        }
    }

    throw new Error(
        'Δεν βρέθηκε Mongoose model για Τύπους Αποδοχών. ' +
            'Έλεγξε το export στο server/models/kinhseis.js ή πρόσθεσε το σωστό όνομα στο server/dropdowns/kinhseis/apasxolhseis/typoiApodoxon.js.'
    );
};

const TypoiApodoxonModel = resolveTypoiApodoxonModel();

module.exports = {
    path: '/api/dropdown/kinhseis/apasxolhseis/typoiApodoxon',
    model: TypoiApodoxonModel,
    options: {
        pk: 'kodikos',
        searchFields: ['kodikos', 'perigrafh'],
        extraQueryBuilder: () => ({}),
        sort: { kodikos: 1 },
        mapItem: (item) => {
            const kodikos = cleanQueryValue(item.kodikos || item.value);
            const perigrafh = cleanQueryValue(item.perigrafh || item.perigrafh_stathera || item.label || item.text);
            const label = perigrafh ? perigrafh.toLocaleUpperCase('el-GR') : kodikos;

            return {
                value: kodikos,
                kodikos,
                perigrafh,
                label,
                text: label,
                raw: item
            };
        }
    }
};

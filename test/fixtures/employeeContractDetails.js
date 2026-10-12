'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const helper = require('../../server/services/ergazomenoi/employeeContractDescriptionService');
// Run the actual controller's read-only enrichment against in-memory catalogs.
// Model doubles deliberately filter on all fields, as MongoDB does.
function enrichWithCatalogs(rows, catalogs) {
    const source = fs.readFileSync(path.join(__dirname, '../../server/controllers/ergazomenoi/ergazomenoiController.js'), 'utf8');
    const model = items => ({ find(filter) { return { select() { return this; }, lean() {
        return Promise.resolve(items.filter(item => filter.$or.some(query =>
            Object.entries(query).every(([key, value]) => item[key] === value))));
    } }; } });
    const raw = name => (catalogs[name] || []).map(({ code, label, ...parent }) => ({ kodikos: code, perigrafh: label, ...parent }));
    const enrich = vm.runInNewContext(source.slice(source.indexOf('function uniqueTruthy('),
        source.indexOf('// Server-side guards (in-memory)')) + '\nenrichIstorikoRowsForDetails;', {
        ...helper, Intl,
        SymbaseisModel: model(raw('CONTRACT_TYPE')),
        KathgoriesSymbaseonModel: model(raw('CONTRACT_CATEGORY')),
        EidikothtesAnaKathgoriaSymbaseonModel: model(raw('CONTRACT_SPECIALTY')),
        StoixeiaSymbaseonModel: model(raw('CONTRACT_ITEM')), KrathseisModel: model([])
    });
    return enrich(rows);
}
module.exports = { enrichWithCatalogs };

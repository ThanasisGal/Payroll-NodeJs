const statheraArxeiaModel = require('../models/stathera_arxeia');

const {
  EidikothtesErganhModel
} = statheraArxeiaModel;

module.exports = {
  path: '/api/dropdown/tmhmata',
  model: EidikothtesErganhModel,
  options: {
    searchFields: ['perigrafh'],
    // extraQueryBuilder: (query) => ({
    //   companyId: query.companyId,
    // }),
  }
};

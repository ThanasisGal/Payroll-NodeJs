const symbaseisModel = require('../../models/symbaseis');

const {
  SymbaseisModel
} = symbaseisModel;

module.exports = {
  path: '/api/dropdown/symbaseis/symbash',
  model: SymbaseisModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    sort: { kodikos: 1 },
  }
};

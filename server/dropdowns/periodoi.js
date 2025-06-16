// const express = require("express");
// const router = express.Router();

// const { buildDropdownRoute } = require("../utils/dropdownHelper");
// const tmhmataDropdown = require("../dropdowns/tmhmata");

// router.get(
//   tmhmataDropdown.path,
//   buildDropdownRoute(tmhmataDropdown.model, tmhmataDropdown.options)
// );

// module.exports = router;

const statheraArxeiaModel = require('../models/stathera_arxeia');

const {
  PeriodsModel
} = statheraArxeiaModel;

module.exports = {
  path: '/api/dropdown/periodoi',
  model: PeriodsModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    sort: { kodikos: 1 },
    extraQueryBuilder: (query) => ({
      xrhsh: query.xrhsh || new Date().getFullYear().toString()
    }),
  }
};

const express = require("express");
const router = express.Router();

const { buildDropdownRoute } = require("../utils/dropdownHelper");
const tmhmataDropdown = require("../dropdowns/tmhmata");

router.get(
  tmhmataDropdown.path,
  buildDropdownRoute(tmhmataDropdown.model, tmhmataDropdown.options)
);

module.exports = router;

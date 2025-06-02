const express = require("express");
const router = express.Router();

const { buildDropdownRoute } = require("../utils/dropdownHelper");
const statheraArxeiaModels = require("../models/stathera_arxeia");
const companiesModels = require("../models/companies");
const typoiApodoxon = require("../dropdowns/typoiApodoxon");
const tmhmata = require("../dropdowns/tmhmata");
const periodoi = require("../dropdowns/periodoi");
const ypokatasthmata = require("../dropdowns/ypokatasthmata");

// const router = Router();

const   {
            YpokatasthmataModel,
        } = companiesModels;

const   {
            Typoi_ApodoxonModel,
            EidikothtesErganhModel,
            PeriodsModel
        } = statheraArxeiaModels;

router.get('/typoiApodoxon',    buildDropdownRoute(Typoi_ApodoxonModel, typoiApodoxon.options));
router.get('/periodoi',         buildDropdownRoute(PeriodsModel, periodoi.options));
router.get('/ypokatasthmata',   buildDropdownRoute(YpokatasthmataModel, ypokatasthmata.options));
router.get('/tmhmata',          buildDropdownRoute(EidikothtesErganhModel, tmhmata.options));

module.exports = router;

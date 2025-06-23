const express = require("express");
const router = express.Router();

const { buildDropdownRoute } = require("../utils/dropdownHelper");
const statheraArxeiaModels = require("../models/stathera_arxeia");
const companiesModels = require("../models/companies");
const typoiApodoxon = require("../dropdowns/typoiApodoxon");
const tmhmata = require("../dropdowns/tmhmata");
const periodoi = require("../dropdowns/periodoi");
const ypokatasthmata = require("../dropdowns/ypokatasthmata");
const nomikesMorfes = require('../dropdowns/nomikesMorfes');
const pararthmataEfka = require('../dropdowns/pararthmataEfka');
const doy = require('../dropdowns/doy');
const tameia = require('../dropdowns/tameia');
const kad = require('../dropdowns/kad');
// const logisths = require('../dropdowns/logistes');

const   {
            YpokatasthmataModel,
        } = companiesModels;

const   {
            NomikesMorfesModel,
            PararthmataEfkaModel,
            DoyModel,
            TameiaModel,
            KadModel,
            Typoi_ApodoxonModel,
            TmhmataModel,
            PeriodsModel
        } = statheraArxeiaModels;

router.get('/typoiApodoxon',    buildDropdownRoute(Typoi_ApodoxonModel, typoiApodoxon.options));
router.get('/periodoi',         buildDropdownRoute(PeriodsModel, periodoi.options));
router.get('/ypokatasthmata',   buildDropdownRoute(YpokatasthmataModel, ypokatasthmata.options));
router.get('/tmhmata',          buildDropdownRoute(TmhmataModel, tmhmata.options));

router.get('/nomikesMorfes',    buildDropdownRoute(NomikesMorfesModel, nomikesMorfes.options));
router.get('/pararthmataEfka',  buildDropdownRoute(PararthmataEfkaModel, pararthmataEfka.options));
router.get('/doy',              buildDropdownRoute(DoyModel, doy.options));
router.get('/tameia',           buildDropdownRoute(TameiaModel, tameia.options));

router.get('/kad',              buildDropdownRoute(KadModel, kad.options));
router.get('/logistes',         buildDropdownRoute(DoyModel, doy.options));

module.exports = router;

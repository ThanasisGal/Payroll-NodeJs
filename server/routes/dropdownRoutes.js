const express = require("express");
const router = express.Router();

const { buildDropdownRoute }                = require("../utils/dropdownHelper");
const statheraArxeiaModels                  = require("../models/stathera_arxeia");
const companiesModels                       = require("../models/companies");
const typoiApodoxon                         = require("../dropdowns/typoiApodoxon");
const tmhmata                               = require("../dropdowns/tmhmata");
const periodoi                              = require("../dropdowns/periodoi");
const ypokatasthmata                        = require("../dropdowns/ypokatasthmata");
const nomikesMorfes                         = require('../dropdowns/nomikesMorfes');
const pararthmataEfka                       = require('../dropdowns/pararthmataEfka');
const doy                                   = require('../dropdowns/doy');
const tameia                                = require('../dropdowns/tameia');
const kad                                   = require('../dropdowns/kad');
const sepe                                  = require('../dropdowns/ypokatasthmata/sepe');
const dypa                                  = require('../dropdowns/ypokatasthmata/dypa');
const pararthmataEfkaErgolaboy              = require('../dropdowns/ypokatasthmata/pararthmataEfkaErgolaboy');
const idiothtes                             = require('../dropdowns/nomimoiEkprosopoi/idiothtes');
const taytothtes                            = require('../dropdowns/nomimoiEkprosopoi/taytothtes');

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
            PeriodsModel,
            SepeModel,
            DypaModel,
            IdiothtesModel,
            TypoiTaytothtonModel
        } = statheraArxeiaModels;

// ================================ ΕΚΤΥΠΩΣΕΙΣ -> ΑΠΑΣΧΟΛΗΣΕΙΣ ==================================

router.get('/typoiApodoxon',                            buildDropdownRoute(Typoi_ApodoxonModel, typoiApodoxon.options));
router.get('/periodoi',                                 buildDropdownRoute(PeriodsModel, periodoi.options));
router.get('/ypokatasthmata',                           buildDropdownRoute(YpokatasthmataModel, ypokatasthmata.options));
router.get('/tmhmata',                                  buildDropdownRoute(TmhmataModel, tmhmata.options));

// ================================ ΕΤΑΙΡΕΙΕΣ -> ΓΕΝΙΚΑ ΣΤΟΙΧΕΙΑ ==================================

router.get('/nomikesMorfes',                            buildDropdownRoute(NomikesMorfesModel, nomikesMorfes.options));
router.get('/pararthmataEfka',                          buildDropdownRoute(PararthmataEfkaModel, pararthmataEfka.options));
router.get('/doy',                                      buildDropdownRoute(DoyModel, doy.options));
router.get('/tameia',                                   buildDropdownRoute(TameiaModel, tameia.options));

router.get('/kad',                                      buildDropdownRoute(KadModel, kad.options));

router.get('/logistes',                                 buildDropdownRoute(DoyModel, doy.options));

router.get('/emmesosErgodoths',                         buildDropdownRoute(NomikesMorfesModel, nomikesMorfes.options));

router.get('/diadoxosErgodoths',                        buildDropdownRoute(NomikesMorfesModel, nomikesMorfes.options));

// ================================ ΕΤΑΙΡΕΙΕΣ -> ΥΠΟΚΑΤΑΣΤΗΜΑΤΑ ===================================

router.get('/ypokatasthmata/sepe',                      buildDropdownRoute(SepeModel, sepe.options));
router.get('/ypokatasthmata/dypa',                      buildDropdownRoute(DypaModel, dypa.options));

router.get('/ypokatasthmata/pararthmataEfkaErgolaboy',  buildDropdownRoute(PararthmataEfkaModel, pararthmataEfkaErgolaboy.options));

// ================================ ΕΤΑΙΡΕΙΕΣ -> ΝΟΜΙΜΟΙ ΕΚΠΡΟΣΩΠΟΙ ===============================

router.get('/nomimoiEkprosopoi/idiothta',               buildDropdownRoute(IdiothtesModel, idiothtes.options));
router.get('/nomimoiEkprosopoi/taytothta',              buildDropdownRoute(TypoiTaytothtonModel, taytothtes.options));


module.exports = router;

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
const trapezes                              = require('../dropdowns/trapezes/trapezes');

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
            TypoiTaytothtonModel,
            BanksModel
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

// ================================ ΕΤΑΙΡΕΙΕΣ -> ΤΡΑΠΕΖΕΣ =========================================
// Επειδή στο crateDropdownApi.js διαχειρίζομαι τα πεδία kodikow και perigrafh ενώ εδώ σαν pripary key
// έχω το kodikos_dias με το mapItem: item, pad = 3) => ({... αντιστοιχίζω το kodikos με το item.kodikos_dias
// και το περνάω σαν options.

router.get(
  '/trapezes/trapeza',
  buildDropdownRoute(BanksModel, {
    pk: 'kodikos_dias',
    searchFields: ['kodikos_dias', 'perigrafh'],
    sort: { perigrafh: 1 },
    mapItem: (item, pad = 3) => ({
      value: item.kodikos_dias,
      kodikos: item.kodikos_dias,
      perigrafh: item.perigrafh,
      label: `${(item.kodikos_dias?.trim() || '').padEnd(pad, '\u00A0')} - ${item.perigrafh}`,
    }),
  })
);

module.exports = router;

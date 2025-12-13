const express = require("express");
const router = express.Router();

const asyncWrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const { buildDropdownRoute }                = require("../utils/dropdownHelper");

const statheraArxeiaModels                  = require("../models/stathera_arxeia");
const companiesModels                       = require("../models/companies");
const symbaseisModels                       = require("../models/symbaseis");

const typoiApodoxon                         = require("../dropdowns/typoiApodoxon");
const tmhmata                               = require("../dropdowns/tmhmata");
const periodoi                              = require("../dropdowns/periodoi");
const ypokatasthmata                        = require("../dropdowns/ypokatasthmata");
const nomikesMorfes                         = require('../dropdowns/nomikesMorfes');
const pararthmataEfka                       = require('../dropdowns/pararthmataEfka');
const doy                                   = require('../dropdowns/doy');
const tameia                                = require('../dropdowns/tameia');
const kad                                   = require('../dropdowns/kad');
const kathgoriesErgasias                    = require('../dropdowns/statheraArxeia/kathgoriesErgasias');

const sepe                                  = require('../dropdowns/ypokatasthmata/sepe');
const dypa                                  = require('../dropdowns/ypokatasthmata/dypa');
const pararthmataEfkaErgolaboy              = require('../dropdowns/ypokatasthmata/pararthmataEfkaErgolaboy');

const idiothtes                             = require('../dropdowns/nomimoiEkprosopoi/idiothtes');
const taytothtes                            = require('../dropdowns/nomimoiEkprosopoi/taytothtes');

const yphkoothtes                           = require('../dropdowns/ergazomenoi/yphkoothtes');
const eidikesKathgories                     = require('../dropdowns/ergazomenoi/eidikesKathgories');
const oikogeneiakesKatastaseis              = require('../dropdowns/ergazomenoi/oikogeneiakesKatastaseis');
const trapezes                              = require('../dropdowns/ergazomenoi/trapezes');
const kathestosApasxolhseon                 = require('../dropdowns/ergazomenoi/kathestosApasxolhseon');
const sxeseisErgasias                       = require('../dropdowns/ergazomenoi/sxeseisErgasias');
const syggenikesSxeseis                     = require('../dropdowns/ergazomenoi/syggenikesSxeseis');
const theseisEythynhs                       = require('../dropdowns/ergazomenoi/theseisEythynhs');
const eidikesPeriptoseis                    = require('../dropdowns/ergazomenoi/eidikesPeriptoseis');
const apasxolhseisBaseiSymbashs             = require('../dropdowns/ergazomenoi/apasxolhseisBaseiSymbashs');
const tmhmataErgazomenon                    = require('../dropdowns/ergazomenoi/tmhmataErgazomenon');
const ekpaideytikaEpipeda                   = require('../dropdowns/ergazomenoi/ekpaideytikaEpipeda');
const eidikothtes                           = require('../dropdowns/ergazomenoi/eidikothtes');
const typoiErgazomenon                      = require('../dropdowns/ergazomenoi/typoiErgazomenon');
const ypokatasthmaErgazomenon               = require("../dropdowns/ergazomenoi/ypokatasthmata");
const eidikothtesErganh                     = require("../dropdowns/ergazomenoi/eidikothtesErganh");
const perifereies                           = require("../dropdowns/ergazomenoi/perifereies");
const nomoi                                 = require("../dropdowns/ergazomenoi/nomoi");
const dhmoi                                 = require("../dropdowns/ergazomenoi/dhmoi");
const poleis                                = require("../dropdowns/ergazomenoi/poleis");
const kadEfka                               = require("../dropdowns/ergazomenoi/kadEfka");
const eidikothtesEfka                       = require('../dropdowns/ergazomenoi/eidikothtesEfka');
const kpkEfka                               = require('../dropdowns/ergazomenoi/kpkEfka');
const epaEfka                               = require('../dropdowns/ergazomenoi/epaEfka');
const antistoixishEpaKpk                    = require('../dropdowns/ergazomenoi/antistoixishEpaKpk');
const kpkEfkaByCode                         = require('../dropdowns/ergazomenoi/kpkEfkaByCode');
const d_yp_apasxolhshs                      = require('../dropdowns/ergazomenoi/dypa');
const programmaDypa                         = require('../dropdowns/ergazomenoi/programmataDypa');
const kentraKostoys                         = require('../dropdowns/ergazomenoi/kentraKostoys');
const krathseis                             = require('../dropdowns/ergazomenoi/krathseis');
const adeies_diamonhs_typos_0               = require('../dropdowns/ergazomenoi/adeies_diamonhs_typos_0');
const adeies_diamonhs_typos_1               = require('../dropdowns/ergazomenoi/adeies_diamonhs_typos_1');

const symbaseis                             = require('../dropdowns/symbaseis/symbaseis');
const kathgoriesSymbaseon                   = require('../dropdowns/symbaseis/kathgoriesSymbaseon');
const symbaseisController                   = require('../controllers/symbaseisController');
const kathgoriesApoSymbaseis                = require('../dropdowns/symbaseis/kathgoriesApoSymbaseis');
const eidikothtesApoKathgories              = require('../dropdowns/symbaseis/eidikothtesApoKathgories');
const eidikothtesApoKathgoriesMulti         = require('../dropdowns/symbaseis/eidikothtesApoKathgories-multi');
const stoixeiaApoEidikothtes                = require('../dropdowns/symbaseis/stoixeiaApoEidikothtes');

const   {
            YpokatasthmataModel,
            BanksPerCompanyModel
        } = companiesModels;

const   {
            NomikesMorfesModel,
            PararthmataEfkaModel,
            DoyModel,
            PerifereiesModel,
            NomoiModel, 
            DhmoiModel, 
            PoleisModel, 
            TameiaModel,
            KadModel,
            Typoi_ApodoxonModel,
            TmhmataModel,
            PeriodsModel,
            SepeModel,
            DypaModel,
            IdiothtesModel,
            TypoiTaytothtonModel,
            BanksModel,
            YphkoothtesModel,
            EidikesKathgoriesModel,
            OikogeneiakhKatastashModel,
            KathestosApasxolhshsModel,
            SxeseisErgasiasModel,
            SyggenikesSxeseisModel,
            TheseisEythynhsModel,
            EidikesPeriptoseisModel,
            ApasxolhseisBaseiSymbashsModel, 
            AsfalistikesKlaseisModel,
            EkpaideytikoEpipedoModel,
            EidikothtesEfarmoghsModel,
            TypoiErgazomenonModel,
            EidikothtesErganhModel,
            KadEfkaModel,
            KentraKostoysModel,
            KathgoriesErgasiasModel,
            KrathseisModel,
            AdeiesDiamonhsModel,
        } = statheraArxeiaModels;

const   {
            SymbaseisModel,
            KathgoriesSymbaseonModel,
            EidikothtesAnaKathgoriaSymbaseonModel,
            StoixeiaSymbaseonModel
        } = symbaseisModels;


// ---------------- [ ΜΟΝΟ για Ασφαλιστική Κλάση ] ----------------

function toGR(date) {
    if (!date) return '';
    const d = (date instanceof Date) ? date : new Date(date);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function padText(s, w) { return (s ?? '').toString().padEnd(w, '\u00A0'); }

function fmtNum(n, digits = 2, width = 7) {
    if (n === null || n === undefined || n === '') return ''.padEnd(width, '\u00A0');
    const s = Number(n).toFixed(digits);
    return s.padEnd(width, '\u00A0');
}

// middleware: υπολογίζει dateApo/dateEos από το session και τα περνάει στο req.query
function injectMonthRangeFromSession(req, _res, next) {
    const year  = String(req.session?.yearInUse || '').trim();
    const month = String(req.session?.periodInUse || '').trim().padStart(2, '0');

    if (!year || !month) {
        // δεν “σπάμε” το route· απλώς δεν βάζουμε φίλτρο ημερομηνιών
        return next();
    }

    const y = Number(year);
    const m = Number(month);
    const first = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const last = new Date(Date.UTC(y, m - 1, lastDay, 23, 59, 59, 999));

    req.query._dateApo = first.toISOString();
    req.query._dateEos = last.toISOString();

    // αν έρθει preselect ?value=, φρόντισε να είναι 2-ψηφιο (01,02,...)
    if (req.query.value) {
        req.query.value = String(req.query.value).padStart(2, '0');
    }
    next();
}

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
// Επειδή στο crateDropdownApi.js διαχειρίζομαι τα πεδία kodikos και perigrafh ενώ εδώ σαν pripary key έχω
// το kodikos_dias με το mapItem: item, pad = 3) => ({... αντιστοιχίζω το kodikos με το item.kodikos_dias
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

// ========================= ΕΡΓΑΖΟΜΕΝΟΙ -> SECTION1 -> ΠΡΟΣΩΠΙΚΑ ΣΤΟΙΧΕΙΑ =======================

router.get('/ergazomenoi/yphkoothta',                   buildDropdownRoute(YphkoothtesModel, yphkoothtes.options));
router.get('/ergazomenoi/eidikh_kathgoria',             buildDropdownRoute(EidikesKathgoriesModel , eidikesKathgories.options));
router.get('/ergazomenoi/oikogeneiakh_katastash',       buildDropdownRoute(OikogeneiakhKatastashModel , oikogeneiakesKatastaseis.options));
router.get('/ergazomenoi/trapeza',                      buildDropdownRoute(BanksPerCompanyModel , trapezes.options));
router.get('/ergazomenoi/kathestos_apasxolhshs',        buildDropdownRoute(KathestosApasxolhshsModel , kathestosApasxolhseon.options));
router.get('/ergazomenoi/sxesh_ergasias',               buildDropdownRoute(SxeseisErgasiasModel , sxeseisErgasias.options));
router.get('/ergazomenoi/syggenikh_sxesh',              buildDropdownRoute(SyggenikesSxeseisModel , syggenikesSxeseis.options));
router.get('/ergazomenoi/thesh_eythynhs',               buildDropdownRoute(TheseisEythynhsModel , theseisEythynhs.options));
router.get('/ergazomenoi/eidikh_periptosh',             buildDropdownRoute(EidikesPeriptoseisModel , eidikesPeriptoseis.options));
router.get('/ergazomenoi/apasxolhsh_basei_symbashs',    buildDropdownRoute(ApasxolhseisBaseiSymbashsModel , apasxolhseisBaseiSymbashs.options));

router.get('/ergazomenoi/asfalistikh_klash',
    injectMonthRangeFromSession,
    buildDropdownRoute(AsfalistikesKlaseisModel, {
        pk: 'kodikos',
        searchFields: ['kodikos','perigrafh'],
        sort: { kodikos: 1 },
        extraQueryBuilder: (q) => {
            if (!q._dateApo || !q._dateEos) return {};
            const dA = new Date(q._dateApo), dE = new Date(q._dateEos);
            return {
                isxyei_apo: { $lte: dA },
                $or: [{isxyei_eos:{$exists:false}},{isxyei_eos:null},{isxyei_eos:{$gte:dE}}]
            };
        },

        // --- ΜΟΝΟ ΓΙΑ asfalistikh_klash ---
        mapItem: (it, pad = 2) => {
            const NBSP = '\u00A0';
            const kod = String(it.kodikos || '').padStart(2,'0');
            const toGR = d => {
                if (!d) return '';
                const x = new Date(d);
                return `${String(x.getUTCDate()).padStart(2,'0')}/${String(x.getUTCMonth()+1).padStart(2,'0')}/${x.getUTCFullYear()}`;
            };
            const padTxt = (s,w)=>String(s??'').padEnd(w, NBSP);
            const n = (v,dec=2,w=7)=> (v==null?'':Number(v).toFixed(dec)).toString().padStart(w, NBSP);

            const SEP = ' - ';
            const DESC_W = 19; // 21 - 2 για το " - "
            const c1 = kod.padEnd(pad, NBSP);                       // 1η: kodikos (π.χ. 01)
            const c2 = padTxt((it.perigrafh||'').substring(0, DESC_W), DESC_W);
            const c3 = n(it.poso);                                   // 3η: poso (π.χ. 12.28)
            const c4 = n(it.apo_orio);
            const c5 = n(it.eos_orio);
            const c6 = padTxt(toGR(it.isxyei_apo),10);
            const c7 = padTxt(it.isxyei_eos ? toGR(it.isxyei_eos) : '',10);

            return {
                value: kod,
                label: `${c1}${SEP}${c2} ${c3} ${c4} ${c5}  ${c6}  ${c7}`,
                c1, sep: SEP, c2, c3, c4, c5, c6, c7
            };
        }
    })
);

router.get('/ergazomenoi/tmhma',                        buildDropdownRoute(TmhmataModel , tmhmataErgazomenon.options));
router.get('/ergazomenoi/ekpaideytiko_epipedo',         buildDropdownRoute(EkpaideytikoEpipedoModel , ekpaideytikaEpipeda.options));
router.get('/ergazomenoi/eidikothta',                   buildDropdownRoute(EidikothtesEfarmoghsModel , eidikothtes.options));
router.get('/ergazomenoi/typos_ergazomenon',            buildDropdownRoute(TypoiErgazomenonModel , typoiErgazomenon.options));
router.get('/ergazomenoi/ypokatasthma',                 buildDropdownRoute(YpokatasthmataModel , ypokatasthmaErgazomenon.options));
router.get('/ergazomenoi/eidikothta_erganh',            buildDropdownRoute(EidikothtesErganhModel , eidikothtesErganh.options));
router.get('/ergazomenoi/perifereia',                   buildDropdownRoute(PerifereiesModel , perifereies.options));
router.get('/ergazomenoi/nomos',                        buildDropdownRoute(NomoiModel , nomoi.options));
router.get('/ergazomenoi/dhmos',                        buildDropdownRoute(DhmoiModel , dhmoi.options));
router.get('/ergazomenoi/polh',                         buildDropdownRoute(PoleisModel , poleis.options));
router.get('/ergazomenoi/kad_efka',                     buildDropdownRoute(KadEfkaModel , kadEfka.options));
router.get('/ergazomenoi/eidikothta_efka',              eidikothtesEfka.handler);
router.get('/ergazomenoi/kpk_efka',                     kpkEfka.handler);
router.get('/ergazomenoi/epa_efka',                     epaEfka.handler);
router.get('/ergazomenoi/antistoixishEpaKpk',           antistoixishEpaKpk.handler);
router.get('/ergazomenoi/kpk_efka_by_code',             kpkEfkaByCode.handler);
router.get('/ergazomenoi/dypa',                         buildDropdownRoute(DypaModel , d_yp_apasxolhshs.options));
router.get('/ergazomenoi/programma_dypa',               programmaDypa.handler);
router.get('/ergazomenoi/kentro_kostoys',               buildDropdownRoute(KentraKostoysModel , kentraKostoys.options));
router.get('/ergazomenoi/kathgoria_ergasias',           buildDropdownRoute(KathgoriesErgasiasModel , kathgoriesErgasias.options));

// =========================== ΕΡΓΑΖΟΜΕΝΟΙ -> SECTION3 -> ΚΡΑΤΗΣΕΙΣ ==============================

router.get('/ergazomenoi/krathseis',                    buildDropdownRoute(KrathseisModel, krathseis.options));

// =========================== ΕΡΓΑΖΟΜΕΝΟΙ -> SECTION4 -> ΑΛΛΟΔΑΠΟΙ ==============================

// ✅ Άδειες Διαμονής με typos = "0"
router.get('/ergazomenoi/adeies_diamonhs_typos_0',      buildDropdownRoute(AdeiesDiamonhsModel, adeies_diamonhs_typos_0.options));
router.get('/ergazomenoi/adeies_diamonhs_typos_1',      buildDropdownRoute(AdeiesDiamonhsModel, adeies_diamonhs_typos_1.options));

// ============================= ΣΥΜΒΑΣΕΙΣ -> ΚΑΤΗΓΟΡΙΕΣ ΣΥΜΒΑΣΕΩΝ ===============================

router.get('/symbaseis/symbash',                        buildDropdownRoute(SymbaseisModel , symbaseis.options));
router.get('/symbaseis/kathgories',                     buildDropdownRoute(KathgoriesSymbaseonModel, kathgoriesSymbaseon.options));
router.get('/symbaseis/kathgories',                     symbaseisController.listKathgoriesSymbaseon);
router.get('/symbaseis/kathgoria_symbashs',             buildDropdownRoute(KathgoriesSymbaseonModel, kathgoriesApoSymbaseis.options));
router.get('/symbaseis/eidikothta_symbashs',            buildDropdownRoute(EidikothtesAnaKathgoriaSymbaseonModel, eidikothtesApoKathgories.options));
router.get('/symbaseis/eidikothta_symbashs_multi',      buildDropdownRoute(EidikothtesAnaKathgoriaSymbaseonModel, eidikothtesApoKathgoriesMulti.options));
router.get('/symbaseis/stoixeio_symbashs',              buildDropdownRoute(StoixeiaSymbaseonModel, stoixeiaApoEidikothtes.options));

module.exports = router;

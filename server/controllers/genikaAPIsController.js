const mongoose = require("mongoose");
const Models = require("../models/stathera_arxeia");
const Models_Companies = require("../models/companies");
const Models_Symbaseon = require("../models/symbaseis");

const {
        PerifereiesModel,
        NomoiModel,
        DhmoiModel,
        PoleisModel,
        NomikesMorfesModel,
        PararthmataEfkaModel,
        DoyModel,
        TameiaModel,
        KadModel,
        TexnikosAsfaleiasModel,
        IatrosErgasiasModel,
        LogisthsModel,
        EmmesosErgodothsModel,
        DiadoxosErgodothsModel,
        SepeModel,
        DypaModel,
        IdiothtesModel,
        TypoiTaytothtonModel,
        KrathseisModel,
        PosostaKrathseonModel,
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
        TmhmataModel,
        EidikothtesErganhModel,
        EidikothtesEfarmoghsModel,
        EkpaideytikoEpipedoModel,
        TypoiErgazomenonModel,
        KadEfkaModel,
        EidikothtesEfkaModel,
        EidikesPeriptoseisEfkaModel,
        KpkEfkaModel,
        AntistoixishKadEidikothtesKpkEfkaModel,
        AntistoixishEidikhsPeriptoshsKpkEfkaModel,
        ProgrammataDypaModel,
        KentraKostoysModel,
        AdeiesDiamonhsModel,
        ForeisEkpaideyshsModel,
        LanguagesModel,
        ThematikaPediaModel,
        ThematikesEnothtesModel,
        ArgiesModel,
        KathgoriesErgasiasModel,
        KathgoriesAdeiasModel,
        GenikesParametroiModel
      } = Models;

const { NomimoiEkprosopoiModel } = Models_Companies

const { SymbaseisModel,
        KathgoriesSymbaseonModel,
        EidikothtesAnaKathgoriaSymbaseonModel,
        StoixeiaSymbaseonModel,
        KlimakiaSymbaseonModel,
      } = Models_Symbaseon;

class genikaAPIsController {
  static getPerifereies = async (req, res) => {
    try {
      const perifereies = await PerifereiesModel.find().select("kodikos perigrafh").sort("perigrafh"); // Επιλογή των πεδίων που θέλουμε να εμφανιστούν στο dropdown
      res.json(perifereies);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getNomoi = async (req, res) => {
    try {
      const { perifereia } = req.query;
      const nomoi = await NomoiModel.find({ perifereia: perifereia }).sort(
        "perigrafh"
      );
      res.json(nomoi);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getDhmoi = async (req, res) => {
    try {
      const { nomos } = req.query;
      const dhmoi = await DhmoiModel.find({ nomos: nomos }).sort("perigrafh");
      res.json(dhmoi);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getPoleis = async (req, res) => {
    try {
      const { dhmos } = req.query;
      const poleis = await PoleisModel.find({ dhmos: dhmos }).sort("perigrafh");
      res.json(poleis);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getNomikesMorfes = async (req, res) => {
    try {
      const nomikesMorfes = await NomikesMorfesModel.find({}, "kodikos perigrafh").sort("perigrafh");
      res.json(nomikesMorfes);
    } catch (error) {
      res.status(500).send(error);
    }
  }

  static handleNomikesMorfes = async (req, res) => {
    const selectFields = [
      { id: "nomikhmorfh", field: "kodikos", text: "perigrafh" },
      { id: "nomikh_morfh_em_erg", field: "kodikos", text: "perigrafh" },
      { id: "nomikh_morfh_diad_erg", field: "kodikos", text: "perigrafh" },
    ];
    try {
      const documents = await NomikesMorfesModel.find().lean();

      const dropdownData = selectFields.reduce((acc, selectField) => {
        const fieldData = documents.map((doc) => ({
          value: doc[selectField.field],
          text: doc[selectField.text],
        }));
        acc[selectField.id] = fieldData;
        return acc;
      }, {});

      res.json(dropdownData);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getPararthmataEfka = async (req, res) => {
    try {
      const pararthmataEfka = await PararthmataEfkaModel.find(
        {},
        "kodikos perigrafh"
      ).sort("perigrafh");
      res.json(pararthmataEfka);
    } catch (error) {
      res.status(500).send(error);
    }
  }

  static handlePararthmataEfka = async (req, res) => {
    const selectFields = [
      { id: "pararthmaefka", field: "kodikos", text: "perigrafh" },
    ];
    try {
      const documents = await PararthmataEfkaModel.find().lean();

      const dropdownData = selectFields.reduce((acc, selectField) => {
        const fieldData = documents.map((doc) => ({
          value: doc[selectField.field],
          text: doc[selectField.text],
        }));
        acc[selectField.id] = fieldData;
        return acc;
      }, {});

      res.json(dropdownData);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getCompanyDoy = async (req, res) => {
    try {
      const efories = await DoyModel.find().select("kodikos perigrafh").sort("kodikos");
      res.json(efories);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getDoy = async (req, res) => {
    const selectFields = [
      { id: "doy", field: "kodikos", text: "perigrafh" },
      { id: "doy_lo", field: "kodikos", text: "perigrafh" },
    ];
    try {
      const documents = await DoyModel.find().lean();

      const dropdownData = selectFields.reduce((acc, selectField) => {
        const fieldData = documents.map((doc) => ({
          value: doc[selectField.field],
          text: doc[selectField.text],
        }));
        acc[selectField.id] = fieldData;
        return acc;
      }, {});

      res.json(dropdownData);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getTameia = async (req, res) => {
    const selectFields = [
      { id: "tameio1", field: "kodikos", text: "perigrafh" },
      { id: "tameio2", field: "kodikos", text: "perigrafh" },
      { id: "tameio3", field: "kodikos", text: "perigrafh" },
      { id: "tameio4", field: "kodikos", text: "perigrafh" },
    ];
    try {
      const documents = await TameiaModel.find().lean();

      const dropdownData = selectFields.reduce((acc, selectField) => {
        const fieldData = documents.map((doc) => ({
          value: doc[selectField.field],
          text: doc[selectField.text],
        }));
        acc[selectField.id] = fieldData;
        return acc;
      }, {});

      res.json(dropdownData);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static checkTexnikosAsfaleias = async (req, res) => {
    try {
      const { afm_ta } = req.body;
      let aa_kod_ta = null;
      const lastRecord_ta = await TexnikosAsfaleiasModel.find({})
        .sort({ _id: -1 })
        .limit(1);
  
      aa_kod_ta = lastRecord_ta[0] && lastRecord_ta[0].kodikos ? parseInt(lastRecord_ta[0].kodikos, 10) : null;

      const doc = await TexnikosAsfaleiasModel.findOne({ afm: afm_ta });

      const afm_texnikoy = doc && doc.afm !== undefined ? doc.afm : null;

      if (aa_kod_ta === null && afm_ta !== null) {
        aa_kod_ta = 1;
      } else if (aa_kod_ta !== null && afm_texnikoy != null) {
        aa_kod_ta = null;
      } else if (aa_kod_ta !== null && afm_texnikoy === null) {
        aa_kod_ta++;
      } else if (aa_kod_ta === null && afm_ta === null) {
        aa_kod_ta = null;
      }

      if (doc || aa_kod_ta) {
        res.json({ doc, aa_kod_ta });
      }
    } catch (err) {
      res.status(500).send("Σφάλμα κατά την αναζήτηση στη βάση δεδομένων");
    }
  };

  static checkIatrosErgasias = async (req, res) => {
    try {
      const { afm_ia } = req.body;
      let aa_kod_ia = null;
      const lastRecord_ia = await IatrosErgasiasModel.find({})
        .sort({ _id: -1 })
        .limit(1);
      aa_kod_ia =
        lastRecord_ia[0] && lastRecord_ia[0].kodikos
          ? parseInt(lastRecord_ia[0].kodikos, 10)
          : null;

      const doc = await IatrosErgasiasModel.findOne({ afm: afm_ia });
      const afm_iatroy = doc && doc.afm !== undefined ? doc.afm : null;

      if (aa_kod_ia === null && afm_ia !== null) {
        aa_kod_ia = 1;
      } else if (aa_kod_ia !== null && afm_iatroy != null) {
        aa_kod_ia = null;
      } else if (aa_kod_ia !== null && afm_iatroy === null) {
        aa_kod_ia++;
      } else if (aa_kod_ia === null && afm_ia === null) {
        aa_kod_ia = null;
      }

      if (doc || aa_kod_ia) {
        res.json({ doc, aa_kod_ia });
      }
    } catch (err) {
      res.status(500).send("Σφάλμα κατά την αναζήτηση στη βάση δεδομένων");
    }
  };

  static checkLogisths = async (req, res) => {
    try {
      const { afm_lo } = req.body;
      let aa_kod_lo = null;
      const lastRecord_lo = await LogisthsModel.find({})
        .sort({ _id: -1 })
        .limit(1);
      aa_kod_lo =
        lastRecord_lo[0] && lastRecord_lo[0].kodikos
          ? parseInt(lastRecord_lo[0].kodikos, 10)
          : null;

      const doc = await LogisthsModel.findOne({ afm: afm_lo });

      const afm_logisth = doc && doc.afm !== undefined ? doc.afm : null;

      if (aa_kod_lo === null && afm_lo !== null) {
        aa_kod_lo = 1;
      } else if (aa_kod_lo !== null && afm_logisth != null) {
        aa_kod_lo = null;
      } else if (aa_kod_lo !== null && afm_logisth === null) {
        aa_kod_lo++;
      } else if (aa_kod_lo === null && afm_lo === null) {
        aa_kod_lo = null;
      }

      if (doc || aa_kod_lo) {
        res.json({ doc, aa_kod_lo });
      }
    } catch (err) {
      res.status(500).send("Σφάλμα κατά την αναζήτηση στη βάση δεδομένων");
    }
  };

  static checkEmmesosErgodoths = async (req, res) => {
    try {
      const { afm_em_erg } = req.body;
      let aa_kod_em_erg = null;
      const lastRecord_em_erg = await EmmesosErgodothsModel.find({})
        .sort({ _id: -1 })
        .limit(1);
      aa_kod_em_erg =
        lastRecord_em_erg[0] && lastRecord_em_erg[0].kodikos
          ? parseInt(lastRecord_em_erg[0].kodikos, 10)
          : null;

      const doc = await EmmesosErgodothsModel.findOne({ afm: afm_em_erg });

      const afm_emmesoyErgodoth = doc && doc.afm !== undefined ? doc.afm : null;

      if (aa_kod_em_erg === null && afm_em_erg !== null) {
        aa_kod_em_erg = 1;
      } else if (aa_kod_em_erg !== null && afm_emmesoyErgodoth != null) {
        aa_kod_em_erg = null;
      } else if (aa_kod_em_erg !== null && afm_emmesoyErgodoth === null) {
        aa_kod_em_erg++;
      } else if (aa_kod_em_erg === null && afm_em_erg === null) {
        aa_kod_em_erg = null;
      }

      if (doc || aa_kod_em_erg) {
        res.json({ doc, aa_kod_em_erg });
      }
    } catch (err) {
      res.status(500).send("Σφάλμα κατά την αναζήτηση στη βάση δεδομένων");
    }
  };

  static checkDiadoxosErgodoths = async (req, res) => {
    try {
      const { afm_diad_erg } = req.body;
      let aa_kod_diad_erg = null;
      const lastRecord_diad_erg = await DiadoxosErgodothsModel.find({})
        .sort({ _id: -1 })
        .limit(1);
      aa_kod_diad_erg =
        lastRecord_diad_erg[0] && lastRecord_diad_erg[0].kodikos
          ? parseInt(lastRecord_diad_erg[0].kodikos, 10)
          : null;

      const doc = await DiadoxosErgodothsModel.findOne({ afm: afm_diad_erg });

      const afm_diadoxoyErgodoth = doc && doc.afm !== undefined ? doc.afm : null;

      if (aa_kod_diad_erg === null && afm_diad_erg !== null) {
        aa_kod_diad_erg = 1;
      } else if (aa_kod_diad_erg !== null && afm_diadoxoyErgodoth != null) {
        aa_kod_diad_erg = null;
      } else if (aa_kod_diad_erg !== null && afm_emmesoyErgodoth === null) {
        aa_kod_diad_erg++;
      } else if (aa_kod_diad_erg === null && afm_diad_erg === null) {
        aa_kod_diad_erg = null;
      }

      if (doc || aa_kod_diad_erg) {
        res.json({ doc, aa_kod_diad_erg });
      }
    } catch (err) {
      res.status(500).send("Σφάλμα κατά την αναζήτηση στη βάση δεδομένων");
    }
  };

  static checkNomimosEkprosopos = async (req, res) => {
    try {
      const { afm_ekprosopoy } = req.body;
      let aa_kod_ekpr = null;
      const lastRecord_ekpr = await NomimoiEkprosopoiModel.find({})
        .sort({ _id: -1 })
        .limit(1);
      aa_kod_ekpr =
        lastRecord_ekpr[0] && lastRecord_ekpr[0].kodikos
          ? parseInt(lastRecord_ekpr[0].kodikos, 10)
          : null;

      const doc = await NomimoiEkprosopoiModel.findOne({ afm: afm_ekprosopoy });

      const afm_nomimoy_ekprosopoy = doc && doc.afm !== undefined ? doc.afm : null;

      if (aa_kod_ekpr === null && afm_ekprosopoy !== null) {
        aa_kod_ekpr = 1;
      } else if (aa_kod_ekpr !== null && afm_nomimoy_ekprosopoy != null) {
        aa_kod_ekpr = null;
      } else if (aa_kod_ekpr !== null && afm_nomimoy_ekprosopoy === null) {
        aa_kod_ekpr++;
      } else if (aa_kod_ekpr === null && afm_ekprosopoy === null) {
        aa_kod_ekpr = null;
      }

      if (doc || aa_kod_ekpr) {
        res.json({ doc, aa_kod_ekpr });
      }
    } catch (err) {
      res.status(500).send("Σφάλμα κατά την αναζήτηση στη βάση δεδομένων");
    }
  };

  static getKad = async (req, res) => {
    try {
      const searchData = [];
      for (let i = 1; i <= 6; i++) {
        const searchValue = req.query[`koddrast${i}`];
        let results;
        if (searchValue) {
          if (!isNaN(searchValue.substring(0, 2))) {
            results = await KadModel.find({
              kodikos: { $regex: searchValue, $options: "i" },
            }).select("kodikos perigrafh");
          } else {
            results = await KadModel.find({
              perigrafh: { $regex: searchValue, $options: "i" },
            }).select("kodikos perigrafh");
          }
          searchData.push(...results);
        }
      }
      res.json(searchData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  static getNomoiEditForm = async (req, res) => {
    try {
      const perifereiaKodikos = req.params.perifereiaKodikos;
      const nomoi = await NomoiModel.find({
        perifereia: perifereiaKodikos,
      }).sort("perigrafh");
      res.json(nomoi);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Σφάλμα κατά την ανάκτηση των νομών" });
    }
  };

  static getDhmoiEditForm = async (req, res) => {
    try {
      const nomosKodikos = req.params.nomosKodikos;
      const dhmoi = await DhmoiModel.find({ nomos: nomosKodikos }).sort(
        "perigrafh"
      );
      res.json(dhmoi);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Σφάλμα κατά την ανάκτηση των δήμων" });
    }
  };

  static getPoleisEditForm = async (req, res) => {
    try {
      const dhmosKodikos = req.params.dhmosKodikos;
      const poleis = await PoleisModel.find({ dhmos: dhmosKodikos }).sort(
        "perigrafh"
      );
      res.json(poleis);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Σφάλμα κατά την ανάκτηση των πόλεων" });
    }
  };

  static getLogisths = async (req, res) => {
    try {
      const kodikosLogisth = req.params.kodikosLogisth;
      const logistes = await LogisthsModel.find({
        kodikos: kodikosLogisth,
      }).sort("eponymo");
      res.json(logistes);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Σφάλμα κατά την ανάκτηση των λογιστών" });
    }
  };

  static getTexnikosAsfaleias = async (req, res) => {
    try {
      const kodikosTexnikoy = req.params.kodikosTexnikoy;
      const texnikoi = await TexnikosAsfaleiasModel.find({
        kodikos: kodikosTexnikoy,
      }).sort("eponymo");
      res.json(texnikoi);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Σφάλμα κατά την ανάκτηση των τεχνικών ασφαλείας" });
    }
  };

  static getIatrosErgasias = async (req, res) => {
    try {
      const kodikosIatroy = req.params.kodikosIatroy;
      const iatroi = await IatrosErgasiasModel.find({
        kodikos: kodikosIatroy,
      }).sort("eponymo");
      res.json(iatroi);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Σφάλμα κατά την ανάκτηση των ιατρών εργασίας" });
    }
  };

  static getEmmesosErgodoths = async (req, res) => {
    try {
      const kodikosEmmesoyErgodoth = req.params.kodikosEmmesoyErgodoth;
      const emmesoiErgodotes = await EmmesosErgodothsModel.find({kodikos: kodikosEmmesoyErgodoth,
      }).sort("eponymo");
      res.json(emmesoiErgodotes);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Σφάλμα κατά την ανάκτηση των Έμμεσων Εργοδοτών" });
    }
  };

  static getDiadoxosErgodoths = async (req, res) => {
    try {
      const kodikosDiadoxoyErgodoth = req.params.kodikosDiadoxoyErgodoth;
      const diadoxoiErgodotes = await DiadoxosErgodothsModel.find({kodikos: kodikosDiadoxoyErgodoth,
      }).sort("eponymo");
      res.json(diadoxoiErgodotes);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Σφάλμα κατά την ανάκτηση των Διάδοχων Εργοδοτών" });
    }
  };

  static getAllTameia = async (req, res) => {
    try {
      const tameia = await TameiaModel.find({}).sort("kodikos");
      res.json(tameia);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Σφάλμα κατά την ανάκτηση των ταμείων" });
    }
  };

  static getSepe = async (req, res) => {
    try {
      const sepe = await SepeModel.find(
        {},
        "kodikos perigrafh"
      ).sort("perigrafh");
      res.json(sepe);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getDypa = async (req, res) => {
    try {
      const dypa = await DypaModel.find(
        {},
        "kodikos perigrafh"
      ).sort("perigrafh");
      res.json(dypa);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getIdiothtes = async (req, res) => {
    try {
      const idiothta = await IdiothtesModel.find(
        {},
        "kodikos perigrafh"
      ).sort("perigrafh");
      res.json(idiothta);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getTypoiTaytothton = async (req, res) => {
    try {
      const typosTaytothtas = await TypoiTaytothtonModel.find().select("kodikos perigrafh");
      res.json(typosTaytothtas);
    } catch (error) {
      res.status(500).send(error);
    }
  };

    static getNomimosEkprosopos = async (req, res) => {
    try {
      const kodikosNomimoyEkprosopoy = req.params.kodikosNomimoyEkprosopoy;
      const nomimoiEkprosopoi = await NomimoiEkprosopoiModel.find({
        kodikos: kodikosNomimoyEkprosopoy,
      }).sort("eponymia");
      res.json(nomimoiEkprosopoi);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Σφάλμα κατά την ανάκτηση των Νόμιμων Εκπροσώπων" });
    }
  };

  static getKrathseis = async (req, res) => {
    try {
      const krathseis = await KrathseisModel.find().sort("kodikos");
      res.json(krathseis);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getPosostaKrathseon = async (req, res) => {
    try {
      const posostaKrathseon = await PosostaKrathseonModel.find().sort("kodikos");
      res.json(posostaKrathseon);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getBanks = async (req, res) => {
    try {
      const banks = await BanksModel.find().sort("perigrafh");
      res.json(banks);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Σφάλμα κατά την ανάκτηση των Τραπεζών" });
    }
  };

  static getYphkoothtes = async (req, res) => {
    try {
      const yphkoothta = await YphkoothtesModel.find().select("kodikos perigrafh").sort("perigrafh");
      res.json(yphkoothta);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getEidikesKathgories = async (req, res) => {
    try {
      const eidikhKathgoria = await EidikesKathgoriesModel.find().sort("perigrafh");
      res.json(eidikhKathgoria);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getOresFromEidikesKathgories = async (req, res) => {
    try {
      const kodikos = req.params.kodikos;
      const eidikhKathgoria = await EidikesKathgoriesModel.findOne({ kodikos: kodikos }).sort("perigrafh");
      res.json(eidikhKathgoria);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getOikogeneiakhKatastash = async (req, res) => {
    try {
      const oikogeneiakhKatastash = await OikogeneiakhKatastashModel.find().sort("perigrafh");
      res.json(oikogeneiakhKatastash);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getKathestotaApasxolhshs = async (req, res) => {
    try {
      const kathestos = await KathestosApasxolhshsModel.find();
      res.json(kathestos);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getSxeseisErgasias = async (req, res) => {
    try {
      const sxesh = await SxeseisErgasiasModel.find();
      res.json(sxesh);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getSyggenikesSxeseis = async (req, res) => {
    try {
      const syggenikhSxesh = await SyggenikesSxeseisModel.find().sort("kodikos");
      res.json(syggenikhSxesh);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getTheseisEythynhs = async (req, res) => {
    try {
      const theshEythynhs = await TheseisEythynhsModel.find().sort("kodikos");
      res.json(theshEythynhs);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getEidikesPeriptoseis = async (req, res) => {
    try {
      const eidikhPeriptosh = await EidikesPeriptoseisModel.find().sort("kodikos");
      res.json(eidikhPeriptosh);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getApasxolhseisBaseiSymbashs = async (req, res) => {
    try {
      const apasxolhshBaseiSymbashs = await ApasxolhseisBaseiSymbashsModel.find().sort("kodikos");
      res.json(apasxolhshBaseiSymbashs);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getAsfalistikesKlaseis = async (req, res) => {
    const etos_xrhshs = req.session.yearInUse;
    try {
      const documents = await AsfalistikesKlaseisModel.find({ etos: etos_xrhshs })
        .sort({ etos: -1, kodikos: 1 });
  
      const dropdownData = documents.map(doc => {
        // Ελέγχει αν οι τιμές είναι undefined και εξασφαλίζει ότι όλες οι τιμές είναι συμβολοσειρές
        const kodikos = doc.kodikos || '';
        const perigrafh = doc.perigrafh || '';
        const poso = doc.poso ? doc.poso.toString() : '';
        const apo_orio = doc.apo_orio || '';
        const eos_orio = doc.eos_orio || '';
        const isxyei_apo = doc.isxyei_apo || '';
        const isxyei_eos = doc.isxyei_eos || '';
  
        // Δημιουργία του κειμένου για κάθε επιλογή με βάση τις διαθέσιμες τιμές
        const text = `${kodikos.padEnd(4, '\u00A0')} ${perigrafh.substring(0, 20).padEnd(21, '\u00A0')} ${poso.toString().padEnd(7, '\u00A0')} ${apo_orio.toString().padEnd(7, '\u00A0')} ${eos_orio.toString().padEnd(7, '\u00A0')}`;
  
        return {
          value: `${doc.etos}${doc.kodikos}`,
          text: text
        };
      });
  
      res.json({ asfalistikh_klash: dropdownData });
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getTmhmata = async (req, res) => {
    try {
      const tmhma = await TmhmataModel.find().sort("perigrafh");
      res.json(tmhma);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getEkpaideytikaEpipeda = async (req, res) => {
    try {
      const ekpaideytikoEpipedo = await EkpaideytikoEpipedoModel.find().sort("perigrafh");
      res.json(ekpaideytikoEpipedo);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getEidikothtes = async (req, res) => {
    try {
      const eidikothta = await EidikothtesEfarmoghsModel.find().sort("perigrafh");
      res.json(eidikothta);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getTypoiErgazomenon = async (req, res) => {
    try {
      const typosErgazomenoy = await TypoiErgazomenonModel.find().sort({aa_taxinomhshs: 1});
      res.json(typosErgazomenoy);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getEidikothtesErganh = async (req, res) => {
    const searchTerm = req.query.query; // Λαμβάνουμε το query από το URL

    try {
        // Δημιουργία του query object με βάση το searchTerm
        let query = {};
        if (searchTerm) {
          query = {
            $or: [
              { kodikos: { $regex: searchTerm, $options: 'i' } }, // Αναζήτηση με βάση τον κωδικό
              { perigrafh: { $regex: searchTerm, $options: 'i' } } // Αναζήτηση με βάση την περιγραφή
            ]
          };
      }

      const eidikothtes = await EidikothtesErganhModel.find(query); // Χρήση του query object για την αναζήτηση
      res.json(eidikothtes);
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).send(error.message);
    }
  }

  static getSelectedEidikothta = async (req, res) => {
    try {
      const kodikos = req.query.id; // Χρησιμοποιούμε το 'id' από το query για το kodikos

      const eidikothta = await EidikothtesErganhModel.findOne({ kodikos: kodikos });

      if (eidikothta) {
        // return res.status(404).send('Ειδικότητα δεν βρέθηκε');

        // Επιστρέφουμε τα δεδομένα σε κατάλληλη μορφή για το Select2
        res.json({
          id: eidikothta._id,
          text: eidikothta.kodikos.padEnd(9, '\u00A0') + eidikothta.perigrafh
        });
      }
    } catch (error) {
      console.error('Error fetching initial eidikothta:', error);
      res.status(500).send(error.message);
    }
  }

  static getKadEfka = async (req, res) => {
    try {
      const kadEfka = await KadEfkaModel.find().sort("kodikos");
      res.json(kadEfka);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getEidikothtesEfka = async (req, res) => {
    try {
      const { kodikos_kad } = req.query;
      const antistoixies = await AntistoixishKadEidikothtesKpkEfkaModel.find({ kodikos_kad: kodikos_kad }, "kodikos_eidikothtas");
      const kodikoiEidikothtas = antistoixies.map(antistoixia => antistoixia.kodikos_eidikothtas.toString());


      // Ανάκτηση εγγραφών από το EidikothtesEfkaModel
      const eidikothta_efka = await EidikothtesEfkaModel.find({ 'kodikos': { $in: kodikoiEidikothtas } }).sort("kodikos").lean();

      res.json(eidikothta_efka);
    } catch (error) {
      console.error('Error fetching EidikothtesEfka:', error);
      res.status(500).send(error.message);
    }
  };

  static getKpkEfka = async (req, res) => {
    try {
        const { kodikos_kad, kodikos_eidikothtas } = req.query;
        const antistoixies = await AntistoixishKadEidikothtesKpkEfkaModel.find({ kodikos_kad: kodikos_kad, kodikos_eidikothtas: kodikos_eidikothtas }, "kodikos_kpk");
        const kodikoiKpk = antistoixies.map(antistoixia => antistoixia.kodikos_kpk.toString());

        // Χρησιμοποιήστε το aggregation framework για να επιστρέψετε μοναδικές τιμές
        const uniqueKpkEfka = await KpkEfkaModel.aggregate([
            { $match: { 'kodikos': { $in: kodikoiKpk } } },
            { $group: { _id: { kodikos: "$kodikos", perigrafh: "$perigrafh" } } },
            { $project: { kodikos: "$_id.kodikos", perigrafh: "$_id.perigrafh", _id: 0 } }
        ]).sort("kodikos");
        
        // Xρησιμοποιώ πρώτα ένα $match stage για να φιλτράρω τα documents βάσει των kodikoiKpk. Στη συνέχεια, το $group stage ομαδοποιεί τα documents βάσει των kodikos και perigrafh, επιστρέφοντας μοναδικούς συνδυασμούς αυτών των πεδίων. Τέλος, το $project stage χρησιμοποιείται για να επαναπροσδιορίσω τη μορφή των επιστρεφόμενων documents, εξαλείφοντας το πεδίο _id που δημιουργήθηκε από το $group

        res.json(uniqueKpkEfka);
    } catch (error) {
        console.error('Error fetching unique KpkEfka:', error);
        res.status(500).send(error.message);
    }
  };

  static getKpk = async (req, res) => {
    try {
      const { kodikos_kpkEfka } = req.query;
      const kpk = await KpkEfkaModel.find({ kodikos: kodikos_kpkEfka }).select("kodikos perigrafh").sort("perigrafh");
      res.json(kpk);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getEidikesPeriptoseisEfka = async (req, res) => {
    try {
      const epaEfka = await EidikesPeriptoseisEfkaModel.find().sort("kodikos");
      res.json(epaEfka);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getKpkBaseiEpaEfka = async (req, res) => {
    try {
        const { kodikos_eidikhs_periptoshs, kodikos_kpk_apo } = req.query;
        const antistoixies = await AntistoixishEidikhsPeriptoshsKpkEfkaModel.find({ kodikos_eidikhs_periptoshs: kodikos_eidikhs_periptoshs, kodikos_kpk_apo: kodikos_kpk_apo }, "kodikos_kpk_se");
        const kodikoiKpk = antistoixies.map(antistoixia => antistoixia.kodikos_kpk_se.toString());

        // Χρησιμοποιείται το aggregation framework για να επιστρέψει μοναδικές τιμές
        const uniqueKpkEfka = await KpkEfkaModel.aggregate([
            { $match: { 'kodikos': { $in: kodikoiKpk } } },
            { $group: { _id: { kodikos: "$kodikos", perigrafh: "$perigrafh" } } },
            { $project: { kodikos: "$_id.kodikos", perigrafh: "$_id.perigrafh", _id: 0 } }
        ]).sort("kodikos");
        
        res.json(uniqueKpkEfka);
    } catch (error) {
        console.error('Error fetching unique KpkEfka:', error);
        res.status(500).send(error.message);
    }
  };

  static getProgrammataDypa = async (req, res) => {
    try {
      const programmata = await ProgrammataDypaModel.find({ anoixto_kleisto: true });
      res.json(programmata);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getKentraKostoys = async (req, res) => {
    const selectFields = [
      { id: "kentro_kostoys_1", field: "kodikos", text: "perigrafh" },
      { id: "kentro_kostoys_2", field: "kodikos", text: "perigrafh" },
      { id: "kentro_kostoys_3", field: "kodikos", text: "perigrafh" },
      { id: "kentro_kostoys_4", field: "kodikos", text: "perigrafh" },
    ];
    try {
      const documents = await KentraKostoysModel.find().lean();

      const dropdownData = selectFields.reduce((acc, selectField) => {
        const fieldData = documents.map((doc) => ({
          value: doc[selectField.field],
          text: doc[selectField.text],
        }));
        acc[selectField.id] = fieldData;
        return acc;
      }, {});

      res.json(dropdownData);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getSymbaseis = async (req, res) => {
    try {
      const symbaseis = await SymbaseisModel.find().sort("kodikos");
      res.json(symbaseis);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getKathgoriesSymbaseon = async (req, res) => {
    try {
      const { symbash } = req.params;
      const kathgoriesSymbaseon = await KathgoriesSymbaseonModel.find({ afora_thn_symbash: symbash }).sort("kodikos");
      res.json(kathgoriesSymbaseon);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getEidikothtesSymbaseon = async (req, res) => {
    try {
      const { symbash_kathgoria } = req.params;
      const eidikothtesSymbashs = await EidikothtesAnaKathgoriaSymbaseonModel.find({ afora_thn_symbash_kathgoria: symbash_kathgoria }).sort("kodikos");
      res.json(eidikothtesSymbashs);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getStoixeiaSymbaseon = async (req, res) => {
    try {
      const { symbash_kathgoria_eidikothta } = req.params;
      const stoixeiaSymbashs = await StoixeiaSymbaseonModel.find({ afora_thn_symbash_kathgoria_eidikothta: symbash_kathgoria_eidikothta }).sort("afora_thn_symbash_kathgoria_eidikothta").lean();
      res.json(stoixeiaSymbashs);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getAdeiesDiamonhs = async (req, res) => {
    try {
      const { typosAdeias } = req.params;
      const adeiesDiamonhs = await AdeiesDiamonhsModel.find({ typos: typosAdeias }).sort("perigrafh");
      res.json(adeiesDiamonhs);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getGenikesParametroi = async (req, res) => {
    try {
      const genikesParametroi = await GenikesParametroiModel.find();
      res.json(genikesParametroi);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getForeisEkpaideyshs = async (req, res) => {
    try {
      const foreisEkpaydeyshs = await ForeisEkpaideyshsModel.find().sort("perigrafh");
      res.json(foreisEkpaydeyshs);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getLanguages = async (req, res) => {
    try {
      const languages = await LanguagesModel.find().sort("_id");
      res.json(languages);
    } catch (error) {
      res.status(500).send(error.message);
    }
  };
  
  static getThematikaPedia = async (req, res) => {
    try {
      const thematikaPedia = await ThematikaPediaModel.find({}, "kodikos perigrafh").sort("perigrafh"); // Επιλογή των πεδίων που θέλουμε να εμφανιστούν στο dropdown
      res.json(thematikaPedia);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static getThematikesEnothtes = async (req, res) => {
    try {
      const { thematikoPedio } = req.query;
      const thematikesEnothtes = await ThematikesEnothtesModel.find({ kodikos_sysxetishs: thematikoPedio }).sort(
        "perigrafh"
      );
      res.json(thematikesEnothtes);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  static checkArgies = async (req, res) => {
    try {
      const dates = req.body.dates; 
      const argies = await ArgiesModel.find({
          hmeromhnia: { $in: dates }
      }).exec();
      const holidays = argies.map(argia => ({
          date: argia.hmeromhnia.toISOString().split('T')[0],
          description: argia.perigrafh
      }));

      res.json(holidays);
    } catch (error) {
      res.status(500).send({ message: "Server error", error });
    }
  };

  static getKathgoriesErgasias = async (req, res) => {
    try {
      const kathgoriesErgasias = await KathgoriesErgasiasModel.find().sort({ _id: 1});
      res.json(kathgoriesErgasias);
    } catch (error) {
      res.status(500).send(error.message);
    }
  };
  
  static getKathgoriesAdeias = async (req, res) => {
    try {
      const kathgoriesAdeias = await KathgoriesAdeiasModel.find();
      res.json(kathgoriesAdeias);
    } catch (error) {
      res.status(500).send(error.message);
    }
  };
 
  static dateDifference = async (req, res) => {
    try {
      const { startDate, endDate } = req.body;
      const differenceInDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
  
      res.json({ differenceInDays: differenceInDays });
      } catch (error) {
      res.status(500).send(error.message);
    }
  };
 
}  

module.exports = genikaAPIsController;

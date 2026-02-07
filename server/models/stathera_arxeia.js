	const { Schema: _Schema, model } = require("mongoose");

	const Schema = _Schema;

	const PerifereiesSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	});
	const PerifereiesModel = model("Perifereies", PerifereiesSchema);
	
	const NomoiSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
		perifereia: { type: String, trim: true },
	});
	const NomoiModel = model("Nomos", NomoiSchema);
	
	const DhmoiSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
		nomos: { type: String, trim: true },
	});
	const DhmoiModel = model("Dhmos", DhmoiSchema);
	
	const PoleisSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
		dhmos: { type: String, trim: true },
		alt_perigrafh: { type: String, trim: true },
	});
	const PoleisModel = model("Poleis", PoleisSchema);
	
	const NomikesMorfesSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	});
	const NomikesMorfesModel = model("NomikesMorfes", NomikesMorfesSchema);
	
	const TypoiDaneismoySchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	},
		{
		collection: "typoi_daneismoy"
		}
	);
	const TypoiDaneismoyModel = model("TypoiDaneismoy", TypoiDaneismoySchema);
	
	const PararthmataEfkaSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
		palios_kodikos: { type: String, trim: true },
		odos: { type: String, trim: true },
		arithmos: { type: String, trim: true },
		tk: { type: String, trim: true },
		polh: { type: String, trim: true },
		thlefono1: { type: String, trim: true },
		thlefono2: { type: String, trim: true },
		thlefono3: { type: String, trim: true },
		email: { type: String, trim: true },
		},
		{
		collection: "pararthmata_efka"
		}
	);
	const PararthmataEfkaModel = model("PararthmataEfka", PararthmataEfkaSchema);
	
	const DoySchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	});
	const DoyModel = model("Doy", DoySchema);
	
	const TameiaSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
		la_ergod_mist: { type: String, trim: true },
		la_ergod_hmer: { type: String, trim: true },
		la_apodosh_mist: { type: String, trim: true },
		la_apodosh_hmer: { type: String, trim: true },
		la_epidothsh: { type: String, trim: true },
	});
	const TameiaModel = model("Tameia", TameiaSchema);
	
	const KadSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
		kodikosSort: { type: String, index: true },
	});
	const KadModel = model("Kad", KadSchema);
	
	const TexnikosAsfaleiasSchema = new Schema({
		team: { type: String, trim: true },
		kodikos: { type: String, trim: true },
		eponymo: { type: String, trim: true },
		onoma: { type: String, trim: true },
		afm: { type: String, trim: true },
		dieythynsh: { type: String, trim: true },
		thlefono: { type: String, trim: true },
		ores: { type: Number },
		ap_katatheshs: { type: String, trim: true },
		hmnia_katatheshs: { type: Date },
		isxyei_eos: { type: Date },
		createdAt: { type: Date, default: Date.now() },
		updatedAt: { type: Date, default: Date.now() },
	});
	const TexnikosAsfaleiasModel = model("TexnikosAsfaleias", TexnikosAsfaleiasSchema);
	
	const IatrosErgasiasSchema = new Schema({
		team: { type: String, trim: true },
		kodikos: { type: String, trim: true },
		eponymo: { type: String, trim: true },
		onoma: { type: String, trim: true },
		afm: { type: String, trim: true },
		dieythynsh: { type: String, trim: true },
		thlefono: { type: String, trim: true },
		ores: { type: Number },
		ap_katatheshs: { type: String, trim: true },
		hmnia_katatheshs: { type: Date },
		isxyei_eos: { type: Date },
		createdAt: { type: Date, default: Date.now() },
		updatedAt: { type: Date, default: Date.now() },
	});
	const IatrosErgasiasModel = model("IatrosErgasias", IatrosErgasiasSchema);
	
	const LogisthsSchema = new Schema({
		team: { type: String, trim: true },
		kodikos: { type: String, trim: true },
		eponymo: { type: String, trim: true },
		onoma: { type: String, trim: true },
		dieythynsh: { type: String, trim: true },
		thlefono: { type: String, trim: true },
		afm: { type: String, trim: true },
		doy: { type: String, trim: true },
		arithmos_adeias: { type: String, trim: true },
		kathgoria_adeias: { type: String },
		createdAt: { type: Date, default: Date.now() },
		updatedAt: { type: Date, default: Date.now() },
	});
	const LogisthsModel = model("Logisths", LogisthsSchema);
	
	const EmmesosErgodothsSchema = new Schema(
	{
		team: { type: String, trim: true },
		company_cod: { type: String, trim: true },
		kodikos: { type: String, trim: true },
		eponymo: { type: String, trim: true },
		onoma: { type: String, trim: true },
		dieythynsh: { type: String, trim: true },
		thlefono: { type: String, trim: true },
		afm: { type: String, trim: true },
		titlos: { type: String, trim: true },
		nomikhMorfh: { type: String, trim: true },
		drasthriothta: { type: String, trim: true },
		email: { type: String, trim: true, lowercase: true },
		daneismosApo: { type: Date },
		daneismosEos: { type: Date },
		// ΔΕΝ χρειάζεται να δηλώσεις createdAt/updatedAt εδώ αν βάλεις timestamps πιο κάτω
	},
	{
		timestamps: {
		createdAt: "createdAt",
		updatedAt: "updatedAt",
		currentTime: () => Date.now(), // προαιρετικό: ενιαία πηγή χρόνου
		},
	}
	);

	// Unique σύνθετος δείκτης (team+kodikos), με partial για να ισχύει μόνο όταν υπάρχουν έγκυρες τιμές
	EmmesosErgodothsSchema.index( { team: 1, kodikos: 1 }, { unique: true, partialFilterExpression: {team: { $exists: true, $type: "string", $gt: "" }, kodikos: { $exists: true, $type: "string", $gt: "" } } });
	const EmmesosErgodothsModel = model("EmmesosErgodoths", EmmesosErgodothsSchema);
	
	const DiadoxosErgodothsSchema = new Schema({
		team: { type: String, trim: true },
		kodikos: { type: String, trim: true },
		eponymo: { type: String, trim: true },
		onoma: { type: String, trim: true },
		dieythynsh: { type: String, trim: true },
		thlefono: { type: String, trim: true },
		afm: { type: String, trim: true },
		titlos: { type: String, trim: true },
		nomikhMorfh: { type: String, trim: true },
		drasthriothta: { type: String, trim: true },
		email: { type: String, trim: true },
		createdAt: { type: Date, default: Date.now() },
		updatedAt: { type: Date, default: Date.now() },
	});

	DiadoxosErgodothsSchema.index({ kodikos: 1, team: 1 }, { unique: true });
	const DiadoxosErgodothsModel = model("DiadoxosErgodoths", DiadoxosErgodothsSchema);
	
	const XrhseisSchema = new Schema({
		etos: { type: String, unique: true },
	});
	const XrhseisModel = model("Xrhseis", XrhseisSchema);
	
	const PeriodsSchema = new Schema({
		xrhsh: { type: String, required: true },
		kodikos: { type: String, required: true },
		kodikosSort: { type: Number },
		perigrafh: { type: String, trim: true },
		apo: { type: Date, default: null},
		eos: { type: Date, default: null},
	});
	const PeriodsModel = model("Periods", PeriodsSchema);

	const SepeSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	});
	const SepeModel = model("Sepe", SepeSchema);
	
	const DypaSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	});
	const DypaModel = model("Dypa", DypaSchema);
	
	const IdiothtesSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	});
	const IdiothtesModel = model("Idiothtes", IdiothtesSchema);
	
	const TypoiTaytothtonSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	});
	const TypoiTaytothtonModel = model("TypoiTaytothton", TypoiTaytothtonSchema);
	
	const KrathseisSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
		kodikos_tameioy: { type: String, trim: true },
		kyrio_epikoyriko: { type: Boolean, default: false },
		apla_barea: { type: Boolean, default: false },
		typos_apodoxon_001: { type: Boolean, default: false },
		typos_apodoxon_003: { type: Boolean, default: false },
		typos_apodoxon_004: { type: Boolean, default: false },
		typos_apodoxon_005: { type: Boolean, default: false },
		typos_apodoxon_006: { type: Boolean, default: false },
		typos_apodoxon_007: { type: Boolean, default: false },
		typos_apodoxon_008: { type: Boolean, default: false },
		typos_apodoxon_009: { type: Boolean, default: false },
		typos_apodoxon_010: { type: Boolean, default: false },
		typos_apodoxon_011: { type: Boolean, default: false },
		typos_apodoxon_012: { type: Boolean, default: false },
		typos_apodoxon_013: { type: Boolean, default: false },
		typos_apodoxon_014: { type: Boolean, default: false },
		typos_apodoxon_015: { type: Boolean, default: false },
		typos_apodoxon_016: { type: Boolean, default: false },
		typos_apodoxon_017: { type: Boolean, default: false },
		typos_apodoxon_018: { type: Boolean, default: false },
		typos_apodoxon_019: { type: Boolean, default: false },
		typos_apodoxon_021: { type: Boolean, default: false },
		typos_apodoxon_022: { type: Boolean, default: false },
		typos_apodoxon_023: { type: Boolean, default: false },
		typos_apodoxon_024: { type: Boolean, default: false },
		typos_apodoxon_025: { type: Boolean, default: false },
		typos_apodoxon_026: { type: Boolean, default: false },
		typos_apodoxon_027: { type: Boolean, default: false },
		typos_apodoxon_028: { type: Boolean, default: false },
		typos_apodoxon_029: { type: Boolean, default: false },
		typos_apodoxon_030: { type: Boolean, default: false },
		typos_apodoxon_031: { type: Boolean, default: false },
		typos_apodoxon_032: { type: Boolean, default: false },
		typos_apodoxon_033: { type: Boolean, default: false },
		typos_apodoxon_034: { type: Boolean, default: false },
		typos_apodoxon_035: { type: Boolean, default: false },
		typos_apodoxon_068: { type: Boolean, default: false },
		typos_apodoxon_069: { type: Boolean, default: false },
		typos_apodoxon_070: { type: Boolean, default: false },
		typos_apodoxon_071: { type: Boolean, default: false },
		typos_apodoxon_114: { type: Boolean, default: false },
		typos_apodoxon_115: { type: Boolean, default: false },
		typos_apodoxon_601: { type: Boolean, default: false },
		typos_apodoxon_603: { type: Boolean, default: false },
		typos_apodoxon_604: { type: Boolean, default: false },
		typos_apodoxon_605: { type: Boolean, default: false },
		typos_apodoxon_608: { type: Boolean, default: false },
		typos_apodoxon_609: { type: Boolean, default: false },
		typos_apodoxon_610: { type: Boolean, default: false },
		typos_apodoxon_611: { type: Boolean, default: false },
		typos_apodoxon_901: { type: Boolean, default: false },
		typos_apodoxon_902: { type: Boolean, default: false },
		typos_apodoxon_903: { type: Boolean, default: false },
		typos_apodoxon_904: { type: Boolean, default: false },
		typos_apodoxon_905: { type: Boolean, default: false },
		typos_apodoxon_906: { type: Boolean, default: false },
		typos_apodoxon_907: { type: Boolean, default: false },
		typos_apodoxon_908: { type: Boolean, default: false },
		typos_apodoxon_909: { type: Boolean, default: false },
		typos_apodoxon_910: { type: Boolean, default: false },
		typos_apodoxon_911: { type: Boolean, default: false },
		typos_apodoxon_912: { type: Boolean, default: false },
		typos_apodoxon_913: { type: Boolean, default: false },
		typos_apodoxon_914: { type: Boolean, default: false },
		ypologizetai_sto_foro: { type: Boolean, default: false }, 
		apaiteitai_hmnia_apo: { type: Boolean, default: false }, 
		apaiteitai_panta_proslhpsh: { type: Boolean, default: false }, 
		apaiteitai_hmnia_eos: { type: Boolean, default: false }, 
		apaiteitai_panta_apoxorhsh: { type: Boolean, default: false }, 
		apaiteitai_kata_thn_adeia_apo: { type: Boolean, default: false }, 
		apaiteitai_kata_thn_adeia_eos: { type: Boolean, default: false }, 
		apaiteitai_hmeres_asfalishs: { type: Boolean, default: false }, 
		apaiteitai_apodoxes_asfalishs: { type: Boolean, default: false },
		ypologismos_epi_plasmatikhs: { type: Boolean, default: false },
	});
	const KrathseisModel = model("Krathseis", KrathseisSchema);
	
	const PosostaKrathseonSchema = new Schema({
		krathshId: { type: Schema.Types.ObjectId, 
					ref: 'Krathseis' 
				},
		kodikos: { type: String, trim: true },
		aa_eggrafhs: { type: String, trim: true },
		isxyei_apo: { type: Date },
		isxyei_eos: { type: Date },
		pososto_ergazomenoy: { type: Number },
		pososto_ergodoth: { type: Number },
		synolo_pososton: { type: Number },
		poso_ergazomenoy: { type: Number },
		poso_ergodoth: { type: Number },
		synolo_poson: { type: Number },
		poso_plasmatikhs_axias: { type: Number },
		anotato_orio_palion: { type: Number },
		anotato_orio_neon: { type: Number },
	});

	PosostaKrathseonSchema.index({ isxyei_apo: 1, isxyei_eos: 1 });
	const PosostaKrathseonModel = model("PosostaKrathseon", PosostaKrathseonSchema);

	const BanksSchema = new Schema({
		kodikos_dias: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
		},
		{
		collection: "trapezes"
		}
	);
	const BanksModel = model("Banks", BanksSchema);

	const YphkoothtesSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	});
	const YphkoothtesModel = model("Yphkoothtes", YphkoothtesSchema);
	
	const EidikesKathgoriesSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
		ores_plhroys_apasxolhshs: { type: Number },
		prefix: { type: String, trim: true },
	},
		{
			collection: "Eidikes_Kathgories"
		}
	);

	const EidikesKathgoriesModel = model("EidikesKathgories", EidikesKathgoriesSchema);
	
	const OikogeneiakhKatastashSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	});
	const OikogeneiakhKatastashModel = model("OikogeneiakhKatastash", OikogeneiakhKatastashSchema);
	
	const KathestosApasxolhshsSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	});
	const KathestosApasxolhshsModel = model("KathestosApasxolhshs", KathestosApasxolhshsSchema);
	
	const SxeseisErgasiasSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	},
		{
		collection: "sxeseis_ergasias"
		}
	);
	const SxeseisErgasiasModel = model("SxeseisErgasias", SxeseisErgasiasSchema);
	
	const SyggenikesSxeseisSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	});
	const SyggenikesSxeseisModel = model("SyggenikesSxeseis", SyggenikesSxeseisSchema);
	
	const TheseisEythynhsSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	},
		{
		collection: "theseis_eythynhs"
		}
	);
	const TheseisEythynhsModel = model("TheseisEythynhs", TheseisEythynhsSchema);
	
	const EidikesPeriptoseisSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	});
	const EidikesPeriptoseisModel = model("EidikesPeriptoseis", EidikesPeriptoseisSchema);
	
	const ApasxolhseisBaseiSymbashsSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	});
	const ApasxolhseisBaseiSymbashsModel = model("ApasxolhseisBaseiSymbashs", ApasxolhseisBaseiSymbashsSchema);
	
	const AsfalistikesKlaseisSchema = new Schema({
		aa: { type: String, trim: true },
		etos: { type: String, trim: true },
		kodikos: { type: String, trim: true },
		perigrafh: { type: String, trim: true },
		poso: { type: Number },
		apo_orio: { type: Number },
		eos_orio: { type: Number },
		isxyei_apo: { type: Date },
		isxyei_eos: { type: Date },
	});
	const AsfalistikesKlaseisModel = model("AsfalistikesKlaseis", AsfalistikesKlaseisSchema);

	const TmhmataSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
	});
	const TmhmataModel = model("Tmhmata", TmhmataSchema);

	const EidikothtesErganhSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
	});
	const EidikothtesErganhModel = model("EidikothtesErganh", EidikothtesErganhSchema);
	
	const EidikothtesEfarmoghsSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
	});
	const EidikothtesEfarmoghsModel = model("EidikothtesEfarmoghs", EidikothtesEfarmoghsSchema);
	
	const EkpaideytikoEpipedoSchema = new Schema({
		kodikos: { type: String, unique: true},
		perigrafh: { type: String, trim: true },
	});
	const EkpaideytikoEpipedoModel = model("EkpaideytikoEpipedo", EkpaideytikoEpipedoSchema);
	
	const TypoiErgazomenonSchema = new Schema({
		kodikos: { type: String, unique: true},
		perigrafh: { type: String, trim: true },
		aa_taxinomhshs: { type: String, trim: true },
	});
	const TypoiErgazomenonModel = model("TypoiErgazomenon", TypoiErgazomenonSchema);

	const KadEfkaSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
	});
	const KadEfkaModel = model("KadEfka", KadEfkaSchema);
	
	const EidikothtesEfkaSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
	});
	const EidikothtesEfkaModel = model("EidikothtesEfka", EidikothtesEfkaSchema);
	
	const EidikesPeriptoseisEfkaSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
	});
	const EidikesPeriptoseisEfkaModel = model("EidikesPeriptoseisEfka", EidikesPeriptoseisEfkaSchema);
	
	const KpkEfkaSchema = new Schema({
		aa:{ type: String, unique: true},
		kodikos: { type: String, trim: true},
		perigrafh: { type: String, trim: true },
		isxyei_apo_etos: { type: String, trim: true, length: 4 },
		isxyei_apo_mhna: { type: String, trim: true, length: 2 },
		isxyei_eos_etos: { type: String, trim: true, length: 4 },
		isxyei_eos_mhna: { type: String, trim: true, length: 2 },
	});
	const KpkEfkaModel = model("KpkEfka", KpkEfkaSchema);

	const AntistoixishKadEidikothtesKpkEfkaSchema = new Schema({
		aa:{ type: String, unique: true},
		kodikos_kad: { type: String, trim: true},
		kodikos_eidikothtas: { type: String, trim: true},
		kodikos_kpk: { type: String, trim: true},
		isxyei_apo_etos: { type: String, trim: true, length: 4 },
		isxyei_apo_mhna: { type: String, trim: true, length: 2 },
		isxyei_eos_etos: { type: String, trim: true, length: 4 },
		isxyei_eos_mhna: { type: String, trim: true, length: 2 },
	});
	const AntistoixishKadEidikothtesKpkEfkaModel = model("AntistoixishKadEidikothtesKpkEfka", AntistoixishKadEidikothtesKpkEfkaSchema);
	
	const AntistoixishEidikhsPeriptoshsKpkEfkaSchema = new Schema({
		aa:{ type: String, unique: true},
		kodikos_eidikhs_periptoshs: { type: String, trim: true},
		kodikos_kpk_apo: { type: String, trim: true},
		kodikos_kpk_se: { type: String, trim: true},
		isxyei_apo_etos: { type: String, trim: true, length: 4 },
		isxyei_apo_mhna: { type: String, trim: true, length: 2 },
		isxyei_eos_etos: { type: String, trim: true, length: 4 },
		isxyei_eos_mhna: { type: String, trim: true, length: 2 },
	});
	const AntistoixishEidikhsPeriptoshsKpkEfkaModel = model("AntistoixishEidikhsPeriptoshsKpkEfka", AntistoixishEidikhsPeriptoshsKpkEfkaSchema);

	const ProgrammataDypaSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		kodikos_programmatos: { type: String, unique: true, index: true},
		titlos: { type: String, trim: true },
		url_link: { type: String, trim: true },
		anoixto_kleisto: { type: Boolean, default: false },
	},
	{
		collection: "programmata_dypa"
	});

	const ProgrammataDypaModel = model("ProgrammataDypa", ProgrammataDypaSchema);
	
	const KentraKostoysSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
	});
	const KentraKostoysModel = model("KentraKostoys", KentraKostoysSchema);
	
	const GenikesParametroiSchema = new Schema({
		kodikos: { type: String, unique: true },
		perigrafh: { type: String, trim: true },
		timh: { type: String, trim: true },
		ypologismos: { type: String, trim: true }
	});
	const GenikesParametroiModel = model("GenikesParametroi", GenikesParametroiSchema);
	
	const AdeiesDiamonhsSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
		typos: { type: String, trim: true },
		},
		{
		collection: "adeies_diamonhs"
		}
	);
	const AdeiesDiamonhsModel = model("AdeiesDiamonhs", AdeiesDiamonhsSchema);
	
	const ThematikaPediaSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
	});
	const ThematikaPediaModel = model("ThematikaPedia", ThematikaPediaSchema);
	
	const ThematikesEnothtesSchema = new Schema({
		kodikos: { type: String, trim: true},
		perigrafh: { type: String, trim: true },
		kodikos_sysxetishs: { type: String, trim: true },
	});
	const ThematikesEnothtesModel = model("ThematikesEnothtes", ThematikesEnothtesSchema);
	
	const ForeisEkpaideyshsSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
	});
	const ForeisEkpaideyshsModel = model("ForeisEkpaideyshs", ForeisEkpaideyshsSchema);
	
	const LanguagesSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
	});
	const LanguagesModel = model("Languages", LanguagesSchema);
	
	const ArgiesSchema = new Schema({
		team: { type: String, trim: true },
		company_kod: { type: String, trim: true },
		etos: { type: String, trim: true },
		kodikos: { type: String, trim: true },
		perigrafh: { type: String, trim: true },
		hmeromhnia: { type: Date },
		hmera: { type: String, trim: true },
		ypoxreotikh_argia: { type: Boolean, default: false },
		topikh_argia: { type: Boolean, default: false },
	});
	const ArgiesModel = model("Argies", ArgiesSchema);

	const KathgoriesErgasiasSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
		},
		{
		collection: "kathgories_ergasias"
		}
	);
	const KathgoriesErgasiasModel = model("KathgoriesErgasias", KathgoriesErgasiasSchema);
	
	const KathgoriesAdeiasSchema = new Schema({
		aa: { type: String, trim: true},
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
		prosmetratai_stis_dikaioymenes_hmeres: { type: Boolean, default: false},
	});
	const KathgoriesAdeiasModel = model("KathgoriesAdeias", KathgoriesAdeiasSchema);
	
	const EkptoshForoySchema = new Schema({
		xrhsh: { type: String, trim: true},
		aa_teknon: { type: String, trim: true},
		posoEkptoshs: { type: Number, default: 0 },
	});
	const EkptoshForoyModel = model("EkptoshForoy", EkptoshForoySchema);
	
	const Eisodhma_Pro_Foroy_MeioshsSchema = new Schema({
		xrhsh: { type: String, trim: true },
		eisfora_allhleggyhs: { type: String, trim: true },
		aa_teknon: { type: Number, default: 0 },
		poso00: { type: Number, default: 0 },
		poso01: { type: Number, default: 0 },
		poso02: { type: Number, default: 0 },
		poso03: { type: Number, default: 0 },
		poso04: { type: Number, default: 0 },
		poso05: { type: Number, default: 0 },
		poso06: { type: Number, default: 0 },
		poso07: { type: Number, default: 0 },
		poso08: { type: Number, default: 0 },
		poso09: { type: Number, default: 0 },
		poso10: { type: Number, default: 0 },
	});
	const Eisodhma_Pro_Foroy_MeioshsModel = model("Eisodhma_Pro_Foroy_Meioshs", Eisodhma_Pro_Foroy_MeioshsSchema);

	const Klimaka_ForoySchema = new Schema({
		xrhsh: { type: String, trim: true },
		apo_poso: { type: Number, default: 0 },
		eos_poso: { type: Number, default: 0 },
		syntelesths_foroy: { type: Number, default: 0 },
		syntelesths_meioshs_ekptoshs: { type: Number, default: 0 },
		syntelesths_eisforas_allhleggyhs: { type: Number, default: 0 },
	});
	const Klimaka_ForoyModel = model("Klimaka_Foroy", Klimaka_ForoySchema);

	const Typoi_ApodoxonSchema = new Schema({
		kodikos: { type: String, trim: true },
		perigrafh: { type: String, trim: true },
		epilogh: { type: Boolean, default: false },
	});
	const Typoi_ApodoxonModel = model("Typoi_Apodoxon", Typoi_ApodoxonSchema);

	const ForologikesKlimakesSchema = new Schema({
		xrhsh: { type: String, trim: true },
		kodikos: { type: String, trim: true },
		perigrafh: { type: String, trim: true },
	});
	const ForologikesKlimakesModel = model("ForologikesKlimakes", ForologikesKlimakesSchema);

	const ForeasEpikoyrikhsXorisEfkaSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
		},
		{
		collection: "foreas_epikoyrikhs_xoris_efka"
		}
	);
	const ForeasEpikoyrikhsXorisEfkaModel = model("ForeasEpikoyrikhsXorisEfka", ForeasEpikoyrikhsXorisEfkaSchema);

	const ForeasAstheneiasXorisEfkaSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
		},
		{
		collection: "foreas_astheneias_xoris_efka"
		}
	);
	const ForeasAstheneiasXorisEfkaModel = model("ForeasAstheneiasXorisEfka", ForeasAstheneiasXorisEfkaSchema);

	const IdiothtaErgoy39Par9Schema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
		},
		{
		collection: "idiothta_antisymballomenoy_ergoy_39_par_9"
		}
	);
	const IdiothtaErgoy39Par9Model = model("IdiothtaErgoy39Par9", IdiothtaErgoy39Par9Schema);

	const TypoiEpidothseonSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
		pososto_asfalismenoy: { type: Number, default: 0 },
		pososto_ergodoth: { type: Number, default: 0 },
		isxyei_apo: { type: Date },
		isxyei_eos: { type: Date },
		typos: { type: String, trim: true },
		},
		{
		collection: "typoi_epidothseon"
		}
	);
	const TypoiEpidothseonModel = model("TypoiEpidothseon", TypoiEpidothseonSchema);

	const ForeasKyriasAsfalishsSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
		},
		{
		collection: "foreas_kyrias_asfalishs"
		}
	);
	const ForeasKyriasAsfalishsModel = model("ForeasKyriasAsfalishs", ForeasKyriasAsfalishsSchema);

	const ForeasEpikoyrikhsAsfalishsSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
		},
		{
		collection: "foreas_epikoyrikhs_asfalishs"
		}
	);
	const ForeasEpikoyrikhsAsfalishsModel = model("ForeasEpikoyrikhsAsfalishs", ForeasEpikoyrikhsAsfalishsSchema);

	const ApodoxhOysiodonOronSchema = new Schema({
		kodikos: { type: String, unique: true, index: true},
		perigrafh: { type: String, trim: true },
		},
		{
		collection: "oysiodeis_oroi"
		}
	);
	const ApodoxhOysiodonOronModel = model("ApodoxhOysiodonOron", ApodoxhOysiodonOronSchema);

	module.exports = {	AdeiesDiamonhsModel,
						AntistoixishEidikhsPeriptoshsKpkEfkaModel,
						AntistoixishKadEidikothtesKpkEfkaModel,
						ApasxolhseisBaseiSymbashsModel,
						ApodoxhOysiodonOronModel,
						AsfalistikesKlaseisModel,
						ArgiesModel,
						BanksModel, 
						DhmoiModel, 
						DiadoxosErgodothsModel, 
						DoyModel, 
						DypaModel, 
						EidikesPeriptoseisEfkaModel,
						EidikesKathgoriesModel, 
						EidikesPeriptoseisModel,
						EidikothtesEfarmoghsModel,
						EidikothtesEfkaModel,
						EidikothtesErganhModel,
						Eisodhma_Pro_Foroy_MeioshsModel,
						EkpaideytikoEpipedoModel,
						EkptoshForoyModel,
						EmmesosErgodothsModel, 
						ForeasAstheneiasXorisEfkaModel,
						ForeasEpikoyrikhsXorisEfkaModel,
						ForeasEpikoyrikhsAsfalishsModel,
						ForeisEkpaideyshsModel,
						ForeasKyriasAsfalishsModel,
						ForologikesKlimakesModel,
						GenikesParametroiModel,
						IatrosErgasiasModel, 
						IdiothtaErgoy39Par9Model,
						IdiothtesModel, 
						KadEfkaModel,
						KadModel,
						KathestosApasxolhshsModel, 
						KathgoriesAdeiasModel,
						KathgoriesErgasiasModel,
						KentraKostoysModel,
						KpkEfkaModel,
						KrathseisModel, 
						LanguagesModel,
						Klimaka_ForoyModel,
						LogisthsModel, 
						NomikesMorfesModel,
						NomoiModel, 
						OikogeneiakhKatastashModel, 
						PararthmataEfkaModel, 
						PerifereiesModel, 
						PeriodsModel, 
						PoleisModel, 
						PosostaKrathseonModel, 
						ProgrammataDypaModel,
						SepeModel, 
						SxeseisErgasiasModel, 
						SyggenikesSxeseisModel, 
						TameiaModel, 
						TexnikosAsfaleiasModel, 
						ThematikaPediaModel,
						ThematikesEnothtesModel,
						TheseisEythynhsModel,
						TmhmataModel,
						Typoi_ApodoxonModel,
						TypoiDaneismoyModel,
						TypoiEpidothseonModel,
						TypoiErgazomenonModel,
						TypoiTaytothtonModel, 
						XrhseisModel, 
						YphkoothtesModel
					};

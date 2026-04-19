const { Schema: _Schema, model } = require('mongoose');

const Schema = _Schema;

const SymbaseisSchema = new Schema({
    kodikos: { type: String, unique: true, index: true },
    perigrafh: { type: String, trim: true }
});
const SymbaseisModel = model('Symbaseis', SymbaseisSchema);

const KathgoriesSymbaseonSchema = new Schema(
    {
        aa: { type: String, unique: true, index: true },
        kodikos: { type: String, trim: true },
        perigrafh: { type: String, trim: true },
        afora_thn_symbash: { type: String, trim: true }
    },
    {
        collection: 'kathgories_symbaseon'
    }
);
const KathgoriesSymbaseonModel = model('KathgoriesSymbaseon', KathgoriesSymbaseonSchema);

const EidikothtesAnaKathgoriaSymbaseonSchema = new Schema(
    {
        aa: { type: String, unique: true, index: true },
        kodikos: { type: String, trim: true },
        perigrafh: { type: String, trim: true },
        afora_thn_symbash_kathgoria: { type: String, trim: true }
    },
    {
        collection: 'eidikothtes_symbaseon'
    }
);
const EidikothtesAnaKathgoriaSymbaseonModel = model(
    'EidikothtesAnaKathgoriaSymbaseon',
    EidikothtesAnaKathgoriaSymbaseonSchema
);

const StoixeiaSymbaseonSchema = new Schema(
    {
        kodikos: { type: String, trim: true },
        perigrafh: { type: String, trim: true },
        afora_thn_symbash_kathgoria_eidikothta: { type: String, trim: true },
        poso_pososto: { type: Boolean, default: false },
        arithmos_klimakion: { type: Number },
        ypologismos_apo_klimakio: { type: Number },
        bhma_ypologismoy: { type: Number },
        poso: { type: Number },
        pososto: { type: Number },
        typos_ypologismoy: { type: String, trim: true }
    },
    {
        collection: 'stoixeia_symbaseon'
    }
);
const StoixeiaSymbaseonModel = model('StoixeiaSymbaseon', StoixeiaSymbaseonSchema);

const KlimakiaSymbaseonSchema = new Schema(
    {
        kodikos_symbashs: { type: String, trim: true },
        kodikos_kathgorias_symbashs: { type: String, trim: true },
        kodikos_eidikothtas_symbashs: { type: String, trim: true },
        kodikos_stoixeioy: { type: String, trim: true },
        klimakio: { type: String, trim: true },
        poso: { type: Number },
        isxyei_apo: { type: Date },
        isxyei_eos: { type: Date },
        praxh_katatheshs: { type: String, trim: true },
        afora_thn_symbash: { type: String, trim: true },
        afora_thn_symbash_kathgoria: { type: String, trim: true },
        afora_thn_symbash_kathgoria_eidikothta: { type: String, trim: true },
        afora_thn_symbash_kathgoria_eidikothta_stoixeio: { type: String, trim: true }
    },
    {
        collection: 'Klimakia_Symbaseon'
    }
);

// ✅ Compound index για γρήγορη αναζήτηση στο bulkWrite
KlimakiaSymbaseonSchema.index(
    {
        afora_thn_symbash_kathgoria_eidikothta_stoixeio: 1,
        klimakio: 1,
        isxyei_apo: 1,
        isxyei_eos: 1
    },
    {
        unique: true,
        name: 'idx_klimakia_unique' // προαιρετικό όνομα για εύκολη αναφορά
    }
);

const KlimakiaSymbaseonModel = model('KlimakiaSymbaseon', KlimakiaSymbaseonSchema);
module.exports = {
    SymbaseisModel,
    KathgoriesSymbaseonModel,
    EidikothtesAnaKathgoriaSymbaseonModel,
    StoixeiaSymbaseonModel,
    KlimakiaSymbaseonModel
};

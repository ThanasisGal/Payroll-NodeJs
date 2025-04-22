import { Schema as _Schema, model } from "mongoose";

const Schema = _Schema;

const SymbaseisSchema = new Schema({
  kodikos: { type: String, unique: true, index: true },
  perigrafh: { type: String, trim: true },
});
const SymbaseisModel = model("Symbaseis", SymbaseisSchema);
  
const KathgoriesSymbaseonSchema = new Schema({
  aa: { type: String, unique: true, index: true },
  kodikos: { type: String, trim: true },
  perigrafh: { type: String, trim: true },
  afora_thn_symbash: { type: String, trim: true },
});
const KathgoriesSymbaseonModel = model("KathgoriesSymbaseon", KathgoriesSymbaseonSchema);
  
const EidikothtesAnaKathgoriaSymbaseonSchema = new Schema({
  aa: { type: String, unique: true, index: true },
  kodikos: { type: String, trim: true },
  perigrafh: { type: String, trim: true },
  afora_thn_symbash_kathgoria: { type: String, trim: true },
});
const EidikothtesAnaKathgoriaSymbaseonModel = model("EidikothtesAnaKathgoriaSymbaseon", EidikothtesAnaKathgoriaSymbaseonSchema);

const StoixeiaSymbaseonSchema = new Schema({
  kodikos: { type: String, trim: true },
  perigrafh: { type: String, trim: true },
  afora_thn_symbash_kathgoria_eidikothta: { type: String, trim: true },
  poso_pososto: { type: Boolean, default: false },
  arithmos_klimakion: { type: Number },
  ypologismos_apo_klimakio: { type: Number },
  bhma_ypologismoy: { type: Number },
  poso: { type: Number },
  pososto: { type: Number },
  typos_ypologismoy: { type: String, trim: true },
});
const StoixeiaSymbaseonModel = model("StoixeiaSymbaseon", StoixeiaSymbaseonSchema);
  
const KlimakiaSymbaseonSchema = new Schema({
  kodikos_symbashs: { type: String, trim: true },
  kodikos_kathgorias_symbashs: { type: String, trim: true },
  kodikos_eidikothtas_symbashs: { type: String, trim: true },
  kodikos_stoixeioy: { type: String, trim: true },
  klimakio: { type: String, trim: true },
  poso: { type: Number },
  isxyei_apo: { type: Date },
  isxyei_eos: { type: Date },
  afora_thn_symbash: { type: String, trim: true },
  afora_thn_symbash_kathgoria: { type: String, trim: true },
  afora_thn_symbash_kathgoria_eidikothta: { type: String, trim: true },
  afora_thn_symbash_kathgoria_eidikothta_stoixeio: { type: String, trim: true },
});
const KlimakiaSymbaseonModel = model("KlimakiaSymbaseon", KlimakiaSymbaseonSchema);

export default {  SymbaseisModel,
                  KathgoriesSymbaseonModel,
                  EidikothtesAnaKathgoriaSymbaseonModel,
                  StoixeiaSymbaseonModel,
                  KlimakiaSymbaseonModel,
                };

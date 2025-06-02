const { Schema: _Schema, model } = require("mongoose");

const Schema = _Schema;

const ParamSchema = new Schema({
  usrId: { type: String, trim: true },
  usrTeam: { type: String, trim: true },
  companyId: { type: String, trim: true },
  usedPeriod: { type: String, trim: true },
  usedPeriodDescr: { type: String, trim: true },
  usedYear: { type: String, trim: true },
  appDate: { type: String, trim: true }
});
const ParamModel = model("Param", ParamSchema);
  
module.exports = {  ParamModel };

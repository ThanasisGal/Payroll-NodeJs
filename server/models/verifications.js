const { Schema: _Schema, model } = require("mongoose");

const Schema = _Schema;
const VerifySchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  token: {
    type: String,
    default: ' ',
    trim: true,
  },
  verify: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  updatedAt: {
    type: Date,
    default: Date.now(),
  },
});

const VerifyModel = model("VerifyEmail", VerifySchema);

module.exports = VerifyModel;

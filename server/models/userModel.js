const { Schema: _Schema, model } = require("mongoose");
const { USER_ROLE_CODES } = require('../constants/userRoles');

const Schema = _Schema;
const UserSchema = new Schema({
  kod: {type: String},
  firstName: {type: String, required: true, trim: true},
  lastName: {type: String, required: true, trim: true},
  email: {type: String, required: true, lowercase: true, trim: true},
  password: {type: String, required: true, trim: true},
  tel: {type: String, trim: true},
  team: {type: String, required: true, trim: true},
  privileges: {type: String, required: true, trim: true, uppercase: true, enum: USER_ROLE_CODES},
  situation: {type: String, required: true},
  details: {type: String},
  isVerified: {type: Boolean, default: false},
  isAdmin: {type: Boolean, default: false},
  createdAt: {type: Date, default: Date.now()},
  updatedAt: {type: Date, default: Date.now()},
});

const UserModel = model("User", UserSchema);

module.exports = UserModel;

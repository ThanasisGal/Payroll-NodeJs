import { Schema as _Schema, model } from "mongoose";

const Schema = _Schema;
const UserSchema = new Schema({
  kod: {type: String},
  firstName: {type: String, required: true, trim: true},
  lastName: {type: String, required: true, trim: true},
  email: {type: String, required: true, lowercase: true, trim: true},
  password: {type: String, required: true, trim: true},
  tel: {type: String, trim: true},
  team: {type: String, required: true, trim: true},
  privileges: {type: String, required: true},
  situation: {type: String, required: true},
  details: {type: String},
  isVerified: {type: Boolean, default: false},
  isAdmin: {type: Boolean, default: false},
  createdAt: {type: Date, default: Date.now()},
  updatedAt: {type: Date, default: Date.now()},
});

const UserModel = model("User", UserSchema);
export default UserModel;

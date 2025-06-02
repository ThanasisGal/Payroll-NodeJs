const { Schema: _Schema, model } = require("mongoose");

const Schema = _Schema;

const userPrivilegesSchema = new Schema({
    userId: { type: String, required: true },
    form: { type: String, required: true },
    privileges: {
        admin: { type: Boolean, default: false },
        create: { type: Boolean, default: false },
        read: { type: Boolean, default: false },
        update: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
        print: { type: Boolean, default: false },
        export: { type: Boolean, default: false }
    }
});

const UserPrivilegesModel = model("userPrivileges", userPrivilegesSchema);

const sidebarStatusSchema = new Schema({
  userId: { type: String, required: true },
  li_Id: { type: String, required: true },
  situation_A: { type: Boolean, default: false },
  situation_C: { type: Boolean, default: false },
  situation_V: { type: Boolean, default: false }
});

const SidebarStatusModel = model("sidebarStatus", sidebarStatusSchema);

module.exports = { UserPrivilegesModel, 
                 SidebarStatusModel 
               };

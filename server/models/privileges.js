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
		},
	},
	{
		collection: "User_Privileges"
	});

	userPrivilegesSchema.index({ userId: 1, form: 1 }, { unique: true });
	const UserPrivilegesModel = model("userPrivileges", userPrivilegesSchema);

	const sidebarStatusSchema = new Schema({
	userId: { type: String, required: true },
	li_Id: { type: String, required: true },
	situation_A: { type: Boolean, default: false },
	situation_C: { type: Boolean, default: false },
	situation_U: { type: Boolean, default: false },
	situation_V: { type: Boolean, default: false }
	},
	{
		collection: "Sidebar_Status"
	});


	sidebarStatusSchema.index({ userId: 1, li_Id: 1 }, { unique: true });
	const SidebarStatusModel = model("sidebarStatus", sidebarStatusSchema);

	module.exports = { 	UserPrivilegesModel, 
						SidebarStatusModel 
					 };

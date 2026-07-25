const { Schema, model } = require('mongoose');

const userPrivilegeFormCatalogSchema = new Schema(
    {
        form: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            immutable: true,
            match: /^[A-Za-z][A-Za-z0-9]*$/
        },
        formLabel: { type: String, required: true, trim: true },
        sidebarOrder: { type: Number, required: true, min: 0 },
        active: { type: Boolean, default: true },
        showInPrivileges: { type: Boolean, default: true }
    },
    { collection: 'User_Privilege_Form_Catalog' }
);

userPrivilegeFormCatalogSchema.index({ active: 1, showInPrivileges: 1, sidebarOrder: 1, form: 1 });

const UserPrivilegeFormCatalogModel = model(
    'userPrivilegeFormCatalog',
    userPrivilegeFormCatalogSchema
);

module.exports = UserPrivilegeFormCatalogModel;

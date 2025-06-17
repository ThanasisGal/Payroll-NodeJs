const { createDropdownApi } = require("./createDropdownApi");

function buildDropdownRoute(model, options = {}) {
    return createDropdownApi(model, options);
}

module.exports = {
    buildDropdownRoute,
};

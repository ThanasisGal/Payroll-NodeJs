const { ProdhlomenaOrariaModel } = require('../../models/ergazomenoi');
const {
    executeWriteModelsWithInjectedModel
} = require('./apasxoliseisPolicyPreviewApplyModelWriterService');

async function executeWriteModelsWithProdhlomenaOrariaModel({
    mongoWriteModelsPreview = {},
    options = {}
} = {}) {
    return executeWriteModelsWithInjectedModel({
        mongoWriteModelsPreview,
        options,
        model: ProdhlomenaOrariaModel
    });
}

module.exports = {
    executeWriteModelsWithProdhlomenaOrariaModel
};

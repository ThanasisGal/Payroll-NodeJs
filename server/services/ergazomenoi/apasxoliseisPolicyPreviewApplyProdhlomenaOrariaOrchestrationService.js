const {
    orchestratePolicyPreviewApply
} = require('./apasxoliseisPolicyPreviewApplyOrchestrationService');
const {
    executeWriteModelsWithProdhlomenaOrariaModel
} = require('./apasxoliseisPolicyPreviewApplyProdhlomenaOrariaModelService');

async function orchestratePolicyPreviewApplyWithProdhlomenaOrariaModel({
    mongoWriteModelsPreview = {},
    options = {},
    auditContext = {}
} = {}) {
    return orchestratePolicyPreviewApply({
        mongoWriteModelsPreview,
        options,
        auditContext,
        executeWriteModels: executeWriteModelsWithProdhlomenaOrariaModel
    });
}

module.exports = {
    orchestratePolicyPreviewApplyWithProdhlomenaOrariaModel
};

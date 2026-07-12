const {
    executeMongoWriteModelsWithInjectedWriter
} = require('./apasxoliseisPolicyPreviewApplyExecutionService');

function validateInjectedBulkWriterModel(model) {
    return Boolean(model && typeof model.bulkWrite === 'function');
}

function createInjectedModelBulkWriter(model) {
    if (!validateInjectedBulkWriterModel(model)) return undefined;

    return async (writeModels) => model.bulkWrite(writeModels, { ordered: false });
}

async function executeWriteModelsWithInjectedModel({
    mongoWriteModelsPreview = {},
    options = {},
    model
} = {}) {
    return executeMongoWriteModelsWithInjectedWriter({
        mongoWriteModelsPreview,
        options,
        writer: createInjectedModelBulkWriter(model)
    });
}

module.exports = {
    validateInjectedBulkWriterModel,
    createInjectedModelBulkWriter,
    executeWriteModelsWithInjectedModel
};

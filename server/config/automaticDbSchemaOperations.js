function automaticDbSchemaOperationsEnabled(env = process.env) {
    return env.PAYROLL_AUTOMATIC_DB_SCHEMA_OPERATIONS_ENABLED !== 'false';
}

function configureMongooseAutomaticSchemaOperations(mongoose, env = process.env) {
    const enabled = automaticDbSchemaOperationsEnabled(env);
    if (!enabled) {
        mongoose.set('autoIndex', false);
        mongoose.set('autoCreate', false);
    }
    return { enabled, autoIndex: enabled ? undefined : false, autoCreate: enabled ? undefined : false };
}

function buildMongooseConnectionOptions(baseOptions = {}, env = process.env) {
    if (automaticDbSchemaOperationsEnabled(env)) return { ...baseOptions };
    return { ...baseOptions, autoIndex: false, autoCreate: false };
}

function buildSessionStoreOptions(baseOptions = {}, env = process.env) {
    if (automaticDbSchemaOperationsEnabled(env)) return { ...baseOptions };
    return { ...baseOptions, autoRemove: 'disabled' };
}

module.exports = {
    automaticDbSchemaOperationsEnabled,
    configureMongooseAutomaticSchemaOperations,
    buildMongooseConnectionOptions,
    buildSessionStoreOptions
};

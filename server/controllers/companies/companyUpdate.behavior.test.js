const assert = require('assert');
const mongoose = require('mongoose');
const fs = require('fs-extra');
const companiesController = require('./companiesController');
const { CompaniesModel } = require('../../models/companies');
const {
    TexnikosAsfaleiasModel,
    IatrosErgasiasModel,
    LogisthsModel,
    EmmesosErgodothsModel,
    DiadoxosErgodothsModel
} = require('../../models/stathera_arxeia');

const COMPANY_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f191e810c19729de860ea';
const models = [
    CompaniesModel,
    TexnikosAsfaleiasModel,
    IatrosErgasiasModel,
    LogisthsModel,
    EmmesosErgodothsModel,
    DiadoxosErgodothsModel
];

function response() {
    return {
        statusCode: 200,
        status(value) {
            this.statusCode = value;
            return this;
        },
        json(value) {
            this.payload = value;
            return value;
        }
    };
}

function request(body = {}) {
    return {
        companyAccessScope: {
            effectiveTeam: 'TEAM1',
            companyId: COMPANY_ID,
            companyTeamFilter: 'TEAM1'
        },
        body: {
            selectedUsers: [USER_ID],
            hmeromhnia_payshs_polyetias_apo: '',
            hmeromhnia_payshs_polyetias_eos: '',
            ...body
        }
    };
}

function query(result, capture, update, options) {
    if (capture) capture.push({ update, options });
    return { exec: async () => (result instanceof Error ? Promise.reject(result) : result) };
}

async function withModelStubs(test) {
    const originals = models.map((model) => model.findOneAndUpdate);
    const originalDb = mongoose.connection.db;
    const originalStartSession = mongoose.connection.startSession;
    const originalMkdir = fs.mkdir;
    const originalRename = fs.rename;
    try {
        mongoose.connection.db = undefined;
        await test();
    } finally {
        models.forEach((model, index) => {
            model.findOneAndUpdate = originals[index];
        });
        mongoose.connection.db = originalDb;
        mongoose.connection.startSession = originalStartSession;
        fs.mkdir = originalMkdir;
        fs.rename = originalRename;
    }
}

(async () => {
    await withModelStubs(async () => {
        const writes = [];
        CompaniesModel.findOneAndUpdate = (_filter, update, options) =>
            query({ _id: COMPANY_ID }, writes, update, options);
        TexnikosAsfaleiasModel.findOneAndUpdate = (_filter, update, options) =>
            query({ _id: 'ta' }, writes, update, options);
        IatrosErgasiasModel.findOneAndUpdate = (_filter, update, options) =>
            query({ _id: 'ia' }, writes, update, options);

        const res = response();
        await companiesController.postCompanyUpdate(
            request({ kod_ta: 'TA1', kod_ia: 'IA1', hmnia_katatheshs_ta: '', isxyei_eos_ta: '',
                hmnia_katatheshs_ia: '', isxyei_eos_ia: '' }),
            res
        );
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.payload.success, true);
        assert.strictEqual(writes[0].update.$set.hmeromhnia_payshs_polyetias_apo, null);
        assert.strictEqual(writes[1].update.$set.hmnia_katatheshs, null);
        assert.strictEqual(writes[2].update.$set.isxyei_eos, null);
    });

    await withModelStubs(async () => {
        let writes = 0;
        CompaniesModel.findOneAndUpdate = () => {
            writes += 1;
            return query({ _id: COMPANY_ID });
        };
        const res = response();
        await companiesController.postCompanyUpdate(
            request({ kod_ta: 'TA1', hmnia_katatheshs_ta: 'not-a-date' }),
            res
        );
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.payload.code, 'COMPANY_UPDATE_VALIDATION_ERROR');
        assert.match(res.payload.message, /hmnia_katatheshs_ta/);
        assert.strictEqual(writes, 0);
    });

    for (const [codeField, staleDateField, Model] of [
        ['kod_ta', 'hmnia_katatheshs_ta', TexnikosAsfaleiasModel],
        ['kod_ia', 'hmnia_katatheshs_ia', IatrosErgasiasModel],
        ['kod_em_erg', 'daneismos_epa_apo_em_erg', EmmesosErgodothsModel]
    ]) {
        await withModelStubs(async () => {
            let baseWrites = 0;
            let relatedWrites = 0;
            CompaniesModel.findOneAndUpdate = () => {
                baseWrites += 1;
                return query({ _id: COMPANY_ID });
            };
            Model.findOneAndUpdate = () => {
                relatedWrites += 1;
                return query({});
            };
            const res = response();
            await companiesController.postCompanyUpdate(
                request({ [codeField]: '', [staleDateField]: 'not-a-date' }),
                res
            );
            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(baseWrites, 1);
            assert.strictEqual(relatedWrites, 0);
        });

        await withModelStubs(async () => {
            let writes = 0;
            CompaniesModel.findOneAndUpdate = () => {
                writes += 1;
                return query({ _id: COMPANY_ID });
            };
            const res = response();
            await companiesController.postCompanyUpdate(
                request({ [codeField]: 'ACTIVE', [staleDateField]: 'not-a-date' }),
                res
            );
            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.payload.code, 'COMPANY_UPDATE_VALIDATION_ERROR');
            assert.match(res.payload.message, new RegExp(staleDateField));
            assert.strictEqual(writes, 0);
        });
    }

    await withModelStubs(async () => {
        let writes = 0;
        CompaniesModel.findOneAndUpdate = () => {
            writes += 1;
            return query({ _id: COMPANY_ID });
        };
        const res = response();
        await companiesController.postCompanyUpdate(request({ selectedUsers: [] }), res);
        assert.strictEqual(res.statusCode, 400);
        assert.deepStrictEqual(res.payload, {
            success: false,
            code: 'COMPANY_USERS_REQUIRED',
            message: 'Πρέπει να επιλεγεί τουλάχιστον ένας χρήστης στη σελίδα «Διάφορα».'
        });
        assert.strictEqual(writes, 0);
    });

    await withModelStubs(async () => {
        let relatedWrites = 0;
        CompaniesModel.findOneAndUpdate = () => query(null);
        TexnikosAsfaleiasModel.findOneAndUpdate = () => {
            relatedWrites += 1;
            return query({});
        };
        const res = response();
        await companiesController.postCompanyUpdate(request({ kod_ta: 'TA1' }), res);
        assert.strictEqual(res.statusCode, 404);
        assert.strictEqual(res.payload.code, 'COMPANY_NOT_FOUND');
        assert.strictEqual(relatedWrites, 0);
    });

    await withModelStubs(async () => {
        let filesystemMutations = 0;
        fs.mkdir = async () => {
            filesystemMutations += 1;
        };
        fs.rename = async () => {
            filesystemMutations += 1;
        };
        CompaniesModel.findOneAndUpdate = () => query(new Error('database failed'));
        const originalError = console.error;
        console.error = () => {};
        try {
            const res = response();
            await companiesController.postCompanyUpdate(
                request({ sfragida: 'data:image/png;base64,fixture' }),
                res
            );
            assert.strictEqual(res.statusCode, 500);
            assert.strictEqual(filesystemMutations, 0);
        } finally {
            console.error = originalError;
        }
    });

    await withModelStubs(async () => {
        const renames = [];
        let companyWrites = 0;
        fs.mkdir = async () => {};
        fs.rename = async (from, to) => {
            renames.push({ from, to });
        };
        CompaniesModel.findOneAndUpdate = () => {
            companyWrites += 1;
            return query(
                companyWrites === 1
                    ? { _id: COMPANY_ID }
                    : new Error('stamp path database update failed')
            );
        };
        const originalError = console.error;
        console.error = () => {};
        try {
            const res = response();
            await companiesController.postCompanyUpdate(
                request({
                    eponymia: 'fixture',
                    sfragida: 'data:image/png;base64,fixture'
                }),
                res
            );
            assert.strictEqual(res.statusCode, 500);
            assert.strictEqual(renames.length, 2);
            assert.strictEqual(renames[1].from, renames[0].to);
            assert.strictEqual(renames[1].to, renames[0].from);
        } finally {
            console.error = originalError;
        }
    });

    await withModelStubs(async () => {
        const logs = [];
        const originalError = console.error;
        CompaniesModel.findOneAndUpdate = () => query({ _id: COMPANY_ID });
        TexnikosAsfaleiasModel.findOneAndUpdate = () => query(new Error('private database detail'));
        console.error = (...args) => logs.push(args);
        try {
            const res = response();
            await companiesController.postCompanyUpdate(request({ kod_ta: 'TA1' }), res);
            assert.strictEqual(res.statusCode, 500);
            assert.deepStrictEqual(res.payload, {
                success: false,
                code: 'COMPANY_UPDATE_FAILED',
                message: 'Η ενημέρωση της εταιρείας απέτυχε.'
            });
            assert.ok(logs.some((entry) =>
                entry[1]?.stage === 'TEXNIKOS_ASFALEIAS_UPSERT' &&
                entry[1]?.message === 'private database detail'
            ));
        } finally {
            console.error = originalError;
        }
    });

    await withModelStubs(async () => {
        let storedName = 'before';
        let snapshot;
        mongoose.connection.db = {
            admin: () => ({
                command: async () => ({
                    setName: 'rs0',
                    logicalSessionTimeoutMinutes: 30
                })
            })
        };
        mongoose.connection.startSession = async () => ({
            async withTransaction(callback) {
                snapshot = storedName;
                try {
                    await callback();
                } catch (error) {
                    storedName = snapshot;
                    throw error;
                }
            },
            async endSession() {}
        });
        CompaniesModel.findOneAndUpdate = (_filter, update, options) => {
            assert.ok(options.session);
            storedName = update.$set.eponymia;
            return query({ _id: COMPANY_ID });
        };
        TexnikosAsfaleiasModel.findOneAndUpdate = () => query(new Error('related failed'));
        const originalError = console.error;
        console.error = () => {};
        try {
            const res = response();
            await companiesController.postCompanyUpdate(
                request({ eponymia: 'after', kod_ta: 'TA1' }),
                res
            );
            assert.strictEqual(res.statusCode, 500);
            assert.strictEqual(storedName, 'before');
        } finally {
            console.error = originalError;
        }
    });

    console.log('PASS company update controller validation, stages, not-found and rollback');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

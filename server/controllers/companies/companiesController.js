const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const fs = require('fs-extra');
const path = require('path');

const Models_A = require('../../models/param');
const Models_B = require('../../models/privileges');
const Models_C = require('../../models/companies');
const UserModel = require('../../models/userModel');
const Models = require('../../models/stathera_arxeia');
const {
    CompanyUpdateValidationError,
    CompanyUsersRequiredError,
    normalizeCompanyUpdatePayload
} = require('../../services/companies/companyUpdateNormalization');
const { presentCompanyForEdit } = require('../../services/companies/companyEditPresentation');

const { ParamModel } = Models_A;
const { UserPrivilegesModel } = Models_B;
const { CompaniesModel } = Models_C;

const {
    PerifereiesModel,
    NomikesMorfesModel,
    PararthmataEfkaModel,
    DoyModel,
    TameiaModel,
    KadModel,
    TexnikosAsfaleiasModel,
    IatrosErgasiasModel,
    LogisthsModel,
    EmmesosErgodothsModel,
    DiadoxosErgodothsModel
} = Models;

const relatedUpdateModels = Object.freeze({
    texnikosAsfaleias: TexnikosAsfaleiasModel,
    iatrosErgasias: IatrosErgasiasModel,
    logisths: LogisthsModel,
    emmesosErgodoths: EmmesosErgodothsModel,
    diadoxosErgodoths: DiadoxosErgodothsModel
});

let redir,
    sTerm = '';

// OS check
const isWindows = process.platform === 'win32';

/* ---------------------------- helpers ---------------------------------- */
const normalizeStr = (v) => String(v ?? '').trim();
const normalizeUpper = (v) => normalizeStr(v).toUpperCase();

const stampsDir = (team) =>
    isWindows
        ? path.join('C:\\Payroll-NodeJs\\public\\stamps\\teams', team)
        : path.join('/home/ubuntu/Payroll-NodeJs/public/stamps/teams', team);

async function renameAndMoveImage(
    originalPath,
    companyId,
    { eponymia, fatherName, firstName },
    team
) {
    const dir = stampsDir(team);
    await fs.mkdir(dir, { recursive: true });
    const newName = `${companyId}_${normalizeStr(eponymia)}_${normalizeStr(fatherName).substring(0, 3)}_${normalizeStr(firstName)}_sfragida.png`;
    const dest = path.join(dir, newName);
    await fs.rename(originalPath, dest);
    return dest;
}

async function upsertSafe(Model, filter, set, setOnInsert = {}, options = {}) {
    const baseOpts = { upsert: true, new: true, setDefaultsOnInsert: true, ...options };
    try {
        return await Model.findOneAndUpdate(
            filter,
            { $set: set, $setOnInsert: setOnInsert },
            baseOpts
        ).exec();
    } catch (e) {
        // handle race: second writer may see E11000
        if (e?.code === 11000) {
            return await Model.findOneAndUpdate(
                filter,
                { $set: set },
                { new: true, ...options }
            ).exec();
        }
        throw e;
    }
}

async function supportsTransactions(connection = mongoose.connection) {
    try {
        const hello = await connection.db.admin().command({ hello: 1 });
        return Boolean(
            (hello.setName || hello.msg === 'isdbgrid') &&
                Number(hello.logicalSessionTimeoutMinutes) > 0
        );
    } catch (_) {
        return false;
    }
}

function logCompanyUpdateError(stage, error) {
    console.error('[COMPANY_UPDATE]', {
        stage,
        name: error?.name,
        field: error?.path || error?.fieldName,
        message: error?.message
    });
}

/* -------------------------- controller --------------------------------- */
class companiesController {
    static mainAppForm = async (req, res) => {
        const locals = { title: 'Payroll', description: 'Web Payroll Solutions' };
        res.render('mainapp', { locals });
    };

    static mainCompaniesForm = async (req, res) => {
        const locals = { title: 'Εταιρείες', description: 'Web Payroll Solutions' };

        const sessionUserTeam = req.session.userTeam;
        const sessionUserId = req.session.userId;
        // const basePer = Number(process.env.EGGRAFES) || 10;
        const basePer = 500;
        const perx = Math.min(5, Math.max(1, parseInt(req.query.perx, 10) || 1));
        const perPage = basePer * perx;
        const page = Math.max(Number(req.query.page) || 1, 1);

        const showInactive =
            req.query.anenergh === 'on' ||
            req.query.anenergh === 'true' ||
            req.query.anenergh === '1';

        if (!ObjectId.isValid(sessionUserId)) throw new Error('invalid sessionUserId');

        const userId = ObjectId.createFromHexString(sessionUserId);

        try {
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: 'Companies'
            }).lean();

            const matchBase = {
                team: sessionUserTeam,
                users: userId,
                ...(showInactive ? {} : { anenergh: { $ne: true } })
            };

            const countResults = await CompaniesModel.aggregate([
                { $match: matchBase },
                { $count: 'total' }
            ]).exec();

            const totalRecords = countResults[0]?.total || 0;
            const totalPages = Math.max(Math.ceil(totalRecords / perPage), 1);
            const currentPage = Math.min(page, totalPages);
            const skipRecords = (currentPage - 1) * perPage;

            const company = await CompaniesModel.aggregate([
                { $match: matchBase },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'users',
                        foreignField: '_id',
                        as: 'userData'
                    }
                },
                { $sort: { eponymia: 1, firstname: 1 } },
                { $skip: skipRecords },
                { $limit: perPage }
            ]).exec();

            res.render('companies/genikastoixeia/companies', {
                userPrivileges: userPrivileges?.privileges || {},
                locals,
                company,
                current: currentPage,
                pages: totalPages,
                perx,
                basePer,
                entries: perPage,
                totalRecs: totalRecords,
                showInactive
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Σφάλμα');
        }
    };

    static searchPostCompanies = async (req, res) => {
        const locals = { title: 'Αναζήτηση Εταιρειών', description: 'Web Payroll Solutions' };

        try {
            const searchTerm = normalizeStr(req.body.searchTerm || '');
            const sessionUserTeam = req.session.userTeam;
            const sessionUserId = req.session.userId;

            if (!sessionUserTeam) {
                return res.redirect('/');
            }

            const perPage = Math.max(Number(process.env.EGGRAFES) || 10, 1);
            const page = Math.max(Number(req.query.page) || 1, 1);

            const sTerm = searchTerm.replace(/[^a-zα-ωA-ZΑ-Ω0-9]/g, '');

            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: 'Companies'
            }).lean();

            if (!ObjectId.isValid(sessionUserId)) throw new Error('invalid sessionUserId');

            const userId = ObjectId.createFromHexString(sessionUserId);

            const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(escapedSearchTerm, 'i');

            const filter = {
                $and: [
                    { team: sessionUserTeam },
                    { users: userId },
                    {
                        $or: [
                            { kod: re },
                            { eponymia: re },
                            { firstname: re },
                            { fathername: re },
                            { activity: re },
                            { afm: re }
                        ]
                    }
                ]
            };

            const totalRecords = await CompaniesModel.countDocuments(filter);

            const totalPages = Math.max(Math.ceil(totalRecords / perPage), 1);
            const currentPage = Math.min(page, totalPages);
            const skipRecords = (currentPage - 1) * perPage;

            const companyFilteredRecs = await CompaniesModel.find(filter)
                .sort({ eponymia: 1, firstname: 1 })
                .skip(skipRecords)
                .limit(perPage)
                .lean();

            const highlight = companiesController.highlightText;

            const highlightedRecords = companyFilteredRecs.map((r) => ({
                ...r,
                kod: highlight(r.kod || '', searchTerm),
                eponymia: highlight(r.eponymia || '', searchTerm),
                firstname: highlight(r.firstname || '', searchTerm),
                fathername: highlight(r.fathername || '', searchTerm),
                activity: highlight(r.activity || '', searchTerm),
                afm: highlight(r.afm || '', searchTerm)
            }));

            res.render('companies/genikastoixeia/search', {
                companyFilteredRecs: highlightedRecords,
                locals,
                current: currentPage,
                pages: totalPages,
                sTerm,
                userPrivileges
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Σφάλμα');
        }
    };

    static searchGetCompanies = async (req, res) => {
        const locals = { title: 'Αναζήτηση Εταιρειών', description: 'Web Payroll Solutions' };

        try {
            const searchTerm = normalizeStr(req.query.searchTerm || req.body?.searchTerm || '');
            const sessionUserTeam = req.session.userTeam;
            const sessionUserId = req.session.userId;

            if (!sessionUserTeam) {
                return res.redirect('/');
            }

            const perPage = Math.max(Number(process.env.EGGRAFES) || 10, 1);
            const page = Math.max(Number(req.query.page) || 1, 1);

            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: 'Companies'
            }).lean();

            if (!ObjectId.isValid(sessionUserId)) throw new Error('invalid sessionUserId');

            const userId = ObjectId.createFromHexString(sessionUserId);

            const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(escapedSearchTerm, 'i');

            const filter = {
                $and: [
                    { team: sessionUserTeam },
                    { users: userId },
                    {
                        $or: [
                            { kod: re },
                            { eponymia: re },
                            { firstname: re },
                            { fathername: re },
                            { activity: re },
                            { afm: re }
                        ]
                    }
                ]
            };

            const totalRecords = await CompaniesModel.countDocuments(filter);
            const totalPages = Math.max(Math.ceil(totalRecords / perPage), 1);
            const currentPage = Math.min(page, totalPages);
            const skipRecords = (currentPage - 1) * perPage;

            const companyFilteredRecs = await CompaniesModel.find(filter)
                .sort({ eponymia: 1, firstname: 1 })
                .skip(skipRecords)
                .limit(perPage)
                .lean();

            const highlight = companiesController.highlightText;

            const highlightedRecords = companyFilteredRecs.map((r) => ({
                ...r,
                kod: highlight(r.kod || '', searchTerm),
                eponymia: highlight(r.eponymia || '', searchTerm),
                firstname: highlight(r.firstname || '', searchTerm),
                fathername: highlight(r.fathername || '', searchTerm),
                activity: highlight(r.activity || '', searchTerm),
                afm: highlight(r.afm || '', searchTerm)
            }));

            res.render('companies/genikastoixeia/search', {
                companyFilteredRecs: highlightedRecords,
                locals,
                current: currentPage,
                pages: totalPages,
                sTerm: searchTerm,
                userPrivileges
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Σφάλμα');
        }
    };

    static addCompanyForm = async (req, res) => {
        const locals = { title: 'Προσθήκη Νέας Εταιρείας', description: 'Web Payroll Solutions' };
        try {
            const data = await PerifereiesModel.find().sort('kodikos');
            res.render('companies/genikastoixeia/add', {
                locals,
                data,
                mode: 'add',
                context: 'company',
                rec: {}
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Σφάλμα');
        }
    };

    static checkAfmEtaireias = async (req, res) => {
        try {
            const { afm } = req.body;
            const doc = await CompaniesModel.findOne({ afm }).lean();
            if (doc) return res.json(doc);
            return res.json(null);
        } catch (err) {
            res.status(500).send('Σφάλμα κατά την αναζήτηση στη βάση δεδομένων');
        }
    };

    static postCompanyForm = async (req, res) => {
        const sessionUserTeam = req.companyAccessScope.effectiveTeam;
        const sessionUserId = req.companyAccessScope.userId;

        const formData = req.body;
        if (!formData.selectedUsers || formData.selectedUsers.length === 0) {
            return res.json({ success: false });
        }

        try {
            // produce next kod
            const lastRecord = await CompaniesModel.find({ team: sessionUserTeam })
                .sort({ _id: -1 })
                .limit(1)
                .lean();
            let kodValue = lastRecord[0]?.kod ? parseInt(lastRecord[0].kod, 10) : 0;
            const aa_kod = (isNaN(kodValue) ? 0 : kodValue) + 1;

            const newCompany = new CompaniesModel({
                team: sessionUserTeam,
                user_id: sessionUserId,
                kod: aa_kod.toString().padStart(4, '0'),
                eponymia: formData.eponymia,
                firstname: formData.firstName,
                fathername: formData.fatherName,
                activity: formData.activity,
                afm: formData.afm,
                adt: formData.adt,
                titlos: formData.titlos,
                odos: formData.odos,
                arithmos: formData.arithmos,
                tk: formData.tk,
                perifereia: formData.perifereies,
                nomos: formData.nomos,
                dhmos: formData.dhmos,
                polh: formData.polh,
                thlefono: formData.thlefono,
                fax: formData.fax,
                email: formData.email,
                anenergh: formData.anenergh,
                nomikh_morfh: formData.nomikhmorfh_stathera,
                pararthma_efka: formData.pararthmaefka_stathera,
                doy_company: formData.doy_stathera,
                tameio1: formData.kodikos_tameioy1,
                tameio2: formData.kodikos_tameioy2,
                tameio3: formData.kodikos_tameioy3,
                tameio4: formData.kodikos_tameioy4,
                ame1: formData.ame1,
                ame2: formData.ame2,
                ame3: formData.ame3,
                ame4: formData.ame4,
                kad1: formData.koddrast1,
                kad2: formData.koddrast2,
                kad3: formData.koddrast3,
                kad4: formData.koddrast4,
                kad5: formData.koddrast5,
                kad6: formData.koddrast6,
                texnikos_asfaleias: formData.kod_ta,
                iatros_ergasias: formData.kod_ia,
                logisths: formData.kod_lo,
                doy_logisth: formData.doy_logisths,
                emmesos_ergodoths: formData.kod_em_erg,
                diadoxos_ergodoths: formData.kod_diad_erg,
                oikodomika: formData.oikodomika,
                doropasxa_apd: formData.doropasxa_apd,
                doroxrist_apd: formData.doroxrist_apd,
                ypologismos_epi_pragmatikoy_oromisthioy:
                    formData.ypologismos_epi_pragmatikoy_oromisthioy,
                apasxolhsh_kata_tis_argies: formData.apasxolhsh_kata_tis_argies,
                leitoyrgia_stis_mh_ypoxreotikes_argies:
                    formData.leitoyrgia_stis_mh_ypoxreotikes_argies === true,
                apousies_epireazoun_asfalistikes_hmeres:
                    formData.apousies_epireazoun_asfalistikes_hmeres === true,
                apoysies_meionoyn_apodoxes: formData.apoysies_meionoyn_apodoxes === true,
                hmeromhnia_payshs_polyetias_apo: formData.hmeromhnia_payshs_polyetias_apo,
                hmeromhnia_payshs_polyetias_eos: formData.hmeromhnia_payshs_polyetias_eos,
                xronos_epitrepomenhs_proorhs_apoxorhshs_se_lepta:
                    formData.xronos_epitrepomenhs_proorhs_apoxorhshs_se_lepta,
                tropos_ypologismoy_pragmatikoy_oromisthioy:
                    formData.tropos_ypologismoy_pragmatikoy_oromisthioy,
                keimeno_exoflhshs: formData.keimeno_exoflhshs,
                users: formData.selectedUsers,
                sfragida: formData.sfragida
            });

            // upserts for related entities (race-safe)
            const team = normalizeUpper(sessionUserTeam);

            if (formData.kod_ta) {
                const kod = normalizeUpper(formData.kod_ta);
                await upsertSafe(
                    TexnikosAsfaleiasModel,
                    { team, kodikos: kod },
                    {
                        company_kod: aa_kod,
                        eponymo: formData.eponymo_ta,
                        onoma: formData.onoma_ta,
                        afm: formData.afm_ta,
                        dieythynsh: formData.dieythynsh_ta,
                        thlefono: formData.thlefono_ta,
                        ores: formData.ores_ta,
                        ap_katatheshs: formData.ap_katatheshs_ta,
                        hmnia_katatheshs: formData.hmnia_katatheshs_ta,
                        isxyei_eos: formData.isxyei_eos_ta
                    },
                    { team, kodikos: kod }
                );
            }

            if (formData.kod_ia) {
                const kod = normalizeUpper(formData.kod_ia);
                await upsertSafe(
                    IatrosErgasiasModel,
                    { team, kodikos: kod },
                    {
                        company_kod: aa_kod,
                        eponymo: formData.eponymo_ia,
                        onoma: formData.onoma_ia,
                        afm: formData.afm_ia,
                        dieythynsh: formData.dieythynsh_ia,
                        thlefono: formData.thlefono_ia,
                        ores: formData.ores_ia,
                        ap_katatheshs: formData.ap_katatheshs_ia,
                        hmnia_katatheshs: formData.hmnia_katatheshs_ia,
                        isxyei_eos: formData.isxyei_eos_ia
                    },
                    { team, kodikos: kod }
                );
            }

            if (formData.kod_lo) {
                const kod = normalizeUpper(formData.kod_lo);
                await upsertSafe(
                    LogisthsModel,
                    { team, kodikos: kod },
                    {
                        company_kod: aa_kod,
                        eponymo: formData.eponymo_lo,
                        onoma: formData.onoma_lo,
                        afm: formData.afm_lo,
                        dieythynsh: formData.dieythynsh_lo,
                        thlefono: formData.thlefono_lo,
                        doy: formData.doy_logisths,
                        arithmos_adeias: formData.arithmos_adeias_lo,
                        kathgoria_adeias: formData.kathgoria_adeias_lo
                    },
                    { team, kodikos: kod }
                );
            }

            if (formData.kod_em_erg) {
                const kod = normalizeUpper(formData.kod_em_erg);
                await upsertSafe(
                    EmmesosErgodothsModel,
                    { team, kodikos: kod },
                    {
                        company_kod: aa_kod,
                        eponymo: formData.eponymo_em_erg,
                        onoma: formData.onoma_em_erg,
                        dieythynsh: formData.dieythynsh_em_erg,
                        thlefono: formData.thlefono_em_erg,
                        afm: formData.afm_em_erg,
                        doy: formData.doy_em_erg,
                        titlos: formData.titlos_em_erg,
                        nomikhMorfh: formData.nomikhmorfh_emmesosErgodoths,
                        drasthriothta: formData.drasthriothta_em_erg,
                        email: formData.email_em_erg,
                        daneismosApo: formData.daneismos_epa_apo_em_erg,
                        daneismosEos: formData.daneismos_epa_eos_em_erg
                    },
                    { team, kodikos: kod }
                );
            }

            if (formData.kod_diad_erg) {
                const kod = normalizeUpper(formData.kod_diad_erg);
                await upsertSafe(
                    DiadoxosErgodothsModel,
                    { team, kodikos: kod },
                    {
                        eponymo: formData.eponymo_diad_erg,
                        onoma: formData.onoma_diad_erg,
                        dieythynsh: formData.dieythynsh_diad_erg,
                        thlefono: formData.thlefono_diad_erg,
                        afm: formData.afm_diad_erg,
                        doy: formData.doy_diad_erg,
                        titlos: formData.titlos_diad_erg,
                        nomikhMorfh: formData.nomikhmorfh_diadoxosErgodoths,
                        drasthriothta: formData.drasthriothta_diad_erg,
                        email: formData.email_diad_erg
                    },
                    { team, kodikos: kod }
                );
            }

            const savedCompany = await CompaniesModel.create(newCompany);
            const companyId = savedCompany._id.toString();

            // handle stamp
            const originalPath = isWindows
                ? 'C:\\stamps\\sfragida.png'
                : '/home/ubuntu/stamps/sfragida.png';
            let imagePath = '';
            if (formData.sfragida && normalizeStr(formData.sfragida) !== '') {
                const formDataValues = {
                    eponymia: formData.eponymia,
                    fatherName: formData.fatherName,
                    firstName: formData.firstName
                };
                try {
                    imagePath = await renameAndMoveImage(
                        originalPath,
                        companyId,
                        formDataValues,
                        sessionUserTeam
                    );
                } catch (_) {
                    imagePath = '';
                }
            }

            if (imagePath) {
                await CompaniesModel.findByIdAndUpdate(
                    companyId,
                    { $set: { imagePath } },
                    { new: true }
                ).exec();
            }

            return res.json({ success: true, redirectUrl: '/companies/genikastoixeia' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ success: false, message: 'Σφάλμα δημιουργίας' });
        }
    };

    static choiseCompanies = async (req, res) => {
        const locals = { title: 'Payroll', description: 'Web Payroll Solutions' };
        const sessionUserTeam = req.session.userTeam;
        const sessionUserId = req.session.userId;

        try {
            const companies = await CompaniesModel.findById(req.params.id).lean();
            const parameter = await ParamModel.findOne({ usrId: sessionUserId }).lean();

            if (!parameter) {
                await new ParamModel({
                    usrId: sessionUserId,
                    usrTeam: sessionUserTeam,
                    companyId: req.params.id,
                    usedPeriod: '',
                    usedYear: '',
                    appDate: ''
                }).save();
            } else {
                await ParamModel.findByIdAndUpdate(parameter._id, {
                    usrId: sessionUserId,
                    usrTeam: sessionUserTeam,
                    companyId: req.params.id,
                    usedPeriod: parameter.usedPeriod,
                    usedYear: parameter.usedYear,
                    appDate: parameter.appDate
                }).exec();
            }

            req.session.companyInUse = req.params.id;
            req.session.companyDescription = `${companies.eponymia} ${companies.firstname}`;
            req.session.companyKodikos = companies.kod;

            redir = 'mainapp';
        } catch (error) {
            await res.flash(
                'warning',
                'Αδυναμία Επιλογής Εταιρείας. Επικοινωνείστε με τον Διαχειριστή'
            );
            redir = 'companies/companies/genikastoixeia';
        }

        res.render(redir, { bodyClass: 'home-bg-cdn', locals });
    };

    static editCompanyForm = async (req, res) => {
        const locals = { title: 'Διόρθωση Εταιρείας', description: 'Web Payroll Solutions' };

        try {
            const [perifereies, nomikes_morfes, pararthmata_efka, doys, tameia] = await Promise.all(
                [
                    PerifereiesModel.find().sort('perigrafh'),
                    NomikesMorfesModel.find().sort('perigrafh'),
                    PararthmataEfkaModel.find().sort('perigrafh'),
                    DoyModel.find().sort('perigrafh'),
                    TameiaModel.find().sort('perigrafh')
                ]
            );

            const companyId = req.params.id;
            let companyData = await CompaniesModel.findById(companyId).lean();
            companyData = presentCompanyForEdit(companyData);

            for (let i = 1; i <= 6; i++) companyData[`koddrast${i}`] = companyData[`kad${i}`] || '';
            companyData.nomikhmorfh_stathera = companyData.nomikh_morfh || '';
            companyData.pararthmaefka_stathera = companyData.pararthma_efka || '';
            companyData.doy_stathera = companyData.doy_company || '';
            for (let i = 1; i <= 4; i++)
                companyData[`kodikos_tameioy${i}`] = companyData[`tameio${i}`] || '';

            const logisthsData = await LogisthsModel.findOne({
                kodikos: companyData.logisths
            }).lean();
            companyData.doy_logisths = logisthsData?.doy || '';

            const emmesosErgodothsData = await EmmesosErgodothsModel.findOne({
                kodikos: companyData.emmesos_ergodoths
            }).lean();
            companyData.nomikhmorfh_emmesoyErgodoth = emmesosErgodothsData?.nomikhMorfh || '';

            const diadoxosErgodothsData = await DiadoxosErgodothsModel.findOne({
                kodikos: companyData.diadoxos_ergodoths
            }).lean();
            companyData.nomikhmorfh_diadoxoyErgodoth = diadoxosErgodothsData?.nomikhMorfh || '';

            const mimeType = companyData.sfragida
                ? companyData.sfragida.split(';')[0].split(':')[1]
                : '';

            res.render('companies/genikastoixeia/edit', {
                locals,
                perifereies,
                nomikes_morfes,
                pararthmata_efka,
                doys,
                tameia,
                mode: 'edit',
                context: 'company',
                company: companyData,
                rec: companyData,
                mimeType
            });
        } catch (err) {
            console.error('editCompanyForm error →', err);
            res.status(500).send('Σφάλμα κατά τη φόρτωση δεδομένων.');
        }
    };

    static getCompanyKads = async (req, res) => {
        try {
            const companyId = req.params.companyId;
            const companyData = await CompaniesModel.findById(
                companyId,
                'kad1 kad2 kad3 kad4 kad5 kad6'
            ).lean();
            res.json(companyData);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Σφάλμα κατά την ανάκτηση των ΚΑΔ' });
        }
    };

    static getKadForEditForm = async (req, res) => {
        try {
            const prefix = normalizeStr(req.query.prefix);
            const results = await KadModel.find({
                kodikos: mongoose.trusted({ $regex: `^${prefix}` })
            });
            res.json(results);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Σφάλμα κατά την ανάκτηση των ΚΑΔ' });
        }
    };

    static getCompanies = async (req, res) => {
        try {
            const companyId = req.params.companyId;
            const companyData = await CompaniesModel.findById(companyId).lean();
            res.json(companyData);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Σφάλμα κατά την ανάκτηση των λογιστών' });
        }
    };

    static populateCompanyUsers = async (req, res) => {
        try {
            const companyId = req.params.companyId;
            const companyUsers = await CompaniesModel.findById(companyId).populate('users');
            res.json(companyUsers);
        } catch (error) {
            res.json(null);
        }
    };

    static getAllUsersByTeam = async (req, res) => {
        try {
            const companyTeam = req.params.companyTeam;
            const user = await UserModel.find({ team: companyTeam });
            res.json(user);
        } catch (error) {
            res.json([]);
        }
    };

    static postCompanyUpdate = async (req, res) => {
        const sessionUserTeam = req.companyAccessScope.effectiveTeam;
        const companyId = req.companyAccessScope.companyId;
        const formData = req.body;
        let normalized;
        try {
            normalized = normalizeCompanyUpdatePayload(formData);
        } catch (error) {
            if (error instanceof CompanyUsersRequiredError) {
                return res.status(400).json({
                    success: false,
                    code: 'COMPANY_USERS_REQUIRED',
                    message: error.message
                });
            }
            if (error instanceof CompanyUpdateValidationError) {
                return res.status(400).json({
                    success: false,
                    code: 'COMPANY_UPDATE_VALIDATION_ERROR',
                    message: error.message
                });
            }
            logCompanyUpdateError('COMPANY_BASE_UPDATE', error);
            return res.status(500).json({
                success: false,
                code: 'COMPANY_UPDATE_FAILED',
                message: 'Η ενημέρωση της εταιρείας απέτυχε.'
            });
        }

        const team = normalizeUpper(sessionUserTeam);
        let stage = 'COMPANY_BASE_UPDATE';

        const executeWrites = async (session = null) => {
            const options = { new: true, runValidators: true, ...(session ? { session } : {}) };
            stage = 'COMPANY_BASE_UPDATE';
            const updatedCompany = await CompaniesModel.findOneAndUpdate(
                { _id: companyId, team: req.companyAccessScope.companyTeamFilter },
                { $set: normalized.company },
                options
            ).exec();
            if (!updatedCompany) {
                const notFound = new Error('Company not found in scoped update');
                notFound.code = 'COMPANY_NOT_FOUND';
                throw notFound;
            }

            for (const operation of normalized.relatedOperations) {
                stage = operation.stage;
                const Model = relatedUpdateModels[operation.modelKey];
                await upsertSafe(
                    Model,
                    { team, kodikos: operation.kod },
                    operation.payload,
                    { team, kodikos: operation.kod },
                    session ? { session } : {}
                );
            }
        };

        let session;
        try {
            if (await supportsTransactions()) {
                session = await mongoose.connection.startSession();
                await session.withTransaction(() => executeWrites(session));
            } else {
                await executeWrites();
            }
            if (formData.sfragida) {
                const originalPath = isWindows
                    ? 'C:\\stamps\\sfragida.png'
                    : '/home/ubuntu/stamps/sfragida.png';
                let movedPath;
                try {
                    await fs.mkdir(stampsDir(sessionUserTeam), { recursive: true });
                    movedPath = await renameAndMoveImage(
                        originalPath,
                        companyId,
                        {
                            eponymia: normalizeStr(formData.eponymia),
                            fatherName: normalizeStr(formData.fatherName).substring(0, 3),
                            firstName: normalizeStr(formData.firstName)
                        },
                        sessionUserTeam
                    );
                    stage = 'COMPANY_SFRAGIDA_PATH_UPDATE';
                    const stampUpdated = await CompaniesModel.findOneAndUpdate(
                        { _id: companyId, team: req.companyAccessScope.companyTeamFilter },
                        { $set: { imagePath: movedPath } },
                        { new: true, runValidators: true }
                    ).exec();
                    if (!stampUpdated) {
                        const notFound = new Error('Company not found during stamp path update');
                        notFound.code = 'COMPANY_NOT_FOUND';
                        throw notFound;
                    }
                } catch (error) {
                    if (movedPath) {
                        try {
                            await fs.rename(movedPath, originalPath);
                        } catch (compensationError) {
                            logCompanyUpdateError('COMPANY_SFRAGIDA_COMPENSATION', compensationError);
                        }
                        throw error;
                    }
                }
            }
            return res.json({ success: true, redirectUrl: '/companies/genikastoixeia' });
        } catch (error) {
            logCompanyUpdateError(stage, error);
            if (error?.code === 'COMPANY_NOT_FOUND') {
                return res.status(404).json({
                    success: false,
                    code: 'COMPANY_NOT_FOUND',
                    message: 'Η εταιρεία δεν βρέθηκε ή δεν είναι διαθέσιμη στον χρήστη.'
                });
            }
            if (error instanceof CompanyUpdateValidationError || error?.name === 'CastError') {
                const fieldName = error.fieldName || error.path || 'άγνωστο';
                return res.status(400).json({
                    success: false,
                    code: 'COMPANY_UPDATE_VALIDATION_ERROR',
                    message: `Μη έγκυρη τιμή στο πεδίο ${fieldName}.`
                });
            }
            return res.status(500).json({
                success: false,
                code: 'COMPANY_UPDATE_FAILED',
                message: 'Η ενημέρωση της εταιρείας απέτυχε.'
            });
        } finally {
            if (session) await session.endSession();
        }
    };

    static deleteCompany = async (req, res) => {
        try {
            await CompaniesModel.deleteOne({ _id: req.params.id });
            res.json({ success: true, redirectUrl: '/companies/genikastoixeia' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Σφάλμα διαγραφής' });
        }
    };

    static highlightText(text = '', term = '') {
        const highlightStartTag = "<span class='highlight'>";
        const highlightEndTag = '</span>';
        const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!safe) return text;
        const regex = new RegExp(`(${safe})`, 'gi');
        return String(text).replace(regex, `${highlightStartTag}$1${highlightEndTag}`);
    }
}

module.exports = companiesController;

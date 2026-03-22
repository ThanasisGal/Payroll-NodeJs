const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs-extra');
const logger = require('../../utils/logger');
const os = require('os');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

const { s3Client } = require('../../config/aws'); // ✅ from server/controllers/ergazomenoi -> server/config/aws.js
const { GetObjectCommand } = require('@aws-sdk/client-s3');

const Models_A = require('../../models/stathera_arxeia');
const Models_B = require('../../models/privileges');
const Models_C = require('../../models/companies');
const Models_D = require('../../models/ergazomenoi');
const Models_E = require('../../models/pdfDocument');

const { KrathseisModel, PerifereiesModel, GenikesParametroiModel, ForologikesKlimakesModel } =
    Models_A;

const { UserPrivilegesModel } = Models_B;

const { CompaniesModel, YpokatasthmataModel, PasswordsModel, NomimoiEkprosopoiModel } = Models_C;

const { ErgazomenoiModel, ProdhlomenaOrariaModel, IstorikoProslhpseonAllagonModel } = Models_D;

const { pdfDocumentl } = Models_E;

// ✅ IMPORTS
const { savePdfFromBase64 } = require('../../utils/pdfHandler');
const { addPdfUrlsToErgazomenos } = require('../../utils/s3UrlHelper');
const { getUserContext } = require('../../utils/userContext');
const { generatePresignedUrl, downloadS3UriToTempFile, isS3Url } = require('../../utils/s3Helper');

let nextPageSearchTerm = '';

const fieldsStoixeionSymbashs = [
    'stoixeio_symbashs',
    'poso_symbashs',
    'poso_symbashs_basei_oron_ergasias'
];
const fieldsKrathseon = ['krathsh', 'ama_krathshs'];
const fieldsKrathseis = ['krathsh'];
// const checkboxFields = new Set(['repo', 'argia']); // Ορίζουμε ποια fields είναι checkboxes
const numberFields = new Set(['poso_symbashs', 'poso_symbashs_basei_oron_ergasias']); // Ορίζουμε ποια fields είναι numbers

const arithmosStoixeionSymbashs = 15;
const arithmosKrathseon = 7;

function parseS3Uri(s3Uri) {
    // s3://bucket/key
    if (!s3Uri || typeof s3Uri !== 'string' || !s3Uri.startsWith('s3://')) return null;
    const rest = s3Uri.slice('s3://'.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) return null;
    return { bucket: rest.slice(0, slash), key: rest.slice(slash + 1) };
}

// =========================================================================
// ✅ HELPER FUNCTION: Validation για Ωράριο Εργασίας
// =========================================================================
function validateOrarioFields(formData) {
    const apoDate = formData.hmeromhnia_allaghs_orarioy_apo;
    const eosDate = formData.hmeromhnia_allaghs_orarioy_eos;
    const hmeres = parseFloat(formData.hmeres_ergasias_ebdomadas);
    const ores = parseFloat(formData.ores_ergasias_ebdomadas);

    // Check 1: Dates exist and are not empty
    if (!apoDate || apoDate === '' || !eosDate || eosDate === '') {
        return { valid: false, reason: 'Missing date fields (APO or EOS)' };
    }

    // Check 2: Apo <= Eos
    if (apoDate > eosDate) {
        return { valid: false, reason: 'Start date is after end date' };
    }

    // Check 3: Hmeres exists and > 0
    if (!formData.hmeres_ergasias_ebdomadas || isNaN(hmeres) || hmeres <= 0) {
        return { valid: false, reason: 'Invalid or missing hmeres_ergasias_ebdomadas' };
    }

    // Check 4: Ores exists and > 0
    if (!formData.ores_ergasias_ebdomadas || isNaN(ores) || ores <= 0) {
        return { valid: false, reason: 'Invalid or missing ores_ergasias_ebdomadas' };
    }

    // ✅ All checks passed
    return { valid: true };
}

// Server-side guards (in-memory)
// Αν έχεις PM2 cluster / multiple instances, αυτό θέλει DB/Redis. Για single instance είναι ΟΚ.
const erganiInflight = new Map(); // key -> true
const erganiLastStart = new Map(); // key -> timestamp

const ERGANI_COOLDOWN_MS = process.env.NODE_ENV === 'production' ? 10_000 : 1_000;

class ergazomenoiController {
    static mainErgazomenoiForm = async (req, res) => {
        const locals = { title: 'Εργαζόμενοι', description: 'Web Payroll Solutions' };

        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;
        const basePer = Number(process.env.EGGRAFES) || 10;
        const perx = Math.min(5, Math.max(1, parseInt(req.query.perx, 10) || 1)); // 1..5
        const perPage = basePer * perx;
        const page = Math.max(Number(req.query.page) || 1, 1);

        if (!ObjectId.isValid(sessionUserId)) throw new Error('invalid sessionUserId');
        const userId = ObjectId.createFromHexString(sessionUserId);

        try {
            // Έλεγχος CRUD των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: 'Ergazomenoi'
            }).lean();

            // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
            const countPipeline = [
                {
                    $match: {
                        company_kod: companyId
                    }
                },
                {
                    $count: 'total'
                }
            ];

            const countResults = await ErgazomenoiModel.aggregate(countPipeline).exec();

            let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
            let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
            let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
            let limitPerPage = Math.min(
                perPage,
                totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords
            ); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

            // Aggregation query για την ανάκτηση δεδομένων
            const queryPipeline = [
                { $match: { company_kod: companyId } },
                { $skip: skipRecords },
                { $limit: limitPerPage }
            ];

            const ergazomenoi = await ErgazomenoiModel.aggregate(queryPipeline).exec();

            res.render('ergazomenoi/ergazomenoi/ergazomenoi', {
                userPrivileges: userPrivileges ? userPrivileges.privileges : {},
                locals,
                current: page,
                pages: totalPages,
                ergazomenoi,
                perx, // <-- για το UI πολλαπλασιαστή
                basePer, // (προαιρετικό, αν το δείχνεις)
                entries: perPage, // (προαιρετικό: πόσα/σελίδα)
                totalRecs: totalRecords // (προαιρετικό: συνολικά)
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Σφάλμα');
        }
    };

    static editErgazomenoiForm = async (req, res) => {
        const locals = {
            title: 'Συντήρηση Στοιχείων Εργαζομένων',
            description: 'Web Payroll Solutions'
        };

        try {
            const userTeam = req.session.userTeam;
            const companyId = req.session.companyInUse;

            const ergazomenoiId = req.params.id;
            const ergazomenoiData = await ErgazomenoiModel.findById(ergazomenoiId).exec();
            // const ergazomenoiKod = req.params.kod;
            const ergazomenoiKod = ergazomenoiData.kodikos;
            const istorikoData = await IstorikoProslhpseonAllagonModel.find({
                team: userTeam,
                company_kod: companyId,
                kodikos: ergazomenoiKod
            });
            const perifereies = await PerifereiesModel.find().sort('perigrafh');
            const genikesParametroi = await GenikesParametroiModel.find()
                .sort({ kodikos: 1 })
                .lean();
            const orariaData = await ProdhlomenaOrariaModel.find({
                team: userTeam,
                company_kod: companyId,
                kodikos: ergazomenoiKod,
                hmeromhnia: {
                    $gte: new Date(ergazomenoiData.hmeromhnia_allaghs_orarioy_apo),
                    $lte: new Date(ergazomenoiData.hmeromhnia_allaghs_orarioy_eos)
                }
            })
                .sort({ hmeromhnia: 1 })
                .exec();

            res.render('ergazomenoi/ergazomenoi/edit', {
                locals,
                perifereies,
                genikesParametroi,
                istorikoData,
                orariaData,
                ergazomenoiData,
                mode: 'edit',
                context: 'ergazomenoi',
                rec: {}
            });
        } catch (error) {
            console.log('Σφάλμα :', error);
        }
    };

    static getIstorikoData = async (req, res) => {
        const locals = {
            title: 'Συντήρηση Στοιχείων Εργαζομένων',
            description: 'Web Payroll Solutions'
        };

        try {
            const userTeam = req.session.userTeam;
            const companyId = req.session.companyInUse;

            const ergazomenoiKod = req.params.kod;
            const istorikoData = await IstorikoProslhpseonAllagonModel.find({
                team: userTeam,
                company_kod: companyId,
                kodikos: ergazomenoiKod
            }).sort({ aa_eggrafhs: 1 });

            if (istorikoData) {
                res.json(istorikoData);
            }
        } catch (err) {
            res.status(500).send('Σφάλμα κατά την αναζήτηση στη βάση δεδομένων');
        }
    };

    static updateIstorikoData = async (req, res) => {
        const userTeam = req.session.userTeam;
        const companyId = req.session.companyInUse;
        const ergazomenoiKod = req.params.kod;

        try {
            const updates = req.body.updates; // Παίρνουμε τις ενημερώσεις από το σώμα του αιτήματος

            // Αποθήκευση και επεξεργασία των ενημερώσεων
            for (const update of updates) {
                const { _id, data } = update;
                if (update.deleted) {
                    await IstorikoProslhpseonAllagonModel.findByIdAndDelete(_id);
                } else {
                    // Ενημέρωση μόνο των συγκεκριμένων πεδίων
                    const updateData = {
                        hmeromhnia_proslhpshs: data.hmeromhnia_proslhpshs,
                        hmeromhnia_allaghs_symbashs: data.hmeromhnia_allaghs_symbashs,
                        hmeromhnia_lhxhs_symbashs: data.hmeromhnia_lhxhs_symbashs,
                        hmeromhnia_apoxorhshs: data.hmeromhnia_apoxorhshs
                    };
                    await IstorikoProslhpseonAllagonModel.findByIdAndUpdate(_id, updateData, {
                        new: true
                    });
                }
            }

            // Επαναρίθμηση του aa_eggrafhs
            const allRecords = await IstorikoProslhpseonAllagonModel.find({
                team: userTeam,
                company_kod: companyId,
                kodikos: ergazomenoiKod
            }).sort({ _id: 1 });
            let counter = 1;
            for (const record of allRecords) {
                const aa_eggrafhs = counter.toString().padStart(4, '0');
                await IstorikoProslhpseonAllagonModel.findByIdAndUpdate(record._id, {
                    aa_eggrafhs: aa_eggrafhs
                });
                counter++;
            }

            res.status(200).json({ message: 'Το Ιστορικό ενημερώθηκε επιτυχώς' });
        } catch (error) {
            res.status(500).json({
                message: 'Σφάλμα κατά την ενημέρωση του Ιστορικού',
                error: error
            });
        }
    };

    static searchPostErgazomenoi = async (req, res) => {
        const locals = {
            title: 'Αναζήτηση Εργαζομένων',
            description: 'Web Payroll Solutions'
        };

        try {
            let searchTerm = req.body.searchTerm;

            const sessionUserId = req.session.userId;
            const searchNoSpecialChar = searchTerm.replace(/[^a-zα-ωA-ZΑ-Ω0-9()]/g, '');
            const perPage = Number(process.env.EGGRAFES);
            let page = req.query.page || 1;

            let sTerm = searchNoSpecialChar;
            nextPageSearchTerm = searchNoSpecialChar;

            // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: 'Ergazomenoi'
            }).exec();

            // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
            const countPipeline = [
                {
                    $match: {
                        $or: [
                            { kodikos: { $regex: new RegExp(sTerm, 'i') } },
                            { eponymo: { $regex: new RegExp(sTerm, 'i') } },
                            { onoma: { $regex: new RegExp(sTerm, 'i') } },
                            { patronymo: { $regex: new RegExp(sTerm, 'i') } },
                            { afm: { $regex: new RegExp(sTerm, 'i') } },
                            { amka: { $regex: new RegExp(sTerm, 'i') } },
                            { adt: { $regex: new RegExp(sTerm, 'i') } }
                        ]
                    }
                },
                {
                    $count: 'total'
                }
            ];

            const countResults = await ErgazomenoiModel.aggregate(countPipeline).exec();

            let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
            let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
            let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
            let limitPerPage = Math.min(
                perPage,
                totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords
            ); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

            // Αναζήτηση και επισήμανση
            const ergazomenoiFilteredRecs = await ErgazomenoiModel.aggregate([
                {
                    $match: {
                        $or: [
                            { kodikos: { $regex: new RegExp(sTerm, 'i') } },
                            { eponymo: { $regex: new RegExp(sTerm, 'i') } },
                            { onoma: { $regex: new RegExp(sTerm, 'i') } },
                            { patronymo: { $regex: new RegExp(sTerm, 'i') } },
                            { afm: { $regex: new RegExp(sTerm, 'i') } },
                            { amka: { $regex: new RegExp(sTerm, 'i') } },
                            { adt: { $regex: new RegExp(sTerm, 'i') } }
                        ]
                    }
                },
                {
                    $sort: {
                        kodikos: 1
                    }
                }
            ])
                .skip(skipRecords)
                .limit(limitPerPage);

            // Εφαρμογή της επισήμανσης
            const highlightedRecords = ergazomenoiFilteredRecs.map((record) => ({
                ...record,
                kodikos: this.highlightText(record.kodikos, sTerm),
                eponymo: this.highlightText(record.eponymo, sTerm),
                onoma: this.highlightText(record.onoma, sTerm),
                patronymo: this.highlightText(record.patronymo, sTerm),
                afm: this.highlightText(record.afm, sTerm),
                amka: this.highlightText(record.amka, sTerm),
                adt: this.highlightText(record.adt, sTerm)
            }));

            res.render('ergazomenoi/ergazomenoi/search', {
                userPrivileges,
                ergazomenoiFilteredRecs: highlightedRecords,
                locals,
                current: page,
                pages: totalPages,
                sTerm: sTerm,
                entries: perPage,
                totalRecs: totalRecords
            });
        } catch (error) {
            console.log('Σφάλμα :', error);
        }
    };

    static searchGetErgazomenoi = async (req, res) => {
        const locals = {
            title: 'Αναζήτηση Εργαζομένων',
            description: 'Web Payroll Solutions'
        };

        try {
            let searchTerm = nextPageSearchTerm; //req.body.searchTerm;

            const sessionUserId = req.session.userId;
            const perPage = Number(process.env.EGGRAFES);
            let page = req.query.page || 1;

            // try {
            // Έλεγχος C-R-U-D των δικαιωμάτων του χρήστη
            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: 'Ergazomenoi'
            }).exec();

            // Υπολογισμός συνολικού αριθμού εγγραφών για σελιδοποίηση
            const countPipeline = [
                {
                    $match: {
                        $or: [
                            { kodikos: { $regex: new RegExp(searchTerm, 'i') } },
                            { eponymo: { $regex: new RegExp(searchTerm, 'i') } },
                            { onoma: { $regex: new RegExp(searchTerm, 'i') } },
                            { patronymo: { $regex: new RegExp(searchTerm, 'i') } },
                            { afm: { $regex: new RegExp(searchTerm, 'i') } },
                            { amka: { $regex: new RegExp(searchTerm, 'i') } },
                            { adt: { $regex: new RegExp(searchTerm, 'i') } }
                        ]
                    }
                },
                {
                    $count: 'total'
                }
            ];

            const countResults = await ErgazomenoiModel.aggregate(countPipeline).exec();

            let totalRecords = countResults.length > 0 ? countResults[0].total : 0;
            let totalPages = Math.ceil(totalRecords / Math.max(perPage, 1)); // Αποφεύγει διαίρεση με μηδέν ή αρνητικό αριθμό
            let skipRecords = Math.max(0, (page - 1) * perPage); // Εξασφαλίζει ότι skipRecords δεν είναι αρνητικός
            let limitPerPage = Math.min(
                perPage,
                totalRecords - skipRecords <= 0 ? 1 : totalRecords - skipRecords
            ); // Υπολογίζει το limit βάσει των διαθέσιμων εγγραφών

            // Αναζήτηση και επισήμανση
            const ergazomenoiFilteredRecs = await ErgazomenoiModel.aggregate([
                {
                    $match: {
                        $or: [
                            { kodikos: { $regex: new RegExp(searchTerm, 'i') } },
                            { eponymo: { $regex: new RegExp(searchTerm, 'i') } },
                            { onoma: { $regex: new RegExp(searchTerm, 'i') } },
                            { patronymo: { $regex: new RegExp(searchTerm, 'i') } },
                            { afm: { $regex: new RegExp(searchTerm, 'i') } },
                            { amka: { $regex: new RegExp(searchTerm, 'i') } },
                            { adt: { $regex: new RegExp(searchTerm, 'i') } }
                        ]
                    }
                },
                {
                    $sort: {
                        kodikos: 1
                    }
                }
            ])
                .skip(skipRecords)
                .limit(limitPerPage);

            // Εφαρμογή της επισήμανσης
            const highlightedRecords = ergazomenoiFilteredRecs.map((record) => ({
                ...record,
                kodikos: this.highlightText(record.kodikos, searchTerm),
                eponymo: this.highlightText(record.eponymo, searchTerm),
                onoma: this.highlightText(record.onoma, searchTerm),
                patronymo: this.highlightText(record.patronymo, searchTerm),
                afm: this.highlightText(record.afm, searchTerm),
                amka: this.highlightText(record.amka, searchTerm),
                adt: this.highlightText(record.adt, searchTerm)
            }));

            res.render('ergazomenoi/ergazomenoi/search', {
                userPrivileges,
                ergazomenoiFilteredRecs: highlightedRecords,
                locals,
                current: page,
                pages: totalPages,
                sTerm: searchTerm,
                entries: perPage,
                totalRecs: totalRecords
            });
        } catch (error) {
            console.log('Σφάλμα :', error);
        }
    };

    static addErgazomenoiForm = async (req, res) => {
        const locals = {
            title: 'Προσθήκη Νέου Εργαζόμενου',
            description: 'Web Payroll Solutions'
        };

        const sessionYearInUse = req.session.yearInUse;
        const companyId = req.session.companyInUse;

        try {
            const companyData = await CompaniesModel.findById(companyId).lean();

            const data = await PerifereiesModel.find().sort('kodikos');
            res.render('ergazomenoi/ergazomenoi/add', {
                locals,
                companyData,
                data,
                mode: 'add',
                context: 'ergazomenoi',
                sessionYearInUse,
                companyInUse: req.session.companyInUse,
                userTeam: req.session.userTeam,
                csrfToken: res.locals.csrfToken,
                nonce: res.locals.nonce,
                rec: {}
            });
        } catch (error) {
            console.log('Σφάλμα :', error);
        }
    };

    static checkAfmErgazomenoy = async (req, res) => {
        try {
            const { afm } = req.body;

            const doc = await ErgazomenoiModel.findOne({ afm: afm });

            if (doc) {
                return res.json(doc);
            } else {
                return res.json(null);
            }
        } catch (err) {
            return res.status(500).json({ error: 'Σφάλμα κατά την αναζήτηση στη βάση δεδομένων' });
        }
    };

    static postErgazomenoiForm = async (req, res) => {
        const sessionUserTeam = req.session.userTeam;
        const sessionCompanyInUse = req.session.companyInUse;
        const sessionUserId = req.session.userId;

        let aa_kod = null,
            aa_eggr = null,
            kodikosValue = 0;

        const { formData, filesToUpdate } = req.body;

        try {
            const lastRecord = await ErgazomenoiModel.find({
                team: sessionUserTeam,
                company_kod: sessionCompanyInUse
            })
                .sort({ _id: -1 })
                .limit(1);
            let kodValue =
                lastRecord[0] && lastRecord[0].kodikos ? parseInt(lastRecord[0].kodikos, 10) : null;
            if (kodValue !== null) {
                kodValue++;
            } else {
                kodValue = 1;
            }
            aa_kod = kodValue;
            kodikosValue = kodValue;
        } catch (error) {
            console.log('Σφάλμα :', error);
        }

        try {
            const lastRecordIstorikoy = await IstorikoProslhpseonAllagonModel.find({
                team: sessionUserTeam,
                company_kod: sessionCompanyInUse,
                kodikos: kodikosValue
            })
                .sort({ _id: -1 })
                .limit(1);
            let aaValue =
                lastRecordIstorikoy[0] && lastRecordIstorikoy[0].aa_eggrafhs
                    ? parseInt(lastRecordIstorikoy[0].aa_eggrafhs, 10)
                    : null;
            if (aaValue !== null) {
                aaValue++;
            } else {
                aaValue = 1;
            }
            aa_eggr = aaValue;
        } catch (error) {
            console.log('Σφάλμα :', error);
        }

        const days = 7;
        const sessions = 3;

        const newErgazomenos = ErgazomenoiModel({
            team: sessionUserTeam,
            company_kod: sessionCompanyInUse,
            kodikos: aa_kod.toString().padStart(4, '0'),
            eponymo: formData.eponymoHidden,
            onoma: formData.onomaHidden,
            afm: formData.afm_ergazomenoyHidden,
            amka: formData.amka_ergazomenoyHidden,
            eponymo_patera: formData.eponymo_patera,
            patronymo: formData.patronymo,
            eponymo_mhteras: formData.eponymo_mhteras,
            mhtronymo: formData.mhtronymo,
            energos: formData.energos,
            fylo: formData.fylo,
            doy: formData.doy_stathera,
            typos_taytothtas: formData.taytothta_stathera,
            adt: formData.adt,
            hmeromhnia_ekdoshs: formData.hmeromhnia_ekdoshs || null,
            hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy:
                formData.hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy || null,
            arxh_ekdoshs: formData.arxh_ekdoshs,
            hmeromhnia_gennhshs: formData.hmeromhnia_gennhshs || null,
            topos_gennhshs: formData.topos_gennhshs,
            arithmos_bibliarioy_anhlikoy: formData.arithmos_bibliarioy_anhlikoy,
            email: formData.email,
            yphkoothta: formData.yphkoothta_stathera,
            eidikh_kathgoria_ergazomenoy: formData.eidikh_kathgoria_stathera,
            oikogeneiakh_katastash: formData.oikogeneiakh_katastash_stathera,
            arithmos_teknon: formData.arithmos_teknon,
            odos: formData.odos,
            arithmos: formData.arithmos,
            tk: formData.tk,
            thlefono: formData.thlefono,
            perifereia: formData.perifereia_stathera,
            nomos: formData.nomos_stathera,
            dhmos: formData.dhmos_stathera,
            polh: formData.polh_stathera,
            ekpaideytiko_epipedo: formData.ekpaideytiko_epipedo_stathera,
            forologikh_klimaka: formData.forologikh_klimaka,
            trapeza: formData.trapeza_stathera,
            iban: formData.iban,

            hmeromhnia_proslhpshs: formData.hmeromhnia_proslhpshs || null,
            hmeromhnia_allaghs_symbashs: formData.hmeromhnia_allaghs_symbashs || null,
            hmeromhnia_allaghs_orarioy_apo: formData.hmeromhnia_allaghs_orarioy_apo || null,
            hmeromhnia_allaghs_orarioy_eos: formData.hmeromhnia_allaghs_orarioy_eos || null,
            hmeromhnia_lhxhs_symbashs: formData.hmeromhnia_lhxhs_symbashs || null,
            hmeromhnia_apoxorhshs: formData.hmeromhnia_apoxorhshs || null,
            afora_daneismo_ergazomenoy: formData.afora_daneismo_ergazomenoy,
            typos_daneismoy: formData.typos_daneismoy_stathera,
            hmnia_enarxhs_daneismoy: formData.hmnia_enarxhs_daneismoy || null,
            hmnia_lhxhs_daneismoy: formData.hmnia_lhxhs_daneismoy || null,
            afora_dokimastikh_periodo: formData.afora_dokimastikh_periodo,
            hmnia_lhxhs_dokimastikhs_periodoy: formData.hmnia_lhxhs_dokimastikhs_periodoy || null,
            kathestos_apasxolhshs: formData.kathestos_apasxolhshs_stathera,
            sxesh_ergasias: formData.sxesh_ergasias_stathera,
            proyphresia_se_eth: formData.proyphresia_se_eth,
            proyphresia_se_mhnes: formData.proyphresia_se_mhnes,
            proyphresia_adeias_se_eth: formData.proyphresia_adeias_se_eth,
            synolo_proyphresias_se_eth: formData.synolo_proyphresias_se_eth,
            synolo_proyphresias_se_mhnes: formData.synolo_proyphresias_se_mhnes,
            misthologiko_klimakio: formData.misthologiko_klimakio,
            syggeneia: formData.syggeneia,
            syggenikh_sxesh: formData.syggenikh_sxesh_stathera,
            thesh_eythynhs: formData.thesh_eythynhs_stathera,
            eidikh_periptosh: formData.eidikh_periptosh_stathera,
            topos_ergasias: formData.topos_ergasias,
            topos_ergasias_parathrhseis: formData.topos_ergasias_parathrhseis,
            xronos_katabolhs_apodoxon: formData.xronos_katabolhs_apodoxon,
            efarmostea_sse: formData.efarmostea_sse,
            efarmostea_sse_parathrhseis: formData.efarmostea_sse_parathrhseis || '',

            plhrhs_apasxolhsh: formData.plhrhs_apasxolhsh,
            mh_problepsimo_programma: formData.mh_problepsimo_programma,
            hmeres_ores_anaforas: formData.hmeres_ores_anaforas,
            eidopoihsh_prin_thn_anathesh: formData.eidopoihsh_prin_thn_anathesh,
            prothesmia_akyroshs_ths_anatheshs: formData.prothesmia_akyroshs_ths_anatheshs,
            dieythethsh_xronoy_ergasias: formData.dieythethsh_xronoy_ergasias,
            hmnia_enarxhs_dieythethshs_ergasias: formData.hmnia_enarxhs_dieythethshs_ergasias,
            hmnia_lhxhs_dieythethshs_ergasias: formData.hmnia_lhxhs_dieythethshs_ergasias,
            hmeres_ergasias_ebdomadas: formData.hmeres_ergasias_ebdomadas,
            ores_ergasias_ebdomadas: formData.ores_ergasias_ebdomadas,
            mo_oron_hmerhsias_ergasias: formData.mo_oron_hmerhsias_ergasias,
            dialleima_se_lepta: formData.dialleima_se_lepta,
            dialleima_entos_ektos_orarioy: formData.dialleima_entos_ektos_orarioy,
            symbatikes_ores_ergasias: formData.symbatikes_ores_ergasias,
            typos_orarioy: formData.typos_orarioy,
            synexes_diakekomeno: formData.synexes_diakekomeno,
            pshfiakh_organosh: formData.pshfiakh_organosh,
            apasxolhsh_basei_symbashs: formData.apasxolhsh_basei_symbashs_stathera,
            karta_ergasias: formData.karta_ergasias,
            evelikth_proselefsh: formData.evelikth_proselefsh,
            apasxolhsh_gia_proth_fora: formData.apasxolhsh_gia_proth_fora,
            ora_enarxhs_proths_foras: formData.ora_enarxhs_proths_foras,
            ora_apoxorhshs_proths_foras: formData.ora_apoxorhshs_proths_foras,
            asfalish_me_tekmarta: formData.asfalish_me_tekmarta,
            asfalistikh_klash: formData.asfalistikh_klash_stathera,
            epoxikos: formData.epoxikos,
            tmhma: formData.tmhma_stathera,
            eidikothta_erganh: formData.eidikothta_erganh_stathera,
            antikeimeno_ergasion: formData.antikeimeno_ergasion,
            typos_ergazomenon: formData.typos_ergazomenon_stathera,
            ypokatasthma: formData.ypokatasthma_stathera,
            xarakthrismos_ergazomenon: formData.xarakthrismos_ergazomenon,
            eidikothta: formData.eidikothta_stathera,
            diathesimothta: formData.diathesimothta,
            enarxh_diathesimothtas: formData.enarxh_diathesimothtas || null,
            lhxh_diathesimothtas: formData.lhxh_diathesimothtas || null,
            foreas_kyrias_asfalishs: formData.foreas_kyrias_asfalishs_stathera,
            foreas_epikoyrikhs_asfalishs: formData.foreas_epikoyrikhs_asfalishs || [],
            kad_efka: formData.kad_efka_stathera,
            eidikothta_efka: formData.eidikothta_efka_stathera,
            kpk_efka: formData.kpk_efka_stathera,
            kpk_efka_basei_symbashs: formData.tmp_kpk_efka_stathera,
            epa_efka: formData.epa_efka_stathera,
            prosthetes_asfalistikes_apodoxes: formData.prosthetes_asfalistikes_apodoxes,
            meiosh_eisforon_ergazomenon: formData.meiosh_eisforon_ergazomenon,
            kodikos_meioshs: formData.kodikos_meioshs_stathera,
            pososto_asfalismenoy_meioshs: formData.pososto_asfalismenoy_meioshs_stathera,
            pososto_ergodoth_meioshs: formData.pososto_ergodoth_meioshs_stathera,
            isxyei_apo_meioshs: formData.isxyei_apo_meioshs_stathera,
            isxyei_eos_meioshs: formData.isxyei_eos_meioshs_stathera,
            epidothsh_eisforon_ergodoth: formData.epidothsh_eisforon_ergodoth,
            kodikos_epidothshs: formData.kodikos_epidothshs_stathera,
            pososto_asfalismenoy_epidothshs: formData.pososto_asfalismenoy_epidothshs_stathera,
            pososto_ergodoth_epidothshs: formData.pososto_ergodoth_epidothshs_stathera,
            isxyei_apo_epidothshs: formData.isxyei_apo_epidothshs_stathera,
            isxyei_eos_epidothshs: formData.isxyei_eos_epidothshs_stathera,
            meiosh_eisforon_mhteron: formData.meiosh_eisforon_mhteron_stathera,
            kodikos_meioshs_eisforon_mhteron: formData.kodikos_meioshs_eisforon_mhteron_stathera,
            pososto_asfalismenoy_eisforon_mhteron:
                formData.pososto_asfalismenoy_eisforon_mhteron_stathera,
            pososto_ergodoth_eisforon_mhteron: formData.pososto_ergodoth_eisforon_mhteron_stathera,
            isxyei_apo_eisforon_mhteron: formData.isxyei_apo_eisforon_mhteron_stathera || null,
            isxyei_eos_eisforon_mhteron: formData.isxyei_eos_eisforon_mhteron_stathera || null,
            palios_neos: formData.palios_neos,
            amoibetai_me_sse: formData.amoibetai_me_sse,

            epidoma_anergias: formData.epidoma_anergias,
            dypa: formData.dypa_stathera,
            arithmos_deltioy_anergias: formData.arithmos_deltioy_anergias,
            systatiko_shmeioma: formData.systatiko_shmeioma,
            topothethsh_me_programma: formData.topothethsh_me_programma,
            ypoxreotikh_ek_toy_nomoy_katartish: formData.ypoxreotikh_ek_toy_nomoy_katartish,
            programma_dypa: formData.programma_dypa_stathera,
            egkritikh_apofash_dypa: formData.egkritikh_apofash_dypa,
            hmeromhnia_enarxhs_programmatos: formData.hmeromhnia_enarxhs_programmatos || null,
            hmeromhnia_lhxhs_programmatos: formData.hmeromhnia_lhxhs_programmatos || null,
            antikatastash_ergazomenoy: formData.antikatastash_ergazomenoy,
            afm_antikatastath: formData.afm_antikatastath,
            amka_antikatastath: formData.amka_antikatastath,

            kentro_kostoys_1: formData.kentro_kostoys_1_stathera,
            pososto_apasxolhshs_kk1: formData.pososto_apasxolhshs_kk1 || 0,
            kentro_kostoys_2: formData.kentro_kostoys_2_stathera,
            pososto_apasxolhshs_kk2: formData.pososto_apasxolhshs_kk2 || 0,
            kentro_kostoys_3: formData.kentro_kostoys_3_stathera,
            pososto_apasxolhshs_kk3: formData.pososto_apasxolhshs_kk3 || 0,
            kentro_kostoys_4: formData.kentro_kostoys_4_stathera,
            pososto_apasxolhshs_kk4: formData.pososto_apasxolhshs_kk4 || 0,

            symbash: formData.symbash_stathera,
            kathgoria_symbashs: formData.kathgoria_symbashs_stathera,
            eidikothta_symbashs: formData.eidikothta_symbashs_stathera
        });

        const fieldsWithHidden = new Set(['stoixeio_symbashs']);
        const numberFields = new Set(['poso_symbashs', 'poso_symbashs_basei_oron_ergasias']);

        for (let i = 1; i <= arithmosStoixeionSymbashs; i++) {
            const idNum = i.toString().padStart(2, '0');

            // Σειρά fields ανά row
            const fieldsInOrder = [
                'stoixeio_symbashs',
                'poso_symbashs',
                'poso_symbashs_basei_oron_ergasias'
            ];

            fieldsInOrder.forEach((fieldStoixeio) => {
                const fieldName = `${fieldStoixeio}_${idNum}`;

                // Assign main field
                if (numberFields.has(fieldStoixeio)) {
                    newErgazomenos[fieldName] = formData[fieldName] || 0;
                } else {
                    newErgazomenos[fieldName] = formData[fieldName] || null;
                }

                // Assign hidden field (μόνο για stoixeio_symbashs)
                if (fieldsWithHidden.has(fieldStoixeio)) {
                    const hiddenFieldName = `${fieldName}_hidden`;
                    newErgazomenos[hiddenFieldName] = formData[hiddenFieldName] || null;
                }
            });
        }

        newErgazomenos.synolo_symbashs = formData.synolo_symbashs;
        newErgazomenos.synolo_symbashs_basei_oron_ergasias =
            formData.synolo_symbashs_basei_oron_ergasias;
        newErgazomenos.nomimosMisthos = formData.nomimosMisthos;
        newErgazomenos.nomimoHmeromisthio = formData.nomimoHmeromisthio;
        newErgazomenos.nomimoOromisthio = formData.nomimoOromisthio;
        newErgazomenos.pragmatikosMisthos = formData.pragmatikosMisthos;
        newErgazomenos.pragmatikoHmeromisthio = formData.pragmatikoHmeromisthio;
        newErgazomenos.pragmatikoOromisthio = formData.pragmatikoOromisthio;

        // Ορισμός σειράς fields
        const fieldsKrathseonInOrder = ['krathsh', 'ama_krathshs'];

        for (let i = 1; i <= arithmosKrathseon; i++) {
            const idNum = i < 10 ? '0' + i : i;

            fieldsKrathseonInOrder.forEach((fieldKrathsh) => {
                const fieldNameKrathshs = `${fieldKrathsh}_${idNum}`;
                newErgazomenos[fieldNameKrathshs] = formData[fieldNameKrathshs] || null;
            });
        }

        newErgazomenos.epikoyrikh_xoris_efka = formData.epikoyrikh_xoris_efka || null;
        newErgazomenos.astheneia_xoris_efka = formData.astheneia_xoris_efka || null;
        newErgazomenos.idiothta_sto_ergo_39 = formData.idiothta_sto_ergo_39 || null;

        newErgazomenos.adeia_diamonhs_me_amesh_prosbash_gia_ergasia =
            formData.adeia_diamonhs_me_amesh_prosbash_gia_ergasia;
        newErgazomenos.εidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia =
            formData.eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia_stathera;
        newErgazomenos.arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia =
            formData.arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia;
        newErgazomenos.hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia =
            formData.hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia || null;
        newErgazomenos.adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia =
            formData.adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia;
        newErgazomenos.eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia =
            formData.eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia_stathera;
        newErgazomenos.arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia =
            formData.arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia;
        newErgazomenos.hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia =
            formData.hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia || null;
        newErgazomenos.adeia_eisodoy_gia_epoxikh_apasxolhsh =
            formData.adeia_eisodoy_gia_epoxikh_apasxolhsh;
        newErgazomenos.arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh =
            formData.arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh;
        newErgazomenos.apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh =
            formData.apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh || null;
        newErgazomenos.eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh =
            formData.eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh || null;

        newErgazomenos.epaggelmatikh_katartish = formData.epaggelmatikh_katartish;
        newErgazomenos.antikeimeno_katartishs = formData.antikeimeno_katartishs;
        newErgazomenos.thematiko_pedio = formData.thematiko_pedio_stathera;
        newErgazomenos.thematikh_enothta = formData.thematikh_enothta_stathera;
        newErgazomenos.foreas_katartishs = formData.foreas_katartishs_stathera;
        newErgazomenos.katartish_apo = formData.katartish_apo;
        newErgazomenos.katartish_eos = formData.katartish_eos;
        newErgazomenos.diarkeia_se_ores = formData.diarkeia_se_ores;
        newErgazomenos.etos_apokthshs = formData.etos_apokthshs;
        newErgazomenos.allh_glossa_01 = formData.allh_glossa_01;
        newErgazomenos.allh_glossa_02 = formData.allh_glossa_02;
        newErgazomenos.allh_glossa_03 = formData.allh_glossa_03;
        newErgazomenos.allh_glossa_04 = formData.allh_glossa_04;
        newErgazomenos.gnosh_ypologiston = formData.gnosh_ypologiston;
        newErgazomenos.allo_proson = formData.allo_proson;

        newErgazomenos.symfonhtheis_misthos_genikos = formData.symfonhtheis_misthos_genikos;
        newErgazomenos.symfonhtheis_misthos_apasxolhseis =
            formData.symfonhtheis_misthos_apasxolhseis;
        newErgazomenos.paketo_apodoxon = formData.paketo_apodoxon;
        newErgazomenos.mhniaia_repo = formData.mhniaia_repo;
        newErgazomenos.ypologismos_foroy = formData.ypologismos_foroy;
        newErgazomenos.oysiodeis_oroi = formData.oysiodeis_oroi_stathera || '0';
        newErgazomenos.oros_sth_symbash_n_3986_2011 = formData.oros_sth_symbash_n_3986_2011;
        newErgazomenos.kataggelia_katopin_eggrafhs_proeidopoihshs =
            formData.kataggelia_katopin_eggrafhs_proeidopoihshs;
        newErgazomenos.hmeromhnia_eggrafhs_proeidopoihshs =
            formData.hmeromhnia_eggrafhs_proeidopoihshs || null;
        newErgazomenos.omadikh_apolysh = formData.omadikh_apolysh;
        newErgazomenos.arithmos_apofashs_gia_omadikh_apolysh =
            formData.arithmos_apofashs_gia_omadikh_apolysh;
        newErgazomenos.hmeromhnia_apofashs_gia_omadikh_apolysh =
            formData.hmeromhnia_apofashs_gia_omadikh_apolysh || null;
        newErgazomenos.epidosh_me_dikastiko_epimelhth = formData.epidosh_me_dikastiko_epimelhth;
        newErgazomenos.hmeromhnia_epidoshs = formData.hmeromhnia_epidoshs || null;
        newErgazomenos.hmeromhnia_katabolhs_ths_apozhmioshs =
            formData.hmeromhnia_katabolhs_ths_apozhmioshs || null;
        newErgazomenos.shmeioseis_apozhmioshs = formData.shmeioseis_apozhmioshs;
        newErgazomenos.parathrhseis = formData.parathrhseis;

        let savedErgazomenos = null; // ✅ Δήλωση

        try {
            savedErgazomenos = await ErgazomenoiModel.create(newErgazomenos); // ✅ Αποθήκευση
        } catch (error) {
            return res.status(500).json({
                success: false,
                errorMessage: 'Σφάλμα κατά τη αποθήκευση του εργαζόμενου'
            });
        }

        // ✅ Έλεγχος ότι το _id υπάρχει
        if (!savedErgazomenos || !savedErgazomenos._id) {
            console.error('ΣΦΑΛΜΑ: Ο εργαζόμενος δημιουργήθηκε αλλά δεν έχει _id!');
            return res.status(500).json({
                success: false,
                errorMessage: 'Εσωτερικό σφάλμα:  Δεν βρέθηκε ID εργαζόμενου'
            });
        }

        // ======================================================================
        // ✅ ΕΠΕΞΕΡΓΑΣΙΑ PDF BASE64 DATA (Updated για S3)
        // ======================================================================

        const { savePdfFromBase64 } = require('../../utils/pdfHandler');

        const pdfFieldMappings = {
            arxeio_apodoxhs_oron_atomikhs_symbashs_base64: {
                documentType: 'arxeio_symbashs',
                dbField: 'arxeio_apodoxhs_oron_atomikhs_symbashs_path'
            },
            arxeio_apodoxhs_oysiodon_oron_base64: {
                documentType: 'oysiodeis_oroi',
                dbField: 'arxeio_apodoxhs_oysiodon_oron_path'
            },
            bibliario_anhlikoy_base64: {
                documentType: 'anhlikoi',
                dbField: 'bibliario_anhlikoy_path'
            },
            arxeio_symbashs_daneismoy_base64: {
                documentType: 'symbash_daneismoy',
                dbField: 'arxeio_symbashs_daneismoy_path'
            },
            arxeio_nomimopoihtikon_eggrafon_base64: {
                documentType: 'allodapoi',
                dbField: 'arxeio_nomimopoihtikon_eggrafon_path'
            }
        };

        const pdfResults = [];
        const ergazomenosId = savedErgazomenos._id.toString();

        for (const [base64Field, mapping] of Object.entries(pdfFieldMappings)) {
            const base64Data = formData[base64Field];

            if (base64Data && base64Data.startsWith('data:application/pdf;base64,')) {
                try {
                    const s3Key = await savePdfFromBase64(
                        base64Data,
                        mapping.documentType,
                        ergazomenosId
                    );

                    savedErgazomenos[mapping.dbField] = s3Key;

                    pdfResults.push({
                        documentType: mapping.documentType,
                        success: true,
                        s3Key: s3Key
                    });
                } catch (error) {
                    console.error(`❌ Failed to process ${mapping.documentType}:`, error.message);
                    pdfResults.push({
                        documentType: mapping.documentType,
                        success: false,
                        error: error.message
                    });
                }
            } else {
                console.log(`⏭️  Skipping ${mapping.documentType} (no data)`);
            }
        }

        // ✅ Save το document με τα S3 keys
        if (pdfResults.length > 0) {
            try {
                await savedErgazomenos.save();
            } catch (error) {
                console.error(`❌ Failed to save PDF paths:`, error);
            }
        }

        // ✅ Logging
        const successCount = pdfResults.filter((r) => r.success).length;
        const failCount = pdfResults.filter((r) => !r.success).length;

        if (failCount > 0) {
            console.warn(`⚠️ Failed to upload ${failCount} PDFs`);
        }

        newErgazomenos.createdAt = Date.now();
        newErgazomenos.updatedAt = Date.now();

        // ============================================================================
        // ✅ AUTOMATIC CONTRACT PDF GENERATION
        // ============================================================================

        const { generateContractPDF } = require('../../utils/contractGenerator');
        // const { generatePresignedUrl } = require('../../utils/s3Helper'); // ✅ FIXED!

        let contractPdfData = null;

        try {
            const userContext = await getUserContext(req);

            const contractS3Key = await generateContractPDF(savedErgazomenos, userContext);

            // ✅ Generate signed URL (10 minutes expiration)
            const pdfUrl = await generatePresignedUrl(contractS3Key, 600);

            // Save S3 key στο document
            savedErgazomenos.arxeio_apodoxhs_oron_atomikhs_symbashs_path = contractS3Key;
            await savedErgazomenos.save();

            contractPdfData = {
                url: pdfUrl,
                s3Key: contractS3Key,
                showPreview: true
            };
        } catch (pdfError) {
            console.error('⚠️ Error generating contract PDF:', pdfError);
            console.error('Stack:', pdfError.stack);

            contractPdfData = {
                error: 'PDF generation failed: ' + pdfError.message,
                showPreview: false
            };
        }

        const orarioValidation = validateOrarioFields(formData);

        if (orarioValidation.valid) {
            function createOrarioData(i1) {
                return {
                    team: sessionUserTeam,
                    company_kod: sessionCompanyInUse,
                    kodikos: aa_kod.toString().padStart(4, '0'),
                    hmeromhnia: formData[`hmeromhnia_${i1}`],
                    kathgoria_ergasias: formData[`kathgoria_ergasias_sthathera_${i1}`],
                    apo_ora_01: formData[`apo_ora_01_${i1}`],
                    eos_ora_01: formData[`eos_ora_01_${i1}`],
                    dialleima_apo_ora_01: formData[`dialleima_apo_ora_01_${i1}`],
                    dialleima_eos_ora_01: formData[`dialleima_eos_ora_01_${i1}`],
                    apo_ora_02: formData[`apo_ora_02_${i1}`],
                    eos_ora_02: formData[`eos_ora_02_${i1}`],
                    dialleima_apo_ora_02: formData[`dialleima_apo_ora_02_${i1}`],
                    dialleima_eos_ora_02: formData[`dialleima_eos_ora_02_${i1}`],
                    apo_ora_03: formData[`apo_ora_03_${i1}`],
                    eos_ora_03: formData[`eos_ora_03_${i1}`],
                    dialleima_apo_ora_03: formData[`dialleima_apo_ora_03_${i1}`],
                    dialleima_eos_ora_03: formData[`dialleima_eos_ora_03_${i1}`],
                    repo: formData[`repo_${i1}`] || false,
                    adeia: false,
                    astheneia: false,
                    argia: formData[`argia_${i1}`] || false,
                    perigrafh_argias: formData[`perigrafh_argias_${i1}`] || '',
                    kathgoria_adeias: '',
                    ores_ergasias: parseFloat(formData[`total_hours_day_${i1}`]).toFixed(4)
                };
            }

            let promises = [];
            const fromDate = new Date(formData.hmeromhnia_allaghs_orarioy_apo);
            const toDate = new Date(formData.hmeromhnia_allaghs_orarioy_eos);

            let currentDate = new Date(fromDate); // Ξεκινάμε από την αρχική ημερομηνία
            let i = 1;

            while (currentDate <= toDate) {
                let i1 = i < 10 ? '0' + i : i;
                const newOrario = new ProdhlomenaOrariaModel(createOrarioData(i1));
                promises.push(ProdhlomenaOrariaModel.create(newOrario));

                currentDate.setDate(currentDate.getDate() + 1); // Προσθέτουμε μία ημέρα
                i++;
            }

            try {
                await Promise.all(promises);
            } catch (error) {
                console.error('Σφάλμα κατά τη αποθήκευση των οραρίων:', error);
            }
        } else {
            // ❌ Validation failed
            console.warn(`⚠️ Ωράριο Εργασίας validation failed: ${orarioValidation.reason}`);
            console.warn('Debug info:', {
                apoDate: formData.hmeromhnia_allaghs_orarioy_apo,
                eosDate: formData.hmeromhnia_allaghs_orarioy_eos,
                hmeres: formData.hmeres_ergasias_ebdomadas,
                ores: formData.ores_ergasias_ebdomadas
            });
        }

        const newIstoriko = IstorikoProslhpseonAllagonModel({
            team: sessionUserTeam,
            company_kod: sessionCompanyInUse,
            kodikos: aa_kod.toString().padStart(4, '0'),
            aa_eggrafhs: aa_eggr.toString().padStart(4, '0'),
            hmeromhnia_proslhpshs: formData.hmeromhnia_proslhpshs,
            hmeromhnia_allaghs_symbashs: formData.hmeromhnia_allaghs_symbashs,
            hmeromhnia_allaghs_orarioy_apo: formData.hmeromhnia_allaghs_orarioy_apo,
            hmeromhnia_allaghs_orarioy_eos: formData.hmeromhnia_allaghs_orarioy_eos,
            hmeromhnia_lhxhs_symbashs: formData.hmeromhnia_lhxhs_symbashs,
            hmeromhnia_apoxorhshs: formData.hmeromhnia_apoxorhshs,
            afora_proslhpsh: true,
            kathestos_apasxolhshs: formData.kathestos_apasxolhshs,
            misthologiko_klimakio: formData.misthologiko_klimakio,

            symbash: formData.symbash_stathera,
            kathgoria_symbashs: formData.kathgoria_symbashs_stathera,
            eidikothta_symbashs: formData.eidikothta_symbashs_stathera
        });

        for (let i = 1; i <= arithmosStoixeionSymbashs; i++) {
            const idNum = i.toString().padStart(2, '0');

            // Σειρά fields ανά row
            const fieldsInOrder = [
                'stoixeio_symbashs',
                'poso_symbashs',
                'poso_symbashs_basei_oron_ergasias'
            ];

            fieldsInOrder.forEach((fieldStoixeio) => {
                const fieldName = `${fieldStoixeio}_${idNum}`;

                // Assign main field
                if (numberFields.has(fieldStoixeio)) {
                    newIstoriko[fieldName] = formData[fieldName] || 0;
                } else {
                    newIstoriko[fieldName] = formData[fieldName] || null;
                }

                // Assign hidden field (μόνο για stoixeio_symbashs)
                if (fieldsWithHidden.has(fieldStoixeio)) {
                    const hiddenFieldName = `${fieldName}_hidden`;
                    newIstoriko[hiddenFieldName] = formData[hiddenFieldName] || null;
                }
            });
        }

        newIstoriko.synolo_symbashs = formData.synolo_symbashs;
        newIstoriko.synolo_symbashs_basei_oron_ergasias =
            formData.synolo_symbashs_basei_oron_ergasias;
        newIstoriko.nomimosMisthos = formData.nomimosMisthos;
        newIstoriko.nomimoHmeromisthio = formData.nomimoHmeromisthio;
        newIstoriko.nomimoOromisthio = formData.nomimoOromisthio;
        newIstoriko.pragmatikosMisthos = formData.pragmatikosMisthos;
        newIstoriko.pragmatikoHmeromisthio = formData.pragmatikoHmeromisthio;
        newIstoriko.pragmatikoOromisthio = formData.pragmatikoOromisthio;

        fieldsKrathseon.forEach((fieldKrathsh) => {
            for (let i = 1; i <= arithmosKrathseon; i++) {
                const fieldNameKrathshs = `${fieldKrathsh}_${i < 10 ? '0' + i : i}`;
                newIstoriko[fieldNameKrathshs] = formData[fieldNameKrathshs] || null;
            }
        });

        newIstoriko.createdAt = Date.now();
        newIstoriko.updatedAt = Date.now();

        try {
            await IstorikoProslhpseonAllagonModel.create(newIstoriko);
        } catch (error) {
            console.log('Σφάλμα κατά την αποθήκευση του ιστορικού:', error);
            return res.status(500).json({
                success: false,
                errorMessage: 'Σφάλμα κατά την αποθήκευση του ιστορικού'
            });
        }

        try {
            // ✅ Get company data for email
            let company = req.session?.companyData || null;
            let ypokatasthmata = null;

            if (!company && sessionCompanyInUse) {
                try {
                    company = await CompaniesModel.findById(sessionCompanyInUse).lean();
                } catch (error) {
                    console.error('❌ [BACKEND] Error fetching company:', error.message);
                    company = null;
                }
            }

            // ✅ Extract company contact info
            const companyTeam = company?.email || null;
            const companyEmail = company?.email || null;
            const companyPhone = company?.thlefono || null;
            const companyName = company
                ? `${company.eponymia || ''} ${company.firstname || ''}`.trim()
                : null;

            // ✅ Determine company type (ΕΤΑΙΡΕΙΑ vs ΕΠΙΧΕΙΡΗΣΗ)
            let companyType = 'ΕΠΙΧΕΙΡΗΣΗ'; // Default
            if (company && company.eponymia) {
                const firstname = (company.firstname || '').trim();
                if (!firstname || firstname === '') {
                    companyType = 'ΕΤΑΙΡΕΙΑ'; // Εταιρεία (no firstname)
                } else {
                    companyType = 'ΕΠΙΧΕΙΡΗΣΗ'; // Ατομική επιχείρηση (has firstname)
                }
            }

            // ✅ Get ypokatasthmata data
            try {
                ypokatasthmata = await YpokatasthmataModel.findOne({
                    companykod_object: sessionCompanyInUse,
                    kodikos: savedErgazomenos.ypokatasthma
                }).lean();

                if (!ypokatasthmata) {
                    console.warn(
                        '⚠️  [BACKEND] No ypokatasthmata found for:',
                        savedErgazomenos.ypokatasthma
                    );
                }
            } catch (error) {
                console.error('❌ [BACKEND] Error fetching ypokatasthmata:', error.message);
                ypokatasthmata = null;
            }

            // =====================================================================
            // ✅ CONDITIONAL E3 XML GENERATION
            // =====================================================================

            let e3XmlData = null;

            // ✅ DEBUG: Log received data BEFORE if statement
            logger.debug('E3 Generation block reached', {
                module: 'E3-XML-DEBUG',
                filesToUpdate: filesToUpdate,
                e3_flag: filesToUpdate?.e3_anaggelia_proslhpshs,
                e3_flag_type: typeof filesToUpdate?.e3_anaggelia_proslhpshs,
                e3_flag_strict_check: filesToUpdate?.e3_anaggelia_proslhpshs === true
            });

            if (filesToUpdate?.e3_anaggelia_proslhpshs === true) {
                logger.info('E3 XML generation requested', {
                    module: 'E3-XML',
                    employee_kod: savedErgazomenos.kodikos,
                    employee_afm: savedErgazomenos.afm,
                    company: company?.eponymia || 'N/A'
                });

                try {
                    const { generateE3XML } = require('../../utils/xmlGenerators/e3N_v1Generator');

                    // ✅ Generate XML (returns object with xml + storage info)
                    const xmlResult = await generateE3XML(
                        savedErgazomenos,
                        company,
                        ypokatasthmata
                    );

                    logger.info('E3 XML generated successfully', {
                        module: 'E3-XML',
                        s3_key: xmlResult.s3Key,
                        filename: xmlResult.filename,
                        s3_url: xmlResult.s3Url
                    });

                    // // ✅ Save S3 key to employee record (if saved successfully)
                    // if (xmlResult.s3Key) {
                    //     savedErgazomenos.e3_xml_path = xmlResult.s3Key;
                    //     await savedErgazomenos.save();
                    //     console.log('✅ [E3-XML] Path saved to employee record');
                    // }

                    // ✅ Generate presigned download URL (10 min expiration)
                    if (xmlResult.s3Key) {
                        // ✅ Helper once (used in both try/catch)
                        const toRelativeUploadsPath = (p) => {
                            if (!p) return null;

                            // URL → pathname
                            if (p.startsWith('http://') || p.startsWith('https://')) {
                                p = new URL(p).pathname;
                            }

                            // file:/// → filesystem
                            if (p.startsWith('file:///')) {
                                p = p.replace('file:///', '/');
                            }

                            // normalize slashes
                            p = p.replace(/\\/g, '/');

                            // keep only "uploads/..."
                            const idx = p.indexOf('/uploads/');
                            if (idx !== -1) return p.slice(idx + 1); // -> "uploads/..."
                            if (p.startsWith('/uploads/')) return p.slice(1);
                            if (p.startsWith('uploads/')) return p;

                            return null;
                        };

                        const relativePath = toRelativeUploadsPath(xmlResult.s3Url);

                        try {
                            const downloadUrl = await generatePresignedUrl(xmlResult.s3Key, 600);

                            e3XmlData = {
                                success: true,
                                s3Key: xmlResult.s3Key,
                                downloadUrl,
                                filename: xmlResult.filename,
                                relativePath
                            };

                            logger.info('[E3PATH] generated', {
                                filename: e3XmlData.filename,
                                relativePath: e3XmlData.relativePath
                            });
                        } catch (urlError) {
                            e3XmlData = {
                                success: true,
                                s3Key: xmlResult.s3Key,
                                downloadUrl: null,
                                filename: xmlResult.filename,
                                relativePath,
                                urlError: urlError.message
                            };

                            logger.warn('[E3PATH] generated WITHOUT presigned URL', {
                                filename: e3XmlData.filename,
                                relativePath: e3XmlData.relativePath,
                                urlError: urlError.message
                            });
                        }
                    } else {
                        logger.warn('[E3PATH] xml generated but NOT saved', {
                            saveError: xmlResult.saveError
                        });

                        e3XmlData = {
                            success: false,
                            error: xmlResult.saveError || 'XML not saved'
                        };
                    }
                } catch (e3Error) {
                    logger.error('E3 XML generation failed', {
                        module: 'E3-XML',
                        error: e3Error.message,
                        stack: e3Error.stack
                    });

                    e3XmlData = {
                        success: false,
                        error: e3Error.message
                    };
                }
            } else {
                logger.info('E3 XML generation skipped (checkbox not checked)', {
                    module: 'E3-XML',
                    checkbox_value: filesToUpdate?.e3_anaggelia_proslhpshs
                });
            }

            // =====================================================================
            // ✅ CONDITIONAL WTO XML GENERATION
            // =====================================================================
            // =====================================================================
            // ✅ 4) GENERATE WTO XML (if schedules enabled AND isPermanent)
            // =====================================================================

            let wtoXmlData = { success: false };

            // ✅ CRITICAL: Only generate WTO XML if:
            //    1. schedules checkbox is checked
            //    2. isPermanent is TRUE (Οριστική Ενημέρωση)
            if (filesToUpdate?.schedules === true && filesToUpdate?.isPermanent === true) {
                try {
                    logger.info('WTO XML generation requested (Οριστική)', {
                        module: 'WTO-XML',
                        employee_kod: newErgazomenos.kodikos_ergazomenoy,
                        employee_afm: newErgazomenos.afm,
                        company: companyData?.eponymia || 'N/A',
                        isPermanent: true
                    });

                    const {
                        generateWtoWeeklyXML
                    } = require('../../utils/xmlGenerators/wtoGenerator');

                    wtoXmlData = await generateWtoWeeklyXML(
                        newErgazomenos._id,
                        newErgazomenos,
                        companyData,
                        ypokatasthmataData
                    );

                    if (wtoXmlData.success) {
                        logger.info('WTO XML generated successfully', {
                            module: 'WTO-XML',
                            s3_key: wtoXmlData.s3Key,
                            filename: wtoXmlData.filename,
                            s3_url: wtoXmlData.s3Url
                        });

                        logger.info('[WTO-PATH] generated', {
                            filename: wtoXmlData.filename,
                            relativePath: wtoXmlData.relativePath
                        });
                    }
                } catch (wtoError) {
                    logger.error('WTO XML generation failed', {
                        module: 'WTO-XML',
                        error: wtoError.message
                    });
                }
            } else {
                logger.info('WTO XML generation skipped (checkbox not checked)', {
                    module: 'WTO-XML',
                    checkbox_value: filesToUpdate?.schedules
                });
            }

            // =====================================================================
            // ✅ FINAL RESPONSE (with E3 data if generated)
            // =====================================================================

            return res.status(201).json({
                success: true,
                message: 'Εργαζόμενος δημιουργήθηκε επιτυχώς',
                data: {
                    _id: savedErgazomenos._id,
                    kodikos: savedErgazomenos.kodikos,
                    eponymo: savedErgazomenos.eponymo,
                    onoma: savedErgazomenos.onoma,
                    email: savedErgazomenos.email,
                    fylo: savedErgazomenos.fylo,
                    yphkoothta: savedErgazomenos.yphkoothta,
                    arxeio_apodoxhs_oron_atomikhs_symbashs_path:
                        savedErgazomenos.arxeio_apodoxhs_oron_atomikhs_symbashs_path,
                    arxeio_apodoxhs_oysiodon_oron_path:
                        savedErgazomenos.arxeio_apodoxhs_oysiodon_oron_path,
                    bibliario_anhlikoy_path: savedErgazomenos.bibliario_anhlikoy_path,
                    arxeio_symbashs_daneismoy_path: savedErgazomenos.arxeio_symbashs_daneismoy_path,
                    arxeio_nomimopoihtikon_eggrafon_path:
                        savedErgazomenos.arxeio_nomimopoihtikon_eggrafon_path
                    // e3_xml_path: savedErgazomenos.e3_xml_path,
                    // wto_xml_path: savedErgazomenos.wto_xml_path
                },
                pdfResults: pdfResults,
                contractPdf: contractPdfData,
                e3XmlData: e3XmlData,
                wtoXmlData: wtoXmlData, // ✅ NEW!
                companyEmail: companyEmail,
                companyPhone: companyPhone,
                companyName: companyName,
                companyType: companyType,
                redirectUrl: '/ergazomenoi/ergazomenoi',
                waitingForPdfConfirmation: true
            });
        } catch (error) {
            console.log('Σφάλμα κατά τη δημιουργία απάντησης:', error);
            return res.status(500).json({
                success: false,
                errorMessage: 'Σφάλμα κατά την ολοκλήρωση'
            });
        }
    };

    // ======================================================================
    // ✅ UPLOAD E3 TO ERGANH - PROD SAFE (S3) + DEV SAFE (LOCAL)
    // Uses Playwright uploader that requires a local file path.
    // ======================================================================
    static uploadE3ToErganh = async (req, res) => {
        const sessionCompanyInUse = req.session?.companyInUse;
        const sessionUserId = req.session?.userId;

        const { ergazomenosId, s3Url, isPermanent } = req.body || {};

        console.log('[ERGANH-E3] Upload options:', {
            ergazomenosId,
            s3Url: s3Url?.substring(0, 80),
            isPermanent: isPermanent === true
        });

        // ✅ Σταθερό key για lock/cooldown
        const key = `${sessionCompanyInUse || 'NO_COMPANY'}:${ergazomenosId || 'NO_EMP'}:E3`;

        // ✅ Socket emitter (rooms: user_<userId>)
        const { emitToUser } = require('../../socket');

        function emitErganhStep(userId, step, message) {
            const totalSteps = 4;
            const percentByStep = { 1: 0, 2: 30, 3: 60, 4: 90 };
            const percent = percentByStep[step] ?? 0;

            if (!userId) return;

            emitToUser(userId, 'erganh:progress', {
                percent,
                message,
                step,
                totalSteps
            });
        }

        let localXmlPath = s3Url;
        let tempDownloaded = false;

        try {
            // ------------------------------------------------------------------
            // ✅ 0) Basic validation
            // ------------------------------------------------------------------
            if (!ergazomenosId || !s3Url) {
                emitToUser(sessionUserId, 'erganh:error', {
                    message: 'Λείπουν στοιχεία αιτήματος.'
                });
                return res.status(200).json({
                    success: false,
                    userMessage: 'Λείπουν στοιχεία αιτήματος (εργαζόμενος / αρχείο).',
                    errorDetails: 'Missing ergazomenosId or s3Url',
                    messages: []
                });
            }

            if (!sessionCompanyInUse) {
                emitToUser(sessionUserId, 'erganh:error', {
                    message: 'Δεν έχει οριστεί εταιρεία στη συνεδρία.'
                });
                return res.status(200).json({
                    success: false,
                    userMessage: 'Δεν έχει οριστεί εταιρεία στη συνεδρία (companyInUse).',
                    errorDetails: 'Missing session.companyInUse',
                    messages: []
                });
            }

            // ✅ Step 1: login entry (user sees loader immediately)
            emitErganhStep(sessionUserId, 1, 'Είσοδος στο ΕΡΓΑΝΗ ΙΙ');

            // ------------------------------------------------------------------
            // ✅ 0.1) Cooldown
            // ------------------------------------------------------------------
            const now = Date.now();
            const last = erganiLastStart.get(key) || 0;
            const left = ERGANI_COOLDOWN_MS - (now - last);

            if (left > 0) {
                const secondsLeft = Math.ceil(left / 1000);

                console.log(
                    `[Ε3 COOLDOWN] User ${sessionUserId}, Key: ${key}, ${secondsLeft}s remaining`
                );

                emitToUser(sessionUserId, 'erganh:error', {
                    message: `Cooldown ενεργό. Περιμένετε ${secondsLeft} δευτερόλεπτα.`,
                    cooldownMs: left,
                    cooldownSeconds: secondsLeft
                });

                return res.status(200).json({
                    success: false,
                    userMessage: `⏳ Πολύ γρήγορη ενέργεια. Περιμένετε ${secondsLeft} δευτερόλεπτα και ξαναπροσπαθήστε.`,
                    errorDetails: `Cooldown: ${secondsLeft}s / ${Math.ceil(ERGANI_COOLDOWN_MS / 1000)}s total`,
                    cooldownMs: left,
                    cooldownSeconds: secondsLeft,
                    messages: []
                });
            }
            // ------------------------------------------------------------------
            // ✅ 0.2) Concurrent lock
            // ------------------------------------------------------------------
            if (erganiInflight.has(key)) {
                emitToUser(sessionUserId, 'erganh:error', {
                    message: 'Υπάρχει ήδη υποβολή σε εξέλιξη.'
                });
                return res.status(200).json({
                    success: false,
                    userMessage: 'Υπάρχει ήδη υποβολή σε εξέλιξη για αυτόν τον εργαζόμενο.',
                    errorDetails: 'ERGANH upload inflight (server-side lock)',
                    messages: []
                });
            }

            // ✅ lock + start cooldown timer
            erganiInflight.set(key, true);
            erganiLastStart.set(key, now);

            // ------------------------------------------------------------------
            // ✅ 1) Resolve local XML path (DEV vs PROD) - ✅ FIXED
            // ------------------------------------------------------------------
            const prepMsg =
                typeof s3Url === 'string' && isS3Url(s3Url)
                    ? 'Προετοιμασία Αποστολής (λήψη XML από S3)'
                    : 'Προετοιμασία Αποστολής';

            emitErganhStep(sessionUserId, 2, prepMsg);

            // ✅ FIXED: Now supports both s3:// and HTTPS S3 URLs
            if (typeof s3Url === 'string' && isS3Url(s3Url)) {
                logger.info('[ERGANH-UPLOAD] S3 download start', { s3Url });

                localXmlPath = await downloadS3UriToTempFile(s3Url, sessionCompanyInUse);
                tempDownloaded = true;

                logger.info('[ERGANH-UPLOAD] S3 download ok', { localXmlPath });
            } else {
                const cwd = process.cwd();

                if (
                    !path.isAbsolute(localXmlPath) &&
                    !localXmlPath.startsWith('file:///') &&
                    !localXmlPath.startsWith('http')
                ) {
                    localXmlPath = path.join(cwd, localXmlPath.replace(/^\//, ''));
                }

                if (localXmlPath.startsWith('file:///')) {
                    localXmlPath = localXmlPath.replace('file:///', '/');
                }

                localXmlPath = path.resolve(path.normalize(localXmlPath));
            }

            // ------------------------------------------------------------------
            // ✅ 2) Ensure file exists + non-empty
            // ------------------------------------------------------------------
            const exists = await fs.pathExists(localXmlPath);
            if (!exists) {
                emitToUser(sessionUserId, 'erganh:error', {
                    message: 'Δεν βρέθηκε το XML αρχείο.'
                });
                return res.status(200).json({
                    success: false,
                    userMessage: `Δεν βρέθηκε το XML αρχείο: ${path.basename(localXmlPath)}`,
                    errorDetails: `XML file not found: ${localXmlPath}`,
                    messages: []
                });
            }

            const stats = await fs.stat(localXmlPath);
            if (!stats.size) {
                emitToUser(sessionUserId, 'erganh:error', { message: 'Το XML αρχείο είναι κενό.' });
                return res.status(200).json({
                    success: false,
                    userMessage: 'Το XML αρχείο είναι κενό.',
                    errorDetails: `XML file is empty: ${localXmlPath}`,
                    messages: []
                });
            }

            logger.info('[ERGANH-UPLOAD] Local XML ready', { localXmlPath, size: stats.size });

            // ------------------------------------------------------------------
            // ✅ 3) Load ERGANH credentials
            // ------------------------------------------------------------------
            const passwordsData = await PasswordsModel.findOne({
                companykod_object: sessionCompanyInUse,
                kodikos: '0002'
            }).lean();

            const erganhUsername = passwordsData?.username;
            const erganhPassword = passwordsData?.password;

            if (!erganhUsername || !erganhPassword) {
                emitToUser(sessionUserId, 'erganh:error', {
                    message: 'Λείπουν τα στοιχεία σύνδεσης ΕΡΓΑΝΗ.'
                });
                return res.status(200).json({
                    success: false,
                    userMessage: 'Λείπουν τα στοιχεία σύνδεσης ΕΡΓΑΝΗ για την εταιρεία.',
                    errorDetails: 'Missing ERGANH credentials (PasswordsModel kodikos=0002)',
                    messages: []
                });
            }

            // ✅ Step 3: selecting file
            emitErganhStep(sessionUserId, 3, 'Επιλογή XML αρχείου');

            // ------------------------------------------------------------------
            // ✅ 4) Run uploader (BLOCKING)
            // ------------------------------------------------------------------
            const { uploadE3ToErganh } = require('../../utils/erganh/e3Uploader');

            // ✅ Step 4: sending/uploading
            emitErganhStep(sessionUserId, 4, 'Αποστολή');

            const uploadResult = await uploadE3ToErganh(
                sessionCompanyInUse,
                localXmlPath,
                sessionUserId,
                { username: erganhUsername, password: erganhPassword },
                { isPermanent: isPermanent === true } // ✅ Pass options
            );

            // ------------------------------------------------------------------
            // ✅ 5) Save protocol OR errors to DB
            // ------------------------------------------------------------------
            // if (uploadResult?.success && uploadResult?.protocol) {
            //     ErgazomenoiModel.findByIdAndUpdate(ergazomenosId, {
            //         erganh_e3_protocol: uploadResult.protocol,
            //         erganh_e3_upload_date: new Date(),
            //         erganh_e3_screenshot: uploadResult.screenshot
            //     }).catch(() => {});
            // } else if (uploadResult?.messages?.length) {
            //     ErgazomenoiModel.findByIdAndUpdate(ergazomenosId, {
            //         erganh_e3_errors: uploadResult.messages,
            //         erganh_e3_error_date: new Date(),
            //         erganh_e3_screenshot: uploadResult.screenshot
            //     }).catch(() => {});
            // }

            // ------------------------------------------------------------------
            // ✅ 6) Return result to frontend
            // ------------------------------------------------------------------
            emitToUser(sessionUserId, 'erganh:done', { message: 'Ολοκληρώθηκε' });

            return res.status(200).json({
                success: !!uploadResult?.success,
                protocol: uploadResult?.protocol || null,
                screenshot: uploadResult?.screenshot || null,
                userMessage:
                    uploadResult?.userMessage ||
                    (uploadResult?.success
                        ? 'Η υποβολή ολοκληρώθηκε. (Προσωρινή Αποθήκευση.)'
                        : 'Η υποβολή απέτυχε.'),
                errorDetails: uploadResult?.errorDetails || uploadResult?.error || '',
                messages: uploadResult?.messages || []
            });
        } catch (error) {
            logger.error('[ERGANH-UPLOAD] Blocking endpoint failed', {
                error: error.message,
                stack: error.stack
            });

            emitToUser(sessionUserId, 'erganh:error', { message: 'Αποτυχία υποβολής στο ΕΡΓΑΝΗ' });

            return res.status(500).json({
                success: false,
                userMessage: 'Failed to upload to ERGANH',
                errorDetails: error.message,
                messages: []
            });
        } finally {
            // ✅ cleanup temp file (only if downloaded from S3)
            if (tempDownloaded && localXmlPath) {
                fs.remove(localXmlPath).catch(() => {});
            }

            // ✅ always unlock
            erganiInflight.delete(key);
        }
    };

    static uploadWtoToErganh = async (req, res) => {
        const sessionCompanyInUse = req.session?.companyInUse;
        const sessionUserId = req.session?.userId;

        const { ergazomenosId, s3Url } = req.body || {};

        // ✅ Σταθερό key για lock/cooldown
        const key = `${sessionCompanyInUse || 'NO_COMPANY'}:${ergazomenosId || 'NO_EMP'}:WTO`;

        // ✅ Socket emitter (rooms: user_<userId>)
        const { emitToUser } = require('../../socket');

        function emitErganhStep(userId, step, message) {
            const totalSteps = 4;
            const percentByStep = { 1: 0, 2: 30, 3: 60, 4: 90 };
            const percent = percentByStep[step] ?? 0;

            if (!userId) return;

            emitToUser(userId, 'erganh:progress', {
                percent,
                message,
                step,
                totalSteps
            });
        }

        let localXmlPath = s3Url;
        let tempDownloaded = false;

        try {
            // ------------------------------------------------------------------
            // ✅ 0) Basic validation
            // ------------------------------------------------------------------
            if (!ergazomenosId || !s3Url) {
                emitToUser(sessionUserId, 'erganh:error', {
                    message: 'Λείπουν στοιχεία αιτήματος (WTO).'
                });
                return res.status(200).json({
                    success: false,
                    userMessage: 'Λείπουν στοιχεία αιτήματος (εργαζόμενος / αρχείο WTO).',
                    errorDetails: 'Missing ergazomenosId or s3Url',
                    messages: []
                });
            }

            if (!sessionCompanyInUse) {
                emitToUser(sessionUserId, 'erganh:error', {
                    message: 'Δεν έχει οριστεί εταιρεία στη συνεδρία.'
                });
                return res.status(200).json({
                    success: false,
                    userMessage: 'Δεν έχει οριστεί εταιρεία στη συνεδρία (companyInUse).',
                    errorDetails: 'Missing session.companyInUse',
                    messages: []
                });
            }

            // ✅ Step 1: login entry (user sees loader immediately)
            emitErganhStep(sessionUserId, 1, 'Είσοδος στο ΕΡΓΑΝΗ ΙΙ (WTO)');

            // ------------------------------------------------------------------
            // ✅ 0.1) Cooldown
            // ------------------------------------------------------------------
            const now = Date.now();
            const last = erganiLastStart.get(key) || 0;
            const left = ERGANI_COOLDOWN_MS - (now - last);

            if (left > 0) {
                emitToUser(sessionUserId, 'erganh:error', {
                    message: 'Πολύ σύντομα επαναλαμβανόμενο αίτημα (cooldown WTO).'
                });
                return res.status(200).json({
                    success: false,
                    userMessage:
                        'Έγινε ήδη προσπάθεια πολύ πρόσφατα. Περιμένετε λίγο και ξαναδοκιμάστε.',
                    errorDetails: `Cooldown active (${Math.ceil(left / 1000)}s left)`,
                    messages: []
                });
            }

            // ------------------------------------------------------------------
            // ✅ 0.2) Concurrent lock
            // ------------------------------------------------------------------
            if (erganiInflight.has(key)) {
                emitToUser(sessionUserId, 'erganh:error', {
                    message: 'Υπάρχει ήδη υποβολή WTO σε εξέλιξη.'
                });
                return res.status(200).json({
                    success: false,
                    userMessage: 'Υπάρχει ήδη υποβολή WTO σε εξέλιξη για αυτόν τον εργαζόμενο.',
                    errorDetails: 'WTO upload inflight (server-side lock)',
                    messages: []
                });
            }

            // ✅ lock + start cooldown timer
            erganiInflight.set(key, true);
            erganiLastStart.set(key, now);

            // ------------------------------------------------------------------
            // ✅ 1) Resolve local XML path (DEV vs PROD)
            // ------------------------------------------------------------------
            const prepMsg =
                typeof s3Url === 'string' && isS3Url(s3Url)
                    ? 'Προετοιμασία Αποστολής WTO (λήψη XML από S3)'
                    : 'Προετοιμασία Αποστολής WTO';

            emitErganhStep(sessionUserId, 2, prepMsg);

            if (typeof s3Url === 'string' && isS3Url(s3Url)) {
                logger.info('[WTO-UPLOAD] S3 download start', { s3Url });

                localXmlPath = await downloadS3UriToTempFile(s3Url, sessionCompanyInUse);
                tempDownloaded = true;

                logger.info('[WTO-UPLOAD] S3 download ok', { localXmlPath });
            } else {
                const cwd = process.cwd();

                if (
                    !path.isAbsolute(localXmlPath) &&
                    !localXmlPath.startsWith('file:///') &&
                    !localXmlPath.startsWith('http')
                ) {
                    localXmlPath = path.join(cwd, localXmlPath.replace(/^\//, ''));
                }

                if (localXmlPath.startsWith('file:///')) {
                    localXmlPath = localXmlPath.replace('file:///', '/');
                }

                localXmlPath = path.resolve(path.normalize(localXmlPath));
            }

            // ------------------------------------------------------------------
            // ✅ 2) Ensure file exists + non-empty
            // ------------------------------------------------------------------
            const exists = await fs.pathExists(localXmlPath);
            if (!exists) {
                emitToUser(sessionUserId, 'erganh:error', {
                    message: 'Δεν βρέθηκε το WTO XML αρχείο.'
                });
                return res.status(200).json({
                    success: false,
                    userMessage: `Δεν βρέθηκε το WTO XML αρχείο: ${path.basename(localXmlPath)}`,
                    errorDetails: `WTO XML file not found: ${localXmlPath}`,
                    messages: []
                });
            }

            const stats = await fs.stat(localXmlPath);
            if (!stats.size) {
                emitToUser(sessionUserId, 'erganh:error', {
                    message: 'Το WTO XML αρχείο είναι κενό.'
                });
                return res.status(200).json({
                    success: false,
                    userMessage: 'Το WTO XML αρχείο είναι κενό.',
                    errorDetails: `WTO XML file is empty: ${localXmlPath}`,
                    messages: []
                });
            }

            logger.info('[WTO-UPLOAD] Local XML ready', { localXmlPath, size: stats.size });

            // ------------------------------------------------------------------
            // ✅ 3) Load ERGANH credentials
            // ------------------------------------------------------------------
            const passwordsData = await PasswordsModel.findOne({
                companykod_object: sessionCompanyInUse,
                kodikos: '0002'
            }).lean();

            const erganhUsername = passwordsData?.username;
            const erganhPassword = passwordsData?.password;

            if (!erganhUsername || !erganhPassword) {
                emitToUser(sessionUserId, 'erganh:error', {
                    message: 'Λείπουν τα στοιχεία σύνδεσης ΕΡΓΑΝΗ (WTO).'
                });
                return res.status(200).json({
                    success: false,
                    userMessage: 'Λείπουν τα στοιχεία σύνδεσης ΕΡΓΑΝΗ για την εταιρεία.',
                    errorDetails: 'Missing ERGANH credentials (PasswordsModel kodikos=0002)',
                    messages: []
                });
            }

            // ✅ Step 3: selecting file
            emitErganhStep(sessionUserId, 3, 'Επιλογή WTO XML αρχείου');

            // ------------------------------------------------------------------
            // ✅ 4) Run WTO uploader (BLOCKING)
            // ------------------------------------------------------------------
            const { uploadWtoToErganh } = require('../../utils/erganh/wtoUploader');

            // ✅ Step 4: sending/uploading
            emitErganhStep(sessionUserId, 4, 'Αποστολή WTO');

            const uploadResult = await uploadWtoToErganh(
                sessionCompanyInUse,
                localXmlPath,
                sessionUserId,
                { username: erganhUsername, password: erganhPassword }
            );

            // ------------------------------------------------------------------
            // ✅ 5) Save protocol OR errors to DB
            // ------------------------------------------------------------------
            // ------------------------------------------------------------------
            // ✅ 5) DB Save skipped (Temporary storage in ERGANH only)
            // ------------------------------------------------------------------
            // ℹ️ ERGANH stores in "Προσωρινή" state, no need to save protocol yet
            // Can be enabled later if needed
            // ------------------------------------------------------------------
            // ✅ 6) Return result to frontend
            // ------------------------------------------------------------------
            emitToUser(sessionUserId, 'erganh:done', { message: 'Ολοκληρώθηκε WTO' });

            return res.status(200).json({
                success: !!uploadResult?.success,
                protocol: uploadResult?.protocol || null,
                screenshot: uploadResult?.screenshot || null,
                userMessage:
                    uploadResult?.userMessage ||
                    (uploadResult?.success
                        ? 'Η υποβολή WTO ολοκληρώθηκε. (Προσωρινή Αποθήκευση.)'
                        : 'Η υποβολή WTO απέτυχε.'),
                errorDetails: uploadResult?.errorDetails || uploadResult?.error || '',
                messages: uploadResult?.messages || []
            });
        } catch (error) {
            logger.error('[WTO-UPLOAD] Blocking endpoint failed', {
                error: error.message,
                stack: error.stack
            });

            emitToUser(sessionUserId, 'erganh:error', {
                message: 'Αποτυχία υποβολής WTO στο ΕΡΓΑΝΗ'
            });

            return res.status(500).json({
                success: false,
                userMessage: 'Failed to upload WTO to ERGANH',
                errorDetails: error.message,
                messages: []
            });
        } finally {
            // ✅ cleanup temp file (only if downloaded from S3)
            if (tempDownloaded && localXmlPath) {
                fs.remove(localXmlPath).catch(() => {});
            }

            // ✅ always unlock
            erganiInflight.delete(key);
        }
    };

    static uploadWtoTemporaryToErganh = async (req, res) => {
        const sessionCompanyInUse = req.session?.companyInUse;
        const sessionUserId = req.session?.userId;

        const { ergazomenosId } = req.body || {};
        try {
            console.log('[WTO-TEMP] Controller received:', {
                ergazomenosId,
                hasSession: !!req.session,
                userId: sessionUserId,
                companyInUse: sessionCompanyInUse
            });

            // =====================================================================
            // ✅ VALIDATION
            // =====================================================================
            if (!ergazomenosId) {
                console.error('[WTO-TEMP] Missing ergazomenosId');
                return res.status(400).json({
                    success: false,
                    userMessage: 'Λείπουν στοιχεία αιτήματος (WTO).',
                    errorDetails: 'ergazomenosId is required'
                });
            }

            if (!sessionUserId || !sessionCompanyInUse) {
                console.error('[WTO-TEMP] Missing session data');
                return res.status(401).json({
                    success: false,
                    userMessage: 'Η συνεδρία έχει λήξει. Παρακαλώ συνδεθείτε ξανά.',
                    errorDetails: 'Session expired'
                });
            }

            // =====================================================================
            // ✅ FETCH EMPLOYEE DATA FROM DATABASE
            // =====================================================================
            const ergazomenos = await ErgazomenoiModel.findById(ergazomenosId).lean();

            if (!ergazomenos) {
                console.error('[WTO-TEMP] Employee not found:', ergazomenosId);
                return res.status(404).json({
                    success: false,
                    userMessage: 'Δεν βρέθηκε ο εργαζόμενος.',
                    errorDetails: `Employee ${ergazomenosId} not found`
                });
            }

            console.log('[WTO-TEMP] Employee found:', {
                afm: ergazomenos.afm,
                eponymo: ergazomenos.eponymo,
                onoma: ergazomenos.onoma,
                ypokatasthma: ergazomenos.ypokatasthma
            });

            // =====================================================================
            // ✅ PREPARE EMPLOYEE DATA FOR WTO FORM (COMPLETE VERSION)
            // =====================================================================
            const ergazomenosData = {
                // ✅ Database query fields
                team: ergazomenos.team,
                company_kod: ergazomenos.company_kod,
                kodikos: ergazomenos.kodikos,

                // ✅ Date range
                hmeromhnia_allaghs_orarioy_apo: ergazomenos.hmeromhnia_allaghs_orarioy_apo,
                hmeromhnia_allaghs_orarioy_eos: ergazomenos.hmeromhnia_allaghs_orarioy_eos,

                // ✅ Form fields
                ypokatasthma: ergazomenos.ypokatasthma || '0000',
                afm: ergazomenos.afm || '',
                eponymo: ergazomenos.eponymo || '',
                onoma: ergazomenos.onoma || ''
            };

            console.log('[WTO-TEMP] Prepared data (FULL):', ergazomenosData);

            // =====================================================================
            // ✅ GET ERGANH CREDENTIALS
            // =====================================================================
            const passwordsData = await PasswordsModel.findOne({
                companykod_object: sessionCompanyInUse,
                kodikos: '0002'
            }).lean();

            const erganhUsername = passwordsData?.username;
            const erganhPassword = passwordsData?.password;

            if (!erganhUsername || !erganhPassword) {
                console.error('[WTO-TEMP] Missing ERGANH credentials');
                return res.status(400).json({
                    success: false,
                    userMessage: 'Δεν βρέθηκαν τα στοιχεία σύνδεσης ΕΡΓΑΝΗ.',
                    errorDetails: 'ERGANH credentials not configured'
                });
            }

            console.log('[WTO-TEMP] ERGANH credentials found');

            // =====================================================================
            // ✅ CALL WTO TEMPORARY UPLOADER (NO XML PATH NEEDED!)
            // =====================================================================
            const { uploadWtoTemporary } = require('../../utils/erganh/wtoTemporaryUploader');

            console.log('[WTO-TEMP] Calling uploadWtoTemporary...');

            const uploadResult = await uploadWtoTemporary(
                sessionCompanyInUse,
                null, // ✅ NO XML PATH - manual form navigation
                ergazomenosData,
                sessionUserId,
                { username: erganhUsername, password: erganhPassword }
            );

            console.log('[WTO-TEMP] Upload result:', uploadResult);

            // =====================================================================
            // ✅ RETURN RESULT
            // =====================================================================
            if (uploadResult?.success) {
                return res.status(200).json({
                    success: true,
                    userMessage:
                        uploadResult.userMessage ||
                        'Η φόρμα WTO_weekly συμπληρώθηκε επιτυχώς. Ολοκλήρωσε την υποβολή στο παράθυρο του ΕΡΓΑΝΗ.',
                    protocol: uploadResult.protocol || null
                });
            } else {
                return res.status(500).json({
                    success: false,
                    userMessage:
                        uploadResult?.userMessage || 'Αποτυχία συμπλήρωσης φόρμας WTO_weekly.',
                    errorDetails:
                        uploadResult?.error || uploadResult?.errorDetails || 'Unknown error',
                    screenshot: uploadResult?.screenshot || null
                });
            }
        } catch (error) {
            console.error('[WTO-TEMP] Controller error:', error);

            return res.status(500).json({
                success: false,
                userMessage: 'Σφάλμα κατά την επεξεργασία του αιτήματος.',
                errorDetails: error.message
            });
        }
    };

    static getOrariaAnaErgazomeno = async (req, res) => {
        try {
            const {
                team,
                company_kod,
                kodikos,
                hmeromhnia_allaghs_orarioy_apo,
                hmeromhnia_allaghs_orarioy_eos
            } = req.body;

            // Μετατροπή των ημερομηνιών σε αντικείμενα τύπου Date για MongoDB
            const startDate = new Date(hmeromhnia_allaghs_orarioy_apo);
            const endDate = new Date(hmeromhnia_allaghs_orarioy_eos);

            // Χρήση aggregate pipeline για να φιλτράρουμε τα ωράρια και να κάνουμε group ή άλλες λειτουργίες
            const results = await ProdhlomenaOrariaModel.aggregate([
                {
                    $match: {
                        team: team,
                        company_kod: company_kod,
                        kodikos: kodikos,
                        hmeromhnia: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $sort: { hmeromhnia: 1 }
                }
                // {
                //   $group: {
                //     _id: '$kodikos',  // Μπορείς να αλλάξεις το grouping field ανάλογα με την ανάγκη σου
                //     totalHours: { $sum: '$hours' }, // Παράδειγμα ομαδοποίησης: Υπολογισμός συνολικών ωρών
                //     details: { $push: '$$ROOT' }  // Προσθήκη όλων των εγγραφών στο πεδίο "details"
                //   }
                // }
            ]);

            // Επιστροφή των αποτελεσμάτων στο frontend
            res.status(200).json(results);
        } catch (error) {
            console.error('Error fetching oraria with aggregation:', error);
            res.status(500).json({ message: 'Σφάλμα κατά την λήψη των ωραρίων με aggregate.' });
        }
    };

    static postErgazomenoiUpdate = async (req, res) => {
        const ergazomenoiId = req.params.ergazomenoiId;
        const formData = req.body;

        const omadaErgasias = formData.team;
        const kodikosEtaireias = formData.company_kod;
        const kodikosErgazomenoy = formData.kodikosHidden;
        let aa_eggr = null,
            recExist = false;

        try {
            const existRecord = await IstorikoProslhpseonAllagonModel.findOne({
                team: omadaErgasias,
                company_kod: kodikosEtaireias,
                kodikos: kodikosErgazomenoy,
                hmeromhnia_proslhpshs: formData.hmeromhnia_proslhpshs
                    ? new Date(formData.hmeromhnia_proslhpshs + 'T00:00:00.000+00:00')
                    : null,
                hmeromhnia_allaghs_symbashs: formData.hmeromhnia_allaghs_symbashs
                    ? new Date(formData.hmeromhnia_allaghs_symbashs + 'T00:00:00.000+00:00')
                    : null,
                hmeromhnia_lhxhs_symbashs: formData.hmeromhnia_lhxhs_symbashs
                    ? new Date(formData.hmeromhnia_lhxhs_symbashs + 'T00:00:00.000+00:00')
                    : null,
                hmeromhnia_apoxorhshs: formData.hmeromhnia_apoxorhshs
                    ? new Date(formData.hmeromhnia_apoxorhshs + 'T00:00:00.000+00:00')
                    : null
            });

            recExist = existRecord ? true : false;

            const lastRecordIstorikoy = await IstorikoProslhpseonAllagonModel.find({
                team: omadaErgasias,
                company_kod: kodikosEtaireias,
                kodikos: kodikosErgazomenoy
            })
                .sort({ _id: -1 })
                .limit(1);
            let aaValue =
                lastRecordIstorikoy[0] && lastRecordIstorikoy[0].aa_eggrafhs
                    ? parseInt(lastRecordIstorikoy[0].aa_eggrafhs, 10)
                    : null;
            if (aaValue !== null) {
                aaValue++;
            } else {
                aaValue = 1;
            }
            aa_eggr = aaValue;
        } catch (error) {
            console.log('Σφάλμα :', error);
        }

        const filteredDataErgazomenoi = {
            energos: formData.energos,
            fylo: formData.fylo,
            eponymo: formData.eponymoHidden,
            onoma: formData.onomaHidden,
            eponymo_patera: formData.eponymo_patera,
            patronymo: formData.patronymo,
            eponymo_mhteras: formData.eponymo_mhteras,
            mhtronymo: formData.mhtronymo,
            afm: formData.afm_ergazomenoyHidden,
            doy: formData.doy,
            typos_taytothtas: formData.typos_taytothtas,
            adt: formData.adt,
            hmeromhnia_ekdoshs: formData.hmeromhnia_ekdoshs,
            arxh_ekdoshs: formData.arxh_ekdoshs,
            amka: formData.amka_ergazomenoyHidden,
            hmeromhnia_gennhshs: formData.hmeromhnia_gennhshs,
            topos_gennhshs: formData.topos_gennhshs,
            arithmos_bibliarioy_anhlikoy: formData.arithmos_bibliarioy_anhlikoy,
            yphkoothta: formData.yphkoothta,
            odos: formData.odos,
            arithmos: formData.arithmos,
            tk: formData.tk,
            thlefono: formData.thlefono,
            perifereia: formData.perifereia,
            nomos: formData.nomos,
            dhmos: formData.dhmos,
            polh: formData.polh,
            email: formData.email,
            hmeromhnia_proslhpshs: formData.hmeromhnia_proslhpshs,
            hmeromhnia_allaghs_symbashs: formData.hmeromhnia_allaghs_symbashs,
            hmeromhnia_allaghs_orarioy_apo: formData.hmeromhnia_allaghs_orarioy_apo,
            hmeromhnia_allaghs_orarioy_eos: formData.hmeromhnia_allaghs_orarioy_eos,
            hmeromhnia_lhxhs_symbashs: formData.hmeromhnia_lhxhs_symbashs,
            hmeromhnia_apoxorhshs: formData.hmeromhnia_apoxorhshs,
            kathestos_apasxolhshs: formData.kathestos_apasxolhshs,
            sxesh_ergasias: formData.sxesh_ergasias,
            apasxolhsh_gia_proth_fora: formData.apasxolhsh_gia_proth_fora,
            ora_enarxhs_proths_foras: formData.ora_enarxhs_proths_foras,
            ora_apoxorhshs_proths_foras: formData.ora_apoxorhshs_proths_foras,
            karta_ergasias: formData.karta_ergasias,
            evelikth_proselefsh: formData.evelikth_proselefsh,
            syggeneia: formData.syggeneia,
            syggenikh_sxesh: formData.syggenikh_sxesh,
            proyphresia_se_eth: formData.proyphresia_se_eth,
            proyphresia_se_mhnes: formData.proyphresia_se_mhnes,
            proyphresia_adeias_se_eth: formData.proyphresia_adeias_se_eth,
            synolo_proyphresias_se_eth: formData.synolo_proyphresias_se_eth,
            synolo_proyphresias_se_mhnes: formData.synolo_proyphresias_se_mhnes,
            misthologiko_klimakio: formData.misthologiko_klimakio,
            plhrhs_apasxolhsh: formData.plhrhs_apasxolhsh,
            dieythethsh_xronoy_ergasias: formData.dieythethsh_xronoy_ergasias,
            hmeres_ergasias_ebdomadas: formData.hmeres_ergasias_ebdomadas,
            ores_ergasias_ebdomadas: formData.ores_ergasias_ebdomadas,
            dialleima_se_lepta: formData.dialleima_se_lepta,
            dialleima_entos_ektos_orarioy: formData.dialleima_entos_ektos_orarioy,
            symbatikes_ores_ergasias: formData.symbatikes_ores_ergasias,
            typos_orarioy: formData.typos_orarioy,
            synexes_diakekomeno: formData.synexes_diakekomeno,
            pshfiakh_organosh: formData.pshfiakh_organosh,
            apasxolhsh_basei_symbashs: formData.apasxolhsh_basei_symbashs,
            asfalish_me_tekmarta: formData.asfalish_me_tekmarta,
            asfalistikh_klash: formData.asfalistikh_klash,
            epoxikos: formData.epoxikos,
            tmhma: formData.tmhma,
            eidikh_kathgoria_ergazomenoy: formData.eidikh_kathgoria_ergazomenoy,
            oikogeneiakh_katastash: formData.oikogeneiakh_katastash,
            arithmos_teknon: formData.arithmos_teknon,
            ekpaideytiko_epipedo: formData.ekpaideytiko_epipedo,
            eidikothta: formData.eidikothta,
            antikeimeno_ergasion: formData.antikeimeno_ergasion,
            typos_ergazomenon: formData.typos_ergazomenon,
            ypokatasthma: formData.ypokatasthma,
            xarakthrismos_ergazomenon: formData.xarakthrismos_ergazomenon,
            eidikothta_erganh: formData.eidikothta_erganh,
            kad_efka: formData.kad_efka,
            eidikothta_efka: formData.eidikothta_efka,
            kpk_efka: formData.kpk_efka,
            kpk_efka_basei_symbashs: formData.kpk_efka_basei_symbashs,
            epa_efka: formData.epa_efka,
            meiosh_eisforon_ergazomenon: formData.meiosh_eisforon_ergazomenon,
            epidothsh_eisforon_ergodoth: formData.epidothsh_eisforon_ergodoth,
            diathesimothta: formData.diathesimothta,
            enarxh_diathesimothtas: formData.enarxh_diathesimothtas,
            lhxh_diathesimothtas: formData.lhxh_diathesimothtas,
            palios_neos: formData.palios_neos,
            amoibetai_me_sse: formData.amoibetai_me_sse,
            trapeza: formData.trapeza,
            iban: formData.iban,
            arithmos_deltioy_anergias: formData.arithmos_deltioy_anergias,
            systatiko_shmeioma: formData.systatiko_shmeioma,
            programma_dypa: formData.programma_dypa,
            egkritikh_apofash_dypa: formData.egkritikh_apofash_dypa,
            hmeromhnia_enarxhs_programmatos: formData.hmeromhnia_enarxhs_programmatos,
            hmeromhnia_lhxhs_programmatos: formData.hmeromhnia_lhxhs_programmatos,
            antikatastash_ergazomenoy: formData.antikatastash_ergazomenoy,
            afm_antikatastath: formData.afm_antikatastath,
            amka_antikatastath: formData.amka_antikatastath,
            epidoma_anergias: formData.epidoma_anergias,
            dypa: formData.dypa,
            thesh_eythynhs: formData.thesh_eythynhs,
            eidikh_periptosh: formData.eidikh_periptosh,
            kentro_kostoys_1: formData.kentro_kostoys_1,
            pososto_apasxolhshs_kk1: formData.pososto_apasxolhshs_kk1,
            kentro_kostoys_2: formData.kentro_kostoys_2,
            pososto_apasxolhshs_kk2: formData.pososto_apasxolhshs_kk2,
            kentro_kostoys_3: formData.kentro_kostoys_3,
            pososto_apasxolhshs_kk3: formData.pososto_apasxolhshs_kk3,
            kentro_kostoys_4: formData.kentro_kostoys_4,
            pososto_apasxolhshs_kk4: formData.pososto_apasxolhshs_kk4,
            symbash: formData.symbash,
            kathgoria_symbashs: formData.kathgoria_symbashs,
            eidikothta_symbashs: formData.eidikothta_symbashs,
            synolo_symbashs: formData.synolo_symbashs,
            synolo_symbashs_basei_oron_ergasias: formData.synolo_symbashs_basei_oron_ergasias,
            nomimosMisthos: formData.nomimosMisthos,
            nomimoHmeromisthio: formData.nomimoHmeromisthio,
            nomimoOromisthio: formData.nomimoOromisthio,
            pragmatikosMisthos: formData.pragmatikosMisthos,
            pragmatikoHmeromisthio: formData.pragmatikoHmeromisthio,
            pragmatikoOromisthio: formData.pragmatikoOromisthio,
            krathsh_01: formData.krathsh_01,
            ama_krathshs_01: formData.ama_krathshs_01,
            krathsh_02: formData.krathsh_02,
            ama_krathshs_02: formData.ama_krathshs_02,
            krathsh_03: formData.krathsh_03,
            ama_krathshs_03: formData.ama_krathshs_03,
            krathsh_04: formData.krathsh_04,
            ama_krathshs_04: formData.ama_krathshs_04,
            krathsh_05: formData.krathsh_05,
            ama_krathshs_05: formData.ama_krathshs_05,
            krathsh_06: formData.krathsh_06,
            ama_krathshs_06: formData.ama_krathshs_06,
            krathsh_07: formData.krathsh_07,
            ama_krathshs_07: formData.ama_krathshs_07,
            hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy:
                formData.hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy,
            adeia_diamonhs_me_amesh_prosbash_gia_ergasia:
                formData.adeia_diamonhs_me_amesh_prosbash_gia_ergasia,
            eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia:
                formData.eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia,
            arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia:
                formData.arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia,
            hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia:
                formData.hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia,
            adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia:
                formData.adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia,
            eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia:
                formData.eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia,
            arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia:
                formData.arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia,
            hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia:
                formData.hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia,
            adeia_eisodoy_gia_epoxikh_apasxolhsh: formData.adeia_eisodoy_gia_epoxikh_apasxolhsh,
            arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh:
                formData.arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh,
            apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh:
                formData.apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh,
            eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh:
                formData.eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh,
            epaggelmatikh_katartish: formData.epaggelmatikh_katartish,
            antikeimeno_katartishs: formData.antikeimeno_katartishs,
            thematiko_pedio: formData.thematiko_pedio,
            thematikh_enothta: formData.thematikh_enothta,
            foreas_katartishs: formData.foreas_katartishs,
            katartish_apo: formData.katartish_apo,
            katartish_eos: formData.katartish_eos,
            diarkeia_se_ores: formData.diarkeia_se_ores,
            etos_apokthshs: formData.etos_apokthshs,
            allh_glossa_01: formData.allh_glossa_01,
            allh_glossa_02: formData.allh_glossa_02,
            allh_glossa_03: formData.allh_glossa_03,
            allh_glossa_04: formData.allh_glossa_04,
            gnosh_ypologiston: formData.gnosh_ypologiston,
            allo_proson: formData.allo_proson,
            oros_sth_symbash_n_3986_2011: formData.oros_sth_symbash_n_3986_2011,
            kataggelia_katopin_eggrafhs_proeidopoihshs:
                formData.kataggelia_katopin_eggrafhs_proeidopoihshs,
            hmeromhnia_eggrafhs_proeidopoihshs: formData.hmeromhnia_eggrafhs_proeidopoihshs,
            omadikh_apolysh: formData.omadikh_apolysh,
            arithmos_apofashs_gia_omadikh_apolysh: formData.arithmos_apofashs_gia_omadikh_apolysh,
            hmeromhnia_apofashs_gia_omadikh_apolysh:
                formData.hmeromhnia_apofashs_gia_omadikh_apolysh,
            epidosh_me_dikastiko_epimelhth: formData.epidosh_me_dikastiko_epimelhth,
            hmeromhnia_epidoshs: formData.hmeromhnia_epidoshs,
            hmeromhnia_katabolhs_ths_apozhmioshs: formData.hmeromhnia_katabolhs_ths_apozhmioshs,
            shmeioseis_apozhmioshs: formData.shmeioseis_apozhmioshs,
            parathrhseis: formData.parathrhseis,
            symfonhtheis_misthos_genikos: formData.symfonhtheis_misthos_genikos,
            symfonhtheis_misthos_apasxolhseis: formData.symfonhtheis_misthos_apasxolhseis,
            paketo_apodoxon: formData.paketo_apodoxon,
            mhniaia_repo: formData.mhniaia_repo,
            ypologismos_foroy: formData.ypologismos_foroy,
            updatedAt: Date.now()
        };

        fieldsStoixeionSymbashs.forEach((fieldStoixeio) => {
            for (let i = 1; i <= arithmosStoixeionSymbashs; i++) {
                const fieldNameStoixeioy = `${fieldStoixeio}_${i < 10 ? '0' + i : i}`;
                if (numberFields.has(fieldStoixeio)) {
                    filteredDataErgazomenoi[fieldNameStoixeioy] = formData[fieldNameStoixeioy] || 0; // Χειρισμός number πεδίων
                } else {
                    filteredDataErgazomenoi[fieldNameStoixeioy] =
                        formData[fieldNameStoixeioy] || null; // Χειρισμός άλλων τύπων πεδίων
                }
            }
        });

        fieldsKrathseon.forEach((fieldKrathsh) => {
            for (let i = 1; i <= arithmosKrathseon; i++) {
                const fieldNameKrathshs = `${fieldKrathsh}_${i < 10 ? '0' + i : i}`;
                filteredDataErgazomenoi[fieldNameKrathshs] = formData[fieldNameKrathshs] || null;
            }
        });

        // Τώρα μπορώ να χρησιμοποιήσω το filteredDataErgazomenoi στη $set: για ενημέρωση
        try {
            await ErgazomenoiModel.findOneAndUpdate(
                { _id: ergazomenoiId },
                { $set: filteredDataErgazomenoi },
                { new: true } // Μπορώ να δουλέψω με το ενημερωμένο έγγραφο αμέσως μετά την ενημέρωση
            );
        } catch (error) {
            throw error;
        }

        // ============================ ΕΝΗΜΕΡΩΣΗ ΩΡΑΡΙΩΝ =============================
        function createOrarioData(i1) {
            return {
                team: formData.team,
                company_kod: formData.company_kod,
                kodikos: formData.kodikosHidden,
                hmeromhnia: formData[`hmeromhnia_${i1}`],
                kathgoria_ergasias: formData[`kathgoria_ergasias_${i1}`],
                apo_ora_01: formData[`apo_ora_01_${i1}`],
                eos_ora_01: formData[`eos_ora_01_${i1}`],
                dialleima_apo_ora_01: formData[`dialleima_apo_ora_01_${i1}`],
                dialleima_eos_ora_01: formData[`dialleima_eos_ora_01_${i1}`],
                apo_ora_02: formData[`apo_ora_02_${i1}`],
                eos_ora_02: formData[`eos_ora_02_${i1}`],
                dialleima_apo_ora_02: formData[`dialleima_apo_ora_02_${i1}`],
                dialleima_eos_ora_02: formData[`dialleima_eos_ora_02_${i1}`],
                apo_ora_03: formData[`apo_ora_03_${i1}`],
                eos_ora_03: formData[`eos_ora_03_${i1}`],
                dialleima_apo_ora_03: formData[`dialleima_apo_ora_03_${i1}`],
                dialleima_eos_ora_03: formData[`dialleima_eos_ora_03_${i1}`],
                repo: formData[`repo_${i1}`] || false,
                adeia: false,
                astheneia: false,
                argia: formData[`argia_${i1}`] || false,
                perigrafh_argias: formData[`perigrafh_argias_${i1}`] || '',
                kathgoria_adeias: '',
                ores_ergasias: parseFloat(formData[`total_hours_day_${i1}`]).toFixed(4),
                ores_nyxtas: parseFloat(formData[`night_hours_day_${i1}`]).toFixed(4),
                ores_argion: parseFloat(formData[`holiday_hours_day_${i1}`]).toFixed(4),
                ores_yperergasias: parseFloat(formData[`overwork_hours_day_${i1}`]).toFixed(4),
                ores_yperergasias_nyxtas: parseFloat(
                    formData[`night_overwork_hours_day_${i1}`]
                ).toFixed(4),
                ores_yperergasias_argion: parseFloat(
                    formData[`holiday_overwork_hours_day_${i1}`]
                ).toFixed(4),
                ores_yperergasias_argion_nyxtas: parseFloat(
                    formData[`night_holiday_overwork_hours_day_${i1}`]
                ).toFixed(4),
                ores_nominhs_yperorias: parseFloat(
                    formData[`overtimeNomimh_hours_day_${i1}`]
                ).toFixed(4),
                ores_nominhs_yperorias_nyxtas: parseFloat(
                    formData[`night_overtimeNomimh_hours_day_${i1}`]
                ).toFixed(4),
                ores_nominhs_yperorias_argion: parseFloat(
                    formData[`holiday_overtimeNomimh_hours_day_${i1}`]
                ).toFixed(4),
                ores_nominhs_yperorias_argion_nyxtas: parseFloat(
                    formData[`night_holiday_overtimeNomimh_hours_day_${i1}`]
                ).toFixed(4),
                ores_paranomhs_yperorias: parseFloat(
                    formData[`overtimeParanomh_hours_day_${i1}`]
                ).toFixed(4),
                ores_paranomhs_yperorias_nyxtas: parseFloat(
                    formData[`night_overtimeParanomh_hours_day_${i1}`]
                ).toFixed(4),
                ores_paranomhs_yperorias_argion: parseFloat(
                    formData[`holiday_overtimeParanomh_hours_day_${i1}`]
                ).toFixed(4),
                ores_paranomhs_yperorias_argion_nyxtas: parseFloat(
                    formData[`night_holiday_overtimeParanomh_hours_day_${i1}`]
                ).toFixed(4)
            };
        }

        let promises = [];
        const fromDate = new Date(formData.hmeromhnia_allaghs_orarioy_apo);
        const toDate = new Date(formData.hmeromhnia_allaghs_orarioy_eos);

        let currentDate = new Date(fromDate); // Ξεκινάμε από την αρχική ημερομηνία
        let i = 1;

        while (currentDate <= toDate) {
            let i1 = i < 10 ? '0' + i : i;
            const orarioData = createOrarioData(i1);

            // Χρησιμοποιούμε findOneAndUpdate για να ενημερώσουμε ή να δημιουργήσουμε εγγραφή
            const updatePromise = ProdhlomenaOrariaModel.findOneAndUpdate(
                {
                    team: orarioData.team,
                    company_kod: orarioData.company_kod,
                    kodikos: orarioData.kodikos,
                    hmeromhnia: orarioData.hmeromhnia
                },
                {
                    $set: {
                        // Ενημερώνουμε μόνο τα πεδία που πρέπει να αλλάζουν πάντα
                        kathgoria_ergasias: orarioData.kathgoria_ergasias,
                        apo_ora_01: orarioData.apo_ora_01,
                        eos_ora_01: orarioData.eos_ora_01,
                        dialleima_apo_ora_01: orarioData.dialleima_apo_ora_01,
                        dialleima_eos_ora_01: orarioData.dialleima_eos_ora_01,
                        apo_ora_02: orarioData.apo_ora_02,
                        eos_ora_02: orarioData.eos_ora_02,
                        dialleima_apo_ora_02: orarioData.dialleima_apo_ora_02,
                        dialleima_eos_ora_02: orarioData.dialleima_eos_ora_02,
                        apo_ora_03: orarioData.apo_ora_03,
                        eos_ora_03: orarioData.eos_ora_03,
                        dialleima_apo_ora_03: orarioData.dialleima_apo_ora_03,
                        dialleima_eos_ora_03: orarioData.dialleima_eos_ora_03,
                        repo: orarioData.repo,
                        adeia: orarioData.adeia,
                        astheneia: orarioData.astheneia,
                        argia: orarioData.argia,
                        perigrafh_argias: orarioData.perigrafh_argias,
                        kathgoria_adeias: orarioData.kathgoria_adeias,
                        ores_ergasias: orarioData.ores_ergasias,
                        ores_nyxtas: orarioData.ores_nyxtas,
                        ores_argion: orarioData.ores_argion,
                        ores_yperergasias: orarioData.ores_yperergasias,
                        ores_yperergasias_nyxtas: orarioData.ores_yperergasias_nyxtas,
                        ores_yperergasias_argion: orarioData.ores_yperergasias_argion,
                        ores_yperergasias_argion_nyxtas: orarioData.ores_yperergasias_argion_nyxtas,
                        ores_nominhs_yperorias: orarioData.ores_nominhs_yperorias,
                        ores_nominhs_yperorias_nyxtas: orarioData.ores_nominhs_yperorias_nyxtas,
                        ores_nominhs_yperorias_argion: orarioData.ores_nominhs_yperorias_argion,
                        ores_nominhs_yperorias_argion_nyxtas:
                            orarioData.ores_nominhs_yperorias_argion_nyxtas,
                        ores_paranomhs_yperorias: orarioData.ores_paranomhs_yperorias,
                        ores_paranomhs_yperorias_nyxtas: orarioData.ores_paranomhs_yperorias_nyxtas,
                        ores_paranomhs_yperorias_argion: orarioData.ores_paranomhs_yperorias_argion,
                        ores_paranomhs_yperorias_argion_nyxtas:
                            orarioData.ores_paranomhs_yperorias_argion_nyxtas
                    },
                    $setOnInsert: {
                        // Τα πεδία που θα ρυθμιστούν μόνο κατά τη δημιουργία νέας εγγραφής
                        team: orarioData.team,
                        company_kod: orarioData.company_kod,
                        kodikos: orarioData.kodikos,
                        hmeromhnia: orarioData.hmeromhnia
                    }
                },
                { new: true, upsert: true } // Επιστρέφει το ενημερωμένο έγγραφο, και το δημιουργεί αν δεν υπάρχει
            );

            promises.push(updatePromise);

            currentDate.setDate(currentDate.getDate() + 1); // Προσθέτουμε μία ημέρα
            i++;
        }

        try {
            await Promise.all(promises);
        } catch (error) {
            console.error('Σφάλμα κατά την ενημέρωση των οραρίων:', error);
        }

        // ============================ ΕΝΗΜΕΡΩΣΗ ΙΣΤΟΡΙΚΟΥ =============================
        //
        // Πεδία που ενημερώνονται μόνο κατά την εισαγωγή νέας εγγραφής του ΙΣΤΟΡΙΚΟΥ ΑΡΧΕΙΟΥ
        if (!recExist) {
            const filteredDataIstoriko = {
                team: formData.team,
                company_kod: formData.company_kod,
                kodikos: formData.kodikosHidden,
                aa_eggrafhs: aa_eggr.toString().padStart(4, '0'),
                hmeromhnia_proslhpshs: formData.hmeromhnia_proslhpshs,
                createdAt: Date.now()
            };

            // Πεδία που ενημερώνονται πάντα (και κατά την εισαγωγή νέας εγγραφής και κατά την διόρθωση)
            const updateFieldsIstoriko = {
                hmeromhnia_allaghs_symbashs: formData.hmeromhnia_allaghs_symbashs,
                hmeromhnia_allaghs_orarioy_apo: formData.hmeromhnia_allaghs_orarioy_apo,
                hmeromhnia_allaghs_orarioy_eos: formData.hmeromhnia_allaghs_orarioy_eos,
                hmeromhnia_lhxhs_symbashs: formData.hmeromhnia_lhxhs_symbashs,
                hmeromhnia_apoxorhshs: formData.hmeromhnia_apoxorhshs,
                afora_proslhpsh:
                    formData.hmeromhnia_proslhpshs === formData.hmeromhnia_allaghs_symbashs
                        ? true
                        : false,
                kathestos_apasxolhshs: formData.kathestos_apasxolhshs,
                misthologiko_klimakio: formData.misthologiko_klimakio,
                symbash: formData.symbash,
                kathgoria_symbashs: formData.kathgoria_symbashs,
                eidikothta_symbashs: formData.eidikothta_symbashs,
                synolo_symbashs: formData.synolo_symbashs,
                synolo_symbashs_basei_oron_ergasias: formData.synolo_symbashs_basei_oron_ergasias,
                nomimosMisthos: formData.nomimosMisthos,
                nomimoHmeromisthio: formData.nomimoHmeromisthio,
                nomimoOromisthio: formData.nomimoOromisthio,
                pragmatikosMisthos: formData.pragmatikosMisthos,
                pragmatikoHmeromisthio: formData.pragmatikoHmeromisthio,
                pragmatikoOromisthio: formData.pragmatikoOromisthio,
                updatedAt: Date.now()
            };
            fieldsStoixeionSymbashs.forEach((fieldStoixeio) => {
                for (let i = 1; i <= arithmosStoixeionSymbashs; i++) {
                    const fieldNameStoixeioy = `${fieldStoixeio}_${i < 10 ? '0' + i : i}`;
                    if (numberFields.has(fieldStoixeio)) {
                        updateFieldsIstoriko[fieldNameStoixeioy] =
                            formData[fieldNameStoixeioy] || 0; // Χειρισμός number πεδίων
                    } else {
                        updateFieldsIstoriko[fieldNameStoixeioy] =
                            formData[fieldNameStoixeioy] || null; // Χειρισμός άλλων τύπων πεδίων
                    }
                }
            });

            fieldsKrathseis.forEach((fieldKrathsh) => {
                for (let i = 1; i <= arithmosKrathseon; i++) {
                    const fieldNameKrathshs = `${fieldKrathsh}_${i < 10 ? '0' + i : i}`;
                    updateFieldsIstoriko[fieldNameKrathshs] = formData[fieldNameKrathshs] || null;
                }
            });

            try {
                await IstorikoProslhpseonAllagonModel.findOneAndUpdate(
                    {
                        team: formData.team,
                        company_kod: formData.company_kod,
                        kodikos: formData.kodikos
                    },
                    {
                        $set: updateFieldsIstoriko,
                        $setOnInsert: filteredDataIstoriko // Μόνο όταν δημιουργείται νέα εγγραφή
                    },
                    { new: true, upsert: true }
                );
                res.json({ success: true, redirectUrl: '/ergazomenoi/ergazomenoi' });
            } catch (error) {
                throw error;
            }
        } else {
            res.json({ success: true, redirectUrl: '/ergazomenoi/ergazomenoi' });
        }
    };

    static deleteErgazomenoi = async (req, res) => {
        try {
            console.log('🗑️  [DELETE-EMPLOYEE] Starting deletion for ID:', req.params.id);

            const ergazomenoiData = await ErgazomenoiModel.findOne({ _id: req.params.id });

            if (!ergazomenoiData) {
                console.log('❌ [DELETE-EMPLOYEE] Employee not found');
                return res.status(404).json({ success: false, message: 'Εργαζόμενος δεν βρέθηκε' });
            }

            const team = ergazomenoiData.team;
            const company = ergazomenoiData.company_kod;
            const kodikos = ergazomenoiData.kodikos;
            const employeeId = req.params.id; // MongoDB _id

            console.log('📋 [DELETE-EMPLOYEE] Employee data:', {
                employeeId,
                team,
                company,
                kodikos
            });

            // =====================================================================
            // ✅ GET COMPANY DATA (ONCE, USED BY BOTH XML & CONTRACT DELETION)
            // =====================================================================

            let companyKod = 'UNKNOWN';
            let companyName = 'UNKNOWN';

            try {
                const { CompaniesModel } = require('../../models/companies');
                const companyData = await CompaniesModel.findById(company).lean();

                companyKod = companyData?.kod || 'UNKNOWN';
                companyName =
                    companyData?.eponymia?.replace(/\s+/g, '_').substring(0, 50) || 'UNKNOWN';

                console.log('📋 [DELETE-EMPLOYEE] Company kod:', companyKod);
                console.log('📋 [DELETE-EMPLOYEE] Company name:', companyName);
            } catch (e) {
                console.error('❌ [DELETE-EMPLOYEE] Failed to get company data:', e.message);
            }

            // =====================================================================
            // ✅ DELETE XML FILES FROM S3 (E3N & WTO_weekly)
            // =====================================================================

            try {
                console.log(`🔍 [DELETE-EMPLOYEE] Calling deleteXmlFilesForEmployee...`);

                const { deleteXmlFilesForEmployee } = require('../../utils/s3Helper');

                const deletionResult = await deleteXmlFilesForEmployee(employeeId, {
                    team,
                    companyKod,
                    companyName
                });

                console.log(`✅ [DELETE-EMPLOYEE] XML deletion result:`, deletionResult);
            } catch (xmlError) {
                console.error(`❌ [DELETE-EMPLOYEE] Failed to delete XML files:`, xmlError.message);
            }

            // =====================================================================
            // ✅ DELETE CONTRACT PDF FILES
            // =====================================================================

            try {
                console.log(`🔍 [DELETE-EMPLOYEE] Calling deleteContractsForEmployee...`);

                const { deleteContractsForEmployee } = require('../../utils/s3Helper');

                const contractDeletionResult = await deleteContractsForEmployee(employeeId, {
                    team,
                    companyKod,
                    companyName
                });

                console.log(
                    `✅ [DELETE-EMPLOYEE] Contract deletion result:`,
                    contractDeletionResult
                );
            } catch (contractError) {
                console.error(
                    `❌ [DELETE-EMPLOYEE] Failed to delete contracts:`,
                    contractError.message
                );
            }

            // =====================================================================
            // ✅ DELETE EMPLOYEE FROM DATABASE
            // =====================================================================

            console.log('🗑️  [DELETE-EMPLOYEE] Deleting from database...');

            await ErgazomenoiModel.deleteOne({ _id: req.params.id });

            await IstorikoProslhpseonAllagonModel.deleteMany({
                team: team,
                company_kod: company,
                kodikos: kodikos
            });

            await ProdhlomenaOrariaModel.deleteMany({
                team: team,
                company_kod: company,
                kodikos: kodikos
            });

            console.log(`✅ [DELETE-EMPLOYEE] Employee deleted: ${kodikos} (${employeeId})`);

            res.json({ success: true, redirectUrl: '/ergazomenoi/ergazomenoi' });
        } catch (error) {
            console.error('❌ [DELETE-EMPLOYEE] Error:', error);
            console.error('   Stack:', error.stack);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    // ======================================================================
    // ✅ GET ERGAZOMENOS BY ID (with presigned PDF URLs)
    // ======================================================================
    static getErgazomenosById = async (req, res) => {
        try {
            const ergazomenosId = req.params.id;

            const ergazomenos = await ErgazomenoiModel.findById(ergazomenosId);

            if (!ergazomenos) {
                return res.status(404).json({
                    success: false,
                    message: 'Εργαζόμενος δεν βρέθηκε'
                });
            }

            // ✅ Add presigned URLs for PDFs
            const ergazomenosWithUrls = await addPdfUrlsToErgazomenos(ergazomenos);

            return res.status(200).json({
                success: true,
                data: ergazomenosWithUrls
            });
        } catch (error) {
            console.error('❌ Error fetching ergazomenos:', error);
            return res.status(500).json({
                success: false,
                message: 'Σφάλμα server'
            });
        }
    };

    // ======================================================================
    // ✅ GET ALL ERGAZOMENOI (with presigned PDF URLs)
    // ======================================================================
    static getAllErgazomenoiWithUrls = async (req, res) => {
        try {
            const companyId = req.session.companyInUse;

            const ergazomenoi = await ErgazomenoiModel.find({ company_kod: companyId });

            // ✅ Add presigned URLs for all ergazomenoi
            const ergazomenoiWithUrls = await Promise.all(
                ergazomenoi.map((erg) => addPdfUrlsToErgazomenos(erg))
            );

            return res.status(200).json({
                success: true,
                data: ergazomenoiWithUrls
            });
        } catch (error) {
            console.error('❌ Error fetching ergazomenoi:', error);
            return res.status(500).json({
                success: false,
                message: 'Σφάλμα server'
            });
        }
    };

    static forologikesKlimakes = async (req, res) => {
        try {
            const { xrhsh, kodikos } = req.body;

            if (!xrhsh || !kodikos) {
                return res.status(400).json({ success: false, message: 'Missing data' });
            }

            // READ from ForologikesKlimakesModel
            const taxScale = await ForologikesKlimakesModel.findOne({ xrhsh, kodikos });

            if (taxScale) {
                return res.json({
                    success: true,
                    taxScale: {
                        perigrafh: taxScale.perigrafh
                    }
                });
            } else {
                return res.json({ success: false, taxScale: null });
            }
        } catch (error) {
            console.error(error);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    };

    static escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Διαφυγή όλων των ειδικών χαρακτήρων
    }

    static highlightText(text, term) {
        if (!text) return ''; // Επιστρέφει ένα κενό string αν το text είναι falsy (π.χ., undefined, null, '')
        const highlightStartTag = "<span class='highlight'>";
        const highlightEndTag = '</span>';

        const escapedTerm = this.escapeRegExp(term);

        const regex = new RegExp(`(${escapedTerm})`, 'gi');
        // const regex = new RegExp(`(${term})`, "gi");
        const highlightedText = text.replace(regex, `${highlightStartTag}$1${highlightEndTag}`);
        return highlightedText;
    }
}

module.exports = ergazomenoiController;
module.exports.getErgazomenosById = ergazomenoiController.getErgazomenosById;
module.exports.getAllErgazomenoiWithUrls = ergazomenoiController.getAllErgazomenoiWithUrls;
module.exports.uploadE3ToErganh = ergazomenoiController.uploadE3ToErganh;

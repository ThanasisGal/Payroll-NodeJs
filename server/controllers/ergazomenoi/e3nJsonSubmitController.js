const mongoose = require('mongoose');

const { generateE3NJsonPayload } = require('../../utils/jsonGenerators/e3N_v1JsonGenerator');
const { uploadJsonDocumentToErgani } = require('../../utils/erganh/jsonDocumentUploader');
const { assertErganiSubmitAllowed } = require('../../utils/erganh/erganiSubmitSafety');

const Models_C = require('../../models/companies');
const Models_D = require('../../models/ergazomenoi');

const { CompaniesModel, PasswordsModel, YpokatasthmataModel } = Models_C;
const { ErgazomenoiModel } = Models_D;

/**
 * ✅ REST JSON υποβολή E3N / WebE3N
 *
 * Προσοχή:
 * - Χωρίς ALLOW_ERGANI_SUBMIT=true, η πραγματική υποβολή μπλοκάρεται.
 * - Το XML flow δεν πειράζεται εδώ, επειδή ήδη δουλεύει.
 *
 * Expected body:
 * {
 *   ergazomenosId: "...",
 *   ypokatasthma: "0000"
 * }
 */
class E3NJsonSubmitController {
    static submitE3NJsonToErganh = async (req, res) => {
        try {
            const sessionTeam = req.session?.userTeam;
            const companyId = req.session?.companyInUse;
            const body = req.body || {};

            const ergazomenosId = body.ergazomenosId || body.employeeId || body.id || body.kodikos;

            if (!sessionTeam || !companyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν υπάρχει ενεργή ομάδα ή επιλεγμένη εταιρεία στο session.'
                });
            }

            if (!ergazomenosId) {
                return res.status(400).json({
                    success: false,
                    message: 'Λείπει ο εργαζόμενος για την REST JSON υποβολή E3N.'
                });
            }

            const employeeQuery = {
                team: sessionTeam,
                company_kod: companyId
            };

            if (mongoose.Types.ObjectId.isValid(String(ergazomenosId))) {
                employeeQuery._id = ergazomenosId;
            } else {
                employeeQuery.kodikos = String(ergazomenosId).trim();
            }

            const ergazomenos = await ErgazomenoiModel.findOne(employeeQuery).lean();

            if (!ergazomenos) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκε ο εργαζόμενος για την REST JSON υποβολή E3N.'
                });
            }

            let companyData = null;

            if (mongoose.Types.ObjectId.isValid(String(companyId))) {
                companyData = await CompaniesModel.findById(companyId).lean();
            }

            if (!companyData) {
                companyData =
                    (await CompaniesModel.findOne({ kod: companyId }).lean()) ||
                    (await CompaniesModel.findOne({ kodikos: companyId }).lean());
            }

            if (!companyData) {
                return res.status(404).json({
                    success: false,
                    message: 'Δεν βρέθηκαν τα στοιχεία της εταιρείας.'
                });
            }

            const selectedYpokatasthma =
                body.ypokatasthma ||
                body.ypokatasthmata ||
                body.ypokatasthmata_stathera ||
                ergazomenos.ypokatasthma ||
                ergazomenos.ypokatasthma_kodikos ||
                '0';

            let ypokatasthmataData = await YpokatasthmataModel.findOne({
                companykod_object: companyId,
                kodikos: String(selectedYpokatasthma)
            }).lean();

            if (!ypokatasthmataData) {
                ypokatasthmataData = await YpokatasthmataModel.findOne({
                    company: companyData.kod || companyData.kodikos || companyId,
                    kodikos: String(selectedYpokatasthma)
                }).lean();
            }

            if (!ypokatasthmataData) {
                return res.status(404).json({
                    success: false,
                    message: `Δεν βρέθηκε το υποκατάστημα ${selectedYpokatasthma}.`
                });
            }

            const erganhPasswordDoc = await PasswordsModel.findOne({
                team: sessionTeam,
                companykod_object: companyId,
                kodikos: '0002'
            }).lean();

            if (!erganhPasswordDoc?.username || !erganhPasswordDoc?.password) {
                return res.status(400).json({
                    success: false,
                    message: 'Δεν βρέθηκαν credentials ΕΡΓΑΝΗ με kodikos=0002 για την εταιρεία.'
                });
            }

            const payload = await generateE3NJsonPayload(
                ergazomenos,
                companyData,
                ypokatasthmataData
            );

            // ✅ Απόλυτη προστασία: δεν φεύγει πραγματική REST υποβολή χωρίς flag.
            assertErganiSubmitAllowed('WebE3N JSON REST submission');

            const restResult = await uploadJsonDocumentToErgani({
                submissionCode: 'WebE3N',
                payload,
                creds: {
                    username: erganhPasswordDoc.username,
                    password: erganhPasswordDoc.password,
                    userType: process.env.ERGANI_USERTYPE || '01'
                },
                fetchSubmittedPdf: true
            });

            return res.status(restResult?.success ? 200 : 400).json({
                success: !!restResult?.success,
                uploadMethod: 'rest',
                temporary: false,
                finalSubmission: true,
                submissionCode: 'WebE3N',
                message: restResult?.success
                    ? 'Η Πρόσληψη E3N υποβλήθηκε οριστικά στο ΕΡΓΑΝΗ μέσω REST JSON.'
                    : restResult?.userMessage ||
                      restResult?.message ||
                      'Η REST JSON υποβολή E3N απέτυχε.',
                erganh: restResult
            });
        } catch (error) {
            console.error('❌ [E3N-JSON-SUBMIT] Error:', error);

            const status = error.code === 'ERGANI_SUBMIT_BLOCKED' ? 403 : 500;

            return res.status(status).json({
                success: false,
                blocked: error.code === 'ERGANI_SUBMIT_BLOCKED',
                message: error.message || 'Αποτυχία REST JSON υποβολής E3N στο ΕΡΓΑΝΗ.',
                error: process.env.NODE_ENV === 'production' ? undefined : error.stack
            });
        }
    };
}

module.exports = E3NJsonSubmitController;

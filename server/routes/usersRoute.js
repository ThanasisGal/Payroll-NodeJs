const express = require('express');
const router = express.Router();
const multer = require('multer'); // ✅ Κρατάμε για error handling
const path = require('path');
const fs = require('fs').promises;

// ============================================================================
// IMPORTS - Controllers
// ============================================================================
const adminController = require('../controllers/adminController.js');
const userController = require('../controllers/userController.js');
const companiesController = require('../controllers/companies/companiesController.js');
const mainAppController = require('../controllers/mainAppController.js');
const pdfDocumentsController = require('../controllers/pdfDocumentsController.js');
const ypokatasthmataController = require('../controllers/companies/ypokatasthmataController.js');
const nomimoiekprosopoiController = require('../controllers/companies/nomimoiekprosopoiController.js');
const passwordsController = require('../controllers/companies/passwordsController.js');
const trapezesController = require('../controllers/companies/trapezesController.js');
const antistoixiseisController = require('../controllers/companies/antistoixiseisController.js');
const krathseisController = require('../controllers/krathseisController.js');
const genikaAPIsController = require('../controllers/genikaAPIsController.js');
const ergazomenoiController = require('../controllers/ergazomenoi/ergazomenoiController.js');
const symbaseisController = require('../controllers/symbaseisController.js');
const programmataController = require('../controllers/ergazomenoi/programmataController.js');
const erganhController = require('../controllers/ergazomenoi/erganhController.js');
const kinhseisController = require('../controllers/Kinhseis/kinhseisController.js');
const forosController = require('../controllers/Kinhseis/forosContoller.js');
const ektyposhSymbaseonController = require('../controllers/ektyposeis/symbaseis/ektyposhSymbaseonController.js');
const ektyposhApasxolhseonController = require('../controllers/ektyposeis/apasxolhseis/ektyposhApasxolhseonController.js');

// const { savePdfFromBase64, deletePdf } = require('../utils/pdfHandler');

// ============================================================================
// IMPORTS - Middleware
// ============================================================================
const checkUserAuth = require('../middlewares/auth-middleware.js');
const getSessionVars = require('../middlewares/session-variables.js');
const checkAuth = require('../middlewares/checkValidUser.js');
const sanitizeNumberFields = require('../middlewares/sanitizeNumbers');

// ============================================================================
// IMPORTS - Models
// ============================================================================
const TmhmataModel = require('../models/stathera_arxeia.js');
const PeriodsModel = require('../models/stathera_arxeia.js');

// ============================================================================
// ✅ MULTER CONFIGURATION - Import από κεντρικό config
// ============================================================================
const { upload } = require('../config/multer'); // ✅ Destructure

// ============================================================================
// MIDDLEWARE - Route Level
// ============================================================================
router.use('/changepassword', checkUserAuth);
router.use(getSessionVars);

// ============================================================================
// PUBLIC ROUTES - User Authentication
// ============================================================================
router.get('/', userController.homepage);
router.post('/search', (req, res) => res.redirect('/'));

router.get('/login', userController.loginForm);
router.get('/login/verify-email', userController.verifyEmailForm);
router.get('/verify-Email', userController.emailVerification);
router.post(
    '/login/verify-email',
    (req, res, next) => {
        console.log('HIT POST /login/verify-email, body =', req.body);
        res.set('X-Route-Touched', '1');
        next();
    },
    userController.sendUserVerifyEmail
);

router.get('/register', userController.registerForm);
router.post('/register/userRegistration', userController.userRegistration);
router.post('/login/userLogin', userController.userLogin);
router.get('/login/change_password', userController.changePasswordForm);
router.post('/login/send-reset-password-email', userController.sendUserResetPasswordEmail);
router.get('/reset_password', userController.resetPasswordForm);
router.get('/login/reset_old_password/:uid/:token', userController.showResetPasswordForm);
router.post('/login/reset_old_password/:uid/:token', userController.handleResetPassword);

router.get('/login/logout', userController.logoutForm);
router.post('/logout/userLogout', userController.logout);
router.get('/logout/end_Session', userController.logout);

// ============================================================================
// ADMIN ROUTES
// ============================================================================
router.get('/admin', userController.adminHomepage);
router.get('/admin/add', userController.addUser);
router.post('/admin/add', userController.postUser);
router.get('/admin/view/:id', userController.viewUser);
router.get('/admin/edit/:id', userController.editUser);
router.put('/admin/edit/:id', userController.editPostUser);
router.delete('/admin/edit/:id', userController.deletePostUser);
router.get('/admin/delete/:id', userController.checkAndDeletePostUser);
router.post('/admin/search', userController.searchPostUser);
router.get('/admin/search', userController.searchGetUser);
router.post('/admin/dhmioyrgia-arxeion-neas-xrhshs', checkAuth, adminController.anoigmaNeasXrhshs);
router.get('/admin/active-sessions', checkAuth, userController.activeSessionsPage);
router.post('/admin/send-message', checkAuth, userController.sendMessageToUser);

// ============================================================================
// MAIN APP ROUTES
// ============================================================================
router.get('/mainapp', checkAuth, mainAppController.getMainAppForm);

// ============================================================================
// DATE ROUTES
// ============================================================================
router.get('/dates/getYearsForm', mainAppController.getYearsForm);
router.post('/dates/changeYear', mainAppController.changeYear);
router.get('/dates/getPeriodsForm', mainAppController.getPeriodsForm);
router.post('/dates/changePeriod', mainAppController.changePeriod);
router.get('/dates/getAppDateForm', mainAppController.getAppDateForm);
router.post('/dates/changeAppDate', mainAppController.changeAppDate);

// ============================================================================
// COMPANIES ROUTES
// ============================================================================
router.get('/companies/genikastoixeia', checkAuth, companiesController.mainCompaniesForm);
router.get('/companies/genikastoixeia/add', checkAuth, companiesController.addCompanyForm);
router.post('/companies/genikastoixeia/add', companiesController.postCompanyForm);
router.post('/companies/genikastoixeia/search', companiesController.searchPostCompanies);
router.get('/companies/genikastoixeia/search', checkAuth, companiesController.searchGetCompanies);
router.get('/companies/genikastoixeia/select/:id', checkAuth, companiesController.choiseCompanies);
router.get('/companies/genikastoixeia/edit/:id', checkAuth, companiesController.editCompanyForm);
router.delete('/companies/genikastoixeia/delete/:id', checkAuth, companiesController.deleteCompany);

// ============================================================================
// YPOKATASTHMATA ROUTES
// ============================================================================
router.get('/companies/ypokatasthmata', checkAuth, ypokatasthmataController.mainYpokatasthmataForm);
router.get(
    '/companies/ypokatasthmata/add',
    checkAuth,
    ypokatasthmataController.addYpokatasthmataForm
);
router.post('/companies/ypokatasthmata/add', ypokatasthmataController.postYpokatasthmataForm);
router.post('/companies/ypokatasthmata/search', ypokatasthmataController.searchPostYpokatasthmata);
router.get(
    '/companies/ypokatasthmata/search',
    checkAuth,
    ypokatasthmataController.searchGetYpokatasthmata
);
router.get(
    '/companies/ypokatasthmata/edit/:id',
    checkAuth,
    ypokatasthmataController.editYpokatasthmataForm
);
router.delete(
    '/companies/ypokatasthmata/delete/:id',
    checkAuth,
    ypokatasthmataController.deleteYpokatasthmata
);

// ============================================================================
// NOMIMOI EKPROSOPOI ROUTES
// ============================================================================
router.get(
    '/companies/nomimoi_ekprosopoi',
    checkAuth,
    nomimoiekprosopoiController.mainNomimoiEkprosopoiForm
);
router.get(
    '/companies/nomimoi_ekprosopoi/add',
    checkAuth,
    nomimoiekprosopoiController.addNomimoiEkprosopoiForm
);
router.post(
    '/companies/nomimoi_ekprosopoi/add',
    nomimoiekprosopoiController.postNomimoiEkprosopoiForm
);
router.get(
    '/companies/nomimoi_ekprosopoi/search',
    checkAuth,
    nomimoiekprosopoiController.searchGetNomimoiEkprosopoi
);
router.post(
    '/companies/nomimoi_ekprosopoi/search',
    nomimoiekprosopoiController.searchPostNomimoiEkprosopoi
);
router.get(
    '/companies/nomimoi_ekprosopoi/edit/:id',
    checkAuth,
    nomimoiekprosopoiController.editNomimoiEkprosopoiForm
);
router.delete(
    '/companies/nomimoi_ekprosopoi/delete/:id',
    checkAuth,
    nomimoiekprosopoiController.deleteNomimoiEkprosopoi
);

// ============================================================================
// PASSWORDS ROUTES
// ============================================================================
router.get('/companies/passwords', checkAuth, passwordsController.mainPasswordsForm);
router.get('/companies/passwords/add', checkAuth, passwordsController.addPasswordsForm);
router.post('/companies/passwords/add', passwordsController.postPasswordsForm);
router.get('/companies/passwords/search', checkAuth, passwordsController.searchGetPasswords);
router.post('/companies/passwords/search', passwordsController.searchPostPasswords);
router.get('/companies/passwords/edit/:id', checkAuth, passwordsController.editPasswordsForm);
router.delete('/companies/passwords/delete/:id', checkAuth, passwordsController.deletePasswords);

// ============================================================================
// TRAPEZES ROUTES
// ============================================================================
router.get('/companies/trapezes', checkAuth, trapezesController.mainTrapezesForm);
router.get('/companies/trapezes/add', checkAuth, trapezesController.addTrapezesForm);
router.post('/companies/trapezes/add', trapezesController.postTrapezesForm);
router.get('/companies/trapezes/search', checkAuth, trapezesController.searchGetTrapezes);
router.post('/companies/trapezes/search', trapezesController.searchPostTrapezes);
router.get('/companies/trapezes/edit/:id', checkAuth, trapezesController.editTrapezesForm);
router.delete('/companies/trapezes/delete/:id', checkAuth, trapezesController.deleteTrapezes);

// ============================================================================
// ANTISTOIXISEIS ROUTES
// ============================================================================
router.get('/companies/antistoixiseis', checkAuth, antistoixiseisController.mainAntistoixiseisForm);
router.get(
    '/companies/antistoixiseis/search',
    checkAuth,
    antistoixiseisController.searchGetAntistoixiseis
);
router.post('/companies/antistoixiseis/search', antistoixiseisController.searchPostAntistoixiseis);
router.get(
    '/companies/antistoixiseis/add/:id',
    checkAuth,
    antistoixiseisController.addAntistoixiseisForm
);
router.get(
    '/companies/antistoixiseis/addFromNested/:id',
    checkAuth,
    antistoixiseisController.addAntistoixiseisNestedForm
);
router.post('/companies/antistoixiseis/add', antistoixiseisController.postAntistoixiseisForm);
router.get(
    '/companies/antistoixiseis/edit/:id',
    checkAuth,
    antistoixiseisController.editAntistoixiseisForm
);
router.delete(
    '/companies/antistoixiseis/deleteFromNested/:id',
    antistoixiseisController.deleteAntistoixiseis
);
router.delete(
    '/companies/antistoixiseis/delete/:id',
    antistoixiseisController.deleteAllAntistoixiseis
);

// ============================================================================
// KRATHSEIS ROUTES
// ============================================================================
router.get('/krathseis/krathseis', checkAuth, krathseisController.mainKrathseisForm);
router.get('/krathseis/search', checkAuth, krathseisController.searchGetKrathseis);
router.post('/krathseis/search', krathseisController.searchPostKrathseis);
router.get('/krathseis/genika/add', checkAuth, krathseisController.addKrathseisForm);
router.post('/krathseis/genika/add', krathseisController.postKrathseisForm);
router.get('/krathseis/genika/edit/:id', checkAuth, krathseisController.editKrathseisForm);
router.delete('/krathseis/genika/delete/:id', checkAuth, krathseisController.deleteKrathseis);
router.get('/krathseis/pososta/add', checkAuth, krathseisController.addPosostaKrathseonForm);
router.post('/krathseis/pososta/add', krathseisController.postPosostaKrathseonForm);
router.get(
    '/krathseis/posostaKrathseon/edit/:id',
    checkAuth,
    krathseisController.editPosostaKrathseonForm
);
router.delete('/krathseis/posostaKrathseon/delete/:id', krathseisController.deletePosostaKrathseon);
router.get('/krathseis/updates', checkAuth, krathseisController.posostaKrathseonKrathshId);
router.get('/kad/updates', checkAuth, krathseisController.kadKodikosSort);

// ============================================================================
// ERGAZOMENOI ROUTES
// ============================================================================
router.get('/ergazomenoi/ergazomenoi', checkAuth, ergazomenoiController.mainErgazomenoiForm);
router.get('/ergazomenoi/ergazomenoi/add', checkAuth, ergazomenoiController.addErgazomenoiForm);
router.post(
    '/ergazomenoi/ergazomenoi/add',
    checkAuth,
    sanitizeNumberFields,
    ergazomenoiController.postErgazomenoiForm
);
router.get(
    '/ergazomenoi/ergazomenoi/edit/:id',
    checkAuth,
    ergazomenoiController.editErgazomenoiForm
);
router.get(
    '/api/ergazomenoi/:id/documents/allodapoi/view',
    checkAuth,
    ergazomenoiController.viewAllodapoiPdf
);
router.delete(
    '/api/ergazomenoi/:id/documents/allodapoi',
    checkAuth,
    ergazomenoiController.deleteAllodapoiPdf
);
router.get(
    '/api/ergazomenoi/:id/documents/anhlikoi/view',
    checkAuth,
    ergazomenoiController.viewBibliarioAnhlikoyPdf
);
router.delete(
    '/api/ergazomenoi/:id/documents/anhlikoi',
    checkAuth,
    ergazomenoiController.deleteBibliarioAnhlikoyPdf
);
router.get(
    '/api/ergazomenoi/:id/documents/symbash-daneismoy/view',
    checkAuth,
    ergazomenoiController.viewSymbashDaneismoyPdf
);
router.delete(
    '/api/ergazomenoi/:id/documents/symbash-daneismoy',
    checkAuth,
    ergazomenoiController.deleteSymbashDaneismoyPdf
);
router.get('/api/ergazomenoi/:id', ergazomenoiController.getErgazomenosById);
router.get('/api/ergazomenoi', ergazomenoiController.getAllErgazomenoiWithUrls);
router.get(
    '/ergazomenoi/ergazomenoi/istoriko/:kod',
    checkAuth,
    ergazomenoiController.getIstorikoData
);
router.post(
    '/ergazomenoi/ergazomenoi/istoriko/:kod',
    checkAuth,
    ergazomenoiController.updateIstorikoData
);
router.delete(
    '/ergazomenoi/ergazomenoi/delete/:id',
    checkAuth,
    ergazomenoiController.deleteErgazomenoi
);
router.get(
    '/ergazomenoi/ergazomenoi/search',
    checkAuth,
    ergazomenoiController.searchGetErgazomenoi
);
router.post('/ergazomenoi/ergazomenoi/search', ergazomenoiController.searchPostErgazomenoi);
router.post(
    '/ergazomenoi/ergazomenoi/upload-e3-to-erganh',
    checkAuth,
    ergazomenoiController.uploadE3ToErganh
);
router.post(
    '/ergazomenoi/ergazomenoi/upload-ma-to-erganh',
    checkAuth,
    ergazomenoiController.uploadMAToErganh
);
router.post(
    '/ergazomenoi/ergazomenoi/upload-wto-to-erganh',
    checkAuth,
    ergazomenoiController.uploadWtoToErganh
);
router.post(
    '/ergazomenoi/ergazomenoi/upload-wto-temporary-to-erganh',
    checkAuth,
    ergazomenoiController.uploadWtoTemporaryToErganh
);
router.post('/ergazomenoi/erganh/openErganh', checkAuth, erganhController.openErganh);

// ============================================================================
// ERGAZOMENOI - PROGRAMMATA ROUTES
// ============================================================================
router.get(
    '/ergazomenoi/programmata/programmaErgasias',
    checkAuth,
    programmataController.mainProgrammaErgasiasForm
);
router.delete(
    '/ergazomenoi/programmata/delete/:selectedTeam/:selectedCompany/:selectedKodikos/:startDate/:endDate',
    checkAuth,
    programmataController.deleteOrariaErgazomenoyApoEos
);
router.get(
    '/ergazomenoi/programmata/antigrafhProgrammaton',
    checkAuth,
    programmataController.mainAntigrafhProgrammatonForm
);
router.post(
    '/ergazomenoi/programmata/copy',
    checkAuth,
    programmataController.antigrafhProgrammaton
);

// ============================================================================
// ERGAZOMENOI - PROGRAMMATA - ERGANH ROUTES
// ============================================================================
router.get(
    '/ergazomenoi/programmata/lhpshOrarionApoErganh',
    checkAuth,
    erganhController.mainLhpshOrarionApoErganhForm
);
router.post(
    '/ergazomenoi/programmata/downloadSchedule',
    checkAuth,
    erganhController.lhpshOrarionApoErganh
);
router.get(
    '/ergazomenoi/programmata/lhpshOrarionApoKartes',
    checkAuth,
    erganhController.mainLhpshOrarionApoKartesForm
);
router.post(
    '/ergazomenoi/programmata/downloadCards',
    checkAuth,
    erganhController.lhpshOrarionApoKartes
);

router.get(
    '/ergazomenoi/programmata/calcApasxolhseisPeriodoy',
    checkAuth,
    erganhController.mainCalcApasxolhseisPeriodoyForm
);

router.post('/ergazomenoi/programmata/delete-pdf', checkAuth, erganhController.deletePdfFile);
router.get(
    '/ergazomenoi/programmata/exagoghOrarionSeErganh',
    checkAuth,
    erganhController.mainExagoghOrarionSeErganhForm
);
router.get(
    '/ergazomenoi/programmata/apologistikosPinakasOrarion',
    checkAuth,
    erganhController.mainApologistikosPinakasForm
);

// ============================================================================
// SYMBASEIS ROUTES
// ============================================================================
router.get('/symbaseis/symbaseis', checkAuth, symbaseisController.mainSymbaseisForm);
router.get('/symbaseis/symbaseis/add', checkAuth, symbaseisController.addSymbaseisForm);
router.post('/symbaseis/symbaseis/add', symbaseisController.postSymbaseisForm);
router.get('/symbaseis/symbaseis/search', checkAuth, symbaseisController.searchGetSymbaseis);
router.post('/symbaseis/symbaseis/search', symbaseisController.searchPostSymbaseis);
router.get('/symbaseis/symbaseis/edit/:id', checkAuth, symbaseisController.editSymbaseisForm);
router.delete('/symbaseis/symbaseis/delete/:id', checkAuth, symbaseisController.deleteSymbaseis);

// ============================================================================
// KATHGORIES SYMBASEON ROUTES
// ============================================================================
router.get('/symbaseis/kathgories', checkAuth, symbaseisController.mainKathgoriesSymbaseonForm);
router.get(
    '/symbaseis/kathgories/add/:kodikosSymbashs',
    checkAuth,
    symbaseisController.addKathgoriesSymbaseonForm
);
router.post('/symbaseis/kathgories/add', symbaseisController.postKathgoriesSymbaseonForm);
router.post(
    '/symbaseis/kathgories/search/:symbash',
    checkAuth,
    symbaseisController.searchPostKathgoriesSymbaseon
);
router.get(
    '/symbaseis/kathgories/search',
    checkAuth,
    symbaseisController.searchGetKathgoriesSymbaseon
);

router.get(
    '/symbaseis/kathgories/edit/:id',
    checkAuth,
    symbaseisController.editKathgoriesSymbaseonForm
);
router.delete(
    '/symbaseis/kathgories/delete/:id',
    checkAuth,
    symbaseisController.deleteKathgoriesSymbaseon
);

// ============================================================================
// EIDIKOTHTES SYMBASEON ROUTES
// ============================================================================
router.get('/symbaseis/eidikothtes', checkAuth, symbaseisController.mainEidikothtesSymbaseonForm);
router.get(
    '/symbaseis/eidikothtes/search',
    checkAuth,
    symbaseisController.searchGetEidikothtesSymbaseon
);
router.post(
    '/symbaseis/eidikothtes/search/:kodikos_symbashs_kathgorias',
    checkAuth,
    symbaseisController.searchPostEidikothtesSymbaseon
);
router.get(
    '/symbaseis/eidikothtes/add/:kodikosSymbashs_Kathgorias',
    checkAuth,
    symbaseisController.addEidikothtesSymbaseonForm
);
router.post('/symbaseis/eidikothtes/add', symbaseisController.postEidikothtesSymbaseonForm);
router.get(
    '/symbaseis/eidikothtes/edit/:id',
    checkAuth,
    symbaseisController.editEidikothtesSymbaseonForm
);
router.delete(
    '/symbaseis/eidikothtes/delete/:id',
    checkAuth,
    symbaseisController.deleteEidikothtesSymbaseon
);

// ============================================================================
// STOIXEIA SYMBASEON ROUTES
// ============================================================================
router.get(
    '/symbaseis/stoixeiaSymbaseon',
    checkAuth,
    symbaseisController.mainStoixeiaSymbaseonForm
);
router.post(
    '/symbaseis/stoixeiaSymbaseon/search/:kodikos_symbashs_kathgorias_eidikothtas',
    checkAuth,
    symbaseisController.searchPostStoixeiaSymbaseon
);
router.get(
    '/symbaseis/stoixeiaSymbaseon/search',
    checkAuth,
    symbaseisController.searchGetStoixeiaSymbaseon
);
router.get(
    '/symbaseis/stoixeiaSymbaseon/add/:kodikosSymbashs_Kathgorias_Eidikothtas',
    checkAuth,
    symbaseisController.addStoixeiaSymbaseonForm
);
router.post('/symbaseis/stoixeiaSymbaseon/add', symbaseisController.postStoixeiaSymbaseonForm);
router.get(
    '/symbaseis/stoixeiaSymbaseon/edit/:id',
    checkAuth,
    symbaseisController.editStoixeiaSymbaseonForm
);
router.delete(
    '/symbaseis/stoixeiaSymbaseon/delete/:id',
    checkAuth,
    symbaseisController.deleteStoixeiaSymbaseon
);

// ============================================================================
// YPOLOGISMOI KLIMAKION ROUTES
// ============================================================================
router.get('/symbaseis/ypologismoiKlimakion', checkAuth, symbaseisController.mainYpologismoiForm);
router.get('/symbaseis/klimakia', checkAuth, symbaseisController.mainKlimakiaForm);

// ============================================================================
// KINHSEIS ROUTES
// ============================================================================
router.get('/kinhseis/apasxolhseis', checkAuth, kinhseisController.mainApasxolhseisForm);
router.post('/kinhseis/apasxolhseis/add', checkAuth, kinhseisController.postApasxolhseisForm);
router.delete(
    '/kinhseis/apasxolhseis/delete/:id',
    checkAuth,
    kinhseisController.deleteApasxolhseis
);

// ============================================================================
// EKTYPOSEIS APASXOLHSEON ROUTES
// ============================================================================
router.get(
    '/ektyposeis/apasxolhseis/ektyposhApasxolhseon',
    checkAuth,
    ektyposhApasxolhseonController.mainApodeixeisErgazomenonForm
);

// ============================================================================
// EKTYPOSEIS SYMBASEON ROUTES
// ============================================================================
router.get(
    '/ektyposeis/symbaseis/ektyposhSymbaseonErgazomenon',
    checkAuth,
    ektyposhSymbaseonController.mainSymbaseisErgazomenonForm
);

// ============================================================================
// PROTECTED ROUTES
// ============================================================================
router.post('/login/change_password/changepassword', userController.changeUserPassword);

// ============================================================================
// ✅ PDF MANAGEMENT API ROUTES
// ============================================================================
router.post(
    '/api/upload-pdf',
    checkAuth,
    upload.single('pdfFile'),
    pdfDocumentsController.uploadPdf
);
router.get('/api/pdf/:ergazomenosId', checkAuth, pdfDocumentsController.getPdfsByErgazomenos);
router.get('/api/download-pdf/:id', checkAuth, pdfDocumentsController.downloadPdf);
router.delete('/api/delete-pdf/:id', checkAuth, pdfDocumentsController.deletePdf);

// ============================================================================
// API ENDPOINTS - Companies
// ============================================================================
router.post('/api/afmEtaireias', companiesController.checkAfmEtaireias);
router.get('/api/allUser', mainAppController.getAllUsers);
router.get('/api/allUsersByTeam/:companyTeam', companiesController.getAllUsersByTeam);
router.get('/api/appDateInUse', mainAppController.getAppDateInUse);
router.get('/api/companies/:companyId', companiesController.getCompanies);
router.get(
    '/api/companies/antistoixiseis/getAntistoixiseis/:krathshId',
    antistoixiseisController.getAntistoixiseis
);
router.post(
    '/api/companies/antistoixiseis/update/:antistoixishId',
    antistoixiseisController.postAntistoixiseisUpdate
);
router.post('/api/companies/update/:companyId', companiesController.postCompanyUpdate);
router.get('/api/companyDescription', mainAppController.getCompanyDescription);
router.get('/api/companyUsers/:companyId', companiesController.populateCompanyUsers);

// ============================================================================
// API ENDPOINTS - General Data
// ============================================================================
router.get('/api/dhmoi', genikaAPIsController.getDhmoi);
router.post('/api/diadoxosErgodoths', genikaAPIsController.checkDiadoxosErgodoths);
router.get(
    '/api/diadoxosErgodoths/:kodikosDiadoxoyErgodoth',
    genikaAPIsController.getDiadoxosErgodoths
);
router.get('/api/doy', genikaAPIsController.getCompanyDoy);
router.get('/api/dypa', genikaAPIsController.getDypa);
router.post('/api/emmesosErgodoths', genikaAPIsController.checkEmmesosErgodoths);
router.get(
    '/api/emmesosErgodoths/:kodikosEmmesoyErgodoth',
    genikaAPIsController.getEmmesosErgodoths
);
router.get('/api/getKadForEditForm', companiesController.getKadForEditForm);
router.get('/api/getKads/:companyId', companiesController.getCompanyKads);
router.get('/api/handleNomikesMorfes', genikaAPIsController.handleNomikesMorfes);
router.get('/api/handlePararthmataEfka', genikaAPIsController.handlePararthmataEfka);
router.post('/api/iatrosErgasias', genikaAPIsController.checkIatrosErgasias);
router.get('/api/iatrosErgasias/:kodikosIatroy', genikaAPIsController.getIatrosErgasias);
router.get('/api/idiothtes', genikaAPIsController.getIdiothtes);

// ============================================================================
// API ENDPOINTS - Krathseis
// ============================================================================
router.post('/api/krathseis/checkKrathshIfExists', krathseisController.checkKrathshIfExists);
router.get('/api/krathseis/getKrathseis', krathseisController.getKrathseis);
router.get(
    '/api/krathseis/getPosostaKrathseon/:krathshId',
    krathseisController.getPosostaKrathseon
);
router.post(
    '/api/krathseis/PosostaKrathseon/update/:posostaKrathseonId',
    krathseisController.postPosostaKrathseonUpdate
);
router.post('/api/krathseis/update/:krathseisId', krathseisController.postKrathseisUpdate);

// ============================================================================
// API ENDPOINTS - Geographic Data
// ============================================================================
router.get('/api/loadDhmoi/:nomosKodikos', genikaAPIsController.getDhmoiEditForm);
router.get('/api/loadNomoi/:perifereiaKodikos', genikaAPIsController.getNomoiEditForm);
router.get('/api/loadPoleis/:dhmosKodikos', genikaAPIsController.getPoleisEditForm);
router.get('/api/login/getRoles', userController.getUserRoles);
router.post('/api/logisths', genikaAPIsController.checkLogisths);
router.get('/api/logisths/:kodikosLogisth', genikaAPIsController.getLogisths);

// ============================================================================
// API ENDPOINTS - Legal & Administrative
// ============================================================================
router.get('/api/nomikesMorfes', genikaAPIsController.getNomikesMorfes);
router.post('/companies/api/nomimosEkprosopos', genikaAPIsController.checkNomimosEkprosopos);
router.get(
    '/companies/api/nomimosEkprosopos/:kodikosNomimoyEkprosopoy',
    genikaAPIsController.getNomimosEkprosopos
);
router.post(
    '/api/nomimoi_ekprosopoi/update/:nomimosEkprosoposId',
    nomimoiekprosopoiController.postNomimoiEkprosopoiUpdate
);
router.get('/api/nomoi', genikaAPIsController.getNomoi);
router.get('/api/pararthmataEfka', genikaAPIsController.getPararthmataEfka);
router.post('/api/passwords/update/:passwordsId', passwordsController.postPasswordsUpdate);
router.get('/api/perifereies', genikaAPIsController.getPerifereies);
router.get('/api/periodoi', mainAppController.getPeriods);
router.get('/api/periodInUse', mainAppController.getPeriodInUse);
router.get('/api/poleis', genikaAPIsController.getPoleis);
router.get('/api/populatekad', genikaAPIsController.getKad);
router.get('/api/populatetameia', genikaAPIsController.getTameia);
router.get('/api/sepe', genikaAPIsController.getSepe);

// ============================================================================
// API ENDPOINTS - Insurance & Finance
// ============================================================================
router.get('/api/tameia', genikaAPIsController.getAllTameia);
router.post('/api/texnikosAsfaleias', genikaAPIsController.checkTexnikosAsfaleias);
router.get('/api/texnikosAsfaleias/:kodikosTexnikoy', genikaAPIsController.getTexnikosAsfaleias);
router.get('/api/typoiTaytothton', genikaAPIsController.getTypoiTaytothton);
router.get('/api/yphkoothtes', genikaAPIsController.getYphkoothtes);
router.get('/api/eidikesKathgories', genikaAPIsController.getEidikesKathgories);
router.get(
    '/api/oresEidikonKathgorion/:kodikos',
    genikaAPIsController.getOresFromEidikesKathgories
);
router.get('/api/oikogeneiakhKatastash', genikaAPIsController.getOikogeneiakhKatastash);
router.get('/api/trapezes', genikaAPIsController.getBanks);

// ============================================================================
// API ENDPOINTS - Ergazomenoi
// ============================================================================
router.post('/api/afmErgazomenoy', ergazomenoiController.checkAfmErgazomenoy);
router.get('/api/kathestosApasxolhshs', genikaAPIsController.getKathestotaApasxolhshs);
router.get('/api/sxeseisErgasias', genikaAPIsController.getSxeseisErgasias);
router.get('/api/syggenikesSxeseis', genikaAPIsController.getSyggenikesSxeseis);
router.get('/api/theshEythynhs', genikaAPIsController.getTheseisEythynhs);
router.get('/api/eidikhPeriptosh', genikaAPIsController.getEidikesPeriptoseis);
router.get('/api/apasxolhseisBaseiSymbashs', genikaAPIsController.getApasxolhseisBaseiSymbashs);
router.get('/api/asfalistikesKlaseis', genikaAPIsController.getAsfalistikesKlaseis);
router.get('/api/tmhmata', genikaAPIsController.getTmhmata);
router.get('/api/ekpaideytikaEpipeda', genikaAPIsController.getEkpaideytikaEpipeda);
router.get('/api/eidikothtes', genikaAPIsController.getEidikothtes);
router.get('/api/typoiErgazomenon', genikaAPIsController.getTypoiErgazomenon);
router.get('/api/ypokatasthmata', ypokatasthmataController.getYpokatasthmata);
router.get('/api/eidikothtesErganh', genikaAPIsController.getEidikothtesErganh);
router.get('/api/getSelectedEidikothta', genikaAPIsController.getSelectedEidikothta);

// ============================================================================
// API ENDPOINTS - EFKA & KPK
// ============================================================================
router.get('/api/kadEfka', genikaAPIsController.getKadEfka);
router.get('/api/kpkEfkaOtanYparxeiEpa', genikaAPIsController.getKpk);
router.get('/api/antistoixishKadEidikothtesEfka', genikaAPIsController.getEidikothtesEfka);
router.get('/api/antistoixishKadKpkEfka', genikaAPIsController.getKpkEfka);
router.get('/api/epaEfka', genikaAPIsController.getEidikesPeriptoseisEfka);
router.get('/api/getKpkEfkaReset', genikaAPIsController.getKpkEfka);
router.get('/api/programmataDypa', genikaAPIsController.getProgrammataDypa);
router.get('/api/populateKentraKostoys', genikaAPIsController.getKentraKostoys);

// ============================================================================
// API ENDPOINTS - Symbaseis
// ============================================================================
router.get('/api/symbaseis', genikaAPIsController.getSymbaseis);
router.post('/api/symbaseis/update/:symbaseisId', symbaseisController.postSymbaseisUpdate);
router.get('/api/kathgoriesSymbaseon/:symbash', genikaAPIsController.getKathgoriesSymbaseon);
router.post(
    '/api/kathgoriesSymbaseon/update/:kathgoriesId',
    symbaseisController.postKathgoriesSymbaseonUpdate
);
router.get(
    '/api/eidikothtesSymbaseon/:symbash_kathgoria',
    genikaAPIsController.getEidikothtesSymbaseon
);
router.post(
    '/api/eidikothtesSymbaseon/update/:eidikothtesId',
    symbaseisController.postEidikothtesSymbaseonUpdate
);
router.get(
    '/api/stoixeiaSymbaseon/:symbash_kathgoria_eidikothta',
    genikaAPIsController.getStoixeiaSymbaseon
);
router.post(
    '/api/stoixeiaSymbaseon/update/:stoixeiaSymbaseonId',
    symbaseisController.postStoixeiaSymbaseonUpdate
);
router.get(
    '/api/klimakiaSymbaseon/:symbash_kathgoria_eidikothta_stoixeio',
    genikaAPIsController.getKlimakiaSymbaseon
);

// ============================================================================
// API ENDPOINTS - Calculations
// ============================================================================
router.post('/api/apodoxesErgazomenon', symbaseisController.calcApodoxesErgazomenon);
router.post('/api/enhmeroshKlimakion', symbaseisController.postKlimakiaSymbaseon);
router.post('/api/enhmeroshKlimakia', symbaseisController.postKlimakiaSymbaseonUpdates);
router.get('/api/krathseisErgazomenon', symbaseisController.getKrathseisErgazomenon);
router.get('/api/genikesParametroi', genikaAPIsController.getGenikesParametroi);
router.post('/api/getOraria', ergazomenoiController.getOrariaAnaErgazomeno);
router.post('/api/ergazomenoi/update/:ergazomenoiId', ergazomenoiController.postErgazomenoiUpdate);
router.post('/api/forologikes-klimakes/lookup', ergazomenoiController.forologikesKlimakes);

// ============================================================================
// API ENDPOINTS - Programmata
// ============================================================================
router.get(
    '/api/getAllErgazomenoi/:selectedTeam/:selectedCompany',
    programmataController.getAllErgazomenoi
);
router.get(
    '/api/getErgazomeno/:selectedTeam/:selectedCompany/:selectedKodikos',
    programmataController.getErgazomeno
);
router.post(
    '/api/ergazomenoi/programmata/update/:selectedTeam/:selectedCompany/:selectedKodikos',
    programmataController.postOrariaUpdate
);
router.get('/api/erganh/periods', checkAuth, erganhController.getPeriods);
router.post('/api/ergazomenoi/programmata/getOraria', programmataController.getOraria);

// ============================================================================
// API ENDPOINTS - Additional Employee Data
// ============================================================================
router.get('/api/adeiesDiamonhs/:typosAdeias', genikaAPIsController.getAdeiesDiamonhs);
router.get('/api/thematikaPedia', genikaAPIsController.getThematikaPedia);
router.get('/api/thematikesEnothtes', genikaAPIsController.getThematikesEnothtes);
router.get('/api/foreisEkpaideyshs', genikaAPIsController.getForeisEkpaideyshs);
router.get('/api/languages', genikaAPIsController.getLanguages);
router.post('/api/checkArgies', genikaAPIsController.checkArgies);
router.post('/api/dateDifference', genikaAPIsController.dateDifference);
router.get('/api/kathgoriesErgasias', genikaAPIsController.getKathgoriesErgasias);
router.post('/api/getProdhlomenaOraria', genikaAPIsController.getProdhlomenaOraria);

// ============================================================================
// API ENDPOINTS - User & Session
// ============================================================================
router.get('/api/user', mainAppController.getUser);
router.get('/api/xrhseis', mainAppController.getXrhseis);
router.get('/api/yearInUse', mainAppController.getYearInUse);
router.post(
    '/api/ypokatasthmata/update/:ypokatasthmaId',
    ypokatasthmataController.postYpokatasthmaUpdate
);
router.post('/api/trapezes/update/:trapezesId', trapezesController.postTrapezesUpdate);

// ============================================================================
// API ENDPOINTS - Kinhseis
// ============================================================================
router.get(
    '/api/kinhseis/getErgazomenoi/:selectedTeam/:selectedCompany',
    kinhseisController.getErgazomenoi
);
router.get(
    '/api/kinhseis/getLoipaStoixeiaErgazomenoy/:selectedTeam/:selectedCompany/:selectedKodikos',
    kinhseisController.loipaStoixeiaErgazomenoy
);
router.get('/api/kinhseis/typoiApodoxon', kinhseisController.getTypoiApodoxon);
router.get('/api/kinhseis/calcTotals', kinhseisController.getTotals_Apasxolhseon);
router.get('/api/kinhseis/calcApoysies', kinhseisController.getTotals_Apoysion);
router.get('/api/kinhseis/getApasxolhseis', kinhseisController.getApasxolhseis);
router.get('/api/kinhseis/getEthsioSynoloYperorion', kinhseisController.getEthsioSynoloYperorion);
router.get('/api/kinhseis/getKrathseis', kinhseisController.getKrathseisWithPososta);
router.get(
    '/api/kinhseis/getAntistoixiseisByKrathshAndTypoApodoxon',
    kinhseisController.getAntistoixiseisByKrathshAndTypoApodoxon
);
router.post(
    '/ergazomenoi/programmata/calcApasxolhseisPeriodoy',
    erganhController.calcApasxolhseisPeriodoy
);
router.get(
    '/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy',
    erganhController.mainElegxosApasxolhseonPeriodoyForm
);
router.get('/api/prodhlomena-oraria/review', erganhController.getProdhlomenaOrariaForReview);
router.get(
    '/api/prodhlomena-oraria/review/export-excel',
    erganhController.exportProdhlomenaOrariaReviewExcel
);
router.patch(
    '/api/prodhlomena-oraria/review/:id',
    erganhController.updateProdhlomenaOrariaReviewRecord
);
router.get(
    '/api/prodhlomena-oraria/review/:id/audit',
    erganhController.getProdhlomenaOrariaReviewAudit
);
router.patch(
    '/api/prodhlomena-oraria/review/:id/unlock',
    erganhController.unlockProdhlomenaOrariaReviewRecord
);
router.post(
    '/api/prodhlomena-oraria/review/:id/restore/:auditId',
    erganhController.restoreProdhlomenaOrariaReviewRecord
);
router.get('/api/kinhseis/getKlimakiaForoy', forosController.getKlimakiaForoy);
router.get('/api/kinhseis/getEkptoshForoy', forosController.getEkptoshForoy);
router.get('/api/kinhseis/getEisodhmaProForoyMeioshs', forosController.getEisodhmaProForoyMeioshs);
router.post('/api/kinhseis/argies_astheneion', kinhseisController.getSynoloArgion);
router.post('/api/kinhseis/hmeres_mh_ergasias', kinhseisController.getSynoloHmeronMhErgasias);
router.post(
    '/api/kinhseis/prohgoymenes_astheneies',
    kinhseisController.getSynoloProhgoymenonAstheneion
);
router.post('/api/kinhseis/hmeromhnies_astheneias', kinhseisController.get_Hmeromhnies_Astheneion);
router.post(
    '/api/kinhseis/asfalistikes_klaseis',
    kinhseisController.get_Asfalistikes_Klaseis_Gia_Epidothsh_Efka
);
router.get('/api/kinhseis/kathgories_adeion', kinhseisController.get_Kathgories_Adeion);
router.post('/api/kinhseis/prohgoymenes_adeies', kinhseisController.getSynoloProhgoymenonAdeion);
router.post(
    '/api/kinhseis/apodoxes_prohgoymenon_periodon',
    kinhseisController.getSynoloApodoxonProhgoymenonPeriodon
);

// ============================================================================
// API ENDPOINTS - Ektyposeis
// ============================================================================
router.post('/api/ektyposeis/symbaseis/ergazomenoi', ektyposhSymbaseonController.createPdf);

// ============================================================================
// API ENDPOINTS - Session Updates
// ============================================================================
router.post('/api/update_session_typosApodoxon', kinhseisController.update_session_typosApodoxon);
router.post('/api/update_session_periodos', kinhseisController.update_session_periodos);

router.post('/api/usage/heartbeat', checkAuth, userController.heartbeat);
router.get('/admin/usage-report', checkAuth, userController.usageReportPage);
router.get('/admin/usage-report/export', checkAuth, userController.exportUsageReport);
// ============================================================================
// ✅ ERROR HANDLING - Multer & PDF Errors
// ============================================================================
router.use((error, req, res, next) => {
    // Multer-specific errors
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Το αρχείο είναι πολύ μεγάλο. Μέγιστο μέγεθος:  5MB'
            });
        }

        return res.status(400).json({
            success: false,
            message: `Σφάλμα upload: ${error.message}`
        });
    }

    // PDF-specific errors (από fileFilter)
    if (error.message && error.message.includes('PDF')) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    // Pass to next error handler
    next(error);
});

module.exports = router;

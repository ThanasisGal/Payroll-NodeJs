// routes/apiRoutes.js
const express = require('express');
const router  = express.Router();

const symbaseisController = require('../controllers/symbaseisController');

// ΠΙΝΑΚΑΣ ΜΕ PAGINATION (JSON: items, page, pages, total)
router.get('/symbaseis/kathgories',             symbaseisController.listKathgoriesSymbaseon);
router.get('/symbaseis/eidikothtes',            symbaseisController.listEidikothtesSymbaseon);
router.get('/symbaseis/stoixeiaSymbaseon',      symbaseisController.listStoixeiaSymbaseon);

module.exports = router;

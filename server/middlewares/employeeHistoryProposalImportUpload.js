'use strict';

const multer = require('multer');
const { MAX_FILE_BYTES, rejected } = require('../services/ergazomenoi/employeeHistoryProposalImportFileService');
const upload = multer({ storage:multer.memoryStorage(), limits:{fileSize:MAX_FILE_BYTES,files:1,fields:0,parts:2},
    fileFilter(req,file,callback) {
        callback(/\.xlsx$/i.test(file.originalname) ? null : rejected('FORMAT',415),true);
    } }).single('proposal');
function parseHistoryProposalImport(req,res,next) {
    upload(req,res,error => {
        if (!error && req.file?.buffer) return next();
        const failure=error?.importReason ? error : rejected(error?.code==='LIMIT_FILE_SIZE'?'SIZE':'FORMAT',error?.code==='LIMIT_FILE_SIZE'?413:422);
        return require('../services/ergazomenoi/employeeHistoryProposalImportService').sendImportFailure(res,failure);
    });
}
module.exports={parseHistoryProposalImport};

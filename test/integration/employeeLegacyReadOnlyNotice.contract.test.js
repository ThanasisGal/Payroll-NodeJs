'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.resolve(__dirname,'../../public/js/ergazomenoi/genika/putFieldValues.js'),'utf8');
const start=code.indexOf('function employeeLegacyReadOnlyNotice(');
const end=code.indexOf('\n// Only successful saves', start);
assert.ok(start>0 && end>start);
const create=()=>vm.runInNewContext('(' + code.slice(start,end).trim()+')');
const oldReview={success:true,employeeUpdated:true,historyUpdated:false,
 historyAccessMode:'READ_ONLY',historyStatus:'LEGACY_REVIEW_REQUIRED',
 historyPreservationReason:{code:'HISTORY_CHANGE_REQUESTED',message:'Διαφορά στα ιστορικά στοιχεία της σύμβασης.'}};
test('no selected documents/ERGANI: no invented dependent-action failure',()=>{
 const message=create()(oldReview,{isPermanent:true,erganiUploadMethod:'rest',create_contract:false,ma_217:false});
 assert.match(message,/Η αποθήκευση των στοιχείων του εργαζομένου ολοκληρώθηκε/);
 assert.match(message,/Το Ιστορικό δεν άλλαξε/);
 assert.match(message,/Διαφορά στα ιστορικά στοιχεία της σύμβασης/);
 assert.match(message,/HISTORY_CHANGE_REQUESTED/);
 assert.doesNotMatch(message,/δεν εκτελέστηκαν|CLEAN|επιστροφ/);
});
test('selected ERGANI: preserve explicit non-execution notice',()=>{
 const message=create()(oldReview,{isPermanent:true,erganiUploadMethod:'rest',ma_217:true});
 assert.match(message,/Οι επιλεγμένες ενέργειες εγγράφων\/ΕΡΓΑΝΗ δεν εκτελέστηκαν/);
});
test('selected contract PDF: preserve explicit non-execution notice',()=>{
 const message=create()(oldReview,{create_contract:true});
 assert.match(message,/εγγράφων\/ΕΡΓΑΝΗ δεν εκτελέστηκαν/);
});
test('no Employee change: never imply changed Employee or CLEAN History',()=>{
 const message=create()({...oldReview,employeeUpdated:false},{isPermanent:true});
 assert.match(message,/Δεν προέκυψε αλλαγή/);
 assert.doesNotMatch(message,/ενημερώθηκαν|CLEAN/);
});
test('no reason: do not fabricate a cause or CLEAN classification',()=>{
 const message=create()({success:true,employeeUpdated:true,historyAccessMode:'READ_ONLY'},null);
 assert.match(message,/Η ασφάλεια νέας ιστορικής μεταβολής δεν έχει πιστοποιηθεί/);
 assert.match(message,/LEGACY_REVIEW_REQUIRED/);
 assert.doesNotMatch(message,/CLEAN|δεν εκτελέστηκαν/);
});
test('backend reason is assigned as text, never injected as HTML',()=>{
 assert.match(code,/notice\.textContent = employeeLegacyReadOnlyNotice\(data, v\.filesToUpdate\)/);
 assert.doesNotMatch(code,/notice\.innerHTML\s*=/);
 const message=create()({...oldReview,historyPreservationReason:{message:'<script>alert(1)</script>',code:'SOURCE_CODE'}},{});
 assert.ok(message.includes('<script>alert(1)</script>'));
});

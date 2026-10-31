'use strict';

// Offline preparation only: no database configuration, connection, importer or writer.
const mongoose = require('mongoose');
const { acceptanceB, acceptanceBWithInitialGap } = require('../../test/fixtures/employeeHistoryCoordinatedSettlementFixture');
const { buildCoordinatedSettlementProposal } = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
const id = number => new mongoose.Types.ObjectId(`5025b00100000000${String(number).padStart(8,'0')}`);

function buildCaseB({ initialGap = true, passwordHash } = {}) {
    if (typeof passwordHash !== 'string' || !/^\$2[aby]\$/.test(passwordHash)) throw Error('TEST_PASSWORD_HASH_REQUIRED');
    const source = initialGap ? acceptanceBWithInitialGap() : acceptanceB();
    // THA is mandatory for ADMIN_FULL; every actual test entity has an explicit TEST identity.
    const scope = { team:'THA', company_kod:String(id(1)), kodikos:'TEST-5025-CASE-B' };
    const actorId = String(id(2)), employeeId = String(id(4));
    const history = source.completeHistoryRows.map(row => ({ ...row, ...scope,
        _id:id(100 + Number(row.aa_eggrafhs)) }));
    const employee = { ...source.currentEmployee, ...scope, _id:id(4),
        onoma:'TEST', eponymo:'CASE B SYNTHETIC', oristikh_enhmerosh:true };
    const frozen = history.map((row,index) => ({ _id:id(200+index), ...scope,
        frozen_snapshot:{ finalized:true, amount:123.45, hours:8,
            daily_results:[{ kodikos:scope.kodikos, effective_profile_istoriko_id:row._id }] } }));
    const protectedReferenceSummary = Object.fromEntries(history.map((row,index) => [String(row._id),
        [{ collection:'Apasxoliseis_Period_Frozen_Snapshots', documentId:String(frozen[index]._id) }]]));
    const input = { scope, employeeId, actorUserId:actorId, currentEmployee:employee,
        completeHistoryRows:history, protectedReferenceSummary };
    const proposal = buildCoordinatedSettlementProposal(input);
    return {
        marker:'TEST_5025_CASE_B_OFFLINE_ONLY', database:'payroll_test_isolated', databaseUser:'payroll_dev_test',
        variant:initialGap?'acceptanceBWithInitialGap':'acceptanceB', scope, actorId, employeeId,
        executionEnabled:false, imported:false,
        collections:{
            Companies:[{_id:id(1),team:scope.team,user_id:actorId,kod:'TEST5025',eponymia:'TEST 5025 CASE B SYNTHETIC'}],
            users:[{_id:id(2),kod:'TEST5025B',firstName:'TEST',lastName:'CASE B',
                email:'test-5025-case-b@example.invalid',password:passwordHash,team:'THA',privileges:'A',
                situation:'A',isVerified:true,details:'TEST 5025 SYNTHETIC — NEVER PRODUCTION'}],
            User_Privileges:[{_id:id(3),userId:actorId,form:'Ergazomenoi',
                privileges:{admin:false,create:false,read:true,update:true,delete:false,print:false,export:false}}],
            Ergazomenoi:[employee], Istoriko_Proslhpseon_Allagon:history,
            Apasxoliseis_Period_Frozen_Snapshots:frozen
        },
        // A template for server-owned session state after normal authenticated login/company selection.
        // It must never be accepted from request headers, query strings or request bodies.
        sessionTemplate:{userId:actorId,userTeam:scope.team,companyInUse:scope.company_kod,userRole:'A',userStatus:'A'},
        expected:{proposalStatus:proposal.status,noOp:proposal.noOp,
            baselineHistoryRows:history.length,protectedReferenceDocuments:frozen.length},
        previewPath:`/api/ergazomenoi/${employeeId}/history-reconstruction-preview?presentation=settlement`,
        input
    };
}

async function main() {
    if (process.argv.length !== 2 || mongoose.connection.readyState !== 0) throw Error('OFFLINE_ONLY');
    const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
    const root = path.resolve(__dirname,'../..');
    if (fs.realpathSync(process.cwd()) !== root) throw Error('WORKTREE_REQUIRED');
    const directory = path.join(root,'.cache/isolated-atlas/history-first-transaction');
    // A fresh output directory prevents replacing any previous preparation or credentials.
    fs.mkdirSync(directory,{mode:0o700});
    const fakePassword = crypto.randomBytes(32).toString('base64url');
    const passwordHash = require('bcrypt').hashSync(fakePassword,10);
    const bundle = { preparationOnly:true, historyExecutionEnabled:false,
        syntheticLoginPassword:fakePassword,
        cases:[buildCaseB({passwordHash}),buildCaseB({passwordHash,initialGap:false})] };
    const fd = fs.openSync(path.join(directory,'case-b.ejson'),'wx',0o600);
    fs.writeFileSync(fd,mongoose.mongo.BSON.EJSON.stringify(bundle,{relaxed:false}));
    fs.closeSync(fd);
    console.log(JSON.stringify({status:'PREPARED_OFFLINE',cases:bundle.cases.map(item=>({variant:item.variant,...item.expected})),
        databaseWrites:0,transactionsStarted:0,historyExecutionEnabled:false}));
}
module.exports = { buildCaseB };
if (require.main === module) main().catch(() => {
    console.error('Η τοπική προετοιμασία των συνθετικών δεδομένων σταμάτησε. Δεν ζητήθηκε καμία εγγραφή σε βάση ή ενεργοποίηση Ιστορικού.\n1. Ελέγξτε ότι βρίσκεστε στο δοκιμαστικό worktree και ότι δεν υπάρχει ήδη ο φάκελος history-first-transaction.\n2. Αν δημιουργήθηκε μερικό τοπικό αρχείο, ελέγξτε το πριν επαναλάβετε.\nΚωδικός αναφοράς: ATLAS-ISOLATED-OFFLINE-B.');
    process.exitCode=1;
});

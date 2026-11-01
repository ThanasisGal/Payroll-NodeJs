'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const F = require('./employeeHistoryPilotFiles');
const R = require('./employeeHistoryPilotRecoveryService');
const ARGUMENT = '--employee-history-settlement-pilot=';
function createGate({ grantFile, deps, root, ledgerDirectory = path.join(os.homedir(), '.local/state/payroll-history-pilot') }) {
    const bytes = F.readPrivate(grantFile, root), grant = JSON.parse(bytes);
    if (grant.version !== 1 || grant.root !== root || !grant.scope ||
        !A.equal(Object.keys(grant.scope).sort(),['company_kod','kodikos','team']) ||
        !['team','company_kod','kodikos'].every(key=>typeof grant.scope[key]==='string' && grant.scope[key].trim()===grant.scope[key] && grant.scope[key].length>0) ||
        ![grant.actorUserId, grant.employeeId, grant.scope.company_kod].every(id=>/^[a-f0-9]{24}$/i.test(id||'')) ||
        !/^[A-Za-z0-9_-]{43}$/.test(grant.fingerprint||'') ||
        !/^[a-f0-9]{64}$/.test(grant.backupSha256||'') ||
        !A.equal(grant.identity,R.databaseIdentity(deps.connection))) F.fail('GRANT');
    const backup = R.readBackup(grant.backupFile,grant.backupSha256,root);
    if (!A.equal(backup.scope,grant.scope) || backup.employeeId!==grant.employeeId || backup.actorUserId!==grant.actorUserId ||
        backup.approvalFingerprint!==grant.fingerprint ||
        !A.equal(backup.identity,grant.identity)) F.fail('BACKUP_SCOPE');
    // A fixed per-user ledger prevents copying/renaming a manifest into a new
    // directory from giving the same approval a second execution allowance.
    const directory = F.privateDirectory(ledgerDirectory, root);
    // Same approval cannot be rearmed by renaming the grant or changing its nonce.
    const key = A.hash({ identity:grant.identity,scope:grant.scope,employeeId:grant.employeeId,
        actorUserId:grant.actorUserId,fingerprint:grant.fingerprint });
    const claimFile = path.join(directory,key+'.consumed'), undoFile = path.join(directory,key+'.undo-consumed');
    let owner = null, undoOwner = null;
    const grantHash = F.digest(bytes);
    function available() { return !fs.existsSync(claimFile); }
    function assertIdentity({scope,employeeId,actorUserId,fingerprint}) {
        if (!A.equal(scope,grant.scope) || employeeId!==grant.employeeId || actorUserId!==grant.actorUserId ||
            fingerprint!==grant.fingerprint || !A.equal(grant.identity,R.databaseIdentity(deps.connection))) F.fail('SCOPE');
    }
    function assertRequest(req) {
        if (req.session?.userId!==grant.actorUserId || req.session?.companyInUse!==grant.scope.company_kod ||
            req.session?.userTeam!==grant.scope.team || req.params?.id!==grant.employeeId) F.fail('SCOPE');
    }
    function assertTransaction(session) {
        if (!available() && owner !== session) F.fail('ALREADY_CLAIMED');
    }
    async function claimExecution(args) {
        assertIdentity(args);
        if (!args.session?.inTransaction()) F.fail('TRANSACTION_REQUIRED');
        const fresh = await R.capture({deps,scope:grant.scope,employeeId:grant.employeeId,session:args.session});
        if (!R.sameSnapshot(backup,fresh)) F.fail('BACKUP_STALE');
        if (owner===args.session) return; // Driver retry of this transaction only.
        F.writeExclusive(claimFile,JSON.stringify({version:1,state:'CONSUMED',grantHash,
            fingerprint:grant.fingerprint,claimedAt:new Date().toISOString()}),root);
        owner=args.session;
    }
    function claimUndo(session) {
        if (!fs.existsSync(claimFile) || !session?.inTransaction()) F.fail('UNDO_WITHOUT_CLAIM');
        if (undoOwner===session) return;
        F.writeExclusive(undoFile,JSON.stringify({version:1,grantHash,claimedAt:new Date().toISOString()}),root);
        undoOwner=session;
    }
    return Object.freeze({grant:Object.freeze(grant),grantHash,available,assertIdentity,assertRequest,assertTransaction,claimExecution,claimUndo,
        auditEvidence: ({currentBefore,currentAfter})=>({grantHash,backupSha256:grant.backupSha256,currentBefore,currentAfter})});
}
module.exports={ ARGUMENT,createGate };

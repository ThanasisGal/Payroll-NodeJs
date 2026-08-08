'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const PostingModel = require('../../models/apasxoliseisCorrectivePayrollPosting');
const BalanceModel = require('../../models/apasxoliseisCorrectivePayrollBalance');
const CorrectiveModel = require('../../models/apasxoliseisPeriodCorrectiveCase');
const FrozenModel = require('../../models/apasxoliseisPeriodFrozenSnapshot');
const AuditModel = require('../../models/apasxoliseisPeriodLifecycleAudit');
const { ApasxolhseisModel } = require('../../models/kinhseis');
const { ErgazomenoiModel } = require('../../models/ergazomenoi');
const { normalizeScope, periodError } = require('./apasxoliseisPeriodControlService');
const { assertCriticalEmploymentDecisionRole } = require('./apasxoliseisCriticalActionAuthorizationService');
const { roundPayrollMoney } = require('../kinhseis/payrollMoneyService');

function roundMoney(value) { return roundPayrollMoney(value); }
function resolveEmployeeTypeGrossDelta(correctiveDelta, employeeKodikos, typosApodoxon) {
    const matches = (correctiveDelta?.monetary_by_employee_and_type || []).filter((row) =>
        String(row.employee_kodikos) === String(employeeKodikos) &&
        String(row.typos_apodoxon) === String(typosApodoxon));
    if (matches.length !== 1) throw periodError('CORRECTIVE_PAYROLL_MONETARY_DELTA_NOT_DETERMINISTIC', 409,
        'Η χρηματική διορθωτική διαφορά δεν μπορεί να αντιστοιχιστεί μονοσήμαντα στον τύπο αποδοχών.');
    return roundMoney(matches[0].gross_corrective_delta);
}
function calculateCorrectivePostingAmounts({ grossDelta, openBalance = 0, withholdingRatePercent = 0 }) {
    const gross = roundMoney(grossDelta); const balance = Math.max(0, roundMoney(openBalance));
    const rate = Number(withholdingRatePercent);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw periodError('INVALID_CORRECTIVE_WITHHOLDING_RATE', 409,
        'Το ποσοστό παρακράτησης διορθωτικής μισθοδοσίας δεν είναι έγκυρο.');
    if (gross === 0) return Object.freeze({ gross_corrective_delta: 0, open_offset_balance_consumed_from: balance,
        offset_applied: 0, remaining_after_offset: 0, withholding_rate_percent: rate,
        withholding_amount: 0, payable_now: 0, carry_forward_created: 0, next_open_balance: balance });
    if (gross < 0) return Object.freeze({ gross_corrective_delta: gross, open_offset_balance_consumed_from: balance,
        offset_applied: 0, remaining_after_offset: 0, withholding_rate_percent: rate,
        withholding_amount: 0, payable_now: 0, carry_forward_created: roundMoney(Math.abs(gross)),
        next_open_balance: roundMoney(balance + Math.abs(gross)) });
    const offset = roundMoney(Math.min(gross, balance)); const remaining = roundMoney(gross - offset);
    const withholding = remaining > 0 ? roundMoney(remaining * rate / 100) : 0;
    return Object.freeze({ gross_corrective_delta: gross, open_offset_balance_consumed_from: balance,
        offset_applied: offset, remaining_after_offset: remaining, withholding_rate_percent: rate,
        withholding_amount: withholding, payable_now: roundMoney(remaining - withholding), carry_forward_created: 0,
        next_open_balance: roundMoney(balance - offset) });
}
function nextFreePayrollSequence(used, originals) { const occupied = new Set(used.map(String));
    const start = Math.max(0, ...originals.map((value) => Number(value) || 0));
    for (let candidateNumber = start + 1; candidateNumber <= 9; candidateNumber += 1) {
        const candidate = String(candidateNumber);
        if (!occupied.has(candidate)) return candidate; }
    throw periodError('CORRECTIVE_PAYROLL_SEQUENCE_EXHAUSTED', 409,
        'Δεν υπάρχει ελεύθερος α/α μισθοδοσίας από 1 έως 9. Απαιτείται χειροκίνητη επιλογή.');
}
function actor(session = {}) { const role = assertCriticalEmploymentDecisionRole(session); const id = String(session.userId || '');
    if (!mongoose.isValidObjectId(id)) throw periodError('NOT_AUTHORIZED', 403, 'Μη έγκυρη ενεργή συνεδρία.');
    return { id, name: String(session.userName || session.username || id), role }; }
async function defaultTransaction(work) { const session = await mongoose.startSession(); try { let result;
    await session.withTransaction(async () => { result = await work(session); }); return result; } finally { await session.endSession(); } }

async function postCorrectivePayroll({ session: userSession, scope: input, caseId, employeeKodikos,
    typosApodoxon, requestId, reason, now = new Date(), transactionRunner = defaultTransaction,
    postingModel = PostingModel, balanceModel = BalanceModel, correctiveModel = CorrectiveModel,
    frozenModel = FrozenModel, payrollModel = ApasxolhseisModel, employeeModel = ErgazomenoiModel,
    auditModel = AuditModel,
    indexGuard }) {
    const scope = normalizeScope(input); const by = actor(userSession); const employee = String(employeeKodikos || '').trim();
    const earningsType = String(typosApodoxon || '').trim(); const request = String(requestId || '').trim();
    const cleanReason = String(reason || '').trim();
    if (!caseId || !employee || !earningsType || !request || !cleanReason) throw periodError('INVALID_CORRECTIVE_PAYROLL_COMMAND', 400,
        'Λείπουν υποχρεωτικά στοιχεία διορθωτικής μισθοδοσίας.');
    if (typeof indexGuard === 'function') await indexGuard();
    return transactionRunner(async (dbSession) => {
        const retry = await postingModel.findOne({ team: scope.team, company_kod: scope.company_kod, request_id: request })
            .session(dbSession).lean();
        const corrective = await correctiveModel.findOne({ ...scope, case_id: caseId, status: 'CLOSED' }).session(dbSession).lean();
        if (!corrective?.corrective_delta || !corrective.corrected_result_fingerprint || !corrective.corrective_delta_fingerprint) throw periodError('CORRECTIVE_PAYROLL_CASE_NOT_READY', 409,
            'Η διορθωτική υπόθεση δεν είναι κλειστή με έγκυρο αποτέλεσμα.');
        const commandFingerprint = crypto.createHash('sha256').update(JSON.stringify({ case_id: caseId,
            employee_kodikos: employee, typos_apodoxon: earningsType,
            corrective_delta_fingerprint: corrective.corrective_delta_fingerprint })).digest('hex');
        if (retry) { if (retry.command_fingerprint !== commandFingerprint) throw periodError('CORRECTIVE_PAYROLL_REQUEST_CONFLICT', 409,
            'Το αναγνωριστικό αιτήματος έχει χρησιμοποιηθεί για διαφορετικό posting.'); return { posting: retry, idempotent: true }; }
        const existingBusinessPosting = await postingModel.findOne({ ...scope, case_id: caseId,
            employee_kodikos: employee, typos_apodoxon: earningsType }).session(dbSession).lean();
        if (existingBusinessPosting) {
            if (existingBusinessPosting.corrective_delta_fingerprint === corrective.corrective_delta_fingerprint &&
                existingBusinessPosting.command_fingerprint === commandFingerprint) return { posting: existingBusinessPosting, idempotent: true };
            throw periodError('CORRECTIVE_PAYROLL_POSTING_CONFLICT', 409,
                'Η διορθωτική υπόθεση έχει ήδη καταχωριστεί με διαφορετικό αποτέλεσμα.');
        }
        const baseline = await frozenModel.findOne({ _id: corrective.baseline_snapshot_reference, ...scope,
            frozen_snapshot_fingerprint: corrective.baseline_fingerprint }).session(dbSession).lean();
        if (!baseline?.frozen_snapshot) throw periodError('CORRECTIVE_BASELINE_MISMATCH', 409, 'Το παγωμένο αποτέλεσμα δεν συμφωνεί.');
        const frozenPayroll = (baseline.frozen_snapshot.payroll_results || []).filter((row) =>
            String(row.kodikos) === employee && String(row.typos_apodoxon) === earningsType);
        if (!frozenPayroll.length) throw periodError('CORRECTIVE_ORIGINAL_PAYROLL_NOT_FOUND', 409,
            'Δεν βρέθηκε αρχική μισθοδοτική εγγραφή για τον εργαζόμενο και τον τύπο αποδοχών.');
        const originalIds = frozenPayroll.map((row) => row._id).filter(Boolean);
        const originals = await payrollModel.find({ _id: { $in: originalIds }, team: scope.team,
            company_kod: scope.company_kod, ypokatasthma: scope.ypokatasthma, kodikos: employee,
            typos_apodoxon: earningsType }).session(dbSession).lean();
        if (originals.length !== originalIds.length) throw periodError('CORRECTIVE_ORIGINAL_PAYROLL_MISMATCH', 409,
            'Οι αρχικές μισθοδοτικές εγγραφές δεν συμφωνούν με το παγωμένο αποτέλεσμα.');
        const gross = resolveEmployeeTypeGrossDelta(corrective.corrective_delta, employee, earningsType);
        if (gross === 0) throw periodError('NO_CORRECTIVE_PAYROLL_DIFFERENCE', 409, 'Δεν υπάρχει διορθωτική μισθοδοτική διαφορά προς καταχώριση.');
        const employeeRecord = await employeeModel.findOne({ team: scope.team, company_kod: scope.company_kod,
            ypokatasthma: scope.ypokatasthma, kodikos: employee }).select('corrective_payroll_withholding_rate_percent').session(dbSession).lean();
        const balanceScope = { team: scope.team, company_kod: scope.company_kod, ypokatasthma: scope.ypokatasthma,
            employee_kodikos: employee, typos_apodoxon: earningsType };
        let balance = await balanceModel.findOne(balanceScope).session(dbSession).lean();
        if (!balance) { try { const made = await balanceModel.create([{ ...balanceScope, open_balance: 0, version: 0, updated_at: now }], { session: dbSession });
            balance = made[0].toObject(); } catch (error) { if (error?.code === 11000) throw periodError('CORRECTIVE_PAYROLL_CONFLICT', 409,
                'Η διορθωτική μισθοδοσία άλλαξε ταυτόχρονα.'); throw error; } }
        const amounts = calculateCorrectivePostingAmounts({ grossDelta: gross, openBalance: balance.open_balance,
            withholdingRatePercent: employeeRecord?.corrective_payroll_withholding_rate_percent || 0 });
        const usedRows = await payrollModel.find({ team: scope.team, company_kod: scope.company_kod,
            ypokatasthma: scope.ypokatasthma, kodikos: employee, xrhsh: originals[0].xrhsh,
            periodos: originals[0].periodos, typos_apodoxon: earningsType }).select('aa_misthodosias').session(dbSession).lean();
        const nextAa = nextFreePayrollSequence(usedRows.map((row) => row.aa_misthodosias), originals.map((row) => row.aa_misthodosias));
        const updatedBalance = await balanceModel.findOneAndUpdate({ ...balanceScope, version: balance.version,
            open_balance: balance.open_balance }, { $set: { open_balance: amounts.next_open_balance, updated_at: now }, $inc: { version: 1 } },
        { new: true, session: dbSession });
        if (!updatedBalance) throw periodError('CORRECTIVE_PAYROLL_CONFLICT', 409, 'Το υπόλοιπο συμψηφισμού άλλαξε ταυτόχρονα.');
        const source = originals[originals.length - 1]; const payrollDocuments = await payrollModel.create([{
            team: scope.team, company_kod: scope.company_kod, ypokatasthma: scope.ypokatasthma, kodikos: employee,
            xrhsh: source.xrhsh, periodos: source.periodos, typos_apodoxon: earningsType, aa_misthodosias: nextAa,
            apo_hmeromhnia: scope.period_start, eos_hmeromhnia: scope.period_end,
            synolo_apodoxon: gross > 0 ? gross : 0, synolo_mikton_apodoxon: gross > 0 ? gross : 0,
            synolo_krathseon_i: amounts.withholding_amount, poso_plhromhs: amounts.payable_now,
            plhroteo: amounts.payable_now }], { session: dbSession });
        const postingDocuments = await postingModel.create([{ ...scope, case_id: caseId, employee_kodikos: employee,
            original_payroll_row_references: originals.map((row) => row._id), corrective_payroll_row_references: payrollDocuments.map((row) => row._id),
            typos_apodoxon: earningsType, original_aa_misthodosias: originals.map((row) => String(row.aa_misthodosias)),
            corrective_aa_misthodosias: nextAa, corrective_delta_fingerprint: corrective.corrective_delta_fingerprint,
            ...amounts, request_id: request, command_fingerprint: commandFingerprint, posting_status: 'POSTED',
            posted_by_user_id: by.id, posted_by_user_name: by.name, posted_by_user_role: by.role, posted_at: now }], { session: dbSession });
        await auditModel.create([{ ...scope, event_type: 'CORRECTIVE_PAYROLL_POST', actor_user_id: by.id,
            actor_user_name: by.name, actor_user_role: by.role, reason: cleanReason,
            reference_id: caseId, details: { employee_kodikos: employee, typos_apodoxon: earningsType,
                corrective_aa_misthodosias: nextAa, posting_id: postingDocuments[0]._id }, occurred_at: now }],
        { session: dbSession });
        return { posting: postingDocuments[0], idempotent: false };
    });
}

module.exports = { roundMoney, calculateCorrectivePostingAmounts, nextFreePayrollSequence,
    resolveEmployeeTypeGrossDelta, postCorrectivePayroll };

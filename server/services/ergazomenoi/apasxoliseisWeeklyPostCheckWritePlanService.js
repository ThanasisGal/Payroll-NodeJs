const {
    startOfWeekMondayUtc,
    endOfWeekSundayUtc,
    addDaysUtc,
    dateKeyUtc
} = require('../../utils/date/mondaySundayWeek');
const {
    getEffectiveRepoProfileForDate,
    getWeeklyRepoProfileInfo,
    resolveNoCardsDisplayStatus
} = require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');
const {
    analyzeWeeklySixthSeventhDay
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const {
    buildWeeklyCanonicalDecisionSnapshotInput,
    weeklyCanonicalDecisionGroupKey
} = require('./apasxoliseisWeeklyCanonicalDecisionSnapshotInputService');
const {
    resolveWeeklyCanonicalDecisionAnalysis
} = require('./apasxoliseisWeeklyCanonicalDecisionResolutionService');
const {
    resolveCanonicalRepoDayCountState
} = require('./apasxoliseisWeeklyCanonicalRepoCountService');
const {
    resolveFullTimeFromWorkTerms
} = require('./apasxoliseisReviewEmploymentProfileService');
const {
    buildPartialVerifiedCardUpdate
} = require('./apasxoliseisIncompleteCardSafetyService');
const {
    resolveCardPairVerification
} = require('./apasxoliseisCardPairResolverService');
const { resolveSafeStartOnlyOrphan } = require('./apasxoliseisAttendanceDerivedScheduleService');
const {
    buildDailyCompensationBreakdown
} = require('./apasxoliseisDailyCompensationBreakdownService');
const {
    sanitizeAppliedRepoTransferUpdate
} = require('./apasxoliseisWeeklyRepoTransferAppliedProtectionService');
const {
    isWeekFullyWithinEmploymentPeriod
} = require('./apasxoliseisEmploymentPeriodScopeService');
const {
    POLICY_VERSION: WEEKLY_REPO_DEVIATION_POLICY_VERSION,
    SOURCE_VERSION: WEEKLY_REPO_DEVIATION_SOURCE_VERSION
} = require('./apasxoliseisWeeklyRepoDeviationPreviewService');
const {
    LEAVE_PROVENANCE,
    classifyLeaveProvenance
} = require('./apasxoliseisLeaveProvenanceService');

function clampDateStartUtc(value) {
    const date = new Date(value);
    date.setUTCHours(0, 0, 0, 0);
    return date;
}

function clampDateEndUtc(value) {
    const date = new Date(value);
    date.setUTCHours(23, 59, 59, 999);
    return date;
}

function asDateOnlyUtc(value, endOfDay = false) {
    return endOfDay ? clampDateEndUtc(value) : clampDateStartUtc(value);
}

function getWeekRangesInsidePeriod(apoDate, eosDate) {
    const periodStart = clampDateStartUtc(apoDate);
    const periodEnd = clampDateEndUtc(eosDate);
    const ranges = [];
    let cursor = startOfWeekMondayUtc(periodStart);

    while (cursor.getTime() <= periodEnd.getTime()) {
        const naturalWeekStart = startOfWeekMondayUtc(cursor);
        const naturalWeekEnd = endOfWeekSundayUtc(cursor);
        const weekStart = naturalWeekStart.getTime() < periodStart.getTime()
            ? periodStart : naturalWeekStart;
        const weekEnd = naturalWeekEnd.getTime() > periodEnd.getTime()
            ? periodEnd : naturalWeekEnd;
        ranges.push({
            naturalWeekStart,
            naturalWeekEnd,
            weekStart,
            weekEnd,
            isFullWeek:
                dateKeyUtc(weekStart) === dateKeyUtc(naturalWeekStart) &&
                dateKeyUtc(weekEnd) === dateKeyUtc(naturalWeekEnd)
        });
        cursor = addDaysUtc(naturalWeekStart, 7);
    }
    return ranges;
}

function isZeroHours(value) {
    const number = Number(value || 0);
    return !Number.isFinite(number) || Math.abs(number) < 0.000001;
}

function isNonZeroHours(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) && Math.abs(number) >= 0.000001;
}

function isNoCardDeclaredWorkRow(row = {}) {
    return String(row.kathgoria_ergasias || '').trim() === 'ΕΡΓ' &&
        isNonZeroHours(row.ores_ergasias) && isZeroHours(row.cards_ores_ergasias);
}

function isMisthotosEmployee(profile = {}) {
    return String(profile.typos_ergazomenon || '').trim() === 'Μ';
}

function buildSeventhDayAttendanceUpdate(row = {}) {
    const verification = resolveCardPairVerification(row);
    const update = { apologistiko_biblio: true };
    for (let pairIndex = 1; pairIndex <= 3; pairIndex += 1) {
        const pairNumber = String(pairIndex).padStart(2, '0');
        const pair = verification.completePairs.find(
            (candidate) => candidate.pairNumber === pairNumber
        );
        update[`apo_ora_${pairNumber}_apologistika`] = pair?.start || '';
        update[`eos_ora_${pairNumber}_apologistika`] = pair?.end || '';
    }
    return update;
}

/**
 * Builds the exact Phase-C post-check Mongo write plan. `rows` must be the rows
 * reloaded after the first calculation-stage ProdhlomenaOraria bulkWrite.
 * This function performs no persistence and does not support pre-first-stage rows.
 */
function buildWeeklyRepoPostCheckWritePlan({
    sessionTeam,
    companyId,
    apoDate,
    eosDate,
    employees = [],
    rows = [],
    istorikoRowsByKodikos = new Map(),
    companyPolicyRules = [],
    postCheckArgiesDateSet = new Set(),
    noCardsDisplayContext = {},
    appliedProtectionContext,
    appliedProtectionReasonsByWeek = new Map(),
    canonicalDecisionsByWeek = new Map(),
    sameRunDailyCalculatedRowIds = new Set(),
    resolveProfileForDate = null,
    buildWeeklyIllegalOvertimeUpdate
}) {
    if (typeof buildWeeklyIllegalOvertimeUpdate !== 'function') {
        throw new TypeError('buildWeeklyIllegalOvertimeUpdate must be a function');
    }

    const rowsByEmployeeAndDate = new Map();
    for (const row of rows) {
        rowsByEmployeeAndDate.set(`${row.kodikos}|${dateKeyUtc(row.hmeromhnia)}`, row);
    }

    const bulkOps = [];
    const deviations = [];
    const diagnostics = [];
    const compensationBreakdowns = {
        ready: 0,
        needsHrDecision: 0,
        daysWithRejectedCompanyRule: 0
    };
    const weekRanges = getWeekRangesInsidePeriod(apoDate, eosDate);

    for (const erg of employees) {
        const istorikoRows = istorikoRowsByKodikos.get(String(erg.kodikos)) || [];

        for (const week of weekRanges) {
            let pragmatikaRepo = 0;
            const repoStateReasons = new Set();
            const protectionWeekKey = `${erg.kodikos}|${dateKeyUtc(startOfWeekMondayUtc(week.weekStart))}`;
            for (const reason of appliedProtectionReasonsByWeek.get(protectionWeekKey) || []) {
                repoStateReasons.add(reason);
            }
            const weekFullyInsideEmployment = isWeekFullyWithinEmploymentPeriod(week.weekStart, erg);
            const weeklyProfileInfo = getWeeklyRepoProfileInfo({
                week,
                istorikoRows,
                ergazomenos: erg,
                resolveProfileForDate: typeof resolveProfileForDate === 'function'
                    ? (reviewDate) => resolveProfileForDate({
                        reviewDate, employee: erg, history: istorikoRows })
                    : null
            });
            const expectedWeeklyRepo = weeklyProfileInfo.expectedWeeklyRepo;
            const effectiveProfile = weeklyProfileInfo.effectiveProfile || {};
            const previousProfile = weeklyProfileInfo.previousProfile || {};
            const weekRows = [];
            for (let day = clampDateStartUtc(week.weekStart); day <= week.weekEnd; day = addDaysUtc(day, 1)) {
                const row = rowsByEmployeeAndDate.get(`${erg.kodikos}|${dateKeyUtc(day)}`);
                if (row) weekRows.push(row);
            }
            const automaticSixthSeventhAnalysis = weekFullyInsideEmployment
                ? analyzeWeeklySixthSeventhDay({
                      weekRows,
                      effectiveProfile,
                      hourlyRate: effectiveProfile.pragmatikoOromisthio,
                      calculatedWorkHoursAuthoritative: true,
                      allowDeclaredRepoIdentityOverride: true,
                      canonicalRepoDayIdentitiesOverride: (() => {
                          const identities = weekRows
                              .filter((row) => sameRunDailyCalculatedRowIds.has(String(row._id)) &&
                                  (row.repo === true ||
                                      String(row.kathgoria_ergasias || '').trim() === 'ΑΝ' ||
                                      String(row.kathgoria_ergasias || '').trim() === 'ΜΕ'))
                              .map((row) => dateKeyUtc(row.hmeromhnia));
                          return [1, 2].includes(identities.length) ? identities : null;
                      })()
                  })
                : { status: 'READY', reasons: [], sixthDay: null, seventhDay: null };
            const decisionKey = weeklyCanonicalDecisionGroupKey({
                ypokatasthma: erg.ypokatasthma,
                employee_kodikos: erg.kodikos,
                week_start: week.naturalWeekStart,
                week_end: week.naturalWeekEnd
            });
            const decisionRecords = [
                ...(canonicalDecisionsByWeek.get(decisionKey) || []),
                ...(canonicalDecisionsByWeek.get('__REUSABLE__') || [])
            ];
            let sixthSeventhAnalysis = automaticSixthSeventhAnalysis;
            if (weekFullyInsideEmployment && decisionRecords.length > 0 &&
                automaticSixthSeventhAnalysis.status === 'NEEDS_HR_DECISION') {
                const snapshotInput = buildWeeklyCanonicalDecisionSnapshotInput({
                    team: sessionTeam, company_kod: companyId, employee: erg, week, weekRows,
                    effectiveProfile, profileHistory: istorikoRows,
                    automaticAnalysis: automaticSixthSeventhAnalysis,
                    appliedProtectionContext,
                    calculatedWorkHoursAuthoritative: true
                });
                sixthSeventhAnalysis = resolveWeeklyCanonicalDecisionAnalysis({
                    automaticAnalysis: automaticSixthSeventhAnalysis,
                    snapshotInput,
                    decisionRecords,
                    weekRows,
                    effectiveProfile,
                    employee: erg,
                    profileHistory: istorikoRows
                }).analysis;
            }
            const canonicalBlockingReasons =
                sixthSeventhAnalysis.status === 'NEEDS_HR_DECISION'
                    ? [...new Set(sixthSeventhAnalysis.reasons || [])]
                    : [];

            for (let day = clampDateStartUtc(week.weekStart); day <= week.weekEnd; day = addDaysUtc(day, 1)) {
                const row = rowsByEmployeeAndDate.get(`${erg.kodikos}|${dateKeyUtc(day)}`);
                if (!row) continue;

                const kathgoriaErgasias = String(row.kathgoria_ergasias || '').trim();
                const oresErgasiasIsZero = isZeroHours(row.ores_ergasias);
                const cardsOresIsNonZero = isNonZeroHours(row.cards_ores_ergasias);
                const dailyProfile = typeof resolveProfileForDate === 'function'
                    ? resolveProfileForDate({ reviewDate: day, employee: erg,
                        history: istorikoRows })
                    : getEffectiveRepoProfileForDate(day, istorikoRows, erg);
                const isFullTimeProfile = resolveFullTimeFromWorkTerms(dailyProfile) === true;
                const update = {};
                const rawUnresolvedCardPair = resolveCardPairVerification(row).hasUnresolvedCardEvidence;
                const safeOrphan = rawUnresolvedCardPair
                    ? resolveSafeStartOnlyOrphan(row, {
                          flexibleArrivalMinutes: dailyProfile.evelikth_proselefsh
                      })
                    : null;
                const hasUnresolvedCardPair = rawUnresolvedCardPair && !safeOrphan;
                const repoCountState = resolveCanonicalRepoDayCountState({
                    row,
                    dailyProfile,
                    hasUnresolvedCardPair
                });
                for (const reason of repoCountState.diagnostics) repoStateReasons.add(reason);

                if (hasUnresolvedCardPair) Object.assign(update, buildPartialVerifiedCardUpdate(row).update);
                if (!hasUnresolvedCardPair && isNonZeroHours(row.ores_ergasias) &&
                    cardsOresIsNonZero && String(row.kathgoria_ergasias_apologistika || '').trim() === 'ΜΕ') {
                    update.kathgoria_ergasias_apologistika = '';
                    update.repo_apologistika = false;
                }
                const declaredNonWork = isFullTimeProfile
                    ? kathgoriaErgasias === 'ΑΝ'
                    : kathgoriaErgasias === 'ΜΕ' || kathgoriaErgasias === 'ΑΝ';
                if (repoCountState.countsAsRepo) {
                    pragmatikaRepo += 1;
                } else if (!hasUnresolvedCardPair && declaredNonWork && oresErgasiasIsZero && cardsOresIsNonZero) {
                    update.kathgoria_ergasias_apologistika = 'ΕΡΓ';
                } else if (!hasUnresolvedCardPair && isNoCardDeclaredWorkRow(row) &&
                    classifyLeaveProvenance(row) !== LEAVE_PROVENANCE.HR_DECLARED_LEAVE) {
                    const noCardsDisplayStatus = resolveNoCardsDisplayStatus(row, noCardsDisplayContext);
                    update.apologistiko_biblio = false;
                    update.kathgoria_ergasias_apologistika = '';
                    update.ores_ergasias_apologistika = isMisthotosEmployee(dailyProfile)
                        ? Number(row.ores_ergasias || 0) : 0;
                    update.ores_apoysias_apologistika = 0;
                    update.adeia_apologistika = false;
                    update.argia = noCardsDisplayStatus === 'ΑΡΓΙΑ';
                    update.kathgoria_adeias_apologistika =
                        noCardsDisplayStatus === 'ΑΔΕΙΑ' ? 'POSSIBLE_LEAVE' : '';
                }

                const rowDateKey = dateKeyUtc(row.hmeromhnia);
                const isSixthDay = sixthSeventhAnalysis?.sixthDay?.hmeromhnia === rowDateKey;
                const isSeventhDay = sixthSeventhAnalysis?.seventhDay?.hmeromhnia === rowDateKey;
                if (isSeventhDay) {
                    Object.assign(update, buildSeventhDayAttendanceUpdate(row));
                }
                const weeklyIllegalOvertimeHours = isSixthDay
                    ? sixthSeventhAnalysis.sixthDay.illegalOvertimeHours
                    : isSeventhDay ? sixthSeventhAnalysis.seventhDay.illegalOvertimeHours : 0;
                if (weeklyIllegalOvertimeHours > 0) {
                    Object.assign(update, buildWeeklyIllegalOvertimeUpdate(
                        { ...row, ...update },
                        dailyProfile,
                        weeklyIllegalOvertimeHours,
                        postCheckArgiesDateSet,
                        { clearOverlappingLegal: isSeventhDay }
                    ));
                }
                const compensationBreakdown = buildDailyCompensationBreakdown({
                    row: { ...row, ...update },
                    companyKod: companyId,
                    atDate: row.hmeromhnia,
                    paidHourlyRate: dailyProfile.pragmatikoOromisthio,
                    legalHourlyRate: dailyProfile.nomimoOromisthio,
                    sixthDayHours: isSixthDay ? sixthSeventhAnalysis.sixthDay.sixthDayHours : 0,
                    weeklyIllegalOvertimeHours,
                    sixthDayMandatoryRatePercent: dailyProfile.pososto_prosayxhshs_6hs_hmeras,
                    companyRules: companyPolicyRules,
                    calculatedWorkHoursAuthoritative: true,
                    blockingReasons:
                        week.isFullWeek && sixthSeventhAnalysis.status === 'NEEDS_HR_DECISION'
                            ? sixthSeventhAnalysis.reasons : []
                });
                update.ores_pragmatikhs_ergasias_apologistika = compensationBreakdown.hours.actualWorkHours;
                update.ores_adeias_pistomenes_apologistika = compensationBreakdown.hours.paidLeaveHours;
                update.ores_argias_pistomenes_apologistika = compensationBreakdown.hours.holidayCreditedHours;
                update.compensation_breakdown_apologistika = compensationBreakdown;
                if (compensationBreakdown.status === 'READY') compensationBreakdowns.ready += 1;
                else compensationBreakdowns.needsHrDecision += 1;
                if (compensationBreakdown.warnings.some((warning) => String(warning).startsWith('REJECTED_'))) {
                    compensationBreakdowns.daysWithRejectedCompanyRule += 1;
                }

                const protectedUpdate = sanitizeAppliedRepoTransferUpdate({
                    rowId: row._id,
                    currentRow: row,
                    update,
                    protectionContext: appliedProtectionContext
                });
                for (const reason of protectedUpdate.diagnostics) repoStateReasons.add(reason);
                if (protectedUpdate.diagnostics.length > 0) {
                    diagnostics.push({
                        kodikos: erg.kodikos,
                        weekStart: dateKeyUtc(week.weekStart),
                        rowId: row._id,
                        reasons: [...protectedUpdate.diagnostics]
                    });
                }
                if (Object.keys(protectedUpdate.sanitizedUpdate).length > 0 && row.is_locked !== true) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: row._id },
                            update: { $set: protectedUpdate.sanitizedUpdate },
                            upsert: false
                        }
                    });
                }
            }

            const allBlockingReasons = [
                ...new Set([...repoStateReasons, ...canonicalBlockingReasons])
            ];
            const isProfileChangeDeviation =
                weeklyProfileInfo.profileChangedInsideWeek === true ||
                canonicalBlockingReasons.includes('PROFILE_CHANGED_INSIDE_WEEK');

            if (week.isFullWeek && weekFullyInsideEmployment &&
                (weeklyProfileInfo.repoResolutionReason ||
                    Number(pragmatikaRepo) !== Number(expectedWeeklyRepo) ||
                    repoStateReasons.size > 0 || canonicalBlockingReasons.length > 0)) {
                const excessRepo = Math.max(0, Number(pragmatikaRepo) - Number(expectedWeeklyRepo));
                deviations.push({
                    team: sessionTeam,
                    company_kod: companyId,
                    period_apo: asDateOnlyUtc(apoDate),
                    period_eos: asDateOnlyUtc(eosDate, true),
                    ypokatasthma: erg.ypokatasthma || '',
                    kodikos: erg.kodikos || '',
                    eponymo: erg.eponymo || '',
                    onoma: erg.onoma || '',
                    week_apo: asDateOnlyUtc(week.weekStart),
                    week_eos: asDateOnlyUtc(week.weekEnd),
                    weekStart: dateKeyUtc(week.weekStart),
                    weekEnd: dateKeyUtc(week.weekEnd),
                    policyVersion: WEEKLY_REPO_DEVIATION_POLICY_VERSION,
                    sourceVersion: WEEKLY_REPO_DEVIATION_SOURCE_VERSION,
                    expected_repo: expectedWeeklyRepo,
                    repo_resolution_source: weeklyProfileInfo.repoResolutionSource,
                    repo_resolution_reason: weeklyProfileInfo.repoResolutionReason,
                    ...(allBlockingReasons.length > 0
                        ? { status: 'NEEDS_HR_DECISION', reasons: allBlockingReasons } : {}),
                    actual_repo: pragmatikaRepo,
                    missing_repo: Math.max(Number(expectedWeeklyRepo || 0) - Number(pragmatikaRepo), 0),
                    pragmatikaRepo,
                    profile_changed_inside_week: weeklyProfileInfo.profileChangedInsideWeek,
                    excess_repo: excessRepo,
                    effective_expected_repo: expectedWeeklyRepo,
                    effective_weekly_workdays: Number(effectiveProfile.hmeres_ergasias_ebdomadas) || 0,
                    expected_repo_source: weeklyProfileInfo.repoResolutionSource || '',
                    effective_typos_apasxolhshs: effectiveProfile.typos_apasxolhshs || '',
                    effective_profile_source:
                        effectiveProfile.resolution_source ||
                        effectiveProfile.employment_profile_source || effectiveProfile.source || '',
                    effective_profile_date: weeklyProfileInfo.effectiveProfileDate,
                    effective_profile_istoriko_id: effectiveProfile.istorikoId || null,
                    previous_typos_apasxolhshs: previousProfile.typos_apasxolhshs || '',
                    previous_profile_source:
                        previousProfile.resolution_source ||
                        previousProfile.employment_profile_source || previousProfile.source || '',
                    previous_profile_date: weeklyProfileInfo.previousProfileDate,
                    previous_profile_istoriko_id: previousProfile.istorikoId || null,
                    deviation_type: isProfileChangeDeviation
                        ? 'PROFILE_CHANGED_INSIDE_WEEK' : 'WEEKLY_REPO_MISMATCH',
                    note: weeklyProfileInfo.profileChangedInsideWeek && excessRepo > 0
                        ? 'Υπάρχουν επιπλέον ρεπό σε εβδομάδα με αλλαγή όρων εργασίας. Να ελεγχθεί αν πρέπει να χαρακτηριστούν ως ΑΔΑΛ.'
                        : ''
                });
            }
        }
    }

    return { bulkOps, deviations, diagnostics, compensationBreakdowns };
}

module.exports = { buildWeeklyRepoPostCheckWritePlan, buildSeventhDayAttendanceUpdate };

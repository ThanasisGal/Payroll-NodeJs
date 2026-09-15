'use strict';

const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');

function appendStage4BlockedDeviationRows({ deviations = [], canonicalLifecycleProjections = [], reviewRows = [] }) {
    const presented = [...deviations];
    const identity = (employee, week) => `${String(employee || '').trim()}|${dateKeyUtc(week)}`;
    const existing = new Set(presented.map((row) => identity(
        row.kodikos || row.employee_kodikos, row.week_apo || row.weekStart)));

    for (const entry of canonicalLifecycleProjections) {
        const stage4 = entry.lifecycle_projection?.stages?.stage4;
        if (stage4?.business_status !== 'BLOCKED') continue;
        const { employee_kodikos: kodikos, week_start: weekStart, week_end: weekEnd } = entry.scope || {};
        const key = identity(kodikos, weekStart);
        if (!kodikos || !dateKeyUtc(weekStart) || existing.has(key)) continue;

        const weekRows = reviewRows.filter((row) =>
            String(row.kodikos || '').trim() === String(kodikos).trim() &&
            dateKeyUtc(row.hmeromhnia) >= dateKeyUtc(weekStart) &&
            dateKeyUtc(row.hmeromhnia) <= dateKeyUtc(weekEnd));
        const analysis = stage4.final_weekly_analysis || {};
        const sixthDay = analysis.sixthDayIdentity || '';
        const seventhDay = analysis.seventhDayIdentity || '';
        const profileRow = weekRows.find((row) => dateKeyUtc(row.hmeromhnia) === dateKeyUtc(sixthDay)) ||
            weekRows[0] || {};
        const actualWorkdays = Array.isArray(analysis.dailyFacts)
            ? analysis.dailyFacts.filter((day) => day.countsAsActualWorkDay === true).length
            : null;
        const weeklyWorkdays = profileRow.effective_weekly_workdays;
        presented.push({
            kodikos: String(kodikos).trim(),
            ypokatasthma: profileRow.ypokatasthma || entry.scope?.ypokatasthma || '',
            week_apo: dateKeyUtc(weekStart),
            week_eos: dateKeyUtc(weekEnd),
            status: 'NEEDS_HR_DECISION',
            requires_new_hr_decision: false,
            effective_typos_apasxolhshs: profileRow.effective_typos_apasxolhshs,
            effective_weekly_workdays: weeklyWorkdays,
            effective_expected_repo: Number.isFinite(Number(weeklyWorkdays))
                ? 7 - Number(weeklyWorkdays) : null,
            actual_workdays: actualWorkdays,
            sixth_day_count: sixthDay ? 1 : 0,
            sixth_day_date: dateKeyUtc(sixthDay),
            seventh_day_count: seventhDay ? 1 : 0,
            seventh_day_date: dateKeyUtc(seventhDay),
            sixth_seventh_day_status: analysis.status,
            sixth_seventh_day_reasons: [...new Set([
                ...(stage4.blockers || []), ...(stage4.pending_reasons || []),
                ...(analysis.reasons || [])
            ])],
            stage4_blocked_presentation: true
        });
        existing.add(key);
    }
    return presented;
}

module.exports = { appendStage4BlockedDeviationRows };

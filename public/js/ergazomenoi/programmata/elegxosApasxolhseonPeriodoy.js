const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

function userCanReviewEdit() {
    return document.getElementById('canReviewEdit')?.value === '1';
}

function num(value) {
    return Number(value || 0);
}

function hours(value) {
    return num(value).toFixed(2);
}

function hasMeaningfulValue(value) {
    if (value === null || value === undefined) return false;

    const v = String(value).trim();

    return v !== '' && v !== '-' && v !== '0' && v !== '0.0' && v !== '0.00';
}

function hasPositiveNumber(value) {
    return Number(value || 0) > 0;
}

function intervalText(apo, eos) {
    const a = String(apo || '').trim();
    const e = String(eos || '').trim();

    if (!a && !e) return '-';

    return `${a || ''} - ${e || ''}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const scenarioCodeLabels = {
    UNKNOWN_PATTERN_REQUIRES_REVIEW: 'Άγνωστο μοτίβο - προς έλεγχο',
    DECLARED_REPO_WITH_CARDS: 'Δηλωμένο ρεπό με κάρτες',
    DECLARED_WORK_NO_CARDS_LEAVE: 'Εργασία χωρίς κάρτες - άδεια',
    DECLARED_WORK_NO_CARDS_HOLIDAY_REQUIRED: 'Εργασία χωρίς κάρτες - υποχρεωτική αργία',
    DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_CLOSED:
        'Μη υποχρεωτική αργία - εταιρεία κλειστή',
    DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_WORKS:
        'Μη υποχρεωτική αργία - εταιρεία λειτουργεί',
    ZERO_LENGTH_CARD_INTERVAL: 'Μηδενικό διάστημα κάρτας',
    DECLARED_NON_WORK_WITH_CARDS: 'Μη εργασία με κάρτες',
    SPLIT_SHIFT_MATCHED_WITH_DEVIATION: 'Σπαστό με απόκλιση',
    REPO_TRANSFER_WITHIN_WEEK: 'Πιθανή μεταφορά ρεπό'
};

const scenarioConfidenceLabels = {
    HIGH: 'Υψηλή',
    MEDIUM: 'Μεσαία',
    LOW: 'Χαμηλή'
};

const scenarioDecisionStatusLabels = {
    PENDING_REVIEW: 'Προς έλεγχο',
    CLASSIFIED_ONLY: 'Ταξινομημένο'
};

const scenarioReasonLabels = {
    DECLARED_WORK_WITHOUT_CARDS: 'Δηλωμένη εργασία χωρίς κάρτες',
    DECLARED_LEAVE_FOUND: 'Βρέθηκε άδεια',
    HOLIDAY_REQUIRED_FOUND: 'Βρέθηκε υποχρεωτική αργία',
    HOLIDAY_OPTIONAL_COMPANY_WORKS: 'Μη υποχρεωτική αργία - εταιρεία λειτουργεί',
    HOLIDAY_OPTIONAL_COMPANY_CLOSED: 'Μη υποχρεωτική αργία - εταιρεία κλειστή',
    ZERO_LENGTH_CARD_INTERVAL_FOUND: 'Βρέθηκε μηδενικό διάστημα κάρτας',
    SPLIT_SHIFT_DEVIATION_FOUND: 'Βρέθηκε σπαστό με απόκλιση',
    DECLARED_REPO_WITH_CARDS: 'Δηλωμένο ρεπό με κάρτες',
    DECLARED_NON_WORK_WITH_CARDS: 'Μη εργασία με κάρτες',
    REPO_TRANSFER_CANDIDATE: 'Πιθανή μεταφορά ρεπό',
    LEGAL_CLASSIFICATION_REQUIRED: 'Απαιτείται νομοθετική ταξινόμηση',
    UNKNOWN_PATTERN: 'Άγνωστο μοτίβο'
};

function rowIdentityKey(value) {
    if (value === null || value === undefined) return '';

    return String(value).trim();
}

function scenarioLabel(decision = {}) {
    const code = String(decision.scenario_code || '').trim();

    if (!code) return '';
    if (decision.requires_review === true) return 'ΠΡΟΣ ΕΛΕΓΧΟ';

    return scenarioCodeLabels[code] || code;
}

function scenarioTitle(decision = {}) {
    const code = String(decision.scenario_code || '').trim();
    const label = scenarioCodeLabels[code] || code;

    if (!code) return '';

    return `${label} / ${code}`;
}

function scenarioConfidenceLabel(confidence) {
    const key = String(confidence || '').trim();

    return scenarioConfidenceLabels[key] || key;
}

function scenarioDecisionStatusLabel(status) {
    const key = String(status || '').trim();

    return scenarioDecisionStatusLabels[key] || key;
}

function scenarioReasonLabel(reason) {
    const key = String(reason || '').trim();

    return scenarioReasonLabels[key] || key;
}

function renderScenarioBadge(row) {
    const decision = row?.scenarioDecision;

    if (!decision || !decision.scenario_code) return '';

    const label = scenarioLabel(decision);
    const confidence = scenarioConfidenceLabel(decision.confidence);
    const badgeClass =
        decision.requires_review === true
            ? 'review-scenario-badge review-scenario-badge-review'
            : 'review-scenario-badge review-scenario-badge-classified';
    const title = scenarioTitle(decision);
    const confidenceHtml = confidence
        ? `<span class="review-scenario-confidence">${escapeHtml(confidence)}</span>`
        : '';

    return `
        <div class="review-scenario-badge-row">
            <span class="${badgeClass}" title="${escapeHtml(title)}">
                ${escapeHtml(label)}
            </span>
            ${confidenceHtml}
        </div>
    `;
}

function formatScenarioValue(value) {
    if (value === true) return 'ΝΑΙ';
    if (value === false) return 'ΟΧΙ';
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'object') return JSON.stringify(value);

    return String(value);
}

function renderScenarioList(items = [], labelFn = (value) => value) {
    const listItems = (Array.isArray(items) ? items : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .map(
            (item) => `
                <li>
                    ${escapeHtml(labelFn(item))}
                    <small class="text-muted">(${escapeHtml(item)})</small>
                </li>
            `
        );

    if (listItems.length === 0) return '';

    return `<ul class="review-scenario-list mb-0">${listItems.join('')}</ul>`;
}

function renderScenarioProposedUpdates(proposedUpdates = {}) {
    const entries = Object.entries(proposedUpdates || {});

    if (entries.length === 0) return '';

    return `
        <div class="review-scenario-subsection">
            <div class="fw-semibold mb-1">Προτεινόμενες ενημερώσεις</div>
            <table class="table table-sm table-bordered mb-0">
                <tbody>
                    ${entries
                        .map(
                            ([field, value]) => `
                                <tr>
                                    <td>${escapeHtml(auditLabel(field))}</td>
                                    <td>${escapeHtml(formatScenarioValue(value))}</td>
                                </tr>
                            `
                        )
                        .join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderScenarioFactsSummary(factsSummary = {}) {
    if (!factsSummary || Object.keys(factsSummary).length === 0) return '';

    const items = [
        ['Προδηλωμένο', factsSummary.declared_category],
        ['Ώρες καρτών', factsSummary.card_hours],
        ['Έχει κάρτες', factsSummary.has_cards],
        ['Αργία', factsSummary.is_holiday],
        ['Κλειδωμένη', factsSummary.is_locked]
    ];

    return `
        <div class="review-scenario-facts">
            ${items
                .map(
                    ([label, value]) => `
                        <span class="review-scenario-fact">
                            ${escapeHtml(label)}: ${escapeHtml(formatScenarioValue(value))}
                        </span>
                    `
                )
                .join('')}
        </div>
    `;
}

function renderScenarioDetailsSection(row) {
    const decision = row?.scenarioDecision;

    if (!decision) return '';

    const code = String(decision.scenario_code || '').trim();
    const label = scenarioCodeLabels[code] || code || '-';
    const confidence = scenarioConfidenceLabel(decision.confidence);
    const status = scenarioDecisionStatusLabel(decision.decision_status);
    const reviewText =
        decision.requires_review === true ? 'ΠΡΟΣ ΕΛΕΓΧΟ' : 'Δεν απαιτείται έλεγχος';
    const reasonsHtml = renderScenarioList(decision.reasons, scenarioReasonLabel);
    const warningsHtml = renderScenarioList(decision.warnings);
    const proposedUpdatesHtml = renderScenarioProposedUpdates(decision.proposed_updates);
    const factsSummaryHtml = renderScenarioFactsSummary(row.scenarioFactsSummary);

    return `
        <div class="review-modal-section" id="reviewScenarioDetails">
            <div class="review-modal-section-title">Ταξινόμηση Σεναρίου</div>

            <div class="review-scenario-summary">
                <span class="review-badge">${escapeHtml(label)}</span>
                ${code ? `<span class="review-badge">${escapeHtml(code)}</span>` : ''}
                ${confidence ? `<span class="review-badge">Βεβαιότητα: ${escapeHtml(confidence)}</span>` : ''}
                ${status ? `<span class="review-badge">Κατάσταση: ${escapeHtml(status)}</span>` : ''}
                <span class="review-badge">${escapeHtml(reviewText)}</span>
            </div>

            ${
                reasonsHtml
                    ? `
                        <div class="review-scenario-subsection">
                            <div class="fw-semibold mb-1">Λόγοι</div>
                            ${reasonsHtml}
                        </div>
                    `
                    : ''
            }

            ${
                warningsHtml
                    ? `
                        <div class="review-scenario-subsection">
                            <div class="fw-semibold mb-1">Προειδοποιήσεις</div>
                            ${warningsHtml}
                        </div>
                    `
                    : ''
            }

            ${proposedUpdatesHtml}
            ${factsSummaryHtml}
        </div>
    `;
}

function intervalTextHtml(apo, eos) {
    const a = String(apo || '').trim();
    const e = String(eos || '').trim();

    if (!a && !e) return '-';

    return `${escapeHtml(a || '')} - ${escapeHtml(e || '')}`;
}

function renderIntervalCell(row, apoPrefix, eosPrefix, suffix = '') {
    const lines = [1, 2, 3]
        .map((n) => {
            const p = pairNo(n);
            const apo = row[`${apoPrefix}_${p}${suffix}`];
            const eos = row[`${eosPrefix}_${p}${suffix}`];

            if (!hasMeaningfulValue(apo) && !hasMeaningfulValue(eos)) {
                return '';
            }

            return `<div class="review-interval-line">${intervalTextHtml(apo, eos)}</div>`;
        })
        .filter(Boolean);

    return lines.length > 0 ? lines.join('') : '-';
}

function tdClass(className) {
    return className ? ` class="${className}"` : '';
}

function isApologistikoIntervalPresent(row) {
    return (
        hasMeaningfulValue(row.apo_ora_01_apologistika) ||
        hasMeaningfulValue(row.eos_ora_01_apologistika) ||
        hasMeaningfulValue(row.apo_ora_02_apologistika) ||
        hasMeaningfulValue(row.eos_ora_02_apologistika) ||
        hasMeaningfulValue(row.apo_ora_03_apologistika) ||
        hasMeaningfulValue(row.eos_ora_03_apologistika)
    );
}

function yperoriaCellClass(row) {
    if (sumParanomiYperoria(row) > 0) return 'cell-paranomi-yperoria';
    if (sumNomimiYperoria(row) > 0) return 'cell-nomimi-yperoria';

    return '';
}

function timeToMinutes(value) {
    const v = String(value || '').trim();

    if (!/^\d{2}:\d{2}$/.test(v)) return null;

    const [hh, mm] = v.split(':').map(Number);

    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

    return hh * 60 + mm;
}

function dateKey(value) {
    if (!value) return '';

    const dt = new Date(value);

    if (isNaN(dt.getTime())) return '';

    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function addDaysKey(value, daysToAdd) {
    const dt = new Date(value);

    if (isNaN(dt.getTime())) return '';

    dt.setDate(dt.getDate() + daysToAdd);

    return dateKey(dt);
}

function isSundayDate(value) {
    const dt = new Date(value);

    if (isNaN(dt.getTime())) return false;

    return dt.getDay() === 0;
}

function isHolidayLikeRow(row) {
    return row.argia === true || row.kyriakes_apologistika === true || isSundayDate(row.hmeromhnia);
}

function buildHolidayLikeDateSet(rows) {
    const set = new Set();

    (rows || []).forEach((row) => {
        if (isHolidayLikeRow(row)) {
            const key = dateKey(row.hmeromhnia);

            if (key) set.add(key);
        }
    });

    return set;
}

function calculateHolidayDisplayHours(row, holidayLikeDateSet = new Set()) {
    const recordedHolidayHours =
        num(row.ores_argion_prosayxhsh_apologistika) + num(row.ores_argion_ergasia_apologistika);

    if (recordedHolidayHours > 0) {
        return recordedHolidayHours;
    }

    const rowDateKey = dateKey(row.hmeromhnia);
    const nextDateKey = addDaysKey(row.hmeromhnia, 1);

    const currentDayIsHoliday = isHolidayLikeRow(row) || holidayLikeDateSet.has(rowDateKey);
    const nextDayIsHoliday = holidayLikeDateSet.has(nextDateKey);

    const fullCardsHours = num(row.cards_ores_ergasias);

    let partialHolidayMinutes = 0;

    [1, 2, 3].forEach((n) => {
        const p = pairNo(n);
        const start = timeToMinutes(row[`cards_apo_ora_${p}`]);
        const end = timeToMinutes(row[`cards_eos_ora_${p}`]);

        if (start === null || end === null) return;

        const crossesMidnight = end <= start;

        if (currentDayIsHoliday) {
            if (!crossesMidnight) {
                partialHolidayMinutes += end - start;
                return;
            }

            if (nextDayIsHoliday) {
                // Η τρέχουσα μέρα είναι Κυριακή/αργία και η επόμενη είναι επίσης αργία:
                // όλο το διάστημα θεωρείται αργία.
                partialHolidayMinutes += 1440 - start + end;
                return;
            }

            // Η τρέχουσα μέρα είναι Κυριακή/αργία αλλά η επόμενη όχι:
            // μετράμε μόνο μέχρι 23:59/24:00.
            partialHolidayMinutes += 1440 - start;
            return;
        }

        if (crossesMidnight && nextDayIsHoliday) {
            // Η τρέχουσα μέρα δεν είναι αργία, αλλά μετά τα μεσάνυχτα μπαίνουμε
            // σε Κυριακή/αργία: μετράμε 00:00 έως ώρα αποχώρησης.
            partialHolidayMinutes += end;
        }
    });

    const calculatedHours = +(partialHolidayMinutes / 60).toFixed(2);

    if (calculatedHours > 0) {
        if (currentDayIsHoliday && nextDayIsHoliday && fullCardsHours > 0) {
            return fullCardsHours;
        }

        return calculatedHours;
    }

    if (currentDayIsHoliday && fullCardsHours > 0) {
        return fullCardsHours;
    }

    return 0;
}

function formatDate(value) {
    if (!value) return '';

    const dt = new Date(value);

    if (isNaN(dt.getTime())) return '';

    const days = ['Κυ', 'Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα'];
    const dayName = days[dt.getDay()];

    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();

    return `${dayName}   ${day}/${month}/${year}`;
}

function employeeGroupKey(row) {
    // return [row.ypokatasthma || '', row.kodikos || ''].join('|');
    return String(row.kodikos || '').trim();
}

function effectiveWorkHoursValue(row) {
    if (row.ores_ergasias_apologistika !== null && row.ores_ergasias_apologistika !== undefined) {
        return num(row.ores_ergasias_apologistika);
    }

    return num(row.cards_ores_ergasias);
}

// function breakSubtractedHoursValue(row) {
//     const diff = num(row.cards_ores_ergasias) - effectiveWorkHoursValue(row);

//     return diff > 0.004 ? +diff.toFixed(2) : 0;
// }

function breakSubtractedHoursValue(row) {
    return 0;
}

function renderHoursCell(row) {
    const effectiveHours = effectiveWorkHoursValue(row);
    const rawCardHours = num(row.cards_ores_ergasias);
    const breakHours = breakSubtractedHoursValue(row);

    if (breakHours <= 0) {
        return `<div class="fw-semibold">${hours(effectiveHours)}</div>`;
    }

    return `
        <div class="fw-semibold">${hours(effectiveHours)}</div>
        <small class="review-hours-note">
            Κάρτες ${hours(rawCardHours)} − διάλ. ${hours(breakHours)}
        </small>
    `;
}

function ensureReviewTableStructure() {
    const table = document.getElementById('resultsTable');

    if (!table) return;

    table.querySelectorAll('thead tr').forEach((tr) => {
        const headers = Array.from(tr.children);

        if (headers.some((th) => th.dataset.autoColumn === 'apoysies')) return;

        const hoursHeader = headers.find((th) => th.textContent.trim() === 'Ώρες');

        if (!hoursHeader) return;

        const th = document.createElement('th');
        th.dataset.autoColumn = 'apoysies';
        th.textContent = 'Απουσίες';

        hoursHeader.after(th);
    });

    if (!document.getElementById('reviewDynamicCellStyles')) {
        const style = document.createElement('style');
        style.id = 'reviewDynamicCellStyles';
        style.textContent = `
            .cell-apoysia {
                background-color: #dc3545 !important;
                color: #ffffff !important;
                font-weight: 700;
            }

            .cell-break-subtracted {
                background-color: #edf6ff !important;
                color: #12344d !important;
            }

            .cell-repo-day {
                background-color: #fff3cd !important;
                color: #856404 !important;
                font-weight: 700;
                text-align: center;
            }

            .cell-declared-repo-day {
                background-color: #f1f3f5 !important;
                color: #495057 !important;
                font-weight: 700;
                text-align: center;
            }

            .cell-non-work-day {
                background-color: #e9ecef !important;
                color: #495057 !important;
                font-weight: 700;
                text-align: center;
            }

            .cell-no-card-adeia {
                background-color: #fff9c4 !important;
                color: #000000 !important;
                font-weight: 700;
                text-align: center;
            }

            .cell-no-card-argia {
                background-color: #ffd8a8 !important;
                color: #000000 !important;
                font-weight: 700;
                text-align: center;
            }

            .cell-adeia-suggestion {
                background-color: #fdebd0 !important;
                color: #7f3300 !important;
                font-weight: 700;
            }

            .review-warning-badge {
                display: inline-block;
                padding: 0.25rem 0.5rem;
                border-radius: 999px;
                background-color: #fff3cd;
                color: #856404;
                font-weight: 700;
                border: 1px solid #ffe69c;
                margin-left: 0.5rem;
                white-space: nowrap;
            }

            .review-adeia-badge {
                display: inline-block;
                padding: 0.25rem 0.55rem;
                border-radius: 999px;
                background-color: #fdebd0;
                color: #7f3300;
                border: 1px solid #f7c98b;
                font-weight: 700;
                margin-left: 0.4rem;
                white-space: nowrap;
            }

            .review-scenario-badge-row {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: center;
                gap: 0.25rem;
                margin-top: 0.25rem;
            }

            .review-scenario-badge {
                display: inline-block;
                padding: 0.12rem 0.4rem;
                border-radius: 999px;
                font-size: 0.72rem;
                font-weight: 700;
                line-height: 1.25;
                white-space: nowrap;
            }

            .review-scenario-badge-review {
                background-color: #fff3cd;
                border: 1px solid #ffe69c;
                color: #856404;
            }

            .review-scenario-badge-classified {
                background-color: #e7f1ff;
                border: 1px solid #b6d4fe;
                color: #084298;
            }

            .review-scenario-confidence {
                display: inline-block;
                padding: 0.08rem 0.35rem;
                border-radius: 999px;
                border: 1px solid #ced4da;
                color: #495057;
                background-color: #f8f9fa;
                font-size: 0.68rem;
                font-weight: 600;
                line-height: 1.25;
                white-space: nowrap;
            }

            .review-scenario-summary,
            .review-scenario-facts {
                display: flex;
                flex-wrap: wrap;
                gap: 0.35rem;
                align-items: center;
            }

            .review-scenario-subsection {
                margin-top: 0.75rem;
            }

            .review-scenario-list {
                padding-left: 1.25rem;
            }

            .review-scenario-fact {
                display: inline-block;
                padding: 0.18rem 0.45rem;
                border-radius: 0.25rem;
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
                font-size: 0.8rem;
            }

            .review-hours-note {
                display: block;
                margin-top: 2px;
                font-size: 0.72rem;
                line-height: 1.1;
                color: inherit;
                white-space: nowrap;
            }

            .review-interval-line {
                line-height: 1.2;
                white-space: nowrap;
            }

            .review-interval-line + .review-interval-line {
                margin-top: 2px;
            }
        `;
        document.head.appendChild(style);
    }
}

function createEmptyTotals() {
    return {
        ores_ergasias_apologistika: 0,
        ores_apoysias_apologistika: 0,
        ores_nyxtas_apologistika: 0,
        ores_argion_prosayxhsh_apologistika: 0,
        ores_argion_ergasia_apologistika: 0,
        ores_prostheths_ergasias_apologistika: 0,
        yperergasia: 0,
        nomimiYperoria: 0,
        paranomiYperoria: 0
    };
}

function sumYperergasia(row) {
    return (
        num(row.ores_yperergasias_apologistika) +
        num(row.ores_yperergasias_nyxtas_apologistika) +
        num(row.ores_yperergasias_argion_apologistika) +
        num(row.ores_yperergasias_argion_nyxtas_apologistika)
    );
}

function sumNomimiYperoria(row) {
    return (
        num(row.ores_nominhs_yperorias_apologistika) +
        num(row.ores_nominhs_yperorias_nyxtas_apologistika) +
        num(row.ores_nominhs_yperorias_argion_apologistika) +
        num(row.ores_nominhs_yperorias_argion_nyxtas_apologistika)
    );
}

function sumParanomiYperoria(row) {
    return (
        num(row.ores_paranomhs_yperorias_apologistika) +
        num(row.ores_paranomhs_yperorias_nyxtas_apologistika) +
        num(row.ores_paranomhs_yperorias_argion_apologistika) +
        num(row.ores_paranomhs_yperorias_argion_nyxtas_apologistika)
    );
}

function addRowToTotals(totals, row) {
    totals.ores_ergasias_apologistika += effectiveWorkHoursValue(row);
    totals.ores_apoysias_apologistika += num(row.ores_apoysias_apologistika);
    totals.ores_nyxtas_apologistika += num(row.ores_nyxtas_apologistika);
    totals.ores_argion_prosayxhsh_apologistika += num(row.ores_argion_prosayxhsh_apologistika);
    totals.ores_argion_ergasia_apologistika += num(row.ores_argion_ergasia_apologistika);
    totals.ores_prostheths_ergasias_apologistika += num(row.ores_prostheths_ergasias_apologistika);
    totals.yperergasia += sumYperergasia(row);
    totals.nomimiYperoria += sumNomimiYperoria(row);
    totals.paranomiYperoria += sumParanomiYperoria(row);
}

function appendEmployeeTotalsRow(tbody, totals, groupId) {
    const tr = document.createElement('tr');
    tr.classList.add('employee-subtotal-row');
    tr.classList.add('d-none');
    tr.dataset.groupId = groupId;

    tr.innerHTML = `
        <td colspan="6" class="fw-bold text-end">
            Σύνολα εργαζομένου
        </td>
        <td class="fw-bold">${hours(totals.ores_ergasias_apologistika)}</td>
        <td class="fw-bold ${hasPositiveNumber(totals.ores_apoysias_apologistika) ? 'cell-apoysia cell-apoysia-total' : 'cell-apoysia-total'}">
            ${hours(totals.ores_apoysias_apologistika)}
        </td>        
        <td class="fw-bold">${hours(totals.ores_nyxtas_apologistika)}</td>
        <td class="fw-bold">${hours(totals.ores_argion_prosayxhsh_apologistika + totals.ores_argion_ergasia_apologistika)}</td>
        <td class="fw-bold">${hours(totals.ores_prostheths_ergasias_apologistika)}</td>
        <td class="fw-bold">${hours(totals.yperergasia)}</td>
        <td class="fw-bold">${hours(totals.nomimiYperoria + totals.paranomiYperoria)}</td>
    `;

    tbody.appendChild(tr);
}

function buildDeviationsByKodikos(deviations = []) {
    const map = new Map();

    deviations.forEach((dev) => {
        const kodikos = String(dev.kodikos || '').trim();
        if (!kodikos) return;
        if (!map.has(kodikos)) map.set(kodikos, []);
        map.get(kodikos).push(dev);
    });

    return map;
}

function employmentTypeLabel(value) {
    const v = String(value ?? '').trim();

    switch (v) {
        case '0':
            return 'Πλήρης';
        case '1':
            return 'Μερική';
        case '2':
            return 'Εκ Περιτροπής';
        default:
            return v || '-';
    }
}

function renderDeviationProfileCell(dev) {
    const effectiveRepo = dev.effective_mhniaia_repo ?? dev.mhniaia_repo ?? dev.expected_repo ?? '';
    const effectiveType = employmentTypeLabel(dev.effective_typos_apasxolhshs);
    const effectiveDate = dev.effective_profile_date ? formatDate(dev.effective_profile_date) : '';
    const hasReadableEmploymentType =
        effectiveType && effectiveType !== '-' && !/^\d+$/.test(String(effectiveType));

    if (!dev.profile_changed_inside_week) {
        return `
            ${hasReadableEmploymentType ? `<div>${escapeHtml(effectiveType)}</div>` : ''}
            <small class="text-muted">Αναμενόμενα ρεπό profile: ${escapeHtml(effectiveRepo)}</small>
        `;
    }

    return `
        <div class="fw-bold text-warning-emphasis">Τελικό προφίλ εβδομάδας</div>
        ${hasReadableEmploymentType ? `<div>${escapeHtml(effectiveType)}</div>` : ''}
        <div>${escapeHtml(effectiveRepo)} ${Number(effectiveRepo) === 1 ? 'ρεπό' : 'ρεπό'}</div>
        ${
            effectiveDate
                ? `<small class="text-muted">Ισχύει από: ${escapeHtml(effectiveDate)}</small>`
                : ''
        }
    `;
}

function renderDeviationNoteCell(dev) {
    if (dev.profile_changed_inside_week) {
        const excessRepo =
            Number(dev.actual_repo ?? dev.pragmatikaRepo ?? 0) -
            Number(dev.expected_repo ?? dev.mhniaia_repo ?? 0);
        const excessText =
            excessRepo > 0
                ? `<div>Πλεονάζοντα ρεπό: <strong>${escapeHtml(excessRepo)}</strong></div>`
                : '';

        return `
            <div class="fw-bold text-warning-emphasis">
                ⚠ Αλλαγή όρων εργασίας μέσα στην εβδομάδα
            </div>
            <small class="text-muted">
                Υπερισχύουν οι όροι εργασίας που ίσχυαν το Σάββατο της εβδομάδας.
            </small>
            ${excessText}
            ${dev.note ? `<div class="small mt-1">${escapeHtml(dev.note)}</div>` : ''}
        `;
    }

    return dev.note ? escapeHtml(dev.note) : '-';
}

function hasProfileChangeDeviation(deviations = []) {
    return (
        Array.isArray(deviations) &&
        deviations.some((dev) => dev.profile_changed_inside_week === true)
    );
}

function hasAdeiaSuggestion(row) {
    return hasMeaningfulValue(row?.kathgoria_adeias_apologistika);
}

function hasAdeiaSuggestionInRows(rows = []) {
    return Array.isArray(rows) && rows.some((row) => hasAdeiaSuggestion(row));
}

function appendEmployeeDeviationRows(tbody, deviations, groupId) {
    if (!Array.isArray(deviations) || deviations.length === 0) return;

    const wrapperTr = document.createElement('tr');
    wrapperTr.classList.add('employee-deviation-row');
    wrapperTr.classList.add('d-none');
    wrapperTr.dataset.groupId = groupId;

    const rowsHtml = deviations
        .map(
            (dev) => `
                <tr class="${dev.profile_changed_inside_week ? 'table-warning' : ''}">
                    <td>${formatDate(dev.week_apo || dev.weekStart)}</td>
                    <td>${formatDate(dev.week_eos || dev.weekEnd)}</td>
                    <td class="text-end">${escapeHtml(dev.expected_repo ?? dev.mhniaia_repo ?? '')}</td>
                    <td class="text-end fw-bold">${escapeHtml(dev.actual_repo ?? dev.pragmatikaRepo ?? '')}</td>
                    <td>${renderDeviationProfileCell(dev)}</td>
                    <td>${renderDeviationNoteCell(dev)}</td>
                </tr>
            `
        )
        .join('');

    wrapperTr.innerHTML = `
        <td colspan="13" class="p-2 bg-warning-subtle">
            <div class="fw-bold mb-1">Αποκλίσεις εβδομαδιαίων ρεπό</div>
            <div class="table-responsive">
                <table class="table table-sm table-bordered mb-0 bg-white">
                    <thead class="table-light">
                        <tr>
                            <th>Από</th>
                            <th>Έως</th>
                            <th class="text-end">Αναμενόμενα ρεπό</th>
                            <th class="text-end">Πραγματικά ρεπό</th>
                            <th>Profile</th>
                            <th>Σχόλιο</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </td>
    `;

    tbody.appendChild(wrapperTr);
}

function appendGrandTotalsRow(tbody, totals) {
    const tr = document.createElement('tr');
    tr.classList.add('grand-total-row');

    tr.innerHTML = `
        <td colspan="6" class="fw-bold text-end">
            Γενικά σύνολα φίλτρου
        </td>
        <td class="fw-bold">${hours(totals.ores_ergasias_apologistika)}</td>
        <td class="fw-bold ${hasPositiveNumber(totals.ores_apoysias_apologistika) ? 'cell-apoysia' : ''}">${hours(totals.ores_apoysias_apologistika)}</td>
        <td class="fw-bold">${hours(totals.ores_nyxtas_apologistika)}</td>
        <td class="fw-bold">${hours(totals.ores_argion_prosayxhsh_apologistika + totals.ores_argion_ergasia_apologistika)}</td>
        <td class="fw-bold">${hours(totals.ores_prostheths_ergasias_apologistika)}</td>
        <td class="fw-bold">${hours(totals.yperergasia)}</td>
        <td class="fw-bold">${hours(totals.nomimiYperoria + totals.paranomiYperoria)}</td>
    `;

    tbody.appendChild(tr);
}

function buildScenarioReviewParams(baseParams, page) {
    const params = new URLSearchParams({
        apo_hmeromhnia: baseParams.get('apo_hmeromhnia') || '',
        eos_hmeromhnia: baseParams.get('eos_hmeromhnia') || '',
        ypokatasthma: baseParams.get('ypokatasthma') || '',
        kodikos: baseParams.get('kodikos') || '',
        page: String(page),
        limit: '200'
    });

    return params;
}

async function fetchScenarioClassifications(baseParams) {
    const scenarioRows = [];
    const maxPages = 50;
    let totalPages = 1;

    for (let page = 1; page <= totalPages && page <= maxPages; page += 1) {
        const params = buildScenarioReviewParams(baseParams, page);
        const response = await fetch(`/api/prodhlomena-oraria/review/scenarios?${params.toString()}`, {
            method: 'GET',
            headers: {
                'CSRF-Token': csrfToken
            }
        });

        const payload = await response.json();

        if (!payload.success) {
            throw new Error(payload.message || 'Αποτυχία ανάκτησης scenario classifications.');
        }

        scenarioRows.push(...(payload.rows || []));

        const payloadTotalPages = Number(payload.totalPages || 0);
        const payloadTotal = Number(payload.total || 0);
        const payloadLimit = Number(payload.limit || 200);

        totalPages =
            payloadTotalPages > 0
                ? payloadTotalPages
                : payloadTotal > 0
                  ? Math.ceil(payloadTotal / payloadLimit)
                  : page;

        if ((payload.rows || []).length === 0) break;
    }

    return scenarioRows;
}

function buildScenarioClassificationsMap(scenarioRows = []) {
    const scenarioByProdhlomenaId = new Map();

    scenarioRows.forEach((scenarioRow) => {
        const key = rowIdentityKey(scenarioRow.prodhlomena_oraria_id);

        if (!key) return;

        scenarioByProdhlomenaId.set(key, scenarioRow);
    });

    return scenarioByProdhlomenaId;
}

function attachScenarioClassifications(rows = [], scenarioByProdhlomenaId = new Map()) {
    rows.forEach((row) => {
        const scenarioRow = scenarioByProdhlomenaId.get(rowIdentityKey(row._id));

        if (!scenarioRow) return;

        row.scenarioDecision = scenarioRow.decision || null;
        row.scenarioFactsSummary = scenarioRow.facts_summary || null;
    });
}

async function loadResults() {
    try {
        const params = new URLSearchParams({
            apo_hmeromhnia: document.getElementById('apo_hmeromhnia')?.value || '',
            eos_hmeromhnia: document.getElementById('eos_hmeromhnia')?.value || '',
            ypokatasthma: document.getElementById('ypokatasthma')?.value || '',
            kodikos: document.getElementById('kodikos')?.value || '',
            only_apologistiko: document.getElementById('only_apologistiko')?.checked || false,
            only_nyxta: document.getElementById('only_nyxta')?.checked || false,
            only_argia: document.getElementById('only_argia')?.checked || false,
            only_yperergasia: document.getElementById('only_yperergasia')?.checked || false,
            page: 1,
            limit: 5000
        });

        const response = await fetch(`/api/prodhlomena-oraria/review?${params.toString()}`, {
            method: 'GET',
            headers: {
                'CSRF-Token': csrfToken
            }
        });

        const payload = await response.json();

        if (!payload.success) {
            Swal.fire({
                icon: 'warning',
                title: 'Σφάλμα',
                text: payload.message || 'Αποτυχία ανάκτησης δεδομένων.'
            });
            return;
        }

        ensureReviewTableStructure();

        const rows = payload.rows || [];
        try {
            const scenarioRows = await fetchScenarioClassifications(params);
            const scenarioByProdhlomenaId = buildScenarioClassificationsMap(scenarioRows);
            attachScenarioClassifications(rows, scenarioByProdhlomenaId);
        } catch (scenarioError) {
            console.warn('[loadResults] Scenario classifications unavailable:', scenarioError);
        }

        const deviationsByKodikos = buildDeviationsByKodikos(payload.deviations || []);
        const rowsByKodikos = new Map();
        rows.forEach((row) => {
            const key = employeeGroupKey(row);
            if (!rowsByKodikos.has(key)) rowsByKodikos.set(key, []);
            rowsByKodikos.get(key).push(row);
        });
        const holidayLikeDateSet = buildHolidayLikeDateSet(rows);

        const tbody = document.querySelector('#resultsTable tbody');
        tbody.innerHTML = '';

        let currentGroup = '';
        let currentGroupId = '';
        let employeeTotals = createEmptyTotals();
        let grandTotals = createEmptyTotals();
        let currentGroupRows = [];

        for (const row of rows) {
            const groupKey = employeeGroupKey(row);

            if (groupKey !== currentGroup) {
                if (currentGroup !== '') {
                    appendEmployeeTotalsRow(tbody, employeeTotals, currentGroupId);
                    appendEmployeeDeviationRows(
                        tbody,
                        deviationsByKodikos.get(currentGroup) || [],
                        currentGroupId
                    );
                    employeeTotals = createEmptyTotals();
                    currentGroupRows = [];
                }

                currentGroup = groupKey;

                const groupId = `group-${String(groupKey).replace(/[^a-zA-Z0-9]/g, '-')}`;
                currentGroupId = groupId;

                const groupTr = document.createElement('tr');
                groupTr.classList.add('table-secondary', 'employee-group-row', 'collapsed');
                groupTr.dataset.groupId = groupId;
                groupTr.style.cursor = 'pointer';

                const groupDeviations = deviationsByKodikos.get(groupKey) || [];
                const groupHasProfileChange = hasProfileChangeDeviation(groupDeviations);
                const groupHasAdeiaSuggestion = hasAdeiaSuggestionInRows(
                    rowsByKodikos.get(groupKey) || []
                );

                groupTr.innerHTML = `
                    <td colspan="13" class="fw-bold">
                        ${row.ypokatasthma || ''}
                        |
                        ${row.kodikos || ''}
                        |
                        ${row.eponymo || ''}
                        ${row.onoma || ''}
                        ${groupHasProfileChange ? '<span class="review-warning-badge">⚠ Αλλαγή όρων</span>' : ''}
                        ${groupHasAdeiaSuggestion ? '<span class="review-adeia-badge">⚠ Έλεγχος άδειας</span>' : ''}
                    </td>
                `;

                groupTr.addEventListener('click', () => {
                    groupTr.classList.toggle('collapsed');

                    const rows = document.querySelectorAll(
                        `tr.employee-detail-row[data-group-id="${groupId}"],
                         tr.employee-subtotal-row[data-group-id="${groupId}"],
                         tr.employee-deviation-row[data-group-id="${groupId}"]`
                    );

                    rows.forEach((r) => {
                        r.classList.toggle('d-none');
                    });
                });

                tbody.appendChild(groupTr);
            }

            const tr = document.createElement('tr');
            tr.classList.add('employee-detail-row');
            tr.classList.add('d-none');
            tr.dataset.groupId = currentGroupId;

            if (row.is_locked) {
                tr.classList.add('row-locked');
            }

            // Cell-level coloring is applied below in the <td> elements.

            tr.style.cursor = 'pointer';

            const apologistikoText = renderIntervalCell(row, 'apo_ora', 'eos_ora', '_apologistika');

            const effectiveKathgoria =
                row.kathgoria_ergasias_apologistika &&
                String(row.kathgoria_ergasias_apologistika).trim() !== ''
                    ? String(row.kathgoria_ergasias_apologistika).trim()
                    : String(row.kathgoria_ergasias || '').trim();

            const effectiveTyposApasxolhshs = String(
                row.effective_typos_apasxolhshs ?? row.typos_apasxolhshs ?? ''
            ).trim();
            const reviewPhaseCode = String(
                row.review_phase_code ?? row.review_kathestos_code ?? ''
            ).trim();

            const isFullTimeProfile = reviewPhaseCode
                ? reviewPhaseCode === '0'
                : row.effective_is_full_time === true ||
                  row.effective_is_full_time === 'true' ||
                  row.effective_is_full_time === 1 ||
                  row.effective_is_full_time === '1' ||
                  effectiveTyposApasxolhshs === '0';

            const isApologistikoRepoRow =
                row.apologistiko_biblio === true &&
                effectiveKathgoria === 'ΑΝ' &&
                num(row.cards_ores_ergasias) === 0 &&
                isFullTimeProfile;

            const isApologistikoNonWorkRow =
                row.apologistiko_biblio === true &&
                (effectiveKathgoria === 'ΜΕ' ||
                    (effectiveKathgoria === 'ΑΝ' && !isFullTimeProfile)) &&
                num(row.cards_ores_ergasias) === 0;

            const noCardsDisplayStatus = String(
                row.noCardsDisplayStatus || row.no_cards_display_status || ''
            ).trim();
            const hasNoCardsDisplayStatus =
                noCardsDisplayStatus === 'ΑΔΕΙΑ' || noCardsDisplayStatus === 'ΑΡΓΙΑ';

            const apologistikoDisplayText = hasNoCardsDisplayStatus
                ? noCardsDisplayStatus
                : isApologistikoRepoRow
                ? 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ'
                : isApologistikoNonWorkRow
                  ? 'ΜΗ ΕΡΓΑΣΙΑ'
                  : apologistikoText;

            const apologistikoDisplayClass = hasNoCardsDisplayStatus
                ? noCardsDisplayStatus === 'ΑΔΕΙΑ'
                    ? 'cell-no-card-adeia'
                    : 'cell-no-card-argia'
                : isApologistikoRepoRow
                ? 'cell-repo-day'
                : isApologistikoNonWorkRow
                  ? 'cell-non-work-day'
                  : isApologistikoIntervalPresent(row)
                    ? 'cell-apologistiko'
                    : hasAdeiaSuggestion(row)
                      ? 'cell-adeia-suggestion'
                      : '';

            const isDeclaredRestOrNonWork =
                row.apologistiko_biblio !== true &&
                num(row.ores_ergasias) === 0 &&
                num(row.cards_ores_ergasias) === 0;

            const declaredText = isDeclaredRestOrNonWork
                ? isFullTimeProfile
                    ? 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ'
                    : 'ΜΗ ΕΡΓΑΣΙΑ'
                : renderIntervalCell(row, 'apo_ora', 'eos_ora');

            const declaredClass = isDeclaredRestOrNonWork
                ? isFullTimeProfile
                    ? 'cell-declared-repo-day'
                    : 'cell-non-work-day'
                : '';

            const argiaHoursValue = hours(calculateHolidayDisplayHours(row, holidayLikeDateSet));

            const yperoriaTotal = sumNomimiYperoria(row) + sumParanomiYperoria(row);

            tr.innerHTML = `
                <td>${formatDate(row.hmeromhnia)}</td>
                <td>${row.ypokatasthma || ''}</td>
                <td>${row.kodikos || ''}</td>
                <td${tdClass(declaredClass)}>${declaredText}</td>
                <td>${renderIntervalCell(row, 'cards_apo_ora', 'cards_eos_ora')}</td>
                <td${tdClass(apologistikoDisplayClass)}>
                    ${apologistikoDisplayText}
                    ${renderScenarioBadge(row)}
                </td>
                <td${tdClass(breakSubtractedHoursValue(row) > 0 ? 'cell-break-subtracted' : '')}>
                    ${renderHoursCell(row)}
                </td>
                <td${tdClass(hasPositiveNumber(row.ores_apoysias_apologistika) ? 'cell-apoysia' : '')}>
                    ${hours(row.ores_apoysias_apologistika)}
                </td>
                <td${tdClass(hasPositiveNumber(row.ores_nyxtas_apologistika) ? 'cell-nyxta' : '')}>
                    ${hours(row.ores_nyxtas_apologistika)}
                </td>
                <td${tdClass(hasPositiveNumber(argiaHoursValue) ? 'cell-argia' : '')}>
                    ${argiaHoursValue}
                </td>
                <td${tdClass(hasPositiveNumber(row.ores_prostheths_ergasias_apologistika) ? 'cell-prostheti' : '')}>
                    ${hours(row.ores_prostheths_ergasias_apologistika)}
                </td>
                <td${tdClass(sumYperergasia(row) > 0 ? 'cell-yperergasia' : '')}>
                    ${hours(sumYperergasia(row))}
                </td>
                <td${tdClass(yperoriaCellClass(row))}>
                    ${hours(yperoriaTotal)}
                </td>
            `;

            tr.addEventListener('click', () => {
                showDetailsModal(row);
            });

            addRowToTotals(employeeTotals, row);
            addRowToTotals(grandTotals, row);
            currentGroupRows.push(row);

            tbody.appendChild(tr);
        }

        if (currentGroup !== '') {
            appendEmployeeTotalsRow(tbody, employeeTotals, currentGroupId);
            appendEmployeeDeviationRows(
                tbody,
                deviationsByKodikos.get(currentGroup) || [],
                currentGroupId
            );
            appendGrandTotalsRow(tbody, grandTotals);
        }
    } catch (error) {
        console.error(error);

        Swal.fire({
            icon: 'error',
            title: 'Σφάλμα',
            text: error.message
        });
    }
}

function pairNo(n) {
    return String(n).padStart(2, '0');
}

function renderReadOnlyTimeRows(row, apoPrefix, eosPrefix) {
    return [1, 2, 3]
        .map((n) => {
            const p = pairNo(n);
            const apo = row[`${apoPrefix}_${p}`] || '';
            const eos = row[`${eosPrefix}_${p}`] || '';

            return `
                <div class="review-time-row">
                    <div class="review-time-label">${n}</div>
                    <div>${apo || '-'}</div>
                    <div>${eos || '-'}</div>
                </div>
            `;
        })
        .join('');
}

function renderEditableApologistikaRows(row) {
    return [1, 2, 3]
        .map((n) => {
            const p = pairNo(n);

            return `
                <div class="review-time-row">
                    <div class="review-time-label">${n}</div>

                    <input type="time"
                           class="form-control form-control-sm modal-edit-field modal-time-input"
                           id="edit_apo_ora_${p}_apologistika"
                           value="${row[`apo_ora_${p}_apologistika`] || ''}">

                    <input type="time"
                           class="form-control form-control-sm modal-edit-field modal-time-input"
                           id="edit_eos_ora_${p}_apologistika"
                           value="${row[`eos_ora_${p}_apologistika`] || ''}">
                </div>
            `;
        })
        .join('');
}

function renderApologistikaFields(row) {
    const numberFields = [
        ['Ώρες εργασίας', 'ores_ergasias_apologistika'],
        ['Ώρες απουσίας', 'ores_apoysias_apologistika'],
        ['Ώρες νύχτας', 'ores_nyxtas_apologistika'],
        ['Προσαύξηση αργιών', 'ores_argion_prosayxhsh_apologistika'],
        ['Εργασία αργιών', 'ores_argion_ergasia_apologistika'],
        ['Πρόσθετη εργασία', 'ores_prostheths_ergasias_apologistika'],

        ['Υπερεργασία', 'ores_yperergasias_apologistika'],
        ['Υπερεργασία νύχτας', 'ores_yperergasias_nyxtas_apologistika'],
        ['Υπερεργασία αργίας', 'ores_yperergasias_argion_apologistika'],
        ['Υπερεργασία αργίας + νύχτας', 'ores_yperergasias_argion_nyxtas_apologistika'],

        ['Νόμιμη υπερωρία', 'ores_nominhs_yperorias_apologistika'],
        ['Νόμιμη υπερωρία νύχτας', 'ores_nominhs_yperorias_nyxtas_apologistika'],
        ['Νόμιμη υπερωρία αργίας', 'ores_nominhs_yperorias_argion_apologistika'],
        ['Νόμιμη υπερωρία αργίας + νύχτας', 'ores_nominhs_yperorias_argion_nyxtas_apologistika'],

        ['Παράνομη υπερωρία', 'ores_paranomhs_yperorias_apologistika'],
        ['Παράνομη υπερωρία νύχτας', 'ores_paranomhs_yperorias_nyxtas_apologistika'],
        ['Παράνομη υπερωρία αργίας', 'ores_paranomhs_yperorias_argion_apologistika'],
        ['Παράνομη υπερωρία αργίας + νύχτας', 'ores_paranomhs_yperorias_argion_nyxtas_apologistika']
    ];

    const checkboxFields = [
        ['Ρεπό', 'repo_apologistika'],
        ['Άδεια', 'adeia_apologistika'],
        ['Ασθένεια', 'astheneia_apologistika'],
        ['Κυριακή', 'kyriakes_apologistika']
    ];

    return `
        <div class="row g-2">
            ${numberFields
                .map(
                    ([label, field]) => `
                        <div class="col-md-3">
                            <label class="form-label review-total-label">
                                ${label}
                            </label>

                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                class="form-control form-control-sm modal-edit-field modal-number-input apologistika-number-field"
                                id="edit_${field}"
                                data-field="${field}"
                                value="${hours(row[field])}"
                            />
                        </div>
                    `
                )
                .join('')}
        </div>

        <hr>

        <div class="row g-2 align-items-center">
            ${checkboxFields
                .map(
                    ([label, field]) => `
                        <div class="col-md-3 d-flex align-items-center gap-2">
                            <label for="edit_${field}" class="form-label mb-0">
                                ${label}
                            </label>

                            <input
                                type="checkbox"
                                class="form-check-input custom-checkbox checkbox-class apologistika-checkbox-field"
                                id="edit_${field}"
                                data-field="${field}"
                                ${row[field] ? 'checked' : ''}
                            />
                        </div>
                    `
                )
                .join('')}

                <div class="col-md-12">
                    <label class="form-label review-total-label">
                        Κατηγορία άδειας απολογιστικά
                    </label>

                    <input
                        type="hidden"
                        name="edit_kathgoria_adeias_apologistika_hidden"
                        id="edit_kathgoria_adeias_apologistika_hidden"
                        value="${row.kathgoria_adeias_apologistika || ''}"
                    />

                    <select
                        class="tom-dropdown selectpicker-dropdown-normal left-align w-100 modal-edit-field"
                        name="edit_kathgoria_adeias_apologistika"
                        id="edit_kathgoria_adeias_apologistika"
                        data-field="kathgoria_adeias_apologistika"
                        data-api="/api/dropdown/ergazomenoi/kathgoria_adeias"
                        data-target-input="edit_kathgoria_adeias_apologistika_hidden"
                        data-preselect="edit_kathgoria_adeias_apologistika_hidden"
                        data-preload-all="true"
                        data-pad-length="6">
                    </select>
                </div>
        </div>
    `;
}

async function loadAuditHistory(recordId) {
    const container = document.getElementById('auditHistoryContainer');

    if (!container) return;

    container.innerHTML = '<div class="text-muted">Φόρτωση...</div>';

    try {
        const response = await fetch(`/api/prodhlomena-oraria/review/${recordId}/audit`, {
            method: 'GET',
            headers: {
                'CSRF-Token': csrfToken
            }
        });

        const payload = await response.json();

        if (!payload.success) {
            container.innerHTML = `
                <div class="text-danger">
                    ${payload.message || 'Αποτυχία φόρτωσης ιστορικού.'}
                </div>
            `;
            return;
        }

        if (!payload.rows || payload.rows.length === 0) {
            container.innerHTML = `
                <div class="text-muted">
                    Δεν υπάρχει ιστορικό αλλαγών.
                </div>
            `;
            return;
        }

        container.innerHTML = payload.rows.map((audit) => renderAuditRow(audit)).join('');

        container.querySelectorAll('.restore-audit-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const auditId = btn.dataset.auditId;
                restoreFromAudit(recordId, auditId);
            });
        });
    } catch (error) {
        console.error(error);

        container.innerHTML = `
            <div class="text-danger">
                ${error.message}
            </div>
        `;
    }
}

function renderAuditRow(audit) {
    const changedAt = audit.changedAt ? new Date(audit.changedAt).toLocaleString('el-GR') : '';

    return `
        <div class="audit-row">
            <div class="audit-row-header">
                <strong>${changedAt}</strong>
                <span>${audit.changedBy || ''}</span>
            </div>

            <div class="audit-reason">
                ${audit.reason || '-'}
            </div>

            <div class="audit-values">
                ${renderAuditValues(audit.oldValues, audit.newValues)}
            </div>

            ${
                userCanReviewEdit()
                    ? `
                        <button
                            type="button"
                            class="btn btn-sm btn-warning mt-2 restore-audit-btn"
                            data-audit-id="${audit._id}">
                            <i class="bi bi-arrow-counterclockwise"></i>
                            Επαναφορά
                        </button>
                    `
                    : ''
            }
        </div>
    `;
}

const auditFieldLabels = {
    apo_ora_01_apologistika: 'Απολογιστικό Από 1',
    eos_ora_01_apologistika: 'Απολογιστικό Έως 1',
    apo_ora_02_apologistika: 'Απολογιστικό Από 2',
    eos_ora_02_apologistika: 'Απολογιστικό Έως 2',
    apo_ora_03_apologistika: 'Απολογιστικό Από 3',
    eos_ora_03_apologistika: 'Απολογιστικό Έως 3',

    ores_ergasias_apologistika: 'Ώρες εργασίας',
    ores_apoysias_apologistika: 'Ώρες απουσίας',
    ores_nyxtas_apologistika: 'Ώρες νύχτας',
    ores_argion_prosayxhsh_apologistika: 'Προσαύξηση αργιών',
    ores_argion_ergasia_apologistika: 'Εργασία αργιών',

    repo_apologistika: 'Ρεπό',
    adeia_apologistika: 'Άδεια',
    kathgoria_adeias_apologistika: 'Κατηγορία άδειας',
    astheneia_apologistika: 'Ασθένεια',
    kyriakes_apologistika: 'Κυριακή',

    is_locked: 'Κλειδωμένη εγγραφή',
    locked_by: 'Κλείδωμα από',
    locked_at: 'Κλείδωμα στις',
    unlocked_by: 'Ξεκλείδωμα από'
};

function auditLabel(field) {
    return auditFieldLabels[field] || field;
}

function renderAuditValues(oldValues = {}, newValues = {}) {
    const fields = Object.keys(newValues || {});

    if (fields.length === 0) {
        return '<div class="text-muted">Δεν υπάρχουν επιμέρους αλλαγές.</div>';
    }

    return `
        <table class="table table-sm table-bordered mb-0">
            <thead>
                <tr>
                    <th>Πεδίο</th>
                    <th>Πριν</th>
                    <th>Μετά</th>
                </tr>
            </thead>
            <tbody>
                ${fields
                    .map(
                        (field) => `
                            <tr>
                                <td>${auditLabel(field)}</td>
                                <td>${oldValues?.[field] ?? ''}</td>
                                <td>${newValues?.[field] ?? ''}</td>
                            </tr>
                        `
                    )
                    .join('')}
            </tbody>
        </table>
    `;
}

async function restoreFromAudit(recordId, auditId) {
    try {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Επαναφορά εγγραφής',
            text: 'Θέλετε σίγουρα να επαναφέρετε τις προηγούμενες τιμές;',
            showCancelButton: true,
            confirmButtonText: 'Ναι, επαναφορά',
            cancelButtonText: 'Ακύρωση',
            reverseButtons: true
        });

        if (!result.isConfirmed) {
            return;
        }

        const response = await fetch(
            `/api/prodhlomena-oraria/review/${recordId}/restore/${auditId}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                }
            }
        );

        const payload = await response.json();

        if (!payload.success) {
            Swal.fire({
                icon: 'error',
                title: 'Σφάλμα',
                text: payload.message || 'Αποτυχία επαναφοράς.'
            });

            return;
        }

        Swal.fire({
            icon: 'success',
            title: 'Επιτυχία',
            text: payload.message || 'Η επαναφορά ολοκληρώθηκε.'
        });

        const modalElement = document.getElementById('detailsModal');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);

        modalInstance?.hide();

        await loadResults();
    } catch (error) {
        console.error(error);

        Swal.fire({
            icon: 'error',
            title: 'Σφάλμα',
            text: error.message
        });
    }
}

function validateReviewSave(updates) {
    const errors = [];

    const timeFields = [
        ['apo_ora_01_apologistika', 'eos_ora_01_apologistika'],
        ['apo_ora_02_apologistika', 'eos_ora_02_apologistika'],
        ['apo_ora_03_apologistika', 'eos_ora_03_apologistika']
    ];

    timeFields.forEach(([apoField, eosField], index) => {
        const apo = updates[apoField];
        const eos = updates[eosField];

        if ((apo && !eos) || (!apo && eos)) {
            errors.push(`Σειρά ${index + 1}: πρέπει να συμπληρωθούν και Από και Έως.`);
        }
    });

    document.querySelectorAll('.apologistika-number-field').forEach((input) => {
        const value = Number(input.value || 0);

        if (Number.isNaN(value)) {
            errors.push(
                `Το πεδίο "${input.closest('.col-md-3')?.querySelector('label')?.textContent?.trim()}" δεν είναι αριθμός.`
            );
        }

        if (value < 0) {
            errors.push(
                `Το πεδίο "${input.closest('.col-md-3')?.querySelector('label')?.textContent?.trim()}" δεν μπορεί να είναι αρνητικό.`
            );
        }
    });

    if (updates.adeia_apologistika === true && !updates.kathgoria_adeias_apologistika) {
        errors.push('Όταν υπάρχει Άδεια, πρέπει να συμπληρωθεί Κατηγορία άδειας απολογιστικά.');
    }

    if (updates.repo_apologistika === true && updates.adeia_apologistika === true) {
        errors.push('Δεν μπορεί να είναι ταυτόχρονα Ρεπό και Άδεια.');
    }

    return errors;
}

function showDetailsModal(row) {
    const html = `
    <div class="container-fluid">

        <div class="review-modal-section">
            <div class="review-modal-section-title">Στοιχεία Εγγραφής</div>

            <span class="review-badge">${formatDate(row.hmeromhnia)}</span>
            <span class="review-badge">Παράρτημα: ${row.ypokatasthma || ''}</span>
            <span class="review-badge">Κωδικός: ${row.kodikos || ''}</span>
            <span class="review-badge">${row.eponymo || ''} ${row.onoma || ''}</span>
            ${hasAdeiaSuggestion(row) ? '<span class="review-adeia-badge">⚠ Προτείνεται έλεγχος άδειας</span>' : ''}
        </div>

        <div class="review-modal-grid-3">

            <div class="review-modal-section program-section">
                <div class="review-modal-section-title">Προδηλωμένο Ωράριο</div>
                ${renderReadOnlyTimeRows(row, 'apo_ora', 'eos_ora')}
            </div>

            <div class="review-modal-section cards-section">
                <div class="review-modal-section-title">Κάρτες</div>
                ${renderReadOnlyTimeRows(row, 'cards_apo_ora', 'cards_eos_ora')}
            </div>

            <div class="review-modal-section apologistiko-section">
                <div class="review-modal-section-title">Απολογιστικό προς Διόρθωση</div>
                ${renderEditableApologistikaRows(row)}
            </div>

        </div>

        <div class="review-modal-section">
            <div class="review-modal-section-title">Flags</div>

            <span class="review-badge">Απολογιστικό: ${row.apologistiko_biblio ? 'ΝΑΙ' : 'ΟΧΙ'}</span>
            <span class="review-badge">Ρεπό: ${row.repo ? 'ΝΑΙ' : 'ΟΧΙ'}</span>
            <span class="review-badge">Αργία: ${row.argia ? 'ΝΑΙ' : 'ΟΧΙ'}</span>
            <span class="review-badge">Κυριακή: ${row.kyriakes_apologistika ? 'ΝΑΙ' : 'ΟΧΙ'}</span>
        </div>

        ${renderScenarioDetailsSection(row)}

        <div class="review-modal-section">
            <div class="review-modal-section-title">
                Απολογιστικά Πεδία
                ${hasAdeiaSuggestion(row) ? '<span class="review-adeia-badge">Προτείνεται έλεγχος άδειας</span>' : ''}
            </div>
            ${renderApologistikaFields(row)}
        </div>

        <div class="review-modal-section">
            <div class="review-modal-section-title">Αιτιολογία Αλλαγής</div>

            <textarea id="edit_reason" class="form-control" rows="3"></textarea>

            <div class="d-flex gap-2 mt-3">
                ${
                    userCanReviewEdit()
                        ? `
                            <button class="btn btn-success" id="saveRecordBtn">
                                <i class="bi bi-save"></i> Αποθήκευση
                            </button>
                        `
                        : ''
                }

                ${
                    row.is_locked && userCanReviewEdit()
                        ? `
                            <button class="btn btn-warning" id="unlockRecordBtn">
                                <i class="bi bi-unlock"></i> Ξεκλείδωμα
                            </button>
                        `
                        : ''
                }
            </div>
        </div>

        <div class="review-modal-section">
            <div class="review-modal-section-title">Ιστορικό Αλλαγών</div>

            <button class="btn btn-sm mb-2" id="loadAuditBtn">
                Φόρτωση ιστορικού
            </button>

            <div id="auditHistoryContainer">
                <div class="text-muted">
                    Πατήστε «Φόρτωση ιστορικού» για να εμφανιστούν οι αλλαγές.
                </div>
            </div>
        </div>
    </div>
    `;

    document.getElementById('detailsContainer').innerHTML = html;

    const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
    const lockBadge = document.getElementById('detailsLockBadge');

    if (lockBadge) {
        lockBadge.classList.toggle('d-none', !row.is_locked);
    }

    modal.show();

    // initModalKathgoriaAdeiasTomSelect();
    setTimeout(() => {
        initModalKathgoriaAdeiasTomSelect();
    }, 100);
    initModalMoveByEnter();

    document.getElementById('loadAuditBtn')?.addEventListener('click', () => {
        loadAuditHistory(row._id);
    });

    document.getElementById('saveRecordBtn')?.addEventListener('click', async () => {
        try {
            const updates = {
                apo_ora_01_apologistika:
                    document.getElementById('edit_apo_ora_01_apologistika')?.value || '',

                eos_ora_01_apologistika:
                    document.getElementById('edit_eos_ora_01_apologistika')?.value || '',

                apo_ora_02_apologistika:
                    document.getElementById('edit_apo_ora_02_apologistika')?.value || '',

                eos_ora_02_apologistika:
                    document.getElementById('edit_eos_ora_02_apologistika')?.value || '',

                apo_ora_03_apologistika:
                    document.getElementById('edit_apo_ora_03_apologistika')?.value || '',

                eos_ora_03_apologistika:
                    document.getElementById('edit_eos_ora_03_apologistika')?.value || ''
            };

            document.querySelectorAll('.apologistika-number-field').forEach((input) => {
                updates[input.dataset.field] = Number(input.value || 0);
            });

            document.querySelectorAll('.apologistika-checkbox-field').forEach((input) => {
                updates[input.dataset.field] = input.checked;
            });

            updates.kathgoria_adeias_apologistika =
                document.getElementById('edit_kathgoria_adeias_apologistika_hidden')?.value || '';

            const validationErrors = validateReviewSave(updates);

            if (validationErrors.length > 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Έλεγχος πεδίων',
                    html: validationErrors.map((x) => `<div>${x}</div>`).join('')
                });

                return;
            }

            const reason = document.getElementById('edit_reason')?.value || '';

            if (!reason.trim()) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Αιτιολογία',
                    text: 'Παρακαλώ συμπληρώστε αιτιολογία αλλαγής.'
                });

                return;
            }

            const response = await fetch(`/api/prodhlomena-oraria/review/${row._id}`, {
                method: 'PATCH',

                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },

                body: JSON.stringify({
                    updates,
                    reason
                })
            });

            const payload = await response.json();

            if (!payload.success) {
                Swal.fire({
                    icon: 'error',
                    title: 'Σφάλμα',
                    text: payload.message || 'Αποτυχία αποθήκευσης.'
                });

                return;
            }

            Swal.fire({
                icon: 'success',
                title: 'Επιτυχία',
                text: payload.message || 'Η εγγραφή αποθηκεύτηκε.'
            });

            modal.hide();

            await loadResults();
        } catch (error) {
            console.error(error);

            Swal.fire({
                icon: 'error',
                title: 'Σφάλμα',
                text: error.message
            });
        }
    });

    document.getElementById('unlockRecordBtn')?.addEventListener('click', async () => {
        try {
            const reason = document.getElementById('edit_reason')?.value || '';

            if (!reason.trim()) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Αιτιολογία',
                    text: 'Παρακαλώ συμπληρώστε αιτιολογία ξεκλειδώματος.'
                });

                return;
            }

            const response = await fetch(`/api/prodhlomena-oraria/review/${row._id}/unlock`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    reason
                })
            });

            const payload = await response.json();

            if (!payload.success) {
                Swal.fire({
                    icon: 'error',
                    title: 'Σφάλμα',
                    text: payload.message || 'Αποτυχία ξεκλειδώματος.'
                });

                return;
            }

            Swal.fire({
                icon: 'success',
                title: 'Επιτυχία',
                text: payload.message || 'Η εγγραφή ξεκλειδώθηκε.'
            });

            const modalElement = document.getElementById('detailsModal');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);

            modalInstance?.hide();

            await loadResults();
        } catch (error) {
            console.error(error);

            Swal.fire({
                icon: 'error',
                title: 'Σφάλμα',
                text: error.message
            });
        }
    });
}

function buildReviewExportParams() {
    return new URLSearchParams({
        apo_hmeromhnia: document.getElementById('apo_hmeromhnia')?.value || '',
        eos_hmeromhnia: document.getElementById('eos_hmeromhnia')?.value || '',
        ypokatasthma: document.getElementById('ypokatasthma')?.value || '',
        kodikos: document.getElementById('kodikos')?.value || '',
        only_apologistiko: document.getElementById('only_apologistiko')?.checked || false,
        only_nyxta: document.getElementById('only_nyxta')?.checked || false,
        only_argia: document.getElementById('only_argia')?.checked || false,
        only_yperergasia: document.getElementById('only_yperergasia')?.checked || false
    });
}
async function exportExcel() {
    const params = buildReviewExportParams();
    window.location.href = `/api/prodhlomena-oraria/review/export-excel?${params.toString()}`;
}

let currentPdfBlobUrl = null;
let currentPdfFileName = null;

async function exportPdf() {
    try {
        const response = await fetch(
            `/api/prodhlomena-oraria/review/export-pdf?${buildReviewExportParams().toString()}`,
            { method: 'GET', headers: { 'CSRF-Token': csrfToken } }
        );

        if (!response.ok) throw new Error('Αποτυχία δημιουργίας PDF.');

        const blob = await response.blob();

        if (currentPdfBlobUrl) {
            URL.revokeObjectURL(currentPdfBlobUrl);
        }

        currentPdfBlobUrl = URL.createObjectURL(blob);
        currentPdfFileName = `elegxos_apasxolhseon_${Date.now()}.pdf`;

        const iframe = document.getElementById('reviewPdfFrame');
        if (iframe) iframe.src = currentPdfBlobUrl;

        const modalEl = document.getElementById('pdfPreviewModal');
        if (modalEl && typeof bootstrap !== 'undefined') {
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        } else {
            window.open(currentPdfBlobUrl, '_blank');
        }
    } catch (error) {
        console.error(error);
        Swal.fire({ icon: 'error', title: 'Σφάλμα', text: error.message });
    }
}

function initReviewMoveByEnter() {
    const fields = Array.from(document.querySelectorAll('#reviewFiltersEnterScope .move-by-enter'));

    fields.forEach((field, index) => {
        field.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;

            event.preventDefault();

            const nextField = fields[index + 1];

            if (nextField) {
                nextField.focus();
                return;
            }

            document.getElementById('searchBtn')?.focus();
        });
    });
}

function initModalMoveByEnter() {
    const fields = Array.from(document.querySelectorAll('#detailsModal .modal-edit-field'));

    fields.forEach((field, index) => {
        field.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;

            event.preventDefault();

            const nextField = fields[index + 1];

            if (nextField) {
                nextField.focus();
                nextField.select?.();
                return;
            }

            document.getElementById('edit_reason')?.focus();
        });
    });
}

function initModalKathgoriaAdeiasTomSelect() {
    const select = document.getElementById('edit_kathgoria_adeias_apologistika');
    const hidden = document.getElementById('edit_kathgoria_adeias_apologistika_hidden');
    const adeiaCheckbox = document.getElementById('edit_adeia_apologistika');

    if (!select || !hidden) return;

    if (select.tomselect) {
        select.tomselect.destroy();
    }

    if (typeof TomSelect === 'undefined') {
        console.warn('[initModalKathgoriaAdeiasTomSelect] TomSelect not loaded.');
        return;
    }

    const tomSelect = new TomSelect(select, {
        valueField: 'value',
        labelField: 'label',
        searchField: ['label', 'text', 'perigrafh', 'kodikos', 'value'],
        preload: true,
        maxOptions: 500,
        // dropdownParent: '#detailsModal .modal-body',

        load: async function (query, callback) {
            try {
                const api = select.dataset.api;
                const url = `${api}?q=${encodeURIComponent(query || '')}`;

                const response = await fetch(url, {
                    headers: {
                        'CSRF-Token': csrfToken
                    }
                });

                const payload = await response.json();

                const rawOptions = Array.isArray(payload)
                    ? payload
                    : payload.results || payload.data || payload.items || payload.options || [];

                const options = rawOptions.map((item) => {
                    const value = item.value || item.kodikos || item.id || '';

                    const label =
                        item.label ||
                        item.text ||
                        `${item.kodikos || value} - ${item.perigrafh || ''}`;

                    return {
                        ...item,
                        value,
                        label
                    };
                });

                callback(options);
            } catch (error) {
                console.error(error);
                callback();
            }
        },

        onInitialize: function () {
            const value = hidden.value || '';

            if (value) {
                this.addOption({
                    value,
                    label: value
                });

                this.setValue(value, true);

                if (adeiaCheckbox) {
                    adeiaCheckbox.checked = true;
                }
            }
        },

        onChange: function (value) {
            hidden.value = value || '';

            if (adeiaCheckbox) {
                adeiaCheckbox.checked = !!value;
            }
        }
    });

    if (adeiaCheckbox) {
        adeiaCheckbox.addEventListener('change', () => {
            if (!adeiaCheckbox.checked) {
                hidden.value = '';
                tomSelect.clear(true);
            }
        });
    }
}

let suppressLoaderUntil = 0;

if (typeof window.showLoader === 'function' && !window.__reviewPdfShowLoaderPatched) {
    const originalShowLoader = window.showLoader;

    window.showLoader = function (...args) {
        if (Date.now() < suppressLoaderUntil) {
            return;
        }

        return originalShowLoader.apply(this, args);
    };

    window.__reviewPdfShowLoaderPatched = true;
}

document.getElementById('reviewPdfDownloadBtn')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!currentPdfBlobUrl) return;

    const a = document.createElement('a');
    a.href = currentPdfBlobUrl;
    a.download = currentPdfFileName || `elegxos_apasxolhseon_${Date.now()}.pdf`;
    a.setAttribute('data-no-loader', 'true');
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();
    a.remove();

    if (typeof window.AppLoader?.hide === 'function') {
        window.AppLoader.hide();
    }
});

document.addEventListener('DOMContentLoaded', initReviewMoveByEnter);
document.getElementById('exportExcelBtn')?.addEventListener('click', exportExcel);
document.getElementById('exportPdfBtn')?.addEventListener('click', exportPdf);
document.getElementById('searchBtn')?.addEventListener('click', loadResults);

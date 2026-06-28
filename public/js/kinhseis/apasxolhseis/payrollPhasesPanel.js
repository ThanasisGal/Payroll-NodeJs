(function () {
    'use strict';

    const KATHESTOS_LABELS = {
        PLHRHS: 'Πλήρης',
        MERIKH: 'Μερική',
        EK_PERITROPHS: 'Εκ περιτροπής'
    };

    const PATTERN_LABELS = {
        FULL_WEEKLY_TERMS: 'Πλήρες εβδομαδιαίο pattern',
        SIX_DAY_40H_PATTERN: '6ήμερη κατανομή 40 ωρών',
        REDUCED_FULL_DAY_WEEKLY_TERMS: 'Πλήρεις ημέρες σε μειωμένο εβδομαδιαίο pattern',
        PARTIAL_DAY_TERMS: 'Μερικές ημερήσιες ώρες',
        UNKNOWN: 'Άγνωστο/προς έλεγχο'
    };

    const panel = document.getElementById('payrollPhasesPanel');
    const summaryEl = document.getElementById('payrollPhasesSummary');
    const listEl = document.getElementById('payrollPhasesList');
    const warningsEl = document.getElementById('payrollPhasesWarnings');
    const diagnosticsEl = document.getElementById('payrollPhasesDiagnostics');
    const closeButton = document.getElementById('payrollPhasesCloseBtn');
    const infoButton = document.getElementById('payrollPhasesInfoBtn');

    let requestSeq = 0;
    let activeController = null;
    let lastRenderedData = null;
    let currentContext = null;

    if (!panel || !summaryEl || !listEl || !warningsEl || !diagnosticsEl) {
        return;
    }

    function valueFromElement(id) {
        const element = document.getElementById(id);
        return element ? String(element.value || '').trim() : '';
    }

    function resolveEmployeeKod(detail) {
        return String(detail?.ergazomenoi?.kodikos || valueFromElement('kodikosHidden')).trim();
    }

    function resolveYpokatasthma(detail) {
        return String(detail?._YPOKATASTHMA || valueFromElement('ypokatasthma_Hidden')).trim();
    }

    function showPanel() {
        infoButton?.classList.add('d-none');
        panel.classList.remove('d-none');
    }

    function hidePanel() {
        panel.classList.add('d-none');
        infoButton?.classList.add('d-none');
        lastRenderedData = null;
        summaryEl.replaceChildren();
        listEl.replaceChildren();
        warningsEl.replaceChildren();
        diagnosticsEl.replaceChildren();
    }

    function closePanelToInfoButton() {
        panel.classList.add('d-none');
        if (currentContext?.employeeKod) {
            infoButton?.classList.remove('d-none');
        }
    }

    function clearPanel() {
        summaryEl.replaceChildren();
        listEl.replaceChildren();
        warningsEl.replaceChildren();
        diagnosticsEl.replaceChildren();
    }

    function appendText(parent, tagName, text, classNames) {
        const element = document.createElement(tagName);
        if (classNames) {
            classNames.split(' ').filter(Boolean).forEach((className) => {
                element.classList.add(className);
            });
        }
        element.textContent = text;
        parent.appendChild(element);
        return element;
    }

    function formatValue(value) {
        if (Array.isArray(value)) {
            return value.length ? value.join(', ') : '-';
        }

        if (value === null || value === undefined || value === '') {
            return '-';
        }

        return String(value);
    }

    function formatPatternKinds(kinds) {
        const normalizedKinds = Array.isArray(kinds) && kinds.length ? kinds : ['UNKNOWN'];
        return normalizedKinds.map((kind) => PATTERN_LABELS[kind] || kind).join(', ');
    }

    function formatKathestos(phase) {
        const key = String(phase?.detectedKathestos || '').trim();
        return KATHESTOS_LABELS[key] || key || '-';
    }

    function appendBadge(parent, text, className) {
        const badge = appendText(parent, 'span', text, `badge ${className}`);
        return badge;
    }

    function appendHeaderCell(row, text) {
        appendText(row, 'th', text, '');
    }

    function appendCell(row, text) {
        appendText(row, 'td', text, '');
    }

    function appendPhaseRow(tbody, phase) {
        const row = document.createElement('tr');
        appendCell(row, formatValue(phase.aa_misthodosias));
        appendCell(row, formatValue(phase.apo));
        appendCell(row, formatValue(phase.eos));
        appendCell(row, formatKathestos(phase));
        appendCell(row, formatValue(phase.detectedKathestosCode));
        appendCell(row, formatValue(phase.totalHours));
        appendCell(row, formatValue(phase.workedDays));
        appendCell(row, formatValue(phase.expectedActiveWorkDays));
        appendCell(row, formatValue(phase.sourcePhaseNos));
        appendCell(row, formatPatternKinds(phase.phasePatternKinds));

        const warningCell = document.createElement('td');
        if (phase.hasWarnings === true) {
            appendBadge(warningCell, 'Προειδοποίηση', 'text-bg-warning');
        } else {
            warningCell.textContent = '-';
        }
        row.appendChild(warningCell);

        tbody.appendChild(row);
    }

    function renderOperationalPhases(operationalPhases) {
        const tableWrapper = document.createElement('div');
        tableWrapper.classList.add('table-responsive');

        const table = document.createElement('table');
        table.classList.add('table', 'table-sm', 'table-bordered', 'align-middle', 'mb-0');

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        [
            'α/α',
            'Από',
            'Έως',
            'Καθεστώς',
            'Code',
            'Ώρες',
            'Ημέρες',
            'Αναμ. εργάσιμες',
            'Τεχνικά segments',
            'Pattern',
            'Προειδοποιήσεις'
        ].forEach((label) => appendHeaderCell(headerRow, label));
        thead.appendChild(headerRow);

        const tbody = document.createElement('tbody');
        operationalPhases.forEach((phase) => appendPhaseRow(tbody, phase));

        table.appendChild(thead);
        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        listEl.appendChild(tableWrapper);
    }

    function renderWarnings(operationalPhases) {
        const warningCount = operationalPhases.filter((phase) => phase.hasWarnings === true).length;
        if (!warningCount) {
            return;
        }

        const warningLine = document.createElement('div');
        warningLine.classList.add('small');
        appendBadge(warningLine, 'Προειδοποίηση', 'text-bg-warning');
        const text = document.createElement('span');
        text.classList.add('ms-2');
        text.textContent =
            warningCount === 1
                ? '1 μισθολογική φάση έχει προειδοποιήσεις.'
                : `${warningCount} μισθολογικές φάσεις έχουν προειδοποιήσεις.`;
        warningLine.appendChild(text);
        warningsEl.appendChild(warningLine);
    }

    function renderDiagnostics(data, operationalPhasesCount) {
        const phases = Array.isArray(data.phases) ? data.phases : [];
        const container = document.createElement('div');
        appendText(
            container,
            'div',
            `Diagnostic phases: ${phases.length}, operational phases: ${operationalPhasesCount}`,
            ''
        );

        if (phases.length > operationalPhasesCount) {
            appendText(
                container,
                'div',
                'Υπάρχουν τεχνικά segments που συγχωνεύθηκαν μισθολογικά.',
                ''
            );
        }

        diagnosticsEl.appendChild(container);
    }

    function renderData(data) {
        lastRenderedData = data;
        clearPanel();

        const operationalPhases = Array.isArray(data.operationalPhases)
            ? data.operationalPhases
            : [];
        const operationalPhasesCount = Number.isInteger(data.operationalPhasesCount)
            ? data.operationalPhasesCount
            : operationalPhases.length;
        const hasOperationalSplit = data.hasOperationalSplit === true;

        if (!operationalPhases.length) {
            appendText(summaryEl, 'div', 'Δεν βρέθηκαν μισθολογικές φάσεις για την περίοδο.', 'small');
            return;
        }

        const summaryText =
            operationalPhasesCount === 1 && hasOperationalSplit === false
                ? 'Ενιαία μισθολογική φάση για την περίοδο'
                : 'Η περίοδος έχει περισσότερες από μία μισθολογικές φάσεις';
        appendText(summaryEl, 'div', summaryText, 'fw-semibold text-info');

        renderOperationalPhases(operationalPhases);
        renderWarnings(operationalPhases);
        renderDiagnostics(data, operationalPhasesCount);
    }

    function renderError(message) {
        clearPanel();
        appendText(summaryEl, 'div', message, 'small text-muted');
    }

    if (closeButton) {
        closeButton.addEventListener('click', function () {
            requestSeq += 1;
            if (activeController) {
                activeController.abort();
                activeController = null;
            }
            closePanelToInfoButton();
        });
    }

    if (infoButton) {
        infoButton.addEventListener('click', function () {
            if (!currentContext?.employeeKod) {
                hidePanel();
                return;
            }

            infoButton.classList.add('d-none');
            showPanel();

            if (lastRenderedData) {
                renderData(lastRenderedData);
                return;
            }

            requestSeq += 1;
            const seq = requestSeq;

            if (activeController) {
                activeController.abort();
            }

            activeController = new AbortController();
            clearPanel();
            appendText(summaryEl, 'div', 'Φόρτωση μισθολογικών φάσεων...', 'small text-muted');

            loadPayrollPhases(
                currentContext.employeeKod,
                currentContext.ypokatasthma,
                seq,
                activeController.signal
            ).catch((error) => {
                if (seq !== requestSeq || error?.name === 'AbortError') {
                    return;
                }
                renderError('Δεν ήταν δυνατή η εμφάνιση των μισθολογικών φάσεων.');
            });
        });
    }

    async function loadPayrollPhases(employeeKod, ypokatasthma, seq, signal) {
        const params = new URLSearchParams({
            employeeKod
        });

        if (ypokatasthma) {
            params.set('ypokatasthma', ypokatasthma);
        }

        const response = await fetch(`/api/kinhseis/detectPayrollPhases?${params.toString()}`, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json'
            },
            signal
        });

        if (!response.ok) {
            throw new Error('Payroll phases request failed');
        }

        const payload = await response.json();
        if (seq !== requestSeq) {
            return;
        }

        renderData(payload?.data || payload || {});
    }

    document.addEventListener('sharedParamsLoaded', function (event) {
        const detail = event.detail || {};
        const employeeKod = resolveEmployeeKod(detail);
        const ypokatasthma = resolveYpokatasthma(detail);
        requestSeq += 1;

        if (activeController) {
            activeController.abort();
            activeController = null;
        }

        currentContext = employeeKod ? { employeeKod, ypokatasthma } : null;

        if (!employeeKod) {
            hidePanel();
            return;
        }

        lastRenderedData = null;
        clearPanel();
        panel.classList.add('d-none');
        infoButton?.classList.remove('d-none');
    });
})();

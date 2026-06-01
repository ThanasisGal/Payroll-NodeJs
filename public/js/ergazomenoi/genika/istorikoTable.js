// ============================================================================
// ΙΣΤΟΡΙΚΟ ΠΡΟΣΛΗΨΕΩΝ - ΑΛΛΑΓΩΝ
// CRUD / Undo / Save / Details modal
// CSP-safe: no inline handlers, no inline styles
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('istorikoTable');
    const saveBtn = document.getElementById('updateIstorikoBtn');
    const cancelBtn = document.getElementById('cancelIstorikoBtn');
    const employeeIdInput = document.getElementById('istorikoEmployeeId');
    const detailsModalEl = document.getElementById('istorikoDetailsModal');
    const detailsBody = document.getElementById('istorikoDetailsBody');

    if (!table) return;

    const fields = [
        'hmeromhnia_proslhpshs',
        'hmeromhnia_allaghs_symbashs',
        'hmeromhnia_allaghs_orarioy_apo',
        'hmeromhnia_allaghs_orarioy_eos',
        'hmeromhnia_lhxhs_symbashs',
        'hmeromhnia_apoxorhshs'
    ];

    const excludedModalFields = new Set([
        '_id',
        '__v',
        'team',
        'company_kod',
        'kodikos',
        'createdAt',
        'updatedAt',
        '__lookups',
        'symbash',
        'kathgoria_symbashs',
        'eidikothta_symbashs'
    ]);

    for (let i = 1; i <= 15; i += 1) {
        const ii = String(i).padStart(2, '0');
        excludedModalFields.add(`stoixeio_symbashs_${ii}`);
        excludedModalFields.add(`poso_symbashs_${ii}`);
        excludedModalFields.add(`poso_symbashs_basei_oron_ergasias_${ii}`);
    }

    for (let i = 1; i <= 7; i += 1) {
        const ii = String(i).padStart(2, '0');
        excludedModalFields.add(`krathsh_${ii}`);
        excludedModalFields.add(`ama_krathshs_${ii}`);
    }

    // Τα σύνολα εμφανίζονται στο section «Στοιχεία Σύμβασης / Ποσά»
    // και όχι ξανά στα «Λοιπά Στοιχεία».
    excludedModalFields.add('synolo_symbashs');
    excludedModalFields.add('synolo_symbashs_basei_oron_ergasias');

    // Οι νόμιμες/πραγματικές αποδοχές εμφανίζονται σε ξεχωριστό section
    // και όχι ξανά στα «Λοιπά Στοιχεία».
    excludedModalFields.add('nomimosMisthos');
    excludedModalFields.add('nomimoHmeromisthio');
    excludedModalFields.add('nomimoOromisthio');
    excludedModalFields.add('pragmatikosMisthos');
    excludedModalFields.add('pragmatikoHmeromisthio');
    excludedModalFields.add('pragmatikoOromisthio');

    const fieldLabels = {
        aa_eggrafhs: 'α/α Εγγραφής',
        hmeromhnia_proslhpshs: 'Ημ/νία Πρόσληψης',
        hmeromhnia_allaghs_symbashs: 'Ημ/νία Αλλαγής Σύμβασης',
        hmeromhnia_allaghs_orarioy_apo: 'Ημ/νία Αλλαγής Ωραρίου Από',
        hmeromhnia_allaghs_orarioy_eos: 'Ημ/νία Αλλαγής Ωραρίου Έως',
        hmeromhnia_isxyos_oron_ergasias_apo: 'Ημ/νία Ισχύος Όρων Εργασίας Από',
        hmeromhnia_isxyos_oron_ergasias_eos: 'Ημ/νία Ισχύος Όρων Εργασίας Έως',
        hmeromhnia_lhxhs_symbashs: 'Ημ/νία Λήξης Σύμβασης',
        hmeromhnia_apoxorhshs: 'Ημ/νία Αποχώρησης',
        afora_proslhpsh: 'Αφορά Πρόσληψη',
        kathestos_apasxolhshs: 'Καθεστώς Απασχόλησης',
        hmeres_ergasias_ebdomadas: 'Ημέρες Εργασίας Εβδομάδας',
        ores_ergasias_ebdomadas: 'Ώρες Εργασίας Εβδομάδας',
        mo_oron_hmerhsias_ergasias: 'Μ.Ο. Ημερήσιας Εργασίας',
        typos_apasxolhshs: 'Τύπος Απασχόλησης',
        typos_ebdomadas: 'Απασχόληση Βάσει Σύμβασης',
        afora_allagh_oron_ergasias: 'Αφορά Αλλαγή Όρων Εργασίας',
        misthologiko_klimakio: 'Μισθολογικό Κλιμάκιο',
        synolo_symbashs: 'Σύνολο Σύμβασης',
        synolo_symbashs_basei_oron_ergasias: 'Σύνολο Σύμβασης Βάσει Όρων Εργασίας',
        nomimosMisthos: 'Νόμιμος Μισθός',
        nomimoHmeromisthio: 'Νόμιμο Ημερομίσθιο',
        nomimoOromisthio: 'Νόμιμο Ωρομίσθιο',
        pragmatikosMisthos: 'Πραγματικός Μισθός',
        pragmatikoHmeromisthio: 'Πραγματικό Ημερομίσθιο',
        pragmatikoOromisthio: 'Πραγματικό Ωρομίσθιο'
    };

    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.content || '';
    }

    function padAa(n) {
        return String(n).padStart(4, '0');
    }

    function safeParseJson(value) {
        try {
            return JSON.parse(value || '{}');
        } catch {
            return {};
        }
    }

    function htmlEscape(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function isEmptyValue(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string' && value.trim() === '') return true;
        if (typeof value === 'number' && value === 0) return true;
        if (typeof value === 'boolean' && value === false) return true;
        return false;
    }

    function formatDateForDisplay(value) {
        if (!value) return '';
        const iso = String(value).split('T')[0];
        const [y, m, d] = iso.split('-');
        if (!y || !m || !d) return '';
        return `${d}/${m}/${y}`;
    }

    function isoFromDisplay(value) {
        if (!value) return '';
        const parts = value.trim().split('/');
        if (parts.length !== 3) return '';
        const [d, m, y] = parts;
        return `${y}-${m}-${d}`;
    }

    function formatNumber(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return String(value ?? '');
        return new Intl.NumberFormat('el-GR', {
            minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
            maximumFractionDigits: 4
        }).format(n);
    }

    function formatMoney2(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return '0,00';

        return new Intl.NumberFormat('el-GR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(n);
    }

    function formatKathestosApasxolhshs(value) {
        const code = String(value ?? '').trim();

        if (code === '0') return '0  -  ΠΛΗΡΗΣ ΑΠΑΣΧΟΛΗΣΗ';
        if (code === '1') return '1  -  ΜΕΡΙΚΗ ΑΠΑΣΧΟΛΗΣΗ';
        if (code === '2') return '2  -  ΕΚ ΠΕΡΙΤΡΟΠΗΣ ΕΡΓΑΣΙΑ';

        return code;
    }

    function formatModalValue(value) {
        if (value === true) return 'ΝΑΙ';
        if (value === false) return 'ΟΧΙ';
        if (typeof value === 'number') return formatNumber(value);
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
            return formatDateForDisplay(value);
        }
        return String(value ?? '');
    }

    function getFieldLabel(field) {
        return fieldLabels[field] || field.replaceAll('_', ' ');
    }

    function setRowState(row, state) {
        row.dataset.state = state;

        row.classList.remove(
            'istoriko-row-inserted',
            'istoriko-row-modified',
            'istoriko-row-deleted'
        );

        const dot = row.querySelector('.istoriko-state');
        if (dot) {
            dot.className = `istoriko-state state-${state}`;
        }

        if (state !== 'clean') {
            row.classList.add(`istoriko-row-${state}`);
        }
    }

    function renumberRows() {
        const rows = table.querySelectorAll('tbody tr.istoriko-row');

        rows.forEach((row, index) => {
            const aa = padAa(index + 1);
            const aaCell = row.querySelector('.istoriko-aa-col');
            if (aaCell) aaCell.textContent = aa;
            row.dataset.aa = aa;
        });
    }

    function createActionButtons() {
        return `
            <div class="istoriko-actions">
                <button type="button" class="btn btn-sm istoriko-btn istoriko-btn-add" data-action="add" title="Προσθήκη">
                    <i class="bi bi-plus-lg"></i>
                </button>
                <button type="button" class="btn btn-sm istoriko-btn istoriko-btn-edit" data-action="edit" title="Τροποποίηση">
                    <i class="bi bi-pencil-square"></i>
                </button>
                <button type="button" class="btn btn-sm istoriko-btn istoriko-btn-delete" data-action="delete" title="Διαγραφή">
                    <i class="bi bi-trash3"></i>
                </button>
                <button type="button" class="btn btn-sm istoriko-btn istoriko-btn-undo" data-action="undo" title="Αναίρεση">
                    <i class="bi bi-arrow-counterclockwise"></i>
                </button>
            </div>
        `;
    }

    function createEmptyRow() {
        const tr = document.createElement('tr');
        tr.className = 'istoriko-row';
        tr.dataset.id = '';
        tr.dataset.state = 'inserted';
        tr.dataset.original = JSON.stringify({});
        tr.dataset.record = JSON.stringify({});
        tr.dataset.aa = '';

        tr.innerHTML = `
            <td class="text-center istoriko-aa-col"></td>
            <td class="text-center" data-field="hmeromhnia_proslhpshs"></td>
            <td class="text-center" data-field="hmeromhnia_allaghs_symbashs"></td>
            <td class="text-center" data-field="hmeromhnia_allaghs_orarioy_apo"></td>
            <td class="text-center" data-field="hmeromhnia_allaghs_orarioy_eos"></td>
            <td class="text-center" data-field="hmeromhnia_lhxhs_symbashs"></td>
            <td class="text-center" data-field="hmeromhnia_apoxorhshs"></td>
            <td class="text-center istoriko-state-col">
                <span class="istoriko-state state-inserted"></span>
            </td>
            <td class="istoriko-actions-col text-center">
                ${createActionButtons()}
            </td>
        `;

        setRowState(tr, 'inserted');
        return tr;
    }

    function rowToEditMode(row) {
        if (row.dataset.editing === '1') return;
        if (row.dataset.state === 'deleted') return;

        fields.forEach((field) => {
            const cell = row.querySelector(`[data-field="${field}"]`);
            if (!cell) return;

            const value = cell.dataset.iso || '';
            cell.innerHTML = `<input type="date" class="date-control istoriko-date-input" data-field-input="${field}" value="${value}">`;
        });

        row.dataset.editing = '1';

        row.querySelectorAll('.istoriko-date-input').forEach((input) => {
            const markModified = () => {
                if (row.dataset.state === 'clean') {
                    setRowState(row, 'modified');
                }
            };

            input.addEventListener('input', markModified);
            input.addEventListener('change', markModified);
        });
    }

    function rowFromEditMode(row) {
        if (row.dataset.editing !== '1') return;

        let changed = false;

        fields.forEach((field) => {
            const input = row.querySelector(`[data-field-input="${field}"]`);
            const cell = row.querySelector(`[data-field="${field}"]`);
            if (!input || !cell) return;

            const newValue = input.value || '';
            const oldValue = cell.dataset.iso || '';

            if (newValue !== oldValue) changed = true;

            cell.dataset.iso = newValue;
            cell.textContent = formatDateForDisplay(newValue);
        });

        row.dataset.editing = '0';

        if (changed && row.dataset.state === 'clean') {
            setRowState(row, 'modified');
        }
    }

    function restoreRowFromOriginal(row) {
        const original = safeParseJson(row.dataset.original);

        fields.forEach((field, index) => {
            const cell = row.children[index + 1];
            if (!cell) return;

            const iso = original?.[field] ? String(original[field]).split('T')[0] : '';
            cell.dataset.field = field;
            cell.dataset.iso = iso;
            cell.textContent = formatDateForDisplay(iso);
        });

        row.dataset.editing = '0';
        setRowState(row, 'clean');
    }

    function hydrateExistingRows() {
        table.querySelectorAll('tbody tr.istoriko-row').forEach((row) => {
            const original = safeParseJson(row.dataset.original);

            fields.forEach((field, index) => {
                const cell = row.children[index + 1];
                if (!cell) return;

                cell.dataset.field = field;
                const rawValue = original?.[field] || '';
                const isoValue = rawValue
                    ? String(rawValue).split('T')[0]
                    : isoFromDisplay(cell.textContent);

                cell.dataset.iso = isoValue;
            });

            row.dataset.editing = '0';
            setRowState(row, row.dataset.state || 'clean');
        });

        renumberRows();
    }

    function getRowData(row) {
        const data = {};

        fields.forEach((field) => {
            const input = row.querySelector(`[data-field-input="${field}"]`);
            const cell = row.querySelector(`[data-field="${field}"]`);
            data[field] = input ? input.value || '' : cell?.dataset.iso || '';
        });

        return data;
    }

    function collectUpdates() {
        const updates = [];

        table.querySelectorAll('tbody tr.istoriko-row').forEach((row) => {
            if (row.dataset.editing === '1') {
                rowFromEditMode(row);
            }

            const state = row.dataset.state || 'clean';
            if (state === 'clean') return;

            updates.push({
                _id: row.dataset.id || null,
                state,
                aa_eggrafhs: row.dataset.aa || '',
                data: getRowData(row)
            });
        });

        return updates;
    }

    function lookupText(record, group, code, directField) {
        const lookups = record.__lookups || {};
        const value = code || '';
        if (!value) return '';

        if (directField && record[directField]) return record[directField];
        if (lookups[group]?.[value]?.perigrafh) return lookups[group][value].perigrafh;
        if (lookups[group]?.perigrafh) return lookups[group].perigrafh;
        return '';
    }

    function lookupByIndex(record, group, index, code) {
        const lookups = record.__lookups || {};
        if (!code) return '';

        if (lookups[group]?.[index]?.perigrafh) return lookups[group][index].perigrafh;
        if (lookups[group]?.[code]?.perigrafh) return lookups[group][code].perigrafh;
        return '';
    }

    function codeWithDescription(code, description) {
        if (!code && !description) return '';

        if (!description) {
            return `<span class="istoriko-code">${htmlEscape(code)}</span>`;
        }

        return `
            <span class="istoriko-code">${htmlEscape(code)}</span>
            <span class="istoriko-code-separator"> - </span>
            <span class="istoriko-description">${htmlEscape(description)}</span>
        `;
    }

    function buildMainContractRows(record) {
        const symbash = record.symbash || '';
        const kathgoria = record.kathgoria_symbashs || '';
        const eidikothta = record.eidikothta_symbashs || '';

        const symbashDescr = lookupText(record, 'symbaseis', symbash, 'symbash_perigrafh');
        const kathgoriaDescr = lookupText(
            record,
            'kathgoriesSymbaseon',
            kathgoria,
            'kathgoria_symbashs_perigrafh'
        );
        const eidikothtaDescr = lookupText(
            record,
            'eidikothtesAnaKathgoriaSymbaseon',
            eidikothta,
            'eidikothta_symbashs_perigrafh'
        );

        const rows = [
            ['Σύμβαση', symbash, symbashDescr],
            ['Κατηγορία Σύμβασης', kathgoria, kathgoriaDescr],
            ['Ειδικότητα Σύμβασης', eidikothta, eidikothtaDescr]
        ].filter(([, code, descr]) => !isEmptyValue(code) || !isEmptyValue(descr));

        if (!rows.length) return '';

        return `
            <div class="istoriko-details-section">
                <div class="istoriko-details-section-title">Στοιχεία Σύμβασης</div>
                <table class="table table-sm table-bordered istoriko-details-table istoriko-main-contract-table">
                    <tbody>
                        ${rows
                            .map(
                                ([label, code, descr]) => `
                            <tr>
                                <th>${htmlEscape(label)}</th>
                                <td>${codeWithDescription(code, descr)}</td>
                            </tr>
                        `
                            )
                            .join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    function buildContractElementsRows(record) {
        const rows = [];

        for (let i = 1; i <= 15; i += 1) {
            const ii = String(i).padStart(2, '0');
            const code = record[`stoixeio_symbashs_${ii}`];
            if (isEmptyValue(code)) continue;

            rows.push(`
                <tr>
                    <td class="istoriko-modal-aa-col">${htmlEscape(ii)}</td>
                    <td class="istoriko-modal-desc-col">
                        ${codeWithDescription(code, lookupByIndex(record, 'stoixeiaSymbaseon', ii, code))}
                    </td>
                    <td class="istoriko-modal-money-col">${htmlEscape(formatMoney2(record[`poso_symbashs_${ii}`]))}</td>
                    <td class="istoriko-modal-money-col">${htmlEscape(formatMoney2(record[`poso_symbashs_basei_oron_ergasias_${ii}`]))}</td>
                </tr>
            `);
        }

        if (!rows.length) return '';

        rows.push(`
            <tr class="istoriko-modal-totals-row">
                <td class="istoriko-modal-aa-col">ΣΥΝΟΛΑ</td>
                <td class="istoriko-modal-desc-col"></td>
                <td class="istoriko-modal-money-col">${htmlEscape(formatMoney2(record.synolo_symbashs))}</td>
                <td class="istoriko-modal-money-col">${htmlEscape(formatMoney2(record.synolo_symbashs_basei_oron_ergasias))}</td>
            </tr>
        `);

        return `
            <div class="istoriko-details-section">
                <div class="istoriko-details-section-title">Στοιχεία Σύμβασης / Ποσά</div>
                <table class="table table-sm table-bordered istoriko-details-table istoriko-contract-elements-table">
                    <thead>
                        <tr>
                            <th class="istoriko-modal-aa-col">α/α</th>
                            <th class="istoriko-modal-desc-col">Στοιχείο Σύμβασης</th>
                            <th class="istoriko-modal-money-col">Ποσό Σύμβασης</th>
                            <th class="istoriko-modal-money-col">Ποσό Βάσει Ωρών Εργασίας</th>
                        </tr>
                    </thead>
                    <tbody>${rows.join('')}</tbody>
                </table>
            </div>
        `;
    }

    function hasAnyRemunerationValue(record) {
        const fields = [
            'nomimosMisthos',
            'nomimoHmeromisthio',
            'nomimoOromisthio',
            'pragmatikosMisthos',
            'pragmatikoHmeromisthio',
            'pragmatikoOromisthio'
        ];

        return fields.some((field) => !isEmptyValue(record[field]));
    }

    function buildRemunerationRows(record) {
        if (!hasAnyRemunerationValue(record)) return '';

        return `
            <div class="istoriko-details-section">
                <div class="istoriko-details-section-title">Νόμιμες / Πραγματικές Αποδοχές</div>
                <table class="table table-sm table-bordered istoriko-details-table istoriko-remuneration-table">
                    <tbody>
                        <tr>
                            <th class="istoriko-remuneration-label">Νόμιμος Μισθός</th>
                            <td class="istoriko-remuneration-money">${htmlEscape(formatMoney2(record.nomimosMisthos))}</td>
                            <th class="istoriko-remuneration-label">Νόμιμο Ημερομίσθιο</th>
                            <td class="istoriko-remuneration-money">${htmlEscape(formatMoney2(record.nomimoHmeromisthio))}</td>
                            <th class="istoriko-remuneration-label">Νόμιμο Ωρομίσθιο</th>
                            <td class="istoriko-remuneration-money">${htmlEscape(formatMoney2(record.nomimoOromisthio))}</td>
                        </tr>
                        <tr>
                            <th class="istoriko-remuneration-label">Πραγματικός Μισθός</th>
                            <td class="istoriko-remuneration-money">${htmlEscape(formatMoney2(record.pragmatikosMisthos))}</td>
                            <th class="istoriko-remuneration-label">Πραγματικό Ημερομίσθιο</th>
                            <td class="istoriko-remuneration-money">${htmlEscape(formatMoney2(record.pragmatikoHmeromisthio))}</td>
                            <th class="istoriko-remuneration-label">Πραγματικό Ωρομίσθιο</th>
                            <td class="istoriko-remuneration-money">${htmlEscape(formatMoney2(record.pragmatikoOromisthio))}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    function buildKrathseisRows(record) {
        const rows = [];

        for (let i = 1; i <= 7; i += 1) {
            const ii = String(i).padStart(2, '0');
            const code = record[`krathsh_${ii}`];
            if (isEmptyValue(code)) continue;

            const descr = lookupByIndex(record, 'krathseis', ii, code);

            rows.push(`
                <tr>
                    <td class="istoriko-modal-aa-col">${htmlEscape(ii)}</td>
                    <td class="istoriko-modal-krathsh-col">
                        ${codeWithDescription(code, descr)}
                    </td>
                </tr>
            `);
        }

        if (!rows.length) return '';

        return `
            <div class="istoriko-details-section">
                <div class="istoriko-details-section-title">Κρατήσεις</div>
                <table class="table table-sm table-bordered istoriko-details-table istoriko-krathseis-table">
                    <thead>
                        <tr>
                            <th class="istoriko-modal-aa-col">α/α</th>
                            <th class="istoriko-modal-krathsh-col">Κράτηση</th>
                        </tr>
                    </thead>
                    <tbody>${rows.join('')}</tbody>
                </table>
            </div>
        `;
    }

    function buildOtherFieldsRows(record) {
        const rows = Object.entries(record)
            .filter(([key, value]) => !excludedModalFields.has(key) && !isEmptyValue(value))
            .map(([key, value]) => {
                const displayValue =
                    key === 'kathestos_apasxolhshs'
                        ? formatKathestosApasxolhshs(value)
                        : formatModalValue(value);

                return `
                <tr>
                    <th>${htmlEscape(getFieldLabel(key))}</th>
                    <td>${htmlEscape(displayValue)}</td>
                </tr>
            `;
            })
            .join('');

        if (!rows) return '';

        return `
            <div class="istoriko-details-section">
                <div class="istoriko-details-section-title">Λοιπά Στοιχεία</div>
                <table class="table table-sm table-bordered istoriko-details-table istoriko-other-table">
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    function buildIstorikoDetailsHtml(record) {
        const html = [
            buildMainContractRows(record),
            buildContractElementsRows(record),
            buildRemunerationRows(record),
            buildKrathseisRows(record),
            buildOtherFieldsRows(record)
        ]
            .filter(Boolean)
            .join('');

        return html || '<div class="text-muted text-center">Δεν υπάρχουν συμπληρωμένα πεδία.</div>';
    }

    function openIstorikoDetailsModal(row) {
        if (!detailsModalEl || !detailsBody) return;
        if (row.dataset.editing === '1') return;

        const record = safeParseJson(row.dataset.record);
        detailsBody.innerHTML = buildIstorikoDetailsHtml(record);

        bootstrap.Modal.getOrCreateInstance(detailsModalEl).show();
    }

    table.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action]');

        if (!button) {
            const passiveControl = event.target.closest('input, select, textarea, button, a');
            if (passiveControl) return;

            const rowForModal = event.target.closest('tr.istoriko-row');
            if (rowForModal) openIstorikoDetailsModal(rowForModal);
            return;
        }

        const row = button.closest('tr.istoriko-row');
        if (!row) return;

        const action = button.dataset.action;

        if (action === 'add') {
            const newRow = createEmptyRow();
            row.insertAdjacentElement('afterend', newRow);
            renumberRows();
            rowToEditMode(newRow);
            return;
        }

        if (action === 'edit') {
            if (row.dataset.state === 'deleted') return;

            if (row.dataset.editing === '1') {
                rowFromEditMode(row);
            } else {
                rowToEditMode(row);
            }
            return;
        }

        if (action === 'delete') {
            if (row.dataset.state === 'inserted') {
                row.remove();
                renumberRows();
                return;
            }

            setRowState(row, 'deleted');
            return;
        }

        if (action === 'undo') {
            const state = row.dataset.state;

            if (state === 'inserted') {
                row.remove();
                renumberRows();
                return;
            }

            if (row.dataset.editing === '1' && state === 'clean') {
                restoreRowFromOriginal(row);
                return;
            }

            if (state === 'deleted') {
                setRowState(row, 'clean');
                return;
            }

            if (state === 'modified') {
                restoreRowFromOriginal(row);
            }
        }
    });

    saveBtn?.addEventListener('click', async () => {
        const employeeId = employeeIdInput?.value || '';
        const csrfToken = getCsrfToken();
        const updates = collectUpdates();

        if (!employeeId) {
            await Swal.fire('Σφάλμα', 'Δεν βρέθηκε employeeId.', 'error');
            return;
        }

        if (!csrfToken) {
            await Swal.fire('Σφάλμα', 'Δεν βρέθηκε CSRF token. Κάνε refresh τη σελίδα.', 'error');
            return;
        }

        if (updates.length === 0) {
            await Swal.fire('Καμία αλλαγή', 'Δεν υπάρχουν αλλαγές για αποθήκευση.', 'info');
            return;
        }

        const confirm = await Swal.fire({
            backdrop: false,
            allowOutsideClick: false,
            icon: 'question',
            title: 'Ενημέρωση Ιστορικού',
            html: `Θέλετε να αποθηκευτούν <strong>${updates.length}</strong> αλλαγές;`,
            showCancelButton: true,
            confirmButtonText: 'Αποθήκευση',
            cancelButtonText: 'Άκυρο',
            customClass: {
                confirmButton: 'class-success custom-confirm-button custom-swal-button',
                cancelButton: 'class-secondary custom-cancel-button custom-swal-button',
                title: 'custom-title',
                popup: 'custom-swal-popup'
            }
        });

        if (!confirm.isConfirmed) return;

        try {
            const response = await fetch('/ergazomenoi/ergazomenoi/istoriko/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken,
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify({ employeeId, updates })
            });

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(result.message || 'Αποτυχία ενημέρωσης ιστορικού.');
            }

            await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'success',
                title: 'Επιτυχία',
                text: result.message || 'Το Ιστορικό ενημερώθηκε επιτυχώς.',
                confirmButtonText: 'OK'
            });

            window.location.reload();
        } catch (error) {
            await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'error',
                title: 'Σφάλμα',
                text: error.message || 'Σφάλμα κατά την ενημέρωση του Ιστορικού.',
                confirmButtonText: 'OK'
            });
        }
    });

    cancelBtn?.addEventListener('click', async () => {
        // const confirm = await Swal.fire({
        //     backdrop: false,
        //     allowOutsideClick: false,
        //     icon: 'warning',
        //     title: 'Ακύρωση αλλαγών',
        //     text: 'Θέλετε να ακυρωθούν όλες οι αλλαγές στο ιστορικό;',
        //     showCancelButton: true,
        //     confirmButtonText: 'Ναι',
        //     cancelButtonText: 'Όχι'
        // });

        // if (confirm.isConfirmed) {
        window.location.reload();
        // }
    });

    hydrateExistingRows();
});

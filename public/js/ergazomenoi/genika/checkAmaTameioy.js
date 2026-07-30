const KRATHSEIS_ROW_COUNT = 7;

function krathshRowId(index) {
    return String(index).padStart(2, '0');
}

function getKrathshSelectionForRow(rowIndex) {
    const idNum = krathshRowId(rowIndex);
    const selectEl = document.getElementById(`select_krathsh_${idNum}`);
    const tom = selectEl?.tomselect;
    const value = tom?.getValue?.() || selectEl?.value || '';
    const normalizedValue = Array.isArray(value) ? value[0] || '' : value;
    const option = normalizedValue ? tom?.options?.[normalizedValue] : null;
    if (!normalizedValue || !option) return null;
    return { idNum, selectEl, tom, value: normalizedValue, option };
}

function getSelectedKrathshRows() {
    const rows = [];
    for (let index = 1; index <= KRATHSEIS_ROW_COUNT; index += 1) {
        const selection = getKrathshSelectionForRow(index);
        if (selection) rows.push(selection);
    }
    return rows;
}

function rebuildKrathseisTableFromRows() {
    const tableInput = document.getElementById('krathseis_table');
    if (!tableInput) return [];

    const byTameio = new Map();
    getSelectedKrathshRows().forEach(({ option }) => {
        const kodikosTameioy = String(option.kodikos_tameioy || '').padStart(4, '0');
        if (!kodikosTameioy || kodikosTameioy === '0000' || byTameio.has(kodikosTameioy)) {
            return;
        }
        byTameio.set(kodikosTameioy, {
            kodikos: String(option.kodikos || '').padStart(4, '0'),
            kodikos_tameioy: kodikosTameioy,
            perigrafh: option.perigrafh || ''
        });
    });

    const tableData = [...byTameio.values()];
    tableInput.value = JSON.stringify(tableData);
    return tableData;
}

function handleKrathshChange(rowIndex, selectedValue) {
    const idNum = krathshRowId(rowIndex);
    const hidden = document.getElementById(`krathsh_${idNum}`);
    if (hidden) hidden.value = selectedValue || '';

    const selection = getKrathshSelectionForRow(idNum);
    const tableData = rebuildKrathseisTableFromRows();
    if (!selection) return;

    document.dispatchEvent(
        new CustomEvent('krathshChanged', {
            detail: { rowIndex: idNum, selectedOption: selection.option, tableData }
        })
    );
}

function handleAmaFocus(rowIndex) {
    const idNum = krathshRowId(rowIndex);
    const current = getKrathshSelectionForRow(idNum);
    const amaInput = document.getElementById(`ama_krathshs_${idNum}`);
    if (!current || !amaInput) return;

    const currentTameio = String(current.option.kodikos_tameioy || '').padStart(4, '0');
    const source = getSelectedKrathshRows().find(({ idNum: otherId, option }) => {
        if (otherId === idNum) return false;
        return String(option.kodikos_tameioy || '').padStart(4, '0') === currentTameio;
    });
    const sourceAma = source
        ? document.getElementById(`ama_krathshs_${source.idNum}`)
        : null;

    if (sourceAma?.value) {
        amaInput.value = sourceAma.value;
        amaInput.style.backgroundColor = '#f0f0f0';
        amaInput.setAttribute('data-copied-from', `ama_krathshs_${source.idNum}`);
        return;
    }

    amaInput.style.backgroundColor = '';
    amaInput.removeAttribute('data-copied-from');
}

function initializeKrathseisAmaHandlers() {
    document.querySelectorAll('.krathsh-select').forEach((selectEl) => {
        if (selectEl.dataset.krathshChangeBound === 'true') return;
        selectEl.dataset.krathshChangeBound = 'true';
        selectEl.addEventListener('change', () => {
            handleKrathshChange(selectEl.dataset.rowIndex, selectEl.value || '');
        });
    });

    for (let index = 1; index <= KRATHSEIS_ROW_COUNT; index += 1) {
        const idNum = krathshRowId(index);
        const amaInput = document.getElementById(`ama_krathshs_${idNum}`);
        if (!amaInput || amaInput.dataset.amaFocusBound === 'true') continue;
        amaInput.dataset.amaFocusBound = 'true';
        amaInput.addEventListener('focus', () => handleAmaFocus(idNum));
    }

    rebuildKrathseisTableFromRows();
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initializeKrathseisAmaHandlers);
}

if (typeof window !== 'undefined') {
    window.getSelectedKrathshRows = getSelectedKrathshRows;
    window.rebuildKrathseisTableFromRows = rebuildKrathseisTableFromRows;
    window.handleKrathshChange = handleKrathshChange;
    window.handleAmaFocus = handleAmaFocus;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getKrathshSelectionForRow,
        getSelectedKrathshRows,
        rebuildKrathseisTableFromRows,
        handleKrathshChange,
        handleAmaFocus,
        initializeKrathseisAmaHandlers
    };
}

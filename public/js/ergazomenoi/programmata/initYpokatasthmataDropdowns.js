import { initTomDropdown } from '../../dropdown-item.js';

const REVIEW_BRANCH_ID = 'ypokatasthma';
const REVIEW_EMPLOYEE_ID = 'reviewEmployee';

function normalizedBranch(value) {
    const branch = String(value || '').trim();
    if (!branch || branch.toUpperCase() === 'ALL' || branch.includes(',')) return '';
    return /^\d{1,4}$/.test(branch) ? branch.padStart(4, '0') : '';
}

function tomFor(id) {
    return document.getElementById(id)?.tomselect || null;
}

function hiddenFor(id) {
    const hiddenId = document.getElementById(id)?.dataset.targetInput;
    return hiddenId ? document.getElementById(hiddenId) : null;
}

function currentBranch(id) {
    return normalizedBranch(tomFor(id)?.getValue?.() || hiddenFor(id)?.value);
}

async function ensureOption(id, branch) {
    const select = document.getElementById(id);
    const tom = tomFor(id);
    if (!select || !tom || !branch || tom.options?.[branch]) return;
    const response = await fetch(
        `${select.dataset.api}${select.dataset.api.includes('?') ? '&' : '?'}value=${encodeURIComponent(branch)}`
    );
    const payload = await response.json();
    const item = Array.isArray(payload.items)
        ? payload.items.find((candidate) => normalizedBranch(candidate?.value) === branch)
        : null;
    if (item) tom.addOption(item);
}

async function setBranch(id, value, silent = true) {
    const branch = normalizedBranch(value);
    const tom = tomFor(id);
    const hidden = hiddenFor(id);
    if (!tom) return;
    if (!branch) {
        tom.clear(silent);
        if (hidden) hidden.value = '';
        return;
    }
    await ensureOption(id, branch);
    tom.setValue(branch, silent);
    if (normalizedBranch(tom.getValue?.()) !== branch && tom.options?.[branch]) {
        tom.addItem(branch, silent);
    }
    const appliedBranch = normalizedBranch(tom.getValue?.());
    if (hidden) hidden.value = appliedBranch;
    return appliedBranch === branch;
}

function employeeOptionHtml(item, escape) {
    const code = escape(String(item?.kodikos || item?.value || '').trim());
    const name = escape([item?.eponymo, item?.onoma].filter(Boolean).join(' ').trim());
    return `<div>${code}${name ? ` — ${name}` : ''}</div>`;
}

function clearEmployeeSelection() {
    const select = document.getElementById(REVIEW_EMPLOYEE_ID);
    const hidden = document.getElementById('kodikos');
    select?.tomselect?.destroy();
    if (select) { select.replaceChildren(); select.disabled = true; }
    if (hidden) hidden.value = '';
}

function initializeEmployee(branch) {
    const select = document.getElementById(REVIEW_EMPLOYEE_ID);
    clearEmployeeSelection();
    if (!select || !branch) return null;
    select.disabled = false;
    const instance = initTomDropdown({ selector: `#${REVIEW_EMPLOYEE_ID}`,
        url: select.dataset.api,
        extraParams: { ypokatasthma: branch, energoi: 'true' }, minChars: 1,
        render: { option: employeeOptionHtml, item: employeeOptionHtml } });
    instance?.enable?.();
    return instance;
}

function bindBranch(id, onBranchChange) {
    const select = document.getElementById(id);
    const tom = tomFor(id);
    if (!select || !tom || select.__employmentReviewBranchSyncBound) return;
    select.__employmentReviewBranchSyncBound = true;
    let lastAppliedBranch = null;
    const applyBranch = (value) => {
        const hidden = hiddenFor(id);
        const branch = normalizedBranch(value);
        if (hidden) hidden.value = branch;
        if (lastAppliedBranch === branch) return;
        lastAppliedBranch = branch;
        onBranchChange?.(branch);
    };
    tom.on('change', (value) => applyBranch(value));
    tom.on('clear', () => applyBranch(''));
}

function initialize(id) {
    const select = document.getElementById(id);
    if (!select) return null;
    const key = `#${id}`;
    const existing = window.__tomInstances?.[key];
    if (existing && existing !== select.tomselect) existing.destroy();
    if (select.tomselect) return select.tomselect;
    return initTomDropdown({
        selector: key,
        url: select.dataset.api,
        extraParams: {},
        minChars: 0
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    initialize(REVIEW_BRANCH_ID);
    bindBranch(REVIEW_BRANCH_ID, initializeEmployee);
    const initialBranch = normalizedBranch(hiddenFor(REVIEW_BRANCH_ID)?.value);
    if (initialBranch) {
        await setBranch(REVIEW_BRANCH_ID, initialBranch, true);
        initializeEmployee(initialBranch);
    } else clearEmployeeSelection();

    window.EmploymentReviewBranches = {
        currentBranch,
        setBranch,
        diagnostics() {
            return {
                branch: currentBranch(REVIEW_BRANCH_ID),
                initialized: Boolean(tomFor(REVIEW_BRANCH_ID))
            };
        }
    };
    window.EmploymentReviewEmployees = {
        initialize: initializeEmployee,
        clear: clearEmployeeSelection,
        diagnostics() {
            return { branch: currentBranch(REVIEW_BRANCH_ID),
                value: String(document.getElementById('kodikos')?.value || ''),
                initialized: Boolean(tomFor(REVIEW_EMPLOYEE_ID)) };
        }
    };
});

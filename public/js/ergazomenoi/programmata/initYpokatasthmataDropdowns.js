import { initTomDropdown } from '../../dropdown-item.js';

const SIMPLE_ID = 'ypokatasthmata';
const ADVANCED_ID = 'ypokatasthma';
const IDS = [SIMPLE_ID, ADVANCED_ID];
let lastAdvancedBranch = '';
let syncQueue = Promise.resolve();

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

async function syncBranch(sourceId, targetId, expectedBranch) {
    if (currentBranch(sourceId) !== expectedBranch) return;
    if (sourceId === ADVANCED_ID && expectedBranch) {
        lastAdvancedBranch = expectedBranch;
    }
    await setBranch(targetId, expectedBranch, true);
}

function queueBranchSync(sourceId, targetId) {
    const expectedBranch = currentBranch(sourceId);
    syncQueue = syncQueue.then(() =>
        syncBranch(sourceId, targetId, expectedBranch)
    );
    return syncQueue;
}

function bindSync(id, targetId) {
    const select = document.getElementById(id);
    const tom = tomFor(id);
    if (!select || !tom || select.__employmentReviewBranchSyncBound) return;
    select.__employmentReviewBranchSyncBound = true;
    select.addEventListener('change', () => {
        const hidden = hiddenFor(id);
        if (hidden) hidden.value = normalizedBranch(tom.getValue?.());
        void queueBranchSync(id, targetId);
    });
    tom.on('clear', () => {
        const hidden = hiddenFor(id);
        if (hidden) hidden.value = '';
        void queueBranchSync(id, targetId);
    });
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

async function preselectAdvancedBranch() {
    await syncQueue;
    const simple = currentBranch(SIMPLE_ID);
    const fallback = simple || lastAdvancedBranch || currentBranch(ADVANCED_ID);
    if (fallback) {
        await setBranch(ADVANCED_ID, fallback, true);
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (currentBranch(ADVANCED_ID) !== fallback) {
            await setBranch(ADVANCED_ID, fallback, true);
        }
    }
    return fallback;
}

document.addEventListener('DOMContentLoaded', async () => {
    IDS.forEach(initialize);
    bindSync(SIMPLE_ID, ADVANCED_ID);
    bindSync(ADVANCED_ID, SIMPLE_ID);

    const initialSimple = normalizedBranch(hiddenFor(SIMPLE_ID)?.value);
    const initialAdvanced = normalizedBranch(hiddenFor(ADVANCED_ID)?.value);
    if (initialSimple) {
        await setBranch(SIMPLE_ID, initialSimple, true);
        await setBranch(ADVANCED_ID, initialSimple, true);
    } else if (initialAdvanced) {
        await setBranch(ADVANCED_ID, initialAdvanced, true);
        await setBranch(SIMPLE_ID, initialAdvanced, true);
    }

    window.EmploymentReviewBranches = {
        preselectAdvancedBranch,
        currentBranch,
        setBranch,
        diagnostics() {
            return {
                simple: currentBranch(SIMPLE_ID),
                advanced: currentBranch(ADVANCED_ID),
                simpleInitialized: Boolean(tomFor(SIMPLE_ID)),
                advancedInitialized: Boolean(tomFor(ADVANCED_ID))
            };
        }
    };
});

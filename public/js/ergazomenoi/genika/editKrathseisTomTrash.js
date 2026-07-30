const EDIT_KRATHSEIS_MAIN_PREFIX = 'select_krathsh_';

function krathseisTomValue(selectEl) {
    const value = selectEl?.tomselect?.getValue?.() ?? selectEl?.value ?? '';
    return Array.isArray(value) ? value[0] || '' : value;
}

function krathseisExternalTrash(scope, selectId) {
    return scope?.querySelector(`[data-tom-target="${selectId}"]`) || null;
}

function syncKrathseisExternalTrash(scope, selectId) {
    const selectEl = document.getElementById(selectId);
    const button = krathseisExternalTrash(scope, selectId);
    if (!selectEl || !button) return false;
    const hasValue = Boolean(String(krathseisTomValue(selectEl) || '').trim());
    button.hidden = !hasValue;
    return hasValue;
}

function unlockKrathseisTom(tom) {
    tom.enable();
    tom.wrapper?.classList.remove('disabled', 'ts-disabled-selected', 'ts-locked');
}

function reloadKrathseisTomOptions(selectEl) {
    const tom = selectEl.tomselect;
    if (!tom) return Promise.resolve();

    tom.nextPage = null;
    tom.clearOptions();
    tom.setTextboxValue?.('');
    tom.clearFilter?.();

    return new Promise((resolve) => {
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            tom.off?.('load', finish);
            tom.refreshOptions(false);
            tom.close();
            resolve();
        };
        tom.on?.('load', finish);
        tom.load('');
        queueMicrotask(() => {
            if (!tom.on) finish();
        });
    });
}

function clearKrathseisRowState(selectId) {
    const idNum = selectId.slice(EDIT_KRATHSEIS_MAIN_PREFIX.length);
    const hidden = document.getElementById(`krathsh_${idNum}`);
    const ama = document.getElementById(`ama_krathshs_${idNum}`);
    if (hidden) hidden.value = '';
    if (ama) {
        ama.value = '';
        ama.style.backgroundColor = '';
        ama.removeAttribute('data-copied-from');
    }
}

async function clearEditKrathseisTom(scope, selectId) {
    const selectEl = document.getElementById(selectId);
    const tom = selectEl?.tomselect;
    if (!selectEl || !tom) return;

    unlockKrathseisTom(tom);
    tom.ignoreFocusOpen = true;
    try {
        tom.clear(true);
        tom.close();
        tom.control_input?.blur();
        selectEl.value = '';

        if (selectId.startsWith(EDIT_KRATHSEIS_MAIN_PREFIX)) {
            clearKrathseisRowState(selectId);
            selectEl.closest('.row')?.classList.remove('d-none');
            window.rebuildKrathseisTableFromRows?.();
        } else {
            const hiddenId = selectEl.dataset.targetInput;
            const hidden = hiddenId ? document.getElementById(hiddenId) : null;
            if (hidden) hidden.value = '';
        }

        syncKrathseisExternalTrash(scope, selectId);
        await reloadKrathseisTomOptions(selectEl);
    } finally {
        tom.ignoreFocusOpen = false;
        unlockKrathseisTom(tom);
        tom.close();
    }
}

function removeInternalKrathseisResets(scope) {
    scope.querySelectorAll('.ts-single-reset-btn').forEach((button) => button.remove());
}

function initializeEditKrathseisTomTrash() {
    const scope = document.getElementById('editKrathseisTomDropdownScope');
    if (!scope) return;

    removeInternalKrathseisResets(scope);

    scope.querySelectorAll('select[data-external-reset="true"]').forEach((selectEl) => {
        if (selectEl.dataset.externalTrashSyncBound !== 'true') {
            selectEl.dataset.externalTrashSyncBound = 'true';
            selectEl.addEventListener('change', () => {
                if (selectEl.id.startsWith(EDIT_KRATHSEIS_MAIN_PREFIX)) {
                    const idNum = selectEl.id.slice(EDIT_KRATHSEIS_MAIN_PREFIX.length);
                    const hidden = document.getElementById(`krathsh_${idNum}`);
                    if (hidden) hidden.value = krathseisTomValue(selectEl) || '';
                    window.rebuildKrathseisTableFromRows?.();
                }
                syncKrathseisExternalTrash(scope, selectEl.id);
            });
        }
        syncKrathseisExternalTrash(scope, selectEl.id);
    });

    if (scope.dataset.externalTrashOwnerBound !== 'true') {
        scope.dataset.externalTrashOwnerBound = 'true';
        scope.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-tom-target]');
            if (!button || !scope.contains(button) || button.dataset.clearing === 'true') return;
            event.preventDefault();
            event.stopPropagation();
            button.dataset.clearing = 'true';
            try {
                await clearEditKrathseisTom(scope, button.dataset.tomTarget);
            } finally {
                delete button.dataset.clearing;
            }
        });
    }

    window.rebuildKrathseisTableFromRows?.();
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeEditKrathseisTomTrash();
        [100, 300, 700].forEach((delay) => {
            setTimeout(() => {
                initializeEditKrathseisTomTrash();
                window.rebuildKrathseisTableFromRows?.();
            }, delay);
        });
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        krathseisTomValue,
        syncKrathseisExternalTrash,
        reloadKrathseisTomOptions,
        clearEditKrathseisTom,
        initializeEditKrathseisTomTrash
    };
}

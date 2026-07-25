(function userPrivilegesManagement() {
    'use strict';

    const state = { userId: '', columns: [], rows: [], loaded: false, loading: false, saving: false, requestId: 0 };
    const elements = {};

    function getActiveCheckboxes(root) {
        return Array.from(root.querySelectorAll('input[type="checkbox"]:not(:disabled)'));
    }

    function toggleAllActive(root) {
        const boxes = getActiveCheckboxes(root);
        const shouldCheck = boxes.length > 0 && !boxes.every((box) => box.checked);
        boxes.forEach((box) => { box.checked = shouldCheck; });
        return shouldCheck;
    }

    function getColumnCheckboxes(root, key) {
        return Array.from(root.querySelectorAll(`input[type="checkbox"][data-key="${key}"]:not(:disabled)`));
    }

    function toggleColumn(root, key) {
        const boxes = getColumnCheckboxes(root, key);
        const shouldCheck = boxes.length > 0 && !boxes.every((box) => box.checked);
        boxes.forEach((box) => { box.checked = shouldCheck; });
        return shouldCheck;
    }

    function checkboxState(boxes) {
        const checked = boxes.filter((box) => box.checked).length;
        return {
            all: boxes.length > 0 && checked === boxes.length,
            partial: checked > 0 && checked < boxes.length
        };
    }

    function setStatus(message, kind) {
        elements.status.textContent = message;
        elements.status.dataset.kind = kind || 'info';
    }

    function setBusy(busy) {
        state.loading = busy;
        if (busy) window.showLoader?.('', 'Φόρτωση δικαιωμάτων...');
        else window.hideLoader?.();
        updateControls();
    }

    function updateControls() {
        const active = getActiveCheckboxes(elements.body);
        elements.update.disabled = !state.loaded || state.loading || state.saving || active.length === 0;
        elements.toggle.disabled = !state.loaded || state.loading || state.saving || active.length === 0;
        const allChecked = active.length > 0 && Array.from(active).every((box) => box.checked);
        elements.toggle.textContent = allChecked ? 'Αποεπιλογή όλων' : 'Επιλογή όλων';
        elements.toggle.setAttribute('aria-pressed', allChecked ? 'true' : 'false');
        elements.head.querySelectorAll('.user-privileges-column-toggle').forEach((button) => {
            const columnState = checkboxState(getColumnCheckboxes(elements.body, button.dataset.privilegeKey));
            const hasActiveCheckboxes = getColumnCheckboxes(elements.body, button.dataset.privilegeKey).length > 0;
            button.setAttribute('aria-pressed', columnState.all ? 'true' : 'false');
            button.dataset.state = columnState.partial ? 'partial' : (columnState.all ? 'all' : 'none');
            button.disabled = !hasActiveCheckboxes || state.loading || state.saving;
            button.classList.toggle('is-active', columnState.all);
            button.classList.toggle('is-partial', columnState.partial);
        });
    }

    function clearTable(message) {
        state.columns = [];
        state.rows = [];
        state.loaded = false;
        elements.head.replaceChildren();
        elements.body.replaceChildren();
        elements.empty.hidden = true;
        elements.role.value = '';
        setStatus(message || 'Επιλέξτε χρήστη για να εμφανιστούν τα δικαιώματα.', 'info');
        updateControls();
    }

    function checkboxId(rowId, key) {
        return `user-privileges-${rowId}-${key}`;
    }

    function getFormDisplayLabel(row) {
        return typeof row?.formLabel === 'string' && row.formLabel.trim()
            ? row.formLabel.trim()
            : 'Μη έγκυρη ρύθμιση φόρμας';
    }

    function renderTableHead(columns) {
        const headerRow = document.createElement('tr');
        const formHeader = document.createElement('th');
        formHeader.scope = 'col';
        formHeader.textContent = 'Λειτουργία';
        headerRow.appendChild(formHeader);
        columns.forEach((key) => {
            const th = document.createElement('th');
            th.scope = 'col';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'user-privileges-column-toggle';
            button.dataset.privilegeKey = key;
            button.dataset.state = 'none';
            button.setAttribute('aria-label', `Επιλογή ή αποεπιλογή όλων στη στήλη ${key}`);
            button.setAttribute('aria-pressed', 'false');
            button.textContent = key;
            th.appendChild(button);
            headerRow.appendChild(th);
        });
        elements.head.replaceChildren(headerRow);
    }

    function renderTable(data) {
        state.columns = Array.isArray(data.columns) ? data.columns.slice() : [];
        state.rows = Array.isArray(data.rows) ? data.rows.slice() : [];
        elements.role.value = data.user?.roleLabel || '';
        elements.body.replaceChildren();

        if (!state.rows.length) {
            state.loaded = true;
            elements.empty.hidden = false;
            elements.empty.textContent = 'Ο κατάλογος φορμών δεν έχει ενεργές εγγραφές. Απαιτείται ρύθμιση καταλόγου.';
            setStatus('Δεν υπάρχουν ενεργές φόρμες στον κατάλογο δικαιωμάτων.', 'warning');
            updateControls();
            return;
        }

        elements.empty.hidden = true;
        renderTableHead(state.columns);

        state.rows.forEach((row) => {
            const tr = document.createElement('tr');
            tr.dataset.rowId = row.id || '';
            tr.dataset.form = row.form;
            const formCell = document.createElement('th');
            formCell.scope = 'row';
            formCell.className = 'user-privileges-form-cell user-privileges-form-name';
            formCell.textContent = getFormDisplayLabel(row);
            formCell.title = getFormDisplayLabel(row);
            tr.appendChild(formCell);
            const applicable = new Set(row.applicableKeys || []);
            state.columns.forEach((key) => {
                const td = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'form-check-input user-privileges-checkbox';
                checkbox.id = checkboxId(row.id || row.form, key);
                checkbox.dataset.key = key;
                checkbox.checked = row.privileges?.[key] === true;
                checkbox.disabled = !applicable.has(key);
                checkbox.setAttribute('aria-label', `${getFormDisplayLabel(row)}: ${key}`);
                td.classList.toggle('user-privileges-not-applicable', checkbox.disabled);
                td.appendChild(checkbox);
                tr.appendChild(td);
            });
            elements.body.appendChild(tr);
        });
        state.loaded = true;
        setStatus(`Φορτώθηκαν ${state.rows.length} εγγραφές δικαιωμάτων.`, 'success');
        updateControls();
    }

    async function loadUser(userId) {
        const requestId = ++state.requestId;
        state.userId = userId || '';
        clearTable(userId ? 'Φόρτωση δικαιωμάτων...' : undefined);
        if (!userId) return;
        setBusy(true);
        try {
            const response = await fetch(`/admin/user-privileges/${encodeURIComponent(userId)}`, { headers: { Accept: 'application/json' } });
            const data = await response.json();
            if (requestId !== state.requestId) return;
            if (!response.ok) throw new Error(data.message || 'Αποτυχία φόρτωσης δικαιωμάτων');
            renderTable(data);
        } catch (error) {
            if (requestId !== state.requestId) return;
            clearTable('Δεν ήταν δυνατή η φόρτωση των δικαιωμάτων.');
            await window.Swal?.fire('Σφάλμα', error.message, 'error');
        } finally {
            if (requestId === state.requestId) setBusy(false);
        }
    }

    function collectRows() {
        return Array.from(elements.body.querySelectorAll('tr[data-row-id]')).map((tr) => {
            const privileges = Object.create(null);
            tr.querySelectorAll('input[data-key]:not(:disabled)').forEach((box) => { privileges[box.dataset.key] = box.checked; });
            return { id: tr.dataset.rowId || null, form: tr.dataset.form, privileges };
        });
    }

    function canStartSave(currentState) {
        return !currentState.saving && !currentState.loading && currentState.loaded && Boolean(currentState.userId);
    }

    async function save() {
        if (!canStartSave(state)) return;
        state.saving = true;
        updateControls();
        window.showLoader?.('', 'Αποθήκευση δικαιωμάτων...');
        try {
            const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
            const response = await fetch(`/admin/user-privileges/${encodeURIComponent(state.userId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrf },
                body: JSON.stringify({ rows: collectRows() })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Η ενημέρωση απέτυχε');
            await window.Swal?.fire('Επιτυχία', data.message, 'success');
            await loadUser(state.userId);
        } catch (error) {
            await window.Swal?.fire('Σφάλμα', error.message, 'error');
        } finally {
            state.saving = false;
            window.hideLoader?.();
            updateControls();
        }
    }

    function bindTomSelect() {
        const instance = elements.user.tomselect;
        if (!instance || instance.__userPrivilegesBound) return false;
        instance.__userPrivilegesBound = true;
        instance.on('change', (value) => loadUser(String(value || '')));
        return true;
    }

    document.addEventListener('DOMContentLoaded', () => {
        elements.user = document.getElementById('userPrivilegesUser');
        elements.role = document.getElementById('userPrivilegesRole');
        elements.status = document.getElementById('userPrivilegesStatus');
        elements.head = document.getElementById('userPrivilegesTableHead');
        elements.body = document.getElementById('userPrivilegesTableBody');
        elements.empty = document.getElementById('userPrivilegesEmpty');
        elements.toggle = document.getElementById('userPrivilegesToggleAll');
        elements.update = document.getElementById('userPrivilegesUpdate');
        if (!Object.values(elements).every(Boolean)) return;

        elements.toggle.addEventListener('click', () => {
            toggleAllActive(elements.body);
            updateControls();
        });
        elements.head.addEventListener('click', (event) => {
            const button = event.target.closest('.user-privileges-column-toggle');
            if (!button || !elements.head.contains(button) || button.disabled) return;
            toggleColumn(elements.body, button.dataset.privilegeKey);
            updateControls();
        });
        elements.body.addEventListener('change', (event) => {
            if (event.target.matches('input[type="checkbox"]')) updateControls();
        });
        elements.update.addEventListener('click', save);
        if (!bindTomSelect()) {
            const timer = window.setInterval(() => { if (bindTomSelect()) window.clearInterval(timer); }, 50);
            window.setTimeout(() => window.clearInterval(timer), 5000);
        }
        clearTable();
    });

    window.UserPrivilegesManagement = {
        loadUser,
        collectRows,
        updateControls,
        getState: () => ({ ...state }),
        test: {
            canStartSave,
            checkboxState,
            getActiveCheckboxes,
            getColumnCheckboxes,
            getFormDisplayLabel,
            renderTableHead,
            toggleAllActive,
            toggleColumn
        }
    };
})();

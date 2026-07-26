(function userPrivilegesManagement() {
    'use strict';

    const state = {
        userId: '',
        columns: [],
        rows: [],
        tree: [],
        collapsedPaths: new Set(),
        loaded: false,
        loading: false,
        saving: false,
        requestId: 0
    };
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
        return typeof row?.navigation?.itemLabel === 'string' && row.navigation.itemLabel.trim()
            ? row.navigation.itemLabel.trim()
            : 'Μη έγκυρη ρύθμιση φόρμας';
    }

    function hierarchyPathKey(parentPath, key) {
        return parentPath ? `${parentPath}/${key}` : key;
    }

    function validateNavigationMetadata(row) {
        const navigation = row?.navigation;
        if (!row || typeof row.form !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(row.form) ||
            !navigation || typeof navigation !== 'object' ||
            typeof navigation.itemLabel !== 'string' || !navigation.itemLabel.trim() ||
            !Number.isInteger(navigation.itemOrder) || navigation.itemOrder < 0 ||
            !Array.isArray(navigation.ancestors) || navigation.ancestors.length === 0) {
            throw new Error('Μη έγκυρη ρύθμιση πλοήγησης δικαιωμάτων');
        }
        navigation.ancestors.forEach((ancestor) => {
            if (!ancestor || !/^[a-z][a-z0-9-]*$/.test(ancestor.key || '') ||
                typeof ancestor.label !== 'string' || !ancestor.label.trim() ||
                !Number.isInteger(ancestor.order) || ancestor.order < 0) {
                throw new Error('Μη έγκυρη ρύθμιση πλοήγησης δικαιωμάτων');
            }
        });
        return true;
    }

    function buildPrivilegeNavigationTree(rows) {
        if (!Array.isArray(rows)) throw new Error('Μη έγκυρη ρύθμιση πλοήγησης δικαιωμάτων');
        const roots = [];
        const groups = new Map();
        const forms = new Set();
        const siblingOrders = new Map();

        rows.forEach((row) => {
            validateNavigationMetadata(row);
            if (forms.has(row.form)) throw new Error('Διπλή φόρμα στην πλοήγηση δικαιωμάτων');
            forms.add(row.form);
            let parentPath = '';
            let children = roots;
            row.navigation.ancestors.forEach((ancestor, depth) => {
                const pathKey = hierarchyPathKey(parentPath, ancestor.key);
                const orderKey = `${parentPath}\u0000${ancestor.order}`;
                if (siblingOrders.has(orderKey) && siblingOrders.get(orderKey) !== `group:${pathKey}`) {
                    throw new Error('Διπλή σειρά στην πλοήγηση δικαιωμάτων');
                }
                siblingOrders.set(orderKey, `group:${pathKey}`);
                let group = groups.get(pathKey);
                if (!group) {
                    group = {
                        type: 'group',
                        key: ancestor.key,
                        pathKey,
                        label: ancestor.label.trim(),
                        order: ancestor.order,
                        depth,
                        children: []
                    };
                    groups.set(pathKey, group);
                    children.push(group);
                } else if (group.label !== ancestor.label.trim() || group.order !== ancestor.order) {
                    throw new Error('Ασυνεπής διαδρομή πλοήγησης δικαιωμάτων');
                }
                parentPath = pathKey;
                children = group.children;
            });
            const leafOrderKey = `${parentPath}\u0000${row.navigation.itemOrder}`;
            if (siblingOrders.has(leafOrderKey)) throw new Error('Διπλή σειρά στην πλοήγηση δικαιωμάτων');
            siblingOrders.set(leafOrderKey, `form:${row.form}`);
            children.push({
                type: 'form',
                form: row.form,
                order: row.navigation.itemOrder,
                depth: row.navigation.ancestors.length,
                row
            });
        });

        function sortNodes(nodes) {
            nodes.sort((left, right) => left.order - right.order ||
                (left.pathKey || left.form).localeCompare(right.pathKey || right.form));
            nodes.forEach((node) => { if (node.type === 'group') sortNodes(node.children); });
        }
        sortNodes(roots);
        return roots;
    }

    function collectHierarchyPaths(tree, paths = new Set()) {
        tree.forEach((node) => {
            if (node.type !== 'group') return;
            paths.add(node.pathKey);
            collectHierarchyPaths(node.children, paths);
        });
        return paths;
    }

    function isDescendantPath(pathKey, possibleAncestor) {
        return pathKey.startsWith(`${possibleAncestor}/`);
    }

    function toggleHierarchyPath(collapsedPaths, pathKey) {
        if (collapsedPaths.has(pathKey)) collapsedPaths.delete(pathKey);
        else collapsedPaths.add(pathKey);
        return !collapsedPaths.has(pathKey);
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

    function renderHierarchyHeaderRow(node, columns, collapsedPaths, documentRef = document) {
        const tr = documentRef.createElement('tr');
        tr.className = 'user-privileges-hierarchy-row';
        tr.dataset.hierarchyPath = node.pathKey;
        tr.style.setProperty('--user-privileges-depth', String(node.depth));
        tr.dataset.hierarchyDepth = String(node.depth);
        const cell = documentRef.createElement('th');
        cell.scope = 'rowgroup';
        cell.colSpan = 1 + columns.length;
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = 'user-privileges-hierarchy-toggle';
        button.dataset.hierarchyPath = node.pathKey;
        const expanded = !collapsedPaths.has(node.pathKey);
        button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        button.setAttribute('aria-label', `${expanded ? 'Σύμπτυξη' : 'Ανάπτυξη'} ενότητας ${node.label}`);
        const chevron = documentRef.createElement('span');
        chevron.className = 'user-privileges-hierarchy-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.textContent = expanded ? '▾' : '▸';
        const label = documentRef.createElement('span');
        label.textContent = node.label;
        button.appendChild(chevron);
        button.appendChild(label);
        cell.appendChild(button);
        tr.appendChild(cell);
        return tr;
    }

    function renderPrivilegeFormRow(row, columns, depth, documentRef = document) {
        const tr = documentRef.createElement('tr');
        tr.dataset.privilegeFormRow = 'true';
        tr.dataset.rowId = row.id || '';
        tr.dataset.form = row.form;
        tr.dataset.hierarchyParent = row.navigation.ancestors.map((ancestor) => ancestor.key).join('/');
        tr.style.setProperty('--user-privileges-depth', String(depth));
        const formCell = documentRef.createElement('th');
        formCell.scope = 'row';
        formCell.className = 'user-privileges-form-cell user-privileges-form-name';
        formCell.textContent = getFormDisplayLabel(row);
        formCell.title = getFormDisplayLabel(row);
        tr.appendChild(formCell);
        const applicable = new Set(row.applicableKeys || []);
        columns.forEach((key) => {
            const td = documentRef.createElement('td');
            const checkbox = documentRef.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input custom-checkbox checkbox-class user-privileges-checkbox';
            checkbox.id = checkboxId(row.id || row.form, key);
            checkbox.dataset.key = key;
            checkbox.checked = row.privileges?.[key] === true;
            checkbox.disabled = !applicable.has(key);
            checkbox.setAttribute('aria-label', `${getFormDisplayLabel(row)}: ${key}`);
            td.classList.toggle('user-privileges-not-applicable', checkbox.disabled);
            td.appendChild(checkbox);
            tr.appendChild(td);
        });
        return tr;
    }

    function renderTreeRows(tree, columns, collapsedPaths, body, documentRef = document) {
        function visit(nodes, ancestorCollapsed) {
            nodes.forEach((node) => {
                if (node.type === 'group') {
                    const header = renderHierarchyHeaderRow(node, columns, collapsedPaths, documentRef);
                    header.hidden = ancestorCollapsed;
                    body.appendChild(header);
                    visit(node.children, ancestorCollapsed || collapsedPaths.has(node.pathKey));
                } else {
                    const tr = renderPrivilegeFormRow(node.row, columns, node.depth, documentRef);
                    tr.hidden = ancestorCollapsed;
                    body.appendChild(tr);
                }
            });
        }
        visit(tree, false);
    }

    function renderBody() {
        elements.body.replaceChildren();
        renderTreeRows(state.tree, state.columns, state.collapsedPaths, elements.body);
    }

    function updateHierarchyVisibility(body, collapsedPaths) {
        body.querySelectorAll('tr[data-hierarchy-path]').forEach((tr) => {
            const pathKey = tr.dataset.hierarchyPath;
            tr.hidden = Array.from(collapsedPaths).some((collapsed) =>
                collapsed !== pathKey && isDescendantPath(pathKey, collapsed));
            const button = tr.querySelector('.user-privileges-hierarchy-toggle');
            if (button) {
                const expanded = !collapsedPaths.has(pathKey);
                button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                button.setAttribute('aria-label', `${expanded ? 'Σύμπτυξη' : 'Ανάπτυξη'} ενότητας ${button.lastChild?.textContent || ''}`);
                const chevron = button.querySelector('.user-privileges-hierarchy-chevron');
                if (chevron) chevron.textContent = expanded ? '▾' : '▸';
            }
        });
        body.querySelectorAll('tr[data-privilege-form-row="true"]').forEach((tr) => {
            tr.hidden = Array.from(collapsedPaths).some((collapsed) =>
                tr.dataset.hierarchyParent === collapsed ||
                isDescendantPath(tr.dataset.hierarchyParent, collapsed));
        });
    }

    function renderTable(data) {
        state.columns = Array.isArray(data.columns) ? data.columns.slice() : [];
        state.rows = Array.isArray(data.rows) ? data.rows.slice() : [];
        state.tree = buildPrivilegeNavigationTree(state.rows);
        const validPaths = collectHierarchyPaths(state.tree);
        state.collapsedPaths.forEach((pathKey) => {
            if (!validPaths.has(pathKey)) state.collapsedPaths.delete(pathKey);
        });
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
        renderBody();
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

    function collectPrivilegeRows(body) {
        return Array.from(body.querySelectorAll('tr[data-privilege-form-row="true"]')).map((tr) => {
            const privileges = Object.create(null);
            tr.querySelectorAll('input[data-key]:not(:disabled)').forEach((box) => { privileges[box.dataset.key] = box.checked; });
            return { id: tr.dataset.rowId || null, form: tr.dataset.form, privileges };
        });
    }

    function collectRows() {
        return collectPrivilegeRows(elements.body);
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
        elements.body.addEventListener('click', (event) => {
            const button = event.target.closest('.user-privileges-hierarchy-toggle');
            if (!button || !elements.body.contains(button)) return;
            toggleHierarchyPath(state.collapsedPaths, button.dataset.hierarchyPath);
            updateHierarchyVisibility(elements.body, state.collapsedPaths);
            updateControls();
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
            buildPrivilegeNavigationTree,
            collectPrivilegeRows,
            collectHierarchyPaths,
            getActiveCheckboxes,
            getColumnCheckboxes,
            getFormDisplayLabel,
            hierarchyPathKey,
            isDescendantPath,
            renderHierarchyHeaderRow,
            renderPrivilegeFormRow,
            renderTreeRows,
            renderTableHead,
            toggleHierarchyPath,
            toggleAllActive,
            toggleColumn,
            updateHierarchyVisibility,
            validateNavigationMetadata
        }
    };
})();

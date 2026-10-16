/* Presentation only. Keep existing controls, column nodes, listeners and form ownership. */
(function () {
    'use strict';
    // Τοπική δοκιμή εμφάνισης στη 5001: true για επαναφορά της αυτόματης ομαδοποίησης.
    const automaticFieldGroupingEnabled = false;
    const fieldSelector = 'input:not([type="hidden"]), select, textarea';
    const excluded = '.employee-schedule-day, .employee-schedule-pair, .employee-retention-row, .input-group';
    const ignorable = e => e.matches('input[type="hidden"], script, template')
        || (e.tagName === 'DIV' && !e.children.length && !e.textContent.trim());
    function nextColumn(column) {
        let next = column.nextElementSibling;
        while (next && ignorable(next)) next = next.nextElementSibling;
        return next;
    }

    function columnOf(element, row) {
        let column = element;
        while (column && column.parentElement !== row) column = column.parentElement;
        return column?.tagName === 'DIV' ? column : null;
    }

    function spanOf(column) {
        for (const name of column.classList) {
            const match = /^col-(\d+)((?:-\d+)+)?$/.exec(name);
            if (match) return Number(match[1] + (match[2] ? '.' + match[2].replaceAll('-', '') : ''));
        }
        return 3;
    }

    function groupRow(row) {
        if (!automaticFieldGroupingEnabled) return;
        if (row.matches(excluded) || row.closest('table, .payroll-entry-table, #employmentReviewWorkspace')) return;
        const columns = [...row.children];
        for (const labelColumn of columns) {
            if (labelColumn.parentElement !== row || labelColumn.matches('.payroll-field-group')) continue;
            const labels = [...labelColumn.querySelectorAll('label, [data-field-group-label]')].filter(l => !l.closest('.hover-modal, .modal, table'));
            if (labels.length !== 1) continue;
            const label = labels[0];
            if (labelColumn.querySelector(fieldSelector)) {
                if (label.control && labelColumn.contains(label.control)
                    && !label.control.matches('[type="checkbox"],[type="radio"]') && !labelColumn.querySelector('.row')) {
                    labelColumn.classList.add('payroll-contained-field');
                }
                continue;
            }
            let field = label.control;
            // Tom Select retargets `for` to its generated control. Recover the owning select.
            if (!field && label.htmlFor) {
                const target = document.getElementById(label.htmlFor);
                field = [...row.querySelectorAll('select, input')].find(e => e.tomselect
                    && (e.tomselect.control === target || e.tomselect.control_input === target));
            }
            const next = nextColumn(labelColumn);
            const radioGroup = label.hasAttribute('data-field-group-label') && next?.matches('[role="radiogroup"]') ? next : null;
            if (radioGroup) field = radioGroup;
            const displayValue = !label.htmlFor && !next?.querySelector(fieldSelector)
                && next?.querySelector('[data-field-display], label.form-control, label:not([for]):not(.col-form-label)');
            if (displayValue) field = displayValue;
            // Old templates sometimes omit `for`. Infer only an unambiguous adjacent field.
            if (!label.htmlFor && next && next.tagName === 'DIV') {
                const candidates = [...next.querySelectorAll(fieldSelector)];
                if (candidates.length === 1 && candidates[0].id
                    && [...next.querySelectorAll('label')].every(l => l.htmlFor === candidates[0].id)) {
                    field = candidates[0];
                    label.htmlFor = field.id;
                }
            }
            if (!field || !row.contains(field)) continue;
            const fieldColumn = columnOf(field, row);
            if (!fieldColumn || fieldColumn === labelColumn) continue;
            let adjacent = true;
            for (let column = labelColumn.nextElementSibling; column && column !== fieldColumn; column = column.nextElementSibling) {
                const hints = [...column.querySelectorAll('label')];
                const fields = [...column.querySelectorAll(fieldSelector)];
                if (!ignorable(column) && !(column.tagName === 'DIV'
                    && hints.every(l => l.htmlFor === field.id)
                    && fields.every(f => f.id.startsWith(field.id))
                    && (hints.length || fields.length))) adjacent = false;
            }
            if (!adjacent) continue;
            if ((!radioGroup && [...fieldColumn.querySelectorAll('label')].some(l => l !== displayValue && l.htmlFor !== field.id))
                || fieldColumn.matches('.row, .payroll-field-group')) continue;
            const group = document.createElement('div');
            group.className = 'payroll-field-group';
            const span = Math.min(12, spanOf(labelColumn) + spanOf(fieldColumn));
            group.style.setProperty('--field-columns', span);
            group.style.setProperty('--field-min', span <= 3 ? '8rem' : span <= 4 ? '10rem' : '14rem');
            labelColumn.before(group);
            labelColumn.classList.add('payroll-field-label');
            fieldColumn.classList.add('payroll-field-control');
            const between = [];
            for (let node = labelColumn.nextSibling; node && node !== fieldColumn; node = node.nextSibling) between.push(node);
            group.append(labelColumn, ...between, fieldColumn);
            for (const column of group.children) if (column.tagName === 'DIV' && column.querySelector('label')
                && !column.querySelector(fieldSelector)) column.classList.add('payroll-field-label');
            const controls = [...group.children].filter(c => c.tagName === 'DIV' && c.querySelector(fieldSelector));
            if (controls.length > 1) {
                const inputs = document.createElement('div');
                inputs.className = 'payroll-field-inputs';
                controls[0].before(inputs);
                for (const column of controls) { column.classList.add('payroll-field-control'); inputs.append(column); }
            }
            // File/search/preview actions belong to this field, before the next label.
            const actionColumn = nextColumn(group);
            if (actionColumn?.tagName === 'DIV' && !actionColumn.querySelector('label, input:not([type="hidden"],[type="file"]), select, textarea')
                && actionColumn.querySelector('.btn, .pdf-button-wrapper')) {
                actionColumn.classList.add('payroll-field-actions');
                group.append(actionColumn);
            }
            row.classList.add('payroll-field-row');
        }
        if ([...row.children].some(c => c.querySelector('.pdf-button-wrapper'))
            && [...row.children].every(c => ignorable(c) || (c.tagName === 'DIV'
                && c.querySelector('.pdf-button-wrapper') && !c.querySelector('label, ' + fieldSelector)))) row.classList.add('payroll-action-row');
        if (row.matches('.payroll-field-row, .payroll-action-row')) {
            for (const column of row.children) {
                if (column.tagName === 'DIV' && !column.children.length && !column.textContent.trim()) {
                    column.classList.add('payroll-field-spacer');
                }
            }
        }
    }

    function layout(scope) {
        if (scope.matches?.('.row.form-group')) groupRow(scope);
        scope.querySelectorAll('.row.form-group').forEach(groupRow);
        scope.querySelectorAll('.row.form-group > div > .d-flex:has(> span.badge)').forEach(context => {
            if (!context.querySelector(fieldSelector)) context.classList.add('payroll-context-row');
        });
        // Tax rows are a description with annual/monthly values, not independent field pairs.
        scope.querySelectorAll('.payroll-entry-table .foroi-body-row:not(.payroll-tax-heading)').forEach(row => {
            const label = row.querySelector('label');
            const fields = [...row.querySelectorAll(fieldSelector)];
            if (!label || fields.length < 1 || fields.length > 2) return;
            label.id ||= 'payrollTaxLabel_' + fields[0].id;
            row.classList.add('payroll-tax-row');
            row.setAttribute('role', 'group');
            row.setAttribute('aria-labelledby', label.id);
            fields.forEach((field, index) => {
                const annual = fields.length === 2 && index === 0;
                field.parentElement.classList.add(annual ? 'payroll-tax-annual' : 'payroll-tax-monthly');
                field.setAttribute('aria-labelledby', label.id + ' ' + (annual ? 'payrollTaxAnnualHeading' : 'payrollTaxMonthlyHeading'));
            });
        });
    }

    function syncGroupVisibility(group) {
        if (!group) return;
        const columns = [...group.querySelectorAll('.payroll-field-label, .payroll-field-control, .payroll-field-actions')];
        group.classList.toggle('payroll-field-group-empty', columns.length > 0
            && columns.every(column => getComputedStyle(column).display === 'none'));
    }

    function layoutTables(main) {
        for (const header of main.querySelectorAll('#myTableHeader')) {
            if (header.closest('.maintenance-table-scroll, .payroll-table-scroll')) continue;
            const card = header.closest('.card');
            if (!card) continue;
            const bodyTable = card.querySelector('#myTable');
            const body = bodyTable?.closest('.card-body');
            const host = columnOf(header, card);
            // Only the established separate-header pattern, with adjacent sibling containers.
            if (!host || !body || host.nextElementSibling !== body || body.parentElement !== card) continue;
            const scroll = document.createElement('div');
            scroll.className = 'payroll-table-scroll';
            const inner = document.createElement('div');
            inner.className = 'payroll-table-inner';
            host.classList.add('payroll-table-header');
            inner.style.setProperty('--payroll-table-width', Math.max(52, header.querySelectorAll('th').length * 8) + 'rem');
            host.before(scroll);
            scroll.append(inner);
            inner.append(host, body);
        }
        for (const table of main.querySelectorAll('.card-body table#myTable:has(thead)')) {
            table.classList.add('payroll-scroll-table');
            table.style.setProperty('--payroll-table-width', Math.max(52, table.querySelectorAll('thead th').length * 8) + 'rem');
        }
    }

    function initialize() {
        const main = document.querySelector('main.payroll-form-layout');
        if (!main) return;
        layout(main);
        layoutTables(main);
        main.querySelectorAll('.payroll-field-group').forEach(syncGroupVisibility);
        const cards = () => main.querySelectorAll('.card:has(.card-body):has(.card-footer)');
        let frame;
        function scheduleCardSpace() {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const header = document.querySelector('header.payroll-navigation');
                if (header) {
                    const height = header.getBoundingClientRect().height + 'px';
                    document.documentElement.style.setProperty('--app-header-h', height);
                    document.documentElement.style.setProperty('--navH', height);
                }
                main.style.setProperty('--payroll-main-top', main.getBoundingClientRect().top + 'px');
                const footerTop = document.querySelector('.footer')?.getBoundingClientRect().top || innerHeight;
                for (const card of cards()) {
                    if (card.closest('.modal, #employmentReviewWorkspace') || !card.getClientRects().length) continue;
                    card.classList.add('payroll-scroll-card');
                    const isUserAdministrationCard = card.matches('.user-management-page > .user-management-card, .user-privileges-layout .user-privileges-card, .disconnect-users-page > .disconnect-users-card, .companies-management-page .companies-management-card');
                    // Οι εγκεκριμένες κάρτες διαχείρισης μοιράζονται αυτή τη μέτρηση ύψους.
                    // Διατηρείται η εγκεκριμένη πρόβλεψη σκιάς 30px και καθαρό κενό 4px.
                    const space = isUserAdministrationCard
                        ? Math.max(0, footerTop - card.getBoundingClientRect().top - (30 + 4))
                        : Math.max(192, Math.min(innerHeight, footerTop, main.getBoundingClientRect().bottom)
                            - (card.getBoundingClientRect().top + main.scrollTop) - 20);
                    card.style.setProperty('--payroll-card-space', space + 'px');
                    const inlineTableHeader = card.querySelector(':scope > .maintenance-table-scroll > .maintenance-table-companies > #myTable > thead');
                    if (inlineTableHeader) {
                        card.style.setProperty('--payroll-inline-table-header-height', inlineTableHeader.getBoundingClientRect().height + 'px');
                    }
                    const tableScroll = card.querySelector(':scope > .payroll-table-scroll');
                    if (tableScroll) {
                        const otherHeight = [...card.children].filter(e => e !== tableScroll && e.getClientRects().length)
                            .reduce((total, e) => total + e.getBoundingClientRect().height
                                + parseFloat(getComputedStyle(e).marginTop) + parseFloat(getComputedStyle(e).marginBottom), 2);
                        tableScroll.style.setProperty('--payroll-table-height', Math.max(100, space - otherHeight) + 'px');
                        const tableBody = tableScroll.querySelector('.card-body');
                        tableScroll.style.setProperty('--payroll-table-gutter', Math.max(0, tableBody.offsetWidth - tableBody.clientWidth) + 'px');
                    }
                }
            });
        }
        const resizeObserver = new ResizeObserver(scheduleCardSpace);
        resizeObserver.observe(main);
        const userManagementPage = main.querySelector(':scope > .user-management-page');
        const userPrivilegesPage = main.querySelector(':scope > .user-privileges-layout');
        const disconnectUsersPage = main.querySelector(':scope > .disconnect-users-page');
        const companiesManagementPage = main.querySelector(':scope > .companies-management-page');
        if (userManagementPage || userPrivilegesPage || disconnectUsersPage || companiesManagementPage) {
            const footer = document.querySelector('.footer');
            if (footer) resizeObserver.observe(footer);
            const search = (userManagementPage || companiesManagementPage)?.firstElementChild;
            if (search) resizeObserver.observe(search);
            if (companiesManagementPage) {
                const companiesFilter = companiesManagementPage.querySelector('#companiesFilterForm');
                if (companiesFilter) resizeObserver.observe(companiesFilter);
                resizeObserver.observe(companiesManagementPage.querySelector('.card-footer'));
            }
            window.addEventListener('load', scheduleCardSpace, { once: true });
        }
        main.querySelectorAll('.payroll-table-inner > .card-body').forEach(body => resizeObserver.observe(body));
        if (document.querySelector('header')) resizeObserver.observe(document.querySelector('header'));
        window.addEventListener('resize', scheduleCardSpace);
        main.addEventListener('click', event => { if (event.target.closest('.menu_Links')) scheduleCardSpace(); });
        main.addEventListener('pointerover', event => {
            const label = event.target.closest('.hover-label');
            const popup = label?.nextElementSibling;
            if (!popup?.matches('.hover-modal')) return;
            const box = label.getBoundingClientRect();
            const footer = document.querySelector('.footer')?.getBoundingClientRect().top || innerHeight;
            const below = Math.min(innerHeight, footer) - box.bottom - 16;
            const above = box.top - (document.querySelector('header')?.getBoundingClientRect().bottom || 0) - 16;
            const upward = below < 160 && above > below;
            popup.classList.toggle('payroll-hover-above', upward);
            popup.style.setProperty('--payroll-hover-space', Math.max(0, upward ? above : below) + 'px');
        });
        scheduleCardSpace();
        // Process newly inserted form rows, never option-list mutations or values.
        const observer = new MutationObserver(records => {
            for (const record of records) if (record.type === 'attributes'
                && record.target.matches('.payroll-field-label, .payroll-field-control, .payroll-field-actions')) {
                syncGroupVisibility(record.target.closest('.payroll-field-group'));
            }
            for (const record of records) for (const node of record.addedNodes) {
                if (node.nodeType === 1 && node.isConnected && !node.closest('.ts-wrapper, table')) layout(node);
            }
            if ((userManagementPage || userPrivilegesPage || disconnectUsersPage || companiesManagementPage) && records.some(r => r.type === 'childList'
                && (r.target === main || r.target.closest?.('.payroll-flash-messages')))) scheduleCardSpace();
            if (records.some(r => r.target.matches?.('.sections') || [...r.addedNodes].some(n => n.nodeType === 1 && n.matches('.card')))) scheduleCardSpace();
        });
        observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();

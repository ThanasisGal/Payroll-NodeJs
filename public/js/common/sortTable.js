// /common/sortTable.js
(function () {
    'use strict';
    const headers = header => Array.from(header?.querySelectorAll('th') || []);
    function getSortState(table, header) {
        if (!table) return null;
        const column = headers(header).findIndex(th => ['asc', 'desc'].includes(th.dataset.dir));
        const th = headers(header)[column];
        return th ? { key: th.dataset.sortKey, column, direction: th.dataset.dir } : null;
    }

    document.addEventListener('DOMContentLoaded', function () {
    // click στα headers
    document.querySelectorAll('#myTableHeader th').forEach((th, index) => {
		th.addEventListener('click', function () {
			applySortState(document.getElementById('myTable'), document.getElementById('myTableHeader'), {
                column: index, direction: this.dataset.dir === 'asc' ? 'desc' : 'asc'
            });
      	});
    });

    });

    const getCellText = (cell) =>
      	(cell?.textContent || cell?.innerText || '').trim();

    const isNumeric = (v) => v !== '' && !isNaN(parseFloat(v)) && isFinite(v);

    function detectNumericColumn(table, colIdx) {
		const rows = table.tBodies[0]?.rows || [];
		for (let i = 0; i < rows.length; i++) {
			const txt = getCellText(rows[i].cells[colIdx]);
			if (txt !== '') return isNumeric(txt);
		}
		return false;
    }

    // Exact application shares the click comparator and icon updates; never toggles.
    function applySortState(table, header, state) {
        const ths = headers(header);
        const column = state?.key !== undefined
            ? ths.findIndex(th => th.dataset.sortKey === state.key) : state?.column;
        const thElement = ths[column];
        if (!table?.tBodies[0] || !Number.isInteger(column) || !thElement ||
            !['asc', 'desc'].includes(state?.direction)) return false;
        const dir = state.direction;

		const tbody = table.tBodies[0];
		const rows = Array.from(tbody.rows);

		// 2) Αν είναι numeric στήλη
		const numeric = detectNumericColumn(table, column);

		// 3) Ταξινόμηση
		rows.sort((r1, r2) => {
			const x = getCellText(r1.cells[column]);
			const y = getCellText(r2.cells[column]);

			let a = x, b = y;
			if (numeric) {
				a = parseFloat(x) || 0;
				b = parseFloat(y) || 0;
			} else {
				a = x.toLowerCase();
				b = y.toLowerCase();
			}

			if (a < b) return dir === 'asc' ? -1 : 1;
			if (a > b) return dir === 'asc' ? 1 : -1;
			return 0;
		});

		rows.forEach(tr => tbody.appendChild(tr));

		// 4) ΜΕΤΑ το sort, καθάρισε όλα τα εικονίδια/dirs
		resetSortIcons(header);

		// 5) Γράψε το νέο dir στο τρέχον <th> και ενημέρωσε εικονίδιο
		thElement.dataset.dir = dir;
		updateSortIcon(thElement, dir, numeric);
        return true;
    }

    function resetSortIcons(header) {
		headers(header).forEach(th => {
			th.removeAttribute('data-dir');
			const icon = th.querySelector('.sort-icon');
			if (icon) icon.className = 'sort-icon bi';
		});
    }

    function updateSortIcon(th, direction, isNumericCol) {
		const icon = th.querySelector('.sort-icon');
		if (!icon) return;
		icon.className = 'sort-icon bi';
		if (direction === 'asc') {
			icon.classList.add(isNumericCol ? 'bi-sort-numeric-down' : 'bi-sort-alpha-down');
		} else {
			icon.classList.add(isNumericCol ? 'bi-sort-numeric-down-alt' : 'bi-sort-alpha-down-alt');
		}
    }
    window.TableSort = { getSortState, applySortState };
})();

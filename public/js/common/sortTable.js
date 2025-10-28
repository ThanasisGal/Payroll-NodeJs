// /common/sortTable.js
document.addEventListener('DOMContentLoaded', function () {
    // click στα headers
    document.querySelectorAll('#myTableHeader th').forEach((th, index) => {
		th.addEventListener('click', function () {
			sortTable(index, this);
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

    function sortTable(column, thElement) {
		const table = document.getElementById('myTable');
		if (!table || !table.tBodies[0]) return;

		const tbody = table.tBodies[0];
		const rows = Array.from(tbody.rows);

		// 1) Διάβασε ΠΡΙΝ κάνεις reset
		const prevDir = thElement.dataset.dir || '';     // 'asc' | 'desc' | ''
		const dir = prevDir === 'asc' ? 'desc' : 'asc';  // toggle

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
		resetSortIcons();

		// 5) Γράψε το νέο dir στο τρέχον <th> και ενημέρωσε εικονίδιο
		thElement.dataset.dir = dir;
		updateSortIcon(thElement, dir, numeric);
    }

    function resetSortIcons() {
		document.querySelectorAll('#myTableHeader th').forEach(th => {
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
});

// nestingTables.js
document.addEventListener('DOMContentLoaded', () => {
  const table     = document.getElementById('myTable');
  const addBtn    = document.getElementById('add-btn');
  const editBtn   = document.getElementById('edit-btn');
  const deleteBtn = document.getElementById('delete-btn');

  if (!table) return;

  // ΠΟΙΑ κύρια γραμμή είναι ανοιχτή τώρα (μοιραζόμαστε το state)
  window._openMainRowId = window._openMainRowId || null;

  // ---------- helpers ----------
  function setHref(id, href) {
    const el = document.getElementById(id);
    if (el) el.href = href;
  }
  function resetHrefs() {
    ['add-btn','edit-btn','delete-btn'].forEach(id => setHref(id, '#'));
    // αφαίρεσε “τρέχον” nested id (αν είχε οριστεί από άλλο script)
    if (table.dataset) delete table.dataset.currentNestedId;
  }

  function closeMainRow(mainId) {
    if (!mainId) return;
    const row      = table.querySelector(`tr[data-id="${mainId}"]`);
    const collapse = document.getElementById(`antistoixiseis${mainId}`);

    // ξεβάψιμο / εικονίδιο
    if (row) {
      row.classList.remove('active-row');
      const icon = row.querySelector('.btn-nesting i');
      if (icon) {
        icon.classList.remove('bi-chevron-up', 'icon-white');
        icon.classList.add('bi-chevron-down');
      }
    }

    // κλείσιμο nested + καθάρισμα τυχόν selected rows μέσα
    if (collapse) {
      collapse.classList.remove('show');
      collapse.querySelectorAll('tbody tr.selected-row')
        .forEach(tr => tr.classList.remove('selected-row'));
    }

    // κουμπιά κάτω: καθάρισμα
    resetHrefs();

    window._openMainRowId = null;
  }

  function openMainRow(mainId) {
    const row      = table.querySelector(`tr[data-id="${mainId}"]`);
    const collapse = document.getElementById(`antistoixiseis${mainId}`);
    if (!row || !collapse) return;

    row.classList.add('active-row');
    const icon = row.querySelector('.btn-nesting i');
    if (icon) {
      icon.classList.remove('bi-chevron-down');
      icon.classList.add('bi-chevron-up', 'icon-white');
    }
    collapse.classList.add('show');

    // Αν θες να ρυθμίζονται τα κουμπιά για ΚΥΡΙΑ επιλογή (όχι nested),
    // αποσχόλιασε τα παρακάτω 2:
    // setHref('add-btn',  `/companies/antistoixiseis/add/${mainId}`);
    // setHref('edit-btn', `/companies/antistoixiseis/edit/${mainId}`);

    window._openMainRowId = mainId;
  }

  // ---------- main row click: ΜΟΝΟ εδώ πλέον ----------
  document.querySelectorAll('#myTable tr[data-id]').forEach(row => {
    row.addEventListener('click', async function () {
      const id       = this.dataset.id;
      const collapse = document.getElementById(`antistoixiseis${id}`);
      if (!collapse) return;

      const isSameOpen =
        window._openMainRowId === id && collapse.classList.contains('show');

      // 1) κλείσε ό,τι ήταν ανοιχτό (ίδια ή άλλη)
      if (window._openMainRowId) {
        closeMainRow(window._openMainRowId);
      }

      // 2) αν ήταν η ΙΔΙΑ → τέλος (επιστροφή στην ΑΡΧΙΚΗ κατάσταση)
      if (isSameOpen) return;

      // 3) άνοιξε τη νέα
      openMainRow(id);

      // 4) φόρτωσε nested data την 1η φορά
      if (!collapse.dataset.loaded) {
        try {
          const resp = await fetch(
            `/api/companies/antistoixiseis/getAntistoixiseis/${encodeURIComponent(id)}`,
            { credentials: 'same-origin' }
          );
          if (!resp.ok) throw new Error('Network response was not ok');

          const data = await resp.json();

          const v = x => (x && x !== '' ? x : '—');
          const mk = (cls, val, isTh = false, usePlaceholder = true) => {
            const cell = isTh ? document.createElement('th') : document.createElement('td');
            cell.className = cls;
            cell.textContent = usePlaceholder ? v(val) : (val ?? '');
            return cell;
          };

          const tableEl = document.createElement('table');
          tableEl.className =
            'table table-striped table-bordered table-sm table-hover nested-table margin-bottom--0_3rem';

          const thead = document.createElement('thead');
          thead.innerHTML = `
            <tr>
              <th class="col-1-5 text-center nested-table-header bg-white"></th>
              <th class="col-0-5 text-center nested-table-header bg-white"></th>
              <th colspan="2" class="col-2 text-center nested-table-header">Μετατροπή Τύπων Αποδοχών</th>
              <th class="col-1 text-center nested-table-header bg-white"></th>
              <th class="col-1 text-center nested-table-header bg-white"></th>
            </tr>
            <tr>
              <th class="col-1-5 text-center nested-table-header bg-white border-0"></th>
              <th class="col-0-5 text-center nested-table-header">Κ.Π.Κ.</th>
              <th class="col-1 text-center nested-table-header">Από</th>
              <th class="col-1 text-center nested-table-header">Σε</th>
              <th class="col-1 text-center nested-table-header">Κ.Α.Δ.</th>
              <th class="col-1 text-center nested-table-header">Ειδικότητα</th>
            </tr>
          `;
          tableEl.appendChild(thead);

          const tbody = document.createElement('tbody');
          tbody.className = 'bg-white';
          tableEl.appendChild(tbody);

          for (const r of data) {
            const tr = document.createElement('tr');
            tr.dataset.id = r._id;

            const allEmpty = [r.kpk, r.apo_typos_apodoxon, r.se_typos_apodoxon, r.kad, r.eidikothta]
              .every(x => x == null || String(x).trim() === '');

            if (allEmpty) {
              const thMsg = document.createElement('th');
              thMsg.className = 'col-1-5 text-center fs0_65vw bg-white cred first-col';

              const icon = document.createElement('span');
              icon.textContent = '⚠️';
              icon.className = 'fs0_75vw me-1'; // Bootstrap, βάζει μικρό κενό δεξιά

              thMsg.appendChild(icon);
              thMsg.appendChild(document.createTextNode(' Κενή εγγραφή. Δεν δόθηκαν στοιχεία...'));

              tr.appendChild(thMsg);
              const dash = cls => {
                const td = document.createElement('td');
                td.className = cls;
                td.textContent = '—';
                return td;
              };
              tr.appendChild(dash('col-0-5 text-center fs0_9vw bg-gray'));
              tr.appendChild(dash('col-1 text-center fs0_9vw bg-gray'));
              tr.appendChild(dash('col-1 text-center fs0_9vw bg-gray'));
              tr.appendChild(dash('col-1 text-center fs0_9vw bg-gray'));
              tr.appendChild(dash('col-1 text-center fs0_9vw bg-gray'));
            } else {
              tr.appendChild(mk('col-1-5 text-center fs0_9vw first-col bg-white', '', true, false));
              tr.appendChild(mk('col-0-5 text-center fs0_9vw bg-gray', r.kpk));
              tr.appendChild(mk('col-1 text-center fs0_9vw bg-gray', r.apo_typos_apodoxon));
              tr.appendChild(mk('col-1 text-center fs0_9vw bg-gray', r.se_typos_apodoxon));
              tr.appendChild(mk('col-1 text-center fs0_9vw bg-gray', r.kad));
              tr.appendChild(mk('col-1 text-center fs0_9vw bg-gray', r.eidikothta));
            }

            tbody.appendChild(tr);
          }

          collapse.replaceChildren(tableEl);
          collapse.dataset.loaded = 'true';

          // delegate click στο nested (ΜΟΝΟ επιλογή, όχι άνοιγμα/κλείσιμο)
          if (!collapse._bound) {
            tbody.addEventListener('click', (e) => {
              const tr = e.target.closest('tr[data-id]');
              if (tr) selectRow(tr);
              // ΜΗΝ αφήσεις να ανέβει στο main handler
              e.stopPropagation();
            });
            collapse._bound = true;
          }

        } catch (err) {
          console.error('Failed to fetch antistoixiseis data:', err);
        }
      }
    });
  });

  // highlight επιλογής σε NESTED row (μόνο εμφάνιση)
  function selectRow(row) {
    const isSelected = row.classList.contains('selected-row');
    const siblings   = row.parentElement?.children || [];
    if (isSelected) {
      row.classList.remove('selected-row');
    } else {
      for (const sib of siblings) sib.classList.remove('selected-row');
      row.classList.add('selected-row');
    }
  }
});

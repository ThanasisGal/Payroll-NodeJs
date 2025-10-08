// nestingTables.js
document.addEventListener('DOMContentLoaded', () => {
  // Flag: αυτή η σελίδα ελέγχει το footer μέσω nested
  window._nestedControlsFooter = true;

  const table = document.getElementById('myTable');
  if (!table) return;

  // --- κουμπιά footer (σταθερά) ---
  const addBtn    = document.getElementById('add-btn');
  const editBtn   = document.getElementById('edit-btn');
  const deleteBtn = document.getElementById('delete-btn');

  const hasFooterButtons = !!(addBtn || editBtn || deleteBtn);

  // Δικαιώματα (από EJS -> data-allowed="1|0")
  const perms = {
    add:    addBtn?.dataset.allowed === '1',
    edit:   editBtn?.dataset.allowed === '1',
    delete: deleteBtn?.dataset.allowed === '1',
  };

  // ---------- helpers για κουμπιά ----------
  function setBtnState(btn, enable) {
    if (!btn) return;
    btn.classList.toggle('disabled-link', !enable);
    btn.classList.toggle('disabled', !enable); // Bootstrap compat
    btn.setAttribute('aria-disabled', String(!enable));
    btn.tabIndex = enable ? 0 : -1;
    btn.href = enable ? (btn.dataset.href || '#') : '#';
  }

  function clearBtnHrefs() {
    if (addBtn)    { delete addBtn.dataset.href;    addBtn.href = '#'; }
    if (editBtn)   { delete editBtn.dataset.href;   editBtn.href = '#'; }
    if (deleteBtn) { delete deleteBtn.dataset.href; deleteBtn.href = '#'; }
  }

  /**
   * Ενεργοποίηση κουμπιών.
   * @param {boolean} hasSelection - υπάρχει επιλεγμένη nested γραμμή;
   * @param {boolean} allowAddOnly - αν true, ενεργοποιείται ΜΟΝΟ το Add (χωρίς επιλογή).
   */
  function refreshButtons(hasSelection, allowAddOnly = false) {
    if (!hasFooterButtons) return;
    setBtnState(addBtn,    (hasSelection || allowAddOnly) && perms.add);
    setBtnState(editBtn,   hasSelection && perms.edit);
    setBtnState(deleteBtn, hasSelection && perms.delete);
    if (!hasSelection && table.dataset) delete table.dataset.currentNestedId;
  }

  // Στην αρχή: τίποτα επιλεγμένο -> όλα disabled
  refreshButtons(false);

  // ΠΟΙΑ κύρια γραμμή είναι ανοιχτή τώρα (μοιραζόμαστε το state)
  window._openMainRowId = window._openMainRowId || null;

  // ---------- helpers για άνοιγμα/κλείσιμο main row ----------
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
      collapse.querySelectorAll('tr.selected-row')
        .forEach(tr => tr.classList.remove('selected-row'));
    }

    // κουμπιά: καθάρισμα hrefs & disable
    clearBtnHrefs();
    refreshButtons(false);

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

    // Από τη στιγμή που εμφανίζονται οι επικεφαλίδες του nested,
    // θέλουμε το ADD να είναι enabled (χωρίς nested selection)
    if (addBtn) addBtn.dataset.href = `/companies/antistoixiseis/add/${mainId}`;
    // Edit/Delete παραμένουν disabled μέχρι να επιλεγεί nested
    refreshButtons(false, true);

    window._openMainRowId = mainId;
  }

  // ---------- helper για τιμές κελιών ----------
  const v = x => (x && x !== '' ? x : '—');

  /**
   * Δημιουργεί <td> ή <th> με data-name/data-value κ.λπ.
   */
  function mkCell(cls, val, opts = {}) {
    const { isTh = false, usePlaceholder = true, key = null, includeHidden = false } = opts;
    const cell = isTh ? document.createElement('th') : document.createElement('td');
    cell.className = cls;

    const display = usePlaceholder ? v(val) : (val ?? '');
    cell.textContent = display;

    if (key) cell.dataset.name = key;
    cell.dataset.value = (val ?? '').toString();

    if (includeHidden && key) {
      const hidden = document.createElement('input');
      hidden.type  = 'hidden';
      hidden.name  = key;
      hidden.value = (val ?? '').toString();
      cell.appendChild(hidden);
    }
    return cell;
  }

  // ---------- main row click: άνοιγμα/κλείσιμο + φόρτωση nested ----------
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

      // 2) αν ήταν η ΙΔΙΑ -> τέλος (επιστροφή σε "όλα off")
      if (isSameOpen) return;

      // 3) άνοιξε τη νέα (ενεργοποιεί ADD μόνο)
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

          const tableEl = document.createElement('table');
          tableEl.className =
            'table table-striped table-bordered table-sm table-hover nested-table margin-bottom--0_3rem';

          const thead = document.createElement('thead');
          thead.innerHTML = `
            <tr>
              <th class="col-1-5 text-center nested-table-header bg-white"></th>
              <th class="col-0-5 text-center nested-table-header bg-white"></th>
              <th colspan="2" class="col-2 text-center nested-table-header">Μετατροπή Τύπων Αποδοχών</th>
              <th class="col-0-5 text-center nested-table-header bg-white"></th>
              <th class="col-0-5 text-center nested-table-header bg-white"></th>
              <th class="col-1 text-center nested-table-header bg-white"></th>
            </tr>
            <tr>
              <th class="col-1-5 text-center nested-table-header bg-white border-0"></th>
              <th class="col-0-5 text-center nested-table-header">Κ.Π.Κ.</th>
              <th class="col-1 text-center nested-table-header">Από</th>
              <th class="col-1 text-center nested-table-header">Σε</th>
              <th class="col-0-5 text-center nested-table-header">Κ.Α.Δ.</th>
              <th class="col-0-5 text-center nested-table-header">Ειδικότητα</th>
              <th class="col-1 text-center nested-table-header">Ειδική Περίπτωση Ασφάλισης</th>
            </tr>
          `;
          tableEl.appendChild(thead);

          const tbody = document.createElement('tbody');
          tbody.className = 'bg-white';
          tableEl.appendChild(tbody);

          for (const r of data) {
            const tr = document.createElement('tr');
            tr.dataset.id = r._id;

            const allEmpty = [r.kpk, r.apo_typos_apodoxon, r.se_typos_apodoxon, r.kad, r.eidikothta, r.epa]
              .every(x => x == null || String(x).trim() === '');

            if (allEmpty) {
              const thMsg = document.createElement('th');
              thMsg.className = 'col-1-5 text-center fs0_65vw bg-white cred first-col';

              const icon = document.createElement('span');
              icon.textContent = '⚠️';
              icon.className = 'fs0_75vw me-1';

              thMsg.appendChild(icon);
              thMsg.appendChild(document.createTextNode(' Κενή εγγραφή. Δεν δόθηκαν στοιχεία...'));

              tr.appendChild(thMsg);
              const dash = cls => {
                const td = document.createElement('td');
                td.className = cls;
                td.textContent = '—';
                td.dataset.value = '—';
                return td;
              };
              tr.appendChild(dash('col-0-5 text-center fs0_9vw bg-gray'));
              tr.appendChild(dash('col-1 text-center fs0_9vw bg-gray'));
              tr.appendChild(dash('col-1 text-center fs0_9vw bg-gray'));
              tr.appendChild(dash('col-0-5 text-center fs0_9vw bg-gray'));
              tr.appendChild(dash('col-0-5 text-center fs0_9vw bg-gray'));
              tr.appendChild(dash('col-1 text-center fs0_9vw bg-gray'));
            } else {
              tr.appendChild(mkCell('col-1-5 text-center fs0_9vw first-col bg-white', '', { isTh: true, usePlaceholder: false, key: 'blank' }));
              tr.appendChild(mkCell('col-0-5 text-center fs0_9vw bg-gray', r.kpk,                { key: 'kpk', includeHidden: true }));
              tr.appendChild(mkCell('col-1   text-center fs0_9vw bg-gray', r.apo_typos_apodoxon, { key: 'apo_typos_apodoxon', includeHidden: true }));
              tr.appendChild(mkCell('col-1   text-center fs0_9vw bg-gray', r.se_typos_apodoxon,  { key: 'se_typos_apodoxon', includeHidden: true }));
              tr.appendChild(mkCell('col-0-5 text-center fs0_9vw bg-gray', r.kad,                { key: 'kad', includeHidden: true }));
              tr.appendChild(mkCell('col-0-5 text-center fs0_9vw bg-gray', r.eidikothta,         { key: 'eidikothta', includeHidden: true }));
              tr.appendChild(mkCell('col-1   text-center fs0_9vw bg-gray', r.epa,                { key: 'epa', includeHidden: true }));
            }

            tbody.appendChild(tr);
          }

          collapse.replaceChildren(tableEl);
          collapse.dataset.loaded = 'true';

          // --- επιλογή nested γραμμής ---
          if (!collapse._bound) {
            tbody.addEventListener('click', (e) => {
              const tr = e.target.closest('tr[data-id]');
              if (!tr) return;

              const already = tr.classList.contains('selected-row');

              // καθάρισε προηγούμενες επιλογές στο ίδιο tbody
              tbody.querySelectorAll('.selected-row').forEach(r => r.classList.remove('selected-row'));

              if (!already) {
                tr.classList.add('selected-row');
                const nestedId = tr.dataset.id;

                // ADD/EDIT/DELETE για nested επιλογή
                if (addBtn)    addBtn.dataset.href    = `/companies/antistoixiseis/addFromNested/${nestedId}`;
                if (editBtn)   editBtn.dataset.href   = `/companies/antistoixiseis/edit/${nestedId}`;
                if (deleteBtn) deleteBtn.dataset.href = `/companies/antistoixiseis/deleteFromNested/${nestedId}`;

                table.dataset.currentNestedId = nestedId;
                refreshButtons(true); // όλα ενεργά σύμφωνα με perms
              } else {
                // Αποεπιλογή -> κράτα μόνο ADD enabled με mainId
                if (addBtn && window._openMainRowId) {
                  addBtn.dataset.href = `/companies/antistoixiseis/add/${window._openMainRowId}`;
                }
                // καθάρισε edit/delete
                if (editBtn)   delete editBtn.dataset.href;
                if (deleteBtn) delete deleteBtn.dataset.href;

                refreshButtons(false, true); // μόνο ADD enabled
              }

              e.stopPropagation();
            });
            collapse._bound = true;
          }

        } catch (err) {
          console.error('Failed to fetch antistoixiseis data:', err);
          // Ακόμη κι αν αποτύχει το fetch, έχουμε ήδη ενεργοποιήσει το ADD για το mainId.
          if (addBtn && window._openMainRowId) {
            addBtn.dataset.href = `/companies/antistoixiseis/add/${window._openMainRowId}`;
          }
          // Edit/Delete παραμένουν κλειστά
          refreshButtons(false, true);
        }
      }
    });
  });
});

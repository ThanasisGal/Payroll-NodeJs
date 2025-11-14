// (() => {
//   const SYM_ID = 'symbash';

//   const KAT_ID = 'kathgoria_symbashs';
//   const KAT_H  = 'kathgoria_symbashs_stathera';
//   const KAT_T  = 'kathgoria_symbashs_table';

//   const EID_ID = 'eidikothta_symbashs';
//   const EID_H  = 'eidikothta_symbashs_stathera';
//   const EID_T  = 'eidikothta_symbashs_table';

//   // === ΡΥΘΜΙΣΕΙΣ ΜΕΓΕΘΟΥΣ / ΘΕΣΗΣ ===
//   const SIZE_SCALE        = 1.2;
//   const SIZE_MIN_PX       = 16;
//   const SIZE_MAX_PX       = 28;
//   const VERTICAL_LIFT_REM = 0.4;
//   const ROW_PAD_BASE_PX   = 36;

//   const TRASH_SVG = `
// <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
//      fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16"
//      aria-hidden="true" focusable="false">
//   <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/>
// </svg>`.trim();

//   const $ = (id) => document.getElementById(id);
//   const isMulti = (el) => !!(el?.multiple || el?.tomselect?.settings?.mode === 'multi');

//   const clearTable = () => {
//     const tb = document.querySelector('#myTable tbody');
//     if (tb) tb.innerHTML = '';
//   };

//   function dispatchChange(el) {
//     try { el?.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
//   }

//   const clearSelectCompletely = (selId, hiddenId, tableId) => {
//     const inst = $(selId)?.tomselect;
//     if (inst) {
//       inst.clear(true);
//       inst.clearOptions();
//       try { inst.refreshOptions(false); } catch (_) {}
//     } else {
//       const el = $(selId);
//       if (el) { el.value = ''; while (el.options?.length) el.remove(0); }
//     }

//     const hid = $(hiddenId);
//     if (hid) { hid.value = ''; dispatchChange(hid); }

//     const tbl = $(tableId);
//     if (tbl) { tbl.value = '[]'; dispatchChange(tbl); }
//   };

//   // πέτα ό,τι inline trash μπορεί να έβαλε το dropdown-item μέσα στο TS
//   const stripInlineTrashInsideTS = (sel) => {
//     const wrap = sel.closest('.ts-wrapper, .ts-control') || sel.parentElement;
//     if (!wrap) return;
//     wrap.querySelectorAll('.ts-inline-trash, [class^="ts-inline-trash-"]').forEach(n => n.remove());
//   };

//   const findPlusMinusBtnInRow = (row) => row?.querySelector('.ts-fill-reset-btn');

//   function getSymTrashSizePx() {
//     const row = $('#'+SYM_ID)?.closest('.row.form-group') || $('#'+SYM_ID)?.closest('.row');
//     if (!row) return 16;
//     const ref = row.querySelector('.bi-trash3, .ts-ext-trash-symbash, [class*="trash"] svg');
//     if (!ref) return 16;
//     const r = ref.getBoundingClientRect();
//     const s = Math.round(Math.max(r.width, r.height));
//     return s > 8 && s < 48 ? s : 16;
//   }

//   function remToPx(rem) {
//     const fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
//     return rem * fs;
//   }

//   function computeRightOffsetPx(row) {
//     try {
//       const symSel = $('#'+SYM_ID);
//       const symRow = symSel?.closest('.row.form-group') || symSel?.closest('.row');
//       const symIcon = symRow?.querySelector('.bi-trash3, .ts-ext-trash-symbash, [class*="trash"] svg');
//       if (symRow && symIcon) {
//         const sr = symRow.getBoundingClientRect();
//         const tr = symIcon.getBoundingClientRect();
//         const px = Math.round(sr.right - tr.right);
//         if (px >= 4 && px <= 40) return px;
//       }
//     } catch (_) {}

//     const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
//     if (vw <= 1280) return 16;
//     if (vw <= 1440) return 20;
//     if (vw <= 1536) return 24;
//     if (vw <= 1920) return 36;
//     return 14;
//   }

//   function syncVisuals(row, btn) {
//     try {
//       const base = getSymTrashSizePx();
//       const size = Math.min(SIZE_MAX_PX, Math.max(SIZE_MIN_PX, Math.round(base * SIZE_SCALE)));
//       const svg  = btn.querySelector('svg');
//       if (svg) { svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size)); }

//       const rightPx = computeRightOffsetPx(row);
//       btn.style.right = rightPx + 'px';

//       const pm = findPlusMinusBtnInRow(row);
//       const rr = row.getBoundingClientRect();
//       let center;
//       if (pm) {
//         const pr = pm.getBoundingClientRect();
//         center = (pr.top + pr.height / 2) - rr.top;
//       } else {
//         center = rr.height / 2;
//       }
//       center -= remToPx(VERTICAL_LIFT_REM);
//       btn.style.top = center + 'px';
//       btn.style.transform = 'translateY(-50%)';

//       const desiredPad = Math.max(ROW_PAD_BASE_PX, rightPx + size + 8);
//       const currentPad = parseFloat(getComputedStyle(row).paddingRight || '0') || 0;
//       if (Math.abs(currentPad - desiredPad) > 1) {
//         row.style.paddingRight = desiredPad + 'px';
//       }
//     } catch (_) {}
//   }

//   function mountRowTrash(selectId, { title, onClick }) {
//     const sel = $(selectId);
//     if (!sel) return;
//     if (!isMulti(sel)) return;

//     const row = sel.closest('.row.form-group') || sel.closest('.row');
//     if (!row) return;

//     stripInlineTrashInsideTS(sel);

//     const cs = getComputedStyle(row);
//     if (cs.position === 'static') row.style.position = 'relative';

//     const cls = 'row-trash-btn-' + selectId;
//     let btn = row.querySelector('.' + cls);
//     if (!btn) {
//       btn = document.createElement('button');
//       btn.type = 'button';
//       btn.className = cls;
//       btn.title = title;
//       btn.setAttribute('aria-label', title);
//       btn.innerHTML = TRASH_SVG;
//       Object.assign(btn.style, {
//         position: 'absolute',
//         background: 'transparent',
//         border: '0',
//         color: '#dc3545',
//         cursor: 'pointer',
//         padding: '0',
//         lineHeight: '1',
//         width: '1.25rem',
//         height: '1.25rem',
//         zIndex: 2,
//         pointerEvents: 'auto'
//       });
//       btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick?.(); });
//       row.appendChild(btn);

//       syncVisuals(row, btn);
//       const ro = new ResizeObserver(() => syncVisuals(row, btn));
//       ro.observe(row);
//       btn._resizeObs = ro;
//     } else {
//       syncVisuals(row, btn);
//     }
//   }

//   function mountAll() {
//     mountRowTrash(KAT_ID, {
//       title: 'Καθαρισμός Κατηγορίας, Ειδικοτήτων & Πίνακα',
//       onClick: () => {
//         clearSelectCompletely(KAT_ID, KAT_H, KAT_T);
//         clearSelectCompletely(EID_ID, EID_H, EID_T);
//         clearTable();
//         const sym = $(SYM_ID);
//         if (sym) sym.dispatchEvent(new Event('change', { bubbles: true }));
//       }
//     });

//     mountRowTrash(EID_ID, {
//       title: 'Καθαρισμός Ειδικοτήτων & Πίνακα',
//       onClick: () => {
//         clearSelectCompletely(EID_ID, EID_H, EID_T);
//         clearTable();
//       }
//     });
//   }

//   function boot() {
//     mountAll();
//     setTimeout(mountAll, 150);
//     setTimeout(mountAll, 400);
//     setTimeout(mountAll, 800);
//   }

//   if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', boot, { once: true });
//   } else {
//     boot();
//   }

//   document.addEventListener('change', (e) => {
//     const id = e.target?.id;
//     if (id === SYM_ID || id === KAT_ID || id === EID_ID) {
//       setTimeout(mountAll, 0);
//     }
//   }, true);

//   window.addEventListener('resize', () => {
//     document
//       .querySelectorAll('.row-trash-btn-' + KAT_ID + ', .row-trash-btn-' + EID_ID)
//       .forEach((btn) => {
//         const row = btn.closest('.row.form-group') || btn.closest('.row');
//         if (row) syncVisuals(row, btn);
//       });
//   });
// })();


(() => {
  const SYM_ID = 'symbash';
  const SYM_H  = 'symbash_stathera';


  const KAT_ID = 'kathgoria_symbashs';
  const KAT_H  = 'kathgoria_symbashs_stathera';
  const KAT_T  = 'kathgoria_symbashs_table';

  const EID_ID = 'eidikothta_symbashs';
  const EID_H  = 'eidikothta_symbashs_stathera';
  const EID_T  = 'eidikothta_symbashs_table';

  // === ΡΥΘΜΙΣΕΙΣ ΜΕΓΕΘΟΥΣ / ΘΕΣΗΣ ===
  const SIZE_SCALE        = 1.2;
  const SIZE_MIN_PX       = 16;
  const SIZE_MAX_PX       = 28;
  const VERTICAL_LIFT_REM = 0.4;
  const ROW_PAD_BASE_PX   = 36;

  const TRASH_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
     fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16"
     aria-hidden="true" focusable="false">
  <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/>
</svg>`.trim();

  const $ = (id) => document.getElementById(id);
  const isMulti = (el) => !!(el?.multiple || el?.tomselect?.settings?.mode === 'multi');

  const clearTable = () => {
    const tb = document.querySelector('#myTable tbody');
    if (tb) tb.innerHTML = '';
  };

  function clearAllForSym() {
    // Καθαρισμός όλων με βάση το σκουπιδάκι της Σύμβασης
    clearSelectCompletely(SYM_ID, SYM_H, null);
    clearSelectCompletely(KAT_ID, KAT_H, KAT_T);
    clearSelectCompletely(EID_ID, EID_H, EID_T);
    clearTable();
    const sym = document.getElementById(SYM_ID);
    if (sym) { try { sym.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {} }
  }

  function dispatchChange(el) {
    try { el?.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
  }

  const clearSelectCompletely = (selId, hiddenId, tableId) => {
    const inst = $(selId)?.tomselect;
    if (inst) {
      inst.clear(true);
      inst.clearOptions();
      try { inst.refreshOptions(false); } catch (_) {}
    } else {
      const el = $(selId);
      if (el) { el.value = ''; while (el.options?.length) el.remove(0); }
    }

    const hid = $(hiddenId);
    if (hid) { hid.value = ''; dispatchChange(hid); }

    const tbl = $(tableId);
    if (tbl) { tbl.value = '[]'; dispatchChange(tbl); }
  };

  // πέτα ό,τι inline trash μπορεί να έβαλε το dropdown-item μέσα στο TS
  const stripInlineTrashInsideTS = (sel) => {
    const wrap = sel.closest('.ts-wrapper, .ts-control') || sel.parentElement;
    if (!wrap) return;
    wrap.querySelectorAll('.ts-inline-trash, [class^="ts-inline-trash-"]').forEach(n => n.remove());
  };

  const findPlusMinusBtnInRow = (row) => row?.querySelector('.ts-fill-reset-btn');

  function getSymTrashSizePx() {
    const row = $('#'+SYM_ID)?.closest('.row.form-group') || $('#'+SYM_ID)?.closest('.row');
    if (!row) return 16;
    const ref = row.querySelector('.bi-trash3, .ts-ext-trash-symbash, [class*="trash"] svg');
    if (!ref) return 16;
    const r = ref.getBoundingClientRect();
    const s = Math.round(Math.max(r.width, r.height));
    return s > 8 && s < 48 ? s : 16;
  }

  function remToPx(rem) {
    const fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return rem * fs;
  }

  function computeRightOffsetPx(row) {
    try {
      const symSel = $('#'+SYM_ID);
      const symRow = symSel?.closest('.row.form-group') || symSel?.closest('.row');
      const symIcon = symRow?.querySelector('.bi-trash3, .ts-ext-trash-symbash, [class*="trash"] svg');
      if (symRow && symIcon) {
        const sr = symRow.getBoundingClientRect();
        const tr = symIcon.getBoundingClientRect();
        const px = Math.round(sr.right - tr.right);
        if (px >= 4 && px <= 40) return px;
      }
    } catch (_) {}

    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    if (vw <= 1280) return 16;
    if (vw <= 1440) return 20;
    if (vw <= 1536) return 24;
    if (vw <= 1920) return 36;
    return 14;
  }

  function syncVisuals(row, btn) {
    try {
      const base = getSymTrashSizePx();
      const size = Math.min(SIZE_MAX_PX, Math.max(SIZE_MIN_PX, Math.round(base * SIZE_SCALE)));
      const svg  = btn.querySelector('svg');
      if (svg) { svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size)); }

      const rightPx = computeRightOffsetPx(row);
      btn.style.right = rightPx + 'px';

      const pm = findPlusMinusBtnInRow(row);
      const rr = row.getBoundingClientRect();
      let center;
      if (pm) {
        const pr = pm.getBoundingClientRect();
        center = (pr.top + pr.height / 2) - rr.top;
      } else {
        center = rr.height / 2;
      }
      center -= remToPx(VERTICAL_LIFT_REM);
      btn.style.top = center + 'px';
      btn.style.transform = 'translateY(-50%)';

      const desiredPad = Math.max(ROW_PAD_BASE_PX, rightPx + size + 8);
      const currentPad = parseFloat(getComputedStyle(row).paddingRight || '0') || 0;
      if (Math.abs(currentPad - desiredPad) > 1) {
        row.style.paddingRight = desiredPad + 'px';
      }
    } catch (_) {}
  }

  function mountRowTrash(selectId, { title, onClick }) {
    const sel = $(selectId);
    if (!sel) return;
    if (!isMulti(sel)) return;

    const row = sel.closest('.row.form-group') || sel.closest('.row');
    if (!row) return;

    stripInlineTrashInsideTS(sel);

    const cs = getComputedStyle(row);
    if (cs.position === 'static') row.style.position = 'relative';

    const cls = 'row-trash-btn-' + selectId;
    let btn = row.querySelector('.' + cls);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = cls;
      btn.title = title;
      btn.setAttribute('aria-label', title);
      btn.innerHTML = TRASH_SVG;
      Object.assign(btn.style, {
        position: 'absolute',
        background: 'transparent',
        border: '0',
        color: '#dc3545',
        cursor: 'pointer',
        padding: '0',
        lineHeight: '1',
        width: '1.25rem',
        height: '1.25rem',
        zIndex: 2,
        pointerEvents: 'auto'
      });
      btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick?.(); });
      row.appendChild(btn);

      syncVisuals(row, btn);
      const ro = new ResizeObserver(() => syncVisuals(row, btn));
      ro.observe(row);
      btn._resizeObs = ro;
    } else {
      syncVisuals(row, btn);
    }
  }

  function mountAll() {
    mountRowTrash(KAT_ID, {
      title: 'Καθαρισμός Κατηγορίας, Ειδικοτήτων & Πίνακα',
      onClick: () => {
        clearSelectCompletely(KAT_ID, KAT_H, KAT_T);
        clearSelectCompletely(EID_ID, EID_H, EID_T);
        clearTable();
        const sym = $(SYM_ID);
        if (sym) sym.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    mountRowTrash(EID_ID, {
      title: 'Καθαρισμός Ειδικοτήτων & Πίνακα',
      onClick: () => {
        clearSelectCompletely(EID_ID, EID_H, EID_T);
        clearTable();
      }
    });
  }

  function boot() {
    mountAll();
    setTimeout(mountAll, 150);
    setTimeout(mountAll, 400);
    setTimeout(mountAll, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  
  // Catch clicks στο INLINE trash της Σύμβασης και κάνε full clear
  document.addEventListener('click', (e) => {
    const target = e.target;
    const symSel = document.getElementById(SYM_ID);
    if (!symSel) return;
    const symRow = symSel.closest('.row.form-group') || symSel.closest('.row');
    if (!symRow) return;
    const isTrash = target.closest && target.closest('.bi-trash3, .ts-ext-trash-symbash, .ts-single-reset-btn, [class*="trash"] svg, [class*="trash"]');
    if (isTrash && symRow.contains(isTrash)) {
      e.preventDefault();
      e.stopPropagation();
      clearAllForSym();
    }
  }, true);

document.addEventListener('change', (e) => {
    const id = e.target?.id;
    if (id === SYM_ID || id === KAT_ID || id === EID_ID) {
      setTimeout(mountAll, 0);
    }
  }, true);

  window.addEventListener('resize', () => {
    document
      .querySelectorAll('.row-trash-btn-' + KAT_ID + ', .row-trash-btn-' + EID_ID)
      .forEach((btn) => {
        const row = btn.closest('.row.form-group') || btn.closest('.row');
        if (row) syncVisuals(row, btn);
      });
  });
})();


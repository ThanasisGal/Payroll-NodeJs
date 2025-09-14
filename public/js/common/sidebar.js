// document.addEventListener('DOMContentLoaded', () => {
//     const TREE_SEL    = '#nav-tree';
//     const SIDEBAR_SEL = '.sidebar-content';

//     const USER_ID     = (window.WPS_USER_ID || '').trim();     // ← από το server
//     const STATE_KEY   = (id) => `wps.sidebar.state.v1.${id||'guest'}`;
//     const SCROLL_KEY  = (id) => `wps.sidebar.scroll.v1.${id||'guest'}`;

//     const tree    = document.querySelector(TREE_SEL);
//     const sidebar = document.querySelector(SIDEBAR_SEL);
//     if (!tree) return;

//     // --- helpers ------------------------------------------------------
//     const getOpenIds = () =>
//         [...tree.querySelectorAll('ul.submenu.active')]
//         .map(ul => ul.parentElement?.id)
//         .filter(Boolean);

//     const openByIds = (ids = []) => {
//         ids.forEach(id => {
//             const li = document.getElementById(id);
//             if (!li) return;
//             const a  = li.querySelector(':scope > a');
//             const ul = li.querySelector(':scope > ul.submenu');
//             if (ul) ul.classList.add('active');
//             a?.setAttribute('aria-expanded', 'true');
//             a?.querySelector('.chevron-icon')?.classList.add('rotate-chevron');
//         });
//     };

//     const collapseAll = () => {
//         tree.querySelectorAll('ul.submenu.active').forEach(ul => ul.classList.remove('active'));
//         tree.querySelectorAll('.chevron-icon.rotate-chevron').forEach(i => i.classList.remove('rotate-chevron'));
//         tree.querySelectorAll('#nav-tree a[aria-expanded="true"]').forEach(a => a.setAttribute('aria-expanded','false'));
//         tree.querySelectorAll('#nav-tree a.active').forEach(a => a.classList.remove('active'));
//         if (sidebar) sidebar.scrollTop = 0;
//     };

//     const saveState = ({ activeId = null } = {}) => {
//         // ΜΗΝ αποθηκεύεις τίποτα όταν δεν υπάρχει userId στο session
//         if (!USER_ID) return;
//         const state = { openIds: getOpenIds(), activeId };
//         localStorage.setItem(STATE_KEY(USER_ID), JSON.stringify(state));
//         if (sidebar) localStorage.setItem(SCROLL_KEY(USER_ID), String(sidebar.scrollTop));
//     };

//     const loadState = () => {
//         // Αν δεν υπάρχει userId ⇒ καθόλου restore, όλα collapsed
//         if (!USER_ID) {
//             // καθάρισε τυχόν παλιό generic state (συμβατότητα με παλιές εκδόσεις)
//             localStorage.removeItem('wps.sidebar.state.v1');
//             localStorage.removeItem('wps.sidebar.scroll.v1');
//             collapseAll();
//             return;
//         }
//         try {
//             const raw = localStorage.getItem(STATE_KEY(USER_ID));
//             if (raw) {
//                 const s = JSON.parse(raw);
//                 if (Array.isArray(s.openIds)) openByIds(s.openIds);
//                 if (s.activeId) {
//                     document.getElementById(s.activeId)
//                     ?.querySelector(':scope > a')
//                     ?.classList.add('active');
//                 }
//             }
//             const y = parseInt(localStorage.getItem(SCROLL_KEY(USER_ID)) || '0', 10);
//             if (sidebar && Number.isFinite(y)) sidebar.scrollTop = y;
//         } catch {
//             // σε οποιοδήποτε σφάλμα: ασφαλές collapse
//             collapseAll();
//         }
//     };

//     // --- αρχική επαναφορά/μη-επαναφορά --------------------------------
//     loadState();

//     // --- toggle για ΟΛΑ τα επίπεδα (event delegation) ----------------
//     tree.addEventListener('click', (ev) => {
//         const a = ev.target.closest('#nav-tree a');
//         if (!a || !tree.contains(a)) return;

//         const li = a.closest('li[data-value]') || a.closest('li');
//         const submenu = a.nextElementSibling;

//         if (submenu && submenu.classList.contains('submenu')) {
//             ev.preventDefault(); // κόμβος με υπομενού
//             submenu.classList.toggle('active');
//             a.querySelector('.chevron-icon')?.classList.toggle('rotate-chevron');
//             a.setAttribute('aria-expanded', submenu.classList.contains('active') ? 'true' : 'false');
//             saveState(); // θα σώσει ΜΟΝΟ αν υπάρχει USER_ID
//             return;
//         }

//         // Leaf link: πριν το navigation αποθήκευσε (αν υπάρχει USER_ID)
//         const activeId = li?.id || null;
//         saveState({ activeId });
//     });

//     // --- BFCache συγχρονισμός ----------------------------------------
//     window.addEventListener('pageshow', () => loadState());

//     // --- δυναμικές προσθήκες items -----------------------------------
//     tree.addEventListener('wps:nav-refresh', loadState);
// });





document.addEventListener('DOMContentLoaded', () => {
  const TREE_SEL     = '#nav-tree';
  const SCROLL_SEL   = '#sidebarMenu .sidebar-scroll'; // <-- ΤΟ scroll container
  const BTN_COLL_SEL = '#btn-collapse-all';
  const BTN_EXPD_SEL = '#btn-expand-all';
  const SEARCH_SEL   = '#sidebarMenu .sidebar-search';

  const USER_ID   = (window.WPS_USER_ID || '').trim();
  const STATE_KEY = (id) => `wps.sidebar.state.v1.${id || 'guest'}`;
  const SCROL_KEY = (id) => `wps.sidebar.scroll.v1.${id || 'guest'}`;

  const tree        = document.querySelector(TREE_SEL);
  const scrollArea  = document.querySelector(SCROLL_SEL);
  const btnCollapse = document.querySelector(BTN_COLL_SEL);
  const btnExpand   = document.querySelector(BTN_EXPD_SEL);
  const searchInput = document.querySelector(SEARCH_SEL);

  if (!tree) return;

  // ---------- helpers ----------
  const setExpandedState = (li, expanded) => {
    const a  = li.querySelector(':scope > a');
    const ul = li.querySelector(':scope > ul.submenu');
    if (!a || !ul) return;
    ul.classList.toggle('active', expanded);
    a.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    a.querySelector('.chevron-icon')?.classList
      .toggle('rotate-chevron', expanded);
  };

  const getOpenIds = () =>
    [...tree.querySelectorAll('ul.submenu.active')]
      .map(ul => ul.parentElement?.id)
      .filter(Boolean);

  const openByIds = (ids = []) => {
    ids.forEach(id => {
      const li = document.getElementById(id);
      if (li) setExpandedState(li, true);
    });
  };

  const collapseAll = () => {
    tree.querySelectorAll('ul.submenu.active')
        .forEach(ul => ul.classList.remove('active'));
    tree.querySelectorAll('#nav-tree a[aria-expanded]')
        .forEach(a => a.setAttribute('aria-expanded', 'false'));
    tree.querySelectorAll('.chevron-icon.rotate-chevron')
        .forEach(i => i.classList.remove('rotate-chevron'));
    tree.querySelectorAll('#nav-tree a.active')
        .forEach(a => a.classList.remove('active'));
    if (scrollArea) scrollArea.scrollTop = 0;
  };

  const expandAll = () => {
    tree.querySelectorAll('#nav-tree li').forEach(li => {
      const ul = li.querySelector(':scope > ul.submenu');
      if (ul) setExpandedState(li, true);
    });
  };

  const saveState = ({ activeId = null } = {}) => {
    if (!USER_ID) return;                  // αν δεν υπάρχει user, μην σώζεις
    const state = { openIds: getOpenIds(), activeId };
    localStorage.setItem(STATE_KEY(USER_ID), JSON.stringify(state));
    if (scrollArea) {
      localStorage.setItem(SCROL_KEY(USER_ID), String(scrollArea.scrollTop));
    }
  };

  const loadState = () => {
    if (!USER_ID) { collapseAll(); return; }
    try {
      const raw = localStorage.getItem(STATE_KEY(USER_ID));
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.openIds)) openByIds(s.openIds);
        if (s.activeId) {
          document.getElementById(s.activeId)
            ?.querySelector(':scope > a')
            ?.classList.add('active');
        }
      }
      const y = parseInt(localStorage.getItem(SCROL_KEY(USER_ID)) || '0', 10);
      if (scrollArea && Number.isFinite(y)) scrollArea.scrollTop = y;
    } catch {
      collapseAll();
    }
  };

  // ---------- αρχική επαναφορά ----------
  loadState();

  // ---------- delegation για toggling ----------
  tree.addEventListener('click', (ev) => {
    const a = ev.target.closest('#nav-tree a');
    if (!a || !tree.contains(a)) return;

    const li = a.closest('li[data-value]') || a.closest('li');
    const submenu = a.nextElementSibling;

    if (submenu && submenu.classList.contains('submenu')) {
      ev.preventDefault();
      const expanded = !submenu.classList.contains('active');
      setExpandedState(li, expanded);
      saveState();
      return;
    }
    // leaf
    const activeId = li?.id || null;
    saveState({ activeId });
  });

  // ---------- BFCache / refresh ----------
  window.addEventListener('pageshow', loadState);
  tree.addEventListener('wps:nav-refresh', loadState);

  // ---------- κουμπιά toolbox ----------
  btnCollapse?.addEventListener('click', () => {
    collapseAll();
    saveState();
  });
  btnExpand?.addEventListener('click', () => {
    expandAll();
    saveState();
  });

  // ---------- search με τόνους ----------
  const norm = (s) => (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // βγάζει τόνους
    .replace(/ς/g, 'σ');                              // τελικό σίγμα

  const pathToRoot = (li) => {
    const path = [];
    let p = li?.parentElement;
    while (p && p !== tree) {
      if (p.tagName === 'UL' && p.classList.contains('submenu')) {
        const parentLi = p.parentElement;
        if (parentLi) path.push(parentLi);
        p = parentLi?.parentElement;
      } else {
        p = p.parentElement;
      }
    }
    return path;
  };

  const filterTree = (queryRaw) => {
    const q = norm(queryRaw);
    if (!q) {
      // clear search → επαναφορά state
      tree.querySelectorAll('li').forEach(li => li.style.display = '');
      collapseAll();
      loadState();
      return;
    }

    // κρύψε τα πάντα και εμφάνισε μόνο τα matches + τους προγόνους τους
    tree.querySelectorAll('li').forEach(li => li.style.display = 'none');

    tree.querySelectorAll('#nav-tree li > a').forEach(a => {
      const txt = norm(a.textContent || '');
      if (txt.includes(q)) {
        const li = a.closest('li');
        li.style.display = '';
        pathToRoot(li).forEach(pli => {
          pli.style.display = '';
          setExpandedState(pli, true); // άνοιγμα γονέων για να φαίνεται
        });
      }
    });

    // γύρνα στην κορυφή του scroll
    if (scrollArea) scrollArea.scrollTop = 0;
  };

  const debounce = (fn, ms = 150) => {
    let t = 0;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  searchInput?.addEventListener('input', debounce(e => {
    filterTree(e.target.value);
  }, 150));
});

// ✅ dropdown-item.js – Tom-Select v2.4.3  +  custom infinite scroll (ΧΩΡΙΣ virtual_scroll)

const globalRenderMap = {};
const globalHookMap   = {};
const templateCache   = {};

window.setTomDropdownRender = (id, r) => (globalRenderMap[id] = r);
window.setTomDropdownHooks  = (id, h) => (globalHookMap[id]  = h);

const debounce = (fn, d = 100) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),d);} };

/* ------------------------------------------------------------------ *
 * initTomDropdown
 * ------------------------------------------------------------------ */
export const initTomDropdown = ({
  selector,
  url,
  extraParams = {},
  render      = {},
  hooks       = {},
  minChars    = 0
}) => {
  if (!selector || !url) return;
  const el = document.querySelector(selector);
  if (!el) return;

  const isMultiple = el.hasAttribute('multiple');

  /** ----------------------------------------------------------------
   *  Helper: χτίζουμε next-page URL
   * ----------------------------------------------------------------*/
  const nextUrl = (current) => {
    const u = new URL(current);
    const p = (+u.searchParams.get('page') || 1) + 1;
    u.searchParams.set('page', p);
    return u.toString();
  };

  /** ----------------------------------------------------------------
   *  TomSelect instance
   * ----------------------------------------------------------------*/
  const tom = new TomSelect(el, {
    valueField   : 'value',
    labelField   : 'label',
    searchField  : ['label'],
    maxOptions   : null,
    maxItems     : isMultiple ? null : 1,
    hideSelected : true,
    create       : false,
    persist      : false,
    preload      : true,            // πρώτη σελίδα auto-fetch
    placeholder  : '',
    plugins      : [ ...(isMultiple ? ['remove_button'] : []) ],   // 🔹 ΧΩΡΙΣ virtual_scroll

    /* ---------- custom LOAD (page 1) ---------- */
    load : async function (query, callback) {

      /* 1.  URL προς fetch */
      const urlToFetch =
        (typeof query === 'string' && query.startsWith('http'))
          ? query
          : (() => {
              const u = new URL(url, location.origin);
              Object.entries(extraParams).forEach(([k,v]) => v && u.searchParams.set(k,v));
              if (query.length >= minChars) u.searchParams.set('search', query);
              u.searchParams.set('page', 1);
              u.searchParams.set('limit', 50);
              return u.toString();
            })();

      try {
        /* 2.  fetch JSON */
        const res = await fetch(urlToFetch, { credentials:'include' }).then(r => r.json());
        const { items = [], hasMore = false } = res;

        /* 3.  κρατάμε nextPage URL για το χειροποίητο infinite scroll */
        this.nextPage = hasMore ? nextUrl(urlToFetch) : null;

        /* 4.  επιστρέφουμε items στην TomSelect */
        callback(items);

      } catch (err) {
        console.error('❌ Dropdown load failed', err);
        callback();                            // “No results”
      }
    },

    /* ---------- render ---------- */
    render : {
      option : (d,e) => `<div class="ts-option">${e(d.label)}</div>`,
      item   : (d,e) => `<div class="item" data-value="${e(d.value)}">${e(d.label)}</div>`,
      ...render
    },

    /* ---------- lifecycle ---------- */
    // onInitialize () {
    //   this.wrapper.classList.add('dropdown-wrapper');
    //   this.control_input.classList.add('dropdown-input');

    //   if (isMultiple && typeof hooks.onInit === 'function') hooks.onInit(this);

    //   this.wrapper.style.position = 'relative';
    //   this.control_input.removeAttribute('placeholder');

    //   if (isMultiple) {
    //     const refresh = debounce(()=>updateOverflow(this),50);
    //     refresh();
    //     this.on('item_add',   refresh);
    //     this.on('item_remove',refresh);
    //     window.addEventListener('resize', refresh);
    //   }
    // },
/* ---------- lifecycle ---------- */
onInitialize () {
  /* κοινό setup */
  this.wrapper.classList.add('dropdown-wrapper');
  this.control_input.classList.add('dropdown-input');
  this.wrapper.style.position = 'relative';
  this.control_input.removeAttribute('placeholder');

  /* ➤ πρώτη κλήση ΠΑΝΤΑ */
  updateOverflow(this);

  /* hooks του project σου */
  if (isMultiple && typeof hooks.onInit === 'function') hooks.onInit(this);

  /* MULTI -----------------------------------------------------------*/
  if (isMultiple) {
    const refresh = debounce(() => updateOverflow(this), 50);
    refresh();                                   // ← ήδη έγινε, αλλά ok
    this.on('item_add',    refresh);
    this.on('item_remove', refresh);
    window.addEventListener('resize', refresh);
  }

  /* SINGLE ----------------------------------------------------------*/
  else {
    /* όταν αλλάζει τιμή (add / clear) */
    this.on('change', () => updateOverflow(this));

    /* trigger ξανά μόλις κλείσει το dropdown (π.χ. Esc χωρίς αλλαγή) */
    this.on('dropdown_close', () => updateOverflow(this));
  }
},

    onDropdownOpen () {
      // placeholder μέσα στο input του dropdown
      this.dropdown.querySelector('.dropdown-input')
          ?.setAttribute('placeholder', el.getAttribute('placeholder') || 'Αναζήτηση…');

      // bind once το χειροποίητο infinite scroll
      if (!this._infiniteBound) {
        const content = this.dropdown.querySelector('.ts-dropdown-content');
        if (content) {
          content.addEventListener('scroll', () => handleScroll(this, content), { passive:true });
          this._infiniteBound = true;
        }
      }
      hooks.onOpen?.(this);
    },

    onDropdownClose () {
      this.dropdown.querySelector('.dropdown-input')?.removeAttribute('placeholder');
    },

    onFocus () {
      if (this.ignoreFocusOpen){ this.ignoreFocusOpen=false; this.blur(); }
    },

    onChange (vals) {
      if (!this.settings.mode.includes('multi') || !Array.isArray(vals)) return;
      const recs = vals.map(v=>this.options[v]);
      recs.sort((a,b)=>parseInt(a.label)-parseInt(b.label));
      this.setValue(recs.map(r=>r.value), true);
    }
  });

  /** ----------------------------------------------------------------
   *  Χειροποίητο infinite scroll
   * ----------------------------------------------------------------*/
  async function handleScroll (instance, content) {
    if (!instance.nextPage || instance._loadingNext) return;

    const bottom = content.scrollTop + content.clientHeight;
    if (bottom < content.scrollHeight - 50) return;   // ακόμη μακριά

    instance._loadingNext = true;
    const urlToFetch = instance.nextPage;

    try {
      const res = await fetch(urlToFetch, { credentials:'include' }).then(r => r.json());
      const { items = [], hasMore = false } = res;

      /* προσθέτουμε options */
      items.forEach(item => {
        if (!instance.options[item.value]) instance.addOption(item);
      });
      instance.refreshOptions(false);

      /* ανανεώνουμε nextPage */
      instance.nextPage = hasMore ? nextUrl(urlToFetch) : null;

    } catch (err) {
      console.error('❌ Dropdown next-page load failed', err);
    } finally {
      instance._loadingNext = false;
    }
  }

  /* --------------------------------------------------------------- */
  window.__tomInstances = window.__tomInstances || {};
  window.__tomInstances[selector] = tom;
};

/* ------------------------------------------------------------------
 * updateOverflow – κοινός helper για όλα τα TomSelect instances
 *   ▸ multi-select :  +N indicator  +  reset (+ / −)
 *   ▸ single-select:  trash-clear  (🗑)  +  ellipsis σε μακρύ label
 * ------------------------------------------------------------------ */
function updateOverflow (tom) {
  // 1. Safety checks -------------------------------------------------
  if (!tom?.wrapper) return;

  const wrapper = tom.wrapper;               // .ts-wrapper
  const ctrl    = wrapper.querySelector('.ts-control');
  if (!ctrl) return;

  const isMulti = tom.settings.mode?.includes?.('multi');

  /* ==================================================================
   *  SINGLE-SELECT MODE                                               */
  /* ==================================================================*/
  if (!isMulti) {
    /* ----------------------------------------------------------------
     * A. Δημιουργία / update του trash-clear κουμπιού
     * ----------------------------------------------------------------*/
    let trash = wrapper.querySelector('.ts-single-reset-btn');
    if (!trash) {
      // Στήνουμε relative ώστε το absolute να δουλέψει σωστά
      if (getComputedStyle(wrapper).position === 'static') {
        wrapper.style.position = 'relative';
      }
      wrapper.style.overflow = 'visible';

      // κάνουμε flex το control ώστε το label να μπορεί να συρρικνωθεί
      ctrl.style.display = 'flex';
      ctrl.style.alignItems = 'center';

      trash           = document.createElement('button');
      trash.type      = 'button';
      trash.className = 'ts-single-reset-btn ts-fill-reset-btn';
      trash.title     = 'Καθαρισμός επιλογής';
      trash.innerHTML = '<i class="bi bi-trash3"></i>'; // bootstrap-icons
      trash.style.cssText = [
        'position:absolute',
        'top:50%',
        'left:calc(100% + 4px)', // 4 px δεξιά από το ts-control
        'transform:translateY(-50%)',
        'padding:0',
        'padding:0 0.25rem',
        'border:none',
        'cursor:pointer',
        'color:#6c757d',
        'line-height:1',
        'font-size:1rem',
        'cursor:pointer',
        'z-index:2'
      ].join(';');
      wrapper.appendChild(trash);

      // Click handler – clear & refresh
      trash.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!(tom.items || []).length) return;

        tom.ignoreFocusOpen = true;
        tom.clear();
        tom.close();
        tom.control_input.blur();
        tom.ignoreFocusOpen = false;

        setTimeout(() => tom?.wrapper && updateOverflow(tom), 0);
      });
    }

    // Εμφάνιση / απόκρυψη ανάλογα με επιλογή
    trash.style.display = (tom.items || []).length ? '' : 'none';

    /* ----------------------------------------------------------------
     * B. Ellipsis στο label όταν είναι μακρύ
     * ----------------------------------------------------------------*/
    const itemEl = ctrl.querySelector('.item');
    if (itemEl) {
      itemEl.style.flex         = '1 1 auto';   // παίρνει διαθέσιμο χώρο
      itemEl.style.minWidth     = '0';          // επιτρέπει shrink
      itemEl.style.whiteSpace   = 'nowrap';
      itemEl.style.overflow     = 'hidden';
      itemEl.style.textOverflow = 'ellipsis';
      itemEl.style.paddingRight = '0.75rem';    // οπτικό κενό
      itemEl.style.backgroundColor = 'transparent';
    }

    return; // single-select τελείωσε εδώ
  }

  /* ==================================================================
   *  MULTI-SELECT MODE                                                */
  /* =================================================================*/

  /* 2. resetBtn (+/−) — δημιουργείται ΠΑΝΤΑ μία φορά -----------------*/
  if (!ctrl.querySelector('.ts-fill-reset-btn')) {
    const resetBtn = document.createElement('button');
    resetBtn.className = 'ts-fill-reset-btn';
    resetBtn.type      = 'button';
    resetBtn.title     = 'Επιλογή όλων ή Καθαρισμός';
    resetBtn.innerHTML = '<i class="bi bi-plus-slash-minus"></i>';
    resetBtn.style.cssText = 'margin-left:2.5rem!important';
    ctrl.appendChild(resetBtn);

    /* ⇄ toggle: αν υπάρχουν tags → clear, αλλιώς → επίλεξε ΟΛΑ χωρίς dropdown */
    resetBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      tom.ignoreFocusOpen = true; // stop auto-open

      try {
        const hasTags = (tom.items || []).length > 0;

        if (hasTags) {
          tom.clear();                       // clear all
        } else {
          /* ▸▸ Επιλογή ΟΛΩΝ ------------------------------------------------*/
          let allValues = Object.values(tom.options).map(o => o.value);

          // αν είναι κενό (π.χ. remote) → fetch
          if (!allValues.length && typeof url !== 'undefined') {
            const finalUrl = new URL(url, window.location.origin);
            if (typeof extraParams === 'object') {
              Object.entries(extraParams).forEach(([k, v]) => v && finalUrl.searchParams.set(k, v));
            }
            try {
              const json = await fetch(finalUrl, { credentials: 'include' }).then(r => r.json());
              const allItems = json.items || [];
              tom.addOptions(allItems);
              allValues = allItems.map(i => i.value);
            } catch (err) {
              console.error('❌ resetBtn remote load failed', err);
            }
          }

          if (allValues.length) {
            tom.setValue([], true);          // redraw trick
            tom.setValue(allValues, true);
          }
        }
      } finally {
        tom.close();
        tom.control_input.blur();
        tom.ignoreFocusOpen = false;
        setTimeout(() => tom?.wrapper && updateOverflow(tom), 0);
      }
    });
  }

  /* 3. Υπολογισμός overflow -----------------------------------------*/
  const ARROW = 36, GAP = 28;
  const wrapW = wrapper.getBoundingClientRect().width;
  let avail   = wrapW - ARROW;
  let total   = 0;

  const items = [...ctrl.querySelectorAll('.item')].filter(i => !i.closest('.ts-overflow-popup'));

  // καθάρισμα προηγούμενων δεικτών
  ctrl.querySelector('.ts-overflow-indicator')?.remove();
  ctrl.querySelector('.ts-overflow-popup')?.remove();

  const hidden = [];
  for (let i = items.length - 1; i >= 0; i--) {
    const el = items[i];
    el.style.display = '';
    const w = el.offsetWidth + (parseInt(getComputedStyle(el).marginRight) || 0) + GAP;
    if (total + w <= avail) {
      total += w;
    } else {
      hidden.push(el);
    }
  }
  hidden.forEach(el => el.style.display = 'none');

  if (!hidden.length) return;   // early exit (resetBtn κρατήθηκε)

  /* 4. +N indicator & ταξινομημένο popup -----------------------------*/
  const dot = document.createElement('div');
  dot.className = 'ts-overflow-indicator';
  dot.tabIndex  = -1;
  dot.textContent = `+${hidden.length}`;
  dot.title       = `Πατήστε για εμφάνιση (${hidden.length} ακόμη)`;
  ctrl.appendChild(dot);

  dot.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    tom.ignoreFocusOpen = true;
    tom.control_input.blur();

    setTimeout(() => {
      tom.ignoreFocusOpen = false;
      if (ctrl.querySelector('.ts-overflow-popup')) return;

      const popup = document.createElement('div');
      popup.className = 'ts-overflow-popup';

      const sorted = hidden.slice().sort((a, b) => {
        const extract = (el) => {
          const lbl = (tom.options[el.dataset.value]?.label || el.dataset.value).split('-')[0].trim();
          return lbl;
        };
        return extract(a).localeCompare(extract(b), undefined, { numeric: true, sensitivity: 'base' });
      });

      popup.innerHTML = sorted.map(el => {
        const v = el.dataset.value;
        const l = tom.options[v]?.label || v;
        return `<div class="ts-popup-row"><span>${l}</span><button data-val="${v}" title="Αφαίρεση"><i class="bi bi-trash3"></i></button></div>`;
      }).join('');

      document.body.appendChild(popup);
      const r = wrapper.getBoundingClientRect();
      popup.style.cssText = `position:absolute;z-index:99999;top:${r.bottom + 2}px;left:${r.left}px;width:${r.width}px;`;

      // auto-height με όριο 8 lines
      const rowH = popup.querySelector('.ts-popup-row')?.offsetHeight || 32;
      const lim  = Math.min(rowH * 8 + 8, window.innerHeight - r.bottom - 8);
      if (popup.offsetHeight > lim) {
        popup.style.maxHeight = `${lim}px`;
        popup.style.overflowY = 'auto';
      }

      // κουμπάκια αφαίρεσης μέσα στο popup
      popup.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          ctrl.querySelector(`.item[data-value="${btn.dataset.val}"] .remove`)?.click();
          popup.remove();
          updateOverflow(tom);
        });
      });

      // κλείσιμο popup όταν κλικάρει έξω ή ξαναπατήσει το +N
      document.addEventListener('click', function close(ev) {
        if (!popup.contains(ev.target) && ev.target !== dot) {
          popup.remove();
          document.removeEventListener('click', close);
        }
      });
    }, 0);
  });
}

window.tomDropdownConfig={
  setRender:(id,r)=>globalRenderMap[id]=r,
  setHooks :(id,h)=>globalHookMap[id]=h,
  setTemplate:(id,t)=>templateCache[id]=t
};

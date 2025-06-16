// ✅ dropdown-item.js – Tom-Select v2.4.3  +  custom infinite scroll (ΧΩΡΙΣ virtual_scroll)

const globalRenderMap = {};
const globalHookMap   = {};
const templateCache   = {};
const selectedCache = {};

window.setTomDropdownRender = (id, r) => (globalRenderMap[id] = r);
window.setTomDropdownHooks  = (id, h) => (globalHookMap[id]  = h);

const debounce = (fn, d = 100) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),d);} };

export const initTomDropdown = ({
    selector,
    url,
    extraParams = {},
    render      = {},
    hooks       = {},        // επιπλέον events του caller
    minChars    = 0,
} = {}) => {
    if (!selector || !url) return;
    const el = document.querySelector(selector);
    if (!el) return;
    // ⬅️ Αν υπάρχει pad-length στο HTML, πέρασέ το στα extraParams
    const padLength = el.dataset.padLength;
    if (padLength && !extraParams.padLength) {
        extraParams.padLength = padLength;
    }

    /* -------------------------------------------------------------- */
    /* helper: πόσο είναι το limit που ζητήσαμε στην κλήση            */
    const getLimitFromUrl = (urlStr) => {
        const v = parseInt(new URL(urlStr, location.origin)
                .searchParams.get('limit'), 10);
        return Number.isFinite(v) && v > 0 ? v : 50;      // default 50
    };

    /* helper: επόμενη σελίδα, κληρονομεί ΟΛΑ τα query-params         */
    const buildNextPageUrl = (urlStr) => {
        const urlObj = new URL(urlStr, location.origin);
        const next = (+urlObj.searchParams.get('page') || 1) + 1;
        urlObj.searchParams.set('page', next);
        return urlObj.toString();
    };

    /* ---------------------------------------------------------------- */
    const isMultiple = el.hasAttribute('multiple');
    const preloadAll = el.dataset.preloadAll === 'true';

    /* helper για next‑page URL  -------------------------------------- */
    const nextUrl = (current) => {
        const urlObj = new URL(current);
        const p = (+urlObj.searchParams.get('page') || 1) + 1;
        urlObj.searchParams.set('page', p);
        return urlObj.toString();
    };

    /* ---------------------------------------------------------- */
    // ➜ αποθηκεύουμε τυχόν custom onInitialize που πέρασε ο caller
    const userOnInit = hooks.onInitialize || hooks.initialize;
    delete hooks.onInitialize;
    delete hooks.initialize;

    /* ---------------------------------------------------------- */
    let currentAbort = null;

    const tom = new TomSelect(el, {
        /* ▼ βασικά πεδία ▼ */
        valueField      : 'value',
        labelField      : 'label',
        searchField     : ['label'],
        sortField       : 'index',
        /* custom score ώστε κενό search ⇒ όλα τα items */
        score(search) {
            if (!search || !Array.isArray(search.tokens) || !search.tokens.length) {
                return () => 1;
            }
            const toks = search.tokens.map(t => t.string.toLowerCase());
            return (item) => toks.every(t => item.label.toLowerCase().includes(t)) ? 1 : 0;
        },

        maxOptions   : null,
        maxItems     : isMultiple ? null : 1,
        hideSelected : isMultiple,   // false → single, true → multi
        create       : false,
        persist      : false,

        /* preload λογική */
        preload      : preloadAll ? 'focus' : false,
        loadThrottle : 0,
        shouldLoad   : (q) => preloadAll ? true : q.trim().length >= minChars,

        placeholder  : el.getAttribute('placeholder') || 'Αναζήτηση…',
        plugins      : [ ...(isMultiple ? ['remove_button'] : []), 'dropdown_input' ],
        // plugins      : [ ...(isMultiple ? ['remove_button'] : ['clear_button']), 'dropdown_input' ],

        /* ------ async LOAD (σελίδα 1) ------------------------- */
        async load(searchText, callback) {

            /* 1. ακύρωσε τυχόν προηγούμενο fetch */
            try { currentAbort?.abort(); } catch {}
            currentAbort = new AbortController();

            /* 2. χτίζω το URL  – το δικό σου κομμάτι μένει όπως ήταν */
            const urlToFetch = (typeof searchText === 'string' && searchText.startsWith('http'))
                ? searchText
                : (() => {
                    const urlObj = new URL(url, location.origin);
                    Object.entries(extraParams).forEach(([k,v]) => v && urlObj.searchParams.set(k,v));
                    urlObj.searchParams.set('search', searchText || '');
                    urlObj.searchParams.set('page',   1);
                    urlObj.searchParams.set('limit',  50);
                    return urlObj.toString();
                    })
                ();

            try {
                /* 3. fetch */
                const json = await fetch(urlToFetch, { signal: currentAbort.signal })
                                        .then(r => r.json());
                let items = Array.isArray(json.items) ? json.items : [];

                /* 4. πρόσθεσε ΟΠΟΙΟ επιλεγμένο λείπει */
                this.items.forEach(v => {
                    const cached = selectedCache[v];
                    const alreadyInOptions = this.options[v];

                    if (!alreadyInOptions && cached) {
                        this.addOption(cached);
                        console.log('✅ Re-added cached selected option:', v);
                    } else if (!cached) {
                        console.warn('⚠️ Cannot re-add – missing from cache:', v);
                    }
                });

                /* 5. πέρασέ τα στον Tom-Select */
                items.length ? callback(items) : callback();   // κλείνει και το spinner

                /* 6. diff-clean-up  */
                const idKey = this.settings.valueField;        // π.χ. 'kodikos'
                const keep  = new Set([
                    ...(this.items || []),                       // ήδη επιλεγμένα
                    ...items.map(o => o[idKey])                  // φρέσκα + «ενέσεις»
                ]);
                Object.keys(this.options).forEach(id => {
                    if (!keep.has(id)) this.removeOption(id);
                });

                /* 7. endless-scroll: επόμενη σελίδα */
                const limit   = Number(new URL(urlToFetch).searchParams.get('limit')) || 50;
                const hasMore = ('hasMore' in json) ? !!json.hasMore
                                                    : items.length === limit;
                this.nextPage = hasMore ? nextUrl(urlToFetch) : null;

            } catch (err) {
                if (err.name !== 'AbortError') console.error('Dropdown load failed', err);
                callback();                 // κλείσε spinner σε κάθε σφάλμα
            }
        },
        /* ------ render ----------------------------------------- */
        render : {
            option(optionData, e) {
                return `<div class="ts-option">${e(optionData.label)}</div>`;
            },
            item(optionData, e) {
                if (!optionData || typeof optionData !== 'object' || !('value' in optionData)) {
                    return '<div class="item">(???)</div>';
                }
                const vKey = this.settings.valueField || 'value';
                return `<div class="item" data-value="${e(optionData[vKey])}">${e(optionData.label)}</div>`;
                },
            ...render,
        },

        /* flag ώστε να είναι διαθέσιμο στο onInitialize */
        _preloadAll : preloadAll,

        /* ===== onInitialize (core + project specific + χρήστη) ===== */
        onInitialize() {
            /******************* A. Core reset logic *******************/
            const resetList = () => {
                this.setTextboxValue('');
                // this.lastQuery = '';
                this.clearFilter();          // μηδενίζει το εσωτερικό filter του TS
                this.refreshOptions(false);  // επαναφέρει hideSelected
            };

            const isMultiple = el.hasAttribute('multiple');

            /* -- επιλέχθηκε item (ΜΟΝΟ στο multiple) --------------*/
            if (isMultiple) {
                this.on('item_add', value => {

                    // ➜ αφήνουμε τον Tom-Select να ρίξει πρώτα το tag στο DOM
                    setTimeout(() => {
                        const q = this.lastQuery;

                        resetList();                     // τώρα δεν «σβήνει» το tag

                        if (!this.settings._preloadAll && q) {
                            this.load(q);
                        }
                        this.open();                     // dropdown μένει ανοιχτό
                    }, 0);                               // 0 ms = τρέχει στο επόμενο tick
                });
            } else {
                /* SINGLE: συμπεριφορά όπως πριν */
                this.on('item_add', () => {
                    resetList();
                    this.ignoreFocusOpen = true;
                    this.close();
                    this.control_input.blur();
                    setTimeout(() => (this.ignoreFocusOpen = false), 0);
                });
            }


            // /* ➜ κλείσιμο + blur ΜΟΝΟ μετά από επιλογή */
            /* -- clear (σκουπιδάκι) -------------------------------- */
            this.on('clear', () => {
                // 1. εσωτερικό reset
                resetList();
                // 2. ο TomSelect καθαρίζει selected ⇒ ας κάνουμε reload
                this.clearOptions();
                this.nextPage = null;
                if (this.settings._preloadAll) {
                    this.load('');       // φέρνει ξανά όλα ~50 options
                }
                // 3. μικρό delay ώστε refreshOptions να "δει" τα νέα data
                setTimeout(() => this.refreshOptions(false));
            });

            /* -- focus (dropdown_open) ----------------------------- */
            this.on('dropdown_open', () => {
                if (this.settings._preloadAll && !this.control_input.value) {
                    if (Object.keys(this.options).length < 2) {
                        this.load('');
                    } else {
                        this.refreshOptions(false);
                    }
                }
            });

            /******************* B. Project‑specific setup *****************/
            this.wrapper.classList.add('dropdown-wrapper');
            this.control_input.classList.add('dropdown-input');
            this.wrapper.style.position = 'relative';
            const phTxt = el.getAttribute('placeholder') || 'Αναζήτηση…';
            this.control_input.setAttribute('placeholder', phTxt);

            this.on('type', debounce((query) => {
                /* κενό search ----------------------------------------------*/
                if (!query.trim()) {
                    this.nextPage = null;
                    if (this.settings._preloadAll) {
                        this.load('');                 // default λίστα
                    } else {
                        this.refreshOptions(false);    // απλώς ξαναδείξε τη cache
                    }
                    return;
                }

                /* κανονικό search ------------------------------------------*/
                /* ΔΕΝ καλούμε clearOptions()  -> κρατά τα ήδη selected options */
                this.clearOptions();
                this.nextPage = null;
                this.load(query);
            }, 300));


            // overflow handling -----------------------------------
            updateOverflow(this);
            if (isMultiple && typeof hooks.onInit === 'function') hooks.onInit(this);

            if (isMultiple) {
                const refresh = debounce(() => updateOverflow(this), 50);
                refresh();
                this.on('item_add',    refresh);
                this.on('item_remove', refresh);
                window.addEventListener('resize', refresh);
            } else {
                this.on('change', () => updateOverflow(this));
                this.on('dropdown_close', () => updateOverflow(this));
            }

            /******************* C. Custom onInitialize (caller) ***********/
            if (typeof userOnInit === 'function') userOnInit.call(this);

            /* -------------------------------------------------------------
             *  Προεπιλογή κωδικού από τη ΒΔ
            * ------------------------------------------------------------*/

// 🔁 Re-render any missing tags manually (multi-select issue fix)
this.items.forEach(val => {
    const itemExists = this.control.querySelector(`.item[data-value="${val}"]`);
    if (!itemExists) {
        console.warn('⚠️ Missing tag for value:', val, '→ Re-adding...');
        this.removeItem(val, true);
        this.addItem(val);
    }
});

            const preSel = el.dataset.preselect;
            const code = document.getElementById(preSel)?.value?.trim();
            if (code) {
                fetch(`${url}?value=${encodeURIComponent(code)}`, { credentials: 'include' })
                    .then(r => r.json())
                    .then(({ items }) => {
                        if (items?.length) {
                            this.addOption(items[0]);
                            this.setValue(code, true);
                            selectedCache[code] = items[0];
                        }
                    })
                    .catch(console.error);
            }

            /* -----------------------------------------------------------------
            *  Α. Ενημέρωση κρυφού input  ΜΟΝΟ στο single
            * ----------------------------------------------------------------*/
            if (!isMultiple) {
                this.on('change', val => {
                    const inputId = el.dataset.targetInput;
                    const input   = document.getElementById(inputId);
                    if (input) input.value = val;
                });
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
            // ➜ αν φαίνεται σκουπιδάκι, «πάτα» το
            clickClearIfVisible(this);

            if (!this.ignoreFocusOpen) this.open();
        },

        onChange (vals) {
            if (!this.settings.mode.includes('multi') || !Array.isArray(vals)) return;
            const recs = vals.map(v=>this.options[v]);
            recs.sort((a,b)=>parseInt(a.label)-parseInt(b.label));
        }
    });

    const preselectId = el.dataset.preselect;
    const preselectValue = document.getElementById(preselectId)?.value;

    if (preselectValue) {
        fetch(`/api/dropdown/kad?value=${encodeURIComponent(preselectValue)}`)
            .then(res => res.json())
            .then(data => {
                const item = data.items?.[0]; // ή αναλόγως το format του API
                if (item) {
                    tom.addOption(item);
                    tom.setValue(preselectValue, true);
                    selectedCache[preselectValue] = item;
                    console.log('✅ Preselect fetched & applied', item);
                } else {
                    console.warn('⚠️ No matching item found in fetch for', preselectValue);
                }
            })
        .catch(err => console.error('❌ Preselect fetch failed:', err));
    }
    tom.on('item_add', (value, data) => {
        if (!data || !data.value) {
            data = tom.options?.[value];
        }

        if (data) {
            selectedCache[value] = data;

            // ✅ Αν δεν υπάρχει στο options, ξαναπέρασέ το
            if (!tom.options[value]) {
                tom.addOption(data);
                console.log('✅ Re-injected missing option on add', value);
            }

        } else {
            console.error('❌ item_add: cannot cache or re-add', value);
        }
    });

    /** ----------------------------------------------------------------
    *  Χειροποίητο infinite scroll
    * ----------------------------------------------------------------*/
    async function handleScroll (instance, content) {

        if (!instance.nextPage || instance._loadingNext) return;
        if (content.scrollTop + content.clientHeight < content.scrollHeight - 50) return;

        instance._loadingNext = true;
        const urlToFetch = instance.nextPage;

        try {
      
            const json     = await fetch(urlToFetch, { credentials: 'include' }).then(r => r.json());
            const items    = Array.isArray(json.items) ? json.items : [];
            if (items.length < getLimitFromUrl(urlToFetch)) {
                instance.nextPage = null;           // ⇠ ΤΕΛΟΣ – δεν υπάρχει άλλη σελίδα
            }

            const hasMore  = ('hasMore' in json)
                    ? Boolean(json.hasMore)
                    : items.length === getLimitFromUrl(urlToFetch);

            /* ----- DEBUG & ασφαλιστική δικλίδα -------------------------------- */
            /* Αν η τρέχουσα σελίδα γύρισε λιγότερα από limit ⟶ δεν υπάρχει άλλη */
            if (items.length < getLimitFromUrl(urlToFetch)) {
                instance.nextPage = null;   // σταματάει το infinite scroll
            } else {
                instance.nextPage = hasMore ? buildNextPageUrl(urlToFetch) : null;
            }
            
            /* ------------------------------------------------------------------- */
            /* ▸▸ 1.  Θυμόμαστε scroll & ύψος ΠΡΙΝ την προσθήκη */
            const prevScroll  = content.scrollTop;
            const prevHeight  = content.scrollHeight;

            /* ▸▸ 2.  προσθέτουμε options */
            let newCount = 0;
            items.forEach(item => {
                if (!instance.options[item.value]) {
                    instance.addOption(item);
                    newCount++;
                }
            });
            instance.refreshOptions(false);

            /* Αν δεν προσθέσαμε τίποτα καινούργιο → τέλος infinite */
            if (newCount === 0) {
                instance.nextPage = null;
                instance._loadingNext = false;
                return;
            }

            /* ▸▸ 3.  επαναφέρουμε τη θέση 1-του-πριν */
            requestAnimationFrame(() => {
                const newHeight   = content.scrollHeight;
                const delta       = newHeight - prevHeight;
                // Αφήνουμε ένα περιθώριο ασφαλείας από το τέλος της scrollbar (σε pixel)
                const SAFE = 500;

                content.scrollTop = prevScroll + delta - SAFE;
            });

        } catch (err) {
            console.error('❌ Dropdown next-page load failed', err);
        } finally {
            instance._loadingNext = false;
        }
    }

    /* --------------------------------------------------------------- */
    (window.__tomInstances ??= {})[selector] = tom;
};

const CLEAR_BTN_SELECTOR = '.ts-single-reset-btn';

function clickClearIfVisible(ts) {
    const btn = ts.wrapper.querySelector(CLEAR_BTN_SELECTOR);
    // ➜ offsetParent === null → το element είναι display:none ή hidden
    if (btn && btn.offsetParent !== null) {
        btn.click();          // πυροδοτεί το 'clear' + ό,τι handler έχεις
    }
}

/* ------------------------------------------------------------------
 * updateOverflow – κοινός helper για όλα τα TomSelect instances
 *   ▸ multi-select :  +N indicator  +  reset (+ / −)
 *   ▸ single-select:  trash-clear  (🗑)  +  ellipsis σε μακρύ label
 * ------------------------------------------------------------------ */
function updateOverflow(tom) {
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
        // ✔ Μόλις γίνει ορατό, πάρε focus
        if (trash.style.display !== 'none') {
            trash.focus();
        }
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
                    tom.clear();       // clear all
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
        for (let i = 0; i < items.length; i++) {
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

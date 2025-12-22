// ✅ dropdown-item.js – Tom-Select v2.4.3  +  custom infinite scroll (ΧΩΡΙΣ virtual_scroll)

const globalRenderMap = {};
const globalHookMap   = {};
const templateCache   = {};
const selectedCache = {};

window.setTomDropdownRender = (id, r) => (globalRenderMap[id] = r);
window.setTomDropdownHooks  = (id, h) => (globalHookMap[id]  = h);

const debounce = (fn, d = 100) => {
	let t;
	return (...args) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...args), d);
	};
};

// dropdown-item.js

export function attachInlineSummary(tom, el) {
	if (!tom || !el) return;
	if (tom.settings.maxItems === 1) return;           // μόνο για multiple

	const host = tom.wrapper || tom.control;
	if (!host) return;

	// να έχει βάση για absolute και να μην κόβει
	const cs = getComputedStyle(host);
	if (cs.position === 'static') host.style.position = 'relative';
	host.style.overflow = 'visible';

	// φτιάξε/πάρε το inline box
	let box = el.__inlineSummary;
	if (!box) {
		box = document.createElement('div');
		box.className = 'ts-inline-summary';
		Object.assign(box.style, {
			position: 'absolute',
			left: '8px',
			right: '56px',                 // reserve για βελάκι/clear
			top: '50%',
			transform: 'translateY(-50%)',
			whiteSpace: 'nowrap',
			overflow: 'hidden',
			textOverflow: 'ellipsis',
			pointerEvents: 'none',
			zIndex: 10,
			display: 'none'
		});
		el.__inlineSummary = box;
		host.appendChild(box);
	}

	const peek = parseInt(el.dataset.summaryPeek || el.dataset.inlinePeek || '1', 10) || 1;
	const pad4 = s => String(s ?? '').replace(/\D/g,'').padStart(4,'0');

	const calcRight = () => {
		let reserve = 56;
		try {
			const rectHost = host.getBoundingClientRect();
			let rightMost = 0;
			for (const c of Array.from(host.children)) {
				if (c === box) continue;
				const r = c.getBoundingClientRect();
				if (r.width > 0 && r.right > rightMost) rightMost = r.right;
			}
			const free = Math.max(0, rectHost.right - rightMost) + 16; // +1rem
			if (free > 36) reserve = free;
		} catch {}
		box.style.right = reserve + 'px';
	};

	const render = () => {
		const vals = tom.items || [];
		if (!vals.length) { box.style.display = 'none'; return; }

		const labels = vals.map(v => {
			const o = tom.options[v] || {};
			return (o.label || o.text || (o.kodikos != null ? pad4(o.kodikos) : v)).toString();
		}).filter(Boolean);

		const head = labels.slice(0, peek).join(', ');
		const rest = labels.length - peek;
		box.textContent = rest > 0 ? `${head} +${rest}` : head;
		box.style.display = 'block';
		calcRight();
	};

	const rerender = () => { try { render(); } catch {} };
	tom.on('item_add', rerender);
	tom.on('item_remove', rerender);
	tom.on('clear', rerender);
	tom.on('change', rerender);
	tom.on('load', rerender);
	new MutationObserver(rerender).observe(host, { childList:true, subtree:true });
	window.addEventListener('resize', rerender, { passive:true });
	setTimeout(rerender, 0);
}

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
    
    // ✅ Ασφαλής καθαρισμός υπάρχοντος instance
    if (el.tomselect) {
        el.tomselect.destroy();
    }

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
    const isMultiple = el.hasAttribute('multiple') ;
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
    // let currentAbort = null;

    const tom = new TomSelect(el, {
        /* ▼ βασικά πεδία ▼ */
        valueField      : 'value',
        labelField      : 'label',
        searchField     : ['label'],
        sort            : false,
        dropdownDirection: 'auto',

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

        placeholder  : '',
        plugins      : [ ...(isMultiple ? ['remove_button'] : []), 'dropdown_input' ],

        /* ------ async LOAD (σελίδα 1) ------------------------- */
        async load(searchText, callback) {
            // ✅ Debounce guard για διαδοχικά calls
            const now = Date.now();
            if (this._lastLoadTime && now - this._lastLoadTime < 150) { // increased from 50 -> 150 to reduce aborts
                callback();
                return;
            }
            this._lastLoadTime = now;
    
            /* 1. ακύρωσε τυχόν προηγούμενο fetch */
            try { this._currentAbort?. abort(); } catch {}
            this._currentAbort = new AbortController();
    
            /* 2. χτίζω το URL  – το δικό σου κομμάτι μένει όπως ήταν */
            let urlToFetch;
            if (typeof searchText === 'string' && searchText.startsWith('http')) {
                urlToFetch = searchText;
            } else {
                const urlObj = new URL(url, location.origin);
                Object.entries(extraParams).forEach(([k, v]) => v && urlObj.searchParams.set(k, v));

                // 🟢 extra filter από άλλο input (π.χ. σύμβαση σε εξαρτημένο dropdown)
                const extraFilterId = el.dataset.extraFilter;
                if (extraFilterId) {
                    const extraFilterVal = document.getElementById(extraFilterId)?.value?.trim();
                    if (extraFilterVal) {
                        urlObj.searchParams.set(extraFilterId, extraFilterVal);
                    }
                }

                // 🟢 2ο extra filter (π.χ. κατηγορίες ⇒ ειδικότητες) με ΠΗΓΗ λίστας
                const extraFilterParam = el.dataset.extraFilter2; // π.χ. "kathgoria_symbashs_stathera"
                if (extraFilterParam) {
                    // από πού θα διαβάσω την ΤΙΜΗ; (αν δεν οριστεί, διαβάζει από το ίδιο id όπως πριν)
                    const srcId = el.dataset.extraFilter2Src || extraFilterParam;
                    const raw   = document.getElementById(srcId)?.value?.trim();
                    if (raw) {
                        const to4 = (x) => {
                            const d = String(x ?? '').replace(/\D/g, '');
                            if (!d) return '';
                            const n = parseInt(d, 10);
                            return Number.isFinite(n) ? String(n).padStart(4, '0') : d.slice(-4).padStart(4, '0');
                        };

                        let used = false;

                        // 1) JSON array τύπου [{aa:"....", kodikos:"0001"}, ...]
                        try {
                            const arr = JSON.parse(raw);
                            if (Array.isArray(arr)) {
                                arr.forEach(obj => {
                                const k = to4(obj?.kodikos);
                                if (k) urlObj.searchParams.append(extraFilterParam, k);
                                });
                                used = true;
                            }
                        } catch {}

                        // 2) CSV: "0001,0003"
                        if (!used && raw.includes(',')) {
                            raw.split(',').map(s => to4(s)).filter(Boolean)
                                .forEach(k => urlObj.searchParams.append(extraFilterParam, k));
                            used = true;
                        }

                        // 3) Μία τιμή (παλιό behavior)
                        if (!used) {
                            const k = to4(raw);
                            if (k) urlObj.searchParams.set(extraFilterParam, k);
                        }
                    }
                }

                urlObj.searchParams.set('search', searchText || '');
                urlObj.searchParams.set('page', 1);
                urlObj.searchParams.set('limit', 50);
                urlToFetch = urlObj.toString();
            }

            try {
                /* 3. fetch */
            const json = await fetch(urlToFetch, { signal: this._currentAbort.signal })
                            .then(r => r. json());
                let items = Array.isArray(json.items) ? json.items : [];

                // ✅ Normalize items: ensure every record has value + label/text (strings)
                const vKey = this.settings.valueField || 'value';
                const lKey = this.settings.labelField || 'label';
                items = items
					.filter(it => it && (it[vKey] != null || it.value != null || it.id != null || it.kodikos != null))
					.map(it => {
						const rawVal = (it[vKey] ?? it.value ?? it.id ?? (it.kodikos != null ? String(it.kodikos).padStart(4,'0') : ''));
						const val = String(rawVal).trim();
						const label = String(
							it[lKey] ?? it.label ?? it.text ??
							(it.kodikos != null ? `${String(it.kodikos).padStart(4,'0')} - ${it.perigrafh ?? ''}` : val)
						);
						return { ...it, [vKey]: val, [lKey]: label, value: val, label, text: label };
					})
					.filter(it => it[vKey] !== '');

                /* 4. πρόσθεσε ΟΠΟΙΟ επιλεγμένο λείπει */
                this.items.forEach(v => {
                    const cached = selectedCache[v];
                    const alreadyInOptions = this.options[v];

                    if (!alreadyInOptions && cached) {
                        // 👉 δώσε group και στα cached (αν υπάρχει optgroupBy)
                        if (el.dataset.optgroupBy) {
                            const ogField   = el.dataset.optgroupField || '__group';
                            const ogExtract = (el.dataset.optgroupExtract || '').toLowerCase();
                            const raw = String(cached[el.dataset.optgroupBy] ?? '');
                            cached[ogField] = ogExtract === 'last4' ? raw.slice(-4) : raw;
                        }
                        this.addOption(cached);
                    } else if (!cached) {
                        console.warn('⚠️ Cannot re-add – missing from cache:', v);
                    }
                });

                /* ========= PATCH B: optgroups + group sorting ========= */
                {
                    const ogBy      = el.dataset.optgroupBy || '';
                    const ogField   = el.dataset.optgroupField || '__group';
                    const ogExtract = (el.dataset.optgroupExtract || '').toLowerCase();
                    const ogSrcId   = el.dataset.optgroupLabelSource || '';

                    if (ogBy) {
                        // 1) βγάλε group id
                        items = (items || []).map(it => {
                            const raw = String(it[ogBy] ?? '');
                            const gid = ogExtract === 'last4' ? raw.slice(-4) : raw;
                            return { ...it, [ogField]: gid };
                        });

                        // 2) δήλωσε τα optgroups
                        const groups = new Map();
                        const katTS  = ogSrcId ? document.getElementById(ogSrcId)?.tomselect || null : null;

                        for (const it of items) {
                            const gid = it[ogField];
                            if (!gid || groups.has(gid)) continue;
                            let label = gid;
                            const katOpt = katTS?.options?.[gid];
                            if (katOpt) {
								const base = String(katOpt.text || katOpt.label || '').trim();
								// αν το base ξεκινά ήδη με "0001 -", βγάλε το πρώτο "0001 -"
								const withoutDup = base.replace(new RegExp(`^${gid}\\s*-\\s*`, 'i'), '');
								label = `${gid} - ${withoutDup || base}`;
                            }
                            groups.set(gid, { value: gid, label });
                        }
                        
                        try { groups.forEach((data, gid) => this.addOptionGroup(gid, data)); } catch {}

                        // 3) ταξινόμηση: Κατηγορία → kodikos
                        items.sort((a, b) => {
                            const ga = String(a[ogField] || ''), gb = String(b[ogField] || '');
                            const cmpG = ga.localeCompare(gb, undefined, { numeric: true });
                            if (cmpG !== 0) return cmpG;
                            const kA = String(a.kodikos || ''), kB = String(b.kodikos || '');
                            return kA.localeCompare(kB, undefined, { numeric: true });
                        });
                    }
                }

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
                if (err && err.name === 'AbortError') {
                    // silent — expected cancellation
                } else {
                    if (err.name !== 'AbortError') console.error('Dropdown load failed', err);
                }
                callback();                 // κλείσε spinner σε κάθε σφάλμα
            }
        },
        /* ------ render ----------------------------------------- */
        render : {
            option(optionData, e) {
                const v = (optionData && (optionData.value ?? optionData.id)) ?? '';
                const l = (optionData && (optionData.label ?? optionData.text ?? '')) || '';
                if (!v) return `<div class="option disabled" aria-disabled="true">${e(l)}</div>`;
                return `<div class="option" data-value="${e(String(v))}">${e(String(l))}</div>`;
            },
            item(optionData, e) {
                if (!optionData || typeof optionData !== 'object' || !('value' in optionData)) {
                    const phText = el.getAttribute('placeholder') || '…';
                    return `<div class="item placeholder-item" aria-placeholder="true">${e(phText)}</div>`;
                }
                const vKey = this.settings.valueField || 'value';
                const lbl = optionData.label ?? optionData.text ?? optionData[vKey] ?? '';
                return `<div class="item" data-value="${e(optionData[vKey])}">${e(String(lbl))}</div>`;
            },
            ...render,
        },


        /* flag ώστε να είναι διαθέσιμο στο onInitialize */
        _preloadAll : preloadAll,

        /* ===== onInitialize (core + project specific + χρήστη) ===== */
        onInitialize() {
            const ts = this; // ← alias του instance

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

            /* ---------------------------------------------------------------
            * dropdown_open  ➜  position + preload + trash btn κ.λπ.
            * -------------------------------------------------------------*/
            this.on('dropdown_open', () => {
                ts.wrapper.classList.add('open');

                /* ---------- προαιρετικό preload ---------------------------------*/
                if (this.settings._preloadAll && !this.control_input.value) {
                    if (Object.keys(this.options).length < 2) {
                        this.load('');
                    } else {
                        this.refreshOptions(false);
                    }
                }

                /* ---------- helper: έξυπνη τοποθέτηση (ΧΩΡΙΣ inline styles) -----*/
                const reposition = () => {
                    const controlRect = this.control.getBoundingClientRect();
                    const ddEl        = this.dropdown;

                    /* 1. «ιδανικό» ύψος =  search + ~6.5 rows */
                    const searchH     = 36;   // fallback ύψος search
                    const optionH     = 34;   // fallback ύψος μίας option
                    const idealHeight = searchH + optionH * 6.5;

                    /* 2. διαθέσιμος χώρος ΜΕΣΑ στο .card (για να μην «ξεχειλίζει» ) */
                    const cardRect    = ts.wrapper.closest('.card')
                        ?.getBoundingClientRect()
                        ?? { top: 0, bottom: window.innerHeight };

                    const spaceAbove  = controlRect.top    - cardRect.top;
                    const spaceBelow  = cardRect.bottom    - controlRect.bottom;

                    /* καθάρισε προηγούμενες κλάσεις θέσης/ύψους */
                    ddEl.classList.remove('place-above','place-below','maxh-ideal','maxh-limited');

                    /* 3. λογική επιλογής (ίδια με πριν, αλλά με κλάσεις) */
                    if (idealHeight <= spaceBelow) {
                        // χωράει κάτω στο «ιδανικό»
                        ddEl.classList.add('place-below','maxh-ideal');
                    } else if (idealHeight <= spaceAbove) {
                        // χωράει πάνω στο «ιδανικό»
                        ddEl.classList.add('place-above','maxh-ideal');
                    } else {
                        // δεν χωρά ολόκληρο: ΠΑΝΩ με περιορισμένο ύψος (scrollbar)
                        ddEl.classList.add('place-above','maxh-limited');
                    }
                };

                /* --- 1η τοποθέτηση (ανοίγει κενό αν skip-autoload) --------------*/
                requestAnimationFrame(reposition);

                /* --- 2η τοποθέτηση όταν φορτωθούν τα options --------------------*/
                const origLoad = this.settings.load;
                this.settings.load = (query, callback) => {
                    origLoad.call(this, query, items => {
                        if (Array.isArray(items) && items.length) {
                            callback(items);          // κανονική ροή
                        } else {
                            callback();               // κλείνει το spinner – δεν κρασάρει
                        }
                        requestAnimationFrame(reposition);   // ξαναϋπολόγισε με τα νέα ύψη
                    });
                };
            });

            /******************* B. Project-specific setup *****************/
            this.wrapper.classList.add('dropdown-wrapper'); // CSS: position:relative κ.λπ.
            this.control_input.classList.add('dropdown-input');
            // (was) this.wrapper.style.position = 'relative';  ➜ αφαιρέθηκε λόγω CSP
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

            /* =====================================================
            *  ΕΜΦΑΝΙΣΗ 🗑 ΑΜΕΣΩΣ  μόλις προστεθεί/φορτωθεί επιλογή
            * ----------------------------------------------------- */
            const overflowNow = () => requestAnimationFrame(() => updateOverflow(this));

            this.on('load'       , overflowNow);   // fire μετά από κάθε async load
            this.on('item_add'   , overflowNow);   // single & multi
            this.on('item_remove', overflowNow);
            this.on('clear'      , overflowNow);
            
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

            const doPreselect = async () => {
                if (ts._preselectDone) return;
                ts._preselectDone = true;

				const preSelId = el.dataset.preselect;
				if (!preSelId) return;

				const preSelVal = document.getElementById(preSelId)?.value?.trim();
				if (!preSelVal) return;

				// 🟢  1ο φίλτρο
				const extraFilterId  = el.dataset.extraFilter;
				const extraFilterVal = extraFilterId ? document.getElementById(extraFilterId)?.value?.trim() : '';

				// 🟢  2ο φίλτρο
				const extraFilterId2  = el.dataset.extraFilter2;
				const extraFilterVal2 = extraFilterId2 ? document.getElementById(extraFilterId2)?.value?.trim() : '';

				if (el.hasAttribute('data-has-value')) return;

				// Φτιάξε URL + extra params
				const u = new URL(url, location.origin);
				Object.entries(extraParams || {}).forEach(([k, v]) => v && u.searchParams.set(k, v));
				u.searchParams.set('value', preSelVal);
				
				if (extraFilterVal) {
					u.searchParams.set(extraFilterId, extraFilterVal);
				}
				if (extraFilterVal2) {
					u.searchParams.set(extraFilterId2, extraFilterVal2);
				}
				// Abort τυχόν προηγούμενο preselect
				try { ts._preselectAbort?.abort(); } catch {}
				const controller = new AbortController();
				ts._preselectAbort = controller;

				try {
					const res   = await fetch(u, { credentials: 'include', signal: controller.signal });
					const json  = await res.json();
					const item  = json?.items?.[0];
					if (!item) return;

					// Αν στο μεταξύ έγινε άλλο preselect → μην συνεχίσεις (stale)
					if (ts._preselectAbort !== controller) return;

					const key = ts.settings.valueField || 'value';
					const id  = item[key] ?? preSelVal;

					ts.addOption(item);
					ts.setValue(id, true);
					selectedCache[id] = item;
					requestAnimationFrame(() => updateOverflow(ts));
					el.setAttribute('data-has-value', 'true');
				} catch (err) {
					if (err?.name !== 'AbortError') console.error('❌ Preselect fetch failed:', err);
				} finally {
					if (ts._preselectAbort === controller) ts._preselectAbort = null;
				}
            };

            // small delay to avoid competing initial fetches which can cause aborts on first load
            setTimeout(doPreselect, 150);

            /* -----------------------------------------------------------------
            *  Α. Ενημέρωση κρυφού input  ΜΟΝΟ στο single
            * ----------------------------------------------------------------*/
            if (!isMultiple) {
                this.on('change', val => {
                    const inputId = el.dataset.targetInput;
                    const input   = document.getElementById(inputId);
                    if (input) input.value = val;
                });
            } else {
                const targetTableId = el.dataset.targetTable;   // π.χ. "kathgoria_symbashs_table"
                if (targetTableId) {
                    const to4 = (x) => {
                        const d = String(x ?? '').replace(/\D/g, '');
                        if (!d) return '';
                        const n = parseInt(d, 10);
                        return Number.isFinite(n) ? String(n).padStart(4, '0') : d.slice(-4).padStart(4, '0');
                    };

                    const writeTable = () => {
                        const vals = this.getValue(); // array από selected values (aa)
                        const arr = (Array.isArray(vals) ? vals : (vals ? [vals] : []))
                            .map(v => {
                                const o = this.options?.[v] || {};
                                const to4 = (x) => {
                                    const d = String(x ?? '').replace(/\D/g, '');
                                    if (!d) return '';
                                    const n = parseInt(d, 10);
                                    return Number.isFinite(n) ? String(n).padStart(4, '0') : d.slice(-4).padStart(4, '0');
                                };
                                return {
                                    aa: String(o.aa ?? v),                      // <-- ΠΑΝΤΑ γεμάτο
                                    kodikos: to4(o.kodikos ?? (v.split?.('|')[0]) ?? '')
                                };
                            })
                            .filter(x => x.kodikos)
                            .sort((a,b) => a.kodikos.localeCompare(b.kodikos, undefined, { numeric:true }));

                        const input = document.getElementById(targetTableId);
                        if (input) {
                            input.value = JSON.stringify(arr);
                            // 🔔 ενημέρωσε όλο το σύστημα ότι άλλαξε ο table-hidden (πιάνει x, +/- κλπ)
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    };

                    // ενημέρωση σε όλες τις σχετικές αλλαγές
                    this.on('change',      writeTable);
                    this.on('item_add',    writeTable);
                    this.on('item_remove', writeTable);
                    this.on('clear',       writeTable);

                    // αρχικοποίηση
                    writeTable();
                }
            }
        },

        onDropdownOpen () {
            // placeholder μέσα στο input του dropdown
            const ddInput = this.dropdown?.querySelector('.dropdown-input');
            if (ddInput) {
                // αποθήκευση αρχικού placeholder για restore στο close
                if (!this._origDdPlaceholderSaved) {
					this._origDdPlaceholder = ddInput.getAttribute('placeholder') || '';
					this._origDdPlaceholderSaved = true;
                }
                ddInput.setAttribute('placeholder', el.getAttribute('placeholder') || 'Αναζήτηση…');
            }


            // Guard: block clicks on options without data-value to avoid TS internal errors
            const dd = this.dropdown;
            if (dd && !this._guardedNoValue) {
                dd.addEventListener('mousedown', (e) => {
                    const opt = e.target.closest('.option, .ts-option');
                    if (!opt) return;
                    const v = opt.getAttribute('data-value');
                    if (v == null || v === '' || v === 'undefined') {
                        if (e.preventDefault) e.preventDefault();
                        if (e.stopPropagation) e.stopPropagation();
                        return false;
                    }
                }, true);
                this._guardedNoValue = true;
            }
            // bind once το χειροποίητο infinite scroll
            if (!this._infiniteBound) {
                const content = this.dropdown?.querySelector('.ts-dropdown-content');
                if (content) {
					// κρατάμε ref για να μπορούμε να το αφαιρέσουμε αν ποτέ χρειαστεί
					this._infiniteScrollHandler = () => handleScroll(this, content);
					content.addEventListener('scroll', this._infiniteScrollHandler, { passive: true });
					this._infiniteBound = true;
                }
            }

            // flag στο wrapper (αν χρειάζεσαι CSS εφέ κατά το άνοιγμα)
            this.wrapper.classList.add('open');

            hooks.onOpen?.(this);
        },

        onDropdownClose () {
            // αφαίρεση open flag
            this.wrapper.classList.remove('open');

            // επαναφορά placeholder όπως ήταν πριν το open
            const ddInput = this.dropdown?.querySelector('.dropdown-input');
            if (ddInput && this._origDdPlaceholderSaved) {
                if (this._origDdPlaceholder) {
					ddInput.setAttribute('placeholder', this._origDdPlaceholder);
                } else {
					ddInput.removeAttribute('placeholder');
                }
            }
        },

        onFocus () {
            // ΜΗΝ καθαρίζεις τίποτα στο focus εκτός κι αν ζητηθεί ρητά
            if (this.input?.dataset?.autoclearOnFocus === 'true' ||
                this.wrapper?.dataset?.autoclearOnFocus === 'true') {
                clickClearIfVisible(this);
            }
            if (!this.ignoreFocusOpen) this.open();
        },

        onChange (vals) {
            if (!this.settings.mode.includes('multi') || !Array.isArray(vals)) return;
            const recs = vals.map(v=>this.options[v]);
            // recs.sort((a,b)=>parseInt(a.label)-parseInt(b.label));
        }
    });

    /* ========= PATCH A: client-side sort & optgroups from data-attributes ========= */
    (() => {
        // data-sort-by="afora_thn_symbash_kathgoria,kodikos"  ➜ ταξινόμηση από meta πεδία
        const sortBy = (el.dataset.sortBy || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        if (sortBy.length) {
            tom.settings.sortField = sortBy.map(f => ({ field: f, direction: 'asc' }));
            tom.settings.sort = true;   // ενεργοποίησε client sort μόνο αν ζητήθηκε
        } else {
            tom.settings.sort = false;  // αλλιώς σεβάσου τη σειρά του server
        }

        // optgroups: data-optgroup-by="afora_thn_symbash_kathgoria"
        const ogBy = el.dataset.optgroupBy || '';
        if (ogBy) {
            tom.settings.optgroupField      = el.dataset.optgroupField || '__group';
            tom.settings.lockOptgroupOrder  = true; // σταθερή σειρά ομάδων
            // optional: custom header (κρατάμε το default αν υπάρχει ήδη renderer)
            tom.settings.render = tom.settings.render || {};
            const prevHeader = tom.settings.render.optgroup_header;
            tom.settings.render.optgroup_header = function (data, escape) {
                const inner = prevHeader ? prevHeader.call(this, data, escape)
                                         : `<div class="optgroup-header ts-og">${escape(data.label || data.value || '')}</div>`;
                return inner;
            };
        }
    })();

    // --- Cache του επιλεγμένου option ώστε να μπορεί να «ξαναμπεί» --- 
    tom.on('item_add', (value /* , $itemEl */) => {
    const key   = tom.settings.valueField || 'value';
    const rec   = tom.options?.[value];  // πιο αξιόπιστο από το 2ο arg του event
    const cacheId = rec?.[key] ?? value;

    if (rec) {
        selectedCache[cacheId] = rec;

        // ✅ Αν δεν υπάρχει στο options (π.χ. από προ-επιλογή), ξαναπέρασέ το
        if (!tom.options[cacheId]) {
			tom.addOption(rec);
        }
    } else {
        console.error('❌ item_add: cannot cache or re-add', value);
    }
    });

    /** ----------------------------------------------------------------
    *  Χειροποίητο infinite scroll
    * ----------------------------------------------------------------*/
    async function handleScroll (instance, content) {
		// Φρένο αν δεν υπάρχει επόμενη σελίδα ή ήδη φορτώνουμε
		if (!instance.nextPage || instance._loadingNext) return;

		// Trigger όταν πλησιάσουμε ~50px από το τέλος
		if (content.scrollTop + content.clientHeight < content.scrollHeight - 50) return;

		instance._loadingNext = true;

		const urlToFetch = instance.nextPage;
		const limit      = getLimitFromUrl(urlToFetch);

		try {
			const json  = await fetch(urlToFetch, { credentials: 'include' }).then(r => r.json());
			const items = Array.isArray(json.items) ? json.items : [];

			// hasMore: αν δίνεται ρητά, αλλιώς με βάση το limit
			const hasMore = ('hasMore' in json) ? Boolean(json.hasMore) : items.length === limit;
			instance.nextPage = hasMore ? buildNextPageUrl(urlToFetch) : null;

			// 1) θυμόμαστε scroll & ύψος ΠΡΙΝ την προσθήκη
			const prevScroll = content.scrollTop;
			const prevHeight = content.scrollHeight;

			// 2) προσθέτουμε options (dedupe με βάση valueField)
			const key = instance.settings.valueField || 'value';
			let newCount = 0;
			for (const it of items) {
				const id = it?.[key];
				if (id == null) continue;
				if (!instance.options[id]) {
					instance.addOption(it);
					newCount++;
				}
			}
			instance.refreshOptions(false);

			// Αν δεν προσθέσαμε τίποτα καινούργιο → τέλος infinite
			if (newCount === 0) {
				instance.nextPage = null;
				return;
			}

			// 3) επαναφέρουμε τη θέση 1-του-πριν (με ένα «μαξιλαράκι» ασφαλείας)
			requestAnimationFrame(() => {
				const newHeight = content.scrollHeight;
				const delta     = newHeight - prevHeight;
				const SAFE      = 500; // pixel από το τέλος
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
    return tom;
}

const CLEAR_BTN_SELECTOR = '.ts-single-reset-btn';

function makeUnfocusable(btn) {
    if (!btn) return;
    // βγάλ’ το από το tab order
    btn.tabIndex = -1;
    // αν πάρει focus κατά λάθος, βγάλ’ το αμέσως
    btn.addEventListener('focus', () => { try { btn.blur(); } catch(_){} }, true);
    // με mouse/touch μην επιτρέπεις μεταφορά εστίασης (το click συνεχίζει να δουλεύει)
    const stop = (e) => { try { e.preventDefault(); } catch(_){} };
    btn.addEventListener('mousedown', stop, true);
    btn.addEventListener('touchstart', stop, { capture: true, passive: false });
}

function clickClearIfVisible(ts) {
    const btn = ts.wrapper.querySelector(CLEAR_BTN_SELECTOR);
    // ➜ offsetParent === null → το element είναι display:none ή hidden
    if (btn && btn.offsetParent !== null) {
        btn.click(); // πυροδοτεί το 'clear' + ό,τι handler έχουμε
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
	// --- reserve right space for external actions (optional) ---
	try {
		const reserve = parseInt(tom.input?.dataset.reserveRight || tom.wrapper?.dataset.reserveRight || '0', 10) || 0;
		if (reserve > 0) {
		tom.wrapper.style.display = 'inline-block';
		tom.wrapper.style.width   = `calc(100% - ${reserve}px)`;
		}
	} catch {}

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
			trash           = document.createElement('button');
			trash.type      = 'button';
			trash.className = 'ts-single-reset-btn ts-fill-reset-btn';
			trash.title     = 'Καθαρισμός επιλογής';
			// trash.innerHTML = '<i class="bi bi-trash3"></i>'; // bootstrap-icons
			trash.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
				<path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/>
			</svg>`;
			wrapper.appendChild(trash);
			makeUnfocusable(trash); // ⬅️ ΝΕΟ: ποτέ focus στο σκουπιδάκι
			
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

		// Εμφάνιση / απόκρυψη ανάλογα με επιλογή (χωρίς inline styles)
		trash.hidden = !(tom.items || []).length;

        /* ================================================================
        * ✅ ΣΥΓΧΡΟΝΙΣΜΟΣ ΜΕ ΤΟ GLOBAL DISABLED STATE
        * ================================================================ */

        // Αν υπάρχει global __trashButtonsDisabledState, χρησιμοποίησέ το
        if (typeof window.__trashButtonsDisabledState !== 'undefined') {
            const disabledState = window.__trashButtonsDisabledState;
            const selectId = tom?.input?.id || el?.id;
            
            if (selectId && typeof disabledState[selectId] !== 'undefined') {
                const shouldBeHidden = disabledState[selectId];
                // Κρύψε το trash button αν το dropdown είναι disabled
                trash.hidden = shouldBeHidden || !(tom.items || []).length;
            }
        }

        /* ----------------------------------------------------------------
		* B. Ellipsis στο label όταν είναι μακρύ (χωρίς inline styles)
		* ----------------------------------------------------------------*/
		const itemEl = ctrl.querySelector('.item');
		if (itemEl) itemEl.classList.add('ts-item-ellipsis');

		return; // single-select τελείωσε εδώ
	}

    /* ==================================================================
    *  MULTI-SELECT MODE
    * =================================================================*/
    if (isMulti) {
        // καθάρισε τυχόν παλιό inline trash από μέσα στο ts-control
        ctrl.querySelectorAll('.ts-inline-trash').forEach(n => n.remove());

        // ── 0) Μικρό group για το +/- ΜΟΝΟ μέσα στο TS
        let tools = ctrl.querySelector('.ts-tools');
        if (!tools) {
            tools = document.createElement('span');
            tools.className = 'ts-tools';
            Object.assign(tools.style, {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '.25rem',
                marginRight: '.25rem',
                flex: '0 0 auto'
            });
            ctrl.insertBefore(tools, ctrl.firstChild);
        }

        // ── 1) +/- (μία φορά, μέσα στο TS)
        let resetBtn = tools.querySelector('.ts-fill-reset-btn');
        if (!resetBtn) {
            resetBtn = document.createElement('button');
            resetBtn.className = 'ts-fill-reset-btn';
            resetBtn.type      = 'button';
            resetBtn.title     = 'Επιλογή όλων ή Καθαρισμός';
            resetBtn.innerHTML = '<i class="bi bi-plus-slash-minus"></i>';
            Object.assign(resetBtn.style, {
                background: 'transparent',
                border: 0,
                lineHeight: '1',
                cursor: 'pointer',
                padding: 0,
                flex: '0 0 auto'
            });
            tools.appendChild(resetBtn);

            // ⬅️ ΜΗΝ παίρνει ποτέ focus
            makeUnfocusable(resetBtn);
        }

        // ── helpers για καθαρίσματα
        const clearTable = () => {
            const tb = document.querySelector('#myTable tbody');
            if (tb) tb.innerHTML = '';
        };
  
        const clearSelectAll = (selId, hiddenId, tableId) => {
			const inst = document.getElementById(selId)?.tomselect;
			if (inst) { inst.clear(true); inst.clearOptions(); }
			else {
				const el = document.getElementById(selId);
				if (el) { el.value = ''; while (el.options?.length) el.remove(0); }
			}
			const hid = document.getElementById(hiddenId);
			if (hid) hid.value = '';
			if (tableId) {
				const t = document.getElementById(tableId);
				if (t) t.value = '[]';
			}
		};

		// ── 3) Συμπεριφορά του +/−
		/* ---------- μικρό helper: εξαναγκασμένο change (TS + native) ---------- */
		function forceChange(ts) {
			try { ts.trigger && ts.trigger('change', ts.getValue()); } catch {}
			try { ts.input && ts.input.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
			setTimeout(() => {
				try { ts.trigger && ts.trigger('change', ts.getValue()); } catch {}
				try { ts.input && ts.input.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
			}, 0);
		}

		/* ---------- listener για το +/- (resetBtn) ---------- */
		/* Προϋπόθεση: υπάρχει μεταβλητή `resetBtn` και το αρχικό `tom` του πεδίου. */
		if (!resetBtn.__wired) {
			resetBtn.__wired = true;

			// Κρατάμε το id του select για να βρίσκουμε ΠΑΝΤΑ το ΠΙΟ ΦΡΕΣΚΟ instance
			const selectId = (tom?.input?.id) || (el && el.id) || null;

			resetBtn.addEventListener('click', async (e) => {
				e.preventDefault();
				e.stopPropagation();

				// Βρες το τρέχον instance (σε περίπτωση που έγινε reinit)
				const tsInst = (selectId && document.getElementById(selectId)?.tomselect) || tom;
				if (!tsInst) return;

				tsInst.ignoreFocusOpen = true; // μην ανοίγει το dropdown ενώ κάνουμε μαζικές αλλαγές

				try {
				const hasTags = Array.isArray(tsInst.items) && tsInst.items.length > 0;

				if (hasTags) {
					// ========== ΚΑΘΑΡΙΣΜΑ ΟΛΩΝ (ΟΧΙ silent) ========== //
					if (typeof tsInst.clear === 'function') tsInst.clear(false);
					else tsInst.setValue([], false);

					// εξαναγκασμένο change
					forceChange(tsInst);

				} else {
					// ========== ΕΠΙΛΟΓΗ ΟΛΩΝ ========== //
					let allValues = Object.values(tsInst.options || [])
					.map(o => o && o.value)
					.filter(v => v && v !== '__optgroup');

					// Αν δεν υπάρχουν ακόμη options (remote), δοκίμασε να τα φορτώσεις
					if (!allValues.length && typeof url === 'string') {
						try {
							const finalUrl = new URL(url, window.location.origin);
							if (extraParams && typeof extraParams === 'object') {
								Object.entries(extraParams).forEach(([k, v]) => {
									if (v !== undefined && v !== null && v !== '') {
										finalUrl.searchParams.set(k, v);
									}
								});
							}
							const resp = await fetch(finalUrl.toString(), { credentials: 'include' });
							const json = await resp.json();
							const items = Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);
							if (items.length) {
								tsInst.addOptions(items);
								allValues = items.map(i => i.value).filter(Boolean);
							}
						} catch (err) {
							console.error('resetBtn remote load failed', err);
						}
					}

					allValues = Array.from(new Set(allValues));
					if (allValues.length) {
					// ΟΧΙ silent για να εκπέμψει change
					tsInst.setValue(allValues, false);

					// εξαναγκασμένο change
					forceChange(tsInst);
					}
				}
				} finally {
				tsInst.close();
				tsInst.control_input?.blur?.();
				tsInst.ignoreFocusOpen = false;
				setTimeout(() => tsInst?.wrapper && updateOverflow(tsInst), 0);
				}
			});
		}
	}


	// 🔹 ΕΙΔΙΚΗ ΜΕΤΑΧΕΙΡΙΣΗ για #kathgoria_symbashs:
	//    - Πάντα κρατάμε ΟΡΑΤΗ την 1η επιλογή
	//    - Την εμφανίζουμε με δυναμική περικοπή κειμένου (80–135 chars)
	(function applyKathgoriaFirstItemTruncation(){
		try {
			if (!tom || !tom.input || tom.input.id !== 'kathgoria_symbashs') return;
			const itemsList = Array.from(ctrl.querySelectorAll('.item')).filter(i => !i.closest('.ts-overflow-popup'));
			if (!itemsList.length) return;
			const firstEl = itemsList[0];
			const v = firstEl.getAttribute('data-value') || '';
			const opt = (tom.options && tom.options[v]) || {};
			let lbl = String(opt.label || v || firstEl.textContent || '').trim();
			if (!lbl) return;

			// Δυναμικό όριο χαρακτήρων βάσει πλάτους TS ή οθόνης
			var tsWidth = 0;
			try { tsWidth = tom.wrapper && tom.wrapper.clientWidth ? tom.wrapper.clientWidth : 0; } catch(_){}
			var width = tsWidth;
			if (!width) {
				width = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth
					: (typeof screen !== 'undefined' ? screen.width : 1912);
			}
			var baselineW = tsWidth ? 1028 : 1912;
			var baselineL = 130;
			var dynLimit;
			if (tsWidth) {
				if (width <= 640) dynLimit = Math.round(baselineL * 640 / 1028);         // ~81
				else if (width >= 1028) dynLimit = baselineL;                            // 130
				else dynLimit = Math.round(baselineL * width / 1028);
			} else {
				dynLimit = Math.round(baselineL * width / baselineW);
			}
			if (!(typeof dynLimit === 'number' && isFinite(dynLimit))) dynLimit = baselineL;
			// clamp περίπου 80–135
			if (dynLimit < 80) dynLimit = 80;
			if (dynLimit > 135) dynLimit = 135;

			var shown = lbl.length > dynLimit ? (lbl.slice(0, dynLimit) + '…') : lbl;

			// Χτίσε label span χωρίς να χαλάσεις το remove button
			var removeEl = firstEl.querySelector('.remove');
			// αφαίρεσε όλα τα παιδιά
			var kids = Array.from(firstEl.childNodes);
			for (var i=0;i<kids.length;i++){ firstEl.removeChild(kids[i]); }
			var span = document.createElement('span');
			span.className = 'ts-kathgoria-first';
			span.textContent = shown;
			span.title = lbl;
			firstEl.appendChild(span);
			if (removeEl) firstEl.appendChild(removeEl);
			// κράτα σημείο ότι έγινε truncation (σε επόμενα rerender θα ξαναπαρθεί από tom.options[v].label)
			firstEl.setAttribute('data-trunc', '1');
		} catch (e) {
		// ignore
		}
	})();

	// 3. Υπολογισμός overflow */)
	const ARROW = 36, GAP = 28;
	const wrapW = wrapper.getBoundingClientRect().width;
	let avail   = wrapW - ARROW;
	let total   = 0;

	const items = Array.from(ctrl.querySelectorAll('.item'))
		.filter(i => !i.closest('.ts-overflow-popup'));

	// καθάρισμα προηγούμενων δεικτών
	ctrl.querySelector('.ts-overflow-indicator')?.remove();
	ctrl.querySelector('.ts-overflow-popup')?.remove();

	const hidden = [];
	const pinFirst = (tom && tom.input && tom.input.id === 'kathgoria_symbashs' && items.length > 0);
	for (let i = 0; i < items.length; i++) {
		const el = items[i];
		el.hidden = false; // δείξε το αρχικά
		const w = el.offsetWidth + (parseInt(getComputedStyle(el).marginRight) || 0) + GAP;
		if (total + w <= avail || (pinFirst && i === 0)) {
			total += w;
		} else {
			hidden.push(el);
		}
	}
	hidden.forEach(el => (el.hidden = true));

	if (!hidden.length) return;   // early exit (resetBtn κρατήθηκε)

	/* 4. +N indicator & ταξινομημένο popup -----------------------------*/
	const dot = document.createElement('div');
	dot.className = 'ts-overflow-indicator';
	dot.tabIndex  = -1;
	dot.textContent = `+${hidden.length}`;
	dot.title       = `Πατήστε για εμφάνιση (${hidden.length} ακόμη)`;
	ctrl.appendChild(dot);

	// ---- αναγνώριση πεδίου -------------------------------------------------
	const idOrName = String(tom.input?.id || tom.input?.name || '').toLowerCase();
	const IS_EID = idOrName === 'eidikothta_symbashs' || /(^|[_-])eidikothta[_-]?symbashs($|[_-])/.test(idOrName);

	// λίγο UX
	try { dot.style.cursor = 'pointer'; dot.setAttribute('role','button'); } catch{}

	// ---- (ΜΟΝΟ για Ειδικότητες) αφοπλίζουμε προσωρινά clear/reload --------
	(function setupNoReloadOnPlusN() {
		if (!IS_EID) return;
		if (tom.__noReloadPatched) return;
		tom.__noReloadPatched = true;

		const armed = () => !!tom.__noReloadArmed;
		const wrap = (obj, key) => {
			const orig = obj[key] && obj[key].bind(obj);
			if (!orig) return;
			obj[key] = (...a) => (armed() ? undefined : orig(...a));
		};

		wrap(tom, 'clear');
		wrap(tom, 'clearOptions');
		wrap(tom, 'load');
		wrap(tom, 'addOption');
		wrap(tom, 'addOptions');

		// οπλίζουμε το "no reload" για λίγο όταν πατηθεί το +N των ειδικοτήτων
		const arm = () => {
			tom.__noReloadArmed = true;
			clearTimeout(tom.__noReloadTimer);
			tom.__noReloadTimer = setTimeout(() => (tom.__noReloadArmed = false), 600);
		};
		// θα το καλέσουμε μέσα στα mousedown/touchstart για IS_EID
		dot.__armNoReload = arm;
	})();

	// ---- helper: άνοιγμα του overflow popup -------------------------------
	const openOverflowPopup = () => {
		// κλείσε αν υπάρχει ήδη
		if (ctrl.querySelector('.ts-overflow-popup')) return;

		// μην ανοίγει/κλείνει το TS από focus
		tom.ignoreFocusOpen = true;
		try { tom.control_input.blur(); } catch {}
		setTimeout(() => {
			tom.ignoreFocusOpen = false;
			if (ctrl.querySelector('.ts-overflow-popup')) return;

			const popup = document.createElement('div');
			popup.className = 'ts-overflow-popup';
			try { Object.assign(popup.style, { maxHeight: '408px', overflowY: 'auto' }); } catch {}

			const to4 = (s) => String(s ?? '').replace(/\D/g,'').padStart(4,'0');

			const getEidIndex = () => {
				if (!window.__eidikothta_index) {
					let arr = window.eidikothta_symbashs_table || window.eidikothta_symbashs || [];
					try { if (typeof arr === 'string') arr = JSON.parse(arr); } catch {}
					if (!Array.isArray(arr)) {
						if (arr && Array.isArray(arr.data)) arr = arr.data;
						else if (arr && typeof arr === 'object') arr = Object.values(arr);
						else arr = [];
					}
					const m = new Map();
					for (const r of arr) if (r && r.kodikos != null) m.set(to4(r.kodikos), String(r.afora_thn_symbash_kathgoria || ''));
					window.__eidikothta_index = m;
				}
				return window.__eidikothta_index;
			};

			const codeOf = (v) => {
				const o = (tom.options && tom.options[v]) || (selectedCache && selectedCache[v]) || {};
				return (o.kodikos != null) ? to4(o.kodikos) : to4((v.split?.('|')[0] || v));
			};
			const catOf = (v) => {
				const o = (tom.options && tom.options[v]) || (selectedCache && selectedCache[v]) || {};
				if (o.afora_thn_symbash_kathgoria) return String(o.afora_thn_symbash_kathgoria);
				const idx = getEidIndex();
				return idx.get(codeOf(v)) || '';
			};
			const makeLabel = (v) => {
				const o = (tom.options && tom.options[v]) || (selectedCache && selectedCache[v]) || {};
				const code = (o.kodikos != null) ? to4(o.kodikos) : to4((v.split?.('|')[0] || v));
				const desc = String(o.perigrafh || o.description || '').trim();
				const base = String(o.label || o.text || '').trim();
				if (desc) return `${code} - ${desc}`;
				if (base) return base.includes(' - ') ? base : `${code} - ${base}`;
				return code;
			};

			const sorted = hidden.slice().sort((a, b) => {
				const av = a.dataset.value, bv = b.dataset.value;
				const byCat = catOf(av).localeCompare(catOf(bv), undefined, { numeric: true, sensitivity: 'base' });
				return byCat !== 0 ? byCat : codeOf(av).localeCompare(codeOf(bv), undefined, { numeric: true, sensitivity: 'base' });
			});

			let html = '';
			let prevCat = null;
			for (const el of sorted) {
				const v   = el.dataset.value;
				const cat = catOf(v);
				const l   = makeLabel(v);

				// Ομαδοποιημένος header ΜΟΝΟ για Ειδικότητες
				if (IS_EID && (prevCat === null || cat !== prevCat)) {
					if (prevCat !== null) html += `<div style="height:8px"></div>`; // μικρό κενό πριν από νέα ομάδα
					html += `<div class="ts-popup-sep" role="separator" style="height:1px;background:#e5e7eb;margin:4px -6px 6px;"></div>`;
					html += `<div class="ts-popup-sep-labeled" style="font-weight:700;font-size:15px;line-height:1.25;color:#111827;margin:2px 0 6px 6px;">Κατηγορία ${String(cat || '').padStart(4,'0')}</div>`;
				} else if (!IS_EID && prevCat !== null && cat !== prevCat) {
					// στα υπόλοιπα πεδία: απλός separator μόνο όταν αλλάζει κατηγορία
					html += `<div class="ts-popup-sep" role="separator"></div>`;
				}

				html += `<div class="ts-popup-row"><span>${l}</span><button data-val="${v}" title="Αφαίρεση"><i class="bi bi-trash3"></i></button></div>`;
				prevCat = cat;
			}
			popup.innerHTML = html;

    		wrapper.appendChild(popup);

			// κουμπί "Αφαίρεση" σε κάθε γραμμή του popup
            popup.querySelectorAll('button').forEach((btn) => {
                // 🔒 ΜΗΝ παίρνουν ΠΟΤΕ focus τα trash του popup
                makeUnfocusable(btn);

                btn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();

                    const val = btn.dataset.val;
                    const removeBtn = ctrl.querySelector(`.item[data-value="${val}"] .remove`);
                    if (removeBtn) {
                        removeBtn.click();
                    }

                    popup.remove();
                    updateOverflow(tom);
                });
            });

			// κλείσιμο popup όταν κλικάρει έξω ή ξαναπατήσει το +N
			document.addEventListener('click', function close(ev) {
				const clickOutside = !popup.contains(ev.target);
				const clickedDot   = (ev.target === dot);
				if (clickOutside && !clickedDot) {
					popup.remove();
					document.removeEventListener('click', close);
				}
			});
		}, 0);
	};

	// ---- ενεργοποίηση στο mousedown/touchstart (για να ΜΗ χάνεται το click) --
	const onPress = (ev) => {
	ev.preventDefault();               // σταματά την προεπιλογή του TS (focus toggle)
	ev.stopPropagation();
	if (IS_EID && typeof dot.__armNoReload === 'function') dot.__armNoReload();
	openOverflowPopup();
	};
	dot.addEventListener('mousedown',   onPress, { capture: true });
	dot.addEventListener('pointerdown', onPress, { capture: true });
	dot.addEventListener('touchstart',  onPress, { capture: true, passive: false });

	// Προαιρετικά: fallback για πληκτρολόγιο
	dot.addEventListener('click', (e) => {
        if (IS_EID) { e.preventDefault(); e.stopPropagation(); }
        openOverflowPopup();
	});

    // 🔚 ΤΕΛΙΚΟ ΒΗΜΑ:
    // Σε multiple TS βγάζουμε από το tab-order ΟΛΑ τα κουμπιά
    // που έχουν μέσα icon με bi-plus-slash-minus ή bi-trash3
    wrapper
        .querySelectorAll('button i.bi.bi-plus-slash-minus, button i.bi.bi-trash3')
        .forEach((icon) => {
            const btn = icon.closest('button');
            if (btn) makeUnfocusable(btn);
        });
}

window.tomDropdownConfig = {
	setRender  : (id, r) => (globalRenderMap[id] = r),
	setHooks   : (id, h) => (globalHookMap[id]  = h),
	setTemplate: (id, t) => (templateCache[id]  = t)
};

window.initTomDropdown = initTomDropdown;
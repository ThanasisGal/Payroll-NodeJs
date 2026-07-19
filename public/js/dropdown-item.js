// ✅ dropdown-item.js – Tom-Select v2.4.3 + custom infinite scroll (ΧΩΡΙΣ virtual_scroll)

const globalRenderMap = {};
const globalHookMap = {};
const templateCache = {};
const selectedCache = {};

window.setTomDropdownRender = (id, r) => (globalRenderMap[id] = r);
window.setTomDropdownHooks = (id, h) => (globalHookMap[id] = h);

const debounce = (fn, d = 100) => {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), d);
    };
};

export function attachInlineSummary(tom, el) {
    if (!tom || !el) return;
    if (tom.settings.maxItems === 1) return;

    const host = tom.wrapper || tom.control;
    if (!host) return;

    const cs = getComputedStyle(host);
    if (cs.position === 'static') host.style.position = 'relative';
    host.style.overflow = 'visible';

    let box = el.__inlineSummary;
    if (!box) {
        box = document.createElement('div');
        box.className = 'ts-inline-summary';
        Object.assign(box.style, {
            position: 'absolute',
            left: '8px',
            right: '56px',
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
    const pad4 = (s) =>
        String(s ?? '')
            .replace(/\D/g, '')
            .padStart(4, '0');

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
            const free = Math.max(0, rectHost.right - rightMost) + 16;
            if (free > 36) reserve = free;
        } catch {}
        box.style.right = reserve + 'px';
    };

    const render = () => {
        const vals = tom.items || [];
        if (!vals.length) {
            box.style.display = 'none';
            return;
        }

        const labels = vals
            .map((v) => {
                const o = tom.options[v] || {};
                return (o.label || o.text || (o.kodikos != null ? pad4(o.kodikos) : v)).toString();
            })
            .filter(Boolean);

        const head = labels.slice(0, peek).join(', ');
        const rest = labels.length - peek;
        box.textContent = rest > 0 ? `${head} +${rest}` : head;
        box.style.display = 'block';
        calcRight();
    };

    const rerender = () => {
        try {
            if (tom?._preselecting || tom?._suspendItemAddFlow) return;
            render();
        } catch {}
    };
    tom.on('item_add', rerender);
    tom.on('item_remove', rerender);
    tom.on('clear', rerender);
    tom.on('change', rerender);
    tom.on('load', rerender);
    const debouncedRerender = debounce(rerender, 100);
    new MutationObserver(debouncedRerender).observe(host, { childList: true, subtree: true });
    window.addEventListener('resize', rerender, { passive: true });
    setTimeout(rerender, 0);
}

export const initTomDropdown = ({
    selector,
    url,
    extraParams = {},
    render = {},
    hooks = {},
    minChars = 0
} = {}) => {
    if (!selector || !url) return;

    const el = document.querySelector(selector);
    if (!el) return;

    if (el.tomselect) {
        el.tomselect.destroy();
    }

    const padLength = el.dataset.padLength;
    if (padLength && !extraParams.padLength) {
        extraParams.padLength = padLength;
    }

    const getLimitFromUrl = (urlStr) => {
        const v = parseInt(new URL(urlStr, location.origin).searchParams.get('limit'), 10);
        return Number.isFinite(v) && v > 0 ? v : 50;
    };

    const buildNextPageUrl = (urlStr) => {
        const urlObj = new URL(urlStr, location.origin);
        const next = (+urlObj.searchParams.get('page') || 1) + 1;
        urlObj.searchParams.set('page', next);
        return urlObj.toString();
    };

    const isMultiple = el.hasAttribute('multiple');
    const preloadAll = el.dataset.preloadAll === 'true';

    const nextUrl = (current) => {
        const urlObj = new URL(current);
        const p = (+urlObj.searchParams.get('page') || 1) + 1;
        urlObj.searchParams.set('page', p);
        return urlObj.toString();
    };

    const userOnInit = hooks.onInitialize || hooks.initialize;
    delete hooks.onInitialize;
    delete hooks.initialize;

    const tom = new TomSelect(el, {
        valueField: 'value',
        labelField: 'label',
        searchField: ['label'],
        sort: false,

        score(search) {
            if (!search || !Array.isArray(search.tokens) || !search.tokens.length) {
                return () => 1;
            }
            const toks = search.tokens.map((t) => t.string.toLowerCase());
            return (item) => (toks.every((t) => item.label.toLowerCase().includes(t)) ? 1 : 0);
        },

        maxOptions: null,
        maxItems: isMultiple ? null : 1,
        hideSelected: isMultiple,
        create: false,
        persist: false,

        preload: preloadAll ? 'focus' : false,
        loadThrottle: 0,
        shouldLoad: (q) => (preloadAll ? true : q.trim().length >= minChars),

        placeholder: '',
        plugins: [...(isMultiple ? ['remove_button'] : []), 'dropdown_input'],

        async load(searchText, callback) {
            const now = Date.now();
            if (this._lastLoadTime && now - this._lastLoadTime < 150) {
                callback();
                return;
            }
            this._lastLoadTime = now;

            try {
                this._currentAbort?.abort();
            } catch {}
            this._currentAbort = new AbortController();

            let urlToFetch;
            if (typeof searchText === 'string' && searchText.startsWith('http')) {
                urlToFetch = searchText;
            } else {
                const urlObj = new URL(url, location.origin);
                Object.entries(extraParams).forEach(([k, v]) => v && urlObj.searchParams.set(k, v));

                const extraFilterId = el.dataset.extraFilter;
                if (extraFilterId) {
                    const extraFilterVal = document.getElementById(extraFilterId)?.value?.trim();
                    if (extraFilterVal) {
                        urlObj.searchParams.set(extraFilterId, extraFilterVal);
                    }
                }

                const extraFilterParam = el.dataset.extraFilter2;
                if (extraFilterParam) {
                    const srcId = el.dataset.extraFilter2Src || extraFilterParam;
                    const raw = document.getElementById(srcId)?.value?.trim();
                    if (raw) {
                        const to4 = (x) => {
                            const d = String(x ?? '').replace(/\D/g, '');
                            if (!d) return '';
                            const n = parseInt(d, 10);
                            return Number.isFinite(n)
                                ? String(n).padStart(4, '0')
                                : d.slice(-4).padStart(4, '0');
                        };

                        let used = false;

                        try {
                            const arr = JSON.parse(raw);
                            if (Array.isArray(arr)) {
                                arr.forEach((obj) => {
                                    const k = to4(obj?.kodikos);
                                    if (k) urlObj.searchParams.append(extraFilterParam, k);
                                });
                                used = true;
                            }
                        } catch {}

                        if (!used && raw.includes(',')) {
                            raw.split(',')
                                .map((s) => to4(s))
                                .filter(Boolean)
                                .forEach((k) => urlObj.searchParams.append(extraFilterParam, k));
                            used = true;
                        }

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
                const json = await fetch(urlToFetch, { signal: this._currentAbort.signal }).then(
                    (r) => r.json()
                );
                let items = Array.isArray(json.items) ? json.items : [];

                const vKey = this.settings.valueField || 'value';
                const lKey = this.settings.labelField || 'label';
                items = items
                    .filter(
                        (it) =>
                            it &&
                            (it[vKey] != null ||
                                it.value != null ||
                                it.id != null ||
                                it.kodikos != null)
                    )
                    .map((it) => {
                        const rawVal =
                            it[vKey] ??
                            it.value ??
                            it.id ??
                            (it.kodikos != null
                                ? String(it.kodikos).padStart(
                                      parseInt(el.dataset.padLength || '3', 10),
                                      '0'
                                  )
                                : '');
                        const val = String(rawVal).trim();
                        const label = String(
                            it[lKey] ??
                                it.label ??
                                it.text ??
                                (it.kodikos != null
                                    ? `${String(it.kodikos).padStart(
                                          parseInt(el.dataset.padLength || '3', 10),
                                          '0'
                                      )} - ${it.perigrafh ?? ''}`
                                    : val)
                        );
                        return {
                            ...it,
                            [vKey]: val,
                            [lKey]: label,
                            value: val,
                            label,
                            text: label
                        };
                    })
                    .filter((it) => it[vKey] !== '');

                this.items.forEach((v) => {
                    const cached = selectedCache[v];
                    const alreadyInOptions = this.options[v];

                    if (!alreadyInOptions && cached) {
                        if (el.dataset.optgroupBy) {
                            const ogField = el.dataset.optgroupField || '__group';
                            const ogExtract = (el.dataset.optgroupExtract || '').toLowerCase();
                            const raw = String(cached[el.dataset.optgroupBy] ?? '');
                            cached[ogField] = ogExtract === 'last4' ? raw.slice(-4) : raw;
                        }
                        this.addOption(cached);
                    } else if (!cached) {
                        console.warn('⚠️ Cannot re-add – missing from cache:', v);

                        console.log('RE-ADD DEBUG', {
                            value,
                            cacheHit: !!itemCache?.[value],
                            tomOptionHit: !!tom?.options?.[value],
                            tomOption: tom?.options?.[value]
                        });
                    }
                });

                {
                    const ogBy = el.dataset.optgroupBy || '';
                    const ogField = el.dataset.optgroupField || '__group';
                    const ogExtract = (el.dataset.optgroupExtract || '').toLowerCase();
                    const ogSrcId = el.dataset.optgroupLabelSource || '';

                    if (ogBy) {
                        items = (items || []).map((it) => {
                            const raw = String(it[ogBy] ?? '');
                            const gid = ogExtract === 'last4' ? raw.slice(-4) : raw;
                            return { ...it, [ogField]: gid };
                        });

                        const groups = new Map();
                        const katTS = ogSrcId
                            ? document.getElementById(ogSrcId)?.tomselect || null
                            : null;

                        for (const it of items) {
                            const gid = it[ogField];
                            if (!gid || groups.has(gid)) continue;
                            let label = gid;
                            const katOpt = katTS?.options?.[gid];
                            if (katOpt) {
                                const base = String(katOpt.text || katOpt.label || '').trim();
                                const withoutDup = base.replace(
                                    new RegExp(`^${gid}\\s*-\\s*`, 'i'),
                                    ''
                                );
                                label = `${gid} - ${withoutDup || base}`;
                            }
                            groups.set(gid, { value: gid, label });
                        }

                        try {
                            groups.forEach((data, gid) => this.addOptionGroup(gid, data));
                        } catch {}

                        items.sort((a, b) => {
                            const ga = String(a[ogField] || ''),
                                gb = String(b[ogField] || '');
                            const cmpG = ga.localeCompare(gb, undefined, { numeric: true });
                            if (cmpG !== 0) return cmpG;
                            const kA = String(a.kodikos || ''),
                                kB = String(b.kodikos || '');
                            return kA.localeCompare(kB, undefined, { numeric: true });
                        });
                    }
                }

                items.length ? callback(items) : callback();

                const idKey = this.settings.valueField;
                const keep = new Set([...(this.items || []), ...items.map((o) => o[idKey])]);
                Object.keys(this.options).forEach((id) => {
                    if (!keep.has(id)) this.removeOption(id);
                });

                const limit = Number(new URL(urlToFetch).searchParams.get('limit')) || 50;
                const hasMore = 'hasMore' in json ? !!json.hasMore : items.length === limit;
                this.nextPage = hasMore ? nextUrl(urlToFetch) : null;
            } catch (err) {
                if (err && err.name === 'AbortError') {
                } else {
                    if (err.name !== 'AbortError') console.error('Dropdown load failed', err);
                }
                callback();
            }
        },

        render: {
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
            ...render
        },

        _preloadAll: preloadAll,

        onInitialize() {
            const ts = this;

            const keyHandler = function (e) {
                if (e.altKey && e.key === 'ArrowDown') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!ts.isOpen) ts.open();
                    return false;
                }
                if (e.altKey && e.key === 'ArrowUp') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (ts.isOpen) ts.close();
                    return false;
                }
                if (e.key === 'F4') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (ts.isOpen) ts.close();
                    else ts.open();
                    return false;
                }
            };

            if (ts.wrapper) {
                ts.wrapper.addEventListener('keydown', keyHandler, true);
            }

            setTimeout(() => {
                if (ts.control_input && !ts.control_input.__keyHandlerBound) {
                    ts.control_input.addEventListener('keydown', keyHandler);
                    ts.control_input.__keyHandlerBound = true;
                }
            }, 100);

            const resetList = () => {
                this.setTextboxValue('');
                this.clearFilter();
                this.refreshOptions(false);
            };

            if (isMultiple) {
                this.on('item_add', (value) => {
                    if (this._suspendItemAddFlow || this._preselecting) return;

                    setTimeout(() => {
                        if (this._suspendItemAddFlow || this._preselecting) return;

                        const q = this.lastQuery;
                        resetList();

                        if (!this.settings._preloadAll && q) {
                            this.load(q);
                        }

                        if (
                            !this._suspendItemAddFlow &&
                            !this._preselecting &&
                            this.isOpen &&
                            document.activeElement === this.control_input
                        ) {
                            this.open();
                        }
                    }, 0);
                });
            } else {
                this.on('item_add', () => {
                    resetList();
                    this.ignoreFocusOpen = true;
                    this.close();
                    this.control_input.blur();
                    setTimeout(() => {
                        this.ignoreFocusOpen = false;
                        this.disable();
                        this.wrapper.classList.add('ts-disabled-selected');
                        this.wrapper.classList.add('ts-locked');

                        // ✅ Chain callback
                        const chainFn = this.input?.__onItemAddChain;
                        if (typeof chainFn === 'function') {
                            try {
                                chainFn(this.getValue(), this);
                            } catch (_) {}
                        }
                    }, 0);
                });
            }

            this.on('clear', () => {
                if (this._preselecting || this._suspendItemAddFlow) return;

                resetList();
                this.clearOptions();
                this.nextPage = null;
                // if (this.settings._preloadAll) {
                //     this.load('');
                // }
                setTimeout(() => this.refreshOptions(false));

                // ✅ Clear chain callback
                const clearChainFn = this.input?.__onClearChain;
                if (typeof clearChainFn === 'function') {
                    try {
                        clearChainFn();
                    } catch (_) {}
                }
            });

            this.on('dropdown_open', () => {
                if (this._preselecting || this._suspendItemAddFlow) return;

                ts.wrapper.classList.add('open');

                if (this.settings._preloadAll && !this.control_input.value) {
                    if (Object.keys(this.options).length < 2) {
                        this.load('');
                    } else {
                        this.refreshOptions(false);
                    }
                }

                const reposition = () => {
                    const controlRect = this.control.getBoundingClientRect();
                    const ddEl = this.dropdown;
                    const requestedDropdownDirection = String(
                        el.dataset.dropdownDirection || 'auto'
                    )
                        .trim()
                        .toLowerCase();
                    const forcedDirection = ['auto', 'up', 'down'].includes(
                        requestedDropdownDirection
                    )
                        ? requestedDropdownDirection
                        : 'auto';

                    const searchH = 36;
                    const optionH = 34;
                    const idealHeight = searchH + optionH * 6.5;

                    const cardRect = ts.wrapper.closest('.card')?.getBoundingClientRect() ?? {
                        top: 0,
                        bottom: window.innerHeight
                    };

                    const spaceAbove = controlRect.top - cardRect.top;
                    const spaceBelow = cardRect.bottom - controlRect.bottom;

                    ddEl.classList.remove(
                        'place-above',
                        'place-below',
                        'maxh-ideal',
                        'maxh-limited'
                    );
                    ddEl.style.removeProperty('--ts-available-space');

                    if (forcedDirection === 'down') {
                        if (idealHeight <= spaceBelow) {
                            ddEl.classList.add('place-below', 'maxh-ideal');
                        } else {
                            ddEl.style.setProperty(
                                '--ts-available-space',
                                `${Math.max(0, spaceBelow - 8)}px`
                            );
                            ddEl.classList.add('place-below', 'maxh-limited');
                        }
                    } else if (forcedDirection === 'up') {
                        if (idealHeight <= spaceAbove) {
                            ddEl.classList.add('place-above', 'maxh-ideal');
                        } else {
                            ddEl.style.setProperty(
                                '--ts-available-space',
                                `${Math.max(0, spaceAbove - 8)}px`
                            );
                            ddEl.classList.add('place-above', 'maxh-limited');
                        }
                    } else if (idealHeight <= spaceBelow) {
                        ddEl.classList.add('place-below', 'maxh-ideal');
                    } else if (idealHeight <= spaceAbove) {
                        ddEl.classList.add('place-above', 'maxh-ideal');
                    } else {
                        ddEl.style.setProperty(
                            '--ts-available-space',
                            `${Math.max(0, spaceAbove - 8)}px`
                        );
                        ddEl.classList.add('place-above', 'maxh-limited');
                    }
                };

                requestAnimationFrame(reposition);

                if (!this._loadWrappedForReposition) {
                    const origLoad = this.settings.load;
                    this.settings.load = (query, callback) => {
                        origLoad.call(this, query, (items) => {
                            if (Array.isArray(items) && items.length) {
                                callback(items);
                            } else {
                                callback();
                            }
                            requestAnimationFrame(reposition);
                        });
                    };
                    this._loadWrappedForReposition = true;
                }
            });

            this.wrapper.classList.add('dropdown-wrapper');
            this.control_input.classList.add('dropdown-input');
            const phTxt = el.getAttribute('placeholder') || 'Αναζήτηση…';
            this.control_input.setAttribute('placeholder', phTxt);

            this.on(
                'type',
                debounce((query) => {
                    if (!query.trim()) {
                        this.nextPage = null;
                        if (this.settings._preloadAll) {
                            this.load('');
                        } else {
                            this.refreshOptions(false);
                        }
                        return;
                    }

                    this.clearOptions();
                    this.nextPage = null;
                    this.load(query);
                }, 300)
            );

            if (isMultiple) {
                updateOverflow(this);

                const overflowNow = () => {
                    if (this._preselecting || this._suspendItemAddFlow) return;
                    requestAnimationFrame(() => updateOverflow(this));
                };

                this.on('load', overflowNow);
                this.on('item_add', overflowNow);
                this.on('item_remove', overflowNow);
                this.on('clear', overflowNow);

                if (typeof hooks.onInit === 'function') hooks.onInit(this);

                const refresh = debounce(() => {
                    if (this._preselecting || this._suspendItemAddFlow) return;
                    updateOverflow(this);
                }, 50);
                refresh();
                this.on('item_add', refresh);
                this.on('item_remove', refresh);
                window.addEventListener('resize', refresh);
            } else {
                setTimeout(() => updateOverflow(this), 200);
                this.on('change', () => updateOverflow(this));
                this.on('dropdown_close', () => updateOverflow(this));
            }

            if (typeof userOnInit === 'function') userOnInit.call(this);

            const fieldMappings = el.dataset.fieldMappings;
            if (fieldMappings) {
                try {
                    const mappings = JSON.parse(fieldMappings);

                    const formatDate = (dateString) => {
                        if (!dateString) return '';
                        const date = new Date(dateString);
                        if (isNaN(date.getTime())) return '';
                        return date.toISOString().split('T')[0];
                    };

                    const formatDecimal = (value, decimals = 2) => {
                        if (value == null || value === '') return '';
                        const num = parseFloat(value);
                        return isNaN(num) ? '' : num.toFixed(decimals);
                    };

                    this.on('change', (value) => {
                        if (!value) {
                            Object.values(mappings).forEach((targetId) => {
                                const input = document.getElementById(targetId);
                                if (input) {
                                    input.value = '';
                                    input.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            });
                            return;
                        }

                        const selectedItem = this.options[value];
                        if (!selectedItem) {
                            console.warn('⚠️ No option data found for value:', value);
                            return;
                        }

                        Object.keys(mappings).forEach((sourceField) => {
                            const targetFieldId = mappings[sourceField];
                            const targetInput = document.getElementById(targetFieldId);

                            if (!targetInput) {
                                console.warn(`⚠️ Target input not found: ${targetFieldId}`);
                                return;
                            }

                            if (selectedItem[sourceField] === undefined) {
                                console.warn(`⚠️ Source field "${sourceField}" not found in item`);
                                return;
                            }

                            let fieldValue = selectedItem[sourceField];

                            if (targetFieldId.includes('pososto_')) {
                                fieldValue = formatDecimal(fieldValue, 3);
                            } else if (
                                sourceField.includes('isxyei') ||
                                sourceField.includes('date') ||
                                sourceField.includes('hmeromhnia')
                            ) {
                                fieldValue = formatDate(fieldValue);
                            }

                            targetInput.value = fieldValue;
                            targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                        });
                    });
                } catch (err) {
                    console.error('❌ Failed to parse data-field-mappings:', err);
                }
            }

            this.items.forEach((val) => {
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

                const preSelRaw = document.getElementById(preSelId)?.value?.trim();
                if (!preSelRaw) return;

                if (el.hasAttribute('data-has-value')) return;

                const padLen = parseInt(el.dataset.padLength || '3', 10);

                const normalizeItem = (item, fallbackValue) => {
                    const key = ts.settings.valueField || 'value';
                    const lblKey = ts.settings.labelField || 'label';

                    const rawVal =
                        item?.[key] ??
                        item?.value ??
                        item?.id ??
                        (item?.kodikos != null
                            ? String(item.kodikos).padStart(padLen, '0')
                            : fallbackValue);

                    const finalValue = String(rawVal ?? '').trim();

                    const finalLabel =
                        item?.[lblKey] ??
                        item?.label ??
                        item?.text ??
                        (item?.kodikos != null
                            ? `${String(item.kodikos).padStart(padLen, '0')} - ${item.perigrafh ?? ''}`
                            : finalValue);

                    return {
                        ...item,
                        [key]: finalValue,
                        [lblKey]: String(finalLabel),
                        value: finalValue,
                        label: String(finalLabel),
                        text: String(finalLabel)
                    };
                };

                // ── MULTIPLE ─────────────────────────────────────────────────
                if (isMultiple) {
                    let values = [];

                    try {
                        const parsed = JSON.parse(preSelRaw);
                        values = Array.isArray(parsed) ? parsed : [preSelRaw];
                    } catch {
                        values = preSelRaw
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean);
                    }

                    values = values.map((v) => String(v ?? '').trim()).filter(Boolean);

                    if (!values.length) return;

                    ts._preselecting = true;
                    ts._suspendItemAddFlow = true;

                    try {
                        for (const val of values) {
                            const u = new URL(url, location.origin);
                            Object.entries(extraParams || {}).forEach(
                                ([k, v]) => v && u.searchParams.set(k, v)
                            );
                            u.searchParams.set('value', val);

                            try {
                                const res = await fetch(u, { credentials: 'include' });
                                const json = await res.json();
                                const item = json?.items?.[0];
                                if (!item) continue;

                                const normalized = normalizeItem(item, val);
                                const id = normalized.value;

                                if (!ts.options[id]) {
                                    ts.addOption(normalized);
                                }

                                ts.addItem(id, true);
                                selectedCache[id] = normalized;
                            } catch (err) {
                                if (err?.name !== 'AbortError') {
                                    console.error('❌ Preselect fetch failed (multiple):', err);
                                }
                            }
                        }
                    } finally {
                        ts._preselecting = false;
                        setTimeout(() => {
                            ts._suspendItemAddFlow = false;
                            requestAnimationFrame(() => updateOverflow(ts));
                        }, 500);
                    }

                    el.setAttribute('data-has-value', 'true');
                    return;
                }

                // ── SINGLE ───────────────────────────────────────────────────
                const extraFilterId = el.dataset.extraFilter;
                const extraFilterVal = extraFilterId
                    ? document.getElementById(extraFilterId)?.value?.trim()
                    : '';

                const extraFilterId2 = el.dataset.extraFilter2;
                const extraFilterVal2 = extraFilterId2
                    ? document.getElementById(extraFilterId2)?.value?.trim()
                    : '';

                const u = new URL(url, location.origin);
                Object.entries(extraParams || {}).forEach(
                    ([k, v]) => v && u.searchParams.set(k, v)
                );
                u.searchParams.set('value', preSelRaw);

                if (extraFilterVal) u.searchParams.set(extraFilterId, extraFilterVal);
                if (extraFilterVal2) u.searchParams.set(extraFilterId2, extraFilterVal2);

                try {
                    ts._preselectAbort?.abort();
                } catch {}

                const controller = new AbortController();
                ts._preselectAbort = controller;

                try {
                    const res = await fetch(u, {
                        credentials: 'include',
                        signal: controller.signal
                    });
                    const json = await res.json();
                    const item = json?.items?.[0];
                    if (!item) return;

                    if (ts._preselectAbort !== controller) return;

                    const normalized = normalizeItem(item, preSelRaw);
                    const id = normalized.value;

                    if (!ts.options[id]) {
                        ts.addOption(normalized);
                    }

                    ts.setValue(id, true);
                    selectedCache[id] = normalized;
                    el.setAttribute('data-has-value', 'true');

                    // ✅ ΚΡΙΣΙΜΟ: κάλεσε τον __onItemAddChain για hydration
                    // ώστε το downstream να ενημερωθεί (lock/unlock/load)
                    const chainFn = el.__onItemAddChain;
                    if (typeof chainFn === 'function') {
                        try {
                            chainFn(id, ts);
                        } catch (_) {}
                    }

                    requestAnimationFrame(() => {
                        updateOverflow(ts);
                        ts.disable();
                        ts.wrapper.classList.add('ts-disabled-selected');
                        ts.wrapper.classList.add('ts-locked');
                    });

                    // Ενημέρωσε data-link-target αν υπάρχει
                    const linkTargetId = el.dataset.linkTarget;
                    if (linkTargetId) {
                        const linkBtn = document.getElementById(linkTargetId);
                        const url = normalized.url_link || '';
                        if (linkBtn) {
                            if (url) {
                                linkBtn.href = url;
                                linkBtn.classList.remove('disabled');
                                linkBtn.removeAttribute('aria-disabled');
                                linkBtn.style.pointerEvents = 'auto';
                                linkBtn.style.opacity = '1';
                            } else {
                                linkBtn.href = '#';
                                linkBtn.classList.add('disabled');
                                linkBtn.setAttribute('aria-disabled', 'true');
                                linkBtn.style.pointerEvents = 'none';
                                linkBtn.style.opacity = '0.4';
                            }
                        }
                    }
                } catch (err) {
                    if (err?.name !== 'AbortError') {
                        console.error('❌ Preselect fetch failed:', err);
                    }
                } finally {
                    if (ts._preselectAbort === controller) ts._preselectAbort = null;
                }
            };

            setTimeout(doPreselect, 150);

            if (!isMultiple) {
                this.on('change', (val) => {
                    const inputId = el.dataset.targetInput;
                    const input = document.getElementById(inputId);
                    if (input) input.value = val;
                });
            } else {
                const targetTableId = el.dataset.targetTable;
                if (targetTableId) {
                    const padLen = parseInt(el.dataset.padLength || '3', 10);

                    const toPad = (x) => {
                        const d = String(x ?? '').replace(/\D/g, '');
                        if (!d) return '';
                        const n = parseInt(d, 10);
                        return Number.isFinite(n)
                            ? String(n).padStart(padLen, '0')
                            : d.slice(-padLen).padStart(padLen, '0');
                    };

                    const writeTable = () => {
                        if (this._preselecting || this._suspendItemAddFlow) return;
                        if (this._writingTargetTable) return;
                        this._writingTargetTable = true;

                        try {
                            const vals = this.getValue();
                            const arr = (Array.isArray(vals) ? vals : vals ? [vals] : [])
                                .map((v) => {
                                    const o = this.options?.[v] || {};
                                    return {
                                        aa: String(o.aa ?? v),
                                        kodikos: toPad(o.kodikos ?? v.split?.('|')[0] ?? '')
                                    };
                                })
                                .filter((x) => x.kodikos)
                                .sort((a, b) =>
                                    a.kodikos.localeCompare(b.kodikos, undefined, { numeric: true })
                                );

                            const nextValue = JSON.stringify(arr);
                            const input = document.getElementById(targetTableId);
                            if (!input) return;

                            if (input.value !== nextValue) {
                                input.value = nextValue;
                            }
                        } finally {
                            this._writingTargetTable = false;
                        }
                    };

                    this.on('change', writeTable);
                    writeTable();
                }
            }
        },

        onDropdownOpen() {
            if (this._preselecting || this._suspendItemAddFlow) return;

            const ddInput = this.dropdown ? this.dropdown.querySelector('.dropdown-input') : null;
            if (ddInput) {
                if (!this._origDdPlaceholderSaved) {
                    this._origDdPlaceholder = ddInput.getAttribute('placeholder') || '';
                    this._origDdPlaceholderSaved = true;
                }
                ddInput.setAttribute('placeholder', el.getAttribute('placeholder') || 'Αναζήτηση…');
            }

            const dd = this.dropdown;
            if (dd && !this._guardedNoValue) {
                dd.addEventListener(
                    'mousedown',
                    (e) => {
                        const opt = e.target.closest('.option, .ts-option');
                        if (!opt) return;
                        const v = opt.getAttribute('data-value');
                        if (v == null || v === '' || v === 'undefined') {
                            if (e.preventDefault) e.preventDefault();
                            if (e.stopPropagation) e.stopPropagation();
                            return false;
                        }
                    },
                    true
                );
                this._guardedNoValue = true;
            }

            if (!this._infiniteBound) {
                const content = this.dropdown
                    ? this.dropdown.querySelector('.ts-dropdown-content')
                    : null;
                if (content) {
                    this._infiniteScrollHandler = () => handleScroll(this, content);
                    content.addEventListener('scroll', this._infiniteScrollHandler, {
                        passive: true
                    });
                    this._infiniteBound = true;
                }
            }

            this.wrapper.classList.add('open');
            hooks.onOpen?.(this);
        },

        onDropdownClose() {
            this.wrapper.classList.remove('open');

            const ddInput = this.dropdown ? this.dropdown.querySelector('.dropdown-input') : null;
            if (ddInput && this._origDdPlaceholderSaved) {
                if (this._origDdPlaceholder) {
                    ddInput.setAttribute('placeholder', this._origDdPlaceholder);
                } else {
                    ddInput.removeAttribute('placeholder');
                }
            }
        },

        onFocus() {
            if (this._preselecting || this._suspendItemAddFlow) return;

            if (
                this.input?.dataset?.autoclearOnFocus === 'true' ||
                this.wrapper?.dataset?.autoclearOnFocus === 'true'
            ) {
                clickClearIfVisible(this);
            }
            if (!this.ignoreFocusOpen) this.open();
        },

        onChange(vals) {
            if (this._preselecting || this._suspendItemAddFlow) return;
            if (!this.settings.mode.includes('multi') || !Array.isArray(vals)) return;
            const recs = vals.map((v) => this.options[v]);
        }
    });

    (() => {
        const sortBy = (el.dataset.sortBy || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

        if (sortBy.length) {
            tom.settings.sortField = sortBy.map((f) => ({ field: f, direction: 'asc' }));
            tom.settings.sort = true;
        } else {
            tom.settings.sort = false;
        }

        const ogBy = el.dataset.optgroupBy || '';
        if (ogBy) {
            tom.settings.optgroupField = el.dataset.optgroupField || '__group';
            tom.settings.lockOptgroupOrder = true;
            tom.settings.render = tom.settings.render || {};
            const prevHeader = tom.settings.render.optgroup_header;
            tom.settings.render.optgroup_header = function (data, escape) {
                const inner = prevHeader
                    ? prevHeader.call(this, data, escape)
                    : `<div class="optgroup-header ts-og">${escape(data.label || data.value || '')}</div>`;
                return inner;
            };
        }
    })();

    tom.on('item_add', (value) => {
        const key = tom.settings.valueField || 'value';
        const rec = tom.options?.[value];
        const cacheId = rec?.[key] ?? value;

        if (rec) {
            selectedCache[cacheId] = rec;
        } else {
            console.error('❌ item_add: cannot cache or re-add', value);
        }
    });

    async function handleScroll(instance, content) {
        if (!instance.nextPage || instance._loadingNext) return;

        if (content.scrollTop + content.clientHeight < content.scrollHeight - 50) return;

        instance._loadingNext = true;

        const urlToFetch = instance.nextPage;
        const limit = getLimitFromUrl(urlToFetch);

        try {
            const json = await fetch(urlToFetch, { credentials: 'include' }).then((r) => r.json());
            const items = Array.isArray(json.items) ? json.items : [];

            const hasMore = 'hasMore' in json ? Boolean(json.hasMore) : items.length === limit;
            instance.nextPage = hasMore ? buildNextPageUrl(urlToFetch) : null;

            const prevScroll = content.scrollTop;
            const prevHeight = content.scrollHeight;

            const padLen = parseInt(instance.input?.dataset.padLength || '3', 10);
            const key = instance.settings.valueField || 'value';
            const lblKey = instance.settings.labelField || 'label';

            let newCount = 0;

            for (const it of items) {
                const rawVal =
                    it?.[key] ??
                    it?.value ??
                    it?.id ??
                    (it?.kodikos != null ? String(it.kodikos).padStart(padLen, '0') : '');

                const val = String(rawVal ?? '').trim();
                if (!val) continue;

                const label =
                    it?.[lblKey] ??
                    it?.label ??
                    it?.text ??
                    (it?.kodikos != null
                        ? `${String(it.kodikos).padStart(padLen, '0')} - ${it.perigrafh ?? ''}`
                        : val);

                const normalized = {
                    ...it,
                    [key]: val,
                    [lblKey]: String(label),
                    value: val,
                    label: String(label),
                    text: String(label)
                };

                if (!instance.options[val]) {
                    instance.addOption(normalized);
                    newCount++;
                }
            }

            instance.refreshOptions(false);

            if (newCount === 0) {
                return;
            }

            requestAnimationFrame(() => {
                const newHeight = content.scrollHeight;
                const delta = newHeight - prevHeight;
                const SAFE = 500;
                content.scrollTop = prevScroll + delta - SAFE;
            });
        } catch (err) {
            console.error('❌ Dropdown next-page load failed', err);
        } finally {
            instance._loadingNext = false;
        }
    }

    (window.__tomInstances ??= {})[selector] = tom;
    return tom;
};

const CLEAR_BTN_SELECTOR = '.ts-single-reset-btn';

function makeUnfocusable(btn) {
    if (!btn) return;
    btn.tabIndex = -1;
    btn.addEventListener(
        'focus',
        () => {
            try {
                btn.blur();
            } catch (_) {}
        },
        true
    );
    const stop = (e) => {
        try {
            e.preventDefault();
        } catch (_) {}
    };
    btn.addEventListener('mousedown', stop, true);
    btn.addEventListener('touchstart', stop, { capture: true, passive: false });
}

function clickClearIfVisible(ts) {
    const btn = ts.wrapper.querySelector(CLEAR_BTN_SELECTOR);
    if (btn && btn.offsetParent !== null) {
        btn.click();
    }
}

function updateOverflow(tom) {
    if (tom?._preselecting || tom?._suspendItemAddFlow) return;

    if (!tom?.wrapper) return;

    const wrapper = tom.wrapper;
    const ctrl = wrapper.querySelector('.ts-control');
    if (!ctrl) return;

    try {
        const reserve =
            parseInt(
                tom.input?.dataset.reserveRight || tom.wrapper?.dataset.reserveRight || '0',
                10
            ) || 0;
        if (reserve > 0) {
            tom.wrapper.style.display = 'inline-block';
            tom.wrapper.style.width = `calc(100% - ${reserve}px)`;
        }
    } catch {}

    const isMulti = tom.settings.mode?.includes?.('multi');

    if (!isMulti) {
        let trash = wrapper.querySelector('.ts-single-reset-btn');
        if (!trash) {
            trash = document.createElement('button');
            trash.type = 'button';
            trash.className = 'ts-single-reset-btn ts-fill-reset-btn';
            trash.title = 'Καθαρισμός επιλογής';
            trash.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
            <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/></svg>`;
            wrapper.appendChild(trash);
            makeUnfocusable(trash);

            trash.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!(tom.items || []).length) return;

                tom.enable();
                tom.wrapper.classList.remove('ts-disabled-selected');
                tom.wrapper.classList.remove('ts-locked');

                tom.ignoreFocusOpen = true;
                tom.clear();
                tom.close();
                tom.control_input.blur();
                tom.ignoreFocusOpen = false;

                setTimeout(() => {
                    if (tom?.wrapper) {
                        updateOverflow(tom);
                        tom.ignoreFocusOpen = false;
                        // tom.open();
                    }
                }, 0);
            });
        }

        trash.hidden = !(tom.items || []).length;

        if (typeof window.__trashButtonsDisabledState !== 'undefined') {
            const disabledState = window.__trashButtonsDisabledState;
            const selectId = tom?.input?.id || null;

            if (selectId && typeof disabledState[selectId] !== 'undefined') {
                const shouldBeHidden = disabledState[selectId];
                trash.hidden = shouldBeHidden || !(tom.items || []).length;
            }
        }

        const itemEl = ctrl.querySelector('.item');
        if (itemEl) itemEl.classList.add('ts-item-ellipsis');

        return;
    }

    if (isMulti) {
        ctrl.querySelectorAll('.ts-inline-trash').forEach((n) => n.remove());

        let resetBtn = wrapper.querySelector('.ts-fill-reset-btn');
        if (!resetBtn) {
            resetBtn = document.createElement('button');
            resetBtn.type = 'button';
            resetBtn.className = 'ts-fill-reset-btn ts-multi-reset-btn';
            wrapper.appendChild(resetBtn);
            makeUnfocusable(resetBtn);
        }

        const clearTable = () => {
            const tb = document.querySelector('#myTable tbody');
            if (tb) tb.innerHTML = '';
        };

        const clearSelectAll = (selId, hiddenId, tableId) => {
            const inst = document.getElementById(selId)?.tomselect;
            if (inst) {
                inst.clear(true);
                inst.clearOptions();
            } else {
                const el = document.getElementById(selId);
                if (el) {
                    el.value = '';
                    while (el.options?.length) el.remove(0);
                }
            }
            const hid = document.getElementById(hiddenId);
            if (hid) hid.value = '';
            if (tableId) {
                const t = document.getElementById(tableId);
                if (t) t.value = '[]';
            }
        };

        function forceChange(ts) {
            if (ts?._preselecting || ts?._suspendItemAddFlow) return;
            try {
                ts.trigger && ts.trigger('change', ts.getValue());
            } catch {}
            try {
                ts.input && ts.input.dispatchEvent(new Event('change', { bubbles: true }));
            } catch {}
        }

        if (!resetBtn.__wired) {
            resetBtn.__wired = true;

            const SVG_TRASH = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
    <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/></svg>`;

            const SVG_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-all" viewBox="0 0 16 16">
  <path d="M8.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L2.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093L8.95 4.992zm-.92 5.14.92.92a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 1 0-1.091-1.028L9.477 9.417l-.485-.486z"/>
</svg>`;

            const updateResetIcon = () => {
                if (tom?._preselecting || tom?._suspendItemAddFlow) return;
                const hasTags = Array.isArray(tom.items) && tom.items.length > 0;
                if (hasTags) {
                    resetBtn.innerHTML = SVG_TRASH;
                    resetBtn.title = 'Καθαρισμός όλων';
                    resetBtn.hidden = false;
                } else {
                    resetBtn.innerHTML = SVG_CHECK;
                    resetBtn.title = 'Επιλογή όλων';
                    resetBtn.hidden = false;
                }
            };

            updateResetIcon();

            tom.on('item_add', updateResetIcon);
            tom.on('item_remove', updateResetIcon);
            tom.on('clear', updateResetIcon);

            const selectId = tom?.input?.id || (el && el.id) || null;

            resetBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const tsInst = (selectId && document.getElementById(selectId)?.tomselect) || tom;
                if (!tsInst) return;

                tsInst.ignoreFocusOpen = true;

                try {
                    const hasTags = Array.isArray(tsInst.items) && tsInst.items.length > 0;

                    if (hasTags) {
                        if (typeof tsInst.clear === 'function') tsInst.clear(false);
                        else tsInst.setValue([], false);

                        forceChange(tsInst);
                    } else {
                        let allValues = Object.values(tsInst.options || [])
                            .map((o) => o && o.value)
                            .filter((v) => v && v !== '__optgroup');

                        allValues = Array.from(new Set(allValues));
                        if (allValues.length) {
                            tsInst.setValue(allValues, false);
                            forceChange(tsInst);
                        }
                    }
                } finally {
                    tsInst.close();
                    tsInst.control_input?.blur?.();
                    tsInst.ignoreFocusOpen = false;
                    setTimeout(() => {
                        if (tsInst?.wrapper) {
                            updateOverflow(tsInst);
                            updateResetIcon();
                        }
                    }, 0);
                }
            });
        }
    }

    (function applyKathgoriaFirstItemTruncation() {
        try {
            if (!tom || !tom.input || tom.input.id !== 'kathgoria_symbashs') return;
            const itemsList = Array.from(ctrl.querySelectorAll('.item')).filter(
                (i) => !i.closest('.ts-overflow-popup')
            );
            if (!itemsList.length) return;
            const firstEl = itemsList[0];
            const v = firstEl.getAttribute('data-value') || '';
            const opt = (tom.options && tom.options[v]) || {};
            let lbl = String(opt.label || v || firstEl.textContent || '').trim();
            if (!lbl) return;

            var tsWidth = 0;
            try {
                tsWidth = tom.wrapper && tom.wrapper.clientWidth ? tom.wrapper.clientWidth : 0;
            } catch (_) {}
            var width = tsWidth;
            if (!width) {
                width =
                    typeof window !== 'undefined' && window.innerWidth
                        ? window.innerWidth
                        : typeof screen !== 'undefined'
                          ? screen.width
                          : 1912;
            }
            var baselineW = tsWidth ? 1028 : 1912;
            var baselineL = 130;
            var dynLimit;
            if (tsWidth) {
                if (width <= 640) dynLimit = Math.round((baselineL * 640) / 1028);
                else if (width >= 1028) dynLimit = baselineL;
                else dynLimit = Math.round((baselineL * width) / 1028);
            } else {
                dynLimit = Math.round((baselineL * width) / baselineW);
            }
            if (!(typeof dynLimit === 'number' && isFinite(dynLimit))) dynLimit = baselineL;
            if (dynLimit < 80) dynLimit = 80;
            if (dynLimit > 135) dynLimit = 135;

            var shown = lbl.length > dynLimit ? lbl.slice(0, dynLimit) + '…' : lbl;

            var removeEl = firstEl.querySelector('.remove');
            var kids = Array.from(firstEl.childNodes);
            for (var i = 0; i < kids.length; i++) {
                firstEl.removeChild(kids[i]);
            }
            var span = document.createElement('span');
            span.className = 'ts-kathgoria-first';
            span.textContent = shown;
            span.title = lbl;
            firstEl.appendChild(span);
            if (removeEl) firstEl.appendChild(removeEl);
            firstEl.setAttribute('data-trunc', '1');
        } catch (e) {}
    })();

    const ARROW = 36,
        GAP = 28;
    const wrapW = wrapper.getBoundingClientRect().width;
    let avail = wrapW - ARROW;
    let total = 0;

    const items = Array.from(ctrl.querySelectorAll('.item')).filter(
        (i) => !i.closest('.ts-overflow-popup')
    );

    ctrl.querySelector('.ts-overflow-indicator')?.remove();
    ctrl.querySelector('.ts-overflow-popup')?.remove();

    const hidden = [];
    const pinFirst = tom && tom.input && tom.input.id === 'kathgoria_symbashs' && items.length > 0;
    for (let i = 0; i < items.length; i++) {
        const el = items[i];
        el.hidden = false;
        const w = el.offsetWidth + (parseInt(getComputedStyle(el).marginRight) || 0) + GAP;
        if (total + w <= avail || (pinFirst && i === 0)) {
            total += w;
        } else {
            hidden.push(el);
        }
    }
    hidden.forEach((el) => (el.hidden = true));

    if (!hidden.length) return;

    const dot = document.createElement('div');
    dot.className = 'ts-overflow-indicator';
    dot.tabIndex = -1;
    dot.textContent = `+${hidden.length}`;
    dot.title = `Πατήστε για εμφάνιση (${hidden.length} ακόμη)`;
    ctrl.appendChild(dot);

    const idOrName = String(tom.input?.id || tom.input?.name || '').toLowerCase();
    const IS_EID =
        idOrName === 'eidikothta_symbashs' ||
        /(^|[_-])eidikothta[_-]?symbashs($|[_-])/.test(idOrName);

    try {
        dot.style.cursor = 'pointer';
        dot.setAttribute('role', 'button');
    } catch {}

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

        const arm = () => {
            tom.__noReloadArmed = true;
            clearTimeout(tom.__noReloadTimer);
            tom.__noReloadTimer = setTimeout(() => (tom.__noReloadArmed = false), 600);
        };
        dot.__armNoReload = arm;
    })();

    const openOverflowPopup = () => {
        if (ctrl.querySelector('.ts-overflow-popup')) return;

        tom.ignoreFocusOpen = true;
        if (tom.isOpen) tom.close();
        try {
            tom.control_input.blur();
        } catch {}
        setTimeout(() => {
            tom.ignoreFocusOpen = false;
            if (ctrl.querySelector('.ts-overflow-popup')) return;
            const popup = document.createElement('div');
            popup.className = 'ts-overflow-popup';
            try {
                Object.assign(popup.style, { maxHeight: '408px', overflowY: 'auto' });
            } catch {}

            const to4 = (s) =>
                String(s ?? '')
                    .replace(/\D/g, '')
                    .padStart(4, '0');

            const getEidIndex = () => {
                if (!window.__eidikothta_index) {
                    let arr = window.eidikothta_symbashs_table || window.eidikothta_symbashs || [];
                    try {
                        if (typeof arr === 'string') arr = JSON.parse(arr);
                    } catch {}
                    if (!Array.isArray(arr)) {
                        if (arr && Array.isArray(arr.data)) arr = arr.data;
                        else if (arr && typeof arr === 'object') arr = Object.values(arr);
                        else arr = [];
                    }
                    const m = new Map();
                    for (const r of arr)
                        if (r && r.kodikos != null)
                            m.set(to4(r.kodikos), String(r.afora_thn_symbash_kathgoria || ''));
                    window.__eidikothta_index = m;
                }
                return window.__eidikothta_index;
            };

            const codeOf = (v) => {
                const o =
                    (tom.options && tom.options[v]) || (selectedCache && selectedCache[v]) || {};
                return o.kodikos != null ? to4(o.kodikos) : to4(v.split?.('|')[0] || v);
            };
            const catOf = (v) => {
                const o =
                    (tom.options && tom.options[v]) || (selectedCache && selectedCache[v]) || {};
                if (o.afora_thn_symbash_kathgoria) return String(o.afora_thn_symbash_kathgoria);
                const idx = getEidIndex();
                return idx.get(codeOf(v)) || '';
            };
            const makeLabel = (v) => {
                const o =
                    (tom.options && tom.options[v]) || (selectedCache && selectedCache[v]) || {};
                const code = o.kodikos != null ? to4(o.kodikos) : to4(v.split?.('|')[0] || v);
                const desc = String(o.perigrafh || o.description || '').trim();
                const base = String(o.label || o.text || '').trim();
                if (desc) return `${code} - ${desc}`;
                if (base) return base.includes(' - ') ? base : `${code} - ${base}`;
                return code;
            };

            const sorted = hidden.slice().sort((a, b) => {
                const av = a.dataset.value,
                    bv = b.dataset.value;
                const byCat = catOf(av).localeCompare(catOf(bv), undefined, {
                    numeric: true,
                    sensitivity: 'base'
                });
                return byCat !== 0
                    ? byCat
                    : codeOf(av).localeCompare(codeOf(bv), undefined, {
                          numeric: true,
                          sensitivity: 'base'
                      });
            });

            let html = '';
            let prevCat = null;
            for (const el of sorted) {
                const v = el.dataset.value;
                const cat = catOf(v);
                const l = makeLabel(v);

                if (IS_EID && (prevCat === null || cat !== prevCat)) {
                    if (prevCat !== null) html += `<div style="height: 8px"></div>`;
                    html += `<div class="ts-popup-sep" role="separator" style="height:1px;background:#e5e7eb;margin:4px -6px 6px;"></div>`;
                    html += `<div class="ts-popup-sep-labeled" style="font-weight:700;font-size:15px;line-height:1.25;color:#111827;margin:2px 0 6px 6px;">Κατηγορία ${String(cat || '').padStart(4, '0')}</div>`;
                } else if (!IS_EID && prevCat !== null && cat !== prevCat) {
                    html += `<div class="ts-popup-sep" role="separator"></div>`;
                }

                html += `<div class="ts-popup-row"><span>${l}</span><button data-val="${v}" title="Αφαίρεση"><i class="bi bi-trash3"></i></button></div>`;
                prevCat = cat;
            }
            popup.innerHTML = html;

            wrapper.appendChild(popup);

            popup.querySelectorAll('button').forEach((btn) => {
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

            document.addEventListener('click', function close(ev) {
                const clickOutside = !popup.contains(ev.target);
                const clickedDot = ev.target === dot;
                if (clickOutside && !clickedDot) {
                    popup.remove();
                    document.removeEventListener('click', close);
                }
            });
        }, 0);
    };

    const onPress = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (IS_EID && typeof dot.__armNoReload === 'function') dot.__armNoReload();
        tom.ignoreFocusOpen = true;
        try {
            tom.control_input.blur();
        } catch {}
        openOverflowPopup();
        setTimeout(() => {
            if (tom.isOpen) tom.close();
            tom.ignoreFocusOpen = false;
        }, 0);
    };
    dot.addEventListener('mousedown', onPress, { capture: true });
    dot.addEventListener('pointerdown', onPress, { capture: true });
    dot.addEventListener('touchstart', onPress, { capture: true, passive: false });

    dot.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    wrapper
        .querySelectorAll(
            'button i.bi.bi-trash3, button i.bi.bi-check-all, svg.bi-trash3, svg.bi-check-square'
        )
        .forEach((icon) => {
            const btn = icon.closest('button');
            if (btn) makeUnfocusable(btn);
        });
}

window.tomDropdownConfig = {
    setRender: (id, r) => (globalRenderMap[id] = r),
    setHooks: (id, h) => (globalHookMap[id] = h),
    setTemplate: (id, t) => (templateCache[id] = t)
};

window.initTomDropdown = initTomDropdown;

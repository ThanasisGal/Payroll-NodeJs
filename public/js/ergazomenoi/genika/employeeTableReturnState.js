/* Temporary same-tab navigation state, never an employee preference or a write. */
(function () {
    'use strict';
    const KEY = 'employee-table-return:v2';
    const MARK = 'employeeTableReturn';
    const BASE = '/ergazomenoi/ergazomenoi';
    const FORM_PATH = new RegExp(`^${BASE}/(?:add|edit/[a-f\\d]{24})$`, 'i');
    const SORT_KEYS = ['kodikos', 'eponymo', 'onoma', 'patronymo', 'eidikothta', 'afm', 'amka', 'adt'];
    const context = JSON.stringify([
        document.currentScript?.dataset.listCompany || '',
        document.currentScript?.dataset.listYear || ''
    ]);
    let activeFormToken = null;
    const currentUrl = () => location.pathname + location.search;
    const tokenFromUrl = () => new URLSearchParams(location.hash.slice(1)).get(MARK);
    const validId = id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
    const validSort = sort => SORT_KEYS.includes(sort?.key) && ['asc', 'desc'].includes(sort?.direction);
    function storage(action, value) {
        try {
            if (action === 'read') return JSON.parse(sessionStorage.getItem(KEY) || 'null');
            if (action === 'write') sessionStorage.setItem(KEY, JSON.stringify(value));
            else sessionStorage.removeItem(KEY);
            return true;
        } catch (_) { return null; }
    }
    function listUrl(value) {
        try {
            const url = new URL(value, location.origin);
            return url.origin === location.origin && [BASE, `${BASE}/search`, `${BASE}/search/`].includes(url.pathname)
                && !url.hash ? url.pathname + url.search : null;
        } catch (_) { return null; }
    }
    function read() {
        const state = storage('read');
        if (!state || state.context !== context || !/^[a-f\d]{32}$/.test(state.token) ||
            !listUrl(state.returnUrl) || !FORM_PATH.test(state.formPath) ||
            !['outbound', 'entered'].includes(state.phase)) return null;
        return { ...state, returnUrl: listUrl(state.returnUrl) };
    }
    function historyMark(token) {
        try {
            const state = { ...history.state };
            if (token) state[MARK] = token;
            else delete state[MARK];
            history.replaceState(state, '', currentUrl() + (tokenFromUrl() ? '' : location.hash));
        } catch (_) { /* Storage/history restrictions leave ordinary navigation usable. */ }
    }
    function clear(expectedToken) {
        if (expectedToken && storage('read')?.token !== expectedToken) return;
        storage('clear');
        historyMark(null);
        try { sessionStorage.removeItem('employee-maintenance-return:v1'); } catch (_) { /* legacy cleanup */ }
    }
    function begin(formPath, employeeId, scrollTop, sort) {
        if (!listUrl(currentUrl())) return formPath;
        try {
            const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
            const state = { token, phase: 'outbound', context, formPath, returnUrl: currentUrl(),
                employeeId: validId(employeeId) ? employeeId : null,
                scrollTop: Number.isFinite(scrollTop) && scrollTop >= 0 ? scrollTop : 0,
                sort: validSort(sort) ? { key: sort.key, direction: sort.direction } : null };
            if (!storage('write', state)) return formPath;
            historyMark(token);
            return `${formPath}#${MARK}=${token}`;
        } catch (_) { return formPath; }
    }
    function returning(persisted = false) {
        const state = read();
        const traversal = persisted || performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
        const proven = state?.phase === 'entered' && (tokenFromUrl() === state.token ||
            (traversal && history.state?.[MARK] === state.token && currentUrl() === state.returnUrl));
        if (!proven) { clear(); return null; }
        if (currentUrl() !== state.returnUrl) {
            location.replace(`${state.returnUrl}#${MARK}=${state.token}`);
            return { redirected: true };
        }
        return { ...state, sort: validSort(state.sort) ? state.sort : null,
            employeeId: validId(state.employeeId) ? state.employeeId : null };
    }
    function enterForm() {
        if (!FORM_PATH.test(location.pathname)) return;
        activeFormToken = null;
        const state = read();
        if (!state || currentUrl() !== state.formPath ||
            (tokenFromUrl() !== state.token && history.state?.[MARK] !== state.token)) {
            clear();
            return;
        }
        storage('write', { ...state, phase: 'entered' });
        activeFormToken = state.token;
        historyMark(state.token);
        document.querySelectorAll(`.card-footer a[href="${BASE}"]`).forEach(link => {
            link.href = `${state.returnUrl}#${MARK}=${state.token}`;
        });
    }
    window.EmployeeTableReturn = { begin, returning, clear };
    // The app suppresses referrers. Carry the token on existing location.href save
    // redirects where Navigation API is available, without touching Save/POST code.
    // Explicit Return links and browser Back work independently of this API.
    window.navigation?.addEventListener('navigate', event => {
        if (!activeFormToken || !event.cancelable || event.navigationType === 'traverse') return;
        const state = read();
        if (state?.token !== activeFormToken || state.phase !== 'entered' ||
            !listUrl(event.destination.url)) return;
        event.preventDefault();
        location.href = `${state.returnUrl}#${MARK}=${state.token}`;
    });
    document.addEventListener('DOMContentLoaded', enterForm);
    window.addEventListener('pageshow', event => { if (event.persisted) enterForm(); });
})();

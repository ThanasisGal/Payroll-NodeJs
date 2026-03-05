(function () {
    'use strict';

    if (!window.fetch) return;

    const originalFetch = window.fetch.bind(window);

    async function fetchCsrfToken() {
        try {
            const r = await originalFetch('/csrf-token', { credentials: 'include' });
            if (!r.ok) return '';
            const j = await r.json().catch(() => ({}));
            return j.csrfToken || '';
        } catch {
            return '';
        }
    }

    function getTokenFromDom() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta && meta.getAttribute('content')) return meta.getAttribute('content');

        const inp = document.querySelector('input[name="_csrf"]');
        if (inp && inp.value) return inp.value;

        if (window.__CSRF_TOKEN__) return window.__CSRF_TOKEN__;

        return '';
    }

    function setTokenToDom(token) {
        // Keep a global copy (helps pages without meta refresh)
        window.__CSRF_TOKEN__ = token;

        // If meta exists, update it so other code reading meta gets the new token
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) meta.setAttribute('content', token);

        const inp = document.querySelector('input[name="_csrf"]');
        if (inp) inp.value = token;
    }

    function looksLikeCsrfFailure(status, text) {
        if (status !== 403) return false;
        const t = String(text || '');
        return (
            t.includes('Invalid or missing CSRF token') ||
            t.includes('CSRF validation failed') ||
            t.includes('CSRF token invalid')
        );
    }

    async function doFetchWithCsrf(input, init) {
        const opts = init ? { ...init } : {};
        const method = String(opts.method || 'GET').toUpperCase();

        // Leave GET/HEAD/OPTIONS unchanged
        if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
            return originalFetch(input, opts);
        }

        // Always include cookies (your server compares cookieToken vs headerToken)
        opts.credentials = 'include';

        // Normalize headers
        const headers = new Headers(opts.headers || {});

        // Attach token before first attempt (best effort)
        const token = getTokenFromDom();
        if (token) {
            headers.set('csrf-token', token);
            headers.set('x-csrf-token', token);
        }
        opts.headers = headers;

        // Attempt #1
        let res = await originalFetch(input, opts);

        // Retry once if CSRF
        if (res.status === 403) {
            const bodyText = await res
                .clone()
                .text()
                .catch(() => '');
            if (looksLikeCsrfFailure(res.status, bodyText)) {
                const fresh = await fetchCsrfToken();
                if (fresh) {
                    setTokenToDom(fresh);

                    const retryOpts = { ...opts, headers: new Headers(opts.headers) };
                    retryOpts.headers.set('csrf-token', fresh);
                    retryOpts.headers.set('x-csrf-token', fresh);

                    // Optional: inject _csrf into JSON body
                    const ct =
                        retryOpts.headers.get('Content-Type') ||
                        retryOpts.headers.get('content-type') ||
                        '';

                    if (
                        retryOpts.body &&
                        typeof retryOpts.body === 'string' &&
                        ct.includes('application/json')
                    ) {
                        try {
                            const parsed = JSON.parse(retryOpts.body);
                            parsed._csrf = fresh;
                            retryOpts.body = JSON.stringify(parsed);
                        } catch {}
                    }

                    res = await originalFetch(input, retryOpts);
                }
            }
        }

        return res;
    }

    // Patch fetch once. If something else patches later (like your loader),
    // it will wrap OUR patched fetch, which is what we want.
    window.fetch = function (input, init) {
        return doFetchWithCsrf(input, init);
    };
})();

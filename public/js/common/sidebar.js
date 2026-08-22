// /public/js/common/sidebar.js

document.addEventListener('DOMContentLoaded', () => {
    const TREE_SEL = '#nav-tree';
    const SCROLL_SEL = '#sidebarMenu .sidebar-scroll';
    const BTN_COLL_SEL = '#btn-collapse-all';
    const BTN_EXPD_SEL = '#btn-expand-all';
    const SEARCH_SEL = '#sidebarMenu .sidebar-search';
    const BTN_ERGANI_SEL = '#btn-open-ergani';

    const STATE_KEY = 'wps.sidebar.open-ids.v2';

    const tree = document.querySelector(TREE_SEL);
    const scrollArea = document.querySelector(SCROLL_SEL);
    const btnCollapse = document.querySelector(BTN_COLL_SEL);
    const btnExpand = document.querySelector(BTN_EXPD_SEL);
    const searchInput = document.querySelector(SEARCH_SEL);
    const btnErgani = document.querySelector(BTN_ERGANI_SEL);

    if (!tree) return;

    // ---------- helpers ----------
    const setExpandedState = (li, expanded) => {
        const a = li.querySelector(':scope > a');
        const ul = li.querySelector(':scope > ul.submenu');
        if (!a || !ul) return;
        ul.classList.toggle('active', expanded);
        a.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        const arrow = a.querySelector('.user-privileges-hierarchy-chevron');
        if (arrow) arrow.textContent = expanded ? '▾' : '▸';
    };

    const getOpenIds = () =>
        [...tree.querySelectorAll('ul.submenu.active')]
            .map((ul) => ul.parentElement?.id)
            .filter(Boolean);

    const openByIds = (ids = []) => {
        ids.forEach((id) => {
            const li = document.getElementById(id);
            if (li) setExpandedState(li, true);
        });
    };

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

    const normalizePathname = (value) => {
        const pathname = String(value || '').replace(/\/{2,}/g, '/');
        if (!pathname || pathname === '/') return '/';
        return pathname.replace(/\/+$/, '');
    };

    const findCurrentLeaf = () => {
        const currentPath = normalizePathname(window.location.pathname);
        const candidates = [...tree.querySelectorAll('a[href]')]
            .filter((link) => !link.nextElementSibling?.classList.contains('submenu'))
            .map((link) => {
                try {
                    const href = String(link.getAttribute('href') || '').trim();
                    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null;
                    const url = new URL(href, window.location.origin);
                    if (url.origin !== window.location.origin) return null;
                    const path = normalizePathname(url.pathname);
                    if (path === '/' && currentPath !== '/') return null;
                    const exact = currentPath === path;
                    const nested = path !== '/' && currentPath.startsWith(`${path}/`);
                    return exact || nested ? { link, path, exact } : null;
                } catch {
                    return null;
                }
            })
            .filter(Boolean)
            .sort((left, right) => Number(right.exact) - Number(left.exact) || right.path.length - left.path.length);
        return candidates[0]?.link || null;
    };

    const activateCurrentPath = () => {
        tree.querySelectorAll('a.active').forEach((link) => link.classList.remove('active'));
        const currentLeaf = findCurrentLeaf();
        if (!currentLeaf) return null;
        currentLeaf.classList.add('active');
        pathToRoot(currentLeaf.closest('li')).reverse().forEach((parentLi) => {
            setExpandedState(parentLi, true);
        });
        return currentLeaf;
    };

    const collapseAll = () => {
        tree.querySelectorAll('ul.submenu.active').forEach((ul) => ul.classList.remove('active'));
        tree.querySelectorAll('#nav-tree a[aria-expanded]').forEach((a) =>
            a.setAttribute('aria-expanded', 'false')
        );
        tree.querySelectorAll('.user-privileges-hierarchy-chevron').forEach((arrow) => {
            arrow.textContent = '▸';
        });
        tree.querySelectorAll('#nav-tree a.active').forEach((a) => a.classList.remove('active'));
        if (scrollArea) scrollArea.scrollTop = 0;
    };

    const expandAll = () => {
        tree.querySelectorAll('#nav-tree li').forEach((li) => {
            const ul = li.querySelector(':scope > ul.submenu');
            if (ul) setExpandedState(li, true);
        });
    };

    const saveState = () => {
        try {
            sessionStorage.setItem(STATE_KEY, JSON.stringify(getOpenIds()));
        } catch {
            // Το sidebar παραμένει λειτουργικό όταν το storage δεν είναι διαθέσιμο.
        }
    };

    const loadState = () => {
        collapseAll();
        try {
            const raw = sessionStorage.getItem(STATE_KEY);
            if (raw) {
                const openIds = JSON.parse(raw);
                if (Array.isArray(openIds)) openByIds(openIds);
            }
        } catch {
            collapseAll();
        }
        activateCurrentPath();
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

            // ── ACCORDION: κλείσε όλο το tree εκτός από το τρέχον path ──
            if (expanded) {
                // βρες όλους τους προγόνους του τρέχοντος li (το path προς τη ρίζα)
                const ancestorLis = new Set();
                let cursor = li.parentElement;
                while (cursor && cursor !== tree) {
                    if (cursor.tagName === 'LI') ancestorLis.add(cursor);
                    cursor = cursor.parentElement;
                }

                // κλείσε όλα τα li που έχουν submenu και ΔΕΝ ανήκουν στο path
                tree.querySelectorAll('li').forEach((otherLi) => {
                    if (otherLi !== li && !ancestorLis.has(otherLi)) {
                        setExpandedState(otherLi, false);
                    }
                });
            }
            // ──────────────────────────────────────────────────────────────

            setExpandedState(li, expanded);
            saveState();
            return;
        }
        // leaf
        saveState();
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
    const norm = (s) =>
        (s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ς/g, 'σ');

    const filterTree = (queryRaw) => {
        const q = norm(queryRaw);
        if (!q) {
            // clear search → επαναφορά state
            tree.querySelectorAll('li').forEach((li) => (li.style.display = ''));
            collapseAll();
            loadState();
            return;
        }

        // κρύψε τα πάντα και εμφάνισε μόνο τα matches + τους προγόνους τους
        tree.querySelectorAll('li').forEach((li) => (li.style.display = 'none'));

        tree.querySelectorAll('#nav-tree li > a').forEach((a) => {
            const txt = norm(a.textContent || '');
            if (txt.includes(q)) {
                const li = a.closest('li');
                li.style.display = '';
                pathToRoot(li).forEach((pli) => {
                    pli.style.display = '';
                    setExpandedState(pli, true);
                });
            }
        });

        // γύρνα στην κορυφή του scroll
        if (scrollArea) scrollArea.scrollTop = 0;
    };

    const debounce = (fn, ms = 150) => {
        let t = 0;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
        };
    };

    searchInput?.addEventListener(
        'input',
        debounce((e) => {
            filterTree(e.target.value);
        }, 150)
    );

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

    btnErgani?.addEventListener('click', async () => {
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

            const res = await fetch('/ergazomenoi/erganh/openErganh', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'CSRF-Token': csrfToken
                }
            });

            const data = await res.json();

            if (!data.success) {
                Swal.fire('Σφάλμα', data.message || 'Σφάλμα ανοίγματος ΕΡΓΑΝΗ.', 'error');
                return;
            }

            Swal.fire({
                title: 'Σύνδεση ΕΡΓΑΝΗ ΙΙ',
                html: `
        <div class="erganh-swal-body">
            <div class="mb-2">
                <strong>Username:</strong>
                <code>${data.username}</code>
            </div>

            <div class="mb-3">
                <strong>Password:</strong>
                <code>${data.password}</code>
            </div>

            <button id="copy-erganh-username" class="btn btn-sm erganh-copy-btn">
                Αντιγραφή username
            </button>

            <button id="copy-erganh-password" class="btn btn-sm erganh-copy-btn">
                Αντιγραφή password
            </button>
        </div>
    `,
                icon: 'info',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showCancelButton: true,
                confirmButtonText: 'Άνοιγμα ΕΡΓΑΝΗ',
                cancelButtonText: 'Κλείσιμο',
                customClass: {
                    actions: 'erganh-swal-actions',
                    confirmButton: 'btn erganh-open-btn',
                    cancelButton: 'btn erganh-close-btn'
                },
                buttonsStyling: false,

                preConfirm: () => {
                    window.open(data.url, '_blank', 'noopener,noreferrer');
                    return false; // ΔΕΝ κλείνει το Swal
                },

                didOpen: () => {
                    document
                        .getElementById('copy-erganh-username')
                        ?.addEventListener('click', () => {
                            navigator.clipboard.writeText(data.username);
                        });

                    document
                        .getElementById('copy-erganh-password')
                        ?.addEventListener('click', () => {
                            navigator.clipboard.writeText(data.password);
                        });
                }
            });
        } catch (err) {
            console.error(err);
            Swal.fire('Σφάλμα', 'Σφάλμα επικοινωνίας με τον server.', 'error');
        }
    });
});

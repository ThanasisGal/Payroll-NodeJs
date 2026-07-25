(function sidebarPrivileges() {
    'use strict';

    function canOpenForm(permission) {
        return permission?.admin === true || permission?.read === true;
    }

    function setLinkEnabled(link, enabled) {
        if (!link) return;
        link.classList.toggle('enabled', enabled);
        link.classList.toggle('disabled', !enabled);
        if (enabled) {
            link.removeAttribute('disabled');
            link.removeAttribute('aria-disabled');
        } else {
            link.setAttribute('disabled', 'true');
            link.setAttribute('aria-disabled', 'true');
        }
    }

    function updateParentLinks(root) {
        const parents = Array.from(root.querySelectorAll('li')).reverse();
        parents.forEach((item) => {
            const ownLink = item.querySelector(':scope > a');
            const descendantLeaves = item.querySelectorAll('li > a[data-privilege-form], li > a[data-sidebar-special]');
            if (!ownLink || descendantLeaves.length === 0) return;
            setLinkEnabled(ownLink, Array.from(descendantLeaves).some((link) => link.classList.contains('enabled')));
        });
    }

    function applySidebarPermissions(root, permissions) {
        root.querySelectorAll('a[data-privilege-form]').forEach((link) => {
            const form = link.dataset.privilegeForm;
            setLinkEnabled(link, canOpenForm(permissions?.[form]));
        });
        root.querySelectorAll('a[data-sidebar-special]').forEach((link) => {
            setLinkEnabled(link, link.dataset.sidebarAuthorized === 'true');
        });
        updateParentLinks(root);
    }

    function disableProtectedLinks(root) {
        root.querySelectorAll('a[data-privilege-form]').forEach((link) => setLinkEnabled(link, false));
        updateParentLinks(root);
    }

    document.addEventListener('click', (event) => {
        const disabledLink = event.target.closest?.('#sidebarMenu a.disabled, #sidebarMenu a[aria-disabled="true"]');
        if (disabledLink) event.preventDefault();
    });

    document.addEventListener('DOMContentLoaded', async () => {
        const root = document.getElementById('sidebarMenu');
        if (!root) return;
        const publicPages = ['/login', '/reset_password', '/register', '/login/logout', '/logout', '/dates/appDate', '/dates/yearInUse', '/dates/periods'];
        if (publicPages.includes(window.location.pathname)) return;
        const userId = window.WPS_USER_ID;
        if (!userId || userId === '""' || userId === 'null') return;

        try {
            const response = await fetch('/api/login/getRoles', {
                credentials: 'include',
                headers: { Accept: 'application/json' }
            });
            if (response.status === 401) {
                disableProtectedLinks(root);
                return;
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            applySidebarPermissions(root, data?.permissions || {});
        } catch (error) {
            console.error('[sidebarPrivileges] Αποτυχία φόρτωσης δικαιωμάτων:', error);
            disableProtectedLinks(root);
        }
    });

    window.SidebarPrivileges = {
        canOpenForm,
        setLinkEnabled,
        updateParentLinks,
        applySidebarPermissions,
        disableProtectedLinks
    };
})();

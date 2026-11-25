'use strict';
(() => {
    const controls = new Map();
    let opened = null, sequence = 0, search = '', searchTimer;
    const panel = document.createElement('div');
    panel.id = 'proposal-dropdown-options'; panel.className = 'proposal-dropdown-options';
    panel.setAttribute('role', 'listbox'); panel.setAttribute('popover', 'manual');
    document.body.append(panel);
    function close() {
        if (!opened) return;
        opened.select.setAttribute('aria-expanded', 'false');
        opened.select.removeAttribute('aria-activedescendant');
        panel.hidePopover(); panel.replaceChildren(); opened = null;
        clearTimeout(searchTimer); search = '';
    }
    function refresh() {
        for (const [select, label] of controls) {
            if (!select.isConnected) { if (opened?.select === select) close(); controls.delete(select); continue; }
            const text = select.selectedOptions[0]?.textContent || '';
            if (label.textContent !== text) label.textContent = text;
            if (opened?.select === select && select.disabled) close();
        }
    }
    function activate(index) {
        if (!opened || !opened.items.length) return;
        opened.index = index;
        const item = opened.items[index];
        for (const node of panel.children) node.classList.toggle('proposal-option-active', node === item);
        opened.select.setAttribute('aria-activedescendant', item.id);
        const top = item.offsetTop, bottom = top + item.offsetHeight;
        if (top < panel.scrollTop) panel.scrollTop = top;
        else if (bottom > panel.scrollTop + panel.clientHeight) panel.scrollTop = bottom - panel.clientHeight;
    }
    function choose(item) {
        if (!opened || !item || item.getAttribute('aria-disabled') === 'true') return;
        const select = opened.select;
        select.value = item.dataset.value; close(); refresh();
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select.focus({ preventScroll: true });
    }
    function open(select) {
        if (select.disabled) return;
        close();
        const options = [...select.options].filter(option => !option.hidden && !option.parentElement.disabled);
        for (const option of options) {
            const item = document.createElement('div'); item.id = `proposal-option-${++sequence}`;
            item.setAttribute('role', 'option'); item.setAttribute('aria-selected', String(option.selected));
            item.setAttribute('aria-disabled', String(option.disabled)); item.dataset.value = option.value;
            item.textContent = option.textContent;
            panel.append(item);
        }
        opened = { select, items: [...panel.children].filter(item => item.getAttribute('aria-disabled') !== 'true'), index: -1 };
        panel.setAttribute('aria-label', select.getAttribute('aria-label') || select.labels?.[0]?.textContent || 'Επιλογές');
        select.setAttribute('aria-expanded', 'true'); panel.showPopover();
        const rect = select.getBoundingClientRect(), viewport = window.visualViewport;
        const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
        const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight, gap = 8;
        panel.style.width = `${Math.min(Math.max(rect.width, 320), 640, width - 2 * gap)}px`;
        panel.style.left = `${Math.max(left + gap, Math.min(rect.left, left + width - panel.offsetWidth - gap))}px`;
        panel.style.maxHeight = 'none'; panel.style.height = 'auto'; panel.style.setProperty('--proposal-option-height', '2.6rem');
        // Eight minimum-height rows cap the menu; longer descriptions consume
        // more of that space without adding empty space to shorter options.
        const rowHeight = Math.min(...[...panel.children].map(item => item.getBoundingClientRect().height));
        const desired = Math.min(panel.scrollHeight + 2, rowHeight * 8 + 2);
        const anchorTop = Math.max(top + gap, Math.min(rect.top, top + height - gap));
        const anchorBottom = Math.max(top + gap, Math.min(rect.bottom, top + height - gap));
        const below = Math.max(0, top + height - anchorBottom - gap), above = Math.max(0, anchorTop - top - gap);
        const down = below >= desired || below >= above;
        const available = down ? below : above;
        panel.style.maxHeight = `${Math.min(desired, available)}px`;
        panel.style.top = `${down ? anchorBottom : Math.max(top + gap, anchorTop - Math.min(desired, available))}px`;
        panel.dataset.direction = down ? 'down' : 'up'; panel.dataset.rowHeight = String(rowHeight);
        const index = opened.items.findIndex(item => item.dataset.value === select.value);
        opened.anchor = select.getBoundingClientRect();
        activate(Math.max(0, index));
    }
    function enhance() {
        for (const select of document.querySelectorAll('.history-proposal-editor select:not([multiple])')) {
            if (controls.has(select)) continue;
            const wrapper = document.createElement('div'), label = document.createElement('span');
            wrapper.className = 'proposal-dropdown'; label.className = 'proposal-dropdown-label'; label.setAttribute('aria-hidden', 'true');
            select.before(wrapper); wrapper.append(select, label); controls.set(select, label);
            select.setAttribute('aria-controls', panel.id); select.setAttribute('aria-expanded', 'false');
            select.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); select.focus({ preventScroll: true }); } });
            select.addEventListener('click', event => { event.preventDefault(); opened?.select === select ? close() : open(select); });
            select.addEventListener('change', () => { close(); queueMicrotask(refresh); });
            select.addEventListener('keydown', event => {
                if (event.key === 'Escape' || event.key === 'Tab') { close(); if (event.key === 'Escape') event.preventDefault(); return; }
                if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
                    event.preventDefault();
                    if (opened?.select !== select) {
                        open(select);
                        if (event.key === 'Home' || event.key === 'End') activate(event.key === 'Home' ? 0 : opened.items.length - 1);
                        return;
                    }
                    if (event.key === 'Enter' || event.key === ' ') { choose(opened.items[opened.index]); return; }
                    const last = opened.items.length - 1;
                    activate(event.key === 'Home' ? 0 : event.key === 'End' ? last : Math.max(0, Math.min(last, opened.index + (event.key === 'ArrowDown' ? 1 : -1))));
                } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                    event.preventDefault(); if (opened?.select !== select) open(select);
                    search += event.key.toLocaleLowerCase('el'); clearTimeout(searchTimer);
                    searchTimer = setTimeout(() => { search = ''; }, 700);
                    const index = opened.items.findIndex(item => item.textContent.toLocaleLowerCase('el').startsWith(search));
                    if (index >= 0) activate(index);
                }
            });
        }
        refresh();
    }
    panel.addEventListener('pointerdown', event => event.preventDefault());
    panel.addEventListener('click', event => choose(event.target.closest('[role=option]')));
    document.addEventListener('pointerdown', event => { if (opened && !panel.contains(event.target) && event.target !== opened.select) close(); });
    document.addEventListener('focusin', event => { if (opened && event.target !== opened.select) close(); });
    document.addEventListener('scroll', event => {
        if (!opened || event.target === panel || panel.contains(event.target)) return;
        const rect = opened.select.getBoundingClientRect();
        if (rect.top !== opened.anchor.top || rect.left !== opened.anchor.left) close();
    }, true);
    window.addEventListener('resize', close);
    window.visualViewport?.addEventListener('resize', close);
    window.visualViewport?.addEventListener('scroll', close);
    new MutationObserver(enhance).observe(document.querySelector('.proposal-page'), { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected', 'hidden'] });
    window.refreshProposalDropdowns = refresh;
    enhance();
})();

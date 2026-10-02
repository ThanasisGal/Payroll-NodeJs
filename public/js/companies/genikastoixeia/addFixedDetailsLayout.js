(function initCompanyAddFixedDetailsLayout() {
    const card = document.getElementById('companyAddFixedDetailsCard');
    let layoutFrame = null;

    function syncCompanyAddFixedDetailsCardHeight() {
        if (!card) return;
        const minimumHeight = 320;
        const footerClearance = 25;
        const cardTop = card.getBoundingClientRect().top;
        const footer = document.querySelector('.footer');
        const footerTop = footer
            ? Math.min(footer.getBoundingClientRect().top, window.innerHeight)
            : window.innerHeight;
        const availableHeight = footerTop - cardTop - footerClearance;
        const cardHeight = Math.max(minimumHeight, Math.floor(availableHeight));
        card.style.height = `${cardHeight}px`;
        card.style.maxHeight = `${cardHeight}px`;
    }

    function scheduleCompanyAddFixedDetailsCardHeightSync() {
        if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
        layoutFrame = window.requestAnimationFrame(() => {
            layoutFrame = null;
            syncCompanyAddFixedDetailsCardHeight();
        });
    }

    function initializeLayout() {
        syncCompanyAddFixedDetailsCardHeight();
        window.addEventListener('resize', scheduleCompanyAddFixedDetailsCardHeightSync);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeLayout, { once: true });
    } else {
        initializeLayout();
    }
})();

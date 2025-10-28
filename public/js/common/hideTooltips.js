// /common/hideTooltips.js
(function () {
    const init = () => {
        const nodes = document.querySelectorAll('[data-bs-toggle="tooltip"]');

        nodes.forEach(el => {
        const tip = bootstrap.Tooltip.getOrCreateInstance(el, { container: 'body' });
        let timer;

        // 4) Όταν ανοίγει το tooltip
        el.addEventListener('shown.bs.tooltip', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
            tip.hide();
            }, 3000);
        });

        // 5) Όταν πάει να κλείσει / έκλεισε, καθάρισε το timer
        el.addEventListener('hide.bs.tooltip', () => {
            clearTimeout(timer);
        });
        el.addEventListener('hidden.bs.tooltip', () => {
            clearTimeout(timer);
        });
        });
  };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();

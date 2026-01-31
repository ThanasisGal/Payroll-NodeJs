const setupAllDynamicChoices = () => {
  const selects = document.querySelectorAll('select[data-api]');

  selects.forEach(async (select) => {
    const apiUrl = select.dataset.api;
    const rawParams = select.dataset.params;
    const extraParams = rawParams ? JSON.parse(rawParams) : {};
    const choices = new Choices(select, {
      searchEnabled: true,
      removeItemButton: false,
      placeholderValue: 'Επιλέξτε...',
      searchPlaceholderValue: 'Αναζήτηση...',
      shouldSort: false,
      loadingText: 'Φόρτωση...'
    });

    let currentPage = 1;
    let currentSearch = '';
    let hasMore = true;
    let isLoading = false;

    async function loadData({ reset = false } = {}) {
      if (isLoading || !hasMore) return;
      isLoading = true;

      try {
        const url = new URL(apiUrl, window.location.origin);
        url.searchParams.set('search', currentSearch);
        url.searchParams.set('page', currentPage);
        for (const [key, value] of Object.entries(extraParams)) {
          url.searchParams.set(key, value);
        }

        const res = await fetch(url);
        const { items, hasMore: more } = await res.json();

        if (reset) {
          choices.clearChoices();
          currentPage = 1;
        }

        choices.setChoices(items, 'value', 'label', false);
        currentPage++;
        hasMore = more;
      } catch (error) {
        console.error('Σφάλμα κατά τη φόρτωση:', error);
      } finally {
        isLoading = false;
      }
    }

    // Παρακολούθηση scroll στο dropdown
    const observeDropdownScroll = () => {
      const wrapper = select.closest('.choices');
    
      const observer = new MutationObserver(() => {
        const scrollTarget = wrapper?.querySelector('.choices__list--dropdown .choices__list');
        if (scrollTarget && !scrollTarget.dataset.scrollBound) {
          scrollTarget.dataset.scrollBound = 'true';
    
          scrollTarget.addEventListener('scroll', async () => {
            const bottom = scrollTarget.scrollTop + scrollTarget.clientHeight;
            if (bottom >= scrollTarget.scrollHeight - 20) {
              await loadData();
            }
          });
    
          observer.disconnect();
        }
      });
    
      observer.observe(wrapper, { childList: true, subtree: true });
    };
    
    // Αναζήτηση
    select.addEventListener('search', async (e) => {
      currentSearch = e.detail.value;
      currentPage = 1;
      hasMore = true;
      await loadData({ reset: true });
    });

    // Εμφάνιση extra info αν υπάρχει
    select.addEventListener('change', () => {
      const value = choices.getValue();
    
      // Αν είναι array (π.χ. multiple select)
      const selected = Array.isArray(value) ? value[0] : value;
    
      if (selected?.customProperties) {
        const { kodikos, apo, eos } = selected.customProperties;
        const infoDiv = document.getElementById('info');
        if (infoDiv) {
          infoDiv.innerHTML = `
            <strong>Κωδικός:</strong> ${kodikos || ''}<br>
            <strong>Από:</strong> ${apo ? new Date(apo).toLocaleDateString() : '-'}<br>
            <strong>Έως:</strong> ${eos ? new Date(eos).toLocaleDateString() : '-'}`;
          infoDiv.style.display = 'block';
        }
      }
    });
    // Κάλεσμα αρχικών δεδομένων και ενεργοποίηση scroll παρακολούθησης
    await loadData();
    observeDropdownScroll();
  });
};

setupAllDynamicChoices();
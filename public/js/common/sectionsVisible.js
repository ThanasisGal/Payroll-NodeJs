document.addEventListener('DOMContentLoaded', function () {
  const tabLinks = document.querySelectorAll('.menu_Links li');
  const sections = document.querySelectorAll('.sections section');

  const mode = document.body.dataset.mode;       // "add" | "edit"
  const context = document.body.dataset.context; // "company" | "branch" | ...

  // ➤ Τίτλοι ανά context/mode
  const TITLES = {
    company: {
      add:  'Εισαγωγή Νέας Εταιρείας',
      edit: 'Συντήρηση Στοιχείων Εταιρείας'
    },
    branch: {
      add:  'Εισαγωγή Νέου Υποκαταστήματος',
      edit: 'Συντήρηση Στοιχείων Υποκαταστημάτων'
    },
    // Προσθέτουμε κι άλλα context εδώ αν χρειαστεί...
  };

  const titleBase = (TITLES[context] && TITLES[context][mode]) || '';

  const getTabName = (el) => (el?.textContent || '').trim();
  const setVisibleTitle = (tabName) => {
    const visibleTitle = document.querySelector('.sections section.visible .sectionTitle');
    if (visibleTitle) visibleTitle.textContent = `${titleBase}${tabName ? ` (${tabName})` : ''}`;
  };

  // ➤ Εμφάνισε μόνο το πρώτο section και κάνε active το πρώτο tab αν δεν υπάρχει
  sections.forEach(section => section.classList.remove('visible'));
  if (sections.length > 0) sections[0].classList.add('visible');

  if (![...tabLinks].some(l => l.classList.contains('active')) && tabLinks.length > 0) {
    tabLinks[0].classList.add('active');
  }

  // ➤ Αρχικός τίτλος
  const initialTab = document.querySelector('.menu_Links li.active') || tabLinks[0];
  setVisibleTitle(getTabName(initialTab));

  // ➤ Click switching
  tabLinks.forEach((link, index) => {
    link.addEventListener('click', () => {
      // Tabs
      tabLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Sections
      sections.forEach(section => section.classList.remove('visible'));
      if (sections[index]) sections[index].classList.add('visible');

      // Τίτλος μόνο στο ορατό section
      setVisibleTitle(getTabName(link));
    });
  });
});


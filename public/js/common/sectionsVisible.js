document.addEventListener('DOMContentLoaded', function () {
  const tabLinks = document.querySelectorAll('.menu_Links li');
  const sections = document.querySelectorAll('.sections section');

  // Προβολή μόνο του πρώτου section
  sections.forEach(section => section.classList.remove('visible'));
  if (sections.length > 0) {
    sections[0].classList.add('visible');
  }

  // ➤ Ενημέρωση αρχικού τίτλου
  const initialTab = document.querySelector('.menu_Links li.active');
  if (initialTab) {
    const tabName = initialTab.textContent.trim();
    const visibleTitle = document.querySelector('.sections section.visible .sectionTitle');
    if (visibleTitle) {
      visibleTitle.textContent = `Εισαγωγή Νέας Εταιρείας (${tabName})`;
    }
  }

  // ➤ Click switching
  tabLinks.forEach((link, index) => {
    link.addEventListener('click', () => {
      // Εναλλαγή tabs
      tabLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Απόκρυψη όλων των sections
      sections.forEach(section => section.classList.remove('visible'));
      if (sections[index]) {
        sections[index].classList.add('visible');
      }

      // ➤ Ενημέρωση τίτλου ΜΟΝΟ στο ορατό section
      const visibleTitle = document.querySelector('.sections section.visible .sectionTitle');
      if (visibleTitle) {
        const tabName = link.textContent.trim();
        visibleTitle.textContent = `Εισαγωγή Νέας Εταιρείας (${tabName})`;
      }
    });
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const cardBodies = document.querySelectorAll('.card-body');
  const scrollToTopButtons = document.querySelectorAll('.scroll-to-top');

  cardBodies.forEach((cardBody, index) => {
    if (cardBody && scrollToTopButtons[index]) { // Ελέγχουμε αν και τα δύο στοιχεία υπάρχουν
      const scrollToTopButton = scrollToTopButtons[index];

      const reserveSpace = !!scrollToTopButton.closest(':is(.employee-add-page, .employee-edit-page) .companies-management-footer');
      const updateScrollToTop = function() {
        const visible = cardBody.scrollTop > 40;
        if (reserveSpace) {
          scrollToTopButton.style.visibility = visible ? 'visible' : 'hidden';
        } else {
          scrollToTopButton.style.display = visible ? 'block' : 'none';
        }
      };
      cardBody.addEventListener('scroll', updateScrollToTop);
      if (reserveSpace) updateScrollToTop();

      scrollToTopButton.addEventListener('click', function() {
        cardBody.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const cardBodies = document.querySelectorAll('.card-body');
  const scrollToTopButtons = document.querySelectorAll('.scroll-to-top');

  cardBodies.forEach((cardBody, index) => {
    if (cardBody && scrollToTopButtons[index]) { // Ελέγχουμε αν και τα δύο στοιχεία υπάρχουν
      const scrollToTopButton = scrollToTopButtons[index];

      cardBody.addEventListener('scroll', function() {
        if (cardBody.scrollTop > 40) {
          scrollToTopButton.style.display = 'block';
        } else {
          scrollToTopButton.style.display = 'none';
        }
      });

      scrollToTopButton.addEventListener('click', function() {
        cardBody.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }
  });
});

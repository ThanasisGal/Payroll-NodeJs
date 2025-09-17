document.addEventListener('DOMContentLoaded', () => {
    // μπλόκαρε τα links που δεν επιτρέπονται
    document.querySelectorAll('a[data-allowed="0"]').forEach(a => {
        a.classList.add('is-disabled');            // hook για styling
        a.setAttribute('aria-disabled', 'true');   // προσβασιμότητα
        a.setAttribute('tabindex', '-1');          // βγάλ’ το από tab order (προαιρετικό)

        const block = (e) => { e.preventDefault(); e.stopPropagation(); };

        // ποντίκι
        a.addEventListener('click', block);

        // πληκτρολόγιο (Enter/Space σε role="button" anchors)
        a.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') block(e);
        });
    });
});

// document.addEventListener('DOMContentLoaded', function() {
//   // Δημιουργία αντικειμένου για τα πεδία εισόδου
//   const inputs = {
//     eponymo: document.getElementById('eponymo'),
//     onoma: document.getElementById('onoma'),
//     afm: document.getElementById('afm'),
//     amka: document.getElementById('amka')
//   };

//   // Περπάτηση στα keys του αντικειμένου
//   Object.keys(inputs).forEach(key => {
//     // Προσθήκη event listener για το blur event
//     inputs[key].addEventListener('blur', function() {
//       // Βρείτε το αντίστοιχο κρυφό πεδίο
//       const hiddenInput = document.getElementById(`${key}Hidden`);
//       // Αντιγραφή της τιμής στο κρυφό πεδίο
//       if (hiddenInput) {
//         hiddenInput.value = this.value;
//       }
//     });
//   });
// });
// putInputValuesToHiddenValues.js
document.addEventListener('DOMContentLoaded', () => {
  const ids = ['eponymo','onoma','afm','amka'];

  ids.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) {
      // προαιρετικό log για debugging
      // console.warn(`[putInputValuesToHiddenValues] Missing #${id}`);
      return;
    }

    const hiddenId = `${id}Hidden`;
    input.addEventListener('blur', () => {
      const hidden = document.getElementById(hiddenId);
      if (hidden) hidden.value = input.value;
      // else console.warn(`[putInputValuesToHiddenValues] Missing #${hiddenId}`);
    });
  });
});

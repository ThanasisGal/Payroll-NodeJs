// putInputValuesToHiddenValues.js

document.addEventListener('DOMContentLoaded', () => {
  const ids = ['eponymo','onoma','afm_ergazomenoy','amka_ergazomenoy'];

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

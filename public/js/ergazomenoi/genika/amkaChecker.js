const checkAmka = async (elementIds) => {
  const results = [];
  for (const elementId of elementIds) {
    const input = document.getElementById(elementId);
    const amkaValue = input.value;

    if (amkaValue === '') continue;

    if (amkaValue.length !== 11) {
      await Swal.fire({
        icon: "error",
        title: "Λάθος ΑΜΚΑ...",
        text: 'Ο AMKA πρέπει να αποτελείται από 11 ψηφία.',
        timer: 2500,
        focusConfirm: true,
        showConfirmButton: false,
        showCancelButton: false,
        customClass: {
          confirmButton: 'class-error',
          title: 'custom-title',
        }
      });
      input.value = '';
      input.focus();
      continue;
    }

    const digits = [...amkaValue];
    const arr2 = digits.reduceRight((acc, digit, index) => {
      const num = parseInt(digit, 10);
      if (index % 2 === 0) {
        acc.push(num);
      } else {
        const doubled = num * 2;
        acc.push(doubled < 10 ? doubled : parseInt(doubled.toString()[0], 10) + parseInt(doubled.toString()[1], 10));
      }
      return acc;
    }, []);

    const total = arr2.reduce((acc, val) => acc + val, 0);

    if (total % 10 !== 0) {
      await Swal.fire({
        icon: "error",
        title: "Λάθος ΑΜΚΑ...",
        text: "Πληκτρολογείστε τον σωστό ΑΜΚΑ ή αφήστε το πεδίο κενό....",
        timer: 2500,
        focusConfirm: true,
        showConfirmButton: false,
        showCancelButton: false,
        customClass: {
          confirmButton: 'class-error',
          title: 'custom-title',
        }
      });
      input.value = '';
      input.focus();
      continue;
    }

    results.push(true);
  }
  return results;
};

document.addEventListener('DOMContentLoaded', () => {
  const amkaInputs = document.querySelectorAll('.amka-input');
  amkaInputs.forEach(input => {
    input.addEventListener('blur', async () => {
      await checkAmka(['amka', 'amka_antikatastath']);
    });
  });
});

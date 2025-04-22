document.addEventListener('DOMContentLoaded', () => {
  const bankSelect = document.getElementById('trapeza');
  const bankCodeHiddenInput = document.getElementById('bankCode');

  bankSelect.addEventListener('change', () => {
    bankCodeHiddenInput.value = bankSelect.value;
  });
});
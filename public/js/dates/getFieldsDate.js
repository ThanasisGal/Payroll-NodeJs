document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('input[type="date"]').forEach(function (inputElement) {
    const originalDate = inputElement.getAttribute('value');
    if (originalDate) {
      inputElement.value = window.formatISODate(originalDate);
    }
  });
});
function createSafeTooltip(el, text) {
  // 1️⃣ καθάρισε τυχόν παλιό instance
  bootstrap.Tooltip.getInstance(el)?.dispose();

  // 2️⃣ φτιάξε καινούριο με defaults – ΠΑΝΤΑ trigger
  return new bootstrap.Tooltip(el, {
    title     : text,
    trigger   : 'hover focus',     // fallback -> δεν λείπει ποτέ
    placement : 'top'
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const selectElements = document.querySelectorAll("[id^='select_']");

  selectElements.forEach((selectElement, index) => {
    const tooltipIcon = document.getElementById(`tooltipIcon_${index + 1}`);
    const options = selectElement.getElementsByTagName('option');
  
    Array.from(options).forEach(option => {
      if (option.textContent.length > 97) {
        option.setAttribute('data-bs-toggle', 'tooltip');
        option.setAttribute('data-bs-placement', 'top');
        option.setAttribute('title', option.textContent);
        createSafeTooltip(tooltipIcon, option.textContent);
        tooltipIcon.addEventListener('mouseleave', () => {
          const tooltip = bootstrap.Tooltip.getInstance(tooltipIcon);
          if (tooltip) {
            tooltip.hide();
          }
        });
      }
    });
  
    selectElement.addEventListener('change', (event) => {
      const selectedOption = event.target.selectedOptions[0];
      if (selectedOption.textContent.length > 97) {
        createSafeTooltip(tooltipIcon, selectedOption.textContent);
      } else {
        bootstrap.Tooltip.getInstance(tooltipIcon)?.dispose();
      }
    });
  });
});

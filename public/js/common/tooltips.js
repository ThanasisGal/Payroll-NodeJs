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
        tooltipIcon.addEventListener('mouseover', () => {
          new bootstrap.Tooltip(tooltipIcon, {
            title: option.textContent,
            placement: 'top',
          });
        });
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
        new bootstrap.Tooltip(tooltipIcon, {
          title: selectedOption.textContent,
          placement: 'top',
        });
      } else {
        const tooltip = bootstrap.Tooltip.getInstance(tooltipIcon);
        if (tooltip) {
          tooltip.dispose();
        }
      }
    });
  });
});

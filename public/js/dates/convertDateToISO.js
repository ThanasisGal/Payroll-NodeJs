document.addEventListener("DOMContentLoaded", function () {
  function formatISODate(isoDate) {
    const date = new Date(isoDate);
    return date.toISOString().split("T")[0];
  }
  window.formatISODate = formatISODate;
  
});

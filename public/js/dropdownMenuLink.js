document.addEventListener("DOMContentLoaded", function () {
  const dropdown = document.querySelector(".dropdown");

  dropdown.addEventListener("click", function () {
    this.classList.toggle("active");
    const dropdownMenu = this.querySelector(".dropdown-menu");
    dropdownMenu.classList.toggle("show");
  })

});

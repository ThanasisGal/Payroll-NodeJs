document.addEventListener("DOMContentLoaded", function () {
  const expandIcons = document.querySelectorAll('.expand-icon');
  expandIcons.forEach(icon => {
    icon.addEventListener('click', () => {
        const listItem = icon.parentElement;
        listItem.classList.toggle('collapsed');
        const subMenu = listItem.querySelector('.sub-menu');
        subMenu.style.display = subMenu.style.display === 'none' ? 'block' : 'none';
    });
  });
});

// Διαχείριση των main menus
document.querySelectorAll('#nav-tree > li > a').forEach(menu => {
  menu.addEventListener('click', function(event) {
    const submenu = this.nextElementSibling;
    const chevron = this.querySelector('.chevron-icon');

    if (submenu && submenu.classList.contains('submenu')) {
      event.preventDefault();
      submenu.classList.toggle('active');
      if (chevron) {
        chevron.classList.toggle('rotate-chevron');
      }
    }
  });
});

// Διαχείριση των nested submenus
document.querySelectorAll('#nav-tree li ul li > a').forEach(menu => {
  menu.addEventListener('click', function(event) {
    const submenu = this.nextElementSibling;
    const chevron = this.querySelector('.chevron-icon');

    if (submenu && submenu.classList.contains('submenu')) {
      event.preventDefault();
      submenu.classList.toggle('active');
      if (chevron) {
        chevron.classList.toggle('rotate-chevron');
      }
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const menuItems = document.querySelectorAll("#nav-tree a");

  function adjustSpacing() {
    menuItems.forEach(item => {
      item.style.marginBottom = "2px";
      item.style.removeProperty('padding');

      const chevron = item.querySelector('.chevron-icon');
      if (chevron) {
        // Το styling πλέον γίνεται μέσω CSS, δεν πειράζουμε transform εδώ
        chevron.style.position = 'absolute';
        chevron.style.right = '0.5rem';
        chevron.style.top = '50%';
        chevron.style.visibility = 'visible';
      }

      const parentLi = item.closest("li");
      if (parentLi) {
        parentLi.style.position = "relative";
        parentLi.style.minHeight = "auto";
        parentLi.addEventListener("mouseenter", function () {
          const submenu = parentLi.querySelector("ul");
          if (submenu && submenu.classList.contains("nav")) {
            const totalHeight = submenu.offsetHeight + item.offsetHeight;
            parentLi.style.height = `${totalHeight}px`;
            parentLi.style.background = "#e0e0e0";
          }
        });
        parentLi.addEventListener("mouseleave", function () {
          parentLi.style.height = "auto";
          parentLi.style.background = "none";
        });
      }
    });
  }

  adjustSpacing();

  menuItems.forEach(item => {
    item.addEventListener("click", function () {
      setTimeout(adjustSpacing, 100);
    });
  });
});

document.addEventListener("DOMContentLoaded", function () {
  async function fetchUserDataAndPermissions() {
    try {
      const response = await fetch("/api/login/getRoles");
      const data = await response.json();
      const { permissions } = data;
      updateDOM(permissions);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  }

  function updateDOM(permissions) {
    // enableAllLinks()

    for (const key in permissions) {
      const listItem = document.querySelector(`#${key}`);
      const links = listItem ? listItem.querySelectorAll('a') : [];
  
      links.forEach(link => {
        if (permissions[key]) {
          link.classList.remove("disabled");
          link.classList.add("enabled");
        } else {
          link.classList.remove("enabled");
          link.classList.add("disabled");
        }
      });
    }
  }

  fetchUserDataAndPermissions();

});






// document.addEventListener('DOMContentLoaded', () => {
//   async function fetchUserDataAndPermissions() {
//     try {
//       const res = await fetch('/api/login/getRoles', { cache: 'no-store' });
//       if (!res.ok) return;
//       const { permissions = {} } = await res.json();
//       applyPermissions(permissions);
//     } catch (e) { console.error(e); }
//   }

//   function applyPermissions(permissions) {
//     // προαιρετικά: κλείδωσε όλα by default
//     document.querySelectorAll('#nav-tree a').forEach(a => {
//       a.classList.add('disabled');
//       a.classList.remove('enabled');
//       a.setAttribute('aria-disabled', 'true');
//       a.tabIndex = -1;
//     });

//     // άνοιξε όσα επιτρέπονται
//     for (const key in permissions) {
//       const allowed = !!permissions[key];
//       const root = document.getElementById(key);
//       if (!root) continue;
//       root.querySelectorAll('a').forEach(a => {
//         if (allowed) {
//           a.classList.remove('disabled');
//           a.classList.add('enabled');
//           a.removeAttribute('aria-disabled');
//           a.tabIndex = 0;
//         }
//       });
//     }
//   }

//   // μπλοκάρεις clicks σε disabled links κεντρικά
//   document.getElementById('nav-tree')?.addEventListener('click', (ev) => {
//     const a = ev.target.closest('a.disabled');
//     if (a) ev.preventDefault();
//   });

//   fetchUserDataAndPermissions();
// });

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

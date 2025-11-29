document.addEventListener("DOMContentLoaded", function () {
  
  // ✅ Only run on authenticated/protected pages
  // Skip on public pages and login flow
  const publicPages = ['/login', '/reset_password', '/register', '/logout', '/', '/dates/appDate', '/dates/yearInUse', '/dates/periods'];
  const currentPath = window. location.pathname;
  
  // If on home page or login pages, skip permission check
  if (publicPages. some(page => currentPath === page)) {
    // console.log("Public page - skipping permission check");
    return;
  }

  // ✅ Only run if user appears to be logged in
  const userId = window.WPS_USER_ID;
  if (!userId || userId === '""' || userId === 'null') {
    // console.log("No user ID - skipping permission check");
    return;
  }

  async function fetchUserDataAndPermissions() {
    try {
      const response = await fetch("/api/login/getRoles", {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // If not authenticated, just log and exit (don't redirect)
      if (response.status === 401) {
        console. warn("Not authenticated - permissions unavailable");
        hideProtectedElements();
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data || !data.permissions) {
        console.warn("No permissions data received");
        return;
      }

      const { permissions } = data;
      updateDOM(permissions);
      
    } catch (error) {
      console.error("Error fetching user data:", error);
      hideProtectedElements();
    }
  }

  function updateDOM(permissions) {
    for (const key in permissions) {
      const listItem = document.querySelector(`#${key}`);
      if (! listItem) continue;
      
      const links = listItem.querySelectorAll('a');
  
      links.forEach(link => {
        if (permissions[key]) {
          link.classList. remove("disabled");
          link. classList.add("enabled");
          link.removeAttribute('disabled');
        } else {
          link. classList.remove("enabled");
          link.classList.add("disabled");
          link.setAttribute('disabled', 'true');
        }
      });
    }
  }

  function hideProtectedElements() {
    // Silently disable protected features
    const protectedElements = document.querySelectorAll('[id^="perm_"], [data-permission]');
    protectedElements.forEach(el => {
      const links = el.querySelectorAll('a');
      links. forEach(link => {
        link.classList.add("disabled");
        link.classList.remove("enabled");
      });
    });
  }

  fetchUserDataAndPermissions();

});
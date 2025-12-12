document.addEventListener("DOMContentLoaded", function () {
	// ✅ Only run on authenticated/protected pages
	// Skip on public pages and login flow
	const publicPages = ['/login', '/reset_password', '/register', '/login/logout', '/logout', '/dates/appDate', '/dates/yearInUse', '/dates/periods'];
	const currentPath = window.location.pathname;
	
	// If on home page or login pages, skip permission check
	if (publicPages. some(page => currentPath === page)) {
		return;
	}

	// ✅ Πρώτα ελέγξε αν ο χρήστης είναι συνδεδεμένος
	const userId = window.WPS_USER_ID;
	if (! userId || userId === '""' || userId === 'null') {
		return;
	}

	// ✅ Αν έχει userId, πρέπει να φορτώσουμε τα δικαιώματα ΑΚΟΜΑ κι αν είναι στο home page
	// (γιατί μπορεί να έχει ενεργό session από προηγούμενη σύνδεση)
	
	async function fetchUserDataAndPermissions() {
		try {
			const response = await fetch("/api/login/getRoles", {
				credentials: 'include',
				headers: {
				'Content-Type': 'application/json'
				}
			});

			if (response.status === 401) {
				hideProtectedElements();
				return;
			}

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			
			if (! data || !data.permissions) {
				console.warn("[DOMContentLoaded] Δεν υπάρχουν δικαιώματα");
				return;
			}

			const { permissions } = data;
			updateDOM(permissions);
			
		} catch (error) {
			console.error("[DOMContentLoaded] Σφάλμα:", error);
			hideProtectedElements();
		}
	}

	function updateDOM(permissions) {
		for (const key in permissions) {
			const listItem = document.querySelector(`#${key}`);
			if (!listItem) continue;
		
			const links = listItem.querySelectorAll('a');
		
			links.forEach(link => {
				if (permissions[key]) {
					link.classList.remove("disabled");
					link.classList.add("enabled");
					link.removeAttribute('disabled');
				} else {
					link.classList.remove("enabled");
					link.classList.add("disabled");
					link.setAttribute('disabled', 'true');
				}
			});
		}
	}

	function hideProtectedElements() {
		const protectedElements = document.querySelectorAll('[id^="perm_"], [data-permission]');
		protectedElements.forEach(el => {
			const links = el.querySelectorAll('a');
			links.forEach(link => {
				link.classList.add("disabled");
				link.classList.remove("enabled");
			});
		});
	}

	fetchUserDataAndPermissions();

});
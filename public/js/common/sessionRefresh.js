// ============================================
// SESSION AUTO-REFRESH ON NAVIGATION
// Only for authenticated users
// Refreshes session to 30:00 when navigating
// EXCEPT during grace period (≤ 2:00)
// 
// OPTION 3 (HYBRID):
// - Frontend auto-refresh on page load
// - Backend middleware resets lastActivity
// ============================================

/**
 * Ανανεώνει το session όταν ο χρήστης αλλάζει φόρμα
 * ΜΟΝΟ αν το remaining time > 2 minutes
 */
async function refreshSessionOnNavigation() {
    try {
        const response = await fetch('/api/session/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        });

        // Αν επιστρέψει 401 (unauthenticated), skip
        if (response.status === 401) {
            console.log('ℹ️ Session refresh skipped (not authenticated)');
            return;
        }

        if (!response.ok) {
            console.warn('⚠️ Session refresh failed:', response.status);
            return;
        }

        const data = await response.json();

        if (data.success && data.refreshed) {
            console.log('✅ Session refreshed → 30:00', {
                timestamp: new Date().toLocaleTimeString(),
                remainingTime: data.remainingTime,
                remainingMs: data.remainingMs
            });
            
            // ✅ ΚΛΕΙΔΙ: Κάλεσε το global countdown refresh
            if (typeof window. forceRefreshCountdown === 'function') {
                window.forceRefreshCountdown(data.remainingMs);
            } else {
                console.warn('⚠️ forceRefreshCountdown not available (will retry)');
                
                // ✅ Retry after 500ms (countdown. js may not be loaded yet)
                setTimeout(() => {
                    if (typeof window.forceRefreshCountdown === 'function') {
                        window.forceRefreshCountdown(data.remainingMs);
                    }
                }, 500);
            }
        } else if (data.gracePeriod) {
            console.log('⏰ Grace period active - session NOT refreshed', {
                remainingTime: data.remainingTime
            });
        }
    } catch (error) {
        console.error('❌ Session refresh error:', error);
    }
}

/**
 * Hook into navigation events
 */
function initSessionAutoRefresh() {
    // ═══════════════════════════════════════════════════════════
    // 1. Intercept menu clicks (sidebar/nav)
    // ═══════════════════════════════════════════════════════════
    const menuLinks = document. querySelectorAll('a.nav-link, .sidebar a, [data-form-link]');
    
    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Skip external links & logout
            const href = link.getAttribute('href') || '';
            if (href.startsWith('http') || href.includes('/logout')) {
                return;
            }
            
            // Delay to let page start loading
            setTimeout(refreshSessionOnNavigation, 300);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // 2. Intercept AJAX navigation (jQuery)
    // ═══════════════════════════════════════════════════════════
    if (typeof $ !== 'undefined' && $. ajaxComplete) {
        $(document).ajaxComplete(function(event, xhr, settings) {
            // Skip session refresh API calls (avoid infinite loop)
            if (settings. url && ! settings.url.includes('/api/session/refresh') && !settings.url.includes('/remaining-time')) {
                refreshSessionOnNavigation();
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // 3. Intercept browser back/forward
    // ═══════════════════════════════════════════════════════════
    window.addEventListener('popstate', () => {
        refreshSessionOnNavigation();
    });

    // ═══════════════════════════════════════════════════════════
    // 4. Intercept form submissions (optional)
    // ═══════════════════════════════════════════════════════════
    document.addEventListener('submit', (e) => {
        const form = e.target;
        // Skip login/logout forms
        if (form. action && (form.action.includes('/login') || form.action.includes('/logout'))) {
            return;
        }
        
        setTimeout(refreshSessionOnNavigation, 300);
    });

    console.log('✅ Session auto-refresh initialized');
}

// ═══════════════════════════════════════════════════════════
// AUTO-INIT
// ═══════════════════════════════════════════════════════════
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initSessionAutoRefresh();
        
        // ✅ OPTION 3: Auto-refresh on page load (except login/logout pages)
        if (! window.location.pathname.includes('/login') && 
            !window.location.pathname.includes('/logout')) {
            
            console.log('🔄 Auto-refresh session on page load');
            
            // Delay to ensure countdown. js is loaded
            setTimeout(() => {
                refreshSessionOnNavigation();
            }, 800); // 800ms delay for countdown.js to init
        }
    });
} else {
    initSessionAutoRefresh();
    
    // ✅ OPTION 3: Auto-refresh if script loads after DOMContentLoaded
    if (! window.location.pathname.includes('/login') && 
        !window.location.pathname.includes('/logout')) {
        
        console. log('🔄 Auto-refresh session on script load');
        setTimeout(() => {
            refreshSessionOnNavigation();
        }, 800);
    }
}

// ═══════════════════════════════════════════════════════════
// EXPORT (for ES6 modules)
// ═══════════════════════════════════════════════════════════
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { refreshSessionOnNavigation, initSessionAutoRefresh };
}
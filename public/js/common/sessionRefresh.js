/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SESSION REFRESH ON PAGE NAVIGATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose:
 * - Automatically refresh session countdown when user navigates between pages
 * - ONLY works for authenticated users (logged in)
 * - Resets countdown from current time to full 60:00
 * - Respects grace period (last 2 minutes - no refresh)
 * 
 * How it works:
 * 1. On page load, check if user is authenticated
 * 2. If authenticated, send POST to /api/session/refresh
 * 3. Server checks remaining time:
 *    - If > 2 minutes remaining → Reset to 60:00 ✓
 *    - If ≤ 2 minutes remaining → Don't reset (grace period)
 * 4. Force countdown UI to update with new time
 * 
 * Dependencies:
 * - countdown.js must be loaded first (provides forceRefreshCountdown())
 * - User must be logged in (checks for user info elements)
 * - CSRF token must be available
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIG
    // ═══════════════════════════════════════════════════════════════════════════
    const CONFIG = {
        GRACE_PERIOD_MINUTES: 5,      // Grace period threshold (λεπτά)
        CHECK_INTERVAL: 5000,          // Check interval (milliseconds)
        DEBUG: false,                  // Set to true for detailed console logging
        MAX_RETRIES: 3,                // Max retry attempts on failure
        RETRY_DELAY: 2000              // Delay between retries (ms)
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════
    let retryCount = 0;
    let refreshAttempted = false;

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER: Debug logging
    // ═══════════════════════════════════════════════════════════════════════════
    function log(... args) {
        if (CONFIG.DEBUG) {
            console. log('[SessionRefresh]', new Date().toISOString(), ... args);
        }
    }

    function warn(...args) {
        if (CONFIG.DEBUG) {
            console.warn('[SessionRefresh]', new Date().toISOString(), ...args);
        }
    }

    function error(...args) {
        console.error('[SessionRefresh]', new Date().toISOString(), ...args);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER: Check if user is authenticated
    // ═══════════════════════════════════════════════════════════════════════════
    function isAuthenticated() {
        try {
            // Method 1: Check for user info display elements
            const userNameEl = document.getElementById('displayedSessionUsername');
            const userGroupEl = document.getElementById('displayedSessionUsergroup');
            
            const hasUserInfo = ! !(userNameEl && userGroupEl && userNameEl.textContent. trim());
            
            if (hasUserInfo) {
                log('✓ User authenticated (found user info elements)');
                return true;
            }

            // Method 2: Check for session cookie (fallback)
            const hasSessionCookie = document.cookie. split(';').some(cookie => {
                return cookie.trim().startsWith('connect.sid=');
            });

            if (hasSessionCookie) {
                log('✓ User authenticated (found session cookie)');
                return true;
            }

            log('✗ User NOT authenticated');
            return false;

        } catch (err) {
            error('Error checking authentication:', err);
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER: Get CSRF token
    // ═══════════════════════════════════════════════════════════════════════════
    function getCSRFToken() {
        try {
            // Method 1: Meta tag
            const meta = document.querySelector('meta[name="csrf-token"]');
            if (meta) {
                const token = meta.getAttribute('content');
                if (token) {
                    log('✓ CSRF token found in meta tag');
                    return token;
                }
            }

            // Method 2: Hidden input field
            const input = document.querySelector('input[name="_csrf"]');
            if (input) {
                const token = input.value;
                if (token) {
                    log('✓ CSRF token found in hidden input');
                    return token;
                }
            }

            warn('⚠ CSRF token not found');
            return '';

        } catch (err) {
            error('Error getting CSRF token:', err);
            return '';
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER: Format milliseconds to MM:SS
    // ═══════════════════════════════════════════════════════════════════════════
    function formatTime(ms) {
        const totalSeconds = Math. floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER: Sleep utility for retries
    // ═══════════════════════════════════════════════════════════════════════════
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MAIN: Refresh session on page load
    // ═══════════════════════════════════════════════════════════════════════════
    async function refreshSessionOnLoad() {
        // ✅ Prevent multiple simultaneous calls
        if (refreshAttempted) {
            log('⏭ Session refresh already attempted, skipping');
            return;
        }

        refreshAttempted = true;

        try {
            // ✅ GUARD: Only run if user is authenticated
            if (!isAuthenticated()) {
                log('⏭ User not authenticated, skipping session refresh');
                return;
            }

            log('🔄 Attempting session refresh on page load...');

            const csrfToken = getCSRFToken();
            
            if (!csrfToken) {
                warn('⚠ No CSRF token available, cannot refresh session');
                return;
            }

            // ✅ Make API request with retry logic
            let response;
            let lastError;

            for (let attempt = 0; attempt <= CONFIG. MAX_RETRIES; attempt++) {
                try {
                    log(`📡 API call attempt ${attempt + 1}/${CONFIG.MAX_RETRIES + 1}`);

                    response = await fetch('/api/session/refresh', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'CSRF-Token': csrfToken
                        },
                        credentials: 'include'
                    });

                    // ✅ Success - break retry loop
                    if (response. ok) {
                        break;
                    }

                    // ✅ 401 Unauthorized → User logged out, stop retrying
                    if (response.status === 401) {
                        warn('⚠ Session expired (401), stopping refresh attempts');
                        return;
                    }

                    // ✅ Other errors → retry
                    lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                    
                    if (attempt < CONFIG.MAX_RETRIES) {
                        warn(`⚠ Request failed, retrying in ${CONFIG.RETRY_DELAY}ms...`);
                        await sleep(CONFIG.RETRY_DELAY);
                    }

                } catch (fetchError) {
                    lastError = fetchError;
                    
                    if (attempt < CONFIG. MAX_RETRIES) {
                        warn(`⚠ Network error, retrying in ${CONFIG.RETRY_DELAY}ms...`, fetchError);
                        await sleep(CONFIG.RETRY_DELAY);
                    }
                }
            }

            // ✅ Check final response
            if (! response || ! response.ok) {
                error('❌ Session refresh failed after all retries:', lastError);
                return;
            }

            // ✅ Parse response
            const data = await response.json();
            log('📥 Session refresh response:', data);

            // ✅ Handle success cases
            if (data.success && data.refreshed) {
                log('✅ Session refreshed to 60:00');
                
                // ✅ Force countdown reset (if countdown. js is loaded)
                if (typeof window.forceRefreshCountdown === 'function') {
                    log('🔄 Triggering countdown refresh.. .');
                    window.forceRefreshCountdown();
                } else {
                    warn('⚠ forceRefreshCountdown() not available (countdown.js not loaded?)');
                }

            } else if (data.gracePeriod) {
                log('⏰ Grace period active - session NOT refreshed');
                log(`   Remaining time: ${data.remainingTime || 'unknown'}`);

            } else if (! data.success) {
                warn('⚠ Session refresh returned success=false:', data. error || 'unknown error');
            }

        } catch (err) {
            error('❌ Unexpected error in refreshSessionOnLoad:', err);
        } finally {
            // Reset flag after 5 seconds to allow manual retries if needed
            setTimeout(() => {
                refreshAttempted = false;
            }, 5000);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INIT: Run on DOMContentLoaded
    // ═══════════════════════════════════════════════════════════════════════════
    function init() {
        log('🚀 SessionRefresh initialized');
        log(`   Config: Grace Period=${CONFIG.GRACE_PERIOD_MINUTES}min, Debug=${CONFIG.DEBUG}`);

        // ✅ Run refresh
        refreshSessionOnLoad();
    }

    // ✅ Start when DOM is ready
    if (document.readyState === 'loading') {
        document. addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded
        init();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EXPOSE: Global API for manual triggering (debugging)
    // ═══════════════════════════════════════════════════════════════════════════
    window.manualSessionRefresh = function() {
        refreshAttempted = false; // Reset flag
        return refreshSessionOnLoad();
    };

    log('📦 SessionRefresh module loaded');

})();
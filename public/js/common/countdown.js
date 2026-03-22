/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SESSION COUNTDOWN - CLIENT-SIDE (Clickable Refresh)
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════
window.CountdownManager = {
    sessionEndTime: null,
    countdownInterval: null,
    wasAuthenticated: false,
    currentUserType: null,
    gracePeriodActive: false,
    isRunning: false,
    remainingTimeElement: null,
    lastAuthState: null,
    isRefreshing: false
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════
const CONFIG = {
    SESSION_DURATION_MS: 60 * 60 * 1000,
    GRACE_PERIOD_MS: 5 * 60 * 1000,
    UPDATE_INTERVAL_MS: 1000,
    WARNING_THRESHOLD_MS: 15 * 60 * 1000,
    DANGER_THRESHOLD_MS: 5 * 60 * 1000,
    DEBUG: true // Αλλάξτε σε false για production
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY: Debug logging
// ═══════════════════════════════════════════════════════════════════════════
function log(...args) {
    if (CONFIG.DEBUG) {
        console.log('[Countdown]', ...args);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Get CSRF token
// ═══════════════════════════════════════════════════════════════════════════
function getCSRFToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) {
        const token = meta.getAttribute('content');
        if (token) return token;
    }

    const input = document.querySelector('input[name="_csrf"]');
    if (input) {
        const token = input.value;
        if (token) return token;
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Format time as MM:SS
// ═══════════════════════════════════════════════════════════════════════════
function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Update text color
// ═══════════════════════════════════════════════════════════════════════════
function updateTextColor(remainingMs, userType, element) {
    element.classList.remove('rt-white', 'rt-orange', 'rt-red', 'rt-anonymous');

    if (userType === 'anonymous') {
        if (remainingMs >= 60000) {
            element.classList.add('rt-orange');
        } else {
            element.classList.add('rt-red');
        }
    } else {
        if (remainingMs >= CONFIG.WARNING_THRESHOLD_MS) {
            element.classList.add('rt-white');
        } else if (remainingMs >= CONFIG.DANGER_THRESHOLD_MS) {
            element.classList.add('rt-orange');
        } else {
            element.classList.add('rt-red');
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Show/hide countdown
// ═══════════════════════════════════════════════════════════════════════════
function showCountdown(element) {
    if (element) {
        element.classList.add('remaining-time-visible');
    }
}

function hideCountdown(element) {
    if (element) {
        element.classList.remove('remaining-time-visible');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Update clickable state
// ═══════════════════════════════════════════════════════════════════════════
function updateClickableState(element) {
    if (!element) return;

    const isAuthenticated =
        window.CountdownManager.wasAuthenticated &&
        window.CountdownManager.currentUserType === 'authenticated';

    if (isAuthenticated) {
        element.classList.add('remaining-time-clickable');
        element.removeAttribute('title');
    } else {
        element.classList.remove('remaining-time-clickable');
        element.removeAttribute('title');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FETCH: Get session data from server
// ═══════════════════════════════════════════════════════════════════════════
async function fetchInitialRemainingTime() {
    try {
        log('📡 Fetching session data from server...');

        const response = await fetch('/remaining-time', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Cache-Control': 'no-cache',
                Accept: 'application/json'
            }
        });

        if (response.status === 401) {
            const data = await response.json();
            log('❌ Server returned 401 (unauthenticated)');

            return {
                remainingMs: 0,
                userType: data.userType || 'anonymous',
                gracePeriod: true,
                expired: true,
                authenticated: false
            };
        }

        if (!response.ok) {
            log('❌ Server error:', response.status);
            return null;
        }

        const data = await response.json();

        const isAuthenticated = data.userType === 'authenticated';

        log('✅ Server response:', {
            remainingTime: formatTime(data.remainingTime || 0),
            userType: data.userType,
            authenticated: isAuthenticated
        });

        return {
            remainingMs: data.remainingTime || 0,
            userType: data.userType,
            gracePeriod: data.gracePeriod || false,
            expired: false,
            authenticated: isAuthenticated
        };
    } catch (error) {
        log('❌ Fetch error:', error);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// INIT: Initialize countdown
// ═══════════════════════════════════════════════════════════════════════════
async function initCountdown(element) {
    log('🚀 Initializing countdown...');

    const sessionData = await fetchInitialRemainingTime();

    if (!sessionData) {
        log('⚠️ Server fetch failed → Using grace period (5:00)');
        window.CountdownManager.gracePeriodActive = true;
        window.CountdownManager.currentUserType = 'anonymous';
        window.CountdownManager.sessionEndTime = Date.now() + CONFIG.GRACE_PERIOD_MS;
        window.CountdownManager.wasAuthenticated = false;
    } else if (sessionData.authenticated) {
        log('✅ User IS authenticated');

        window.CountdownManager.sessionEndTime = Date.now() + sessionData.remainingMs;
        window.CountdownManager.currentUserType = 'authenticated';
        window.CountdownManager.gracePeriodActive = false;
        window.CountdownManager.wasAuthenticated = true;

        log('📊 Session time:', formatTime(sessionData.remainingMs));
    } else {
        log('⚠️ User NOT authenticated → Using grace period (5:00)');

        window.CountdownManager.gracePeriodActive = true;
        window.CountdownManager.currentUserType = 'anonymous';
        window.CountdownManager.sessionEndTime = Date.now() + CONFIG.GRACE_PERIOD_MS;
        window.CountdownManager.wasAuthenticated = false;
    }

    log('📊 Final state:', {
        endTime: new Date(window.CountdownManager.sessionEndTime).toLocaleTimeString(),
        userType: window.CountdownManager.currentUserType,
        gracePeriod: window.CountdownManager.gracePeriodActive,
        wasAuthenticated: window.CountdownManager.wasAuthenticated
    });

    startCountdown(element);
    updateClickableState(element);
}

// ═══════════════════════════════════════════════════════════════════════════
// START: Begin countdown
// ═══════════════════════════════════════════════════════════════════════════
function startCountdown(element) {
    if (window.CountdownManager.countdownInterval) {
        clearInterval(window.CountdownManager.countdownInterval);
    }

    updateCountdownDisplay(element);

    window.CountdownManager.countdownInterval = setInterval(() => {
        updateCountdownDisplay(element);
    }, CONFIG.UPDATE_INTERVAL_MS);

    window.CountdownManager.isRunning = true;
    log('▶️ Countdown started');
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE: Display countdown
// ═══════════════════════════════════════════════════════════════════════════
function updateCountdownDisplay(element) {
    if (!element) return;

    const now = Date.now();
    const remainingMs = Math.max(0, window.CountdownManager.sessionEndTime - now);

    showCountdown(element);
    element.textContent = formatTime(remainingMs);
    updateTextColor(remainingMs, window.CountdownManager.currentUserType, element);

    if (remainingMs <= 0) {
        handleSessionExpiry(element);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLE: Session expiry
// ═══════════════════════════════════════════════════════════════════════════
function handleSessionExpiry(element) {
    log('⏰ Session expired!');

    if (window.CountdownManager.countdownInterval) {
        clearInterval(window.CountdownManager.countdownInterval);
        window.CountdownManager.countdownInterval = null;
        window.CountdownManager.isRunning = false;
    }

    if (element) {
        element.textContent = 'Λήξη!';
        element.classList.remove('rt-white', 'rt-orange');
        element.classList.add('rt-red');
    }

    if (
        window.CountdownManager.currentUserType === 'authenticated' ||
        window.CountdownManager.wasAuthenticated
    ) {
        document.dispatchEvent(new Event('sessionExpired'));
    } else if (window.CountdownManager.currentUserType === 'anonymous') {
        document.dispatchEvent(new Event('gracePeriodExpired'));
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLICK HANDLER: Refresh session on click
// ═══════════════════════════════════════════════════════════════════════════
async function handleRemainingTimeClick(event) {
    event.preventDefault();

    const element = event.currentTarget;

    // Έλεγχος αν ο χρήστης είναι authenticated
    if (
        !window.CountdownManager.wasAuthenticated ||
        window.CountdownManager.currentUserType !== 'authenticated'
    ) {
        log('⚠️ Click ignored - user not authenticated');
        return;
    }

    // Αποφυγή multiple clicks
    if (window.CountdownManager.isRefreshing) {
        log('⚠️ Already refreshing...');
        return;
    }

    window.CountdownManager.isRefreshing = true;

    // Visual feedback
    const originalText = element.textContent;
    element.classList.add('refreshing');

    log('🔄 Manual refresh triggered by click on remaining-time');

    try {
        // Λήψη CSRF token
        const csrfToken = getCSRFToken();

        if (!csrfToken) {
            log('❌ No CSRF token found');
            showRefreshError(element);
            element.textContent = originalText;
            return;
        }

        // Call unified API endpoint
        const response = await fetch('/api/session/refresh', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken,
                'Cache-Control': 'no-cache'
            }
        });

        if (response.ok) {
            const data = await response.json();

            if (data.success && data.refreshed) {
                // Χρήση του remainingMs αντί για remainingTime
                const remainingMs = data.remainingMs || data.remainingTime;

                log('✅ Session refreshed successfully to:', formatTime(remainingMs));

                // Update countdown
                window.CountdownManager.sessionEndTime = Date.now() + remainingMs; // ← ΔΙΟΡΘΩΣΗ
                updateCountdownDisplay(element);

                // Show success feedback
                showRefreshSuccess(element);
            } else if (data.gracePeriod) {
                const remainingMs = data.remainingMs || data.remainingTime;

                log('⏰ Grace period active - session NOT refreshed');
                log(`   Remaining time: ${formatTime(remainingMs || 0)}`);

                // Ενημέρωση χρήστη ότι είναι σε grace period
                element.textContent = originalText;
                showRefreshWarning(element);
            } else {
                log('❌ Refresh failed:', data.error || data.message);
                element.textContent = originalText;
                showRefreshError(element);
            }
        } else if (response.status === 401) {
            log('❌ Unauthorized - session expired');
            element.textContent = originalText;
            showRefreshError(element);
        } else {
            log('❌ Refresh request failed:', response.status);
            element.textContent = originalText;
            showRefreshError(element);
        }
    } catch (error) {
        log('❌ Refresh error:', error);
        element.textContent = originalText;
        showRefreshError(element);
    } finally {
        // Re-enable
        setTimeout(() => {
            element.classList.remove('refreshing');
            window.CountdownManager.isRefreshing = false;
        }, 800);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FEEDBACK: Visual feedback functions
// ═══════════════════════════════════════════════════════════════════════════
function showRefreshSuccess(element) {
    if (element) {
        element.classList.add('refresh-success');
        setTimeout(() => {
            element.classList.remove('refresh-success');
        }, 1000);
    }
}

function showRefreshWarning(element) {
    if (element) {
        element.classList.add('refresh-warning');
        setTimeout(() => {
            element.classList.remove('refresh-warning');
        }, 1000);
    }
}

function showRefreshError(element) {
    if (element) {
        element.classList.add('refresh-error');
        setTimeout(() => {
            element.classList.remove('refresh-error');
        }, 1000);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL API: Force refresh (for sessionRefresh.js)
// ═══════════════════════════════════════════════════════════════════════════
window.forceRefreshCountdown = async function () {
    log('🔄 Force refresh triggered');

    const element = window.CountdownManager.remainingTimeElement;

    if (!element) {
        log('⚠️ Countdown element not found');
        return;
    }

    if (!window.CountdownManager.wasAuthenticated) {
        log('⚠️ Not authenticated, skipping refresh');
        return;
    }

    const freshData = await fetchInitialRemainingTime();

    if (freshData && freshData.authenticated && !freshData.expired) {
        window.CountdownManager.sessionEndTime = Date.now() + freshData.remainingMs;
        window.CountdownManager.currentUserType = 'authenticated';
        window.CountdownManager.gracePeriodActive = false;

        log('✅ Countdown refreshed to:', formatTime(freshData.remainingMs));

        updateCountdownDisplay(element);

        if (!window.CountdownManager.isRunning) {
            startCountdown(element);
        }
    } else {
        log('⚠️ Failed to refresh countdown');
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// EVENT: Session expired
// ═══════════════════════════════════════════════════════════════════════════
function onSessionExpired() {
    if (!window.CountdownManager.wasAuthenticated) {
        return;
    }

    if (document.querySelector('.swal2-container')) {
        return;
    }

    Swal.fire({
        backdrop: false,
        allowOutsideClick: false,
        title: 'Λήξη Συνεδρίας',
        text: 'Η συνεδρία σας έχει λήξει λόγω αδράνειας. Συνδεθείτε ξανά για να συνεχίσετε...',
        icon: 'error',
        timer: 4000,
        timerProgressBar: true,
        showConfirmButton: false,
        allowOutsideClick: false,
        customClass: {
            confirmButton: 'class-error custom-confirm-button custom-swal-button',
            title: 'custom-title',
            popup: 'custom-swal-popup'
        },
        willClose: () => {
            window.location.href = '/logout/end_Session?method=idle';
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT: Grace period expired
// ═══════════════════════════════════════════════════════════════════════════
function onGracePeriodExpired(event) {
    if (document.querySelector('.swal2-container')) {
        return;
    }

    Swal.fire({
        backdrop: false,
        allowOutsideClick: false,
        title: 'Λήξη Συνεδρίας',
        text: 'Η συνεδρία σας έχει λήξει λόγω αδράνειας. Συνδεθείτε ξανά για να συνεχίσετε...',
        icon: 'error',
        timer: 4000,
        timerProgressBar: true,
        showConfirmButton: false,
        allowOutsideClick: false,
        customClass: {
            confirmButton: 'class-error custom-confirm-button custom-swal-button',
            title: 'custom-title',
            popup: 'custom-swal-popup'
        },
        willClose: () => {
            window.location.href = '/logout/end_Session?method=idle';
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    const remainingTimeElement = document.getElementById('remaining-time');

    if (!remainingTimeElement) {
        log('ℹ️ No countdown element in DOM');
        return;
    }

    window.CountdownManager.remainingTimeElement = remainingTimeElement;

    document.addEventListener('sessionExpired', onSessionExpired);
    document.addEventListener('gracePeriodExpired', onGracePeriodExpired);

    // Add click handler to remaining-time element
    remainingTimeElement.addEventListener('click', handleRemainingTimeClick);
    log('🖱️ Click handler attached to remaining-time');

    hideCountdown(remainingTimeElement);
    initCountdown(remainingTimeElement);

    window.addEventListener('beforeunload', () => {
        if (window.CountdownManager.countdownInterval) {
            clearInterval(window.CountdownManager.countdownInterval);
            window.CountdownManager.isRunning = false;
        }
    });
});

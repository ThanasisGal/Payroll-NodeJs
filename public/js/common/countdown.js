/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SESSION COUNTDOWN - CLIENT-SIDE (No polling!  Works with httpOnly cookies!)
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
    lastAuthState: null
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════
const CONFIG = {
    SESSION_DURATION_MS: 30 * 60 * 1000,
    GRACE_PERIOD_MS: 2 * 60 * 1000,
    UPDATE_INTERVAL_MS: 1000,
    WARNING_THRESHOLD_MS: 15 * 60 * 1000,
    DANGER_THRESHOLD_MS: 5 * 60 * 1000,
    DEBUG: false
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
// HELPER: Format time as MM:SS
// ═══════════════════════════════════════════════════════════════════════════
function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Update text color
// ═══════════════════════════════════════════════════════════════════════════
function updateTextColor(remainingMs, userType, element) {
    element.classList.remove("rt-white", "rt-orange", "rt-red", "rt-anonymous");

    if (userType === 'anonymous') {
        if (remainingMs >= 60000) {
            element.classList.add("rt-orange");
        } else {
            element.classList.add("rt-red");
        }
    } else {
        if (remainingMs >= CONFIG.WARNING_THRESHOLD_MS) {
            element.classList.add("rt-white");
        } else if (remainingMs >= CONFIG. DANGER_THRESHOLD_MS) {
            element.classList.add("rt-orange");
        } else {
            element.classList.add("rt-red");
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Show/hide countdown
// ═══════════════════════════════════════════════════════════════════════════
function showCountdown(element) {
    if (element) {
        element.style.visibility = 'visible';
        element.style.opacity = '1';
    }
}

function hideCountdown(element) {
    if (element) {
        element.style. visibility = 'hidden';
        element.style.opacity = '0';
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
                'Accept': 'application/json'
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

        if (! response.ok) {
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

    // Fetch session data from server
    const sessionData = await fetchInitialRemainingTime();
    
    if (!sessionData) {
        // Fetch failed - use grace period as fallback
        log('⚠️ Server fetch failed → Using grace period (2:00)');
        window.CountdownManager.gracePeriodActive = true;
        window.CountdownManager.currentUserType = 'anonymous';
        window.CountdownManager.sessionEndTime = Date.now() + CONFIG. GRACE_PERIOD_MS;
        window.CountdownManager.wasAuthenticated = false;
    } else if (sessionData.authenticated) {
        // ✅ AUTHENTICATED USER
        log('✅ User IS authenticated');
        
        window.CountdownManager.sessionEndTime = Date.now() + sessionData.remainingMs;
        window.CountdownManager.currentUserType = 'authenticated';
        window.CountdownManager.gracePeriodActive = false;
        window.CountdownManager.wasAuthenticated = true;
        
        log('📊 Session time:', formatTime(sessionData.remainingMs));
    } else {
        // ❌ NOT AUTHENTICATED → Grace period
        log('⚠️ User NOT authenticated → Using grace period (2:00)');
        
        window.CountdownManager.gracePeriodActive = true;
        window.CountdownManager.currentUserType = 'anonymous';
        window.CountdownManager.sessionEndTime = Date.now() + CONFIG.GRACE_PERIOD_MS;
        window.CountdownManager.wasAuthenticated = false;
    }

    log('📊 Final state:', {
        endTime: new Date(window.CountdownManager. sessionEndTime).toLocaleTimeString(),
        userType: window.CountdownManager.currentUserType,
        gracePeriod: window.CountdownManager.gracePeriodActive,
        wasAuthenticated: window.CountdownManager.wasAuthenticated
    });

    startCountdown(element);
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
    if (! element) return;

    const now = Date.now();
    const remainingMs = Math.max(0, window.CountdownManager. sessionEndTime - now);

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
    log('⏰ Session expired! ');

    if (window.CountdownManager.countdownInterval) {
        clearInterval(window.CountdownManager.countdownInterval);
        window.CountdownManager.countdownInterval = null;
        window.CountdownManager.isRunning = false;
    }

    if (element) {
        element.textContent = "Λήξη! ";
        element.classList.remove("rt-white", "rt-orange");
        element.classList.add("rt-red");
    }

    if (window.CountdownManager.currentUserType === 'authenticated' || window.CountdownManager.wasAuthenticated) {
        document.dispatchEvent(new Event("sessionExpired"));
    } else if (window.CountdownManager.currentUserType === 'anonymous') {
        document.dispatchEvent(new Event("gracePeriodExpired"));
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL API: Force refresh
// ═══════════════════════════════════════════════════════════════════════════
window.forceRefreshCountdown = async function() {
    log('🔄 Force refresh triggered');

    const element = window.CountdownManager.remainingTimeElement;
    
    if (! element) {
        log('⚠️ Countdown element not found');
        return;
    }

    if (! window.CountdownManager.wasAuthenticated) {
        log('⚠️ Not authenticated, skipping refresh');
        return;
    }

    const freshData = await fetchInitialRemainingTime();
    
    if (freshData && freshData.authenticated && ! freshData.expired) {
        window.CountdownManager.sessionEndTime = Date.now() + freshData.remainingMs;
        window.CountdownManager.currentUserType = 'authenticated';
        window.CountdownManager.gracePeriodActive = false;
        
        log('✅ Countdown refreshed to:', formatTime(freshData.remainingMs));
        
        updateCountdownDisplay(element);
        
        if (! window.CountdownManager.isRunning) {
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
    if (! window.CountdownManager.wasAuthenticated) {
        return;
    }

    if (document.querySelector('.swal2-container')) {
        return;
    }

    Swal.fire({
        title: "Λήξη Συνεδρίας",
        text: "Η συνεδρία σας έχει λήξει λόγω αδράνειας.  Συνδεθείτε ξανά για να συνεχίσετε.. .",
        icon: "error",
        timer: 4000,
        timerProgressBar: true,
        showConfirmButton: false,
        allowOutsideClick: false,
        customClass: {
            title: 'custom-title',
            popup: "custom-swal-popup",
        },
        willClose: () => {
            window. location.href = "/logout/end_Session? method=idle";
        },
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
        title: "Λήξη Συνεδρίας",
        text: "Η συνεδρία σας έχει λήξει λόγω αδράνειας.  Συνδεθείτε ξανά για να συνεχίσετε.. .",
        icon: "error",
        timer: 4000,
        timerProgressBar: true,
        showConfirmButton: false,
        allowOutsideClick: false,
        customClass: {
            title: 'custom-title',
            popup: "custom-swal-popup",
        },
        willClose: () => {
            window.location.href = "/logout/end_Session?method=idle";
        },
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
    const remainingTimeElement = document.getElementById("remaining-time");
    
    if (! remainingTimeElement) {
        log('ℹ️ No countdown element in DOM');
        return;
    }

    window.CountdownManager. remainingTimeElement = remainingTimeElement;

    document.addEventListener("sessionExpired", onSessionExpired);
    document. addEventListener("gracePeriodExpired", onGracePeriodExpired);

    hideCountdown(remainingTimeElement);
    initCountdown(remainingTimeElement);

    // console.log('✅ Countdown initialized (client-side - 1 server call only!)');

    window.addEventListener('beforeunload', () => {
        if (window.CountdownManager.countdownInterval) {
            clearInterval(window.CountdownManager.countdownInterval);
            window.CountdownManager.isRunning = false;
        }
    });
});
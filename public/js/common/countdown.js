// document.addEventListener("DOMContentLoaded", () => {
// 	const remainingTimeElement = document.getElementById("remaining-time");
	
// 	if (!remainingTimeElement) {
// 		console.log('ℹ️ No countdown element in DOM');
// 		return;
// 	}

// 	let intervalId = null;
// 	let wasAuthenticated = false;
// 	let currentUserType = null; // 'authenticated', 'anonymous', or null
// 	let consecutiveErrors = 0;

// 	function formatTime(ms) {
// 		const totalSeconds = Math.floor(ms / 1000);
// 		const minutes = Math.floor(totalSeconds / 60);
// 		const seconds = totalSeconds % 60;
// 		return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
// 	}

// 	function updateTextColor(remainingTime, userType) {
// 		const totalSeconds = Math.ceil(remainingTime / 1000);
// 		remainingTimeElement.classList.remove("rt-white", "rt-orange", "rt-red", "rt-anonymous");

// 		// ✅ Διαφορετικά colors για anonymous vs authenticated
// 		if (userType === 'anonymous') {
// 			// Anonymous: Πάντα πορτοκαλί/κόκκινο (grace period)
// 			if (totalSeconds >= 60) {
// 				remainingTimeElement.classList.add("rt-orange");
// 			} else {
// 				remainingTimeElement.classList.add("rt-red");
// 			}
// 		} else {
// 			// Authenticated: Κανονικά colors
// 			if (totalSeconds >= 900) {
// 				remainingTimeElement.classList.add("rt-white");   // 30' - 15'
// 			} else if (totalSeconds >= 300) {
// 				remainingTimeElement.classList.add("rt-orange");  // 15' - 05'
// 			} else {
// 				remainingTimeElement.classList.add("rt-red");     // 05' - 00'
// 			}
// 		}
// 	}

// 	function showCountdown() {
// 		remainingTimeElement.style.visibility = 'visible';
// 		remainingTimeElement.style.opacity = '1';
// 	}

// 	function hideCountdown() {
// 		remainingTimeElement. style.visibility = 'hidden';
// 		remainingTimeElement.style.opacity = '0';
// 	}

// 	async function checkSession() {
// 		try {
// 			const response = await fetch("/remaining-time", {
// 				method: 'GET',
// 				credentials: 'include',
// 				headers: {
// 					'Cache-Control': 'no-cache',
// 					'Accept': 'application/json'
// 				}
// 			});

// 			consecutiveErrors = 0;

// 			// ═══════════════════════════════════════════════════
// 			// CASE 1: Grace Period Expired (401)
// 			// ═══════════════════════════════════════════════════
// 			if (response.status === 401) {
// 				const data = await response.json();
				
// 				// ✅ Αν ήταν anonymous και έληξε το grace period
// 				if (data. userType === 'anonymous' && currentUserType === 'anonymous') {
// 					console.warn('⚠️ Anonymous grace period expired');
// 					hideCountdown();
// 					document.dispatchEvent(new CustomEvent("gracePeriodExpired", {
// 						detail: { message: data.message }
// 					}));
// 					return;
// 				}
				
// 				// ✅ Αν ήταν authenticated και έχασε το session
// 				if (wasAuthenticated) {
// 					console.warn('⚠️ Authenticated session expired');
// 					hideCountdown();
// 					currentUserType = null;
// 					wasAuthenticated = false;
// 					document.dispatchEvent(new Event("sessionExpired"));
// 					return;
// 				}
				
// 				// ✅ Αν ποτέ δεν είχε session, κρύψε το countdown
// 				hideCountdown();
// 				return;
// 			}

// 			if (! response.ok) {
// 				throw new Error(`HTTP ${response.status}`);
// 			}

// 			// ═══════════════════════════════════════════════════
// 			// CASE 2: Valid Response
// 			// ═══════════════════════════════════════════════════
// 			const data = await response.json();

// 			if (data.remainingTime > 0) {
// 				currentUserType = data.userType;
				
// 				// ✅ Authenticated user
// 				if (data.userType === 'authenticated') {
// 					wasAuthenticated = true;
// 				}
				
// 				showCountdown();
// 				remainingTimeElement.textContent = formatTime(data.remainingTime);
// 				updateTextColor(data. remainingTime, data.userType);
// 			} else {
// 				// Time reached 0
// 				remainingTimeElement.textContent = "Λήξη! ";
// 				remainingTimeElement.classList.remove("rt-white", "rt-orange");
// 				remainingTimeElement.classList.add("rt-red");
				
// 				if (currentUserType === 'authenticated' || wasAuthenticated) {
// 					document.dispatchEvent(new Event("sessionExpired"));
// 				} else if (currentUserType === 'anonymous') {
// 					document.dispatchEvent(new Event("gracePeriodExpired"));
// 				}
// 			}

// 		} catch (error) {
// 			consecutiveErrors++;
// 			console.error(`❌ Countdown error (${consecutiveErrors}):`, error. message);
			
// 			if (consecutiveErrors >= 3) {
// 				console.warn('⚠️ Multiple errors, hiding countdown');
// 				hideCountdown();
// 			}
// 		}
// 	}

// 	// ═══════════════════════════════════════════════════
// 	// Event: Session Expired (Authenticated users)
// 	// ═══════════════════════════════════════════════════
// 	function onSessionExpired() {
// 		if (! wasAuthenticated) {
// 			return;
// 		}

// 		if (document.querySelector('. swal2-container')) {
// 			return;
// 		}

// 		Swal.fire({
// 			title: "Λήξη Συνεδρίας",
// 			text: "Η συνεδρία σας έχει λήξει λόγω αδράνειας. Συνδεθείτε ξανά για να συνεχίσετε.. .",
// 			icon: "error",
// 			timer: 4000,
// 			timerProgressBar: true,
// 			showConfirmButton: false,
// 			allowOutsideClick: false,
// 			customClass: {
// 				title: 'custom-title',
// 				popup: "custom-swal-popup",
// 			},
// 			willClose: () => {
// 				window.location.href = "/logout/end_Session? method=idle";
// 			},
// 		});
// 	}

// 	// ═══════════════════════════════════════════════════
// 	// Event: Grace Period Expired (Anonymous users)
// 	// ═══════════════════════════════════════════════════
// 	function onGracePeriodExpired(event) {
// 		if (document.querySelector('.swal2-container')) {
// 			return;
// 		}
		
// 		Swal.fire({
// 			title: "Λήξη Συνεδρίας",
// 			text: "Η συνεδρία σας έχει λήξει λόγω αδράνειας. Συνδεθείτε ξανά για να συνεχίσετε.. .",
// 			icon: "error",
// 			timer: 4000,
// 			timerProgressBar: true,
// 			showConfirmButton: false,
// 			allowOutsideClick: false,
// 			customClass: {
// 				title: 'custom-title',
// 				popup: "custom-swal-popup",
// 			},
// 			willClose: () => {
// 				window.location.href = "/logout/end_Session? method=idle";
// 			},
// 		});
// 	}

// 	// ═══════════════════════════════════════════════════
// 	// Event Listeners
// 	// ═══════════════════════════════════════════════════
// 	document.addEventListener("sessionExpired", onSessionExpired);
// 	document.addEventListener("gracePeriodExpired", onGracePeriodExpired);

// 	// ═══════════════════════════════════════════════════
// 	// Initialization
// 	// ═══════════════════════════════════════════════════
// 	hideCountdown();
// 	checkSession();
// 	intervalId = setInterval(checkSession, 1000);

// 	window.addEventListener('beforeunload', () => {
// 		if (intervalId) clearInterval(intervalId);
// 	});
// });


// ═══════════════════════════════════════════════════════════════════════════
// SESSION COUNTDOWN - Global State Management
// ═══════════════════════════════════════════════════════════════════════════

// ✅ Global state
window.CountdownManager = {
    intervalId: null,
    wasAuthenticated: false,
    currentUserType: null,
    consecutiveErrors: 0,
    isRunning: false
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Format time
// ═══════════════════════════════════════════════════════════════════════════
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Update text color
// ═══════════════════════════════════════════════════════════════════════════
function updateTextColor(remainingTime, userType, element) {
    const totalSeconds = Math.ceil(remainingTime / 1000);
    element.classList.remove("rt-white", "rt-orange", "rt-red", "rt-anonymous");

    if (userType === 'anonymous') {
        if (totalSeconds >= 60) {
            element.classList. add("rt-orange");
        } else {
            element.classList.add("rt-red");
        }
    } else {
        if (totalSeconds >= 900) {
            element.classList. add("rt-white");
        } else if (totalSeconds >= 300) {
            element.classList. add("rt-orange");
        } else {
            element.classList.add("rt-red");
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Show/hide countdown
// ═══════════════════════════════════════════════════════════════════════════
function showCountdown(element) {
    element.style.visibility = 'visible';
    element.style.opacity = '1';
}

function hideCountdown(element) {
    element.style.visibility = 'hidden';
    element.style.opacity = '0';
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE: Check session (polls /remaining-time)
// ═══════════════════════════════════════════════════════════════════════════
async function checkSession(element) {
    try {
        const response = await fetch("/remaining-time", {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Cache-Control': 'no-cache',
                'Accept': 'application/json'
            }
        });

        window.CountdownManager.consecutiveErrors = 0;

        // Grace period expired (401)
        if (response.status === 401) {
            const data = await response.json();
            
            if (data.userType === 'anonymous' && window.CountdownManager.currentUserType === 'anonymous') {
                console.warn('⚠️ Anonymous grace period expired');
                hideCountdown(element);
                document.dispatchEvent(new CustomEvent("gracePeriodExpired", {
                    detail: { message: data.message }
                }));
                return;
            }
            
            if (window.CountdownManager.wasAuthenticated) {
                console.warn('⚠️ Authenticated session expired');
                hideCountdown(element);
                window.CountdownManager.currentUserType = null;
                window.CountdownManager.wasAuthenticated = false;
                document.dispatchEvent(new Event("sessionExpired"));
                return;
            }
            
            hideCountdown(element);
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.remainingTime > 0) {
            window. CountdownManager.currentUserType = data.userType;
            
            if (data.userType === 'authenticated') {
                window.CountdownManager.wasAuthenticated = true;
            }
            
            showCountdown(element);
            element.textContent = formatTime(data.remainingTime);
            updateTextColor(data.remainingTime, data.userType, element);
        } else {
            element.textContent = "Λήξη! ";
            element.classList.remove("rt-white", "rt-orange");
            element.classList.add("rt-red");
            
            if (window.CountdownManager.currentUserType === 'authenticated' || window.CountdownManager.wasAuthenticated) {
                document.dispatchEvent(new Event("sessionExpired"));
            } else if (window.CountdownManager.currentUserType === 'anonymous') {
                document.dispatchEvent(new Event("gracePeriodExpired"));
            }
        }

    } catch (error) {
        window.CountdownManager.consecutiveErrors++;
        console.error(`❌ Countdown error (${window.CountdownManager.consecutiveErrors}):`, error. message);
        
        if (window.CountdownManager.consecutiveErrors >= 3) {
            console. warn('⚠️ Multiple errors, hiding countdown');
            hideCountdown(element);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ✅ GLOBAL API: Force refresh countdown (called by sessionRefresh. js)
// ═══════════════════════════════════════════════════════════════════════════
window.forceRefreshCountdown = function(newRemainingMs) {
    const element = document.getElementById("remaining-time");
    if (! element) {
        console.warn('⚠️ Countdown element not found');
        return;
    }

    console.log(`🔄 Force refresh countdown → ${formatTime(newRemainingMs)}`);
    
    // ✅ ΚΛΕΙΔΙ: Clear existing interval to prevent override
    if (window.CountdownManager. intervalId) {
        clearInterval(window.CountdownManager.intervalId);
        console.log('⏸️ Interval cleared');
    }
    
    // ✅ Update display immediately
    element.textContent = formatTime(newRemainingMs);
    updateTextColor(newRemainingMs, window.CountdownManager.currentUserType || 'authenticated', element);
    showCountdown(element);
    
    // ✅ Reset consecutive errors
    window.CountdownManager. consecutiveErrors = 0;
    
    // ✅ ΚΛΕΙΔΙ: Restart interval with fresh state
    window.CountdownManager. intervalId = setInterval(() => {
        checkSession(element);
    }, 1000);
    
    console.log('▶️ Interval restarted');
};

// ═══════════════════════════════════════════════════════════════════════════
// EVENT: Session expired (Authenticated users)
// ═══════════════════════════════════════════════════════════════════════════
function onSessionExpired() {
    if (! window.CountdownManager.wasAuthenticated) {
        return;
    }

    if (document.querySelector('. swal2-container')) {
        return;
    }

    Swal.fire({
        title: "Λήξη Συνεδρίας",
        text: "Η συνεδρία σας έχει λήξει λόγω αδράνειας. Συνδεθείτε ξανά για να συνεχίσετε.. .",
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
// EVENT: Grace period expired (Anonymous users)
// ═══════════════════════════════════════════════════════════════════════════
function onGracePeriodExpired(event) {
    if (document.querySelector('.swal2-container')) {
        return;
    }
    
    Swal.fire({
        title: "Λήξη Συνεδρίας",
        text: "Η συνεδρία σας έχει λήξει λόγω αδράνειας. Συνδεθείτε ξανά για να συνεχίσετε...",
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
            window.location.href = "/logout/end_Session? method=idle";
        },
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
    const remainingTimeElement = document.getElementById("remaining-time");
    
    if (! remainingTimeElement) {
        console.log('ℹ️ No countdown element in DOM');
        return;
    }

    // Event listeners
    document.addEventListener("sessionExpired", onSessionExpired);
    document.addEventListener("gracePeriodExpired", onGracePeriodExpired);

    // Start countdown
    hideCountdown(remainingTimeElement);
    checkSession(remainingTimeElement);
    
    window.CountdownManager.intervalId = setInterval(() => {
        checkSession(remainingTimeElement);
    }, 1000);
    
    window.CountdownManager.isRunning = true;

    console.log('✅ Countdown initialized');

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.CountdownManager.intervalId) {
            clearInterval(window.CountdownManager.intervalId);
            window.CountdownManager.isRunning = false;
        }
    });
});
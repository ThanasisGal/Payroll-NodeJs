(function () {
    'use strict';

    const INTERVAL_MS = 60 * 1000; // κάθε 1 λεπτό

    function sendHeartbeat(closing) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

        // ✅ sendBeacon για browser close (πιο αξιόπιστο)
        if (closing) {
            const data = JSON.stringify({ closing: true });
            const blob = new Blob([data], { type: 'application/json' });
            navigator.sendBeacon('/api/usage/heartbeat', blob);
            return;
        }

        // ✅ fetch για κανονικό heartbeat
        fetch('/api/usage/heartbeat', {
            method: 'POST',
            credentials: 'same-origin',
            skipLoader: true,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ closing: false })
        }).catch(function () {
            // silent fail -- δεν ενοχλούμε τον χρήστη
        });
    }

    // ✅ Ξεκίνα heartbeat μόνο αν υπάρχει session (userId στο DOM)
    document.addEventListener('DOMContentLoaded', function () {
        sendHeartbeat(false); // αμέσως κατά το load
        setInterval(function () {
            sendHeartbeat(false);
        }, INTERVAL_MS);
    });

    // ✅ Browser/tab close
    window.addEventListener('beforeunload', function () {
        sendHeartbeat(true);
    });
})();

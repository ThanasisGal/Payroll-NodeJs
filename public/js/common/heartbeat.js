(function () {
    'use strict';

    const INTERVAL_MS = 60 * 1000;

    function sendHeartbeat(closing) {
        // ✅ Αν δεν υπάρχει userId, μην στέλνεις
        const userId = document.querySelector('meta[name="user-id"]')?.content || '';
        if (!userId) return;

        // ✅ Αν δεν υπάρχει CSRF token, μην στέλνεις
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
        if (!csrfToken) return;

        if (closing) {
            const data = JSON.stringify({ closing: true });
            const blob = new Blob([data], { type: 'application/json' });
            navigator.sendBeacon('/api/usage/heartbeat', blob);
            return;
        }

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
            // silent fail
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        sendHeartbeat(false);
        setInterval(function () {
            sendHeartbeat(false);
        }, INTERVAL_MS);
    });

    window.addEventListener('beforeunload', function () {
        sendHeartbeat(true);
    });
})();

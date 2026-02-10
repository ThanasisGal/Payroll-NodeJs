/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SESSION ROUTES - Payroll System
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Endpoints:
 * - GET  /remaining-time         → Επιστρέφει υπόλοιπο χρόνο session
 * - POST /api/session/refresh    → Ανανεώνει το session (manual click)
 * - GET  /api/session/status     → Debugging endpoint (optional)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Calculate remaining time
// ═══════════════════════════════════════════════════════════════════════════
function calculateRemainingTime(req) {
    const sessionDurationMinutes = parseInt(process.env.DIARKEIA_SESSION || 60);
    const sessionDurationMs = sessionDurationMinutes * 60 * 1000;
    
    const lastActivity = req.session.lastActivity || Date.now();
    const elapsed = Date.now() - lastActivity;
    const remainingTime = Math.max(0, sessionDurationMs - elapsed);
    
    return {
        remainingTime,
        sessionDurationMs,
        expired: remainingTime <= 0
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Format time for logging
// ═══════════════════════════════════════════════════════════════════════════
function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /remaining-time
// ═══════════════════════════════════════════════════════════════════════════
router.get('/remaining-time', (req, res) => {
    try {
        console.log('[GET /remaining-time] Request received');
        
        if (!req.session) {
            console.log('  ❌ No session object');
            return res.status(401).json({
                userType: 'anonymous',
                remainingTime: 0,  // ← NUMBER (milliseconds)
                message: 'No session'
            });
        }
        
        if (!req.session.userId) {
            console.log('  ⚠️ User not authenticated');
            const gracePeriodMs = 5 * 60 * 1000;
            
            return res.json({
                userType: 'anonymous',
                remainingTime: gracePeriodMs,  // ← NUMBER (milliseconds) - ΣΩΣΤΟ!
                gracePeriod: true,
                message: 'Anonymous user - grace period'
            });
        }
        
        const { remainingTime, expired } = calculateRemainingTime(req);
        
        console.log(`  ✅ User ${req.session.userId} - Remaining: ${formatTime(remainingTime)}`);
        
        if (expired) {
            console.log('  ⏰ Session expired');
            return res.status(401).json({
                userType: 'authenticated',
                remainingTime: 0,  // ← NUMBER (milliseconds)
                expired: true,
                message: 'Session expired'
            });
        }
        
        res.json({
            userType: 'authenticated',
            remainingTime: remainingTime,  // ← NUMBER (milliseconds)
            gracePeriod: false,
            message: 'Session active'
        });
        
    } catch (error) {
        console.error('[GET /remaining-time] Error:', error);
        res.status(500).json({
            userType: 'anonymous',
            remainingTime: 0,  // ← NUMBER (milliseconds)
            error: 'Server error',
            message: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/session/refresh
// ═══════════════════════════════════════════════════════════════════════════
router.post('/api/session/refresh', (req, res) => {
    try {
        console.log('[POST /api/session/refresh] Request received');
        
        // GUARD 1: Έλεγχος Session
        if (!req.session) {
            console.log('  ❌ No session object');
            return res.status(401).json({ 
                success: false, 
                error: 'No session',
                message: 'Session not found'
            });
        }
        
        // GUARD 2: Έλεγχος Authentication
        if (!req.session.userId) {
            console.log('  ❌ User not authenticated');
            return res.status(401).json({ 
                success: false, 
                error: 'Not authenticated',
                message: 'User not logged in'
            });
        }
        
        // Configuration
        const sessionDurationMinutes = parseInt(process.env.DIARKEIA_SESSION || 60);
        const sessionDurationMs = sessionDurationMinutes * 60 * 1000;
        const gracePeriodMs = 5 * 60 * 1000;
        
        // Calculate remaining time
        const { remainingTime, expired } = calculateRemainingTime(req);
        
        console.log(`  User: ${req.session.userId}`);
        console.log(`  Remaining before refresh: ${formatTime(remainingTime)}`);
        
        // GUARD 3: Session Expired
        if (expired) {
            console.log('  ❌ Session already expired');
            return res.status(401).json({
                success: false,
                expired: true,
                remainingTime: 0,
                message: 'Session has expired'
            });
        }
        
        // GUARD 4: Grace Period Check
        if (remainingTime <= gracePeriodMs) {
            console.log('  ⏰ Grace period active - NOT refreshing');
            console.log(`     Only ${formatTime(remainingTime)} left`);
            
            return res.json({
                success: false,
                gracePeriod: true,
                remainingTime: remainingTime,  // ← NUMBER (milliseconds)
                message: 'Cannot refresh during grace period (last 5 minutes)'
            });
        }
        
        // ✅ REFRESH SESSION
        req.session.touch();
        req.session.lastActivity = Date.now();
        
        console.log(`  ✅ Session refreshed successfully`);
        console.log(`     New duration: ${sessionDurationMinutes} minutes`);
        
        res.json({
            success: true,
            refreshed: true,
            remainingTime: sessionDurationMs,  // ← NUMBER (milliseconds)
            previousRemainingTime: remainingTime,
            message: 'Session refreshed successfully'
        });
        
    } catch (error) {
        console.error('[POST /api/session/refresh] Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error',
            message: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/session/status (για debugging)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/api/session/status', (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.json({
                authenticated: false,
                userType: 'anonymous'
            });
        }
        
        const { remainingTime, sessionDurationMs, expired } = calculateRemainingTime(req);
        const gracePeriodMs = 5 * 60 * 1000;
        
        res.json({
            authenticated: true,
            userType: 'authenticated',
            userId: req.session.userId,
            remainingTime: remainingTime,
            remainingFormatted: formatTime(remainingTime),
            sessionDuration: sessionDurationMs,
            gracePeriod: remainingTime <= gracePeriodMs && remainingTime > 0,
            expired: expired,
            lastActivity: req.session.lastActivity ? new Date(req.session.lastActivity).toISOString() : null
        });
        
    } catch (error) {
        console.error('[GET /api/session/status] Error:', error);
        res.status(500).json({
            error: 'Server error',
            message: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════
module.exports = router;
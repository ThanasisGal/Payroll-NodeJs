// ./server/routes/efkaRoutes.js
const express = require('express');
const router = express.Router();
const { getIO } = require('../socket');

const { loadFromApd } = require('../utils/efka/loadFromApd');
const { continueApd } = require('../utils/efka/continueApd');
const { closeSession } = require('../utils/efka/efkaSessionStore');

// 1) Ξεκινά flow και επιστρέφει sessionId
router.post('/efka/apd/open', async (req, res) => {
    try {
        const { headless, keepSession, ttlMs } = req.body || {};

        const result = await loadFromApd({
            headless: typeof headless === 'boolean' ? headless : undefined,
            keepSession: typeof keepSession === 'boolean' ? keepSession : undefined,
            ttlMs: typeof ttlMs === 'number' ? ttlMs : undefined
        });

        if (!result.success) return res.status(500).json(result);
        return res.json(result);
    } catch (e) {
        return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
});

// 2) Συνέχεια flow με sessionId
router.post('/efka/apd/continue', async (req, res) => {
    try {
        const { PasswordsModel, CompaniesModel } = require('../models/companies');
        const io = getIO();

        const { sessionId } = req.body || {};
        if (!sessionId) return res.status(400).json({ success: false, error: 'Missing sessionId' });

        const companyInUse = req.session?.companyInUse;
        if (!companyInUse) {
            return res.status(401).json({ success: false, error: 'Missing session companyInUse' });
        }

        // ✅ userId (ΠΡΕΠΕΙ να ταιριάζει με locals.userId στο EJS)
        const userId = req.session?.user?._id?.toString() || req.session?.userId?.toString();
        const roomName = userId ? `user_${userId}` : null;

        const company = await CompaniesModel.findOne({ _id: companyInUse }).lean();
        if (!company) return res.status(404).json({ success: false, error: 'Company not found' });

        const ame = company.ame1;
        if (!ame) return res.status(500).json({ success: false, error: 'Company missing ame1' });

        const rec = await PasswordsModel.findOne({
            companykod_object: companyInUse,
            kodikos: '0001'
        }).lean();

        if (!rec) {
            return res
                .status(404)
                .json({ success: false, error: 'Taxisnet credentials not found (kodikos=0001)' });
        }

        const username = rec.username || rec.user || rec.value1;
        const password = rec.password || rec.pass || rec.value2;

        if (!username || !password) {
            return res
                .status(500)
                .json({
                    success: false,
                    error: 'Credentials record missing username/password fields'
                });
        }

        // helper: safe emit (room + fallback broadcast)
        const emitProgressSafe = (event, payload) => {
            if (roomName) io.to(roomName).emit(event, payload);
            else io.emit(event, payload);

            // ✅ fallback πάντα (για να μην “χάνονται” τα steps όταν δεν έγινε join σωστά)
            // Αν θέλεις μετά να το αφαιρέσουμε, το αφαιρούμε όταν σταθεροποιηθεί το userId join.
            io.emit(event, payload);
        };

        const result = await continueApd(sessionId, {
            username,
            password,
            ame,
            amka: req.body.amka,
            closeAfter: true,

            onProgress: ({ percent, message, step, totalSteps }) => {
                const payload = { percent, message, step, totalSteps };
                emitProgressSafe('efka:progress', payload);
                console.log('EFKA PROGRESS:', { ...payload, roomName });
            }
        });

        if (result?.success) emitProgressSafe('efka:done', { message: 'Ολοκληρώθηκε' });
        else emitProgressSafe('efka:error', { message: result?.error || 'Σφάλμα ΕΦΚΑ' });

        return res.status(result.success ? 200 : 400).json(result);
    } catch (e) {
        return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
});

// 3) Κλείσε session (cleanup)
router.post('/efka/apd/close', async (req, res) => {
    try {
        const { sessionId } = req.body || {};
        if (!sessionId) return res.status(400).json({ success: false, error: 'Missing sessionId' });

        const ok = await closeSession(sessionId);
        return res.json({ success: true, closed: ok });
    } catch (e) {
        return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
});

module.exports = router;

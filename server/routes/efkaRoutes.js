// ./server/routes/efkaRoutes.js
const express = require('express');
const router = express.Router();

const { loadFromApd } = require('../utils/efka/loadFromApd');
const { continueApd } = require('../utils/efka/continueApd');
const { closeSession } = require('../utils/efka/efkaSessionStore');

// 1) Ξεκινά flow και επιστρέφει sessionId
router.post('/efka/apd/open', async (req, res) => {
  try {
    // προαιρετικά allow overrides από body (μόνο αν θες)
    const { headless, keepSession, ttlMs } = req.body || {};

    const result = await loadFromApd({
      headless: typeof headless === 'boolean' ? headless : undefined,
      keepSession: typeof keepSession === 'boolean' ? keepSession : undefined,
      ttlMs: typeof ttlMs === 'number' ? ttlMs : undefined,
    });

    if (!result.success) return res.status(500).json(result);
    return res.json(result);

  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

// 2) Συνέχεια flow με sessionId (το υλοποιούμε στο Βήμα 5)
router.post('/efka/apd/continue', async (req, res) => {
    try {
        const { PasswordsModel, CompaniesModel } = require("../models/companies");

        const { sessionId } = req.body || {};
        if (!sessionId) return res.status(400).json({ success: false, error: 'Missing sessionId' });

        // 1) Πάρε εταιρία από session
        const companyInUse = req.session?.companyInUse;
        if (!companyInUse) {
            return res.status(401).json({ success: false, error: 'Missing session companyInUse' });
        }

        const company = await CompaniesModel.findOne({ _id: companyInUse }).lean(); 

        if (!company) {
            return res.status(404).json({ success: false, error: 'Company not found' });
        }

        const ame = company.ame1;
        if (!ame) {
            return res.status(500).json({ success: false, error: 'Company missing ame1' });
        }

        // 2) Διάβασε taxisnet credentials από PasswordsModel
        const rec = await PasswordsModel.findOne({
            companykod_object: companyInUse,
            kodikos: "0001"
        }).lean();

        if (!rec) {
            return res.status(404).json({ success: false, error: 'Taxisnet credentials not found (kodikos=0001)' });
        }

        // ⚠️ Προσαρμόζεις αυτά τα πεδία στα πραγματικά ονόματα που έχεις στον πίνακα
        const username = rec.username || rec.user || rec.value1;
        const password = rec.password || rec.pass || rec.value2;

        if (!username || !password) {
            return res.status(500).json({ success: false, error: 'Credentials record missing username/password fields' });
        }

        

        // 3) Συνέχεια στο ίδιο tab και κάνε login
        const result = await continueApd(sessionId, {
            // closeAfter: !!closeAfter,
            username,
            password,
            ame,
            amka: req.body.amka,
            closeAfter: true
        });

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
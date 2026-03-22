'use strict';

console.log('✅ [efkaTekaRoute] Route loaded successfully');

const express = require('express');
const router = express.Router();
const { PasswordsModel } = require('../models/companies');
const { checkTekaFromEfka } = require('../utils/efka/checkTekaFromEfka');

router.use((req, res, next) => {
    console.log(`[efkaTekaRoute] ${req.method} ${req.path} — received`);
    next();
});

router.post('/check', async (req, res) => {
    console.log('[efkaTekaRoute] POST /check — executing');
    try {
        const amka = String(req.body?.amka || '').replace(/\D+/g, '');
        if (!amka) return res.status(400).json({ success: false, error: 'Missing AMKA' });

        const team = req.session?.userTeam;
        const company_object = req.session?.companyInUse;

        console.log('[TEKA-ROUTE] Session:', { team, company_object });

        if (!team || !company_object) {
            return res.status(401).json({ success: false, error: 'Missing session data' });
        }

        // ✅ ΔΙΟΡΘΩΣΗ: companykod_object αντί company_object
        const pwdDoc = await PasswordsModel.findOne({
            team,
            companykod_object: company_object, // ✅ ΣΩΣΤΟ field name
            kodikos: '0002'
        }).lean();

        console.log('[TEKA-ROUTE] Found doc:', pwdDoc);

        if (!pwdDoc) {
            return res.status(404).json({
                success: false,
                error: `Δεν βρέθηκαν credentials για team=${team}, companykod_object=${company_object}, kodikos=0002`
            });
        }

        const result = await checkTekaFromEfka({
            username: pwdDoc.username,
            password: pwdDoc.password,
            amka
        });

        return res.json(result);
    } catch (e) {
        console.error('[TEKA-ROUTE] Error:', e);
        return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
});

module.exports = router;

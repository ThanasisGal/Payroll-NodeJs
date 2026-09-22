'use strict';

const { listActiveManagedUsers, forceLogoutUser } = require('../services/adminForceLogoutService');
const { emitToUser } = require('../socket');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

exports.renderPage = async (req, res) => {
    try {
        const users = await listActiveManagedUsers({
            store: req.sessionStore, actor: req.adminActor
        });
        return res.render('admin/disconnectUsers', {
            title: 'Αποσύνδεση Χρηστών', description: 'Αναγκαστική αποσύνδεση ενεργού χρήστη', users
        });
    } catch (error) {
        logger.error('Admin disconnect users list failed');
        return res.status(503).send('Δεν ήταν δυνατή η φόρτωση των ενεργών χρηστών.');
    }
};

exports.disconnectUser = async (req, res) => {
    try {
        const result = await forceLogoutUser({
            store: req.sessionStore,
            actor: req.adminActor,
            targetId: req.body?.userId,
            emit: emitToUser,
            log: logger
        });
        return res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Admin force logout failed', {
            actorId: String(req.session.userId),
            targetId: mongoose.isValidObjectId(req.body?.userId) ? String(req.body.userId) : 'invalid'
        });
        return res.status(error.status || 503).json({ success: false,
            message: error.status ? error.message : 'Η αποσύνδεση δεν ολοκληρώθηκε. Δοκιμάστε ξανά.' });
    }
};

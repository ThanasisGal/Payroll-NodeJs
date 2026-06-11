const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types; // ✅ Import ObjectId
const logger = require('../../server/utils/logger');
const { sessionOpts } = require('../../config/sessionOpts');

const UserModel = require('../models/userModel');
const VerifyModel = require('../models/verifications');
const Models = require('../models/stathera_arxeia');
const Models_A = require('../models/param');
const Models_B = require('../models/privileges');
const Models_C = require('../models/companies');

const UsageLogModel = require('../models/usageLog');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const jwtDecode = require('jwt-decode').jwtDecode;
const transporter = require('../../config/emailConfig');
const { getDetailedGreeting } = require('../utils/emailHelpers');

const { PeriodsModel } = Models;
const { ParamModel } = Models_A;
const { UserPrivilegesModel, SidebarStatusModel } = Models_B;
const { CompaniesModel } = Models_C;

const APP_ORIGIN =
    process.env.NODE_ENV === 'production'
        ? process.env.APP_ORIGIN_PRODUCTION
        : process.env.APP_ORIGIN_DEVELOPMENT;

// Defaults για το session
const now = new Date();
const day = String(now.getDate()).padStart(2, '0');
const month = String(now.getMonth() + 1).padStart(2, '0');
const year = now.getFullYear();

const monthNames = [
    'ΙΑΝΟΥΑΡΙΟΣ',
    'ΦΕΒΡΟΥΑΡΙΟΣ',
    'ΜΑΡΤΙΟΣ',
    'ΑΠΡΙΛΙΟΣ',
    'ΜΑΙΟΣ',
    'ΙΟΥΝΙΟΣ',
    'ΙΟΥΛΙΟΣ',
    'ΑΥΓΟΥΣΤΟΣ',
    'ΣΕΠΤΕΜΒΡΙΟΣ',
    'ΟΚΤΩΒΡΙΟΣ',
    'ΝΟΕΜΒΡΙΟΣ',
    'ΔΕΚΕΜΒΡΙΟΣ'
];

const greeting = getDetailedGreeting();

const isProd = process.env.NODE_ENV === 'production';

// ═══════════════════════════════════════════════════════════
// PASSWORD VALIDATION HELPER
// ═══════════════════════════════════════════════════════════

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} { valid: boolean, error: string|null }
 */
const validatePasswordStrength = (password) => {
    if (!password) {
        return { valid: false, error: 'Ο κωδικός είναι υποχρεωτικός' };
    }

    if (password.length < 8) {
        return { valid: false, error: 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες' };
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
    if (!passwordRegex.test(password)) {
        return {
            valid: false,
            error: 'Ο κωδικός πρέπει να περιέχει τουλάχιστον:  1 κεφαλαίο και 1 πεζό (Λατινικό Χαρακτήρα), 1 αριθμό και 1 ειδικό χαρακτήρα (@$!%*?&)'
        };
    }

    return { valid: true, error: null };
};

let sTerm = '';
var redir, tmpEmail;

// Helper: συγχρονίζει συλλογή με βάση πρότυπο
async function syncFromTemplate({
    Model,
    userIdStr, // π.χ.String(user._id)
    templateId, // π.χ.process.env.PROTYPO_ID
    uniqueKey, // π.χ.'form' για UserPrivileges, 'li_Id' για SidebarStatus
    projection = { _id: 0, userId: 0 } // να μη φέρνουμε _id/userId από το πρότυπο
}) {
    if (!templateId) return;

    // Φέρε υπάρχουσες του χρήστη & τις πρότυπες σε μία «βολή»
    const [existing, template] = await Promise.all([
        Model.find({ userId: userIdStr }, projection).lean(),
        Model.find({ userId: templateId }, projection).lean()
    ]);

    if (!template?.length) return; // δεν υπάρχουν καθόλου πρότυπα, άρα skip

    // Αν ο χρήστης δεν έχει τίποτα -> κλωνοποίησε τα πάντα
    if (!existing.length) {
        const clones = template.map((doc) => ({ ...doc, userId: userIdStr }));
        if (clones.length) await Model.insertMany(clones, { ordered: false });
        return;
    }

    // Αλλιώς, βρες ποια λείπουν με βάση το μοναδικό κλειδί (uniqueKey)
    const have = new Set(existing.map((d) => String(d[uniqueKey])));
    const missing = template
        .filter((t) => !have.has(String(t[uniqueKey])))
        .map((doc) => ({ ...doc, userId: userIdStr }));

    if (missing.length) {
        await Model.insertMany(missing, { ordered: false });
    }
}

class userController {
    static homepage = async (req, res) => {
        res.render('home', {
            title: 'Payroll',
            description: 'Web Payroll Solutions'
        });
    };

    static adminHomepage = async (req, res) => {
        const perPage = Number(process.env.EGGRAFES);
        let page = req.query.page || 1;

        try {
            const totalRecords = await UserModel.countDocuments({});
            let totalPages = perPage > totalRecords ? 1 : Math.ceil(totalRecords / perPage);
            let limPerPage = perPage > totalRecords ? totalRecords : perPage;
            let limitPerPage = limPerPage <= 0 ? 1 : limPerPage;
            let skipRecords = totalPages == 1 ? 0 : perPage * page - perPage;

            const users = await UserModel.aggregate([{ $sort: { createdAt: -1 } }])
                .skip(skipRecords)
                .limit(limitPerPage)
                .exec();

            res.render('index', {
                title: 'Admin Διαχείριση Χρηστών', // ✅ Απευθείας
                description: 'Web Payroll Solutions by Admin', // ✅ Απευθείας
                users,
                current: page,
                pages: totalPages
            });
        } catch (error) {
            logger.error(error);
        }
    };

    static addUser = (req, res) => {
        res.render('users/add', {
            title: 'Προσθήκη Νέου Χρήστη',
            description: 'Web Payroll Solutions by Admin'
        });
    };

    static postUser = async (req, res) => {
        let aa_kod = 1;
        try {
            const lastRecord = await UserModel.findOne({}, { kod: 1 }).sort({ kod: -1 }).lean();
            if (lastRecord && lastRecord.kod) {
                aa_kod = Number(lastRecord.kod) + 1;
            }
        } catch (error) {
            console.error('Error getting last kod:', error);
            aa_kod = 1;
        }

        const isAdmin = req.body.radioRoles === 'A' ? true : false;

        const newUser = UserModel({
            kod: aa_kod,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            password: req.body.password,
            tel: req.body.tel,
            team: req.body.team,
            privileges: req.body.radioRoles,
            situation: req.body.radioStatus,
            details: req.body.details,
            isVerified: false,
            isAdmin: isAdmin,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        try {
            await UserModel.create(newUser);
            await res.flash('success', 'Έχει προστεθεί νέος χρήστης');
            redir = 'index';

            await res.render(redir);
        } catch (error) {
            throw error;
        }
    };

    static viewUser = async (req, res) => {
        try {
            const users = await UserModel.findOne({ _id: req.params.id });

            res.render('users/view', {
                title: 'Προβολή Στοιχείων Χρήστη',
                description: 'Web Payroll Solutions by Admin',
                users
            });
        } catch (error) {
            logger.error(error);
        }
    };

    static editUser = async (req, res) => {
        try {
            const users = await UserModel.findOne({ _id: req.params.id });

            res.render('users/edit', {
                title: 'Διόρθωση Στοιχείων Χρήστη',
                description: 'Web Payroll Solutions by Admin',
                users
            });
        } catch (error) {
            logger.error(error);
        }
    };

    static editPostUser = async (req, res) => {
        try {
            await UserModel.findByIdAndUpdate(req.params.id, {
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                email: req.body.email,
                password: req.body.password,
                tel: req.body.tel,
                team: req.body.team,
                privileges: req.body.radioRoles,
                situation: req.body.radioStatus,
                details: req.body.details,
                updatedAt: Date.now()
            });
            await res.flash('info', 'Επιτυχής Ενημέρωση');
            await res.redirect(`/admin`);
        } catch (error) {
            logger.error(error);
        }
    };

    static deletePostUser = async (req, res) => {
        try {
            await res.flash('info', 'Επιτυχής Διαγραφή');
            await UserModel.deleteOne({ _id: req.params.id });
            res.redirect('/admin');
        } catch (error) {
            logger.error(error);
        }
    };

    static checkAndDeletePostUser = async (req, res) => {
        try {
            const users = await UserModel.findOne({ _id: req.params.id });

            res.render('users/delete', {
                title: 'Διαγραφή Χρήστη',
                description: 'Web Payroll Solutions by Admin',
                users
            });
        } catch (error) {
            logger.error(error);
        }
    };

    static searchPostUser = async (req, res) => {
        try {
            let searchTerm = req.body.searchTerm;
            const searchNoSpecialChar = searchTerm.replace(/[^a-zα-ωA-ZΑ-Ω0-9]/g, '');
            sTerm = searchNoSpecialChar;
            const perPage = Number(process.env.EGGRAFES);
            const page = req.query.page || 1;

            const users = await UserModel.find({
                $or: [
                    { kod: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
                    { firstName: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
                    { lastName: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
                    { email: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
                    { tel: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
                    { team: { $regex: new RegExp(searchNoSpecialChar, 'i') } }
                ]
            });

            const totalRecords = users.length;
            let totalPages = perPage > totalRecords ? 1 : Math.ceil(totalRecords / perPage);
            let limitPerPage = perPage > totalRecords ? totalRecords : perPage;
            let skipRecords = totalPages == 1 ? 0 : perPage * page - perPage;

            const user = await UserModel.find({
                $or: [
                    { kod: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
                    { firstName: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
                    { lastName: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
                    { email: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
                    { tel: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
                    { team: { $regex: new RegExp(searchNoSpecialChar, 'i') } }
                ]
            })
                .skip(skipRecords)
                .limit(limitPerPage);

            res.render('search', {
                title: 'Αναζήτηση',
                description: 'Web Payroll Solutions',
                user,
                current: page,
                pages: totalPages
            });
        } catch (error) {
            logger.error(error);
        }
    };

    static searchGetUser = async (req, res) => {
        try {
            let searchTerm = sTerm;
            const perPage = Number(process.env.EGGRAFES);
            const page = req.query.page || 1;

            const users = await UserModel.find({
                $or: [
                    { firstName: { $regex: new RegExp(searchTerm, 'i') } },
                    { lastName: { $regex: new RegExp(searchTerm, 'i') } },
                    { email: { $regex: new RegExp(searchTerm, 'i') } },
                    { tel: { $regex: new RegExp(searchTerm, 'i') } },
                    { team: { $regex: new RegExp(searchTerm, 'i') } }
                ]
            });

            const totalRecords = users.length;
            let totalPages = perPage > totalRecords ? 1 : Math.ceil(totalRecords / perPage);
            let limitPerPage = perPage > totalRecords ? totalRecords : perPage;
            let skipRecords = totalPages == 1 ? 0 : perPage * page - perPage;

            const user = await UserModel.find({
                $or: [
                    { firstName: { $regex: new RegExp(searchTerm, 'i') } },
                    { lastName: { $regex: new RegExp(searchTerm, 'i') } },
                    { email: { $regex: new RegExp(searchTerm, 'i') } },
                    { tel: { $regex: new RegExp(searchTerm, 'i') } },
                    { team: { $regex: new RegExp(searchTerm, 'i') } }
                ]
            })
                .skip(skipRecords)
                .limit(limitPerPage);

            res.render('search', {
                title: 'Αναζήτηση',
                description: 'Web Payroll Solutions',
                user,
                current: page,
                pages: totalPages
            });
        } catch (error) {
            logger.error(error);
        }
    };

    static activeSessionsPage = async (req, res) => {
        try {
            const currentUser = await UserModel.findById(req.session.userId).lean();
            if (!currentUser || !currentUser.isAdmin) {
                return res.status(403).send('Δεν έχετε δικαίωμα πρόσβασης');
            }
            const sessions = await mongoose.connection.db.collection('sessions').find({}).toArray();

            const activeUsers = [];

            for (const s of sessions) {
                try {
                    const data = JSON.parse(s.session);
                    if (!data.userId) continue;

                    const user = await UserModel.findById(data.userId)
                        .select('firstName lastName email tel team privileges')
                        .lean();

                    activeUsers.push({
                        userId: data.userId,
                        firstName: user?.firstName || 'Άγνωστος',
                        lastName: user?.lastName || '',
                        email: user?.email || '',
                        tel: user?.tel || '',
                        team: user?.team || data.userTeam || '',
                        privileges: user?.privileges || '',
                        companyInUse: data.companyInUse || '',
                        companyDescription: data.companyDescription || '',
                        periodInUseDescr: data.periodInUseDescr || '',
                        yearInUse: data.yearInUse || '',
                        expires: s.expires
                    });
                } catch (e) {
                    // skip invalid session
                }
            }

            res.render('admin/activeSessions', {
                title: 'Ενεργοί Χρήστες',
                description: 'Web Payroll Solutions',
                activeUsers,
                currentUserId: String(req.session.userId)
            });
        } catch (error) {
            logger.error(error);
            res.status(500).send('Σφάλμα');
        }
    };

    static sendMessageToUser = async (req, res) => {
        try {
            const currentUser = await UserModel.findById(req.session.userId).lean();
            if (!currentUser || !currentUser.isAdmin) {
                return res.status(403).json({ success: false, message: 'Unauthorized' });
            }

            const { toUserId, message } = req.body;

            if (!toUserId || !message?.trim()) {
                return res.status(400).json({ success: false, message: 'Missing data' });
            }

            // ✅ Στείλε το μήνυμα μέσω Socket.io
            const { getIO } = require('../socket');
            const io = getIO();
            const roomName = `user_${String(toUserId)}`;

            io.to(roomName).emit('admin:message', {
                from: `${currentUser.firstName} ${currentUser.lastName}`,
                fromUserId: String(req.session.userId), // ✅ Προσθήκη
                message: message.trim(),
                sentAt: new Date().toISOString()
            });

            return res.json({ success: true });
        } catch (error) {
            logger.error(error);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    };

    static heartbeat = async (req, res) => {
        try {
            const userId = req.session?.userId;
            if (!userId) return res.status(401).json({ ok: false });

            const now = new Date();
            const closing = req.body?.closing === true;

            const log = await UsageLogModel.findOne({
                userId,
                logoutAt: null
            }).sort({ loginAt: -1 });

            if (log) {
                if (closing) {
                    // ✅ Κλείσιμο browser
                    const durationMs = now - log.loginAt;
                    await UsageLogModel.findByIdAndUpdate(log._id, {
                        logoutAt: now,
                        durationMs,
                        lastSeen: now,
                        closedBy: 'browser_close'
                    });
                } else {
                    // ✅ Απλό heartbeat -- ενημέρωσε μόνο lastSeen
                    await UsageLogModel.findByIdAndUpdate(log._id, {
                        lastSeen: now
                    });
                }
            }

            return res.json({ ok: true });
        } catch (error) {
            logger.error('❌ Heartbeat error:', error);
            return res.status(500).json({ ok: false });
        }
    };

    static usageReportPage = async (req, res) => {
        try {
            const currentUser = await UserModel.findById(req.session.userId).lean();
            if (!currentUser || !currentUser.isAdmin) {
                return res.status(403).send('Δεν έχετε δικαίωμα πρόσβασης');
            }

            const greekMonths = [
                'ΙΑΝΟΥΑΡΙΟΣ',
                'ΦΕΒΡΟΥΑΡΙΟΣ',
                'ΜΑΡΤΙΟΣ',
                'ΑΠΡΙΛΙΟΣ',
                'ΜΑΪΟΣ',
                'ΙΟΥΝΙΟΣ',
                'ΙΟΥΛΙΟΣ',
                'ΑΥΓΟΥΣΤΟΣ',
                'ΣΕΠΤΕΜΒΡΙΟΣ',
                'ΟΚΤΩΒΡΙΟΣ',
                'ΝΟΕΜΒΡΙΟΣ',
                'ΔΕΚΕΜΒΡΙΟΣ'
            ];

            const month = req.query.month || new Date().toISOString().slice(0, 7);
            const [year, monthIndex] = month.split('-');
            const yearNumber = parseInt(year, 10);
            const monthNumber = parseInt(monthIndex, 10);
            const monthLabel = `${greekMonths[monthNumber - 1]} ${year}`;
            const athensTimezone = 'Europe/Athens';

            const logs = await UsageLogModel.aggregate([
                { $match: { date: month } },
                {
                    $group: {
                        _id: { userId: '$userId', team: '$team' },
                        totalMs: { $sum: '$durationMs' },
                        sessionCount: { $sum: 1 },
                        firstLogin: { $min: '$loginAt' },
                        lastLogin: { $max: '$loginAt' }
                    }
                },
                { $sort: { '_id.team': 1 } }
            ]);

            const [dailyRaw, hourlyRaw, weekdayRaw, dailyUserRaw] = await Promise.all([
                UsageLogModel.aggregate([
                    { $match: { date: month } },
                    {
                        $group: {
                            _id: {
                                day: {
                                    $dateToString: {
                                        format: '%Y-%m-%d',
                                        date: '$loginAt',
                                        timezone: athensTimezone
                                    }
                                }
                            },
                            sessions: { $sum: 1 },
                            totalMs: { $sum: '$durationMs' }
                        }
                    },
                    { $sort: { '_id.day': 1 } }
                ]),
                UsageLogModel.aggregate([
                    { $match: { date: month } },
                    {
                        $group: {
                            _id: {
                                hour: {
                                    $hour: {
                                        date: '$loginAt',
                                        timezone: athensTimezone
                                    }
                                }
                            },
                            sessions: { $sum: 1 },
                            totalMs: { $sum: '$durationMs' }
                        }
                    },
                    { $sort: { '_id.hour': 1 } }
                ]),
                UsageLogModel.aggregate([
                    { $match: { date: month } },
                    {
                        $group: {
                            _id: {
                                weekday: {
                                    $dayOfWeek: {
                                        date: '$loginAt',
                                        timezone: athensTimezone
                                    }
                                }
                            },
                            sessions: { $sum: 1 },
                            totalMs: { $sum: '$durationMs' }
                        }
                    },
                    { $sort: { '_id.weekday': 1 } }
                ]),
                UsageLogModel.aggregate([
                    { $match: { date: month } },
                    {
                        $group: {
                            _id: {
                                day: {
                                    $dateToString: {
                                        format: '%Y-%m-%d',
                                        date: '$loginAt',
                                        timezone: athensTimezone
                                    }
                                },
                                userId: '$userId',
                                team: '$team'
                            },
                            sessions: { $sum: 1 },
                            totalMs: { $sum: '$durationMs' }
                        }
                    },
                    { $sort: { '_id.day': 1, sessions: -1 } }
                ])
            ]);

            const enriched = await Promise.all(
                logs.map(async (l) => {
                    const user = await UserModel.findById(l._id.userId)
                        .select('firstName lastName')
                        .lean();

                    const totalMinutes = Math.round(l.totalMs / 60000);
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;

                    return {
                        userId: String(l._id.userId),
                        team: l._id.team,
                        firstName: user?.firstName || '—',
                        lastName: user?.lastName || '—',
                        totalMs: l.totalMs,
                        totalHours: `${hours}ω ${minutes}λ`,
                        sessionCount: l.sessionCount,
                        firstLogin: l.firstLogin,
                        lastLogin: l.lastLogin
                    };
                })
            );

            const byTeam = enriched.reduce((acc, u) => {
                if (!acc[u.team]) acc[u.team] = [];
                acc[u.team].push(u);
                return acc;
            }, {});

            const daysInMonth = new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate();
            const dailyMap = new Map(
                dailyRaw.map((d) => [
                    d._id.day,
                    {
                        sessions: Number(d.sessions || 0),
                        totalMs: Number(d.totalMs || 0)
                    }
                ])
            );

            const dailyUsage = Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const isoDay = `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const data = dailyMap.get(isoDay) || { sessions: 0, totalMs: 0 };
                return {
                    day: isoDay,
                    label: `${String(day).padStart(2, '0')}/${String(monthNumber).padStart(2, '0')}`,
                    sessions: data.sessions,
                    totalMs: data.totalMs
                };
            });

            const hourlyMap = new Map(
                hourlyRaw.map((h) => [
                    Number(h._id.hour),
                    {
                        sessions: Number(h.sessions || 0),
                        totalMs: Number(h.totalMs || 0)
                    }
                ])
            );

            const hourlyUsage = Array.from({ length: 24 }, (_, hour) => {
                const data = hourlyMap.get(hour) || { sessions: 0, totalMs: 0 };
                return {
                    hour,
                    label: `${String(hour).padStart(2, '0')}:00`,
                    sessions: data.sessions,
                    totalMs: data.totalMs
                };
            });

            const weekdayLabels = {
                1: 'Κυριακή',
                2: 'Δευτέρα',
                3: 'Τρίτη',
                4: 'Τετάρτη',
                5: 'Πέμπτη',
                6: 'Παρασκευή',
                7: 'Σάββατο'
            };
            const weekdayOrder = [2, 3, 4, 5, 6, 7, 1];
            const weekdayMap = new Map(
                weekdayRaw.map((w) => [
                    Number(w._id.weekday),
                    {
                        sessions: Number(w.sessions || 0),
                        totalMs: Number(w.totalMs || 0)
                    }
                ])
            );
            const weekdayUsage = weekdayOrder.map((weekday) => {
                const data = weekdayMap.get(weekday) || { sessions: 0, totalMs: 0 };
                return {
                    weekday,
                    label: weekdayLabels[weekday],
                    sessions: data.sessions,
                    totalMs: data.totalMs
                };
            });

            const dailyUserIds = [
                ...new Set(dailyUserRaw.map((d) => String(d._id.userId)).filter(Boolean))
            ];

            const dailyUsers = dailyUserIds.length
                ? await UserModel.find({
                      _id: mongoose.trusted({ $in: dailyUserIds })
                  })
                      .select('firstName lastName')
                      .lean()
                : [];

            const dailyUserNameMap = new Map(
                dailyUsers.map((user) => [
                    String(user._id),
                    `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—'
                ])
            );

            const dailyUserBreakdown = dailyUserRaw.reduce((acc, row) => {
                const day = row._id.day;
                const userId = String(row._id.userId || '');
                if (!day) return acc;
                if (!acc[day]) acc[day] = [];

                acc[day].push({
                    day,
                    userId,
                    team: row._id.team || '',
                    name: dailyUserNameMap.get(userId) || '—',
                    sessions: Number(row.sessions || 0),
                    totalMs: Number(row.totalMs || 0)
                });

                return acc;
            }, {});

            Object.keys(dailyUserBreakdown).forEach((day) => {
                dailyUserBreakdown[day].sort((a, b) => {
                    if (b.sessions !== a.sessions) return b.sessions - a.sessions;
                    return b.totalMs - a.totalMs;
                });
            });

            res.render('admin/usageReport', {
                title: 'Αναφορά Χρήσης',
                description: 'Web Payroll Solutions',
                byTeam,
                usageAnalytics: {
                    dailyUsage,
                    hourlyUsage,
                    weekdayUsage,
                    dailyUserBreakdown
                },
                month,
                monthLabel,
                nonce: res.locals.nonce
            });
        } catch (error) {
            logger.error(error);
            res.status(500).send('Σφάλμα');
        }
    };

    static exportUsageReport = async (req, res) => {
        try {
            const currentUser = await UserModel.findById(req.session.userId).lean();
            if (!currentUser || !currentUser.isAdmin) {
                return res.status(403).send('Δεν έχετε δικαίωμα πρόσβασης');
            }

            const month = req.query.month || new Date().toISOString().slice(0, 7);
            const logs = await UsageLogModel.find({ date: month }).sort({ loginAt: 1 }).lean();

            const rows = [
                'Team,Χρήστης,Ημ/νία Login,Ημ/νία Logout,Διάρκεια (λεπτά),Τρόπος Κλεισίματος'
            ];

            for (const log of logs) {
                const user = await UserModel.findById(log.userId)
                    .select('firstName lastName team')
                    .lean();

                const minutes = log.durationMs ? Math.round(log.durationMs / 60000) : 0;
                const closedBy =
                    {
                        logout: 'Κανονική αποσύνδεση',
                        browser_close: 'Κλείσιμο browser',
                        session_expired: 'Λήξη session',
                        null: 'Ακόμα online'
                    }[log.closedBy] || '—';

                rows.push(
                    [
                        user?.team || '—',
                        `${user?.firstName} ${user?.lastName}`,
                        log.loginAt ? new Date(log.loginAt).toLocaleString('el-GR') : '—',
                        log.logoutAt ? new Date(log.logoutAt).toLocaleString('el-GR') : 'Online',
                        minutes,
                        closedBy
                    ].join(',')
                );
            }

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="usage_${month}.csv"`);
            res.send('\uFEFF' + rows.join('\n')); // BOM για σωστή εμφάνιση στο Excel
        } catch (error) {
            logger.error(error);
            res.status(500).send('Σφάλμα');
        }
    };

    static verifyEmailForm = async (req, res) => {
        try {
            res.render('login/verify_email', {
                title: 'Verify Email',
                description: 'Web Payroll Solutions',
                bodyClass: 'home-bg-cdn'
            });
        } catch (error) {
            res.redirect('/login');
        }
    };

    static sendUserVerifyEmail = async (req, res) => {
        // 1) Βασικός καθαρισμός/έλεγχος εισόδου
        const email = String(req.body?.email || '')
            .trim()
            .toLowerCase();
        const secret = process.env.JWT_SECRET_KEY;
        const base = APP_ORIGIN || `http://localhost:${process.env.PORT || 5000}`;

        if (!email) {
            if (res.flash) await res.flash('error', 'Συμπλήρωσε e-mail.');
            return res.redirect('back');
        }
        if (!secret) {
            console.error('JWT_SECRET_KEY is missing');
            if (res.flash)
                await res.flash('error', 'Πρόβλημα ρύθμισης. Επικοινωνήστε με τον διαχειριστή.');
            return res.redirect('back');
        }

        try {
            const now = new Date();

            // ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ: Αν verify=true αλλά δεν υπάρχει user → reset
            const existingVerify = await VerifyModel.findOne({ email });
            if (existingVerify?.verify === true) {
                const existingUser = await UserModel.findOne({ email }).lean();
                if (!existingUser) {
                    // Επαλήθευσε αλλά δεν ολοκλήρωσε εγγραφή → reset verify
                    await VerifyModel.updateOne(
                        { email },
                        { $set: { verify: false, updatedAt: now } }
                    );
                } else {
                    // Υπάρχει ήδη εγγεγραμμένος χρήστης → μπλοκάρισε
                    if (res.flash)
                        await res.flash('info', 'Το email είναι ήδη εγγεγραμμένο. Συνδεθείτε.');
                    return res.redirect('/login');
                }
            }

            // 2) ΑΤΟΜΙΚΟ UPSERT για να αποφύγουμε race conditions & E11000
            const doc = await VerifyModel.findOneAndUpdate(
                { email },
                {
                    $setOnInsert: { email, verify: false, createdAt: now },
                    $set: { updatedAt: now }
                },
                { new: true, upsert: true }
            );

            // 3) Δημιουργία token (λήξη 5')
            const token = jwt.sign({ userID: doc._id }, secret, { expiresIn: '5m' });

            // (προαιρετικό) Αποθήκευση token για audit/έλεγχο
            await VerifyModel.updateOne(
                { _id: doc._id },
                { $set: { token, updatedAt: new Date() } }
            );

            // 4) Φτιάχνουμε link επαλήθευσης
            const s3 = Buffer.from(email, 'utf8').toString('hex');
            const link = `${base}/verify-Email/?s1=${doc._id}&s2=${token}&s3=${s3}`;

            // 5) Αποστολή email
            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: email,
                subject: 'Επαλήθευση email - Web Payroll Solutions',
                html: `
                <div style="font-family: Arial, sans-serif; line-height:1.6;">
                    <h2>${greeting}, Καλώς ήρθατε στο Web Payroll Solutions</h2>
                    <p></p>
                    <p>Ευχαριστούμε που εγγραφήκατε στην εφαρμογή <strong>Web Payroll Solutions</strong>.</p>
                    <p>Για να ολοκληρώσετε τη διαδικασία, επαληθεύστε το email σας (διάρκεια 5').</p>
                    <p style="margin:20px 0;">
                        <a href="${link}" style="background:#28a745; color:#fff; padding:10px 15px; border-radius:5px; text-decoration:none;">
                            Επαλήθευση Email
                        </a>
                    </p>
                    <p>Αν δεν δημιουργήσατε εσείς λογαριασμό, αγνοήστε αυτό το μήνυμα.</p>
                    <hr style="margin:20px 0;">
                    <p style="font-size:14px; color:#555;">
                        Για υποστήριξη, επικοινωνήστε με την ομάδα μας μέσω email.
                    </p>
                </div>
            `
            });

            if (res.flash) {
                await res.flash(
                    'info',
                    "Στάλθηκε email επαλήθευσης (ισχύει 5'). Ελέγξτε τα εισερχόμενα/ανεπιθύμητα."
                );
            }
            // 6) PRG: redirect για να εμφανιστεί το flash και να μην ξαναγίνει POST με refresh
            return res.redirect('/login/verify-email');
        } catch (err) {
            // Αν παρ' όλα αυτά προκύψει E11000 (σπάνιο με upsert), χειρίσου το ως "υπάρχον"
            if (err && err.code === 11000) {
                try {
                    const existing = await VerifyModel.findOne({ email });
                    if (existing) {
                        const token = jwt.sign({ userID: existing._id }, secret, {
                            expiresIn: '5m'
                        });
                        await VerifyModel.updateOne(
                            { _id: existing._id },
                            { $set: { token, updatedAt: new Date() } }
                        );
                        const s3 = Buffer.from(email, 'utf8').toString('hex');
                        const link = `${base}/verify-Email/?s1=${existing._id}&s2=${token}&s3=${s3}`;

                        await transporter.sendMail({
                            from: process.env.EMAIL_FROM,
                            to: email,
                            subject: 'Επαλήθευση email - Web Payroll Solutions',
                            html: `
                            <h2>${greeting}, Καλώς ήρθατε στο Web Payroll Solutions</h2>
                            <p>Το email υπάρχει ήδη. Σας στείλαμε νέο link επαλήθευσης (ισχύει 5').</p>
                            <p><a href="${link}">Επαλήθευση Email</a></p>
                        `
                        });

                        if (res.flash)
                            await res.flash(
                                'info',
                                "Το e-mail υπάρχει ήδη — στείλαμε νέο link επαλήθευσης (5')."
                            );
                        return res.redirect('/login/verify-email');
                    }
                } catch (e2) {
                    console.error('dup-recover failed:', e2);
                }
            }

            console.error('sendUserVerifyEmail ERROR:', err);
            if (res.flash) await res.flash('error', 'Κάτι πήγε στραβά. Δοκιμάστε ξανά.');
            return res.redirect('back');
        }
    };

    static emailVerification = async (req, res, next) => {
        const paramsEmail = req.query.s3.toString('utf8');
        const link = req.query.s2;

        const decoded = jwtDecode(link);
        var dateNow = new Date();
        var isExpiredToken = decoded.exp < dateNow.getTime() / 1000 ? true : false;

        if (isExpiredToken) {
            const checkSendLink = await VerifyModel.findById(req.query.s1);
            if (checkSendLink) {
                await VerifyModel.deleteOne({ _id: req.query.s1 });
                await res.flash(
                    'error',
                    'Έχει λήξει η περίοδος που μπορούσατε να χρησιμοποιήσετε το link επιβεβαίωσης Email. Προσπαθείστε ξανά...'
                );
                redir = 'login/login';
            } else {
                await res.flash('error', 'Ανύπαρκτο ή λανθασμένο link');
                redir = 'home';
            }
        } else {
            const checkSendLink = await VerifyModel.findById(req.query.s1);
            if (checkSendLink) {
                if (checkSendLink.verify === true) {
                    // ✅ ΝΕΟΣ ΕΛΕΓΧΟΣ: Υπάρχει ήδη εγγεγραμμένος χρήστης;
                    const existingUser = await UserModel.findOne({
                        email: checkSendLink.email
                    }).lean();

                    if (existingUser) {
                        // ✅ Υπάρχει user → πραγματικά έχει εγγραφεί
                        await res.flash(
                            'info',
                            'Έχετε ήδη επαληθεύσει το Email σας και έχετε εγγραφεί. Συνδεθείτε...'
                        );
                        redir = 'login/login';
                    } else {
                        // ✅ ΔΕΝ υπάρχει user → επαλήθευσε αλλά δεν ολοκλήρωσε εγγραφή
                        // Reset το verify ώστε να μπορεί να ξαναστείλει email
                        await VerifyModel.findByIdAndUpdate(checkSendLink._id, {
                            $set: { verify: false }
                        });
                        await res.flash(
                            'warning',
                            'Έχετε επαληθεύσει το email αλλά δεν ολοκληρώσατε την εγγραφή σας. Ζητήστε νέο link επαλήθευσης.'
                        );
                        redir = 'login/verify_email'; // ✅ Πήγαινέ τον να ξαναζητήσει link
                    }
                } else {
                    await VerifyModel.findByIdAndUpdate(checkSendLink._id, {
                        $set: { verify: true }
                    });
                    tmpEmail = checkSendLink.email;
                    await res.flash(
                        'success',
                        'Επιτυχής επαλήθευση του email σας. Προχωρείστε στην καταχώρηση του χρήστη...'
                    );
                    redir = 'login/register';
                }
            } else {
                await res.flash('error', 'Ανύπαρκτο ή λανθασμένο link');
                redir = '/home';
            }
        }

        if (redir == 'login/register') {
            await res.redirect('/register/?mail=' + req.query.s3);
        } else {
            await res.render(redir);
        }
    };

    static loginForm = async (req, res) => {
        try {
            res.render('login/login', {
                title: 'Login',
                description: 'Web Payroll Solutions',
                bodyClass: 'home-bg-cdn'
            });
        } catch (error) {
            res.redirect('/');
        }
    };

    static getUserRoles = async (req, res) => {
        if (!req.session?.userId) {
            return res.status(401).json({ permissions: {} });
        }

        const user_Id = req.session.userId;
        const userPermission = req.session.userRole;
        const permissions = await userController.fetchPermissions(user_Id, userPermission);

        res.json({ permissions }); // Επιστροφή δεδομένων στο frontend
    };

    static async fetchPermissions(user_Id, userPermission) {
        try {
            const lis = await SidebarStatusModel.find(
                { userId: user_Id },
                { li_Id: 1, situation_A: 1, situation_C: 1, situation_U: 1, situation_V: 1 }
            )
                .sort({ li_Id: 1 })
                .lean();

            const isValidRole = ['A', 'C', 'U', 'V'].includes(userPermission);
            if (!Array.isArray(lis)) lis = [];

            if (!isValidRole) {
                return {}; // ή return null, ανάλογα με το πώς το περιμένει ο caller
            }

            const permissions = Object.fromEntries(
                lis.map((li) => [li.li_Id, Boolean(li[`situation_${userPermission}`])])
            );

            return permissions;
        } catch (err) {
            logger.error(err);
            return {};
        }
    }

    static userLogin = async (req, res) => {
        let redir = 'login/login';

        try {
            const { email, password } = req.body || {};

            if (!email || !password) {
                await res.flash('info', 'Όλα τα πεδία είναι υποχρεωτικά...');
                return res.render('login/login', { bodyClass: 'home-bg-cdn' });
            }

            const user = await UserModel.findOne({ email: String(email).trim().toLowerCase() });

            if (!user) {
                await res.flash(
                    'warning',
                    'Δεν είστε εγγεγραμμένος χρήστης. Εγγραφείτε για να συνεχίσετε...'
                );
                return res.render('login/login', { bodyClass: 'home-bg-cdn' });
            }

            if (!user.isVerified) {
                await res.flash(
                    'error',
                    'Δεν έχετε κάνει επαλήθευση του Email σας. Επαληθεύστε το email και συνεχίστε...'
                );
                return res.render('login/login', { bodyClass: 'home-bg-cdn' });
            }

            if (user.situation === 'I') {
                await res.flash(
                    'error',
                    'Είστε απενεργοποιημένος χρήστης. Επικοινωνήστε με τον διαχειριστή...'
                );
                return res.render('login/login', { bodyClass: 'home-bg-cdn' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!(user.email === String(email).trim().toLowerCase() && isMatch)) {
                await res.flash('error', 'Το email ή ο κωδικός πρόσβασης δεν είναι έγκυρα...');
                return res.render('login/login', { bodyClass: 'home-bg-cdn' });
            }

            // JWT
            const token = jwt.sign({ userID: user._id }, process.env.JWT_SECRET_KEY, {
                expiresIn: '10m'
            });

            // ═══════════════════════════════════════════════════════════
            // ✅ Set session data
            // ═══════════════════════════════════════════════════════════
            req.session.userId = user._id;
            req.session.userName = user.firstName;
            req.session.userTeam = user.team;
            req.session.userRole = user.privileges;
            req.session.userStatus = user.situation;
            req.session.companyInUse = '';
            req.session.companyDescription = '';
            req.session.companyKodikos = '';
            req.session.yearInUse = String(year);
            req.session.periodInUse = month;
            req.session.periodInUseDescr = monthNames[now.getMonth()];
            req.session.appDate = `${day}/${month}/${year}`;
            req.session.currentTyposApodoxon = '001';
            req.session.energoi = true;
            req.session.ypokatasthma = '';

            // ✅ ΚΡΙΣΙΜΟ: Set lastActivity για countdown
            req.session.lastActivity = Date.now();

            // ✅ ΚΡΙΣΙΜΟ: Διέγραψε anonymousStartTime (αν υπάρχει)
            delete req.session.anonymousStartTime;

            // Sync from template
            const templateUserId = process.env.PROTYPO_ID;
            const userIdStr = String(user._id);

            await syncFromTemplate({
                Model: UserPrivilegesModel,
                userIdStr,
                templateId: templateUserId,
                uniqueKey: 'form',
                projection: { _id: 0, userId: 0, createdAt: 0, updatedAt: 0 }
            });

            await syncFromTemplate({
                Model: SidebarStatusModel,
                userIdStr,
                templateId: templateUserId,
                uniqueKey: 'li_Id',
                projection: { _id: 0, userId: 0 }
            });

            // Υπολόγισε το sessionExpires από το maxAge του session
            const sessionMaxAge = req.session?.cookie?.maxAge || 1800000; // default 30 λεπτά

            await UsageLogModel.create({
                userId: user._id,
                team: user.team,
                loginAt: new Date(),
                date: new Date().toISOString().slice(0, 7), // 'YYYY-MM'
                sessionExpires: new Date(Date.now() + sessionMaxAge)
            });

            // Load user parameters
            const parameter = await ParamModel.findOne({ usrId: req.session.userId });
            if (parameter) {
                if (parameter.usedYear) req.session.yearInUse = parameter.usedYear;
                if (parameter.usedPeriod) req.session.periodInUse = parameter.usedPeriod;
                if (parameter.usedPeriodDescr)
                    req.session.periodInUseDescr = parameter.usedPeriodDescr;
                if (parameter.appDate) req.session.appDate = parameter.appDate;

                if (parameter.companyId && parameter.companyId.length > 0) {
                    const companies = await CompaniesModel.findById(parameter.companyId);
                    if (companies) {
                        req.session.companyInUse = parameter.companyId;
                        req.session.companyDescription =
                            `${companies.eponymia} ${companies.firstname}`.trim();
                        req.session.companyKodikos = companies.kod;
                    }
                    redir = '/mainapp';
                } else {
                    redir = '/companies/genikastoixeia';
                }

                if (parameter.usedPeriod && parameter.usedYear) {
                    const periodoi = await PeriodsModel.findOne({
                        xrhsh: parameter.usedYear,
                        kodikos: parameter.usedPeriod
                    });
                    if (periodoi) req.session.periodInUseDescr = periodoi.perigrafh;
                }
            } else {
                redir = '/companies/genikastoixeia';
            }
        } catch (error) {
            console.error('❌ Login error:', error);
            await res.flash('error', 'Αδυναμία Σύνδεσης. Επικοινωνήστε με τον Διαχειριστή');
            redir = 'login/login';
        }

        // ✅ Save session before redirect
        if (redir === '/mainapp' || redir === '/companies/genikastoixeia') {
            req.session.save((err) => {
                if (err) {
                    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.error('❌ SESSION SAVE ERROR');
                    console.error(err);
                    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    return res.render('login/login', { bodyClass: 'home-bg-cdn' });
                }

                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('✅ SESSION SAVED SUCCESSFULLY');
                console.log('   Session ID:', req.sessionID);
                console.log('   User ID:', req.session.userId);
                console.log('   Last Activity:', new Date(req.session.lastActivity).toISOString());
                console.log('   Redirecting to:', redir);

                return res.redirect(redir);
            });
        } else {
            return res.render(redir, { bodyClass: 'home-bg-cdn' });
        }
    };

    static registerForm = async (req, res) => {
        try {
            res.render('login/register', {
                title: 'Register',
                description: 'Web Payroll Solutions'
            });
        } catch (error) {
            res.redirect('/login');
        }
    };

    static userRegistration = async (req, res) => {
        let aa_kod = 0;
        let redir = 'login/login';

        try {
            const lastUser = await UserModel.findOne({}, { kod: 1 }).sort({ kod: -1 }).lean();
            aa_kod = lastUser?.kod ? Number(lastUser.kod) + 1 : 1;
        } catch (err) {
            aa_kod = 1;
        }

        const {
            firstName,
            lastName,
            email,
            tel,
            team,
            password,
            password_confirmation,
            privileges,
            situation,
            details,
            isVerified,
            isAdmin
        } = req.body;

        try {
            const existing = await UserModel.findOne({ email: email });
            if (existing) {
                return res.status(400).render('login/register', {
                    title: 'Register',
                    description: 'Web Payroll Solutions',
                    error: 'Το Email είναι ήδη καταχωρημένο.'
                });
            }

            // ✅ 1. Required fields validation
            if (!(firstName && lastName && email && team && password && password_confirmation)) {
                return res.status(400).render('login/register', {
                    title: 'Register',
                    description: 'Web Payroll Solutions',
                    error: 'Δεν συμπληρώσατε όλα τα υποχρεωτικά πεδία'
                });
            }

            // ✅ 2. Password match validation
            if (password !== password_confirmation) {
                return res.status(400).render('login/register', {
                    title: 'Register',
                    description: 'Web Payroll Solutions',
                    error: 'Δεν συμφωνεί ο κωδικός πρόσβασης (Password) με την επιβεβαίωση του κωδικού πρόσβασης'
                });
            }

            // ✅ 3. PASSWORD STRENGTH VALIDATION
            const validation = validatePasswordStrength(password);
            if (!validation.valid) {
                return res.status(400).render('login/register', {
                    title: 'Register',
                    description: 'Web Payroll Solutions',
                    error: validation.error
                });
            }

            // ✅ 4. Create user
            const salt = await bcrypt.genSalt(10);
            const hashPassword = await bcrypt.hash(password, salt);

            const newUser = new UserModel({
                kod: aa_kod,
                firstName,
                lastName,
                email,
                tel,
                team,
                password: hashPassword,
                privileges: privileges,
                situation,
                details,
                isVerified: true,
                isAdmin,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });

            const saved = await UserModel.create(newUser);

            // Count & update privileges
            const teamCount = await UserModel.countDocuments({ team: saved.team });
            const newPrivileges = teamCount === 1 ? 'C' : 'U';
            await UserModel.updateOne({ _id: saved._id }, { $set: { privileges: newPrivileges } });

            // Clone privileges from template
            const templateUserId = process.env.PROTYPO_ID;
            if (templateUserId) {
                const existingPrivileges = await UserPrivilegesModel.countDocuments({
                    userId: String(saved._id)
                });
                if (existingPrivileges === 0) {
                    const templatePrivileges = await UserPrivilegesModel.find({
                        userId: templateUserId
                    }).lean();
                    if (templatePrivileges?.length) {
                        const clones = templatePrivileges.map(({ _id, userId, ...rest }) => ({
                            ...rest,
                            userId: String(saved._id),
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }));
                        await UserPrivilegesModel.insertMany(clones);
                    }
                }
            }

            // Clone sidebar from template
            if (templateUserId) {
                const existingSidebar = await SidebarStatusModel.countDocuments({
                    userId: String(saved._id)
                });
                if (existingSidebar === 0) {
                    const templateSidebar = await SidebarStatusModel.find(
                        { userId: templateUserId },
                        { _id: 0, userId: 0 }
                    ).lean();

                    if (templateSidebar?.length) {
                        const sidebarClones = templateSidebar.map((doc) => ({
                            ...doc,
                            userId: String(saved._id)
                        }));
                        await SidebarStatusModel.insertMany(sidebarClones);
                    }
                }
            }

            // ✅ Success
            await res.flash('success', 'Επιτυχής καταχώρηση...');
            return res.render('login/login');
        } catch (error) {
            console.error('Registration error:', error);

            return res.status(500).render('login/register', {
                title: 'Register',
                description: 'Web Payroll Solutions',
                error: 'Αδυναμία εγγραφής. Επικοινωνήστε με τον Διαχειριστή...'
            });
        }
    };

    static changePasswordForm = async (req, res) => {
        try {
            if (
                req.session &&
                (req.session.userRole === 'A' || req.session.userRole === 'C') &&
                req.session.userStatus === 'A'
            ) {
                // 🔍 Βρες τον χρήστη με βάση το session.userId
                const user = await UserModel.findById(req.session.userId).lean();
                if (!user) {
                    await res.flash('error', 'Δεν βρέθηκε ο χρήστης στο σύστημα');
                    return res.redirect('/login');
                }

                const userEmail = user.email;
                const userRole = req.session.userRole;
                const attemptTime = new Date().toLocaleString('el-GR', {
                    timeZone: 'Europe/Athens'
                });

                // ✉️ Στήσιμο email
                const mailOptions = {
                    from: `"Web Payroll Solutions" <${process.env.MAIL_USER}>`,
                    to: userEmail,
                    subject: 'Προσπάθεια αλλαγής κωδικού πρόσβασης',
                    html: `
                <h2>${greeting},</h2>
                <p>Στις <b>${attemptTime}</b> καταγράφηκε προσπάθεια 
                αλλαγής του κωδικού πρόσβασης για τον λογαριασμό σας
                (<b>${userEmail}</b>) με ρόλο <b>${userRole}</b>.</p>

                <p>✅ Αν εσείς ξεκινήσατε τη διαδικασία, μπορείτε να αγνοήσετε αυτό το μήνυμα.</p>

                <p style="color:red;">
                    ⚠️ Αν δεν ήσασταν εσείς, παρακαλούμε επικοινωνήστε άμεσα με τον Administrator 
                    ή αλλάξτε τον κωδικό σας το συντομότερο δυνατό.
                </p>

                <hr>
                <small>Αυτό το email δημιουργήθηκε αυτόματα από το Web Payroll Solutions.</small>
                `
                };

                try {
                    await transporter.sendMail(mailOptions);
                } catch (err) {
                    console.error('Σφάλμα αποστολής email:', err);
                }

                // Προχώρα στο render
                return res.render('login/change_password', {
                    title: 'Change Password',
                    description: 'Web Payroll Solutions'
                });
            } else {
                await res.flash(
                    'warning',
                    'Δεν έχετε δικαίωμα αλλαγής του κωδικού πρόσβασης. Απευθυνθείτε στον supervisor σας ή στον Administrator'
                );
                return res.redirect('/login');
            }
        } catch (error) {
            console.error(error);
            return res.redirect('/');
        }
    };

    static changeUserPassword = async (req, res) => {
        try {
            // ✅ 1. Έλεγχος authentication
            if (!req.session || !req.session.userId) {
                await res.flash('error', 'Πρέπει να είστε συνδεδεμένος για να αλλάξετε τον κωδικό');
                return res.redirect('/login');
            }

            const { old_password, password, password_confirmation } = req.body;

            // ✅ 2. Βρες τον χρήστη από το session
            const user = await UserModel.findById(req.session.userId);

            if (!user) {
                await res.flash('error', 'Ο χρήστης δεν βρέθηκε');
                return res.redirect('/login');
            }

            // ✅ 3. Validation - Required fields
            if (!old_password || !password || !password_confirmation) {
                return res.status(400).render('login/change_password', {
                    title: 'Change Password',
                    description: 'Web Payroll Solutions',
                    error: 'Όλα τα πεδία είναι υποχρεωτικά'
                });
            }

            // ✅ 4. Validation - Passwords match
            if (password !== password_confirmation) {
                return res.status(400).render('login/change_password', {
                    title: 'Change Password',
                    description: 'Web Payroll Solutions',
                    error: 'Ο νέος κωδικός δεν συμφωνεί με την επιβεβαίωση'
                });
            }

            // ✅ 5. Verify old password
            const isMatchOldPassword = await bcrypt.compare(old_password, user.password);
            if (!isMatchOldPassword) {
                return res.status(400).render('login/change_password', {
                    title: 'Change Password',
                    description: 'Web Payroll Solutions',
                    error: 'Ο τρέχων κωδικός δεν είναι σωστός'
                });
            }

            // ✅ 6. PASSWORD STRENGTH VALIDATION
            const validation = validatePasswordStrength(password);
            if (!validation.valid) {
                return res.status(400).render('login/change_password', {
                    title: 'Change Password',
                    description: 'Web Payroll Solutions',
                    error: validation.error
                });
            }

            // ✅ 7. Check if new password is same as old
            const isSameAsOld = await bcrypt.compare(password, user.password);
            if (isSameAsOld) {
                return res.status(400).render('login/change_password', {
                    title: 'Change Password',
                    description: 'Web Payroll Solutions',
                    error: 'Ο νέος κωδικός πρέπει να είναι διαφορετικός από τον παλιό'
                });
            }

            // ✅ 8. Hash & save new password
            const salt = await bcrypt.genSalt(10);
            const newHashPassword = await bcrypt.hash(password, salt);

            await UserModel.findByIdAndUpdate(user._id, {
                $set: {
                    password: newHashPassword,
                    updatedAt: new Date()
                }
            });

            // ✅ 9. Log the password change
            logger.info(`✅ Password changed successfully:`, {
                userId: user._id,
                email: user.email,
                ip: req.ip,
                timestamp: new Date().toISOString()
            });

            // ✅ 10. Invalidate all other sessions
            const sessionStore = req.sessionStore;
            if (sessionStore && sessionStore.all) {
                sessionStore.all((err, sessions) => {
                    if (err) {
                        logger.error('Session enumeration error:', err);
                        return;
                    }

                    const currentSessionId = req.sessionID;
                    for (const sid in sessions) {
                        const session = sessions[sid];
                        if (session.userId === String(user._id) && sid !== currentSessionId) {
                            sessionStore.destroy(sid, (destroyErr) => {
                                if (destroyErr) {
                                    logger.error('Session destroy error:', destroyErr);
                                }
                            });
                        }
                    }
                });
            }

            // ✅ 11. Send email notification
            try {
                const greeting = getDetailedGreeting();

                await transporter.sendMail({
                    from: `"Web Payroll Solutions" <${process.env.EMAIL_USER}>`,
                    to: user.email,
                    subject: 'Επιτυχής αλλαγή κωδικού πρόσβασης',
                    html: `
                <h3>${greeting} ${user.firstName},</h3>
                <p>Ο κωδικός πρόσβασής σας άλλαξε επιτυχώς στις <b>${new Date().toLocaleString('el-GR')}</b>.</p>
                <p>✅ Αν εσείς κάνατε αυτή την αλλαγή, μπορείτε να αγνοήσετε αυτό το μήνυμα.</p>
                <p style="color: red;">
                    ⚠️ Αν δεν ήσασταν εσείς, επικοινωνήστε ΑΜΕΣΑ με τον Administrator 
                    και αλλάξτε ξανά τον κωδικό σας.
                </p>
                <hr>
                <small>Αυτό το email δημιουργήθηκε αυτόματα από το Web Payroll Solutions.</small>
                `
                });
            } catch (emailErr) {
                logger.error('Email notification error:', emailErr);
            }

            // ✅ 12. Success message & redirect
            await res.flash(
                'success',
                'Ο κωδικός σας άλλαξε επιτυχώς. Χρησιμοποιήστε τον νέο κωδικό στην επόμενη σύνδεση.'
            );
            return res.redirect('/login');
        } catch (error) {
            logger.error('changeUserPassword error:', error);

            return res.status(500).render('login/change_password', {
                title: 'Change Password',
                description: 'Web Payroll Solutions',
                error: 'Σφάλμα κατά την αλλαγή κωδικού. Δοκιμάστε ξανά.'
            });
        }
    };

    static resetPasswordForm = async (req, res) => {
        try {
            if (
                req.session &&
                (req.session.userRole === 'A' || req.session.userRole === 'C') &&
                req.session.userStatus === 'A'
            ) {
                // 🔍 Βρες τον χρήστη με βάση το session.userId
                const user = await UserModel.findById(req.session.userId).lean();
                if (!user) {
                    await res.flash('error', 'Δεν βρέθηκε ο χρήστης στο σύστημα');
                    return res.redirect('/login');
                }

                const userEmail = user.email;
                const userRole = req.session.userRole;
                const attemptTime = new Date().toLocaleString('el-GR', {
                    timeZone: 'Europe/Athens'
                });
                const roleLabels = {
                    A: 'Administrator',
                    C: 'Supervisor',
                    U: 'User',
                    V: 'Viewer'
                };

                const roleName = roleLabels[userRole] || 'Άγνωστος ρόλος';

                // ✉️ Στήσιμο email
                const mailOptions = {
                    from: `"Web Payroll Solutions" <${process.env.EMAIL_USER}>`,
                    to: userEmail,
                    subject: 'Προσπάθεια επαναφοράς κωδικού πρόσβασης',
                    html: `
                <h3>Αγαπητέ/ή χρήστη,</h3>
                <p>Στις <b>${attemptTime}</b> καταγράφηκε προσπάθεια 
                επαναφοράς του κωδικού πρόσβασης για τον λογαριασμό σας
                (<b>${userEmail}</b>) με ρόλο <b>${userRole}: ${roleName}</b>.</p>

                <p>✅ Αν εσείς ξεκινήσατε τη διαδικασία, μπορείτε να αγνοήσετε αυτό το μήνυμα.</p>

                <p style="color:red;">
                    ⚠️ Αν δεν ήσασταν εσείς, παρακαλούμε επικοινωνήστε άμεσα με τον Administrator 
                    ή αλλάξτε τον κωδικό σας το συντομότερο δυνατό.
                </p>

                <hr>
                <small>Αυτό το email δημιουργήθηκε αυτόματα από το Web Payroll Solutions.</small>
                `
                };

                try {
                    await transporter.sendMail(mailOptions);
                } catch (err) {
                    console.error('Σφάλμα αποστολής email:', err);
                }

                // Προχώρα στο render
                return res.render('login/reset_password', {
                    title: 'Reset Password',
                    description: 'Web Payroll Solutions'
                });
            } else {
                await res.flash(
                    'warning',
                    'Δεν έχετε δικαίωμα επαναφοράς του κωδικού πρόσβασης. Απευθυνθείτε στον supervisor σας ή στον Administrator'
                );
                return res.redirect('/login');
            }
        } catch (error) {
            console.error(error);
            return res.redirect('/');
        }
    };

    static sendUserResetPasswordEmail = async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                await res.flash('warning', 'Το email είναι υποχρεωτικό');
                return res.redirect('/');
            }

            const user = await UserModel.findOne({ email });
            if (!user) return res.redirect('/');

            await res.flash(
                'info',
                'Αν το email υπάρχει στη βάση δεδομένων, θα σας σταλεί άμεσα ένα link στο email σας το οποίο θα έχει ισχύ για τα επόμενα 5 λεπτά. Ελέγξτε το email σας.'
            );

            // secret που δένει με το password hash
            const secret = user._id + user.password + process.env.JWT_SECRET_KEY;
            const token = jwt.sign({ userID: user._id }, secret, { expiresIn: '5m' });

            const base = APP_ORIGIN || `http://localhost:${process.env.PORT || 5000}`;
            const link = `${base}/login/reset_old_password/${user._id}/${token}`;

            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: user.email,
                subject: 'Επαναφορά κωδικού πρόσβασης (reset password)',
                html: `
                <div style="font-family: Arial, sans-serif; line-height:1.6;">
                    <h2>${greeting},</h2>
                    <p>Λάβαμε αίτημα για επαναφορά του κωδικού πρόσβασης για τον λογαριασμό σας στο <strong>Web Payroll Solutions</strong>.</p>
                    
                    <p>Για να ορίσετε νέο κωδικό, κάντε κλικ στον παρακάτω σύνδεσμο:</p>
                    <p style="margin:20px 0;">
                        <a href="${link}" 
                            style="background:#007bff; color:#fff; padding:10px 15px; border-radius:5px; text-decoration:none;">
                            Ορισμός νέου κωδικού
                        </a>
                    </p>
                    
                    <p>Ο σύνδεσμος θα παραμείνει ενεργός για <strong>5 λεπτά</strong>. Μετά τη λήξη, θα χρειαστεί να υποβάλετε νέο αίτημα επαναφοράς.</p>
                    
                    <hr style="margin:20px 0;">
                    
                    <p style="font-size:14px; color:#555;">
                    Αν δεν ζητήσατε εσείς την επαναφορά, μπορείτε να αγνοήσετε αυτό το μήνυμα. 
                    Ο λογαριασμός σας παραμένει ασφαλής και δεν απαιτείται καμία ενέργεια.
                    </p>
                    
                    <p style="font-size:14px; color:#555;">
                    Για οποιαδήποτε απορία ή βοήθεια, επικοινωνήστε μέσω του email με την υποστήριξή μας.
                    </p>
                </div>
                `
            });

            return res.redirect('/');
        } catch (err) {
            console.error(err);
            await res.flash('error', 'Σφάλμα κατά την αποστολή email.');
            return res.redirect('/');
        }
    };

    static showResetPasswordForm = async (req, res) => {
        try {
            const { uid, token } = req.params;

            // ✅ 1. Validate parameters
            if (!uid || !token) {
                await res.flash('error', 'Μη έγκυρος σύνδεσμος');
                return res.redirect('/login');
            }

            // ✅ 2. Find user
            const user = await UserModel.findById(uid);
            if (!user) {
                logger.warn('⚠️ Password reset attempt for non-existent user:', { uid });
                await res.flash('error', 'Ο χρήστης δεν βρέθηκε');
                return res.redirect('/login');
            }

            // ✅ 3. Verify token
            const secret = user._id + user.password + process.env.JWT_SECRET_KEY;

            try {
                const decoded = jwt.verify(token, secret);

                // ✅ 4. Token user ID check
                if (decoded.userID !== String(user._id)) {
                    logger.warn('⚠️ Token userID mismatch:', {
                        tokenUserId: decoded.userID,
                        urlUserId: uid
                    });
                    await res.flash('error', 'Μη έγκυρος σύνδεσμος');
                    return res.redirect('/login');
                }

                // ✅ 5. Log access
                logger.info('✅ Password reset form accessed:', {
                    userId: user._id,
                    email: user.email,
                    ip: req.ip,
                    timestamp: new Date().toISOString()
                });

                // ✅ 6. Render form
                return res.render('login/set_new_password', {
                    title: 'Ορισμός νέου κωδικού',
                    description: 'Web Payroll Solutions',
                    uid,
                    token,
                    email: user.email,
                    error: null,
                    nonce: res.locals.nonce
                });
            } catch (jwtErr) {
                // ✅ 7. Handle token errors
                if (jwtErr.name === 'TokenExpiredError') {
                    logger.warn('⚠️ Expired password reset token:', {
                        userId: user._id,
                        email: user.email,
                        expiredAt: jwtErr.expiredAt
                    });
                    await res.flash(
                        'error',
                        'Ο σύνδεσμος έληξε (5 λεπτά). Ζητήστε νέο σύνδεσμο επαναφοράς.'
                    );
                } else {
                    logger.warn('⚠️ Invalid password reset token:', {
                        userId: user._id,
                        error: jwtErr.message
                    });
                    await res.flash('error', 'Μη έγκυρος σύνδεσμος');
                }
                return res.redirect('/login');
            }
        } catch (err) {
            logger.error('showResetPasswordForm error:', err);
            await res.flash('error', 'Σφάλμα. Δοκιμάστε ξανά.');
            return res.redirect('/login');
        }
    };

    static handleResetPassword = async (req, res) => {
        try {
            const { uid, token } = req.params;
            const { password, password2 } = req.body;

            // ✅ 1. Validate parameters
            if (!uid || !token) {
                await res.flash('error', 'Μη έγκυρος σύνδεσμος');
                return res.redirect('/login');
            }

            // ✅ 2. Find user FIRST (before validation)
            const user = await UserModel.findById(uid);
            if (!user) {
                logger.warn('⚠️ Password reset attempt for non-existent user:', { uid });
                await res.flash('error', 'Ο χρήστης δεν βρέθηκε');
                return res.redirect('/login');
            }

            // ✅ 3. Verify token BEFORE processing password
            const secret = user._id + user.password + process.env.JWT_SECRET_KEY;

            try {
                const decoded = jwt.verify(token, secret);

                if (decoded.userID !== String(user._id)) {
                    logger.warn('⚠️ Token userID mismatch during reset:', {
                        tokenUserId: decoded.userID,
                        urlUserId: uid
                    });
                    await res.flash('error', 'Μη έγκυρος σύνδεσμος');
                    return res.redirect('/login');
                }
            } catch (jwtErr) {
                if (jwtErr.name === 'TokenExpiredError') {
                    logger.warn('⚠️ Expired token during password reset:', {
                        userId: user._id,
                        email: user.email
                    });
                    await res.flash('error', 'Ο σύνδεσμος έληξε. Ζητήστε νέο σύνδεσμο επαναφοράς.');
                } else {
                    logger.warn('⚠️ Invalid token during password reset:', {
                        userId: user._id,
                        error: jwtErr.message
                    });
                    await res.flash('error', 'Μη έγκυρος σύνδεσμος');
                }
                return res.redirect('/login');
            }

            // ✅ 4. Validate passwords - Required fields
            if (!password || !password2) {
                return res.status(400).render('login/set_new_password', {
                    title: 'Ορισμός νέου κωδικού',
                    description: 'Web Payroll Solutions',
                    uid,
                    token,
                    email: user.email,
                    nonce: res.locals.nonce,
                    error: 'Είναι υποχρεωτικό να συμπληρώσετε και τα δύο πεδία'
                });
            }

            // ✅ 5. Validate - Passwords match
            if (password !== password2) {
                return res.status(400).render('login/set_new_password', {
                    title: 'Ορισμός νέου κωδικού',
                    description: 'Web Payroll Solutions',
                    uid,
                    token,
                    email: user.email,
                    nonce: res.locals.nonce,
                    error: 'Οι κωδικοί δεν ταιριάζουν'
                });
            }

            // ✅ 6. PASSWORD STRENGTH VALIDATION
            const validation = validatePasswordStrength(password);
            if (!validation.valid) {
                return res.status(400).render('login/set_new_password', {
                    title: 'Ορισμός νέου κωδικού',
                    description: 'Web Payroll Solutions',
                    uid,
                    token,
                    email: user.email,
                    nonce: res.locals.nonce,
                    error: validation.error
                });
            }

            // ✅ 7. Check if new password is same as old
            const isSameAsOld = await bcrypt.compare(password, user.password);
            if (isSameAsOld) {
                return res.status(400).render('login/set_new_password', {
                    title: 'Ορισμός νέου κωδικού',
                    description: 'Web Payroll Solutions',
                    uid,
                    token,
                    email: user.email,
                    nonce: res.locals.nonce,
                    error: 'Ο νέος κωδικός πρέπει να είναι διαφορετικός από τον παλιό'
                });
            }

            // ✅ 8. Hash new password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // ✅ 9. Update password
            user.password = hashedPassword;
            user.updatedAt = new Date();
            await user.save();

            // ✅ 10. Invalidate all sessions
            const sessionStore = req.sessionStore;
            if (sessionStore && sessionStore.all) {
                sessionStore.all((err, sessions) => {
                    if (err) {
                        logger.error('Session enumeration error:', err);
                        return;
                    }

                    for (const sid in sessions) {
                        const session = sessions[sid];
                        if (session.userId === String(user._id)) {
                            sessionStore.destroy(sid, (destroyErr) => {
                                if (destroyErr) {
                                    logger.error('Session destroy error:', destroyErr);
                                }
                            });
                        }
                    }
                });
            }

            // ✅ 11. Log successful reset
            logger.info('✅ Password reset successful:', {
                userId: user._id,
                email: user.email,
                ip: req.ip,
                timestamp: new Date().toISOString()
            });

            // ✅ 12. Send confirmation email
            try {
                const greeting = getDetailedGreeting();

                await transporter.sendMail({
                    from: `"Web Payroll Solutions" <${process.env.EMAIL_USER}>`,
                    to: user.email,
                    subject: 'Επιτυχής επαναφορά κωδικού πρόσβασης',
                    html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h2>Επιτυχής Επαναφορά Κωδικού</h2>
                    <p>${greeting} <strong>${user.firstName} ${user.lastName}</strong>,</p>
                    
                    <p>Ο κωδικός πρόσβασής σας άλλαξε επιτυχώς στις 
                    <strong>${new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' })}</strong>.</p>
                    
                    <p>✅ Μπορείτε τώρα να συνδεθείτε με τον νέο κωδικό σας.</p>
                    
                    <p style="margin: 20px 0;">
                        <a href="${process.env.APP_ORIGIN || 'http://localhost:5000'}/login" 
                        style="background:#28a745; color:#fff; padding:10px 15px; border-radius:5px; text-decoration:none;">
                            Σύνδεση
                        </a>
                    </p>
                    
                    <hr style="margin: 20px 0;">
                    
                    <p style="color: red; font-weight: bold;">
                        ⚠️ Αν δεν ζητήσατε εσείς την επαναφορά, επικοινωνήστε ΑΜΕΣΑ 
                        με τον Administrator.
                    </p>
                    
                    <p style="font-size: 14px; color:#555;">
                        Για ασφάλεια, όλες οι ενεργές συνεδρίες σας έχουν τερματιστεί.
                    </p>
                    
                    <hr style="margin: 20px 0;">
                    <small>Αυτό το email δημιουργήθηκε αυτόματα από το Web Payroll Solutions.</small>
                </div>
                `
                });
            } catch (emailErr) {
                logger.error('Password reset confirmation email error:', emailErr);
            }

            // ✅ 13. Success & redirect
            await res.flash('success', 'Ο κωδικός άλλαξε επιτυχώς! Συνδεθείτε με τον νέο κωδικό.');
            return res.redirect('/login');
        } catch (err) {
            logger.error('handleResetPassword error:', err);
            await res.flash('error', 'Σφάλμα κατά την αλλαγή κωδικού. Δοκιμάστε ξανά.');
            return res.redirect('/login');
        }
    };

    static transferTxtFilesToAwsS3 = async (req, res) => {
        const sessionUserTeam = req.session.userTeam;
        const companyId = req.session.companyInUse;
        const sessionUserId = req.session.userId;

        try {
            if (!sessionUserId || !companyId || !sessionUserTeam) {
                return res.status(400).send('Missing session data');
            }

            const userPrivileges = await UserPrivilegesModel.findOne({
                userId: sessionUserId,
                form: 'Ergazomenoi'
            }).lean();

            const company = await CompaniesModel.findOne({
                _id: companyId,
                team: sessionUserTeam
            })
                .select('kod eponymia')
                .lean();

            if (!company) {
                return res.status(404).send('Company not found');
            }

            res.render('admin/uploadTemplates', {
                title: 'Upload Templates',
                description: 'Web Payroll Solutions',
                bodyClass: 'upload-templates-page',
                userPrivileges: userPrivileges?.privileges || {},
                sessionTeam: sessionUserTeam,
                companyId: companyId,
                companyKod: company.kod,
                companyName: company.eponymia
            });
        } catch (error) {
            console.error('Error in transferTxtFilesToAwsS3:', error);
            res.status(500).send('Σφάλμα κατά τη φόρτωση της σελίδας');
        }
    };

    static logoutForm = async (req, res) => {
        try {
            res.render('login/logout', {
                title: 'Αποσύνδεση',
                description: 'Web Payroll Solutions',
                bodyClass: 'home-bg-cdn'
            });
        } catch (error) {
            res.redirect('/');
        }
    };

    static logout = async (req, res) => {
        // ✅ 1.Έλεγχος authentication
        if (!req.session || !req.session.userId) {
            const nonce = res.locals.nonce;

            return res.status(200).send(`
                <!doctype html>
                <html lang="el">
                    <head>
                        <meta charset="utf-8" />
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Ανακατεύθυνση</title>
                        <style>
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100vh;
                                margin: 0;
                                background: linear-gradient(135deg, #5a7c5e 0%, #7a9b7e 50%, #8b7355 100%);
                            }
                            .logout-container {
                                text-align: center;
                                padding: 3rem 2rem;
                                background:  white;
                                border-radius: 16px;
                                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                                max-width: 400px;
                                width:  90%;
                            }
                            .spinner {
                                border: 4px solid #f3f3f3;
                                border-top: 4px solid #a8a8a8;
                                border-radius: 50%;
                                width: 50px;
                                height: 50px;
                                animation: spin 1s linear infinite;
                                margin: 0 auto 1.5rem;
                            }
                            @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                            h2 {
                                color: #4a6b4e;
                                margin:  0 0 0.5rem;
                                font-size: 1.5rem;
                                font-weight: 600;
                            }
                            p {
                                color: #666;
                                margin: 0;
                                font-size:  0.95rem;
                            }
                            . success-icon {
                                font-size: 3rem;
                                color: #a8a8a8;
                                margin-bottom: 1rem;
                                display: none;
                            }
                            .logo {
                                width: 100px;
                                height: 100px;
                                background: radial-gradient(circle at 28% 28%, #ffffff, #efefef 40%, #c8c8c8 75%, #a8a8a8);
                                border-radius:  50%;
                                display:  flex;
                                align-items: center;
                                justify-content: center;
                                margin: 0 auto 20px;
                                box-shadow: 
                                    0 10px 25px rgba(0, 0, 0, 0.2),
                                    inset -4px -4px 12px rgba(0, 0, 0, 0.1),
                                    inset 4px 4px 12px rgba(255, 255, 255, 1);
                                position:  relative;
                            }
                            . logo::before {
                                content: '';
                                position: absolute;
                                top: 12%;
                                left: 18%;
                                width: 45%;
                                height: 45%;
                                background: radial-gradient(circle, 
                                    rgba(255, 255, 255, 1) 0%, 
                                    rgba(255, 255, 255, 0.7) 40%, 
                                    transparent 70%
                                );
                                border-radius: 50%;
                                filter: blur(12px);
                            }
                            . logo img {
                                width: 60px;
                                height: auto;
                                display: block;
                                position: relative;
                                z-index: 1;
                                filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.15));
                            }
                        </style>
                        </head>
                    <body>
                        <div class="logout-container">
                            <div class="logo">
                                <img src="https://cdn.webpayrollsolutions.com/assets/img/wps2.png" alt="WPS Logo" crossorigin="anonymous">
                            </div>
                            <h2>Δεν υπάρχει ενεργή σύνδεση</h2>
                            <p>Ανακατεύθυνση σε https://www.google.gr...</p>
                        </div>
                        <script nonce="${nonce}">
                            setTimeout(() => {
                                window.location.href = 'https://www.google.gr';
                            }, 2000);
                        </script>
                    </body>
                </html>
            `);
        }

        const sid = req.sessionID;
        const userId = req.session.userId;
        const userEmail = req.session.userEmail || 'unknown';

        // Καταγραφή logout ΠΡΙΝ το destroy
        try {
            const log = await UsageLogModel.findOne({
                userId,
                logoutAt: null
            }).sort({ loginAt: -1 });

            if (log) {
                const logoutAt = new Date();
                const durationMs = logoutAt - log.loginAt;
                await UsageLogModel.findByIdAndUpdate(log._id, {
                    logoutAt,
                    durationMs,
                    closedBy: 'logout'
                });
            }
        } catch (usageErr) {
            logger.error('❌ UsageLog logout error:', usageErr);
            // ✅ Δεν σταματάμε το logout αν αποτύχει η καταγραφή
        }

        // ✅ 2.Destroy session
        req.session.destroy((err) => {
            if (err) {
                logger.error('❌ Logout destroy error:', {
                    userId,
                    error: err.message
                });
                return res.redirect('/');
            }

            // ✅ 3.Destroy session από το store (MongoDB)
            try {
                req.sessionStore?.destroy?.(sid, (storeErr) => {
                    if (storeErr) {
                        logger.error('Session store destroy error:', storeErr);
                    }
                });
            } catch (destroyErr) {
                logger.error('Session store destroy exception:', destroyErr);
            }

            // ✅ 4.Clear session cookie
            res.clearCookie(sessionOpts.name || 'connect.sid', {
                path: sessionOpts.cookie.path ?? '/',
                sameSite: sessionOpts.cookie.sameSite ?? 'lax',
                httpOnly: sessionOpts.cookie.httpOnly !== false,
                secure: sessionOpts.cookie.secure ?? false
            });

            // ✅ 5.Clear CSRF cookie
            const csrfCookieName = isProd ? '__Host-psifi.x-csrf-token' : 'psifi.x-csrf-token';
            res.clearCookie(csrfCookieName, {
                path: '/',
                sameSite: 'lax',
                httpOnly: true,
                secure: isProd
            });

            // ✅ 6.Log successful logout
            logger.info(`✅ User logout successful: `, {
                userId,
                email: userEmail,
                ip: req.ip,
                timestamp: new Date().toISOString()
            });

            // ✅ 7.Redirect με cleanup
            const nonce = res.locals.nonce;
            const redirectUrl = 'https://www.google.gr'; // ✅ Redirect to Google Greece

            return res.status(200).send(`
                <!doctype html>
                <html lang="el">
                    <head>
                        <meta charset="utf-8" />
                        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src 'self' https://cdn.webpayrollsolutions.com;">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Αποσύνδεση... </title>
                        <style>
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100vh;
                                margin: 0;
                                background: linear-gradient(135deg, #5a7c5e 0%, #7a9b7e 50%, #8b7355 100%);
                            }
                            .logout-container {
                                text-align: center;
                                padding: 3rem 2rem;
                                background:  white;
                                border-radius: 16px;
                                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                                max-width: 400px;
                                width:  90%;
                            }
                            .spinner {
                                border: 4px solid #f3f3f3;
                                border-top: 4px solid #a8a8a8;
                                border-radius: 50%;
                                width: 50px;
                                height: 50px;
                                animation: spin 1s linear infinite;
                                margin: 0 auto 1.5rem;
                            }
                            @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                            h2 {
                                color: #4a6b4e;
                                margin:  0 0 0.5rem;
                                font-size: 1.5rem;
                                font-weight: 600;
                            }
                            p {
                                color: #666;
                                margin: 0;
                                font-size:  0.95rem;
                            }
                            . success-icon {
                                font-size: 3rem;
                                color: #a8a8a8;
                                margin-bottom: 1rem;
                                display: none;
                            }
                            .logo {
                                width: 100px;
                                height: 100px;
                                background: radial-gradient(circle at 28% 28%, #ffffff, #efefef 40%, #c8c8c8 75%, #a8a8a8);
                                border-radius:  50%;
                                display:  flex;
                                align-items: center;
                                justify-content: center;
                                margin: 0 auto 20px;
                                box-shadow: 
                                    0 10px 25px rgba(0, 0, 0, 0.2),
                                    inset -4px -4px 12px rgba(0, 0, 0, 0.1),
                                    inset 4px 4px 12px rgba(255, 255, 255, 1);
                                position:  relative;
                            }
                            . logo::before {
                                content: '';
                                position: absolute;
                                top: 12%;
                                left: 18%;
                                width: 45%;
                                height: 45%;
                                background: radial-gradient(circle, 
                                    rgba(255, 255, 255, 1) 0%, 
                                    rgba(255, 255, 255, 0.7) 40%, 
                                    transparent 70%
                                );
                                border-radius: 50%;
                                filter: blur(12px);
                            }
                            . logo img {
                                width: 60px;
                                height: auto;
                                display: block;
                                position: relative;
                                z-index: 1;
                                filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.15));
                            }
                        </style>
                    </head>
                    <body>
                        <div class="logout-container">
                            <div class="logo">
                                <img src="https://cdn.webpayrollsolutions.com/assets/img/wps2.png" alt="WPS Logo" crossorigin="anonymous">
                            </div>
                            <div class="spinner"></div>
                            <div class="success-icon" id="successIcon">✓</div>
                            <h2>Αποσύνδεση...</h2>
                            <p>Παρακαλώ περιμένετε</p>
                        </div>
                        <script nonce="${nonce}">
                            (function() {
                                'use strict';
                                
                                try {
                                    const keysToRemove = [];
                                    for (let i = 0; i < window.sessionStorage.length; i++) {
                                        const key = window.sessionStorage.key(i);
                                        if (key && key.indexOf('wps: ') === 0) {
                                            keysToRemove.push(key);
                                        }
                                    }
                                    
                                    keysToRemove.forEach(function(key) {
                                        try {
                                            window.sessionStorage.removeItem(key);
                                        } catch (e) {
                                            console.error('Failed to remove sessionStorage key:', key, e);
                                        }
                                    });
                                    
                                    const localKeysToRemove = [];
                                    for (let i = 0; i < window.localStorage. length; i++) {
                                        const key = window.localStorage.key(i);
                                        if (key && key.indexOf('wps:') === 0) {
                                            localKeysToRemove.push(key);
                                        }
                                    }
                                    
                                    localKeysToRemove.forEach(function(key) {
                                        try {
                                            window.localStorage.removeItem(key);
                                        } catch (e) {
                                            console. error('Failed to remove localStorage key:', key, e);
                                        }
                                    });
                                    
                                } catch (e) {
                                    console.error('Storage cleanup error:', e);
                                }
                                
                                setTimeout(function() {
                                    const spinner = document.querySelector('.spinner');
                                    const successIcon = document. getElementById('successIcon');
                                    if (spinner) spinner.style.display = 'none';
                                    if (successIcon) successIcon.style.display = 'block';
                                }, 300);
                                
                                setTimeout(function() {
                                    window.location.href = ${JSON.stringify(redirectUrl)};
                                }, 1500);
                            })();
                        </script>
                    </body>
                </html>
            `);
        });
    };
}

module.exports = userController;

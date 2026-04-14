// server/routes/dropdowns/ergazomenoi/kpkEfka.js
const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { AntistoixishKadEidikothtesKpkEfkaModel, KpkEfkaModel } = statheraArxeiaModel;

const toInt = (v, def) => {
    const n = Number((v ?? '').toString().trim());
    return Number.isFinite(n) ? n : def;
};
const escRe = (s) => (s ?? '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = {
    path: '/api/dropdown/ergazomenoi/kpk_efka',
    handler: async (req, res) => {
        try {
            // χρειάζονται και τα 2
            const kad = (req.query.kad ?? req.query.kodikos_kad ?? '').toString().trim();
            const eidik = (req.query.eidikothta ?? req.query.kodikos_eidikothtas ?? '')
                .toString()
                .trim();
            if (!kad || !eidik) {
                return res.json({ items: [], total: 0, page: 1, hasMore: false });
            }

            // έτος/μήνας χρήσης
            const now = new Date();
            const yearInUse = toInt(
                req.session?.yearInUse ?? req.query.yearInUse,
                now.getFullYear()
            );
            const periodInUse = toInt(
                req.session?.periodInUse ?? req.query.periodInUse,
                now.getMonth() + 1
            );

            // ---------- Preselect by ?value= ----------
            if (req.query.value) {
                const value = String(req.query.value).trim();
                const row = await KpkEfkaModel.findOne(
                    { kodikos: value },
                    { _id: 0, kodikos: 1, perigrafh: 1 }
                )
                    .lean()
                    .exec();
                if (!row) return res.json({ items: [], total: 0, page: 1, hasMore: false });
                const kodikos = (row.kodikos ?? '').toString().trim();
                const perigrafh = (row.perigrafh ?? '').toString().trim();
                return res.json({
                    items: [
                        { value: kodikos, label: `${kodikos} - ${perigrafh}`, kodikos, perigrafh }
                    ],
                    total: 1,
                    page: 1,
                    hasMore: false
                });
            }

            // remote search + pagination
            const search = (req.query.search || '').trim();
            const page = Math.max(1, toInt(req.query.page, 1));
            const limit = Math.min(Math.max(1, toInt(req.query.limit, 50)), 200);
            const skip = (page - 1) * limit;

            // ---------- 1) DISTINCT KPK από το mapping (και εκεί ισχύς) ----------
            const mapPipe = [
                { $match: { kodikos_kad: kad, kodikos_eidikothtas: eidik } },
                {
                    $addFields: {
                        apoEtos: { $toInt: '$isxyei_apo_etos' },
                        apoMhnas: { $toInt: '$isxyei_apo_mhna' },
                        eosEtos: { $toInt: '$isxyei_eos_etos' },
                        eosMhnas: { $toInt: '$isxyei_eos_mhna' }
                    }
                },
                {
                    $match: {
                        $expr: {
                            $and: [
                                {
                                    $or: [
                                        { $lt: ['$apoEtos', yearInUse] },
                                        {
                                            $and: [
                                                { $eq: ['$apoEtos', yearInUse] },
                                                { $lte: ['$apoMhnas', periodInUse] }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    $or: [
                                        { $gt: ['$eosEtos', yearInUse] },
                                        {
                                            $and: [
                                                { $eq: ['$eosEtos', yearInUse] },
                                                { $gte: ['$eosMhnas', periodInUse] }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                },
                { $group: { _id: '$kodikos_kpk' } },
                { $sort: { _id: 1 } }
            ];
            const distinct = await AntistoixishKadEidikothtesKpkEfkaModel.aggregate(mapPipe).exec();
            const codes = distinct.map((d) => (d._id ?? '').toString().trim()).filter(Boolean);
            if (!codes.length) {
                return res.json({ items: [], total: 0, page: 1, hasMore: false });
            }

            // ---------- 2) Φιλτράρισμα & ισχύς πάνω στο ίδιο το KpkEfka ----------
            //   (ώστε π.χ. το 3137 με isxyei_eos_etos "2022" να ΜΗΝ έρχεται)
            const re = search ? new RegExp(escRe(search), 'i') : null;

            // βασικό $match: κωδικοί και προαιρετικό search
            const baseMatch = { kodikos: { $in: codes } };
            if (re) {
                Object.assign(baseMatch, {
                    $or: [{ kodikos: { $regex: re } }, { perigrafh: { $regex: re } }]
                });
            }

            // pipeline με ισχύ επάνω στο KpkEfka
            const kpkBase = [
                { $match: baseMatch },
                {
                    $addFields: {
                        apoEtos: { $ifNull: [{ $toInt: '$isxyei_apo_etos' }, 0] },
                        apoMhnas: { $ifNull: [{ $toInt: '$isxyei_apo_mhna' }, 1] },
                        eosEtos: { $ifNull: [{ $toInt: '$isxyei_eos_etos' }, 9999] },
                        eosMhnas: { $ifNull: [{ $toInt: '$isxyei_eos_mhna' }, 12] }
                    }
                },
                {
                    $match: {
                        $expr: {
                            $and: [
                                {
                                    $or: [
                                        { $lt: ['$apoEtos', yearInUse] },
                                        {
                                            $and: [
                                                { $eq: ['$apoEtos', yearInUse] },
                                                { $lte: ['$apoMhnas', periodInUse] }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    $or: [
                                        { $gt: ['$eosEtos', yearInUse] },
                                        {
                                            $and: [
                                                { $eq: ['$eosEtos', yearInUse] },
                                                { $gte: ['$eosMhnas', periodInUse] }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            ];

            // total
            const [{ total = 0 } = {}] = await KpkEfkaModel.aggregate([
                ...kpkBase,
                { $count: 'total' }
            ])
                .collation({ locale: 'el', strength: 1 })
                .exec();

            // page
            const rows = await KpkEfkaModel.aggregate([
                ...kpkBase,
                { $sort: { kodikos: 1 } },
                { $skip: skip },
                { $limit: limit },
                { $project: { _id: 0, kodikos: 1, perigrafh: 1 } }
            ])
                .collation({ locale: 'el', strength: 1 })
                .exec();

            const items = rows.map((doc) => {
                const kod = (doc.kodikos ?? '').toString().trim();
                const per = (doc.perigrafh ?? '').toString().trim();
                return { value: kod, label: `${kod} - ${per}`, kodikos: kod, perigrafh: per };
            });

            return res.json({
                items,
                total,
                page,
                hasMore: skip + items.length < total
            });
        } catch (err) {
            console.error('kpkEfka handler error:', err);
            return res.status(500).json({ items: [], total: 0, page: 1, hasMore: false });
        }
    }
};

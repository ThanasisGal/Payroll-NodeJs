// module.exports = { path: '/api/dropdown/ergazomenoi/eidikothta_efka', handler };

const mongoose = require('mongoose');

const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { AntistoixishKadEidikothtesKpkEfkaModel, EidikothtesEfkaModel } = statheraArxeiaModel;

const toInt = (v, def) => {
    const n = Number((v ?? '').toString().trim());
    return Number.isFinite(n) ? n : def;
};
const escRe = (s) => (s ?? '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const handler = async (req, res) => {
    try {
        // --- required kad ---
        const kad = (req.query.kad ?? req.query.kodikos_kad ?? '').toString().trim();
        if (!kad) return res.json({ items: [], total: 0, page: 1, hasMore: false });

        if (req.query.value) {
            const value = String(req.query.value).trim();
            const row = await EidikothtesEfkaModel.findOne(
                { kodikos: value },
                { _id: 0, kodikos: 1, perigrafh: 1 }
            )
                .lean()
                .exec();
            if (!row) return res.json({ items: [], total: 0, page: 1, hasMore: false });
            const kodikos = (row.kodikos ?? '').toString().trim();
            const perigrafh = (row.perigrafh ?? '').toString().trim();
            return res.json({
                items: [{ value: kodikos, label: `${kodikos} - ${perigrafh}`, kodikos, perigrafh }],
                total: 1,
                page: 1,
                hasMore: false
            });
        }

        // --- session period ---
        const now = new Date();
        const yearInUse = toInt(req.session?.yearInUse ?? req.query.yearInUse, now.getFullYear());
        const periodInUse = toInt(
            req.session?.periodInUse ?? req.query.periodInUse,
            now.getMonth() + 1
        );

        // --- remote search & paging from Tom Select ---
        const search = (req.query.search || '').trim();
        const page = Math.max(1, toInt(req.query.page, 1));
        const limit = Math.min(Math.max(1, toInt(req.query.limit, 50)), 200);
        const skip = (page - 1) * limit;

        // 1) get distinct ειδικότητες για ΚΑΔ που είναι "εν ισχύ"
        const pipeline = [
            { $match: { kodikos_kad: kad } },
            {
                $addFields: {
                    apoEtos: { $toInt: '$isxyei_apo_etos' },
                    apoMh: { $toInt: '$isxyei_apo_mhna' },
                    eosEtos: { $toInt: '$isxyei_eos_etos' },
                    eosMh: { $toInt: '$isxyei_eos_mhna' }
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
                                            { $lte: ['$apoMh', periodInUse] }
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
                                            { $gte: ['$eosMh', periodInUse] }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            { $group: { _id: '$kodikos_eidikothtas' } },
            { $sort: { _id: 1 } }
        ];

        const distinct = await AntistoixishKadEidikothtesKpkEfkaModel.aggregate(pipeline).exec();
        const codes = distinct.map((d) => (d._id ?? '').toString().trim()).filter(Boolean);
        if (!codes.length) return res.json({ items: [], total: 0, page: 1, hasMore: false });

        // 2) build filter για EidikothtesEfka + search
        const filter = mongoose.trusted({ kodikos: { $in: codes } });

        if (search) {
            const re = new RegExp(escRe(search), 'i');

            Object.assign(
                filter,
                mongoose.trusted({
                    $or: [{ kodikos: { $regex: re } }, { perigrafh: { $regex: re } }]
                })
            );
        }

        // 3) count + page results (με collation για case/diacritics-insensitive)
        const collation = { locale: 'el', strength: 1 }; // strength 1: αγνοεί τόνους & case
        const total = await EidikothtesEfkaModel.countDocuments(filter).collation(collation);

        const rows = await EidikothtesEfkaModel.find(filter)
            .sort({ kodikos: 1 })
            .skip(skip)
            .limit(limit)
            .collation(collation)
            .lean()
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
        console.error('eidikothtesEfka handler error:', err);
        return res.status(500).json({ items: [], total: 0, page: 1, hasMore: false });
    }
};

module.exports = { path: '/api/dropdown/ergazomenoi/eidikothta_efka', handler };

// server/dropdowns/ergazomenoi/kpkEfkaByCode.js
const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { KpkEfkaModel } = statheraArxeiaModel;

const toInt = (v, def) => {
  const n = Number((v ?? '').toString().trim());
  return Number.isFinite(n) ? n : def;
};

module.exports = {
  path: '/api/dropdown/ergazomenoi/kpk_efka_by_code',
  handler: async (req, res) => {
    try {
      // Δέξου: kodikos  ή code  ή kpk  ή kodikos_kpk_se
      const raw =
        (req.query.kodikos ??
         req.query.code ??
         req.query.kpk ??
         req.query.kodikos_kpk_se ?? '')
        .toString().trim();

      if (!raw) {
        return res.json({ items: [], total: 0, page: 1, hasMore: false });
      }

      // Επιτρέπουμε και comma-separated λίστα (προαιρετικά)
      const codes = raw.split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const now = new Date();
      const yearInUse   = toInt(req.session?.yearInUse   ?? req.query.yearInUse,   now.getFullYear());
      const periodInUse = toInt(req.session?.periodInUse ?? req.query.periodInUse, now.getMonth() + 1);

      const rows = await KpkEfkaModel.aggregate([
        { $match: { kodikos: { $in: codes } } },
        { $addFields: {
            apoEtos: { $ifNull: [ { $toInt: '$isxyei_apo_etos' }, 0 ] },
            apoMh:   { $ifNull: [ { $toInt: '$isxyei_apo_mhna' }, 1 ] },
            eosEtos: { $ifNull: [ { $toInt: '$isxyei_eos_etos' }, 9999 ] },
            eosMh:   { $ifNull: [ { $toInt: '$isxyei_eos_mhna' }, 12 ] },
        }},
        { $match: { $expr: {
          $and: [
            { $or: [
              { $lt: ['$apoEtos', yearInUse] },
              { $and: [ { $eq: ['$apoEtos', yearInUse] }, { $lte: ['$apoMh', periodInUse] } ] }
            ]},
            { $or: [
              { $gt: ['$eosEtos', yearInUse] },
              { $and: [ { $eq: ['$eosEtos', yearInUse] }, { $gte: ['$eosMh', periodInUse] } ] }
            ]}
          ]
        }}},
        { $project: { _id: 0, kodikos: 1, perigrafh: 1 } },
        { $sort: { kodikos: 1 } }
      ]).exec();

      const items = rows.map(doc => {
        const kod = (doc.kodikos ?? '').toString().trim();
        const per = (doc.perigrafh ?? '').toString().trim();
        return { value: kod, label: per ? `${kod} - ${per}` : kod, kodikos: kod, perigrafh: per };
      });

      return res.json({ items, total: items.length, page: 1, hasMore: false });
    } catch (err) {
      console.error('kpk_efka_by_code error:', err);
      return res.status(500).json({ items: [], total: 0, page: 1, hasMore: false });
    }
  }
};

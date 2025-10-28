// server/dropdowns/ergazomenoi/antistoixishEpaKpk.js
// Επιστρέφει τα KPK(se) για (KPK_apo, EPA) σε ισχύ – πιο πρόσφατο πρώτα. (CommonJS)

const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { AntistoixishEidikhsPeriptoshsKpkEfkaModel, KpkEfkaModel } = statheraArxeiaModel;

const toInt = (v, def) => {
  const n = Number((v ?? '').toString().trim());
  return Number.isFinite(n) ? n : def;
};

module.exports = {
  // ίδιο interface με το “δεύτερο” παράδειγμα
  path: '/api/antistoixishEpaKpk',

  handler: async (req, res) => {
    try {
      const kpkApo = (req.query.kodikos_kpk_apo || req.query.kpk || '').toString().trim();
      const epa    = (req.query.kodikos_eidikhs_periptoshs || req.query.epa || '').toString().trim();
      if (!kpkApo || !epa) return res.json([]);

      const now = new Date();
      const yearInUse   = toInt(req.session?.yearInUse   ?? req.query.yearInUse,   now.getFullYear());
      const periodInUse = toInt(req.session?.periodInUse ?? req.query.periodInUse, now.getMonth() + 1);

      // 1) Mapping ενεργό στην περίοδο (κρατάμε το πιο πρόσφατο "από" για κάθε KPK_se)
      const mapRows = await AntistoixishEidikhsPeriptoshsKpkEfkaModel.aggregate([
        { $match: { kodikos_kpk_apo: kpkApo, kodikos_eidikhs_periptoshs: epa } },
        { $addFields: {
            apoEtos: { $toInt: '$isxyei_apo_etos' },
            apoMh:   { $toInt: '$isxyei_apo_mhna' },
            eosEtos: { $toInt: '$isxyei_eos_etos' },
            eosMh:   { $toInt: '$isxyei_eos_mhna' },
        }},
        { $match: { $expr: {
          $and: [
            { $or: [
              { $lt:  ['$apoEtos', yearInUse] },
              { $and: [ { $eq: ['$apoEtos', yearInUse] }, { $lte: ['$apoMh', periodInUse] } ] }
            ]},
            { $or: [
              { $gt:  ['$eosEtos', yearInUse] },
              { $and: [ { $eq: ['$eosEtos', yearInUse] }, { $gte: ['$eosMh', periodInUse] } ] }
            ]}
          ]
        }}},
        { $group: {
          _id: '$kodikos_kpk_se',
          maxApoEtos: { $max: '$apoEtos' },
          maxApoMh:   { $max: '$apoMh' }
        }},
        { $sort: { maxApoEtos: -1, maxApoMh: -1, _id: 1 } },
        { $project: { _id: 0, kodikos: '$_id' } }
      ]).exec();

      if (!mapRows.length) return res.json([]);

      // 2) Φέρε KPK περιγραφές και διατήρησε τη σειρά
      const codes = mapRows.map(x => x.kodikos);

      let doc = null;
      for (const code of codes) {
        doc = await KpkEfkaModel.findOne(
          { kodikos: code },
          { _id: 0, kodikos: 1, perigrafh: 1 }
        ).lean().exec();
        if (doc) break; // σταμάτα στον πρώτο που βρέθηκε
      }

      // const order = new Map(codes.map((c, i) => [c, i]));

      // const kpkDocs = await KpkEfkaModel
      //   .find({ kodikos: { $in: codes } }, { _id: 0, kodikos: 1, perigrafh: 1 })
      //   .lean().exec();

      // kpkDocs.sort((a, b) => (order.get(a.kodikos) ?? 9e9) - (order.get(b.kodikos) ?? 9e9));

      // return res.json(kpkDocs.map(doc => ({
      //   kodikos: doc.kodikos,
      //   perigrafh: doc.perigrafh || ''
      // })));
      // if (!doc) return res.json([]); // τίποτα δεν βρέθηκε

      return res.json([{ kodikos: doc.kodikos, perigrafh: doc.perigrafh || '' }]);
    } catch (err) {
      console.error('antistoixishEpaKpk error:', err);
      return res.status(500).json([]);
    }
  }
};

// routes/dropdowns/ergazomenoi/poleis.js
const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { PoleisModel } = statheraArxeiaModel; // ή όπως λέγεται το μοντέλο σου

module.exports = {
  path: '/api/dropdown/ergazomenoi/polh',
  model: PoleisModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    sort: { perigrafh: 1 },

    // φιλτραρισμένες πόλεις για συγκεκριμένο Δήμο: ?dhmos=XXXX
    extraQueryBuilder: (q) => {
      const res = {};
      if (q.dhmos) res.dhmos = String(q.dhmos).trim();
      return res;
    },

    mapItem: (doc) => {
      const kod = String(doc.kodikos || '').trim();
      const per = String(doc.perigrafh || '').trim();
      return {
        value     : kod,
        label     : `${kod} - ${per}`,
        kodikos   : kod,
        perigrafh : per,
        dhmos     : String(doc.dhmos || '').trim()
      };
    },
  }
};

// routes/dropdowns/ergazomenoi/dhmoi.js
const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { DhmoiModel } = statheraArxeiaModel;

module.exports = {
  path: '/api/dropdown/ergazomenoi/dhmos',
  model: DhmoiModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    sort: { perigrafh: 1 },

    // φιλτραρισμένοι δήμοι για συγκεκριμένο Νομό: ?nomos=XXXX
    extraQueryBuilder: (q) => {
      const res = {};
      if (q.nomos) res.nomos = String(q.nomos).trim();
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
        nomos     : String(doc.nomos || '').trim()
      };
    },
  }
};

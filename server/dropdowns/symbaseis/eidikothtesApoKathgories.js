// server/dropdowns/symbaseis/eidikothtesApoKathgories.js
const symbaseisModels = require('../../models/symbaseis');
const { EidikothtesSymbaseonModel } = symbaseisModels;

module.exports = {
  path: '/api/dropdown/symbaseis/eidikothta_symbashs',
  model: EidikothtesSymbaseonModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    sort: { kodikos: 1 },

    // Απαιτείται ΚΑΙ σύμβαση ΚΑΙ κατηγορία
    extraQueryBuilder: (q) => {
      const sym = String(q.symbash_stathera || q.symbash || q.afora_thn_symbash || '').trim();
      const kat = String(q.kathgoria_symbashs_stathera || q.kathgoria_symbashs || '').trim();

      if (!sym || !kat) {
        return { _id: { $exists: false } };
      }

      // Αν το μοντέλο κρατά έτοιμο composite 8-ψηφιο:
      const afora_thn_symbash_kathgoria = `${sym}${kat}`;
      return { afora_thn_symbash_kathgoria };
    },

    mapItem: (doc) => {
      const kod = String(doc.kodikos || '').trim();
      const per = String(doc.perigrafh || '').trim();
      const lbl = `${kod} - ${per}`;
      return {
        value: kod,
        label: lbl,
        text:  lbl,
        kodikos: kod,
        perigrafh: per,
        afora_thn_symbash_kathgoria: String(doc.afora_thn_symbash_kathgoria || '').trim(),
        id: String(doc._id || ''),
      };
    },
  },
};

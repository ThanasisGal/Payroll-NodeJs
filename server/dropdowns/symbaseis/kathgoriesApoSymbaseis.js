// server/dropdowns/symbaseis/kathgoriesApoSymbaseis.js
const symbaseisModels = require('../../models/symbaseis');
const { KathgoriesSymbaseonModel } = symbaseisModels;

module.exports = {
  path: '/api/dropdown/symbaseis/kathgoria_symbashs',
  model: KathgoriesSymbaseonModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    sort: { kodikos: 1 },

    // ✅ Αν ΔΕΝ υπάρχει σύμβαση -> γύρνα κενό αποτέλεσμα
    extraQueryBuilder: (q) => {
      const v = String(
        q.symbash_stathera || q.symbash || q.afora_thn_symbash || ''
      ).trim();

      if (!v) {
        // "Αδύνατο" φίλτρο ώστε να επιστραφούν 0 έγγραφα
        return { _id: { $exists: false } };
      }

      return { afora_thn_symbash: v };
    },

    mapItem: (doc) => {
      const kod = String(doc.kodikos || '').trim();
      const per = String(doc.perigrafh || '').trim();
      const lbl = `${kod} - ${per}`;
      return {
        value: kod, // ή value: String(doc._id) αν το θέλω με _id
        label: lbl,
        text: lbl,
        kodikos: kod,
        perigrafh: per,
        afora_thn_symbash: String(doc.afora_thn_symbash || '').trim(),
        aa: String(doc.aa),
        id: String(doc._id || ''),
      };
    },
  },
};

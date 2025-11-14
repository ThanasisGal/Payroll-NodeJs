// server/dropdowns/symbaseis/eidikothtesApoKathgories.js
const symbaseisModels = require('../../models/symbaseis');
const { EidikothtesSymbaseonModel } = symbaseisModels;

module.exports = {
  path: '/api/dropdown/symbaseis/eidikothta_symbashs_multi',
  model: EidikothtesSymbaseonModel,
  options: {
    searchFields: ['kodikos', 'perigrafh'],
    sort: { afora_thn_symbash_kathgoria: 1, kodikos: 1 },

    extraQueryBuilder: (q) => {
      const to4 = (v) => {
        const d = String(v ?? '').replace(/\D/g, '');
        if (!d) return '';
        const n = parseInt(d, 10);
        return Number.isFinite(n) ? String(n).padStart(4, '0') : d.slice(-4).padStart(4, '0');
      };

      // --- σύμβαση (μία τιμή)
      const sym = to4(q.symbash_stathera || q.symbash || q.afora_thn_symbash || '');
      if (!sym) return { _id: { $exists: false } };

      // --- συλλογή κατηγοριών από ΟΛΕΣ τις πιθανές πηγές
      const pool = new Set();

      const addKat = (x) => {
        if (!x) return;
        if (Array.isArray(x)) { x.forEach(addKat); return; }

        if (typeof x === 'string') {
          const s = x.trim();
          if (!s) return;

          // Αν μας έρθει JSON string (π.χ. το hidden table)
          if (s.startsWith('[') && s.endsWith(']')) {
            try { JSON.parse(s).forEach(addKat); } catch {}
            return;
          }

          // CSV "0001,0003"
          if (s.includes(',')) { s.split(',').forEach(addKat); return; }

          // απλή τιμή
          const k = to4(s);
          if (k) pool.add(k);
          return;
        }

        if (typeof x === 'object') {
          // αντικείμενο από το hidden table: {aa, kodikos}
          const k = to4(x.kodikos || x.value || x.id);
          if (k) pool.add(k);
        }
      };

      addKat(q.kathgoria_symbashs_stathera);
      addKat(q.kathgoria_symbashs);
      addKat(q.kathgoria);
      addKat(q.kathgoria_symbashs_table); // JSON array από το hidden

      const kats = Array.from(pool).filter(Boolean);
      if (!kats.length) return { _id: { $exists: false } };

      // --- ΜΟΝΟ 8-ψηφιο: sym(4)+kat(4)
      const combos = kats.map(k => sym + k); // π.χ. "0002" + "0003" = "00020003"

      return { afora_thn_symbash_kathgoria: { $in: combos } };
    },

    mapItem: (doc) => {
      const eid = String(doc.kodikos || '').padStart(4,'0');
      const per = String(doc.perigrafh || '').trim();
      const afk = String(doc.afora_thn_symbash_kathgoria || ''); // π.χ. "00020001"
      const aa  = (doc.aa != null ? String(doc.aa) : '');         // ΜΟΝΑΔΙΚΟ

      return {
        value: aa || `${eid}|${afk}`,   // <-- ΜΟΝΑΔΙΚΟ value (ιδανικά το aa)
        label: `${eid} - ${per}`,
        text:  `${eid} - ${per}`,

        // meta που θα χρειαστούμε client-side
        aa,
        kodikos: eid,
        perigrafh: per,
        afora_thn_symbash_kathgoria: afk,
        id: String(doc._id || ''),
      };
    }
  },
};

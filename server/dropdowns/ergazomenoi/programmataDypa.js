// dropdowns/ergazomenoi/programmataDypa.js
const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { ProgrammataDypaModel } = statheraArxeiaModel;

const escapeRx = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const NBSP = '\u00A0';
const padRight = (s = '', targetLen = 11) => {
    const t = String(s || '').trim();
    return t.length >= targetLen ? t : t + NBSP.repeat(targetLen - t.length);
};

const mapOption = (doc, padLen = 11) => ({
    value: doc.kodikos,
    label: `${(doc.kodikos || '').trim()} — ${padRight(doc.kodikos_programmatos, padLen)} — ${(doc.titlos || '').trim()}`,
    url_link: doc.url_link,
    kodikos_programmatos: doc.kodikos_programmatos,
    // group   : groupOf(doc),  για optgroup headers στο Tom Select
    _id: doc._id
});

// async function handler(req, res, next) {
//   try {
//     const q = (req.query.search || req.query.q || req.query.term || '').trim();
//     const padLen = Number.parseInt(req.query.padLength, 10) || 11;

//     const match = { anoixto_kleisto: true };
//     if (q) {
//       const rx = new RegExp(escapeRx(q), 'i');
//       match.$or = [
//         { kodikos: rx },
//         { kodikos_programmatos: rx },
//         { titlos: rx },
//       ];
//     }

//     // Ταξινόμηση ώστε οι τίτλοι να είναι ομαδοποιημένοι αλφαβητικά (άρα και τα groups)
//     const rows = await ProgrammataDypaModel
//       .find(match)
//       .sort({ titlos: 1, kodikos: 1, kodikos_programmatos: 1 })
//       .select({ _id: 1, kodikos: 1, kodikos_programmatos: 1, titlos: 1, url_link: 1 })
//       .lean();

//     const items = rows.map(doc => mapOption(doc, padLen));
//     return res.json({ items, hasMore: false, nextPage: null, totalCount: items.length });
//   } catch (err) {
//     next(err);
//   }
// }

async function handler(req, res, next) {
    try {
        // ✅ Πρόσθεσε το value parameter
        const value = (req.query.value || '').trim();
        const q = (req.query.search || req.query.q || req.query.term || '').trim();
        const padLen = Number.parseInt(req.query.padLength, 10) || 11;

        const match = { anoixto_kleisto: true };

        if (value) {
            // ✅ Preselect: ακριβής αναζήτηση με kodikos
            match.kodikos = value;
        } else if (q) {
            const rx = new RegExp(escapeRx(q), 'i');
            match.$or = [{ kodikos: rx }, { kodikos_programmatos: rx }, { titlos: rx }];
        }

        const rows = await ProgrammataDypaModel.find(match)
            .sort({ titlos: 1, kodikos: 1, kodikos_programmatos: 1 })
            .select({ _id: 1, kodikos: 1, kodikos_programmatos: 1, titlos: 1, url_link: 1 })
            .lean();

        const items = rows.map((doc) => mapOption(doc, padLen));
        return res.json({ items, hasMore: false, nextPage: null, totalCount: items.length });
    } catch (err) {
        next(err);
    }
}

module.exports = { handler };

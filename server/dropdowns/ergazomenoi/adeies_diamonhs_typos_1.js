const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { AdeiesDiamonhsModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/adeies_diamonhs_typos_1',
    model:  AdeiesDiamonhsModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
        
        // ✅ ΦΙΛΤΡΟ:  Μόνο typos = "1"
        extraQueryBuilder: (q) => {
            const res = { typos: "1" };  // ✅ Σταθερό filter
            return res;
        },

        // ✅ Προαιρετικό: format το label
        mapItem: (doc) => {
            const kod = String(doc.kodikos || '').padStart(2, '0');
            const per = String(doc.perigrafh || '').trim();
            return {
                value     : kod,
                label     : `${kod} - ${per}`,
                kodikos   : kod,
                perigrafh : per,
                typos     : String(doc.typos || '').trim(),
                _sortKey  : parseInt(doc.kodikos) || 0  // ✅ Κλειδί ταξινόμησης
            };
        },
        
        // ✅ ΝΕΟ: Custom sort function (client-side)
        sortItems: (items) => {
            return items.sort((a, b) => {
                const aNum = parseInt(a.kodikos) || 0;
                const bNum = parseInt(b.kodikos) || 0;
                return aNum - bNum;
            });
        }
    }
};
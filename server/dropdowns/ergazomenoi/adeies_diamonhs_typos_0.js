const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { AdeiesDiamonhsModel } = statheraArxeiaModel;

module.exports = {
    path: '/api/dropdown/ergazomenoi/adeies_diamonhs_typos_0',
    model: AdeiesDiamonhsModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },  // ✅ Βασικη ταξινόμηση στη ΒΔ
        numericSort: 'kodikos',
        
        extraQueryBuilder: (q) => {
            const res = { typos: "0" };
            return res;
        },

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
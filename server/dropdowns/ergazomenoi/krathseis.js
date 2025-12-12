const statheraArxeiaModel = require('../../models/stathera_arxeia');

const { KrathseisModel } = statheraArxeiaModel;

// module.exports = {
//     path: '/api/dropdown/ergazomenoi/krathseis',
//     model: KrathseisModel,
//     options: {
//         searchFields: ['kodikos', 'perigrafh'],
//         sort: { kodikos: 1 },
//         fields: ['kodikos', 'perigrafh', 'kodikos_tameioy']  
//     }
// };

module.exports = {
    path: '/api/dropdown/ergazomenoi/krathseis',
    model:  KrathseisModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
        // ✅ CUSTOM mapItem για κρατήσεις - περιλαμβάνει kodikos_tameioy
        mapItem: (item, pad = 11) => {
            const valRaw = item. kodikos;
            const val    = (valRaw == null) ? '' : String(valRaw).trim();
            const kod    = (item.kodikos == null) ? '' : String(item. kodikos);
            const lab    = `${(val || '').padEnd(pad, '\u00A0')} - ${item.perigrafh ?? ''}`;
            return {
                value         : val,
                kodikos       : kod,
                perigrafh     : item.perigrafh,
                kodikos_tameioy: item.kodikos_tameioy,  // ✅ ΝΕΟ
                label         : lab,
            };
        }
    }
};
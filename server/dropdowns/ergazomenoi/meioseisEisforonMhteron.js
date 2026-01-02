const statheraArxeiaModel = require('../../models/stathera_arxeia');
const { TypoiEpidothseonModel } = statheraArxeiaModel;

module. exports = {
    path: '/api/dropdown/ergazomenoi/meiosh_eisforas_mhteron',
    model: TypoiEpidothseonModel,
    options: {
        searchFields:  ['kodikos', 'perigrafh'],
        sort: { kodikos: 1 },
        
        // ✅ ΦΙΛΤΡΟ: Μόνο εγγραφές με typos = "3"
        extraQueryBuilder: () => ({
            typos: "3"
        }),
        
        // ✅ Custom mapItem για να περιλαμβάνει τα extra πεδία
        mapItem: (item, pad = 11) => {
            const val = String(item.kodikos ??  '').trim();
            const lab = `${val.padEnd(pad, '\u00A0')} - ${item.perigrafh ?? ''}`;
            
            return {
                value: val,
                kodikos: val,
                perigrafh: item.perigrafh,
                label: lab,
                
                // ✅ Τα πεδία που θα χρησιμοποιηθούν από το field-mappings
                pososto_asfalismenoy: item.pososto_asfalismenoy ?? null,
                pososto_ergodoth: item.pososto_ergodoth ?? null,
                isxyei_apo: item. isxyei_apo ?? null,
                isxyei_eos: item.isxyei_eos ?? null,
            };
        }
    }
};
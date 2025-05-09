import statheraArxeiaModel from '../models/stathera_arxeia.js';

const   {
            PeriodsModel
        } = statheraArxeiaModel;
        
export default {
    path: '/api/dropdown/tmhmata',
    model: PeriodsModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        extraQueryBuilder: (query) => ({
            xrhsh: query.xrhsh || new Date().getFullYear().toString()
        }),
    }
};

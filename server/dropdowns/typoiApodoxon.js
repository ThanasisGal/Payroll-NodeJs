import statheraArxeiaModel from '../models/stathera_arxeia.js';

const   {
            Typoi_ApodoxonModel
        } = statheraArxeiaModel;
        
export default {
    path: '/api/dropdown/tmhmata',
    model: Typoi_ApodoxonModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        // extraQueryBuilder: (query) => ({
        //     xrhsh: query.xrhsh || new Date().getFullYear().toString()
        // }),
    }
};

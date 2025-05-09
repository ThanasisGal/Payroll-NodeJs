import statheraArxeiaModel from '../models/stathera_arxeia.js';

// const   {
//             TmhmataModel
//         } = statheraArxeiaModel;
        
// export default {
//     path: '/api/dropdown/tmhmata',
//     model: TmhmataModel,
//     options: {
//         searchFields: ['perigrafh'],
//         // extraQueryBuilder: (query) => ({
//             // companyId: query.companyId,
//         // }),
//     }
// };

const   {
    EidikothtesErganhModel
} = statheraArxeiaModel;

export default {
path: '/api/dropdown/tmhmata',
model: EidikothtesErganhModel,
options: {
searchFields: ['perigrafh'],
// extraQueryBuilder: (query) => ({
    // companyId: query.companyId,
// }),
}
};

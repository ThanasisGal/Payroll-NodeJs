import companiesModel from '../models/companies.js';

const   {
            YpokatasthmataModel
        } = companiesModel;
        
export default {
    path: '/api/dropdown/ypokatasthmata',
    model: YpokatasthmataModel,
    options: {
        searchFields: ['kodikos', 'perigrafh'],
        extraQueryBuilder: (query) => ({
            team: query.team,
            companykod_object: query.company
        }),
    }
};

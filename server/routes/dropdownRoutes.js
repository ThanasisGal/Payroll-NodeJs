import { Router } from 'express';
import { buildDropdownRoute }   from '../utils/dropdownHelper.js';
import statheraArxeiaModels     from '../models/stathera_arxeia.js';
import companiesModels          from '../models/companies.js';
import typoiApodoxon            from '../dropdowns/typoiApodoxon.js';
import tmhmata                  from '../dropdowns/tmhmata.js';
import periodoi                 from '../dropdowns/periodoi.js';
import ypokatasthmata           from '../dropdowns/ypokatasthmata.js';

const router = Router();

const   {
            YpokatasthmataModel,
        } = companiesModels;

const   {
            Typoi_ApodoxonModel,
            EidikothtesErganhModel,
            PeriodsModel
        } = statheraArxeiaModels;

router.get('/typoiApodoxon',    buildDropdownRoute(Typoi_ApodoxonModel, typoiApodoxon.options));
router.get('/periodoi',         buildDropdownRoute(PeriodsModel, periodoi.options));
router.get('/ypokatasthmata',   buildDropdownRoute(YpokatasthmataModel, ypokatasthmata.options));
router.get('/tmhmata',          buildDropdownRoute(EidikothtesErganhModel, tmhmata.options));

export default router;

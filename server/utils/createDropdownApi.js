// utils/createDropdownApi.js
/**
 * Δημιουργεί handler για dropdown endpoints. 
 *
 * Options:
 * - pk:                 string            -> primary key για preselect (default:  'kodikos')
 * - searchFields:      string[]          -> πεδία για regex αναζήτηση
 * - extraQueryBuilder: (q) => object     -> επιπλέον φίλτρο από req.query
 * - mapItem:           (item, pad) => {} -> CUSTOM MAPPER - μετατρέπει ένα record
 * - sort:              object            -> default sort
 * - baseUrl:           string            -> για nextPage
 * - preselectSort:     object|null       -> sort για 2ο γύρο preselect fallback
 */

function createDropdownApi(model, options = {}) {
    const {
        pk = 'kodikos',
        searchFields = ['kodikos', 'perigrafh'],
        extraQueryBuilder = () => ({}),
        // ✅ DEFAULT mapItem - αν δεν δωθεί custom
        mapItem = (item, pad = 11) => {
            const valRaw = item[pk];
            const val    = (valRaw == null) ? '' : String(valRaw).trim();
            const kod    = (item. kodikos == null) ? '' : String(item.kodikos);
            const lab    = `${(val || '').padEnd(pad, '\u00A0')} - ${item.perigrafh ??  ''}`;
            return {
                value    : val,
                kodikos  : kod,
                perigrafh: item.perigrafh,
                label    : lab,
            };
        },
        sort = null,
        baseUrl = '',
        preselectSort = null,
    } = options;

    return async (req, res) => {
        const padLength = Number. parseInt(req.query.padLength, 10) || 11;

        try {
            // ---------- 1) Preselect by ? value= ----------
            if (req.query. value) {
                const value = String(req.query.value).trim();

                const extraQuery = extraQueryBuilder(req. query) || {};

                const withExtra = await model
                    .findOne({ ... extraQuery, [pk]: value })
                    .sort(preselectSort || {})
                    .lean();

                if (withExtra) {
                    return res.json({ items: [mapItem(withExtra, padLength)] });
                }

                const any = await model
                    .findOne({ [pk]: value })
                    . sort(preselectSort || {})
                    .lean();

                return res.json({ items: any ? [mapItem(any, padLength)] : [] });
            }

            // ---------- 2) Κανονικό search / list ----------
            const { search = '', page = 1 } = req.query;
            const limit = 50;
            const skip = (Number.parseInt(page, 10) - 1) * limit;

            const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(esc(String(search)), 'i');

            const extraQuery = extraQueryBuilder(req. query) || {};
            const searchQuery = search
                ? { $or: searchFields.map((field) => ({ [field]: regex })) }
                : {};

            const andConditions = [];
            if (Object.keys(extraQuery).length) andConditions.push(extraQuery);
            if (Object. keys(searchQuery).length) andConditions.push(searchQuery);

            const finalQuery = andConditions.length > 0 ? { $and:  andConditions } : {};

            const sortObj = sort || { [pk]: 1 };

            const [results, count] = await Promise.all([
                model. find(finalQuery).sort(sortObj).skip(skip).limit(limit).lean(),
                model.countDocuments(finalQuery),
            ]);

            const safeResults = results.filter(r => r?.[pk] != null && String(r[pk]).trim() !== '');

            if (results.length > 0) {
                return res.json({
                    items   : safeResults. map((item) => mapItem(item, padLength)),
                    hasMore : skip + safeResults.length < count,
                    nextPage: buildNextPageUrl(req, baseUrl, page, skip + safeResults.length < count),
                    totalCount: count,
                });
            }

            // ---------- 3) Fallback:  aggregation ----------
            if (req.query._dateApo && req.query._dateEos) {
                const pipeline = [
                    { $sort: { isxyei_apo: -1, [pk]: 1 } },
                    { $limit: 50 },
                    { 
                        $facet: {
                            data: [{ $skip: skip }, { $limit: limit }],
                            total: [{ $count: 'count' }],
                        },
                    },
                ];

                const agg = await model.aggregate(pipeline);
                const data = (agg[0]?.data || []);
                const totalCount = (agg[0]?.total?.[0]?.count) || 0;

                const dataSafe = (data || []).filter(r => r?.[pk] != null && String(r[pk]).trim() !== '');
                return res.json({
                    items   : dataSafe.map((item) => mapItem(item, padLength)),
                    hasMore : skip + dataSafe.length < totalCount,
                    nextPage: buildNextPageUrl(req, baseUrl, page, skip + dataSafe.length < totalCount),
                    totalCount,
                });
            }

            // Τίποτα
            return res.json({
                items:  [],
                hasMore: false,
                nextPage: null,
                totalCount: 0,
            });
        } catch (error) {
            console.error('Σφάλμα στο createDropdownApi:', error);
            res.status(500).send('Σφάλμα κατά την ανάκτηση δεδομένων.');
        }
    };
}

function buildNextPageUrl(req, baseUrl, page, hasMore) {
    if (! hasMore) return null;
    const urlBase = baseUrl || req.originalUrl. split('?')[0];
    const url = new URL(urlBase, `${req.protocol}://${req.get('host')}`);

    const original = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    for (const [k, v] of original.searchParams. entries()) {
        if (k !== 'page') url.searchParams.set(k, v);
    }
    url.searchParams.set('page', Number. parseInt(page, 10) + 1);
    return url.toString();
}

module.exports = { createDropdownApi };
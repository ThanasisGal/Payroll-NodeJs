export function createDropdownApi(model, options = {}) {
    const {
        searchFields = ['kodikos', 'perigrafh'],
        extraQueryBuilder = () => ({}),
        mapItem = (item) => ({
            value: item._id,
            label: `${item.kodikos} - ${item.perigrafh}`,
        }),
        baseUrl = '',
    } = options;
  
    return async (req, res) => {
        try {
            const { search = '', page = 1 } = req.query;
            const limit = 50;
            const skip = (parseInt(page) - 1) * limit;
  
            const regex = new RegExp(search, 'i');
            const extraQuery = extraQueryBuilder(req.query);
  
            const searchQuery = search
                ? { $or: searchFields.map(field => ({ [field]: regex })) }
                : {};
  
            const query = { ...extraQuery, ...searchQuery };
  
            const results = await model.find(query).sort({ kodikos: 1 }).skip(skip).limit(limit);
            const count = await model.countDocuments(query);
            const hasMore = skip + results.length < count;
  
            const items = results.map(mapItem);
  
            let nextPage = null;
            if (hasMore) {
                const url = new URL(baseUrl || req.originalUrl, `${req.protocol}://${req.get('host')}`);
                url.searchParams.set('page', parseInt(page) + 1);
                nextPage = url.toString();
            }
  
            res.json({ items, hasMore, nextPage, totalCount: count });
      } catch (error) {
            console.error('Σφάλμα στο createDropdownApi:', error);
            res.status(500).send('Σφάλμα κατά την ανάκτηση δεδομένων.');
        }
    };
}
  
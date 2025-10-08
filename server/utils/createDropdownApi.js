// function createDropdownApi(model, options = {}) {
//     const {
//         searchFields = ['kodikos', 'perigrafh'],
//         extraQueryBuilder = () => ({}),
//         mapItem = (item, pad = 11) => ({
//             value: item.kodikos,
//             kodikos: item.kodikos,
//             perigrafh: item.perigrafh,
//             label: `${(item.kodikos?.trim() || '').padEnd(pad, '\u00A0')} - ${item.perigrafh}`,
//         }),
//         baseUrl = '',
//     } = options;

//     return async (req, res) => {
//         const padLength = parseInt(req.query.padLength) || 11;
//         try {
//             const { search = '', page = 1 } = req.query;
//             if (req.query.value) {
//                 const rec = await model.findOne({ kodikos: req.query.value }).lean();
//                 return res.json({
//                     items: rec ? [ mapItem(rec, padLength) ] : []
//                 });
//             }
//             const limit = 50;
//             const skip = (parseInt(page) - 1) * limit;

//             const regex = new RegExp(search, 'i');
//             const extraQuery = extraQueryBuilder(req.query);

//             // Ερώτημα
//             const searchQuery = search
//                 ? { $or: searchFields.map(field => ({ [field]: regex })) }
//                 : {};

//             const finalQuery = { ...extraQuery, ...searchQuery };
//             const sortObj = options.sort || { kodikos: 1 };

//             // Εύρεση + απόλυτη ταξινόμηση
//             const results = await model
//                 .find(finalQuery)
//                 .sort(sortObj)
//                 .skip(skip)
//                 .limit(limit);

//             const count = await model.countDocuments(finalQuery);
//             const hasMore = skip + results.length < count;

//             const items = results.map(item => mapItem(item, padLength));

//             let nextPage = null;
//             if (hasMore) {
//                 const urlBase = baseUrl || req.originalUrl.split('?')[0];
//                 const url = new URL(urlBase, `${req.protocol}://${req.get('host')}`);
//                 url.searchParams.set('page', parseInt(page) + 1);
//                 nextPage = url.toString();
//             }

//             res.json({
//                 items,
//                 hasMore,
//                 nextPage,
//                 totalCount: count
//             });

//         } catch (error) {
//             console.error('Σφάλμα στο createDropdownApi:', error);
//             res.status(500).send('Σφάλμα κατά την ανάκτηση δεδομένων.');
//         }
//     };
// }

// module.exports = {
//     createDropdownApi,
// };






function createDropdownApi(model, options = {}) {
  const {
    searchFields = ['kodikos', 'perigrafh'],
    extraQueryBuilder = () => ({}),
    mapItem = (item, pad = 11) => ({
      value: item.kodikos,
      kodikos: item.kodikos,
      perigrafh: item.perigrafh,
      label: `${(item.kodikos?.trim() || '').padEnd(pad, '\u00A0')} - ${item.perigrafh}`,
    }),
    baseUrl = '',
    pk = 'kodikos',                  // <-- ΝΕΟ
  } = options;

  return async (req, res) => {
    const padLength = parseInt(req.query.padLength) || 11;
    try{
    // preselect/lookup by value
    if (req.query.value) {
      const rec = await model.findOne({ [pk]: req.query.value }).lean(); // <-- χρησιμοποίησε pk
      return res.json({ items: rec ? [mapItem(rec, padLength)] : [] });
    }

    const { search = '', page = 1 } = req.query;
    const limit = 50;
    const skip = (parseInt(page) - 1) * limit;

    const regex = new RegExp(search, 'i');
    const extraQuery = extraQueryBuilder(req.query);

    const searchQuery = search
      ? { $or: searchFields.map(field => ({ [field]: regex })) }
      : {};

    const finalQuery = { ...extraQuery, ...searchQuery };
    const sortObj = options.sort || { [pk]: 1 };            // <-- default sort με pk

    const results = await model.find(finalQuery).sort(sortObj).skip(skip).limit(limit).lean();
    const count = await model.countDocuments(finalQuery);

    res.json({
      items: results.map(item => mapItem(item, padLength)),
      hasMore: skip + results.length < count,
      nextPage: null, // (ή κράτα το όπως το έχεις)
      totalCount: count
    });
    } catch (error) {
      console.error('Σφάλμα στο createDropdownApi:', error);
      res.status(500).send('Σφάλμα κατά την ανάκτηση δεδομένων.');
    }
  };
}

module.exports = {
    createDropdownApi,
};

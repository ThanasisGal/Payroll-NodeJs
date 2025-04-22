export function createDropdownApi(model, extraQueryBuilder = () => ({})) {
    return async (req, res) => {
      try {
        const { search = '', page = 1 } = req.query;
        const limit = 30;
        const skip = (parseInt(page) - 1) * limit;
        const regex = new RegExp(search, 'i');
        const extraQuery = extraQueryBuilder(req.query);
  
        const query = {
          ...extraQuery,
          $or: [
            { kodikos: regex },
            { perigrafh: regex }
          ]
        };
  
        const results = await model.find(query)
          .sort({ kodikos: 1 })
          .skip(skip)
          .limit(limit);
  
        const count = await model.countDocuments(query);
        const hasMore = skip + results.length < count;
  
        const items = results.map(item => ({
          value: item._id,
          label: `${item.kodikos} - ${item.perigrafh}`,
          customProperties: item.apo || item.eos ? {
            kodikos: item.kodikos,
            apo: item.apo,
            eos: item.eos,
          } : undefined,
        }));
  
        res.json({ items, hasMore });
      } catch (error) {
        console.error('Σφάλμα στο createDropdownApi:', error);
        res.status(500).send('Σφάλμα κατά την ανάκτηση δεδομένων.');
      }
    };
  }

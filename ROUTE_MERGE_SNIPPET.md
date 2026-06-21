# Route merge snippet για Τύπους Αποδοχών

Στο `server/routes/dropdownRoutes.js` πρόσθεσε στα require:

```js
const typoiApodoxonApasxolhseon = require('../dropdowns/kinhseis/apasxolhseis/typoiApodoxon');
```

Και στα routes, μαζί με τα άλλα `/kinhseis/apasxolhseis/...`, πρόσθεσε:

```js
router.get(
    '/kinhseis/apasxolhseis/typoiApodoxon',
    buildDropdownRoute(typoiApodoxonApasxolhseon.model, typoiApodoxonApasxolhseon.options)
);
```

Το τελικό endpoint θα είναι:

```text
/api/dropdown/kinhseis/apasxolhseis/typoiApodoxon
```

Γρήγορο test από browser μετά το restart:

```text
http://localhost:5000/api/dropdown/kinhseis/apasxolhseis/typoiApodoxon?search=&page=1&limit=200
```

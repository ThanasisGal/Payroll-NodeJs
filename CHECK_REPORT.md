Checks:
- node --check public/js/kinhseis/apasxolhseis/loadDropdowns.js OK
- node --check public/js/kinhseis/apasxolhseis/apasxolhseis.js OK
- node --check public/js/kinhseis/apasxolhseis/clearFormFields.js OK
- node --check server/controllers/Kinhseis/kinhseisController.js OK

Notes:
- formatValue() in loadDropdowns.js now defaults to 2 decimals.
- All `ores...` field blur formatters in apasxolhseis.js now use 2 decimals.
- Hourly wage fields remain 4 decimals.

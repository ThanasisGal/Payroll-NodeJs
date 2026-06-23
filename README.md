# apasxolhseis_ores_fields_2_decimals_display_fix

Βάση: `apasxolhseis_oromisthia_4_decimals_fix.zip`.

Αλλαγές:

1. Τα πεδία ωρών `ores...` που γεμίζουν από `ProdhlomenaOrariaModel` εμφανίζονται πλέον με 2 δεκαδικά.
   - π.χ. `44.9300` -> `44.93`
   - `5.8100` -> `5.81`
   - `0` -> `0.00`

2. Τα blur formatters των πεδίων ωρών άλλαξαν σε 2 δεκαδικά.

3. Τα ωρομίσθια παραμένουν με 4 δεκαδικά:
   - `nomimoOromisthio`
   - `pragmatikoOromisthio`

Δεν αλλάχθηκαν controller, Mongo queries, save logic, TomDropdowns ή τύποι υπολογισμών.

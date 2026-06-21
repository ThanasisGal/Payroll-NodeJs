# CSS merge report

Ενσωματώθηκε το scoped CSS για το TomDropdown του υποκαταστήματος στο `public/css/main.css`.

Έλεγχος πριν την προσθήκη:

- Δεν βρέθηκε υπάρχον marker `APASXOLHSEIS_TOMDROPDOWN_UI_FIX_START` στο δοθέν `main.css`.
- Δεν βρέθηκαν υπάρχοντες selectors:
  - `.apasxolhseis-ypokatasthma-label-col`
  - `.apasxolhseis-ypokatasthma-col`
  - `.apasxolhseis-ypokatasthma-select`

Το CSS είναι scoped κάτω από `#apasxolhseisForm`, ώστε να μη χτυπάει άλλα TomDropdowns/φόρμες.

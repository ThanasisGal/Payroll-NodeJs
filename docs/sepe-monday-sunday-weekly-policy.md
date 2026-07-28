# Πολιτική εβδομάδας Σ.ΕΠ.Ε. (2026-07)

Policy versions:

- weekly repo scenario: `repo-transfer-single-pair:v3`
- decision snapshot: `weekly-repo-transfer-decision-snapshot:v2`
- sixth/seventh day: `sepe-weekly-sixth-seventh-day:v1`
- work facts: `workFactsPrecalc:v2`
- carry-over: `weekly-payroll-carry-over:v1`

Η φυσική εβδομάδα ορίζεται αποκλειστικά ως Δευτέρα 00:00:00.000Z έως
Κυριακή 23:59:59.999Z. Η Κυριακή διατηρεί τη σημασία της για αργίες και
προσαυξήσεις, αλλά είναι η τελευταία ημέρα του εβδομαδιαίου bucket.

Τα αναμενόμενα ρεπό προκύπτουν από το ημερομηνιακά ισχύον συμβατικό profile:
πενθήμερο `2`, εξαήμερο `1`. Το observed ή προδηλωμένο πλήθος ημερών δεν
μεταβάλλει το συμβατικό profile. Αλλαγή κρίσιμων όρων μέσα στην ίδια εβδομάδα
επιστρέφει `NEEDS_HR_DECISION / PROFILE_CHANGED_INSIDE_WEEK`.

Το ημερομηνιακά ισχύον `pososto_prosayxhshs_6hs_hmeras` αποθηκεύεται ως
ποσοστό (π.χ. `40`) στον εργαζόμενο και στο ιστορικό. Κενή, μη αριθμητική ή
αρνητική τιμή υφιστάμενου profile επιστρέφει
`MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE`; δεν εφαρμόζεται υπολογιστικό
fallback.

Οι εβδομάδες που διασχίζουν μήνα αξιολογούνται ολόκληρες. Οι προηγούμενες
ημέρες της πρώτης εβδομάδας είναι read context. Διαφορές που οριστικοποιούνται
στον επόμενο μήνα φέρουν source week/month, target payroll month και
deterministic idempotency key. Η υλοποίηση δεν ξαναγράφει κλεισμένη μισθοδοσία
και δεν απαιτεί migration ή backfill.

Legacy decisions παραμένουν αναγνώσιμες. Reconstruction/apply με παλιό
proposal version αποτυγχάνει κλειστά ως μη υποστηριζόμενη έκδοση.

# apasxolhseis_employee_pipeline_stage7_alert_default_swal_fix

Βάση: `apasxolhseis_employee_pipeline_stage6_alert_layout_fix.zip`.

Διορθώσεις:

1. Αφαιρέθηκε το custom SweetAlert layout/CSS που χαλούσε τη φόρμα και μετακινούσε το alert.
2. Το alert εκτός περιόδου χρησιμοποιεί πλέον default centered `Swal.fire()` με `icon: warning`.
3. Διατηρείται το καθαρό μήνυμα και η εμφάνιση μετά το pipeline loader.
4. Δεν άλλαξαν υπολογισμοί, controller, Mongo, save logic, TomDropdowns ή clearFormFields.


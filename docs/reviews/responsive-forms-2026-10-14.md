# Προσαρμοστικές φόρμες — τεκμηρίωση ελέγχου 14/10/2026

Η εργασία αφορά αποκλειστικά το PR #312, στον κλάδο `feat/employment-review-guidance`, με αφετηρία το `ae67a5c30`, στον φάκελο `Payroll-NodeJs-guidance`.

## Κοινή αιτία και αποκατάσταση

Η σύγκριση του `ae67a5c30` με την προηγούμενη διάταξη έδειξε ότι οι κανόνες `.maintenance-responsive-form .row.form-group > div` άλλαζαν ανεξάρτητα τις στήλες ετικέτας και πεδίου. Κάτω από `70rem` κάθε στήλη αποκτούσε `flex: 1 1 12rem`, ενώ οι ετικέτες διαφορετικό `flex-basis: 10rem`. Οι επιλογείς `:has(.btn)` άλλαζαν επιπλέον πλάτη και ελάχιστα πλάτη. Στην πραγματική Συντήρηση Εταιρείας αυτό τοποθετούσε το «Τ.Κ.» δίπλα στον «Αριθμό», ενώ το δικό του πεδίο μεταφερόταν αλλού. Η γενική μετατροπή της κεφαλίδας εργαζομένου σε πλέγμα είχε το ίδιο δομικό πρόβλημα.

Αυτοί οι κανόνες αντικαταστάθηκαν. Το `common/formLayout.js` αναγνωρίζει τις πραγματικές σχέσεις `label`/`for`, κρατά τους αρχικούς κόμβους και τις στήλες τους, και μετακινεί ολόκληρο το ζεύγος σε `.payroll-field-group`. Κρυφά πεδία, τιμές, ονόματα, συνδέσεις με `form` και χειριστές συμβάντων διατηρούνται. Ο έλεγχος των 94 σελίδων συγκρίνει τους ίδιους κόμβους, τη σειρά, τις τιμές, `checked`, `disabled`, `form` και ολόκληρο το `FormData`, και απαιτεί μηδέν ανεπιθύμητα `change`.

Οι υπάρχουσες `.row`, `.col-*` και `.input-group` δεν μετατρέπονται καθολικά. Εξαιρούνται ρητά οι γραμμές ωραρίου, οι ενιαίες γραμμές κρατήσεων εργαζομένου, οι πίνακες καταχώρισης Κινήσεων και ο ειδικός χώρος Ελέγχου Απασχολήσεων. Στις Κρατήσεις εργαζομένου διατηρείται η σειρά επιλογέα–Α.Μ.Α.–καθαρισμού και η γραμμή αποτελεί μία συνεκτική ομάδα. Οι τρεις επιπλέον φορείς είχαν ετικέτες σε ξεχωριστή προηγούμενη γραμμή: κάθε ετικέτα μεταφέρθηκε στον δικό της περιέκτη με `for`, μαζί με τον επιλογέα και τον καθαρισμό. Η οπτική επιθεώρηση περιέλαβε και το κάτω μέρος όλων των 129 ενοτήτων, όπου εντοπίστηκε αυτή η αστοχία. Οι Ασθένειες, Άδειες και Κρατήσεις Κινήσεων διατηρούν τη δομή τους ως πίνακες καταχώρισης με εσωτερική οριζόντια κύλιση. Οι Φόροι χρησιμοποιούν τη δική τους διάταξη τριών στηλών: περιγραφή, ετήσιο ποσό και μηνιαίο ποσό, με ελάχιστο πλάτος 35rem. Αντικαταστάθηκαν μόνο εκεί τα παλιά πλάτη στηλών με `!important`, τα οποία συμπίεζαν τα ποσά σε περίπου 27px. Η νέα δοκιμή απαιτεί πλάτος τουλάχιστον 120px ανά ποσό. Η πρόσθετη ονομασία `aria-labelledby` συνδέει κάθε ποσό τόσο με την περιγραφή όσο και με την ετήσια/μηνιαία επικεφαλίδα.

Διορθώθηκαν επίσης λανθασμένα `for`, συνδέσεις με κρυφά πεδία αποθήκευσης, μη συμπληρωμένα μηδενικά σε αναγνωριστικά κρατήσεων, επικεφαλίδες ομάδων επιλογών και πληροφορίες μόνο για ανάγνωση. Ο Tom Select μεταφέρει το `for` σε δικό του κόμβο· η ομαδοποίηση και ο έλεγχος ανακτούν τον πραγματικό επιλογέα μέσω της σχέσης του με το `control`/`control_input`.

Το `navTabs.css`, που φορτώνεται μετά το `main.css`, επέβαλλε ελάχιστο πλάτος `600px` και πλάτος καρτελών `12.5vw`. Οι νέοι κανόνες περιορίζονται στην κοινή `.payroll-form-layout` και κρατούν τις καρτέλες σε μία γραμμή με εσωτερική κύλιση. Η επάνω μπάρα μετριέται πραγματικά όταν γίνεται πολυγραμμική και ενημερώνει το διαθέσιμο ύψος και τη θέση του πλευρικού μενού.

## Χειριστήρια και κύλιση

Η κοινή μεταβλητή `--payroll-control-font` είναι `clamp(.9rem, .78rem + .25cqi, 1rem)` και χρησιμοποιείται από πεδία, εγγενείς επιλογείς, Tom Select και συνηθισμένα κουμπιά. Δεν αυξήθηκε η βασική γραμματοσειρά της εφαρμογής. Διατηρείται η ειδική κλίμακα του Ελέγχου Απασχολήσεων έως 16.8px, κοινή για τα πεδία και τα κουμπιά του· οι υπόλοιπες συνηθισμένες περιοχές μετρήθηκαν στα 14.4–16px. Τα συνηθισμένα κουμπιά έχουν βάρος `400`, εικονίδια `1em`, μονόγραμμες λεζάντες, γωνίες `6px`, ανοιχτή κανονική κατάσταση και συμπαγή αιώρηση. Διατηρούνται οι ειδικές διατάξεις χειριστηρίων καθαρισμού, μικρών εικονιδίων, ενεργειών ιστορικού και των προϋπαρχόντων ειδικών παραθύρων PDF· το κείμενο «Έλεγχος / Διόρθωση» χρησιμοποιεί την αναγνώσιμη κοινή κλίμακα.

Στον επιμέρους έλεγχο πραγματικού εργαζομένου, πεδίο, εγγενής επιλογέας, εξωτερικό περίβλημα Tom Select και κουμπί μετρήθηκαν σε ύψος `36px`. Το εσωτερικό `control` του Tom Select είναι `34px` συν περίγραμμα. Η πολλαπλή επιλογή διατηρεί φυσικό ύψος όταν απαιτείται. Η επιλεγμένη απλή τιμή δεν κληρονομεί πλέον τα περιθώρια των ετικετών πολλαπλής επιλογής. Στην πολλαπλή επιλογή χρησιμοποιείται μία εμφάνιση των επιλεγμένων τιμών, με διατήρηση του καθαρισμού, της αφαίρεσης και του καταλόγου επιπλέον τιμών.

Οι ανταγωνιστικές μετατοπίσεις `820px`, `40vw`, `translateX` και ο παρατηρητής που επανέγραφε το πλάτος καταργήθηκαν από το `initTomDropdown.js`. Το `dropdown-item.js` υπολογίζει πλάτος, θέση, φορά ανοίγματος και ύψος μέσα στην πραγματική τομή των περιεκτών κύλισης και του παραθύρου. Ο πλήρης κατάλογος και τα αποτελέσματα αναζήτησης ακολουθούν τα ίδια όρια. Οι αρχικές λειτουργίες επιλογής, φόρτωσης και συγχρονισμού τιμών διατηρούνται.

Οι μεγάλες φόρμες χρησιμοποιούν κατάλληλο `overflow-y: auto`. Σε στενό διαθέσιμο πλάτος, ένας ψηλός τίτλος/κεφαλίδα δεν συμπιέζει τα πεδία σε ελάχιστη εσωτερική περιοχή: η απλή φόρμα κυλά ως σύνολο. Οι μεγάλοι πίνακες διατηρούν ανεξάρτητη οριζόντια κύλιση και η κεφαλίδα ακολουθεί τις γραμμές. Διορθώθηκαν οι στενές στήλες κωδικών/ΑΦΜ, η σελίδωση και η ασυμφωνία `col-5`/`col-11` στην αναζήτηση συμβάσεων. Τα κάτω κουμπιά δεν καλύπτουν τα πεδία. Τα παράθυρα SweetAlert κεντράρονται χωρίς την παλιά μετατόπιση `left: 5%`.

## Πραγματικές μετρήσεις και αποτελέσματα

Κάθε ανάλυση περιλαμβάνει 129 ενότητες με ανοικτό και κλειστό πλευρικό μενού: 258 περιπτώσεις. Οι τιμές είναι πραγματικές υπολογισμένες γραμματοσειρές των συνηθισμένων κουμπιών. Όπου υπάρχει αντίστοιχο πεδίο στην ίδια περιοχή, απαιτείται απόκλιση το πολύ `0.1px`.

| Ανάλυση | Περιπτώσεις | Κουμπιά, ανοικτό μενού | Κουμπιά, κλειστό μενού | Ευρήματα μετά τη διόρθωση |
|---|---:|---|---|---:|
| 1920×1080 | 258 | 15.84px, 16px | 16px, 16.8px | 0 |
| 1680×1050 | 258 | 15.024px, 15.93px | 16px, 16.032px | 0 |
| 1600×900 | 258 | 14.752px, 15.76px | 15.712px, 16px | 0 |
| 1440×900 | 258 | 14.4px, 15.41px | 15.072px, 15.96px | 0 |
| 1280×1024 | 258 | 14.4px, 15.01px | 14.432px, 15.56px | 0 |
| 1280×800 | 258 | 14.4px, 15.01px | 14.432px, 15.56px | 0 |
| 1280×720 | 258 | 14.4px, 15.01px | 14.432px, 15.56px | 0 |
| 1100×700 | 258 | 14.4px, 14.56px | 14.4px, 15.11px | 0 |
| 800×700 | 258 | 14.4px | 14.4px | 0 |

Οι δοκιμές αλληλεπίδρασης κάλυψαν **57 εγγενείς επιλογείς**, **204 ορατούς Tom Select** (6 απενεργοποιημένους), **198 πραγματικές αναζητήσεις/επιλογές** και **195 καθαρισμούς**. Ελέγχονται πλήρεις κατάλογοι 60 επιλογών, η κύλισή τους, η αναζήτηση, η επιλογή με πραγματικό συμβάν `change`, οι εσωτερικοί και οι εξωτερικοί καθαρισμοί Κρατήσεων. Οι καταστάσεις εστίασης, σφάλματος, απενεργοποίησης και απόκρυψης/επανεμφάνισης ομάδων ελέγχονται σε πραγματικά πρότυπα. Ελέγχονται επίσης επιλογές ραδιοκουμπιών, πλαίσια επιλογής και επιλογή συνθετικού αρχείου.

Η πρόσβαση στις ενέργειες ελέγχεται και με `click({trial:true})` του Playwright: γίνεται πραγματικός έλεγχος δυνατότητας κλικ χωρίς εκτέλεση της ενέργειας. Ελέγχονται πρώτο/τελευταίο πεδίο και η τελευταία στήλη σε **28** περιέκτες οριζόντιας κύλισης.

Οι 2.322 περιπτώσεις συμπληρώνονται από τις παλαιότερες σχετικές δοκιμές Συντήρησης (666 περιπτώσεις), τις δοκιμές πλήρους πραγματικού ωραρίου εργαζομένου με 84 πεδία ώρας, τις δοκιμές κουμπιών και την εξειδικευμένη δοκιμή Ελέγχου Απασχολήσεων στις εννέα αναλύσεις και στις δύο καταστάσεις μενού. Το πραγματικό παράθυρο πληροφοριών εργαζομένου στις Κινήσεις ελέγχθηκε και στους 18 συνδυασμούς, με συνθετικές τιμές, αναγνώσιμη γραμματοσειρά, κύλιση και διατήρηση της εμφάνισης όταν ο δείκτης μεταφέρεται στο περιεχόμενό του. Το διαθέσιμο ύψος μετριέται κατά το άνοιγμα. Τα δύο ειδικά παράθυρα μεταφόρτωσης/προεπισκόπησης αρχείων εργαζομένου ανοίγουν επίσης σε όλους τους 18 συνδυασμούς, με έλεγχο πλήρων λεζαντών, γραμματοσειρών και δυνατότητας κλικ χωρίς μεταφόρτωση. Η εξειδικευμένη δοκιμή Ελέγχου Απασχολήσεων ανοίγει επεξηγήσεις, παράθυρο ημέρας, επεξεργαστή, προεπισκοπήσεις και επιβεβαιώσεις με απομονωμένα συνθετικά δεδομένα. Τα πεδία και κουμπιά των ειδικών SweetAlert χρησιμοποιούν την ίδια κλίμακα `15.2–16.8px`, ενώ των γενικών παραθύρων `16px`.

Έγινε έλεγχος σύνταξης JavaScript, μεταγλώττιση και των 183 EJS, ανάλυση CSS χωρίς σφάλματα ή προειδοποιήσεις, έλεγχος YAML, `git diff --check`, και 30 σχετικοί συμβατικοί έλεγχοι χειριστηρίων/πληκτρολογίου/απογραφής. Δεν εκτελέστηκε ολόκληρη η επιχειρησιακή σουίτα τοπικά.

## Οπτική επιθεώρηση και τεκμήρια

Επιθεωρήθηκαν αντιπροσωπευτικά στιγμιότυπα όλων των 129 ενοτήτων στα 1280×720 και 800×700, καθώς και επιλεγμένες πλήρεις εικόνες και εικόνες μεγάλου πλάτους. Τα στιγμιότυπα παράγονται από τα πραγματικά EJS μέσα στο πραγματικό `layouts/main.ejs`, με `bootstrap.min.css`, `main.css`, `navTabs.css`, Tom Select 2.4.3, Bootstrap Icons και πραγματικά Roboto Mono. Δεν χρησιμοποιείται απλοποιημένη ανακατασκευή φόρμας. Η λήψη περιμένει να σταθεροποιηθεί η διάταξη μετά την αλλαγή πλάτους/καρτέλας.

Ο οπτικός έλεγχος εντόπισε προβλήματα πέρα από τις γεωμετρικές δοκιμές: αποσύνδεση Τ.Κ., επικάλυψη στοιχείων εταιρείας μόνο για ανάγνωση, κατακόρυφα διαλυμένη ένδειξη α/α, διπλό κείμενο πολλαπλών επιλογών, κρυμμένη κεφαλίδα Ποσοστών Κρατήσεων, δυσανάγνωστες επικεφαλίδες Κινήσεων, σπασμένους κωδικούς, ασύμφωνες στήλες Συμβάσεων και πεδία ποσών Φόρων πλάτους μόλις 27px. Τα αντίστοιχα διορθωμένα στιγμιότυπα επανελέγχθηκαν.

Το τοπικό σύνολο τεκμηρίων βρίσκεται στο `/tmp/payroll-responsive-312/evidence/`, με συλλογή `index.html`, πλήρεις εικόνες, αποτελέσματα και συγκεντρωτικούς πίνακες εικόνων. Το CI αποθηκεύει επίσης το τεκμήριο `employment-review-guidance-visual` με εικόνες και πρωτογενείς μετρήσεις. Η μηχανικά αναγνώσιμη σύνοψη είναι το `responsive-forms-coverage-2026-10-14.json` και η αναλυτική απογραφή το `test/fixtures/responsiveFormsInventory.json`.

## Απογραφή πραγματικών σελίδων και διαδρομών

Όλες οι παρακάτω σελίδες καλύφθηκαν από πραγματική απόδοση, σημασιολογικούς ελέγχους και δοκιμές χειριστηρίων. Η κοινή ενοποίηση εφαρμόζεται και στις 94. Οι στοχευμένες αλλαγές προτύπων καταγράφονται χωριστά παρακάτω.

| Πρότυπο EJS | Πραγματικές διαδρομές | Ενότητες | Συνδυασμοί |
|---|---|---:|---:|
| `views/404.ejs` | `GET * (404)` | 1 | 18 |
| `views/admin/activeSessions.ejs` | `GET /admin/active-sessions` | 1 | 18 |
| `views/admin/disconnectUsers.ejs` | `GET /admin/disconnect-users` | 1 | 18 |
| `views/admin/uploadTemplates.ejs` | `GET /api/admin/aws_s3` | 1 | 18 |
| `views/admin/usageReport.ejs` | `GET /admin/usage-report` | 1 | 18 |
| `views/companies/antistoixiseis/add.ejs` | `GET /companies/antistoixiseis/add/:id`<br>`GET /companies/antistoixiseis/addFromNested/:id` | 1 | 18 |
| `views/companies/antistoixiseis/antistoixiseis.ejs` | `GET /companies/antistoixiseis` | 1 | 18 |
| `views/companies/antistoixiseis/edit.ejs` | `GET /companies/antistoixiseis/edit/:id` | 1 | 18 |
| `views/companies/antistoixiseis/search.ejs` | `GET /companies/antistoixiseis/search`<br>`POST /companies/antistoixiseis/search` | 1 | 18 |
| `views/companies/genikastoixeia/add.ejs` | `GET /companies/genikastoixeia/add` | 8 | 144 |
| `views/companies/genikastoixeia/companies.ejs` | `GET /companies/genikastoixeia` | 1 | 18 |
| `views/companies/genikastoixeia/edit.ejs` | `GET /companies/genikastoixeia/edit/:id` | 8 | 144 |
| `views/companies/genikastoixeia/search.ejs` | `POST /companies/genikastoixeia/search`<br>`GET /companies/genikastoixeia/search` | 1 | 18 |
| `views/companies/nomimoi_ekprosopoi/add.ejs` | `GET /companies/nomimoi_ekprosopoi/add` | 1 | 18 |
| `views/companies/nomimoi_ekprosopoi/edit.ejs` | `GET /companies/nomimoi_ekprosopoi/edit/:id` | 1 | 18 |
| `views/companies/nomimoi_ekprosopoi/nomimoi_ekprosopoi.ejs` | `GET /companies/nomimoi_ekprosopoi` | 1 | 18 |
| `views/companies/nomimoi_ekprosopoi/search.ejs` | `GET /companies/nomimoi_ekprosopoi/search`<br>`POST /companies/nomimoi_ekprosopoi/search` | 1 | 18 |
| `views/companies/passwords/add.ejs` | `GET /companies/passwords/add` | 1 | 18 |
| `views/companies/passwords/edit.ejs` | `GET /companies/passwords/edit/:id` | 1 | 18 |
| `views/companies/passwords/passwords.ejs` | `GET /companies/passwords` | 1 | 18 |
| `views/companies/passwords/search.ejs` | `GET /companies/passwords/search`<br>`POST /companies/passwords/search` | 1 | 18 |
| `views/companies/trapezes/add.ejs` | `GET /companies/trapezes/add` | 1 | 18 |
| `views/companies/trapezes/edit.ejs` | `GET /companies/trapezes/edit/:id` | 1 | 18 |
| `views/companies/trapezes/search.ejs` | `GET /companies/trapezes/search`<br>`POST /companies/trapezes/search` | 1 | 18 |
| `views/companies/trapezes/trapezes.ejs` | `GET /companies/trapezes` | 1 | 18 |
| `views/companies/ypokatasthmata/add.ejs` | `GET /companies/ypokatasthmata/add` | 2 | 36 |
| `views/companies/ypokatasthmata/edit.ejs` | `GET /companies/ypokatasthmata/edit/:id` | 2 | 36 |
| `views/companies/ypokatasthmata/search.ejs` | `POST /companies/ypokatasthmata/search`<br>`GET /companies/ypokatasthmata/search` | 1 | 18 |
| `views/companies/ypokatasthmata/ypokatasthmata.ejs` | `GET /companies/ypokatasthmata` | 1 | 18 |
| `views/dates/appDate.ejs` | `GET /dates/getAppDateForm` | 1 | 18 |
| `views/dates/periods.ejs` | `GET /dates/getPeriodsForm` | 1 | 18 |
| `views/dates/yearInUse.ejs` | `GET /dates/getYearsForm` | 1 | 18 |
| `views/ektyposeis/apasxolhseis/atomikesEkkathariseis.ejs` | `GET /ektyposeis/apasxolhseis/ektyposhApasxolhseon` | 1 | 18 |
| `views/ektyposeis/symbaseis/symbaseisErgazomenon.ejs` | `GET /ektyposeis/symbaseis/ektyposhSymbaseonErgazomenon` | 1 | 18 |
| `views/ergazomenoi/ergazomenoi/add.ejs` | `GET /ergazomenoi/ergazomenoi/add` | 8 | 144 |
| `views/ergazomenoi/ergazomenoi/edit.ejs` | `GET /ergazomenoi/ergazomenoi/edit/:id` | 8 | 144 |
| `views/ergazomenoi/ergazomenoi/employment-profile-conflict.ejs` | `GET /ergazomenoi/ergazomenoi/edit/:id` | 1 | 18 |
| `views/ergazomenoi/ergazomenoi/ergazomenoi.ejs` | `GET /ergazomenoi/ergazomenoi` | 1 | 18 |
| `views/ergazomenoi/ergazomenoi/search.ejs` | `GET /ergazomenoi/ergazomenoi/search`<br>`POST /ergazomenoi/ergazomenoi/search` | 1 | 18 |
| `views/ergazomenoi/programmata/antigrafhProgrammatonErgasias.ejs` | `GET /ergazomenoi/programmata/antigrafhProgrammaton` | 1 | 18 |
| `views/ergazomenoi/programmata/apologistikosPinakasOrarion.ejs` | `GET /ergazomenoi/programmata/apologistikosPinakasOrarion` | 1 | 18 |
| `views/ergazomenoi/programmata/apologistikosPinakasYperorion.ejs` | `GET /ergazomenoi/programmata/apologistikosPinakasYperorion` | 1 | 18 |
| `views/ergazomenoi/programmata/calcApasxolhseisPeriodoy.ejs` | `GET /ergazomenoi/programmata/calcApasxolhseisPeriodoy` | 1 | 18 |
| `views/ergazomenoi/programmata/ektyposhOristikouApologistikouPinaka.ejs` | `GET /ergazomenoi/programmata/ektyposhOristikouApologistikouPinaka` | 1 | 18 |
| `views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs` | `GET /ergazomenoi/programmata/elegxosApasxolhseonPeriodoy` | 1 | 18 |
| `views/ergazomenoi/programmata/exagoghOrarionSeErganh.ejs` | `GET /ergazomenoi/programmata/exagoghOrarionSeErganh` | 1 | 18 |
| `views/ergazomenoi/programmata/katastashElegxouApologistikouPinaka.ejs` | `GET /ergazomenoi/programmata/katastashElegxouApologistikouPinaka` | 1 | 18 |
| `views/ergazomenoi/programmata/lhpshOrarionApoErganh.ejs` | `GET /ergazomenoi/programmata/lhpshOrarionApoErganh` | 1 | 18 |
| `views/ergazomenoi/programmata/lhpshOrarionApoKartes.ejs` | `GET /ergazomenoi/programmata/lhpshOrarionApoKartes` | 1 | 18 |
| `views/ergazomenoi/programmata/lhpshProdhlomenonOrarionMonoDaneizomenon.ejs` | `GET /ergazomenoi/programmata/lhpshProdhlomenonOrarionMonoDaneizomenon` | 1 | 18 |
| `views/ergazomenoi/programmata/lhpshPshfiakonKartonMonoDaneizomenon.ejs` | `GET /ergazomenoi/programmata/lhpshPshfiakonKartonMonoDaneizomenon` | 1 | 18 |
| `views/ergazomenoi/programmata/programmaErgasias.ejs` | `GET /ergazomenoi/programmata/programmaErgasias` | 1 | 18 |
| `views/ergazomenoi/programmata/ypovoliAdeion.ejs` | `GET /ergazomenoi/programmata/ypovoliAdeion` | 1 | 18 |
| `views/home.ejs` | `GET /` | 1 | 18 |
| `views/index.ejs` | `GET /admin` | 1 | 18 |
| `views/kinhseis/apasxolhseis.ejs` | `GET /kinhseis/apasxolhseis` | 6 | 108 |
| `views/krathseis/genika/add.ejs` | `GET /krathseis/genika/add` | 1 | 18 |
| `views/krathseis/genika/edit.ejs` | `GET /krathseis/genika/edit/:id` | 1 | 18 |
| `views/krathseis/krathseis.ejs` | `GET /krathseis/krathseis` | 1 | 18 |
| `views/krathseis/pososta/add.ejs` | `GET /krathseis/pososta/add` | 1 | 18 |
| `views/krathseis/pososta/edit.ejs` | `GET /krathseis/posostaKrathseon/edit/:id` | 1 | 18 |
| `views/krathseis/search.ejs` | `GET /krathseis/search`<br>`POST /krathseis/search` | 1 | 18 |
| `views/login/change_password.ejs` | `GET /login/change_password`<br>`POST /login/change_password/changepassword` | 1 | 18 |
| `views/login/login.ejs` | `GET /login`<br>`POST /register/userRegistration`<br>`POST /login/userLogin` | 1 | 18 |
| `views/login/logout.ejs` | `GET /login/logout` | 1 | 18 |
| `views/login/register.ejs` | `GET /register`<br>`POST /register/userRegistration` | 1 | 18 |
| `views/login/reset_password.ejs` | `GET /reset_password` | 1 | 18 |
| `views/login/set_new_password.ejs` | `GET /login/reset_old_password/:uid/:token`<br>`POST /login/reset_old_password/:uid/:token` | 1 | 18 |
| `views/login/verify_email.ejs` | `GET /login/verify-email` | 1 | 18 |
| `views/mainapp.ejs` | `GET /mainapp` | 1 | 18 |
| `views/search.ejs` | `POST /admin/search`<br>`GET /admin/search` | 1 | 18 |
| `views/symbaseis/eidikothtes/add.ejs` | `GET /symbaseis/eidikothtes/add/:kodikosSymbashs_Kathgorias` | 1 | 18 |
| `views/symbaseis/eidikothtes/edit.ejs` | `GET /symbaseis/eidikothtes/edit/:id` | 1 | 18 |
| `views/symbaseis/eidikothtes/eidikothtes.ejs` | `GET /symbaseis/eidikothtes` | 1 | 18 |
| `views/symbaseis/eidikothtes/search.ejs` | `GET /symbaseis/eidikothtes/search`<br>`POST /symbaseis/eidikothtes/search/:kodikos_symbashs_kathgorias` | 1 | 18 |
| `views/symbaseis/kathgories/add.ejs` | `GET /symbaseis/kathgories/add/:kodikosSymbashs` | 1 | 18 |
| `views/symbaseis/kathgories/edit.ejs` | `GET /symbaseis/kathgories/edit/:id` | 1 | 18 |
| `views/symbaseis/kathgories/kathgories.ejs` | `GET /symbaseis/kathgories` | 1 | 18 |
| `views/symbaseis/kathgories/search.ejs` | `POST /symbaseis/kathgories/search/:symbash`<br>`GET /symbaseis/kathgories/search` | 1 | 18 |
| `views/symbaseis/klimakia/klimakiaSymbaseon.ejs` | `GET /symbaseis/klimakia` | 1 | 18 |
| `views/symbaseis/stoixeiaSymbaseon/add.ejs` | `GET /symbaseis/stoixeiaSymbaseon/add/:kodikosSymbashs_Kathgorias_Eidikothtas` | 1 | 18 |
| `views/symbaseis/stoixeiaSymbaseon/edit.ejs` | `GET /symbaseis/stoixeiaSymbaseon/edit/:id` | 1 | 18 |
| `views/symbaseis/stoixeiaSymbaseon/search.ejs` | `POST /symbaseis/stoixeiaSymbaseon/search/:kodikos_symbashs_kathgorias_eidikothtas`<br>`GET /symbaseis/stoixeiaSymbaseon/search` | 1 | 18 |
| `views/symbaseis/stoixeiaSymbaseon/stoixeiaSymbaseon.ejs` | `GET /symbaseis/stoixeiaSymbaseon` | 1 | 18 |
| `views/symbaseis/symbaseis/add.ejs` | `GET /symbaseis/symbaseis/add` | 1 | 18 |
| `views/symbaseis/symbaseis/edit.ejs` | `GET /symbaseis/symbaseis/edit/:id` | 1 | 18 |
| `views/symbaseis/symbaseis/search.ejs` | `GET /symbaseis/symbaseis/search`<br>`POST /symbaseis/symbaseis/search` | 1 | 18 |
| `views/symbaseis/symbaseis/symbaseis.ejs` | `GET /symbaseis/symbaseis` | 1 | 18 |
| `views/symbaseis/ypologismoiKlimakion/ypologismoiKlimakion.ejs` | `GET /symbaseis/ypologismoiKlimakion` | 1 | 18 |
| `views/users/add.ejs` | `GET /admin/add` | 1 | 18 |
| `views/users/delete.ejs` | `GET /admin/delete/:id` | 1 | 18 |
| `views/users/dikaiomataXrhston.ejs` | `GET /admin/user-privileges` | 1 | 18 |
| `views/users/edit.ejs` | `GET /admin/edit/:id` | 1 | 18 |
| `views/users/view.ejs` | `GET /admin/view/:id` | 1 | 18 |

## Επιμέρους πρότυπα και κατάλογος φορμών

Τα 83 επιμέρους πρότυπα περιλαμβάνονται στις παραπάνω γονικές σελίδες. Μεταγλωττίστηκε επίσης το κοινό `views/layouts/main.ejs`.

- `views/companies/genikastoixeia/partials/add/cardBodies/diadoxosErgodoths.ejs`
- `views/companies/genikastoixeia/partials/add/cardBodies/diafora.ejs`
- `views/companies/genikastoixeia/partials/add/cardBodies/drasthriothtes.ejs`
- `views/companies/genikastoixeia/partials/add/cardBodies/emmesosErgodoths.ejs`
- `views/companies/genikastoixeia/partials/add/cardBodies/iatrosErgasias.ejs`
- `views/companies/genikastoixeia/partials/add/cardBodies/logisths.ejs`
- `views/companies/genikastoixeia/partials/add/cardBodies/statheraStoixeia.ejs`
- `views/companies/genikastoixeia/partials/add/cardBodies/texnikosAsfaleias.ejs`
- `views/companies/genikastoixeia/partials/add/cardFooter.ejs`
- `views/companies/genikastoixeia/partials/add/cardHeader.ejs`
- `views/companies/genikastoixeia/partials/edit/cardBodies/diadoxosErgodoths.ejs`
- `views/companies/genikastoixeia/partials/edit/cardBodies/diafora.ejs`
- `views/companies/genikastoixeia/partials/edit/cardBodies/drasthriothtes.ejs`
- `views/companies/genikastoixeia/partials/edit/cardBodies/emmesosErgodoths.ejs`
- `views/companies/genikastoixeia/partials/edit/cardBodies/iatrosErgasias.ejs`
- `views/companies/genikastoixeia/partials/edit/cardBodies/logisths.ejs`
- `views/companies/genikastoixeia/partials/edit/cardBodies/statheraStoixeia.ejs`
- `views/companies/genikastoixeia/partials/edit/cardBodies/texnikosAsfaleias.ejs`
- `views/companies/genikastoixeia/partials/edit/cardFooter.ejs`
- `views/companies/genikastoixeia/partials/edit/cardFooter1-2.ejs`
- `views/companies/genikastoixeia/partials/edit/cardHeader.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section1/accordion/dypa.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section1/accordion/efka.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section1/accordion/kentraKostoys.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section1/accordion/prosopikaStoixeia.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section1/accordion/stoixeiaApasxolhshs.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section1/accordion/stoixeiaProslhpshs.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section2/apodoxes.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section3/krathseis.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section4/allodapoi.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section5/epaggelmatikhKatartish.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section6/diafora.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section8/orarioErgasias.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardFooters/cardFooter_Add.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardFooters/cardFooter_Add_Oraria.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardHeaders/cardHeader_Add_Section1.ejs`
- `views/ergazomenoi/ergazomenoi/partials/add/cardHeaders/cardHeader_Add_Section2_8.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/dypa.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/efka.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/kentraKostoys.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/prosopikaStoixeia.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/stoixeiaApasxolhshs.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/stoixeiaProslhpshs.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/typoiMetabolon.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section2/apodoxes.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section3/krathseis.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section4/allodapoi.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section5/epaggelmatikhKatartish.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section6/diafora.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section8/orarioErgasias.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardFooters/cardFooter_Edit.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardFooters/cardFooter_Edit_6.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardHeaders/cardHeader_Edit_Section1.ejs`
- `views/ergazomenoi/ergazomenoi/partials/edit/cardHeaders/cardHeader_Edit_Section2_8.ejs`
- `views/ergazomenoi/ergazomenoi/partials/employmentProfileArrangementRows.ejs`
- `views/ergazomenoi/ergazomenoi/partials/employmentProfileBreakRows.ejs`
- `views/ergazomenoi/ergazomenoi/partials/employmentTableNavigation.ejs`
- `views/kinhseis/adeies/cardBody_Adeies.ejs`
- `views/kinhseis/adeies/cardFooter_Adeies.ejs`
- `views/kinhseis/adeies/cardHeader_Adeies.ejs`
- `views/kinhseis/apasxolhseis/cardBody_Apasxolhseis.ejs`
- `views/kinhseis/apasxolhseis/cardFooter_Apodoxes.ejs`
- `views/kinhseis/apasxolhseis/cardHeader_Apasxolhseis.ejs`
- `views/kinhseis/apasxolhseis/payrollPhasesPanel.ejs`
- `views/kinhseis/astheneia/cardBody_Astheneia.ejs`
- `views/kinhseis/astheneia/cardFooter_Astheneia.ejs`
- `views/kinhseis/astheneia/cardHeader_Astheneia.ejs`
- `views/kinhseis/diafora/cardBody_Diafora.ejs`
- `views/kinhseis/diafora/cardFooter_Diafora.ejs`
- `views/kinhseis/diafora/cardHeader_Diafora.ejs`
- `views/kinhseis/foroi/cardBody_Foroi.ejs`
- `views/kinhseis/foroi/cardFooter_Foroi.ejs`
- `views/kinhseis/foroi/cardHeader_Foroi.ejs`
- `views/kinhseis/krathseis/cardBody_Krathseis.ejs`
- `views/kinhseis/krathseis/cardFooter_Krathseis.ejs`
- `views/kinhseis/krathseis/cardHeader_Krathseis.ejs`
- `views/partials/_csrfField.ejs`
- `views/partials/flash.ejs`
- `views/partials/footer.ejs`
- `views/partials/header.ejs`
- `views/partials/modalDelete.ejs`
- `views/partials/sidebar.ejs`

Ο επίσημος κατάλογος περιλαμβάνει 31 εγγραφές:

- `Companies` — Γενικά Στοιχεία
- `Ypokatasthmata` — Υποκαταστήματα
- `NomimoiEkprosopoi` — Νόμιμοι Εκπρόσωποι
- `Passwords` — Κωδικοί Πρόσβασης
- `Antistoixiseis` — Αντιστοιχίσεις Κ.Π.Κ.
- `Trapezes` — Τράπεζες Ανά Εταιρεία
- `Ergazomenoi` — Στοιχεία Εργαζομένων
- `AntigrafhProgrammatonErgasias` — Αντιγραφή Προγράμματος Από Έως Ημερ/νία
- `LhpshOrarionApoErganh` — ΜΗ Δανειζόμενων Εργαζόμενων
- `LhpshProdhlomenonOrarionMonoDaneizomenon` — ΜΟΝΟ Δανειζόμενων Εργαζόμενων
- `LhpshOrarionApoKartes` — ΜΗ Δανειζόμενων Εργαζόμενων
- `LhpshPshfiakonKartonMonoDaneizomenon` — ΜΟΝΟ Δανειζόμενων Εργαζόμενων
- `CalcApasxolhseisPeriodoy` — Υπολογισμός Απασχολήσεων Βάσει των Ψηφιακών Καρτών
- `ElegxosApasxolhseonPeriodoy` — Έλεγχος Απασχολήσεων
- `ApologistikosPinakasOrarion` — Απολογιστικός Πίνακας Ωραρίων
- `ApologistikosPinakasYperorion` — Απολογιστικός Πίνακας Υπερωριών
- `KatastashElegxouApologistikouPinaka` — Κατάσταση Ελέγχου Απολογιστικού Πίνακα
- `EktyposhOristikouApologistikouPinaka` — Εκτύπωση Οριστικού Απολογιστικού Πίνακα
- `YpobolhAdeion` — Υποβολή Αδειών
- `Krathseis` — Κρατήσεις
- `Symbaseis` — Συμβάσεις
- `KathgoriesSymbaseon` — Κατηγορίες Συμβάσεων
- `EidikothtesSymbaseon` — Ειδικότητες Συμβάσεων
- `StoixeiaSymbaseon` — Στοιχεία Συμβάσεων
- `KlimakiaSymbaseon` — Κλιμάκια Συμβάσεων
- `YpologismoiKlimakionSymbaseon` — Υπολογισμός Κλιμακίων Συμβάσεων
- `Apasxolhseis` — Απασχολήσεις
- `EktyposhAtomikonEkkathariseon` — Αποδείξεις Μισθοδοσίας
- `EktyposhSymbaseonErgazomenon` — Εργαζόμενων
- `SynthrhshProgrammatosErgasias` — Συντήρηση ωραρίων εργασίας
- `ExagoghOrarionSeErganh` — Εξαγωγή Ωραρίων στο ΕΡΓΑΝΗ

Δεν αποτελούν ενεργές σελίδες οι ακόλουθες πέντε καταχωρίσεις χωρίς αναφορά από διαδρομή ή `include`. Μεταγλωττίστηκαν, αλλά δεν δηλώνονται ως οπτικά ελεγμένες φόρμες:

- `views/kinhseis/cardFooter.ejs`
- `views/kinhseis/employeeInfo.ejs`
- `views/login/logoutModal.ejs`
- `views/partials/checks/checkAfm.ejs`
- `views/partials/checks/checkLogin.ejs`

## Ακριβές εύρος και όρια επαλήθευσης

Δεν παραμένει ανεξέλεγκτο ενεργό πρότυπο EJS της απογραφής. Αυτό δεν αποτελεί ισχυρισμό εξαντλητικού ελέγχου κάθε δυνατής επιχειρησιακής κατάστασης ή παραγωγικής εγκατάστασης. Οι δοκιμές χρησιμοποιούν συνθετικά δεδομένα, αντικαθιστούν τις απομακρυσμένες απαντήσεις επιλογέων και αποκλείουν πραγματικές δικτυακές ενέργειες. Οι επιχειρησιακοί χειριστές αποθήκευσης, υπολογισμών και υποβολής δεν φορτώνονται στις γενικές οπτικές δοκιμές. Οι προεπισκοπήσεις που παράγονται δυναμικά από επιπλέον επιχειρησιακές ροές εκτός της εξειδικευμένης δοκιμής Ελέγχου Απασχολήσεων δεν καλύπτονται εξαντλητικά. Ελέγχθηκε το περίβλημα και η πρόσβαση στις ενέργειες της προεπισκόπησης PDF, όχι το περιεχόμενο πραγματικού παραγόμενου PDF. Οι διακοσμητικές απομακρυσμένες εικόνες/φόντα δεν αποτελούν αντικείμενο της δοκιμής.

Δεν έγιναν παραγωγικές εγγραφές, αλλαγές σε υπολογισμούς, αποθηκεύσεις, δικαιώματα, συναλλαγές, κάρτες, ιστορικά ή υποβολές ΕΡΓΑΝΗ. Η υπάρχουσα εξειδικευμένη δοκιμή εμφάνισης χρησιμοποιεί αποκλειστικά προσωρινή τοπική βάση συνθετικών δεδομένων. Δεν τροποποιήθηκαν `.env`, διαπιστευτήρια, εξαρτήσεις, `package.json`, αρχεία ελαχιστοποιημένου κώδικα ή παραγόμενα αρχεία. Δεν χρησιμοποιήθηκαν οι θύρες 5000/5001 ως υπηρεσίες. Δεν τροποποιήθηκε ο προστατευμένος κύριος φάκελος. Δεν έγινε εγκατάσταση στην παραγωγή ή συγχώνευση.

Για επιβεβαίωση στην τοπική εφαρμογή, χωρίς πραγματική αποθήκευση:

1. Ανοίξτε Συντήρηση Εταιρείας και ελέγξτε «Οδός / Αριθμός / Τ.Κ.» με ανοικτό και κλειστό μενού.
2. Στον εργαζόμενο ελέγξτε τις καρτέλες, το πλήρες ωράριο, τις κρατήσεις με Α.Μ.Α. και τον καθαρισμό επιλογής.
3. Στις Κινήσεις κυλήστε κατακόρυφα και οριζόντια έως τα τελευταία πεδία των Φόρων, Ασθενειών και Αδειών.
4. Ανοίξτε μεγάλους καταλόγους εγγενών επιλογέων και Tom Select, αναζητήστε και καθαρίστε τιμές.
5. Ελέγξτε τα αναδυόμενα παράθυρα και τις βασικές ενέργειες χωρίς επιβεβαίωση αποθήκευσης ή υποβολής.

## Αρχεία που άλλαξαν και αιτία

| Αρχείο | Αιτία |
|---|---|
| `.github/workflows/ci-validation.yml` | Πραγματικές γραμματοσειρές/εικονίδια και εκτέλεση της πλήρους οπτικής απογραφής στο υπάρχον CI. |
| `public/css/main.css` | Αντικατάσταση προβληματικής αναδιάταξης, κοινή τυπογραφία, ύψη/όρια επιλογέων, κύλιση, κεφαλίδες, πίνακες και παράθυρα. |
| `public/js/common/formLayout.js` | Συνεκτικές ομάδες με τους αρχικούς κόμβους, διατήρηση ορατότητας, κοινή κύλιση πινάκων και μέτρηση διαθέσιμου χώρου. |
| `public/js/common/initTomDropdown.js` | Αφαίρεση ανταγωνιστικών μετατοπίσεων/παρατηρητή πλάτους και διπλής εμφάνισης επιλεγμένων τιμών. |
| `public/js/dropdown-item.js` | Όρια καταλόγου μέσα στους πραγματικούς περιέκτες κύλισης και αναγνώσιμη εμφάνιση ετικετών πολλαπλής επιλογής. |
| `public/js/ergazomenoi/genika/editKrathseisTomTrash.test.js` | Απογραφή, πραγματικά συνθετικά δεδομένα ή συμβατική/οπτική επαλήθευση της τροποποιημένης διεπαφής. |
| `test/fixtures/responsiveForms.js` | Απογραφή, πραγματικά συνθετικά δεδομένα ή συμβατική/οπτική επαλήθευση της τροποποιημένης διεπαφής. |
| `test/fixtures/responsiveFormsInventory.json` | Απογραφή, πραγματικά συνθετικά δεδομένα ή συμβατική/οπτική επαλήθευση της τροποποιημένης διεπαφής. |
| `test/helpers/responsiveFormsBrowser.js` | Απογραφή, πραγματικά συνθετικά δεδομένα ή συμβατική/οπτική επαλήθευση της τροποποιημένης διεπαφής. |
| `test/integration/allFormsResponsive.browser.test.js` | Απογραφή, πραγματικά συνθετικά δεδομένα ή συμβατική/οπτική επαλήθευση της τροποποιημένης διεπαφής. |
| `test/integration/employeeMaintenanceResponsive.browser.test.js` | Απογραφή, πραγματικά συνθετικά δεδομένα ή συμβατική/οπτική επαλήθευση της τροποποιημένης διεπαφής. |
| `test/integration/employmentReviewResponsive.browser.test.js` | Απογραφή, πραγματικά συνθετικά δεδομένα ή συμβατική/οπτική επαλήθευση της τροποποιημένης διεπαφής. |
| `test/integration/formControls.browser.test.js` | Απογραφή, πραγματικά συνθετικά δεδομένα ή συμβατική/οπτική επαλήθευση της τροποποιημένης διεπαφής. |
| `test/integration/formsInventory.contract.test.js` | Απογραφή, πραγματικά συνθετικά δεδομένα ή συμβατική/οπτική επαλήθευση της τροποποιημένης διεπαφής. |
| `test/integration/maintenanceFormsResponsive.browser.test.js` | Απογραφή, πραγματικά συνθετικά δεδομένα ή συμβατική/οπτική επαλήθευση της τροποποιημένης διεπαφής. |
| `views/admin/uploadTemplates.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/companies/antistoixiseis/add.ejs` | Σημασιολογική και οπτική ομαδοποίηση στοιχείων μόνο για ανάγνωση και α/α εγγραφής. |
| `views/companies/antistoixiseis/edit.ejs` | Σημασιολογική και οπτική ομαδοποίηση στοιχείων μόνο για ανάγνωση και α/α εγγραφής. |
| `views/companies/genikastoixeia/partials/add/cardBodies/diafora.ejs` | Πραγματική ομάδα ραδιοκουμπιών και σωστή σύνδεση ετικέτας. |
| `views/companies/genikastoixeia/partials/edit/cardBodies/diadoxosErgodoths.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/companies/genikastoixeia/partials/edit/cardBodies/diafora.ejs` | Πραγματική ομάδα ραδιοκουμπιών και σωστή σύνδεση ετικέτας. |
| `views/companies/genikastoixeia/partials/edit/cardBodies/emmesosErgodoths.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/companies/passwords/add.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/companies/passwords/edit.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/companies/trapezes/add.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/companies/trapezes/edit.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/ektyposeis/apasxolhseis/atomikesEkkathariseis.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/ergazomenoi/ergazomenoi/add.ejs` | Εφαρμογή των ήδη υπαρχουσών κοινών κλάσεων Συντήρησης και στην εισαγωγή. |
| `views/ergazomenoi/ergazomenoi/edit.ejs` | Αφαίρεση ορατού υπολείμματος σχολίου HTML κάτω από τη φόρμα. |
| `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section1/accordion/prosopikaStoixeia.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section1/accordion/stoixeiaApasxolhshs.ejs` | Σύνδεση ετικέτας και ενιαία ομάδα των δύο ημερομηνιών διευθέτησης. |
| `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section3/krathseis.ejs` | Σωστά αναγνωριστικά label/for και συνεκτική σειρά επιλογέα–Α.Μ.Α.–βοηθητικής ενέργειας. |
| `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section4/allodapoi.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section5/epaggelmatikhKatartish.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/ergazomenoi/ergazomenoi/partials/add/cardHeaders/cardHeader_Add_Section1.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/stoixeiaApasxolhshs.ejs` | Σύνδεση ετικέτας και ενιαία ομάδα των δύο ημερομηνιών διευθέτησης. |
| `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/stoixeiaProslhpshs.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section3/krathseis.ejs` | Σωστά αναγνωριστικά label/for και συνεκτική σειρά επιλογέα–Α.Μ.Α.–βοηθητικής ενέργειας. |
| `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section4/allodapoi.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section5/epaggelmatikhKatartish.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/ergazomenoi/ergazomenoi/partials/edit/cardHeaders/cardHeader_Edit_Section1.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/kinhseis/adeies/cardBody_Adeies.ejs` | Σωστή ετικέτα/ένδειξη ή αναγνώσιμη κοινή τυπογραφία πινάκων καταχώρισης, χωρίς αλλαγή τύπων. |
| `views/kinhseis/apasxolhseis.ejs` | Ρητοί περιέκτες για τους διαφορετικούς πίνακες καταχώρισης, με οριζόντια κύλιση. |
| `views/kinhseis/apasxolhseis/cardBody_Apasxolhseis.ejs` | Σωστή ετικέτα/ένδειξη ή αναγνώσιμη κοινή τυπογραφία πινάκων καταχώρισης, χωρίς αλλαγή τύπων. |
| `views/kinhseis/astheneia/cardBody_Astheneia.ejs` | Σωστή ετικέτα/ένδειξη ή αναγνώσιμη κοινή τυπογραφία πινάκων καταχώρισης, χωρίς αλλαγή τύπων. |
| `views/kinhseis/foroi/cardBody_Foroi.ejs` | Σωστή ετικέτα/ένδειξη ή αναγνώσιμη κοινή τυπογραφία πινάκων καταχώρισης, χωρίς αλλαγή τύπων. |
| `views/kinhseis/krathseis/cardBody_Krathseis.ejs` | Σωστή ετικέτα/ένδειξη ή αναγνώσιμη κοινή τυπογραφία πινάκων καταχώρισης, χωρίς αλλαγή τύπων. |
| `views/krathseis/genika/add.ejs` | Αφαίρεση σταθερού ενσωματωμένου ύψους κεφαλίδας που έκρυβε ετικέτες/πεδία. |
| `views/krathseis/genika/edit.ejs` | Αφαίρεση σταθερού ενσωματωμένου ύψους κεφαλίδας που έκρυβε ετικέτες/πεδία. |
| `views/krathseis/pososta/add.ejs` | Αφαίρεση σταθερού ενσωματωμένου ύψους κεφαλίδας που έκρυβε ετικέτες/πεδία. |
| `views/krathseis/pososta/edit.ejs` | Αφαίρεση σταθερού ενσωματωμένου ύψους κεφαλίδας που έκρυβε ετικέτες/πεδία. |
| `views/krathseis/search.ejs` | Κοινό αναγνώσιμο μέγεθος χειριστηρίου ανάπτυξης αντί για ενσωματωμένο 1vw. |
| `views/layouts/main.ejs` | Περιορισμένη κοινή κλάση παρουσίασης και φόρτωση της ομαδοποίησης. |
| `views/login/register.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/partials/header.ejs` | Κλάση για αναγνώσιμη μπάρα και πραγματική μέτρηση του ύψους της. |
| `views/symbaseis/symbaseis/search.ejs` | Ίδιο πλάτος στήλης περιγραφής σε κεφαλίδα και γραμμές. |
| `views/users/add.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/users/edit.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |
| `views/users/view.ejs` | Διόρθωση label/for, ονομασίας ομάδας ή σύνδεσης με το ορατό αντί του κρυφού πεδίου. |

Η παρούσα αναφορά και η συγκεντρωτική JSON προστέθηκαν ως τεκμηρίωση. Οι καταχωρίσεις Git και το τελικό CI αναφέρονται στην τελική αναφορά του PR.

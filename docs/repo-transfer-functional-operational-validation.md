# Μεταφορά ρεπό — functional και operational validation

Το παρόν runbook αφορά την ελεγχόμενη επαλήθευση του ήδη υλοποιημένου
μηχανισμού μεταφοράς ρεπό. Δεν αποτελεί εντολή ενεργοποίησης, deployment ή
εφαρμογής και δεν περιέχει production identifiers, προσωπικά δεδομένα ή
τιμές environment variables.

## Audit υπάρχουσας κάλυψης

| Περιοχή | Υφιστάμενη απόδειξη | Τύπος |
| --- | --- | --- |
| Decision command και persistence | strict body/command validation, immutable snapshot και ιστορικό | συμπεριφορικά unit tests και model validation |
| Decision batch/capability | READY, runtime/index/permission blockers, stale και applied state | συμπεριφορικά tests με mocked read models |
| Apply body parser | content type, μέγεθος, επιτρεπόμενο μόνο `request_id` | middleware behavior |
| Apply command | ακριβή fields, ObjectId, request id, session scope και A/S permission | pure behavior |
| Runtime guard | development και διπλό production opt-in | pure behavior |
| Index guard | ακριβή unique indexes, missing και inspection failure | pure behavior με injected loader |
| Reconstruction | v1/v2 dispatch, pair identity, fingerprint και fail-closed versions | behavior με deterministic context |
| Preflight | approval, scope, stale/lock/current values, idempotency και conflicts | behavior με fake models |
| Apply service | success, replay, request conflict, already applied και duplicate race | behavior με injected preflight/writer |
| Atomic writer | transaction-only updates, audits/execution και rollback failures | behavior με transactional fake store |
| Controller/route | middleware order, authorization, runtime/index order και safe errors | κυρίως static source contract |
| Execution/audit models | strict typed immutable snapshots, no automatic indexes | model validation και static contract |
| Frontend apply | server `can_apply`, confirmation, CSRF, retry id, refresh και completed state | VM-based behavioral UI tests |
| `STALE_DECISION` | νέα απόφαση, historical approval, χωρίς apply | VM-based behavioral UI tests |
| `ALREADY_APPLIED` | timestamp/actor και απουσία apply control | batch και VM-based UI behavior |

Η απομονωμένη κάλυψη ήταν επαρκής ανά service, αλλά δεν υπήρχε κοινή
database-free απόδειξη που να περνά canonical employment fixtures από
command validation, πραγματικό reconstruction, preflight και apply service
έως τον πραγματικό atomic writer. Το
`apasxoliseisWeeklyRepoTransferFunctionalOperationalValidation.test.js`
καλύπτει αυτό το κενό με κοινά fixtures και transactional fake store. Τα
controller/route tests παραμένουν source contracts επειδή η φόρτωση της
κανονικής εφαρμογής θα μπορούσε να εκκινήσει πραγματικές υποδομές.

## Τι αποδεικνύει το ενοποιημένο harness

- behavioral success chain για FULL μέσω πραγματικού v1 proposal contract,
  με target `ΑΝ`,
- behavioral success chains για MERIKH, EK_PERITROPHS και MERIKH με
  μειωμένες εβδομαδιαίες ημέρες και μειωμένες ημερήσιες ώρες μέσω του
  πραγματικού v2 partial-family contract, με target `ΜΕ`,
- πραγματικό apply command validation και session authorization,
- πραγματικό runtime και index-readiness contract,
- πραγματικό analyzer/proposal/group projection και
  `reconstructWeeklyRepoTransferDecision` μέσα στην ίδια success chain,
- snapshot και fingerprint που παράγονται και επαναχρησιμοποιούνται από το
  ίδιο reconstruction contract κατά το preflight,
- πραγματικό apply service και πραγματικό transaction-only writer,
- ακριβώς δύο staged row updates, δύο audit records και ένα `APPLIED`
  execution,
- idempotent replay και network-uncertainty replay με το ίδιο request id,
- request-id conflict και already-applied προστασία,
- authoritative post-apply ανάγνωση μέσω
  `loadWeeklyRepoTransferDecisionBatch`, με `ALREADY_APPLIED`,
  `can_apply=false` και το ίδιο `APPLIED` execution,
- rollback σε source/target/audit/execution/commit/abort failure,
- fail-fast απαγόρευση DB connection, network listener/outbound request και
  filesystem deployment writes.

Τα εξειδικευμένα behavioral tests που εκτελούνται από το CI συνεχίζουν να
αποτελούν την αναλυτική απόδειξη για
wrong scope, rejection/needs-review, stale fingerprint, changed rows,
locked rows, duplicate races, controller error mapping και κάθε UI state.
Ο token/source inventory έλεγχος του συγκεντρωτικού harness είναι μόνο
στατικό sanity check ότι τα σχετικά focused αρχεία παραμένουν παρόντα. Δεν
θεωρείται behavioral evidence και δεν αντικαθιστά την εκτέλεσή τους. Τα
controller/route contracts παραμένουν ρητά static source contracts· δεν
υπάρχει ισχυρισμός πραγματικού HTTP route integration.

## Προϋποθέσεις πριν από μελλοντική ενεργοποίηση

- Να έχει καταγραφεί το ακριβές release SHA και να αντιστοιχεί στον κώδικα
  που πέρασε CI.
- Το required CI να είναι επιτυχές.
- Τα απαιτούμενα unique indexes να έχουν επαληθευτεί read-only.
- Τα runtime flags να παραμένουν αρχικά κλειστά.
- Ο χρήστης να έχει τον ήδη προβλεπόμενο ρόλο και permission.
- Να έχει επιλεγεί συγκεκριμένη εταιρεία και συγκεκριμένο παράρτημα.
- Να υπάρχει καταγεγραμμένο rollback σημείο και incident owner.
- Να μην υπάρχουν ενεργοί χρήστες κατά το deployment window.
- Η MongoDB τοπολογία να υποστηρίζει transactions.

## Safe smoke sequence για εγκεκριμένο maintenance window

Οι παρακάτω ενέργειες δεν εκτελούνται από αυτό το PR:

1. Φόρτωση του HR review με κλειστά runtime flags.
2. Επιβεβαίωση read-only/informational κατάστασης.
3. Καταγραφή απόφασης χωρίς apply.
4. Read-only έλεγχος execution history.
5. Ενεργοποίηση μόνο μέσα σε εγκεκριμένο, ελεγχόμενο παράθυρο.
6. Επιλογή μίας προκαθορισμένης controlled περίπτωσης χωρίς προσωπικά
   δεδομένα στα evidence notes.
7. Apply της εγκεκριμένης atomic πρότασης.
8. Επιβεβαίωση source και target ως ενιαίας αλλαγής.
9. Επιβεβαίωση των δύο audit entries και του execution.
10. Επανάληψη του ίδιου request id για απόδειξη idempotency.
11. Άμεση απενεργοποίηση των flags αν εμφανιστεί οποιαδήποτε απόκλιση.

## Stop conditions

Η διαδικασία σταματά χωρίς apply όταν:

- υπάρχουν ενεργοί χρήστες,
- το CI δεν είναι πράσινο,
- λείπει ή αποκλίνει απαιτούμενο index,
- δεν υπάρχει transaction support,
- η πρόταση είναι stale,
- source ή target διαφέρουν από το approved snapshot,
- δεν επιβεβαιώνεται execution και audit μετά το apply,
- το session scope ή το permission δεν είναι ακριβές,
- υπάρχει αβέβαιη προηγούμενη αποστολή που δεν έχει ελεγχθεί με το ίδιο
  request id.

## Evidence checklist

- [ ] Release/deployment SHA
- [ ] CI run URL και αποτέλεσμα
- [ ] Deployment timestamp και maintenance window
- [ ] Runtime state πριν, κατά και μετά το controlled window
- [ ] Read-only index readiness αποτέλεσμα
- [ ] Εξουσιοδοτημένος χρήστης εφαρμογής
- [ ] Εταιρεία και παράρτημα
- [ ] Decision reference
- [ ] Execution reference
- [ ] Source πριν και μετά
- [ ] Target πριν και μετά
- [ ] Δύο audit references
- [ ] Idempotent retry αποτέλεσμα
- [ ] Rollback σημείο και incident notes

Τα evidence records πρέπει να φυλάσσονται στο εγκεκριμένο operational
σύστημα και όχι στο repository. Δεν καταγράφονται πραγματικά προσωπικά
δεδομένα ή production IDs σε commit, PR body ή test fixture.

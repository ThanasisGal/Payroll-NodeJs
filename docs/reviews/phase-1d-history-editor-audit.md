# Phase 1D: history-editor compatibility and controller audit

Baseline: `da765ee8050c91419b7707839b55e4ead0412ef3` on
`feature/employee-approved-work-arrangement-profile-20260906`.
Audit is source-only. No application server, database connection, migration or deployment ran.

## Exact baseline behavior

Source: `server/controllers/ergazomenoi/ergazomenoiController.js`, baseline
`updateIstorikoData` (approximately lines 914–1069), and the unchanged
`public/js/ergazomenoi/genika/istorikoTable.js`.

| Operation | Baseline behavior |
| --- | --- |
| Modified | Parse/require a non-negative sixth-day rate; if missing/invalid return 400. With a nonempty `_id`, scoped `updateOne` applies `$set: buildUpdateData(data)` to that same row. No comparison with old identity, no matched-count check, no transaction. Missing `_id` is skipped after rate validation. |
| Inserted | Scoped `create`, `aa_eggrafhs: '0000'`, mapped dates/work terms. No chronological/overlap test and no surrounding-boundary update. This branch bypasses the modified-row rate validator. |
| Deleted | Scoped `deleteOne` by `_id, team, company_kod, kodikos`; no `_id` means skip. No deleted-count check, no current write, no reopening/extension of neighboring periods. |
| Identity/date changes | Ordinary `$set` on the same `_id`, including all mapped identity dates. **Not** delete-old + insert-new. Explicit effective start falls back to schedule start; explicit effective end falls back to null. No retrospective/overlap validation. |
| Sequence | After all operations, query scoped rows sorted by `{ aa_eggrafhs: 1, createdAt: 1, _id: 1 }`; rewrite sequence `0001…`. New `0000` rows sort before existing numbered rows. It is not a chronological date sort. Even an empty update array reaches renumbering. |
| Current employee | One scoped read identifies the employee and supplies the optional inserted-row rate fallback. **No write to Ergazomenoi** for modification, insertion or deletion, including the latest row. There is no baseline restoration of a previous snapshot. |
| Failure | Operations are sequential independent writes. A later failure can leave earlier operations/partial renumbering persisted; catch returns 500. |

The current browser table serializes six dates only. It does not serialize work
terms or the sixth-day rate. Consequently, a date-only modified request encounters
the baseline missing-rate 400. The integration validates the rate **when supplied**
and preserves omitted stored facts instead of filling them from today's employee
or clearing fields absent from the editor. No UI fields were added.

## Accepted operations and exact safety limits

- Modified rows use the same writer and exact scoped ID. Unchanged effective
  periods and safe identity metadata corrections remain the same historical row.
  A forward change of the latest complete version's effective start/end is allowed
  if the resulting interval is valid and does not overlap another row. Current is
  updated consistently; neighboring boundaries are not rewritten.
- A new version strictly after the pre-batch latest historical/current effective
  start uses `MODE_NEW_VERSION`. It closes an overlapping predecessor using the
  approved writer, produces a complete snapshot and updates current atomically.
  Removing a row earlier in a batch cannot bypass this append floor.
- Retrospective insertions, non-latest effective-boundary mutations, backwards
  effective-start moves, overlaps and unsupported incomplete-legacy boundary
  mutations fail closed. They do not become silent corrections/new versions.
- Deletion targets exactly one scoped ID and checks `deletedCount`. Nonexistent
  IDs fail. Neighbor boundaries/facts are unchanged; only baseline sequence
  renumbering can change their `aa_eggrafhs`.
- Latest **legacy** deletion is supported with the baseline unchanged current
  document. No absent facts are invented. Deleting a latest/future snapshot is
  also supported when current retains its own matching complete snapshot.
- Removing the snapshot supporting the current V1 profile without a matching
  retained/replacement snapshot is specifically blocked with
  `EMPLOYEE_PROFILE_DELETE_CURRENT_VERSION_UNSUPPORTED`. **No automatic revert**
  was implemented: baseline has none. A chronological replacement in the same
  atomic batch can make deletion safe.
- Incomplete legacy editor corrections, including latest rows, require explicit missing facts;
  current/future facts are never copied backwards to fill them.
- Accepted mixed operations and final renumbering use one `withTransaction` on
  the existing writer's private shared session. Any later validation, write,
  renumbering or commit failure rolls everything back. No parallel persistence
  implementation was introduced.

## Every controller diff block

Definition: each hunk of `git diff --unified=0 <baseline> --
server/controllers/ergazomenoi/ergazomenoiController.js`. There are **17** changed
blocks. Each has exactly one classification below. Baseline line anchors remain
stable even when uncommitted line numbers move.

| Block / baseline anchor | Classification | Review |
| --- | --- | --- |
| 1 / after line 1 | required Add persistence integration | Shared writer/extraction/error imports also reused by Edit and history. |
| 2 / 978–1015 | required history-editor integration | Map accepted operation types; exact delete IDs; supplied-only validation and field extraction. |
| 3 / 1017–1018 | required history-editor integration | Forward mapped batch to existing transactional writer. |
| 4 / 1020–1052 | required history-editor integration | Remove independent history writes/renumbering; same operations now inside writer transaction. |
| 5 / 1060–1064 | required history-editor integration | Specific validation errors; retain original generic 500 body. |
| 6 / 1337–1338 | required Add persistence integration | Remove obsolete history sequence local; employee code allocator retained. |
| 7 / 1406–1427 | required Add persistence integration | Move history sequence allocation into transactional writer. |
| 8 / insertion after 1747 | code movement with byte/semantic parity | Existing Add history mapping moved before persistence; only sequence field is now writer-owned. EOL normalization has no semantic effect. |
| 9 / 1751 | required Add persistence integration | Replace independent employee create with atomic current+history call. |
| 10 / 1753–1756 | required Add persistence integration | Handle profile errors; original generic error response preserved. |
| 11 / 2016–2098 | required Add persistence integration | Remove relocated history builder and old independent history create/catch. |
| 12 / 3387–3389 | required Edit persistence integration | Remove obsolete history lookup/sequence locals. |
| 13 / 3421–3459 | required Edit persistence integration | Identity lookup and sequence calculation now use transactional fresh history. |
| 14 / insertion after 3755 | code movement with byte/semantic parity | Existing Edit history mapping moved before current write; effective-start expression inlined with same operands/order. |
| 15 / 3820–3824 | required Edit persistence integration | Existing current mapping passed to writer; result hydrated for unchanged post-actions. |
| 16 / 3834–3837 | required Edit persistence integration | Handle profile errors; original generic error response preserved. |
| 17 / 3984–4164 | required Edit persistence integration | Remove relocated mapping and independent correction/append/close writes. |

`UNRELATED_CHANGE_COUNT = 0`. No test-support-only production structural changes.
Employee code allocation, all personal/contract/remuneration/insurance/termination/
borrowing maps and numeric conversion blocks retain baseline parity. Add history
mapping parity excludes its intentionally writer-owned sequence. Edit history
mapping uses the same values and helper expressions. Tenant guards and scoped
IDs remain mandatory; transactional writes/renumbering include full scope.

Automated source parity assertions cover allocation, Add/current/history maps,
Edit/current numeric conversion, all other controller methods and the unchanged
PDF/schedule/ERGANI/success-response/redirect suffixes. Generic Add/Edit failure
response assertions protect the restored baseline error messages. New tests use
only in-memory transaction drafts and Mongoose schema validation without a connection.

No Employment Check, break/night/holiday/overtime/seventh-day calculations, ERGANI
payloads, Phase 1C table state, package/version, deployment or migration changed.

## User-facing restriction path and final verification

The existing employee **Ιστορικό → Αποθήκευση** flow posts its `updates` array to
`/ergazomenoi/ergazomenoi/istoriko/update`. An inserted date at/before the latest
version, a prohibited effective-boundary modification, an incomplete legacy
correction without explicitly supplied facts, or deletion of an unsupported current
V1 snapshot returns a specific validation response through this same path. The
entire batch is rolled back. Safe append/correction/deletion requests keep the
existing success response.

Final verification: 102 focused/foundation tests, 34 related tests, and 40 Phase 1C
browser tests pass, with zero failures/skips. Syntax checks pass for all 14 changed
or new JS files; seven relevant EJS templates compile (no EJS files changed).
`git diff --check` passes. HEAD and protected stash remain at the stated SHAs;
no files were staged and no commit was created.

Cumulative uncommitted file inventory:

- `public/js/ergazomenoi/genika/employmentProfileUi.js`: common payload extraction.
- `public/js/ergazomenoi/genika/getFieldValues.js`: Add serialization integration.
- `public/js/ergazomenoi/genika/putFieldValues.js`: Edit serialization integration.
- `public/js/ergazomenoi/genika/employmentProfileSerialization.test.js`: serialization regressions.
- `server/controllers/ergazomenoi/ergazomenoiController.js`: three persistence seams audited above.
- `server/controllers/ergazomenoi/ergazomenoiController.employmentProfile.test.js`: mocked controller, transaction and source-parity tests.
- `server/controllers/ergazomenoi/erganiRestSubmittedPdf.security.contract.test.js`: security assertions adapted to the scoped writer seam.
- `server/models/employeeEmploymentProfileFields.js`: original omission context in validation.
- `server/services/ergazomenoi/employeeEmploymentProfileWriter.js`: shared atomic Add/Edit/editor operations.
- `server/utils/ergazomenoi/employmentProfileMaintenance.js`: input extraction and validation responses.
- `server/utils/ergazomenoi/employmentProfileContract.js`: normalization and legacy omission semantics.
- `server/utils/ergazomenoi/employmentProfileContract.test.js`: corresponding contract regressions.
- `server/utils/ergazomenoi/employmentProfileHistory.js`: complete snapshots retain contract semantics.
- `server/utils/ergazomenoi/employmentProfileUi.test.js`: controller integration assertion.
- `docs/reviews/phase-1d-history-editor-audit.md`: this exact-baseline review.

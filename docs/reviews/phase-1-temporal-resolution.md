# Phase 1 temporal profile resolution

The temporal contract is implemented by `employmentProfileTemporal.js`. This is
fact selection and provenance; arithmetic and legal/payroll policy are unchanged.

## Observation before first V1

`employment_profile_pre_v1` is server-owned compatibility metadata on the current
employee. The existing writer captures it from its scoped, transactional **pre-write
lean current document**, before the first legacy-to-V1 write. It contains:

- `source: PRE_V1_CURRENT_OBSERVATION`;
- `before`: the first V1 effective boundary, not an invented historical start;
- `facts`: only whitelisted fields actually present in that current document.

An overlapping legacy history row does not prove identity with the superseded
current employee. Consequently this design does not backfill that row. No
arrangement facts or version stamps are captured in the anchor. No Add anchor is
created when there was no previous employee. Latest supported legacy exact
correction captures the observation at its effective boundary when it first
establishes V1. Later corrections/appends cannot replace it. The normal form and
history patches cannot supply/overwrite the metadata.

The anchor shares the current/history transaction and rollback. Keeping it on the
employee makes it available to period-filtered queries, borrowed profiles and
frozen contexts even when the earliest V1 history row is deleted. It is not a
second timeline. Deleting a V1 version does not extend the anchor through the
resulting gap. Such a gap is unrecorded unless explicit history supplies it.
Moving the anchored first transition's start is rejected; ordinary exact
corrections and the already-supported safe later history operations remain.

## Precedence and period boundaries

1. Applicable complete V1 history precedes legacy candidates.
2. Explicit applicable legacy history precedes the observation fallback.
3. Before the immutable first-V1 boundary, observed anchor fields may fill only
   missing legacy facts; absent anchor fields are never invented.
4. With versioned evidence, current is eligible only within its own effective
   bounds, with complete provenance and no later historical version invalidating
   the fallback. Otherwise the source is `UNRECORDED_PROFILE`.
5. Pure legacy employee/history input retains the established legacy fallback.

For complete V1, canonical end `null` means open ended. Schedule-generation end is
not consulted. Legacy work-term rows retain canonical-or-schedule end semantics;
legacy break rows retain month-start eligibility and their original continuation
semantics. Earlier explicit break rows are included in the scoped review history
queries even when their separate work-term intervals no longer overlap the review
period. The resolver still applies the eligibility rule.

The dedicated arrangement resolver continues requiring recorded applicable V1
history and its existing arrangement applicability predicates. Neither an anchor
nor current-only fallback invents an approved historical arrangement.

## Field classification

| Family | Anchor classification | Explicit legacy | V1 | Current fallback |
| --- | --- | --- | --- | --- |
| Weekly/daily hours, days, employment status/type/week | ANCHOR_KNOWN_VALUE | Supplied facts win | Complete version | Guarded |
| Contractual hours | ANCHOR_KNOWN_VALUE | Supplied facts win | Complete version | Guarded |
| Break duration and inside/outside | ANCHOR_KNOWN_VALUE | Month-start break history wins | Calendar-day version | Guarded |
| Three break pairs | ANCHOR_KNOWN_VALUE, only if observed | Supplied intervals only | Complete version | Guarded |
| Continuous/split schedule and schedule type | ANCHOR_KNOWN_VALUE, only if observed | Supplied facts only | Complete version | Guarded |
| Flexible arrival | ANCHOR_KNOWN_VALUE, only if observed | Supplied facts only | Complete version | Guarded |
| Sixth-day rate, hourly rates, special-category identifiers used in legacy work-term fallback | ANCHOR_KNOWN_VALUE, only if observed | Supplied facts win | Recorded facts | Guarded; no policy changed |
| Approved arrangement | V1_ONLY for effective arrangement | Never inferred or activated | Required | Never activates arrangement |
| Absent legacy values, schema/policy version stamps | NOT_SAFE_TO_ANCHOR | Retain absence/provenance | Server-owned versions | No fabrication |

## Production read paths

The central `profileSelect`/`HISTORY_SELECT` contract contains every fact required
for complete V1 recognition, canonical bounds and known work-term facts.
Canonical weekly and atomic transfer field lists retain their original extra
fields and include this shared definition. Borrowed-profile queries and direct
controller profile projections do likewise. Company lookup projections are
unchanged. Frozen serialization adds temporal fields only for versioned records,
leaving pure-legacy snapshot projection unchanged. Already stored frozen snapshots
are not rewritten.

`getIstorikoOronErgasiasForPeriod` already returns full lean documents and its
canonical date-range query includes null-ended V1 periods. It needs no projection
or query change. Review full-time classification delegates to the resolved work
terms without arithmetic changes. The controller's separate legacy work-term
resolver retains its original path for pure legacy input; versioned input uses the
shared resolver. Explicit CURRENT candidate selection uses the current version's
actual start instead of the old synthetic epoch date.

## Regression coverage

In-memory writer tests cover the exact 30 -> 15 -> 20 break sequence, 40 -> 32
weekly hours, days/status, rollback, first/later correction, earliest deletion,
explicit legacy precedence, unknown fields and client metadata protection.
Full versus actual selected data is compared across break/work-term/arrangement
resolvers, including canonical/atomic lists, borrowed preload and frozen
serialization. Open-ended V1 and deployed-baseline pure-legacy parity are tested.
No database or external write service is needed for these tests.

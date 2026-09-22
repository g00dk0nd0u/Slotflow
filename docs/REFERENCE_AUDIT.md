# ContextLab/scheduler source audit

Reference: [`ContextLab/scheduler`](https://github.com/ContextLab/scheduler)<br>
Audited `main`: [`c92dec793039fa5a365162029041bdbd26088901`](https://github.com/ContextLab/scheduler/tree/c92dec793039fa5a365162029041bdbd26088901) (2026-08-16)<br>
History specifically inspected: `c92dec7` (Advanced Calendar service declaration) and
`883880e` (maintenance credential transport), plus the booking, reconciliation,
reschedule, rate-limit and free/busy changes leading to the audited revision.

This is a source and history audit, not an endorsement and not a proposal to copy the
project. Findings below are based on code paths, tests, manifest/workflows, and diffs,
not README claims. Provider behavior which a local mock cannot prove is called out as an
integration-test obligation.

## Verdict vocabulary

- **ADOPT**: retain the idea, with an independent Slotflow test.
- **ADAPT**: useful idea, but its contract or implementation must change.
- **REJECT**: the observed behavior must not enter Slotflow.

## Executive decision table

| Reference pattern or behavior | Decision | Slotflow rule | Required regression |
|---|---|---|---|
| Static client + Apps Script for a one-store pilot | **ADAPT** | Accept the cost profile, not the reference security/transaction model | deployed-origin and real-service smoke tests |
| Specially titled Calendar events define availability | **REJECT** | Expand configured business hours, then subtract busy intervals | ordinary manual events block; no magic title required |
| Advanced Calendar API for event status/transparency | **ADAPT** | Declare the service and fail closed if semantics cannot be preserved | missing service cannot silently change results |
| Opaque timed events block; transparent events do not | **ADOPT** | Apply consistently on every configured conflict calendar | opaque/transparent matrix |
| Ignore every all-day event | **REJECT** | Opaque all-day event on an occupancy calendar closes its covered local dates | one-day and multi-day closures |
| Script lock plus ledger overlap check | **ADAPT** | Lock the whole conflict-check/intent/create/finalize section; use explicit states | two truly concurrent executions |
| Final booking rows bridge Calendar read lag | **ADAPT** | Include pending and recovery states, idempotency key, and flush/read-back rules | Calendar lag and retry injection |
| Delete old event first when rescheduling | **REJECT** | Preserve the old durable booking until replacement is recoverable | failure at every reschedule boundary |
| Continue cancellation after Calendar delete error | **REJECT** | Never return `cancelled` while an opaque old event may remain | deletion error yields recovery state/non-success |
| Conservative missing-event reconciliation | **ADAPT** | Reconcile both directions and distinguish absence from provider uncertainty | stale, orphaned, moved and transient-error cases |
| Expiring management tokens | **ADAPT** | CSPRNG, hashed at rest, purpose-bound, expiring and revocable | entropy/expiry/purpose/replay tests |
| CacheService request counters | **ADAPT** | Abuse friction only, never authorization or booking integrity | cache miss/eviction/race/bypass tests |
| Maintenance secret in POST body | **ADOPT** | Keep credentials out of URLs, but authenticate and authorize maintenance separately | URL/log leakage check and invalid-secret rejection |
| CORS/origin parameter as protection | **REJECT** | Browser origin policy is not caller authorization | direct non-browser request reaches only public contract |
| Secret scanning workflow | **ADOPT** | Keep it alongside, not instead of, functional CI | seeded canary fixture is detected |

## 1. Availability calculation

### Observed algorithm

The reference begins with positive Calendar “availability” events selected by title,
then subtracts conflicting events. That model is visible in
[`backend/Calendar.gs`](https://github.com/ContextLab/scheduler/blob/c92dec793039fa5a365162029041bdbd26088901/backend/Calendar.gs)
and its test fixtures. Slotflow's base is instead configured weekly business hours plus
dated exceptions. Requiring synthetic Calendar windows adds owner work and makes a title
part of an integrity contract. **REJECT**.

Timed opaque events are treated as busy and transparent events as free when the Advanced
Calendar service path is available. Cancelled events are excluded. Declined-event logic
depends on attendee response information and must be verified against the configured
calendar/account, not inferred merely from event presence. All-day events are deliberately
discarded by both implementation and tests. Overlaps are handled as interval subtraction,
but arbitrary service duration/buffer boundaries are not established strongly enough for
Slotflow's generic-service contract. **ADOPT** interval subtraction; **ADAPT** classification;
**REJECT** ignoring all-day events.

Slotflow's classification contract should be:

1. Start with store-local business-hour windows.
2. Union occupied intervals from every explicitly configured conflict calendar.
3. Ignore cancelled events and timed events explicitly marked transparent.
4. Treat an opaque all-day event as busy for `[start.date, end.date)` in the store timezone.
5. Treat a declined event as non-blocking only when the resource owner's own response is
   unambiguously declined; ambiguous/missing attendee identity fails closed.
6. Merge overlapping/touching occupied intervals before testing a candidate whose occupied
   span includes pre/post buffers.
7. Apply min notice to the buffered start and max advance to a precisely specified booking
   boundary; Issue #3 must choose those boundary rules.

Multiple-calendar behavior must not be an accidental loop: partial failure reading any
required conflict calendar makes availability unknown (fail closed), rather than treating
the unread calendar as empty. Manual owner-created opaque events then block immediately
without needing ledger rows. **ADAPT**, with provider integration tests.

### Configuration and time defects

[`backend/Calendar.gs`](https://github.com/ContextLab/scheduler/blob/c92dec793039fa5a365162029041bdbd26088901/backend/Calendar.gs)
contains `parseInt(Config.get('MIN_NOTICE_HOURS'), 10) || 12`; a configured numeric zero is
falsy and becomes 12. The test configuration contains `MIN_NOTICE_HOURS: '0'`, but its
future-dated cases do not exercise the notice boundary, so they do not catch the defect.
**REJECT**. Parse, validate finite/range, then default only when missing/invalid.

The reference passes JavaScript `Date` values through browser, Apps Script, Calendar and
sheet representations. That is not sufficient evidence for device/store timezone
separation or DST correctness. Slotflow APIs accept ISO 8601 instants with offsets/`Z`,
store an explicit IANA store zone, and expand civil business hours in that zone. Test a
spring gap and autumn fold in a DST zone even though the pilot is `Asia/Tokyo`. **ADAPT**.

Frontend and backend defaults represent another authority split: client-side duration,
notice or horizon values can drift from enforcement. UI values are hints only; backend
configuration is authoritative and responses should include a configuration version where
the UI needs matching display behavior. **REJECT** duplicated enforcement defaults.

## 2. Booking integrity and mutation traces

The reference's important improvement is recognizing that a fresh Calendar write may not
immediately appear in a subsequent availability read. The booking handler takes
`LockService` and consults Sheets for overlapping bookings. This reduces a known
double-booking window, but a final-row-only ledger is not a transaction protocol.
`SpreadsheetApp.flush()` only applies pending spreadsheet changes; it does not make a
Calendar write and a Sheet write atomic, guarantee another execution's view, or repair a
failed call. **ADAPT**.

Slotflow must require a caller-supplied idempotency key scoped to operation and principal.
The same key plus the same canonical payload returns the prior outcome; the same key with a
different payload is rejected. A random booking/management token is not a substitute.

### Create, observed order: Calendar create → Sheet append → notification

| Failure boundary | Reference outcome | Risk / Slotflow decision |
|---|---|---|
| before Calendar create | no mutation | Safe only if no success is returned |
| Calendar create succeeds, Sheet append/flush fails | orphan opaque event | Availability is blocked but retry can create another event; **REJECT** |
| Sheet append succeeds | confirmed row exists | There was no prior durable intent; recovery of the preceding boundary is weak; **ADAPT** |
| email fails after both durable writes | booking remains booked; notification may be absent | Correct booking result must be distinct from notification status; retry notification by outbox/idempotent job; **ADAPT** |

Slotflow should durably write a pending intent under the lock before Calendar creation,
then finalize with the event ID. Calendar failure leaves an explicit failed/retryable state;
final Sheet failure leaves `confirmation_pending`/`recovery_needed`, not a fabricated
failure that encourages a duplicate retry. The exact state machine remains Issue #3.

### Cancel, observed order: Calendar delete attempt → ledger cancel → email/result

[`backend/Code.gs`](https://github.com/ContextLab/scheduler/blob/c92dec793039fa5a365162029041bdbd26088901/backend/Code.gs)
catches/logs deletion failure and continues to mark the row cancelled, notify, and return
success. The durable Calendar may still block the slot while the customer is told it does
not. **REJECT**. Deletion not-found, transient failure, and confirmed deletion need distinct
handling; only a proven absent/deleted event permits a clean cancelled state.

### Reschedule, observed order: delete old event → create new → append/update ledger

If old deletion succeeds and new creation fails, the only valid appointment is destroyed.
If new creation succeeds and ledger update fails, the replacement is orphaned and the
ledger can still describe the old booking. Concurrent cancellation/reschedule can compound
the split because tokens and row state are not a complete compare-and-set protocol.
**REJECT**. Slotflow needs operation/version preconditions, a reserved replacement intent,
and compensating/recovery rules. Do not report `rescheduled` until durable state agrees.

### Concurrency and manual edits

- Two same-slot requests must contend on one script/store lock and both re-check ledger and
  Calendar *after* acquiring it. Lock timeout is a retryable busy response, not permission
  to proceed. **ADAPT**.
- Calendar reads can lag; active `pending`, `confirmed`, and relevant recovery states must
  participate in ledger overlap checks. **ADAPT**.
- Sheet reads/writes must use canonical row identifiers and explicit status/version checks;
  `flush()` is not a compare-and-set. **REJECT** blind row mutation.
- A manual opaque event is occupancy whether or not it has Slotflow metadata. Moving or
  deleting a Slotflow event is drift to reconcile, not a reason to ignore the owner's live
  Calendar. **ADAPT**.

## 3. Calendar ↔ ledger reconciliation

[`backend/Reconcile.gs`](https://github.com/ContextLab/scheduler/blob/c92dec793039fa5a365162029041bdbd26088901/backend/Reconcile.gs)
scans future confirmed ledger rows, uses a grace period to avoid fresh-write visibility
false positives, and changes state only when the associated Calendar event is provably
missing. This conservative ledger→Calendar check is useful. A transient Calendar error is
not proof of absence. **ADOPT** the grace/uncertainty distinction; **ADAPT** the scope.

Coverage is asymmetric:

- stale/ghost ledger row after confirmed manual deletion: addressed most directly;
- manually moved event: event-ID lookup may prove it exists, but the row's stored time can
  remain stale unless reconciliation compares normalized start/end;
- orphan Slotflow event after Sheet failure: there is no equivalent Calendar→ledger
  inventory/reconstruction path;
- arbitrary manual Calendar event: rightly blocks availability, but should not be imported
  as a customer booking;
- cancel/reschedule recovery states: not modeled sufficiently to converge both stores.

Slotflow reconciliation must be bidirectional for Slotflow-tagged events, never synthesize
customer data from arbitrary manual events, use a documented freshness/grace window, record
last checked/error/action, and fail closed for availability when provider state is
uncertain. Destructive repair should be idempotent and auditable. Issue #3 must decide
whether a manually moved Slotflow event updates the ledger automatically or enters
`review_required`.

## 4. Security audit

The Apps Script web app exposes public request dispatch through `doGet`/`doPost` in
[`backend/Code.gs`](https://github.com/ContextLab/scheduler/blob/c92dec793039fa5a365162029041bdbd26088901/backend/Code.gs).
Public booking/availability may be intentional, but action dispatch is not authorization.
The code reads an origin-like request parameter and an allowed origin, without a meaningful
server-side authorization boundary; Apps Script does not thereby obtain a trustworthy
browser `Origin` header. CORS would constrain browsers, not curl/bots. **REJECT**.

Commit [`883880e`](https://github.com/ContextLab/scheduler/commit/883880e) moved the
maintenance secret from a GET query parameter into a POST body. That removes common URL,
history, redirect and access-log exposure, but the endpoint still needs constant-time
credential comparison where available, least privilege, rotation and replay/abuse design.
Script Properties are preferable to source/static assets but are secret storage, not an
authorization system. **ADOPT** no-secrets-in-URLs; **ADAPT** maintenance authentication.

Management links/tokens are bearer credentials. Slotflow must generate at least 128 bits
with a cryptographically secure generator, store a hash rather than plaintext where
practical, bind purpose/booking, expire, revoke/rotate after use, and never expose customer
PII through lookup errors. The reference's expiring-token idea is useful, but entropy,
storage and replay need explicit tests. **ADAPT**.

Validate action, timestamps, service ID, duration (server-derived), text lengths and
formats before mutation; escape all values rendered into HTML/email or formulas. Prevent
spreadsheet formula injection for cells beginning with formula markers. Return minimal
booking data and non-enumerating errors. Public GitHub Pages assets necessarily expose all
embedded configuration, so no secret belongs there. OAuth scopes in
[`backend/appsscript.json`](https://github.com/ContextLab/scheduler/blob/c92dec793039fa5a365162029041bdbd26088901/backend/appsscript.json)
must be reviewed and minimized; the Advanced Calendar service must be explicitly declared.

Reference rate limiting uses CacheService counters and caller-controlled identifiers/email.
Cache entries may expire/evict early and read-modify-write is not an atomic security
primitive; identifiers rotate. It is best-effort abuse friction only. Add coarse operational
limits/monitoring, but preserve lock, validation and idempotency independently. **ADAPT**.

## 5. Apps Script operational limits (one realistic store)

This architecture can be reasonable for a lightly loaded pilot, but correctness must not
depend on quota folklore. The reference health response's hard-coded daily email limit of
50 can differ by account and provider changes. **REJECT** hard-coded quota claims.

- **Execution and concurrency:** keep lock-held work bounded; reject/retry on lock timeout;
  measure p95 handler and reconciliation time. Never send email while holding the booking
  lock. A burst from a rich-menu campaign can hit simultaneous-execution constraints even
  for one store.
- **LockService:** use the correct shared script/store lock, acquire before both conflict
  checks, and do not continue unlocked after timeout. Test contention using separate real
  executions because a synchronous mock cannot establish mutual exclusion semantics.
- **CacheService:** accept eviction and non-atomic counters. Never store the only copy of a
  booking, idempotency outcome, token revocation, or authorization decision there.
- **Calendar:** batch/list bounded windows, paginate, declare the Advanced service, and
  distinguish quota/transient/auth errors from empty results. Exponential backoff must stay
  within execution limits and preserve retry identity.
- **Sheets:** avoid whole-sheet scans per request; use stable schema/version, bounded indexes
  or archival strategy, append/read-back verification, and formula-injection protection.
  Measure at realistic row counts before migration rather than prematurely replacing it.
- **Email:** notification quota/failure never rolls back or misstates a durable booking.
  Persist notification status and retry separately.
- **Scheduled reconciliation:** use a trigger with a checkpoint/bounded batch, mutual
  exclusion with mutations, idempotent repairs and alerts when errors repeat. One-store
  scale does not remove Apps Script execution ceilings.

## 6. Tests, CI, and how much confidence they provide

The repository contains backend test functions/fixtures, frontend tests, and browser/E2E
artifacts. They are useful examples, especially the explicit all-day behavior fixture, but
most Google services are mocked. Mocks prove branch behavior, not Calendar propagation,
attendee-response identity, all-day date semantics, LockService exclusion, Sheet visibility,
quota errors, or Apps Script deployment request behavior.

Material gaps include zero min notice, exact notice/horizon boundaries, arbitrary
duration/buffers, multiple-calendar partial failure, DST, idempotent retry, genuinely
parallel booking, failure at every mutation boundary, cancel/reschedule races, orphan-event
recovery, moved events, token entropy/replay, CacheService eviction/races and formula
injection. Known production fixes are not all protected by targeted regression tests.

Checked-in GitHub Actions are maintenance cleanup and secret scanning, not a required
normal unit/integration workflow on every change. Repository files cannot prove branch
protection; that is GitHub settings state and must be verified separately by an authorized
maintainer. Therefore “tests exist” does not establish that `main` is protected. **REJECT**
this process for Slotflow; Issue #4 must install required CI before backend implementation.

## 7. Significant history and mandatory Slotflow regressions

| History/fix | Independently observed implication | Slotflow regression |
|---|---|---|
| `c92dec7`: declare Advanced Calendar service | Earlier `Calendar.Events.list` could throw `Calendar is not defined`; catch/fallback used `CalendarApp`, whose available fields produce different transparency behavior | undeclared/unavailable service fails closed; transparent and opaque results cannot change through silent fallback |
| transparency/free-busy changes | Event classification is provider-field-sensitive and differs between API surfaces | opaque, transparent, cancelled, self-declined, ambiguous attendee and all-day matrix against fixtures plus deployed integration |
| `883880e`: maintenance secret moved from URL to POST body | URL credential transport was recognized as a leak vector | no credential in URL/log; invalid/absent secret rejected |
| double-booking/ledger fixes | Calendar-only re-read did not cover propagation lag; lock + Sheet overlap was added | two parallel requests, lock timeout, lagged Calendar read, and overlapping pending intent |
| ghost/reconciliation fixes | Calendar deletion/drift required a grace period and proof rather than treating lookup errors as absence | fresh row preserved, proven missing repaired, transient error unchanged, orphan inverse detected |
| rescheduling fixes | Multi-step delete/create/row update still has destructive partial-failure boundaries | inject failure before/after each external write and race reschedule vs cancel |
| eventual-consistency changes | `flush()`/immediate reread cannot create cross-service atomicity | delayed Calendar visibility and delayed/failed Sheet finalization preserve one logical booking |
| rate-limit changes | Cache/caller-key controls remain bypassable and non-atomic | correctness survives cache loss and identifier rotation |

## 8. Final disposition

**ADOPT:** explicit Advanced Calendar declaration, opaque/transparent distinction, interval
subtraction, secret scanning, secrets absent from URLs, reconciliation grace/uncertainty,
and the principle of a shared critical-section lock.

**ADAPT:** low-cost GAS/Sheets shape, multi-calendar classification, lock + ledger overlap,
pending lifecycle/idempotency, expiring management tokens, bidirectional reconciliation,
rate-limit friction, notifications, and scheduled maintenance.

**REJECT:** named availability events, ignored opaque all-day closures, truthy numeric
defaults, silent semantic fallback, Calendar-first create without durable intent, successful
cancellation after failed deletion, delete-first reschedule, client/CORS authorization,
CacheService as a boundary, duplicated client enforcement config, hard-coded quotas, and a
development process without required correctness CI.

No implementation from the reference is approved for copying. The audit is complete as a
decision input, but Issue #2 should only be closed after repository maintainers confirm its
acceptance criteria and branch-protection status; Issue #3 owns the unresolved contracts
listed below.

## Issue #3 questions deliberately left open

1. Exact lifecycle states, legal transitions, retry ownership and terminal/manual-review
   states for create/cancel/reschedule.
2. Whether reschedule uses create-new-then-retire-old, a temporary hold, or another saga,
   and how capacity is interpreted while both events exist.
3. Exact min-notice/max-advance boundary, and whether buffers count against those boundaries.
4. Which calendars are mandatory conflict sources and how self-declined/owner response is
   identified for shared/invited events.
5. Whether manually moved/deleted Slotflow events automatically rewrite lifecycle state or
   require owner review, including grace duration.
6. Token lifetime, one-time-use rules and customer re-authentication requirement.
7. Reconciliation cadence, repair authority, event metadata marker and retention/archive
   policy for the Sheet ledger.

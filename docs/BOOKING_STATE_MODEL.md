# Booking state and consistency model

Status: authoritative MVP contract for issues #4 and #5. This document specifies behavior,
not an implementation. The pilot has one owner, one location and one shared booking-mutation
lock.

## 1. Authorities and availability invariant

No single system is authoritative for every fact:

- **Configured settings** own weekly business hours, dated exceptions, store IANA timezone,
  services, duration, buffers, notice, horizon and format/location policy. They define when a
  customer may request service.
- **Google Calendar** owns actual operational occupancy across every configured required
  occupancy calendar. An opaque ordinary owner/Gemini event blocks without a ledger row.
- **The Slotflow Sheets ledger** owns immutable booking identity, lifecycle and operation
  version, idempotency outcomes, customer/service metadata, the Calendar association and
  recovery/audit state. It is not another calendar.

For every candidate, availability is:

```text
normalized configured bookable windows
MINUS the union of required Calendar occupancy
MINUS the union of active or uncertain ledger occupancy
```

Calendar reads are required and fail closed. Ledger subtraction is an additional safety net
for propagation lag and uncertain cross-system writes, not evidence that Calendar events may
be ignored. `create_pending`, `confirmed`, `cancel_pending`, `reschedule_pending` and
`recovery_needed` contribute the intervals in the occupancy table below. `failed` and
`cancelled` do not.

## 2. Identity, versions and records

Each logical customer appointment receives one immutable, opaque `booking_id`. An ordinary
reschedule keeps that ID, customer identity, service identity, management capability and,
where the event exists, `calendar_event_id`. It is a mutation, not a replacement booking.

`version` is a non-negative integer. A durable create intent starts at `0`; successful create
confirmation sets it to `1`. Each successfully finalized reschedule, cancellation, reconciled
manual move or reconciled manual deletion increments it exactly once. Entering a pending or
recovery state does not increment it. Retrying or reconciling an already applied operation
does not increment it again. Calendar private metadata carries the intended resulting version.

The booking row distinguishes immutable identity from mutable current facts. Append-only
operation/audit records distinguish attempts and transitions from the current snapshot; row
updates must never erase the evidence needed to diagnose a partial failure.

## 3. Lifecycle

`rescheduled` is an API outcome and audit event, not a persistent state. A successfully moved
booking returns to `confirmed` with a new interval and version.

### State table

| State | Meaning | Clean customer success? | Reconciliation | Terminal? |
|---|---|---:|---|---:|
| `create_pending` | Durable create intent exists; Calendar creation has not been finalized. | No | Find the tagged event; finalize, safely retry creation, or prove no event and fail. | No |
| `confirmed` | Calendar and ledger agree that the current appointment exists. | Yes: `confirmed` or completed `rescheduled` | Verify event identity/time/version and process manual drift after grace. | No |
| `cancel_pending` | Cancellation intent is durable; deletion is in progress. | No | Prove absent and cancel, or observe present and safely retry. | No |
| `reschedule_pending` | Move intent is durable; old and target outcomes are not yet finalized. | No | Inspect the exact event and finalize old or target facts; retry only when safe. | No |
| `cancelled` | Event deletion/absence is proven and cancellation is final. | Yes: `cancelled` | Ensure no matching tagged live event remains; otherwise escalate to recovery. | Yes for customer mutations |
| `failed` | Create is definitively unapplied: there is no unresolved external side effect. | No | None normally; retain for audit. | Yes |
| `recovery_needed` | Calendar and ledger may disagree or an external mutation outcome is uncertain. | No | Use `pending_operation`, intervals, event/tag and evidence to converge. | No |

`failed` is used for a failed create because there is no prior active booking to restore.
A definitely unapplied cancel or reschedule returns to `confirmed` and records a failed
operation audit entry; it does not destroy the booking's lifecycle state.

### Legal transitions

| From | To | Cause |
|---|---|---|
| new intent | `create_pending` | Valid request passed locked conflict checks and intent is durable. |
| `create_pending` | `confirmed` | Tagged Calendar event and final ledger facts are durable. |
| `create_pending` | `failed` | Calendar creation is definitively rejected/not applied. |
| `create_pending` | `recovery_needed` | Create outcome or ledger finalization is uncertain. |
| `confirmed` | `cancel_pending` | Durable cancellation intent. |
| `cancel_pending` | `cancelled` | Event is confirmed deleted or proven absent. |
| `cancel_pending` | `confirmed` | Delete is definitively not applied; audit failure. |
| `cancel_pending` | `recovery_needed` | Delete outcome/finalization is uncertain. |
| `confirmed` | `reschedule_pending` | Durable target interval intent. |
| `reschedule_pending` | `confirmed` | Update finalized at target, or definitely not applied at old interval. |
| `reschedule_pending` | `recovery_needed` | Update outcome/finalization is uncertain. |
| `recovery_needed` | `confirmed` | Reconciliation proves a live current event and finalizes its facts. |
| `recovery_needed` | `cancelled` | Cancellation/manual deletion is proven. |
| `recovery_needed` | `failed` | Create is proven unapplied with no event. |
| `cancelled` | `recovery_needed` | A matching live tagged event contradicts the terminal snapshot. |
| `confirmed` | `confirmed` | Reconciled manual move; update interval/version and audit source atomically. |
| `confirmed` | `cancelled` | Grace-expired, confirmed manual deletion reconciliation. |

Every other transition is illegal. In particular, `cancelled` cannot be rescheduled and
`failed` cannot be revived. A fresh create may use a new idempotency key and booking ID.

### Occupancy/blocking table

All intervals are occupied intervals including buffers.

| State | Current/old interval | Target interval |
|---|---:|---:|
| `create_pending` | Yes (requested interval) | N/A |
| `confirmed` | Yes | N/A |
| `cancel_pending` | Yes | N/A |
| `reschedule_pending` | Yes | Yes, unless byte-for-byte/equivalent instant interval |
| `cancelled` | No | No |
| `failed` | No | No |
| `recovery_needed` | Every interval that could contain the event | Every target that could contain it |

Calendar occupancy is unioned with this table. Thus a pending create blocks immediately,
and unresolved cancellation never reopens the old interval. Unresolved reschedule blocks
both old and target even if they overlap partially.

## 4. Shared transaction and lock rules

All create/cancel/reschedule mutations and reconciliation repairs use the same store-level
(script-level in GAS) mutation lock. The critical section contains the idempotency re-check,
ledger conflict check, all required Calendar reads, durable intent, Calendar mutation and
ledger finalization. The implementation may not release it between those steps.

A lock timeout performs no mutation, does not continue unlocked, and returns `retryable_busy`.
Notification delivery is queued/performed after releasing the lock. Slow notification or
failure cannot alter booking state.

## 5. Create

Under server authority, the sequence is:

1. Parse the explicit-offset ISO 8601 request and validate shape/limits.
2. Resolve `service_id`; derive duration, buffers, notice, horizon, format/location and zone.
3. Validate the caller-generated idempotency key and canonical request hash.
4. Acquire the store mutation lock; on timeout stop with `retryable_busy`.
5. Re-check durable idempotency under lock and replay/conflict/recover as section 8 requires.
6. Reject overlap with all blocking ledger intervals.
7. Read every required occupancy Calendar and reject any Calendar/ledger conflict. Any
   required read failure returns `provider_unavailable` without writing an intent.
8. Persist and verify a `create_pending` intent, booking ID, requested intervals, operation
   record and intended version `1`.
9. Insert one Calendar event with private booking/version properties.
10. Persist its event ID/metadata, then atomically finalize the snapshot as `confirmed`,
    version `1`, and its replayable result.
11. Release the lock and enqueue notification work.

### Create failure matrix

| Boundary/result | Durable state and blocking | API result / retry behavior |
|---|---|---|
| Validation/service/idempotency validation fails | No mutation | `validation_failure` (or `idempotency_conflict`). |
| Lock times out | No mutation | `retryable_busy`; same key may retry. |
| Ledger/Calendar conflict | No mutation | `conflict`. |
| Required Calendar read fails | No mutation | `provider_unavailable`; never claim free. |
| Pending intent write fails or cannot be verified | No Calendar call; no valid intent | `provider_unavailable`; retry may restart. |
| Pending succeeds; Calendar create definitely fails | `failed`; interval no longer blocks; audit exact failure | Non-success; same key replays failure, a new key may attempt afresh. |
| Calendar create outcome is unknown | `recovery_needed`; requested interval blocks | `processing`; retry reconciles by private tag before any create. |
| Calendar succeeds; event-ID or final ledger write fails | `recovery_needed` (or still observable pending); interval blocks | `processing`; tagged event is adopted/finalized, never duplicated. |
| Finalization succeeds; HTTP response is lost | `confirmed`; interval blocks | Same key returns stored `confirmed` result. |
| Notification fails | `confirmed`; notification `failed_retryable` | Booking success remains true; notification retries separately. |

The private `slotflowBookingId` makes recovery lookup possible even if storing the returned
event ID failed. No retry may call Calendar create until reconciliation proves that this
logical operation has no event and it remains the same durable intent.

## 6. Cancellation

After authentication and validation, lock and re-check idempotency/version. From
`confirmed`, persist `cancel_pending`, delete the exact associated event, prove deletion or
confirmed absence, then write `cancelled`, increment version once and store the result.

| Boundary/result | Durable state and blocking | API result / recovery |
|---|---|---|
| Already cancelled, same canonical operation | `cancelled`; no block | Replay `cancelled`. |
| Conflict/invalid state/token/version | Unchanged | Non-success, non-enumerating where applicable. |
| Pending write fails | `confirmed`; old blocks | `provider_unavailable`; no delete call. |
| Event is already proven absent | `cancelled`; no block; version increments | `cancelled`. |
| Delete definitely fails/not applied | `confirmed`; old blocks; failed audit | Non-success; safe fresh attempt. |
| Delete returns success and absence is established | `cancelled`; no block | `cancelled`. |
| Delete outcome unknown or finalization fails | `recovery_needed`; old blocks | `processing`; reconcile before retrying delete. |
| Notification fails | `cancelled`; no block | Cancellation stays successful; retry notification. |

A not-found response is proof only when it is the provider's authoritative not-found for the
exact event, not an authorization, quota, transport or transient lookup error.

## 7. Reschedule

Slotflow patches the existing tagged Calendar event in place; it never uses delete-old then
create-new. Under the lock it persists `reschedule_pending` with old and target intervals,
then checks the target against ledger and every required Calendar. During that Calendar
check it excludes **only** the exact `calendar_event_id` associated with this booking.
All other Slotflow and ordinary events remain blocking. It patches that event with the new
service interval and intended version, finalizes current/occupied intervals and version,
returns to `confirmed`, and records `rescheduled` in the audit/result.

- **Same time:** if all derived service/occupied instants and service policy are unchanged,
  this is a successful idempotent no-op: no pending state, patch or version increment. The
  operation/result is still stored against its idempotency key.
- **Partial overlap:** allowed if the target, after excluding only the exact old event, has no
  other conflict. Old and target are protected while pending.
- **Adjacent:** `[old_start, old_end)` and `[old_end, target_end)` do not overlap; the exact
  old event is still the only exclusion.
- **Third-party event:** always blocks the overlapping target, including one that overlaps
  the old booking.

### Reschedule failure matrix

| Boundary/result | Durable state and blocking | API result / recovery |
|---|---|---|
| Target validation or availability conflict | `confirmed`; old blocks | `validation_failure` or `conflict`; no intent/mutation. |
| Required read fails | `confirmed`; old blocks | `provider_unavailable`; no intent/mutation. |
| Pending write fails | `confirmed`; old blocks | Non-success; no Calendar patch. |
| Associated event is proven missing before patch | `recovery_needed`; old and target block during grace/investigation | `processing`; resolve as manual deletion, never create a replacement implicitly. |
| Patch definitely fails/not applied and old event is proven unchanged | `confirmed`; old blocks; failed audit | Non-success; fresh attempt is safe. |
| Patch outcome unknown | `recovery_needed`; old and target block | `processing`; inspect exact event/tag before any patch retry. |
| Patch succeeds; ledger finalization fails | `recovery_needed`; old and target block | `processing`; adopt event time, finalize once, never create another event. |
| Finalization succeeds; response is lost | `confirmed` at target | Same key replays stored `rescheduled` result. |
| Notification fails | `confirmed` at target | Reschedule remains successful; retry notification. |

## 8. Durable idempotency

Every mutation requires a caller-generated, opaque idempotency key. The durable operation
identity is `(operation_type, booking_id-or-create-scope, idempotency_key)` and stores a
canonical request hash, status, resulting booking/version, timestamps and sanitized prior
result/error. Canonicalization has one specified representation: validated semantic fields,
normalized instants and server-resolved policy identifiers; object ordering or cosmetic
JSON differences cannot change the hash.

- Same identity and hash: return the stored terminal result, or run on-demand reconciliation
  and return/converge an unresolved logical operation. Never launch a second operation.
- Same identity and a different hash: return `idempotency_conflict` without mutation.
- A key cannot be reused across operation types or bookings; such reuse conflicts.
- Operation records are durable in Sheets and retained at least through the booking's
  management lifetime. CacheService may accelerate lookup or abuse controls only.

This contract covers response loss at every success boundary. Concurrent equal requests are
serialized by the lock and see the same durable operation.

## 9. Calendar event identity and manual changes

Slotflow-created events use the Google Calendar API through the Apps Script Advanced Calendar
service for create/get/patch/delete/list semantics and private extended properties:

- `slotflowBookingId`: immutable `booking_id`
- `slotflowVersion`: intended successful version as a decimal integer

Title, description and customer name are display data, never identity. Exact property names
are frozen for the MVP. Arbitrary owner events are opaque occupancy only and are never
imported as customer bookings.

The default manual-change grace is configurable and **10 minutes**, measured from the first
successful observation of mismatch/absence; transient failed reads do not start or complete
it. Reconciliation records the observation and keeps ledger protection during grace.

- A tagged event moved by the owner and still mismatched after grace is an intentional
  operational override. Calendar time wins. Under lock, update service and occupied intervals
  (using configured buffers), increment version once, update the event's version tag if
  needed, audit `manual_calendar_move`, and enqueue a customer notification. Do not revert it.
- A tagged event confirmed absent on successful authoritative checks after grace is an owner
  cancellation. Under lock, increment version, set `cancelled`, audit
  `calendar_manual_delete`, and enqueue notification. A transient error is never absence.
- If a manual move violates customer bookable hours, notice/horizon, or conflicts with an
  opaque event, Calendar still wins operational occupancy. Record a recovery/audit warning
  for owner review; do not silently move it back or offer the interval.

## 10. Reconciliation

A scheduled reconciler runs every **five minutes** by default and can also run on-demand for
an idempotent retry in `processing`. It shares the mutation lock, processes bounded batches,
persists a checkpoint, and makes each repair idempotent. Each inspected booking/operation
records `last_checked_at`, `last_error` and `recovery_reason` as applicable.

Both directions are mandatory:

| Detection | Action after reliable evidence/grace |
|---|---|
| Confirmed ledger, event missing | Preserve old occupancy during grace; then apply manual-delete rule. |
| Tagged event, matching pending/incomplete finalization | Associate by booking tag/event ID and finalize the one logical operation. |
| Tagged event, no ledger identity | Do not invent customer data or import it; quarantine/report for operator recovery while Calendar continues to block. |
| Same event ID, different time | Apply manual-move rule after grace unless it matches an unresolved reschedule target. |
| Time/version mismatch | Determine from pending operation and evidence; update stale side only when safe, increment at most once. |
| Create recovery | Find by tag; finalize if present, retry only after proven absent, or fail safely. |
| Cancel recovery | Confirm absence then cancel; if present, retry deletion only when operation identity makes it safe. |
| Reschedule recovery | If event is at target finalize; if provably at old restore confirmed/optionally retry; otherwise keep recovery and both blocks. |

Repeated ambiguity remains `recovery_needed` and is surfaced for owner/operator action. Repair
must never import an unrelated event, delete an event based only on title, or interpret a
provider error as absence.

## 11. Time, boundaries and all-day events

All service and occupancy intervals are half-open `[start, end)`: conflict exists exactly
when `a.start < b.end && b.start < a.end`. Therefore an appointment ending at 11:00 does not
conflict with one whose occupied interval starts at 11:00.

- The customer-visible service interval `[service_start, service_end)` must fit wholly inside
  one normalized configured bookable window: `window_start <= service_start` and
  `service_end <= window_end`.
- `occupied_start = service_start - pre_buffer`; `occupied_end = service_end + post_buffer`.
  Buffers may extend outside business hours, but the entire occupied interval participates in
  Calendar and ledger conflict checks.
- `min_notice` and `max_advance` compare the service start, not occupied start, against the
  server's current instant. Earliest is inclusive: `service_start >= now + min_notice`.
  Latest is inclusive: `service_start <= now + max_advance`. Zero notice is valid.
- Inputs are explicit ISO 8601 instants with offset or `Z`. Business-hour/all-day expansion
  uses the configured store IANA zone, never the device zone.
- Per ADR-014, opaque all-day events occupy their half-open date range
  `[start.date, end.date)` expanded at store-local midnight. Cancelled or explicitly
  transparent events do not block.

DST gap/fold behavior and exact equality at every boundary are required regression cases.
For example, with a 10:00–18:00 window, 30-minute pre-buffer and a 10:00 service start, the
service fits; occupancy begins at 09:30 and is permitted only if 09:30 onward is conflict-free.

## 12. Notification and management capability

Notification status is separate from lifecycle: `pending`, `sent`, or `failed_retryable`.
It also records notification kind/attempt metadata. Create, cancel, reschedule and reconciled
manual changes enqueue the appropriate kind; delivery failure never rolls lifecycle back.

A management token is not an idempotency key. It is generated with a CSPRNG with at least
128 bits of entropy, scoped to one booking's allowed management actions, compared/located in
a timing-safe and non-enumerating manner, and stored only as a cryptographic hash. Plaintext
is returned only at capability issuance and never written to the ledger or logs. The same
capability remains valid across ordinary reschedules, so notification delivery is not needed
to obtain a replacement. It expires/revokes after the appointment lifecycle no longer needs
management; exact retention duration is configurable policy, and expired/invalid/unknown
tokens produce the same public response.

## 13. API outcomes

| Outcome | When it may be returned |
|---|---|
| `confirmed` | Create Calendar event and confirmed ledger snapshot agree durably. |
| `cancelled` | Exact event is confirmed deleted/absent and ledger is durably cancelled. |
| `rescheduled` | Existing event and confirmed ledger durably agree on the target/version (or defined same-time no-op). |
| `conflict` | A reliable locked ledger/Calendar check finds overlap. |
| `validation_failure` | Request or server-policy validation fails before mutation. |
| `retryable_busy` | Mutation lock times out; no mutation occurred. |
| `provider_unavailable` | A required read/pre-intent provider action fails; availability/success is not asserted. |
| `processing` | An external mutation or finalization may have happened and recovery is required. |

Only the first three are clean lifecycle successes. `processing` includes a stable operation
reference but no assertion of success or clean failure; polling/retrying with the same key
retrieves or converges on the eventual stored outcome. Public errors do not disclose whether
a booking ID/token exists.

## 14. MVP Sheets ledger contract

This is a logical contract, not a relational-database design. A versioned Sheet schema may
use a booking snapshot sheet plus append-only operations/audit sheet.

| Class | Minimum fields |
|---|---|
| Immutable booking | `booking_id`, `created_at`, original customer reference/contact fields, `management_token_hash` |
| Mutable snapshot | `version`, `state`, `service_id`, `service_start`, `service_end`, `occupied_start`, `occupied_end`, `calendar_event_id`, current customer/contact fields where correction is allowed, `updated_at`, `change_source`, notification state/kind |
| Pending/recovery | `pending_operation`, pending operation ID, `previous_service/occupied_interval`, `target_service/occupied_interval`, intended version, `recovery_reason`, `last_checked_at`, `last_error` |
| Durable operation | operation type, idempotency key, canonical request hash, operation status, booking ID, base/result version, stored result/error, created/updated timestamps |
| Append-only audit | booking ID, before/after state and version, operation ID, change source (API, reconciliation, `manual_calendar_move`, `calendar_manual_delete`), timestamp and sanitized diagnostic |

Pending/recovery fields are cleared from the current snapshot only after their resolution is
also append-only audited. Customer contact correction policy may mutate contact fields, but
booking ID, original identity evidence and historical values remain auditable. Sheet writes
require schema validation, formula-injection protection and write/read verification.

## 15. Test translation and resolved scope

Issue #4 can treat every table row and boundary above as a test case. Provider mocks test
branch behavior; deployed contract tests are still required for private properties,
not-found/error classification, patch semantics, LockService exclusion and visibility lag.
There is no Issue #3 question blocking the harness: configuration values such as retention
length may be fixtures, while their behavioral invariants are fixed here.
